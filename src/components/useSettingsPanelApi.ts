import { useState, useEffect, useRef, useCallback } from "react";
import * as api from "../api";
import type { ApiProvider, ApiProviderType } from "../api";
import type { Agent, Department } from "../types/index.ts";
import type { TFunction } from "./SettingsPanelShared.tsx";

export const API_TYPE_PRESETS: Record<ApiProviderType, { label: string; base_url: string }> = {
  openai:     { label: "OpenAI",     base_url: "https://api.openai.com/v1" },
  anthropic:  { label: "Anthropic",  base_url: "https://api.anthropic.com/v1" },
  google:     { label: "Google AI",  base_url: "https://generativelanguage.googleapis.com/v1beta" },
  ollama:     { label: "Ollama",     base_url: "http://localhost:11434/v1" },
  openrouter: { label: "OpenRouter", base_url: "https://openrouter.ai/api/v1" },
  together:   { label: "Together",   base_url: "https://api.together.xyz/v1" },
  groq:       { label: "Groq",       base_url: "https://api.groq.com/openai/v1" },
  cerebras:   { label: "Cerebras",   base_url: "https://api.cerebras.ai/v1" },
  custom:     { label: "Custom",     base_url: "" },
};

export interface UseSettingsPanelApiParams {
  tab: string;
  t: TFunction;
}

export interface UseSettingsPanelApiReturn {
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
  apiTesting: string | null;
  apiTestResult: Record<string, { ok: boolean; msg: string }>;
  apiModelsExpanded: Record<string, boolean>;
  setApiModelsExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  apiAssignTarget: { providerId: string; model: string } | null;
  setApiAssignTarget: (v: { providerId: string; model: string } | null) => void;
  apiAssignAgents: Agent[];
  setApiAssignAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
  apiAssignDepts: Department[];
  setApiAssignDepts: React.Dispatch<React.SetStateAction<Department[]>>;
  apiAssigning: boolean;
  API_TYPE_PRESETS: Record<ApiProviderType, { label: string; base_url: string }>;
  handleApiProviderSave: () => Promise<void>;
  handleApiProviderDelete: (id: string) => Promise<void>;
  handleApiProviderTest: (id: string) => Promise<void>;
  handleApiProviderToggle: (id: string, enabled: boolean) => Promise<void>;
  handleApiEditStart: (provider: ApiProvider) => void;
  handleApiModelAssign: (providerId: string, model: string) => Promise<void>;
  handleApiAssignToAgent: (agentId: string) => Promise<void>;
}

