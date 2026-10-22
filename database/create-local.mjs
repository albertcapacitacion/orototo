import { DatabaseSync } from 'node:sqlite';
import { openSync, closeSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));

// Explicit first-run setup. Exclusive creation protects even an empty existing file.
export function createLocalDatabase(filename = path.join(directory, 'orototo.sqlite')) {
  const sql = ['schema.sql', 'seed.sql'].map(name => readFileSync(path.join(directory, name), 'utf8'));
  const file = openSync(filename, 'wx');
  closeSync(file);
  const db = new DatabaseSync(filename);
  try {
    for (const script of sql) db.exec(script);
  } finally { db.close(); }
  return filename;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const filename = createLocalDatabase();
    console.log(`Created ${filename}. Sample products are hidden. See database/README.md for the optional image/visibility step.`);
  } catch (error) {
    console.error(error.code === 'EEXIST'
      ? 'Database already exists; no changes made. Skip creation and see database/README.md.'
      : `Database setup failed: ${error.message}. Existing files were not overwritten.`);
    process.exitCode = 1;
  }
}
