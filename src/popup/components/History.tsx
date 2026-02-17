import { useState, useEffect } from 'react';
import type { HistoryEntry } from '@/types';

interface HistoryProps {
  onSelectRepo: (owner: string, repo: string) => void;
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return '刚刚';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  const months = Math.floor(days / 30);
  return `${months} 个月前`;
}

function formatStars(stars: number): string {
  if (stars >= 1000) {
    return `${(stars / 1000).toFixed(1)}k`;
  }
  return String(stars);
}

export default function History({ onSelectRepo }: HistoryProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_HISTORY' });
      if (response.success) {
        setHistory(response.data);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(repoKey: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await chrome.runtime.sendMessage({
        type: 'DELETE_HISTORY_ENTRY',
        payload: { repoKey }
      });
      setHistory(prev => prev.filter(h => h.repoKey !== repoKey));
    } catch (err) {
      console.error('Failed to delete history entry:', err);
    }
  }

  async function handleClearAll() {
    if (!confirm('确定要清空所有历史记录吗？')) return;
    try {
      await chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' });
      setHistory([]);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-600 font-medium">暂无分析历史</p>
          <p className="text-gray-400 text-sm mt-1">分析仓库后会自动记录在这里</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{history.length} 条记录</span>
        <button
          onClick={handleClearAll}
          className="text-sm text-red-500 hover:text-red-600"
        >
          清空全部
        </button>
      </div>

      <div className="space-y-2">
        {history.map((entry) => (
          <div
            key={entry.repoKey}
            onClick={() => onSelectRepo(entry.owner, entry.repo)}
            className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer transition-colors group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {entry.isPrivate && (
                    <span className="text-gray-400" title="Private">🔒</span>
                  )}
                  <span className="font-medium text-gray-800 truncate">
                    {entry.repoKey}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  <span>{entry.language}</span>
                  <span>·</span>
                  <span>{formatTimeAgo(entry.analyzedAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  ⭐ {formatStars(entry.stars)}
                </span>
                <button
                  onClick={(e) => handleDelete(entry.repoKey, e)}
                  className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="删除"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
            {entry.description && (
              <p className="mt-2 text-xs text-gray-500 line-clamp-1">
                {entry.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
