import { useCallback, useState, useMemo } from "react";
import { useI18n } from "../i18n";
import type { OfficeViewProps } from "./office-view/officeViewTypes";
import { LOCALE_TEXT } from "./office-view/officeViewPalette";
import OfficeGrid from "./office-view/card/OfficeGrid";
import { Users, FileText } from "lucide-react";

/* re-export type so other modules can still import it */
export type { OfficeViewProps };

export default function OfficeView(props: OfficeViewProps) {
  const { t } = useI18n();

  const unreadSet = props.unreadAgentIds ?? new Set<string>();
  const teamLeaders = useMemo(() => props.agents.filter((a) => a.role === "team_leader"), [props.agents]);
  const [showNoTeamLeadersAlert, setShowNoTeamLeadersAlert] = useState(false);
  const hasConveneCallback = typeof props.onConveneTeamLeaderMeeting === "function";
  const hasAgentManagerCallback = typeof props.onOpenAgentManager === "function";

  const handleConveneClick = useCallback(() => {
    if (teamLeaders.length === 0) {
      setShowNoTeamLeadersAlert(true);
      return;
    }
    props.onConveneTeamLeaderMeeting?.();
  }, [teamLeaders.length, props.onConveneTeamLeaderMeeting]);

  return (
    <div className="w-full overflow-auto" style={{ minHeight: "100%" }}>
      <header className="border-b border-slate-600/30 bg-slate-900/40 px-4 py-4 backdrop-blur-md">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-100">{t(LOCALE_TEXT.officeCardTitle)}</h2>
            <p className="mt-1 text-xs text-slate-400" aria-hidden>
              {t(LOCALE_TEXT.officeCardSubtitle)}
            </p>
          </div>
          {hasConveneCallback && (
            <button
              type="button"
              onClick={handleConveneClick}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/25 hover:border-cyan-400/60"
              aria-label={t(LOCALE_TEXT.conveneTeamLeaderMeetingA11y)}
            >
              <Users width={16} height={16} aria-hidden />
              {t(LOCALE_TEXT.conveneTeamLeaderMeeting)}
              {teamLeaders.length > 0 && (
                <span className="rounded bg-cyan-500/30 px-1.5 py-0.5 text-[10px] font-bold">{teamLeaders.length}</span>
              )}
            </button>
          )}
        </div>
        {showNoTeamLeadersAlert && teamLeaders.length === 0 && hasConveneCallback && (
          <div
            className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
            role="alert"
          >
            <span>
              {t(LOCALE_TEXT.noTeamLeaders)} {t(LOCALE_TEXT.noTeamLeadersHint)}
            </span>
            {hasAgentManagerCallback && (
              <button
                type="button"
                onClick={() => {
                  setShowNoTeamLeadersAlert(false);
                  props.onOpenAgentManager?.();
                }}
                className="rounded border border-amber-400/50 bg-amber-500/20 px-2.5 py-1 font-semibold transition hover:bg-amber-500/30"
              >
                {t(LOCALE_TEXT.openAgentManager)}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowNoTeamLeadersAlert(false)}
              className="ml-auto rounded px-2 py-1 text-amber-300/80 hover:bg-amber-500/20"
              aria-label={t(LOCALE_TEXT.dismiss)}
            >
              ×
            </button>
          </div>
        )}
        {props.activeMeetingTaskId &&
          props.onOpenActiveMeetingMinutes &&
          (() => {
            const meetingTask = props.tasks.find((tk) => tk.id === props.activeMeetingTaskId);
            const taskTitle = meetingTask?.title ?? props.activeMeetingTaskId;
            return (
              <div
                className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200"
                role="status"
              >
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                  {t(LOCALE_TEXT.meetingLiveBanner)} — {taskTitle}
                </span>
                <button
                  type="button"
                  onClick={() => props.onOpenActiveMeetingMinutes!(props.activeMeetingTaskId!)}
                  className="ml-auto inline-flex items-center gap-1.5 rounded border border-cyan-400/50 bg-cyan-500/20 px-2.5 py-1 font-semibold transition hover:bg-cyan-500/30"
                >
                  <FileText width={12} height={12} aria-hidden />
                  {t(LOCALE_TEXT.viewMeetingMinutes)}
                </button>
              </div>
            );
          })()}
      </header>

      <div className="p-4 sm:p-5">
        <OfficeGrid
          departments={props.departments}
          agents={props.agents}
          tasks={props.tasks}
          unreadAgentIds={unreadSet}
          meetingPresence={props.meetingPresence}
          t={t}
          onSelectAgent={props.onSelectAgent}
          onSelectDepartment={props.onSelectDepartment}
          onHireAgent={props.onHireAgent}
          onMoveAgent={props.onMoveAgent}
        />
      </div>
    </div>
  );
}
