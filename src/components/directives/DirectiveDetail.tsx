import { useState, useMemo } from "react";
import type { Task, Agent, Department, SubTask } from "../../types";
import { useI18n } from "../../i18n";
import {
  taskStatusLabel,
  taskTypeLabel,
  priorityColor,
  priorityLabel,
  timeAgo,
  STATUS_OPTIONS,
} from "../task-board/taskBoardHelpers";
import DirectiveTimeline from "./DirectiveTimeline";
import {
  Play,
  Square,
  Pause,
  RotateCcw,
  Copy,
  Terminal,
  FileText,
  FolderCheck,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Trash2,
} from "lucide-react";
import * as api from "../../api";

interface DirectiveDetailProps {
  task: Task;
  agents: Agent[];
  departments: Department[];
  subtasks: SubTask[];
  onUpdateTask: (id: string, data: Partial<Task>) => Promise<void>;
  onRunTask: (id: string, executionMode?: string) => Promise<void>;
  onStopTask: (id: string) => Promise<void>;
  onPauseTask: (id: string) => Promise<void>;
  onResumeTask: (id: string) => Promise<void>;
  onOpenTerminal: (id: string) => void;
  onOpenMeetingMinutes: (id: string) => void;
  onClone: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onViewDeliverable?: (id: string) => void;
}

const SUBTASK_ICON: Record<string, React.ReactNode> = {
  done: <CheckCircle2 width={12} height={12} className="text-green-500" />,
  in_progress: <Clock width={12} height={12} className="text-amber-500" />,
  blocked: <AlertCircle width={12} height={12} className="text-red-500" />,
  pending: <Circle width={12} height={12} style={{ color: "var(--th-text-muted)" }} />,
};

