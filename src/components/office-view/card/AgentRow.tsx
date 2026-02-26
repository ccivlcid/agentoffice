import { useDraggable } from "@dnd-kit/core";
import type { Agent, AgentStatus, MeetingReviewDecision } from "../../../types";
import AgentAvatar from "../../AgentAvatar";
import { LOCALE_TEXT } from "../officeViewPalette";
import type { LangText } from "../../../i18n";

const STATUS_STYLE: Record<AgentStatus, { text: LangText; dot: string; label: string }> = {
  working: { text: { ko: "작업중", en: "Working" }, dot: "bg-emerald-400", label: "text-emerald-400/90" },
  idle: { text: { ko: "대기중", en: "Idle" }, dot: "bg-slate-400", label: "text-slate-400/80" },
  break: { text: { ko: "휴식중", en: "On break" }, dot: "bg-amber-400", label: "text-amber-400/80" },
  offline: { text: { ko: "오프라인", en: "Offline" }, dot: "bg-slate-600", label: "text-slate-500/70" },
};

export interface MeetingBadgeInfo {
  phase: "kickoff" | "review";
  decision?: MeetingReviewDecision | null;
}

interface AgentRowProps {
  agent: Agent;
  agents: Agent[];
  taskCount: number;
  hasUnread: boolean;
  meetingBadge?: MeetingBadgeInfo;
  t: (obj: LangText) => string;
  onSelect: (agent: Agent) => void;
  draggable?: boolean;
}

const ROLE_KEYS = ["team_leader", "senior", "junior", "intern", "part_time"] as const;

function roleLabel(role: string | undefined, t: (obj: LangText) => string): string {
  if (!role) return "";
  const key = ROLE_KEYS.find((r) => r === role);
  if (key && LOCALE_TEXT.role[key]) return t(LOCALE_TEXT.role[key]);
  return role;
}

function meetingBadgeStyle(badge: MeetingBadgeInfo): { text: LangText; className: string } {
  if (badge.phase === "kickoff") {
    return { text: LOCALE_TEXT.meetingBadgeKickoff, className: "bg-amber-500/20 text-amber-300" };
  }
  if (badge.decision === "approved") {
    return { text: LOCALE_TEXT.meetingBadgeApproved, className: "bg-emerald-500/20 text-emerald-300" };
  }
  if (badge.decision === "hold") {
    return { text: LOCALE_TEXT.meetingBadgeHold, className: "bg-orange-500/20 text-orange-300" };
  }
  return { text: LOCALE_TEXT.meetingBadgeReviewing, className: "bg-blue-500/20 text-blue-300" };
}

export default function AgentRow({
  agent,
  agents,
  taskCount,
  hasUnread,
  meetingBadge,
  t,
  onSelect,
  draggable: isDraggable = false,
}: AgentRowProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: agent.id,
    data: { agentId: agent.id, currentDeptId: agent.department_id },
    disabled: !isDraggable,
  });

  const displayName = agent.name_ko || agent.name || agent.id;
  const role = roleLabel(agent.role, t);

  const style: React.CSSProperties | undefined = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onSelect(agent)}
      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors duration-150 hover:bg-slate-700/50 focus:bg-slate-700/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800${isDragging ? " opacity-40 scale-95" : ""}${isDraggable ? " cursor-grab active:cursor-grabbing" : ""}`}
      style={style}
      aria-label={`${displayName}${role ? `, ${role}` : ""}${hasUnread ? ", " + t({ ko: "읽지 않음", en: "Unread" }) : ""}`}
      {...(isDraggable ? { ...listeners, ...attributes } : {})}
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
          {meetingBadge &&
            (() => {
              const s = meetingBadgeStyle(meetingBadge);
              return (
                <span className={`flex-shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${s.className}`}>
                  {t(s.text)}
                </span>
              );
            })()}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px]">
          {(() => {
            const s = STATUS_STYLE[agent.status] ?? STATUS_STYLE.idle;
            return (
              <span className={`flex items-center gap-1 ${s.label}`}>
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${s.dot}${agent.status === "working" ? " animate-pulse" : ""}`}
                />
                {t(s.text)}
              </span>
            );
          })()}
          {taskCount > 0 && <span className="text-slate-500">·</span>}
          {taskCount > 0 && (
            <span className="text-amber-400/95">
              {t({ ko: "태스크", en: "Tasks" })} {taskCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
