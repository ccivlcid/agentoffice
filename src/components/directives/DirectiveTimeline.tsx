import { useState, useEffect } from "react";
import { useI18n } from "../../i18n";
import { timeAgo } from "../task-board/taskBoardHelpers";
import * as api from "../../api";
import type { TaskTimelineEvent } from "../../api";
import { Clock, Loader2 } from "lucide-react";

interface DirectiveTimelineProps {
  taskId: string;
}

export default function DirectiveTimeline({ taskId }: DirectiveTimelineProps) {
  const { t, locale } = useI18n();
  const [events, setEvents] = useState<TaskTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getTaskTimeline(taskId).then((evts) => {
      if (!cancelled) {
        setEvents(evts);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [taskId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 justify-center text-xs" style={{ color: "var(--th-text-muted)" }}>
        <Loader2 width={14} height={14} className="animate-spin" />
        {t({ ko: "로딩 중...", en: "Loading..." })}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="py-4 text-center text-xs" style={{ color: "var(--th-text-muted)" }}>
        {t({ ko: "타임라인 이벤트가 없습니다.", en: "No timeline events." })}
      </div>
    );
  }

  return (
    <div className="relative pl-4">
      <div
        className="absolute left-[7px] top-2 bottom-2 w-px"
        style={{ background: "var(--th-border)" }}
      />
      <div className="space-y-3">
        {events.map((ev) => (
          <div key={ev.id} className="relative flex gap-3">
            <div
              className="absolute left-[-13px] top-1 w-2.5 h-2.5 rounded-full border-2"
              style={{
                background: "var(--th-bg-surface)",
                borderColor: ev.kind === "status_change" ? "#60a5fa" : "var(--th-border)",
              }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs" style={{ color: "var(--th-text-secondary)" }}>
                {ev.message}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[10px]" style={{ color: "var(--th-text-muted)" }}>
                <Clock width={10} height={10} />
                <span>{timeAgo(ev.created_at, locale)}</span>
                {ev.agent_name && (
                  <>
                    <span>·</span>
                    <span>{ev.agent_name}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
