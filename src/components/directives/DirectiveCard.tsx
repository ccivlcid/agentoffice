import type { Task, Agent, Department } from "../../types";
import { useI18n } from "../../i18n";
import {
  taskStatusLabel,
  priorityColor,
  taskTypeLabel,
  timeAgo,
} from "../task-board/taskBoardHelpers";
import { Clock } from "lucide-react";

interface DirectiveCardProps {
  task: Task;
  agents: Agent[];
  departments: Department[];
  selected: boolean;
  onClick: () => void;
}

export default function DirectiveCard({
  task,
  agents,
  departments,
  selected,
  onClick,
}: DirectiveCardProps) {
  const { t, locale } = useI18n();
  const dept = departments.find((d) => d.id === task.department_id);
  const agent = agents.find((a) => a.id === task.assigned_agent_id);
  const statusLabel = taskStatusLabel(task.status, t);
  const typeLabel = taskTypeLabel(task.task_type, t);

  const statusColor: Record<string, string> = {
    inbox: "var(--th-text-muted)",
    planned: "#60a5fa",
    collaborating: "#818cf8",
    in_progress: "#fbbf24",
    review: "#c084fc",
    done: "#4ade80",
    pending: "#fb923c",
    cancelled: "#f87171",
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg p-3 transition-all ${
        selected
          ? "ring-2 ring-blue-500/60 shadow-md"
          : "hover:shadow-sm"
      }`}
      style={{
        background: selected ? "var(--th-bg-surface-hover)" : "var(--th-bg-surface)",
        border: "1px solid var(--th-border)",
      }}
    >
      <div className="flex items-start gap-2">
        <div
          className="w-2 h-2 rounded-full mt-1.5 shrink-0"
          style={{ background: statusColor[task.status] ?? "var(--th-text-muted)" }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className="text-[10px] font-mono"
              style={{ color: "var(--th-text-muted)" }}
            >
              #{task.id.slice(0, 6)}
            </span>
            <span
              className="text-[10px] px-1 rounded"
              style={{
                background: `${statusColor[task.status] ?? "#666"}20`,
                color: statusColor[task.status] ?? "var(--th-text-muted)",
              }}
            >
              {statusLabel}
            </span>
          </div>
          <div
            className="text-sm font-medium truncate"
            style={{ color: "var(--th-text-heading)" }}
          >
            {task.title}
          </div>
          <div className="flex items-center gap-2 mt-1 text-[11px]" style={{ color: "var(--th-text-muted)" }}>
            {dept && (
              <span className="truncate">
                {locale === "ko" ? dept.name_ko || dept.name : dept.name}
              </span>
            )}
            <span>·</span>
            <span>{typeLabel}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${priorityColor(task.priority)}`} />
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-[10px]" style={{ color: "var(--th-text-muted)" }}>
            <Clock width={10} height={10} />
            <span>{timeAgo(task.created_at, locale)}</span>
            {agent && (
              <>
                <span>·</span>
                <span>{agent.name}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
