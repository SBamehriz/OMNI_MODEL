import { supabase } from '../lib/db.js';
import { premiumEstimate } from '../lib/providers.js';
import type { RequestContext } from '../lib/auth.js';

type Query = { from?: string; to?: string };
type Req = {
  context: RequestContext;
  query?: Query;
  request_id?: string;
  log?: { warn: (o: object, s: string) => void };
};
type Rep = { status: (c: number) => Rep; send: (b: unknown) => Rep };

export async function usageRoutes(app: { get: (path: string, h: (req: Req, reply: Rep) => Promise<Rep | void>) => void }) {
  app.get('/usage', async (req: Req, reply: Rep) => {
    const ctx = req.context;
    const { from, to } = req.query ?? {};

    let query = supabase
      .from('requests')
      .select('model_used, cost, success, created_at, tokens, tokens_input, tokens_output')
      .eq('org_id', ctx.org_id);

    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const { data: rows, error } = await query;

    if (error) {
      req.log?.warn({ err: error }, 'Usage query failed');
      return reply.status(500).send({
        error: { code: 'internal_error', message: 'Failed to fetch usage' },
        request_id: req.request_id,
      });
    }

    const total_requests = rows?.length ?? 0;
    const total_cost = rows?.reduce((sum, r) => sum + Number(r.cost ?? 0), 0) ?? 0;
    const total_tokens = rows?.reduce((sum, r) => sum + Number(r.tokens ?? 0), 0) ?? 0;
    const total_tokens_input = rows?.reduce((sum, r) => sum + Number(r.tokens_input ?? 0), 0) ?? 0;
    const total_tokens_output = rows?.reduce((sum, r) => sum + Number(r.tokens_output ?? 0), 0) ?? 0;

    const byModel = (rows ?? []).reduce<Record<string, { count: number; cost: number }>>((acc, r) => {
      const m = r.model_used ?? 'unknown';
      if (!acc[m]) acc[m] = { count: 0, cost: 0 };
      acc[m].count += 1;
      acc[m].cost += Number(r.cost ?? 0);
      return acc;
    }, {});

    const premiumCost = (rows ?? []).reduce((sum, r) => {
      const inTokens = Number(r.tokens_input ?? 0);
      const outTokens = Number(r.tokens_output ?? 0);
      if (inTokens + outTokens > 0) {
        return sum + premiumEstimate(inTokens, outTokens);
      }
      const totalTokens = Number(r.tokens ?? 0);
      if (!totalTokens) return sum;
      const half = totalTokens / 2;
      return sum + premiumEstimate(half, half);
    }, 0);
    const estimated_savings = Math.max(0, premiumCost - total_cost);

    const byDayMap = (rows ?? []).reduce<Record<string, { date: string; requests: number; cost: number; savings: number }>>(
      (acc, r) => {
        const date = r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : 'unknown';
        if (!acc[date]) acc[date] = { date, requests: 0, cost: 0, savings: 0 };
        acc[date].requests += 1;
        const c = Number(r.cost ?? 0);
        acc[date].cost += c;
        const inTokens = Number(r.tokens_input ?? 0);
        const outTokens = Number(r.tokens_output ?? 0);
        let est = 0;
        if (inTokens + outTokens > 0) {
          est = premiumEstimate(inTokens, outTokens);
        } else {
          const totalTokens = Number(r.tokens ?? 0);
          if (totalTokens) {
            const half = totalTokens / 2;
            est = premiumEstimate(half, half);
          }
        }
        acc[date].savings += Math.max(0, est - c);
        return acc;
      },
      {}
    );

    const by_day = Object.values(byDayMap).sort((a, b) => (a.date < b.date ? -1 : 1));

    return reply.send({
      total_requests,
      total_cost: Math.round(total_cost * 1e8) / 1e8,
      estimated_savings: Math.round(estimated_savings * 1e8) / 1e8,
      total_tokens,
      total_tokens_input,
      total_tokens_output,
      by_day: by_day.map((d) => ({
        date: d.date,
        requests: d.requests,
        cost: Math.round(d.cost * 1e8) / 1e8,
        savings: Math.round(d.savings * 1e8) / 1e8,
      })),
      by_model: Object.entries(byModel).map(([model, v]) => ({
        model,
        count: v.count,
        cost: Math.round(v.cost * 1e8) / 1e8,
      })),
    });
  });
}
