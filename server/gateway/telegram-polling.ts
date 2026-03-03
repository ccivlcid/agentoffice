// @ts-nocheck
/** Telegram long-polling via getUpdates. No webhook/ngrok required — just bot token + chat ID. */

import fs from "node:fs";
import path from "node:path";
import { decryptSecret } from "../oauth/helpers.ts";
import { sendToChannel, sendFileToChannel, deleteTelegramWebhook } from "./send.ts";
import { processInboxPayload } from "../modules/routes/ops/inbox-routes.ts";
import type { InboxCtx } from "../modules/routes/ops/inbox-routes.ts";

const TAG = "[telegram-polling]";
const POLL_TIMEOUT = 30; // seconds (long polling)
const SESSION_REFRESH_MS = 60_000; // re-check DB for session changes
const BACKOFF = [5_000, 10_000, 30_000]; // error retry delays
const REPLY_POLL_MS = 800; // chat agent reply poll interval (fast for messenger UX)
const REPLY_MAX_WAIT_MS = 90_000; // max wait for agent reply

const MEETING_PROMPT_KO = "팀장 소집 회의를 진행할까요?\n1️⃣ 회의 진행 (기획팀 주관)\n2️⃣ 회의 없이 바로 실행";
const DELIVERED_KO = "업무지시 전달 완료 (회의 생략)";
const MEETING_ACK_KO = "회의를 진행합니다.";

const RESET_ACK: Record<string, string> = {
  ko: "대화 세션이 초기화되었습니다. 새 업무를 입력해주세요.",
  en: "Session reset. Please enter a new task.",
  ja: "セッションをリセットしました。新しいタスクを入力してください。",
  zh: "会话已重置。请输入新任务。",
};

/** Parse decision reply: "1" → [1], "1,3" → [1,3], "1 3" → [1,3] */
function parseDecisionReply(text: string): number[] | null {
  const nums = text.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n) && n > 0);
  return nums.length > 0 ? nums : null;
}

/** Per-session polling state */
interface PollSession {
  sessionId: string;
  sessionKey: string;
  token: string;
  target: string;
  agentId: string | null;
  offset: number;
  controller: AbortController;
}

const activeSessions = new Map<string, PollSession>();
const pendingByAuthor = new Map<string, { rawText: string }>();

/** Dedup: track recently processed update_ids to prevent double-handling */
const processedUpdateIds = new Set<number>();
const MAX_PROCESSED_IDS = 500;

/** Pending review approval — key: `${sessionKey}:${chatId}` */
interface PendingReview {
  taskId: string;
  taskTitle: string;
  timer: ReturnType<typeof setTimeout>;
}
const pendingReviewByAuthor = new Map<string, PendingReview>();

let refreshTimer: ReturnType<typeof setInterval> | null = null;
let ctxRef: any = null;

function getInboxCtx(): InboxCtx {
  return ctxRef as InboxCtx;
}

export function startTelegramPolling(ctx: any): void {
  ctxRef = ctx;
  syncSessions();
  refreshTimer = setInterval(syncSessions, SESSION_REFRESH_MS);
  console.log(`${TAG} Polling manager started (refresh every ${SESSION_REFRESH_MS / 1000}s)`);
}

export function stopAllPolling(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  for (const [id, session] of activeSessions) {
    session.controller.abort();
    console.log(`${TAG} Stopped polling: ${id}`);
  }
  activeSessions.clear();
}

