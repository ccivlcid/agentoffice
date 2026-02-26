import { useState, useMemo, useCallback } from 'react';
import type { Task, Agent, Department, SubTask } from '../types';
import ProjectManagerModal from './ProjectManagerModal';
import { bulkHideTasks } from '../api';
import {
  useI18n,
  isHideableStatus,
  taskStatusLabel,
  COLUMNS,
  type HideableStatus,
} from './task-board/taskBoardHelpers';
import { CreateModal } from './task-board/CreateModal';
import { TaskCard } from './task-board/TaskCard';
import { FilterBar } from './task-board/FilterBar';
import { BulkHideModal } from './task-board/BulkHideModal';
import { EyeOff, FolderKanban, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { STATUS_ICONS } from '../constants/icons';

const COLUMN_FOLD_STORAGE_KEY = 'climpire.taskboard.columnsFolded';

interface TaskBoardProps {
  tasks: Task[];
  agents: Agent[];
  departments: Department[];
  subtasks: SubTask[];
  onCreateTask: (input: {
    title: string;
    description?: string;
    department_id?: string;
    task_type?: string;
    priority?: number;
    project_id?: string;
    project_path?: string;
    assigned_agent_id?: string;
  }) => void;
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
}

export function TaskBoard({
  tasks, agents, departments, subtasks, onCreateTask, onUpdateTask, onDeleteTask,
  onAssignTask, onRunTask, onStopTask, onPauseTask, onResumeTask,
  onOpenTerminal, onOpenMeetingMinutes, onMergeTask, onDiscardTask,
}: TaskBoardProps) {
  const { t } = useI18n();
  const [showCreate, setShowCreate] = useState(false);
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [showBulkHideModal, setShowBulkHideModal] = useState(false);
  const [filterDept, setFilterDept] = useState('');
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [columnFolded, setColumnFolded] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(COLUMN_FOLD_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // ignore
    }
    return {};
  });

  const toggleColumnFold = useCallback((status: string) => {
    setColumnFolded((prev) => {
      const next = { ...prev, [status]: !prev[status] };
      try {
        localStorage.setItem(COLUMN_FOLD_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const hiddenTaskIds = useMemo(
    () => new Set(tasks.filter((t) => t.hidden === 1).map((t) => t.id)),
    [tasks],
  );

  const hideTask = useCallback((taskId: string) => { onUpdateTask(taskId, { hidden: 1 }); }, [onUpdateTask]);
  const unhideTask = useCallback((taskId: string) => { onUpdateTask(taskId, { hidden: 0 }); }, [onUpdateTask]);
  const hideByStatuses = useCallback((statuses: HideableStatus[]) => { if (statuses.length === 0) return; bulkHideTasks(statuses, 1); }, []);

  const filteredTasks = useMemo(() => tasks.filter((t) => {
    if (filterDept && t.department_id !== filterDept) return false;
    if (filterType && t.task_type !== filterType) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (!showAllTasks && hiddenTaskIds.has(t.id)) return false;
    return true;
  }), [tasks, filterDept, filterType, search, hiddenTaskIds, showAllTasks]);

  const tasksByStatus = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const col of COLUMNS) {
      map[col.status] = filteredTasks
        .filter((t) => t.status === col.status)
        .sort((a, b) => b.priority - a.priority || b.created_at - a.created_at);
    }
    return map;
  }, [filteredTasks]);

  const subtasksByTask = useMemo(() => {
    const map: Record<string, SubTask[]> = {};
    for (const st of subtasks) {
      if (!map[st.task_id]) map[st.task_id] = [];
      map[st.task_id].push(st);
    }
    return map;
  }, [subtasks]);

  const activeFilterCount = [filterDept, filterType, search].filter(Boolean).length;
  const hiddenTaskCount = useMemo(() => {
    let count = 0;
    for (const task of tasks) {
      if (isHideableStatus(task.status) && hiddenTaskIds.has(task.id)) count++;
    }
    return count;
  }, [tasks, hiddenTaskIds]);

  return (
    <div className="taskboard-shell flex h-full flex-col gap-4 bg-slate-950 p-3 sm:p-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-white">{t({ ko: '업무 보드', en: 'Task Board' })}</h1>
        <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
          {t({ ko: '총', en: 'Total' })} {filteredTasks.length}
          {t({ ko: '개', en: '' })}
          {activeFilterCount > 0 && ` (${t({ ko: '필터', en: 'filters' })} ${activeFilterCount}${t({ ko: '개 적용', en: ' applied' })})`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button onClick={() => { setFilterDept(''); setFilterType(''); setSearch(''); }}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-white">
              {t({ ko: '필터 초기화', en: 'Reset Filters' })}
            </button>
          )}
          <button onClick={() => setShowAllTasks((prev) => !prev)}
            className={`rounded-lg border px-3 py-1.5 text-xs transition ${showAllTasks ? 'border-cyan-600 bg-cyan-900/40 text-cyan-100 hover:bg-cyan-900/60' : 'border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'}`}
            title={showAllTasks ? t({ ko: '진행중 보기로 전환 (숨김 제외)', en: 'Switch to active view (exclude hidden)' }) : t({ ko: '모두보기로 전환 (숨김 포함)', en: 'Switch to all view (include hidden)' })}>
            <span className={showAllTasks ? 'text-slate-400' : 'text-emerald-200'}>{t({ ko: '진행중', en: 'Active' })}</span>
            <span className="mx-1 text-slate-500">/</span>
            <span className={showAllTasks ? 'text-cyan-100' : 'text-slate-500'}>{t({ ko: '모두보기', en: 'All' })}</span>
            <span className="ml-1 rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">{hiddenTaskCount}</span>
          </button>
          <button onClick={() => setShowBulkHideModal(true)}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800 hover:text-white"
            title={t({ ko: '완료/보류/취소 상태 업무 숨기기', en: 'Hide done/pending/cancelled tasks' })}>
            <EyeOff width={14} height={14} /> {t({ ko: '숨김', en: 'Hide' })}
          </button>
          <button onClick={() => setShowProjectManager(true)}
            className="taskboard-project-manage-btn rounded-lg border px-3 py-1.5 text-xs font-semibold transition">
            <FolderKanban width={14} height={14} className="inline -mt-0.5 mr-1" /> {t({ ko: '프로젝트 관리', en: 'Project Manager' })}
          </button>
          <button onClick={() => setShowCreate(true)}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white shadow transition hover:bg-blue-500 active:scale-95">
            <Plus width={14} height={14} className="inline -mt-0.5 mr-0.5" /> {t({ ko: '새 업무', en: 'New Task' })}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar departments={departments} filterDept={filterDept}
        filterType={filterType} search={search} onFilterDept={setFilterDept}
        onFilterType={setFilterType} onSearch={setSearch} />

      {/* Kanban board — 스티커 메모처럼 컬럼 접기/펼치기 */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-2 sm:flex-row sm:overflow-x-auto sm:overflow-y-hidden">
        {COLUMNS.map((col) => {
          const colTasks = tasksByStatus[col.status] ?? [];
          const folded = columnFolded[col.status];
          return (
            <div
              key={col.status}
              className={`taskboard-column flex w-full flex-col rounded-xl border shadow-md transition-all duration-300 sm:flex-shrink-0 ${col.borderColor} bg-slate-900 ${
                folded ? 'sm:w-14 sm:min-w-[3.5rem]' : 'sm:w-72'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleColumnFold(col.status)}
                className={`flex w-full items-center justify-between rounded-t-xl ${col.headerBg} px-3.5 py-2.5 text-left transition hover:opacity-90 ${
                  folded ? 'flex-col gap-1.5 py-3 sm:flex-col sm:px-2' : ''
                }`}
                title={folded ? `${taskStatusLabel(col.status, t)} · ${t({ ko: '펼치기', en: 'Expand' })}` : t({ ko: '접기', en: 'Collapse' })}
              >
                <div className={`flex items-center gap-2 ${folded ? 'flex-col' : ''}`}>
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${col.dotColor}`} />
                  <span className="text-sm font-semibold text-white inline-flex items-center gap-1.5">
                    {(() => { const I = STATUS_ICONS[col.status as keyof typeof STATUS_ICONS]; return I ? <I width={14} height={14} className="flex-shrink-0" /> : null; })()}
                    {folded ? null : taskStatusLabel(col.status, t)}
                  </span>
                </div>
                <span className="rounded-full bg-black/30 px-2 py-0.5 text-xs font-bold text-white/80 flex items-center gap-1">
                  {folded ? <ChevronUp width={12} height={12} className="sm:rotate-90" aria-hidden /> : <ChevronDown width={12} height={12} aria-hidden />}
                  {colTasks.length}
                </span>
              </button>
              <div
                className={`flex flex-col gap-2.5 overflow-hidden transition-all duration-300 sm:flex-1 ${
                  folded ? 'max-h-0 p-0 opacity-0 sm:min-h-0' : 'p-2.5 sm:overflow-y-auto opacity-100'
                }`}
              >
                {colTasks.length === 0 ? (
                  <div className="flex min-h-24 items-center justify-center py-8 text-xs text-slate-600 sm:flex-1">
                    {t({ ko: '업무 없음', en: 'No tasks' })}
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <TaskCard key={task.id} task={task} agents={agents} departments={departments}
                      taskSubtasks={subtasksByTask[task.id] ?? []} isHiddenTask={hiddenTaskIds.has(task.id)}
                      onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} onAssignTask={onAssignTask}
                      onRunTask={onRunTask} onStopTask={onStopTask} onPauseTask={onPauseTask}
                      onResumeTask={onResumeTask} onOpenTerminal={onOpenTerminal}
                      onOpenMeetingMinutes={onOpenMeetingMinutes}
                      onMergeTask={onMergeTask} onDiscardTask={onDiscardTask}
                      onHideTask={hideTask} onUnhideTask={unhideTask}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showCreate && (
        <CreateModal agents={agents} departments={departments} onClose={() => setShowCreate(false)}
          onCreate={onCreateTask} onAssign={onAssignTask} />
      )}
      {showProjectManager && (
        <ProjectManagerModal agents={agents} onClose={() => setShowProjectManager(false)} />
      )}
      {showBulkHideModal && (
        <BulkHideModal tasks={tasks} hiddenTaskIds={hiddenTaskIds} onClose={() => setShowBulkHideModal(false)}
          onApply={(statuses) => { hideByStatuses(statuses); setShowBulkHideModal(false); }} />
      )}
    </div>
  );
}

export default TaskBoard;
