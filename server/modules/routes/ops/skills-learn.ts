// @ts-nocheck
/**
 * Skill learn jobs, history, available, unlearn (npx skills add/remove).
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  type SkillLearnProvider,
  type SkillHistoryProvider,
  type SkillLearnStatus,
  type SkillLearnJob,
  SKILL_LEARN_PROVIDER_TO_AGENT,
  SKILL_HISTORY_PROVIDER_TO_AGENT,
  SKILL_LEARN_REPO_RE,
  SKILL_LEARN_MAX_LOG_LINES,
  SKILL_LEARN_JOB_TTL_MS,
  SKILL_LEARN_MAX_JOBS,
  SKILL_LEARN_HISTORY_RETENTION_DAYS,
  SKILL_LEARN_HISTORY_RETENTION_MS,
  SKILL_LEARN_HISTORY_MAX_ROWS_PER_PROVIDER,
  SKILL_LEARN_HISTORY_MAX_QUERY_LIMIT,
  SKILL_UNLEARN_TIMEOUT_MS,
  SKILLS_NPX_CMD,
  isSkillLearnProvider,
  isSkillHistoryProvider,
  normalizeSkillLearnProviders,
  normalizeSkillLearnStatus,
  normalizeSkillLearnSkillId,
  runSkillUnlearnForProvider,
} from "./skills-learn-helpers.ts";

export function registerOpsSkillsLearn(ctx: RuntimeContext): void {
  const { app, db, execWithTimeout } = ctx;
  const skillLearnJobs = new Map<string, SkillLearnJob>();

  function buildSkillLearnLabel(repo: string, skillId: string): string {
    return skillId ? `${repo}#${skillId}` : repo;
  }

  function pruneSkillLearnJobs(now = Date.now()): void {
    if (skillLearnJobs.size === 0) return;
    for (const [id, job] of skillLearnJobs.entries()) {
      const end = job.completedAt ?? job.updatedAt;
      if (job.status !== "running" && now - end > SKILL_LEARN_JOB_TTL_MS) skillLearnJobs.delete(id);
    }
    if (skillLearnJobs.size <= SKILL_LEARN_MAX_JOBS) return;
    const oldest = [...skillLearnJobs.values()]
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .slice(0, Math.max(0, skillLearnJobs.size - SKILL_LEARN_MAX_JOBS));
    for (const job of oldest) {
      if (job.status !== "running") skillLearnJobs.delete(job.id);
    }
  }

  function pruneSkillLearningHistory(now = Date.now()): void {
    db.prepare(`
      DELETE FROM skill_learning_history
      WHERE COALESCE(run_completed_at, updated_at, created_at) < ?
    `).run(now - SKILL_LEARN_HISTORY_RETENTION_MS);
    const overflowProviders = db.prepare(`
      SELECT provider, COUNT(*) AS cnt FROM skill_learning_history
      GROUP BY provider HAVING COUNT(*) > ?
    `).all(SKILL_LEARN_HISTORY_MAX_ROWS_PER_PROVIDER) as Array<{ provider: string; cnt: number }>;
    if (overflowProviders.length === 0) return;
    const trimStmt = db.prepare(`
      DELETE FROM skill_learning_history WHERE provider = ? AND id IN (
        SELECT id FROM skill_learning_history WHERE provider = ?
        ORDER BY updated_at DESC, created_at DESC LIMIT -1 OFFSET ?
      )
    `);
    for (const row of overflowProviders) {
      trimStmt.run(row.provider, row.provider, SKILL_LEARN_HISTORY_MAX_ROWS_PER_PROVIDER);
    }
  }

  function recordSkillLearnHistoryState(
    job: SkillLearnJob,
    status: SkillLearnStatus,
    opts: { error?: string | null; startedAt?: number | null; completedAt?: number | null } = {},
  ): void {
    const now = Date.now();
    const normalizedSkillId = normalizeSkillLearnSkillId(job.skillId, job.repo);
    const skillLabel = buildSkillLearnLabel(job.repo, normalizedSkillId);
    const upsert = db.prepare(`
      INSERT INTO skill_learning_history (id, job_id, provider, repo, skill_id, skill_label, status, command, error, run_started_at, run_completed_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(job_id, provider) DO UPDATE SET repo = excluded.repo, skill_id = excluded.skill_id, skill_label = excluded.skill_label, status = excluded.status, command = excluded.command, error = excluded.error, run_started_at = COALESCE(excluded.run_started_at, skill_learning_history.run_started_at), run_completed_at = COALESCE(excluded.run_completed_at, skill_learning_history.run_completed_at), updated_at = excluded.updated_at
    `);
    for (const provider of job.providers) {
      upsert.run(randomUUID(), job.id, provider, job.repo, normalizedSkillId, skillLabel, status, job.command, opts.error ?? null, opts.startedAt ?? null, opts.completedAt ?? null, now, now);
    }
    pruneSkillLearningHistory(now);
  }

  function appendSkillLearnLogs(job: SkillLearnJob, chunk: string): void {
    for (const rawLine of chunk.split(/\r?\n/)) {
      const line = rawLine.trimEnd();
      if (line) job.logTail.push(line);
    }
    if (job.logTail.length > SKILL_LEARN_MAX_LOG_LINES) job.logTail.splice(0, job.logTail.length - SKILL_LEARN_MAX_LOG_LINES);
    job.updatedAt = Date.now();
  }

  function createSkillLearnJob(repo: string, skillId: string, providers: SkillLearnProvider[]): SkillLearnJob {
    const id = randomUUID();
    const normalizedSkillId = normalizeSkillLearnSkillId(skillId, repo);
    const agents = providers.map((p) => SKILL_LEARN_PROVIDER_TO_AGENT[p]).filter((v, i, arr) => arr.indexOf(v) === i);
    const args = ["--yes", "skills@latest", "add", repo, "--yes", "--agent", ...agents];
    const job: SkillLearnJob = {
      id, repo, skillId: normalizedSkillId, providers, agents,
      status: "queued",
      command: `npx ${args.join(" ")}`,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      updatedAt: Date.now(),
      exitCode: null,
      logTail: [],
      error: null,
    };
    skillLearnJobs.set(id, job);
    try { recordSkillLearnHistoryState(job, "queued"); } catch (err) { console.warn(`[skills.learn] record queued: ${String(err)}`); }

    setTimeout(() => {
      job.status = "running";
      job.startedAt = Date.now();
      job.updatedAt = job.startedAt;
      try { recordSkillLearnHistoryState(job, "running", { startedAt: job.startedAt }); } catch (e) { console.warn(`[skills.learn] record running: ${String(e)}`); }
      let child: ReturnType<typeof spawn>;
      try {
        child = spawn(SKILLS_NPX_CMD, args, {
          cwd: process.cwd(),
          env: { ...process.env, FORCE_COLOR: "0" },
          stdio: ["ignore", "pipe", "pipe"],
          shell: process.platform === "win32",
        });
      } catch (err) {
        job.status = "failed";
        job.error = err instanceof Error ? err.message : String(err);
        job.completedAt = Date.now();
        job.updatedAt = job.completedAt;
        appendSkillLearnLogs(job, `ERROR: ${job.error}`);
        try { recordSkillLearnHistoryState(job, "failed", { error: job.error, startedAt: job.startedAt, completedAt: job.completedAt }); } catch (_) {}
        pruneSkillLearnJobs();
        return;
      }
      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      child.stdout?.on("data", (chunk: string | Buffer) => appendSkillLearnLogs(job, String(chunk)));
      child.stderr?.on("data", (chunk: string | Buffer) => appendSkillLearnLogs(job, String(chunk)));
      child.on("error", (err: Error) => {
        job.status = "failed";
        job.error = err.message || String(err);
        job.completedAt = Date.now();
        job.updatedAt = job.completedAt;
        appendSkillLearnLogs(job, `ERROR: ${job.error}`);
        try { recordSkillLearnHistoryState(job, "failed", { error: job.error, startedAt: job.startedAt, completedAt: job.completedAt }); } catch (_) {}
        pruneSkillLearnJobs();
      });
      child.on("close", (code: number | null, signal: string | null) => {
        job.exitCode = code;
        job.completedAt = Date.now();
        job.updatedAt = job.completedAt;
        job.status = code === 0 ? "succeeded" : "failed";
        job.error = code === 0 ? null : (signal ? `process terminated by ${signal}` : `process exited with code ${String(code)}`);
        try { recordSkillLearnHistoryState(job, job.status, { error: job.error, startedAt: job.startedAt, completedAt: job.completedAt }); } catch (_) {}
        pruneSkillLearnJobs();
      });
    }, 0);
    return job;
  }

  app.post("/api/skills/learn", (req: any, res: any) => {
    pruneSkillLearnJobs();
    const repo = String(req.body?.repo ?? "").trim();
    const skillId = String(req.body?.skillId ?? "").trim();
    const providers = normalizeSkillLearnProviders(req.body?.providers);
    if (!repo) return res.status(400).json({ error: "repo required" });
    if (!SKILL_LEARN_REPO_RE.test(repo)) return res.status(400).json({ error: "invalid repo format" });
    if (providers.length === 0) return res.status(400).json({ error: "providers required" });
    const job = createSkillLearnJob(repo, skillId, providers);
    res.status(202).json({ ok: true, job });
  });

  app.get("/api/skills/learn/:jobId", (req: any, res: any) => {
    pruneSkillLearnJobs();
    const jobId = String(req.params.jobId ?? "").trim();
    const job = skillLearnJobs.get(jobId);
    if (!job) return res.status(404).json({ error: "job_not_found" });
    res.json({ ok: true, job });
  });

  app.get("/api/skills/history", (req: any, res: any) => {
    pruneSkillLearningHistory();
    const rawProvider = String(req.query.provider ?? "").trim().toLowerCase();
    const provider = rawProvider ? (isSkillHistoryProvider(rawProvider) ? rawProvider : null) : null;
    if (rawProvider && !provider) return res.status(400).json({ error: "invalid provider" });
    const rawStatus = String(req.query.status ?? "").trim().toLowerCase();
    const status = rawStatus ? normalizeSkillLearnStatus(rawStatus) : null;
    if (rawStatus && !status) return res.status(400).json({ error: "invalid status" });
    const requestedLimit = Number.parseInt(String(req.query.limit ?? ""), 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), SKILL_LEARN_HISTORY_MAX_QUERY_LIMIT) : 50;
    const where: string[] = [];
    const params: Array<string | number> = [];
    if (provider) { where.push("provider = ?"); params.push(provider); }
    if (status) { where.push("status = ?"); params.push(status); }
    params.push(limit);
    const sql = `
      SELECT id, job_id, provider, repo, skill_id, skill_label, status, command, error, run_started_at, run_completed_at, created_at, updated_at
      FROM skill_learning_history
      ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY updated_at DESC, created_at DESC LIMIT ?
    `;
    const history = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
    res.json({ ok: true, retention_days: SKILL_LEARN_HISTORY_RETENTION_DAYS, history });
  });

  app.get("/api/skills/available", (req: any, res: any) => {
    pruneSkillLearningHistory();
    const rawProvider = String(req.query.provider ?? "").trim().toLowerCase();
    const provider = rawProvider ? (isSkillHistoryProvider(rawProvider) ? rawProvider : null) : null;
    if (rawProvider && !provider) return res.status(400).json({ error: "invalid provider" });
    const requestedLimit = Number.parseInt(String(req.query.limit ?? ""), 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), SKILL_LEARN_HISTORY_MAX_QUERY_LIMIT) : 30;
    const params: Array<string | number> = [];
    let whereClause = "status = 'succeeded'";
    if (provider) { whereClause += " AND provider = ?"; params.push(provider); }
    params.push(limit);
    const skills = db.prepare(`
      SELECT provider, repo, skill_id, skill_label, MAX(COALESCE(run_completed_at, updated_at, created_at)) AS learned_at
      FROM skill_learning_history WHERE ${whereClause}
      GROUP BY provider, repo, skill_id, skill_label ORDER BY learned_at DESC LIMIT ?
    `).all(...params) as Array<Record<string, unknown>>;
    res.json({ ok: true, skills });
  });

  app.post("/api/skills/unlearn", async (req: any, res: any) => {
    pruneSkillLearningHistory();
    const rawProvider = String(req.body?.provider ?? "").trim().toLowerCase();
    const provider = isSkillHistoryProvider(rawProvider) ? rawProvider : null;
    if (!provider) return res.status(400).json({ error: "invalid provider" });
    const repo = String(req.body?.repo ?? "").trim();
    if (!repo || !SKILL_LEARN_REPO_RE.test(repo)) return res.status(400).json({ error: "invalid repo format" });
    const inputSkillId = String(req.body?.skillId ?? req.body?.skill_id ?? "").trim();
    const skillId = normalizeSkillLearnSkillId(inputSkillId, repo);
    const cliResult = await runSkillUnlearnForProvider(execWithTimeout, provider, repo, skillId);
    if (!cliResult.ok) {
      return res.status(409).json({
        error: cliResult.message || "cli_unlearn_failed",
        code: "cli_unlearn_failed",
        provider,
        repo,
        skill_id: skillId,
        agent: cliResult.agent,
        attempts: cliResult.attempts,
      });
    }
    const removed = db.prepare(`
      DELETE FROM skill_learning_history
      WHERE provider = ? AND repo = ? AND skill_id = ? AND status = 'succeeded'
    `).run(provider, repo, skillId).changes;
    res.json({
      ok: true,
      provider,
      repo,
      skill_id: skillId,
      removed,
      cli: { skipped: cliResult.skipped, agent: cliResult.agent, skill: cliResult.removedSkill, message: cliResult.message },
    });
  });
}
