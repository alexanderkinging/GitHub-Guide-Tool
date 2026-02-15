/**
 * Model context limits mapping
 * Maps model IDs to their maximum context window sizes (in tokens)
 */

export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  // Claude models
  'claude-sonnet-4-20250514': 200000,
  'claude-3-5-sonnet-20241022': 200000,
  'claude-3-haiku-20240307': 200000,

  // OpenAI models
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,

  // SiliconFlow models (DeepSeek, Qwen, Llama)
  'deepseek-ai/DeepSeek-V3': 64000,
  'deepseek-ai/DeepSeek-R1': 64000,
  'Qwen/Qwen2.5-72B-Instruct': 32000,
  'meta-llama/Llama-3.3-70B-Instruct': 128000,

  // BigModel (智谱) models
  'glm-4.5-air': 128000,
  'glm-4-plus': 128000,
  'glm-4-air': 128000,
  'glm-4-flash': 128000,
};

// Default context limit for unknown models
const DEFAULT_CONTEXT_LIMIT = 32000;

// Safety margin: use 80% of context to leave room for response
const SAFETY_MARGIN = 0.8;

/**
 * Get the context limit for a specific model
 * @param model - Model ID
 * @returns Maximum context tokens (with safety margin applied)
 */
export function getModelContextLimit(model: string): number {
  const limit = MODEL_CONTEXT_LIMITS[model] || DEFAULT_CONTEXT_LIMIT;
  return Math.floor(limit * SAFETY_MARGIN);
}

/**
 * Get the raw context limit without safety margin
 */
export function getRawModelContextLimit(model: string): number {
  return MODEL_CONTEXT_LIMITS[model] || DEFAULT_CONTEXT_LIMIT;
}
