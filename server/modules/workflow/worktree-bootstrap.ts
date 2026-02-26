// @ts-nocheck
/**
 * Git repository bootstrap and worktree creation.
 * Extracted from worktree.ts to reduce single-file size.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { isGitRepo, type AppendTaskLog, type TaskWorktrees } from "./worktree-utils.ts";

export function ensureWorktreeBootstrapRepo(appendTaskLog: AppendTaskLog, projectPath: string, taskId: string): boolean {
  if (isGitRepo(projectPath)) return true;
  const shortId = taskId.slice(0, 8);
  try {
    if (!fs.existsSync(projectPath) || !fs.statSync(projectPath).isDirectory()) {
      appendTaskLog(taskId, "system", `Git bootstrap skipped: invalid project path (${projectPath})`);
      return false;
    }
  } catch {
    appendTaskLog(taskId, "system", `Git bootstrap skipped: cannot access project path (${projectPath})`);
    return false;
  }

  try {
    appendTaskLog(taskId, "system", "Git repository not found. Bootstrapping local repository for worktree execution...");
    try {
      execFileSync("git", ["init", "-b", "main"], { cwd: projectPath, stdio: "pipe", timeout: 10000 });
    } catch {
      execFileSync("git", ["init"], { cwd: projectPath, stdio: "pipe", timeout: 10000 });
    }

    const excludePath = path.join(projectPath, ".git", "info", "exclude");
    const baseIgnore = ["node_modules/", "dist/", ".climpire-worktrees/", ".climpire/", ".DS_Store", "*.log"];
    let existingExclude = "";
    try {
      existingExclude = fs.existsSync(excludePath) ? fs.readFileSync(excludePath, "utf8") : "";
    } catch {
      existingExclude = "";
    }
    const appendLines = baseIgnore.filter((line) => !existingExclude.includes(line));
    if (appendLines.length > 0) {
      const prefix = existingExclude && !existingExclude.endsWith("\n") ? "\n" : "";
      fs.appendFileSync(excludePath, `${prefix}${appendLines.join("\n")}\n`, "utf8");
    }

    const readConfig = (key: string): string => {
      try {
        return execFileSync("git", ["config", "--get", key], { cwd: projectPath, stdio: "pipe", timeout: 3000 }).toString().trim();
      } catch {
        return "";
      }
    };
    if (!readConfig("user.name")) {
      execFileSync("git", ["config", "user.name", "HyperClaw Bot"], { cwd: projectPath, stdio: "pipe", timeout: 3000 });
    }
    if (!readConfig("user.email")) {
      execFileSync("git", ["config", "user.email", "hyperclaw@local"], { cwd: projectPath, stdio: "pipe", timeout: 3000 });
    }

    execFileSync("git", ["add", "-A"], { cwd: projectPath, stdio: "pipe", timeout: 20000 });
    const staged = execFileSync("git", ["diff", "--cached", "--name-only"], { cwd: projectPath, stdio: "pipe", timeout: 5000 }).toString().trim();
    if (staged) {
      execFileSync("git", ["commit", "-m", "chore: initialize project for HyperClaw worktrees"], { cwd: projectPath, stdio: "pipe", timeout: 20000 });
    } else {
      execFileSync("git", ["commit", "--allow-empty", "-m", "chore: initialize project for HyperClaw worktrees"], { cwd: projectPath, stdio: "pipe", timeout: 10000 });
    }

    appendTaskLog(taskId, "system", "Git repository initialized automatically for worktree execution.");
    console.log(`[HyperClaw] Auto-initialized git repo for task ${shortId} at ${projectPath}`);
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    appendTaskLog(taskId, "system", `Git bootstrap failed: ${msg}`);
    console.error(`[HyperClaw] Failed git bootstrap for task ${shortId}: ${msg}`);
    return false;
  }
}

export function createWorktree(
  taskWorktrees: TaskWorktrees,
  appendTaskLog: AppendTaskLog,
  projectPath: string,
  taskId: string,
  agentName: string,
  baseBranch?: string,
): string | null {
  if (!ensureWorktreeBootstrapRepo(appendTaskLog, projectPath, taskId)) return null;
  if (!isGitRepo(projectPath)) return null;

  const shortId = taskId.slice(0, 8);
  const branchName = `climpire/${shortId}`;
  const worktreeBase = path.join(projectPath, ".climpire-worktrees");
  const worktreePath = path.join(worktreeBase, shortId);

  try {
    fs.mkdirSync(worktreeBase, { recursive: true });
    let base: string;
    if (baseBranch) {
      try {
        base = execFileSync("git", ["rev-parse", baseBranch], { cwd: projectPath, stdio: "pipe", timeout: 5000 }).toString().trim();
      } catch {
        base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: projectPath, stdio: "pipe", timeout: 5000 }).toString().trim();
      }
    } else {
      base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: projectPath, stdio: "pipe", timeout: 5000 }).toString().trim();
    }
    execFileSync("git", ["worktree", "add", worktreePath, "-b", branchName, base], { cwd: projectPath, stdio: "pipe", timeout: 15000 });
    taskWorktrees.set(taskId, { worktreePath, branchName, projectPath });
    console.log(`[HyperClaw] Created worktree for task ${shortId}: ${worktreePath} (branch: ${branchName}, agent: ${agentName})`);
    return worktreePath;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    appendTaskLog(taskId, "system", `Git worktree creation skipped: ${msg}. Running directly in project directory.`);
    console.error(`[HyperClaw] Failed to create worktree for task ${shortId}: ${msg}`);
    return null;
  }
}
