import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';

export function openStore(filename) {
  // Never silently create an empty replacement if the configured DB is missing.
  if (!existsSync(filename)) throw new Error('Configured database does not exist. For first-run setup, see database/README.md and node database/create-local.mjs.');
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  const columns = db.prepare('PRAGMA table_info(orders)').all().map(column => column.name);
  if (!columns.includes('request_key') || !columns.includes('request_fingerprint')) {
    db.close();
    throw new Error('Database needs the approved order retry migration; see database/README.md.');
  }
  const getOrder = id => {
    const order = db.prepare('SELECT id, customer_name, customer_email, created_at FROM orders WHERE id = ?').get(id);
    order.items = db.prepare(`SELECT product_id, quantity, product_name, product_description, unit_price_cents
      FROM order_items WHERE order_id = ? ORDER BY product_id`).all(id);
    order.subtotal_cents = order.items.reduce((sum, item) => sum + item.quantity * item.unit_price_cents, 0);
    return order;
  };
  return {
    close: () => db.close(),
    listProducts: () => db.prepare(`SELECT id, code, name, category, purity, description, weight_g,
      price_cents, image_path, tag FROM products WHERE is_visible = 1 ORDER BY id`).all(),
    saveOrder(order, requestKey, fingerprint) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const previous = db.prepare('SELECT id, request_fingerprint FROM orders WHERE request_key = ?').get(requestKey);
        if (previous) {
          if (previous.request_fingerprint !== fingerprint) throw Object.assign(new Error('This request key belongs to a different order.'), { status: 409 });
          const saved = getOrder(previous.id);
          db.exec('COMMIT');
          return { order: saved, repeated: true };
        }
        const items = order.items.map(item => {
          const product = db.prepare('SELECT id, name, description, price_cents FROM products WHERE id = ? AND is_visible = 1').get(item.product_id);
          if (!product) throw Object.assign(new Error('A selected product is no longer available. Refresh the catalog and review your cart.'), { status: 409 });
          return { ...item, product };
        });
        if (items.some(item => item.expected_unit_price_cents !== item.product.price_cents)) {
          throw Object.assign(new Error('Prices changed. Review the updated cart and submit again to confirm.'), {
            status: 409, code: 'PRICE_CHANGED',
            prices: items.map(item => ({ product_id: item.product_id, unit_price_cents: item.product.price_cents })),
          });
        }
        const subtotal = items.reduce((sum, item) => sum + item.quantity * item.product.price_cents, 0);
        if (!Number.isSafeInteger(subtotal)) throw Object.assign(new Error('Order total is too large.'), { status: 400 });
        const inserted = db.prepare(`INSERT INTO orders (customer_name, customer_email, request_key, request_fingerprint)
          VALUES (?, ?, ?, ?)`).run(order.customer_name, order.customer_email, requestKey, fingerprint);
        const id = Number(inserted.lastInsertRowid);
        const insertItem = db.prepare(`INSERT INTO order_items
          (order_id, product_id, quantity, product_name, product_description, unit_price_cents) VALUES (?, ?, ?, ?, ?, ?)`);
        for (const item of items) insertItem.run(id, item.product_id, item.quantity, item.product.name, item.product.description, item.product.price_cents);
        const saved = getOrder(id);
        db.exec('COMMIT');
        return { order: saved, repeated: false };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
