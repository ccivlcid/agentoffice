import { useState, useEffect, useCallback } from "react";
import type { CompanySettings, CliModelInfo, CliStatusMap } from "../types/index.ts";
import * as api from "../api";
import type { OAuthCallbackResult } from "../App";
import { useI18n, normalizeLocale, LANGUAGE_STORAGE_KEY, LocalSettings } from "./SettingsPanelShared.tsx";
import { SettingsPanelProvider } from "./SettingsPanelContext.tsx";
import { SettingsPanelGeneral } from "./SettingsPanelGeneral.tsx";
import { SettingsPanelCli } from "./SettingsPanelCli.tsx";
import { SettingsPanelGateway } from "./SettingsPanelGateway.tsx";
import { SettingsPanelOAuth } from "./SettingsPanelOAuth.tsx";
import { SettingsPanelApi } from "./SettingsPanelApi.tsx";
import { useSettingsPanelOAuth } from "./useSettingsPanelOAuth.ts";
import { useSettingsPanelApi } from "./useSettingsPanelApi.ts";
import { useSettingsPanelGateway } from "./useSettingsPanelGateway.ts";
import { Settings, Monitor, Key, Plug, Radio } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SettingsPanelProps {
  settings: CompanySettings;
  cliStatus: CliStatusMap | null;
  onSave: (settings: CompanySettings) => void;
  onRefreshCli: () => void;
  oauthResult?: OAuthCallbackResult | null;
  onOauthResultClear?: () => void;
}

