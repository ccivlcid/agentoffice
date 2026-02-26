// @ts-nocheck
/**
 * Worktree merge, cleanup, diff, and rollback operations.
 * Extracted from worktree.ts to reduce single-file size.
 */

import fs from "node:fs";
import { execFileSync } from "node:child_process";
import {
  DIFF_SUMMARY_NONE, DIFF_SUMMARY_ERROR, hasVisibleDiffSummary, readWorktreeStatusShort,
  type AppendTaskLog, type TaskWorktrees,
} from "./worktree-utils.ts";
import { autoCommitWorktreePendingChanges } from "./worktree-commit.ts";

type MergeCtx = {
  db: any;
  appendTaskLog: AppendTaskLog;
  resolveLang: Function;
  pickL: Function;
  l: Function;
};

export function cleanupWorktree(taskWorktrees: TaskWorktrees, projectPath: string, taskId: string): void {
  const info = taskWorktrees.get(taskId);
  if (!info) return;
  const shortId = taskId.slice(0, 8);
  try {
    execFileSync("git", ["worktree", "remove", info.worktreePath, "--force"], { cwd: projectPath, stdio: "pipe", timeout: 10000 });
  } catch {
    console.warn(`[HyperClaw] git worktree remove failed for ${shortId}, falling back to manual cleanup`);
    try {
      if (fs.existsSync(info.worktreePath)) fs.rmSync(info.worktreePath, { recursive: true, force: true });
      execFileSync("git", ["worktree", "prune"], { cwd: projectPath, stdio: "pipe", timeout: 5000 });
    } catch { /* ignore */ }
  }
  try {
    execFileSync("git", ["branch", "-D", info.branchName], { cwd: projectPath, stdio: "pipe", timeout: 5000 });
  } catch {
    console.warn(`[HyperClaw] Failed to delete branch ${info.branchName} — may need manual cleanup`);
  }
  taskWorktrees.delete(taskId);
  console.log(`[HyperClaw] Cleaned up worktree for task ${shortId}`);
}

export function getWorktreeDiffSummary(taskWorktrees: TaskWorktrees, projectPath: string, taskId: string): string {
  const info = taskWorktrees.get(taskId);
  if (!info) return "";
  try {
    const currentBranch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: projectPath, stdio: "pipe", timeout: 5000 }).toString().trim();
    const stat = execFileSync("git", ["diff", `${currentBranch}...${info.branchName}`, "--stat"], { cwd: projectPath, stdio: "pipe", timeout: 10000 }).toString().trim();
    const worktreePending = readWorktreeStatusShort(info.worktreePath);
    if (stat && worktreePending) return `${stat}\n\n[uncommitted worktree changes]\n${worktreePending}`;
    if (stat) return stat;
    if (worktreePending) return `[uncommitted worktree changes]\n${worktreePending}`;
    return DIFF_SUMMARY_NONE;
  } catch {
    return DIFF_SUMMARY_ERROR;
  }
}

export function rollbackTaskWorktree(appendTaskLog: AppendTaskLog, taskWorktrees: TaskWorktrees, taskId: string, reason: string): boolean {
  const info = taskWorktrees.get(taskId);
  if (!info) return false;
  const diffSummary = getWorktreeDiffSummary(taskWorktrees, info.projectPath, taskId);
  if (hasVisibleDiffSummary(diffSummary)) {
    appendTaskLog(taskId, "system", `Rollback(${reason}) diff summary:\n${diffSummary}`);
  }
  cleanupWorktree(taskWorktrees, info.projectPath, taskId);
  appendTaskLog(taskId, "system", `Worktree rollback completed (${reason})`);
  return true;
}

