import { useState, useEffect, useMemo } from "react";
import { useI18n } from "../../i18n";
import * as api from "../../api";
import type { TaskDiffResult } from "../../api";
import { Loader2, GitBranch, FileCode } from "lucide-react";

interface DeliverableCodeTabProps {
  taskId: string;
}

/** Classify diff lines for syntax coloring */
function DiffContent({ text }: { text: string }) {
  const lines = useMemo(() => text.split("\n"), [text]);
  return (
    <pre className="text-[11px] font-mono leading-[1.65] m-0 whitespace-pre-wrap break-all">
      {lines.map((line, i) => {
        let cls = "";
        if (line.startsWith("@@")) cls = "dlv-diff-header";
        else if (line.startsWith("+")) cls = "dlv-diff-add";
        else if (line.startsWith("-")) cls = "dlv-diff-del";
        return (
          <div key={i} className={cls} style={{ padding: "0 0.25rem" }}>
            {line || "\u00A0"}
          </div>
        );
      })}
    </pre>
  );
}

export default function DeliverableCodeTab({ taskId }: DeliverableCodeTabProps) {
  const { t } = useI18n();
  const [diff, setDiff] = useState<TaskDiffResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getTaskDiff(taskId).then((d) => {
      if (!cancelled) { setDiff(d); setLoading(false); }
    }).catch(() => {
      if (!cancelled) { setDiff(null); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [taskId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center text-xs" style={{ color: "var(--th-text-muted)" }}>
        <Loader2 width={14} height={14} className="animate-spin" />
        {t({ ko: "코드 변경사항 로딩 중...", en: "Loading code changes..." })}
      </div>
    );
  }

  if (!diff || !diff.ok) {
    return (
      <div className="dlv-empty">
        <div className="dlv-empty-icon"><FileCode width={20} height={20} /></div>
        <p className="dlv-empty-text">{t({ ko: "코드 변경사항이 없습니다", en: "No code changes available" })}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Branch info */}
      {diff.branchName && (
        <div className="dlv-section">
          <div className="dlv-section-body flex items-center gap-2">
            <GitBranch width={13} height={13} style={{ color: "#60a5fa" }} />
            <span className="text-xs font-mono font-medium" style={{ color: "var(--th-text-primary)" }}>
              {diff.branchName}
            </span>
            {diff.hasWorktree && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa" }}
              >
                worktree
              </span>
            )}
          </div>
        </div>
      )}

      {/* Stat summary */}
      {diff.stat && (
        <div className="dlv-section">
          <div className="dlv-section-header">
            <div className="dlv-section-dot" style={{ background: "#fbbf24" }} />
            {t({ ko: "변경 통계", en: "Change Stats" })}
          </div>
          <div className="dlv-section-body">
            <pre className="text-[11px] font-mono whitespace-pre-wrap" style={{ color: "var(--th-text-secondary)", margin: 0 }}>
              {diff.stat}
            </pre>
          </div>
        </div>
      )}

      {/* Diff with syntax coloring */}
      {diff.diff && (
        <div className="dlv-terminal">
          <div className="dlv-terminal-header">
            <div className="dlv-terminal-dots">
              <i style={{ background: "#f87171" }} />
              <i style={{ background: "#fbbf24" }} />
              <i style={{ background: "#4ade80" }} />
            </div>
            <span>{t({ ko: "코드 Diff", en: "Code Diff" })}</span>
          </div>
          <div className="dlv-terminal-body">
            <DiffContent text={diff.diff} />
          </div>
        </div>
      )}
    </div>
  );
}
