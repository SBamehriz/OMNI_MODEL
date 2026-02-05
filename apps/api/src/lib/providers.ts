import OpenAI from 'openai';
import type { ModelRow } from './router.js';
import { estimateTokensFromMessages, estimateTokensFromText } from './tokens.js';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const openrouterKey = process.env.OPENROUTER_API_KEY ?? '';
const groqKey = process.env.GROQ_API_KEY ?? '';
const anthropicKey = process.env.ANTHROPIC_API_KEY ?? '';

export type CompletionResult = {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
};

type OpenAICompatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

async function chatWithOpenAICompat(
  endpoint: string,
  apiKey: string,
  modelName: string,
  messages: OpenAI.ChatCompletionMessageParam[]
): Promise<CompletionResult> {
  if (!apiKey) throw new Error('Missing API key');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: modelName, messages }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Provider error: ${response.status} ${text}`);
  }
  const data = (await response.json()) as OpenAICompatResponse;
  const choice = data.choices?.[0];
  const content = choice?.message?.content ?? '';
  const fallbackTokens = estimateTokensFromMessages(messages);
  const inputTokens = data.usage?.prompt_tokens ?? fallbackTokens.inputTokens;
  const outputTokens = data.usage?.completion_tokens ?? estimateTokensFromText(content);
  return { content, inputTokens, outputTokens, model: modelName };
}

function buildAnthropicPayload(modelName: string, messages: OpenAI.ChatCompletionMessageParam[]) {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => (typeof m.content === 'string' ? m.content : ''))
    .join('\n');
  const filtered = messages.filter((m) => m.role !== 'system').map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: typeof m.content === 'string' ? m.content : '',
  }));
  return {
    model: modelName,
    max_tokens: 1024,
    system: system || undefined,
    messages: filtered,
  };
}

type AnthropicResponse = {
  content?: Array<{ type?: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

async function chatWithAnthropic(
  modelName: string,
  messages: OpenAI.ChatCompletionMessageParam[]
): Promise<CompletionResult> {
  if (!anthropicKey) throw new Error('Missing API key');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildAnthropicPayload(modelName, messages)),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Provider error: ${response.status} ${text}`);
  }
  const data = (await response.json()) as AnthropicResponse;
  const content = data.content?.map((c) => c.text ?? '').join('') ?? '';
  const fallbackTokens = estimateTokensFromMessages(messages);
  const inputTokens = data.usage?.input_tokens ?? fallbackTokens.inputTokens;
  const outputTokens = data.usage?.output_tokens ?? estimateTokensFromText(content);
  return { content, inputTokens, outputTokens, model: modelName };
}

export async function chatWithProvider(
  provider: string,
  modelName: string,
  messages: OpenAI.ChatCompletionMessageParam[]
): Promise<CompletionResult> {
  if (provider === 'openai' && openai) {
    const completion = await openai.chat.completions.create({
      model: modelName,
      messages,
    });
    const choice = completion.choices?.[0];
    const content = choice?.message?.content ?? '';
    const inputTokens = completion.usage?.prompt_tokens ?? 0;
    const outputTokens = completion.usage?.completion_tokens ?? 0;
    return { content, inputTokens, outputTokens, model: modelName };
  }
  if (provider === 'openrouter') {
    return chatWithOpenAICompat('https://openrouter.ai/api/v1/chat/completions', openrouterKey, modelName, messages);
  }
  if (provider === 'groq') {
    return chatWithOpenAICompat('https://api.groq.com/openai/v1/chat/completions', groqKey, modelName, messages);
  }
  if (provider === 'anthropic') {
    return chatWithAnthropic(modelName, messages);
  }
  throw new Error(`Unsupported provider: ${provider}`);
}

export function costForModel(model: Pick<ModelRow, 'cost_input' | 'cost_output'>, inputTokens: number, outputTokens: number): number {
  const inCost = Number(model.cost_input);
  const outCost = Number(model.cost_output);
  return (inputTokens / 1000) * inCost + (outputTokens / 1000) * outCost;
}

export const PREMIUM_ESTIMATE_PER_1K_IN = 0.0025;
export const PREMIUM_ESTIMATE_PER_1K_OUT = 0.01;

export function premiumEstimate(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1000) * PREMIUM_ESTIMATE_PER_1K_IN + (outputTokens / 1000) * PREMIUM_ESTIMATE_PER_1K_OUT
  );
}

export function savingsEstimate(actualCost: number, premiumCost: number): number {
  return Math.max(0, premiumCost - actualCost);
}