export function mergeWorktree(
  ctx: MergeCtx,
  taskWorktrees: TaskWorktrees,
  projectPath: string,
  taskId: string,
): { success: boolean; message: string; conflicts?: string[] } {
  const { db, appendTaskLog, resolveLang, pickL, l } = ctx;
  const info = taskWorktrees.get(taskId);
  if (!info) return { success: false, message: "No worktree found for this task" };
  const taskRow = db.prepare("SELECT title, description FROM tasks WHERE id = ?").get(taskId) as { title: string; description: string | null } | undefined;
  const lang = resolveLang(taskRow?.description ?? taskRow?.title);

  try {
    const autoCommit = autoCommitWorktreePendingChanges(appendTaskLog, taskId, info);
    if (autoCommit.error) {
      if (autoCommit.errorKind === "restricted_untracked") {
        return {
          success: false,
          message: pickL(l(
            [`병합 전 제한된 미추적 파일(${autoCommit.restrictedUntrackedCount}개) 때문에 자동 커밋이 차단되었습니다.`],
            [`Pre-merge auto-commit was blocked by restricted untracked files (${autoCommit.restrictedUntrackedCount}). Remove/review restricted files and retry.`],
            [`マージ前の自動コミットは制限付き未追跡ファイル（${autoCommit.restrictedUntrackedCount}件）によりブロックされました。`],
            [`合并前自动提交因受限未跟踪文件（${autoCommit.restrictedUntrackedCount}个）被阻止。`],
          ), lang),
        };
      }
      return {
        success: false,
        message: pickL(l(
          [`병합 전 변경사항 자동 커밋에 실패했습니다: ${autoCommit.error}`],
          [`Failed to auto-commit pending changes before merge: ${autoCommit.error}`],
          [`マージ前の未コミット変更の自動コミットに失敗しました: ${autoCommit.error}`],
          [`合并前自动提交未提交更改失败：${autoCommit.error}`],
        ), lang),
      };
    }

    const currentBranch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: projectPath, stdio: "pipe", timeout: 5000 }).toString().trim();
    try {
      const diffCheck = execFileSync("git", ["diff", `${currentBranch}...${info.branchName}`, "--stat"], { cwd: projectPath, stdio: "pipe", timeout: 10000 }).toString().trim();
      if (!diffCheck) {
        return { success: true, message: pickL(l(["변경사항이 없어 병합이 필요하지 않습니다."], ["No changes to merge."], ["マージする変更がありません。"], ["没有可合并的更改。"]), lang) };
      }
    } catch { /* proceed */ }

    const mergeMsg = `Merge climpire task ${taskId.slice(0, 8)} (branch ${info.branchName})`;
    execFileSync("git", ["merge", info.branchName, "--no-ff", "-m", mergeMsg], { cwd: projectPath, stdio: "pipe", timeout: 30000 });
    return { success: true, message: pickL(l([`병합 완료: ${info.branchName} → ${currentBranch}`], [`Merge completed: ${info.branchName} -> ${currentBranch}`], [`マージ完了: ${info.branchName} -> ${currentBranch}`], [`合并完成: ${info.branchName} -> ${currentBranch}`]), lang) };
  } catch (err: unknown) {
    try {
      const unmerged = execFileSync("git", ["diff", "--name-only", "--diff-filter=U"], { cwd: projectPath, stdio: "pipe", timeout: 5000 }).toString().trim();
      const conflicts = unmerged ? unmerged.split("\n").filter(Boolean) : [];
      if (conflicts.length > 0) {
        try { execFileSync("git", ["merge", "--abort"], { cwd: projectPath, stdio: "pipe", timeout: 5000 }); } catch { /* ignore */ }
        return { success: false, message: pickL(l([`병합 충돌 발생: ${conflicts.length}개 파일`], [`Merge conflict: ${conflicts.length} file(s) have conflicts.`], [`マージ競合: ${conflicts.length}件`], [`合并冲突：${conflicts.length} 个文件`]), lang), conflicts };
      }
    } catch { /* ignore */ }
    try { execFileSync("git", ["merge", "--abort"], { cwd: projectPath, stdio: "pipe", timeout: 5000 }); } catch { /* ignore */ }
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: pickL(l([`병합 실패: ${msg}`], [`Merge failed: ${msg}`], [`マージ失敗: ${msg}`], [`合并失败: ${msg}`]), lang) };
  }
}
