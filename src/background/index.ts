import type { StorageSettings, CachedAnalysis, AnalysisTask, ChunkedAnalysisProgress, HistoryEntry } from '@/types';
import { githubAPI } from '@/lib/github';
import { extractCodeSkeleton } from '@/lib/analyzer';
import { analyzeWithAI, checkNeedsChunking, analyzeWithChunking } from '@/lib/ai';
import { getTemplateById } from '@/lib/prompts/presets';

// Cache duration: 7 days
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;

// Storage limit: 4.5MB (leaving some buffer from 5MB limit)
const MAX_STORAGE_BYTES = 4.5 * 1024 * 1024;

// Storage keys
const SETTINGS_KEY = 'settings';
const CACHE_KEY = 'analysisCache';
const ANALYSIS_STATE_KEY = 'analysisTaskState';
const HISTORY_KEY = 'analysisHistory';

// History settings
const MAX_HISTORY_ENTRIES = 100;

// Analysis task management
const ANALYSIS_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const THROTTLE_INTERVAL = 500; // 500ms
const TASK_CLEANUP_DELAY = 5 * 60 * 1000; // 5 minutes after completion
const MAX_CONCURRENT_TASKS = 3;

// Multi-task support: Map of taskId -> AnalysisTask
const activeTasks = new Map<string, AnalysisTask>();
const lastSaveTimes = new Map<string, number>();

// Feishu API
const FEISHU_API_BASE = 'https://internal-api-space.feishu.cn';

// Get Feishu CSRF token from cookie
async function getFeishuCsrfToken(): Promise<string | null> {
  try {
    const cookie = await chrome.cookies.get({
      url: 'https://feishu.cn',
      name: 'swp_csrf_token'
    });
    return cookie?.value || null;
  } catch {
    return null;
  }
}

// Check if user is logged in to Feishu
async function checkFeishuLogin(): Promise<boolean> {
  const token = await getFeishuCsrfToken();
  return !!token;
}

// Generate UUID for request ID
function generateRequestId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Convert Markdown to HTML
function markdownToHtml(markdown: string): string {
  // Normalize line endings and trim
  let html = markdown.replace(/\r\n/g, '\n').trim();

  // Code blocks (preserve content, process first)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');

  // Headers
  html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Unordered lists - collect consecutive items
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match.replace(/\n/g, '')}</ul>`);

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');

  // Clean up multiple newlines (3+ becomes 2)
  html = html.replace(/\n{3,}/g, '\n\n');

  // Paragraphs - split by double newlines
  html = html.replace(/\n\n+/g, '</p><p>');

  // Single line breaks within paragraphs
  html = html.replace(/\n/g, '<br>');

  // Wrap in paragraph
  html = `<p>${html}</p>`;

  // Clean up empty paragraphs and fix block elements
  html = html
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/<p>(<h[1-6]>)/g, '$1')
    .replace(/(<\/h[1-6]>)<\/p>/g, '$1')
    .replace(/<p>(<ul>)/g, '$1')
    .replace(/(<\/ul>)<\/p>/g, '$1')
    .replace(/<p>(<pre>)/g, '$1')
    .replace(/(<\/pre>)<\/p>/g, '$1')
    .replace(/<p>(<blockquote>)/g, '$1')
    .replace(/(<\/blockquote>)<\/p>/g, '$1')
    .replace(/<p>(<hr>)/g, '$1')
    .replace(/(<hr>)<\/p>/g, '$1')
    .replace(/<br>\s*<br>/g, '<br>')
    .replace(/<p><br>/g, '<p>')
    .replace(/<br><\/p>/g, '</p>');

  return html;
}

// Save to Feishu document
async function saveToFeishu(markdown: string, title: string, sourceUrl: string): Promise<{ success: boolean; url?: string; error?: string }> {
  const csrfToken = await getFeishuCsrfToken();
  if (!csrfToken) {
    return { success: false, error: '请先登录 feishu.cn' };
  }

  const requestId = generateRequestId();
  const html = markdownToHtml(markdown);

  try {
    const formData = new FormData();
    const file = new Blob([html], { type: 'text/plain' });
    formData.append('file', file, title);
    formData.append('originUrl', sourceUrl);
    formData.append('lang', 'zh-CN');
    formData.append('clipVersion', '1.0.38');
    formData.append('docType', 'docx');
    formData.append('description', '');
    formData.append('cover', '');

    const response = await fetch(`${FEISHU_API_BASE}/space/api/parser/wiki/parse_html/`, {
      method: 'POST',
      headers: {
        'Request-Id': requestId,
        'X-Request-Source': 'feishu-clipper',
        'X-Csrf-Token': csrfToken
      },
      credentials: 'include',
      body: formData
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${text.substring(0, 100)}` };
    }

    const text = await response.text();
    if (!text || text.trim() === '') {
      return { success: false, error: '服务器返回空响应' };
    }

    const result = JSON.parse(text);

    // If ticket returned, poll for result
    if (result.ticket) {
      return await pollFeishuClipResult(result.ticket, csrfToken);
    }

    return result;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : '保存失败' };
  }
}

