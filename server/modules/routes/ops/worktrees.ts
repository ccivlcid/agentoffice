// @ts-nocheck
/**
 * Git worktree management: diff, merge, discard, list.
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import { execFileSync } from "node:child_process";

export function registerOpsWorktrees(ctx: RuntimeContext): void {
  const {
    app,
    taskWorktrees,
    mergeWorktree,
    cleanupWorktree,
    appendTaskLog,
    notifyCeo,
    pickL,
    l,
    resolveLang,
  } = ctx;

  app.get("/api/tasks/:id/diff", (req: any, res: any) => {
    const id = String(req.params.id);
    const wtInfo = taskWorktrees.get(id);
    if (!wtInfo) {
      return res.json({ ok: true, hasWorktree: false, diff: "", stat: "" });
    }
    try {
      const currentBranch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
        cwd: wtInfo.projectPath, stdio: "pipe", timeout: 5000,
      }).toString().trim();
      const stat = execFileSync("git", ["diff", `${currentBranch}...${wtInfo.branchName}`, "--stat"], {
        cwd: wtInfo.projectPath, stdio: "pipe", timeout: 10000,
      }).toString().trim();
      const diff = execFileSync("git", ["diff", `${currentBranch}...${wtInfo.branchName}`], {
        cwd: wtInfo.projectPath, stdio: "pipe", timeout: 15000,
      }).toString();
      res.json({
        ok: true,
        hasWorktree: true,
        branchName: wtInfo.branchName,
        stat,
        diff: diff.length > 50000 ? diff.slice(0, 50000) + "\n... (truncated)" : diff,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.json({ ok: false, error: msg });
    }
  });

  app.post("/api/tasks/:id/merge", (req: any, res: any) => {
    const id = String(req.params.id);
    const wtInfo = taskWorktrees.get(id);
    if (!wtInfo) {
      return res.status(404).json({ error: "no_worktree", message: "No worktree found for this task" });
    }
    const result = mergeWorktree(wtInfo.projectPath, id);
    const lang = resolveLang();
    if (result.success) {
      cleanupWorktree(wtInfo.projectPath, id);
      appendTaskLog(id, "system", `Manual merge completed: ${result.message}`);
      notifyCeo(pickL(l(
        [`수동 병합 완료: ${result.message}`],
        [`Manual merge completed: ${result.message}`],
        [`手動マージ完了: ${result.message}`],
        [`手动合并完成: ${result.message}`],
      ), lang), id);
    } else {
      appendTaskLog(id, "system", `Manual merge failed: ${result.message}`);
    }
    res.json({ ok: result.success, message: result.message, conflicts: result.conflicts });
  });

  app.post("/api/tasks/:id/discard", (req: any, res: any) => {
    const id = String(req.params.id);
    const wtInfo = taskWorktrees.get(id);
    if (!wtInfo) {
      return res.status(404).json({ error: "no_worktree", message: "No worktree found for this task" });
    }
    cleanupWorktree(wtInfo.projectPath, id);
    appendTaskLog(id, "system", "Worktree discarded (changes abandoned)");
    const lang = resolveLang();
    notifyCeo(pickL(l(
      [`작업 브랜치가 폐기되었습니다: climpire/${id.slice(0, 8)}`],
      [`Task branch discarded: climpire/${id.slice(0, 8)}`],
      [`タスクブランチを破棄しました: climpire/${id.slice(0, 8)}`],
      [`任务分支已丢弃: climpire/${id.slice(0, 8)}`],
    ), lang), id);
    res.json({ ok: true, message: "Worktree discarded" });
  });

  app.get("/api/worktrees", (_req: any, res: any) => {
    const entries: Array<{ taskId: string; branchName: string; worktreePath: string; projectPath: string }> = [];
    for (const [taskId, info] of taskWorktrees) {
      entries.push({ taskId, ...info });
    }
    res.json({ ok: true, worktrees: entries });
  });
}
