import type { TestRun } from "../../../api";
import { useI18n } from "../../../i18n";
import { timeAgo } from "../../task-board/taskBoardHelpers";
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";

interface TestResultCardProps {
  run: TestRun;
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: { ko: string; en: string } }> = {
  running: { icon: <Loader2 width={14} height={14} className="animate-spin" />, color: "#60a5fa", label: { ko: "실행 중", en: "Running" } },
  passed: { icon: <CheckCircle2 width={14} height={14} />, color: "#4ade80", label: { ko: "통과", en: "Passed" } },
  failed: { icon: <XCircle width={14} height={14} />, color: "#f87171", label: { ko: "실패", en: "Failed" } },
  error: { icon: <AlertCircle width={14} height={14} />, color: "#fb923c", label: { ko: "에러", en: "Error" } },
};

export default function TestResultCard({ run }: TestResultCardProps) {
  const { t, locale } = useI18n();
  const cfg = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.error;

  return (
    <div
      className="rounded-lg p-3"
      style={{ background: "var(--th-bg-surface)", border: "1px solid var(--th-border)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: cfg.color }}>{cfg.icon}</span>
        <span className="text-xs font-medium" style={{ color: cfg.color }}>
          {t(cfg.label)}
        </span>
        <span className="text-[10px] flex-1 text-right" style={{ color: "var(--th-text-muted)" }}>
          {timeAgo(run.started_at, locale)}
        </span>
      </div>

      <div className="text-[10px] font-mono mb-1" style={{ color: "var(--th-text-muted)" }}>
        $ {run.command}
      </div>

      {run.total > 0 && (
        <div className="flex items-center gap-3 text-[11px] mt-1">
          <span style={{ color: "var(--th-text-secondary)" }}>
            {t({ ko: "전체", en: "Total" })}: {run.total}
          </span>
          <span className="text-green-500">{run.passed} {t({ ko: "통과", en: "passed" })}</span>
          {run.failed > 0 && (
            <span className="text-red-500">{run.failed} {t({ ko: "실패", en: "failed" })}</span>
          )}
          {run.skipped > 0 && (
            <span style={{ color: "var(--th-text-muted)" }}>{run.skipped} {t({ ko: "건너뜀", en: "skipped" })}</span>
          )}
        </div>
      )}

      {run.duration != null && (
        <div className="text-[10px] mt-1" style={{ color: "var(--th-text-muted)" }}>
          {(run.duration / 1000).toFixed(1)}s
        </div>
      )}
    </div>
  );
}
