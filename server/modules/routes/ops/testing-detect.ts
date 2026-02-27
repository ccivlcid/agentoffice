// @ts-nocheck
/**
 * GET /api/tasks/:id/test/detect — detect available test scripts
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import fs from "node:fs";
import path from "node:path";

export function registerOpsTestingDetect(ctx: RuntimeContext): void {
  const { app, db } = ctx;

  app.get("/api/tasks/:id/test/detect", (req, res) => {
    const { id } = req.params;
    const task = db.prepare("SELECT id, project_path FROM tasks WHERE id = ?").get(id);
    if (!task) return res.status(404).json({ error: "task_not_found" });

    const projectPath = task.project_path;
    if (!projectPath) {
      return res.json({ ok: true, scripts: [], message: "no_project_path" });
    }

    const scripts: Array<{ name: string; command: string; source: string }> = [];

    // Check package.json scripts
    try {
      const pkgPath = path.join(projectPath, "package.json");
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        if (pkg.scripts) {
          for (const [name, cmd] of Object.entries(pkg.scripts)) {
            if (/test|spec|jest|vitest|mocha|cypress|playwright/i.test(name) ||
                /test|spec|jest|vitest|mocha|cypress|playwright/i.test(String(cmd))) {
              scripts.push({
                name: `npm run ${name}`,
                command: `npm run ${name}`,
                source: "package.json",
              });
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // Check Makefile targets
    try {
      const mkPath = path.join(projectPath, "Makefile");
      if (fs.existsSync(mkPath)) {
        const content = fs.readFileSync(mkPath, "utf-8");
        const targets = content.match(/^(test\S*):/gm);
        if (targets) {
          for (const t of targets) {
            const name = t.replace(":", "");
            scripts.push({ name: `make ${name}`, command: `make ${name}`, source: "Makefile" });
          }
        }
      }
    } catch {
      // ignore
    }

    // Check pyproject.toml / setup.cfg for pytest
    try {
      const pyprojectPath = path.join(projectPath, "pyproject.toml");
      if (fs.existsSync(pyprojectPath)) {
        scripts.push({ name: "pytest", command: "pytest", source: "pyproject.toml" });
      }
    } catch {
      // ignore
    }

    res.json({ ok: true, scripts });
  });
}
