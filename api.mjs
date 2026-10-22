// Web Request/Response API; only the store adapter depends on the local runtime.
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

export async function handleApi(request, store) {
  const pathname = new URL(request.url).pathname;
  if (pathname === '/api/products') {
    if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
    return json({ products: await store.listProducts() });
  }
  if (pathname !== '/api/orders') return json({ error: 'Not found.' }, 404);
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) {
    return json({ error: 'Cross-origin submissions are not allowed.' }, 403);
  }
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return json({ error: 'Send application/json.' }, 415);
  }
  let body;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 16384) return json({ error: 'Request too large.' }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ error: 'Invalid JSON.' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid order.' }, 400);
  const name = typeof body.customer_name === 'string' ? body.customer_name.trim() : '';
  const email = typeof body.customer_email === 'string' ? body.customer_email.trim() : '';
  if (!name || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name) ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof body.request_key !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(body.request_key) ||
      !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) {
    return json({ error: 'Provide a valid name, email, request key, and 1–50 products.' }, 400);
  }
  const ids = new Set();
  for (const item of body.items) {
    if (!item || !Number.isSafeInteger(item.product_id) || item.product_id < 1 ||
        !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 100 ||
        !Number.isSafeInteger(item.expected_unit_price_cents) || item.expected_unit_price_cents < 0 || ids.has(item.product_id)) {
      return json({ error: 'Each product must have a unique ID, a quantity from 1 to 100, and an expected price in integer cents.' }, 400);
    }
    ids.add(item.product_id);
  }
  const order = {
    customer_name: name, customer_email: email,
    items: body.items.map(({ product_id, quantity, expected_unit_price_cents }) => ({ product_id, quantity, expected_unit_price_cents })).sort((a, b) => a.product_id - b.product_id),
  };
  // Canonical client intent identifies retries; catalog prices remain server-controlled.
  const fingerprint = JSON.stringify(order);
  try {
    const result = await store.saveOrder(order, body.request_key, fingerprint);
    return json({ order: result.order, repeated: result.repeated }, result.repeated ? 200 : 201);
  } catch (error) {
    if (error.status) return json({ error: error.message,
      ...(error.code === 'PRICE_CHANGED' ? { code: error.code, prices: error.prices } : {}),
    }, error.status);
    console.error('Order save failed:', error.message);
    return json({ error: 'The order could not be saved. Please try again.' }, 500);
  }
}
