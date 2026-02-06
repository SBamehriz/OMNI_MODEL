import { randomUUID } from 'crypto';
import { supabase } from './db.js';
import { checkRateLimit } from './rateLimit.js';

export type RequestContext = { org_id: string; user_id: string };

type Req = { headers: Record<string, string | string[] | undefined>; request_id?: string };
type Rep = { status: (code: number) => Rep; send: (body: unknown) => Rep; header: (name: string, value: string | number) => Rep };

function getApiKey(req: Req): string | null {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const xKey = req.headers['x-api-key'];
  if (typeof xKey === 'string') return xKey.trim();
  return null;
}

function errorReply(reply: Rep, code: string, message: string, statusCode: number, request_id?: string) {
  return reply.status(statusCode).send({
    error: { code, message },
    request_id,
  });
}

export async function authPlugin(app: {
  decorateRequest: (name: string, value: unknown) => void;
  addHook: (name: string, fn: (req: Req & { context?: RequestContext }, reply: Rep) => Promise<Rep | void>) => void;
}) {
  app.decorateRequest('context', null as RequestContext | null);
  app.decorateRequest('request_id', null as string | null);

  app.addHook('onRequest', async (req: Req & { context?: RequestContext }, reply: Rep) => {
    if (!req.request_id) req.request_id = randomUUID();
    reply.header('x-request-id', req.request_id);
  });

  app.addHook('preHandler', async (req: Req & { context?: RequestContext }, reply: Rep) => {
    if (!req.request_id) req.request_id = randomUUID();
    const path = (req as { raw?: { url?: string } }).raw?.url?.split('?')[0];
    if (path === '/health' || path === '/ready') return;
    const key = getApiKey(req);
    if (!key) {
      return errorReply(reply, 'invalid_api_key', 'Missing or invalid API key', 401, req.request_id);
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, org_id')
      .eq('api_key_hash', key)
      .limit(1)
      .single();

    if (error || !user) {
      return errorReply(reply, 'invalid_api_key', 'Invalid API key', 401, req.request_id);
    }

    const limit = Number(process.env.RATE_LIMIT_MAX ?? '100');
    const windowSeconds = Number(process.env.RATE_LIMIT_WINDOW_SEC ?? '60');
    const rate = await checkRateLimit({
      key: `org:${user.org_id}`,
      limit,
      windowSeconds,
    });
    if (rate.remaining !== null) {
      reply.header('x-ratelimit-limit', limit);
      reply.header('x-ratelimit-remaining', rate.remaining);
      reply.header('x-ratelimit-reset', rate.resetSeconds ?? windowSeconds);
    }
    if (!rate.ok) {
      return errorReply(reply, 'rate_limited', 'Rate limit exceeded', 429, req.request_id);
    }

    req.context = {
      org_id: user.org_id,
      user_id: user.id,
    };
  });
}
