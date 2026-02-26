// @ts-nocheck
import type { RuntimeContext } from "../../types/runtime-context.ts";

export function rotateBreaks(ctx: RuntimeContext): void {
  const { db, broadcast, isAgentInMeeting } = ctx as any;

  const allAgents = db.prepare(
    "SELECT id, department_id, status FROM agents WHERE status IN ('idle','break')"
  ).all() as { id: string; department_id: string; status: string }[];

  if (allAgents.length === 0) return;

  for (const a of allAgents) {
    if (a.status === "break" && isAgentInMeeting(a.id)) {
      db.prepare("UPDATE agents SET status = 'idle' WHERE id = ?").run(a.id);
      broadcast("agent_status", db.prepare("SELECT * FROM agents WHERE id = ?").get(a.id));
    }
  }

  const candidates = allAgents.filter((a) => !isAgentInMeeting(a.id));
  if (candidates.length === 0) return;

  const byDept = new Map<string, typeof candidates>();
  for (const a of candidates) {
    const list = byDept.get(a.department_id) || [];
    list.push(a);
    byDept.set(a.department_id, list);
  }

  for (const [, members] of byDept) {
    const onBreak = members.filter((a) => a.status === "break");
    const idle = members.filter((a) => a.status === "idle");

    if (onBreak.length > 1) {
      const extras = onBreak.slice(1);
      for (const a of extras) {
        db.prepare("UPDATE agents SET status = 'idle' WHERE id = ?").run(a.id);
        broadcast("agent_status", db.prepare("SELECT * FROM agents WHERE id = ?").get(a.id));
      }
    } else if (onBreak.length === 1) {
      if (Math.random() < 0.4) {
        db.prepare("UPDATE agents SET status = 'idle' WHERE id = ?").run(onBreak[0].id);
        broadcast("agent_status", db.prepare("SELECT * FROM agents WHERE id = ?").get(onBreak[0].id));
      }
    } else if (onBreak.length === 0 && idle.length > 0) {
      if (Math.random() < 0.5) {
        const pick = idle[Math.floor(Math.random() * idle.length)];
        db.prepare("UPDATE agents SET status = 'break' WHERE id = ?").run(pick.id);
        broadcast("agent_status", db.prepare("SELECT * FROM agents WHERE id = ?").get(pick.id));
      }
    }
  }
}

export function pruneDuplicateReviewMeetings(ctx: RuntimeContext): void {
  const { db, runInTransaction } = ctx as any;

  const rows = db.prepare(`
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY task_id, round, status
          ORDER BY started_at DESC, created_at DESC, id DESC
        ) AS rn
      FROM meeting_minutes
      WHERE meeting_type = 'review'
        AND status IN ('in_progress', 'failed')
    )
    SELECT id
    FROM ranked
    WHERE rn > 1
  `).all() as Array<{ id: string }>;
  if (rows.length === 0) return;

  const delEntries = db.prepare("DELETE FROM meeting_minute_entries WHERE meeting_id = ?");
  const delMeetings = db.prepare("DELETE FROM meeting_minutes WHERE id = ?");
  runInTransaction(() => {
    for (const id of rows.map((r) => r.id)) {
      delEntries.run(id);
      delMeetings.run(id);
    }
  });
}
