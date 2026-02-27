import type { Task, Department } from "../../types";
import { useI18n } from "../../i18n";
import { ExternalLink, X } from "lucide-react";
import { taskTypeLabel } from "../task-board/taskBoardHelpers";

interface DeliverableSummaryCardProps {
  task: Task;
  departments: Department[];
  onOpenInNewTab: (taskId: string) => void;
  onClearSelection: () => void;
}

/** 오른쪽 패널용 요약 카드: 제목·한 줄 설명 + 새 탭에서 전체 보기 */
export default function DeliverableSummaryCard({
  task,
  departments,
  onOpenInNewTab,
  onClearSelection,
}: DeliverableSummaryCardProps) {
  const { t } = useI18n();
  const dept = departments.find((d) => d.id === task.department_id);
  const desc = (task.description ?? "").trim().split(/\n/)[0]?.slice(0, 120) ?? "";

  return (
    <div className="flex flex-col h-full min-h-0 p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold truncate flex-1" style={{ color: "var(--th-text-heading)" }}>
          {task.title}
        </h3>
        <button
          type="button"
          onClick={onClearSelection}
          className="shrink-0 p-1 rounded hover:opacity-80"
          style={{ color: "var(--th-text-muted)" }}
          aria-label={t({ ko: "선택 해제", en: "Clear selection" })}
        >
          <X width={16} height={16} />
        </button>
      </div>
      {dept && (
        <p className="text-xs mb-2" style={{ color: "var(--th-text-muted)" }}>
          {dept.name_ko || dept.name} · {taskTypeLabel(task.task_type, t)}
        </p>
      )}
      {desc && (
        <p className="text-xs mb-4 line-clamp-2" style={{ color: "var(--th-text-secondary)" }}>
          {desc}
          {(task.description ?? "").length > 120 ? "…" : ""}
        </p>
      )}
      <div className="mt-auto pt-4 border-t" style={{ borderColor: "var(--th-border)" }}>
        <button
          type="button"
          onClick={() => onOpenInNewTab(task.id)}
          className="btn-primary btn-sm w-full"
        >
          <ExternalLink width={14} height={14} />
          {t({ ko: "새 탭에서 전체 보기", en: "Open full view in new tab" })}
        </button>
      </div>
    </div>
  );
}