export default function DirectiveDetail({
  task,
  agents,
  departments,
  subtasks,
  onUpdateTask,
  onRunTask,
  onStopTask,
  onPauseTask,
  onResumeTask,
  onOpenTerminal,
  onOpenMeetingMinutes,
  onClone,
  onDelete,
  onViewDeliverable,
}: DirectiveDetailProps) {
  const { t, locale } = useI18n();
  const [showTimeline, setShowTimeline] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const handleDeleteClick = () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    onDelete(task.id).finally(() => setDeleteConfirm(false));
  };

  const dept = departments.find((d) => d.id === task.department_id);
  const agent = agents.find((a) => a.id === task.assigned_agent_id);
  const taskSubtasks = useMemo(
    () => subtasks.filter((s) => s.task_id === task.id),
    [subtasks, task.id],
  );
  const doneCount = taskSubtasks.filter((s) => s.status === "done").length;

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

  const canRun = ["inbox", "planned", "collaborating"].includes(task.status);
  const canStop = task.status === "in_progress";
  const canPause = task.status === "in_progress";
  const canResume = task.status === "pending";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--th-border)" }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono" style={{ color: "var(--th-text-muted)" }}>
            #{task.id.slice(0, 8)}
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-medium"
            style={{
              background: `${statusColor[task.status] ?? "#666"}20`,
              color: statusColor[task.status],
            }}
          >
            {taskStatusLabel(task.status, t)}
          </span>
        </div>
        <h3 className="text-base font-bold" style={{ color: "var(--th-text-heading)" }}>
          {task.title}
        </h3>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Description */}
        {task.description && (
          <div>
            <div className="text-[11px] font-medium mb-1" style={{ color: "var(--th-text-muted)" }}>
              {t({ ko: "설명", en: "Description" })}
            </div>
            <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--th-text-secondary)" }}>
              {task.description}
            </p>
          </div>
        )}

        {/* Meta info */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span style={{ color: "var(--th-text-muted)" }}>{t({ ko: "부서", en: "Dept" })}: </span>
            <span style={{ color: "var(--th-text-secondary)" }}>
              {dept ? (locale === "ko" ? dept.name_ko || dept.name : dept.name) : "-"}
            </span>
          </div>
          <div>
            <span style={{ color: "var(--th-text-muted)" }}>{t({ ko: "유형", en: "Type" })}: </span>
            <span style={{ color: "var(--th-text-secondary)" }}>{taskTypeLabel(task.task_type, t)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span style={{ color: "var(--th-text-muted)" }}>{t({ ko: "우선순위", en: "Priority" })}: </span>
            <span className={`w-2 h-2 rounded-full ${priorityColor(task.priority)}`} />
            <span style={{ color: "var(--th-text-secondary)" }}>{priorityLabel(task.priority, t)}</span>
          </div>
          <div>
            <span style={{ color: "var(--th-text-muted)" }}>{t({ ko: "담당", en: "Agent" })}: </span>
            <span style={{ color: "var(--th-text-secondary)" }}>{agent?.name ?? "-"}</span>
          </div>
          <div>
            <span style={{ color: "var(--th-text-muted)" }}>{t({ ko: "생성", en: "Created" })}: </span>
            <span style={{ color: "var(--th-text-secondary)" }}>{timeAgo(task.created_at, locale)}</span>
          </div>
          {task.completed_at && (
            <div>
              <span style={{ color: "var(--th-text-muted)" }}>{t({ ko: "완료", en: "Completed" })}: </span>
              <span style={{ color: "var(--th-text-secondary)" }}>{timeAgo(task.completed_at, locale)}</span>
            </div>
          )}
        </div>

        {/* Status change */}
        <div>
          <div className="text-[11px] font-medium mb-1" style={{ color: "var(--th-text-muted)" }}>
            {t({ ko: "상태 변경", en: "Change Status" })}
          </div>
          <select
            value={task.status}
            onChange={(e) => onUpdateTask(task.id, { status: e.target.value as Task["status"] })}
            className="w-full rounded-md px-2 py-1.5 text-xs bg-transparent outline-none"
            style={{ border: "1px solid var(--th-border)", color: "var(--th-text-primary)" }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{taskStatusLabel(s, t)}</option>
            ))}
          </select>
        </div>

        {/* Subtasks */}
        {taskSubtasks.length > 0 && (
          <div>
            <button
              onClick={() => setShowSubtasks(!showSubtasks)}
              className="flex items-center gap-1 text-[11px] font-medium mb-1"
              style={{ color: "var(--th-text-muted)" }}
            >
              {showSubtasks ? <ChevronUp width={12} height={12} /> : <ChevronDown width={12} height={12} />}
              {t({ ko: "서브태스크", en: "Subtasks" })} ({doneCount}/{taskSubtasks.length})
            </button>
            {showSubtasks && (
              <div className="space-y-1 ml-1">
                {/* Progress bar */}
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--th-border)" }}>
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{ width: `${taskSubtasks.length > 0 ? (doneCount / taskSubtasks.length) * 100 : 0}%` }}
                  />
                </div>
                {taskSubtasks.map((st) => (
                  <div key={st.id} className="flex items-center gap-1.5 text-xs py-0.5">
                    {SUBTASK_ICON[st.status] ?? SUBTASK_ICON.pending}
                    <span
                      className={st.status === "done" ? "line-through" : ""}
                      style={{ color: "var(--th-text-secondary)" }}
                    >
                      {st.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Timeline */}
        <div>
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            className="flex items-center gap-1 text-[11px] font-medium mb-1"
            style={{ color: "var(--th-text-muted)" }}
          >
            {showTimeline ? <ChevronUp width={12} height={12} /> : <ChevronDown width={12} height={12} />}
            {t({ ko: "타임라인", en: "Timeline" })}
          </button>
          {showTimeline && <DirectiveTimeline taskId={task.id} />}
        </div>
      </div>

      {/* Actions */}
      <div
        className="flex flex-wrap items-center gap-2 px-4 py-3"
        style={{ borderTop: "1px solid var(--th-border)" }}
      >
        {canRun && (
          <button
            onClick={() => onRunTask(task.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            <Play width={12} height={12} />
            {t({ ko: "실행", en: "Run" })}
          </button>
        )}
        {canStop && (
          <button
            onClick={() => onStopTask(task.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            <Square width={12} height={12} />
            {t({ ko: "중단", en: "Stop" })}
          </button>
        )}
        {canPause && (
          <button
            onClick={() => onPauseTask(task.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-md"
            style={{ border: "1px solid var(--th-border)", color: "var(--th-text-secondary)" }}
          >
            <Pause width={12} height={12} />
            {t({ ko: "일시정지", en: "Pause" })}
          </button>
        )}
        {canResume && (
          <button
            onClick={() => onResumeTask(task.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <RotateCcw width={12} height={12} />
            {t({ ko: "재개", en: "Resume" })}
          </button>
        )}
        <button
          onClick={() => onOpenTerminal(task.id)}
          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-md"
          style={{ border: "1px solid var(--th-border)", color: "var(--th-text-secondary)" }}
        >
          <Terminal width={12} height={12} />
          {t({ ko: "터미널", en: "Terminal" })}
        </button>
        <button
          onClick={() => onOpenMeetingMinutes(task.id)}
          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-md"
          style={{ border: "1px solid var(--th-border)", color: "var(--th-text-secondary)" }}
        >
          <FileText width={12} height={12} />
          {t({ ko: "회의록", en: "Minutes" })}
        </button>
        <button
          onClick={() => onClone(task.id)}
          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-md"
          style={{ border: "1px solid var(--th-border)", color: "var(--th-text-secondary)" }}
        >
          <Copy width={12} height={12} />
          {t({ ko: "복제", en: "Clone" })}
        </button>
        <button
          onClick={handleDeleteClick}
          className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-md ${
            deleteConfirm ? "bg-red-600 text-white hover:bg-red-700" : ""
          }`}
          style={
            deleteConfirm
              ? undefined
              : { border: "1px solid var(--th-border)", color: "var(--th-text-secondary)" }
          }
          title={deleteConfirm ? t({ ko: "다시 클릭하면 삭제됩니다", en: "Click again to delete" }) : undefined}
        >
          <Trash2 width={12} height={12} />
          {deleteConfirm ? t({ ko: "삭제 확인", en: "Confirm delete" }) : t({ ko: "삭제", en: "Delete" })}
        </button>
        {task.status === "done" && onViewDeliverable && (
          <button
            onClick={() => onViewDeliverable(task.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
          >
            <FolderCheck width={12} height={12} />
            {t({ ko: "결과물 보기", en: "Deliverable" })}
          </button>
        )}
      </div>
    </div>
  );
}
