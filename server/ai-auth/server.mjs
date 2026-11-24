/**
 * Self-hosted AI auth BFF (Hong Kong, behind nginx).
 *
 * One process per region:
 *   - .cn: 127.0.0.1:8090  (AI_BFF_PORT=8090)
 *   - .com: 127.0.0.1:8091 (AI_BFF_PORT=8091)
 *
 * nginx routes `/api/auth/*` on `www.<root>` to the matching port. No Vercel.
 */
import http from 'node:http';
import { createNodeHandler } from './sdk/index.js';
import { auth } from './config.mjs';

const handler = createNodeHandler(auth);
const host = process.env.AI_BFF_HOST || '127.0.0.1';
const port = Number(process.env.AI_BFF_PORT || 8090);

const server = http.createServer(async (req, res) => {
  const pathname = (req.url || '/').split('?')[0];
  if (pathname === '/health' || pathname === '/healthz') {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  try {
    await handler(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ai-bff] unhandled: ${message}`);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.setHeader('cache-control', 'no-store');
      res.end(JSON.stringify({ error: 'internal_error' }));
    } else {
      res.end();
    }
  }
});

server.listen(port, host, () => {
  console.log(`[ai-bff] listening on http://${host}:${port}`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`[ai-bff] ${signal} received, closing`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  });
}
