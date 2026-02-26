// @ts-nocheck
/**
 * OAuth web-auth: orchestrates all OAuth route sub-modules.
 * Account management routes: disconnect, refresh, activate, update.
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import { createOAuthCredentialsService } from "./oauth-credentials.ts";
import { registerOAuthFlow } from "./oauth-flow.ts";
import { registerOAuthStatus } from "./oauth-status.ts";
import { registerOAuthDevice } from "./oauth-device.ts";

export function registerOpsOAuth(ctx: RuntimeContext): void {
  const {
    app, db, nowMs, firstQueryValue,
    normalizeOAuthProvider, getOAuthAccounts, getActiveOAuthAccountIds,
    ensureOAuthActiveAccount, setActiveOAuthAccount, removeActiveOAuthAccount,
    setOAuthActiveAccounts, getPreferredOAuthAccounts, getNextOAuthLabel, refreshGoogleToken,
  } = ctx;

  const credService = createOAuthCredentialsService({ db, normalizeOAuthProvider, nowMs, getNextOAuthLabel, setActiveOAuthAccount, ensureOAuthActiveAccount });

  registerOAuthStatus(app, { db, ensureOAuthActiveAccount, getActiveOAuthAccountIds, setActiveOAuthAccount, setOAuthActiveAccounts, getOAuthAccounts });
  registerOAuthFlow(app, { db, firstQueryValue }, credService);
  registerOAuthDevice(app, { db, nowMs, upsertOAuthCredential: credService.upsertOAuthCredential });

  // Account management routes
  app.post("/api/oauth/disconnect", (req: any, res: any) => {
    const body = (req.body as { provider?: string; account_id?: string }) ?? {};
    const provider = normalizeOAuthProvider(body.provider ?? "");
    const accountId = body.account_id;
    if (!provider) return res.status(400).json({ error: `Invalid provider: ${provider}` });

    if (accountId) {
      db.prepare("DELETE FROM oauth_accounts WHERE id = ? AND provider = ?").run(accountId, provider);
      ensureOAuthActiveAccount(provider);
      const remaining = (db.prepare("SELECT COUNT(*) as cnt FROM oauth_accounts WHERE provider = ?").get(provider) as { cnt: number }).cnt;
      if (remaining === 0) {
        db.prepare("DELETE FROM oauth_credentials WHERE provider = ?").run(provider);
        db.prepare("DELETE FROM oauth_active_accounts WHERE provider = ?").run(provider);
      }
    } else {
      db.prepare("DELETE FROM oauth_accounts WHERE provider = ?").run(provider);
      db.prepare("DELETE FROM oauth_active_accounts WHERE provider = ?").run(provider);
      db.prepare("DELETE FROM oauth_credentials WHERE provider = ?").run(provider);
    }
    res.json({ ok: true });
  });

  app.post("/api/oauth/refresh", async (req: any, res: any) => {
    const body = (req.body as { provider?: string; account_id?: string }) ?? {};
    const provider = normalizeOAuthProvider(body.provider ?? "");
    if (provider !== "google_antigravity") return res.status(400).json({ error: `Unsupported provider for refresh: ${provider}` });
    let cred: { id: string; refreshToken?: string | null } | null = null;
    if (body.account_id) {
      cred = getOAuthAccounts(provider, true).find((a: { id?: string }) => a.id === body.account_id) ?? null;
    } else {
      cred = getPreferredOAuthAccounts(provider)[0] ?? null;
    }
    if (!cred) return res.status(404).json({ error: "No credential found for google_antigravity" });
    if (!cred.refreshToken) return res.status(400).json({ error: "No refresh token available – re-authentication required" });
    try {
      await refreshGoogleToken(cred as any);
      const updatedRow = db.prepare("SELECT expires_at, updated_at FROM oauth_accounts WHERE id = ?").get(cred!.id) as { expires_at: number | null; updated_at: number } | undefined;
      console.log("[oauth] Manual refresh: Antigravity token renewed");
      res.json({ ok: true, expires_at: updatedRow?.expires_at ?? null, refreshed_at: Date.now(), account_id: cred.id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[oauth] Manual refresh failed for Antigravity:", msg);
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/oauth/accounts/activate", (req: any, res: any) => {
    const body = (req.body as { provider?: string; account_id?: string; mode?: "exclusive" | "add" | "remove" | "toggle" }) ?? {};
    const provider = normalizeOAuthProvider(body.provider ?? "");
    const mode = body.mode ?? "exclusive";
    if (!provider || !body.account_id) return res.status(400).json({ error: "provider and account_id are required" });
    const account = db.prepare("SELECT id, status FROM oauth_accounts WHERE id = ? AND provider = ?").get(body.account_id, provider) as { id: string; status: "active" | "disabled" } | undefined;
    if (!account) return res.status(404).json({ error: "account_not_found" });
    if ((mode === "exclusive" || mode === "add" || mode === "toggle") && account.status !== "active") return res.status(400).json({ error: "account_disabled" });

    if (mode === "exclusive") {
      setOAuthActiveAccounts(provider, [body.account_id]);
    } else if (mode === "add") {
      setActiveOAuthAccount(provider, body.account_id);
    } else if (mode === "remove") {
      removeActiveOAuthAccount(provider, body.account_id);
    } else if (mode === "toggle") {
      const activeIds = new Set(getActiveOAuthAccountIds(provider));
      if (activeIds.has(body.account_id)) { removeActiveOAuthAccount(provider, body.account_id); } else { setActiveOAuthAccount(provider, body.account_id); }
    } else {
      return res.status(400).json({ error: "invalid_mode" });
    }

    const activeIdsAfter = getActiveOAuthAccountIds(provider);
    if (activeIdsAfter.length === 0 && (mode === "remove" || mode === "toggle")) {
      const fallback = db.prepare("SELECT id FROM oauth_accounts WHERE provider = ? AND status = 'active' AND id != ? ORDER BY priority ASC, updated_at DESC LIMIT 1").get(provider, body.account_id) as { id: string } | undefined;
      if (fallback) { setActiveOAuthAccount(provider, fallback.id); } else { ensureOAuthActiveAccount(provider); }
    } else {
      ensureOAuthActiveAccount(provider);
    }
    res.json({ ok: true, activeAccountIds: getActiveOAuthAccountIds(provider) });
  });

  app.put("/api/oauth/accounts/:id", (req: any, res: any) => {
    const id = String(req.params.id);
    const body = (req.body as { label?: string | null; model_override?: string | null; priority?: number; status?: "active" | "disabled" }) ?? {};
    const existing = db.prepare("SELECT id FROM oauth_accounts WHERE id = ?").get(id) as { id: string } | undefined;
    if (!existing) return res.status(404).json({ error: "account_not_found" });
    const updates: string[] = ["updated_at = ?"];
    const params: unknown[] = [nowMs()];
    if ("label" in body) { updates.push("label = ?"); params.push(body.label ?? null); }
    if ("model_override" in body) { updates.push("model_override = ?"); params.push(body.model_override ?? null); }
    if (typeof body.priority === "number" && Number.isFinite(body.priority)) { updates.push("priority = ?"); params.push(Math.max(1, Math.round(body.priority))); }
    if (body.status === "active" || body.status === "disabled") { updates.push("status = ?"); params.push(body.status); }
    params.push(id);
    db.prepare(`UPDATE oauth_accounts SET ${updates.join(", ")} WHERE id = ?`).run(...(params as any[]));
    const providerRow = db.prepare("SELECT provider FROM oauth_accounts WHERE id = ?").get(id) as { provider: string };
    ensureOAuthActiveAccount(providerRow.provider);
    res.json({ ok: true });
  });
}
