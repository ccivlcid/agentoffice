// @ts-nocheck
/** Core API: task git info endpoint (GET /api/tasks/:id/git-info). */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import { execFileSync } from "node:child_process";
import { isGitRepo } from "../../workflow/worktree-utils.ts";

export function registerTaskGitInfo(ctx: RuntimeContext): void {
  const { app, db, resolveProjectPath } = ctx;

  app.get("/api/tasks/:id/git-info", (req, res) => {
    const id = String(req.params.id);
    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as {
      id: string;
      project_path: string | null;
    } | undefined;
    if (!task) return res.status(404).json({ error: "not_found" });

    const projectPath = resolveProjectPath(task) || process.cwd();
    const gitRepo = isGitRepo(projectPath);

    if (!gitRepo) {
      return res.json({ is_git_repo: false, project_path: projectPath });
    }

    let currentBranch = "";
    let remoteUrl = "";
    try {
      currentBranch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
        cwd: projectPath, stdio: "pipe", timeout: 5000,
      }).toString().trim();
    } catch { /* ignore */ }
    try {
      remoteUrl = execFileSync("git", ["remote", "get-url", "origin"], {
        cwd: projectPath, stdio: "pipe", timeout: 5000,
      }).toString().trim();
    } catch { /* no remote configured */ }

    return res.json({
      is_git_repo: true,
      current_branch: currentBranch || undefined,
      remote_url: remoteUrl || undefined,
      project_path: projectPath,
    });
  });
}
