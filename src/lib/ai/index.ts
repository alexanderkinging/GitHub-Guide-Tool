import type { AIProvider, AIStreamCallback, CodeSkeleton, RepoInfo, PromptTemplate, ChunkedAnalysisProgress } from '@/types';
import { formatSkeletonForAI } from '@/lib/analyzer';
import SYSTEM_PROMPT from '@/prompts/system.txt?raw';
import USER_PROMPT_TEMPLATE from '@/prompts/user.txt?raw';
import { getModelContextLimit } from './modelLimits';
import { needsChunking, splitIntoChunks, estimateBaseContextTokens, formatChunkSummaryForContext, type ChunkSummary, type AnalysisChunk } from './chunker';
import { CHUNK_ANALYSIS_SYSTEM_PROMPT, CHUNK_ANALYSIS_USER_PROMPT, FINAL_REPORT_SYSTEM_PROMPT, FINAL_REPORT_USER_PROMPT } from '@/lib/prompts/chunkedAnalysis';

// Default prompts (used when no custom template is provided)
const DEFAULT_SYSTEM = SYSTEM_PROMPT;
const DEFAULT_USER = USER_PROMPT_TEMPLATE;

async function streamClaude(
  apiKey: string,
  model: string,
  skeleton: string,
  callback: AIStreamCallback,
  systemPrompt: string,
  userPrompt: string
): Promise<void> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: model || 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      stream: true,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt.replace('{skeleton}', skeleton),
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let fullText = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              const token = parsed.delta.text;
              fullText += token;
              callback.onToken(token);
            }
          } catch {
            // Ignore parse errors for incomplete JSON
          }
        }
      }
    }

    callback.onComplete(fullText);
  } catch (error) {
    callback.onError(error instanceof Error ? error : new Error(String(error)));
  } finally {
    reader.cancel().catch(() => {});
  }
}

async function streamOpenAI(
  apiKey: string,
  model: string,
  skeleton: string,
  callback: AIStreamCallback,
  systemPrompt: string,
  userPrompt: string
): Promise<void> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o',
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: userPrompt.replace('{skeleton}', skeleton),
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let fullText = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const token = parsed.choices?.[0]?.delta?.content;
            if (token) {
              fullText += token;
              callback.onToken(token);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }

    callback.onComplete(fullText);
  } catch (error) {
    callback.onError(error instanceof Error ? error : new Error(String(error)));
  } finally {
    reader.cancel().catch(() => {});
  }
}

async function streamSiliconFlow(
  apiKey: string,
  model: string,
  skeleton: string,
  callback: AIStreamCallback,
  systemPrompt: string,
  userPrompt: string
): Promise<void> {
  const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'deepseek-ai/DeepSeek-V3',
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: userPrompt.replace('{skeleton}', skeleton),
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SiliconFlow API error: ${response.status} - ${error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let fullText = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const token = parsed.choices?.[0]?.delta?.content;
            if (token) {
              fullText += token;
              callback.onToken(token);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }

    callback.onComplete(fullText);
  } catch (error) {
    callback.onError(error instanceof Error ? error : new Error(String(error)));
  } finally {
    reader.cancel().catch(() => {});
  }
}

