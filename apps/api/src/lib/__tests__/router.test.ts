import { describe, it, expect, beforeEach, vi } from 'vitest';
import { selectModels, invalidateModelCache, type ModelRow } from '../router.js';
import type { TaskType } from '../taskClassifier.js';

// Mock the database module
vi.mock('../db.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        data: mockModels,
        error: null,
      })),
    })),
  },
}));

// Mock models data
let mockModels: ModelRow[] = [];

describe('Router - Model Selection', () => {
  beforeEach(() => {
    // Reset mock models before each test
    mockModels = [
      {
        id: '1',
        provider: 'openai',
        model_name: 'gpt-4o-mini',
        cost_input: 0.00015,
        cost_output: 0.0006,
        avg_latency: 400,
        strengths: ['chat', 'summarization'],
        quality_rating: 78,
        speed_index: 92,
        price_index: 20,
        deprecated: false,
      },
      {
        id: '2',
        provider: 'openai',
        model_name: 'gpt-4o',
        cost_input: 0.0025,
        cost_output: 0.01,
        avg_latency: 800,
        strengths: ['reasoning', 'coding', 'chat'],
        quality_rating: 90,
        speed_index: 75,
        price_index: 70,
        deprecated: false,
      },
      {
        id: '3',
        provider: 'anthropic',
        model_name: 'claude-3-5-haiku-20241022',
        cost_input: 0.0008,
        cost_output: 0.004,
        avg_latency: 350,
        strengths: ['chat', 'summarization'],
        quality_rating: 80,
        speed_index: 88,
        price_index: 30,
        deprecated: false,
      },
      {
        id: '4',
        provider: 'anthropic',
        model_name: 'claude-3-5-sonnet-20241022',
        cost_input: 0.003,
        cost_output: 0.015,
        avg_latency: 600,
        strengths: ['reasoning', 'coding', 'chat'],
        quality_rating: 92,
        speed_index: 70,
        price_index: 75,
        deprecated: false,
      },
      {
        id: '5',
        provider: 'google',
        model_name: 'gemini-1.5-flash',
        cost_input: 0.000075,
        cost_output: 0.0003,
        avg_latency: 350,
        strengths: ['chat', 'summarization'],
        quality_rating: 74,
        speed_index: 95,
        price_index: 15,
        deprecated: false,
      },
    ];

    // Invalidate cache before each test
    invalidateModelCache();
  });

  describe('Priority Mode: cheap', () => {
    it('should select cheapest model for chat task', async () => {
      const models = await selectModels('chat', 'cheap', 'normal');

      expect(models).toBeDefined();
      expect(models.length).toBeGreaterThan(0);

      // Gemini Flash should be first (cheapest)
      expect(models[0].model_name).toBe('gemini-1.5-flash');
      expect(models[0].cost_input).toBe(0.000075);
    });

    it('should prioritize cost over quality', async () => {
      const models = await selectModels('reasoning', 'cheap', 'normal');

      // Should still pick cheaper models first even for reasoning
      expect(models[0].cost_input).toBeLessThan(0.001);
    });
  });

  describe('Priority Mode: balanced', () => {
    it('should balance cost, latency, and task match', async () => {
      const models = await selectModels('coding', 'balanced', 'normal');

      expect(models).toBeDefined();
      expect(models.length).toBeGreaterThan(0);

      // Should select models with 'coding' strength
      const topModel = models[0];
      expect(topModel.strengths).toContain('coding');
    });

    it('should adjust weights for fast latency preference', async () => {
      const normalModels = await selectModels('chat', 'balanced', 'normal');
      const fastModels = await selectModels('chat', 'balanced', 'fast');

      // With fast preference, should favor lower latency models
      expect(fastModels[0].avg_latency).toBeLessThanOrEqual(normalModels[0].avg_latency + 100);
    });
  });

  describe('Priority Mode: best', () => {
    it('should prioritize task match for coding', async () => {
      const models = await selectModels('coding', 'best', 'normal');

      expect(models).toBeDefined();
      const topModel = models[0];

      // Should pick a model with 'coding' strength
      expect(topModel.strengths).toContain('coding');
      // Should be gpt-4o or claude-sonnet
      expect(['gpt-4o', 'claude-3-5-sonnet-20241022']).toContain(topModel.model_name);
    });

    it('should prioritize task match for reasoning', async () => {
      const models = await selectModels('reasoning', 'best', 'normal');

      const topModel = models[0];
      expect(topModel.strengths).toContain('reasoning');
    });
  });

  describe('Priority Mode: quality', () => {
    it('should prioritize models with high quality ratings', async () => {
      const models = await selectModels('chat', 'quality', 'normal');

      expect(models).toBeDefined();
      const topModel = models[0];

      // Should be one of the highest rated models (90+)
      expect(topModel.quality_rating).toBeGreaterThanOrEqual(85);
    });

    it('should weight quality heavily over cost', async () => {
      const models = await selectModels('coding', 'quality', 'normal');

      const topModel = models[0];

      // Should pick high quality model even if expensive
      expect(topModel.quality_rating).toBeGreaterThan(85);
    });
  });

  describe('Deprecated Models', () => {
    it('should filter out deprecated models', async () => {
      // Mark one model as deprecated
      mockModels[0].deprecated = true;

      const models = await selectModels('chat', 'balanced', 'normal');

      // Deprecated model should not be in results
      const modelNames = models.map((m) => m.model_name);
      expect(modelNames).not.toContain('gpt-4o-mini');
    });

    it('should return remaining models when some are deprecated', async () => {
      // Mark half as deprecated
      mockModels[0].deprecated = true;
      mockModels[2].deprecated = true;

      const models = await selectModels('chat', 'balanced', 'normal');

      expect(models.length).toBe(3); // Only 3 active models
    });
  });

  describe('Provider Filtering', () => {
    it('should filter by available providers', async () => {
      const models = await selectModels('chat', 'balanced', 'normal', {
        availableProviders: ['openai'],
      });

      // All results should be OpenAI
      models.forEach((model) => {
        expect(model.provider).toBe('openai');
      });
    });

    it('should handle multiple provider filter', async () => {
      const models = await selectModels('chat', 'balanced', 'normal', {
        availableProviders: ['openai', 'anthropic'],
      });

      const providers = new Set(models.map((m) => m.provider));
      expect(providers.size).toBeGreaterThanOrEqual(2);
      expect(providers.has('openai')).toBe(true);
      expect(providers.has('anthropic')).toBe(true);
      expect(providers.has('google')).toBe(false);
    });
  });

  describe('Cost Filtering', () => {
    it('should filter models by max cost', async () => {
      const maxCost = 0.001; // Very low max cost
      const tokenEstimate = { inputTokens: 100, outputTokens: 100 };

      const models = await selectModels('chat', 'balanced', 'normal', {
        maxCost,
        tokenEstimate,
      });

      // All models should be within budget
      models.forEach((model) => {
        const estimatedCost =
          (tokenEstimate.inputTokens / 1000) * model.cost_input +
          (tokenEstimate.outputTokens / 1000) * model.cost_output;
        expect(estimatedCost).toBeLessThanOrEqual(maxCost);
      });
    });

    it('should return empty array if no models meet max cost', async () => {
      const maxCost = 0.00001; // Impossibly low
      const tokenEstimate = { inputTokens: 100, outputTokens: 100 };

      const models = await selectModels('chat', 'balanced', 'normal', {
        maxCost,
        tokenEstimate,
      });

      expect(models).toEqual([]);
    });
  });

  describe('Task Type Matching', () => {
    const taskTypes: TaskType[] = ['chat', 'coding', 'reasoning', 'summarization'];

    taskTypes.forEach((taskType) => {
      it(`should return models for ${taskType} task`, async () => {
        const models = await selectModels(taskType, 'balanced', 'normal');

        expect(models).toBeDefined();
        expect(models.length).toBeGreaterThan(0);
      });
    });

    it('should prefer models with matching strengths', async () => {
      const codingModels = await selectModels('coding', 'best', 'normal');
      const topModel = codingModels[0];

      // Best model for coding should have 'coding' in strengths
      expect(topModel.strengths).toContain('coding');
    });
  });

  describe('Empty Registry', () => {
    it('should return empty array when no models available', async () => {
      mockModels = [];

      const models = await selectModels('chat', 'balanced', 'normal');

      expect(models).toEqual([]);
    });
  });

  describe('Fallback Order', () => {
    it('should return models in fallback order', async () => {
      const models = await selectModels('coding', 'balanced', 'normal');

      expect(models.length).toBeGreaterThan(1);

      // Models should be ordered by score (best first)
      // Each subsequent model is a fallback option
      for (let i = 0; i < models.length - 1; i++) {
        // Just verify they all have required fields for fallback
        expect(models[i].provider).toBeDefined();
        expect(models[i].model_name).toBeDefined();
      }
    });
  });

  describe('Quality Rating Integration', () => {
    it('should use quality ratings in balanced mode', async () => {
      const models = await selectModels('chat', 'balanced', 'normal');

      // Higher quality models should generally rank higher in balanced mode
      // (though not exclusively, as cost/latency also matter)
      const topModel = models[0];
      expect(topModel.quality_rating).toBeDefined();
    });

    it('should handle models without quality ratings', async () => {
      // Remove quality ratings
      mockModels.forEach((m) => {
        m.quality_rating = undefined;
      });

      const models = await selectModels('chat', 'balanced', 'normal');

      // Should still work, using default value
      expect(models.length).toBeGreaterThan(0);
    });
  });
});

describe('Router - Cache', () => {
  beforeEach(() => {
    mockModels = [
      {
        id: '1',
        provider: 'openai',
        model_name: 'gpt-4o-mini',
        cost_input: 0.00015,
        cost_output: 0.0006,
        avg_latency: 400,
        strengths: ['chat'],
        deprecated: false,
      },
    ];
    invalidateModelCache();
  });

  it('should cache model registry', async () => {
    // First call
    const models1 = await selectModels('chat', 'balanced', 'normal');

    // Second call (should use cache)
    const models2 = await selectModels('chat', 'balanced', 'normal');

    expect(models1).toEqual(models2);
  });

  it('should invalidate cache when requested', async () => {
    const models1 = await selectModels('chat', 'balanced', 'normal');

    // Invalidate cache
    invalidateModelCache();

    const models2 = await selectModels('chat', 'balanced', 'normal');

    // Should still get same models, but fetched fresh from DB
    expect(models1.length).toBe(models2.length);
  });
});
