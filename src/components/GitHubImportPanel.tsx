import { useI18n } from '../i18n';
import GitHubDeviceConnect from './github/GitHubDeviceConnect';
import GitHubImportStepRepo from './github/GitHubImportStepRepo';
import GitHubImportStepBranch from './github/GitHubImportStepBranch';
import GitHubImportStepClone from './github/GitHubImportStepClone';
import { useGitHubImport } from './github/useGitHubImport';

interface GitHubImportPanelProps {
  onComplete: (result: { projectId: string; projectPath: string; branch: string }) => void;
  onCancel: () => void;
}

export default function GitHubImportPanel({ onComplete, onCancel }: GitHubImportPanelProps) {
  const { t } = useI18n();
  const {
    ghStatus,
    statusLoading,
    reloadStatus,
    step,
    setStep,
    repos,
    reposLoading,
    repoSearch,
    setRepoSearch,
    selectedRepo,
    setSelectedRepo,
    directInput,
    setDirectInput,
    directInputError,
    setDirectInputError,
    branches,
    branchesLoading,
    selectedBranch,
    setSelectedBranch,
    branchError,
    patToken,
    setPatToken,
    patLoading,
    targetPath,
    setTargetPath,
    projectName,
    setProjectName,
    coreGoal,
    setCoreGoal,
    cloneProgress,
    cloneStatus,
    setCloneStatus,
    cloneError,
    setCloneError,
    creating,
    setCreating,
    handleRepoSelect,
    handleDirectInput,
    handlePatRetry,
    handleBranchSelect,
    handleImport,
  } = useGitHubImport({ t, onComplete });

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-slate-400">{t({ ko: '확인 중...', en: 'Checking...' })}</p>
      </div>
    );
  }

  if (!ghStatus?.connected) {
    return (
      <GitHubDeviceConnect
        reason="not_connected"
        onConnected={reloadStatus}
        onCancel={onCancel}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Step indicator */}
      <div className="flex items-center gap-2 border-b border-slate-700 px-5 py-3">
        <button
          type="button"
          onClick={() => { setStep('repo'); setSelectedRepo(null); setSelectedBranch(null); }}
          className={`rounded-full px-3 py-1 text-xs font-medium ${step === 'repo' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
        >
          1. {t({ ko: '리포 선택', en: 'Select Repo' })}
        </button>
        <span className="text-slate-600">/</span>
        <button
          type="button"
          disabled={!selectedRepo}
          onClick={() => { if (selectedRepo) setStep('branch'); }}
          className={`rounded-full px-3 py-1 text-xs font-medium ${step === 'branch' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'} disabled:opacity-40`}
        >
          2. {t({ ko: '브랜치', en: 'Branch' })}
        </button>
        <span className="text-slate-600">/</span>
        <button
          type="button"
          disabled={!selectedBranch}
          onClick={() => { if (selectedBranch) setStep('clone'); }}
          className={`rounded-full px-3 py-1 text-xs font-medium ${step === 'clone' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'} disabled:opacity-40`}
        >
          3. {t({ ko: '가져오기', en: 'Import' })}
        </button>
        <div className="flex-1" />
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-400 hover:text-white">
          {t({ ko: '취소', en: 'Cancel' })}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {step === 'repo' && (
          <GitHubImportStepRepo
            repos={repos}
            reposLoading={reposLoading}
            directInput={directInput}
            directInputError={directInputError}
            repoSearch={repoSearch}
            t={t}
            onRepoSelect={(repo) => void handleRepoSelect(repo)}
            onDirectInputChange={(value) => { setDirectInput(value); setDirectInputError(null); }}
            onDirectInputSubmit={() => void handleDirectInput()}
            onRepoSearchChange={setRepoSearch}
          />
        )}

        {step === 'branch' && selectedRepo && (
          <GitHubImportStepBranch
            selectedRepo={selectedRepo}
            branches={branches}
            branchesLoading={branchesLoading}
            branchError={branchError}
            patToken={patToken}
            patLoading={patLoading}
            t={t}
            onBranchSelect={handleBranchSelect}
            onPatChange={setPatToken}
            onPatRetry={() => void handlePatRetry()}
          />
        )}

        {step === 'clone' && selectedRepo && selectedBranch && (
          <GitHubImportStepClone
            selectedRepo={selectedRepo}
            selectedBranch={selectedBranch}
            creating={creating}
            cloneStatus={cloneStatus}
            cloneProgress={cloneProgress}
            cloneError={cloneError}
            projectName={projectName}
            targetPath={targetPath}
            coreGoal={coreGoal}
            t={t}
            onProjectNameChange={setProjectName}
            onTargetPathChange={setTargetPath}
            onCoreGoalChange={setCoreGoal}
            onImport={() => void handleImport()}
            onBack={() => { setStep('branch'); setCloneStatus('idle'); setCloneError(null); setCreating(false); }}
          />
        )}
      </div>
    </div>
  );
}
