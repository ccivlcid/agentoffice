import { useI18n, timeAgo, type CreateTaskDraft, type MissingPathPrompt } from './taskBoardHelpers';
import { X } from 'lucide-react';

// ── Restore Draft Overlay ──────────────────────────────────────────────────────

interface RestorePromptProps {
  restoreCandidates: CreateTaskDraft[];
  selectedRestoreDraft: CreateTaskDraft | null;
  selectedRestoreDraftId: string | null;
  onSelectDraft: (id: string) => void;
  onClose: () => void;
  onLoad: () => void;
  localeTag: string;
}

export function RestorePromptOverlay({
  restoreCandidates, selectedRestoreDraft, selectedRestoreDraftId,
  onSelectDraft, onClose, onLoad, localeTag,
}: RestorePromptProps) {
  const { t } = useI18n();
  const formatTs = (ts: number) =>
    new Intl.DateTimeFormat(localeTag, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(ts));

  if (!selectedRestoreDraft) return null;
  return (
    <div className="fixed inset-0 z-[58] flex items-center justify-center bg-black/65 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-700 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">{t({ ko: '임시 데이터 복구', en: 'Restore Draft' })}</h3>
        </div>
        <div className="space-y-2 px-4 py-4">
          <p className="text-sm text-slate-200">{t({ ko: '기존에 입력하던 데이터가 있습니다. 불러오시겠습니까?', en: 'There is previously entered data. Would you like to load it?' })}</p>
          <p className="text-xs text-slate-400">{t({ ko: '최근 임시 항목 (최대 3개)', en: 'Recent drafts (up to 3)' })}</p>
          <div className="space-y-2">
            {restoreCandidates.map((draft) => (
              <button key={draft.id} type="button" onClick={() => onSelectDraft(draft.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left transition ${selectedRestoreDraftId === draft.id ? 'border-blue-500 bg-blue-500/15' : 'border-slate-700 bg-slate-800/70 hover:bg-slate-800'}`}>
                <p className="truncate text-sm font-semibold text-slate-100">{draft.title || t({ ko: '(제목 없음)', en: '(Untitled)' })}</p>
                <p className="mt-0.5 text-xs text-slate-400">{formatTs(draft.updatedAt)} · {timeAgo(draft.updatedAt, localeTag)}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-700 px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800">
            {t({ ko: '새로 작성', en: 'Start Fresh' })}
          </button>
          <button type="button" onClick={onLoad} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500">
            {t({ ko: '불러오기', en: 'Load' })}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Submit Without Project Overlay ─────────────────────────────────────────────

interface SubmitWithoutProjectProps { onClose: () => void; onConfirm: () => void; }

export function SubmitWithoutProjectOverlay({ onClose, onConfirm }: SubmitWithoutProjectProps) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-[59] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-700 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">{t({ ko: '프로젝트 연결 없이 생성', en: 'Create Without Project' })}</h3>
        </div>
        <div className="space-y-2 px-4 py-4">
          <p className="text-sm text-slate-200">{t({ ko: '프로젝트 연결 없이 업무를 생성하시겠습니까?', en: 'Create this task without a project link?' })}</p>
          <p className="text-xs text-slate-400">{t({ ko: '이 경우 프로젝트 이력에는 집계되지 않습니다.', en: 'It will not appear in project history.' })}</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-700 px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800">
            {t({ ko: '취소', en: 'Cancel' })}
          </button>
          <button type="button" onClick={onConfirm} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500">
            {t({ ko: '계속', en: 'Continue' })}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Missing Path Overlay ───────────────────────────────────────────────────────

interface MissingPathProps { prompt: MissingPathPrompt; submitBusy: boolean; onClose: () => void; onConfirm: () => void; }

export function MissingPathOverlay({ prompt, submitBusy, onClose, onConfirm }: MissingPathProps) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-[59] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-700 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">{t({ ko: '프로젝트 경로 확인', en: 'Confirm Project Path' })}</h3>
        </div>
        <div className="space-y-2 px-4 py-4">
          <p className="text-sm text-slate-200">{t({ ko: '해당 경로가 없습니다. 추가하시겠습니까?', en: 'This path does not exist. Create it now?' })}</p>
          <p className="break-all rounded-md border border-slate-700 bg-slate-800/70 px-2.5 py-2 text-xs text-slate-200">{prompt.normalizedPath}</p>
          {prompt.nearestExistingParent && (
            <p className="text-xs text-slate-400">{t({ ko: `기준 폴더: ${prompt.nearestExistingParent}`, en: `Base folder: ${prompt.nearestExistingParent}` })}</p>
          )}
          {!prompt.canCreate && (
            <p className="text-xs text-amber-300">{t({ ko: '현재 권한으로 해당 경로를 생성할 수 없습니다. 다른 경로를 선택해주세요.', en: 'This path is not creatable with current permissions. Choose another path.' })}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-700 px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800">
            {t({ ko: '취소', en: 'Cancel' })}
          </button>
          <button type="button" disabled={!prompt.canCreate || submitBusy} onClick={onConfirm}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40">
            {t({ ko: '예', en: 'Yes' })}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Manual Path Picker Overlay ─────────────────────────────────────────────────

interface ManualPathPickerProps {
  manualPathCurrent: string;
  manualPathParent: string | null;
  manualPathEntries: { name: string; path: string }[];
  manualPathTruncated: boolean;
  manualPathLoading: boolean;
  manualPathError: string | null;
  onClose: () => void;
  onNavigate: (path: string) => void;
  onSelect: (path: string) => void;
}

export function ManualPathPickerOverlay({
  manualPathCurrent, manualPathParent, manualPathEntries, manualPathTruncated,
  manualPathLoading, manualPathError, onClose, onNavigate, onSelect,
}: ManualPathPickerProps) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">{t({ ko: '앱 내 폴더 탐색', en: 'In-App Folder Browser' })}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white" aria-label={t({ ko: '닫기', en: 'Close' })}><X width={18} height={18} /></button>
        </div>
        <div className="space-y-3 px-4 py-4">
          <div className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2">
            <p className="text-[11px] text-slate-400">{t({ ko: '현재 위치', en: 'Current Location' })}</p>
            <p className="break-all text-xs text-slate-200">{manualPathCurrent || '-'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" disabled={!manualPathParent || manualPathLoading} onClick={() => manualPathParent && onNavigate(manualPathParent)}
              className="rounded-md border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
              {t({ ko: '상위 폴더', en: 'Up' })}
            </button>
            <button type="button" disabled={manualPathLoading} onClick={() => onNavigate(manualPathCurrent || '')}
              className="rounded-md border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
              {t({ ko: '새로고침', en: 'Refresh' })}
            </button>
          </div>
          <div className="max-h-[45dvh] overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/50">
            {manualPathLoading ? (
              <p className="px-3 py-2 text-xs text-slate-400">{t({ ko: '폴더 목록을 불러오는 중...', en: 'Loading directories...' })}</p>
            ) : manualPathError ? (
              <p className="px-3 py-2 text-xs text-rose-300">{manualPathError}</p>
            ) : manualPathEntries.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">{t({ ko: '선택 가능한 하위 폴더가 없습니다.', en: 'No selectable subdirectories.' })}</p>
            ) : (
              manualPathEntries.map((entry) => (
                <button key={entry.path} type="button" onClick={() => onNavigate(entry.path)}
                  className="w-full border-b border-slate-700/70 px-3 py-2 text-left transition hover:bg-slate-700/60">
                  <p className="text-xs font-semibold text-slate-100">{entry.name}</p>
                  <p className="truncate text-[11px] text-slate-400">{entry.path}</p>
                </button>
              ))
            )}
          </div>
          {manualPathTruncated && (
            <p className="text-[11px] text-slate-400">{t({ ko: '항목이 많아 상위 300개 폴더만 표시했습니다.', en: 'Only the first 300 directories are shown.' })}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-700 px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800">
            {t({ ko: '취소', en: 'Cancel' })}
          </button>
          <button type="button" disabled={!manualPathCurrent} onClick={() => onSelect(manualPathCurrent)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40">
            {t({ ko: '현재 폴더 선택', en: 'Select Current Folder' })}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Draft Manager Overlay ──────────────────────────────────────────────────────

interface DraftManagerProps {
  drafts: CreateTaskDraft[];
  onClose: () => void;
  onLoad: (draft: CreateTaskDraft) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  localeTag: string;
}

export function DraftManagerOverlay({ drafts, onClose, onLoad, onDelete, onClearAll, localeTag }: DraftManagerProps) {
  const { t } = useI18n();
  const formatTs = (ts: number) =>
    new Intl.DateTimeFormat(localeTag, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(ts));

  return (
    <div className="fixed inset-0 z-[61] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">{t({ ko: '임시 저장 목록', en: 'Temporary Drafts' })}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white" title={t({ ko: '닫기', en: 'Close' })} aria-label={t({ ko: '닫기', en: 'Close' })}><X width={18} height={18} /></button>
        </div>
        <div className="max-h-[55dvh] space-y-2 overflow-y-auto px-4 py-3">
          {drafts.length === 0 ? (
            <div className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-4 text-center text-sm text-slate-400">
              {t({ ko: '저장된 임시 항목이 없습니다.', en: 'No temporary drafts saved.' })}
            </div>
          ) : (
            drafts.map((draft) => (
              <div key={draft.id} className="rounded-lg border border-slate-700 bg-slate-800/70 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-100">{draft.title || t({ ko: '(제목 없음)', en: '(Untitled)' })}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{formatTs(draft.updatedAt)} · {timeAgo(draft.updatedAt, localeTag)}</p>
                    {draft.description.trim() && <p className="mt-1 line-clamp-2 text-xs text-slate-300">{draft.description}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => onLoad(draft)} className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-blue-500">
                      {t({ ko: '불러오기', en: 'Load' })}
                    </button>
                    <button type="button" onClick={() => onDelete(draft.id)} className="rounded-md border border-red-500/70 px-2.5 py-1 text-xs font-semibold text-red-300 transition hover:bg-red-500/10">
                      {t({ ko: '삭제', en: 'Delete' })}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex justify-end border-t border-slate-700 px-4 py-3">
          <button type="button" onClick={onClearAll} disabled={drafts.length === 0}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
            {t({ ko: '전체 삭제', en: 'Delete All' })}
          </button>
        </div>
      </div>
    </div>
  );
}

