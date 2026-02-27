import type { McpServer } from "../../api";
import type { Agent } from "../../types";
import type { TFunction } from "./skillsLibraryHelpers";
import { pickRepresentativeForProvider } from "./skillsLibraryHelpers";
import AgentAvatar from "../AgentAvatar";
import { configProviderIcon } from "./SkillsLibraryProviderLogos";
import { Pencil, Trash2, Server } from "lucide-react";
import { MCP_CATEGORY_ICONS } from "../../constants/icons";

const CATEGORY_COLORS: Record<string, string> = {
  filesystem: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
  database: "text-blue-400 bg-blue-500/15 border-blue-500/30",
  api: "text-purple-400 bg-purple-500/15 border-purple-500/30",
  "dev-tools": "text-amber-400 bg-amber-500/15 border-amber-500/30",
  other: "text-slate-400 bg-slate-500/15 border-slate-500/30",
};

const MCP_CATEGORY_LABEL: Record<string, { ko: string; en: string }> = {
  filesystem: { ko: "파일시스템", en: "Filesystem" },
  database: { ko: "데이터베이스", en: "Database" },
  api: { ko: "API", en: "API" },
  "dev-tools": { ko: "개발도구", en: "Dev Tools" },
  other: { ko: "기타", en: "Other" },
};

const MCP_PROVIDER_LABEL: Record<string, string> = {
  claude: "Claude Code",
  codex: "Codex CLI",
  gemini: "Gemini CLI",
  opencode: "OpenCode",
};

interface McpServerRowProps {
  server: McpServer;
  agents: Agent[];
  t: TFunction;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function McpServerRow({ server, agents, t, onToggle, onEdit, onDelete }: McpServerRowProps) {
  const providers: string[] = (() => {
    try {
      return JSON.parse(server.providers);
    } catch {
      return [];
    }
  })();
  const args: string[] = (() => {
    try {
      return JSON.parse(server.args);
    } catch {
      return [];
    }
  })();
  const catColor = CATEGORY_COLORS[server.category] ?? CATEGORY_COLORS.other;
  const CatIcon = MCP_CATEGORY_ICONS[server.category];

  return (
    <div
      className={`rounded-lg border border-slate-700/70 bg-slate-800/50 p-2.5 transition-all ${
        !server.enabled ? "opacity-50" : ""
      }`}
    >
      {/* Row 1: icon + name + toggle + providers + edit/delete */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-900/60">
            <Server width={13} height={13} className="text-purple-400" />
          </div>
          <div className="truncate text-xs font-semibold text-slate-100">{server.name}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Toggle */}
          <button
            onClick={onToggle}
            className={`shrink-0 w-8 h-4 rounded-full transition-colors relative ${
              server.enabled ? "bg-emerald-500" : "bg-slate-600"
            }`}
            title={server.enabled ? t({ ko: "비활성화", en: "Disable" }) : t({ ko: "활성화", en: "Enable" })}
          >
            <div
              className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                server.enabled ? "left-[17px]" : "left-0.5"
              }`}
            />
          </button>
          {/* Providers mini-grid */}
          {providers.length > 0 && (
            <div className="flex gap-0.5">
              {providers.slice(0, 4).map((p) => {
                const agent = pickRepresentativeForProvider(agents, p as Agent["cli_provider"]);
                return (
                  <span
                    key={p}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-emerald-500/20 bg-slate-900/70"
                    title={`${MCP_PROVIDER_LABEL[p] || p}${agent ? ` · ${agent.name}` : ""}`}
                  >
                    <AgentAvatar agent={agent ?? undefined} agents={agents} size={14} rounded="xl" />
                  </span>
                );
              })}
            </div>
          )}
          {/* Edit / Delete */}
          <button
            onClick={onEdit}
            className="p-1 text-slate-400 hover:text-blue-300 transition-colors"
            title={t({ ko: "편집", en: "Edit" })}
          >
            <Pencil width={12} height={12} />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-slate-400 hover:text-rose-300 transition-colors"
            title={t({ ko: "삭제", en: "Delete" })}
          >
            <Trash2 width={12} height={12} />
          </button>
        </div>
      </div>
      {/* Row 2: package + category + command */}
      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-500">
        <span className="truncate font-mono">{server.package || server.server_key}</span>
        <span className={`shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border ${catColor}`}>
          {CatIcon && <CatIcon width={10} height={10} />}
          {t(MCP_CATEGORY_LABEL[server.category] || { ko: server.category, en: server.category })}
        </span>
        <span className="shrink-0 font-mono">$ {server.command}</span>
      </div>
    </div>
  );
}
