import { supabase } from './db.js';

export type RequestContext = { org_id: string; user_id: string };

type Req = { headers: Record<string, string | string[] | undefined> };
type Rep = { status: (code: number) => Rep; send: (body: unknown) => Rep };

function getApiKey(req: Req): string | null {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const xKey = req.headers['x-api-key'];
  if (typeof xKey === 'string') return xKey.trim();
  return null;
}

function errorReply(reply: Rep, code: string, message: string, statusCode: number) {
  return reply.status(statusCode).send({
    error: { code, message },
    request_id: undefined,
  });
}

export async function authPlugin(app: {
  decorateRequest: (name: string, value: unknown) => void;
  addHook: (name: string, fn: (req: Req & { context?: RequestContext }, reply: Rep) => Promise<Rep | void>) => void;
}) {
  app.decorateRequest('context', null as RequestContext | null);

  app.addHook('preHandler', async (req: Req & { context?: RequestContext }, reply: Rep) => {
    const path = (req as { raw?: { url?: string } }).raw?.url?.split('?')[0];
    if (path === '/health') return;
    const key = getApiKey(req);
    if (!key) {
      return errorReply(reply, 'invalid_api_key', 'Missing or invalid API key', 401);
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, org_id')
      .eq('api_key_hash', key)
      .limit(1)
      .single();

    if (error || !user) {
      return errorReply(reply, 'invalid_api_key', 'Invalid API key', 401);
    }

    req.context = {
      org_id: user.org_id,
      user_id: user.id,
    };
  });
}
