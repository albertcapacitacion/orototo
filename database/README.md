# Oro Toto database

`orototo.sqlite` is the local store database. The Node server reads the catalog
and saves orders here. The CSV inventory report remains browser-session-only.

- `products`: catalog data, USD prices/costs in integer cents, and visibility.
  `is_visible` defaults to `0` (hidden). `is_active` defaults to `1` and allows
  retirement without deleting historical references.
- `orders`: customer name, customer email, UTC creation timestamp, and unique
  request key/fingerprint used to identify checkout retries.
- `order_items`: products and positive integer quantities for each order, with
  product name, description, and unit price snapshots. One row per product per
  order. Subtotal is `SUM(quantity * unit_price_cents)`.

The local database contains the four synthetic products from
`output/playwright/inventory-sample.csv`. CSV IDs map to `products.code`;
`products.id` is an independent internal key. With the user's approval, A1–A4
now have generated demo image paths and `is_visible = 1`. Prices and other
catalog data were preserved. Stock storage and handling are deferred.

## Run locally

Requires Node.js with built-in `node:sqlite`. The complete setup was verified
with Node.js 22.23.4, which prints an experimental SQLite warning. No npm
installation or separate SQLite CLI is required.

For a **fresh installation without `database/orototo.sqlite`**, run this from
the project root:

```powershell
node database/create-local.mjs
```

This creates exactly `database/orototo.sqlite` using `schema.sql` and `seed.sql`.
All four sample products start hidden. It refuses to change any existing file,
including an empty file. If initialization reports an error, stop and inspect it
before proceeding. The server never creates or seeds databases automatically.

After successful creation, to assign the supplied sample images and make A1–A4
visible, explicitly run:

```powershell
node database/prepare-local.mjs --confirm-images-and-visibility
```

That command backs up the DB and changes those sample products' image paths and
visibility. **For an existing installation, skip both setup commands** unless
you specifically intend the documented maintenance changes.

For normal use, run `start-server.bat` (or `node server.mjs`) and visit
http://localhost:5173. The server binds to 127.0.0.1 only. `PORT` selects another
port; `OROTOTO_DB` selects an existing DB. Restart the server after backend
source changes; browser live reload only refreshes frontend source files.

- `GET /api/products`: only `is_visible = 1`; excludes internal costs.
- `POST /api/orders`: JSON with `customer_name`, `customer_email`, `request_key`
  (a UUID), and `items: [{ product_id, quantity, expected_unit_price_cents }]`.
  Each expected price is the integer-cent price displayed to the customer.
  The server reads current prices and saves immutable item snapshots in one
  transaction. A mismatch returns 409 with `code: "PRICE_CHANGED"` and current
  `prices: [{ product_id, unit_price_cents }]`, without saving any order or items.
  The browser updates the displayed prices/total and requires another submission.
- Repeating the same key and order returns the existing order. Reusing a key
  for different order details returns 409. Hidden or unknown products return 409.
- The browser derives retry identity from trimmed customer details, sorted
  product IDs, quantities and displayed prices. Whitespace edits or an add/remove
  that restores the same cart keep the original key. A previously saved retry
  returns its original snapshots even if catalog prices have since changed.
- The browser sends the confirmed order to the existing Formspree endpoint only
  after saving. If notification fails, the order remains saved and the cart is
  held for notification retry. Retrying does not insert another order.

Notification delivery cannot be atomic with a SQLite write. Retrying an uncertain
Formspree response can send a duplicate email, identifiable by the same order ID.
Notification retry state and the cart remain in the open tab only; refreshing
does not remove a saved order from the DB, but loses that tab's retry controls.
No background notification delivery or order-management UI was added.

## Data safety and maintenance

Before the approved image/visibility updates and retry-column migration, a full
SQLite backup was created under `.local/backups/`. The original backup contains
four hidden products and zero orders. Runtime DBs, backups, and test outputs are
Git-ignored; never publish them as website assets.

`prepare-local.mjs` is an explicit maintenance script, not server startup code.
It requires `--confirm-images-and-visibility`, makes another backup, applies
`order-retries.sql` only when both columns are absent, and sets A1–A4's image
paths/visibility. Do not rerun it without intending those product updates.

## Recreating a separate database

Requires SQLite 3.37.0 or newer (STRICT tables). From the project root, use the
SQLite CLI with a **new, unused filename**; do not run these against live data:

```powershell
sqlite3 -bail database/new-orototo.sqlite ".read database/schema.sql" ".read database/seed.sql"
```

The SQL contains no DROP, DELETE, replacement inserts, or updates. Duplicate seed
codes fail instead of overwriting products. The original CSV is not needed to
recreate this sample database because `seed.sql` records its product values.

## Persistence and Sites compatibility

Enable `PRAGMA foreign_keys = ON` on **every connection**, before transactions.
Referenced products and orders cannot be deleted while their order items exist.
Save an order and all its items in one transaction; resolve product prices on the
server. Snapshots must be supplied when creating an order item, so subsequent
catalog changes do not change historical order details.

The server's explicit public-file allowlist does not expose this directory.
Local live reload watches only the three frontend source files; DB writes and
backup/test files do not reload checkout.

`api.mjs` uses Web Request/Response and an asynchronous-compatible store interface
(`listProducts`, `saveOrder`). `database/local.mjs` contains the Node SQLite code.
This keeps the API reusable for Sites, but this Node server is not itself a
Cloudflare Worker. Before Sites deployment, replace the SQLite adapter with a D1
adapter, use D1's transactional batch operations, create reviewed hosted schema
migrations, and run the same API checks against D1. A Sites server entrypoint,
hosting configuration, access policy, and data import still need separate vetting.
Nothing has been registered, uploaded, pushed, or deployed to Sites.

## Validation

Run `node --test tests/api.test.mjs`. Tests create isolated DBs in `.local/tests/`
and never write to `database/orototo.sqlite`. Browser QA also used a separate DB
and intercepted Formspree, so it sent no real emails. The automated tests cover
visibility/cost filtering, trusted prices, historical snapshots, reopening DBs,
idempotency, hidden products, transaction rollback, request validation, stale-price
reconfirmation, and safe first-run creation/refusal to overwrite existing files.
