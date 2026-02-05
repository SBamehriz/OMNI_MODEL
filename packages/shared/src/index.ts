export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };
export type ChatResponse = {
  output: string;
  model_used: string;
  cost: number;
  latency_ms: number;
  savings_estimate: number;
};