// Poll for Feishu clip result
async function pollFeishuClipResult(ticket: string, csrfToken: string): Promise<{ success: boolean; url?: string; error?: string }> {
  const maxAttempts = 30;
  const interval = 2000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, interval));

    try {
      const response = await fetch(
        `${FEISHU_API_BASE}/space/api/parser/wiki/clip/result?ticket=${encodeURIComponent(ticket)}`,
        {
          headers: {
            'X-Csrf-Token': csrfToken,
            'X-Request-Source': 'feishu-clipper'
          },
          credentials: 'include'
        }
      );

      const result = await response.json();

      if (result.code === 0 && result.docUrl && result.status === 'success') {
        return { success: true, url: result.docUrl };
      }

      if (result.code === 0 && result.status === 'processing') {
        continue;
      }

      if (result.code !== 0) {
        return { success: false, error: result.msg || '处理失败' };
      }

      if (result.code === 0 && result.data && result.data.url) {
        return { success: true, url: result.data.url };
      }
    } catch (err) {
      console.error('Poll error:', err);
    }
  }

  return { success: false, error: '处理超时，请稍后重试' };
}

// Get settings from storage
async function getSettings(): Promise<StorageSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return result[SETTINGS_KEY] || {
    aiProvider: 'claude',
  };
}

// Save settings to storage
async function saveSettings(settings: StorageSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

// Get cached analysis
async function getCachedAnalysis(repoKey: string): Promise<CachedAnalysis | null> {
  const result = await chrome.storage.local.get(CACHE_KEY);
  const cache = result[CACHE_KEY] || {};
  const cached = cache[repoKey];

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached;
  }

  return null;
}

// Clean up expired cache entries
async function cleanupExpiredCache(): Promise<number> {
  const storageResult = await chrome.storage.local.get(CACHE_KEY);
  const cache = storageResult[CACHE_KEY] || {};
  const now = Date.now();
  let cleanedCount = 0;

  for (const key of Object.keys(cache)) {
    if (now - cache[key].timestamp >= CACHE_DURATION) {
      delete cache[key];
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    await chrome.storage.local.set({ [CACHE_KEY]: cache });
    console.log(`Cleaned up ${cleanedCount} expired cache entries`);
  }

  return cleanedCount;
}

// Check storage space and cleanup if necessary
async function ensureStorageSpace(): Promise<void> {
  const bytes = await new Promise<number>((resolve) => {
    chrome.storage.local.getBytesInUse(null, resolve);
  });

  if (bytes > MAX_STORAGE_BYTES) {
    console.log(`Storage usage ${(bytes / 1024 / 1024).toFixed(2)}MB exceeds limit, cleaning up...`);
    await cleanupOldestCache();
  }
}

// Remove oldest cache entries when storage is full
async function cleanupOldestCache(): Promise<void> {
  const storageResult = await chrome.storage.local.get(CACHE_KEY);
  const cache = storageResult[CACHE_KEY] || {};
  const entries = Object.entries(cache)
    .sort((a, b) => (a[1] as CachedAnalysis).timestamp - (b[1] as CachedAnalysis).timestamp);

  if (entries.length === 0) return;

  // Delete oldest 25% of cache entries
  const toRemove = Math.max(1, Math.ceil(entries.length * 0.25));
  for (let i = 0; i < toRemove; i++) {
    delete cache[entries[i][0]];
  }

  await chrome.storage.local.set({ [CACHE_KEY]: cache });
  console.log(`Removed ${toRemove} oldest cache entries`);
}

// Save analysis to cache
async function cacheAnalysis(repoKey: string, result: CachedAnalysis['result']): Promise<void> {
  // Clean up expired entries before saving new one
  await cleanupExpiredCache();

  // Ensure we have storage space
  await ensureStorageSpace();

  const storageResult = await chrome.storage.local.get(CACHE_KEY);
  const cache = storageResult[CACHE_KEY] || {};

  cache[repoKey] = {
    repoKey,
    result,
    timestamp: Date.now(),
  };

  await chrome.storage.local.set({ [CACHE_KEY]: cache });
}

// Clear all cache
async function clearCache(): Promise<void> {
  await chrome.storage.local.remove(CACHE_KEY);
}

// ============ History Management ============

// Extract summary with smart sentence boundary detection
function extractSummary(text: string, minLength = 400, maxLength = 500): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Find the last sentence ender within maxLength range
  const searchRange = text.slice(0, maxLength);
  const sentenceEnders = /[。！？.!?]/g;
  let lastEnd = -1;
  let match;

  while ((match = sentenceEnders.exec(searchRange)) !== null) {
    if (match.index >= minLength) {
      lastEnd = match.index;
    }
  }

  // If found a sentence ender, cut there
  if (lastEnd > 0) {
    return text.slice(0, lastEnd + 1);
  }

  // Fallback to maxLength
  return text.slice(0, maxLength);
}

