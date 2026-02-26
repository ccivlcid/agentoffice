// @ts-nocheck
/**
 * Worktree staging and auto-commit logic.
 * Extracted from worktree.ts to reduce single-file size.
 */

import { execFileSync } from "node:child_process";
import {
  readWorktreeStatusShort, readGitNullSeparated, normalizeRepoRelativePath,
  isSafeUntrackedPathForAutoCommit, type AppendTaskLog,
} from "./worktree-utils.ts";

export function stageWorktreeChangesForAutoCommit(
  appendTaskLog: AppendTaskLog,
  taskId: string,
  worktreePath: string,
): { stagedPaths: string[]; blockedUntrackedPaths: string[]; error: string | null } {
  try {
    execFileSync("git", ["add", "-u"], { cwd: worktreePath, stdio: "pipe", timeout: 10000 });

    const untracked = readGitNullSeparated(worktreePath, ["ls-files", "--others", "--exclude-standard", "-z", "--"]);
    const blockedUntrackedPaths: string[] = [];
    const safeUntrackedPaths: string[] = [];
    for (const rawPath of untracked) {
      const relPath = normalizeRepoRelativePath(rawPath);
      if (!relPath) continue;
      if (!isSafeUntrackedPathForAutoCommit(relPath)) {
        blockedUntrackedPaths.push(relPath);
        continue;
      }
      safeUntrackedPaths.push(relPath);
    }

    if (safeUntrackedPaths.length > 0) {
      const chunkSize = 200;
      for (let i = 0; i < safeUntrackedPaths.length; i += chunkSize) {
        const chunk = safeUntrackedPaths.slice(i, i + chunkSize);
        execFileSync("git", ["add", "--", ...chunk], { cwd: worktreePath, stdio: "pipe", timeout: 10000 });
      }
    }

    if (blockedUntrackedPaths.length > 0) {
      const preview = blockedUntrackedPaths.slice(0, 8).join(", ");
      const suffix = blockedUntrackedPaths.length > 8 ? " ..." : "";
      appendTaskLog(taskId, "system", `Auto-commit skipped ${blockedUntrackedPaths.length} restricted untracked path(s): ${preview}${suffix}`);
    }

    const stagedPaths = readGitNullSeparated(worktreePath, ["diff", "--cached", "--name-only", "-z", "--"])
      .map(normalizeRepoRelativePath)
      .filter(Boolean);
    return { stagedPaths, blockedUntrackedPaths, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { stagedPaths: [], blockedUntrackedPaths: [], error: msg };
  }
}

export function autoCommitWorktreePendingChanges(
  appendTaskLog: AppendTaskLog,
  taskId: string,
  info: { worktreePath: string; branchName: string },
): {
  committed: boolean;
  error: string | null;
  errorKind: "restricted_untracked" | "git_error" | null;
  restrictedUntrackedCount: number;
} {
  const statusBefore = readWorktreeStatusShort(info.worktreePath);
  if (!statusBefore) return { committed: false, error: null, errorKind: null, restrictedUntrackedCount: 0 };

  try {
    const staged = stageWorktreeChangesForAutoCommit(appendTaskLog, taskId, info.worktreePath);
    if (staged.error) return { committed: false, error: staged.error, errorKind: "git_error", restrictedUntrackedCount: 0 };
    if (staged.stagedPaths.length === 0) {
      if (staged.blockedUntrackedPaths.length > 0) {
        return {
          committed: false,
          error: `auto-commit blocked by restricted untracked files (${staged.blockedUntrackedPaths.length})`,
          errorKind: "restricted_untracked",
          restrictedUntrackedCount: staged.blockedUntrackedPaths.length,
        };
      }
      return { committed: false, error: null, errorKind: null, restrictedUntrackedCount: 0 };
    }

    execFileSync(
      "git",
      ["-c", "user.name=HyperClaw", "-c", "user.email=hyperclaw@local", "commit", "-m", `chore: auto-commit pending task changes (${taskId.slice(0, 8)})`],
      { cwd: info.worktreePath, stdio: "pipe", timeout: 15000 },
    );
    appendTaskLog(taskId, "system", `Worktree auto-commit created on ${info.branchName} before merge`);
    return { committed: true, error: null, errorKind: null, restrictedUntrackedCount: 0 };
  } catch (err: unknown) {
    const statusAfter = readWorktreeStatusShort(info.worktreePath);
    if (!statusAfter) return { committed: false, error: null, errorKind: null, restrictedUntrackedCount: 0 };
    const msg = err instanceof Error ? err.message : String(err);
    appendTaskLog(taskId, "system", `Worktree auto-commit failed: ${msg}`);
    return { committed: false, error: msg, errorKind: "git_error", restrictedUntrackedCount: 0 };
  }
}
