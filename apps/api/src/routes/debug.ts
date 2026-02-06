import { classifyTask } from '../lib/taskClassifier.js';
import { selectModels, getRoutingDecision } from '../lib/router.js';
import { estimateTokensFromMessages } from '../lib/tokens.js';

type Body = {
  messages?: Array<{ role: string; content: string }>;
  priority?: string;
  latency_pref?: string;
  max_cost?: number;
};
type Req = { body?: Body; request_id?: string };
type Rep = { status: (c: number) => Rep; send: (b: unknown) => Rep };

function isValidMessages(messages: unknown): messages is Array<{ role: string; content: string }> {
  if (!Array.isArray(messages) || messages.length === 0) return false;
  return messages.every(
    (m) =>
      m &&
      typeof m === 'object' &&
      (m as { role?: string }).role &&
      (m as { content?: string }).content
  );
}

function isValidPriority(value: unknown): value is 'cheap' | 'balanced' | 'best' {
  return value === undefined || value === 'cheap' || value === 'balanced' || value === 'best';
}

function isValidLatency(value: unknown): value is 'fast' | 'normal' {
  return value === undefined || value === 'fast' || value === 'normal';
}

export async function debugRoutes(app: { post: (path: string, h: (req: Req, reply: Rep) => Rep | Promise<Rep>) => void }) {
  app.post('/debug', async (req: Req, reply: Rep) => {
    const { messages, priority = 'balanced', latency_pref = 'normal' } = req.body ?? {};
    if (!isValidMessages(messages)) {
      return reply.status(400).send({
        error: { code: 'invalid_request', message: 'messages is required and must be non-empty' },
        request_id: req.request_id,
      });
    }
    if (!isValidPriority(priority)) {
      return reply.status(400).send({
        error: { code: 'invalid_request', message: 'priority must be cheap, balanced, or best' },
        request_id: req.request_id,
      });
    }
    if (!isValidLatency(latency_pref)) {
      return reply.status(400).send({
        error: { code: 'invalid_request', message: 'latency_pref must be fast or normal' },
        request_id: req.request_id,
      });
    }
    const task_type = classifyTask(messages ?? []);
    const tokenEstimate = estimateTokensFromMessages(messages ?? []);

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
