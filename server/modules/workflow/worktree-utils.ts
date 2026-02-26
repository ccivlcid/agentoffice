// @ts-nocheck
/**
 * Pure utility functions and constants for worktree operations.
 * Extracted from worktree.ts to reduce single-file size.
 */

import path from "node:path";
import { execFileSync } from "node:child_process";

export const DIFF_SUMMARY_NONE = "__DIFF_NONE__";
export const DIFF_SUMMARY_ERROR = "__DIFF_ERROR__";

export const AUTO_COMMIT_ALLOWED_UNTRACKED_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".json", ".md", ".mdx", ".txt",
  ".css", ".scss", ".sass", ".less",
  ".html", ".xml", ".svg",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".bmp",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".yml", ".yaml", ".toml", ".ini",
  ".py", ".go", ".rs", ".java", ".kt", ".swift", ".rb", ".php",
  ".sh", ".bash", ".zsh",
  ".sql", ".graphql", ".gql",
  ".vue", ".svelte",
]);
export const AUTO_COMMIT_ALLOWED_UNTRACKED_BASENAMES = new Set([
  "dockerfile", "makefile", "cmakelists.txt", "readme", "license",
  ".editorconfig", ".gitignore", ".gitattributes", ".npmrc", ".nvmrc",
  ".node-version", ".eslintrc", ".eslintrc.js", ".eslintrc.cjs", ".eslintrc.json",
  ".prettierrc", ".prettierrc.js", ".prettierrc.cjs", ".prettierrc.json", ".env.example",
]);
export const AUTO_COMMIT_BLOCKED_DIR_SEGMENTS = new Set([
  ".git", ".climpire", ".climpire-worktrees", "node_modules",
  "dist", "build", "coverage", "logs", "tmp", "temp",
]);
export const AUTO_COMMIT_ALLOWED_DOT_DIR_SEGMENTS = new Set([
  ".github", ".storybook", ".changeset", ".husky", ".vscode",
]);
export const AUTO_COMMIT_BLOCKED_FILE_PATTERN = /(^|\/)(\.env($|[./])|id_rsa|id_ed25519|known_hosts|authorized_keys|.*\.(pem|key|p12|pfx|crt|cer|der|kdbx|sqlite|db|log|zip|tar|gz|tgz|rar|7z))$/i;

export type AppendTaskLog = (taskId: string, kind: string, msg: string) => void;
export type TaskWorktreeInfo = { worktreePath: string; branchName: string; projectPath: string };
export type TaskWorktrees = Map<string, TaskWorktreeInfo>;

export function isGitRepo(dir: string): boolean {
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: dir, stdio: "pipe", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export function hasVisibleDiffSummary(summary: string): boolean {
  return Boolean(summary && summary !== DIFF_SUMMARY_NONE && summary !== DIFF_SUMMARY_ERROR);
}

export function readWorktreeStatusShort(worktreePath: string): string {
  try {
    return execFileSync("git", ["status", "--short"], { cwd: worktreePath, stdio: "pipe", timeout: 5000 }).toString().trim();
  } catch {
    return "";
  }
}

export function readGitNullSeparated(worktreePath: string, args: string[]): string[] {
  try {
    const out = execFileSync("git", args, { cwd: worktreePath, stdio: "pipe", timeout: 10000 }).toString("utf8");
    return out.split("\0").filter((entry) => entry.length > 0);
  } catch {
    return [];
  }
}

export function normalizeRepoRelativePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "").trim();
}

export function isSafeUntrackedPathForAutoCommit(filePath: string): boolean {
  const normalized = normalizeRepoRelativePath(filePath);
  if (!normalized || normalized.startsWith("/") || normalized.includes("..")) return false;
  const lower = normalized.toLowerCase();
  const segments = lower.split("/").filter(Boolean);
  for (const seg of segments.slice(0, -1)) {
    if (seg.startsWith(".") && !AUTO_COMMIT_ALLOWED_DOT_DIR_SEGMENTS.has(seg)) return false;
    if (AUTO_COMMIT_BLOCKED_DIR_SEGMENTS.has(seg)) return false;
  }
  if (AUTO_COMMIT_BLOCKED_FILE_PATTERN.test(lower)) {
    if (lower === ".env.example" || lower.endsWith("/.env.example")) return true;
    return false;
  }
  const base = segments[segments.length - 1] || "";
  if (AUTO_COMMIT_ALLOWED_UNTRACKED_BASENAMES.has(base)) return true;
  const ext = path.extname(base);
  return AUTO_COMMIT_ALLOWED_UNTRACKED_EXTENSIONS.has(ext);
}
