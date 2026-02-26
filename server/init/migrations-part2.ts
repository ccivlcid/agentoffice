// @ts-nocheck
import type { Database } from "better-sqlite3";
import { repairLegacyTaskForeignKeys } from "./migrations-fk-repair.ts";

export { repairLegacyTaskForeignKeys } from "./migrations-fk-repair.ts";

export function runMigrationsPart2(db: Database): void {
  // Subtask cross-department delegation columns
  try { db.exec("ALTER TABLE subtasks ADD COLUMN target_department_id TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE subtasks ADD COLUMN delegated_task_id TEXT"); } catch { /* already exists */ }

  // Cross-department collaboration: link collaboration task back to original task
  try { db.exec("ALTER TABLE tasks ADD COLUMN source_task_id TEXT"); } catch { /* already exists */ }
  try {
    const taskCols = db.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string }>;
    const hasProjectId = taskCols.some((c) => c.name === "project_id");
    if (!hasProjectId) {
      try {
        db.exec("ALTER TABLE tasks ADD COLUMN project_id TEXT REFERENCES projects(id)");
      } catch {
        // Fallback for legacy SQLite builds that reject REFERENCES on ADD COLUMN.
        db.exec("ALTER TABLE tasks ADD COLUMN project_id TEXT");
      }
    }
  } catch { /* table missing during migration window */ }
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id, updated_at DESC)"); } catch { /* project_id not ready yet */ }

  // Task creation audit completion flag
  try { db.exec("ALTER TABLE task_creation_audits ADD COLUMN completed INTEGER NOT NULL DEFAULT 0"); } catch { /* already exists */ }
  // Task hidden state (migrated from client localStorage)
  try { db.exec("ALTER TABLE tasks ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0"); } catch { /* already exists */ }

  // v1.2.0: Agent multi-language names and sprite number
  try { db.exec("ALTER TABLE agents ADD COLUMN name_ja TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE agents ADD COLUMN name_zh TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE agents ADD COLUMN sprite_number INTEGER DEFAULT 1"); } catch { /* already exists */ }

  // v1.2.0: Department multi-language names and prompt
  try { db.exec("ALTER TABLE departments ADD COLUMN name_ja TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE departments ADD COLUMN name_zh TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE departments ADD COLUMN prompt TEXT"); } catch { /* already exists */ }

  // v1.2.0: Project manual assignment mode
  try { db.exec("ALTER TABLE projects ADD COLUMN assignment_mode TEXT NOT NULL DEFAULT 'auto'"); } catch { /* already exists */ }

  // v1.2.0: Project-agent join table
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_agents (
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      created_at INTEGER DEFAULT (unixepoch()*1000),
      PRIMARY KEY (project_id, agent_id)
    );
    CREATE INDEX IF NOT EXISTS idx_project_agents_project ON project_agents(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_agents_agent ON project_agents(agent_id);
  `);
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_task_creation_audits_completed ON task_creation_audits(completed, created_at DESC)");
  } catch { /* table missing or migration in progress */ }

  // v1.2.0: Safe sort_order UNIQUE index migration for departments
  try {
    // Drop old UNIQUE index if it exists to avoid constraint violations during seed updates
    db.exec("DROP INDEX IF EXISTS idx_departments_sort_order");
    // Normalize sort_order values to ensure uniqueness
    const depts = db.prepare("SELECT id FROM departments ORDER BY sort_order ASC, id ASC").all() as { id: string }[];
    for (let i = 0; i < depts.length; i++) {
      db.prepare("UPDATE departments SET sort_order = ? WHERE id = ?").run(i * 10, depts[i].id);
    }
    // Recreate UNIQUE index
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_sort_order ON departments(sort_order)");
  } catch { /* departments table may not exist yet */ }
}

export function migrateMessagesDirectiveType(db: Database): void {
  const row = db.prepare(`
    SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'messages'
  `).get() as { sql?: string } | undefined;
  const ddl = (row?.sql ?? "").toLowerCase();
  if (ddl.includes("'directive'")) return;

  console.log("[HyperClaw] Migrating messages.message_type CHECK to include 'directive'");
  const oldTable = "messages_directive_migration_old";
  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.exec("BEGIN");
    try {
      db.exec(`ALTER TABLE messages RENAME TO ${oldTable}`);
      const oldCols = db.prepare(`PRAGMA table_info(${oldTable})`).all() as Array<{ name: string }>;
      const hasIdempotencyKey = oldCols.some((c) => c.name === "idempotency_key");
      const idempotencyExpr = hasIdempotencyKey ? "idempotency_key" : "NULL";
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
        SELECT id, sender_type, sender_id, receiver_type, receiver_id, content, message_type, task_id, ${idempotencyExpr}, created_at
        FROM ${oldTable};
      `);
      db.exec(`DROP TABLE ${oldTable}`);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      try { db.exec(`ALTER TABLE ${oldTable} RENAME TO messages`); } catch { /* */ }
      throw e;
    }
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_type, receiver_id, created_at DESC)");
}

