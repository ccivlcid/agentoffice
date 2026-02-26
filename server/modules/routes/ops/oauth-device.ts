// @ts-nocheck
/**
 * OAuth device flow routes: device-start + device-poll for GitHub Copilot.
 * Extracted from oauth.ts to reduce single-file size.
 */

import { randomUUID } from "node:crypto";
import { BUILTIN_GITHUB_CLIENT_ID, OAUTH_STATE_TTL_MS, OAUTH_ENCRYPTION_SECRET, encryptSecret, decryptSecret } from "../../../oauth/helpers.ts";
import type { UpsertOAuthInput } from "./oauth-credentials.ts";

type DeviceCtx = {
  db: any;
  nowMs: () => number;
  upsertOAuthCredential: (input: UpsertOAuthInput) => string;
};

export function registerOAuthDevice(app: any, ctx: DeviceCtx): void {
  const { db, nowMs, upsertOAuthCredential } = ctx;

  app.post("/api/oauth/github-copilot/device-start", async (_req: any, res: any) => {
    if (!OAUTH_ENCRYPTION_SECRET) {
      return res.status(400).json({ error: "missing_OAUTH_ENCRYPTION_SECRET" });
    }
    const customClientId = (db.prepare("SELECT value FROM settings WHERE key = 'github_oauth_client_id'").get() as { value: string } | undefined)?.value?.replace(/^"|"$/g, "").trim();
    const clientId = customClientId || process.env.OAUTH_GITHUB_CLIENT_ID || BUILTIN_GITHUB_CLIENT_ID;
    try {
      const resp = await fetch("https://github.com/login/device/code", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: clientId, scope: "read:user user:email repo" }),
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) return res.status(502).json({ error: "github_device_code_failed", status: resp.status });
      const json = await resp.json() as { device_code: string; user_code: string; verification_uri: string; expires_in: number; interval: number };
      if (!json.device_code || !json.user_code) return res.status(502).json({ error: "github_device_code_invalid" });
      const stateId = randomUUID();
      db.prepare("INSERT INTO oauth_states (id, provider, created_at, verifier_enc, redirect_to) VALUES (?, ?, ?, ?, ?)")
        .run(stateId, "github", nowMs(), encryptSecret(json.device_code), null);
      res.json({ stateId, userCode: json.user_code, verificationUri: json.verification_uri, expiresIn: json.expires_in, interval: json.interval });
    } catch (err) {
      res.status(500).json({ error: "github_device_start_failed", message: String(err) });
    }
  });

  app.post("/api/oauth/github-copilot/device-poll", async (req: any, res: any) => {
    const stateId = (req.body as { stateId?: string })?.stateId;
    if (!stateId || typeof stateId !== "string") return res.status(400).json({ error: "stateId is required" });

    const row = db.prepare(
      "SELECT provider, verifier_enc, redirect_to, created_at FROM oauth_states WHERE id = ? AND provider = ?"
    ).get(stateId, "github") as { provider: string; verifier_enc: string; redirect_to: string | null; created_at: number } | undefined;
    if (!row) return res.status(400).json({ error: "invalid_state", status: "expired" });
    if (nowMs() - row.created_at > OAUTH_STATE_TTL_MS) {
      db.prepare("DELETE FROM oauth_states WHERE id = ?").run(stateId);
      return res.json({ status: "expired" });
    }

    let deviceCode: string;
    try {
      deviceCode = decryptSecret(row.verifier_enc);
    } catch {
      return res.status(500).json({ error: "decrypt_failed" });
    }

    const customClientId = (db.prepare("SELECT value FROM settings WHERE key = 'github_oauth_client_id'").get() as { value: string } | undefined)?.value?.replace(/^"|"$/g, "").trim();
    const clientId = customClientId || process.env.OAUTH_GITHUB_CLIENT_ID || BUILTIN_GITHUB_CLIENT_ID;
    try {
      const resp = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: clientId, device_code: deviceCode, grant_type: "urn:ietf:params:oauth:grant-type:device_code" }),
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) return res.status(502).json({ error: "github_poll_failed", status: "error" });
      const json = await resp.json() as Record<string, unknown>;

      if ("access_token" in json && typeof json.access_token === "string") {
        db.prepare("DELETE FROM oauth_states WHERE id = ?").run(stateId);
        const accessToken = json.access_token;
        let email: string | null = null;
        try {
          const emailsResp = await fetch("https://api.github.com/user/emails", {
            headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": "climpire", Accept: "application/vnd.github+json" },
            signal: AbortSignal.timeout(5000),
          });
          if (emailsResp.ok) {
            const emails = await emailsResp.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
            const primary = emails.find((e) => e.primary && e.verified);
            if (primary) email = primary.email;
          }
        } catch { /* best-effort */ }
        const grantedScope = typeof json.scope === "string" && json.scope.trim() ? json.scope : null;
        upsertOAuthCredential({ provider: "github", source: "web-oauth", email, scope: grantedScope, access_token: accessToken, refresh_token: null, expires_at: null });
        return res.json({ status: "complete", email });
      }

      const error = typeof json.error === "string" ? json.error : "unknown";
      if (error === "authorization_pending") return res.json({ status: "pending" });
      if (error === "slow_down") return res.json({ status: "slow_down" });
      if (error === "expired_token") { db.prepare("DELETE FROM oauth_states WHERE id = ?").run(stateId); return res.json({ status: "expired" }); }
      if (error === "access_denied") { db.prepare("DELETE FROM oauth_states WHERE id = ?").run(stateId); return res.json({ status: "denied" }); }
      return res.json({ status: "error", error });
    } catch (err) {
      return res.status(500).json({ error: "github_poll_error", message: String(err) });
    }
  });
}
