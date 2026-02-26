// @ts-nocheck
/**
 * Core API: agents list, detail, patch, meeting-presence, CLI process inspection, and spawn.
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { SQLInputValue } from "./agents-helpers.ts";
import { registerCoreAgentsProcesses } from "./agents-processes.ts";

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function registerCoreAgents(ctx: RuntimeContext): void {
  const {
    app,
    db,
    broadcast,
    nowMs,
    notifyTaskStatus,
    taskExecutionSessions,
    activeProcesses,
    meetingPresenceUntil,
    meetingSeatIndexByAgent,
    meetingPhaseByAgent,
    meetingTaskIdByAgent,
    meetingReviewDecisionByAgent,
    killPidTree,
    stopRequestedTasks,
    stopRequestModeByTask,
    stopProgressTimer,
    endTaskExecutionSession,
    clearTaskWorkflowState,
    appendTaskLog,
    ensureTaskExecutionSession,
    buildAvailableSkillsPromptBlock,
    buildTaskExecutionPrompt,
    hasExplicitWarningFixRequest,
    getProviderModelConfig,
    getNextHttpAgentPid,
    launchApiProviderAgent,
    launchHttpAgent,
    spawnCliAgent,
    handleTaskRunComplete,
    resolveLang,
    l,
    pickL,
    logsDir,
  } = ctx;

  registerCoreAgentsProcesses(ctx);

  app.get("/api/agents", (_req, res) => {
    const agents = db.prepare(`
      SELECT a.*, d.name AS department_name, d.name_ko AS department_name_ko, d.color AS department_color
      FROM agents a
      LEFT JOIN departments d ON a.department_id = d.id
      ORDER BY a.department_id, a.role, a.name
    `).all();
    res.json({ agents });
  });

  app.get("/api/agents/:id", (req, res) => {
    const id = String(req.params.id);
    const agent = db.prepare(`
      SELECT a.*, d.name AS department_name, d.name_ko AS department_name_ko, d.color AS department_color
      FROM agents a
      LEFT JOIN departments d ON a.department_id = d.id
      WHERE a.id = ?
    `).get(id);
    if (!agent) return res.status(404).json({ error: "not_found" });

    // Include recent tasks
    const recentTasks = db.prepare(
      "SELECT * FROM tasks WHERE assigned_agent_id = ? ORDER BY updated_at DESC LIMIT 10"
    ).all(id);

    res.json({ agent, recent_tasks: recentTasks });
  });

  app.patch("/api/agents/:id", (req, res) => {
    const id = String(req.params.id);
    const existing = db.prepare("SELECT * FROM agents WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ error: "not_found" });

    const body = (req.body ?? {}) as Record<string, unknown>;
    const nextProviderRaw = ("cli_provider" in body ? body.cli_provider : existing.cli_provider) as string | null | undefined;
    const nextProvider = nextProviderRaw ?? "claude";
    const nextOAuthProvider = nextProvider === "copilot"
      ? "github"
      : nextProvider === "antigravity"
      ? "google_antigravity"
      : null;

    if (!nextOAuthProvider && !("oauth_account_id" in body) && ("cli_provider" in body)) {
      // Auto-clear pinned OAuth account when switching to non-OAuth provider.
      body.oauth_account_id = null;
    }
    if (nextProvider !== "api" && !("api_provider_id" in body) && ("cli_provider" in body)) {
      // Auto-clear API provider fields when switching to non-API provider.
      body.api_provider_id = null;
      body.api_model = null;
    }

    if ("oauth_account_id" in body) {
      if (body.oauth_account_id === "" || typeof body.oauth_account_id === "undefined") {
        body.oauth_account_id = null;
      }
      if (body.oauth_account_id !== null && typeof body.oauth_account_id !== "string") {
        return res.status(400).json({ error: "invalid_oauth_account_id" });
      }
      if (body.oauth_account_id && !nextOAuthProvider) {
        return res.status(400).json({ error: "oauth_account_requires_oauth_provider" });
      }
      if (body.oauth_account_id && nextOAuthProvider) {
        const oauthAccount = db.prepare(
          "SELECT id, status FROM oauth_accounts WHERE id = ? AND provider = ?"
        ).get(body.oauth_account_id, nextOAuthProvider) as { id: string; status: "active" | "disabled" } | undefined;
        if (!oauthAccount) {
          return res.status(400).json({ error: "oauth_account_not_found_for_provider" });
        }
        if (oauthAccount.status !== "active") {
          return res.status(400).json({ error: "oauth_account_disabled" });
        }
      }
    }

    const allowedFields = [
      "name", "name_ko", "name_ja", "name_zh", "department_id", "role", "cli_provider",
      "oauth_account_id", "api_provider_id", "api_model",
      "avatar_emoji", "personality", "status", "current_task_id",
      "sprite_number",
    ];

    const updates: string[] = [];
    const params: unknown[] = [];

    for (const field of allowedFields) {
      if (field in body) {
        updates.push(`${field} = ?`);
        params.push(body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "no_fields_to_update" });
    }

    params.push(id);
    db.prepare(`UPDATE agents SET ${updates.join(", ")} WHERE id = ?`).run(...(params as SQLInputValue[]));

    const updated = db.prepare("SELECT * FROM agents WHERE id = ?").get(id);
    broadcast("agent_status", updated);
    res.json({ ok: true, agent: updated });
  });

  // ---- Create agent ----
  app.post("/api/agents", (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = body.name;
    const department_idRaw = body.department_id;
    const role = body.role;

    if (!name || typeof name !== "string") return res.status(400).json({ error: "name_required" });
    if (!role || typeof role !== "string") return res.status(400).json({ error: "role_required" });

    // department_id optional: 미배정(휴게실) 시 null
    const department_id =
      typeof department_idRaw === "string" && department_idRaw.trim() !== ""
        ? department_idRaw.trim()
        : null;
    if (department_id !== null) {
      const dept = db.prepare("SELECT id FROM departments WHERE id = ?").get(department_id);
      if (!dept) return res.status(400).json({ error: "department_not_found" });
    }

    const validRoles = ["team_leader", "senior", "junior", "intern"];
    if (!validRoles.includes(role)) return res.status(400).json({ error: "invalid_role", valid: validRoles });

    const id = randomUUID();
    const name_ko = (typeof body.name_ko === "string" ? body.name_ko : name) as string;
    const name_ja = (typeof body.name_ja === "string" ? body.name_ja : null) as string | null;
    const name_zh = (typeof body.name_zh === "string" ? body.name_zh : null) as string | null;
    const cli_provider = (typeof body.cli_provider === "string" ? body.cli_provider : null) as string | null;
    const avatar_emoji = (typeof body.avatar_emoji === "string" ? body.avatar_emoji : "\u{1F916}") as string;
    const personality = (typeof body.personality === "string" ? body.personality : null) as string | null;
    const sprite_number = (typeof body.sprite_number === "number" ? body.sprite_number : 1) as number;

    db.prepare(`
      INSERT INTO agents (id, name, name_ko, name_ja, name_zh, department_id, role, cli_provider, avatar_emoji, personality, sprite_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, name_ko, name_ja, name_zh, department_id, role, cli_provider, avatar_emoji, personality, sprite_number);

    const newAgent = db.prepare(`
      SELECT a.*, d.name AS department_name, d.name_ko AS department_name_ko, d.color AS department_color
      FROM agents a LEFT JOIN departments d ON a.department_id = d.id
      WHERE a.id = ?
    `).get(id);

    broadcast("agent_created", newAgent);
    res.json({ ok: true, agent: newAgent });
  });

  // ---- Delete agent ----
  app.delete("/api/agents/:id", (req, res) => {
    const id = String(req.params.id);
    const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!agent) return res.status(404).json({ error: "not_found" });

    if (agent.status === "working") {
      return res.status(400).json({ error: "agent_is_working", message: "Cannot delete an agent that is currently working." });
    }

    // Cascade NULL references
    db.prepare("UPDATE tasks SET assigned_agent_id = NULL WHERE assigned_agent_id = ?").run(id);
    db.prepare("UPDATE subtasks SET assigned_agent_id = NULL WHERE assigned_agent_id = ?").run(id);
    db.prepare("UPDATE meeting_minute_entries SET speaker_agent_id = NULL WHERE speaker_agent_id = ?").run(id);
    db.prepare("UPDATE task_report_archives SET generated_by_agent_id = NULL WHERE generated_by_agent_id = ?").run(id);
    db.prepare("UPDATE project_review_decision_states SET planner_agent_id = NULL WHERE planner_agent_id = ?").run(id);
    db.prepare("DELETE FROM project_agents WHERE agent_id = ?").run(id);
    db.prepare("DELETE FROM agents WHERE id = ?").run(id);

    broadcast("agent_deleted", { id });
    res.json({ ok: true });
  });

  app.post("/api/agents/:id/spawn", (req, res) => {
    const id = String(req.params.id);
    const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(id) as {
      id: string;
      name: string;
      cli_provider: string | null;
      oauth_account_id: string | null;
      api_provider_id: string | null;
      api_model: string | null;
      current_task_id: string | null;
      status: string;
    } | undefined;
    if (!agent) return res.status(404).json({ error: "not_found" });

    const provider = agent.cli_provider || "claude";
    if (!["claude", "codex", "gemini", "opencode", "copilot", "antigravity", "api"].includes(provider)) {
      return res.status(400).json({ error: "unsupported_provider", provider });
    }

    const taskId = agent.current_task_id;
    if (!taskId) {
      return res.status(400).json({ error: "no_task_assigned", message: "Assign a task to this agent first." });
    }

    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as {
      id: string;
      title: string;
      description: string | null;
      project_path: string | null;
    } | undefined;
    if (!task) {
      return res.status(400).json({ error: "task_not_found" });
    }
    const taskLang = resolveLang(task.description ?? task.title);

    const projectPath = task.project_path || process.cwd();
    const logPath = path.join(logsDir, `${taskId}.log`);
    const executionSession = ensureTaskExecutionSession(taskId, agent.id, provider);
    const availableSkillsPromptBlock = buildAvailableSkillsPromptBlock(provider);

    const prompt = buildTaskExecutionPrompt([
      availableSkillsPromptBlock,
      `[Task Session] id=${executionSession.sessionId} owner=${executionSession.agentId} provider=${executionSession.provider}`,
      "This session is scoped to this task only.",
      `[Task] ${task.title}`,
      task.description ? `\n${task.description}` : "",
      pickL(l(
        ["위 작업을 충분히 완수하세요."],
        ["Please complete the task above thoroughly."],
        ["上記タスクを丁寧に完了してください。"],
        ["请完整地完成上述任务。"],
      ), taskLang),
    ], {
      allowWarningFix: hasExplicitWarningFixRequest(task.title, task.description),
    });

    appendTaskLog(taskId, "system", `RUN start (agent=${agent.name}, provider=${provider})`);

    const spawnModelConfig = getProviderModelConfig();
    const spawnModel = spawnModelConfig[provider]?.model || undefined;
    const spawnReasoningLevel = spawnModelConfig[provider]?.reasoningLevel || undefined;

    if (provider === "api") {
      const controller = new AbortController();
      const fakePid = getNextHttpAgentPid();
      db.prepare("UPDATE agents SET status = 'working' WHERE id = ?").run(id);
      db.prepare("UPDATE tasks SET status = 'in_progress', started_at = ?, updated_at = ? WHERE id = ?")
        .run(nowMs(), nowMs(), taskId);
      const updatedAgent = db.prepare("SELECT * FROM agents WHERE id = ?").get(id);
      broadcast("agent_status", updatedAgent);
      broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId));
      notifyTaskStatus(taskId, task.title, "in_progress", taskLang);
      launchApiProviderAgent(taskId, agent.api_provider_id ?? null, agent.api_model ?? null, prompt, projectPath, logPath, controller, fakePid);
      return res.json({ ok: true, pid: fakePid, logPath, cwd: projectPath });
    }

    if (provider === "copilot" || provider === "antigravity") {
      const controller = new AbortController();
      const fakePid = getNextHttpAgentPid();
      // Update agent status before launching
      db.prepare("UPDATE agents SET status = 'working' WHERE id = ?").run(id);
      db.prepare("UPDATE tasks SET status = 'in_progress', started_at = ?, updated_at = ? WHERE id = ?")
        .run(nowMs(), nowMs(), taskId);
      const updatedAgent = db.prepare("SELECT * FROM agents WHERE id = ?").get(id);
      broadcast("agent_status", updatedAgent);
      broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId));
      notifyTaskStatus(taskId, task.title, "in_progress", taskLang);
      launchHttpAgent(taskId, provider, prompt, projectPath, logPath, controller, fakePid, agent.oauth_account_id ?? null);
      return res.json({ ok: true, pid: fakePid, logPath, cwd: projectPath });
    }

    const child = spawnCliAgent(taskId, provider, prompt, projectPath, logPath, spawnModel, spawnReasoningLevel);

    child.on("close", (code) => {
      handleTaskRunComplete(taskId, code ?? 1);
    });

    // Update agent status
    db.prepare("UPDATE agents SET status = 'working' WHERE id = ?").run(id);
    db.prepare("UPDATE tasks SET status = 'in_progress', started_at = ?, updated_at = ? WHERE id = ?")
      .run(nowMs(), nowMs(), taskId);

    const updatedAgent = db.prepare("SELECT * FROM agents WHERE id = ?").get(id);
    broadcast("agent_status", updatedAgent);
    broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId));
    notifyTaskStatus(taskId, task.title, "in_progress", taskLang);

    res.json({ ok: true, pid: child.pid ?? null, logPath, cwd: projectPath });
  });
}
