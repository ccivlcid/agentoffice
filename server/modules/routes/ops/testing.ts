// @ts-nocheck
/**
 * POST /api/tasks/:id/test — run tests for a task
 * GET  /api/tasks/:id/test — get test runs for a task
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

export function registerOpsTesting(ctx: RuntimeContext): void {
  const { app, db, broadcast } = ctx;

  // GET — list test runs
  app.get("/api/tasks/:id/test", (req, res) => {
    const { id } = req.params;
    const rows = db
      .prepare(
        `SELECT * FROM test_runs WHERE task_id = ? ORDER BY created_at DESC LIMIT 20`
      )
      .all(id);
    res.json({ ok: true, runs: rows });
  });

  // POST — start a test run
  app.post("/api/tasks/:id/test", (req, res) => {
    const { id } = req.params;
    const { command, cwd } = req.body ?? {};
    if (!command) return res.status(400).json({ error: "command_required" });

    const task = db.prepare("SELECT id, project_path FROM tasks WHERE id = ?").get(id);
    if (!task) return res.status(404).json({ error: "task_not_found" });

    const runId = crypto.randomUUID();
    const now = Date.now();
    const workDir = cwd || task.project_path || process.cwd();

    db.prepare(
      `INSERT INTO test_runs (id, task_id, command, cwd, status, started_at)
       VALUES (?, ?, ?, ?, 'running', ?)`
    ).run(runId, id, command, workDir, now);

    // Spawn test process
    const child = spawn(command, { shell: true, cwd: workDir });
    let output = "";

    child.stdout?.on("data", (data) => {
      const chunk = data.toString();
      output += chunk;
      broadcast("test_output", { run_id: runId, task_id: id, chunk });
    });

    child.stderr?.on("data", (data) => {
      const chunk = data.toString();
      output += chunk;
      broadcast("test_output", { run_id: runId, task_id: id, chunk });
    });

    child.on("close", (code) => {
      const finished = Date.now();
      const duration = finished - now;
      const status = code === 0 ? "passed" : "failed";

      // Simple parsing of test output for counts
      const parsed = parseTestOutput(output);

      db.prepare(
        `UPDATE test_runs
         SET status = ?, finished_at = ?, duration = ?,
             total = ?, passed = ?, failed = ?, skipped = ?, output = ?
         WHERE id = ?`
      ).run(
        status, finished, duration,
        parsed.total, parsed.passed, parsed.failed, parsed.skipped,
        output.slice(-50000),
        runId,
      );

      broadcast("test_complete", {
        run_id: runId,
        task_id: id,
        status,
        duration,
        total: parsed.total,
        passed: parsed.passed,
        failed: parsed.failed,
        skipped: parsed.skipped,
      });
    });

    child.on("error", (err) => {
      db.prepare(
        `UPDATE test_runs SET status = 'error', finished_at = ?, output = ? WHERE id = ?`
      ).run(Date.now(), err.message, runId);

      broadcast("test_complete", {
        run_id: runId,
        task_id: id,
        status: "error",
        error: err.message,
      });
    });

    res.json({ ok: true, run_id: runId });
  });
}

/** Simple heuristic to parse test output for counts */
function parseTestOutput(output: string): { total: number; passed: number; failed: number; skipped: number } {
  let total = 0, passed = 0, failed = 0, skipped = 0;

  // Vitest / Jest pattern: "Tests: X passed, Y failed, Z total"
  const jestMatch = output.match(/Tests:\s*(?:(\d+)\s*passed)?[,\s]*(?:(\d+)\s*failed)?[,\s]*(?:(\d+)\s*skipped)?[,\s]*(\d+)\s*total/i);
  if (jestMatch) {
    passed = parseInt(jestMatch[1] ?? "0", 10);
    failed = parseInt(jestMatch[2] ?? "0", 10);
    skipped = parseInt(jestMatch[3] ?? "0", 10);
    total = parseInt(jestMatch[4] ?? "0", 10);
    return { total, passed, failed, skipped };
  }

  // pytest pattern: "X passed, Y failed, Z skipped"
  const pytestMatch = output.match(/(\d+)\s*passed/i);
  if (pytestMatch) {
    passed = parseInt(pytestMatch[1], 10);
    const fMatch = output.match(/(\d+)\s*failed/i);
    if (fMatch) failed = parseInt(fMatch[1], 10);
    const sMatch = output.match(/(\d+)\s*skipped/i);
    if (sMatch) skipped = parseInt(sMatch[1], 10);
    total = passed + failed + skipped;
    return { total, passed, failed, skipped };
  }

  return { total, passed, failed, skipped };
}
