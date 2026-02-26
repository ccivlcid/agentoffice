// @ts-nocheck
import type { Database } from "better-sqlite3";

export function repairLegacyTaskForeignKeys(db: Database): void {
  const refCount = (db.prepare(`
    SELECT COUNT(*) AS cnt
    FROM sqlite_master
    WHERE type = 'table' AND sql LIKE '%tasks_legacy_status_migration%'
  `).get() as { cnt: number }).cnt;
  if (refCount === 0) return;

  console.log("[HyperClaw] Repairing legacy foreign keys to tasks_legacy_status_migration");
  const messagesOld = "messages_fkfix_old";
  const taskLogsOld = "task_logs_fkfix_old";
  const subtasksOld = "subtasks_fkfix_old";
  const meetingMinutesOld = "meeting_minutes_fkfix_old";
  const meetingEntriesOld = "meeting_minute_entries_fkfix_old";

  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.exec("BEGIN");
    try {
      // -- messages
      db.exec(`ALTER TABLE messages RENAME TO ${messagesOld}`);
      const legacyMessageCols = db.prepare(`PRAGMA table_info(${messagesOld})`).all() as Array<{ name: string }>;
      const hasLegacyIdempotencyKey = legacyMessageCols.some((c) => c.name === "idempotency_key");
      const legacyIdempotencyExpr = hasLegacyIdempotencyKey ? "idempotency_key" : "NULL";
      db.exec(`
        CREATE TABLE messages (
          id TEXT PRIMARY KEY,
          sender_type TEXT NOT NULL CHECK(sender_type IN ('ceo','agent','system')),
          sender_id TEXT,
          receiver_type TEXT NOT NULL CHECK(receiver_type IN ('agent','department','all')),
          receiver_id TEXT,
          content TEXT NOT NULL,
          message_type TEXT DEFAULT 'chat' CHECK(message_type IN ('chat','task_assign','announcement','directive','report','status_update')),
          task_id TEXT REFERENCES tasks(id),
          idempotency_key TEXT,
          created_at INTEGER DEFAULT (unixepoch()*1000)
        );
      `);
      db.exec(`
        INSERT INTO messages (id, sender_type, sender_id, receiver_type, receiver_id, content, message_type, task_id, idempotency_key, created_at)
        SELECT id, sender_type, sender_id, receiver_type, receiver_id, content, message_type, task_id, ${legacyIdempotencyExpr}, created_at
        FROM ${messagesOld};
      `);

      // -- task_logs
      db.exec(`ALTER TABLE task_logs RENAME TO ${taskLogsOld}`);
      db.exec(`
        CREATE TABLE task_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id TEXT REFERENCES tasks(id),
          kind TEXT NOT NULL,
          message TEXT NOT NULL,
          created_at INTEGER DEFAULT (unixepoch()*1000)
        );
      `);
      db.exec(`INSERT INTO task_logs (id, task_id, kind, message, created_at) SELECT id, task_id, kind, message, created_at FROM ${taskLogsOld};`);

      // -- subtasks
      db.exec(`ALTER TABLE subtasks RENAME TO ${subtasksOld}`);
      db.exec(`
        CREATE TABLE subtasks (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'pending'
            CHECK(status IN ('pending','in_progress','done','blocked')),
          assigned_agent_id TEXT REFERENCES agents(id),
          blocked_reason TEXT,
          cli_tool_use_id TEXT,
          created_at INTEGER DEFAULT (unixepoch()*1000),
          completed_at INTEGER,
          target_department_id TEXT,
          delegated_task_id TEXT
        );
      `);
      const subtasksCols = db.prepare(`PRAGMA table_info(${subtasksOld})`).all() as Array<{ name: string }>;
      const hasTargetDept = subtasksCols.some((c) => c.name === "target_department_id");
      const hasDelegatedTask = subtasksCols.some((c) => c.name === "delegated_task_id");
      db.exec(`
        INSERT INTO subtasks (id, task_id, title, description, status, assigned_agent_id, blocked_reason, cli_tool_use_id, created_at, completed_at, target_department_id, delegated_task_id)
        SELECT id, task_id, title, description, status, assigned_agent_id, blocked_reason, cli_tool_use_id, created_at, completed_at,
          ${hasTargetDept ? "target_department_id" : "NULL"},
          ${hasDelegatedTask ? "delegated_task_id" : "NULL"}
        FROM ${subtasksOld};
      `);

      // -- meeting_minute_entries + meeting_minutes
      db.exec(`ALTER TABLE meeting_minute_entries RENAME TO ${meetingEntriesOld}`);
      db.exec(`ALTER TABLE meeting_minutes RENAME TO ${meetingMinutesOld}`);
      db.exec(`
        CREATE TABLE meeting_minutes (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          meeting_type TEXT NOT NULL CHECK(meeting_type IN ('planned','review')),
          round INTEGER NOT NULL,
          title TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','completed','revision_requested','failed')),
          started_at INTEGER NOT NULL,
          completed_at INTEGER,
          created_at INTEGER DEFAULT (unixepoch()*1000)
        );
      `);
      db.exec(`INSERT INTO meeting_minutes (id, task_id, meeting_type, round, title, status, started_at, completed_at, created_at) SELECT id, task_id, meeting_type, round, title, status, started_at, completed_at, created_at FROM ${meetingMinutesOld};`);

      db.exec(`
        CREATE TABLE meeting_minute_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          meeting_id TEXT NOT NULL REFERENCES meeting_minutes(id) ON DELETE CASCADE,
          seq INTEGER NOT NULL,
          speaker_agent_id TEXT REFERENCES agents(id),
          speaker_name TEXT NOT NULL,
          department_name TEXT,
          role_label TEXT,
          message_type TEXT NOT NULL DEFAULT 'chat',
          content TEXT NOT NULL,
          created_at INTEGER DEFAULT (unixepoch()*1000)
        );
      `);
      db.exec(`INSERT INTO meeting_minute_entries (id, meeting_id, seq, speaker_agent_id, speaker_name, department_name, role_label, message_type, content, created_at) SELECT id, meeting_id, seq, speaker_agent_id, speaker_name, department_name, role_label, message_type, content, created_at FROM ${meetingEntriesOld};`);

      // -- cleanup old tables
      db.exec(`DROP TABLE ${messagesOld}`);
      db.exec(`DROP TABLE ${taskLogsOld}`);
      db.exec(`DROP TABLE ${subtasksOld}`);
      db.exec(`DROP TABLE ${meetingEntriesOld}`);
      db.exec(`DROP TABLE ${meetingMinutesOld}`);

      // -- recreate indexes
      db.exec("CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id)");
      db.exec("CREATE INDEX IF NOT EXISTS idx_task_logs_task ON task_logs(task_id, created_at DESC)");
      db.exec("CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_type, receiver_id, created_at DESC)");
      db.exec("CREATE INDEX IF NOT EXISTS idx_meeting_minutes_task ON meeting_minutes(task_id, started_at DESC)");
      db.exec("CREATE INDEX IF NOT EXISTS idx_meeting_minute_entries_meeting ON meeting_minute_entries(meeting_id, seq ASC)");

      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}
