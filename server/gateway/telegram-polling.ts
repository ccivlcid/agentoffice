// @ts-nocheck
/** Telegram long-polling via getUpdates. No webhook/ngrok required — just bot token + chat ID. */

import { decryptSecret } from "../oauth/helpers.ts";
import { sendToChannel, deleteTelegramWebhook } from "./send.ts";
import { processInboxPayload } from "../modules/routes/ops/inbox-routes.ts";
import type { InboxCtx } from "../modules/routes/ops/inbox-routes.ts";

const TAG = "[telegram-polling]";
const POLL_TIMEOUT = 30; // seconds (long polling)
const SESSION_REFRESH_MS = 60_000; // re-check DB for session changes
const BACKOFF = [5_000, 10_000, 30_000]; // error retry delays
const REPLY_POLL_MS = 2_000; // chat agent reply poll interval
const REPLY_MAX_WAIT_MS = 90_000; // max wait for agent reply

const MEETING_PROMPT_KO = "팀장 소집 회의를 진행할까요?\n1️⃣ 회의 진행 (기획팀 주관)\n2️⃣ 회의 없이 바로 실행";
const DELIVERED_KO = "업무지시 전달 완료 (회의 생략)";
const MEETING_ACK_KO = "회의를 진행합니다.";

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
  const text = getMessageText(update);
  const chatId = getChatId(update);
  if (!chatId || !text?.trim()) return;

  const trimmed = text.trim();
  const key = `${ps.sessionKey}:${chatId}`;
  const pending = pendingByAuthor.get(key);

  // Handle pending meeting choices ("1" or "2")
  if (pending && (trimmed === "1" || trimmed === "2")) {
    pendingByAuthor.delete(key);
    const opts: Record<string, unknown> = {
      source: "telegram",
      text: pending.rawText,
      author: chatId,
      session_key: ps.sessionKey,
    };
    if (trimmed === "1") opts.confirmMeeting = true;
    else opts.skipPlannedMeeting = true;
    const result = await processInboxPayload(getInboxCtx(), opts);
    if (result.status === 200) {
      const fb = trimmed === "1" ? MEETING_ACK_KO : DELIVERED_KO;
      const msg = (result.json.message as string) || fb;
      await replyTg(ps.token, chatId, typeof msg === "string" ? msg : fb);
    }
    return;
  }

  // $ prefix → always a CEO directive
  if (trimmed.startsWith("$")) return handleDirective(ps, chatId, trimmed);

  // Analyze content: is this a task/directive or casual chat?
  const isTask = ctxRef?.shouldTreatDirectChatAsTask?.(trimmed, "chat") ?? false;

  if (isTask) {
    // Task-like message → CEO directive flow regardless of agent assignment
    console.log(`${TAG} Detected task intent, routing as directive: "${trimmed.slice(0, 40)}"`);
    return handleDirective(ps, chatId, `$ ${trimmed}`);
  }

  // Casual chat with assigned agent → forward to agent
  if (ps.agentId) {
    console.log(`${TAG} Chat → agent ${ps.agentId}: "${trimmed.slice(0, 40)}"`);
    void handleChatWithAgent(ps, chatId, trimmed);
    return;
  }

  // No agent, non-task → still treat as directive (fallback)
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
  ctx.scheduleAgentReply(ps.agentId, text, "chat");
  const deadline = now + REPLY_MAX_WAIT_MS;
  const q = `SELECT content FROM messages WHERE sender_type='agent' AND sender_id=? AND message_type='chat' AND created_at>? ORDER BY created_at ASC LIMIT 1`;
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
