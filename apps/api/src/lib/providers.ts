import OpenAI from 'openai';
import type { ModelRow } from './router.js';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const OPENAI_PER_1K_IN: Record<string, number> = {
  'gpt-4o-mini': 0.00015,
  'gpt-4o': 0.0025,
};
const OPENAI_PER_1K_OUT: Record<string, number> = {
  'gpt-4o-mini': 0.0006,
  'gpt-4o': 0.01,
};

export type CompletionResult = {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
};

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
  throw new Error(`Unsupported provider: ${provider}`);
}

export function costForModel(provider: string, modelName: string, inputTokens: number, outputTokens: number): number {
  if (provider === 'openai') {
    const perIn = OPENAI_PER_1K_IN[modelName] ?? 0.001;
    const perOut = OPENAI_PER_1K_OUT[modelName] ?? 0.003;
    return (inputTokens / 1000) * perIn + (outputTokens / 1000) * perOut;
  }
  return 0;
}

const PREMIUM_ESTIMATE_PER_1K_IN = 0.0025;
const PREMIUM_ESTIMATE_PER_1K_OUT = 0.01;

export function premiumEstimate(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1000) * PREMIUM_ESTIMATE_PER_1K_IN + (outputTokens / 1000) * PREMIUM_ESTIMATE_PER_1K_OUT
  );
}

export function savingsEstimate(actualCost: number, premiumCost: number): number {
  return Math.max(0, premiumCost - actualCost);
}
