// @ts-nocheck
/**
 * OAuth status route: buildOAuthStatus + GET /api/oauth/status.
 * Extracted from oauth.ts to reduce single-file size.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { OAUTH_ENCRYPTION_SECRET } from "../../../oauth/helpers.ts";

type OAuthStatusCtx = {
  db: any;
  ensureOAuthActiveAccount: Function;
  getActiveOAuthAccountIds: Function;
  setActiveOAuthAccount: Function;
  setOAuthActiveAccounts: Function;
  getOAuthAccounts: Function;
};

function detectFileCredential(home: string, provider: "github" | "google_antigravity") {
  if (provider === "github") {
    try {
      const hostsPath = path.join(home, ".config", "gh", "hosts.yml");
      const raw = fs.readFileSync(hostsPath, "utf8");
      const userMatch = raw.match(/user:\s*(\S+)/);
      if (userMatch) {
        const stat = fs.statSync(hostsPath);
        return { detected: true, source: "file-detected", email: userMatch[1], scope: "github.com", created_at: stat.birthtimeMs, updated_at: stat.mtimeMs };
      }
    } catch {}
    const copilotPaths = [
      path.join(home, ".config", "github-copilot", "hosts.json"),
      path.join(home, ".config", "github-copilot", "apps.json"),
    ];
    for (const cp of copilotPaths) {
      try {
        const raw = JSON.parse(fs.readFileSync(cp, "utf8"));
        if (raw && typeof raw === "object" && Object.keys(raw).length > 0) {
          const stat = fs.statSync(cp);
          const firstKey = Object.keys(raw)[0];
          return { detected: true, source: "file-detected", email: raw[firstKey]?.user ?? null, scope: "copilot", created_at: stat.birthtimeMs, updated_at: stat.mtimeMs };
        }
      } catch {}
    }
  } else {
    const agPaths = [
      path.join(home, ".antigravity", "auth.json"),
      path.join(home, ".config", "antigravity", "auth.json"),
      path.join(home, ".config", "antigravity", "credentials.json"),
    ];
    for (const ap of agPaths) {
      try {
        const raw = JSON.parse(fs.readFileSync(ap, "utf8"));
        if (raw && typeof raw === "object") {
          const stat = fs.statSync(ap);
          return { detected: true, source: "file-detected", email: raw.email ?? raw.user ?? null, scope: raw.scope ?? null, created_at: stat.birthtimeMs, updated_at: stat.mtimeMs };
        }
      } catch {}
    }
  }
  return { detected: false, source: null as string | null, email: null as string | null, scope: null as string | null, created_at: 0, updated_at: 0 };
}

async function buildOAuthStatus(ctx: OAuthStatusCtx) {
  const { db, ensureOAuthActiveAccount, getActiveOAuthAccountIds, setActiveOAuthAccount, setOAuthActiveAccounts, getOAuthAccounts } = ctx;
  const home = os.homedir();

  const buildProviderStatus = (internalProvider: "github" | "google_antigravity") => {
    ensureOAuthActiveAccount(internalProvider);
    let activeAccountIds = getActiveOAuthAccountIds(internalProvider);
    let activeSet = new Set(activeAccountIds);

    const rows = db.prepare(`
      SELECT id, label, email, source, scope, status, priority, expires_at,
             refresh_token_enc, model_override, failure_count, last_error, last_error_at, last_success_at, created_at, updated_at
      FROM oauth_accounts WHERE provider = ? ORDER BY priority ASC, updated_at DESC
    `).all(internalProvider) as Array<Record<string, unknown>>;

    const decryptedById = new Map(getOAuthAccounts(internalProvider, true).map((a: { id?: string }) => [a.id as string, a]));
    const accounts = rows.map((row) => {
      const dec = decryptedById.get(row.id as string);
      const expiresAtMs = row.expires_at && (row.expires_at as number) < 1e12 ? (row.expires_at as number) * 1000 : row.expires_at as number;
      const hasRefreshToken = Boolean((dec as any)?.refreshToken);
      const hasFreshAccessToken = Boolean((dec as any)?.accessToken) && (!expiresAtMs || expiresAtMs > Date.now() + 60_000);
      const executionReady = row.status === "active" && (hasFreshAccessToken || hasRefreshToken);
      return {
        id: row.id, label: row.label, email: row.email, source: row.source, scope: row.scope,
        status: row.status as "active" | "disabled", priority: row.priority, expires_at: row.expires_at,
        hasRefreshToken, executionReady, active: activeSet.has(row.id as string),
        modelOverride: row.model_override, failureCount: row.failure_count, lastError: row.last_error,
        lastErrorAt: row.last_error_at, lastSuccessAt: row.last_success_at, created_at: row.created_at, updated_at: row.updated_at,
      };
    });

    if (accounts.length > 0) {
      const activeIdsPresent = activeAccountIds.filter((id: string) => accounts.some((a) => a.id === id && a.status === "active"));
      if (activeIdsPresent.length === 0) {
        const fallback = accounts.find((a) => a.status === "active");
        if (fallback) { setActiveOAuthAccount(internalProvider, fallback.id); activeAccountIds = getActiveOAuthAccountIds(internalProvider); }
      } else if (activeIdsPresent.length !== activeAccountIds.length) {
        setOAuthActiveAccounts(internalProvider, activeIdsPresent); activeAccountIds = activeIdsPresent;
      }
    }
    activeSet = new Set(activeAccountIds);
    const activeAccountId = activeAccountIds[0] ?? null;
    const accountsWithActive = accounts.map((a) => ({ ...a, active: activeSet.has(a.id as string) }));
    const runnable = accountsWithActive.filter((a) => a.executionReady);
    const primary = accountsWithActive.find((a) => a.active) ?? runnable[0] ?? accountsWithActive[0] ?? null;
    const fileDetected = detectFileCredential(home, internalProvider);
    const detected = accountsWithActive.length > 0 || fileDetected.detected;
    const connected = runnable.length > 0;
    return {
      connected, detected, executionReady: connected, requiresWebOAuth: detected && !connected,
      source: primary?.source ?? fileDetected.source, email: primary?.email ?? fileDetected.email,
      scope: primary?.scope ?? fileDetected.scope, expires_at: primary?.expires_at ?? null,
      created_at: primary?.created_at ?? fileDetected.created_at, updated_at: primary?.updated_at ?? fileDetected.updated_at,
      webConnectable: true, hasRefreshToken: primary?.hasRefreshToken ?? false,
      refreshFailed: primary?.lastError ? true : undefined, lastRefreshed: primary?.lastSuccessAt ?? null,
      activeAccountId, activeAccountIds, accounts: accountsWithActive,
    };
  };

  return {
    "github-copilot": buildProviderStatus("github"),
    antigravity: buildProviderStatus("google_antigravity"),
  };
}

export function registerOAuthStatus(app: any, ctx: OAuthStatusCtx): void {
  app.get("/api/oauth/status", async (_req: any, res: any) => {
    try {
      const providers = await buildOAuthStatus(ctx);
      res.json({ storageReady: Boolean(OAUTH_ENCRYPTION_SECRET), providers });
    } catch (err) {
      console.error("[oauth] Failed to build OAuth status:", err);
      res.status(500).json({ error: "Failed to build OAuth status" });
    }
  });
}
