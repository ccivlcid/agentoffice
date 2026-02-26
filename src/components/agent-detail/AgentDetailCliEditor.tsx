import type { Agent } from "../../types";
import type { OAuthAccountInfo } from "../../api";
import {
  CLI_LABELS,
  oauthAccountLabel,
  type TFunction,
} from "./agentDetailHelpers";
import { Wrench, Settings, Pencil } from "lucide-react";

interface AgentDetailCliEditorProps {
  agent: Agent;
  editingCli: boolean;
  selectedCli: Agent["cli_provider"];
  selectedOAuthAccountId: string;
  requiresOAuthAccount: boolean;
  requiresApiProvider: boolean;
  canSaveCli: boolean;
  savingCli: boolean;
  oauthLoading: boolean;
  activeOAuthAccounts: OAuthAccountInfo[];
  t: TFunction;
  onCliChange: (cli: Agent["cli_provider"]) => void;
  onOAuthAccountChange: (id: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onStartEdit: () => void;
}

export default function AgentDetailCliEditor({
  agent,
  editingCli,
  selectedCli,
  selectedOAuthAccountId,
  requiresOAuthAccount,
  requiresApiProvider,
  canSaveCli,
  savingCli,
  oauthLoading,
  activeOAuthAccounts,
  t,
  onCliChange,
  onOAuthAccountChange,
  onSave,
  onCancel,
  onStartEdit,
}: AgentDetailCliEditorProps) {
  if (editingCli) {
    return (
      <>
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
              {t({
                ko: "활성 OAuth 계정 없음",
                en: "No active OAuth account",
})}
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
      </>
    );
  }

  return (
    <button
      onClick={onStartEdit}
      className="flex items-center gap-1 hover:text-slate-300 transition-colors"
      title={t({ ko: "클릭하여 CLI 변경", en: "Click to change CLI" })}
    >
      <Wrench width={14} height={14} className="inline-block align-middle text-slate-400 shrink-0" /> {agent.cli_provider === "api" && agent.api_model
        ? `API: ${agent.api_model}`
        : (CLI_LABELS[agent.cli_provider] ?? agent.cli_provider)}
      <Pencil width={10} height={10} className="inline-block align-middle text-slate-500 ml-0.5" aria-hidden />
    </button>
  );
}
