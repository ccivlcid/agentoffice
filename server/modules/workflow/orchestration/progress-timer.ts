// @ts-nocheck

import { randomUUID, createHash } from "node:crypto";
import { sendToChannel } from "../../../gateway/send.ts";
import { decryptSecret } from "../../../oauth/helpers.ts";

export function createProgressTimerHelpers(ctx: {
  db: any;
  nowMs: () => number;
  broadcast: (...args: any[]) => void;
  resolveLang: (...args: any[]) => any;
  pickL: (...args: any[]) => string;
  l: (...args: any[]) => any;
  findTeamLeader: (...args: any[]) => any;
  sendAgentMessage: (...args: any[]) => void;
  progressTimers: Map<string, ReturnType<typeof setInterval>>;
}) {
  const {
    db, nowMs, broadcast, resolveLang, pickL, l,
    findTeamLeader, sendAgentMessage, progressTimers,
  } = ctx;

  function startProgressTimer(taskId: string, taskTitle: string, departmentId: string | null): void {
    const timer = setInterval(() => {
      const currentTask = db.prepare("SELECT status FROM tasks WHERE id = ?").get(taskId) as { status: string } | undefined;
      if (!currentTask || currentTask.status !== "in_progress") {
        clearInterval(timer);
        progressTimers.delete(taskId);
        return;
      }
      const leader = findTeamLeader(departmentId);
      if (leader) {
        const lang = resolveLang(taskTitle);
        sendAgentMessage(
          leader,
          pickL(l(
            [`대표님, '${taskTitle}' 작업 진행 중입니다. 현재 순조롭게 진행되고 있어요.`],
            [`CEO, '${taskTitle}' is in progress and currently going smoothly.`],
            [`CEO、'${taskTitle}' は進行中で、現在は順調です。`],
            [`CEO，'${taskTitle}' 正在进行中，目前进展顺利。`],
          ), lang),
          "report",
          "all",
          null,
          taskId,
        );
      }
    }, 300_000);
    progressTimers.set(taskId, timer);
  }

  function stopProgressTimer(taskId: string): void {
    const timer = progressTimers.get(taskId);
    if (timer) {
      clearInterval(timer);
      progressTimers.delete(taskId);
    }
  }

  function notifyCeo(content: string, taskId: string | null = null, messageType: string = "status_update"): void {
    const msgId = randomUUID();
    const t = nowMs();
    db.prepare(
      `INSERT INTO messages (id, sender_type, sender_id, receiver_type, receiver_id, content, message_type, task_id, created_at)
       VALUES (?, 'system', NULL, 'all', NULL, ?, ?, ?, ?)`
    ).run(msgId, content, messageType, taskId, t);
    broadcast("new_message", {
      id: msgId,
      sender_type: "system",
      content,
      message_type: messageType,
      task_id: taskId,
      created_at: t,
    });

    // Relay to messenger if task has a messenger route
    if (taskId) {
      try {
        let route = db.prepare("SELECT * FROM messenger_routes WHERE task_id = ? LIMIT 1").get(taskId) as any;

        // Fallback: match by content_hash if task_id not yet linked
        if (!route) {
          const task = db.prepare("SELECT title FROM tasks WHERE id = ?").get(taskId) as any;
          if (task?.title) {
            const hash = createHash("sha256").update(task.title).digest("hex").slice(0, 32);
            route = db.prepare("SELECT * FROM messenger_routes WHERE content_hash = ? ORDER BY created_at DESC LIMIT 1").get(hash) as any;
            if (route) {
              try { db.prepare("UPDATE messenger_routes SET task_id = ? WHERE id = ?").run(taskId, route.id); } catch { /* ignore */ }
            }
          }
        }

        if (route?.session_key) {
          const session = db.prepare("SELECT * FROM messenger_sessions WHERE session_key = ? AND active = 1").get(route.session_key) as any;
          if (session?.token_enc) {
            const token = decryptSecret(session.token_enc).trim();
            const target = route.author || session.target;
            const compact = content.length > 500 ? content.slice(0, 497) + "..." : content;
            sendToChannel(session.channel, target, compact, token).catch(() => {});
          }
        }
      } catch { /* best-effort */ }
    }
  }

  return { startProgressTimer, stopProgressTimer, notifyCeo };
}
