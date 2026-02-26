import { useState, useEffect, useRef, useCallback } from "react";
import * as api from "../api";
import type { OAuthStatus, OAuthConnectProvider, DeviceCodeStart } from "../api";
import type { TFunction } from "./SettingsPanelShared.tsx";

type AccountDraft = { label: string; modelOverride: string; priority: string };

export interface UseSettingsPanelOAuthParams {
  tab: string;
  oauthResult?: { provider?: string | null; error?: string | null } | null;
  onOauthResultClear?: () => void;
  t: TFunction;
  setTab: (tab: "general" | "cli" | "oauth" | "api" | "gateway") => void;
}

export interface UseSettingsPanelOAuthReturn {
  oauthStatus: OAuthStatus | null;
  setOauthStatus: React.Dispatch<React.SetStateAction<OAuthStatus | null>>;
  oauthLoading: boolean;
  loadOAuthStatus: () => Promise<void>;
  disconnecting: string | null;
  refreshing: string | null;
  setRefreshing: React.Dispatch<React.SetStateAction<string | null>>;
  savingAccountId: string | null;
  accountDrafts: Record<string, AccountDraft>;
  setAccountDrafts: React.Dispatch<React.SetStateAction<Record<string, AccountDraft>>>;
  models: Record<string, string[]> | null;
  setModels: React.Dispatch<React.SetStateAction<Record<string, string[]> | null>>;
  modelsLoading: boolean;
  setModelsLoading: (v: boolean) => void;
  deviceCode: DeviceCodeStart | null;
  deviceStatus: string | null;
  deviceError: string | null;
  startDeviceCodeFlow: () => Promise<void>;
  handleConnect: (provider: OAuthConnectProvider) => void;
  handleDisconnect: (provider: OAuthConnectProvider) => Promise<void>;
  updateAccountDraft: (accountId: string, patch: Partial<AccountDraft>) => void;
  handleActivateAccount: (provider: OAuthConnectProvider, accountId: string, currentlyActive: boolean) => Promise<void>;
  handleSaveAccount: (accountId: string) => Promise<void>;
  handleToggleAccount: (accountId: string, nextStatus: "active" | "disabled") => Promise<void>;
  handleDeleteAccount: (provider: OAuthConnectProvider, accountId: string) => Promise<void>;
}

