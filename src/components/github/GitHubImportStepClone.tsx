import type { GitHubRepo } from '../../api';
import type { I18nContextValue } from '../../i18n';

interface GitHubImportStepCloneProps {
  selectedRepo: GitHubRepo;
  selectedBranch: string;
  creating: boolean;
  cloneStatus: string;
  cloneProgress: number;
  cloneError: string | null;
  projectName: string;
  targetPath: string;
  coreGoal: string;
  t: I18nContextValue['t'];
  onProjectNameChange: (value: string) => void;
  onTargetPathChange: (value: string) => void;
  onCoreGoalChange: (value: string) => void;
  onImport: () => void;
  onBack: () => void;
}

export default function GitHubImportStepClone({
  selectedRepo,
  selectedBranch,
  creating,
  cloneStatus,
  cloneProgress,
  cloneError,
  projectName,
  targetPath,
  coreGoal,
  t,
  onProjectNameChange,
  onTargetPathChange,
  onCoreGoalChange,
  onImport,
  onBack,
}: GitHubImportStepCloneProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-2">
        <p className="text-sm text-white">{selectedRepo.full_name} <span className="text-blue-400">({selectedBranch})</span></p>
      </div>

      <label className="block text-xs text-slate-400">
        {t({ ko: '프로젝트 이름', en: 'Project Name' })}
        <input
          type="text"
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
          disabled={creating}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 disabled:opacity-50"
        />
      </label>

      <label className="block text-xs text-slate-400">
        {t({ ko: '대상 경로', en: 'Target Path' })}
        <input
          type="text"
          value={targetPath}
          onChange={(e) => onTargetPathChange(e.target.value)}
          disabled={creating}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 disabled:opacity-50"
        />
      </label>

      <label className="block text-xs text-slate-400">
        {t({ ko: '핵심 목표 (선택)', en: 'Core Goal (optional)' })}
        <textarea
          rows={3}
          value={coreGoal}
          onChange={(e) => onCoreGoalChange(e.target.value)}
          disabled={creating}
          className="mt-1 w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 disabled:opacity-50"
        />
      </label>

      {/* Progress bar */}
      {(cloneStatus === 'cloning' || cloneStatus === 'done') && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">
              {cloneStatus === 'done'
                ? t({ ko: '완료', en: 'Complete' })
                : t({ ko: '클론 중...', en: 'Cloning...' })}
            </span>
            <span className="text-slate-400">{cloneProgress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${cloneProgress}%` }}
            />
          </div>
        </div>
      )}

      {cloneError && (
        <div className="rounded-lg border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {cloneError}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onImport}
          disabled={creating || !projectName.trim() || !targetPath.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40"
        >
          {creating
            ? t({ ko: '가져오는 중...', en: 'Importing...' })
            : t({ ko: 'GitHub에서 가져오기', en: 'Import from GitHub' })}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={creating}
          className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 disabled:opacity-40"
        >
          {t({ ko: '이전', en: 'Back' })}
        </button>
      </div>
    </div>
  );
}
