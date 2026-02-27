import { useState, useCallback, useRef, useLayoutEffect } from "react";
import type { Task, Agent, Department } from "../../types";
import { useI18n } from "../../i18n";
import { PageHeader, EmptyState, ViewGuide } from "../ui";
import DeliverablesList from "./DeliverablesList";
import DeliverableDetail from "./DeliverableDetail";
import { FolderCheck, ChevronLeft, Send } from "lucide-react";

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

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
  const drawerRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!selectedTask || !drawerRef.current) return;
    const first = drawerRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    first?.focus();
  }, [selectedTask]);

  useLayoutEffect(() => {
    if (!selectedTask && prevFocusRef.current) {
      prevFocusRef.current.focus();
      prevFocusRef.current = null;
    }
  }, [selectedTask]);

  const handleSelectTask = useCallback((id: string) => {
    prevFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedTaskId(id);
  }, []);

  const closeDrawer = useCallback(() => {
    setSelectedTaskId(null);
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
      <PageHeader
        title={t({ ko: "결과물", en: "Deliverables" })}
        subtitle={t({
          ko: "완료된 업무의 리포트, 코드, 문서를 한곳에서 확인하세요.",
          en: "Review reports, code, and docs from completed work in one place.",
        })}
      />

      <ViewGuide
        title={t({ ko: "이 화면은 이렇게 쓰세요", en: "How to use this screen" })}
        defaultOpen={false}
      >
        <p>
          {t({
            ko: "결과물은 완료·검토된 업무의 요약, 코드, 테스트, 체크리스트를 한곳에서 볼 수 있는 뷰입니다.",
            en: "Deliverables shows summary, code, tests, and checklists for completed or in-review tasks.",
          })}
        </p>
        <ul className="list-disc list-inside space-y-1" style={{ color: "var(--th-text-muted)" }}>
          <li>{t({ ko: "왼쪽 목록에서 기간·부서로 필터한 뒤 항목을 클릭하면 오른쪽에 상세가 열립니다.", en: "Filter by period or department, then click an item to open its detail on the right." })}</li>
          <li>{t({ ko: "상세에서 요약·코드·테스트·체크리스트·프리뷰 로그 탭을 전환해 확인할 수 있습니다.", en: "Use the Summary, Code, Test, Checklist, and Preview tabs to review the deliverable." })}</li>
        </ul>
      </ViewGuide>

      <div className="flex gap-4 flex-1 min-h-0 relative">
        {/* Left: list (데스크톱에서는 선택해도 항상 표시, 오른쪽에 상세) */}
        <div className="card flex flex-col w-full md:w-[360px] lg:w-[400px] shrink-0">
          <DeliverablesList
            tasks={tasks}
            agents={agents}
            departments={departments}
            selectedTaskId={selectedTaskId}
            onSelectTask={handleSelectTask}
            onNavigateToDirectives={onNavigateToDirectives}
          />
        </div>

        {/* Overlay: 모바일에서 상세 열렸을 때 목록 위 딤드, 클릭 시 닫기 */}
        {selectedTask && (
          <button
            type="button"
            className="master-detail-drawer-overlay md:hidden"
            onClick={closeDrawer}
            aria-label={t({ ko: "상세 닫기", en: "Close detail" })}
          />
        )}

        {/* Right: detail (모바일에서 드로어, md 이상에서 2열) */}
        <div
          ref={drawerRef}
          className={`card card--accent master-detail-drawer ${selectedTask ? "flex" : "hidden md:flex"} flex-1 flex-col min-w-0`}
        >
          {selectedTask ? (
            <div className="flex flex-col h-full min-h-0">
              <button
                onClick={closeDrawer}
                className="deliverables-back md:hidden flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium shrink-0"
                style={{ color: "var(--th-text-accent)", borderBottom: "1px solid var(--th-card-border)" }}
                aria-label={t({ ko: "목록으로", en: "Back to list" })}
              >
                <ChevronLeft width={16} height={16} />
                {t({ ko: "목록으로", en: "Back to list" })}
              </button>
              <nav
                className="hidden md:flex items-center gap-1.5 px-3 py-2 text-xs shrink-0"
                style={{ borderBottom: "1px solid var(--th-border)", color: "var(--th-text-muted)" }}
                aria-label={t({ ko: "경로", en: "Breadcrumb" })}
              >
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="hover:underline truncate max-w-[120px]"
                  style={{ color: "var(--th-text-accent)" }}
                >
                  {t({ ko: "결과물", en: "Deliverables" })}
                </button>
                <span aria-hidden>/</span>
                <span className="truncate max-w-[200px]" title={selectedTask.title}>
                  {selectedTask.title}
                </span>
              </nav>
              <DeliverableDetail task={selectedTask} departments={departments} onDelete={handleDelete} />
            </div>
          ) : (
            <EmptyState
              icon={<FolderCheck width={28} height={28} strokeWidth={1.5} />}
              title={t({ ko: "결과물을 선택하세요", en: "Select a deliverable" })}
              description={t({
                ko: "왼쪽 목록에서 항목을 클릭하면 요약, 코드, 테스트 등을 볼 수 있습니다.",
                en: "Click an item on the left to view summary, code, and tests.",
              })}
              action={
                onNavigateToDirectives ? (
                  <button
                    type="button"
                    onClick={onNavigateToDirectives}
                    className="btn-primary btn-sm"
                  >
                    <Send width={14} height={14} />
                    {t({ ko: "업무지시로 이동", en: "Go to Directives" })}
                  </button>
                ) : undefined
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