// Get history list
async function getHistory(): Promise<HistoryEntry[]> {
  const result = await chrome.storage.local.get(HISTORY_KEY);
  return result[HISTORY_KEY] || [];
}

// Add history entry (called after analysis completes)
async function addHistoryEntry(
  repoKey: string,
  repoInfo: { owner: string; repo: string; language: string; description: string; stars: number; isPrivate: boolean },
  aiAnalysis: string
): Promise<void> {
  const history = await getHistory();

  // Remove existing entry for same repo (will be re-added at top)
  const filtered = history.filter(h => h.repoKey !== repoKey);

  // Create new entry
  const entry: HistoryEntry = {
    repoKey,
    owner: repoInfo.owner,
    repo: repoInfo.repo,
    language: repoInfo.language || 'Unknown',
    description: (repoInfo.description || '').slice(0, 100),
    summary: extractSummary(aiAnalysis),
    analyzedAt: Date.now(),
    stars: repoInfo.stars,
    isPrivate: repoInfo.isPrivate,
  };

  // Add to front
  filtered.unshift(entry);

  // Limit to max entries
  const trimmed = filtered.slice(0, MAX_HISTORY_ENTRIES);

  await chrome.storage.local.set({ [HISTORY_KEY]: trimmed });
}

// Delete single history entry
async function deleteHistoryEntry(repoKey: string): Promise<void> {
  const history = await getHistory();
  const filtered = history.filter(h => h.repoKey !== repoKey);
  await chrome.storage.local.set({ [HISTORY_KEY]: filtered });
}

// Clear all history
async function clearHistory(): Promise<void> {
  await chrome.storage.local.remove(HISTORY_KEY);
}

// ============ Analysis Task Management ============

// Save all analysis tasks to session storage (throttled per task)
async function saveAnalysisState(): Promise<void> {
  if (activeTasks.size === 0) return;

  const tasksObj = Object.fromEntries(activeTasks);
  await chrome.storage.session.set({ [ANALYSIS_STATE_KEY]: tasksObj });
}

// Force save analysis state (bypass throttle)
async function forceSaveAnalysisState(): Promise<void> {
  if (activeTasks.size === 0) {
    await chrome.storage.session.remove(ANALYSIS_STATE_KEY);
    return;
  }

  // Update lastUpdatedAt for all tasks
  const now = Date.now();
  for (const task of activeTasks.values()) {
    task.lastUpdatedAt = now;
  }

  const tasksObj = Object.fromEntries(activeTasks);
  await chrome.storage.session.set({ [ANALYSIS_STATE_KEY]: tasksObj });
}

