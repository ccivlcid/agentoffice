// @ts-nocheck
import type { RuntimeContext } from "../../../types/runtime-context.ts";
import { decryptSecret } from "../../../oauth/helpers.ts";
import { initOAuthTokenHelpers } from "./providers-oauth-tokens.ts";

export function initOAuthHelpers(ctx: RuntimeContext) {
  const db = ctx.db;
  const nowMs = ctx.nowMs;
  const ensureOAuthActiveAccount = ctx.ensureOAuthActiveAccount;
  const getActiveOAuthAccountIds = ctx.getActiveOAuthAccountIds;

  const ANTIGRAVITY_ENDPOINTS = [
    "https://cloudcode-pa.googleapis.com",
    "https://daily-cloudcode-pa.sandbox.googleapis.com",
    "https://autopush-cloudcode-pa.sandbox.googleapis.com",
  ];
  const ANTIGRAVITY_DEFAULT_PROJECT = "rising-fact-p41fc";
  let httpAgentCounter = Date.now() % 1_000_000;
  let cachedModels: { data: Record<string, string[]>; loadedAt: number } | null = null;
  const MODELS_CACHE_TTL = 60_000;

  const { refreshGoogleToken, exchangeCopilotToken, loadCodeAssistProject } =
    initOAuthTokenHelpers(db, nowMs, ANTIGRAVITY_ENDPOINTS, ANTIGRAVITY_DEFAULT_PROJECT);

  function getNextHttpAgentPid(): number {
    httpAgentCounter += 1;
    return -httpAgentCounter;
  }

  function oauthProviderPrefix(provider: string): string {
    return provider === "github" ? "Copi" : "Anti";
  }

  function normalizeOAuthProvider(provider: string): "github" | "google_antigravity" | null {
    if (provider === "github-copilot" || provider === "github" || provider === "copilot") return "github";
    if (provider === "antigravity" || provider === "google_antigravity") return "google_antigravity";
    return null;
  }

  function getOAuthAccountDisplayName(account: any): string {
    if (account.label) return account.label;
    if (account.email) return account.email;
    const prefix = oauthProviderPrefix(account.provider);
    return `${prefix}-${(account.id ?? "unknown").slice(0, 6)}`;
  }

  function getNextOAuthLabel(provider: string): string {
    const normalizedProvider = normalizeOAuthProvider(provider) ?? provider;
    const prefix = oauthProviderPrefix(normalizedProvider);
    const rows = db.prepare(
      "SELECT label FROM oauth_accounts WHERE provider = ?"
    ).all(normalizedProvider) as Array<{ label: string | null }>;
    let maxSeq = 0;
    for (const row of rows) {
      if (!row.label) continue;
      const m = row.label.match(new RegExp(`^${prefix}-(\\d+)$`));
      if (!m) continue;
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
    }
    return `${prefix}-${maxSeq + 1}`;
  }

  function getOAuthAutoSwapEnabled(): boolean {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'oauthAutoSwap'").get() as { value: string } | undefined;
    if (!row) return true;
    const v = String(row.value).toLowerCase().trim();
    return !(v === "false" || v === "0" || v === "off" || v === "no");
  }

  const oauthDispatchCursor = new Map<string, number>();

  function rotateOAuthAccounts(provider: string, accounts: any[]): any[] {
    if (accounts.length <= 1) return accounts;
    const current = oauthDispatchCursor.get(provider) ?? -1;
    const next = (current + 1) % accounts.length;
    oauthDispatchCursor.set(provider, next);
    if (next === 0) return accounts;
    return [...accounts.slice(next), ...accounts.slice(0, next)];
  }

  function prioritizeOAuthAccount(accounts: any[], preferredAccountId?: string | null): any[] {
    if (!preferredAccountId || accounts.length <= 1) return accounts;
    const idx = accounts.findIndex((a) => a.id === preferredAccountId);
    if (idx <= 0) return accounts;
    const [picked] = accounts.splice(idx, 1);
    return [picked, ...accounts];
  }

  function markOAuthAccountFailure(accountId: string, message: string): void {
    db.prepare(`
      UPDATE oauth_accounts
      SET failure_count = COALESCE(failure_count, 0) + 1,
          last_error = ?,
          last_error_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(message.slice(0, 1500), nowMs(), nowMs(), accountId);
  }

  function markOAuthAccountSuccess(accountId: string): void {
    db.prepare(`
      UPDATE oauth_accounts
      SET failure_count = 0,
          last_error = NULL,
          last_error_at = NULL,
          last_success_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(nowMs(), nowMs(), accountId);
  }

  function getOAuthAccounts(provider: string, includeDisabled = false): any[] {
    const normalizedProvider = normalizeOAuthProvider(provider);
    if (!normalizedProvider) return [];
    const rows = db.prepare(`
      SELECT
        id, provider, source, label, email, scope, expires_at,
        access_token_enc, refresh_token_enc, status, priority,
        model_override, failure_count, last_error, last_error_at, last_success_at
      FROM oauth_accounts
      WHERE provider = ?
        ${includeDisabled ? "" : "AND status = 'active'"}
      ORDER BY priority ASC, updated_at DESC
    `).all(normalizedProvider) as any[];

    const accounts: any[] = [];
    for (const row of rows) {
      try {
        accounts.push({
          id: row.id,
          provider: row.provider,
          source: row.source,
          label: row.label,
          accessToken: row.access_token_enc ? decryptSecret(row.access_token_enc) : null,
          refreshToken: row.refresh_token_enc ? decryptSecret(row.refresh_token_enc) : null,
          expiresAt: row.expires_at,
          email: row.email,
          status: row.status,
          priority: row.priority,
          modelOverride: row.model_override,
          failureCount: row.failure_count,
          lastError: row.last_error,
          lastErrorAt: row.last_error_at,
          lastSuccessAt: row.last_success_at,
        });
      } catch {
        // skip undecryptable account
      }
    }
    return accounts;
  }

  function getPreferredOAuthAccounts(provider: string, opts: { includeStandby?: boolean } = {}): any[] {
    const normalizedProvider = normalizeOAuthProvider(provider);
    if (!normalizedProvider) return [];
    ensureOAuthActiveAccount(normalizedProvider);
    const accounts = getOAuthAccounts(normalizedProvider, false);
    if (accounts.length === 0) return [];
    const activeIds = getActiveOAuthAccountIds(normalizedProvider);
    if (activeIds.length === 0) return accounts;
    const activeSet = new Set(activeIds);
    const selected = accounts.filter((a) => a.id && activeSet.has(a.id));
    if (selected.length === 0) return accounts;
    if (!opts.includeStandby) return selected;
    const standby = accounts.filter((a) => !(a.id && activeSet.has(a.id)));
    return [...selected, ...standby];
  }

  function getDecryptedOAuthToken(provider: string): any | null {
    const preferred = getPreferredOAuthAccounts(provider)[0];
    if (preferred) return preferred;

    const row = db
      .prepare("SELECT access_token_enc, refresh_token_enc, expires_at, email FROM oauth_credentials WHERE provider = ?")
      .get(provider) as any | undefined;
    if (!row) return null;
    return {
      id: null,
      provider,
      source: "legacy",
      label: null,
      accessToken: row.access_token_enc ? decryptSecret(row.access_token_enc) : null,
      refreshToken: row.refresh_token_enc ? decryptSecret(row.refresh_token_enc) : null,
      expiresAt: row.expires_at,
      email: row.email,
    };
  }

  function getProviderModelConfig(): Record<string, { model: string; subModel?: string; reasoningLevel?: string; subModelReasoningLevel?: string }> {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'providerModelConfig'").get() as { value: string } | undefined;
    return row ? JSON.parse(row.value) : {};
  }

  return {
    ANTIGRAVITY_ENDPOINTS,
    ANTIGRAVITY_DEFAULT_PROJECT,
    httpAgentCounter,
    getNextHttpAgentPid,
    cachedModels,
    MODELS_CACHE_TTL,
    oauthProviderPrefix,
    normalizeOAuthProvider,
    getOAuthAccountDisplayName,
    getNextOAuthLabel,
    getOAuthAutoSwapEnabled,
    rotateOAuthAccounts,
    prioritizeOAuthAccount,
    markOAuthAccountFailure,
    markOAuthAccountSuccess,
    getOAuthAccounts,
    getPreferredOAuthAccounts,
    getDecryptedOAuthToken,
    getProviderModelConfig,
    refreshGoogleToken,
    exchangeCopilotToken,
    loadCodeAssistProject,
  };
}
