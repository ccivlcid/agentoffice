// @ts-nocheck

/**
 * Gateway routes — messenger session management and message sending.
 * GET  /api/gateway/targets   — list active messenger sessions
 * POST /api/gateway/send      — send a message to a messenger session
 * POST /api/gateway/sessions  — create / update a messenger session
 * DELETE /api/gateway/sessions/:id — delete a session
 */

import { randomUUID } from "node:crypto";
import { encryptSecret, decryptSecret } from "../../../oauth/helpers.ts";
import { sendToChannel } from "../../../gateway/send.ts";

export function registerOpsGatewayRoutes(ctx: { app: any; db: any; nowMs: () => number }) {
  const { app, db, nowMs } = ctx;

  // --- List all sessions for settings UI (id, channel, target, display_name, agent_id, agent name/emoji, active) ---
  app.get("/api/gateway/sessions", (_req, res) => {
    const rows = db
      .prepare(
        `SELECT s.id, s.channel, s.target, s.display_name, s.agent_id, s.session_key, s.active, s.created_at, s.updated_at,
                a.name AS agent_name, a.name_ko AS agent_name_ko, a.avatar_emoji AS agent_avatar_emoji, a.sprite_number AS agent_sprite_number
         FROM messenger_sessions s
         LEFT JOIN agents a ON s.agent_id = a.id
         ORDER BY s.updated_at DESC`,
      )
      .all();
    res.json({ sessions: rows });
  });

  // --- List active targets (for frontend GatewayTarget type) ---
  app.get("/api/gateway/targets", (_req, res) => {
    const rows = db
      .prepare(
        "SELECT session_key, display_name, channel, target FROM messenger_sessions WHERE active = 1 ORDER BY updated_at DESC",
      )
      .all();
    const targets = (rows as any[]).map((r) => ({
      sessionKey: r.session_key,
      displayName: r.display_name,
      channel: r.channel,
      to: r.target,
    }));
    res.json({ targets });
  });

  // --- Send message to a session ---
  app.post("/api/gateway/send", async (req, res) => {
    const { sessionKey, text } = (req.body ?? {}) as Record<string, unknown>;
    if (!sessionKey || typeof sessionKey !== "string" || !text || typeof text !== "string") {
      return res.status(400).json({ ok: false, error: "sessionKey and text are required" });
    }

    const session = db
      .prepare("SELECT * FROM messenger_sessions WHERE session_key = ? AND active = 1")
      .get(sessionKey) as any;
    if (!session) {
      return res.status(404).json({ ok: false, error: "session_not_found" });
    }

    let token: string | null = null;
    if (session.token_enc) {
      try {
        token = decryptSecret(session.token_enc);
      } catch {
        return res.status(500).json({ ok: false, error: "token_decrypt_failed" });
      }
    }

    try {
      await sendToChannel(session.channel, session.target, String(text), token);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(502).json({ ok: false, error: err.message || "send_failed" });
    }
  });

  // --- Create / update messenger session ---
  app.post("/api/gateway/sessions", async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : null;
    const channel = String(body.channel ?? "").trim();
    const target = String(body.target ?? "").trim();
    const displayName = String(body.display_name ?? body.displayName ?? "").trim();
    const rawToken = typeof body.token === "string" ? body.token.trim() : null;
    const agentId = typeof body.agent_id === "string" ? body.agent_id : null;
    const active = body.active !== false ? 1 : 0;

    if (!channel || !target || !displayName) {
      return res.status(400).json({ error: "channel, target, and display_name are required" });
    }

    // Verify Telegram token before saving
    if (channel === "telegram" && rawToken) {
      try {
        const verifyResp = await fetch(`https://api.telegram.org/bot${rawToken}/getMe`);
        const verifyJson = (await verifyResp.json()) as { ok: boolean; result?: { username?: string } };
        if (!verifyJson.ok) {
          return res.status(400).json({
            error: "invalid_telegram_token",
            message: "Bot token rejected by Telegram. Check with @BotFather.",
          });
        }
        console.log(`[gateway] Telegram token verified: @${verifyJson.result?.username}`);
      } catch (err: any) {
        return res.status(400).json({ error: "telegram_verify_failed", message: err.message });
      }
    }

    const tokenEnc = rawToken ? encryptSecret(rawToken) : null;
    const now = nowMs();

    if (id) {
      // Update existing
      const existing = db.prepare("SELECT * FROM messenger_sessions WHERE id = ?").get(id);
      if (!existing) return res.status(404).json({ error: "session_not_found" });

      const setToken = tokenEnc !== null ? ", token_enc = ?" : "";
      const params: any[] = [channel, target, displayName, agentId, active, now];
      if (tokenEnc !== null) params.push(tokenEnc);
      params.push(id);

      db.prepare(
        `UPDATE messenger_sessions SET channel = ?, target = ?, display_name = ?, agent_id = ?, active = ?, updated_at = ?${setToken} WHERE id = ?`,
      ).run(...params);

      const updated = db
        .prepare(
          "SELECT id, channel, target, display_name, session_key, agent_id, active, created_at, updated_at FROM messenger_sessions WHERE id = ?",
        )
        .get(id);
      return res.json({ ok: true, session: updated });
    }

    // Create new
    const newId = randomUUID();
    const sessionKey = randomUUID();
    db.prepare(
      `INSERT INTO messenger_sessions (id, channel, token_enc, target, display_name, agent_id, session_key, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(newId, channel, tokenEnc, target, displayName, agentId, sessionKey, active, now, now);

    const created = db
      .prepare(
        "SELECT id, channel, target, display_name, session_key, agent_id, active, created_at, updated_at FROM messenger_sessions WHERE id = ?",
      )
      .get(newId);
    res.status(201).json({ ok: true, session: created });
  });

  // --- Delete session ---
  app.delete("/api/gateway/sessions/:id", (req, res) => {
    const id = String(req.params.id);
    const existing = db.prepare("SELECT id FROM messenger_sessions WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "session_not_found" });
    db.prepare("DELETE FROM messenger_sessions WHERE id = ?").run(id);
    res.json({ ok: true });
  });
}
