import { useState, useMemo, useEffect } from "react";
import type { Task, TaskType, Department } from "../../types";
import { useI18n } from "../../i18n";
import { TASK_TYPE_COLORS, taskTypeLabel } from "../task-board/taskBoardHelpers";
import DeliverableSummaryTab from "./DeliverableSummaryTab";
import DeliverableCodeTab from "./DeliverableCodeTab";
import DeliverableDocTab from "./DeliverableDocTab";
import DeliverableMinutesTab from "./DeliverableMinutesTab";
import DeliverableLogTab from "./DeliverableLogTab";
import DeliverablePreviewLogTab from "./DeliverablePreviewLogTab.tsx";
import DeliverableTestTab from "./DeliverableTestTab";
import { FileText, Code, BookOpen, Users, Terminal, Server, FlaskConical, Trash2 } from "lucide-react";

interface DeliverableDetailProps {
  task: Task;
  departments: Department[];
  onDelete: (id: string) => Promise<void>;
}

type TabKey = "summary" | "code" | "doc" | "test" | "minutes" | "execution" | "serverLog";

const TAB_ICONS: Record<TabKey, React.ReactNode> = {
  summary: <FileText width={12} height={12} />,
  code: <Code width={12} height={12} />,
  doc: <BookOpen width={12} height={12} />,
  test: <FlaskConical width={12} height={12} />,
  minutes: <Users width={12} height={12} />,
  execution: <Terminal width={12} height={12} />,
  serverLog: <Server width={12} height={12} />,
};

/** 코드·테스트 탭 표시: 개발/디자인/운영(일반) — 기획팀은 제외 */
const CODE_AND_TEST_TYPES: Set<TaskType> = new Set(["development", "design", "general"]);
/** 문서 탭 표시: 문서/발표/분석/기획 등 문서 중심 업무 */
const DOC_TYPES: Set<TaskType> = new Set(["documentation", "presentation", "analysis"]);

function isPlanningDepartment(departments: Department[], departmentId: string | null): boolean {
  if (!departmentId) return false;
  const dept = departments.find((d) => d.id === departmentId);
  if (!dept) return false;
  const ko = (dept.name_ko ?? "").trim();
  const en = (dept.name ?? "").toLowerCase();
  return ko.includes("기획") || en.includes("planning");
}

export default function DeliverableDetail({ task, departments, onDelete }: DeliverableDetailProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabKey>("summary");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  /** 방문한 탭만 마운트 유지해 탭 전환 시 재렌더 비용 절감 */
  const [visitedTabs, setVisitedTabs] = useState<Set<TabKey>>(() => new Set(["summary"]));
  const colors = TASK_TYPE_COLORS[task.task_type] ?? TASK_TYPE_COLORS.general;
  const isPlanning = isPlanningDepartment(departments, task.department_id);

  useEffect(() => {
    setVisitedTabs((prev) => new Set([...prev, activeTab]));
  }, [activeTab]);

  useEffect(() => {
    setVisitedTabs(new Set(["summary"]));
  }, [task.id]);

  const handleDeleteClick = () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    onDelete(task.id).finally(() => setDeleteConfirm(false));
  };

  /** 기획팀은 코드/테스트 미노출. 그 외 개발·디자인·일반(운영)만 코드·테스트 탭 표시 */
  const hasCodeAndTest =
    CODE_AND_TEST_TYPES.has(task.task_type) && !isPlanning;
  const hasDoc = DOC_TYPES.has(task.task_type) || isPlanning;

  const tabs = useMemo(() => {
    const list: { key: TabKey; label: string }[] = [
      { key: "summary", label: t({ ko: "요약", en: "Summary" }) },
    ];
    if (hasCodeAndTest) {
      list.push({ key: "code", label: t({ ko: "코드", en: "Code" }) });
      list.push({ key: "test", label: t({ ko: "테스트", en: "Test" }) });
      list.push({ key: "serverLog", label: t({ ko: "테스트 서버 로그", en: "Server Log" }) });
    }
    if (hasDoc) {
      list.push({ key: "doc", label: t({ ko: "문서", en: "Docs" }) });
    }
    list.push(
      { key: "minutes", label: t({ ko: "회의록", en: "Minutes" }) },
      { key: "execution", label: t({ ko: "업무 내용", en: "Execution" }) },
    );
    return list;
  }, [hasCodeAndTest, hasDoc, t]);

  const validTab = tabs.some((tab) => tab.key === activeTab) ? activeTab : "summary";

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="dlv-detail-header-v2">
        <div
          className="dlv-detail-accent"
          style={{ background: `linear-gradient(90deg, ${colors.accent}, ${colors.accent}88)` }}
        />
        <div className="dlv-detail-header-inner">
          <div className="dlv-detail-meta-row">
            <span
              className="dlv-type-badge"
              style={{ background: colors.bg, color: colors.accent }}
            >
              {taskTypeLabel(task.task_type, t)}
            </span>
          </div>
          <h2 className="dlv-detail-title">{task.title}</h2>
          <div className="dlv-detail-actions">
            <button
              type="button"
              onClick={handleDeleteClick}
              className={`dlv-detail-delete ${deleteConfirm ? "dlv-detail-delete--confirm" : ""}`}
              title={deleteConfirm ? t({ ko: "다시 클릭하면 삭제됩니다", en: "Click again to delete" }) : t({ ko: "삭제", en: "Delete" })}
              aria-label={deleteConfirm ? t({ ko: "삭제 확인", en: "Confirm delete" }) : t({ ko: "삭제", en: "Delete" })}
            >
              <Trash2 width={14} height={14} />
              {deleteConfirm && (
                <span className="dlv-detail-delete-label">
                  {t({ ko: "삭제 확인", en: "Confirm" })}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <nav className="dlv-tabs-v2" aria-label={t({ ko: "결과물 탭", en: "Deliverable tabs" })}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`dlv-tab-v2 ${validTab === tab.key ? "dlv-tab-v2--active" : ""}`}
            aria-selected={validTab === tab.key}
            aria-controls={`dlv-panel-${tab.key}`}
            id={`dlv-tab-${tab.key}`}
          >
            {TAB_ICONS[tab.key]}
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className="dlv-detail-content flex flex-col min-h-0">
        {tabs.map((tab) => {
          if (!visitedTabs.has(tab.key)) return null;
          const isActive = validTab === tab.key;
          return (
            <div
              key={tab.key}
              id={`dlv-panel-${tab.key}`}
              role="tabpanel"
              aria-labelledby={`dlv-tab-${tab.key}`}
              aria-hidden={!isActive}
              hidden={!isActive}
              className="h-full overflow-auto min-h-0"
              style={{ display: isActive ? "block" : "none" }}
            >
              {tab.key === "summary" && <DeliverableSummaryTab taskId={task.id} />}
              {tab.key === "code" && <DeliverableCodeTab taskId={task.id} />}
              {tab.key === "doc" && <DeliverableDocTab taskId={task.id} />}
              {tab.key === "test" && <DeliverableTestTab taskId={task.id} taskType={task.task_type} />}
              {tab.key === "minutes" && <DeliverableMinutesTab taskId={task.id} />}
              {tab.key === "execution" && <DeliverableLogTab taskId={task.id} />}
              {tab.key === "serverLog" && <DeliverablePreviewLogTab taskId={task.id} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
