import { useState, useEffect } from "react";
import { useI18n } from "../../i18n";
import * as api from "../../api";
import type { MeetingMinute } from "../../types";
import { Loader2, Users, MessageCircle } from "lucide-react";
import { timeAgo } from "../task-board/taskBoardHelpers";

interface DeliverableMinutesTabProps {
  taskId: string;
}

/** Speaker color palette */
const SPEAKER_COLORS = ["#60a5fa", "#34d399", "#f472b6", "#fbbf24", "#a78bfa", "#fb923c"];

export default function DeliverableMinutesTab({ taskId }: DeliverableMinutesTabProps) {
  const { t, locale } = useI18n();
  const [minutes, setMinutes] = useState<MeetingMinute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getTaskMeetingMinutes(taskId).then((m) => {
      if (!cancelled) { setMinutes(m); setLoading(false); }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [taskId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center text-xs" style={{ color: "var(--th-text-muted)" }}>
        <Loader2 width={14} height={14} className="animate-spin" />
        {t({ ko: "회의록 로딩 중...", en: "Loading minutes..." })}
      </div>
    );
  }

  if (minutes.length === 0) {
    return (
      <div className="dlv-empty">
        <div className="dlv-empty-icon"><Users width={20} height={20} /></div>
        <p className="dlv-empty-text">{t({ ko: "회의록이 없습니다", en: "No meeting minutes" })}</p>
      </div>
    );
  }

  // Collect unique speaker names across all meetings for consistent coloring
  const speakerColorMap = new Map<string, string>();
  let colorIdx = 0;
  for (const m of minutes) {
    if (m.entries) {
      for (const e of m.entries) {
        if (!speakerColorMap.has(e.speaker_name)) {
          speakerColorMap.set(e.speaker_name, SPEAKER_COLORS[colorIdx % SPEAKER_COLORS.length]);
          colorIdx++;
        }
      }
    }
  }

  return (
    <div className="space-y-4">
      {minutes.map((m) => (
        <div key={m.id} className="space-y-2">
          {/* Meeting header */}
          <div className="flex items-center gap-2 px-1">
            <Users width={12} height={12} style={{ color: "var(--th-text-accent)" }} />
            <span className="text-xs font-semibold" style={{ color: "var(--th-text-heading)" }}>
              {m.meeting_type ?? t({ ko: "회의", en: "Meeting" })}
              {m.round ? ` R${m.round}` : ""}
            </span>
            <span className="text-[10px]" style={{ color: "var(--th-text-muted)" }}>
              {timeAgo(m.started_at ?? m.created_at, locale)}
            </span>
          </div>

          {/* Entries as chat bubbles */}
          {m.entries && m.entries.length > 0 && (
            <div className="space-y-1.5 pl-1">
              {m.entries.map((entry) => {
                const speakerColor = speakerColorMap.get(entry.speaker_name) ?? "#94a3b8";
                return (
                  <div key={entry.id} className="dlv-bubble">
                    <div className="flex items-center gap-1.5 mb-1">
                      <MessageCircle width={10} height={10} style={{ color: speakerColor }} />
                      <span className="dlv-bubble-speaker" style={{ color: speakerColor }}>
                        {entry.speaker_name}
                      </span>
                    </div>
                    <div className="dlv-bubble-content">{entry.content}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
