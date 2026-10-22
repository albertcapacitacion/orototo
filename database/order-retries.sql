-- Apply once, to a backed-up existing database; never during request handling.
BEGIN TRANSACTION;
ALTER TABLE orders ADD COLUMN request_key TEXT;
ALTER TABLE orders ADD COLUMN request_fingerprint TEXT;
CREATE UNIQUE INDEX orders_request_key_idx ON orders(request_key);
COMMIT;
