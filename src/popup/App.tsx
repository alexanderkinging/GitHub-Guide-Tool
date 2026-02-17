import { useState, useEffect } from 'react';
import type { StorageSettings } from '@/types';
import Settings from './components/Settings';
import Analysis from './components/Analysis';
import PromptEditor from './components/PromptEditor';
import History from './components/History';
import Header from './components/Header';

type View = 'main' | 'settings' | 'prompts' | 'history';

interface CurrentRepo {
  owner: string;
  repo: string;
}

export default function App() {
  const [view, setView] = useState<View>('main');
  const [settings, setSettings] = useState<StorageSettings | null>(null);
  const [currentRepo, setCurrentRepo] = useState<CurrentRepo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load settings and detect current repo on mount
  useEffect(() => {
    async function init() {
      try {
        // Load settings
        const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
        if (response.success) {
          setSettings(response.data);
        }

        // Get current tab and check if it's a GitHub repo
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id && tab.url?.includes('github.com')) {
          const repoResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_REPO' });
          if (repoResponse?.isRepoPage) {
            setCurrentRepo({ owner: repoResponse.owner, repo: repoResponse.repo });
          }
        }
      } catch (err) {
        console.error('Init error:', err);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  const handleSaveSettings = async (newSettings: StorageSettings) => {
    try {
      await chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: newSettings });
      setSettings(newSettings);
      if (view === 'settings') {
        setView('main');
      }
    } catch (err) {
      setError('Failed to save settings');
    }
  };

  const hasApiKey = settings && (
    (settings.aiProvider === 'claude' && settings.claudeApiKey) ||
    (settings.aiProvider === 'openai' && settings.openaiApiKey) ||
    (settings.aiProvider === 'siliconflow' && settings.siliconflowApiKey) ||
    (settings.aiProvider === 'bigmodel' && settings.bigmodelApiKey)
  );

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white">
      <Header
        onSettingsClick={() => setView(view === 'settings' ? 'main' : 'settings')}
        onPromptsClick={() => setView(view === 'prompts' ? 'main' : 'prompts')}
        onHistoryClick={() => setView(view === 'history' ? 'main' : 'history')}
        isSettingsView={view === 'settings'}
        isPromptsView={view === 'prompts'}
        isHistoryView={view === 'history'}
      />

      {error && (
        <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      {view === 'settings' ? (
        <Settings
          settings={settings}
          onSave={handleSaveSettings}
          onCancel={() => setView('main')}
        />
      ) : view === 'prompts' ? (
        <PromptEditor
          settings={settings!}
          onSave={handleSaveSettings}
        />
      ) : view === 'history' ? (
        <History
          onSelectRepo={(owner, repo) => {
            setCurrentRepo({ owner, repo });
            setView('main');
          }}
        />
      ) : (
        <div className="p-4">
          {!hasApiKey ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">
                Please configure your API keys in settings to start analyzing repositories.
              </p>
              <button
                onClick={() => setView('settings')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Open Settings
              </button>
            </div>
          ) : !currentRepo ? (
            <div className="text-center py-8">
              <p className="text-gray-600">
                Navigate to a GitHub repository page to analyze it.
              </p>
              <p className="text-gray-400 text-sm mt-2">
                Example: github.com/owner/repo
              </p>
            </div>
          ) : (
            <Analysis
              owner={currentRepo.owner}
              repo={currentRepo.repo}
              settings={settings!}
              onOpenSettings={() => setView('settings')}
            />
          )}
        </div>
      )}
    </div>
  );
}
