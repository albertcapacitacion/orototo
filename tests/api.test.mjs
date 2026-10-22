import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore } from '../database/local.mjs';
import { handleApi } from '../api.mjs';
import { createLocalDatabase } from '../database/create-local.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testDirectory = path.join(root, '.local/tests');
mkdirSync(testDirectory, { recursive: true });
function fixture(t) {
  const filename = path.join(testDirectory, `${crypto.randomUUID()}.sqlite`);
  const db = new DatabaseSync(filename);
  db.exec(readFileSync(path.join(root, 'database/schema.sql'), 'utf8'));
  db.exec(readFileSync(path.join(root, 'database/seed.sql'), 'utf8'));
  db.exec('UPDATE products SET is_visible = 1 WHERE id IN (1, 2)');
  const store = openStore(filename);
  t.after(() => { store.close(); db.close(); });
  return { db, store, filename };
}
const sampleOrder = () => ({ customer_name: 'Test Customer', customer_email: 'test@example.invalid', request_key: crypto.randomUUID(), items: [{ product_id: 1, quantity: 2, expected_unit_price_cents: 15000 }] });
const post = (body, headers = {}) => new Request('http://localhost:5173/api/orders', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});

test('catalog includes visible products only and excludes internal cost', async t => {
  const { store } = fixture(t);
  const response = await handleApi(new Request('http://localhost:5173/api/products'), store);
  const { products } = await response.json();
  assert.deepEqual(products.map(product => product.id), [1, 2]);
  assert.ok(products.every(product => !('cost_cents' in product)));
});
test('order uses database prices, consolidates snapshots, and survives reopening', async t => {
  const { db, store, filename } = fixture(t);
  const request = sampleOrder();
  request.items[0].unit_price_cents = 1;
  const response = await handleApi(post(request), store);
  assert.equal(response.status, 201);
  const { order } = await response.json();
  assert.equal(order.subtotal_cents, 30000);
  assert.equal(order.items[0].product_name, 'Chain');
  assert.equal(order.items[0].quantity, 2);
  db.exec("UPDATE products SET name = 'Changed', price_cents = 999 WHERE id = 1");
  const reopened = openStore(filename);
  t.after(() => reopened.close());
  const retry = await (await handleApi(post(request), reopened)).json();
  assert.equal(retry.order.items[0].product_name, 'Chain');
  assert.equal(retry.order.subtotal_cents, 30000);
});
test('retries save one order and reject a changed request with the same key', async t => {
  const { db, store } = fixture(t);
  const request = sampleOrder();
  const responses = await Promise.all([handleApi(post(request), store), handleApi(post(request), store)]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 201]);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM orders').get().count, 1);
  request.items[0].quantity = 3;
  assert.equal((await handleApi(post(request), store)).status, 409);
});
test('hidden and unknown products reject the whole order', async t => {
  const { db, store } = fixture(t);
  for (const id of [3, 999]) {
    const request = sampleOrder();
    request.items.push({ product_id: id, quantity: 1, expected_unit_price_cents: 0 });
    assert.equal((await handleApi(post(request), store)).status, 409);
  }
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM orders').get().count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM order_items').get().count, 0);
});
test('item insertion failure rolls back both order and items', t => {
  const { db, store } = fixture(t);
  db.exec("CREATE TRIGGER fail_item BEFORE INSERT ON order_items WHEN NEW.product_id = 2 BEGIN SELECT RAISE(ABORT, 'test failure'); END;");
  const order = sampleOrder();
  order.items.push({ product_id: 2, quantity: 1, expected_unit_price_cents: 20000 });
  assert.throws(() => store.saveOrder(order, order.request_key, JSON.stringify(order)), /test failure/);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM orders').get().count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM order_items').get().count, 0);
});
test('malformed orders and duplicate item IDs are rejected without writes', async t => {
  const { db, store } = fixture(t);
  const invalid = [null, {}, { ...sampleOrder(), customer_email: 'invalid' }, { ...sampleOrder(), items: [] },
    { ...sampleOrder(), items: [{ product_id: 1, quantity: -1 }] },
    { ...sampleOrder(), items: [{ product_id: 1, quantity: 1.5 }] },
    { ...sampleOrder(), items: [{ product_id: 1, quantity: 101 }] },
    { ...sampleOrder(), items: [{ product_id: 1, quantity: 1, expected_unit_price_cents: -1 }] },
    { ...sampleOrder(), items: [{ product_id: 1, quantity: 1, expected_unit_price_cents: 1.5 }] },
    { ...sampleOrder(), items: [{ product_id: 1, quantity: 1 }, { product_id: 1, quantity: 1 }] }];
  for (const order of invalid) assert.equal((await handleApi(post(order), store)).status, 400);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM orders').get().count, 0);
});

