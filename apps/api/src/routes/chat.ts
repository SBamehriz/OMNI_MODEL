import type OpenAI from 'openai';
import { classifyTask } from '../lib/taskClassifier.js';
import { selectModels, getRoutingDecision, type ModelRow } from '../lib/router.js';
import { estimateTokensFromMessages } from '../lib/tokens.js';
import { chatWithProvider, costForModel, premiumEstimate, savingsEstimate } from '../lib/providers.js';
import { supabase } from '../lib/db.js';

const DEFAULT_MODEL = 'gpt-4o-mini';

type ChatBody = {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  priority?: 'cheap' | 'balanced' | 'best';
  latency_pref?: 'fast' | 'normal';
  max_cost?: number;
};

function isValidMessages(
  messages: unknown
): messages is Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  if (!Array.isArray(messages) || messages.length === 0) return false;
  return messages.every(
    (m) =>
      m &&
      typeof m === 'object' &&
      (m as { role?: string }).role &&
      (m as { content?: string }).content &&
      ['user', 'assistant', 'system'].includes((m as { role?: string }).role as string)
  );
}

function isValidPriority(value: unknown): value is 'cheap' | 'balanced' | 'best' {
  return value === undefined || value === 'cheap' || value === 'balanced' || value === 'best';
}

function isValidLatency(value: unknown): value is 'fast' | 'normal' {
  return value === undefined || value === 'fast' || value === 'normal';
}

async function tryChat(
  models: ModelRow[],
  messages: OpenAI.ChatCompletionMessageParam[]
): Promise<{ content: string; inputTokens: number; outputTokens: number; model: string; provider: string; modelRow: ModelRow } | null> {
  for (const m of models) {
    try {
      const result = await chatWithProvider(m.provider, m.model_name, messages);
      return { ...result, provider: m.provider, modelRow: m };
    } catch {
      continue;
    }
  }
  return null;
}

type Req = {
  context: { org_id: string; user_id: string };
  body?: ChatBody;
  request_id?: string;
  log?: { error: (o: object, s: string) => void };
};
type Rep = { status: (c: number) => Rep; send: (b: unknown) => Rep };

