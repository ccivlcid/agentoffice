import { useState, useEffect, useCallback } from "react";
import { useI18n } from "../../../i18n";
import * as api from "../../../api";
import type { TestRun, DetectedScript } from "../../../api";
import TestResultCard from "./TestResultCard";
import { Play, Search, Loader2 } from "lucide-react";

interface AutoTestSectionProps {
  taskId: string;
}

export default function AutoTestSection({ taskId }: AutoTestSectionProps) {
  const { t } = useI18n();
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [scripts, setScripts] = useState<DetectedScript[]>([]);
  const [customCmd, setCustomCmd] = useState("");
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getTestRuns(taskId).then((r) => {
      if (!cancelled) { setRuns(r); setLoading(false); }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [taskId]);

  const handleDetect = useCallback(async () => {
    setDetecting(true);
    try {
      const s = await api.detectTestScripts(taskId);
      setScripts(s);
    } catch { /* ignore */ }
    setDetecting(false);
  }, [taskId]);

  const handleRun = useCallback(async (command: string) => {
    if (!command.trim() || running) return;
    setRunning(true);
    try {
      await api.startTestRun(taskId, command);
      // Refresh runs after a short delay
      setTimeout(async () => {
        try {
          const r = await api.getTestRuns(taskId);
          setRuns(r);
        } catch { /* ignore */ }
        setRunning(false);
      }, 1000);
    } catch {
      setRunning(false);
    }
  }, [taskId, running]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium" style={{ color: "var(--th-text-heading)" }}>
          {t({ ko: "자동 테스트", en: "Auto Test" })}
        </h4>
        <button
          onClick={handleDetect}
          disabled={detecting}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded"
          style={{ border: "1px solid var(--th-border)", color: "var(--th-text-accent)" }}
        >
          {detecting ? <Loader2 width={10} height={10} className="animate-spin" /> : <Search width={10} height={10} />}
          {t({ ko: "스크립트 감지", en: "Detect" })}
        </button>
      </div>

      {/* Detected scripts */}
      {scripts.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px]" style={{ color: "var(--th-text-muted)" }}>
            {t({ ko: "감지된 스크립트", en: "Detected Scripts" })}
          </div>
          {scripts.map((s, i) => (
            <button
              key={i}
              onClick={() => handleRun(s.command)}
              disabled={running}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-[11px]"
              style={{ background: "var(--th-bg-surface)", border: "1px solid var(--th-border)", color: "var(--th-text-secondary)" }}
            >
              <Play width={10} height={10} className="shrink-0 text-green-500" />
              <span className="font-mono flex-1 truncate">{s.command}</span>
              <span className="text-[9px]" style={{ color: "var(--th-text-muted)" }}>{s.source}</span>
            </button>
          ))}
        </div>
      )}

      {/* Custom command */}
      <div className="flex gap-2">
        <input
          type="text"
          value={customCmd}
          onChange={(e) => setCustomCmd(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleRun(customCmd); }}
          placeholder={t({ ko: "테스트 명령어 입력...", en: "Enter test command..." })}
          className="flex-1 text-[11px] font-mono px-2 py-1.5 rounded bg-transparent outline-none"
          style={{ border: "1px solid var(--th-border)", color: "var(--th-text-primary)" }}
        />
        <button
          onClick={() => handleRun(customCmd)}
          disabled={!customCmd.trim() || running}
          className="px-2 py-1.5 rounded bg-green-600 text-white text-[11px] disabled:opacity-40"
        >
          {running ? <Loader2 width={12} height={12} className="animate-spin" /> : <Play width={12} height={12} />}
        </button>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center gap-2 py-4 justify-center text-xs" style={{ color: "var(--th-text-muted)" }}>
          <Loader2 width={14} height={14} className="animate-spin" />
        </div>
      ) : runs.length > 0 ? (
        <div className="space-y-2">
          <div className="text-[10px]" style={{ color: "var(--th-text-muted)" }}>
            {t({ ko: "테스트 이력", en: "Test History" })}
          </div>
          {runs.map((run) => (
            <TestResultCard key={run.id} run={run} />
          ))}
        </div>
      ) : (
        <div className="py-4 text-center text-[11px]" style={{ color: "var(--th-text-muted)" }}>
          {t({ ko: "아직 테스트 이력이 없습니다.", en: "No test runs yet." })}
        </div>
      )}
    </div>
  );
}
