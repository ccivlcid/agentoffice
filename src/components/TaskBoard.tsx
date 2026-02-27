import { useState, useMemo, useCallback } from 'react';
import { DndContext, DragOverlay, useDroppable, PointerSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent } from '@dnd-kit/core';
import type { Task, Agent, Department, SubTask, TaskStatus } from '../types';
import ProjectManagerModal from './ProjectManagerModal';
import { bulkHideTasks } from '../api';
import {
  useI18n,
  isHideableStatus,
  taskStatusLabel,
  taskTypeLabel,
  COLUMNS,
  POSTIT_COLORS,
  stickyRotation,
  priorityColor,
  TASK_TYPE_OPTIONS,
  type HideableStatus,
  type ColumnDef,
} from './task-board/taskBoardHelpers';
import { useTheme } from '../ThemeContext';
import { CreateModal } from './task-board/CreateModal';
import { TaskCard } from './task-board/TaskCard';
import { BulkHideModal } from './task-board/BulkHideModal';
import { EyeOff, FolderKanban, Plus, Search, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { STATUS_ICONS } from '../constants/icons';

/* ── Droppable Column body ── */
function DroppableColumn({ status, accent, folded, children }: { status: string; accent: string; folded: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`,
    data: { status },
    disabled: folded,
  });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-2.5 overflow-hidden transition-all duration-300 sm:flex-1 ${
        folded ? 'max-h-0 p-0 opacity-0 sm:min-h-0' : 'p-2.5 sm:overflow-y-auto opacity-100'
      } ${isOver && !folded ? 'taskboard-column--drag-over' : ''}`}
      style={isOver && !folded ? { '--column-accent': accent } as React.CSSProperties : undefined}
    >
      {children}
    </div>
  );
}

const COLUMN_FOLD_STORAGE_KEY = 'climpire.taskboard.columnsFolded';
const EXPANDED_TASKS_STORAGE_KEY = 'climpire.taskboard.expandedTasks';

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

/* ── Column header with accent bar ── */
function ColumnHeader({ col, count, folded, isDark, onToggle, t }: {
  col: ColumnDef; count: number; folded: boolean; isDark: boolean;
  onToggle: () => void; t: (m: Record<string, string>) => string;
}) {
  const Icon = STATUS_ICONS[col.status as keyof typeof STATUS_ICONS];
  const gradient = isDark
    ? `linear-gradient(135deg, ${col.gradientFrom}, ${col.gradientTo})`
    : `linear-gradient(135deg, ${col.gradientFromLight}, ${col.gradientToLight})`;
  const accent = isDark ? col.accent : col.accentLight;

  if (folded) {
    return (
      <>
        <div className="taskboard-column-accent" style={{ background: gradient }} />
        <button
          type="button"
          onClick={onToggle}
          className="taskboard-column-header taskboard-column-header--folded flex flex-col items-center border-b-0"
          title={`${taskStatusLabel(col.status, t)} · ${t({ ko: '펼치기', en: 'Expand' })}`}
        >
          {/* Count badge at top */}
          <span
            className="taskboard-column-count mb-2"
            style={{ backgroundColor: accent + '20', color: accent }}
          >
            {count}
          </span>

          {/* Vertical status label */}
          <div className="flex flex-col items-center gap-1.5 flex-1 min-h-0">
            {Icon && <Icon width={14} height={14} style={{ color: accent }} className="flex-shrink-0" />}
            <span
              className="taskboard-column-vlabel"
              style={{ color: accent }}
            >
              {taskStatusLabel(col.status, t)}
            </span>
          </div>

          {/* Expand hint */}
          <ChevronRight width={12} height={12} className="mt-2 flex-shrink-0 taskboard-column-expand-hint" style={{ color: 'var(--th-text-muted)' }} />
        </button>
      </>
    );
  }

  return (
    <>
      <div className="taskboard-column-accent" style={{ background: gradient }} />
      <button
        type="button"
        onClick={onToggle}
        className="taskboard-column-header flex w-full items-center justify-between"
        title={t({ ko: '접기', en: 'Collapse' })}
      >
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon width={15} height={15} style={{ color: accent }} className="flex-shrink-0" />}
          <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--th-text-heading)' }}>
            {taskStatusLabel(col.status, t)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className="taskboard-column-count"
            style={{ backgroundColor: accent + '20', color: accent }}
          >
            {count}
          </span>
          <ChevronLeft width={12} height={12} style={{ color: 'var(--th-text-muted)' }} />
        </div>
      </button>
    </>
  );
}