export function useSettingsPanelApi({
  tab,
  t,
}: UseSettingsPanelApiParams): UseSettingsPanelApiReturn {
  const [apiProviders, setApiProviders] = useState<ApiProvider[]>([]);
  const [apiProvidersLoading, setApiProvidersLoading] = useState(false);
  const [apiAddMode, setApiAddMode] = useState(false);
  const [apiEditingId, setApiEditingId] = useState<string | null>(null);
  const [apiForm, setApiForm] = useState<{ name: string; type: ApiProviderType; base_url: string; api_key: string }>({
    name: "", type: "openai", base_url: "https://api.openai.com/v1", api_key: "",
  });
  const [apiSaving, setApiSaving] = useState(false);
  const [apiTesting, setApiTesting] = useState<string | null>(null);
  const [apiTestResult, setApiTestResult] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [apiModelsExpanded, setApiModelsExpanded] = useState<Record<string, boolean>>({});
  const [apiAssignTarget, setApiAssignTarget] = useState<{ providerId: string; model: string } | null>(null);
  const [apiAssignAgents, setApiAssignAgents] = useState<Agent[]>([]);
  const [apiAssignDepts, setApiAssignDepts] = useState<Department[]>([]);
  const [apiAssigning, setApiAssigning] = useState(false);
  const apiLoadedRef = useRef(false);

  const loadApiProviders = useCallback(async () => {
    setApiProvidersLoading(true);
    try {
      const providers = await api.getApiProviders();
      setApiProviders(providers);
      apiLoadedRef.current = true;
    } catch (e) {
      console.error("Failed to load API providers:", e);
    } finally {
      setApiProvidersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "api" && !apiLoadedRef.current && !apiProvidersLoading) {
      loadApiProviders();
    }
  }, [tab, apiProvidersLoading, loadApiProviders]);

  async function handleApiProviderSave() {
    if (!apiForm.name.trim() || !apiForm.base_url.trim()) return;
    setApiSaving(true);
    try {
      if (apiEditingId) {
        await api.updateApiProvider(apiEditingId, {
          name: apiForm.name,
          type: apiForm.type,
          base_url: apiForm.base_url,
          ...(apiForm.api_key ? { api_key: apiForm.api_key } : {}),
        });
      } else {
        await api.createApiProvider({
          name: apiForm.name,
          type: apiForm.type,
          base_url: apiForm.base_url,
          api_key: apiForm.api_key || undefined,
        });
      }
      setApiAddMode(false);
      setApiEditingId(null);
      setApiForm({ name: "", type: "openai", base_url: "https://api.openai.com/v1", api_key: "" });
      await loadApiProviders();
    } catch (e) {
      console.error("API provider save failed:", e);
    } finally {
      setApiSaving(false);
    }
  }

  async function handleApiProviderDelete(id: string) {
    try {
      await api.deleteApiProvider(id);
      await loadApiProviders();
    } catch (e) {
      console.error("API provider delete failed:", e);
    }
  }

  async function handleApiProviderTest(id: string) {
    setApiTesting(id);
    setApiTestResult((prev) => ({ ...prev, [id]: { ok: false, msg: "" } }));
    try {
      const result = await api.testApiProvider(id);
      setApiTestResult((prev) => ({
        ...prev,
        [id]: result.ok
          ? {
              ok: true,
              msg: `${result.model_count} ${t({ ko: "개 모델 발견", en: "models found" })}`,
            }
          : { ok: false, msg: result.error?.slice(0, 200) || `HTTP ${result.status}` },
      }));
      if (result.ok) await loadApiProviders();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setApiTestResult((prev) => ({ ...prev, [id]: { ok: false, msg } }));
    } finally {
      setApiTesting(null);
    }
  }

  async function handleApiProviderToggle(id: string, enabled: boolean) {
    try {
      await api.updateApiProvider(id, { enabled: !enabled });
      await loadApiProviders();
    } catch (e) {
      console.error("API provider toggle failed:", e);
    }
  }

  function handleApiEditStart(provider: ApiProvider) {
    setApiEditingId(provider.id);
    setApiAddMode(true);
    setApiForm({
      name: provider.name,
      type: provider.type,
      base_url: provider.base_url,
      api_key: "",
    });
  }

  async function handleApiModelAssign(providerId: string, model: string) {
    setApiAssignTarget({ providerId, model });
    try {
      const [agents, depts] = await Promise.all([api.getAgents(), api.getDepartments()]);
      setApiAssignAgents(agents);
      setApiAssignDepts(depts);
    } catch (e) {
      console.error("Failed to load agents:", e);
    }
  }

  async function handleApiAssignToAgent(agentId: string) {
    if (!apiAssignTarget) return;
    setApiAssigning(true);
    try {
      await api.updateAgent(agentId, {
        cli_provider: "api",
        api_provider_id: apiAssignTarget.providerId,
        api_model: apiAssignTarget.model,
      });
      setApiAssignAgents((prev) =>
        prev.map((a) =>
          a.id === agentId
            ? {
                ...a,
                cli_provider: "api" as const,
                api_provider_id: apiAssignTarget.providerId,
                api_model: apiAssignTarget.model,
              }
            : a
        )
      );
    } catch (e) {
      console.error("Failed to assign API model to agent:", e);
    } finally {
      setApiAssigning(false);
    }
  }

  return {
    apiProviders,
    apiProvidersLoading,
    loadApiProviders,
    apiAddMode,
    setApiAddMode,
    apiEditingId,
    setApiEditingId,
    apiForm,
    setApiForm,
    apiSaving,
    apiTesting,
    apiTestResult,
    apiModelsExpanded,
    setApiModelsExpanded,
    apiAssignTarget,
    setApiAssignTarget,
    apiAssignAgents,
    setApiAssignAgents,
    apiAssignDepts,
    setApiAssignDepts,
    apiAssigning,
    API_TYPE_PRESETS,
    handleApiProviderSave,
    handleApiProviderDelete,
    handleApiProviderTest,
    handleApiProviderToggle,
    handleApiEditStart,
    handleApiModelAssign,
    handleApiAssignToAgent,
  };
}
