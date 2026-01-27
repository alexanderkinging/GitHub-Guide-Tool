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
