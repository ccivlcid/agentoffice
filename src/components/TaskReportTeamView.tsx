import type { TaskReportTeamSection } from '../api';
import type { UiLanguage } from '../i18n';
import { fmtTime, statusClass, TaskReportPopupDocuments } from './TaskReportPopupHelpers';
import type { TaskReportPopupT } from './TaskReportPopupHelpers';

interface Props {
  team: TaskReportTeamSection;
  expandedDocs: Record<string, boolean>;
  documentPages: Record<string, number>;
  onToggleDoc: (docId: string) => void;
  setDocumentPages: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
  uiLanguage: UiLanguage;
  t: TaskReportPopupT;
}

export default function TaskReportTeamView({
  team,
  expandedDocs,
  documentPages,
  onToggleDoc,
  setDocumentPages,
  uiLanguage,
  t,
}: Props) {
  const teamName = uiLanguage === 'ko'
    ? (team.department_name_ko || team.department_name)
    : team.department_name;
  const teamAgent = uiLanguage === 'ko'
    ? (team.agent_name_ko || team.agent_name)
    : team.agent_name;
  const logs = team.logs ?? [];
  const keyLogs = logs
    .filter((lg) => lg.kind === 'system' || lg.message.includes('Status'))
    .slice(-20);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-700/60 bg-slate-800/50 p-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-white">{team.title}</p>
          <span className={`rounded px-2 py-0.5 text-[11px] ${statusClass(team.status)}`}>{team.status}</span>
        </div>
        <p className="text-xs text-slate-400">
          {teamName} · {teamAgent || '-'}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {t({ ko: '완료', en: 'Completed' })}: {fmtTime(team.completed_at)}
        </p>
        <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-300">{team.summary || '-'}</p>
      </div>

      {team.linked_subtasks.length > 0 && (
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
            {t({ ko: '연결된 서브태스크', en: 'Linked Subtasks' })}
          </p>
          <div className="space-y-1.5">
            {team.linked_subtasks.map((st) => (
              <div key={st.id} className="flex items-center justify-between gap-2 rounded bg-slate-800/70 px-2 py-1.5 text-[11px]">
                <span className="min-w-0 flex-1 truncate text-slate-300">{st.title}</span>
                <span className={`rounded px-1.5 py-0.5 ${statusClass(st.status)}`}>{st.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
          {t({ ko: '팀 문서', en: 'Team Documents' })}
        </p>
        <TaskReportPopupDocuments
          documents={team.documents ?? []}
          scopeKey={`team:${team.id}`}
          expandedDocs={expandedDocs}
          documentPages={documentPages}
          onToggleDoc={onToggleDoc}
          setDocumentPages={setDocumentPages}
          t={t}
        />
      </div>

      {keyLogs.length > 0 && (
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
            {t({ ko: '진행 로그', en: 'Progress Logs' })}
          </p>
          <div className="space-y-1">
            {keyLogs.map((lg, idx) => (
              <div key={`${lg.created_at}-${idx}`} className="text-[11px] text-slate-400">
                <span className="mr-2 text-slate-500">{fmtTime(lg.created_at)}</span>
                {lg.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
