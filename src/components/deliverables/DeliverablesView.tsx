import { useState, useCallback } from "react";
import type { Task, Agent, Department } from "../../types";
import { useI18n } from "../../i18n";
import DeliverablesList from "./DeliverablesList";
import DeliverableDetail from "./DeliverableDetail";
import { FolderCheck, ChevronLeft, Send } from "lucide-react";

interface DeliverablesViewProps {
  tasks: Task[];
  agents: Agent[];
  departments: Department[];
  onDeleteTask: (id: string) => Promise<void>;
  onNavigateToDirectives?: () => void;
}

export default function DeliverablesView({
  tasks,
  agents,
  departments,
  onDeleteTask,
  onNavigateToDirectives,
}: DeliverablesViewProps) {
  const { t } = useI18n();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) ?? null : null;

  const handleSelectTask = useCallback((id: string) => {
    setSelectedTaskId(id);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await onDeleteTask(id);
        setSelectedTaskId(null);
      } catch (e) {
        console.error("Delete failed:", e);
      }
    },
    [onDeleteTask],
  );

  return (
    <div className="deliverables-page flex flex-col gap-4 h-[calc(100dvh-120px)]">
      {/* Page title & description */}
      <header className="deliverables-hero shrink-0">
        <h1 className="deliverables-hero-title">
          {t({ ko: "결과물", en: "Deliverables" })}
        </h1>
        <p className="deliverables-hero-desc">
          {t({
            ko: "완료된 업무의 리포트, 코드, 문서를 한곳에서 확인하세요.",
            en: "Review reports, code, and docs from completed work in one place.",
          })}
        </p>
      </header>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: list */}
        <div
          className={`${selectedTask ? "hidden md:flex" : "flex"} w-full md:w-[360px] lg:w-[400px] shrink-0 flex-col dlv-panel dlv-panel--list`}
        >
          <DeliverablesList
            tasks={tasks}
            agents={agents}
            departments={departments}
            selectedTaskId={selectedTaskId}
            onSelectTask={handleSelectTask}
            onNavigateToDirectives={onNavigateToDirectives}
          />
        </div>

        {/* Right: detail */}
        <div
          className={`${selectedTask ? "flex" : "hidden md:flex"} flex-1 flex-col dlv-panel dlv-panel--detail min-w-0`}
        >
          {selectedTask ? (
            <div className="flex flex-col h-full min-h-0">
              <button
                onClick={() => setSelectedTaskId(null)}
                className="deliverables-back md:hidden flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium"
                style={{ color: "var(--th-text-accent)", borderBottom: "1px solid var(--th-card-border)" }}
              >
                <ChevronLeft width={16} height={16} />
                {t({ ko: "목록으로", en: "Back to list" })}
              </button>
              <DeliverableDetail task={selectedTask} departments={departments} onDelete={handleDelete} />
            </div>
          ) : (
            <div className="deliverables-empty-detail">
              <div className="deliverables-empty-detail-icon">
                <FolderCheck width={32} height={32} strokeWidth={1.5} />
              </div>
              <p className="deliverables-empty-detail-title">
                {t({ ko: "결과물을 선택하세요", en: "Select a deliverable" })}
              </p>
              <p className="deliverables-empty-detail-desc">
                {t({
                  ko: "왼쪽 목록에서 항목을 클릭하면 요약, 코드, 테스트 등을 볼 수 있습니다.",
                  en: "Click an item on the left to view summary, code, and tests.",
                })}
              </p>
              {onNavigateToDirectives && (
                <button
                  type="button"
                  onClick={onNavigateToDirectives}
                  className="deliverables-empty-cta"
                >
                  <Send width={14} height={14} />
                  {t({ ko: "업무지시로 이동", en: "Go to Directives" })}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
