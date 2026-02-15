/**
 * Intelligent chunking logic for large codebase analysis
 */

import type { ModuleSkeleton, CodeSkeleton } from '@/types';
import { estimateTokens } from './tokenEstimator';

/**
 * A chunk of modules to be analyzed in one round
 */
export interface AnalysisChunk {
  modules: ModuleSkeleton[];
  chunkIndex: number;
  totalChunks: number;
  isLast: boolean;
}

/**
 * Structured summary from each analysis round
 */
export interface ChunkSummary {
  chunkIndex: number;
  moduleResponsibilities: Array<{
    path: string;
    responsibility: string;
    keyFunctions: string[];
  }>;
  architecturePatterns: string[];
  dependencies: {
    internal: string[];
    external: string[];
  };
  potentialRisks: string[];
  techStack: string[];
}

/**
 * Progress callback for chunked analysis
 */
export interface ChunkedAnalysisProgress {
  currentChunk: number;
  totalChunks: number;
  stage: 'analyzing' | 'summarizing' | 'generating';
}

/**
 * Format a single module for token estimation
 */
function formatModuleForEstimation(module: ModuleSkeleton): string {
  const lines: string[] = [];
  lines.push(`### ${module.path}`);

  if (module.classes.length > 0) {
    lines.push('Classes:');
    for (const cls of module.classes) {
      const exported = cls.isExported ? 'export ' : '';
      const ext = cls.extends ? ` extends ${cls.extends}` : '';
      lines.push(`  - ${exported}class ${cls.name}${ext}`);
    }
  }

  if (module.functions.length > 0) {
    lines.push('Functions:');
    for (const fn of module.functions) {
      const exported = fn.isExported ? 'export ' : '';
      const async = fn.isAsync ? 'async ' : '';
      const ret = fn.returnType ? `: ${fn.returnType}` : '';
      lines.push(`  - ${exported}${async}function ${fn.name}(${fn.params})${ret}`);
    }
  }

  if (module.exports.length > 0) {
    lines.push(`Exports: ${module.exports.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Estimate tokens for the base context (project info, structure, etc.)
 */
export function estimateBaseContextTokens(skeleton: CodeSkeleton, readmeLength: number): number {
  // Rough estimation for project info, directory structure, config, dependencies
  let estimate = 500; // Base overhead

  // Directory structure (rough estimate based on module count)
  estimate += skeleton.modules.length * 10;

  // Config
  if (skeleton.config?.raw) {
    estimate += estimateTokens(skeleton.config.raw);
  }

  // Dependencies
  const depCount = Object.keys(skeleton.dependencies.runtime).length +
                   Object.keys(skeleton.dependencies.dev).length;
  estimate += depCount * 5;

  // README excerpt
  estimate += estimateTokens(readmeLength.toString()) + Math.min(readmeLength / 4, 500);

  return estimate;
}

/**
 * Split modules into chunks that fit within the token limit
 */
export function splitIntoChunks(
  skeleton: CodeSkeleton,
  maxTokensPerChunk: number,
  baseContextTokens: number
): AnalysisChunk[] {
  const modules = skeleton.modules;

  if (modules.length === 0) {
    return [];
  }

  // Calculate available tokens for modules in each chunk
  // Reserve tokens for: base context, system prompt (~500), previous summaries accumulation
  const reservedForPrompts = 1500;
  const availablePerChunk = maxTokensPerChunk - baseContextTokens - reservedForPrompts;

  if (availablePerChunk <= 0) {
    // If base context is too large, just return all modules in one chunk
    return [{
      modules,
      chunkIndex: 0,
      totalChunks: 1,
      isLast: true,
    }];
  }

  // Group modules by directory for better coherence
  const modulesByDir = new Map<string, ModuleSkeleton[]>();
  for (const module of modules) {
    const dir = module.path.split('/').slice(0, -1).join('/') || '.';
    if (!modulesByDir.has(dir)) {
      modulesByDir.set(dir, []);
    }
    modulesByDir.get(dir)!.push(module);
  }

  const chunks: AnalysisChunk[] = [];
  let currentChunk: ModuleSkeleton[] = [];
  let currentTokens = 0;

  // Process directories, trying to keep related modules together
  for (const [, dirModules] of modulesByDir) {
    for (const module of dirModules) {
      const moduleText = formatModuleForEstimation(module);
      const moduleTokens = estimateTokens(moduleText);

      // If adding this module would exceed limit, start a new chunk
      if (currentTokens + moduleTokens > availablePerChunk && currentChunk.length > 0) {
        chunks.push({
          modules: currentChunk,
          chunkIndex: chunks.length,
          totalChunks: 0, // Will be set later
          isLast: false,
        });
        currentChunk = [];
        currentTokens = 0;
      }

      currentChunk.push(module);
      currentTokens += moduleTokens;
    }
  }

  // Add the last chunk
  if (currentChunk.length > 0) {
    chunks.push({
      modules: currentChunk,
      chunkIndex: chunks.length,
      totalChunks: 0,
      isLast: true,
    });
  }

  // Update totalChunks and isLast for all chunks
  const totalChunks = chunks.length;
  for (let i = 0; i < chunks.length; i++) {
    chunks[i].totalChunks = totalChunks;
    chunks[i].isLast = i === chunks.length - 1;
  }

  return chunks;
}

/**
 * Check if chunking is needed based on estimated tokens
 */
export function needsChunking(
  skeleton: CodeSkeleton,
  maxTokens: number,
  readmeLength: number
): boolean {
  const baseTokens = estimateBaseContextTokens(skeleton, readmeLength);

  let moduleTokens = 0;
  for (const module of skeleton.modules) {
    moduleTokens += estimateTokens(formatModuleForEstimation(module));
  }

  const totalTokens = baseTokens + moduleTokens;
  // Add buffer for system prompt and response
  const totalWithBuffer = totalTokens + 2000;

  return totalWithBuffer > maxTokens;
}

/**
 * Format chunk summary for accumulation
 */
export function formatChunkSummaryForContext(summaries: ChunkSummary[]): string {
  if (summaries.length === 0) return '';

  const lines: string[] = ['## Previous Analysis Summaries\n'];

  for (const summary of summaries) {
    lines.push(`### Chunk ${summary.chunkIndex + 1} Summary`);

    if (summary.moduleResponsibilities.length > 0) {
      lines.push('Module Responsibilities:');
      for (const mod of summary.moduleResponsibilities) {
        lines.push(`- ${mod.path}: ${mod.responsibility}`);
        if (mod.keyFunctions.length > 0) {
          lines.push(`  Key functions: ${mod.keyFunctions.join(', ')}`);
        }
      }
    }

    if (summary.architecturePatterns.length > 0) {
      lines.push(`Architecture Patterns: ${summary.architecturePatterns.join(', ')}`);
    }

    if (summary.techStack.length > 0) {
      lines.push(`Tech Stack: ${summary.techStack.join(', ')}`);
    }

    if (summary.potentialRisks.length > 0) {
      lines.push(`Potential Risks: ${summary.potentialRisks.join(', ')}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}
