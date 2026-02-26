import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { MessageCircle } from "lucide-react";
import type { Department, Agent, Task, MeetingPresence } from "../../../types";
import type { LangText } from "../../../i18n";
import { LOCALE_TEXT } from "../officeViewPalette";
import AgentRow from "./AgentRow";
import type { MeetingBadgeInfo } from "./AgentRow";

function buildDeptTheme(hex: string | undefined) {
  const c = hex && hex.length === 7 ? hex : "#64748b";
  return {
    card: {
      borderColor: `${c}30`,
      background: `linear-gradient(135deg, ${c}0a 0%, transparent 60%)`,
    } as React.CSSProperties,
    header: {
      borderLeftWidth: 4,
      borderLeftStyle: "solid" as const,
      borderLeftColor: c,
      background: `linear-gradient(to right, ${c}18, transparent)`,
    } as React.CSSProperties,
    badge: { backgroundColor: `${c}20`, color: c, borderColor: `${c}40` } as React.CSSProperties,
    footerBtn: { backgroundColor: `${c}12`, borderColor: `${c}30` } as React.CSSProperties,
  };
}

interface DeptCardProps {
  department: Department;
  agents: Agent[];
  tasks: Task[];
  unreadAgentIds: Set<string>;
  meetingPresence?: MeetingPresence[];
  t: (obj: LangText) => string;
  onSelectAgent: (agent: Agent) => void;
  onSelectDepartment: (dept: Department) => void;
  draggable?: boolean;
}

function countActiveTasks(tasks: Task[], agentId: string): number {
  return tasks.filter((t) => t.assigned_agent_id === agentId && t.status !== "done" && t.status !== "cancelled").length;
}

function findMeetingBadge(presence: MeetingPresence[] | undefined, agentId: string): MeetingBadgeInfo | undefined {
  if (!presence) return undefined;
  const now = Date.now();
  const row = presence.find((p) => p.agent_id === agentId && p.until > now);
  if (!row) return undefined;
  return { phase: row.phase, decision: row.decision };
}

export default function DeptCard({
  department,
  agents,
  tasks,
  unreadAgentIds,
  meetingPresence,
  t,
  onSelectAgent,
  onSelectDepartment,
  draggable: isDraggable = false,
}: DeptCardProps) {
  const { setNodeRef, isOver, active } = useDroppable({
    id: `dept-${department.id}`,
    data: { deptId: department.id },
  });
  const deptAgents = agents.filter((a) => a.department_id === department.id && !(a as { disabled?: boolean }).disabled);
  const leader = deptAgents.find((a) => a.role === "team_leader");
  const deptName = department.name_ko || department.name || department.id;
  const theme = useMemo(() => buildDeptTheme(department.color), [department.color]);

  const sameDept = isOver && active?.data?.current?.currentDeptId === department.id;
  const highlightDrop = isOver && !sameDept;

  return (
    <article
      ref={setNodeRef}
      className={`flex flex-col overflow-hidden rounded-2xl border shadow-sm transition-all duration-200 ${highlightDrop ? "border-cyan-400/70 bg-slate-700/50 shadow-cyan-500/20 shadow-lg" : "bg-slate-800/40 shadow-slate-950/30 hover:shadow-md"}`}
      style={highlightDrop ? undefined : theme.card}
      aria-label={deptName}
    >
      <header className="relative border-b border-slate-700/40 px-4 py-3.5" style={theme.header}>
        <div className="flex items-center gap-2">
          {department.icon && (
            <span className="text-lg leading-none" aria-hidden="true">
              {department.icon}
            </span>
          )}
          <h3 className="text-sm font-semibold tracking-tight text-slate-100">{deptName}</h3>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span
            className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold"
            style={theme.badge}
          >
            {deptAgents.length}
            {deptAgents.length === 1 ? t(LOCALE_TEXT.agentCountOne) : t(LOCALE_TEXT.agentCountMany)}
          </span>
        </div>
      </header>
      <div className="flex-1 space-y-0.5 p-2.5">
        {deptAgents.length === 0 ? (
          <p className="px-2 py-5 text-center text-xs text-slate-500">{t(LOCALE_TEXT.noAssignedAgent)}</p>
        ) : (
          deptAgents.map((agent) => (
            <AgentRow
              key={agent.id}
              agent={agent}
              agents={agents}
              taskCount={countActiveTasks(tasks, agent.id)}
              hasUnread={unreadAgentIds.has(agent.id)}
              meetingBadge={findMeetingBadge(meetingPresence, agent.id)}
              t={t}
              onSelect={onSelectAgent}
              draggable={isDraggable}
            />
          ))
        )}
      </div>
      {leader && (
        <footer className="border-t border-slate-700/40 p-2.5">
          <button
            type="button"
            onClick={() => onSelectDepartment(department)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-medium text-slate-200 transition-all hover:brightness-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            style={theme.footerBtn}
            aria-label={t(LOCALE_TEXT.chatWithLead)}
          >
            <MessageCircle width={14} height={14} className="opacity-80" aria-hidden />
            {t(LOCALE_TEXT.chatWithLead)}
          </button>
        </footer>
      )}
    </article>
  );
}
