// @ts-nocheck
/**
 * OAuth credential state management: consumeOAuthState + upsertOAuthCredential.
 * Extracted from oauth.ts to reduce single-file size.
 */

import { randomUUID } from "node:crypto";
import { OAUTH_STATE_TTL_MS, encryptSecret } from "../../../oauth/helpers.ts";

type OAuthCredCtx = {
  db: any;
  normalizeOAuthProvider: Function;
  nowMs: () => number;
  getNextOAuthLabel: Function;
  setActiveOAuthAccount: Function;
  ensureOAuthActiveAccount: Function;
};

export type UpsertOAuthInput = {
  provider: string;
  source: string;
  email: string | null;
  scope: string | null;
  access_token: string;
  refresh_token: string | null;
  expires_at: number | null;
  label?: string | null;
  model_override?: string | null;
  make_active?: boolean;
};

export function createOAuthCredentialsService(ctx: OAuthCredCtx) {
  const { db, normalizeOAuthProvider, nowMs, getNextOAuthLabel, setActiveOAuthAccount, ensureOAuthActiveAccount } = ctx;

  function consumeOAuthState(stateId: string, provider: string): { verifier_enc: string; redirect_to: string | null } | null {
    const row = db.prepare(
      "SELECT provider, verifier_enc, redirect_to, created_at FROM oauth_states WHERE id = ?"
    ).get(stateId) as { provider: string; verifier_enc: string; redirect_to: string | null; created_at: number } | undefined;
    if (!row) return null;
    db.prepare("DELETE FROM oauth_states WHERE id = ?").run(stateId);
    if (Date.now() - row.created_at > OAUTH_STATE_TTL_MS) return null;
    if (row.provider !== provider) return null;
    return { verifier_enc: row.verifier_enc, redirect_to: row.redirect_to };
  }

  function upsertOAuthCredential(input: UpsertOAuthInput): string {
    const normalizedProvider = normalizeOAuthProvider(input.provider) ?? input.provider;
    const now = nowMs();
    const accessEnc = encryptSecret(input.access_token);
    const refreshEnc = input.refresh_token ? encryptSecret(input.refresh_token) : null;
    const encData = encryptSecret(JSON.stringify({ access_token: input.access_token }));

    db.prepare(`
      INSERT INTO oauth_credentials (provider, source, encrypted_data, email, scope, expires_at, created_at, updated_at, access_token_enc, refresh_token_enc)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider) DO UPDATE SET
        source = excluded.source, encrypted_data = excluded.encrypted_data,
        email = excluded.email, scope = excluded.scope, expires_at = excluded.expires_at,
        updated_at = excluded.updated_at, access_token_enc = excluded.access_token_enc,
        refresh_token_enc = excluded.refresh_token_enc
    `).run(normalizedProvider, input.source, encData, input.email, input.scope, input.expires_at, now, now, accessEnc, refreshEnc);

    let accountId: string | null = null;
    if (input.email) {
      const existing = db.prepare(
        "SELECT id FROM oauth_accounts WHERE provider = ? AND email = ? ORDER BY updated_at DESC LIMIT 1"
      ).get(normalizedProvider, input.email) as { id: string } | undefined;
      if (existing) accountId = existing.id;
    }

    if (!accountId) {
      const nextPriority = (db.prepare(
        "SELECT COALESCE(MAX(priority), 90) + 10 AS p FROM oauth_accounts WHERE provider = ?"
      ).get(normalizedProvider) as { p: number }).p;
      const defaultLabel = getNextOAuthLabel(normalizedProvider);
      accountId = randomUUID();
      db.prepare(`
        INSERT INTO oauth_accounts (
          id, provider, source, label, email, scope, expires_at,
          access_token_enc, refresh_token_enc, status, priority, model_override,
          failure_count, last_error, last_error_at, last_success_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, 0, NULL, NULL, ?, ?, ?)
      `).run(accountId, normalizedProvider, input.source, input.label ?? defaultLabel, input.email, input.scope, input.expires_at, accessEnc, refreshEnc, nextPriority, input.model_override ?? null, now, now, now);
    } else {
      let resolvedLabel: string | null = input.label ?? null;
      if (!resolvedLabel) {
        const current = db.prepare("SELECT label, email FROM oauth_accounts WHERE id = ?").get(accountId) as { label: string | null; email: string | null } | undefined;
        if (!current?.label || (current.email && current.label === current.email)) {
          resolvedLabel = getNextOAuthLabel(normalizedProvider);
        }
      }
      db.prepare(`
        UPDATE oauth_accounts
        SET source = ?, label = COALESCE(?, label), email = ?, scope = ?, expires_at = ?,
            access_token_enc = ?, refresh_token_enc = ?, model_override = COALESCE(?, model_override),
            status = 'active', updated_at = ?, last_success_at = ?,
            failure_count = 0, last_error = NULL, last_error_at = NULL
        WHERE id = ?
      `).run(input.source, resolvedLabel, input.email, input.scope, input.expires_at, accessEnc, refreshEnc, input.model_override ?? null, now, now, accountId);
    }

    if (input.make_active !== false && accountId) setActiveOAuthAccount(normalizedProvider, accountId);
    ensureOAuthActiveAccount(normalizedProvider);
    return accountId;
  }

  return { consumeOAuthState, upsertOAuthCredential };
}
