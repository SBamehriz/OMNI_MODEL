import { supabase } from '../lib/db.js';
import type { RequestContext } from '../lib/auth.js';

type Query = { from?: string; to?: string };
type Req = { context: RequestContext; query?: Query; log?: { warn: (o: object, s: string) => void } };
type Rep = { status: (c: number) => Rep; send: (b: unknown) => Rep };

export async function usageRoutes(app: { get: (path: string, h: (req: Req, reply: Rep) => Promise<Rep | void>) => void }) {
  app.get('/usage', async (req: Req, reply: Rep) => {
    const ctx = req.context;
    const { from, to } = req.query ?? {};

    let query = supabase
      .from('requests')
      .select('model_used, cost, success, created_at')
      .eq('org_id', ctx.org_id);

    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const { data: rows, error } = await query;

    if (error) {
      req.log?.warn({ err: error }, 'Usage query failed');
      return reply.status(500).send({
        error: { code: 'internal_error', message: 'Failed to fetch usage' },
        request_id: undefined,
      });
    }

    const total_requests = rows?.length ?? 0;
    const total_cost = rows?.reduce((sum, r) => sum + Number(r.cost ?? 0), 0) ?? 0;

    const byModel = (rows ?? []).reduce<Record<string, { count: number; cost: number }>>((acc, r) => {
      const m = r.model_used ?? 'unknown';
      if (!acc[m]) acc[m] = { count: 0, cost: 0 };
      acc[m].count += 1;
      acc[m].cost += Number(r.cost ?? 0);
      return acc;
    }, {});

    const premiumEstimate = (rows ?? []).reduce((sum, r) => {
      const tokens = Number(r.cost) ? 500 : 0;
      const est = (tokens / 1000) * 0.0025 + (tokens / 1000) * 0.01;
      return sum + est;
    }, 0);
    const estimated_savings = Math.max(0, premiumEstimate - total_cost);

    return reply.send({
      total_requests,
      total_cost: Math.round(total_cost * 1e8) / 1e8,
      estimated_savings: Math.round(estimated_savings * 1e8) / 1e8,
      by_model: Object.entries(byModel).map(([model, v]) => ({
        model,
        count: v.count,
        cost: Math.round(v.cost * 1e8) / 1e8,
      })),
    });
  });
}
