import { useState, useEffect } from "react";
import type { Agent } from "../../types";
import type { OAuthAccountInfo } from "../../api";
import * as api from "../../api";
import {
  CLI_LABELS,
  oauthAccountLabel,
  type TFunction,
} from "./agentDetailHelpers";
import { Wrench, Settings, Pencil } from "lucide-react";

const CLI_PROVIDERS_WITH_MODEL: Agent["cli_provider"][] = ["claude", "codex", "gemini", "opencode", "cursor"];
const CODEX_REASONING_LEVELS = ["", "low", "medium", "high", "xhigh"] as const;

interface AgentDetailCliEditorProps {
  agent: Agent;
  editingCli: boolean;
  selectedCli: Agent["cli_provider"];
  selectedCliModel: string;
  selectedCliReasoningLevel: string;
  selectedOAuthAccountId: string;
  requiresOAuthAccount: boolean;
  requiresApiProvider: boolean;
  canSaveCli: boolean;
  savingCli: boolean;
  oauthLoading: boolean;
  activeOAuthAccounts: OAuthAccountInfo[];
  t: TFunction;
  onCliChange: (cli: Agent["cli_provider"]) => void;
  onCliModelChange: (model: string) => void;
  onCliReasoningLevelChange: (level: string) => void;
  onOAuthAccountChange: (id: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onStartEdit: () => void;
}

export default function AgentDetailCliEditor({
  agent,
  editingCli,
  selectedCli,
  selectedCliModel,
  selectedCliReasoningLevel,
  selectedOAuthAccountId,
  requiresOAuthAccount,
  requiresApiProvider,
  canSaveCli,
  savingCli,
  oauthLoading,
  activeOAuthAccounts,
  t,
  onCliChange,
  onCliModelChange,
  onCliReasoningLevelChange,
  onOAuthAccountChange,
  onSave,
  onCancel,
  onStartEdit,
}: AgentDetailCliEditorProps) {
  const [cliModels, setCliModels] = useState<Record<string, Array<{ slug: string; displayName?: string }>>>({});

  useEffect(() => {
    if (!editingCli) return;
    api.getCliModels()
      .then((models) => setCliModels(models ?? {}))
      .catch(() => {});
  }, [editingCli]);

  const showModelSelect = editingCli && CLI_PROVIDERS_WITH_MODEL.includes(selectedCli);
  const providerModels = cliModels[selectedCli] ?? [];
  const showReasoningLevel = editingCli && selectedCli === "codex";

  if (editingCli) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Wrench width={14} height={14} className="inline-block align-middle text-slate-400 shrink-0" aria-hidden />
        <select
          value={selectedCli}
          onChange={(e) => onCliChange(e.target.value as Agent["cli_provider"])}
          className="bg-slate-700 text-slate-200 text-xs rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-blue-500"
        >
          {Object.entries(CLI_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        {showModelSelect && (
          <select
            value={selectedCliModel}
            onChange={(e) => onCliModelChange(e.target.value)}
            className="bg-slate-700 text-slate-200 text-xs rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-blue-500 max-w-[180px]"
          >
            <option value="">{t({ ko: "기본 (Settings)", en: "Default (Settings)" })}</option>
            {providerModels.map((m) => (
              <option key={m.slug} value={m.slug}>{m.displayName || m.slug}</option>
            ))}
          </select>
        )}

        {showReasoningLevel && (
          <select
            value={selectedCliReasoningLevel}
            onChange={(e) => onCliReasoningLevelChange(e.target.value)}
            className="bg-slate-700 text-slate-200 text-xs rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-blue-500"
          >
            {CODEX_REASONING_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level || t({ ko: "기본", en: "Default" })}
              </option>
            ))}
          </select>
        )}

        {requiresOAuthAccount && (
          oauthLoading ? (
            <span className="text-[10px] text-slate-400">
              {t({ ko: "계정 로딩...", en: "Loading accounts..." })}
            </span>
          ) : activeOAuthAccounts.length > 0 ? (
            <select
              value={selectedOAuthAccountId}
              onChange={(e) => onOAuthAccountChange(e.target.value)}
              className="bg-slate-700 text-slate-200 text-xs rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-blue-500 max-w-[170px]"
            >
              {activeOAuthAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {oauthAccountLabel(acc)}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-[10px] text-amber-300">
              {t({ ko: "활성 OAuth 계정 없음", en: "No active OAuth account" })}
            </span>
          )
        )}
        {requiresApiProvider && (
          <span className="text-[10px] text-amber-300">
            <><Settings width={10} height={10} className="inline-block align-middle mr-0.5" /> {t({
                ko: "설정 > API 탭에서 모델을 배정하세요",
                en: "Assign models in Settings > API tab",
})}</>
          </span>
        )}
        <button
          disabled={savingCli || !canSaveCli}
          onClick={onSave}
          className="text-[10px] px-1.5 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50"
        >
          {savingCli ? "..." : t({ ko: "저장", en: "Save" })}
        </button>
        <button
          onClick={onCancel}
          className="text-[10px] px-1.5 py-0.5 bg-slate-600 hover:bg-slate-500 text-slate-300 rounded transition-colors"
        >
          {t({ ko: "취소", en: "Cancel" })}
        </button>
      </div>
    );
  }

  const modelSuffix = agent.cli_model ? ` (${agent.cli_model})` : "";
  const displayLabel = agent.cli_provider === "api" && agent.api_model
    ? `API: ${agent.api_model}`
    : `${CLI_LABELS[agent.cli_provider] ?? agent.cli_provider}${modelSuffix}`;

  return (
    <button
      onClick={onStartEdit}
      className="flex items-center gap-1 hover:text-slate-300 transition-colors"
      title={t({ ko: "클릭하여 CLI 변경", en: "Click to change CLI" })}
    >
      <Wrench width={14} height={14} className="inline-block align-middle text-slate-400 shrink-0" />
      {displayLabel}
      <Pencil width={10} height={10} className="inline-block align-middle text-slate-500 ml-0.5" aria-hidden />
    </button>
  );
}
