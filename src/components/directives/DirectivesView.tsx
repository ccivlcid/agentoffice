import { useState, useCallback } from "react";
import type { Task, Agent, Department, SubTask } from "../../types";
import { useI18n } from "../../i18n";
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

  const selectedTask = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) ?? null : null;

  const handleSelectTask = useCallback((id: string) => {
    setSelectedTaskId(id);
    setRightPanel("detail");
  }, []);

  const handleNewDirective = useCallback(() => {
    setSelectedTaskId(null);
    setRightPanel("form");
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
      {/* Quick directive bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <QuickDirectiveBar onSubmit={handleQuickDirective} />
        </div>
        <button
          onClick={handleNewDirective}
          className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shrink-0"
        >
          <Plus width={14} height={14} />
          {t({ ko: "새 지시", en: "New" })}
        </button>
      </div>

      {/* Master-detail layout */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* Left: list (hidden on mobile when right panel is open) */}
        <div
          className={`${rightPanel !== "none" ? "hidden md:flex" : "flex"} w-full md:w-[340px] lg:w-[380px] shrink-0 rounded-lg overflow-hidden flex-col`}
          style={{ background: "var(--th-bg-panel)", border: "1px solid var(--th-border)" }}
        >
          <DirectivesList
            tasks={tasks}
            agents={agents}
            departments={departments}
            selectedTaskId={selectedTaskId}
            onSelectTask={handleSelectTask}
          />
        </div>

        {/* Right: detail or form (full-width on mobile when open) */}
        <div
          className={`${rightPanel !== "none" ? "flex" : "hidden md:flex"} flex-1 rounded-lg overflow-hidden flex-col`}
          style={{ background: "var(--th-bg-panel)", border: "1px solid var(--th-border)" }}
        >
          {rightPanel === "form" && (
            <div className="flex flex-col h-full">
              <button
                onClick={() => setRightPanel("none")}
                className="md:hidden flex items-center gap-1 px-3 py-2 text-xs"
                style={{ color: "var(--th-text-accent)", borderBottom: "1px solid var(--th-border)" }}
              >
                &larr; {t({ ko: "목록으로", en: "Back" })}
              </button>
              <DirectiveForm
                agents={agents}
                departments={departments}
                onSubmit={onCreateTask}
                onCancel={() => setRightPanel("none")}
              />
            </div>
          )}
          {rightPanel === "detail" && selectedTask && (
            <div className="flex flex-col h-full">
              <button
                onClick={() => { setRightPanel("none"); setSelectedTaskId(null); }}
                className="md:hidden flex items-center gap-1 px-3 py-2 text-xs"
                style={{ color: "var(--th-text-accent)", borderBottom: "1px solid var(--th-border)" }}
              >
                &larr; {t({ ko: "목록으로", en: "Back" })}
              </button>
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
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: "var(--th-bg-surface)", color: "var(--th-text-muted)" }}
              >
                <Send width={24} height={24} />
              </div>
              <p className="text-xs" style={{ color: "var(--th-text-muted)" }}>
                {t({ ko: "업무지시를 선택하거나 새로 생성하세요.", en: "Select or create a directive." })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
