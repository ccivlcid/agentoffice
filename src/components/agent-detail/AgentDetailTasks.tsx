import type { Task, Department, SubTask } from "../../types";
import {
  SUBTASK_STATUS_ICON,
  taskStatusLabel,
  taskTypeLabel,
  type Locale,
  type TFunction,
} from "./agentDetailHelpers";
import { Link } from "lucide-react";

interface AgentDetailTasksProps {
  agentTasks: Task[];
  subtasksByTask: Record<string, SubTask[]>;
  departments: Department[];
  locale: Locale;
  expandedTaskId: string | null;
  onExpandToggle: (taskId: string) => void;
  t: TFunction;
}

export default function AgentDetailTasks({
  agentTasks,
  subtasksByTask,
  departments,
  locale,
  expandedTaskId,
  onExpandToggle,
  t,
}: AgentDetailTasksProps) {
  if (agentTasks.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-sm">
        {t({ ko: "배정된 업무가 없습니다", en: "No assigned tasks" })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {agentTasks.map((taskItem) => {
        const tSubs = subtasksByTask[taskItem.id] ?? [];
        const isExpanded = expandedTaskId === taskItem.id;
        const subTotal = taskItem.subtask_total ?? tSubs.length;
        const subDone = taskItem.subtask_done ?? tSubs.filter((s) => s.status === "done").length;
        return (
          <div key={taskItem.id} className="bg-slate-700/30 rounded-lg p-3">
            <button
              onClick={() => onExpandToggle(taskItem.id)}
              className="flex items-start gap-3 w-full text-left"
            >
              <div
                className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  taskItem.status === "done"
                    ? "bg-green-500"
                    : taskItem.status === "in_progress"
                    ? "bg-blue-500"
                    : "bg-slate-500"
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">
                  {taskItem.title}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {taskStatusLabel(taskItem.status, t)} · {taskTypeLabel(taskItem.task_type, t)}
                </div>
                {subTotal > 0 && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1 bg-slate-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all"
                        style={{ width: `${Math.round((subDone / subTotal) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {subDone}/{subTotal}
                    </span>
                  </div>
                )}
              </div>
            </button>
            {isExpanded && tSubs.length > 0 && (
              <div className="mt-2 ml-5 space-y-1 border-l border-slate-600 pl-2">
                {tSubs.map((st) => {
                  const targetDept = st.target_department_id
                    ? departments.find(d => d.id === st.target_department_id)
                    : null;
                  return (
                    <div key={st.id} className="flex items-center gap-1.5 text-xs">
                      <span>{SUBTASK_STATUS_ICON[st.status] || '\u23F3'}</span>
                      <span className={`flex-1 truncate ${st.status === 'done' ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                        {st.title}
                      </span>
                      {targetDept && (
                        <span
                          className="shrink-0 rounded px-1 py-0.5 text-[10px] font-medium"
                          style={{ backgroundColor: targetDept.color + '30', color: targetDept.color }}
                        >
                          {targetDept.icon} {locale === "ko" ? targetDept.name_ko : targetDept.name}
                        </span>
                      )}
                      {st.delegated_task_id && st.status !== 'done' && (
                        <span
                          className="text-blue-400 shrink-0"
                          title={t({ ko: "위임됨", en: "Delegated" })}
                        >
                          <Link width={12} height={12} className="inline-block" aria-hidden />
                        </span>
                      )}
                      {st.status === 'blocked' && st.blocked_reason && (
                        <span className="text-red-400 text-[10px] truncate max-w-[80px]" title={st.blocked_reason}>
                          {st.blocked_reason}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
