/**
 * Interrupt-inject utilities: sanitize, hash, queue, and consume injection prompts.
 */
import { randomUUID, createHash, randomBytes } from "node:crypto";

const MAX_INJECT_PROMPT_LENGTH = 2000;

export function sanitizeInjectPrompt(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim()
    .slice(0, MAX_INJECT_PROMPT_LENGTH);
}

export function hashInjectPrompt(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

export function generateInterruptToken(): string {
  return randomBytes(24).toString("base64url");
}

export function queueInjection(
  db: any,
  taskId: string,
  prompt: string,
): { id: string; prompt_hash: string } {
  const id = randomUUID();
  const promptHash = hashInjectPrompt(prompt);
  db.prepare(
    `INSERT INTO task_interrupt_injections (id, task_id, prompt, prompt_hash, status, created_at)
     VALUES (?, ?, ?, ?, 'queued', ?)`,
  ).run(id, taskId, prompt, promptHash, Date.now());
  return { id, prompt_hash: promptHash };
}

export function consumePendingInjection(
  db: any,
  taskId: string,
): { id: string; prompt: string } | null {
  const row = db.prepare(
    `SELECT id, prompt FROM task_interrupt_injections
     WHERE task_id = ? AND status = 'queued'
     ORDER BY created_at ASC LIMIT 1`,
  ).get(taskId) as { id: string; prompt: string } | undefined;
  if (!row) return null;
  db.prepare(
    `UPDATE task_interrupt_injections SET status = 'consumed', consumed_at = ? WHERE id = ?`,
  ).run(Date.now(), row.id);
  return row;
}
