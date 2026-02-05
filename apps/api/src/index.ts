// eslint-disable-next-line @typescript-eslint/no-require-imports
const Fastify = require('fastify') as (opts?: { logger?: boolean }) => {
    register: (p: (instance: any) => Promise<void>, opts?: { prefix?: string }) => Promise<void>;
    get: (path: string, h: (req: any, reply: any) => Promise<unknown>) => void;
    listen: (opts: { port: number; host: string }) => Promise<string>;
};

import { chatRoutes } from './routes/chat.js';
import { usageRoutes } from './routes/usage.js';
import { modelsRoutes } from './routes/models.js';
import { debugRoutes } from './routes/debug.js';
import { authPlugin } from './lib/auth.js';

const app = Fastify({ logger: true });

app.get('/health', async () => ({ status: 'ok' }));

await app.register(authPlugin);
await app.register(chatRoutes, { prefix: '/v1' });
await app.register(usageRoutes, { prefix: '/v1' });
await app.register(modelsRoutes, { prefix: '/v1' });
await app.register(debugRoutes, { prefix: '/v1/router' });

const port = Number(process.env.PORT) || 3000;
await app.listen({ port, host: '0.0.0.0' });
