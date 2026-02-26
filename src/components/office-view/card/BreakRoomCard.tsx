import { useDroppable } from "@dnd-kit/core";
import { UserPlus } from "lucide-react";
import type { Department, Agent, Task, MeetingPresence } from "../../../types";
import type { LangText } from "../../../i18n";
import { LOCALE_TEXT } from "../officeViewPalette";
import AgentRow from "./AgentRow";
import type { MeetingBadgeInfo } from "./AgentRow";

interface BreakRoomCardProps {
  departments: Department[];
  agents: Agent[];
  tasks: Task[];
  unreadAgentIds: Set<string>;
  meetingPresence?: MeetingPresence[];
  t: (obj: LangText) => string;
  onSelectAgent: (agent: Agent) => void;
  /** 전달 시 휴게실 카드에 "에이전트 고용" 버튼 표시 */
  onHireAgent?: () => void;
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

/** 팀 배정이 안 된 에이전트를 보여주는 휴게실 카드 */
export default function BreakRoomCard({
  departments,
  agents,
  tasks,
  unreadAgentIds,
  meetingPresence,
  t,
  onSelectAgent,
  onHireAgent,
  draggable: isDraggable = false,
}: BreakRoomCardProps) {
  const { setNodeRef, isOver, active } = useDroppable({
    id: "dept-breakroom",
    data: { deptId: null },
  });
  const deptIds = new Set(departments.map((d) => d.id));
  const unassignedAgents = agents.filter(
    (a) => !(a as { disabled?: boolean }).disabled && (!a.department_id || !deptIds.has(a.department_id)),
  );
  const fromBreakRoom = isOver && !active?.data?.current?.currentDeptId;
  const highlightDrop = isOver && !fromBreakRoom;

  return (
    <article
      ref={setNodeRef}
      className={`flex flex-col overflow-hidden rounded-2xl border shadow-sm transition-all duration-200 ${highlightDrop ? "border-solid border-cyan-400/70 bg-slate-700/40 shadow-cyan-500/20 shadow-lg" : "border-dashed border-slate-600/50 bg-slate-800/30 shadow-slate-950/20 hover:border-slate-500/60 hover:shadow-md hover:shadow-slate-950/15"}`}
      aria-label={t(LOCALE_TEXT.breakRoom)}
    >
      <header className="border-b border-slate-700/40 px-4 py-3.5">
        <h3 className="text-sm font-semibold tracking-tight text-slate-200">{t(LOCALE_TEXT.breakRoom)}</h3>
        <p className="mt-1 text-xs text-slate-400">
          {t(LOCALE_TEXT.breakRoomSubtitle)} · {unassignedAgents.length}
          {unassignedAgents.length === 1 ? t(LOCALE_TEXT.agentCountOne) : t(LOCALE_TEXT.agentCountMany)}
        </p>
      </header>
      <div className="flex-1 space-y-0.5 p-2.5">
        {unassignedAgents.length === 0 ? (
          <p className="px-2 py-5 text-center text-xs text-slate-500">
            {t({ ko: "팀 배정이 안 된 에이전트가 없습니다.", en: "No unassigned agents." })}
          </p>
        ) : (
          unassignedAgents.map((agent) => (
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
      {onHireAgent && (
        <footer className="border-t border-slate-700/40 p-2.5">
          <button
            type="button"
            onClick={onHireAgent}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-500/50 bg-slate-700/40 py-2.5 text-xs font-medium text-slate-200 transition-colors hover:border-slate-400/60 hover:bg-slate-600/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            aria-label={t(LOCALE_TEXT.hireAgent)}
          >
            <UserPlus width={14} height={14} className="opacity-80" aria-hidden />
            {t(LOCALE_TEXT.hireAgent)}
          </button>
        </footer>
      )}
    </article>
  );
}
