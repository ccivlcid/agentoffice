// @ts-nocheck

export function registerDirectiveAndDeleteRoutes(ctx: {
  app: any;
  db: any;
  broadcast: (event: string, data: any) => void;
  firstQueryValue: (val: any) => string | undefined;
  normalizeTextField: (val: any) => string | null;
  resolveMessageIdempotencyKey: (req: any, body: any, prefix: string) => string;
  insertMessageWithIdempotency: (opts: any) => Promise<{ message: any; created: boolean }>;
  recordMessageIngressAuditOr503: (res: any, opts: any) => boolean;
  recordAcceptedIngressAuditOrRollback: (res: any, opts: any, msgId: string) => Promise<boolean>;
  IdempotencyConflictError: any;
  StorageBusyError: any;
  detectMentions: (content: string) => { deptIds: string[]; agentIds: string[] };
  handleTaskDelegation: (agent: any, content: string, ctx: string, opts?: any) => void;
  findTeamLeader: (deptId: string) => any;
  scheduleAnnouncementReplies: (content: string) => void;
  analyzeDirectivePolicy: (content: string) => any;
  shouldExecuteDirectiveDelegation: (policy: any, skip: boolean) => boolean;
  buildAgentUpgradeRequiredPayload: () => any;
  ENFORCE_DIRECTIVE_PROJECT_BINDING: boolean;
}) {
  const {
    app, db, broadcast, firstQueryValue, normalizeTextField,
    resolveMessageIdempotencyKey, insertMessageWithIdempotency,
    recordMessageIngressAuditOr503, recordAcceptedIngressAuditOrRollback,
    IdempotencyConflictError, StorageBusyError,
    detectMentions, handleTaskDelegation, findTeamLeader,
    scheduleAnnouncementReplies, analyzeDirectivePolicy,
    shouldExecuteDirectiveDelegation, buildAgentUpgradeRequiredPayload,
    ENFORCE_DIRECTIVE_PROJECT_BINDING,
  } = ctx;

  type AgentRow = any;
  type StoredMessage = any;
  type DelegationOptions = any;

  app.post("/api/directives", async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const idempotencyKey = resolveMessageIdempotencyKey(req, body, "api.directives");
    const content = body.content;
    let explicitProjectId = normalizeTextField(body.project_id);
    let explicitProjectPath = normalizeTextField(body.project_path);
    let explicitProjectContext = normalizeTextField(body.project_context);
    if (!content || typeof content !== "string") {
      if (!recordMessageIngressAuditOr503(res, { endpoint: "/api/directives", req, body, idempotencyKey, outcome: "validation_error", statusCode: 400, detail: "content_required" })) return;
      return res.status(400).json({ error: "content_required" });
    }
    if (ENFORCE_DIRECTIVE_PROJECT_BINDING && !explicitProjectId) {
      if (!recordMessageIngressAuditOr503(res, { endpoint: "/api/directives", req, body, idempotencyKey, outcome: "validation_error", statusCode: 428, detail: "agent_upgrade_required:install_first" })) return;
      return res.status(428).json(buildAgentUpgradeRequiredPayload());
    }

    let storedMessage: StoredMessage;
    let created: boolean;
    try {
      ({ message: storedMessage, created } = await insertMessageWithIdempotency({
        senderType: "ceo", senderId: null, receiverType: "all", receiverId: null,
        content, messageType: "directive", idempotencyKey,
      }));
    } catch (err) {
      if (err instanceof IdempotencyConflictError) {
        if (!recordMessageIngressAuditOr503(res, { endpoint: "/api/directives", req, body, idempotencyKey, outcome: "idempotency_conflict", statusCode: 409, detail: "payload_mismatch" })) return;
        return res.status(409).json({ error: "idempotency_conflict", idempotency_key: err.key });
      }
      if (err instanceof StorageBusyError) {
        if (!recordMessageIngressAuditOr503(res, { endpoint: "/api/directives", req, body, idempotencyKey, outcome: "storage_busy", statusCode: 503, detail: `operation=${err.operation}, attempts=${err.attempts}` })) return;
        return res.status(503).json({ error: "storage_busy", retryable: true, operation: err.operation });
      }
      throw err;
    }
    const msg = { ...storedMessage };
    if (!created) {
      if (!recordMessageIngressAuditOr503(res, { endpoint: "/api/directives", req, body, idempotencyKey, outcome: "duplicate", statusCode: 200, messageId: msg.id, detail: "idempotent_replay" })) return;
      return res.json({ ok: true, message: msg, duplicate: true });
    }
    if (!(await recordAcceptedIngressAuditOrRollback(res, { endpoint: "/api/directives", req, body, idempotencyKey, outcome: "accepted", statusCode: 200, detail: "created" }, msg.id))) return;
    broadcast("announcement", msg);
    scheduleAnnouncementReplies(content);

    const directivePolicy = analyzeDirectivePolicy(content);
    const explicitSkip = body.skipPlannedMeeting === true;
    const shouldDelegate = shouldExecuteDirectiveDelegation(directivePolicy, explicitSkip);
    const delegationOptions: DelegationOptions = {
      skipPlannedMeeting: explicitSkip || directivePolicy.skipPlannedMeeting,
      skipPlanSubtasks: explicitSkip || directivePolicy.skipPlanSubtasks,
      projectId: explicitProjectId, projectPath: explicitProjectPath, projectContext: explicitProjectContext,
    };

    if (shouldDelegate) {
      const planningLeader = findTeamLeader("planning");
      if (planningLeader) {
        const delegationDelay = 3000 + Math.random() * 2000;
        setTimeout(() => { handleTaskDelegation(planningLeader, content, "", delegationOptions); }, delegationDelay);
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
            const mentioned = db.prepare("SELECT * FROM agents WHERE id = ?").get(agentId) as AgentRow | undefined;
            if (mentioned?.department_id && !processedDepts.has(mentioned.department_id)) {
              processedDepts.add(mentioned.department_id);
              const leader = findTeamLeader(mentioned.department_id);
              if (leader) handleTaskDelegation(leader, content, "", delegationOptions);
            }
          }
        }, mentionDelay);
      }
    }
    res.json({ ok: true, message: msg });
  });

  app.post("/api/inbox", (_req, res) => {
    res.status(410).json({
      error: "gone",
      message: "Inbox webhook was removed. Implement your own webhook endpoint for directives.",
    });
  });

  app.delete("/api/messages", (req, res) => {
    const agentId = firstQueryValue(req.query.agent_id);
    const scope = firstQueryValue(req.query.scope) || "conversation";
    if (scope === "all") {
      const result = db.prepare("DELETE FROM messages").run();
      broadcast("messages_cleared", { scope: "all" });
      return res.json({ ok: true, deleted: result.changes });
    }
    if (agentId) {
      const result = db.prepare(
        `DELETE FROM messages WHERE
          (sender_type = 'ceo' AND receiver_type = 'agent' AND receiver_id = ?)
          OR (sender_type = 'agent' AND sender_id = ?)
          OR receiver_type = 'all'
          OR message_type = 'announcement'`
      ).run(agentId, agentId);
      broadcast("messages_cleared", { scope: "agent", agent_id: agentId });
      return res.json({ ok: true, deleted: result.changes });
    }
    const result = db.prepare(
      "DELETE FROM messages WHERE receiver_type = 'all' OR message_type = 'announcement'"
    ).run();
    broadcast("messages_cleared", { scope: "announcements" });
    res.json({ ok: true, deleted: result.changes });
  });
}
