import { useState, useMemo } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { Task, Agent, Department, TaskStatus, SubTask } from "../../types";
import AgentAvatar from "../AgentAvatar";
import AgentSelect from "../AgentSelect";
import { useTheme } from "../../ThemeContext";
import { DiffModal } from "./DiffModal";
import { ExecutionModeDialog } from "./ExecutionModeDialog";
import { TaskCardActions } from "./TaskCardActions";
import {
  useI18n,
  isHideableStatus,
  getTaskTypeBadge,
  priorityColor,
  priorityLabel,
  taskStatusLabel,
  timeAgo,
  STATUS_OPTIONS,
  POSTIT_COLORS,
  stickyRotation,
} from "./taskBoardHelpers";
import type { TFunction } from "./taskBoardHelpers";
import { EyeOff, Link, Clock, Ban, Hammer, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

export interface TaskCardProps {
  task: Task;
  agents: Agent[];
  departments: Department[];
  taskSubtasks: SubTask[];
  isHiddenTask?: boolean;
  onUpdateTask: (id: string, data: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onAssignTask: (taskId: string, agentId: string) => void;
  onRunTask: (id: string, executionMode?: string) => void;
  onStopTask: (id: string) => void;
  onPauseTask?: (id: string) => void;
  onResumeTask?: (id: string) => void;
  onOpenTerminal?: (taskId: string) => void;
  onOpenMeetingMinutes?: (taskId: string) => void;
  onMergeTask?: (id: string) => void;
  onDiscardTask?: (id: string) => void;
  onHideTask?: (id: string) => void;
  onUnhideTask?: (id: string) => void;
  expanded?: boolean;
  onToggleExpand?: (id: string) => void;
}

const SUBTASK_ICON: Record<string, React.ReactNode> = {
  pending: <Clock width={12} height={12} className="text-slate-400" />,
  in_progress: <Hammer width={12} height={12} className="text-amber-400" />,
  done: <CheckCircle2 width={12} height={12} className="text-green-400" />,
  blocked: <Ban width={12} height={12} className="text-red-400" />,
};

function SubtaskList({ items, departments, t }: { items: SubTask[]; departments: Department[]; t: TFunction }) {
  return (
    <div className="space-y-1 pl-1">
      {items.map((st) => {
        const dept = st.target_department_id ? departments.find((d) => d.id === st.target_department_id) : null;
        return (
          <div key={st.id} className="flex items-center gap-1.5 text-xs">
            <span className="flex items-center">{SUBTASK_ICON[st.status] ?? SUBTASK_ICON.pending}</span>
            <span className={`flex-1 truncate ${st.status === "done" ? "line-through postit-text-muted" : "postit-text"}`}>{st.title}</span>
            {dept && (
              <span className="shrink-0 rounded px-1 py-0.5 text-[10px] font-medium" style={{ backgroundColor: dept.color + "30", color: dept.color }}>
                {dept.name_ko}
              </span>
            )}
            {st.delegated_task_id && st.status !== "done" && (
              <span className="text-blue-400 shrink-0 flex items-center" title={t({ ko: "위임됨", en: "Delegated" })}>
                <Link width={12} height={12} />
              </span>
            )}
            {st.status === "blocked" && st.blocked_reason && (
              <span className="text-red-400 text-[10px] truncate max-w-[80px]" title={st.blocked_reason}>
                {st.blocked_reason}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function TaskCard({
  task,
  agents,
  departments,
  taskSubtasks,
  isHiddenTask,
  onUpdateTask,
  onDeleteTask,
  onAssignTask,
  onRunTask,
  onStopTask,
  onPauseTask,
  onResumeTask,
  onOpenTerminal,
  onOpenMeetingMinutes,
  onHideTask,
  onUnhideTask,
  expanded: expandedProp,
  onToggleExpand,
}: TaskCardProps) {
  const { t, localeTag, locale } = useI18n();
  const { theme } = useTheme();
  const [expandedLocal, setExpandedLocal] = useState(false);
  const expanded = expandedProp ?? expandedLocal;
  const toggleExpand = () => {
    if (onToggleExpand) onToggleExpand(task.id);
    else setExpandedLocal((v) => !v);
  };
  const [showDiff, setShowDiff] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [agentWarning, setAgentWarning] = useState(false);
  const [showExecMode, setShowExecMode] = useState(false);

  const assignedAgent = task.assigned_agent ?? agents.find((a) => a.id === task.assigned_agent_id);
  const department = departments.find((d) => d.id === task.department_id);
  const typeBadge = getTaskTypeBadge(task.task_type, t);

  const canRun = task.status === "planned" || task.status === "inbox";
  const canStop = task.status === "in_progress";
  const canPause = task.status === "in_progress" && !!onPauseTask;
  const canResume = (task.status === "pending" || task.status === "cancelled") && !!onResumeTask;
  const canDelete = task.status !== "in_progress";
  const canHideTask = isHideableStatus(task.status);

  const isDark = theme === "dark";
  const colors = POSTIT_COLORS[task.task_type] ?? POSTIT_COLORS.general;
  const rotation = useMemo(() => stickyRotation(task.id), [task.id]);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { taskId: task.id, currentStatus: task.status },
  });

  const cardStyle: React.CSSProperties = {
    backgroundColor: isDark ? colors.dark : colors.light,
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0) rotate(${rotation}deg)`
      : `rotate(${rotation}deg)`,
    "--postit-fold-color": isDark ? colors.foldDark : colors.foldLight,
    "--postit-fold-bg": "var(--th-panel-bg)",
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      className={`postit-card group relative cursor-grab active:cursor-grabbing ${isDragging ? "postit-card--dragging" : ""} ${isHiddenTask ? "opacity-70" : ""} ${expanded ? "" : "postit-card--collapsed"}`}
      style={cardStyle}
      {...listeners}
      {...attributes}
    >
      {/* Tape */}
      <div className="postit-tape" style={{ backgroundColor: isDark ? colors.tapeDark : colors.tapeLight }} />

      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={toggleExpand}
          className="flex-1 min-w-0 text-left text-sm font-semibold leading-snug postit-title flex items-center gap-1.5"
          title={expanded ? t({ ko: "접기", en: "Collapse" }) : t({ ko: "펼치기", en: "Expand" })}
        >
          <span className="truncate">{task.title}</span>
          <span className="flex-shrink-0 postit-text-muted">
            {expanded ? <ChevronUp width={14} height={14} /> : <ChevronDown width={14} height={14} />}
          </span>
        </button>
        <span
          className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${priorityColor(task.priority)}`}
          title={`${t({ ko: "우선순위", en: "Priority" })}: ${priorityLabel(task.priority, t)}`}
        />
      </div>

      {/* Collapsed: compact agent + status summary */}
      {!expanded && (
        <div className="mt-1.5 flex items-center gap-2 text-[11px] postit-text-muted">
          {assignedAgent ? (
            <span className="flex items-center gap-1">
              <AgentAvatar agent={assignedAgent} agents={agents} size={14} />
              <span className="truncate max-w-[80px]">{locale === "ko" ? assignedAgent.name_ko : assignedAgent.name}</span>
            </span>
          ) : (
            <span>{t({ ko: "미배정", en: "Unassigned" })}</span>
          )}
          <span className="postit-text-muted">&middot;</span>
          <span>{taskStatusLabel(task.status, t)}</span>
        </div>
      )}

      {expanded && (
        <>
          {task.description && <p className="mb-2 text-xs leading-relaxed postit-text-muted">{task.description}</p>}

          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeBadge.color}`}>{typeBadge.label}</span>
            {isHiddenTask && (
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-900/60 px-2 py-0.5 text-xs text-cyan-200">
                <EyeOff width={12} height={12} /> {t({ ko: "숨김", en: "Hidden" })}
              </span>
            )}
            {department && (
              <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs postit-text">{locale === "ko" ? department.name_ko : department.name}</span>
            )}
          </div>

          <div className="mb-3">
            <select
              value={task.status}
              onChange={(e) => onUpdateTask(task.id, { status: e.target.value as TaskStatus })}
              className="postit-input w-full rounded-lg px-2 py-1 text-xs postit-text outline-none transition focus:ring-1 focus:ring-blue-500"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {taskStatusLabel(status, t)}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {assignedAgent ? (
                <>
                  <AgentAvatar agent={assignedAgent} agents={agents} size={20} />
                  <span className="text-xs postit-text">{locale === "ko" ? assignedAgent.name_ko : assignedAgent.name}</span>
                </>
              ) : (
                <span className="text-xs postit-text-muted">{t({ ko: "미배정", en: "Unassigned" })}</span>
              )}
            </div>
            <span className="text-xs postit-text-muted">{timeAgo(task.created_at, localeTag)}</span>
          </div>

          <div className={`mb-3 rounded-lg transition-all ${agentWarning ? "ring-2 ring-red-500 animate-[shake_0.4s_ease-in-out]" : ""}`}>
            <AgentSelect
              agents={agents}
              departments={departments}
              value={task.assigned_agent_id ?? ""}
              onChange={(agentId) => {
                setAgentWarning(false);
                if (agentId) onAssignTask(task.id, agentId);
                else onUpdateTask(task.id, { assigned_agent_id: null });
              }}
            />
            {agentWarning && (
              <p className="mt-1 text-xs font-medium text-red-400 animate-[shake_0.4s_ease-in-out]">
                {t({ ko: "담당자를 배정해주세요!", en: "Please assign an agent!" })}
              </p>
            )}
          </div>

          {(task.subtask_total ?? 0) > 0 && (
            <div className="mb-3">
              <button onClick={() => setShowSubtasks((v) => !v)} className="mb-1.5 flex w-full items-center gap-2 text-left">
                <div className="flex-1 h-1.5 bg-black/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all"
                    style={{ width: `${Math.round(((task.subtask_done ?? 0) / (task.subtask_total ?? 1)) * 100)}%` }}
                  />
                </div>
                <span className="text-xs postit-text-muted whitespace-nowrap">
                  {task.subtask_done ?? 0}/{task.subtask_total ?? 0}
                </span>
                <span className="text-xs postit-text-muted">{showSubtasks ? "\u25B2" : "\u25BC"}</span>
              </button>
              {showSubtasks && taskSubtasks.length > 0 && <SubtaskList items={taskSubtasks} departments={departments} t={t} />}
            </div>
          )}

          <TaskCardActions
            task={task}
            t={t}
            isHiddenTask={isHiddenTask}
            canRun={canRun}
            canStop={canStop}
            canPause={canPause}
            canResume={canResume}
            canDelete={canDelete}
            canHideTask={canHideTask}
            onRunClick={() => {
              if (!task.assigned_agent_id) {
                setAgentWarning(true);
                setTimeout(() => setAgentWarning(false), 3000);
                return;
              }
              setShowExecMode(true);
            }}
            onStopTask={onStopTask}
            onPauseTask={onPauseTask}
            onResumeTask={onResumeTask}
            onOpenTerminal={onOpenTerminal}
            onOpenMeetingMinutes={onOpenMeetingMinutes}
            onShowDiff={() => setShowDiff(true)}
            onHideTask={onHideTask}
            onUnhideTask={onUnhideTask}
            onDeleteTask={onDeleteTask}
          />
        </>
      )}

      {/* Folded corner */}
      <div className="postit-fold" />

      {showDiff && <DiffModal taskId={task.id} onClose={() => setShowDiff(false)} />}
      {showExecMode && (
        <ExecutionModeDialog taskId={task.id} onConfirm={(mode) => { setShowExecMode(false); onRunTask(task.id, mode); }} onCancel={() => setShowExecMode(false)} />
      )}
    </div>
  );
}
