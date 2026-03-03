/**
 * Gateway / external messenger integration.
 * `createNotifyTaskStatus` returns a closure that pushes task status
 * notifications to the originating messenger session via messenger_routes.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { sendToChannel, sendFileToChannel } from "./send.ts";
import { decryptSecret } from "../oauth/helpers.ts";

export type NotifyTaskStatusFn = (taskId: string, title: string, status: string, lang?: string) => void;

const STATUS_LABEL: Record<string, string> = {
  done: "[완료]",
  in_progress: "[진행]",
  review: "[검토]",
};

export function createNotifyTaskStatus(db: any): NotifyTaskStatusFn {
  return function notifyTaskStatus(taskId: string, title: string, status: string, _lang?: string): void {
    if (!STATUS_LABEL[status]) return;

    let route = db.prepare("SELECT * FROM messenger_routes WHERE task_id = ? LIMIT 1").get(taskId) as any;

    if (!route) {
      const hash = createHash("sha256").update(title).digest("hex").slice(0, 32);
      route = db
        .prepare(
          "SELECT * FROM messenger_routes WHERE content_hash = ? ORDER BY created_at DESC LIMIT 1",
        )
        .get(hash) as any;
      if (route) {
        try {
          db.prepare("UPDATE messenger_routes SET task_id = ? WHERE id = ?").run(taskId, route.id);
        } catch {
          /* ignore concurrent update */
        }
      }
    }

    if (!route?.session_key) {
      console.log(`[gateway] notifyTaskStatus: no messenger route for task ${taskId} (title="${title.slice(0, 40)}")`);
      return;
    }

    // Prefer token_key-aware lookup for multi-token route isolation
    const session = route.token_key
      ? (db.prepare("SELECT * FROM messenger_sessions WHERE session_key = ? AND token_key = ? AND active = 1").get(route.session_key, route.token_key) as any)
        ?? (db.prepare("SELECT * FROM messenger_sessions WHERE session_key = ? AND active = 1").get(route.session_key) as any)
      : (db.prepare("SELECT * FROM messenger_sessions WHERE session_key = ? AND active = 1").get(route.session_key) as any);
    if (!session) return;

    const text = `${STATUS_LABEL[status]} ${title}`;

    let token: string | null = null;
    if (session.token_enc) {
      try {
        token = decryptSecret(session.token_enc);
      } catch {
        return;
      }
    }

    console.log(`[gateway] notifyTaskStatus: sending "${text.slice(0, 60)}" → ${session.channel}:${session.target}`);
    sendToChannel(session.channel, session.target, text, token).catch((err) => {
      console.warn(`[gateway] notifyTaskStatus send failed:`, err?.message ?? err);
    });

    // On task completion, find and send deliverable files (PPT, PDF, images, etc.)
    if (status === "done") {
      void sendTaskDeliverables(db, taskId, session.channel, route.author || session.target, token);
    }
  };
}

const DELIVERABLE_EXTENSIONS = [".pptx", ".pdf", ".html", ".png", ".jpg", ".mp4", ".zip"];
const MAX_DELIVERABLE_SIZE = 50 * 1024 * 1024; // 50MB

async function sendTaskDeliverables(
  db: any,
  taskId: string,
  channel: string,
  target: string,
  token: string | null,
): Promise<void> {
  try {
    const task = db.prepare("SELECT project_path, title FROM tasks WHERE id = ?").get(taskId) as any;
    if (!task) return;
    const projectPath = task.project_path || process.cwd();

    // Collect this task + related subtask/child task IDs
    const relatedTaskIds = [taskId];
    try {
      const subs = db.prepare("SELECT delegated_task_id FROM subtasks WHERE task_id = ? AND delegated_task_id IS NOT NULL").all(taskId) as any[];
      for (const s of subs) if (s.delegated_task_id) relatedTaskIds.push(s.delegated_task_id);
      const children = db.prepare("SELECT id FROM tasks WHERE source_task_id = ?").all(taskId) as any[];
      for (const c of children) relatedTaskIds.push(c.id);
    } catch { /* ignore */ }

    const searchDirs = [
      path.join(projectPath, "output"),
      path.join(projectPath, "slides"),
    ];

    // Only scan worktrees belonging to this task and its subtasks
    const worktreeBase = path.join(projectPath, ".climpire-worktrees");
    if (fs.existsSync(worktreeBase)) {
      for (const tid of relatedTaskIds) {
        const shortId = tid.slice(0, 8);
        const wtPath = path.join(worktreeBase, shortId);
        if (fs.existsSync(wtPath)) {
          searchDirs.push(path.join(wtPath, "output"));
          searchDirs.push(path.join(wtPath, "slides"));
        }
      }
    }

    // Find recently modified deliverable files (last 1 hour)
    const cutoff = Date.now() - 60 * 60 * 1000;
    const found: string[] = [];

    function scanDeliverableDir(dir: string, depth = 0): void {
      if (depth > 5 || !fs.existsSync(dir)) return;
      try {
        for (const name of fs.readdirSync(dir)) {
          const fullPath = path.join(dir, name);
          try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) { scanDeliverableDir(fullPath, depth + 1); continue; }
            const ext = path.extname(name).toLowerCase();
            if (!DELIVERABLE_EXTENSIONS.includes(ext)) continue;
            if (stat.mtimeMs > cutoff && stat.size > 0 && stat.size < MAX_DELIVERABLE_SIZE) {
              found.push(fullPath);
            }
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }

    for (const dir of searchDirs) { scanDeliverableDir(dir); }

    if (found.length === 0) return;

    // Send up to 3 most recent files
    found.sort((a, b) => {
      try {
        return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs;
      } catch { return 0; }
    });

    for (const filePath of found.slice(0, 3)) {
      const fileName = path.basename(filePath);
      const relPath = path.relative(projectPath, filePath).replace(/\\/g, "/");
      const caption = `📎 ${task.title}\n${relPath}`;
      const sent = await sendFileToChannel(channel, target, filePath, caption, token);
      if (!sent) {
        // Fallback: send path as text
        await sendToChannel(channel, target, `📎 산출물: ${relPath}`, token).catch(() => {});
      }
    }
  } catch (err) {
    console.warn(`[gateway] deliverable scan failed for task ${taskId}:`, err);
  }
}

/**
 * Backward-compatible named export.
 * Several modules import this symbol at load time to seed RuntimeContext.
 * The real implementation is created via `createNotifyTaskStatus(db)` in workflow.ts
 * and overwrites this placeholder on the runtime object.
 */
export function notifyTaskStatus(_taskId: string, _title: string, _status: string, _lang?: string): void {
  // No-op placeholder — replaced at runtime by createNotifyTaskStatus(db)
}

export async function gatewayHttpInvoke(_req: {
  tool: string;
  action?: string;
  args?: Record<string, unknown>;
}): Promise<unknown> {
  throw new Error("gateway not configured");
}
