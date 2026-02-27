import { useState, useEffect } from "react";
import { useI18n } from "../../i18n";
import * as api from "../../api";
import type { TaskReportDetail, TaskReportDocument } from "../../api";
import { Loader2, FileText, ChevronDown, ChevronUp } from "lucide-react";

interface DeliverableDocTabProps {
  taskId: string;
}

function DocCard({ doc, idx }: { doc: TaskReportDocument; idx: number }) {
  const [expanded, setExpanded] = useState(true);
  const dotColors = ["#60a5fa", "#34d399", "#a78bfa", "#fbbf24", "#f472b6"];
  const dotColor = dotColors[idx % dotColors.length];

  return (
    <div className="dlv-section">
      <button
        onClick={() => setExpanded(!expanded)}
        className="dlv-section-header w-full cursor-pointer hover:opacity-80 transition-opacity"
      >
        <div className="dlv-section-dot" style={{ background: dotColor }} />
        <span className="flex-1 text-left truncate" style={{ color: "var(--th-text-heading)" }}>
          {doc.title || doc.path || "Untitled"}
        </span>
        {doc.path && (
          <span className="text-[9px] font-mono shrink-0" style={{ color: "var(--th-text-muted)" }}>
            {doc.path}
          </span>
        )}
        {expanded
          ? <ChevronUp width={12} height={12} style={{ color: "var(--th-text-muted)" }} />
          : <ChevronDown width={12} height={12} style={{ color: "var(--th-text-muted)" }} />}
      </button>
      {expanded && (
        <div className="dlv-section-body">
          <div className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: "var(--th-text-secondary)" }}>
            {doc.content || doc.text_preview || "\u2014"}
          </div>
          {doc.truncated && (
            <span className="block mt-2 text-[10px] italic" style={{ color: "var(--th-text-muted)" }}>
              (truncated)
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function DeliverableDocTab({ taskId }: DeliverableDocTabProps) {
  const { t } = useI18n();
  const [docs, setDocs] = useState<TaskReportDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getTaskReportDetail(taskId).then((r: TaskReportDetail) => {
      if (cancelled) return;
      const collected: TaskReportDocument[] = [];
      if (r.planning_summary?.documents) collected.push(...r.planning_summary.documents);
      if (r.team_reports) {
        for (const section of r.team_reports) {
          if (section.documents) collected.push(...section.documents);
        }
      }
      setDocs(collected);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [taskId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center text-xs" style={{ color: "var(--th-text-muted)" }}>
        <Loader2 width={14} height={14} className="animate-spin" />
        {t({ ko: "문서 로딩 중...", en: "Loading documents..." })}
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="dlv-empty">
        <div className="dlv-empty-icon"><FileText width={20} height={20} /></div>
        <p className="dlv-empty-text">{t({ ko: "생성된 문서가 없습니다", en: "No documents generated" })}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium px-1" style={{ color: "var(--th-text-muted)" }}>
        <FileText width={11} height={11} />
        {t({ ko: `문서 ${docs.length}건`, en: `${docs.length} document(s)` })}
      </div>
      {docs.map((doc, i) => (
        <DocCard key={doc.id} doc={doc} idx={i} />
      ))}
    </div>
  );
}