// Get analysis state for a specific task
async function getAnalysisState(taskId: string): Promise<AnalysisTask | null> {
  // First check in-memory
  let task = activeTasks.get(taskId);

  // If not in memory, try to restore from session storage
  if (!task) {
    const result = await chrome.storage.session.get(ANALYSIS_STATE_KEY);
    const tasksObj = result[ANALYSIS_STATE_KEY] as Record<string, AnalysisTask> | undefined;
    if (tasksObj && tasksObj[taskId]) {
      task = tasksObj[taskId];
      activeTasks.set(taskId, task);
    }
  }

  if (!task) return null;

  // Check for timeout
  if (task.stage !== 'complete' && task.stage !== 'error' && task.stage !== 'idle') {
    if (Date.now() - task.lastUpdatedAt > ANALYSIS_TIMEOUT) {
      task.stage = 'error';
      task.error = 'Analysis timed out. Please try again.';
      await forceSaveAnalysisState();
    }
  }

  return task;
}

// Clear analysis state for a specific task
async function clearAnalysisState(taskId: string): Promise<void> {
  activeTasks.delete(taskId);
  lastSaveTimes.delete(taskId);
  await forceSaveAnalysisState();
}

// Update task state (throttled save)
function updateTask(taskId: string, updates: Partial<AnalysisTask>): void {
  const task = activeTasks.get(taskId);
  if (!task) return;

  Object.assign(task, updates);
  task.lastUpdatedAt = Date.now();

  // Throttled save per task
  const now = Date.now();
  const lastSave = lastSaveTimes.get(taskId) || 0;
  if (now - lastSave >= THROTTLE_INTERVAL) {
    lastSaveTimes.set(taskId, now);
    saveAnalysisState();
  }
}

// Clean up completed tasks after delay
function scheduleTaskCleanup(taskId: string): void {
  setTimeout(() => {
    const task = activeTasks.get(taskId);
    if (task && (task.stage === 'complete' || task.stage === 'error')) {
      activeTasks.delete(taskId);
      lastSaveTimes.delete(taskId);
      saveAnalysisState();
    }
  }, TASK_CLEANUP_DELAY);
}

// Start analysis in background
async function startBackgroundAnalysis(owner: string, repo: string): Promise<AnalysisTask> {
  const taskId = `${owner}/${repo}`;

  // Check if same task is already running
  const existing = activeTasks.get(taskId);
  if (existing && existing.stage !== 'complete' && existing.stage !== 'error' && existing.stage !== 'idle') {
    return existing;
  }

  // Check concurrent task limit
  const runningCount = [...activeTasks.values()]
    .filter(t => t.stage !== 'complete' && t.stage !== 'error' && t.stage !== 'idle').length;

  if (runningCount >= MAX_CONCURRENT_TASKS) {
    throw new Error(`最多同时分析 ${MAX_CONCURRENT_TASKS} 个仓库`);
  }

  // Initialize new task
  const task: AnalysisTask = {
    id: taskId,
    owner,
    repo,
    stage: 'fetching',
    progress: 0,
    analysis: '',
    repoInfo: null,
    chunkProgress: null,
    error: null,
    startedAt: Date.now(),
    lastUpdatedAt: Date.now(),
  };

  activeTasks.set(taskId, task);
  await forceSaveAnalysisState();

  // Run analysis asynchronously
  runAnalysis(owner, repo).catch((err) => {
    console.error('Analysis error:', err);
    const currentTask = activeTasks.get(taskId);
    if (currentTask) {
      currentTask.stage = 'error';
      currentTask.error = err instanceof Error ? err.message : 'Unknown error occurred';
      forceSaveAnalysisState();
      scheduleTaskCleanup(taskId);
    }
  });

  return task;
}

