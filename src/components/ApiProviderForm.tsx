/**
 * Add/edit form for a single API provider.
 */
import type { ApiProviderType } from '../api';
import { useSettingsPanel } from './SettingsPanelContext';

export const DEFAULT_API_FORM = {
  name: '',
  type: 'openai' as ApiProviderType,
  base_url: 'https://api.openai.com/v1',
  api_key: '',
};

export function ApiProviderForm() {
  const {
    t,
    apiEditingId,
    setApiEditingId,
    apiForm,
    setApiForm,
    apiSaving,
    handleApiProviderSave,
    setApiAddMode,
    API_TYPE_PRESETS,
  } = useSettingsPanel();

  const handleCancel = () => {
    setApiForm(DEFAULT_API_FORM);
    setApiAddMode(false);
    setApiEditingId(null);
  };

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 space-y-3">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        {apiEditingId
          ? t({ ko: '프로바이더 수정', en: 'Edit provider' })
          : t({ ko: '새 프로바이더', en: 'New provider' })}
      </h4>
      <div className="grid gap-2">
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            {t({ ko: '타입', en: 'Type' })}
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(API_TYPE_PRESETS) as [ApiProviderType, { label: string; base_url: string }][]).map(
              ([type, preset]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() =>
                    setApiForm((f) => ({ ...f, type, base_url: preset.base_url || f.base_url }))
                  }
                  className={`px-2 py-1 rounded text-xs ${
                    apiForm.type === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {preset.label}
                </button>
              )
            )}
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            {t({ ko: '이름', en: 'Name' })}
          </label>
          <input
            type="text"
            value={apiForm.name}
            onChange={(e) => setApiForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="My OpenAI"
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            {t({ ko: 'Base URL', en: 'Base URL' })}
          </label>
          <input
            type="text"
            value={apiForm.base_url}
            onChange={(e) => setApiForm((f) => ({ ...f, base_url: e.target.value }))}
            placeholder="https://api.openai.com/v1"
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            {t({ ko: 'API Key', en: 'API Key' })}
          </label>
          <input
            type="password"
            value={apiForm.api_key}
            onChange={(e) => setApiForm((f) => ({ ...f, api_key: e.target.value }))}
            placeholder={
              apiEditingId
                ? t({ ko: '•••••••• (비워두면 유지)', en: '•••••••• (leave blank to keep)' })
                : 'sk-...'
            }
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => handleApiProviderSave()}
          disabled={apiSaving || !apiForm.name.trim() || !apiForm.base_url.trim()}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-50"
        >
          {apiSaving
            ? t({ ko: '저장 중...', en: 'Saving...' })
            : t({ ko: '저장', en: 'Save' })}
        </button>
        <button
          onClick={handleCancel}
          className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-slate-200 text-sm font-medium"
        >
          {t({ ko: '취소', en: 'Cancel' })}
        </button>
      </div>
    </div>
  );
}
