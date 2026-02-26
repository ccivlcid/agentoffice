import type { GitHubRepo } from '../../api';
import type { I18nContextValue } from '../../i18n';

interface GitHubImportStepRepoProps {
  repos: GitHubRepo[];
  reposLoading: boolean;
  directInput: string;
  directInputError: string | null;
  repoSearch: string;
  t: I18nContextValue['t'];
  onRepoSelect: (repo: GitHubRepo) => void;
  onDirectInputChange: (value: string) => void;
  onDirectInputSubmit: () => void;
  onRepoSearchChange: (value: string) => void;
}

export default function GitHubImportStepRepo({
  repos,
  reposLoading,
  directInput,
  directInputError,
  repoSearch,
  t,
  onRepoSelect,
  onDirectInputChange,
  onDirectInputSubmit,
  onRepoSearchChange,
}: GitHubImportStepRepoProps) {
  return (
    <div className="space-y-3">
      {/* Direct repo input */}
      <div className="rounded-xl border border-slate-600/50 bg-slate-800/40 p-3 space-y-2">
        <p className="text-xs font-medium text-slate-300">
          {t({ ko: '직접 입력 (Private 리포 포함)', en: 'Direct Input (incl. private repos)' })}
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={t({ ko: 'owner/repo 또는 GitHub URL', en: 'owner/repo or GitHub URL' })}
            value={directInput}
            onChange={(e) => { onDirectInputChange(e.target.value); }}
            onKeyDown={(e) => { if (e.key === 'Enter') onDirectInputSubmit(); }}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={onDirectInputSubmit}
            disabled={!directInput.trim()}
            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40"
          >
            {t({ ko: '이동', en: 'Go' })}
          </button>
        </div>
        {directInputError && (
          <p className="text-[11px] text-rose-300">{directInputError}</p>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-slate-700" />
        <span className="text-[11px] text-slate-500">{t({ ko: '또는 목록에서 선택', en: 'or select from list' })}</span>
        <div className="flex-1 border-t border-slate-700" />
      </div>

      <input
        type="text"
        placeholder={t({ ko: '리포지토리 검색...', en: 'Search repositories...' })}
        value={repoSearch}
        onChange={(e) => onRepoSearchChange(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
      />
      {reposLoading ? (
        <p className="text-xs text-slate-400">{t({ ko: '불러오는 중...', en: 'Loading...' })}</p>
      ) : repos.length === 0 ? (
        <p className="text-xs text-slate-500">{t({ ko: '검색 결과 없음', en: 'No results' })}</p>
      ) : (
        <div className="space-y-1">
          {repos.map((repo) => (
            <button
              key={repo.id}
              type="button"
              onClick={() => onRepoSelect(repo)}
              className="w-full rounded-lg border border-slate-700/70 bg-slate-800/60 px-4 py-3 text-left transition hover:border-blue-500/70 hover:bg-slate-800"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{repo.full_name}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${repo.private ? 'bg-amber-600/20 text-amber-300' : 'bg-emerald-600/20 text-emerald-300'}`}>
                  {repo.private ? 'Private' : 'Public'}
                </span>
              </div>
              {repo.description && <p className="mt-1 truncate text-xs text-slate-400">{repo.description}</p>}
              <p className="mt-1 text-[11px] text-slate-500">
                {t({ ko: '기본 브랜치', en: 'Default' })}: {repo.default_branch} · {new Date(repo.updated_at).toLocaleDateString()}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