/** Sync active DB sessions → start/stop polling loops as needed */
function syncSessions(): void {
  if (!ctxRef?.db) return;
  const rows = ctxRef?.db
    .prepare(
      "SELECT id, session_key, token_enc, target, agent_id FROM messenger_sessions WHERE channel = 'telegram' AND active = 1",
    )
    .all() as { id: string; session_key: string; token_enc: string | null; target: string; agent_id: string | null }[];

  const activeIds = new Set(rows.map((r) => r.id));

  // Stop polling for removed/deactivated sessions
  for (const [id, session] of activeSessions) {
    if (!activeIds.has(id)) {
      session.controller.abort();
      activeSessions.delete(id);
      console.log(`${TAG} Stopped polling (session removed): ${id}`);
    }
  }

  // Update agentId for existing sessions (user may change assignment)
  for (const row of rows) {
    const ex = activeSessions.get(row.id);
    if (ex) ex.agentId = row.agent_id ?? null;
  }
  // Start polling for new sessions
  for (const row of rows) {
    if (activeSessions.has(row.id)) continue;
    if (!row.token_enc) continue;
    let token: string;
    try {
      token = decryptSecret(row.token_enc).trim();
    } catch {
      console.error(`${TAG} Failed to decrypt token for session ${row.id}`);
      continue;
    }
    if (!token || !token.includes(":")) {
      console.error(`${TAG} Invalid token format for session ${row.id} (length=${token.length})`);
      continue;
    }
    const controller = new AbortController();
    const ps: PollSession = {
      sessionId: row.id,
      sessionKey: row.session_key,
      token,
      target: row.target,
      agentId: row.agent_id ?? null,
      offset: 0,
      controller,
    };
    activeSessions.set(row.id, ps);
    void initAndPoll(ps);
  }
}

async function initAndPoll(ps: PollSession): Promise<void> {
  // Remove any existing webhook first
  try {
    await deleteTelegramWebhook(ps.token);
  } catch {
    /* ignore */
  }
  const masked = ps.token.length > 10 ? `${ps.token.slice(0, 6)}...${ps.token.slice(-4)}` : "***";
  console.log(`${TAG} Started polling: ${ps.sessionId} (target: ${ps.target}, token: ${masked})`);
  void pollLoop(ps, 0);
}

async function pollLoop(ps: PollSession, errorCount: number): Promise<void> {
  while (!ps.controller.signal.aborted) {
    try {
      const url = `https://api.telegram.org/bot${ps.token}/getUpdates?offset=${ps.offset}&timeout=${POLL_TIMEOUT}`;
      const resp = await fetch(url, { signal: ps.controller.signal });

      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        throw new Error(`API ${resp.status}: ${body.slice(0, 200)}`);
      }

      const data = (await resp.json()) as { ok: boolean; result?: any[] };
      if (!data.ok || !data.result) {
        throw new Error("Unexpected response from getUpdates");
      }

      errorCount = 0; // reset on success

      for (const update of data.result) {
        ps.offset = (update.update_id ?? ps.offset) + 1;
        await handleUpdate(ps, update);
      }
    } catch (err: any) {
      if (ps.controller.signal.aborted) return;
      const delay = BACKOFF[Math.min(errorCount, BACKOFF.length - 1)];
      console.error(`${TAG} Poll error (session ${ps.sessionId}), retry in ${delay / 1000}s:`, err.message);
      errorCount++;
      await sleep(delay, ps.controller.signal);
    }
  }
}

