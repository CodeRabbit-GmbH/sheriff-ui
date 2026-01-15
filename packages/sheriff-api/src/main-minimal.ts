import * as http from 'http';
import { createManualRoutes } from './manual/manual.controller';

type Handler = (req: http.IncomingMessage, res: http.ServerResponse) => void | Promise<void>;

function start(): void {
  const host = process.env.HOST ?? '127.0.0.1';
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  const routes = new Map<string, Handler>();

  routes.set('GET /api/env', (_req, res) => {
    const json = JSON.stringify({ ok: true });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(json));
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.end(json);
  });

  for (const [key, handler] of createManualRoutes()) {
    routes.set(key, handler);
  }

  http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      res.end();
      return;
    }

    const method = req.method ?? 'GET';
    const urlPath = (req.url ?? '/').split('?')[0];
    const handler = routes.get(`${method} ${urlPath}`);

    if (handler) {
      await handler(req, res);
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  }).listen(port, host);
}

start();
