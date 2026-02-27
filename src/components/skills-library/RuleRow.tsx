import type { ProjectRule } from "../../api";
import type { Agent } from "../../types";
import type { TFunction } from "./skillsLibraryHelpers";
import { pickRepresentativeForProvider } from "./skillsLibraryHelpers";
import AgentAvatar from "../AgentAvatar";
import { configProviderIcon } from "./SkillsLibraryProviderLogos";
import { Pencil, Trash2, FileText, Pin } from "lucide-react";
import { RULE_CATEGORY_ICONS } from "../../constants/icons";

const CATEGORY_COLORS: Record<string, string> = {
  general: "text-slate-400 bg-slate-500/15 border-slate-500/30",
  coding: "text-blue-400 bg-blue-500/15 border-blue-500/30",
  architecture: "text-purple-400 bg-purple-500/15 border-purple-500/30",
  testing: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
  style: "text-amber-400 bg-amber-500/15 border-amber-500/30",
};

const CATEGORY_LABEL: Record<string, { ko: string; en: string }> = {
  general: { ko: "일반", en: "General" },
  coding: { ko: "코딩", en: "Coding" },
  architecture: { ko: "아키텍처", en: "Architecture" },
  testing: { ko: "테스팅", en: "Testing" },
  style: { ko: "스타일", en: "Style" },
};

const PROVIDER_LABEL: Record<string, string> = {
  claude: "Claude Code",
  cursor: "Cursor",
  codex: "Codex CLI",
  gemini: "Gemini CLI",
  opencode: "OpenCode",
};

interface RuleRowProps {
  rule: ProjectRule;
  agents: Agent[];
  t: TFunction;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function RuleRow({ rule, agents, t, onToggle, onEdit, onDelete }: RuleRowProps) {
  const providers: string[] = (() => {
    try {
      return JSON.parse(rule.providers);
    } catch {
      return [];
    }
  })();
  const catColor = CATEGORY_COLORS[rule.category] ?? CATEGORY_COLORS.general;
  const CatIcon = RULE_CATEGORY_ICONS[rule.category];

  return (
    <div
      className={`rounded-lg border border-slate-700/70 bg-slate-800/50 p-2.5 transition-all ${
        !rule.enabled ? "opacity-50" : ""
      }`}
    >
      {/* Row 1: icon + title + always_apply + toggle + providers + edit/delete */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-900/60">
            <FileText width={13} height={13} className="text-amber-400" />
          </div>
          <div className="truncate text-xs font-semibold text-slate-100">{rule.title || rule.name}</div>
          {rule.always_apply === 1 && (
            <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/20">
              <Pin width={8} height={8} />
              Always
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={onToggle}
            className={`shrink-0 w-8 h-4 rounded-full transition-colors relative ${
              rule.enabled ? "bg-emerald-500" : "bg-slate-600"
            }`}
            title={rule.enabled ? t({ ko: "비활성화", en: "Disable" }) : t({ ko: "활성화", en: "Enable" })}
          >
            <div
              className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                rule.enabled ? "left-[17px]" : "left-0.5"
              }`}
            />
          </button>
          {providers.length > 0 && (
            <div className="flex gap-0.5">
              {providers.slice(0, 4).map((p) => {
                const agent = pickRepresentativeForProvider(agents, p as Agent["cli_provider"]);
                return (
                  <span
                    key={p}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-emerald-500/20 bg-slate-900/70"
                    title={`${PROVIDER_LABEL[p] || p}${agent ? ` · ${agent.name}` : ""}`}
                  >
                    <AgentAvatar agent={agent ?? undefined} agents={agents} size={14} rounded="xl" />
                  </span>
                );
              })}
            </div>
          )}
          <button onClick={onEdit} className="p-1 text-slate-400 hover:text-blue-300 transition-colors" title={t({ ko: "편집", en: "Edit" })}>
            <Pencil width={12} height={12} />
          </button>
          <button onClick={onDelete} className="p-1 text-slate-400 hover:text-rose-300 transition-colors" title={t({ ko: "삭제", en: "Delete" })}>
            <Trash2 width={12} height={12} />
          </button>
        </div>
      </div>
      {/* Row 2: name + category + source */}
      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-500">
        <span className="truncate font-mono">{rule.name}</span>
        <span className={`shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border ${catColor}`}>
          {CatIcon && <CatIcon width={10} height={10} />}
          {t(CATEGORY_LABEL[rule.category] || { ko: rule.category, en: rule.category })}
        </span>
        {rule.source !== "manual" && (
          <span className="shrink-0 text-slate-600">{rule.source}</span>
        )}
      </div>
    </div>
  );
}
