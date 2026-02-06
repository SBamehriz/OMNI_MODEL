import 'dotenv/config';
import { validateEnv, getEnv } from './lib/env.js';

// Validate environment BEFORE starting server
// This catches configuration errors early and provides clear error messages
const env = validateEnv();

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { supabase } from './lib/db.js';
import { chatRoutes } from './routes/chat.js';
import { usageRoutes } from './routes/usage.js';
import { modelsRoutes } from './routes/models.js';
import { debugRoutes } from './routes/debug.js';
import { authPlugin } from './lib/auth.js';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: env.CORS_ORIGIN ? env.CORS_ORIGIN.split(',').map((o) => o.trim()) : true,
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

await app.listen({ port: env.PORT, host: '0.0.0.0' });

// Graceful shutdown handlers
// Allow in-flight requests to complete before shutting down
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received, starting graceful shutdown...`);

  try {
    // Stop accepting new connections
    await app.close();
    console.log('✓ HTTP server closed');

    // Supabase client connections will be cleaned up automatically
    console.log('✓ Database connections closed');

    console.log('✓ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - let the error handler deal with it
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});
