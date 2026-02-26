import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getGitHubBranches,
  getGitHubRepos,
  getGitHubStatus,
  type GitHubBranch,
  type GitHubRepo,
  type GitHubStatus,
} from '../../api';
import type { I18nContextValue } from '../../i18n';
import { useGitHubClone } from './useGitHubClone';

type WizardStep = 'repo' | 'branch' | 'clone';

interface UseGitHubImportOptions {
  t: I18nContextValue['t'];
  onComplete: (result: { projectId: string; projectPath: string; branch: string }) => void;
}

export function useGitHubImport({ t, onComplete }: UseGitHubImportOptions) {
  const [ghStatus, setGhStatus] = useState<GitHubStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [step, setStep] = useState<WizardStep>('repo');

  // Step 1: Repo selection
  const [repoSearch, setRepoSearch] = useState('');
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [directInput, setDirectInput] = useState('');
  const [directInputError, setDirectInputError] = useState<string | null>(null);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [patToken, setPatToken] = useState('');
  const [patLoading, setPatLoading] = useState(false);

  // Step 2: Branch selection
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);

  // Step 3: Clone state via sub-hook
  const cloneHook = useGitHubClone({ onComplete });

  // Load GitHub status
  useEffect(() => {
    setStatusLoading(true);
    getGitHubStatus()
      .then(setGhStatus)
      .catch(() => setGhStatus(null))
      .finally(() => setStatusLoading(false));
  }, []);

  const loadRepos = useCallback(async (query: string) => {
    setReposLoading(true);
    try {
      const res = await getGitHubRepos({ q: query || undefined, per_page: 30 });
      setRepos(res.repos);
    } catch {
      setRepos([]);
    } finally {
      setReposLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (!ghStatus?.connected) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      void loadRepos(repoSearch);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [repoSearch, ghStatus, loadRepos]);

  // Initial load
  useEffect(() => {
    if (ghStatus?.connected) {
      void loadRepos('');
    }
  }, [ghStatus, loadRepos]);

  const handleRepoSelect = useCallback(async (repo: GitHubRepo, pat?: string) => {
    setSelectedRepo(repo);
    setStep('branch');
    setBranchesLoading(true);
    setBranchError(null);
    setSelectedBranch(null);
    try {
      const res = await getGitHubBranches(repo.owner, repo.name, pat);
      setBranches(res.remote_branches);
    } catch (err: any) {
      setBranches([]);
      const msg = err?.message || String(err);
      if (msg.includes('404') || msg.includes('not_found') || msg.includes('repo_not_found')) {
        setBranchError(t({
          ko: `리포지토리 ${repo.full_name}에 접근할 수 없습니다. 설정 → OAuth 탭에서 자체 GitHub OAuth App을 등록하면 Private 리포에 접근할 수 있습니다. 또는 아래에 PAT를 직접 입력하세요.`,
          en: `Cannot access repository ${repo.full_name}. Register your own GitHub OAuth App in Settings → OAuth tab for private repo access, or enter a PAT below.`,
          ja: `リポジトリ ${repo.full_name} にアクセスできません。設定 → OAuth タブで自前の GitHub OAuth App を登録するとプライベートリポにアクセスできます。または下に PAT を入力してください。`,
          zh: `无法访问仓库 ${repo.full_name}。在设置 → OAuth 标签中注册自己的 GitHub OAuth App 即可访问私有仓库，或在下方输入 PAT。`,
        }));
      } else if (msg.includes('token_invalid')) {
        setBranchError(t({
          ko: 'PAT가 유효하지 않거나 만료되었습니다. 다시 확인해주세요.',
          en: 'PAT is invalid or expired. Please check and try again.',
}));
      } else {
        setBranchError(msg);
      }
    } finally {
      setBranchesLoading(false);
    }
  }, [t]);

  const handleDirectInput = useCallback(async () => {
    setDirectInputError(null);
    const input = directInput.trim();
    const match = input.match(/(?:(?:https?:\/\/)?github\.com\/)?([^/\s]+)\/([^/\s#?]+)/);
    if (!match) {
      setDirectInputError(t({
        ko: '형식: owner/repo 또는 GitHub URL',
        en: 'Format: owner/repo or GitHub URL',
}));
      return;
    }
    const [, owner, rawRepo] = match;
    const repoName = rawRepo.replace(/\.git$/, '');
    const fakeRepo: GitHubRepo = {
      id: 0,
      name: repoName,
      full_name: `${owner}/${repoName}`,
      owner,
      private: true,
      description: null,
      default_branch: 'main',
      updated_at: new Date().toISOString(),
      html_url: `https://github.com/${owner}/${repoName}`,
      clone_url: `https://github.com/${owner}/${repoName}.git`,
    };
    try {
      await handleRepoSelect(fakeRepo);
    } catch (err: any) {
      setDirectInputError(err?.message || String(err));
    }
  }, [directInput, t, handleRepoSelect]);

  const handlePatRetry = useCallback(async () => {
    if (!selectedRepo || !patToken.trim()) return;
    setPatLoading(true);
    setBranchError(null);
    await handleRepoSelect(selectedRepo, patToken.trim());
    setPatLoading(false);
  }, [selectedRepo, patToken, handleRepoSelect]);

  const handleBranchSelect = useCallback((branchName: string) => {
    setSelectedBranch(branchName);
    setStep('clone');
    if (selectedRepo) {
      cloneHook.setProjectName(selectedRepo.name);
      cloneHook.setTargetPath(`~/Projects/${selectedRepo.name}`);
      cloneHook.setCoreGoal('');
    }
  }, [selectedRepo, cloneHook]);

  // When clone status changes to done, create project
  useEffect(() => {
    if (cloneHook.cloneStatus !== 'done' || !cloneHook.creating || !selectedRepo || !selectedBranch) return;
    void cloneHook.createProjectOnDone(selectedRepo, selectedBranch);
  }, [cloneHook.cloneStatus, cloneHook.creating, selectedRepo, selectedBranch, cloneHook]);

  const reloadStatus = () => {
    setStatusLoading(true);
    getGitHubStatus()
      .then(setGhStatus)
      .catch(() => setGhStatus(null))
      .finally(() => setStatusLoading(false));
  };

  const handleImport = useCallback(() => {
    if (!selectedRepo || !selectedBranch) return Promise.resolve();
    return cloneHook.handleImport(selectedRepo, selectedBranch, patToken);
  }, [selectedRepo, selectedBranch, patToken, cloneHook]);

  return {
    ghStatus, statusLoading, reloadStatus,
    step, setStep,
    repos, reposLoading, repoSearch, setRepoSearch,
    selectedRepo, setSelectedRepo,
    directInput, setDirectInput, directInputError, setDirectInputError,
    branches, branchesLoading, selectedBranch, setSelectedBranch,
    branchError, patToken, setPatToken, patLoading,
    ...cloneHook,
    handleRepoSelect, handleDirectInput, handlePatRetry, handleBranchSelect, handleImport,
  };
}
