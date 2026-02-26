import { MessageCircle } from "lucide-react";
import type { Department, Agent, Task } from "../../../types";
import type { LangText } from "../../../i18n";
import { LOCALE_TEXT } from "../officeViewPalette";
import AgentRow from "./AgentRow";

interface DeptCardProps {
  department: Department;
  agents: Agent[];
  tasks: Task[];
  unreadAgentIds: Set<string>;
  t: (obj: LangText) => string;
  onSelectAgent: (agent: Agent) => void;
  onSelectDepartment: (dept: Department) => void;
}

function countActiveTasks(tasks: Task[], agentId: string): number {
  return tasks.filter(
    (t) => t.assigned_agent_id === agentId && t.status !== "done" && t.status !== "cancelled"
  ).length;
}

export default function DeptCard({
  department,
  agents,
  tasks,
  unreadAgentIds,
  t,
  onSelectAgent,
  onSelectDepartment,
}: DeptCardProps) {
  const deptAgents = agents.filter(
    (a) => a.department_id === department.id && !(a as { disabled?: boolean }).disabled
  );
  const leader = deptAgents.find((a) => a.role === "team_leader");
  const deptName = department.name_ko || department.name || department.id;

  const accentColor = department.color ? { borderLeftColor: department.color } : undefined;

  return (
    <article
      className="flex flex-col overflow-hidden rounded-2xl border border-slate-600/40 bg-slate-800/40 shadow-sm shadow-slate-950/30 transition-all duration-200 hover:border-slate-500/50 hover:shadow-md hover:shadow-slate-950/20"
      aria-label={deptName}
    >
      <header
        className="relative border-b border-slate-700/40 px-4 py-3.5"
        style={accentColor ? { borderLeftWidth: 3, borderLeftStyle: "solid" as const, ...accentColor } : undefined}
      >
        <h3 className="text-sm font-semibold tracking-tight text-slate-100">{deptName}</h3>
        <p className="mt-1 text-xs text-slate-400">
          {deptAgents.length}
          {deptAgents.length === 1 ? t(LOCALE_TEXT.agentCountOne) : t(LOCALE_TEXT.agentCountMany)}
        </p>
      </header>
      <div className="flex-1 space-y-0.5 p-2.5">
        {deptAgents.length === 0 ? (
          <p className="px-2 py-5 text-center text-xs text-slate-500">
            {t(LOCALE_TEXT.noAssignedAgent)}
          </p>
        ) : (
          deptAgents.map((agent) => (
            <AgentRow
              key={agent.id}
              agent={agent}
              agents={agents}
              taskCount={countActiveTasks(tasks, agent.id)}
              hasUnread={unreadAgentIds.has(agent.id)}
              t={t}
              onSelect={onSelectAgent}
            />
          ))
        )}
      </div>
      {leader && (
        <footer className="border-t border-slate-700/40 p-2.5">
          <button
            type="button"
            onClick={() => onSelectDepartment(department)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-700/60 py-2.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-600/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
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
