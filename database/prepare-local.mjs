// Explicit maintenance step; never imported by the application server.
import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (!process.argv.includes('--confirm-images-and-visibility')) {
  throw new Error('This backs up the DB, adds order retry columns, sets four image paths and makes A1–A4 visible. Run only with --confirm-images-and-visibility after approval.');
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filename = path.join(root, 'database/orototo.sqlite');
statSync(filename);
const images = [
  ['A1', 'assets/products/a1-chain.png'], ['A2', 'assets/products/a2-ring.png'],
  ['A3', 'assets/products/a3-coin.png'], ['A4', 'assets/products/a4-pendant.png'],
];
for (const [, image] of images) if (!statSync(path.join(root, image)).size) throw new Error(`Empty image: ${image}`);
const original = new DatabaseSync(filename, { readOnly: true });
for (const [code] of images) if (!original.prepare('SELECT id FROM products WHERE code = ?').get(code)) throw new Error(`Missing product ${code}`);
const backupDirectory = path.join(root, '.local/backups');
mkdirSync(backupDirectory, { recursive: true });
const backupPath = path.join(backupDirectory, `orototo-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
await backup(original, backupPath);
original.close();
const db = new DatabaseSync(filename);
try {
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  const columns = db.prepare('PRAGMA table_info(orders)').all().map(column => column.name);
  if (!columns.includes('request_key') && !columns.includes('request_fingerprint')) {
    db.exec(readFileSync(path.join(root, 'database/order-retries.sql'), 'utf8'));
  } else if (!columns.includes('request_key') || !columns.includes('request_fingerprint')) {
    throw new Error('Unexpected partial retry migration; no product changes made.');
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    const update = db.prepare('UPDATE products SET image_path = ?, is_visible = 1 WHERE code = ?');
    for (const [code, image] of images) update.run(image, code);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  console.log(JSON.stringify({ backup: backupPath, updatedProducts: images.map(([code]) => code), orders: db.prepare('SELECT COUNT(*) AS count FROM orders').get().count }));
} finally { db.close(); }
