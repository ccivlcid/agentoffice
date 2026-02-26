// @ts-nocheck
import fs from "node:fs";
import path from "path";
import { randomUUID, createHash } from "node:crypto";
import type { Database } from "better-sqlite3";
import {
  SecurityAuditLogWriteError,
  stableAuditJson,
  normalizeAuditText,
  resolveAuditRequestId,
  resolveAuditRequestIp,
  computeAuditChainHash,
  loadSecurityAuditPrevHash,
} from "./audit-types.ts";
import type {
  MessageIngressAuditEntry,
  MessageIngressAuditInput,
  TaskCreationAuditInput,
  AuditRequestLike,
} from "./audit-types.ts";

export type { TaskCreationAuditInput, MessageIngressAuditInput, AuditRequestLike, MessageIngressAuditOutcome } from "./audit-types.ts";
export { SecurityAuditLogWriteError, stableAuditJson, normalizeAuditText, resolveAuditRequestId, resolveAuditRequestIp } from "./audit-types.ts";

export type SecurityAuditContext = {
  nowMs: () => number;
  db: Database;
};

export function createSecurityAuditLogger(logsDir: string, ctx: SecurityAuditContext) {
  const securityAuditLogPath = path.join(logsDir, "security-audit.ndjson");
  const securityAuditFallbackLogPath = path.join(logsDir, "security-audit-fallback.ndjson");
  const SECURITY_AUDIT_CHAIN_SEED =
    process.env.SECURITY_AUDIT_CHAIN_SEED?.trim() || "hyperclaw-security-audit-v1";
  const SECURITY_AUDIT_CHAIN_KEY = process.env.SECURITY_AUDIT_CHAIN_KEY ?? "";

  let securityAuditPrevHash = loadSecurityAuditPrevHash(fs, securityAuditLogPath);

  function appendSecurityAuditFallbackLog(payload: unknown): boolean {
    const line = `${stableAuditJson(payload)}\n`;
    try {
      fs.appendFileSync(securityAuditFallbackLogPath, line, { encoding: "utf8", mode: 0o600 });
      return true;
    } catch (fallbackErr) {
      try {
        process.stderr.write(`[HyperClaw] security audit fallback append failed: ${String(fallbackErr)}\n${line}`);
        return false;
      } catch {
        return false;
      }
    }
  }

  function appendSecurityAuditLog(entry: Omit<MessageIngressAuditEntry, "prev_hash" | "chain_hash">): void {
    const prevHash = securityAuditPrevHash;
    const chainHash = computeAuditChainHash(prevHash, entry, SECURITY_AUDIT_CHAIN_SEED, SECURITY_AUDIT_CHAIN_KEY);
    const line = JSON.stringify({ ...entry, prev_hash: prevHash, chain_hash: chainHash });
    try {
      fs.appendFileSync(securityAuditLogPath, `${line}\n`, { encoding: "utf8", mode: 0o600 });
      securityAuditPrevHash = chainHash;
    } catch (err) {
      const fallbackOk = appendSecurityAuditFallbackLog({
        ...entry,
        prev_hash: prevHash,
        chain_hash: chainHash,
        fallback_reason: String(err),
        fallback_created_at: ctx.nowMs(),
      });
      const fallbackStatus = fallbackOk ? "fallback_saved" : "fallback_failed";
      throw new SecurityAuditLogWriteError(
        `security audit append failed (${fallbackStatus}): ${String(err)}`,
      );
    }
  }

  function recordMessageIngressAudit(input: MessageIngressAuditInput): void {
    const payloadHash = createHash("sha256")
      .update(stableAuditJson(input.body), "utf8")
      .digest("hex");
    const entry: Omit<MessageIngressAuditEntry, "prev_hash" | "chain_hash"> = {
      id: randomUUID(),
      created_at: ctx.nowMs(),
      endpoint: input.endpoint,
      method: "POST",
      status_code: input.statusCode,
      outcome: input.outcome,
      idempotency_key: input.idempotencyKey,
      request_id: resolveAuditRequestId(input.req, input.body),
      message_id: input.messageId ?? null,
      payload_hash: payloadHash,
      request_ip: resolveAuditRequestIp(input.req),
      user_agent: normalizeAuditText(input.req.get("user-agent"), 200),
      detail: normalizeAuditText(input.detail),
    };
    appendSecurityAuditLog(entry);
  }

  function recordMessageIngressAuditOr503(
    res: { status(code: number): { json(payload: unknown): unknown } },
    input: MessageIngressAuditInput,
  ): boolean {
    try {
      recordMessageIngressAudit(input);
      return true;
    } catch (err) {
      console.error(`[HyperClaw] security audit unavailable: ${String(err)}`);
      res.status(503).json({ error: "audit_log_unavailable", retryable: true });
      return false;
    }
  }

  function recordTaskCreationAudit(input: TaskCreationAuditInput): void {
    try {
      const body = (input.body && typeof input.body === "object") ? input.body : null;
      const payloadForHash: Record<string, unknown> = {
        trigger: input.trigger,
        trigger_detail: input.triggerDetail ?? null,
        actor_type: input.actorType ?? null,
        actor_id: input.actorId ?? null,
        actor_name: input.actorName ?? null,
        body,
      };
      const payloadJson = stableAuditJson(payloadForHash);
      const payloadHash = createHash("sha256").update(payloadJson, "utf8").digest("hex");
      const requestId = input.req ? resolveAuditRequestId(input.req, body ?? {}) : null;
      const requestIp = input.req ? resolveAuditRequestIp(input.req) : null;
      const userAgent = input.req ? normalizeAuditText(input.req.get("user-agent"), 200) : null;

      ctx.db.prepare(`
        INSERT INTO task_creation_audits (
          id, task_id, task_title, task_status, department_id, assigned_agent_id, source_task_id,
          task_type, project_path, trigger, trigger_detail, actor_type, actor_id, actor_name,
          request_id, request_ip, user_agent, payload_hash, payload_preview, completed, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        input.taskId,
        normalizeAuditText(input.taskTitle, 500),
        normalizeAuditText(input.taskStatus ?? null, 64),
        normalizeAuditText(input.departmentId ?? null, 100),
        normalizeAuditText(input.assignedAgentId ?? null, 100),
        normalizeAuditText(input.sourceTaskId ?? null, 100),
        normalizeAuditText(input.taskType ?? null, 100),
        normalizeAuditText(input.projectPath ?? null, 500),
        normalizeAuditText(input.trigger, 120),
        normalizeAuditText(input.triggerDetail ?? null, 500),
        normalizeAuditText(input.actorType ?? null, 64),
        normalizeAuditText(input.actorId ?? null, 100),
        normalizeAuditText(input.actorName ?? null, 200),
        requestId,
        requestIp,
        userAgent,
        payloadHash,
        normalizeAuditText(payloadJson, 4000),
        0,
        ctx.nowMs(),
      );
    } catch (err) {
      console.warn(`[HyperClaw] task creation audit failed: ${String(err)}`);
    }
  }

  function setTaskCreationAuditCompletion(taskId: string, completed: boolean): void {
    try {
      ctx.db.prepare(
        "UPDATE task_creation_audits SET completed = ? WHERE task_id = ?"
      ).run(completed ? 1 : 0, taskId);
    } catch (err) {
      console.warn(`[HyperClaw] task creation audit completion update failed: ${String(err)}`);
    }
  }

  return {
    recordMessageIngressAuditOr503,
    recordTaskCreationAudit,
    setTaskCreationAuditCompletion,
  };
}