export function TaskBoard({
  tasks, agents, departments, subtasks, onCreateTask, onUpdateTask, onDeleteTask,
  onAssignTask, onRunTask, onStopTask, onPauseTask, onResumeTask,
  onOpenTerminal, onOpenMeetingMinutes, onMergeTask, onDiscardTask,
}: TaskBoardProps) {
  const { t, locale } = useI18n();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const [showCreate, setShowCreate] = useState(false);
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [showBulkHideModal, setShowBulkHideModal] = useState(false);
  const [dragActiveTask, setDragActiveTask] = useState<Task | null>(null);
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
    } catch { /* ignore */ }
    return {};
  });

  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(EXPANDED_TASKS_STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr as string[]);
      }
    } catch { /* ignore */ }
    return new Set();
  });

  const toggleTaskExpand = useCallback((taskId: string) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      try { localStorage.setItem(EXPANDED_TASKS_STORAGE_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const toggleColumnFold = useCallback((status: string) => {
    setColumnFolded((prev) => {
      const next = { ...prev, [status]: !prev[status] };
      try { localStorage.setItem(COLUMN_FOLD_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
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

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const taskId = event.active.id as string;
    const found = tasks.find((t) => t.id === taskId);
    setDragActiveTask(found ?? null);
  }, [tasks]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setDragActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as string;
    const currentStatus = active.data.current?.currentStatus as TaskStatus | undefined;
    const targetStatus = over.data.current?.status as TaskStatus | undefined;
    if (!targetStatus || currentStatus === targetStatus) return;
    onUpdateTask(taskId, { status: targetStatus });
  }, [onUpdateTask]);

  const handleDragCancel = useCallback(() => setDragActiveTask(null), []);

  const activeFilterCount = [filterDept, filterType, search].filter(Boolean).length;
  const hiddenTaskCount = useMemo(() => {
    let count = 0;
    for (const task of tasks) {
      if (isHideableStatus(task.status) && hiddenTaskIds.has(task.id)) count++;
    }
    return count;
  }, [tasks, hiddenTaskIds]);

  return (
    <div className="taskboard-shell flex h-full flex-col gap-3 p-3 sm:p-4">
      {/* ── Toolbar Row 1: Title + Search + Filters ── */}
      <div className="taskboard-toolbar">
        <h1 className="text-lg font-bold mr-2" style={{ color: 'var(--th-text-heading)', fontFamily: 'var(--th-font-display)' }}>
          {t({ ko: '업무 보드', en: 'Task Board' })}
        </h1>
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-medium mr-3"
          style={{ backgroundColor: 'var(--th-glass-bg)', color: 'var(--th-text-muted)', border: '1px solid var(--th-card-border)' }}
        >
          {filteredTasks.length}{t({ ko: '개', en: '' })}
        </span>

        {/* Search */}
        <div className="taskboard-toolbar-search relative flex items-center min-w-[140px] flex-1 sm:min-w-[180px] sm:max-w-[260px]">
          <Search className="absolute left-2.5 pointer-events-none" width={14} height={14} style={{ color: 'var(--th-text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t({ ko: '업무 검색...', en: 'Search tasks...' })}
            className="w-full bg-transparent py-1.5 pl-8 pr-3 text-[13px] outline-none placeholder:opacity-50"
            style={{ color: 'var(--th-text-primary)' }}
          />
        </div>

        {/* Department filter */}
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="taskboard-toolbar-select"
        >
          <option value="">{t({ ko: '전체 부서', en: 'All Depts' })}</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {locale === 'ko' ? d.name_ko : d.name}
            </option>
          ))}
        </select>

        {/* Type filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="taskboard-toolbar-select"
        >
          <option value="">{t({ ko: '전체 유형', en: 'All Types' })}</option>
          {TASK_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {taskTypeLabel(opt.value, t)}
            </option>
          ))}
        </select>

        {activeFilterCount > 0 && (
          <button
            onClick={() => { setFilterDept(''); setFilterType(''); setSearch(''); }}
            className="taskboard-toolbar-btn text-[11px]"
            style={{ borderColor: 'var(--th-focus-ring)', color: 'var(--th-focus-ring)' }}
          >
            {t({ ko: '초기화', en: 'Reset' })}
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1 hidden sm:block" />

        {/* Action buttons */}
        <button
          onClick={() => setShowAllTasks((prev) => !prev)}
          className={`taskboard-toolbar-btn ${showAllTasks ? 'font-semibold' : ''}`}
          style={showAllTasks ? { borderColor: 'var(--th-focus-ring)', color: 'var(--th-focus-ring)' } : undefined}
          title={showAllTasks ? t({ ko: '진행중 보기', en: 'Active view' }) : t({ ko: '모두 보기', en: 'All view' })}
        >
          {showAllTasks ? t({ ko: '모두', en: 'All' }) : t({ ko: '진행중', en: 'Active' })}
          <span
            className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: 'var(--th-glass-bg)' }}
          >
            {hiddenTaskCount}
          </span>
        </button>

        <button onClick={() => setShowBulkHideModal(true)} className="taskboard-toolbar-btn"
          title={t({ ko: '완료/보류/취소 업무 숨김', en: 'Hide done/pending/cancelled' })}>
          <EyeOff width={13} height={13} /> {t({ ko: '숨김', en: 'Hide' })}
        </button>

        <button onClick={() => setShowProjectManager(true)} className="taskboard-project-manage-btn taskboard-toolbar-btn font-semibold">
          <FolderKanban width={13} height={13} /> {t({ ko: '프로젝트', en: 'Projects' })}
        </button>

        <button
          onClick={() => setShowCreate(true)}
          className="taskboard-toolbar-btn font-semibold"
          style={{ backgroundColor: '#2563eb', borderColor: '#2563eb', color: '#fff' }}
        >
          <Plus width={14} height={14} /> {t({ ko: '새 업무', en: 'New Task' })}
        </button>
      </div>

      {/* ── Kanban Board ── */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-2 sm:flex-row sm:gap-3 sm:overflow-x-auto sm:overflow-y-hidden">
          {COLUMNS.map((col) => {
            const colTasks = tasksByStatus[col.status] ?? [];
            const folded = !!columnFolded[col.status];
            const accent = isDark ? col.accent : col.accentLight;

            return (
              <div
                key={col.status}
                className={`taskboard-column flex w-full flex-col transition-all duration-300 sm:flex-shrink-0 ${
                  folded ? 'sm:w-11 sm:min-w-[2.75rem]' : 'sm:w-72'
                }`}
              >
                <ColumnHeader
                  col={col}
                  count={colTasks.length}
                  folded={folded}
                  isDark={isDark}
                  onToggle={() => toggleColumnFold(col.status)}
                  t={t}
                />
                <DroppableColumn status={col.status} accent={accent} folded={folded}>
                  {colTasks.length === 0 ? (
                    <div className="flex min-h-20 flex-col items-center justify-center gap-1.5 py-6 sm:flex-1">
                      <Inbox width={20} height={20} style={{ color: 'var(--th-text-muted)', opacity: 0.4 }} />
                      <span className="text-xs" style={{ color: 'var(--th-text-muted)', opacity: 0.6 }}>
                        {t({ ko: '업무 없음', en: 'No tasks' })}
                      </span>
                    </div>
                  ) : (
                    colTasks.map((task) => (
                      <TaskCard key={task.id} task={task} agents={agents} departments={departments}
                        taskSubtasks={subtasksByTask[task.id] ?? []} isHiddenTask={hiddenTaskIds.has(task.id)}
                        expanded={expandedTaskIds.has(task.id)} onToggleExpand={toggleTaskExpand}
                        onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} onAssignTask={onAssignTask}
                        onRunTask={onRunTask} onStopTask={onStopTask} onPauseTask={onPauseTask}
                        onResumeTask={onResumeTask} onOpenTerminal={onOpenTerminal}
                        onOpenMeetingMinutes={onOpenMeetingMinutes}
                        onMergeTask={onMergeTask} onDiscardTask={onDiscardTask}
                        onHideTask={hideTask} onUnhideTask={unhideTask}
                      />
                    ))
                  )}
                </DroppableColumn>
              </div>
            );
          })}
        </div>

        {/* Drag overlay */}
        <DragOverlay dropAnimation={null}>
          {dragActiveTask && (() => {
            const colors = POSTIT_COLORS[dragActiveTask.task_type] ?? POSTIT_COLORS.general;
            const rotation = stickyRotation(dragActiveTask.id);
            return (
              <div
                className="postit-card postit-card--collapsed postit-card-overlay"
                style={{
                  backgroundColor: isDark ? colors.dark : colors.light,
                  transform: `rotate(${rotation}deg) scale(1.05)`,
                  width: '17rem',
                  '--postit-fold-color': isDark ? colors.foldDark : colors.foldLight,
                  '--postit-fold-bg': 'var(--th-panel-bg)',
                } as React.CSSProperties}
              >
                <div className="postit-tape" style={{ backgroundColor: isDark ? colors.tapeDark : colors.tapeLight }} />
                <div className="flex items-start justify-between gap-2">
                  <span className="flex-1 min-w-0 text-sm font-semibold leading-snug postit-title truncate">{dragActiveTask.title}</span>
                  <span className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${priorityColor(dragActiveTask.priority)}`} />
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-[11px] postit-text-muted">
                  <span>{taskStatusLabel(dragActiveTask.status, t)}</span>
                </div>
                <div className="postit-fold" />
              </div>
            );
          })()}
        </DragOverlay>
      </DndContext>

      {/* Modals */}
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
