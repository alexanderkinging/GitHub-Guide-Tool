import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import js from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript';
import ts from 'react-syntax-highlighter/dist/esm/languages/hljs/typescript';
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python';
import bash from 'react-syntax-highlighter/dist/esm/languages/hljs/bash';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import go from 'react-syntax-highlighter/dist/esm/languages/hljs/go';
import rust from 'react-syntax-highlighter/dist/esm/languages/hljs/rust';
import java from 'react-syntax-highlighter/dist/esm/languages/hljs/java';
import cpp from 'react-syntax-highlighter/dist/esm/languages/hljs/cpp';
import { githubGist } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import type { StorageSettings, AnalysisResult, AnalysisTask, AnalysisStage, HistoryEntry } from '@/types';
import { determineProjectSize } from '@/lib/analyzer';

// Register only needed languages
SyntaxHighlighter.registerLanguage('javascript', js);
SyntaxHighlighter.registerLanguage('js', js);
SyntaxHighlighter.registerLanguage('typescript', ts);
SyntaxHighlighter.registerLanguage('ts', ts);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('py', python);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('sh', bash);
SyntaxHighlighter.registerLanguage('shell', bash);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('go', go);
SyntaxHighlighter.registerLanguage('golang', go);
SyntaxHighlighter.registerLanguage('rust', rust);
SyntaxHighlighter.registerLanguage('rs', rust);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('cpp', cpp);
SyntaxHighlighter.registerLanguage('c++', cpp);
SyntaxHighlighter.registerLanguage('c', cpp);
SyntaxHighlighter.registerLanguage('cc', cpp);
SyntaxHighlighter.registerLanguage('cxx', cpp);
SyntaxHighlighter.registerLanguage('h', cpp);
SyntaxHighlighter.registerLanguage('hpp', cpp);

// Normalize language name (e.g., c++ -> cpp)
function normalizeLanguage(lang: string): string {
  const normalized = lang.toLowerCase();
  if (normalized === 'c++') return 'cpp';
  return normalized;
}

interface AnalysisProps {
  owner: string;
  repo: string;
  settings: StorageSettings;
  onOpenSettings?: () => void;
}

const STAGE_LABELS: Record<AnalysisStage, string> = {
  idle: 'Ready',
  fetching: 'Fetching repository info...',
  extracting: 'Extracting code skeleton...',
  analyzing: 'Generating analysis...',
  complete: 'Analysis complete',
  error: 'Error occurred',
};

const POLL_INTERVAL = 500; // 500ms

// GitHub Token 创建 URL
const GITHUB_TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=repo&description=GitHub%20Guide%20Tool';

// 检测是否为私有仓库权限错误
function isPrivateRepoError(errorMessage: string): boolean {
  return errorMessage.startsWith('PRIVATE_REPO_ACCESS_DENIED:');
}

// 获取用户友好的错误信息
function getDisplayError(errorMessage: string): string {
  if (errorMessage.startsWith('PRIVATE_REPO_ACCESS_DENIED:')) {
    return errorMessage.replace('PRIVATE_REPO_ACCESS_DENIED: ', '');
  }
  return errorMessage;
}

