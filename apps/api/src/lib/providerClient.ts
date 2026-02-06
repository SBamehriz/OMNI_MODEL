import pTimeout from 'p-timeout';
import pRetry from 'p-retry';

export interface ProviderCallOptions {
  timeout?: number;
  retries?: number;
  minRetryDelay?: number;
  maxRetryDelay?: number;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_RETRIES = 2;
const DEFAULT_MIN_RETRY_DELAY = 1000; // 1 second
const DEFAULT_MAX_RETRY_DELAY = 3000; // 3 seconds

export class ProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public statusCode?: number,
    public isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/**
 * Wrap a provider API call with timeout and retry logic
 * @param fn - The function to call (should return a Promise)
 * @param provider - Provider name for logging
 * @param options - Timeout and retry configuration
 * @returns Promise<T> - Result of the provider call
 * @throws ProviderError if all retries fail
 */
export async function callProviderWithRetry<T>(
  fn: () => Promise<T>,
  provider: string,
  options: ProviderCallOptions = {}
): Promise<T> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const retries = options.retries ?? DEFAULT_RETRIES;
  const minRetryDelay = options.minRetryDelay ?? DEFAULT_MIN_RETRY_DELAY;
  const maxRetryDelay = options.maxRetryDelay ?? DEFAULT_MAX_RETRY_DELAY;

  return pRetry(
    async () => {
      try {
        // Wrap in timeout
        return await pTimeout(fn(), {
          milliseconds: timeout,
          message: `Provider ${provider} timed out after ${timeout}ms`,
        });
      } catch (error) {
        // Determine if error is retryable
        if (error instanceof ProviderError) {
          if (!error.isRetryable) {
            // Non-retryable error - abort immediately
            throw new pRetry.AbortError(error.message);
          }
          throw error; // Retryable - let pRetry handle it
        }

        // Network errors and timeouts are retryable
        if (
          error instanceof Error &&
          (error.name === 'FetchError' ||
            error.message.includes('timeout') ||
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('ETIMEDOUT'))
        ) {
          throw new ProviderError(
            error.message,
            provider,
            undefined,
            true // retryable
          );
        }

        // Unknown errors - don't retry to avoid wasting time
        throw new pRetry.AbortError(
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    },
    {
      retries,
      minTimeout: minRetryDelay,
      maxTimeout: maxRetryDelay,
      onFailedAttempt: (error) => {
        console.warn(
          `Provider ${provider} attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`,
          {
            error: error.message,
            retriesLeft: error.retriesLeft,
          }
        );
      },
    }
  );
}

/**
 * Check if an HTTP status code is retryable
 * @param status - HTTP status code
 * @returns true if the status indicates a retryable error
 */
export function isRetryableStatusCode(status: number): boolean {
  // 408 Request Timeout
  // 429 Too Many Requests
  // 500-599 Server Errors (except 501 Not Implemented)
  return (
    status === 408 ||
    status === 429 ||
    (status >= 500 && status < 600 && status !== 501)
  );
}

/**
 * Fetch with timeout (helper for simple fetch calls)
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise<Response>
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}
