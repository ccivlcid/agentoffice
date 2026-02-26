import type { TaskReportDetail } from '../api';
import { fmtTime, TaskReportPopupDocuments } from './TaskReportPopupHelpers';
import type { TaskReportPopupT } from './TaskReportPopupHelpers';

interface Props {
  planningSummary: TaskReportDetail['planning_summary'];
  expandedDocs: Record<string, boolean>;
  documentPages: Record<string, number>;
  refreshingArchive: boolean;
  onRefresh: () => void;
  onToggleDoc: (docId: string) => void;
  setDocumentPages: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
  t: TaskReportPopupT;
}

export default function TaskReportPlanningSummary({
  planningSummary,
  expandedDocs,
  documentPages,
  refreshingArchive,
  onRefresh,
  onToggleDoc,
  setDocumentPages,
  t,
}: Props) {
  const planningDocs = planningSummary?.documents ?? [];

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-emerald-300">
            {t({ ko: '기획팀장 최종 취합본', en: 'Planning Lead Consolidated Summary' })}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={refreshingArchive}
              className={`rounded-md border px-2 py-1 text-[11px] ${
                refreshingArchive
                  ? 'cursor-not-allowed border-emerald-500/20 bg-emerald-500/10 text-emerald-300/70'
                  : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
              }`}
            >
              {refreshingArchive
                ? t({ ko: '갱신 중...', en: 'Refreshing...' })
                : t({ ko: '취합 갱신', en: 'Refresh Consolidation' })}
            </button>
            <span className="text-[11px] text-emerald-400">{fmtTime(planningSummary?.generated_at)}</span>
          </div>
        </div>
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-emerald-100">
          {planningSummary?.content || t({ ko: '요약 내용이 없습니다', en: 'No summary text' })}
        </pre>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
          {t({ ko: '문서 원문', en: 'Source Documents' })}
        </p>
        <TaskReportPopupDocuments
          documents={planningDocs}
          scopeKey="planning"
          expandedDocs={expandedDocs}
          documentPages={documentPages}
          onToggleDoc={onToggleDoc}
          setDocumentPages={setDocumentPages}
          t={t}
        />
      </div>
    </div>
  );
}
