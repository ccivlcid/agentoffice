import { useState, useCallback, useEffect } from 'react';
import { getTaskDiff, mergeTask, discardTask, type TaskDiffResult } from '../../api';
import { useI18n } from './taskBoardHelpers';

export function DiffModal({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { t } = useI18n();
  const [diffData, setDiffData] = useState<TaskDiffResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);

  useEffect(() => {
    getTaskDiff(taskId)
      .then((d) => {
        if (!d.ok) setError(d.error || t({ ko: '알 수 없는 오류', en: 'Unknown error' }));
        else setDiffData(d);
        setLoading(false);
      })
      .catch((e) => { setError(e instanceof Error ? e.message : String(e)); setLoading(false); });
  }, [taskId, t]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleMerge = useCallback(async () => {
    if (!confirm(t({
      ko: '이 브랜치를 메인에 병합하시겠습니까?',
      en: 'Merge this branch into main?',
}))) return;
    setMerging(true);
    try {
      const result = await mergeTask(taskId);
      setActionResult(
        result.ok
          ? `${t({ ko: '병합 완료', en: 'Merge completed' })}: ${result.message}`
          : `${t({ ko: '병합 실패', en: 'Merge failed' })}: ${result.message}`,
      );
      if (result.ok) setTimeout(onClose, 1500);
    } catch (e: unknown) {
      setActionResult(`${t({ ko: '오류', en: 'Error' })}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setMerging(false);
    }
  }, [taskId, onClose, t]);

  const handleDiscard = useCallback(async () => {
    if (!confirm(t({
      ko: '이 브랜치의 변경사항을 모두 폐기하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
      en: 'Discard all changes in this branch? This action cannot be undone.',
}))) return;
    setDiscarding(true);
    try {
      const result = await discardTask(taskId);
      setActionResult(
        result.ok
          ? t({ ko: '브랜치가 폐기되었습니다.', en: 'Branch was discarded.' })
          : `${t({ ko: '폐기 실패', en: 'Discard failed' })}: ${result.message}`,
      );
      if (result.ok) setTimeout(onClose, 1500);
    } catch (e: unknown) {
      setActionResult(`${t({ ko: '오류', en: 'Error' })}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDiscarding(false);
    }
  }, [taskId, onClose, t]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">
              {t({ ko: 'Git 변경사항', en: 'Git Diff' })}
            </span>
            {diffData?.branchName && (
              <span className="rounded-full bg-purple-900 px-2.5 py-0.5 text-xs text-purple-300">
                {diffData.branchName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleMerge} disabled={merging || discarding || !diffData?.hasWorktree}
              className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-green-600 disabled:opacity-40">
              {merging ? '...' : t({ ko: '병합', en: 'Merge' })}
            </button>
            <button onClick={handleDiscard} disabled={merging || discarding || !diffData?.hasWorktree}
              className="rounded-lg bg-red-800 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-40">
              {discarding ? '...' : t({ ko: '폐기', en: 'Discard' })}
            </button>
            <button onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              title={t({ ko: '닫기', en: 'Close' })}>
              X
            </button>
          </div>
        </div>

        {actionResult && (
          <div className="border-b border-slate-700 bg-slate-800 px-5 py-2 text-sm text-amber-300">{actionResult}</div>
        )}

        <div className="flex-1 overflow-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              {t({ ko: '변경사항 불러오는 중...', en: 'Loading diff...' })}
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12 text-red-400">
              {t({ ko: '오류', en: 'Error' })}: {error}
            </div>
          ) : !diffData?.hasWorktree ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              {t({
                ko: '이 작업의 워크트리를 찾을 수 없습니다. (Git 프로젝트 아님 또는 이미 병합됨)',
                en: 'No worktree found for this task (non-git project or already merged)',
})}
            </div>
          ) : (
            <div className="space-y-4">
              {diffData.stat && (
                <div>
                  <h3 className="mb-1 text-sm font-semibold text-slate-300">
                    {t({ ko: '요약', en: 'Summary' })}
                  </h3>
                  <pre className="rounded-lg bg-slate-800 p-3 text-xs text-slate-300 overflow-x-auto">{diffData.stat}</pre>
                </div>
              )}
              {diffData.diff && (
                <div>
                  <h3 className="mb-1 text-sm font-semibold text-slate-300">
                    {t({ ko: 'Diff', en: 'Diff' })}
                  </h3>
                  <pre className="max-h-[50vh] overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-relaxed">
                    {diffData.diff.split('\n').map((line, i) => {
                      let cls = 'text-slate-400';
                      if (line.startsWith('+') && !line.startsWith('+++')) cls = 'text-green-400';
                      else if (line.startsWith('-') && !line.startsWith('---')) cls = 'text-red-400';
                      else if (line.startsWith('@@')) cls = 'text-cyan-400';
                      else if (line.startsWith('diff ') || line.startsWith('index ')) cls = 'text-slate-500 font-bold';
                      return <span key={i} className={cls}>{line}{'\n'}</span>;
                    })}
                  </pre>
                </div>
              )}
              {!diffData.stat && !diffData.diff && (
                <div className="text-center text-slate-500 py-8">
                  {t({ ko: '변경사항이 없습니다', en: 'No changes detected' })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
