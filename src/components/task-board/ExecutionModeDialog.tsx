import { useState, useEffect } from 'react';
import { getTaskGitInfo, type TaskGitInfo } from '../../api';
import { useI18n } from './taskBoardHelpers';

interface Props {
  taskId: string;
  onConfirm: (mode: string) => void;
  onCancel: () => void;
}

export function ExecutionModeDialog({ taskId, onConfirm, onCancel }: Props) {
  const { t } = useI18n();
  const [gitInfo, setGitInfo] = useState<TaskGitInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<'worktree' | 'direct'>('worktree');

  useEffect(() => {
    getTaskGitInfo(taskId)
      .then((info) => {
        setGitInfo(info);
        if (!info.is_git_repo) {
          onConfirm('direct');
        }
        setLoading(false);
      })
      .catch(() => {
        onConfirm('direct');
      });
  }, [taskId, onConfirm]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  if (loading || !gitInfo || !gitInfo.is_git_repo) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="rounded-2xl border border-slate-700 bg-slate-900 px-8 py-6 shadow-2xl">
          <span className="text-slate-400">
            {t({ ko: '프로젝트 정보 확인 중...', en: 'Checking project info...' })}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
          <span className="text-lg font-bold text-white">
            {t({ ko: '실행 모드 선택', en: 'Execution Mode' })}
          </span>
          <button
            onClick={onCancel}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            title={t({ ko: '닫기', en: 'Close' })}
          >
            X
          </button>
        </div>

        <div className="space-y-3 p-5">
          {/* Git Worktree option */}
          <button
            onClick={() => setSelected('worktree')}
            className={`w-full rounded-xl border p-4 text-left transition ${
              selected === 'worktree'
                ? 'border-blue-500 bg-blue-950/40'
                : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                selected === 'worktree' ? 'border-blue-500' : 'border-slate-600'
              }`}>
                {selected === 'worktree' && <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">
                  {t({ ko: 'Git Worktree (격리 브랜치)', en: 'Git Worktree (isolated branch)' })}
                </div>
                <div className="mt-1 space-y-0.5 text-xs text-slate-400">
                  {gitInfo.current_branch && (
                    <div>
                      {t({ ko: '브랜치', en: 'Branch' })}: <span className="text-purple-400">{gitInfo.current_branch}</span>
                    </div>
                  )}
                  {gitInfo.remote_url && (
                    <div>
                      {t({ ko: '리모트', en: 'Remote' })}: <span className="text-slate-300">{gitInfo.remote_url}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </button>

          {/* Local Directory option */}
          <button
            onClick={() => setSelected('direct')}
            className={`w-full rounded-xl border p-4 text-left transition ${
              selected === 'direct'
                ? 'border-green-500 bg-green-950/40'
                : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                selected === 'direct' ? 'border-green-500' : 'border-slate-600'
              }`}>
                {selected === 'direct' && <div className="h-2.5 w-2.5 rounded-full bg-green-500" />}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">
                  {t({ ko: '로컬 디렉토리 (직접 수정)', en: 'Local Directory (direct edit)' })}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {t({ ko: '경로', en: 'Path' })}: <span className="text-slate-300">{gitInfo.project_path}</span>
                </div>
              </div>
            </div>
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-700 px-5 py-3">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-1.5 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            {t({ ko: '취소', en: 'Cancel' })}
          </button>
          <button
            onClick={() => onConfirm(selected)}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-blue-500"
          >
            {t({ ko: '실행', en: 'Run' })}
          </button>
        </div>
      </div>
    </div>
  );
}