export async function chatRoutes(app: { post: (path: string, h: (req: Req, reply: Rep) => Promise<Rep | void>) => void }) {
  app.post('/chat', async (req: Req, reply: Rep) => {
    const ctx = req.context;
    const { messages, priority = 'balanced', latency_pref = 'normal', max_cost } = req.body ?? {};

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
    if (max_cost !== undefined && (typeof max_cost !== 'number' || Number.isNaN(max_cost) || max_cost <= 0)) {
      return reply.status(400).send({
        error: { code: 'invalid_request', message: 'max_cost must be a positive number' },
        request_id: req.request_id,
      });
    }

    const start = Date.now();
    const taskType = classifyTask(messages);
    const tokenEstimate = estimateTokensFromMessages(messages);
    const availableProviders = [
      process.env.OPENAI_API_KEY ? 'openai' : null,
      process.env.ANTHROPIC_API_KEY ? 'anthropic' : null,
      process.env.OPENROUTER_API_KEY ? 'openrouter' : null,
      process.env.GROQ_API_KEY ? 'groq' : null,
    ].filter(Boolean) as string[];
    if (availableProviders.length === 0) {
      return reply.status(500).send({
        error: { code: 'provider_error', message: 'No providers configured' },
        request_id: req.request_id,
      });
    }

    let models = await selectModels(taskType, priority, latency_pref, {
      maxCost: max_cost,
      tokenEstimate,
      availableProviders,
    });
    if (max_cost !== undefined && models.length === 0) {
      return reply.status(400).send({
        error: { code: 'max_cost_exceeded', message: 'No available models satisfy max_cost' },
        request_id: req.request_id,
      });
    }
    if (!models.length) {
      if (availableProviders.includes('openai')) {
        models = [{ id: '', provider: 'openai', model_name: DEFAULT_MODEL, cost_input: 0.00015, cost_output: 0.0006, avg_latency: 400, strengths: ['chat'] }];
      } else {
        return reply.status(500).send({
          error: { code: 'internal_error', message: 'No models available for configured providers' },
          request_id: req.request_id,
        });
      }
    }

    const result = await tryChat(models, messages as OpenAI.ChatCompletionMessageParam[]);
    const latency_ms = Date.now() - start;

    if (!result) {
      await supabase.from('requests').insert({
        org_id: ctx.org_id,
        task_type: taskType,
        model_used: models[0]?.model_name ?? DEFAULT_MODEL,
        tokens: 0,
        tokens_input: 0,
        tokens_output: 0,
        cost: 0,
        latency_ms,
        success: false,
      });
      return reply.status(502).send({
        error: { code: 'provider_error', message: 'All providers failed' },
        request_id: req.request_id,
      });
    }

    const cost = costForModel(result.modelRow, result.inputTokens, result.outputTokens);
    const premiumCost = premiumEstimate(result.inputTokens, result.outputTokens);
    const savings_estimate = savingsEstimate(cost, premiumCost);

    const { data: reqRow } = await supabase
      .from('requests')
      .insert({
        org_id: ctx.org_id,
        task_type: taskType,
        model_used: result.model,
        tokens: result.inputTokens + result.outputTokens,
        tokens_input: result.inputTokens,
        tokens_output: result.outputTokens,
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
      request_id: req.request_id,
    });
  });

  app.post('/agent-step', async (req: Req, reply: Rep) => {
    const ctx = req.context;
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
    const start = Date.now();
    const taskType = 'agent_step';
    const tokenEstimate = estimateTokensFromMessages(messages);
    const availableProviders = [
      process.env.OPENAI_API_KEY ? 'openai' : null,
      process.env.ANTHROPIC_API_KEY ? 'anthropic' : null,
      process.env.OPENROUTER_API_KEY ? 'openrouter' : null,
      process.env.GROQ_API_KEY ? 'groq' : null,
    ].filter(Boolean) as string[];
    if (availableProviders.length === 0) {
      return reply.status(500).send({
        error: { code: 'provider_error', message: 'No providers configured' },
        request_id: req.request_id,
      });
    }
    let models = await selectModels('chat', priority, latency_pref, { tokenEstimate, availableProviders });
    if (!models.length) {
      if (availableProviders.includes('openai')) {
        models = [{ id: '', provider: 'openai', model_name: DEFAULT_MODEL, cost_input: 0.00015, cost_output: 0.0006, avg_latency: 400, strengths: ['chat'] }];
      } else {
        return reply.status(500).send({
          error: { code: 'internal_error', message: 'No models available for configured providers' },
          request_id: req.request_id,
        });
      }
    }

    const result = await tryChat(models, messages as OpenAI.ChatCompletionMessageParam[]);
    const latency_ms = Date.now() - start;
    if (!result) {
      await supabase.from('requests').insert({
        org_id: ctx.org_id,
        task_type: 'agent_step',
        model_used: DEFAULT_MODEL,
        tokens: 0,
        tokens_input: 0,
        tokens_output: 0,
        cost: 0,
        latency_ms,
        success: false,
      });
      return reply.status(502).send({
        error: { code: 'provider_error', message: 'All providers failed' },
        request_id: req.request_id,
      });
    }
    const cost = costForModel(result.modelRow, result.inputTokens, result.outputTokens);
    const savings_estimate = savingsEstimate(cost, premiumEstimate(result.inputTokens, result.outputTokens));
    await supabase.from('requests').insert({
      org_id: ctx.org_id,
      task_type: 'agent_step',
      model_used: result.model,
      tokens: result.inputTokens + result.outputTokens,
      tokens_input: result.inputTokens,
      tokens_output: result.outputTokens,
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
      request_id: req.request_id,
    });
  });
}
