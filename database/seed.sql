-- Source: output/playwright/inventory-sample.csv (synthetic test inventory).
-- USD values are converted to integer cents. Stock is intentionally omitted.
-- Visibility defaults to 0; missing storefront metadata remains NULL.
PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

INSERT INTO products (code, name, category, purity, weight_g, cost_cents, price_cents)
VALUES
    ('A1', 'Chain', 'Necklaces', '14K', 5, 8000, 15000),
    ('A2', 'Ring', 'Rings', '18K', 3, 10000, 20000),
    ('A3', 'Coin', 'Coins', '24K', 31, 50000, 70000),
    ('A4', 'Pendant', 'Necklaces', '18K', 2, 12000, 25000);

COMMIT;
