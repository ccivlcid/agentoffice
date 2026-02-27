import { useState, useCallback, useRef, useLayoutEffect } from "react";
import type { Task, Agent, Department, SubTask } from "../../types";
import { useI18n } from "../../i18n";
import { PageHeader, EmptyState, ViewGuide } from "../ui";

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
import DirectivesList from "./DirectivesList";
import DirectiveForm from "./DirectiveForm";
import DirectiveDetail from "./DirectiveDetail";
import QuickDirectiveBar from "./QuickDirectiveBar";
import * as api from "../../api";
import { Plus, Send } from "lucide-react";

export interface DirectivesViewProps {
  tasks: Task[];
  agents: Agent[];
  departments: Department[];
  subtasks: SubTask[];
  onCreateTask: (input: {
    title: string; description?: string; department_id?: string;
    task_type?: string; priority?: number; project_id?: string;
    project_path?: string; assigned_agent_id?: string;
  }) => Promise<void>;
  onUpdateTask: (id: string, data: Partial<Task>) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onAssignTask: (id: string, agentId: string) => Promise<void>;
  onRunTask: (id: string, executionMode?: string) => Promise<void>;
  onStopTask: (id: string) => Promise<void>;
  onPauseTask: (id: string) => Promise<void>;
  onResumeTask: (id: string) => Promise<void>;
  onOpenTerminal: (id: string) => void;
  onOpenMeetingMinutes: (id: string) => void;
  onViewDeliverable?: (id: string) => void;
}

type RightPanel = "none" | "form" | "detail";

