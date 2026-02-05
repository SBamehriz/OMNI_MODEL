import type OpenAI from 'openai';
import { classifyTask } from '../lib/taskClassifier.js';
import { selectModels, getRoutingDecision, type ModelRow } from '../lib/router.js';
import {
  chatWithProvider,
  costForModel,
  premiumEstimate,
  savingsEstimate,
} from '../lib/providers.js';
import { supabase } from '../lib/db.js';

const DEFAULT_MODEL = 'gpt-4o-mini';

type ChatBody = {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  priority?: 'cheap' | 'balanced' | 'best';
  latency_pref?: 'fast' | 'normal';
  max_cost?: number;
};

async function tryChat(
  models: ModelRow[],
  messages: OpenAI.ChatCompletionMessageParam[]
): Promise<{ content: string; inputTokens: number; outputTokens: number; model: string; provider: string } | null> {
  for (const m of models) {
    try {
      const result = await chatWithProvider(m.provider, m.model_name, messages);
      return { ...result, provider: m.provider };
    } catch {
      continue;
    }
  }
  return null;
}

type Req = { context: { org_id: string; user_id: string }; body?: ChatBody; log?: { error: (o: object, s: string) => void } };
type Rep = { status: (c: number) => Rep; send: (b: unknown) => Rep };

export async function chatRoutes(app: { post: (path: string, h: (req: Req, reply: Rep) => Promise<Rep | void>) => void }) {
  app.post('/chat', async (req: Req, reply: Rep) => {
    const ctx = req.context;
    const { messages, priority = 'balanced', latency_pref = 'normal', max_cost } = req.body ?? {};

    if (!messages?.length) {
      return reply.status(400).send({
        error: { code: 'invalid_request', message: 'messages is required and must be non-empty' },
        request_id: undefined,
      });
    }

    const start = Date.now();
    const taskType = classifyTask(messages);
    let models = await selectModels(taskType, priority, latency_pref);
    if (!models.length) {
      models = [{ id: '', provider: 'openai', model_name: DEFAULT_MODEL, cost_input: 0.00015, cost_output: 0.0006, avg_latency: 400, strengths: ['chat'] }];
    }

    const result = await tryChat(models, messages as OpenAI.ChatCompletionMessageParam[]);
    const latency_ms = Date.now() - start;

    if (!result) {
      await supabase.from('requests').insert({
        org_id: ctx.org_id,
        task_type: taskType,
        model_used: models[0]?.model_name ?? DEFAULT_MODEL,
        tokens: 0,
        cost: 0,
        latency_ms,
        success: false,
      });
      return reply.status(502).send({
        error: { code: 'provider_error', message: 'All providers failed' },
        request_id: undefined,
      });
    }

    const cost = costForModel(result.provider, result.model, result.inputTokens, result.outputTokens);
    const premiumCost = premiumEstimate(result.inputTokens, result.outputTokens);
    const savings_estimate = savingsEstimate(cost, premiumCost);

    const { data: reqRow } = await supabase
      .from('requests')
      .insert({
        org_id: ctx.org_id,
        task_type: taskType,
        model_used: result.model,
        tokens: result.inputTokens + result.outputTokens,
        cost,
        latency_ms,
        success: true,
      })
      .select('id')
      .single();

    if (reqRow?.id) {
      const decision = getRoutingDecision(models, taskType);
      await supabase.from('routing_logs').insert({
        request_id: reqRow.id,
        considered_models: models.slice(0, 3).map((m) => ({ provider: m.provider, model_name: m.model_name })),
        final_model: result.model,
        reason: decision.reason,
      });
    }

    return reply.send({
      output: result.content,
      model_used: result.model,
      cost: Math.round(cost * 1e8) / 1e8,
      latency_ms,
      savings_estimate: Math.round(savings_estimate * 1e8) / 1e8,
    });
  });

  app.post('/agent-step', async (req: Req, reply: Rep) => {
    const ctx = req.context;
    const { messages, priority = 'balanced', latency_pref = 'normal' } = req.body ?? {};
    if (!messages?.length) {
      return reply.status(400).send({
        error: { code: 'invalid_request', message: 'messages is required and must be non-empty' },
        request_id: undefined,
      });
    }
    const start = Date.now();
    const taskType = 'agent_step';
    let models = await selectModels('chat', priority, latency_pref);
    if (!models.length)
      models = [{ id: '', provider: 'openai', model_name: DEFAULT_MODEL, cost_input: 0.00015, cost_output: 0.0006, avg_latency: 400, strengths: ['chat'] }];

    const result = await tryChat(models, messages as OpenAI.ChatCompletionMessageParam[]);
    const latency_ms = Date.now() - start;
    if (!result) {
      await supabase.from('requests').insert({
        org_id: ctx.org_id,
        task_type: 'agent_step',
        model_used: DEFAULT_MODEL,
        tokens: 0,
        cost: 0,
        latency_ms,
        success: false,
      });
      return reply.status(502).send({
        error: { code: 'provider_error', message: 'All providers failed' },
        request_id: undefined,
      });
    }
    const cost = costForModel(result.provider, result.model, result.inputTokens, result.outputTokens);
    const savings_estimate = savingsEstimate(cost, premiumEstimate(result.inputTokens, result.outputTokens));
    await supabase.from('requests').insert({
      org_id: ctx.org_id,
      task_type: 'agent_step',
      model_used: result.model,
      tokens: result.inputTokens + result.outputTokens,
      cost,
      latency_ms,
      success: true,
    });
    return reply.send({
      output: result.content,
      model_used: result.model,
      cost: Math.round(cost * 1e8) / 1e8,
      latency_ms,
      savings_estimate: Math.round(savings_estimate * 1e8) / 1e8,
    });
  });
}