export function useSettingsPanelOAuth({ tab, oauthResult, onOauthResultClear, t, setTab }: UseSettingsPanelOAuthParams): UseSettingsPanelOAuthReturn {
  const [oauthStatus, setOauthStatus] = useState<OAuthStatus | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [savingAccountId, setSavingAccountId] = useState<string | null>(null);
  const [accountDrafts, setAccountDrafts] = useState<Record<string, AccountDraft>>({});
  const [models, setModels] = useState<Record<string, string[]> | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [deviceCode, setDeviceCode] = useState<DeviceCodeStart | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadOAuthStatus = useCallback(async () => {
    setOauthLoading(true);
    try {
      const next = await api.getOAuthStatus();
      setOauthStatus(next);
      setAccountDrafts((prev) => {
        const merged = { ...prev };
        for (const info of Object.values(next.providers)) {
          for (const account of info.accounts ?? []) {
            if (!merged[account.id]) {
              merged[account.id] = { label: account.label ?? "", modelOverride: account.modelOverride ?? "", priority: String(account.priority ?? 100) };
            }
          }
        }
        return merged;
      });
    } finally {
      setOauthLoading(false);
    }
  }, []);

  useEffect(() => {
    if (oauthResult) { setTab("oauth"); setOauthStatus(null); if (!oauthResult.error) setModels(null); }
  }, [oauthResult, setTab]);

  useEffect(() => {
    if (tab === "oauth" && !oauthStatus) loadOAuthStatus().catch(console.error);
  }, [tab, oauthStatus, loadOAuthStatus]);

  useEffect(() => {
    if (tab !== "oauth" || !oauthStatus || models) return;
    if (!Object.values(oauthStatus.providers).some((p) => p.connected)) return;
    setModelsLoading(true);
    api.getOAuthModels().then(setModels).catch(console.error).finally(() => setModelsLoading(false));
  }, [tab, oauthStatus, models]);

  useEffect(() => {
    if (oauthResult) { const timer = setTimeout(() => onOauthResultClear?.(), 8000); return () => clearTimeout(timer); }
  }, [oauthResult, onOauthResultClear]);

  useEffect(() => { return () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); }; }, []);

  function handleConnect(provider: OAuthConnectProvider) {
    window.location.assign(api.getOAuthStartUrl(provider, window.location.origin + window.location.pathname));
  }

  const startDeviceCodeFlow = useCallback(async () => {
    setDeviceError(null); setDeviceStatus(null);
    try {
      const dc = await api.startGitHubDeviceFlow();
      setDeviceCode(dc); setDeviceStatus("polling");
      window.open(dc.verificationUri, "_blank");
      let intervalMs = Math.max((dc.interval || 5) * 1000, 5000);
      const expiresAt = Date.now() + (dc.expiresIn || 900) * 1000;
      let stopped = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      const stopWith = (status: string, error?: string) => { stopped = true; pollTimerRef.current = null; setDeviceStatus(status); if (error !== undefined) setDeviceError(error); };
      const poll = () => {
        if (stopped) return;
        pollTimerRef.current = setTimeout(async () => {
          if (stopped) return;
          if (Date.now() > expiresAt) {
            stopWith("expired", t({ ko: "코드가 만료되었습니다. 다시 시도해 주세요.", en: "Code expired. Please try again." }));
            setDeviceCode(null); return;
          }
          try {
            const result = await api.pollGitHubDevice(dc.stateId);
            if (result.status === "complete") { stopWith("complete"); setDeviceCode(null); await loadOAuthStatus(); return; }
            if (result.status === "expired" || result.status === "denied") {
              stopWith(result.status, result.status === "expired"
                ? t({ ko: "코드가 만료되었습니다.", en: "Code expired" })
                : t({ ko: "인증이 거부되었습니다.", en: "Authentication denied" }));
              return;
            }
            if (result.status === "slow_down") intervalMs += 5000;
            if (result.status === "error") { stopWith("error", result.error || t({ ko: "알 수 없는 오류", en: "Unknown error" })); return; }
          } catch { /* Network error — keep polling */ }
          poll();
        }, intervalMs);
      };
      poll();
    } catch (err) { setDeviceError(err instanceof Error ? err.message : String(err)); setDeviceStatus("error"); }
  }, [t, loadOAuthStatus]);

  async function handleDisconnect(provider: OAuthConnectProvider) {
    setDisconnecting(provider);
    try {
      await api.disconnectOAuth(provider); await loadOAuthStatus();
      if (provider === "github-copilot") { setDeviceCode(null); setDeviceStatus(null); if (pollTimerRef.current) clearTimeout(pollTimerRef.current); }
    } catch (err) { console.error("Disconnect failed:", err); } finally { setDisconnecting(null); }
  }

  function updateAccountDraft(accountId: string, patch: Partial<AccountDraft>) {
    setAccountDrafts((prev) => ({ ...prev, [accountId]: { label: prev[accountId]?.label ?? "", modelOverride: prev[accountId]?.modelOverride ?? "", priority: prev[accountId]?.priority ?? "100", ...patch } }));
  }

  async function handleActivateAccount(provider: OAuthConnectProvider, accountId: string, currentlyActive: boolean) {
    setSavingAccountId(accountId);
    try { await api.activateOAuthAccount(provider, accountId, currentlyActive ? "remove" : "add"); await loadOAuthStatus(); }
    catch (err) { console.error("Activate account failed:", err); } finally { setSavingAccountId(null); }
  }

  async function handleSaveAccount(accountId: string) {
    const draft = accountDrafts[accountId]; if (!draft) return;
    setSavingAccountId(accountId);
    try {
      await api.updateOAuthAccount(accountId, { label: draft.label.trim() || null, model_override: draft.modelOverride.trim() || null, priority: Number.isFinite(Number(draft.priority)) ? Math.max(1, Math.round(Number(draft.priority))) : 100 });
      await loadOAuthStatus();
    } catch (err) { console.error("Save account failed:", err); } finally { setSavingAccountId(null); }
  }

  async function handleToggleAccount(accountId: string, nextStatus: "active" | "disabled") {
    setSavingAccountId(accountId);
    try { await api.updateOAuthAccount(accountId, { status: nextStatus }); await loadOAuthStatus(); }
    catch (err) { console.error("Toggle account failed:", err); } finally { setSavingAccountId(null); }
  }

  async function handleDeleteAccount(provider: OAuthConnectProvider, accountId: string) {
    if (!window.confirm(t({ ko: "이 OAuth 계정을 삭제하시겠습니까?", en: "Delete this OAuth account?" }))) return;
    setSavingAccountId(accountId);
    try { await api.deleteOAuthAccount(provider, accountId); await loadOAuthStatus(); }
    catch (err) { console.error("Delete account failed:", err); } finally { setSavingAccountId(null); }
  }

  return {
    oauthStatus, setOauthStatus, oauthLoading, loadOAuthStatus,
    disconnecting, refreshing, setRefreshing, savingAccountId,
    accountDrafts, setAccountDrafts, models, setModels, modelsLoading, setModelsLoading,
    deviceCode, deviceStatus, deviceError, startDeviceCodeFlow,
    handleConnect, handleDisconnect, updateAccountDraft,
    handleActivateAccount, handleSaveAccount, handleToggleAccount, handleDeleteAccount,
  };
}