async function handleUpdate(ps: PollSession, update: Record<string, unknown>): Promise<void> {
  // Ignore edited messages — only process new messages
  if (update.edited_message && !update.message) return;

  // Dedup: skip already-processed updates (prevents double-handling across sessions with same bot token)
  const updateId = typeof update.update_id === "number" ? update.update_id : null;
  if (updateId !== null) {
    if (processedUpdateIds.has(updateId)) return;
    processedUpdateIds.add(updateId);
    if (processedUpdateIds.size > MAX_PROCESSED_IDS) {
      const oldest = processedUpdateIds.values().next().value;
      if (oldest !== undefined) processedUpdateIds.delete(oldest);
    }
  }

  const text = getMessageText(update);
  const chatId = getChatId(update);
  if (!chatId || !text?.trim()) return;

  const trimmed = text.trim();
  const key = `${ps.sessionKey}:${chatId}`;

  // /new command — reset session binding
  if (trimmed.toLowerCase() === "/new") {
    pendingByAuthor.delete(key);
    const lang = ctxRef?.getPreferredLanguage?.() ?? "ko";
    await replyTg(ps.token, chatId, RESET_ACK[lang] ?? RESET_ACK.ko);
    return;
  }

  // Handle pending review approval ("1" = approve, "2" = rework)
  const pendingReview = pendingReviewByAuthor.get(key);
  if (pendingReview && (trimmed === "1" || trimmed === "2")) {
    pendingReviewByAuthor.delete(key);
    clearTimeout(pendingReview.timer);
    if (trimmed === "1") {
      // Approve → directly mark as done (skip AI meeting entirely)
      const ctx = ctxRef;
      if (ctx?.db) {
        const t = Date.now();
        ctx.db.prepare("UPDATE tasks SET status = 'done', completed_at = ?, updated_at = ? WHERE id = ?").run(t, t, pendingReview.taskId);
        ctx.appendTaskLog?.(pendingReview.taskId, "system", "Status → done (approved via messenger review)");
        ctx.endTaskExecutionSession?.(pendingReview.taskId, "messenger_approved");
        const updatedTask = ctx.db.prepare("SELECT * FROM tasks WHERE id = ?").get(pendingReview.taskId);
        ctx.broadcast?.("task_update", updatedTask);
        // Free the agent
        const agentId = updatedTask?.assigned_agent_id;
        if (agentId) {
          ctx.db.prepare("UPDATE agents SET status = 'idle', current_task_id = NULL WHERE id = ?").run(agentId);
          ctx.broadcast?.("agent_status", ctx.db.prepare("SELECT * FROM agents WHERE id = ?").get(agentId));
        }
      }
      await replyTg(ps.token, chatId, `✅ '${pendingReview.taskTitle}' 승인 완료되었습니다.`);
    } else {
      // Rework → revert to planned and re-execute
      const ctx = ctxRef;
      if (ctx?.db) {
        const t = Date.now();
        const task = ctx.db.prepare("SELECT * FROM tasks WHERE id = ?").get(pendingReview.taskId);
        if (task?.assigned_agent_id) {
          ctx.db.prepare("UPDATE tasks SET status = 'planned', updated_at = ? WHERE id = ?").run(t, pendingReview.taskId);
          ctx.appendTaskLog?.(pendingReview.taskId, "system", "REWORK requested via messenger review");
          ctx.broadcast?.("task_update", ctx.db.prepare("SELECT * FROM tasks WHERE id = ?").get(pendingReview.taskId));
          const agent = ctx.db.prepare("SELECT * FROM agents WHERE id = ?").get(task.assigned_agent_id);
          if (agent) {
            const deptName = task.department_id ? (ctx.getDeptName?.(task.department_id) ?? "Unassigned") : "Unassigned";
            setTimeout(() => {
              ctx.startTaskExecutionForAgent?.(pendingReview.taskId, agent, task.department_id, deptName);
            }, 1000);
          }
        }
      }
      await replyTg(ps.token, chatId, `🔄 '${pendingReview.taskTitle}' 수정 요청됨. 에이전트가 재작업합니다.`);
    }
    return;
  }

  const pending = pendingByAuthor.get(key);

  // Handle pending meeting/decision choices — supports multi-select: "1", "1,3", "1 3"
  if (pending) {
    const choices = parseDecisionReply(trimmed);
    if (choices) {
      pendingByAuthor.delete(key);
      const opts: Record<string, unknown> = {
        source: "telegram",
        text: pending.rawText,
        author: chatId,
        session_key: ps.sessionKey,
      };
      if (choices.includes(1)) opts.confirmMeeting = true;
      else opts.skipPlannedMeeting = true;
      opts.decisionChoices = choices;
      const result = await processInboxPayload(getInboxCtx(), opts);
      if (result.status === 200) {
        const fb = choices.includes(1) ? MEETING_ACK_KO : DELIVERED_KO;
        const msg = (result.json.message as string) || fb;
        await replyTg(ps.token, chatId, typeof msg === "string" ? msg : fb);
      }
      return;
    }
  }

  // $ prefix → always a CEO directive (explicit intent)
  if (trimmed.startsWith("$")) return handleDirective(ps, chatId, trimmed);

  // Agent-bound session → always route to agent (agent decides task vs chat)
  // Only explicit $ prefix bypasses this to force directive mode
  if (ps.agentId) {
    console.log(`${TAG} → agent ${ps.agentId}: "${trimmed.slice(0, 40)}"`);
    void handleChatWithAgent(ps, chatId, trimmed);
    return;
  }

  // No agent bound → treat as CEO directive
  return handleDirective(ps, chatId, `$ ${trimmed}`);
}

