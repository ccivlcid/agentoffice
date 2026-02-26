import type { TaskReportDocument } from '../api';

export const DOCUMENTS_PER_PAGE = 3;

export function fmtTime(ts: number | null | undefined): string {
  if (!ts) return '-';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function elapsed(start: number | null | undefined, end: number | null | undefined): string {
  if (!start || !end) return '-';
  const ms = end - start;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

export function projectNameFromPath(projectPath: string | null | undefined): string {
  if (!projectPath) return 'General';
  const trimmed = projectPath.replace(/[\\/]+$/, '');
  const seg = trimmed.split(/[\\/]/).pop();
  return seg || 'General';
}

export function statusClass(status: string): string {
  if (status === 'done') return 'bg-emerald-500/15 text-emerald-300';
  if (status === 'review') return 'bg-blue-500/15 text-blue-300';
  if (status === 'in_progress') return 'bg-amber-500/15 text-amber-300';
  return 'bg-slate-700/70 text-slate-300';
}

export type TaskReportPopupT = (text: { ko: string; en: string; ja?: string; zh?: string }) => string;

interface TaskReportPopupDocumentsProps {
  documents: TaskReportDocument[];
  scopeKey: string;
  expandedDocs: Record<string, boolean>;
  documentPages: Record<string, number>;
  onToggleDoc: (docId: string) => void;
  setDocumentPages: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
  t: TaskReportPopupT;
}

export function TaskReportPopupDocuments({
  documents,
  scopeKey,
  expandedDocs,
  documentPages,
  onToggleDoc,
  setDocumentPages,
  t,
}: TaskReportPopupDocumentsProps) {
  if (!documents.length) {
    return (
      <p className="text-xs text-slate-500">
        {t({ ko: '문서가 없습니다', en: 'No documents' })}
      </p>
    );
  }

  const totalPages = Math.max(1, Math.ceil(documents.length / DOCUMENTS_PER_PAGE));
  const rawPage = documentPages[scopeKey] ?? 1;
  const currentPage = Math.min(Math.max(rawPage, 1), totalPages);
  const start = (currentPage - 1) * DOCUMENTS_PER_PAGE;
  const visibleDocs = documents.slice(start, start + DOCUMENTS_PER_PAGE);

  return (
    <div className="space-y-2">
      {visibleDocs.map((doc) => {
        const isExpanded = expandedDocs[doc.id] !== false;
        return (
          <div key={doc.id} className="rounded-lg border border-slate-700/60 bg-slate-800/50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-100">{doc.title}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {doc.source}
                  {doc.path ? ` · ${doc.path}` : ''}
                </p>
              </div>
              <button
                onClick={() => onToggleDoc(doc.id)}
                className="rounded-md border border-slate-600 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
              >
                {isExpanded
                  ? t({ ko: '접기', en: 'Collapse' })
                  : t({ ko: '확장', en: 'Expand' })}
              </button>
            </div>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-black/30 p-2 text-[11px] leading-relaxed text-slate-300">
              {isExpanded ? doc.content : doc.text_preview}
            </pre>
          </div>
        );
      })}
      {totalPages > 1 && (
        <div className="mt-1 flex items-center justify-between rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2">
          <button
            type="button"
            onClick={() => setDocumentPages((prev) => ({ ...prev, [scopeKey]: Math.max(1, currentPage - 1) }))}
            disabled={currentPage <= 1}
            className={`rounded-md px-2 py-1 text-[11px] ${
              currentPage <= 1
                ? 'cursor-not-allowed bg-slate-800 text-slate-600'
                : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
            }`}
          >
            {t({ ko: '이전', en: 'Prev' })}
          </button>
          <span className="text-[11px] text-slate-400">
            {t({ ko: `페이지 ${currentPage}/${totalPages}`, en: `Page ${currentPage}/${totalPages}`, ja: `ページ ${currentPage}/${totalPages}`, zh: `第 ${currentPage}/${totalPages} 页` })}
          </span>
          <button
            type="button"
            onClick={() => setDocumentPages((prev) => ({ ...prev, [scopeKey]: Math.min(totalPages, currentPage + 1) }))}
            disabled={currentPage >= totalPages}
            className={`rounded-md px-2 py-1 text-[11px] ${
              currentPage >= totalPages
                ? 'cursor-not-allowed bg-slate-800 text-slate-600'
                : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
            }`}
          >
            {t({ ko: '다음', en: 'Next' })}
          </button>
        </div>
      )}
    </div>
  );
}
