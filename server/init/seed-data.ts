// @ts-nocheck
import { randomUUID } from "node:crypto";
import type { Database } from "better-sqlite3";

export function seedDefaultData(db: Database): void {
  const deptCount = (db.prepare("SELECT COUNT(*) as cnt FROM departments").get() as { cnt: number }).cnt;

  if (deptCount === 0) {
    const insertDept = db.prepare(
      "INSERT INTO departments (id, name, name_ko, icon, color, sort_order) VALUES (?, ?, ?, ?, ?, ?)"
    );
    // Workflow order: 기획 → 개발 → 디자인 → QA → 인프라보안 → 운영
    insertDept.run("planning",  "Planning",    "기획팀",     "📊", "#f59e0b", 1);
    insertDept.run("dev",       "Development", "개발팀",     "💻", "#3b82f6", 2);
    insertDept.run("design",    "Design",      "디자인팀",   "🎨", "#8b5cf6", 3);
    insertDept.run("qa",        "QA/QC",       "품질관리팀", "🔍", "#ef4444", 4);
    insertDept.run("devsecops", "DevSecOps",   "인프라보안팀","🛡️", "#f97316", 5);
    insertDept.run("operations","Operations",  "운영팀",     "⚙️", "#10b981", 6);
    console.log("[HyperClaw] Seeded default departments");
  }

  const agentCount = (db.prepare("SELECT COUNT(*) as cnt FROM agents").get() as { cnt: number }).cnt;

  if (agentCount === 0) {
    const insertAgent = db.prepare(
      `INSERT INTO agents (id, name, name_ko, department_id, role, cli_provider, avatar_emoji, personality)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    // Development (3) — 유명 엔지니어
    insertAgent.run(randomUUID(), "Andrej Karpathy", "카파시",   "dev",        "team_leader", "claude",   "👩‍💻", "AI·딥러닝 리더");
    insertAgent.run(randomUUID(), "Linus Torvalds",  "리누스",   "dev",        "senior",      "codex",    "⚡",   "Linux 창시자");
    insertAgent.run(randomUUID(), "Steve Wozniak",  "워즈니악", "dev",        "junior",      "copilot",  "🌟",   "애플 공동창업자·개발자");
    // Design (2) — 유명 디자이너
    insertAgent.run(randomUUID(), "Steve Jobs",     "잡스",     "design",     "team_leader", "claude",   "🎨",   "애플 공동창업자");
    insertAgent.run(randomUUID(), "Jony Ive",       "조니 아이브","design",    "junior",      "gemini",   "🌙",   "애플 전 수석 디자이너");
    // Planning (2)
    insertAgent.run(randomUUID(), "Elon Musk",      "머스크",   "planning",  "team_leader", "codex",    "🧠",   "테슬라·스페이스X CEO");
    insertAgent.run(randomUUID(), "Peter Thiel",   "피터 틸",  "planning",  "senior",      "claude",   "📝",   "페이팔 공동창업자·벤처투자자");
    // Operations (2)
    insertAgent.run(randomUUID(), "Jeff Bezos",     "베조스",   "operations", "team_leader", "claude",   "🗺️",  "아마존 창업자");
    insertAgent.run(randomUUID(), "Demis Hassabis", "데미스 허사비스","operations","senior", "codex",    "🚀",   "DeepMind 공동창업자");
    // QA/QC (2)
    insertAgent.run(randomUUID(), "Kent Beck",      "켄트 벡",   "qa",         "team_leader", "claude",   "🦅",   "TDD·eXtreme Programming");
    insertAgent.run(randomUUID(), "Sam Altman",     "샘 알트먼", "qa",         "senior",      "codex",    "🔬",   "OpenAI CEO");
    // DevSecOps (2)
    insertAgent.run(randomUUID(), "Dario Amodei",   "다리오 아모데이","devsecops","team_leader", "claude",   "🛡️",  "Anthropic 공동창업자");
    insertAgent.run(randomUUID(), "Adam Jacob",     "아담 제이콥","devsecops", "senior",      "codex",    "🔧",   "Chef·DevOps");
    console.log("[HyperClaw] Seeded default agents");
  }
}

/** 기존 시드 에이전트(구 이름)를 유명 엔지니어/디자이너 이름으로 한 번만 갱신 */
export function migrateAgentNamesToFamous(db: Database): void {
  const updates: [oldName: string, newName: string, newNameKo: string, personality: string][] = [
    ["Aria", "Andrej Karpathy", "카파시", "AI·딥러닝 리더"],
    ["Bolt", "Linus Torvalds", "리누스", "Linux 창시자"],
    ["Nova", "Steve Wozniak", "워즈니악", "애플 공동창업자·개발자"],
    ["Pixel", "Steve Jobs", "잡스", "애플 공동창업자"],
    ["Luna", "Jony Ive", "조니 아이브", "애플 전 수석 디자이너"],
    ["Sage", "Elon Musk", "머스크", "테슬라·스페이스X CEO"],
    ["Clio", "Peter Thiel", "피터 틸", "페이팔 공동창업자·벤처투자자"],
    ["Atlas", "Jeff Bezos", "베조스", "아마존 창업자"],
    ["Turbo", "Demis Hassabis", "데미스 허사비스", "DeepMind 공동창업자"],
    ["Hawk", "Kent Beck", "켄트 벡", "TDD·eXtreme Programming"],
    ["Lint", "Sam Altman", "샘 알트먼", "OpenAI CEO"],
    ["Vault", "Dario Amodei", "다리오 아모데이", "Anthropic 공동창업자"],
    ["Pipe", "Adam Jacob", "아담 제이콥", "Chef·DevOps"],
  ];
  const updateStmt = db.prepare(
    "UPDATE agents SET name = ?, name_ko = ?, personality = ? WHERE name = ?"
  );
  let n = 0;
  for (const [oldName, newName, newNameKo, personality] of updates) {
    const info = updateStmt.run(newName, newNameKo, personality, oldName);
    if (info.changes > 0) n += info.changes;
  }
  // 이미 이전 마이그레이션으로 바뀐 이름을 최신 인물로 한 번 더 갱신
  const renames: [oldName: string, newName: string, newNameKo: string, personality: string][] = [
    ["Mitchell Hashimoto", "Demis Hassabis", "데미스 허사비스", "DeepMind 공동창업자"],
    ["Lisa Crispin", "Sam Altman", "샘 알트먼", "OpenAI CEO"],
    ["Dan Kaminsky", "Dario Amodei", "다리오 아모데이", "Anthropic 공동창업자"],
    ["Melissa Perri", "Peter Thiel", "피터 틸", "페이팔 공동창업자·벤처투자자"],
    ["Marty Cagan", "Elon Musk", "머스크", "테슬라·스페이스X CEO"],
  ];
  for (const [oldName, newName, newNameKo, personality] of renames) {
    const info = updateStmt.run(newName, newNameKo, personality, oldName);
    if (info.changes > 0) n += info.changes;
  }
  if (n > 0) console.log(`[HyperClaw] Migrated ${n} agent name(s) to famous engineers/designers`);
}

/** (name, department_id, role) 동일한 에이전트 중복 제거 — 한 명만 남기고 나머지는 삭제, 태스크 등은 남는 에이전트로 이관 */
export function removeDuplicateAgents(db: Database): void {
  const rows = db.prepare(
    `SELECT id, name, department_id, role, created_at FROM agents ORDER BY name, department_id, role, created_at ASC`
  ).all() as { id: string; name: string; department_id: string | null; role: string; created_at: number }[];

  const key = (r: { name: string; department_id: string | null; role: string }) =>
    `${r.name}\t${r.department_id ?? ""}\t${r.role}`;
  const byKey = new Map<string, { id: string; created_at: number }[]>();
  for (const r of rows) {
    const k = key(r);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push({ id: r.id, created_at: r.created_at });
  }

  const updateTasks = db.prepare("UPDATE tasks SET assigned_agent_id = ? WHERE assigned_agent_id = ?");
  const updateSubtasks = db.prepare("UPDATE subtasks SET assigned_agent_id = ? WHERE assigned_agent_id = ?");
  const updateMinutes = db.prepare("UPDATE meeting_minute_entries SET speaker_agent_id = ? WHERE speaker_agent_id = ?");
  const updateReports = db.prepare("UPDATE task_report_archives SET generated_by_agent_id = ? WHERE generated_by_agent_id = ?");
  const updateReviewStates = db.prepare("UPDATE project_review_decision_states SET planner_agent_id = ? WHERE planner_agent_id = ?");
  const deleteProjectAgents = db.prepare("DELETE FROM project_agents WHERE agent_id = ?");
  const deleteAgent = db.prepare("DELETE FROM agents WHERE id = ?");

  let removed = 0;
  for (const [, ids] of byKey) {
    if (ids.length <= 1) continue;
    ids.sort((a, b) => a.created_at - b.created_at);
    const [keepId, ...duplicateIds] = ids.map((x) => x.id);
    for (const dupId of duplicateIds) {
      updateTasks.run(keepId, dupId);
      updateSubtasks.run(keepId, dupId);
      updateMinutes.run(keepId, dupId);
      updateReports.run(keepId, dupId);
      updateReviewStates.run(keepId, dupId);
      deleteProjectAgents.run(dupId);
      deleteAgent.run(dupId);
      removed++;
    }
  }
  if (removed > 0) console.log(`[HyperClaw] Removed ${removed} duplicate agent(s)`);
}

export function seedDefaultSettings(db: Database): void {
  const defaultRoomThemes = {
    ceoOffice:  { accent: 0xa77d0c, floor1: 0xe5d9b9, floor2: 0xdfd0a8, wall: 0x998243 },
    planning:   { accent: 0xd4a85a, floor1: 0xf0e1c5, floor2: 0xeddaba, wall: 0xae9871 },
    dev:        { accent: 0x5a9fd4, floor1: 0xd8e8f5, floor2: 0xcce1f2, wall: 0x6c96b7 },
    design:     { accent: 0x9a6fc4, floor1: 0xe8def2, floor2: 0xe1d4ee, wall: 0x9378ad },
    qa:         { accent: 0xd46a6a, floor1: 0xf0cbcb, floor2: 0xedc0c0, wall: 0xae7979 },
    devsecops:  { accent: 0xd4885a, floor1: 0xf0d5c5, floor2: 0xedcdba, wall: 0xae8871 },
    operations: { accent: 0x5ac48a, floor1: 0xd0eede, floor2: 0xc4ead5, wall: 0x6eaa89 },
    breakRoom:  { accent: 0xf0c878, floor1: 0xf7e2b7, floor2: 0xf6dead, wall: 0xa99c83 },
  };

  const settingsCount = (db.prepare("SELECT COUNT(*) as c FROM settings").get() as { c: number }).c;
  const isLegacySettingsInstall = settingsCount > 0;
  if (settingsCount === 0) {
    const insertSetting = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
    insertSetting.run("companyName", "HyperClaw");
    insertSetting.run("ceoName", "CEO");
    insertSetting.run("autoAssign", "true");
    insertSetting.run("autoUpdateEnabled", "false");
    insertSetting.run("autoUpdateNoticePending", "false");
    insertSetting.run("oauthAutoSwap", "true");
    insertSetting.run("language", "en");
    insertSetting.run("defaultProvider", "claude");
    insertSetting.run("providerModelConfig", JSON.stringify({
      claude:      { model: "claude-opus-4-6", subModel: "claude-sonnet-4-6" },
      codex:       { model: "gpt-5.3-codex", reasoningLevel: "xhigh", subModel: "gpt-5.3-codex", subModelReasoningLevel: "high" },
      gemini:      { model: "gemini-3-pro-preview" },
      opencode:    { model: "github-copilot/claude-sonnet-4.6" },
      copilot:     { model: "github-copilot/claude-sonnet-4.6" },
      antigravity: { model: "google/antigravity-gemini-3-pro" },
    }));
    insertSetting.run("roomThemes", JSON.stringify(defaultRoomThemes));
    console.log("[HyperClaw] Seeded default settings");
  }

  const hasLanguageSetting = db
    .prepare("SELECT 1 FROM settings WHERE key = 'language' LIMIT 1")
    .get() as { 1: number } | undefined;
  if (!hasLanguageSetting) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("language", "en");
  }

  const hasOAuthAutoSwapSetting = db
    .prepare("SELECT 1 FROM settings WHERE key = 'oauthAutoSwap' LIMIT 1")
    .get() as { 1: number } | undefined;
  if (!hasOAuthAutoSwapSetting) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("oauthAutoSwap", "true");
  }

  const hasAutoUpdateEnabledSetting = db
    .prepare("SELECT 1 FROM settings WHERE key = 'autoUpdateEnabled' LIMIT 1")
    .get() as { 1: number } | undefined;
  if (!hasAutoUpdateEnabledSetting) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("autoUpdateEnabled", "false");
  }

  const hasAutoUpdateNoticePendingSetting = db
    .prepare("SELECT 1 FROM settings WHERE key = 'autoUpdateNoticePending' LIMIT 1")
    .get() as { 1: number } | undefined;
  if (!hasAutoUpdateNoticePendingSetting) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)")
      .run("autoUpdateNoticePending", isLegacySettingsInstall ? "true" : "false");
  }

  const hasRoomThemesSetting = db
    .prepare("SELECT 1 FROM settings WHERE key = 'roomThemes' LIMIT 1")
    .get() as { 1: number } | undefined;
  if (!hasRoomThemesSetting) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)")
      .run("roomThemes", JSON.stringify(defaultRoomThemes));
  }
}

export function seedDepartmentOrderAndAgents(db: Database): void {
  try { db.exec("ALTER TABLE departments ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 99"); } catch { /* already exists */ }

  const DEPT_ORDER: Record<string, number> = { planning: 1, dev: 2, design: 3, qa: 4, devsecops: 5, operations: 6 };
  const updateOrder = db.prepare("UPDATE departments SET sort_order = ? WHERE id = ?");
  for (const [id, order] of Object.entries(DEPT_ORDER)) {
    updateOrder.run(order, id);
  }

  const insertDeptIfMissing = db.prepare(
    "INSERT OR IGNORE INTO departments (id, name, name_ko, icon, color, sort_order) VALUES (?, ?, ?, ?, ?, ?)"
  );
  insertDeptIfMissing.run("qa", "QA/QC", "품질관리팀", "🔍", "#ef4444", 4);
  insertDeptIfMissing.run("devsecops", "DevSecOps", "인프라보안팀", "🛡️", "#f97316", 5);

  const insertAgentIfMissing = db.prepare(
    `INSERT OR IGNORE INTO agents (id, name, name_ko, department_id, role, cli_provider, avatar_emoji, personality)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const existingNames = new Set(
    (db.prepare("SELECT name FROM agents").all() as { name: string }[]).map((r) => r.name)
  );

  const newAgents: [string, string, string, string, string, string, string][] = [
    ["Jony Ive",       "조니 아이브",   "design",     "junior",      "gemini",   "🌙",  "애플 전 수석 디자이너"],
    ["Peter Thiel",    "피터 틸",     "planning",   "senior",      "claude",   "📝",  "페이팔 공동창업자·벤처투자자"],
    ["Demis Hassabis", "데미스 허사비스", "operations", "senior",    "codex",    "🚀",  "DeepMind 공동창업자"],
    ["Kent Beck",      "켄트 벡",     "qa",         "team_leader", "claude",   "🦅",  "TDD·eXtreme Programming"],
    ["Sam Altman",     "샘 알트먼",   "qa",         "senior",      "opencode", "🔬",  "OpenAI CEO"],
    ["Dario Amodei",   "다리오 아모데이","devsecops", "team_leader", "claude",   "🛡️", "Anthropic 공동창업자"],
    ["Adam Jacob",     "아담 제이콥",  "devsecops",  "senior",      "codex",    "🔧",  "Chef·DevOps"],
  ];

  let added = 0;
  for (const [name, nameKo, dept, role, provider, emoji, personality] of newAgents) {
    if (!existingNames.has(name)) {
      insertAgentIfMissing.run(randomUUID(), name, nameKo, dept, role, provider, emoji, personality);
      added++;
    }
  }
  if (added > 0) console.log(`[HyperClaw] Added ${added} new agents`);
}
