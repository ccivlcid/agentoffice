// @ts-nocheck
/**
 * Workflow Pack routes.
 * GET  /api/workflow-packs          — list packs with state
 * PUT  /api/workflow-packs/:key     — toggle enabled
 * POST /api/workflow-packs/:key/hydrate — seed pack departments/agents into DB
 */

import { randomUUID } from "node:crypto";
import { WORKFLOW_PACKS, getPackByKey } from "../../../workflow-packs/pack-definitions.ts";

export function registerOpsWorkflowPacks(ctx: { app: any; db: any; nowMs: () => number; broadcast: (event: string, data: any) => void }) {
  const { app, db, nowMs, broadcast } = ctx;

  app.get("/api/workflow-packs", (_req, res) => {
    const stateRows = db.prepare("SELECT * FROM workflow_pack_state").all() as any[];
    const stateMap = new Map(stateRows.map((r: any) => [r.pack_key, r]));

    const packs = WORKFLOW_PACKS.map((p) => {
      const state = stateMap.get(p.key);
      return {
        key: p.key,
        label: p.label,
        nameKo: p.nameKo,
        nameEn: p.nameEn,
        isolated: p.isolated,
        enabled: state ? Boolean(state.enabled) : true,
        hydrated: state ? Boolean(state.hydrated) : !p.isolated,
        deptCount: p.departments.length,
        agentCount: p.agents.length,
      };
    });
    res.json({ packs });
  });

  app.put("/api/workflow-packs/:key", (req, res) => {
    const key = String(req.params.key);
    const pack = getPackByKey(key);
    if (!pack) return res.status(404).json({ error: "pack_not_found" });

    const enabled = req.body?.enabled !== false ? 1 : 0;
    const now = nowMs();
    db.prepare(
      `INSERT INTO workflow_pack_state (pack_key, enabled, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(pack_key) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at`,
    ).run(key, enabled, now);

    res.json({ ok: true, key, enabled: Boolean(enabled) });
  });

  app.post("/api/workflow-packs/:key/hydrate", (req, res) => {
    const key = String(req.params.key);
    const pack = getPackByKey(key);
    if (!pack) return res.status(404).json({ error: "pack_not_found" });
    if (!pack.isolated) return res.json({ ok: true, message: "development pack uses DB-backed data, no hydration needed" });

    // Check if already hydrated
    const state = db.prepare("SELECT hydrated FROM workflow_pack_state WHERE pack_key = ?").get(key) as any;
    if (state?.hydrated) return res.json({ ok: true, message: "already hydrated" });

    const now = nowMs();

    // Seed departments
    for (const dept of pack.departments) {
      db.prepare(
        `INSERT OR IGNORE INTO departments (id, name, name_ko, icon, color, description, sort_order, pack_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(dept.id, dept.name, dept.name_ko, dept.icon, dept.color, dept.description, dept.sort_order, key);
    }

    // Seed agents
    for (const agent of pack.agents) {
      db.prepare(
        `INSERT OR IGNORE INTO agents (id, name, name_ko, department_id, role, cli_provider, avatar_emoji, personality, status, sprite_number, pack_key, stats_tasks_done, stats_xp, created_at)
         VALUES (?, ?, ?, ?, ?, 'claude', ?, ?, 'idle', ?, ?, 0, 0, ?)`,
      ).run(agent.id, agent.name, agent.name_ko, agent.department_id, agent.role, agent.avatar_emoji, agent.personality, agent.sprite_number, key, now);
    }

    // Mark hydrated
    db.prepare(
      `INSERT INTO workflow_pack_state (pack_key, enabled, hydrated, updated_at) VALUES (?, 1, 1, ?)
       ON CONFLICT(pack_key) DO UPDATE SET hydrated = 1, updated_at = excluded.updated_at`,
    ).run(key, now);

    broadcast("departments_changed", {});

    res.json({ ok: true, hydrated: true, departments: pack.departments.length, agents: pack.agents.length });
  });
}
