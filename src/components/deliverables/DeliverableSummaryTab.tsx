import { useState, useEffect } from "react";
import { useI18n } from "../../i18n";
import * as api from "../../api";
import type { TaskReportDetail } from "../../api";
import { Loader2, FileText, User, Building2, ScrollText } from "lucide-react";

interface DeliverableSummaryTabProps {
  taskId: string;
}

export default function DeliverableSummaryTab({ taskId }: DeliverableSummaryTabProps) {
  const { t } = useI18n();
  const [report, setReport] = useState<TaskReportDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getTaskReportDetail(taskId).then((r) => {
      if (!cancelled) { setReport(r); setLoading(false); }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [taskId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center text-xs" style={{ color: "var(--th-text-muted)" }}>
        <Loader2 width={14} height={14} className="animate-spin" />
        {t({ ko: "로딩 중...", en: "Loading..." })}
      </div>
    );
  }

  if (!report) {
    return (
      <div className="dlv-empty">
        <div className="dlv-empty-icon"><FileText width={20} height={20} /></div>
        <p className="dlv-empty-text">{t({ ko: "리포트를 찾을 수 없습니다", en: "Report not found" })}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Planning summary */}
      {report.planning_summary && (
        <div className="dlv-section">
          <div className="dlv-section-header">
            <div className="dlv-section-dot" style={{ background: "#60a5fa" }} />
            {t({ ko: "기획 요약", en: "Planning Summary" })}
          </div>
          <div className="dlv-section-body">
            <div className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: "var(--th-text-secondary)" }}>
              {report.planning_summary.content}
            </div>
          </div>
        </div>
      )}

      {/* Task info */}
      <div className="dlv-section">
        <div className="dlv-section-header">
          <div className="dlv-section-dot" style={{ background: "#a78bfa" }} />
          {t({ ko: "태스크 정보", en: "Task Info" })}
        </div>
        <div className="dlv-section-body">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <div className="flex items-center gap-1.5">
              <User width={11} height={11} style={{ color: "var(--th-text-muted)" }} />
              <span style={{ color: "var(--th-text-muted)" }}>{t({ ko: "담당", en: "Agent" })}</span>
              <span className="font-medium" style={{ color: "var(--th-text-primary)" }}>{report.task.agent_name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Building2 width={11} height={11} style={{ color: "var(--th-text-muted)" }} />
              <span style={{ color: "var(--th-text-muted)" }}>{t({ ko: "부서", en: "Dept" })}</span>
              <span className="font-medium" style={{ color: "var(--th-text-primary)" }}>{report.task.dept_name_ko || report.task.dept_name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Team reports */}
      {report.team_reports && report.team_reports.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-medium px-1" style={{ color: "var(--th-text-muted)" }}>
            <ScrollText width={11} height={11} />
            {t({ ko: `팀 리포트 ${report.team_reports.length}건`, en: `${report.team_reports.length} Team Report(s)` })}
          </div>
          {report.team_reports.map((section) => (
            <div key={section.id} className="dlv-section">
              <div className="dlv-section-header">
                <div className="dlv-section-dot" style={{ background: "#34d399" }} />
                <span className="flex-1 truncate">{section.title}</span>
                <span className="text-[10px]" style={{ color: "var(--th-text-muted)" }}>
                  {section.agent_name_ko || section.agent_name}
                </span>
              </div>
              {section.summary && (
                <div className="dlv-section-body">
                  <div className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: "var(--th-text-secondary)" }}>
                    {section.summary}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Logs preview */}
      {report.logs.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-medium px-1" style={{ color: "var(--th-text-muted)" }}>
            <ScrollText width={11} height={11} />
            {t({ ko: `최근 로그 (${Math.min(report.logs.length, 10)}/${report.logs.length})`, en: `Recent Logs (${Math.min(report.logs.length, 10)}/${report.logs.length})` })}
          </div>
          <div
            className="rounded-lg overflow-hidden max-h-40 overflow-y-auto"
            style={{ background: "var(--th-glass-bg)", border: "1px solid var(--th-card-border)" }}
          >
            {report.logs.slice(-10).map((log, i) => (
              <div
                key={i}
                className="px-2.5 py-1 text-[10px] font-mono flex gap-2"
                style={{
                  color: "var(--th-text-muted)",
                  borderBottom: i < Math.min(report.logs.length, 10) - 1 ? "1px solid var(--th-card-border)" : undefined,
                }}
              >
                <span className="shrink-0 font-semibold" style={{ color: "var(--th-text-accent)" }}>
                  [{log.kind}]
                </span>
                <span className="break-all">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