async function handleDirective(ps: PollSession, chatId: string, rawText: string): Promise<void> {
  const key = `${ps.sessionKey}:${chatId}`;
  const result = await processInboxPayload(getInboxCtx(), {
    source: "telegram",
    text: rawText,
    author: chatId,
    session_key: ps.sessionKey,
    skipPlannedMeeting: false,
  });
  if (result.status === 200) {
    if (result.json.need_meeting_choice === true) {
      pendingByAuthor.set(key, { rawText });
      await replyTg(ps.token, chatId, MEETING_PROMPT_KO);
    } else if (result.json.delivered === true) {
      const msg = (result.json.message as string) || DELIVERED_KO;
      await replyTg(ps.token, chatId, typeof msg === "string" ? msg : DELIVERED_KO);
    }
  }
}

/** Route casual chat to the assigned agent, poll for reply, relay back to Telegram. */
async function handleChatWithAgent(ps: PollSession, chatId: string, text: string): Promise<void> {
  const ctx = ctxRef;
  if (!ctx?.db || !ps.agentId) return;
  const now = Date.now();
  try {
    await ctx.insertMessageWithIdempotency({
      senderType: "ceo",
      senderId: null,
      receiverType: "agent",
      receiverId: ps.agentId,
      content: text,
      messageType: "chat",
      idempotencyKey: `tg:${ps.sessionKey}:${chatId}:${now}`,
    });
  } catch {
    /* idempotency conflict OK */
  }
  ctx.scheduleAgentReply(ps.agentId, text, "chat", { messengerSessionKey: ps.sessionKey, messengerAuthor: chatId });
  const deadline = now + REPLY_MAX_WAIT_MS;
  // Listen for both 'chat' and 'task_assign' replies — agent decides which type to send
  const q = `SELECT content FROM messages WHERE sender_type='agent' AND sender_id=? AND message_type IN ('chat','task_assign') AND created_at>? ORDER BY created_at ASC LIMIT 1`;
  while (Date.now() < deadline && !ps.controller.signal.aborted) {
    await sleep(REPLY_POLL_MS, ps.controller.signal);
    if (ps.controller.signal.aborted) return;
    const row = ctx.db.prepare(q).get(ps.agentId, now) as { content: string } | undefined;
    if (row?.content) {
      await replyTg(ps.token, chatId, row.content);
      return;
    }
  }
  console.warn(`${TAG} Agent reply timeout for session ${ps.sessionId}`);
}

function getMessageText(update: Record<string, unknown>): string | null {
  const msg = update.message ?? update.edited_message;
  if (!msg || typeof msg !== "object") return null;
  return typeof (msg as any).text === "string" ? (msg as any).text : null;
}

function getChatId(update: Record<string, unknown>): string | null {
  const msg = update.message ?? update.edited_message;
  if (!msg || typeof msg !== "object") return null;
  const chat = (msg as any).chat;
  return chat?.id != null ? String(chat.id) : null;
}

