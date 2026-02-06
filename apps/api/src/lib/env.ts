import { z } from 'zod';

/**
 * Environment variable schema with validation rules
 * Validates all required configuration at startup
 */
const EnvSchema = z
  .object({
    // Server Configuration
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    PORT: z.string().default('3000').transform(Number),
    CORS_ORIGIN: z.string().optional(),

    // Database (Required)
    SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
    SUPABASE_SERVICE_KEY: z
      .string()
      .min(1, 'SUPABASE_SERVICE_KEY is required'),

    // Provider API Keys (At least one required)
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    OPENROUTER_API_KEY: z.string().optional(),
    GROQ_API_KEY: z.string().optional(),
    GOOGLE_API_KEY: z.string().optional(),

    // Redis (Optional - for distributed rate limiting)
    UPSTASH_REDIS_REST_URL: z.string().url().optional().or(z.literal('')),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional().or(z.literal('')),

    // Rate Limiting
    RATE_LIMIT_MAX: z.string().default('100').transform(Number),
    RATE_LIMIT_WINDOW_SEC: z.string().default('60').transform(Number),

    // Admin (Optional)
    ADMIN_KEY: z.string().optional(),
  })
  .refine(
    (data) => {
      // At least one provider API key must be set
      const hasProvider = !!(
        data.OPENAI_API_KEY ||
        data.ANTHROPIC_API_KEY ||
        data.OPENROUTER_API_KEY ||
        data.GROQ_API_KEY ||
        data.GOOGLE_API_KEY
      );
      return hasProvider;
    },
    {
      message:
        'At least one provider API key must be set (OPENAI_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY, GROQ_API_KEY, or GOOGLE_API_KEY)',
    }
  )
  .refine(
    (data) => {
      // If one Redis var is set, both must be set
      const hasRedisUrl = !!data.UPSTASH_REDIS_REST_URL && data.UPSTASH_REDIS_REST_URL !== '';
      const hasRedisToken = !!data.UPSTASH_REDIS_REST_TOKEN && data.UPSTASH_REDIS_REST_TOKEN !== '';

      // Both must be set together, or both omitted
      return hasRedisUrl === hasRedisToken;
    },
    {
      message:
        'Both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set together, or both omitted',
    }
  );

export type Env = z.infer<typeof EnvSchema>;

let validatedEnv: Env | null = null;

/**
 * Validate environment variables at startup
 * Exits process if validation fails
 * @returns Validated environment object
 */
export function validateEnv(): Env {
  if (validatedEnv) return validatedEnv;

  try {
    validatedEnv = EnvSchema.parse(process.env);

    // Success - log available providers
    console.log('✓ Environment variables validated');
    console.log(`  Node environment: ${validatedEnv.NODE_ENV}`);
    console.log(`  Port: ${validatedEnv.PORT}`);

    const availableProviders = [
      validatedEnv.OPENAI_API_KEY && 'OpenAI',
      validatedEnv.ANTHROPIC_API_KEY && 'Anthropic',
      validatedEnv.OPENROUTER_API_KEY && 'OpenRouter',
      validatedEnv.GROQ_API_KEY && 'Groq',
      validatedEnv.GOOGLE_API_KEY && 'Google',
    ].filter(Boolean);

    console.log(`  Available providers: ${availableProviders.join(', ')}`);

    const redisEnabled = !!(
      validatedEnv.UPSTASH_REDIS_REST_URL &&
      validatedEnv.UPSTASH_REDIS_REST_TOKEN &&
      validatedEnv.UPSTASH_REDIS_REST_URL !== '' &&
      validatedEnv.UPSTASH_REDIS_REST_TOKEN !== ''
    );

    console.log(
      `  Redis: ${redisEnabled ? 'enabled (distributed rate limiting)' : 'disabled (using in-memory)'}`
    );

    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      console.error('\nPlease check your .env file and ensure all required variables are set.');
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Get validated environment (must call validateEnv() first)
 * @returns Validated environment object
 * @throws Error if validateEnv() hasn't been called
 */
export function getEnv(): Env {
  if (!validatedEnv) {
    throw new Error(
      'Environment not validated. Call validateEnv() at startup before using getEnv().'
    );
  }
  return validatedEnv;
}
