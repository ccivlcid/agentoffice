// @ts-nocheck
import { randomUUID } from "node:crypto";
import type { Database } from "better-sqlite3";
import { nowMs } from "./helpers.ts";

export function runMigrationspart1(db: Database): void {
  // Add columns to oauth_credentials for web-oauth tokens (safe to run repeatedly)
  try { db.exec("ALTER TABLE oauth_credentials ADD COLUMN access_token_enc TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE oauth_credentials ADD COLUMN refresh_token_enc TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE agents ADD COLUMN oauth_account_id TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE agents ADD COLUMN api_provider_id TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE agents ADD COLUMN api_model TEXT"); } catch { /* already exists */ }

  // 기존 DB의 cli_provider CHECK 제약 확장 (SQLite는 ALTER CHECK 미지원이므로 새 행만 해당)
  try {
    const hasApiCheck = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='agents'").get() as any)?.sql?.includes("'api'");
    if (!hasApiCheck) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS agents_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          name_ko TEXT NOT NULL,
          department_id TEXT REFERENCES departments(id),
          role TEXT NOT NULL CHECK(role IN ('team_leader','senior','junior','intern')),
          cli_provider TEXT CHECK(cli_provider IN ('claude','codex','gemini','opencode','copilot','antigravity','api')),
          oauth_account_id TEXT,
          api_provider_id TEXT,
          api_model TEXT,
          avatar_emoji TEXT NOT NULL DEFAULT '🤖',
          personality TEXT,
          status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle','working','break','offline')),
          current_task_id TEXT,
          stats_tasks_done INTEGER DEFAULT 0,
          stats_xp INTEGER DEFAULT 0,
          created_at INTEGER DEFAULT (unixepoch()*1000)
        );
        INSERT INTO agents_new SELECT id, name, name_ko, department_id, role, cli_provider, oauth_account_id, NULL, NULL, avatar_emoji, personality, status, current_task_id, stats_tasks_done, stats_xp, created_at FROM agents;
        DROP TABLE agents;
        ALTER TABLE agents_new RENAME TO agents;
      `);
    }
  } catch { /* migration already done or not needed */ }

  // api_providers CHECK 제약 확장: cerebras 추가
  try {
    const apiProvSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='api_providers'").get() as any)?.sql ?? "";
    if (apiProvSql && !apiProvSql.includes("'cerebras'")) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS api_providers_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'openai' CHECK(type IN ('openai','anthropic','google','ollama','openrouter','together','groq','cerebras','custom')),
          base_url TEXT NOT NULL,
          api_key_enc TEXT,
          enabled INTEGER NOT NULL DEFAULT 1,
          models_cache TEXT,
          models_cached_at INTEGER,
          created_at INTEGER DEFAULT (unixepoch()*1000),
          updated_at INTEGER DEFAULT (unixepoch()*1000)
        );
        INSERT INTO api_providers_new SELECT * FROM api_providers;
        DROP TABLE api_providers;
        ALTER TABLE api_providers_new RENAME TO api_providers;
      `);
    }
  } catch { /* migration already done or not needed */ }

  try { db.exec("ALTER TABLE oauth_accounts ADD COLUMN label TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE oauth_accounts ADD COLUMN model_override TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE oauth_accounts ADD COLUMN status TEXT NOT NULL DEFAULT 'active'"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE oauth_accounts ADD COLUMN priority INTEGER NOT NULL DEFAULT 100"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE oauth_accounts ADD COLUMN failure_count INTEGER NOT NULL DEFAULT 0"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE oauth_accounts ADD COLUMN last_error TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE oauth_accounts ADD COLUMN last_error_at INTEGER"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE oauth_accounts ADD COLUMN last_success_at INTEGER"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE tasks ADD COLUMN base_branch TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE projects ADD COLUMN github_repo TEXT"); } catch { /* already exists */ }
}

export function migrateOAuthActiveAccountsTable(db: Database): void {
  const cols = db.prepare("PRAGMA table_info(oauth_active_accounts)").all() as Array<{
    name: string;
    pk: number;
  }>;
  if (cols.length === 0) return;
  const providerPk = cols.find((c) => c.name === "provider")?.pk ?? 0;
  const accountPk = cols.find((c) => c.name === "account_id")?.pk ?? 0;
  const hasCompositePk = providerPk === 1 && accountPk === 2;
  if (hasCompositePk) return;

  db.exec("BEGIN");
  try {
    db.exec("ALTER TABLE oauth_active_accounts RENAME TO oauth_active_accounts_legacy");
    db.exec(`
      CREATE TABLE oauth_active_accounts (
        provider TEXT NOT NULL,
        account_id TEXT NOT NULL REFERENCES oauth_accounts(id) ON DELETE CASCADE,
        updated_at INTEGER DEFAULT (unixepoch()*1000),
        PRIMARY KEY (provider, account_id)
      )
    `);
    db.exec(`
      INSERT OR IGNORE INTO oauth_active_accounts (provider, account_id, updated_at)
      SELECT provider, account_id, COALESCE(updated_at, unixepoch() * 1000)
      FROM oauth_active_accounts_legacy
      WHERE provider IS NOT NULL AND account_id IS NOT NULL
    `);
    db.exec("DROP TABLE oauth_active_accounts_legacy");
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function getActiveOAuthAccountIds(db: Database, provider: string): string[] {
  return (db.prepare(`
    SELECT oa.account_id
    FROM oauth_active_accounts oa
    JOIN oauth_accounts a ON a.id = oa.account_id
    WHERE oa.provider = ?
      AND a.provider = ?
      AND a.status = 'active'
    ORDER BY oa.updated_at DESC, a.priority ASC, a.updated_at DESC
  `).all(provider, provider) as Array<{ account_id: string }>).map((r) => r.account_id);
}

export function setActiveOAuthAccount(db: Database, provider: string, accountId: string): void {
  db.prepare(`
    INSERT INTO oauth_active_accounts (provider, account_id, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(provider, account_id) DO UPDATE SET
      updated_at = excluded.updated_at
  `).run(provider, accountId, nowMs());
}

export function removeActiveOAuthAccount(db: Database, provider: string, accountId: string): void {
  db.prepare(
    "DELETE FROM oauth_active_accounts WHERE provider = ? AND account_id = ?"
  ).run(provider, accountId);
}

export function setOAuthActiveAccounts(
  db: Database,
  runInTransaction: (fn: () => void) => void,
  provider: string,
  accountIds: string[],
): void {
  const cleaned = Array.from(new Set(accountIds.filter(Boolean)));
  runInTransaction(() => {
    db.prepare("DELETE FROM oauth_active_accounts WHERE provider = ?").run(provider);
    if (cleaned.length === 0) return;
    const stmt = db.prepare(`
      INSERT INTO oauth_active_accounts (provider, account_id, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(provider, account_id) DO UPDATE SET
        updated_at = excluded.updated_at
    `);
    let stamp = nowMs();
    for (const id of cleaned) {
      stmt.run(provider, id, stamp);
      stamp += 1;
    }
  });
}

export function oauthProviderPrefix(provider: string): string {
  return provider === "github" ? "Copi" : "Anti";
}

export function normalizeOAuthProvider(provider: string): "github" | "google_antigravity" | null {
  if (provider === "github-copilot" || provider === "github" || provider === "copilot") return "github";
  if (provider === "antigravity" || provider === "google_antigravity") return "google_antigravity";
  return null;
}

export function getNextOAuthLabel(db: Database, provider: string): string {
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

export function ensureOAuthActiveAccount(db: Database, provider: string): void {
  db.prepare(`
    DELETE FROM oauth_active_accounts
    WHERE provider = ?
      AND account_id NOT IN (
        SELECT id FROM oauth_accounts WHERE provider = ? AND status = 'active'
      )
  `).run(provider, provider);

  const activeIds = getActiveOAuthAccountIds(db, provider);
  if (activeIds.length > 0) return;

  const fallback = db.prepare(
    "SELECT id FROM oauth_accounts WHERE provider = ? AND status = 'active' ORDER BY priority ASC, updated_at DESC LIMIT 1"
  ).get(provider) as { id: string } | undefined;
  if (!fallback) {
    db.prepare("DELETE FROM oauth_active_accounts WHERE provider = ?").run(provider);
    return;
  }
  setActiveOAuthAccount(db, provider, fallback.id);
}

export function migrateLegacyOAuthCredentialsToAccounts(db: Database): void {
  const legacyRows = db.prepare(`
    SELECT provider, source, email, scope, expires_at, access_token_enc, refresh_token_enc, created_at, updated_at
    FROM oauth_credentials
    WHERE provider IN ('github','google_antigravity')
  `).all() as Array<{
    provider: string;
    source: string | null;
    email: string | null;
    scope: string | null;
    expires_at: number | null;
    access_token_enc: string | null;
    refresh_token_enc: string | null;
    created_at: number;
    updated_at: number;
  }>;

  for (const row of legacyRows) {
    const hasAccounts = db.prepare(
      "SELECT COUNT(*) as cnt FROM oauth_accounts WHERE provider = ?"
    ).get(row.provider) as { cnt: number };
    if (hasAccounts.cnt > 0) continue;
    if (!row.access_token_enc && !row.refresh_token_enc) continue;
    const id = randomUUID();
    const label = getNextOAuthLabel(db, row.provider);
    db.prepare(`
      INSERT INTO oauth_accounts (
        id, provider, source, label, email, scope, expires_at,
        access_token_enc, refresh_token_enc, status, priority,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 100, ?, ?)
    `).run(
      id,
      row.provider,
      row.source,
      label,
      row.email,
      row.scope,
      row.expires_at,
      row.access_token_enc,
      row.refresh_token_enc,
      row.created_at || nowMs(),
      row.updated_at || nowMs(),
    );
  }

  ensureOAuthActiveAccount(db, "github");
  ensureOAuthActiveAccount(db, "google_antigravity");
}
