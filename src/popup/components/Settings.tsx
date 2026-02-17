import { useState, useEffect } from 'react';
import type { StorageSettings, AIProvider } from '@/types';
import { AI_MODELS } from '@/lib/ai';
import type { TokenPermissions } from '@/lib/github';

// GitHub Token 创建 URL，预填所需权限
const GITHUB_TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=repo&description=GitHub%20Guide%20Tool';
const GITHUB_API_BASE = 'https://api.github.com';

// 独立的 Token 检测函数，不污染全局 githubAPI
async function checkTokenPermissions(token: string): Promise<TokenPermissions> {
  if (!token) {
    return {
      isValid: false,
      hasPrivateAccess: false,
      scopes: [],
      rateLimit: { remaining: 0, limit: 0, reset: 0 },
      error: 'No token configured',
    };
  }

  try {
    const response = await fetch(`${GITHUB_API_BASE}/user`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${token}`,
      },
    });

    const rateLimit = {
      remaining: parseInt(response.headers.get('X-RateLimit-Remaining') || '0', 10),
      limit: parseInt(response.headers.get('X-RateLimit-Limit') || '0', 10),
      reset: parseInt(response.headers.get('X-RateLimit-Reset') || '0', 10),
    };

    if (!response.ok) {
      return {
        isValid: false,
        hasPrivateAccess: false,
        scopes: [],
        rateLimit,
        error: response.status === 401 ? 'Invalid token' : `HTTP ${response.status}`,
      };
    }

    const scopesHeader = response.headers.get('X-OAuth-Scopes') || '';
    const scopes = scopesHeader.split(',').map(s => s.trim()).filter(Boolean);
    const userData = await response.json();

    const hasPrivateAccess: boolean | 'unknown' = scopes.length === 0
      ? 'unknown'
      : scopes.includes('repo') || scopes.some(s => s.startsWith('repo'));

    return {
      isValid: true,
      hasPrivateAccess,
      scopes,
      rateLimit,
      user: userData.login,
    };
  } catch (error) {
    return {
      isValid: false,
      hasPrivateAccess: false,
      scopes: [],
      rateLimit: { remaining: 0, limit: 0, reset: 0 },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

interface SettingsProps {
  settings: StorageSettings | null;
  onSave: (settings: StorageSettings) => void;
  onCancel: () => void;
}

// chrome.storage.session key for draft settings
const DRAFT_KEY = 'settings-draft';

// Get default form data from saved settings
function getDefaultFormData(settings: StorageSettings | null): StorageSettings {
  return {
    aiProvider: settings?.aiProvider || 'claude',
    githubToken: settings?.githubToken || '',
    claudeApiKey: settings?.claudeApiKey || '',
    openaiApiKey: settings?.openaiApiKey || '',
    siliconflowApiKey: settings?.siliconflowApiKey || '',
    bigmodelApiKey: settings?.bigmodelApiKey || '',
    claudeModel: settings?.claudeModel || '',
    openaiModel: settings?.openaiModel || '',
    siliconflowModel: settings?.siliconflowModel || '',
    bigmodelModel: settings?.bigmodelModel || '',
  };
}

export default function Settings({ settings, onSave, onCancel }: SettingsProps) {
  const [formData, setFormData] = useState<StorageSettings>(() => getDefaultFormData(settings));
  const [draftLoaded, setDraftLoaded] = useState(false);

  const [tokenStatus, setTokenStatus] = useState<TokenPermissions | null>(null);
  const [checkingToken, setCheckingToken] = useState(false);

  // Load draft from chrome.storage.session on mount
  useEffect(() => {
    chrome.storage.session.get(DRAFT_KEY, (result) => {
      if (result[DRAFT_KEY]) {
        setFormData(result[DRAFT_KEY]);
      }
      setDraftLoaded(true);
    });
  }, []);

  // Save draft to chrome.storage.session when form data changes (after initial load)
  useEffect(() => {
    if (draftLoaded) {
      chrome.storage.session.set({ [DRAFT_KEY]: formData });
    }
  }, [formData, draftLoaded]);

  // Check token when it changes (using local function, not global githubAPI)
  useEffect(() => {
    const doCheck = async () => {
      if (!formData.githubToken) {
        setTokenStatus(null);
        return;
      }

      setCheckingToken(true);
      const permissions = await checkTokenPermissions(formData.githubToken);
      setTokenStatus(permissions);
      setCheckingToken(false);
    };

    const debounce = setTimeout(doCheck, 500);
    return () => clearTimeout(debounce);
  }, [formData.githubToken]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Clear draft after successful save
    chrome.storage.session.remove(DRAFT_KEY);
    onSave(formData);
  };

  const handleCancel = () => {
    // Clear draft on cancel
    chrome.storage.session.remove(DRAFT_KEY);
    onCancel();
  };

  const currentApiKey = formData.aiProvider === 'claude'
    ? formData.claudeApiKey
    : formData.aiProvider === 'openai'
    ? formData.openaiApiKey
    : formData.aiProvider === 'siliconflow'
    ? formData.siliconflowApiKey
    : formData.bigmodelApiKey;

  const currentModel = formData.aiProvider === 'claude'
    ? formData.claudeModel
    : formData.aiProvider === 'openai'
    ? formData.openaiModel
    : formData.aiProvider === 'siliconflow'
    ? formData.siliconflowModel
    : formData.bigmodelModel;

  const setCurrentApiKey = (value: string) => {
    if (formData.aiProvider === 'claude') {
      setFormData({ ...formData, claudeApiKey: value });
    } else if (formData.aiProvider === 'openai') {
      setFormData({ ...formData, openaiApiKey: value });
    } else if (formData.aiProvider === 'siliconflow') {
      setFormData({ ...formData, siliconflowApiKey: value });
    } else {
      setFormData({ ...formData, bigmodelApiKey: value });
    }
  };

  const setCurrentModel = (value: string) => {
    if (formData.aiProvider === 'claude') {
      setFormData({ ...formData, claudeModel: value });
    } else if (formData.aiProvider === 'openai') {
      setFormData({ ...formData, openaiModel: value });
    } else if (formData.aiProvider === 'siliconflow') {
      setFormData({ ...formData, siliconflowModel: value });
    } else {
      setFormData({ ...formData, bigmodelModel: value });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          GitHub Token
        </label>
        <input
          type="password"
          value={formData.githubToken}
          onChange={(e) => setFormData({ ...formData, githubToken: e.target.value })}
          placeholder="ghp_xxxxxxxxxxxx"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />

        {/* Token Status */}
        {checkingToken && (
          <p className="mt-1 text-xs text-gray-500">检测 Token 权限中...</p>
        )}
        {!checkingToken && tokenStatus && (
          <div className="mt-1 text-xs">
            {tokenStatus.isValid ? (
              <div className="space-y-1">
                <p className="text-green-600">
                  ✓ Token 有效 {tokenStatus.user && `(@${tokenStatus.user})`}
                </p>
                <p className={
                  tokenStatus.hasPrivateAccess === true
                    ? 'text-green-600'
                    : tokenStatus.hasPrivateAccess === 'unknown'
                    ? 'text-blue-600'
                    : 'text-yellow-600'
                }>
                  {tokenStatus.hasPrivateAccess === true
                    ? '✓ 可访问私有仓库'
                    : tokenStatus.hasPrivateAccess === 'unknown'
                    ? 'ℹ Fine-grained Token（权限取决于创建时的配置）'
                    : '⚠ 仅可访问公开仓库'}
                </p>
                <p className="text-gray-500">
                  API 配额: {tokenStatus.rateLimit.remaining}/{tokenStatus.rateLimit.limit}
                </p>
              </div>
            ) : (
              <p className="text-red-600">✗ Token 无效: {tokenStatus.error}</p>
            )}
          </div>
        )}
        {!checkingToken && !tokenStatus && !formData.githubToken && (
          <p className="mt-1 text-xs text-gray-500">
            可选。添加 Token 可提高 API 配额并访问私有仓库。
          </p>
        )}

        {/* Create Token Button */}
        <button
          type="button"
          onClick={() => window.open(GITHUB_TOKEN_URL, '_blank', 'noopener,noreferrer')}
          className="mt-2 text-xs text-blue-600 hover:underline"
        >
          → 创建 GitHub Token（需要 repo 权限）
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          AI Provider
        </label>
        <select
          value={formData.aiProvider}
          onChange={(e) => setFormData({ ...formData, aiProvider: e.target.value as AIProvider })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        >
          <option value="claude">Claude (Anthropic)</option>
          <option value="openai">OpenAI</option>
          <option value="siliconflow">SiliconFlow</option>
          <option value="bigmodel">BigModel (智谱AI)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {formData.aiProvider === 'claude' ? 'Claude' : formData.aiProvider === 'openai' ? 'OpenAI' : formData.aiProvider === 'siliconflow' ? 'SiliconFlow' : 'BigModel'} API Key
        </label>
        <input
          type="password"
          value={currentApiKey}
          onChange={(e) => setCurrentApiKey(e.target.value)}
          placeholder={
            formData.aiProvider === 'claude'
              ? 'sk-ant-xxxxxxxxxxxx'
              : formData.aiProvider === 'bigmodel'
              ? 'xxxxxxxx.xxxxxxxx'
              : 'sk-xxxxxxxxxxxx'
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Model
        </label>
        <select
          value={currentModel}
          onChange={(e) => setCurrentModel(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        >
          <option value="">Default</option>
          {AI_MODELS[formData.aiProvider].map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handleCancel}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          Save
        </button>
      </div>
    </form>
  );
}