// Run the actual analysis
async function runAnalysis(owner: string, repo: string): Promise<void> {
  const taskId = `${owner}/${repo}`;

  try {
    const settings = await getSettings();

    // Set GitHub token
    githubAPI.setToken(settings.githubToken || null);

    // Fetch repo info
    updateTask(taskId, { progress: 10 });
    const fetchedRepoInfo = await githubAPI.getRepoInfo(owner, repo);
    updateTask(taskId, { repoInfo: fetchedRepoInfo });

    // Extract skeleton
    updateTask(taskId, { stage: 'extracting', progress: 30 });
    await forceSaveAnalysisState();

    const extractedSkeleton = await extractCodeSkeleton(fetchedRepoInfo, (_stage, p) => {
      updateTask(taskId, { progress: 30 + (p * 0.3) });
    });

    // Get API key and model
    const apiKey = settings.aiProvider === 'claude'
      ? settings.claudeApiKey
      : settings.aiProvider === 'openai'
      ? settings.openaiApiKey
      : settings.aiProvider === 'siliconflow'
      ? settings.siliconflowApiKey
      : settings.bigmodelApiKey;

    const model = settings.aiProvider === 'claude'
      ? settings.claudeModel
      : settings.aiProvider === 'openai'
      ? settings.openaiModel
      : settings.aiProvider === 'siliconflow'
      ? settings.siliconflowModel
      : settings.bigmodelModel;

    if (!apiKey) {
      throw new Error('API key not configured');
    }

    // Get active prompt template
    const activeTemplate = getTemplateById(
      settings.activeTemplateId || 'preset-default',
      settings.customTemplates
    );

    // Check if chunking is needed
    const readmeLength = fetchedRepoInfo.readme?.length || 0;
    const modelToUse = model || 'claude-sonnet-4-20250514';
    const { needsChunking: useChunking, estimatedChunks } = checkNeedsChunking(
      extractedSkeleton,
      modelToUse,
      readmeLength
    );

    // Start AI analysis
    updateTask(taskId, { stage: 'analyzing', progress: 60 });
    await forceSaveAnalysisState();

    let fullAnalysis = '';

    if (useChunking && estimatedChunks > 1) {
      // Chunked analysis
      await analyzeWithChunking(
        settings.aiProvider,
        apiKey,
        modelToUse,
        extractedSkeleton,
        fetchedRepoInfo,
        {
          onToken: (token) => {
            if (!activeTasks.has(taskId)) return;
            fullAnalysis += token;
            updateTask(taskId, { analysis: fullAnalysis });
          },
          onComplete: async (text) => {
            if (!activeTasks.has(taskId)) return;
            updateTask(taskId, {
              analysis: text,
              stage: 'complete',
              progress: 100,
              chunkProgress: null,
            });
            await forceSaveAnalysisState();

            // Cache the result
            await cacheAnalysis(taskId, {
              repoInfo: fetchedRepoInfo,
              skeleton: extractedSkeleton,
              aiAnalysis: text,
              generatedAt: Date.now(),
            });

            // Add to history
            await addHistoryEntry(taskId, fetchedRepoInfo, text);

            // Schedule cleanup
            scheduleTaskCleanup(taskId);
          },
          onError: (err) => {
            throw err;
          },
        },
        (progress: ChunkedAnalysisProgress) => {
          if (!activeTasks.has(taskId)) return;
          const chunkPercent = (progress.currentChunk / progress.totalChunks) * 100;
          updateTask(taskId, {
            chunkProgress: progress,
            progress: 60 + (chunkPercent * 0.35),
          });
        }
      );
    } else {
      // Standard analysis
      await analyzeWithAI(
        settings.aiProvider,
        apiKey,
        model,
        extractedSkeleton,
        fetchedRepoInfo,
        {
          onToken: (token) => {
            if (!activeTasks.has(taskId)) return;
            fullAnalysis += token;
            updateTask(taskId, { analysis: fullAnalysis });
          },
          onComplete: async (text) => {
            if (!activeTasks.has(taskId)) return;
            updateTask(taskId, {
              analysis: text,
              stage: 'complete',
              progress: 100,
            });
            await forceSaveAnalysisState();

            // Cache the result
            await cacheAnalysis(taskId, {
              repoInfo: fetchedRepoInfo,
              skeleton: extractedSkeleton,
              aiAnalysis: text,
              generatedAt: Date.now(),
            });

            // Add to history
            await addHistoryEntry(taskId, fetchedRepoInfo, text);

            // Schedule cleanup
            scheduleTaskCleanup(taskId);
          },
          onError: (err) => {
            throw err;
          },
        },
        activeTemplate
      );
    }
  } catch (err) {
    const task = activeTasks.get(taskId);
    if (task) {
      task.stage = 'error';
      task.error = err instanceof Error ? err.message : 'Unknown error occurred';
      await forceSaveAnalysisState();
      scheduleTaskCleanup(taskId);
    }
    throw err;
  }
}

