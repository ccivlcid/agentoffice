import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cloneGitHubRepo,
  createProject,
  getCloneStatus,
  type GitHubRepo,
} from '../../api';

interface UseGitHubCloneOptions {
  onComplete: (result: { projectId: string; projectPath: string; branch: string }) => void;
}

export function useGitHubClone({ onComplete }: UseGitHubCloneOptions) {
  const [targetPath, setTargetPath] = useState('');
  const [projectName, setProjectName] = useState('');
  const [coreGoal, setCoreGoal] = useState('');
  const [cloneProgress, setCloneProgress] = useState(0);
  const [cloneStatus, setCloneStatus] = useState<string>('idle');
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleImport = useCallback(async (
    selectedRepo: GitHubRepo,
    selectedBranch: string,
    patToken: string,
  ) => {
    setCreating(true);
    setCloneError(null);
    setCloneStatus('cloning');
    setCloneProgress(0);
    try {
      const resolvedPath = targetPath;
      const res = await cloneGitHubRepo({
        owner: selectedRepo.owner,
        repo: selectedRepo.name,
        branch: selectedBranch,
        target_path: resolvedPath,
        pat: patToken.trim() || undefined,
      });
      if (res.already_exists) {
        setCloneStatus('done');
        setCloneProgress(100);
      } else if (res.clone_id) {
        const cloneId = res.clone_id;
        pollRef.current = setInterval(async () => {
          try {
            const status = await getCloneStatus(cloneId);
            setCloneProgress(status.progress);
            if (status.status === 'done') {
              setCloneStatus('done');
              if (pollRef.current) clearInterval(pollRef.current);
            } else if (status.status === 'error') {
              setCloneStatus('error');
              setCloneError(status.error || 'Clone failed');
              if (pollRef.current) clearInterval(pollRef.current);
              setCreating(false);
            }
          } catch {
            // continue polling
          }
        }, 1000);
        return;
      }
      const project = await createProject({
        name: projectName.trim() || selectedRepo.name,
        project_path: res.target_path || resolvedPath,
        core_goal: coreGoal.trim() || `GitHub: ${selectedRepo.full_name} (${selectedBranch})`,
        github_repo: selectedRepo.full_name,
      });
      onComplete({ projectId: project.id, projectPath: res.target_path || resolvedPath, branch: selectedBranch });
    } catch (err) {
      setCloneStatus('error');
      setCloneError(err instanceof Error ? err.message : String(err));
      setCreating(false);
    }
  }, [targetPath, projectName, coreGoal, onComplete]);

  // When clone status changes to done, create project
  const createProjectOnDone = useCallback(async (
    selectedRepo: GitHubRepo,
    selectedBranch: string,
  ) => {
    const resolvedPath = targetPath;
    try {
      const project = await createProject({
        name: projectName.trim() || selectedRepo.name,
        project_path: resolvedPath,
        core_goal: coreGoal.trim() || `GitHub: ${selectedRepo.full_name} (${selectedBranch})`,
        github_repo: selectedRepo.full_name,
      });
      onComplete({ projectId: project.id, projectPath: resolvedPath, branch: selectedBranch });
    } catch (err) {
      setCloneError(err instanceof Error ? err.message : String(err));
      setCloneStatus('error');
    } finally {
      setCreating(false);
    }
  }, [targetPath, projectName, coreGoal, onComplete]);

  // Cleanup polls
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  return {
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
    handleImport,
    createProjectOnDone,
  };
}
