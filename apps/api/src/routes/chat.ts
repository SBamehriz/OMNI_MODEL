import type OpenAI from 'openai';
import { classifyTask } from '../lib/taskClassifier.js';
import { selectModels, getRoutingDecision, type ModelRow } from '../lib/router.js';
import { estimateTokensFromMessages } from '../lib/tokens.js';
import { chatWithProvider, costForModel, premiumEstimate, savingsEstimate } from '../lib/providers.js';
import { supabase } from '../lib/db.js';
import { ChatRequestSchema, type ChatRequest } from '../lib/schemas.js';
import { validateBody } from '../lib/validation.js';

const DEFAULT_MODEL = 'gpt-4o-mini';

type RoutingModel = { provider: string; model_name: string };

type RequestLogInput = {
  org_id: string;
  task_type: string;
  model_used: string;
  tokens_input: number;
  tokens_output: number;
  cost: number;
  latency_ms: number;
  success: boolean;
  considered_models?: RoutingModel[];
  reason?: string;
};

async function writeRequestLog(input: RequestLogInput) {
  const { data: reqRow, error } = await supabase
    .from('requests')
    .insert({
      org_id: input.org_id,
      task_type: input.task_type,
      model_used: input.model_used,
      tokens: input.tokens_input + input.tokens_output,
      tokens_input: input.tokens_input,
      tokens_output: input.tokens_output,
      cost: input.cost,
      latency_ms: input.latency_ms,
      success: input.success,
    })
    .select('id')
    .single();
  if (error) throw error;

  if (reqRow?.id && input.considered_models?.length) {
    const { error: routingError } = await supabase.from('routing_logs').insert({
      request_id: reqRow.id,
      considered_models: input.considered_models,
      final_model: input.model_used,
      reason: input.reason,
    });
    if (routingError) throw routingError;
  }
}

function queueRequestLog(input: RequestLogInput, log?: { error: (o: object, s: string) => void }) {
  void writeRequestLog(input).catch((err) => {
    log?.error({ err }, 'request logging failed');
  });
}

// Manual validation functions replaced with Zod schemas (see ../lib/schemas.ts)

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
  body?: ChatRequest;
  request_id?: string;
  log?: { error: (o: object, s: string) => void };
};
type Rep = { status: (c: number) => Rep; send: (b: unknown) => Rep };

export async function chatRoutes(app: { post: (path: string, h: (req: Req, reply: Rep) => Promise<Rep | void>) => void }) {
  app.post('/chat', async (req: Req, reply: Rep) => {
    const ctx = req.context;

    // Validate request body with Zod
    const parseResult = ChatRequestSchema.safeParse(req.body);
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

    const { messages, priority, latency_pref, max_cost } = parseResult.data;

    const start = Date.now();
    const taskType = classifyTask(messages);
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

    const decision = getRoutingDecision(models, taskType, priority, latency_pref);
    const result = await tryChat(models, messages as OpenAI.ChatCompletionMessageParam[]);
    const latency_ms = Date.now() - start;

    if (!result) {
      queueRequestLog(
        {
          org_id: ctx.org_id,
          task_type: taskType,
          model_used: models[0]?.model_name ?? DEFAULT_MODEL,
          tokens_input: 0,
          tokens_output: 0,
          cost: 0,
          latency_ms,
          success: false,
          considered_models: models.slice(0, 3).map((m) => ({ provider: m.provider, model_name: m.model_name })),
          reason: decision.reason,
        },
        req.log
      );
      return reply.status(502).send({
        error: { code: 'provider_error', message: 'All providers failed' },
        request_id: req.request_id,
      });
    }

    const cost = costForModel(result.modelRow, result.inputTokens, result.outputTokens);
    const premiumCost = premiumEstimate(result.inputTokens, result.outputTokens);
    const savings_estimate = savingsEstimate(cost, premiumCost);

    queueRequestLog(
      {
        org_id: ctx.org_id,
        task_type: taskType,
        model_used: result.model,
        tokens_input: result.inputTokens,
        tokens_output: result.outputTokens,
        cost,
        latency_ms,
        success: true,
        considered_models: models.slice(0, 3).map((m) => ({ provider: m.provider, model_name: m.model_name })),
        reason: decision.reason,
      },
      req.log
    );

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

    // Validate request body with Zod
    const parseResult = ChatRequestSchema.safeParse(req.body);
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

    const { messages, priority, latency_pref, max_cost } = parseResult.data;
    const start = Date.now();
    const taskType = 'agent_step';
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

    const decision = getRoutingDecision(models, taskType, priority, latency_pref);
    const result = await tryChat(models, messages as OpenAI.ChatCompletionMessageParam[]);
    const latency_ms = Date.now() - start;
    if (!result) {
      queueRequestLog(
        {
          org_id: ctx.org_id,
          task_type: taskType,
          model_used: models[0]?.model_name ?? DEFAULT_MODEL,
          tokens_input: 0,
          tokens_output: 0,
          cost: 0,
          latency_ms,
          success: false,
          considered_models: models.slice(0, 3).map((m) => ({ provider: m.provider, model_name: m.model_name })),
          reason: decision.reason,
        },
        req.log
      );
      return reply.status(502).send({
        error: { code: 'provider_error', message: 'All providers failed' },
        request_id: req.request_id,
      });
    }
    const cost = costForModel(result.modelRow, result.inputTokens, result.outputTokens);
    const savings_estimate = savingsEstimate(cost, premiumEstimate(result.inputTokens, result.outputTokens));
    queueRequestLog(
      {
        org_id: ctx.org_id,
        task_type: taskType,
        model_used: result.model,
        tokens_input: result.inputTokens,
        tokens_output: result.outputTokens,
        cost,
        latency_ms,
        success: true,
        considered_models: models.slice(0, 3).map((m) => ({ provider: m.provider, model_name: m.model_name })),
        reason: decision.reason,
      },
      req.log
    );
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
