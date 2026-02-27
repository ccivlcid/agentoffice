// @ts-nocheck

/**
 * External inbox webhook — POST /api/inbox
 * Receives CEO directives from external messengers (Telegram, etc.).
 * Two-phase flow: Phase 1 → need_meeting_choice, Phase 2 → delegate.
 * processInboxPayload is shared so Telegram polling can call it directly.
 */

import { createHash, randomUUID } from "node:crypto";
import { normalizeSecret } from "../../../config/runtime.ts";

const INBOX_SECRET = normalizeSecret(process.env.INBOX_WEBHOOK_SECRET);

export type InboxCtx = {
  db: any;
  broadcast: (event: string, data: any) => void;
  normalizeTextField: (val: any) => string | null;
  insertMessageWithIdempotency: (opts: any) => Promise<{ message: any; created: boolean }>;
  IdempotencyConflictError: any;
  StorageBusyError: any;
  handleTaskDelegation: (agent: any, content: string, ctx: string, opts?: any) => void;
  findTeamLeader: (deptId: string) => any;
  scheduleAnnouncementReplies: (content: string) => void;
  analyzeDirectivePolicy: (content: string) => any;
  shouldExecuteDirectiveDelegation: (policy: any, skip: boolean) => boolean;
  detectMentions: (content: string) => { deptIds: string[]; agentIds: string[] };
};

/** Process inbox payload (no secret check). Returns status + json for HTTP response. */
export async function processInboxPayload(
  ctx: InboxCtx,
  body: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const {
    db,
    broadcast,
    normalizeTextField,
    insertMessageWithIdempotency,
    IdempotencyConflictError,
    StorageBusyError,
    handleTaskDelegation,
    findTeamLeader,
    scheduleAnnouncementReplies,
    analyzeDirectivePolicy,
    shouldExecuteDirectiveDelegation,
    detectMentions,
  } = ctx;

  const source = normalizeTextField(body.source);
  const rawText = normalizeTextField(body.text);
  const author = normalizeTextField(body.author);

  if (!source || !rawText || !author) {
    return { status: 400, json: { error: "source, text, and author are required" } };
  }

  const content = (rawText ?? "").replace(/^\$\s*/, "").trim();
  if (!content) {
    return { status: 400, json: { error: "text content is empty after stripping $ prefix" } };
  }

  const skipPlannedMeeting = body.skipPlannedMeeting === true;
  const confirmMeeting = body.confirmMeeting === true;
  const projectId = normalizeTextField(body.project_id);
  const projectPath = normalizeTextField(body.project_path);
  const projectContext = normalizeTextField(body.project_context);
  const sessionKey = normalizeTextField(body.session_key);

  const textHash = createHash("sha256").update(rawText).digest("hex").slice(0, 16);
  const idempotencyKey = `inbox:${source}:${author}:${textHash}`;

  let storedMessage: any;
  let created: boolean;
  try {
    ({ message: storedMessage, created } = await insertMessageWithIdempotency({
      senderType: "ceo",
      senderId: null,
      receiverType: "all",
      receiverId: null,
      content,
      messageType: "directive",
      idempotencyKey,
    }));
  } catch (err: any) {
    if (err instanceof IdempotencyConflictError) {
      return { status: 409, json: { error: "idempotency_conflict", idempotency_key: err.key } };
    }
    if (err instanceof StorageBusyError) {
      return { status: 503, json: { error: "storage_busy", retryable: true } };
    }
    throw err;
  }

  if (!skipPlannedMeeting && !confirmMeeting) {
    if (created) {
      broadcast("announcement", storedMessage);
      scheduleAnnouncementReplies(content);
    }
    return { status: 200, json: { ok: true, need_meeting_choice: true, message: storedMessage } };
  }

  if (created) {
    broadcast("announcement", storedMessage);
    scheduleAnnouncementReplies(content);
  }

  const contentHash = createHash("sha256").update(content).digest("hex").slice(0, 32);
  try {
    db.prepare(
      `INSERT OR IGNORE INTO messenger_routes (id, task_id, content_hash, source, author, session_key, created_at)
       VALUES (?, NULL, ?, ?, ?, ?, ?)`,
    ).run(randomUUID(), contentHash, source, author, sessionKey, Date.now());
  } catch {
    /* ignore */
  }

  const directivePolicy = analyzeDirectivePolicy(content);
  const shouldDelegate = shouldExecuteDirectiveDelegation(directivePolicy, true);
  const delegationOptions = {
    skipPlannedMeeting: skipPlannedMeeting,
    skipPlanSubtasks: skipPlannedMeeting,
    projectId,
    projectPath,
    projectContext,
  };

  if (shouldDelegate) {
    const planningLeader = findTeamLeader("planning");
    if (planningLeader) {
      const delay = 3000 + Math.random() * 2000;
      setTimeout(() => handleTaskDelegation(planningLeader, content, "", delegationOptions), delay);
    }
    const mentions = detectMentions(content);
    if (mentions.deptIds.length > 0 || mentions.agentIds.length > 0) {
      const mentionDelay = 5000 + Math.random() * 2000;
      setTimeout(() => {
        const processedDepts = new Set<string>(["planning"]);
        for (const deptId of mentions.deptIds) {
          if (processedDepts.has(deptId)) continue;
          processedDepts.add(deptId);
          const leader = findTeamLeader(deptId);
          if (leader) handleTaskDelegation(leader, content, "", delegationOptions);
        }
        for (const agentId of mentions.agentIds) {
          const mentioned = db.prepare("SELECT * FROM agents WHERE id = ?").get(agentId);
          if (mentioned?.department_id && !processedDepts.has(mentioned.department_id)) {
            processedDepts.add(mentioned.department_id);
            const leader = findTeamLeader(mentioned.department_id);
            if (leader) handleTaskDelegation(leader, content, "", delegationOptions);
          }
        }
      }, mentionDelay);
    }
  }

  const resultMessage = skipPlannedMeeting ? "업무지시 전달 완료 (회의 생략)" : "업무지시 전달 완료 (팀장 회의 진행)";
  return { status: 200, json: { ok: true, delivered: true, message: resultMessage } };
}

export function registerExternalInboxRoute(ctx: InboxCtx & { app: any }) {
  const { app, ...inboxCtx } = ctx;

  app.post("/api/inbox", async (req: any, res: any) => {
    if (!INBOX_SECRET) {
      return res.status(503).json({ error: "inbox_not_configured", message: "INBOX_WEBHOOK_SECRET is not set." });
    }
    const provided = String(req.headers["x-inbox-secret"] ?? "").trim();
    if (provided !== INBOX_SECRET) {
      return res.status(401).json({ error: "unauthorized" });
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const result = await processInboxPayload(inboxCtx, body);
    return res.status(result.status).json(result.json);
  });
}
