import { useI18n } from '../../i18n';
import type { ManualPathEntry, MissingPathPrompt } from './projectManagerHelpers';
import { X } from 'lucide-react';

interface MissingPathDialogProps {
  missingPathPrompt: MissingPathPrompt;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function MissingPathDialog({ missingPathPrompt, saving, onCancel, onConfirm }: MissingPathDialogProps) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-700 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">
            {t({ ko: '프로젝트 경로 확인', en: 'Confirm Project Path' })}
          </h3>
        </div>
        <div className="space-y-2 px-4 py-4">
          <p className="text-sm text-slate-200">
            {t({
              ko: '해당 경로가 없습니다. 추가하시겠습니까?',
              en: 'This path does not exist. Create it now?',
})}
          </p>
          <p className="break-all rounded-md border border-slate-700 bg-slate-800/70 px-2.5 py-2 text-xs text-slate-200">
            {missingPathPrompt.normalizedPath}
          </p>
          {missingPathPrompt.nearestExistingParent && (
            <p className="text-xs text-slate-400">
              {t({
                ko: `기준 폴더: ${missingPathPrompt.nearestExistingParent}`,
                en: `Base folder: ${missingPathPrompt.nearestExistingParent}`,
                ja: `基準フォルダ: ${missingPathPrompt.nearestExistingParent}`,
                zh: `基准目录：${missingPathPrompt.nearestExistingParent}`,
              })}
            </p>
          )}
          {!missingPathPrompt.canCreate && (
            <p className="text-xs text-amber-300">
              {t({
                ko: '현재 권한으로 해당 경로를 생성할 수 없습니다. 다른 경로를 선택해주세요.',
                en: 'This path is not creatable with current permissions. Choose another path.',
})}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-700 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            {t({ ko: '취소', en: 'Cancel' })}
          </button>
          <button
            type="button"
            disabled={!missingPathPrompt.canCreate || saving}
            onClick={onConfirm}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t({ ko: '예', en: 'Yes' })}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ManualPathPickerProps {
  manualPathCurrent: string;
  manualPathParent: string | null;
  manualPathEntries: ManualPathEntry[];
  manualPathTruncated: boolean;
  manualPathLoading: boolean;
  manualPathError: string | null;
  onClose: () => void;
  onNavigate: (path?: string) => void;
  onSelectCurrent: () => void;
}

export function ManualPathPicker({
  manualPathCurrent,
  manualPathParent,
  manualPathEntries,
  manualPathTruncated,
  manualPathLoading,
  manualPathError,
  onClose,
  onNavigate,
  onSelectCurrent,
}: ManualPathPickerProps) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">
            {t({ ko: '앱 내 폴더 탐색', en: 'In-App Folder Browser' })}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label={t({ ko: '닫기', en: 'Close' })}
          >
            <X width={18} height={18} />
          </button>
        </div>
        <div className="space-y-3 px-4 py-4">
          <div className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2">
            <p className="text-[11px] text-slate-400">
              {t({ ko: '현재 위치', en: 'Current Location' })}
            </p>
            <p className="break-all text-xs text-slate-200">{manualPathCurrent || '-'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!manualPathParent || manualPathLoading}
              onClick={() => { if (manualPathParent) onNavigate(manualPathParent); }}
              className="rounded-md border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t({ ko: '상위 폴더', en: 'Up' })}
            </button>
            <button
              type="button"
              disabled={manualPathLoading}
              onClick={() => onNavigate(manualPathCurrent || undefined)}
              className="rounded-md border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t({ ko: '새로고침', en: 'Refresh' })}
            </button>
          </div>
          <div className="max-h-[45dvh] overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/50">
            {manualPathLoading ? (
              <p className="px-3 py-2 text-xs text-slate-400">
                {t({ ko: '폴더 목록을 불러오는 중...', en: 'Loading directories...' })}
              </p>
            ) : manualPathError ? (
              <p className="px-3 py-2 text-xs text-rose-300">{manualPathError}</p>
            ) : manualPathEntries.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">
                {t({ ko: '선택 가능한 하위 폴더가 없습니다.', en: 'No selectable subdirectories.' })}
              </p>
            ) : (
              manualPathEntries.map((entry) => (
                <button
                  key={entry.path}
                  type="button"
                  onClick={() => onNavigate(entry.path)}
                  className="w-full border-b border-slate-700/70 px-3 py-2 text-left transition hover:bg-slate-700/60"
                >
                  <p className="text-xs font-semibold text-slate-100">{entry.name}</p>
                  <p className="truncate text-[11px] text-slate-400">{entry.path}</p>
                </button>
              ))
            )}
          </div>
          {manualPathTruncated && (
            <p className="text-[11px] text-slate-400">
              {t({ ko: '항목이 많아 상위 300개 폴더만 표시했습니다.', en: 'Only the first 300 directories are shown.' })}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-700 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            {t({ ko: '취소', en: 'Cancel' })}
          </button>
          <button
            type="button"
            disabled={!manualPathCurrent}
            onClick={onSelectCurrent}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t({ ko: '현재 폴더 선택', en: 'Select Current Folder' })}
          </button>
        </div>
      </div>
    </div>
  );
}
