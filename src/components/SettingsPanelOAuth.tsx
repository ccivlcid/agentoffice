/**
 * OAuth tab content: status, connected providers, account pool, add account (device code / connect).
 */

import * as api from "../api";
import type { OAuthConnectProvider } from "../api";
import { useSettingsPanel } from "./SettingsPanelContext";
import {
  OAUTH_INFO,
  CONNECTABLE_PROVIDERS,
  GitHubCopilotLogo,
  AntigravityLogo,
} from "./SettingsPanelShared";
import { RefreshCw } from "lucide-react";
import { OAuthAccountPoolList } from "./OAuthAccountPoolList";
import { OAuthAddAccountSection } from "./OAuthAddAccountSection";

export function SettingsPanelOAuth() {
  const {
    t,
    form,
    setForm,
    persistSettings,
    oauthResult,
    onOauthResultClear,
    oauthStatus,
    setOauthStatus,
    oauthLoading,
    loadOAuthStatus,
    models,
    setModels,
    modelsLoading,
    setModelsLoading,
    refreshing,
    setRefreshing,
    disconnecting,
    handleDisconnect,
  } = useSettingsPanel();

  const handleRefreshAll = () => {
    setOauthStatus(null);
    setModelsLoading(true);
    loadOAuthStatus()
      .then(() => api.getOAuthModels(true))
      .then(setModels)
      .catch(console.error)
      .finally(() => setModelsLoading(false));
  };

  const handleProviderRefresh = async (provider: OAuthConnectProvider) => {
    setRefreshing(provider);
    try {
      await api.refreshOAuthToken(provider);
      await loadOAuthStatus();
      const next = await api.getOAuthModels(true);
      setModels(next);
    } catch (e) {
      console.error("Refresh failed:", e);
    } finally {
      setRefreshing(null);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-slate-700/50 bg-slate-800/60 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          {t({ ko: "OAuth 상태", en: "OAuth Status" })}
        </h3>
        <button
          onClick={handleRefreshAll}
          disabled={oauthLoading || modelsLoading}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw width={14} height={14} className="inline-block align-middle mr-1" /> {t({ ko: "새로고침", en: "Refresh" })}
        </button>
      </div>

      {oauthResult && (
        <div
          className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
            oauthResult.error
              ? "bg-red-500/10 text-red-400 border border-red-500/20"
              : "bg-green-500/10 text-green-400 border border-green-500/20"
          }`}
        >
          <span>{oauthResult.error ?? (oauthResult.provider ? `${oauthResult.provider}: OK` : "OK")}</span>
          <button
            type="button"
            onClick={onOauthResultClear}
            className="shrink-0 rounded p-1 hover:bg-white/10"
            aria-label={t({ ko: "닫기", en: "Close" })}
          >
            ×
          </button>
        </div>
      )}

      {oauthStatus && (
        <p className="text-xs text-slate-400">
          {oauthStatus.storageReady
            ? t({
                ko: "저장소 준비됨 (OAuth 토큰 암호화 사용 가능)",
                en: "Storage ready (OAuth token encryption available)",
})
            : t({
                ko: "OAUTH_ENCRYPTION_SECRET이 설정되지 않았습니다. 토큰은 암호화되지 않은 상태로 저장됩니다.",
                en: "OAUTH_ENCRYPTION_SECRET is not set. Tokens will be stored unencrypted.",
})}
        </p>
      )}

      {oauthLoading ? (
        <div className="text-xs text-slate-500 animate-pulse py-2">
          {t({ ko: "로딩 중...", en: "Loading..." })}
        </div>
      ) : oauthStatus ? (
        <div className="space-y-4">
          {Object.entries(oauthStatus.providers).map(([providerKey, info]) => {
            const providerId = providerKey as OAuthConnectProvider;
            const connectable = CONNECTABLE_PROVIDERS.find((p) => p.id === providerId);
            const Logo = connectable?.Logo ?? (providerId === "github-copilot" ? GitHubCopilotLogo : AntigravityLogo);
            const label = OAUTH_INFO[providerKey]?.label ?? connectable?.label ?? providerKey;
            const providerModels = models?.[providerKey] ?? [];
            const currentModel = form.providerModelConfig?.[providerKey]?.model ?? "";
            const isRefreshing = refreshing === providerId;
            const isDisconnecting = disconnecting === providerId;

            return (
              <div
                key={providerKey}
                className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 space-y-3"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Logo className="w-5 h-5 text-slate-300" />
                    <span className="text-sm font-medium text-slate-200">{label}</span>
                  </div>
                  {info.email && (
                    <span className="text-xs text-slate-500">{info.email}</span>
                  )}
                  <div className="flex gap-1.5 flex-wrap">
                    {info.connected && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                        {t({ ko: "연결됨", en: "Connected" })}
                      </span>
                    )}
                    {info.hasRefreshToken && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                        {t({ ko: "갱신 가능", en: "Refreshable" })}
                      </span>
                    )}
                    {info.refreshFailed && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                        {t({ ko: "갱신 실패", en: "Refresh failed" })}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 ml-auto">
                    {info.connected && info.hasRefreshToken && (
                      <button
                        onClick={() => handleProviderRefresh(providerId)}
                        disabled={isRefreshing}
                        className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
                      >
                        {isRefreshing
                          ? t({ ko: "갱신 중...", en: "Refreshing..." })
                          : t({ ko: "갱신", en: "Refresh" })}
                      </button>
                    )}
                    {info.connected && (
                      <button
                        onClick={() => handleDisconnect(providerId)}
                        disabled={isDisconnecting}
                        className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        {isDisconnecting
                          ? t({ ko: "연결 해제 중...", en: "Disconnecting..." })
                          : t({ ko: "연결 해제", en: "Disconnect" })}
                      </button>
                    )}
                  </div>
                </div>

                {info.scope != null && (
                  <p className="text-[11px] text-slate-500">
                    scope: {info.scope}
                    {info.expires_at != null && ` · expires: ${new Date(info.expires_at * 1000).toLocaleString()}`}
                    {info.created_at != null && ` · created: ${new Date(info.created_at * 1000).toLocaleString()}`}
                  </p>
                )}

                {info.connected && providerModels.length > 0 && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      {t({ ko: "기본 모델", en: "Default model" })}
                    </label>
                    <select
                      value={currentModel}
                      onChange={(e) => {
                        const next = {
                          ...form.providerModelConfig,
                          [providerKey]: { ...form.providerModelConfig?.[providerKey], model: e.target.value },
                        };
                        setForm((f) => ({ ...f, providerModelConfig: next }));
                        persistSettings({ ...form, providerModelConfig: next });
                      }}
                      className="w-full max-w-xs px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="">—</option>
                      {providerModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {(info.accounts?.length ?? 0) > 0 && (
                  <OAuthAccountPoolList
                    accounts={info.accounts!}
                    providerId={providerId}
                    activeAccountIds={info.activeAccountIds}
                    activeAccountId={info.activeAccountId ?? undefined}
                  />
                )}
              </div>
            );
          })}

          <OAuthAddAccountSection />
        </div>
      ) : null}
    </section>
  );
}
