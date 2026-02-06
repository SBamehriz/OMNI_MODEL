import { classifyTask } from '../lib/taskClassifier.js';
import { selectModels, getRoutingDecision } from '../lib/router.js';
import { estimateTokensFromMessages } from '../lib/tokens.js';
import { DebugRoutingRequestSchema } from '../lib/schemas.js';

type Req = { body?: unknown; request_id?: string };
type Rep = { status: (c: number) => Rep; send: (b: unknown) => Rep };

export async function debugRoutes(app: { post: (path: string, h: (req: Req, reply: Rep) => Rep | Promise<Rep>) => void }) {
  app.post('/debug', async (req: Req, reply: Rep) => {
    // Validate request body with Zod
    const parseResult = DebugRoutingRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'validation_error',
          message: 'Invalid request body',
          details: parseResult.error.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        },
        request_id: req.request_id,
      });
    }

    const { messages, priority, latency_pref } = parseResult.data;
    const task_type = classifyTask(messages);
    const tokenEstimate = estimateTokensFromMessages(messages);

    const availableProviders = [
      process.env.OPENAI_API_KEY ? 'openai' : null,
      process.env.ANTHROPIC_API_KEY ? 'anthropic' : null,
      process.env.GOOGLE_API_KEY ? 'google' : null,
      process.env.OPENROUTER_API_KEY ? 'openrouter' : null,
      process.env.GROQ_API_KEY ? 'groq' : null,
    ].filter(Boolean) as string[];
    if (availableProviders.length === 0) {
      return reply.status(500).send({
        error: { code: 'provider_error', message: 'No providers configured' },
        request_id: req.request_id,
      });
    }

    const models = await selectModels(task_type, priority, latency_pref, {
      maxCost: req.body?.max_cost,
      tokenEstimate,
      availableProviders,
    });

    if (req.body?.max_cost !== undefined && models.length === 0) {
      return reply.status(400).send({
        error: { code: 'max_cost_exceeded', message: 'No available models satisfy max_cost' },
        request_id: req.request_id,
      });
    }
    if (models.length === 0) {
      return reply.status(500).send({
        error: { code: 'internal_error', message: 'No models available for configured providers' },
        request_id: req.request_id,
      });
    }

    const decision = getRoutingDecision(models, task_type, priority, latency_pref);

    return reply.send({
      task_type,
      considered_models: models.slice(0, 5).map((m) => ({
        provider: m.provider,
        model_name: m.model_name,
      })),
      selected_model: `${decision.provider}/${decision.model_name}`,
      reason: decision.reason,
      request_id: req.request_id,
    });
  });
}
