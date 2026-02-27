import { useState, useEffect, useCallback } from "react";
import { useI18n } from "../../../i18n";
import * as api from "../../../api";
import type { PreviewSession } from "../../../api";
import { Play, Square, ExternalLink, Loader2 } from "lucide-react";

interface PreviewSectionProps {
  taskId: string;
}

export default function PreviewSection({ taskId }: PreviewSectionProps) {
  const { t } = useI18n();
  const [sessions, setSessions] = useState<PreviewSession[]>([]);
  const [command, setCommand] = useState("npm run dev");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getPreviewSessions(taskId).then((s) => {
      if (!cancelled) { setSessions(s); setLoading(false); }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [taskId]);

  const handleStart = useCallback(async () => {
    if (!command.trim() || starting) return;
    setStarting(true);
    try {
      await api.startPreview(taskId, command);
      setTimeout(async () => {
        try {
          const s = await api.getPreviewSessions(taskId);
          setSessions(s);
        } catch { /* ignore */ }
        setStarting(false);
      }, 2000);
    } catch {
      setStarting(false);
    }
  }, [taskId, command, starting]);

  const handleStop = useCallback(async (sessionId: string) => {
    try {
      await api.stopPreview(taskId, sessionId);
      const s = await api.getPreviewSessions(taskId);
      setSessions(s);
    } catch { /* ignore */ }
  }, [taskId]);

  const activeSessions = sessions.filter((s) => s.status === "running" || s.status === "starting");

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-medium" style={{ color: "var(--th-text-heading)" }}>
        {t({ ko: "미리보기 서버", en: "Preview Server" })}
      </h4>

      {/* Start command */}
      <div className="flex gap-2">
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder={t({ ko: "미리보기 명령어", en: "Preview command" })}
          className="flex-1 text-[11px] font-mono px-2 py-1.5 rounded bg-transparent outline-none"
          style={{ border: "1px solid var(--th-border)", color: "var(--th-text-primary)" }}
        />
        <button
          onClick={handleStart}
          disabled={!command.trim() || starting}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-blue-600 text-white text-[11px] disabled:opacity-40"
        >
          {starting ? <Loader2 width={12} height={12} className="animate-spin" /> : <Play width={12} height={12} />}
          {t({ ko: "시작", en: "Start" })}
        </button>
      </div>

      {/* Active sessions */}
      {loading ? (
        <div className="flex items-center gap-2 py-4 justify-center text-xs" style={{ color: "var(--th-text-muted)" }}>
          <Loader2 width={14} height={14} className="animate-spin" />
        </div>
      ) : activeSessions.length > 0 ? (
        <div className="space-y-2">
          {activeSessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-2 rounded-lg px-3 py-2"
              style={{ background: "var(--th-bg-surface)", border: "1px solid var(--th-border)" }}
            >
              <div className={`w-2 h-2 rounded-full ${s.status === "running" ? "bg-green-500 animate-pulse" : "bg-yellow-500 animate-pulse"}`} />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-mono truncate" style={{ color: "var(--th-text-secondary)" }}>
                  {s.command}
                </div>
                {s.url && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] mt-0.5 hover:underline"
                    style={{ color: "var(--th-text-accent)" }}
                  >
                    <ExternalLink width={10} height={10} />
                    {s.url}
                  </a>
                )}
              </div>
              <button
                onClick={() => handleStop(s.id)}
                className="p-1 rounded hover:bg-red-500/20 transition-colors"
                style={{ color: "var(--th-text-muted)" }}
              >
                <Square width={14} height={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-4 text-center text-[11px]" style={{ color: "var(--th-text-muted)" }}>
          {t({ ko: "실행 중인 미리보기가 없습니다.", en: "No active preview server." })}
        </div>
      )}
    </div>
  );
}
