import { useState, useEffect } from "react";
import { useI18n } from "../../i18n";
import * as api from "../../api";
import { Server, Loader2, FlaskConical } from "lucide-react";

interface DeliverablePreviewLogTabProps {
  taskId: string;
}

export default function DeliverablePreviewLogTab({ taskId }: DeliverablePreviewLogTabProps) {
  const { t } = useI18n();
  const [sessions, setSessions] = useState<api.PreviewSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getPreviewSessions(taskId).then((s) => {
      if (!cancelled) {
        setSessions(s);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [taskId]);

  const runningOrRecent = sessions.filter(
    (s) => s.status === "running" || s.status === "starting",
  );
  const hasActive = runningOrRecent.length > 0;

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center text-xs" style={{ color: "var(--th-text-muted)" }}>
        <Loader2 width={14} height={14} className="animate-spin" />
        {t({ ko: "로딩 중...", en: "Loading..." })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="dlv-terminal">
        <div className="dlv-terminal-header">
          <div className="dlv-terminal-dots">
            <i style={{ background: "#f87171" }} />
            <i style={{ background: "#fbbf24" }} />
            <i style={{ background: "#4ade80" }} />
          </div>
          <span>{t({ ko: "테스트 서버 로그", en: "Test Server Log" })}</span>
        </div>
        <div className="dlv-terminal-body">
          {hasActive ? (
            <p className="text-[11px]" style={{ color: "var(--th-text-muted)" }}>
              {t({
                ko: "미리보기 서버가 실행 중입니다. 서버 로그는 추후 API 연동 시 여기에 표시됩니다.",
                en: "Preview server is running. Server log will appear here when API is available.",
              })}
            </p>
          ) : (
            <p className="text-[11px]" style={{ color: "var(--th-text-muted)" }}>
              {t({
                ko: "테스트 탭에서 미리보기 서버를 시작하면 서버 실행 로그가 여기에 표시됩니다.",
                en: "Start the preview server in the Test tab to see server logs here.",
              })}
            </p>
          )}
        </div>
      </div>

      {sessions.length > 0 && (
        <div className="dlv-section">
          <div className="dlv-section-header">
            <Server width={12} height={12} style={{ color: "var(--th-text-muted)" }} />
            {t({ ko: "미리보기 세션", en: "Preview sessions" })}
          </div>
          <div className="dlv-section-body space-y-1.5">
            {sessions.slice(0, 5).map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 text-[11px]"
                style={{ color: "var(--th-text-secondary)" }}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    s.status === "running" ? "bg-green-500" : s.status === "starting" ? "bg-amber-500 animate-pulse" : "bg-[var(--th-text-muted)]"
                  }`}
                />
                <span className="font-mono truncate flex-1">{s.command}</span>
                <span style={{ color: "var(--th-text-muted)" }}>{s.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--th-text-muted)" }}>
        <FlaskConical width={12} height={12} />
        {t({
          ko: "테스트 탭 → 미리보기에서 서버를 시작한 뒤 이 탭에서 로그를 확인할 수 있습니다.",
          en: "Start the server in Test → Preview, then view logs in this tab.",
        })}
      </div>
    </div>
  );
}
