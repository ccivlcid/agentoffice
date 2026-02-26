// @ts-nocheck
import { createHash } from "node:crypto";

export type MessageIngressAuditOutcome =
  | "accepted"
  | "duplicate"
  | "idempotency_conflict"
  | "storage_busy"
  | "validation_error";

export type AuditRequestLike = {
  get(name: string): string | undefined;
  ip?: string;
  socket?: { remoteAddress?: string };
};

export type MessageIngressAuditInput = {
  endpoint: "/api/messages" | "/api/announcements" | "/api/directives";
  req: AuditRequestLike;
  body: Record<string, unknown>;
  idempotencyKey: string | null;
  outcome: MessageIngressAuditOutcome;
  statusCode: number;
  messageId?: string | null;
  detail?: string | null;
};

export type TaskCreationAuditInput = {
  taskId: string;
  taskTitle: string;
  taskStatus?: string | null;
  departmentId?: string | null;
  assignedAgentId?: string | null;
  sourceTaskId?: string | null;
  taskType?: string | null;
  projectPath?: string | null;
  trigger: string;
  triggerDetail?: string | null;
  actorType?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  req?: AuditRequestLike | null;
  body?: Record<string, unknown> | null;
};

export type MessageIngressAuditEntry = {
  id: string;
  created_at: number;
  endpoint: string;
  method: "POST";
  status_code: number;
  outcome: MessageIngressAuditOutcome;
  idempotency_key: string | null;
  request_id: string | null;
  message_id: string | null;
  payload_hash: string;
  request_ip: string | null;
  user_agent: string | null;
  detail: string | null;
  prev_hash: string;
  chain_hash: string;
};

export class SecurityAuditLogWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecurityAuditLogWriteError";
  }
}

function canonicalizeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeAuditValue(item));
  }
  if (value && typeof value === "object") {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src).sort()) {
      out[key] = canonicalizeAuditValue(src[key]);
    }
    return out;
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string" && value.length > 8_000) {
    return `${value.slice(0, 8_000)}...[truncated:${value.length}]`;
  }
  return value;
}

export function stableAuditJson(value: unknown): string {
  try {
    return JSON.stringify(canonicalizeAuditValue(value));
  } catch {
    return JSON.stringify(String(value));
  }
}

export function normalizeAuditText(value: unknown, maxLength = 500): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}...[truncated:${trimmed.length}]`;
}

export function resolveAuditRequestId(
  req: { get(name: string): string | undefined },
  body: Record<string, unknown>,
): string | null {
  const candidates: unknown[] = [
    body.request_id,
    body.requestId,
    req.get("x-request-id"),
    req.get("x-correlation-id"),
    req.get("traceparent"),
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (trimmed) return trimmed.length <= 200 ? trimmed : trimmed.slice(0, 200);
  }
  return null;
}

export function resolveAuditRequestIp(req: AuditRequestLike): string | null {
  const forwarded = req.get("x-forwarded-for");
  if (typeof forwarded === "string" && forwarded.trim()) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  if (typeof req.ip === "string" && req.ip.trim()) {
    return req.ip.trim().slice(0, 128);
  }
  if (typeof req.socket?.remoteAddress === "string" && req.socket.remoteAddress.trim()) {
    return req.socket.remoteAddress.trim().slice(0, 128);
  }
  return null;
}

export function computeAuditChainHash(
  prevHash: string,
  entry: Omit<MessageIngressAuditEntry, "prev_hash" | "chain_hash">,
  chainSeed: string,
  chainKey: string,
): string {
  const hasher = createHash("sha256");
  hasher.update(chainSeed, "utf8");
  hasher.update("|", "utf8");
  hasher.update(prevHash, "utf8");
  hasher.update("|", "utf8");
  if (chainKey) {
    hasher.update(chainKey, "utf8");
    hasher.update("|", "utf8");
  }
  hasher.update(stableAuditJson(entry), "utf8");
  return hasher.digest("hex");
}

export function loadSecurityAuditPrevHash(
  fs: typeof import("node:fs"),
  logPath: string,
): string {
  try {
    if (!fs.existsSync(logPath)) return "GENESIS";
    const raw = fs.readFileSync(logPath, "utf8").trim();
    if (!raw) return "GENESIS";
    const lines = raw.split(/\r?\n/);
    for (let idx = lines.length - 1; idx >= 0; idx -= 1) {
      const line = lines[idx]?.trim();
      if (!line) continue;
      const parsed = JSON.parse(line) as { chain_hash?: unknown };
      if (typeof parsed.chain_hash === "string" && parsed.chain_hash.trim()) {
        return parsed.chain_hash.trim();
      }
    }
  } catch (err) {
    console.warn(`[HyperClaw] security audit chain bootstrap failed: ${String(err)}`);
  }
  return "GENESIS";
}
