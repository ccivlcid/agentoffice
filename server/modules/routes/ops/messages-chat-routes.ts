// @ts-nocheck

import { registerDirectiveAndDeleteRoutes } from "./messages-directive-routes.ts";

export function registerMessageAndAnnouncementRoutes(ctx: {
  app: any;
  db: any;
  broadcast: (event: string, data: any) => void;
  firstQueryValue: (val: any) => string | undefined;
  normalizeTextField: (val: any) => string | null;
  resolveLang: (text: string) => string;
  resolveMessageIdempotencyKey: (req: any, body: any, prefix: string) => string;
  insertMessageWithIdempotency: (opts: any) => Promise<{ message: any; created: boolean }>;
  recordMessageIngressAuditOr503: (res: any, opts: any) => boolean;
  recordAcceptedIngressAuditOrRollback: (res: any, opts: any, msgId: string) => Promise<boolean>;
  IdempotencyConflictError: any;
  StorageBusyError: any;
  scheduleAgentReply: (agentId: string, content: string, messageType: string, opts: any) => void;
  handleReportRequest: (agentId: string, content: string) => boolean;
  detectMentions: (content: string) => { deptIds: string[]; agentIds: string[] };
  handleMentionDelegation: (agent: any, deptId: string, content: string, lang: string) => void;
  handleTaskDelegation: (agent: any, content: string, ctx: string, opts?: any) => void;
  findTeamLeader: (deptId: string) => any;
  scheduleAnnouncementReplies: (content: string) => void;
  scheduleTeamLeaderReplies: (content: string) => void;
}) {
  const {
    app, db, broadcast, firstQueryValue, normalizeTextField, resolveLang,
    resolveMessageIdempotencyKey, insertMessageWithIdempotency,
    recordMessageIngressAuditOr503, recordAcceptedIngressAuditOrRollback,
    IdempotencyConflictError, StorageBusyError,
    scheduleAgentReply, handleReportRequest, detectMentions,
    handleMentionDelegation, handleTaskDelegation, findTeamLeader,
    scheduleAnnouncementReplies, scheduleTeamLeaderReplies,
  } = ctx;

  type AgentRow = any;
  type StoredMessage = any;
  type SQLInputValue = any;

  app.get("/api/messages", (req, res) => {
    const receiverType = firstQueryValue(req.query.receiver_type);
    const receiverId = firstQueryValue(req.query.receiver_id);
    const limitRaw = firstQueryValue(req.query.limit);
    const limit = Math.min(Math.max(Number(limitRaw) || 50, 1), 500);
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (receiverType && receiverId) {
      conditions.push(
        "((receiver_type = ? AND receiver_id = ?) OR (sender_type = 'agent' AND sender_id = ?) OR receiver_type = 'all')"
      );
      params.push(receiverType, receiverId, receiverId);
    } else if (receiverType) {
      conditions.push("receiver_type = ?");
      params.push(receiverType);
    } else if (receiverId) {
      conditions.push("(receiver_id = ? OR receiver_type = 'all')");
      params.push(receiverId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit);
    const messages = db.prepare(`
      SELECT m.*, a.name AS sender_name, a.avatar_emoji AS sender_avatar
      FROM messages m
      LEFT JOIN agents a ON m.sender_type = 'agent' AND m.sender_id = a.id
      ${where}
      ORDER BY m.created_at DESC
      LIMIT ?
    `).all(...(params as SQLInputValue[]));
    res.json({ messages: messages.reverse() });
  });

  app.post("/api/messages", async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const idempotencyKey = resolveMessageIdempotencyKey(req, body, "api.messages");
    const content = body.content;
    if (!content || typeof content !== "string") {
      if (!recordMessageIngressAuditOr503(res, { endpoint: "/api/messages", req, body, idempotencyKey, outcome: "validation_error", statusCode: 400, detail: "content_required" })) return;
      return res.status(400).json({ error: "content_required" });
    }

    const senderType = typeof body.sender_type === "string" ? body.sender_type : "ceo";
    const senderId = typeof body.sender_id === "string" ? body.sender_id : null;
    const receiverType = typeof body.receiver_type === "string" ? body.receiver_type : "all";
    const receiverId = typeof body.receiver_id === "string" ? body.receiver_id : null;
    const messageType = typeof body.message_type === "string" ? body.message_type : "chat";
    const taskId = typeof body.task_id === "string" ? body.task_id : null;
    const projectId = normalizeTextField(body.project_id);
    const projectPath = normalizeTextField(body.project_path);
    const projectContext = normalizeTextField(body.project_context);

    let storedMessage: StoredMessage;
    let created: boolean;
    try {
      ({ message: storedMessage, created } = await insertMessageWithIdempotency({
        senderType, senderId, receiverType, receiverId, content, messageType, taskId, idempotencyKey,
      }));
    } catch (err) {
      if (err instanceof IdempotencyConflictError) {
        if (!recordMessageIngressAuditOr503(res, { endpoint: "/api/messages", req, body, idempotencyKey, outcome: "idempotency_conflict", statusCode: 409, detail: "payload_mismatch" })) return;
        return res.status(409).json({ error: "idempotency_conflict", idempotency_key: err.key });
      }
      if (err instanceof StorageBusyError) {
        if (!recordMessageIngressAuditOr503(res, { endpoint: "/api/messages", req, body, idempotencyKey, outcome: "storage_busy", statusCode: 503, detail: `operation=${err.operation}, attempts=${err.attempts}` })) return;
        return res.status(503).json({ error: "storage_busy", retryable: true, operation: err.operation });
      }
      throw err;
    }

    const msg = { ...storedMessage };
    if (!created) {
      if (!recordMessageIngressAuditOr503(res, { endpoint: "/api/messages", req, body, idempotencyKey, outcome: "duplicate", statusCode: 200, messageId: msg.id, detail: "idempotent_replay" })) return;
      return res.json({ ok: true, message: msg, duplicate: true });
    }
    if (!(await recordAcceptedIngressAuditOrRollback(res, { endpoint: "/api/messages", req, body, idempotencyKey, outcome: "accepted", statusCode: 200, detail: "created" }, msg.id))) return;
    broadcast("new_message", msg);

    if (senderType === "ceo" && receiverType === "agent" && receiverId) {
      if (messageType === "report") {
        const handled = handleReportRequest(receiverId, content);
        if (!handled) scheduleAgentReply(receiverId, content, messageType, { projectId, projectPath, projectContext });
        return res.json({ ok: true, message: msg });
      }
      scheduleAgentReply(receiverId, content, messageType, { projectId, projectPath, projectContext });
      const mentions = detectMentions(content);
      if (mentions.deptIds.length > 0 || mentions.agentIds.length > 0) {
        const senderAgent = db.prepare("SELECT * FROM agents WHERE id = ?").get(receiverId) as AgentRow | undefined;
        if (senderAgent) {
          const lang = resolveLang(content);
          const mentionDelay = 4000 + Math.random() * 2000;
          setTimeout(() => {
            for (const deptId of mentions.deptIds) {
              if (deptId === senderAgent.department_id) continue;
              handleMentionDelegation(senderAgent, deptId, content, lang);
            }
            for (const agentId of mentions.agentIds) {
              const mentioned = db.prepare("SELECT * FROM agents WHERE id = ?").get(agentId) as AgentRow | undefined;
              if (mentioned && mentioned.department_id && mentioned.department_id !== senderAgent.department_id) {
                if (!mentions.deptIds.includes(mentioned.department_id)) {
                  handleMentionDelegation(senderAgent, mentioned.department_id, content, lang);
                }
              }
            }
          }, mentionDelay);
        }
      }
    }
    res.json({ ok: true, message: msg });
  });

  app.post("/api/announcements", async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const idempotencyKey = resolveMessageIdempotencyKey(req, body, "api.announcements");
    const content = body.content;
    if (!content || typeof content !== "string") {
      if (!recordMessageIngressAuditOr503(res, { endpoint: "/api/announcements", req, body, idempotencyKey, outcome: "validation_error", statusCode: 400, detail: "content_required" })) return;
      return res.status(400).json({ error: "content_required" });
    }

    let storedMessage: StoredMessage;
    let created: boolean;
    try {
      ({ message: storedMessage, created } = await insertMessageWithIdempotency({
        senderType: "ceo", senderId: null, receiverType: "all", receiverId: null,
        content, messageType: "announcement", idempotencyKey,
      }));
    } catch (err) {
      if (err instanceof IdempotencyConflictError) {
        if (!recordMessageIngressAuditOr503(res, { endpoint: "/api/announcements", req, body, idempotencyKey, outcome: "idempotency_conflict", statusCode: 409, detail: "payload_mismatch" })) return;
        return res.status(409).json({ error: "idempotency_conflict", idempotency_key: err.key });
      }
      if (err instanceof StorageBusyError) {
        if (!recordMessageIngressAuditOr503(res, { endpoint: "/api/announcements", req, body, idempotencyKey, outcome: "storage_busy", statusCode: 503, detail: `operation=${err.operation}, attempts=${err.attempts}` })) return;
        return res.status(503).json({ error: "storage_busy", retryable: true, operation: err.operation });
      }
      throw err;
    }
    const msg = { ...storedMessage };
    if (!created) {
      if (!recordMessageIngressAuditOr503(res, { endpoint: "/api/announcements", req, body, idempotencyKey, outcome: "duplicate", statusCode: 200, messageId: msg.id, detail: "idempotent_replay" })) return;
      return res.json({ ok: true, message: msg, duplicate: true });
    }
    if (!(await recordAcceptedIngressAuditOrRollback(res, { endpoint: "/api/announcements", req, body, idempotencyKey, outcome: "accepted", statusCode: 200, detail: "created" }, msg.id))) return;
    broadcast("announcement", msg);
    scheduleAnnouncementReplies(content);

    const mentions = detectMentions(content);
    if (mentions.deptIds.length > 0 || mentions.agentIds.length > 0) {
      const mentionDelay = 5000 + Math.random() * 2000;
      setTimeout(() => {
        const processedDepts = new Set<string>();
        for (const deptId of mentions.deptIds) {
          if (processedDepts.has(deptId)) continue;
          processedDepts.add(deptId);
          const leader = findTeamLeader(deptId);
          if (leader) handleTaskDelegation(leader, content, "");
        }
        for (const agentId of mentions.agentIds) {
          const mentioned = db.prepare("SELECT * FROM agents WHERE id = ?").get(agentId) as AgentRow | undefined;
          if (mentioned?.department_id && !processedDepts.has(mentioned.department_id)) {
            processedDepts.add(mentioned.department_id);
            const leader = findTeamLeader(mentioned.department_id);
            if (leader) handleTaskDelegation(leader, content, "");
          }
        }
      }, mentionDelay);
    }
    res.json({ ok: true, message: msg });
  });

  // 팀장 회의 전용: 팀장만 수신·답변, 채널은 receiver_type=team_leaders
  app.post("/api/announcements/team-leaders", async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const idempotencyKey = resolveMessageIdempotencyKey(req, body, "api.announcements.team-leaders");
    const content = body.content;
    if (!content || typeof content !== "string") {
      if (!recordMessageIngressAuditOr503(res, { endpoint: "/api/announcements/team-leaders", req, body, idempotencyKey, outcome: "validation_error", statusCode: 400, detail: "content_required" })) return;
      return res.status(400).json({ error: "content_required" });
    }

    let storedMessage: StoredMessage;
    let created: boolean;
    try {
      ({ message: storedMessage, created } = await insertMessageWithIdempotency({
        senderType: "ceo", senderId: null, receiverType: "team_leaders", receiverId: null,
        content, messageType: "announcement", idempotencyKey,
      }));
    } catch (err) {
      if (err instanceof IdempotencyConflictError) {
        if (!recordMessageIngressAuditOr503(res, { endpoint: "/api/announcements/team-leaders", req, body, idempotencyKey, outcome: "idempotency_conflict", statusCode: 409, detail: "payload_mismatch" })) return;
        return res.status(409).json({ error: "idempotency_conflict", idempotency_key: err.key });
      }
      if (err instanceof StorageBusyError) {
        if (!recordMessageIngressAuditOr503(res, { endpoint: "/api/announcements/team-leaders", req, body, idempotencyKey, outcome: "storage_busy", statusCode: 503, detail: `operation=${err.operation}, attempts=${err.attempts}` })) return;
        return res.status(503).json({ error: "storage_busy", retryable: true, operation: err.operation });
      }
      throw err;
    }
    const msg = { ...storedMessage };
    if (!created) {
      if (!recordMessageIngressAuditOr503(res, { endpoint: "/api/announcements/team-leaders", req, body, idempotencyKey, outcome: "duplicate", statusCode: 200, messageId: msg.id, detail: "idempotent_replay" })) return;
      return res.json({ ok: true, message: msg, duplicate: true });
    }
    if (!(await recordAcceptedIngressAuditOrRollback(res, { endpoint: "/api/announcements/team-leaders", req, body, idempotencyKey, outcome: "accepted", statusCode: 200, detail: "created" }, msg.id))) return;
    broadcast("announcement", msg);
    scheduleTeamLeaderReplies(content);
    // 팀장 회의 채팅에 입력된 프롬프트를 부서별로 실제 AI가 실행하도록 위임(태스크 생성 후 CLI 에이전트 실행)
    const teamLeaders = db.prepare(
      "SELECT * FROM agents WHERE role = 'team_leader' AND status != 'offline'"
    ).all() as AgentRow[];
    const prompt = content.trim() || "";
    if (prompt.length > 0) {
      let delayMs = 5000;
      for (const leader of teamLeaders) {
        const d = delayMs + Math.random() * 2000;
        setTimeout(() => {
          handleTaskDelegation(leader, prompt, "team_leaders_meeting", { skipPlannedMeeting: true });
        }, d);
        delayMs += 3000 + Math.random() * 2000;
      }
    }
    res.json({ ok: true, message: msg });
  });
}

// Backwards-compatible combined registration function
export { registerDirectiveAndDeleteRoutes } from "./messages-directive-routes.ts";

export function registerChatRoutes(ctx: Parameters<typeof registerMessageAndAnnouncementRoutes>[0] & Parameters<typeof registerDirectiveAndDeleteRoutes>[0]) {
  registerMessageAndAnnouncementRoutes(ctx);
  registerDirectiveAndDeleteRoutes(ctx);
}
