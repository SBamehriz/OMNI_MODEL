// eslint-disable-next-line @typescript-eslint/no-require-imports
const Fastify = require('fastify') as (opts?: { logger?: boolean }) => {
  register: (p: (instance: any) => Promise<void>, opts?: { prefix?: string }) => Promise<void>;
  get: (path: string, h: (req: any, reply: any) => Promise<unknown>) => void;
  addHook: (name: string, fn: (req: any, reply: any) => Promise<void> | void) => void;
  setErrorHandler: (fn: (err: Error, req: any, reply: any) => void) => void;
  listen: (opts: { port: number; host: string }) => Promise<string>;
  log: { info: (o: object, s?: string) => void; error: (o: object, s?: string) => void };
};

import { chatRoutes } from './routes/chat.js';
import { usageRoutes } from './routes/usage.js';
import { modelsRoutes } from './routes/models.js';
import { debugRoutes } from './routes/debug.js';
import { authPlugin } from './lib/auth.js';

const app = Fastify({ logger: true });

app.addHook('onResponse', async (req, reply) => {
  const request_id = req.request_id ?? 'unknown';
  const url = req.raw?.url ?? '';
  const method = req.raw?.method ?? '';
  const statusCode = reply.statusCode;
  const responseTime = reply.getResponseTime?.() ?? undefined;
  app.log.info(
    { request_id, method, url, statusCode, responseTime },
    'request completed'
  );
});

app.setErrorHandler((err, req, reply) => {
  const request_id = req.request_id ?? undefined;
  app.log.error({ err, request_id }, 'unhandled error');
  reply.status(500).send({
    error: { code: 'internal_error', message: 'Internal server error' },
    request_id,
  });
});

app.get('/health', async () => ({ status: 'ok' }));

await app.register(authPlugin);
await app.register(chatRoutes, { prefix: '/v1' });
await app.register(usageRoutes, { prefix: '/v1' });
await app.register(modelsRoutes, { prefix: '/v1' });
await app.register(debugRoutes, { prefix: '/v1/router' });

const port = Number(process.env.PORT) || 3000;
await app.listen({ port, host: '0.0.0.0' });
