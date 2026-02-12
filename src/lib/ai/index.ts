import type { AIProvider, AIStreamCallback, CodeSkeleton, RepoInfo } from '@/types';
import { formatSkeletonForAI } from '@/lib/analyzer';
import SYSTEM_PROMPT from '@/prompts/system.txt?raw';
import USER_PROMPT_TEMPLATE from '@/prompts/user.txt?raw';

async function streamClaude(
  apiKey: string,
  model: string,
  skeleton: string,
  callback: AIStreamCallback
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
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: USER_PROMPT_TEMPLATE.replace('{skeleton}', skeleton),
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
    while (true) {
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
  callback: AIStreamCallback
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
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: USER_PROMPT_TEMPLATE.replace('{skeleton}', skeleton),
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
    while (true) {
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
  callback: AIStreamCallback
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
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: USER_PROMPT_TEMPLATE.replace('{skeleton}', skeleton),
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
    while (true) {
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
  callback: AIStreamCallback
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
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: USER_PROMPT_TEMPLATE.replace('{skeleton}', skeleton),
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
    while (true) {
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
  callback: AIStreamCallback
): Promise<void> {
  const formattedSkeleton = formatSkeletonForAI(skeleton, repoInfo);

  switch (provider) {
    case 'claude':
      return streamClaude(apiKey, model || 'claude-sonnet-4-20250514', formattedSkeleton, callback);
    case 'openai':
      return streamOpenAI(apiKey, model || 'gpt-4o', formattedSkeleton, callback);
    case 'siliconflow':
      return streamSiliconFlow(apiKey, model || 'deepseek-ai/DeepSeek-V3', formattedSkeleton, callback);
    case 'bigmodel':
      return streamBigModel(apiKey, model || 'glm-4.5-air', formattedSkeleton, callback);
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
