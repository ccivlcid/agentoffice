/**
 * API providers tab: list, add/edit form, test, toggle, delete, model assign modal.
 */

import type { ApiProviderType } from "../api";
import { useSettingsPanel } from "./SettingsPanelContext";
import { ApiProviderForm, DEFAULT_API_FORM } from "./ApiProviderForm";
import { ApiModelAssignModal } from "./ApiModelAssignModal";
import { RefreshCw } from "lucide-react";

export function SettingsPanelApi() {
  const {
    t,
    apiProviders,
    apiProvidersLoading,
    loadApiProviders,
    apiAddMode,
    setApiAddMode,
    setApiEditingId,
    setApiForm,
    handleApiProviderDelete,
    handleApiProviderTest,
    handleApiProviderToggle,
    handleApiEditStart,
    handleApiModelAssign,
    apiTestResult,
    apiModelsExpanded,
    setApiModelsExpanded,
    API_TYPE_PRESETS,
  } = useSettingsPanel();

  const handleAddClick = () => {
    setApiAddMode(true);
    setApiEditingId(null);
    setApiForm(DEFAULT_API_FORM);
  };

  return (
    <section className="space-y-4 rounded-xl border border-slate-700/50 bg-slate-800/60 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          {t({ ko: "API 프로바이더", en: "API Providers" })}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={loadApiProviders}
            disabled={apiProvidersLoading}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw width={14} height={14} className="inline-block align-middle mr-1" /> {t({ ko: "새로고침", en: "Refresh" })}
          </button>
          {!apiAddMode && (
            <button
              onClick={handleAddClick}
              className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              + {t({ ko: "추가", en: "Add" })}
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        {t({
          ko: "API 키 기반 LLM 프로바이더를 등록하면 에이전트에 모델을 할당할 수 있습니다.",
          en: "Register API key-based LLM providers to assign models to agents.",
})}
      </p>

      {apiAddMode && <ApiProviderForm />}

      {apiProvidersLoading ? (
        <div className="text-xs text-slate-500 animate-pulse py-2">
          {t({ ko: "로딩 중...", en: "Loading..." })}
        </div>
      ) : apiProviders.length === 0 && !apiAddMode ? (
        <div className="text-xs text-slate-500 py-4 text-center rounded-lg bg-slate-800/40">
          {t({
            ko: "등록된 API 프로바이더가 없습니다. 위의 '추가' 버튼으로 등록하세요.",
            en: "No API providers registered. Use the 'Add' button above to register one.",
})}
        </div>
      ) : (
        <ul className="space-y-3">
          {apiProviders.map((provider) => {
            const testResult = apiTestResult[provider.id];
            const expanded = apiModelsExpanded[provider.id];
            const preset = API_TYPE_PRESETS[provider.type as ApiProviderType];
            return (
              <li
                key={provider.id}
                className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 space-y-2"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-200">{provider.name}</span>
                    <span className="text-xs text-slate-500">({preset?.label ?? provider.type})</span>
                    {provider.enabled ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                        {t({ ko: "활성", en: "Enabled" })}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-600/50 text-slate-400">
                        {t({ ko: "비활성", en: "Disabled" })}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApiProviderTest(provider.id)}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      {t({ ko: "테스트", en: "Test" })}
                    </button>
                    <button
                      onClick={() => handleApiEditStart(provider)}
                      className="text-xs text-slate-400 hover:text-slate-300"
                    >
                      {t({ ko: "편집", en: "Edit" })}
                    </button>
                    <button
                      onClick={() => handleApiProviderToggle(provider.id, provider.enabled)}
                      className="text-xs text-slate-400 hover:text-slate-300"
                    >
                      {provider.enabled
                        ? t({ ko: "끄기", en: "Off" })
                        : t({ ko: "켜기", en: "On" })}
                    </button>
                    <button
                      onClick={() => handleApiProviderDelete(provider.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      {t({ ko: "삭제", en: "Delete" })}
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 font-mono truncate">{provider.base_url}</p>
                {testResult && (
                  <p className={`text-xs ${testResult.ok ? "text-green-400" : "text-red-400"}`}>
                    {testResult.msg}
                  </p>
                )}
                <div>
                  <button
                    onClick={() =>
                      setApiModelsExpanded((prev) => ({ ...prev, [provider.id]: !prev[provider.id] }))
                    }
                    className="text-xs text-slate-400 hover:text-slate-300"
                  >
                    {expanded
                      ? t({ ko: "모델 접기", en: "Collapse models" })
                      : t({ ko: "모델 보기", en: "Show models" })}{" "}
                    ({provider.models_cache?.length ?? 0})
                  </button>
                  {expanded && (provider.models_cache?.length ?? 0) > 0 && (
                    <ul className="mt-2 space-y-1 pl-2 border-l border-slate-600">
                      {provider.models_cache!.map((model) => (
                        <li key={model} className="flex items-center gap-2 text-xs">
                          <span className="text-slate-400 font-mono truncate">{model}</span>
                          <button
                            onClick={() => handleApiModelAssign(provider.id, model)}
                            className="shrink-0 text-blue-400 hover:text-blue-300"
                          >
                            {t({ ko: "할당", en: "Assign" })}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ApiModelAssignModal />
    </section>
  );
}
