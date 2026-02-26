// @ts-nocheck

import type { RuntimeContext } from "../../types/runtime-context.ts";
import { execFileSync } from "node:child_process";
import { decryptSecret } from "../../oauth/helpers.ts";
import { isGitRepo, hasVisibleDiffSummary, type TaskWorktrees } from "./worktree-utils.ts";
import { createWorktree } from "./worktree-bootstrap.ts";
import { autoCommitWorktreePendingChanges } from "./worktree-commit.ts";
import { mergeWorktree, cleanupWorktree, getWorktreeDiffSummary, rollbackTaskWorktree } from "./worktree-merge.ts";

function getGitHubToken(db: any): string | null {
  const row = db.prepare(
    "SELECT access_token_enc FROM oauth_accounts WHERE provider = 'github' AND status = 'active' ORDER BY priority ASC, updated_at DESC LIMIT 1"
  ).get() as { access_token_enc: string } | undefined;
  if (!row?.access_token_enc) return null;
  try { return decryptSecret(row.access_token_enc); } catch { return null; }
}

function mergeToDevAndCreatePR(
  ctx: { db: any; appendTaskLog: Function },
  taskWorktrees: TaskWorktrees,
  projectPath: string,
  taskId: string,
  githubRepo: string,
): { success: boolean; message: string; conflicts?: string[]; prUrl?: string } {
  const { db, appendTaskLog } = ctx;
  const info = taskWorktrees.get(taskId);
  if (!info) return { success: false, message: "No worktree found for this task" };
  const taskRow = db.prepare("SELECT title, description FROM tasks WHERE id = ?").get(taskId) as { title: string; description: string | null } | undefined;
  const taskTitle = taskRow?.title ?? taskId.slice(0, 8);

  try {
    const autoCommit = autoCommitWorktreePendingChanges(appendTaskLog, taskId, info);
    if (autoCommit.error) {
      if (autoCommit.errorKind === "restricted_untracked") {
        return { success: false, message: `Pre-merge auto-commit blocked by restricted untracked files (${autoCommit.restrictedUntrackedCount}). Remove or handle restricted files and retry.` };
      }
      return { success: false, message: `Pre-merge auto-commit failed: ${autoCommit.error}` };
    }

    // Ensure dev branch exists
    try {
      const devExists = execFileSync("git", ["branch", "--list", "dev"], { cwd: projectPath, stdio: "pipe", timeout: 5000 }).toString().trim();
      if (!devExists) {
        execFileSync("git", ["branch", "dev", "main"], { cwd: projectPath, stdio: "pipe", timeout: 5000 });
        console.log(`[HyperClaw] Created dev branch from main for task ${taskId.slice(0, 8)}`);
      }
    } catch {
      try { execFileSync("git", ["branch", "dev", "HEAD"], { cwd: projectPath, stdio: "pipe", timeout: 5000 }); } catch { /* dev may already exist */ }
    }

    execFileSync("git", ["checkout", "dev"], { cwd: projectPath, stdio: "pipe", timeout: 5000 });
    const mergeMsg = `Merge climpire task ${taskId.slice(0, 8)} (branch ${info.branchName})`;
    execFileSync("git", ["merge", info.branchName, "--no-ff", "-m", mergeMsg], { cwd: projectPath, stdio: "pipe", timeout: 30000 });

    const token = getGitHubToken(db);
    if (token) {
      const remoteUrl = `https://x-access-token:${token}@github.com/${githubRepo}.git`;
      execFileSync("git", ["remote", "set-url", "origin", remoteUrl], { cwd: projectPath, stdio: "pipe", timeout: 5000 });
    }
    execFileSync("git", ["push", "origin", "dev"], { cwd: projectPath, stdio: "pipe", timeout: 60000 });

    if (token) {
      const [owner, repo] = githubRepo.split("/");
      void (async () => {
        try {
          const listRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?head=${owner}:dev&base=main&state=open`, {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
          });
          const existingPRs = await listRes.json();
          if (Array.isArray(existingPRs) && existingPRs.length > 0) {
            const prUrl = existingPRs[0].html_url;
            console.log(`[HyperClaw] Existing PR updated: ${prUrl}`);
            appendTaskLog(taskId, "system", `GitHub PR updated: ${prUrl}`);
          } else {
            const createRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
              body: JSON.stringify({ title: `[Climpire] ${taskTitle}`, body: `## Climpire Task\n\n**Task:** ${taskTitle}\n**Task ID:** ${taskId.slice(0, 8)}\n\nAutomatically created by Climpire workflow.`, head: "dev", base: "main" }),
            });
            if (createRes.ok) {
              const prData = await createRes.json();
              console.log(`[HyperClaw] Created PR: ${prData.html_url}`);
              appendTaskLog(taskId, "system", `GitHub PR created: ${prData.html_url}`);
            } else {
              const errBody = await createRes.text();
              console.warn(`[HyperClaw] Failed to create PR: ${createRes.status} ${errBody}`);
              appendTaskLog(taskId, "system", `GitHub PR creation failed: ${createRes.status}`);
            }
          }
        } catch (prErr) {
          console.warn(`[HyperClaw] PR creation error:`, prErr);
        }
      })();
    }

    try { execFileSync("git", ["checkout", "main"], { cwd: projectPath, stdio: "pipe", timeout: 5000 }); } catch { /* best effort */ }
    return { success: true, message: `Merged ${info.branchName} → dev and pushed to origin.` };
  } catch (err: unknown) {
    try {
      const unmerged = execFileSync("git", ["diff", "--name-only", "--diff-filter=U"], { cwd: projectPath, stdio: "pipe", timeout: 5000 }).toString().trim();
      const conflicts = unmerged ? unmerged.split("\n").filter(Boolean) : [];
      if (conflicts.length > 0) {
        try { execFileSync("git", ["merge", "--abort"], { cwd: projectPath, stdio: "pipe", timeout: 5000 }); } catch { /* ignore */ }
        try { execFileSync("git", ["checkout", "main"], { cwd: projectPath, stdio: "pipe", timeout: 5000 }); } catch { /* ignore */ }
        return { success: false, message: `Merge conflict: ${conflicts.length} file(s) have conflicts.`, conflicts };
      }
    } catch { /* ignore */ }
    try { execFileSync("git", ["merge", "--abort"], { cwd: projectPath, stdio: "pipe", timeout: 5000 }); } catch { /* ignore */ }
    try { execFileSync("git", ["checkout", "main"], { cwd: projectPath, stdio: "pipe", timeout: 5000 }); } catch { /* ignore */ }
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Dev merge failed: ${msg}` };
  }
}

export function createWorktreeModule(ctx: RuntimeContext) {
  const { db, appendTaskLog, resolveLang, pickL, l } = ctx;
  const taskWorktrees: TaskWorktrees = new Map();
  const mergeCtx = { db, appendTaskLog, resolveLang, pickL, l };
  const githubCtx = { db, appendTaskLog };

  return {
    taskWorktrees,
    isGitRepo,
    hasVisibleDiffSummary,
    createWorktree: (projectPath: string, taskId: string, agentName: string, baseBranch?: string) =>
      createWorktree(taskWorktrees, appendTaskLog, projectPath, taskId, agentName, baseBranch),
    mergeWorktree: (projectPath: string, taskId: string) =>
      mergeWorktree(mergeCtx, taskWorktrees, projectPath, taskId),
    mergeToDevAndCreatePR: (projectPath: string, taskId: string, githubRepo: string) =>
      mergeToDevAndCreatePR(githubCtx, taskWorktrees, projectPath, taskId, githubRepo),
    cleanupWorktree: (projectPath: string, taskId: string) =>
      cleanupWorktree(taskWorktrees, projectPath, taskId),
    rollbackTaskWorktree: (taskId: string, reason: string) =>
      rollbackTaskWorktree(appendTaskLog, taskWorktrees, taskId, reason),
    getWorktreeDiffSummary: (projectPath: string, taskId: string) =>
      getWorktreeDiffSummary(taskWorktrees, projectPath, taskId),
  };
}
