const { test } = require('node:test');
const assert = require('node:assert/strict');

const BASE = process.env.BASE_URL || 'http://localhost:8080';
const json = { 'Content-Type': 'application/json' };
const get = (p, headers) => fetch(BASE + p, { headers });
const post = (p, body) => fetch(BASE + p, { method: 'POST', headers: json, body: JSON.stringify(body) });

let createdOrder;

// ---------- Produk ----------
test('GET /products mengembalikan daftar produk yang bentuknya benar', async () => {
  const res = await get('/product-service/products');
  assert.equal(res.status, 200);
  const list = await res.json();
  assert.ok(Array.isArray(list) && list.length > 0);
  for (const p of list) {
    assert.equal(typeof p.id, 'number');
    assert.equal(typeof p.name, 'string');
    assert.equal(typeof p.price, 'number');
    assert.equal(typeof p.stock, 'number');
  }
});

test('GET /products/:id mengembalikan satu produk', async () => {
  const res = await get('/product-service/products/1');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).id, 1);
});

test('GET /products/:id untuk id tak dikenal mengembalikan 404', async () => {
  const res = await get('/product-service/products/9999');
  assert.equal(res.status, 404);
  assert.ok((await res.json()).error);
});

// ---------- Pesanan ----------
test('POST /orders berhasil (201) dan mengurangi stok produk', async () => {
  const before = await (await get('/product-service/products/2')).json();
  const res = await post('/order-service/orders', { productId: 2, quantity: 1 });
  assert.equal(res.status, 201);
  createdOrder = await res.json();
  assert.equal(createdOrder.productId, 2);
  assert.equal(createdOrder.quantity, 1);
  assert.equal(createdOrder.total, before.price);
  assert.equal(createdOrder.status, 'confirmed');

  const after = await (await get('/product-service/products/2')).json();
  assert.equal(after.stock, before.stock - 1);
});

test('POST /orders dengan quantity melebihi stok mengembalikan 409', async () => {
  const res = await post('/order-service/orders', { productId: 2, quantity: 100000 });
  assert.equal(res.status, 409);
});

test('POST /orders dengan input tidak valid mengembalikan 400', async () => {
  assert.equal((await post('/order-service/orders', { productId: 2, quantity: 0 })).status, 400);
  assert.equal((await post('/order-service/orders', { productId: 2, quantity: 'abc' })).status, 400);
});

test('POST /orders untuk produk tak dikenal mengembalikan 404', async () => {
  const res = await post('/order-service/orders', { productId: 9999, quantity: 1 });
  assert.equal(res.status, 404);
});

test('GET /orders memuat pesanan yang baru dibuat', async () => {
  assert.ok(createdOrder, 'test pembuatan pesanan harus lulus lebih dulu');
  const list = await (await get('/order-service/orders')).json();
  assert.ok(list.some((o) => o.id === createdOrder.id));
});

// ---------- Tambahan Lab 12: health, header ID, metrik ----------
test('GET /product-service/health mengembalikan status ok', async () => {
  const res = await get('/product-service/health');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'ok');
});

test('GET /health pada gateway mengembalikan status ok', async () => {
  const res = await get('/health');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'ok');
});

test('Respons POST /orders memuat header X-Request-Id', async () => {
  // memakai input tidak valid (400) supaya stok tidak ikut berkurang; header tetap harus ada
  const res = await post('/order-service/orders', { productId: 2, quantity: 0 });
  assert.equal(res.status, 400);
  const id = res.headers.get('x-request-id');
  assert.ok(id && id.length > 0, 'header X-Request-Id harus ada');
});

test('X-Request-Id dari klien dipakai ulang sampai ke respons', async () => {
  const res = await get('/order-service/orders', { 'X-Request-Id': 'tes-klien-123' });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-request-id'), 'tes-klien-123');
});

test('GET /order-service/metrics memuat angka metrik', async () => {
  const res = await get('/order-service/metrics');
  assert.equal(res.status, 200);
  const m = await res.json();
  assert.equal(m.service, 'order-service');
  assert.equal(typeof m.requests, 'number');
  assert.equal(typeof m.errors5xx, 'number');
  assert.equal(typeof m.avgMs, 'number');
});