async function streamBigModel(
  apiKey: string,
  model: string,
  skeleton: string,
  callback: AIStreamCallback,
  systemPrompt: string,
  userPrompt: string
): Promise<void> {
  // BigModel API uses direct API key as Bearer token
  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'glm-4.5-air',
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: userPrompt.replace('{skeleton}', skeleton),
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`BigModel API error: ${response.status} - ${error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let fullText = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const token = parsed.choices?.[0]?.delta?.content;
            if (token) {
              fullText += token;
              callback.onToken(token);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }

    callback.onComplete(fullText);
  } catch (error) {
    callback.onError(error instanceof Error ? error : new Error(String(error)));
  } finally {
    reader.cancel().catch(() => {});
  }
}

export async function analyzeWithAI(
  provider: AIProvider,
  apiKey: string,
  model: string | undefined,
  skeleton: CodeSkeleton,
  repoInfo: RepoInfo,
  callback: AIStreamCallback,
  template?: PromptTemplate
): Promise<void> {
  const formattedSkeleton = formatSkeletonForAI(skeleton, repoInfo);
  const systemPrompt = template?.systemPrompt || DEFAULT_SYSTEM;
  const userPrompt = template?.userPrompt || DEFAULT_USER;

  switch (provider) {
    case 'claude':
      return streamClaude(apiKey, model || 'claude-sonnet-4-20250514', formattedSkeleton, callback, systemPrompt, userPrompt);
    case 'openai':
      return streamOpenAI(apiKey, model || 'gpt-4o', formattedSkeleton, callback, systemPrompt, userPrompt);
    case 'siliconflow':
      return streamSiliconFlow(apiKey, model || 'deepseek-ai/DeepSeek-V3', formattedSkeleton, callback, systemPrompt, userPrompt);
    case 'bigmodel':
      return streamBigModel(apiKey, model || 'glm-4.5-air', formattedSkeleton, callback, systemPrompt, userPrompt);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

export const AI_MODELS: Record<AIProvider, string[]> = {
  claude: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  siliconflow: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct', 'meta-llama/Llama-3.3-70B-Instruct'],
  bigmodel: ['glm-4.5-air', 'glm-4-plus', 'glm-4-air', 'glm-4-flash'],
};

/**
 * Non-streaming API call for chunk analysis (returns JSON)
 */
async function callAINonStreaming(
  provider: AIProvider,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  let url: string;
  let headers: Record<string, string>;
  let body: object;

  switch (provider) {
    case 'claude':
      url = 'https://api.anthropic.com/v1/messages';
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      };
      body = {
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      };
      break;
    case 'openai':
      url = 'https://api.openai.com/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      };
      body = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      };
      break;
    case 'siliconflow':
      url = 'https://api.siliconflow.cn/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      };
      body = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      };
      break;
    case 'bigmodel':
      url = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      };
      body = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      };
      break;
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // Extract content based on provider
  if (provider === 'claude') {
    return data.content?.[0]?.text || '';
  } else {
    return data.choices?.[0]?.message?.content || '';
  }
}

/**
 * Format modules for chunk analysis
 */
function formatModulesForChunk(modules: AnalysisChunk['modules']): string {
  const lines: string[] = [];
  for (const module of modules) {
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
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Format directory structure for final report
 */
function formatDirectoryStructure(skeleton: CodeSkeleton): string {
  const lines: string[] = [];
  function traverse(node: CodeSkeleton['structure'], indent: string = '') {
    if (node.name !== '.') {
      const icon = node.type === 'dir' ? '📁' : '📄';
      lines.push(`${indent}${icon} ${node.name}`);
    }
    if (node.children) {
      const sorted = [...node.children].sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      for (const child of sorted.slice(0, 30)) {
        traverse(child, indent + '  ');
      }
      if (sorted.length > 30) {
        lines.push(`${indent}  ... and ${sorted.length - 30} more`);
      }
    }
  }
  traverse(skeleton.structure);
  return lines.join('\n');
}

/**
 * Format dependencies for final report
 */
function formatDependencies(skeleton: CodeSkeleton): string {
  const lines: string[] = [];
  const runtime = Object.entries(skeleton.dependencies.runtime);
  const dev = Object.entries(skeleton.dependencies.dev);

  if (runtime.length > 0) {
    lines.push('Runtime Dependencies:');
    for (const [name, version] of runtime.slice(0, 15)) {
      lines.push(`  - ${name}: ${version}`);
    }
    if (runtime.length > 15) {
      lines.push(`  ... and ${runtime.length - 15} more`);
    }
  }

  if (dev.length > 0) {
    lines.push('\nDev Dependencies:');
    for (const [name, version] of dev.slice(0, 10)) {
      lines.push(`  - ${name}: ${version}`);
    }
    if (dev.length > 10) {
      lines.push(`  ... and ${dev.length - 10} more`);
    }
  }

  return lines.join('\n');
}

/**
 * Parse JSON from AI response, handling potential markdown wrapping
 */
function parseChunkSummary(response: string, chunkIndex: number): ChunkSummary {
  // Try to extract JSON from response
  let jsonStr = response.trim();

  // Remove markdown code block if present
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      chunkIndex,
      moduleResponsibilities: parsed.moduleResponsibilities || [],
      architecturePatterns: parsed.architecturePatterns || [],
      dependencies: parsed.dependencies || { internal: [], external: [] },
      potentialRisks: parsed.potentialRisks || [],
      techStack: parsed.techStack || [],
    };
  } catch {
    // If parsing fails, return a minimal summary
    return {
      chunkIndex,
      moduleResponsibilities: [],
      architecturePatterns: [],
      dependencies: { internal: [], external: [] },
      potentialRisks: [],
      techStack: [],
    };
  }
}

/**
 * Check if chunked analysis is needed
 */
export function checkNeedsChunking(
  skeleton: CodeSkeleton,
  model: string,
  readmeLength: number
): { needsChunking: boolean; estimatedChunks: number } {
  const maxTokens = getModelContextLimit(model);
  const needs = needsChunking(skeleton, maxTokens, readmeLength);

  if (!needs) {
    return { needsChunking: false, estimatedChunks: 1 };
  }

  const baseTokens = estimateBaseContextTokens(skeleton, readmeLength);
  const chunks = splitIntoChunks(skeleton, maxTokens, baseTokens);
  return { needsChunking: true, estimatedChunks: chunks.length };
}

/**
 * Analyze with chunked approach for large codebases
 */
export async function analyzeWithChunking(
  provider: AIProvider,
  apiKey: string,
  model: string,
  skeleton: CodeSkeleton,
  repoInfo: RepoInfo,
  callback: AIStreamCallback,
  onProgress?: (progress: ChunkedAnalysisProgress) => void
): Promise<void> {
  const maxTokens = getModelContextLimit(model);
  const readmeLength = repoInfo.readme?.length || 0;
  const baseTokens = estimateBaseContextTokens(skeleton, readmeLength);
  const chunks = splitIntoChunks(skeleton, maxTokens, baseTokens);

  if (chunks.length === 0) {
    callback.onError(new Error('No modules to analyze'));
    return;
  }

  const summaries: ChunkSummary[] = [];
  const projectContext = `Project: ${repoInfo.owner}/${repoInfo.repo}\nLanguage: ${repoInfo.language}\nDescription: ${repoInfo.description || 'N/A'}`;

  // Phase 1: Analyze each chunk
  for (const chunk of chunks) {
    onProgress?.({
      currentChunk: chunk.chunkIndex + 1,
      totalChunks: chunks.length,
      stage: 'analyzing',
    });

    const previousSummaries = summaries.length > 0
      ? formatChunkSummaryForContext(summaries)
      : 'This is the first chunk, no previous summaries.';

    const userPrompt = CHUNK_ANALYSIS_USER_PROMPT
      .replace('{chunkIndex}', String(chunk.chunkIndex + 1))
      .replace('{totalChunks}', String(chunks.length))
      .replace('{previousSummaries}', previousSummaries)
      .replace('{projectContext}', projectContext)
      .replace('{modules}', formatModulesForChunk(chunk.modules));

    try {
      const response = await callAINonStreaming(
        provider,
        apiKey,
        model,
        CHUNK_ANALYSIS_SYSTEM_PROMPT,
        userPrompt
      );

      const summary = parseChunkSummary(response, chunk.chunkIndex);
      summaries.push(summary);
    } catch (error) {
      callback.onError(error instanceof Error ? error : new Error(String(error)));
      return;
    }
  }

  // Phase 2: Generate final report with streaming
  onProgress?.({
    currentChunk: chunks.length,
    totalChunks: chunks.length,
    stage: 'generating',
  });

  const projectInfo = `- Name: ${repoInfo.repo}\n- Owner: ${repoInfo.owner}\n- Language: ${repoInfo.language}\n- Stars: ${repoInfo.stars}\n- Description: ${repoInfo.description || 'N/A'}`;

  const finalUserPrompt = FINAL_REPORT_USER_PROMPT
    .replace('{projectInfo}', projectInfo)
    .replace('{totalChunks}', String(chunks.length))
    .replace('{accumulatedSummaries}', formatChunkSummaryForContext(summaries))
    .replace('{directoryStructure}', formatDirectoryStructure(skeleton))
    .replace('{dependencies}', formatDependencies(skeleton));

  // Use streaming for final report
  switch (provider) {
    case 'claude':
      return streamClaude(apiKey, model, '', callback, FINAL_REPORT_SYSTEM_PROMPT, finalUserPrompt);
    case 'openai':
      return streamOpenAI(apiKey, model, '', callback, FINAL_REPORT_SYSTEM_PROMPT, finalUserPrompt);
    case 'siliconflow':
      return streamSiliconFlow(apiKey, model, '', callback, FINAL_REPORT_SYSTEM_PROMPT, finalUserPrompt);
    case 'bigmodel':
      return streamBigModel(apiKey, model, '', callback, FINAL_REPORT_SYSTEM_PROMPT, finalUserPrompt);
  }
}
