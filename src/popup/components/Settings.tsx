import { useState } from 'react';
import type { StorageSettings, AIProvider } from '@/types';
import { AI_MODELS } from '@/lib/ai';

interface SettingsProps {
  settings: StorageSettings | null;
  onSave: (settings: StorageSettings) => void;
  onCancel: () => void;
}

export default function Settings({ settings, onSave, onCancel }: SettingsProps) {
  const [formData, setFormData] = useState<StorageSettings>({
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
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
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
          GitHub Token (Optional)
        </label>
        <input
          type="password"
          value={formData.githubToken}
          onChange={(e) => setFormData({ ...formData, githubToken: e.target.value })}
          placeholder="ghp_xxxxxxxxxxxx"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">
          Increases API rate limit. Get one from GitHub Settings → Developer settings → Personal access tokens
        </p>
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
          onClick={onCancel}
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
