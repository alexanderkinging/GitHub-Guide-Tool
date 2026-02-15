/**
 * Token estimation utilities for AI model context management
 */

/**
 * Estimate the number of tokens in a text string.
 * Uses heuristics based on character counts:
 * - English: ~4 characters per token
 * - Chinese: ~1.5 characters per token
 */
export function estimateTokens(text: string): number {
  // Count Chinese characters (CJK Unified Ideographs)
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;

  // Chinese: ~1.5 chars/token, Other: ~4 chars/token
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

/**
 * Estimate tokens for a code skeleton module
 */
export function estimateModuleTokens(moduleText: string): number {
  return estimateTokens(moduleText);
}