test('stale prices reject the entire order until the displayed price is reconfirmed', async t => {
  const { db, store } = fixture(t);
  const request = sampleOrder();
  request.items.push({ product_id: 2, quantity: 1, expected_unit_price_cents: 20000 });
  db.exec('UPDATE products SET price_cents = 18000 WHERE id = 1');
  const rejected = await handleApi(post(request), store);
  assert.equal(rejected.status, 409);
  const conflict = await rejected.json();
  assert.equal(conflict.code, 'PRICE_CHANGED');
  assert.deepEqual(conflict.prices, [{ product_id: 1, unit_price_cents: 18000 }, { product_id: 2, unit_price_cents: 20000 }]);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM orders').get().count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM order_items').get().count, 0);
  request.items[0].expected_unit_price_cents = 18000;
  const accepted = await handleApi(post(request), store);
  assert.equal(accepted.status, 201);
  assert.equal((await accepted.json()).order.subtotal_cents, 56000);
});

test('changed expected price cannot override the database price', async t => {
  const { db, store } = fixture(t);
  const request = sampleOrder();
  request.items[0].expected_unit_price_cents = 1;
  const response = await handleApi(post(request), store);
  assert.equal(response.status, 409);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM orders').get().count, 0);
});

test('whitespace-only edits with the same key reuse a saved order after a price change', async t => {
  const { db, store } = fixture(t);
  const request = sampleOrder();
  const initial = await (await handleApi(post(request), store)).json();
  db.exec('UPDATE products SET price_cents = 18000 WHERE id = 1');
  request.customer_name += ' ';
  request.customer_email = ' ' + request.customer_email + ' ';
  const response = await handleApi(post(request), store);
  assert.equal(response.status, 200);
  const retry = await response.json();
  assert.equal(retry.order.id, initial.order.id);
  assert.equal(retry.order.subtotal_cents, 30000);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM orders').get().count, 1);
});

test('first-run initializer creates a usable hidden sample catalog and preserves existing files', t => {
  const filename = path.join(testDirectory, `setup-${crypto.randomUUID()}.sqlite`);
  createLocalDatabase(filename);
  const store = openStore(filename);
  assert.deepEqual(store.listProducts(), []);
  store.close();
  const db = new DatabaseSync(filename);
  db.exec("UPDATE products SET name = 'Preserve existing data' WHERE id = 1");
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM products').get().count, 4);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM orders').get().count, 0);
  db.close();
  const before = readFileSync(filename);
  assert.throws(() => createLocalDatabase(filename), { code: 'EEXIST' });
  assert.deepEqual(readFileSync(filename), before);
});
test('API rejects foreign origins, oversized bodies, malformed JSON and wrong methods', async t => {
  const { store } = fixture(t);
  assert.equal((await handleApi(post(sampleOrder(), { Origin: 'https://other.example' }), store)).status, 403);
  assert.equal((await handleApi(post(sampleOrder(), { 'Content-Type': 'text/plain' }), store)).status, 415);
  assert.equal((await handleApi(post({ ...sampleOrder(), padding: 'x'.repeat(17000) }), store)).status, 413);
  assert.equal((await handleApi(new Request('http://localhost:5173/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }), store)).status, 400);
  assert.equal((await handleApi(new Request('http://localhost:5173/api/orders'), store)).status, 405);
});
