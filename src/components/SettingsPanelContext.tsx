/**
 * Context for SettingsPanel: state and handlers shared by tab components.
 * Tab components use useSettingsPanel() to read what they need.
 */

import { createContext, useContext } from "react";
import type { LocalSettings, TFunction } from "./SettingsPanelShared";
import type { CompanySettings, CliStatusMap, CliModelInfo } from "../types";
import type {
  OAuthStatus,
  OAuthConnectProvider,
  DeviceCodeStart,
  GatewayTarget,
  ApiProvider,
  ApiProviderType,
} from "../api";

export interface SettingsPanelContextValue {
  // General
  form: LocalSettings;
  setForm: React.Dispatch<React.SetStateAction<LocalSettings>>;
  handleSave: () => void;
  saved: boolean;
  persistSettings: (next: LocalSettings) => void;
  t: TFunction;
  localeTag: string;

  // Props from parent
  settings: CompanySettings;
  cliStatus: CliStatusMap | null;
  onSave: (settings: CompanySettings) => void;
  onRefreshCli: () => void;
  oauthResult?: { provider?: string | null; error?: string | null } | null;
  onOauthResultClear?: () => void;

  // CLI tab
  cliModels: Record<string, CliModelInfo[]> | null;
  setCliModels: React.Dispatch<React.SetStateAction<Record<string, CliModelInfo[]> | null>>;
  cliModelsLoading: boolean;
  setCliModelsLoading: (v: boolean) => void;

  // OAuth tab
  oauthStatus: OAuthStatus | null;
  setOauthStatus: React.Dispatch<React.SetStateAction<OAuthStatus | null>>;
  oauthLoading: boolean;
  loadOAuthStatus: () => Promise<void>;
  models: Record<string, string[]> | null;
  setModels: React.Dispatch<React.SetStateAction<Record<string, string[]> | null>>;
  modelsLoading: boolean;
  setModelsLoading: (v: boolean) => void;
  refreshing: string | null;
  setRefreshing: React.Dispatch<React.SetStateAction<string | null>>;
  disconnecting: string | null;
  accountDrafts: Record<string, { label: string; modelOverride: string; priority: string }>;
  setAccountDrafts: React.Dispatch<React.SetStateAction<Record<string, { label: string; modelOverride: string; priority: string }>>>;
  savingAccountId: string | null;
  handleConnect: (provider: OAuthConnectProvider) => void;
  handleDisconnect: (provider: OAuthConnectProvider) => Promise<void>;
  updateAccountDraft: (accountId: string, patch: Partial<{ label: string; modelOverride: string; priority: string }>) => void;
  handleActivateAccount: (provider: OAuthConnectProvider, accountId: string, currentlyActive: boolean) => Promise<void>;
  handleSaveAccount: (accountId: string) => Promise<void>;
  handleToggleAccount: (accountId: string, nextStatus: "active" | "disabled") => Promise<void>;
  handleDeleteAccount: (provider: OAuthConnectProvider, accountId: string) => Promise<void>;
  deviceCode: DeviceCodeStart | null;
  deviceStatus: string | null;
  deviceError: string | null;
  startDeviceCodeFlow: () => Promise<void>;

  // API tab
  apiProviders: ApiProvider[];
  apiProvidersLoading: boolean;
  loadApiProviders: () => Promise<void>;
  apiAddMode: boolean;
  setApiAddMode: (v: boolean) => void;
  apiEditingId: string | null;
  setApiEditingId: (v: string | null) => void;
  apiForm: { name: string; type: ApiProviderType; base_url: string; api_key: string };
  setApiForm: React.Dispatch<React.SetStateAction<{ name: string; type: ApiProviderType; base_url: string; api_key: string }>>;
  apiSaving: boolean;
  handleApiProviderSave: () => Promise<void>;
  handleApiProviderDelete: (id: string) => Promise<void>;
  handleApiProviderTest: (id: string) => Promise<void>;
  handleApiProviderToggle: (id: string, enabled: boolean) => Promise<void>;
  handleApiEditStart: (provider: ApiProvider) => void;
  handleApiModelAssign: (providerId: string, model: string) => Promise<void>;
  apiAssignTarget: { providerId: string; model: string } | null;
  setApiAssignTarget: (v: { providerId: string; model: string } | null) => void;
  apiAssignAgents: import("../types").Agent[];
  setApiAssignAgents: React.Dispatch<React.SetStateAction<import("../types").Agent[]>>;
  apiAssignDepts: import("../types").Department[];
  setApiAssignDepts: React.Dispatch<React.SetStateAction<import("../types").Department[]>>;
  apiAssigning: boolean;
  handleApiAssignToAgent: (agentId: string) => Promise<void>;
  apiTestResult: Record<string, { ok: boolean; msg: string }>;
  apiModelsExpanded: Record<string, boolean>;
  setApiModelsExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  API_TYPE_PRESETS: Record<ApiProviderType, { label: string; base_url: string }>;

  // Gateway tab
  gwTargets: GatewayTarget[];
  gwLoading: boolean;
  loadGwTargets: () => void;
  gwSelected: string;
  setGwSelected: (v: string) => void;
  gwText: string;
  setGwText: (v: string) => void;
  gwSending: boolean;
  gwStatus: { ok: boolean; msg: string } | null;
  handleGwSend: () => Promise<void>;
}

const SettingsPanelContext = createContext<SettingsPanelContextValue | null>(null);

export function useSettingsPanel(): SettingsPanelContextValue {
  const ctx = useContext(SettingsPanelContext);
  if (!ctx) throw new Error("useSettingsPanel must be used within SettingsPanel");
  return ctx;
}

export function SettingsPanelProvider({
  value,
  children,
}: {
  value: SettingsPanelContextValue;
  children: React.ReactNode;
}) {
  return (
    <SettingsPanelContext.Provider value={value}>
      {children}
    </SettingsPanelContext.Provider>
  );
}