export default function DirectivesView(props: DirectivesViewProps) {
  const {
    tasks, agents, departments, subtasks,
    onCreateTask, onUpdateTask, onDeleteTask, onRunTask,
    onStopTask, onPauseTask, onResumeTask,
    onOpenTerminal, onOpenMeetingMinutes, onViewDeliverable,
  } = props;
  const { t } = useI18n();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [rightPanel, setRightPanel] = useState<RightPanel>("none");
  const panelRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  const selectedTask = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) ?? null : null;

  useLayoutEffect(() => {
    if (rightPanel === "none" || !panelRef.current) return;
    const first = panelRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    first?.focus();
  }, [rightPanel]);

  useLayoutEffect(() => {
    if (rightPanel === "none" && prevFocusRef.current) {
      prevFocusRef.current.focus();
      prevFocusRef.current = null;
    }
  }, [rightPanel]);

  const handleSelectTask = useCallback((id: string) => {
    prevFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedTaskId(id);
    setRightPanel("detail");
  }, []);

  const handleNewDirective = useCallback(() => {
    prevFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedTaskId(null);
    setRightPanel("form");
  }, []);

  const closePanel = useCallback(() => {
    setRightPanel("none");
    setSelectedTaskId(null);
  }, []);

  const handleQuickDirective = useCallback(async (title: string) => {
    await onCreateTask({ title });
  }, [onCreateTask]);

  const handleClone = useCallback(async (id: string) => {
    try {
      await api.cloneTask(id);
    } catch (e) {
      console.error("Clone failed:", e);
    }
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await onDeleteTask(id);
        prevFocusRef.current = null;
        setSelectedTaskId(null);
        setRightPanel("none");
      } catch (e) {
        console.error("Delete failed:", e);
      }
    },
    [onDeleteTask],
  );

  return (
    <div className="flex flex-col gap-3 h-[calc(100dvh-120px)]">
      <PageHeader
        title={t({ ko: "업무지시", en: "Directives" })}
        subtitle={t({
          ko: "지시를 생성하고 진행 상황을 추적하세요.",
          en: "Create directives and track progress.",
        })}
        actions={
          <>
            <div className="flex-1 min-w-0 max-w-md">
              <QuickDirectiveBar onSubmit={handleQuickDirective} />
            </div>
            <button
              type="button"
              onClick={handleNewDirective}
              className="btn-primary btn-sm shrink-0"
            >
              <Plus width={14} height={14} />
              {t({ ko: "새 지시", en: "New" })}
            </button>
          </>
        }
      />

      <ViewGuide
        title={t({ ko: "사용법 및 가이드", en: "Usage & Guide" })}
        defaultOpen={false}
      >
        <p>
          {t({
            ko: "업무지시는 새 지시를 만들고, 진행 중인 지시를 추적하는 뷰입니다.",
            en: "Directives let you create new directives and track progress on active ones.",
          })}
        </p>
        <ul className="list-disc list-inside space-y-1.5 text-slate-400">
          <li>{t({ ko: "상단 입력창에 짧은 문장을 넣고 전송하면 새 지시(태스크)가 생성됩니다.", en: "Type a short phrase in the bar and submit to create a new directive (task)." })}</li>
          <li>{t({ ko: "왼쪽 목록에서 지시를 선택하면 오른쪽에서 상세·실행·터미널·회의록을 볼 수 있습니다.", en: "Select a directive from the list to view detail, run, terminal, and meeting minutes." })}</li>
        </ul>
      </ViewGuide>

      {/* Master-detail layout (모바일: 목록 + 딤드 + 드로어) */}
      <div className="flex-1 flex gap-3 min-h-0 relative">
        {/* Left: list (데스크톱에서는 패널 열려도 항상 표시, 오른쪽에 상세/폼) */}
        <div className="card flex flex-col w-full md:w-[340px] lg:w-[380px] shrink-0">
          <DirectivesList
            tasks={tasks}
            agents={agents}
            departments={departments}
            selectedTaskId={selectedTaskId}
            onSelectTask={handleSelectTask}
          />
        </div>

        {/* Overlay: 모바일에서 패널 열렸을 때 목록 위 딤드 */}
        {rightPanel !== "none" && (
          <button
            type="button"
            className="master-detail-drawer-overlay md:hidden"
            onClick={closePanel}
            aria-label={t({ ko: "패널 닫기", en: "Close panel" })}
          />
        )}

        {/* Right: detail or form (모바일 드로어, md 이상 2열) */}
        <div
          ref={panelRef}
          className={`card card--accent master-detail-drawer ${rightPanel !== "none" ? "flex" : "hidden md:flex"} flex-1 flex-col`}
        >
          {rightPanel === "form" && (
            <div className="flex flex-col h-full">
              <button
                onClick={closePanel}
                className="md:hidden flex items-center gap-1 px-3 py-2 text-xs"
                style={{ color: "var(--th-text-accent)", borderBottom: "1px solid var(--th-border)" }}
                aria-label={t({ ko: "목록으로", en: "Back" })}
              >
                &larr; {t({ ko: "목록으로", en: "Back" })}
              </button>
              <DirectiveForm
                agents={agents}
                departments={departments}
                onSubmit={onCreateTask}
                onCancel={closePanel}
              />
            </div>
          )}
          {rightPanel === "detail" && selectedTask && (
            <div className="flex flex-col h-full">
              <button
                onClick={closePanel}
                className="md:hidden flex items-center gap-1 px-3 py-2 text-xs"
                style={{ color: "var(--th-text-accent)", borderBottom: "1px solid var(--th-border)" }}
                aria-label={t({ ko: "목록으로", en: "Back" })}
              >
                &larr; {t({ ko: "목록으로", en: "Back" })}
              </button>
              <nav
                className="hidden md:flex items-center gap-1.5 px-3 py-2 text-xs shrink-0"
                style={{ borderBottom: "1px solid var(--th-border)", color: "var(--th-text-muted)" }}
                aria-label={t({ ko: "경로", en: "Breadcrumb" })}
              >
                <button
                  type="button"
                  onClick={closePanel}
                  className="hover:underline truncate max-w-[120px]"
                  style={{ color: "var(--th-text-accent)" }}
                >
                  {t({ ko: "업무지시", en: "Directives" })}
                </button>
                <span aria-hidden>/</span>
                <span className="truncate max-w-[200px]" title={selectedTask.title}>
                  {selectedTask.title}
                </span>
              </nav>
              <DirectiveDetail
                task={selectedTask}
                agents={agents}
                departments={departments}
                subtasks={subtasks}
                onUpdateTask={onUpdateTask}
                onRunTask={onRunTask}
                onStopTask={onStopTask}
                onPauseTask={onPauseTask}
                onResumeTask={onResumeTask}
                onOpenTerminal={onOpenTerminal}
                onOpenMeetingMinutes={onOpenMeetingMinutes}
                onClone={handleClone}
                onDelete={handleDelete}
                onViewDeliverable={onViewDeliverable}
              />
            </div>
          )}
          {rightPanel === "none" && (
            <EmptyState
              icon={<Send width={28} height={28} />}
              title={t({ ko: "업무지시를 선택하거나 새로 생성하세요.", en: "Select or create a directive." })}
            />
          )}
        </div>
      </div>
    </div>
  );
}
