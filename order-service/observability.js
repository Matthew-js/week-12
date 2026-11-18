const crypto = require('crypto');

module.exports = function observability(app, service) {
  const stats = { startedAt: new Date().toISOString(), requests: 0, errors5xx: 0, totalMs: 0 };

  // Middleware: beri ID permintaan, ukur waktu, lalu tulis satu baris log JSON per permintaan.
  app.use((req, res, next) => {
    if (req.path === '/health') return next(); // jangan ramaikan log dengan polling dari monitor

    // pakai ID dari pemanggil (gateway / service lain) kalau ada, kalau tidak buat sendiri
    const id = req.headers['x-request-id'] || crypto.randomUUID();
    req.id = id;
    res.setHeader('X-Request-Id', id);

    const t0 = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      stats.requests++;
      stats.totalMs += ms;
      if (res.statusCode >= 500) stats.errors5xx++;
      console.log(JSON.stringify({
        time: new Date().toISOString(), service, id,
        method: req.method, path: req.originalUrl, status: res.statusCode, ms: Math.round(ms),
      }));
    });
    next();
  });

  // GET /health -> service hidup
  app.get('/health', (req, res) =>
    res.json({ status: 'ok', service, uptimeSec: Math.round(process.uptime()) }));

  // GET /metrics -> angka ringkas sejak service menyala
  app.get('/metrics', (req, res) =>
    res.json({
      service,
      startedAt: stats.startedAt,
      requests: stats.requests,
      errors5xx: stats.errors5xx,
      avgMs: stats.requests ? Math.round(stats.totalMs / stats.requests) : 0,
    }));
};