// Message handler
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message, sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(
  message: { type: string; payload?: unknown },
  sendResponse: (response: unknown) => void
) {
  try {
    switch (message.type) {
      case 'GET_SETTINGS': {
        const settings = await getSettings();
        sendResponse({ success: true, data: settings });
        break;
      }

      case 'SAVE_SETTINGS': {
        await saveSettings(message.payload as StorageSettings);
        sendResponse({ success: true });
        break;
      }

      case 'GET_REPO_INFO': {
        const { owner, repo } = message.payload as { owner: string; repo: string };
        const settings = await getSettings();

        if (settings.githubToken) {
          githubAPI.setToken(settings.githubToken);
        }

        const repoInfo = await githubAPI.getRepoInfo(owner, repo);
        sendResponse({ success: true, data: repoInfo });
        break;
      }

      case 'EXTRACT_SKELETON': {
        const { owner, repo } = message.payload as { owner: string; repo: string };
        const settings = await getSettings();

        if (settings.githubToken) {
          githubAPI.setToken(settings.githubToken);
        }

        const repoInfo = await githubAPI.getRepoInfo(owner, repo);
        const skeleton = await extractCodeSkeleton(repoInfo);
        sendResponse({ success: true, data: { repoInfo, skeleton } });
        break;
      }

      case 'CHECK_CACHE': {
        const { owner, repo } = message.payload as { owner: string; repo: string };
        const repoKey = `${owner}/${repo}`;
        const cached = await getCachedAnalysis(repoKey);
        sendResponse({ success: true, data: cached });
        break;
      }

      case 'SAVE_CACHE': {
        const { owner, repo, result } = message.payload as {
          owner: string;
          repo: string;
          result: CachedAnalysis['result'];
        };
        const repoKey = `${owner}/${repo}`;
        await cacheAnalysis(repoKey, result);
        sendResponse({ success: true });
        break;
      }

      case 'CLEAR_CACHE': {
        await clearCache();
        sendResponse({ success: true });
        break;
      }

      case 'REPO_PAGE_DETECTED': {
        // Could be used for badge updates or other UI feedback
        console.log('Repo page detected:', message.payload);
        break;
      }

      case 'CHECK_FEISHU_LOGIN': {
        const isLoggedIn = await checkFeishuLogin();
        sendResponse({ success: true, data: { isLoggedIn } });
        break;
      }

      case 'SAVE_TO_FEISHU': {
        const { markdown, title, sourceUrl } = message.payload as {
          markdown: string;
          title: string;
          sourceUrl: string;
        };
        const result = await saveToFeishu(markdown, title, sourceUrl);
        sendResponse(result);
        break;
      }

      case 'START_ANALYSIS': {
        const { owner, repo } = message.payload as { owner: string; repo: string };
        const task = await startBackgroundAnalysis(owner, repo);
        sendResponse({ success: true, data: task });
        break;
      }

      case 'GET_ANALYSIS_STATE': {
        const { owner, repo } = message.payload as { owner: string; repo: string };
        const taskId = `${owner}/${repo}`;
        const state = await getAnalysisState(taskId);
        sendResponse({ success: true, data: state });
        break;
      }

      case 'CANCEL_ANALYSIS': {
        const { owner, repo } = message.payload as { owner: string; repo: string };
        const taskId = `${owner}/${repo}`;
        await clearAnalysisState(taskId);
        sendResponse({ success: true });
        break;
      }

      case 'GET_HISTORY': {
        const history = await getHistory();
        sendResponse({ success: true, data: history });
        break;
      }

      case 'GET_HISTORY_ENTRY': {
        const { owner, repo } = message.payload as { owner: string; repo: string };
        const repoKey = `${owner}/${repo}`;
        const history = await getHistory();
        const entry = history.find(h => h.repoKey === repoKey) || null;
        sendResponse({ success: true, data: entry });
        break;
      }

      case 'DELETE_HISTORY_ENTRY': {
        const { repoKey } = message.payload as { repoKey: string };
        await deleteHistoryEntry(repoKey);
        sendResponse({ success: true });
        break;
      }

      case 'CLEAR_HISTORY': {
        await clearHistory();
        sendResponse({ success: true });
        break;
      }

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('Background script error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('GitHub Guide Tool installed');
  // Clean up any expired cache on install/update
  const cleaned = await cleanupExpiredCache();
  if (cleaned > 0) {
    console.log(`Cleaned ${cleaned} expired cache entries on startup`);
  }
});
