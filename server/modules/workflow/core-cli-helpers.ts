// @ts-nocheck

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CLI_OUTPUT_DEDUP_WINDOW_MS } from "../../db/runtime.ts";

// ---------------------------------------------------------------------------
// CLI spawn helpers
// ---------------------------------------------------------------------------

export const CLI_PATH_FALLBACK_DIRS = process.platform === "win32"
  ? [
      path.join(process.env.ProgramFiles || "C:\\Program Files", "nodejs"),
      path.join(process.env.LOCALAPPDATA || "", "Programs", "nodejs"),
      path.join(process.env.APPDATA || "", "npm"),
    ].filter(Boolean)
  : [
      "/opt/homebrew/bin",
      "/usr/local/bin",
      "/usr/bin",
      "/bin",
      path.join(os.homedir(), ".local", "bin"),
      path.join(os.homedir(), "bin"),
    ];

export function withCliPathFallback(pathValue: string | undefined): string {
  const parts = (pathValue ?? "")
    .split(path.delimiter)
    .map((item) => item.trim())
    .filter(Boolean);
  const seen = new Set(parts);
  for (const dir of CLI_PATH_FALLBACK_DIRS) {
    if (!dir || seen.has(dir)) continue;
    parts.push(dir);
    seen.add(dir);
  }
  return parts.join(path.delimiter);
}

export function buildAgentArgs(provider: string, model?: string, reasoningLevel?: string): string[] {
  switch (provider) {
    case "codex": {
      const args = ["codex", "--enable", "multi_agent"];
      if (model) args.push("-m", model);
      if (reasoningLevel) args.push("-c", `model_reasoning_effort="${reasoningLevel}"`);
      args.push("--yolo", "exec", "--json");
      return args;
    }
    case "claude": {
      const args = [
        "claude",
        "--dangerously-skip-permissions",
        "--print",
        "--verbose",
        "--output-format=stream-json",
        "--include-partial-messages",
        "--max-turns", "200",
      ];
      if (model) args.push("--model", model);
      return args;
    }
    case "gemini": {
      const args = ["gemini"];
      if (model) args.push("-m", model);
      args.push("--yolo", "--output-format=stream-json");
      return args;
    }
    case "opencode": {
      const args = ["opencode", "run"];
      if (model) args.push("-m", model);
      args.push("--format", "json");
      return args;
    }
    case "copilot":
    case "antigravity":
      throw new Error(`${provider} uses HTTP agent (not CLI spawn)`);
    default:
      throw new Error(`unsupported CLI provider: ${provider}`);
  }
}

export const ANSI_ESCAPE_REGEX = /\u001b(?:\[[0-?]*[ -/]*[@-~]|][^\u0007]*(?:\u0007|\u001b\\)|[@-Z\\-_])/g;
export const CLI_SPINNER_LINE_REGEX = /^[\s.·•◦○●◌◍◐◓◑◒◉◎|/\\\-⠁-⣿]+$/u;
type CliOutputStream = "stdout" | "stderr";
const cliOutputDedupCache = new Map<string, { normalized: string; ts: number }>();

export function shouldSkipDuplicateCliOutput(nowMs: () => number, taskId: string, stream: CliOutputStream, text: string): boolean {
  if (CLI_OUTPUT_DEDUP_WINDOW_MS <= 0) return false;
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  const key = `${taskId}:${stream}`;
  const now = nowMs();
  const prev = cliOutputDedupCache.get(key);
  if (prev && prev.normalized === normalized && (now - prev.ts) <= CLI_OUTPUT_DEDUP_WINDOW_MS) {
    cliOutputDedupCache.set(key, { normalized, ts: now });
    return true;
  }
  cliOutputDedupCache.set(key, { normalized, ts: now });
  return false;
}

export function clearCliOutputDedup(taskId: string): void {
  const prefix = `${taskId}:`;
  for (const key of cliOutputDedupCache.keys()) {
    if (key.startsWith(prefix)) cliOutputDedupCache.delete(key);
  }
}

