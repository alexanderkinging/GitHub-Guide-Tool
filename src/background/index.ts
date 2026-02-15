import type { StorageSettings, CachedAnalysis } from '@/types';
import { githubAPI } from '@/lib/github';
import { extractCodeSkeleton } from '@/lib/analyzer';

// Cache duration: 24 hours
const CACHE_DURATION = 24 * 60 * 60 * 1000;

// Storage limit: 4.5MB (leaving some buffer from 5MB limit)
const MAX_STORAGE_BYTES = 4.5 * 1024 * 1024;

// Storage keys
const SETTINGS_KEY = 'settings';
const CACHE_KEY = 'analysisCache';

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
  let html = markdown
    // Headers
    .replace(/^###### (.+)$/gm, '<h6>$1</h6>')
    .replace(/^##### (.+)$/gm, '<h5>$1</h5>')
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p>')
    // Line breaks
    .replace(/\n/g, '<br>');

  return `<p>${html}</p>`.replace(/<p><\/p>/g, '').replace(/<p>(<h[1-6]>)/g, '$1').replace(/(<\/h[1-6]>)<\/p>/g, '$1');
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
