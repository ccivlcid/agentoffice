import type { GitHubRepo, GitHubBranch } from '../../api';
import type { I18nContextValue } from '../../i18n';

interface GitHubImportStepBranchProps {
  selectedRepo: GitHubRepo;
  branches: GitHubBranch[];
  branchesLoading: boolean;
  branchError: string | null;
  patToken: string;
  patLoading: boolean;
  t: I18nContextValue['t'];
  onBranchSelect: (branchName: string) => void;
  onPatChange: (value: string) => void;
  onPatRetry: () => void;
}

export default function GitHubImportStepBranch({
  selectedRepo,
  branches,
  branchesLoading,
  branchError,
  patToken,
  patLoading,
  t,
  onBranchSelect,
  onPatChange,
  onPatRetry,
}: GitHubImportStepBranchProps) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-2">
        <p className="text-sm font-medium text-white">{selectedRepo.full_name}</p>
        {selectedRepo.description && <p className="text-xs text-slate-400">{selectedRepo.description}</p>}
      </div>
      <h4 className="text-xs font-semibold text-slate-300">
        {t({ ko: '브랜치 선택', en: 'Select Branch' })}
      </h4>
      {branchError && (
        <div className="space-y-3">
          <div className="rounded-lg border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {branchError}
          </div>
          {/* PAT input for private repos */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-900/10 p-3 space-y-2">
            <p className="text-xs font-medium text-amber-300">
              {t({
                ko: 'Personal Access Token (PAT)으로 인증',
                en: 'Authenticate with Personal Access Token (PAT)',
})}
            </p>
            <p className="text-[11px] text-slate-400">
              {t({
                ko: 'GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens에서 해당 리포 접근 권한이 있는 토큰을 생성하세요.',
                en: 'Go to GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens and create a token with access to this repo.',
})}
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="ghp_xxxx... or github_pat_xxxx..."
                value={patToken}
                onChange={(e) => onPatChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && patToken.trim()) onPatRetry(); }}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={onPatRetry}
                disabled={!patToken.trim() || patLoading}
                className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-40"
              >
                {patLoading
                  ? t({ ko: '확인 중...', en: 'Verifying...' })
                  : t({ ko: '인증', en: 'Authenticate' })}
              </button>
            </div>
          </div>
        </div>
      )}
      {branchesLoading ? (
        <p className="text-xs text-slate-400">{t({ ko: '불러오는 중...', en: 'Loading...' })}</p>
      ) : branches.length === 0 && !branchError ? (
        <p className="text-xs text-slate-500">{t({ ko: '브랜치 없음', en: 'No branches' })}</p>
      ) : (
        <div className="space-y-1">
          {branches.map((b) => (
            <button
              key={b.name}
              type="button"
              onClick={() => onBranchSelect(b.name)}
              className={`w-full rounded-lg border px-4 py-2.5 text-left transition ${
                b.is_default
                  ? 'border-blue-500/50 bg-blue-900/20 hover:bg-blue-900/30'
                  : 'border-slate-700/70 bg-slate-800/60 hover:border-blue-500/70 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-white">{b.name}</span>
                {b.is_default && (
                  <span className="rounded bg-blue-600/30 px-1.5 py-0.5 text-[10px] font-medium text-blue-300">default</span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">{b.sha?.slice(0, 8)}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