export function normalizeStreamChunk(
  raw: Buffer | string,
  opts: { dropCliNoise?: boolean } = {},
): string {
  const { dropCliNoise = false } = opts;
  const input = typeof raw === "string" ? raw : raw.toString("utf8");
  const normalized = input
    .replace(ANSI_ESCAPE_REGEX, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  if (!dropCliNoise) return normalized;

  return normalized
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (/^reading prompt from stdin\.{0,3}$/i.test(trimmed)) return false;
      if (CLI_SPINNER_LINE_REGEX.test(trimmed)) return false;
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

export function hasStructuredJsonLines(raw: string): boolean {
  return raw.split(/\r?\n/).some((line) => line.trim().startsWith("{"));
}

/** Fetch recent conversation context for an agent to include in spawn prompt */
export function getRecentConversationContext(db: any, agentId: string, limit = 10): string {
  const msgs = db.prepare(`
    SELECT sender_type, sender_id, content, message_type, created_at
    FROM messages
    WHERE (
      (sender_type = 'ceo' AND receiver_type = 'agent' AND receiver_id = ?)
      OR (sender_type = 'agent' AND sender_id = ?)
      OR (receiver_type = 'all')
    )
    ORDER BY created_at DESC
    LIMIT ?
  `).all(agentId, agentId, limit) as Array<{
    sender_type: string;
    sender_id: string | null;
    content: string;
    message_type: string;
    created_at: number;
  }>;

  if (msgs.length === 0) return "";

  const lines = msgs.reverse().map((m) => {
    const role = m.sender_type === "ceo" ? "CEO" : "Agent";
    const type = m.message_type !== "chat" ? ` [${m.message_type}]` : "";
    return `${role}${type}: ${m.content}`;
  });

  return `\n\n--- Recent conversation context ---\n${lines.join("\n")}\n--- End context ---`;
}

export function extractLatestProjectMemoBlock(description: string, maxChars = 1600): string {
  if (!description) return "";
  const marker = "[PROJECT MEMO]";
  const idx = description.lastIndexOf(marker);
  if (idx < 0) return "";
  const block = description.slice(idx)
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!block) return "";
  return block.length > maxChars ? `...${block.slice(-maxChars)}` : block;
}

export function getTaskContinuationContext(
  db: any,
  taskId: string,
  normalizeStreamChunkFn: (raw: string, opts?: { dropCliNoise?: boolean }) => string,
  summarizeForMeetingBubbleFn: (text: string, maxChars?: number) => string,
): string {
  const runCountRow = db.prepare(`
    SELECT COUNT(*) AS cnt
    FROM task_logs
    WHERE task_id = ?
      AND kind = 'system'
      AND message LIKE 'RUN start%'
  `).get(taskId) as { cnt: number } | undefined;
  if ((runCountRow?.cnt ?? 0) === 0) return "";

  const taskRow = db.prepare(
    "SELECT description, result FROM tasks WHERE id = ?"
  ).get(taskId) as { description: string | null; result: string | null } | undefined;

  const latestRunSummary = db.prepare(`
    SELECT message
    FROM task_logs
    WHERE task_id = ?
      AND kind = 'system'
      AND (message LIKE 'RUN completed%' OR message LIKE 'RUN failed%')
    ORDER BY created_at DESC
    LIMIT 1
  `).get(taskId) as { message: string } | undefined;

  const reviewNotes = db.prepare(`
    SELECT raw_note
    FROM review_revision_history
    WHERE task_id = ?
    ORDER BY first_round DESC, id DESC
    LIMIT 6
  `).all(taskId) as Array<{ raw_note: string }>;

  const latestMeetingNotes = db.prepare(`
    SELECT e.speaker_name, e.content
    FROM meeting_minute_entries e
    JOIN meeting_minutes m ON m.id = e.meeting_id
    WHERE m.task_id = ?
      AND m.meeting_type = 'review'
    ORDER BY m.started_at DESC, m.created_at DESC, e.seq DESC
    LIMIT 4
  `).all(taskId) as Array<{ speaker_name: string; content: string }>;

  const unresolvedLines = reviewNotes
    .map((row) => row.raw_note.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 6);

  const meetingLines = latestMeetingNotes
    .map((row) => {
      const clipped = summarizeForMeetingBubbleFn(row.content, 140);
      if (!clipped) return "";
      return `${row.speaker_name}: ${clipped}`;
    })
    .filter(Boolean)
    .reverse()
    .slice(0, 4);

  const memoBlock = extractLatestProjectMemoBlock(taskRow?.description ?? "", 900);
  const normalizedResult = normalizeStreamChunkFn(taskRow?.result ?? "", { dropCliNoise: true }).trim();
  const resultTail = normalizedResult.length > 900
    ? `...${normalizedResult.slice(-900)}`
    : normalizedResult;

  const lines: string[] = [];
  if (latestRunSummary?.message) lines.push(`Last run: ${latestRunSummary.message}`);
  if (unresolvedLines.length > 0) {
    lines.push("Unresolved checklist:");
    lines.push(...unresolvedLines.map((line) => `- ${line}`));
  }
  if (meetingLines.length > 0) {
    lines.push("Latest review meeting highlights:");
    lines.push(...meetingLines.map((line) => `- ${line}`));
  }
  if (memoBlock) {
    lines.push("Latest project memo excerpt:");
    lines.push(memoBlock);
  }
  if (resultTail) {
    lines.push("Previous run output tail:");
    lines.push(resultTail);
  }
  if (lines.length === 0) return "";

  return `\n\n--- Continuation brief (same owner, same task) ---\n${lines.join("\n")}\n--- End continuation brief ---`;
}
