import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import js from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript';
import ts from 'react-syntax-highlighter/dist/esm/languages/hljs/typescript';
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python';
import bash from 'react-syntax-highlighter/dist/esm/languages/hljs/bash';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import { githubGist } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import type { StorageSettings, RepoInfo, AnalysisResult } from '@/types';
import { githubAPI } from '@/lib/github';
import { extractCodeSkeleton, determineProjectSize } from '@/lib/analyzer';
import { analyzeWithAI } from '@/lib/ai';

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

interface AnalysisProps {
  owner: string;
  repo: string;
  settings: StorageSettings;
  onOpenSettings?: () => void;
}

type Stage = 'idle' | 'fetching' | 'extracting' | 'analyzing' | 'complete' | 'error';

const STAGE_LABELS: Record<Stage, string> = {
  idle: 'Ready',
  fetching: 'Fetching repository info...',
  extracting: 'Extracting code skeleton...',
  analyzing: 'Generating analysis...',
  complete: 'Analysis complete',
  error: 'Error occurred',
};

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

export default function Analysis({ owner, repo, settings, onOpenSettings }: AnalysisProps) {
  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState(0);
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [analysis, setAnalysis] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [feishuSaving, setFeishuSaving] = useState(false);
  const analysisRef = useRef<HTMLDivElement>(null);

  // Check for cached analysis on mount
  useEffect(() => {
    let isMounted = true;

    async function checkCache() {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'CHECK_CACHE',
          payload: { owner, repo },
        });
        if (isMounted && response.success && response.data) {
          const cachedResult = response.data.result as AnalysisResult;
          setRepoInfo(cachedResult.repoInfo);
          setAnalysis(cachedResult.aiAnalysis);
          setStage('complete');
          setCached(true);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Cache check error:', err);
        }
      }
    }
    checkCache();

    return () => {
      isMounted = false;
    };
  }, [owner, repo]);

  const startAnalysis = async () => {
    setStage('fetching');
    setProgress(0);
    setError(null);
    setAnalysis('');
    setCached(false);

    try {
      // Set GitHub token (explicitly clear if not configured)
      githubAPI.setToken(settings.githubToken || null);

      // Fetch repo info
      setProgress(10);
      const fetchedRepoInfo = await githubAPI.getRepoInfo(owner, repo);
      setRepoInfo(fetchedRepoInfo);

      // Extract skeleton
      setStage('extracting');
      setProgress(30);
      const extractedSkeleton = await extractCodeSkeleton(fetchedRepoInfo, (_stage, p) => {
        setProgress(30 + (p * 0.3));
      });

      // Get API key and model for current provider
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

      // Start AI analysis with streaming
      setStage('analyzing');
      setProgress(60);

      let fullAnalysis = '';
      await analyzeWithAI(
        settings.aiProvider,
        apiKey,
        model,
        extractedSkeleton,
        fetchedRepoInfo,
        {
          onToken: (token) => {
            fullAnalysis += token;
            setAnalysis(fullAnalysis);
            // Auto-scroll to bottom during streaming
            if (analysisRef.current) {
              analysisRef.current.scrollTop = analysisRef.current.scrollHeight;
            }
          },
          onComplete: async (text) => {
            setAnalysis(text);
            setStage('complete');
            setProgress(100);

            // Cache the result
            try {
              await chrome.runtime.sendMessage({
                type: 'SAVE_CACHE',
                payload: {
                  owner,
                  repo,
                  result: {
                    repoInfo: fetchedRepoInfo,
                    skeleton: extractedSkeleton,
                    aiAnalysis: text,
                    generatedAt: Date.now(),
                  },
                },
              });
            } catch (err) {
              console.error('Cache save error:', err);
            }
          },
          onError: (err) => {
            throw err;
          },
        }
      );
    } catch (err) {
      setStage('error');
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
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
      setError('Failed to export Markdown file');
    }
  };

  const copyToClipboard = async () => {
    if (!analysis) return;
    await navigator.clipboard.writeText(analysis);
  };

  const saveToFeishu = async () => {
    if (!analysis || feishuSaving) return;

    setFeishuSaving(true);
    setError(null);

    try {
      // Check login status first
      const loginCheck = await chrome.runtime.sendMessage({
        type: 'CHECK_FEISHU_LOGIN',
      });

      if (!loginCheck.success || !loginCheck.data?.isLoggedIn) {
        setError('请先登录 feishu.cn');
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
        // Open the created document
        window.open(result.url, '_blank');
      } else {
        setError(result.error || '保存到飞书失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存到飞书失败');
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
            <span className="text-gray-600">{STAGE_LABELS[stage]}</span>
            <span className="text-gray-400">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
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
                onClick={() => window.open(GITHUB_TOKEN_URL, '_blank')}
                className="text-blue-600 hover:underline text-xs"
              >
                → 创建 Token
              </button>
            </div>
          )}
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
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const isInline = !match;
                  return !isInline ? (
                    <SyntaxHighlighter
                      style={githubGist}
                      language={match[1]}
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

      {/* Action Buttons */}
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
    </div>
  );
}
