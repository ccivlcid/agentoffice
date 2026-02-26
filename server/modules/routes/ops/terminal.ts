// @ts-nocheck
/**
 * Terminal log viewer: GET /api/tasks/:id/terminal.
 * Parsing logic is split across terminal-parser.ts, terminal-helpers.ts, terminal-progress-handlers.ts.
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import fs from "node:fs";
import path from "node:path";
import { prettyStreamJson } from "./terminal-parser.ts";
import type { TerminalProgressHintItem } from "./terminal-helpers.ts";
import { clipHint } from "./terminal-helpers.ts";
import {
  createHintBuilderState,
  processClaudeLine,
  processCodexLine,
  processOpenCodeLine,
  processGeminiLine,
} from "./terminal-progress-handlers.ts";

function buildTerminalProgressHints(raw: string, maxHints = 14): {
  current_file: string | null;
  hints: TerminalProgressHintItem[];
  ok_items: string[];
} {
  const state = createHintBuilderState();
  const hints: TerminalProgressHintItem[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || !t.startsWith("{")) continue;
    try {
      const j: any = JSON.parse(t);
      if (processClaudeLine(j, state, hints)) continue;
      if (processCodexLine(j, state, hints)) continue;
      if (processOpenCodeLine(j, state, hints)) continue;
      if (processGeminiLine(j, state, hints)) continue;
    } catch {
      // ignore malformed stream-json lines
    }
  }

  const compacted: TerminalProgressHintItem[] = [];
  for (const row of hints.slice(-Math.max(maxHints * 3, 24))) {
    const prev = compacted[compacted.length - 1];
    if (prev && prev.phase === row.phase && prev.tool === row.tool && prev.summary === row.summary && prev.file_path === row.file_path) {
      continue;
    }
    compacted.push(row);
  }

  const recent = compacted.slice(-maxHints);
  const latestFile = [...recent].reverse().find((r) => !!r.file_path)?.file_path ?? null;
  const okItems = [...new Set(
    recent
      .filter((r) => r.phase === "ok")
      .map((r) => clipHint(r.summary, 120))
      .filter(Boolean)
  )].slice(-4);

  return { current_file: latestFile, hints: recent, ok_items: okItems };
}

export function registerOpsTerminal(ctx: RuntimeContext): { prettyStreamJson: (raw: string, opts?: { includeReasoning?: boolean }) => string } {
  const { app, db, logsDir, hasStructuredJsonLines } = ctx;

  app.get("/api/tasks/:id/terminal", (req: any, res: any) => {
    const id = String(req.params.id);
    const lines = Math.min(Math.max(Number(req.query.lines ?? 200), 20), 20000);
    const logLimit = Math.min(Math.max(Number(req.query.log_limit ?? 400), 50), 2000);
    const pretty = String(req.query.pretty ?? "0") === "1";
    const filePath = path.join(logsDir, `${id}.log`);

    if (!fs.existsSync(filePath)) {
      return res.json({ ok: true, exists: false, path: filePath, text: "" });
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const parts = raw.split(/\r?\n/);
    const tail = parts.slice(Math.max(0, parts.length - lines)).join("\n");
    let text = tail;
    let progressHints: ReturnType<typeof buildTerminalProgressHints> | null = null;
    if (pretty) {
      text = prettyStreamJson(tail, { includeReasoning: true });
      if (hasStructuredJsonLines(tail)) {
        const hints = buildTerminalProgressHints(tail);
        if (hints.hints.length > 0) progressHints = hints;
      }
    }

    const taskLogs = db.prepare(
      "SELECT id, kind, message, created_at FROM task_logs WHERE task_id = ? ORDER BY created_at DESC LIMIT ?"
    ).all(id, logLimit) as Array<{ id: number; kind: string; message: string; created_at: number }>;
    taskLogs.reverse();

    res.json({ ok: true, exists: true, path: filePath, text, task_logs: taskLogs, progress_hints: progressHints });
  });

  return { prettyStreamJson };
}
