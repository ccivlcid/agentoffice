import { useState } from 'react';
import type { Task, Agent, Department, TaskStatus, SubTask } from '../../types';
import AgentAvatar from '../AgentAvatar';
import AgentSelect from '../AgentSelect';
import { DiffModal } from './DiffModal';
import { ExecutionModeDialog } from './ExecutionModeDialog';
import {
  useI18n,
  isHideableStatus,
  getTaskTypeBadge,
  priorityColor,
  priorityLabel,
  taskStatusLabel,
  timeAgo,
  STATUS_OPTIONS,
} from './taskBoardHelpers';
import type { TFunction } from './taskBoardHelpers';
import { Play, Pause, Square, RotateCcw, Monitor, FileText, EyeOff, Eye, Trash2, Link, Clock, Ban, Hammer, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

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
}

const SUBTASK_STATUS_COMPONENT: Record<string, React.ReactNode> = {
  pending: <Clock width={12} height={12} className="text-slate-400" />,
  in_progress: <Hammer width={12} height={12} className="text-amber-400" />,
  done: <CheckCircle2 width={12} height={12} className="text-green-400" />,
  blocked: <Ban width={12} height={12} className="text-red-400" />,
};

function SubtaskList({ taskSubtasks, departments, t }: {
  taskSubtasks: SubTask[];
  departments: Department[];
  t: TFunction;
}) {
  return (
    <div className="space-y-1 pl-1">
      {taskSubtasks.map((st) => {
        const targetDept = st.target_department_id
          ? departments.find(d => d.id === st.target_department_id)
          : null;
        return (
          <div key={st.id} className="flex items-center gap-1.5 text-xs">
            <span className="flex items-center">{SUBTASK_STATUS_COMPONENT[st.status] || <Clock width={12} height={12} className="text-slate-400" />}</span>
            <span className={`flex-1 truncate ${st.status === 'done' ? 'line-through text-slate-500' : 'text-slate-300'}`}>
              {st.title}
            </span>
            {targetDept && (
              <span
                className="shrink-0 rounded px-1 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: targetDept.color + '30', color: targetDept.color }}
              >
                {targetDept.name_ko}
              </span>
            )}
            {st.delegated_task_id && st.status !== 'done' && (
              <span className="text-blue-400 shrink-0 flex items-center" title={t({ ko: '위임됨', en: 'Delegated' })}>
                <Link width={12} height={12} />
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
  );
}

export function TaskCard({
  task, agents, departments, taskSubtasks, isHiddenTask,
  onUpdateTask, onDeleteTask, onAssignTask, onRunTask, onStopTask,
  onPauseTask, onResumeTask, onOpenTerminal, onOpenMeetingMinutes,
  onHideTask, onUnhideTask,
}: TaskCardProps) {
  const { t, localeTag, locale } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [agentWarning, setAgentWarning] = useState(false);
  const [showExecMode, setShowExecMode] = useState(false);

  const assignedAgent = task.assigned_agent ?? agents.find((a) => a.id === task.assigned_agent_id);
  const department = departments.find((d) => d.id === task.department_id);
  const typeBadge = getTaskTypeBadge(task.task_type, t);

  const canRun = task.status === 'planned' || task.status === 'inbox';
  const canStop = task.status === 'in_progress';
  const canPause = task.status === 'in_progress' && !!onPauseTask;
  const canResume = (task.status === 'pending' || task.status === 'cancelled') && !!onResumeTask;
  const canDelete = task.status !== 'in_progress';
  const canHideTask = isHideableStatus(task.status);

  return (
    <div className={`group rounded-xl border p-3.5 shadow-md transition-all duration-200 hover:shadow-lg ${
      isHiddenTask ? 'border-cyan-700/80 bg-slate-800/80 hover:border-cyan-600' : 'border-slate-700 bg-slate-800 hover:border-slate-600'
    } ${!expanded ? 'ring-1 ring-slate-600/50' : ''}`}>
      {/* 스티커 메모처럼 접기/펼치기: 제목 클릭 시 본문 토글 */}
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 min-w-0 text-left text-sm font-semibold leading-snug text-white flex items-center gap-1.5"
          title={expanded ? t({ ko: '접기', en: 'Collapse' }) : t({ ko: '펼치기', en: 'Expand' })}
        >
          <span className="truncate">{task.title}</span>
          <span className="flex-shrink-0 text-slate-500">{expanded ? <ChevronUp width={14} height={14} /> : <ChevronDown width={14} height={14} />}</span>
        </button>
        <span className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${priorityColor(task.priority)}`}
          title={`${t({ ko: '우선순위', en: 'Priority' })}: ${priorityLabel(task.priority, t)}`} />
      </div>

      {expanded && (
        <>
      {task.description && (
        <p className="mb-2 text-xs leading-relaxed text-slate-400">
          {task.description}
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeBadge.color}`}>{typeBadge.label}</span>
        {isHiddenTask && (
          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-900/60 px-2 py-0.5 text-xs text-cyan-200">
            <EyeOff width={12} height={12} /> {t({ ko: '숨김', en: 'Hidden' })}
          </span>
        )}
        {department && (
          <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
            {locale === 'ko' ? department.name_ko : department.name}
          </span>
        )}
      </div>

      <div className="mb-3">
        <select value={task.status}
          onChange={(e) => onUpdateTask(task.id, { status: e.target.value as TaskStatus })}
          className="w-full rounded-lg border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-white outline-none transition focus:border-blue-500">
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>{taskStatusLabel(status, t)}</option>
          ))}
        </select>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {assignedAgent ? (
            <>
              <AgentAvatar agent={assignedAgent} agents={agents} size={20} />
              <span className="text-xs text-slate-300">{locale === 'ko' ? assignedAgent.name_ko : assignedAgent.name}</span>
            </>
          ) : (
            <span className="text-xs text-slate-500">
              {t({ ko: '미배정', en: 'Unassigned' })}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-500">{timeAgo(task.created_at, localeTag)}</span>
      </div>

      <div className={`mb-3 rounded-lg transition-all ${agentWarning ? 'ring-2 ring-red-500 animate-[shake_0.4s_ease-in-out]' : ''}`}>
        <AgentSelect agents={agents} departments={departments} value={task.assigned_agent_id ?? ''}
          onChange={(agentId) => {
            setAgentWarning(false);
            if (agentId) { onAssignTask(task.id, agentId); }
            else { onUpdateTask(task.id, { assigned_agent_id: null }); }
          }}
        />
        {agentWarning && (
          <p className="mt-1 text-xs font-medium text-red-400 animate-[shake_0.4s_ease-in-out]">
            {t({ ko: '담당자를 배정해주세요!', en: 'Please assign an agent!' })}
          </p>
        )}
      </div>

      {(task.subtask_total ?? 0) > 0 && (
        <div className="mb-3">
          <button onClick={() => setShowSubtasks((v) => !v)} className="mb-1.5 flex w-full items-center gap-2 text-left">
            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all"
                style={{ width: `${Math.round(((task.subtask_done ?? 0) / (task.subtask_total ?? 1)) * 100)}%` }} />
            </div>
            <span className="text-xs text-slate-400 whitespace-nowrap">{task.subtask_done ?? 0}/{task.subtask_total ?? 0}</span>
            <span className="text-xs text-slate-500">{showSubtasks ? '▲' : '▼'}</span>
          </button>
          {showSubtasks && taskSubtasks.length > 0 && (
            <SubtaskList taskSubtasks={taskSubtasks} departments={departments} t={t} />
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {canRun && (
          <button onClick={() => {
            if (!task.assigned_agent_id) { setAgentWarning(true); setTimeout(() => setAgentWarning(false), 3000); return; }
            setShowExecMode(true);
          }}
            title={t({ ko: '작업 실행', en: 'Run task' })}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-green-700 px-2 py-1.5 text-xs font-medium text-white transition hover:bg-green-600">
            <Play width={14} height={14} /> {t({ ko: '실행', en: 'Run' })}
          </button>
        )}
        {canPause && (
          <button onClick={() => onPauseTask!(task.id)}
            title={t({ ko: '작업 일시중지', en: 'Pause task' })}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-orange-700 px-2 py-1.5 text-xs font-medium text-white transition hover:bg-orange-600">
            <Pause width={14} height={14} /> {t({ ko: '일시중지', en: 'Pause' })}
          </button>
        )}
        {canStop && (
          <button onClick={() => {
            if (confirm(t({
              ko: `"${task.title}" 작업을 중지할까요?\n\n경고: Stop 처리 시 해당 프로젝트 변경분은 롤백됩니다.`,
              en: `Stop "${task.title}"?\n\nWarning: stopping will roll back project changes.`,
            }))) { onStopTask(task.id); }
          }}
            title={t({ ko: '작업 중지', en: 'Cancel task' })}
            className="flex items-center justify-center gap-1 rounded-lg bg-red-800 px-2 py-1.5 text-xs font-medium text-white transition hover:bg-red-700">
            <Square width={14} height={14} /> {t({ ko: '중지', en: 'Cancel' })}
          </button>
        )}
        {canResume && (
          <button onClick={() => onResumeTask!(task.id)}
            title={t({ ko: '작업 재개', en: 'Resume task' })}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-700 px-2 py-1.5 text-xs font-medium text-white transition hover:bg-blue-600">
            <RotateCcw width={14} height={14} /> {t({ ko: '재개', en: 'Resume' })}
          </button>
        )}
        {(task.status === 'in_progress' || task.status === 'review' || task.status === 'done' || task.status === 'pending') && onOpenTerminal && (
          <button onClick={() => onOpenTerminal(task.id)}
            title={t({ ko: '터미널 출력 보기', en: 'View terminal output' })}
            className="flex items-center justify-center rounded-lg bg-slate-700 px-2 py-1.5 text-xs text-slate-300 transition hover:bg-slate-600 hover:text-white">
            <Monitor width={14} height={14} />
          </button>
        )}
        {(task.status === 'planned' || task.status === 'collaborating' || task.status === 'in_progress' || task.status === 'review' || task.status === 'done' || task.status === 'pending') && onOpenMeetingMinutes && (
          <button onClick={() => onOpenMeetingMinutes(task.id)}
            title={t({ ko: '회의록 보기', en: 'View meeting minutes' })}
            className="flex items-center justify-center rounded-lg bg-cyan-800/70 px-2 py-1.5 text-xs text-cyan-200 transition hover:bg-cyan-700 hover:text-white">
            <FileText width={14} height={14} />
          </button>
        )}
        {task.status === 'review' && (
          <button onClick={() => setShowDiff(true)}
            title={t({ ko: '변경사항 보기 (Git diff)', en: 'View changes (Git diff)' })}
            className="flex items-center justify-center gap-1 rounded-lg bg-purple-800 px-2 py-1.5 text-xs font-medium text-purple-200 transition hover:bg-purple-700">
            {t({ ko: 'Diff', en: 'Diff' })}
          </button>
        )}
        {canHideTask && !isHiddenTask && onHideTask && (
          <button onClick={() => onHideTask(task.id)}
            title={t({ ko: '완료/보류/취소 작업 숨기기', en: 'Hide done/pending/cancelled task' })}
            className="flex items-center justify-center gap-1 rounded-lg bg-slate-700 px-2 py-1.5 text-xs text-slate-300 transition hover:bg-slate-600 hover:text-white">
            <EyeOff width={14} height={14} /> {t({ ko: '숨김', en: 'Hide' })}
          </button>
        )}
        {canHideTask && !!isHiddenTask && onUnhideTask && (
          <button onClick={() => onUnhideTask(task.id)}
            title={t({ ko: '숨긴 작업 복원', en: 'Restore hidden task' })}
            className="flex items-center justify-center gap-1 rounded-lg bg-blue-800 px-2 py-1.5 text-xs text-blue-200 transition hover:bg-blue-700 hover:text-white">
            <Eye width={14} height={14} /> {t({ ko: '복원', en: 'Restore' })}
          </button>
        )}
        {canDelete && (
          <button onClick={() => {
            if (confirm(t({ ko: `"${task.title}" 업무를 삭제할까요?`, en: `Delete "${task.title}"?` })))
              onDeleteTask(task.id);
          }}
            title={t({ ko: '작업 삭제', en: 'Delete task' })}
            className="flex items-center justify-center rounded-lg bg-red-900/60 px-2 py-1.5 text-xs text-red-400 transition hover:bg-red-800 hover:text-red-300">
            <Trash2 width={14} height={14} />
          </button>
        )}
      </div>
        </>
      )}

      {showDiff && <DiffModal taskId={task.id} onClose={() => setShowDiff(false)} />}
      {showExecMode && (
        <ExecutionModeDialog
          taskId={task.id}
          onConfirm={(mode) => { setShowExecMode(false); onRunTask(task.id, mode); }}
          onCancel={() => setShowExecMode(false)}
        />
      )}
    </div>
  );
}