async function replyTg(token: string, chatId: string, message: string): Promise<void> {
  try {
    await sendToChannel("telegram", chatId, message, token);
  } catch {
    /* best effort */
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

const REVIEW_TIMEOUT_MS = 60_000;

/**
 * Send a review request to the messenger session that originated this task.
 * Returns true if the request was sent (caller should defer finishReview).
 */
export function requestMessengerReview(taskId: string, taskTitle: string, finishReviewFn: (id: string, title: string, opts?: any) => void): boolean {
  if (!ctxRef?.db) return false;

  // Find the messenger route for this task
  const route = ctxRef.db.prepare("SELECT * FROM messenger_routes WHERE task_id = ? LIMIT 1").get(taskId) as any;
  if (!route?.session_key) return false;

  const session = ctxRef.db.prepare(
    "SELECT * FROM messenger_sessions WHERE session_key = ? AND active = 1"
  ).get(route.session_key) as any;
  if (!session?.token_enc) return false;

  let token: string;
  try {
    token = decryptSecret(session.token_enc).trim();
  } catch { return false; }

  const target = route.author || session.target;
  if (!target) return false;

  const key = `${session.session_key}:${target}`;

  // Send review request message
  const msg = [
    `━━━━━━━━━━━━━━━━━━━`,
    `[검수 요청] ${taskTitle}`,
    `에이전트가 작업을 완료했습니다.`,
    ``,
    `1️⃣ 승인 (완료 처리)`,
    `2️⃣ 수정 요청 (재작업)`,
    ``,
    `숫자로 답변해주세요 (60초 후 자동 검수)`,
    `━━━━━━━━━━━━━━━━━━━`,
  ].join("\n");

  sendToChannel(session.channel, target, msg, token).catch(() => {});

  // Send deliverable files with the review request so CEO can inspect
  void sendReviewDeliverables(taskId, session.channel, target, token);

  // Register pending review with timeout fallback
  const timer = setTimeout(() => {
    pendingReviewByAuthor.delete(key);
    console.log(`${TAG} Review timeout for task ${taskId}, falling back to AI review`);
    finishReviewFn(taskId, taskTitle);
  }, REVIEW_TIMEOUT_MS);

  pendingReviewByAuthor.set(key, { taskId, taskTitle, timer });
  console.log(`${TAG} Review request sent for task ${taskId} → ${session.channel}:${target} (timeout ${REVIEW_TIMEOUT_MS / 1000}s)`);
  return true;
}

const DELIVERABLE_EXTS = new Set([".pptx", ".pdf", ".html", ".png", ".jpg", ".mp4", ".zip", ".md", ".xlsx"]);

async function sendReviewDeliverables(taskId: string, channel: string, target: string, token: string): Promise<void> {
  try {
    const db = ctxRef?.db;
    if (!db) return;
    const task = db.prepare("SELECT project_path, title FROM tasks WHERE id = ?").get(taskId) as any;
    if (!task) return;
    const projectPath = task.project_path || process.cwd();

    // Only scan this task's + related subtask worktrees
    const relatedIds = [taskId];
    try {
      const subs = db.prepare("SELECT delegated_task_id FROM subtasks WHERE task_id = ? AND delegated_task_id IS NOT NULL").all(taskId) as any[];
      for (const s of subs) if (s.delegated_task_id) relatedIds.push(s.delegated_task_id);
      const children = db.prepare("SELECT id FROM tasks WHERE source_task_id = ?").all(taskId) as any[];
      for (const c of children) relatedIds.push(c.id);
    } catch { /* ignore */ }

    const searchDirs: string[] = [
      path.join(projectPath, "output"),
      path.join(projectPath, "slides"),
    ];
    const worktreeBase = path.join(projectPath, ".climpire-worktrees");
    if (fs.existsSync(worktreeBase)) {
      for (const tid of relatedIds) {
        const wtPath = path.join(worktreeBase, tid.slice(0, 8));
        if (fs.existsSync(wtPath)) {
          searchDirs.push(path.join(wtPath, "output"));
          searchDirs.push(path.join(wtPath, "slides"));
        }
      }
    }

    const cutoff = Date.now() - 60 * 60 * 1000; // last 1 hour
    const found: string[] = [];

    function scanDir(dir: string, depth = 0): void {
      if (depth > 5 || !fs.existsSync(dir)) return;
      try {
        for (const name of fs.readdirSync(dir)) {
          const fullPath = path.join(dir, name);
          try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) { scanDir(fullPath, depth + 1); continue; }
            const ext = path.extname(name).toLowerCase();
            if (!DELIVERABLE_EXTS.has(ext)) continue;
            if (stat.mtimeMs > cutoff && stat.size > 0 && stat.size < 50 * 1024 * 1024) {
              found.push(fullPath);
            }
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }

    for (const dir of searchDirs) { scanDir(dir); }

    if (found.length === 0) return;
    found.sort((a, b) => { try { return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs; } catch { return 0; } });

    for (const filePath of found.slice(0, 5)) {
      const relPath = path.relative(projectPath, filePath).replace(/\\/g, "/");
      const caption = `📎 ${relPath}`;
      const sent = await sendFileToChannel(channel, target, filePath, caption, token);
      if (!sent) {
        await sendToChannel(channel, target, `📎 산출물: ${relPath}`, token).catch(() => {});
      }
    }
  } catch (err) {
    console.warn(`${TAG} sendReviewDeliverables failed:`, err);
  }
}
