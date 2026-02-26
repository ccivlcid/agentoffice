import type { Agent } from "../../../types";
import AgentAvatar from "../../AgentAvatar";
import { LOCALE_TEXT } from "../officeViewPalette";
import type { LangText } from "../../../i18n";

interface AgentRowProps {
  agent: Agent;
  agents: Agent[];
  taskCount: number;
  hasUnread: boolean;
  t: (obj: LangText) => string;
  onSelect: (agent: Agent) => void;
}

const ROLE_KEYS = ["team_leader", "senior", "junior", "intern", "part_time"] as const;

function roleLabel(role: string | undefined, t: (obj: LangText) => string): string {
  if (!role) return "";
  const key = ROLE_KEYS.find((r) => r === role);
  if (key && LOCALE_TEXT.role[key]) return t(LOCALE_TEXT.role[key]);
  return role;
}

export default function AgentRow({
  agent,
  agents,
  taskCount,
  hasUnread,
  t,
  onSelect,
}: AgentRowProps) {
  const displayName = agent.name_ko || agent.name || agent.id;
  const role = roleLabel(agent.role, t);

  return (
    <button
      type="button"
      onClick={() => onSelect(agent)}
      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors duration-150 hover:bg-slate-700/50 focus:bg-slate-700/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800"
      aria-label={`${displayName}${role ? `, ${role}` : ""}${hasUnread ? ", " + t({ ko: "읽지 않음", en: "Unread" }) : ""}`}
    >
      <div className="relative flex-shrink-0">
        <AgentAvatar agent={agent} agents={agents} size={38} rounded="xl" />
        {hasUnread && (
          <span
            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-slate-800"
            aria-hidden
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-slate-100">{displayName}</span>
          {role && (
            <span className="flex-shrink-0 rounded-md bg-slate-600/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
              {role}
            </span>
          )}
        </div>
        {taskCount > 0 && (
          <p className="mt-1 text-[11px] text-amber-400/95">
            {t({ ko: "진행 중", en: "In progress" })} {taskCount}
          </p>
        )}
      </div>
    </button>
  );
}
