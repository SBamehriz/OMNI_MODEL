import { z } from 'zod';
import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Validate request body with Zod schema
 * Returns middleware function that can be used with Fastify preHandler hook
 */
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      // Parse and validate body
      req.body = schema.parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Format validation errors for API response
        return reply.status(400).send({
          error: {
            code: 'validation_error',
            message: 'Invalid request body',
            details: error.errors.map((err) => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          },
          request_id: (req as { request_id?: string }).request_id,
        });
      }
      // Re-throw unexpected errors
      throw error;
    }
  };
}

/**
 * Validate query parameters with Zod schema
 * Returns middleware function that can be used with Fastify preHandler hook
 */
export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      // Parse and validate query parameters
      req.query = schema.parse(req.query);
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Format validation errors for API response
        return reply.status(400).send({
          error: {
            code: 'validation_error',
            message: 'Invalid query parameters',
            details: error.errors.map((err) => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          },
          request_id: (req as { request_id?: string }).request_id,
        });
      }
      // Re-throw unexpected errors
      throw error;
    }
  };
}

/**
 * Validate request params with Zod schema (for path parameters like :id)
 * Returns middleware function that can be used with Fastify preHandler hook
 */
export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      // Parse and validate path parameters
      req.params = schema.parse(req.params);
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Format validation errors for API response
        return reply.status(400).send({
          error: {
            code: 'validation_error',
            message: 'Invalid path parameters',
            details: error.errors.map((err) => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          },
          request_id: (req as { request_id?: string }).request_id,
        });
      }
      // Re-throw unexpected errors
      throw error;
    }
  };
}
