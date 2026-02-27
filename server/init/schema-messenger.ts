// @ts-nocheck
import type { Database } from "better-sqlite3";

export function createSchemaMessenger(db: Database): void {
  db.exec(`
CREATE TABLE IF NOT EXISTS messenger_sessions (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  token_enc TEXT,
  target TEXT NOT NULL,
  display_name TEXT NOT NULL,
  agent_id TEXT REFERENCES agents(id),
  session_key TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()*1000),
  updated_at INTEGER DEFAULT (unixepoch()*1000)
);

CREATE TABLE IF NOT EXISTS messenger_routes (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  source TEXT NOT NULL,
  author TEXT NOT NULL,
  session_key TEXT,
  created_at INTEGER DEFAULT (unixepoch()*1000)
);

CREATE INDEX IF NOT EXISTS idx_messenger_sessions_channel ON messenger_sessions(channel, active);
CREATE INDEX IF NOT EXISTS idx_messenger_sessions_key ON messenger_sessions(session_key);
CREATE INDEX IF NOT EXISTS idx_messenger_routes_task ON messenger_routes(task_id);
CREATE INDEX IF NOT EXISTS idx_messenger_routes_content ON messenger_routes(content_hash);
`);
}
