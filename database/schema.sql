PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE CHECK (length(trim(code)) > 0),
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    category TEXT,
    purity TEXT,
    description TEXT,
    weight_g REAL CHECK (weight_g > 0),
    cost_cents INTEGER CHECK (cost_cents >= 0),
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    image_path TEXT,
    tag TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    is_visible INTEGER NOT NULL DEFAULT 0 CHECK (is_visible IN (0, 1))
) STRICT;

CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    customer_name TEXT NOT NULL CHECK (length(trim(customer_name)) > 0),
    customer_email TEXT NOT NULL CHECK (length(trim(customer_email)) > 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    request_key TEXT,
    request_fingerprint TEXT
) STRICT;

CREATE TABLE order_items (
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    product_name TEXT NOT NULL CHECK (length(trim(product_name)) > 0),
    product_description TEXT,
    unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
    PRIMARY KEY (order_id, product_id)
) STRICT;

CREATE INDEX order_items_product_id_idx ON order_items(product_id);
CREATE UNIQUE INDEX orders_request_key_idx ON orders(request_key);

COMMIT;