export default function SettingsPanel({ settings, cliStatus, onSave, onRefreshCli, oauthResult, onOauthResultClear }: SettingsPanelProps) {
  const [form, setForm] = useState<LocalSettings>(settings as LocalSettings);
  const { t, localeTag } = useI18n(form.language);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<"general" | "cli" | "oauth" | "api" | "gateway">(
    oauthResult ? "oauth" : "general"
  );

  // CLI models state (managed here, passed via context)
  const [cliModels, setCliModels] = useState<Record<string, CliModelInfo[]> | null>(null);
  const [cliModelsLoading, setCliModelsLoading] = useState(false);

  const persistSettings = useCallback((next: LocalSettings) => { onSave(next as unknown as CompanySettings); }, [onSave]);

  // Sync form when settings prop changes
  useEffect(() => {
    setForm(settings as LocalSettings);
    const syncedLocale = normalizeLocale((settings as LocalSettings).language) ?? "en";
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, syncedLocale);
    window.dispatchEvent(new Event("climpire-language-change"));
  }, [settings]);

  // Load CLI models when CLI tab is visible
  useEffect(() => {
    if (tab !== "cli" || cliModels) return;
    setCliModelsLoading(true);
    api.getCliModels().then(setCliModels).catch(console.error).finally(() => setCliModelsLoading(false));
  }, [tab, cliModels]);

  const oauthHook = useSettingsPanelOAuth({ tab, oauthResult, onOauthResultClear, t, setTab });
  const apiHook = useSettingsPanelApi({ tab, t });
  const gwHook = useSettingsPanelGateway({ tab, t });

  function handleSave() {
    const nextLocale = normalizeLocale(form.language) ?? "en";
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLocale);
    window.dispatchEvent(new Event("climpire-language-change"));
    persistSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const contextValue = {
    form, setForm, handleSave, saved, persistSettings, t, localeTag,
    settings, cliStatus, onSave, onRefreshCli, oauthResult, onOauthResultClear,
    cliModels, setCliModels, cliModelsLoading, setCliModelsLoading,
    // OAuth
    oauthStatus: oauthHook.oauthStatus,
    setOauthStatus: oauthHook.setOauthStatus,
    oauthLoading: oauthHook.oauthLoading,
    loadOAuthStatus: oauthHook.loadOAuthStatus,
    models: oauthHook.models,
    setModels: oauthHook.setModels,
    modelsLoading: oauthHook.modelsLoading,
    setModelsLoading: oauthHook.setModelsLoading,
    refreshing: oauthHook.refreshing,
    setRefreshing: oauthHook.setRefreshing,
    disconnecting: oauthHook.disconnecting,
    accountDrafts: oauthHook.accountDrafts,
    setAccountDrafts: oauthHook.setAccountDrafts,
    savingAccountId: oauthHook.savingAccountId,
    handleConnect: oauthHook.handleConnect,
    handleDisconnect: oauthHook.handleDisconnect,
    updateAccountDraft: oauthHook.updateAccountDraft,
    handleActivateAccount: oauthHook.handleActivateAccount,
    handleSaveAccount: oauthHook.handleSaveAccount,
    handleToggleAccount: oauthHook.handleToggleAccount,
    handleDeleteAccount: oauthHook.handleDeleteAccount,
    deviceCode: oauthHook.deviceCode,
    deviceStatus: oauthHook.deviceStatus,
    deviceError: oauthHook.deviceError,
    startDeviceCodeFlow: oauthHook.startDeviceCodeFlow,
    // API providers
    apiProviders: apiHook.apiProviders,
    apiProvidersLoading: apiHook.apiProvidersLoading,
    loadApiProviders: apiHook.loadApiProviders,
    apiAddMode: apiHook.apiAddMode,
    setApiAddMode: apiHook.setApiAddMode,
    apiEditingId: apiHook.apiEditingId,
    setApiEditingId: apiHook.setApiEditingId,
    apiForm: apiHook.apiForm,
    setApiForm: apiHook.setApiForm,
    apiSaving: apiHook.apiSaving,
    handleApiProviderSave: apiHook.handleApiProviderSave,
    handleApiProviderDelete: apiHook.handleApiProviderDelete,
    handleApiProviderTest: apiHook.handleApiProviderTest,
    handleApiProviderToggle: apiHook.handleApiProviderToggle,
    handleApiEditStart: apiHook.handleApiEditStart,
    handleApiModelAssign: apiHook.handleApiModelAssign,
    apiAssignTarget: apiHook.apiAssignTarget,
    setApiAssignTarget: apiHook.setApiAssignTarget,
    apiAssignAgents: apiHook.apiAssignAgents,
    setApiAssignAgents: apiHook.setApiAssignAgents,
    apiAssignDepts: apiHook.apiAssignDepts,
    setApiAssignDepts: apiHook.setApiAssignDepts,
    apiAssigning: apiHook.apiAssigning,
    handleApiAssignToAgent: apiHook.handleApiAssignToAgent,
    apiTestResult: apiHook.apiTestResult,
    apiModelsExpanded: apiHook.apiModelsExpanded,
    setApiModelsExpanded: apiHook.setApiModelsExpanded,
    API_TYPE_PRESETS: apiHook.API_TYPE_PRESETS,
    // Gateway
    gwTargets: gwHook.gwTargets,
    gwLoading: gwHook.gwLoading,
    loadGwTargets: gwHook.loadGwTargets,
    gwSelected: gwHook.gwSelected,
    setGwSelected: gwHook.setGwSelected,
    gwText: gwHook.gwText,
    setGwText: gwHook.setGwText,
    gwSending: gwHook.gwSending,
    gwStatus: gwHook.gwStatus,
    handleGwSend: gwHook.handleGwSend,
  };

  const tabs: { key: "general" | "cli" | "oauth" | "api" | "gateway"; label: string; icon: LucideIcon }[] = [
    { key: "general", label: t({ ko: "일반 설정", en: "General" }), icon: Settings },
    { key: "cli",     label: t({ ko: "CLI 도구",   en: "CLI Tools" }), icon: Monitor },
    { key: "oauth",   label: t({ ko: "OAuth 인증", en: "OAuth" }), icon: Key },
    { key: "api",     label: t({ ko: "API 연동",   en: "API" }), icon: Plug },
    { key: "gateway", label: t({ ko: "채널 메시지", en: "Channel" }), icon: Radio },
  ];

  return (
    <SettingsPanelProvider value={contextValue}>
      <div className="mx-auto max-w-2xl space-y-4 sm:space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--th-text-heading)" }}>
          <Settings width={20} height={20} className="shrink-0" aria-hidden />
          {t({ ko: "설정", en: "Settings" })}
        </h2>

        <div className="flex flex-wrap gap-1 border-b border-slate-700/50 pb-1">
          {tabs.map((tabItem) => (
            <button
              key={tabItem.key}
              onClick={() => setTab(tabItem.key)}
              className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-medium transition-colors sm:px-4 sm:py-2.5 sm:text-sm ${
                tab === tabItem.key ? "text-blue-400 border-b-2 border-blue-400" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <tabItem.icon width={16} height={16} className="shrink-0" aria-hidden />
              <span>{tabItem.label}</span>
            </button>
          ))}
        </div>

        {tab === "general" && <SettingsPanelGeneral />}
        {tab === "cli" && <SettingsPanelCli />}
        {tab === "oauth" && <SettingsPanelOAuth />}
        {tab === "api" && <SettingsPanelApi />}
        {tab === "gateway" && <SettingsPanelGateway />}
      </div>
    </SettingsPanelProvider>
  );
}
