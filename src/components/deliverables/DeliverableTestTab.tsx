import type { TaskType } from "../../types";
import AutoTestSection from "./testing/AutoTestSection";
import PreviewSection from "./testing/PreviewSection";
import ChecklistSection from "./testing/ChecklistSection";

interface DeliverableTestTabProps {
  taskId: string;
  taskType: TaskType;
}

/** task_type별 표시 섹션: development/general=전체, design=미리보기+체크, 그 외=체크만 */
const SHOW_AUTO_TEST: Set<TaskType> = new Set(["development", "general"]);
const SHOW_PREVIEW: Set<TaskType> = new Set(["development", "general", "design"]);

export default function DeliverableTestTab({ taskId, taskType }: DeliverableTestTabProps) {
  const showAutoTest = SHOW_AUTO_TEST.has(taskType);
  const showPreview = SHOW_PREVIEW.has(taskType);

  return (
    <div className="space-y-6">
      {showAutoTest && <AutoTestSection taskId={taskId} />}
      {showPreview && (
        <div style={showAutoTest ? { borderTop: "1px solid var(--th-border)" } : undefined} className={showAutoTest ? "pt-4" : ""}>
          <PreviewSection taskId={taskId} />
        </div>
      )}
      <div style={showAutoTest || showPreview ? { borderTop: "1px solid var(--th-border)" } : undefined} className={showAutoTest || showPreview ? "pt-4" : ""}>
        <ChecklistSection taskId={taskId} />
      </div>
    </div>
  );
}
