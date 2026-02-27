import type { Task, Agent, Department } from "../../types";
import { useI18n } from "../../i18n";
import {
  taskTypeLabel,
  timeAgo,
  TASK_TYPE_COLORS,
} from "../task-board/taskBoardHelpers";
import { Clock, User } from "lucide-react";

interface DeliverableCardProps {
  task: Task;
  agents: Agent[];
  departments: Department[];
  selected: boolean;
  onClick: () => void;
}

function formatCompletedDate(ts: number, locale: string): string {
  const d = new Date(ts);
  const now = Date.now();
  const diffDays = Math.floor((now - ts) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return timeAgo(ts, locale);
  if (diffDays === 1) return locale.startsWith("ko") ? "어제" : "Yesterday";
  if (diffDays < 7) return locale.startsWith("ko") ? `${diffDays}일 전` : `${diffDays}d ago`;
  return d.toLocaleDateString(locale.startsWith("ko") ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
    year: diffDays > 365 ? "numeric" : undefined,
  });
}

export default function DeliverableCard({
  task,
  agents,
  departments,
  selected,
  onClick,
}: DeliverableCardProps) {
  const { t, locale } = useI18n();
  const dept = departments.find((d) => d.id === task.department_id);
  const agent = agents.find((a) => a.id === task.assigned_agent_id);
  const typeColors = TASK_TYPE_COLORS[task.task_type] ?? TASK_TYPE_COLORS.general;
  const completedTs = task.completed_at ?? task.updated_at;

  const accent = dept?.color && dept.color.trim() ? dept.color.trim() : typeColors.accent;
  const bgTint = dept?.color && dept.color.trim() ? `${dept.color.trim()}20` : typeColors.bg;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`dlv-card-v2 dlv-card-v2--type-${task.task_type} ${selected ? "dlv-card-v2--selected" : ""}`}
      style={{
        ["--dlv-accent" as string]: accent,
        ["--dlv-bg-tint" as string]: bgTint,
      } as React.CSSProperties}
    >
      <div className="dlv-card-v2-accent" />
      <div className="dlv-card-v2-body">
        <h3 className="dlv-card-v2-title">{task.title}</h3>
        <div className="dlv-card-v2-meta">
          <span
            className="dlv-type-badge"
            style={{ background: bgTint, color: accent }}
          >
            {taskTypeLabel(task.task_type, t)}
          </span>
          {dept && (
            <span className="dlv-card-v2-dept">
              {locale === "ko" ? dept.name_ko || dept.name : dept.name}
            </span>
          )}
        </div>
        <div className="dlv-card-v2-footer">
          <span className="dlv-card-v2-date">
            <Clock width={10} height={10} aria-hidden />
            {formatCompletedDate(completedTs, locale)}
          </span>
          {agent && (
            <span className="dlv-card-v2-agent">
              <User width={10} height={10} aria-hidden />
              {agent.name}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
