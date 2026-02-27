/**
 * Gateway / external messenger integration.
 * `createNotifyTaskStatus` returns a closure that pushes task status
 * notifications to the originating messenger session via messenger_routes.
 */

import { createHash } from "node:crypto";
import { sendToChannel } from "./send.ts";
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
          "SELECT * FROM messenger_routes WHERE content_hash = ? AND task_id IS NULL ORDER BY created_at DESC LIMIT 1",
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

    if (!route?.session_key) return;

    const session = db
      .prepare("SELECT * FROM messenger_sessions WHERE session_key = ? AND active = 1")
      .get(route.session_key) as any;
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

    sendToChannel(session.channel, session.target, text, token).catch(() => {
      /* best-effort: silently ignore send failures */
    });
  };
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
