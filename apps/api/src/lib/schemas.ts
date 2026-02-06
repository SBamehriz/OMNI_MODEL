import { z } from 'zod';

/**
 * Message schema for chat completions
 * Supports OpenAI-compatible message format
 */
export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system'], {
    errorMap: () => ({ message: 'Role must be one of: user, assistant, system' }),
  }),
  content: z.string().min(1, 'Message content cannot be empty'),
});

/**
 * Chat request body schema
 * Used by POST /v1/chat and POST /v1/agent-step
 */
export const ChatRequestSchema = z.object({
  messages: z
    .array(MessageSchema)
    .min(1, 'At least one message is required')
    .max(100, 'Maximum 100 messages allowed'),
  priority: z
    .enum(['cheap', 'balanced', 'best'], {
      errorMap: () => ({
        message: 'Priority must be one of: cheap, balanced, best',
      }),
    })
    .optional()
    .default('balanced'),
  latency_pref: z
    .enum(['fast', 'normal'], {
      errorMap: () => ({ message: 'Latency preference must be: fast or normal' }),
    })
    .optional()
    .default('normal'),
  max_cost: z
    .number()
    .positive('Max cost must be a positive number')
    .optional(),
});

/**
 * Usage query parameters schema
 * Used by GET /v1/usage
 */
export const UsageQuerySchema = z
  .object({
    from: z
      .string()
      .datetime({ message: 'Invalid datetime format for "from"' })
      .optional(),
    to: z
      .string()
      .datetime({ message: 'Invalid datetime format for "to"' })
      .optional(),
  })
  .refine(
    (data) => {
      if (data.from && data.to) {
        return new Date(data.from) <= new Date(data.to);
      }
      return true;
    },
    {
      message: '"from" date must be before or equal to "to" date',
      path: ['from'],
    }
  );

/**
 * Debug routing request schema
 * Used by POST /v1/router/debug
 */
export const DebugRoutingRequestSchema = ChatRequestSchema;

// Type exports for use in route handlers
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type UsageQuery = z.infer<typeof UsageQuerySchema>;
export type Message = z.infer<typeof MessageSchema>;
