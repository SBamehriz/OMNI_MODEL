import { supabase } from '../lib/db.js';

type Req = { request_id?: string; log?: { warn: (o: object, s: string) => void } };
type Rep = { status: (c: number) => Rep; send: (b: unknown) => Rep };

export async function modelsRoutes(app: { get: (path: string, h: (req: Req, reply: Rep) => Promise<Rep | void>) => void }) {
  app.get('/models', async (req: Req, reply: Rep) => {
    const { data: rows, error } = await supabase
      .from('models')
      .select('provider, model_name, cost_input, cost_output, avg_latency, strengths, supports_functions, supports_vision, max_tokens');

    if (error) {
      req.log?.warn({ err: error }, 'Models query failed');
      return reply.status(500).send({
        error: { code: 'internal_error', message: 'Failed to fetch models' },
        request_id: req.request_id,
      });
    }

    return reply.send(
      (rows ?? []).map((r) => ({
        provider: r.provider,
        model_name: r.model_name,
        cost_input: Number(r.cost_input),
        cost_output: Number(r.cost_output),
        avg_latency: r.avg_latency,
        strengths: r.strengths ?? [],
        supports_functions: r.supports_functions,
        supports_vision: r.supports_vision,
        max_tokens: r.max_tokens,
      }))
    );
  });
}
