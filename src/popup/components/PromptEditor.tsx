import { useState, useEffect } from 'react';
import type { StorageSettings, PromptTemplate } from '@/types';
import {
  PRESET_TEMPLATES,
  getTemplateById,
  generateTemplateId,
} from '@/lib/prompts/presets';

interface PromptEditorProps {
  settings: StorageSettings;
  onSave: (settings: StorageSettings) => void;
}

export default function PromptEditor({ settings, onSave }: PromptEditorProps) {
  const [selectedId, setSelectedId] = useState<string>(
    settings.activeTemplateId || 'preset-default'
  );
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const currentTemplate = getTemplateById(selectedId, settings.customTemplates);

  // Load template when selection changes
  useEffect(() => {
    if (currentTemplate) {
      setEditingTemplate({ ...currentTemplate });
      setHasChanges(false);
    }
  }, [selectedId]);

  // Initialize editing template
  useEffect(() => {
    if (!editingTemplate && currentTemplate) {
      setEditingTemplate({ ...currentTemplate });
    }
  }, [currentTemplate, editingTemplate]);

  const handleTemplateChange = (id: string) => {
    if (hasChanges) {
      if (!confirm('有未保存的更改，确定要切换模板吗？')) {
        return;
      }
    }
    setSelectedId(id);
  };

  const handleFieldChange = (field: keyof PromptTemplate, value: string) => {
    if (!editingTemplate) return;
    setEditingTemplate({ ...editingTemplate, [field]: value });
    setHasChanges(true);
  };

  const handleSaveAsNew = () => {
    if (!editingTemplate) return;

    const newTemplate: PromptTemplate = {
      ...editingTemplate,
      id: generateTemplateId(),
      name: editingTemplate.name + ' (副本)',
      isPreset: false,
      createdAt: Date.now(),
    };

    const updatedCustomTemplates = [...(settings.customTemplates || []), newTemplate];
    const newSettings: StorageSettings = {
      ...settings,
      customTemplates: updatedCustomTemplates,
      activeTemplateId: newTemplate.id,
    };

    onSave(newSettings);
    setSelectedId(newTemplate.id);
    // 直接设置 editingTemplate，避免依赖异步的 settings 更新
    setEditingTemplate({ ...newTemplate });
    setHasChanges(false);
  };

  const handleSave = () => {
    if (!editingTemplate) return;

    if (editingTemplate.isPreset) {
      // Can't save preset, offer to save as new
      handleSaveAsNew();
      return;
    }

    // Update existing custom template
    const updatedCustomTemplates = (settings.customTemplates || []).map(t =>
      t.id === editingTemplate.id ? editingTemplate : t
    );

    const newSettings: StorageSettings = {
      ...settings,
      customTemplates: updatedCustomTemplates,
      activeTemplateId: editingTemplate.id,
    };

    onSave(newSettings);
    setHasChanges(false);
  };

  const handleDelete = () => {
    if (!editingTemplate || editingTemplate.isPreset) return;

    if (!confirm(`确定要删除模板 "${editingTemplate.name}" 吗？`)) {
      return;
    }

    const updatedCustomTemplates = (settings.customTemplates || []).filter(
      t => t.id !== editingTemplate.id
    );

    const newSettings: StorageSettings = {
      ...settings,
      customTemplates: updatedCustomTemplates,
      activeTemplateId: 'preset-default',
    };

    onSave(newSettings);
    setSelectedId('preset-default');
  };

  const handleSetActive = () => {
    const newSettings: StorageSettings = {
      ...settings,
      activeTemplateId: selectedId,
    };
    onSave(newSettings);
  };

  const handleCreateNew = () => {
    const newTemplate: PromptTemplate = {
      id: generateTemplateId(),
      name: '新模板',
      description: '',
      systemPrompt: '',
      userPrompt: '请分析这个项目：\n\n{skeleton}\n\n请用中文输出。',
      isPreset: false,
      createdAt: Date.now(),
    };

    const updatedCustomTemplates = [...(settings.customTemplates || []), newTemplate];
    const newSettings: StorageSettings = {
      ...settings,
      customTemplates: updatedCustomTemplates,
    };

    onSave(newSettings);
    setSelectedId(newTemplate.id);
    // 直接设置 editingTemplate，避免依赖异步的 settings 更新
    setEditingTemplate({ ...newTemplate });
    setHasChanges(false);
  };

  const isActive = settings.activeTemplateId === selectedId ||
    (!settings.activeTemplateId && selectedId === 'preset-default');

  return (
    <div className="p-4 space-y-4">
      {/* Template Selector */}
      <div className="flex gap-2">
        <select
          value={selectedId}
          onChange={(e) => handleTemplateChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <optgroup label="预设模板">
            {PRESET_TEMPLATES.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} {settings.activeTemplateId === t.id || (!settings.activeTemplateId && t.id === 'preset-default') ? '✓' : ''}
              </option>
            ))}
          </optgroup>
          {(settings.customTemplates?.length ?? 0) > 0 && (
            <optgroup label="自定义模板">
              {settings.customTemplates?.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} {settings.activeTemplateId === t.id ? '✓' : ''}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <button
          onClick={handleCreateNew}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          title="新建模板"
        >
          +
        </button>
      </div>

      {/* Template Info */}
      {editingTemplate && (
        <div className="space-y-3">
          {/* Name & Description */}
          <div className="flex gap-2 items-center">
            {editingTemplate.isPreset ? (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">预设</span>
            ) : (
              <span className="px-2 py-1 bg-blue-100 text-blue-600 rounded text-xs">自定义</span>
            )}
            {isActive && (
              <span className="px-2 py-1 bg-green-100 text-green-600 rounded text-xs">当前使用</span>
            )}
          </div>

          {/* Editable Name */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">模板名称</label>
            <input
              type="text"
              value={editingTemplate.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              disabled={editingTemplate.isPreset}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">描述</label>
            <input
              type="text"
              value={editingTemplate.description || ''}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              disabled={editingTemplate.isPreset}
              placeholder="模板用途说明"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50"
            />
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              系统提示词 (System Prompt)
            </label>
            <textarea
              value={editingTemplate.systemPrompt}
              onChange={(e) => handleFieldChange('systemPrompt', e.target.value)}
              disabled={editingTemplate.isPreset}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono disabled:bg-gray-50 resize-none"
              placeholder="定义 AI 的角色和输出格式..."
            />
          </div>

          {/* User Prompt */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              用户提示词 (User Prompt)
              <span className="text-gray-400 ml-1">使用 {'{skeleton}'} 插入项目信息</span>
            </label>
            <textarea
              value={editingTemplate.userPrompt}
              onChange={(e) => handleFieldChange('userPrompt', e.target.value)}
              disabled={editingTemplate.isPreset}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono disabled:bg-gray-50 resize-none"
              placeholder="请分析这个项目：{skeleton}"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {!isActive && (
              <button
                onClick={handleSetActive}
                className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
              >
                设为当前使用
              </button>
            )}

            {editingTemplate.isPreset ? (
              <button
                onClick={handleSaveAsNew}
                className="flex-1 px-3 py-2 border border-blue-600 text-blue-600 rounded-lg text-sm hover:bg-blue-50"
              >
                复制为新模板
              </button>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  保存
                </button>
                <button
                  onClick={handleDelete}
                  className="px-3 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50"
                >
                  删除
                </button>
              </>
            )}
          </div>

          {hasChanges && (
            <p className="text-xs text-yellow-600">* 有未保存的更改</p>
          )}
        </div>
      )}
    </div>
  );
}
