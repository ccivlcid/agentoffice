import { useState, useEffect } from "react";
import { useI18n } from "../../i18n";
import * as api from "../../api";
import { Loader2, Terminal } from "lucide-react";

interface DeliverableLogTabProps {
  taskId: string;
}

export default function DeliverableLogTab({ taskId }: DeliverableLogTabProps) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getTerminal(taskId, 500, true).then((r) => {
      if (!cancelled) { setText(r.text ?? ""); setLoading(false); }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [taskId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center text-xs" style={{ color: "var(--th-text-muted)" }}>
        <Loader2 width={14} height={14} className="animate-spin" />
        {t({ ko: "로그 로딩 중...", en: "Loading logs..." })}
      </div>
    );
  }

  if (!text) {
    return (
      <div className="dlv-empty">
        <div className="dlv-empty-icon"><Terminal width={20} height={20} /></div>
        <p className="dlv-empty-text">{t({ ko: "아직 실행 기록이 없어요", en: "No execution logs yet" })}</p>
      </div>
    );
  }

  return (
    <div className="dlv-terminal">
      <div className="dlv-terminal-header">
        <div className="dlv-terminal-dots">
          <i style={{ background: "#f87171" }} />
          <i style={{ background: "#fbbf24" }} />
          <i style={{ background: "#4ade80" }} />
        </div>
        <span>{t({ ko: "업무 실행 로그", en: "Execution Log" })}</span>
      </div>
      <div className="dlv-terminal-body">
        <pre>{text}</pre>
      </div>
    </div>
  );
}
