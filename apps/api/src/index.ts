import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { supabase } from './lib/db.js';
import { chatRoutes } from './routes/chat.js';
import { usageRoutes } from './routes/usage.js';
import { modelsRoutes } from './routes/models.js';
import { debugRoutes } from './routes/debug.js';
import { authPlugin } from './lib/auth.js';

const app = Fastify({ logger: true });

const corsOrigin = process.env.CORS_ORIGIN ?? '';
await app.register(cors, {
  origin: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : true,
  credentials: true,
});

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

app.get('/ready', async (_req, reply) => {
  const { error } = await supabase.from('orgs').select('id').limit(1).maybeSingle();
  if (error) {
    return reply.status(503).send({ status: 'degraded', message: 'Database unavailable' });
  }
  return reply.send({ status: 'ok' });
});

await app.register(authPlugin);
await app.register(chatRoutes, { prefix: '/v1' });
await app.register(usageRoutes, { prefix: '/v1' });
await app.register(modelsRoutes, { prefix: '/v1' });
await app.register(debugRoutes, { prefix: '/v1/router' });

const port = Number(process.env.PORT) || 3000;
await app.listen({ port, host: '0.0.0.0' });