export default function Analysis({ owner, repo, settings: _settings, onOpenSettings }: AnalysisProps) {
  const [task, setTask] = useState<AnalysisTask | null>(null);
  const [cached, setCached] = useState(false);
  const [historyEntry, setHistoryEntry] = useState<HistoryEntry | null>(null);
  const [feishuSaving, setFeishuSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const analysisRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<number | null>(null);
  const lastAnalysisLengthRef = useRef(0);
  const userScrolledUpRef = useRef(false);

  // Derived state from task
  const stage: AnalysisStage = task?.stage || 'idle';
  const progress = task?.progress || 0;
  const repoInfo = task?.repoInfo || null;
  const analysis = task?.analysis || '';
  const error = localError || task?.error || null;
  const chunkProgress = task?.chunkProgress || null;

  // Poll for analysis state
  const pollState = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_ANALYSIS_STATE',
        payload: { owner, repo },
      });

      if (response.success && response.data) {
        const newTask = response.data as AnalysisTask;
        setTask(newTask);

        // Auto-scroll only if user hasn't scrolled up
        if (newTask.analysis.length > lastAnalysisLengthRef.current && analysisRef.current && !userScrolledUpRef.current) {
          analysisRef.current.scrollTop = analysisRef.current.scrollHeight;
        }
        lastAnalysisLengthRef.current = newTask.analysis.length;

        // Reset scroll tracking when analysis completes
        if (newTask.stage === 'complete' || newTask.stage === 'error') {
          userScrolledUpRef.current = false;
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      }
    } catch (err) {
      console.error('Poll state error:', err);
    }
  }, [owner, repo]);

  // Start polling
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = window.setInterval(pollState, POLL_INTERVAL);
    pollState(); // Immediate first poll
  }, [pollState]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Check for existing state or cache on mount
  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        // First check for ongoing analysis
        const stateResponse = await chrome.runtime.sendMessage({
          type: 'GET_ANALYSIS_STATE',
          payload: { owner, repo },
        });

        if (isMounted && stateResponse.success && stateResponse.data) {
          const existingTask = stateResponse.data as AnalysisTask;
          setTask(existingTask);
          lastAnalysisLengthRef.current = existingTask.analysis.length;

          // If still in progress, start polling
          if (existingTask.stage !== 'complete' && existingTask.stage !== 'error' && existingTask.stage !== 'idle') {
            startPolling();
          }
          return;
        }

        // Then check cache
        const cacheResponse = await chrome.runtime.sendMessage({
          type: 'CHECK_CACHE',
          payload: { owner, repo },
        });

        if (isMounted && cacheResponse.success && cacheResponse.data) {
          const cachedResult = cacheResponse.data.result as AnalysisResult;
          setTask({
            id: `${owner}/${repo}`,
            owner,
            repo,
            stage: 'complete',
            progress: 100,
            analysis: cachedResult.aiAnalysis,
            repoInfo: cachedResult.repoInfo,
            chunkProgress: null,
            error: null,
            startedAt: cachedResult.generatedAt,
            lastUpdatedAt: cachedResult.generatedAt,
          });
          setCached(true);
          return;
        }

        // Finally check history for expired cache fallback
        const historyResponse = await chrome.runtime.sendMessage({
          type: 'GET_HISTORY_ENTRY',
          payload: { owner, repo },
        });

        if (isMounted && historyResponse.success && historyResponse.data) {
          setHistoryEntry(historyResponse.data as HistoryEntry);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Initialize error:', err);
        }
      }
    }

    initialize();

    return () => {
      isMounted = false;
      stopPolling();
    };
  }, [owner, repo, startPolling, stopPolling]);

  const startAnalysis = async () => {
    setCached(false);
    setHistoryEntry(null);
    setLocalError(null);
    lastAnalysisLengthRef.current = 0;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'START_ANALYSIS',
        payload: { owner, repo },
      });

      if (response.success && response.data) {
        setTask(response.data as AnalysisTask);
        startPolling();
      }
    } catch (err) {
      console.error('Start analysis error:', err);
      setTask({
        id: `${owner}/${repo}`,
        owner,
        repo,
        stage: 'error',
        progress: 0,
        analysis: '',
        repoInfo: null,
        chunkProgress: null,
        error: err instanceof Error ? err.message : 'Failed to start analysis',
        startedAt: Date.now(),
        lastUpdatedAt: Date.now(),
      });
    }
  };

  const exportMarkdown = () => {
    if (!analysis) return;

    try {
      const blob = new Blob([analysis], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${owner}-${repo}-guide.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      setLocalError('Failed to export Markdown file');
    }
  };

  const copyToClipboard = async () => {
    if (!analysis) return;
    await navigator.clipboard.writeText(analysis);
  };

  const saveToFeishu = async () => {
    if (!analysis || feishuSaving) return;

    setFeishuSaving(true);
    setLocalError(null);

    try {
      // Check login status first
      const loginCheck = await chrome.runtime.sendMessage({
        type: 'CHECK_FEISHU_LOGIN',
      });

      if (!loginCheck.success || !loginCheck.data?.isLoggedIn) {
        setLocalError('请先登录 feishu.cn');
        return;
      }

      // Save to Feishu
      const result = await chrome.runtime.sendMessage({
        type: 'SAVE_TO_FEISHU',
        payload: {
          markdown: analysis,
          title: `${owner}/${repo} 项目分析`,
          sourceUrl: `https://github.com/${owner}/${repo}`,
        },
      });

      if (result.success && result.url) {
        // Open the created document with security attributes
        window.open(result.url, '_blank', 'noopener,noreferrer');
      } else {
        setLocalError(result.error || '保存到飞书失败');
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : '保存到飞书失败');
    } finally {
      setFeishuSaving(false);
    }
  };

  const projectSize = repoInfo ? determineProjectSize(repoInfo.fileCount) : null;

  return (
    <div className="space-y-4">
      {/* Repo Info Header */}
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-800">{owner}/{repo}</h2>
            {repoInfo && (
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                repoInfo.isPrivate
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-green-100 text-green-700'
              }`}>
                {repoInfo.isPrivate ? '🔒 私有' : '🌐 公开'}
              </span>
            )}
          </div>
          {repoInfo && (
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              <span>⭐ {repoInfo.stars.toLocaleString()}</span>
              <span>🔀 {repoInfo.forks.toLocaleString()}</span>
              <span>📁 {repoInfo.fileCount} files</span>
              {projectSize && (
                <span className={`px-2 py-0.5 rounded text-xs ${
                  projectSize === 'small' ? 'bg-green-100 text-green-700' :
                  projectSize === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {projectSize}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {stage !== 'idle' && stage !== 'complete' && stage !== 'error' && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              {chunkProgress
                ? chunkProgress.stage === 'generating'
                  ? 'Generating final report...'
                  : `Analyzing chunk ${chunkProgress.currentChunk}/${chunkProgress.totalChunks}...`
                : STAGE_LABELS[stage]}
            </span>
            <span className="text-gray-400">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          {chunkProgress && chunkProgress.totalChunks > 1 && (
            <div className="text-xs text-gray-500">
              Multi-round analysis: {chunkProgress.totalChunks} chunks detected
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
          <p className="text-red-700">{getDisplayError(error)}</p>
          {isPrivateRepoError(error) && (
            <div className="mt-2 flex gap-2">
              {onOpenSettings && (
                <button
                  onClick={onOpenSettings}
                  className="text-blue-600 hover:underline text-xs"
                >
                  → 打开设置
                </button>
              )}
              <button
                onClick={() => window.open(GITHUB_TOKEN_URL, '_blank', 'noopener,noreferrer')}
                className="text-blue-600 hover:underline text-xs"
              >
                → 创建 Token
              </button>
            </div>
          )}
        </div>
      )}

      {/* History Summary Card (when cache expired but history exists) */}
      {historyEntry && !task && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
          <div className="flex items-center gap-2 text-amber-800">
            <span className="text-lg">📋</span>
            <span className="font-medium">历史分析记录</span>
          </div>

          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span>⭐ {historyEntry.stars.toLocaleString()}</span>
            <span>{historyEntry.language}</span>
            <span className={`px-1.5 py-0.5 rounded text-xs ${
              historyEntry.isPrivate
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-green-100 text-green-700'
            }`}>
              {historyEntry.isPrivate ? '私有' : '公开'}
            </span>
          </div>

          <div className="text-sm text-gray-700">
            <div className="text-xs text-gray-500 mb-1">摘要:</div>
            <p className="line-clamp-3">{historyEntry.summary}...</p>
          </div>

          <div className="text-xs text-gray-500">
            上次分析: {new Date(historyEntry.analyzedAt).toLocaleString('zh-CN')}
          </div>

          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded">
            <span>⚠️</span>
            <span>缓存已过期，显示的是历史摘要</span>
          </div>

          <button
            onClick={startAnalysis}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
          >
            🔄 重新分析获取完整内容
          </button>
        </div>
      )}

      {/* Analysis Result */}
      {analysis && (
        <div className="space-y-2">
          {cached && (
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <span>📦 Cached result</span>
              <button
                onClick={startAnalysis}
                className="text-blue-600 hover:underline"
              >
                Refresh
              </button>
            </div>
          )}
          <div
            ref={analysisRef}
            className="markdown-body p-4 bg-gray-50 rounded-lg max-h-[350px] overflow-y-auto"
            onScroll={(e) => {
              const el = e.currentTarget;
              const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
              userScrolledUpRef.current = !isNearBottom;
            }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-([A-Za-z0-9#+-]+)/.exec(className || '');
                  const isInline = !match;
                  return !isInline ? (
                    <SyntaxHighlighter
                      style={githubGist}
                      language={normalizeLanguage(match[1])}
                      PreTag="div"
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {analysis}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Action Buttons (hidden when showing history card) */}
      {!(historyEntry && !task) && (
        <div className="flex gap-2">
          {stage === 'idle' || stage === 'error' ? (
            <button
              onClick={startAnalysis}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Analyze Repository
            </button>
          ) : stage === 'complete' ? (
            <>
              <button
                onClick={startAnalysis}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Re-analyze
              </button>
              <button
                onClick={copyToClipboard}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                title="Copy to clipboard"
              >
                📋
              </button>
              <button
                onClick={exportMarkdown}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                title="Export as Markdown"
              >
                💾
              </button>
              <button
                onClick={saveToFeishu}
                disabled={feishuSaving}
                className={`px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 ${
                  feishuSaving ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                title="保存到飞书文档"
              >
                {feishuSaving ? '⏳' : '📄'}
              </button>
            </>
          ) : (
            <button
              disabled
              className="flex-1 px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed font-medium"
            >
              Analyzing...
            </button>
          )}
        </div>
      )}
    </div>
  );
}