export function migrateLegacyTasksStatusSchema(db: Database): void {
  const row = db.prepare(`
    SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'tasks'
  `).get() as { sql?: string } | undefined;
  const ddl = (row?.sql ?? "").toLowerCase();
  if (ddl.includes("'collaborating'") && ddl.includes("'pending'")) return;

  console.log("[HyperClaw] Migrating legacy tasks.status CHECK constraint");
  const newTable = "tasks_status_migration_new";
  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.exec("BEGIN");
    try {
      db.exec(`DROP TABLE IF EXISTS ${newTable}`);
      db.exec(`
        CREATE TABLE ${newTable} (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          department_id TEXT REFERENCES departments(id),
          assigned_agent_id TEXT REFERENCES agents(id),
          project_id TEXT REFERENCES projects(id),
          status TEXT NOT NULL DEFAULT 'inbox'
            CHECK(status IN ('inbox','planned','collaborating','in_progress','review','done','cancelled','pending')),
          priority INTEGER DEFAULT 0,
          task_type TEXT DEFAULT 'general'
            CHECK(task_type IN ('general','development','design','analysis','presentation','documentation')),
          project_path TEXT,
          result TEXT,
          started_at INTEGER,
          completed_at INTEGER,
          created_at INTEGER DEFAULT (unixepoch()*1000),
          updated_at INTEGER DEFAULT (unixepoch()*1000),
          source_task_id TEXT
        );
      `);

      const cols = db.prepare(`PRAGMA table_info(tasks)`).all() as Array<{ name: string }>;
      const hasSourceTaskId = cols.some((c) => c.name === "source_task_id");
      const hasProjectId = cols.some((c) => c.name === "project_id");
      const sourceTaskIdExpr = hasSourceTaskId ? "source_task_id" : "NULL AS source_task_id";
      const projectIdExpr = hasProjectId ? "project_id" : "NULL AS project_id";
      db.exec(`
        INSERT INTO ${newTable} (
          id, title, description, department_id, assigned_agent_id,
          project_id, status, priority, task_type, project_path, result,
          started_at, completed_at, created_at, updated_at, source_task_id
        )
        SELECT
          id, title, description, department_id, assigned_agent_id,
          ${projectIdExpr},
          CASE
            WHEN status IN ('inbox','planned','collaborating','in_progress','review','done','cancelled','pending')
              THEN status
            ELSE 'inbox'
          END,
          priority, task_type, project_path, result,
          started_at, completed_at, created_at, updated_at, ${sourceTaskIdExpr}
        FROM tasks;
      `);

      db.exec("DROP TABLE tasks");
      db.exec(`ALTER TABLE ${newTable} RENAME TO tasks`);
      db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, updated_at DESC)");
      db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(assigned_agent_id)");
      db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_dept ON tasks(department_id)");
      db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id, updated_at DESC)");
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}

export function ensureMessagesIdempotencySchema(db: Database): void {
  try { db.exec("ALTER TABLE messages ADD COLUMN idempotency_key TEXT"); } catch { /* already exists */ }

  db.prepare(`
    UPDATE messages
    SET idempotency_key = NULL
    WHERE idempotency_key IS NOT NULL
      AND TRIM(idempotency_key) = ''
  `).run();

  const duplicateKeys = db.prepare(`
    SELECT idempotency_key
    FROM messages
    WHERE idempotency_key IS NOT NULL
    GROUP BY idempotency_key
    HAVING COUNT(*) > 1
  `).all() as Array<{ idempotency_key: string }>;

  for (const row of duplicateKeys) {
    const keep = db.prepare(`
      SELECT id
      FROM messages
      WHERE idempotency_key = ?
      ORDER BY created_at ASC, id ASC
      LIMIT 1
    `).get(row.idempotency_key) as { id: string } | undefined;
    if (!keep) continue;
    db.prepare(`
      UPDATE messages
      SET idempotency_key = NULL
      WHERE idempotency_key = ?
        AND id != ?
    `).run(row.idempotency_key, keep.id);
  }

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_idempotency_key
    ON messages(idempotency_key)
    WHERE idempotency_key IS NOT NULL
  `);
}
