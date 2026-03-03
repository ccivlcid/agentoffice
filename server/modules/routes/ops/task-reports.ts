// @ts-nocheck
/**
 * Task reports API routes (list, detail, archive).
 * Extracted from ops.ts to reduce single-file size.
 */

import fs from "node:fs";
import path from "node:path";
import type { RuntimeContext } from "../../../types/runtime-context.ts";
import {
  normalizeTaskText,
  buildTextPreview,
  normalizeProjectName,
  sortReportDocuments,
} from "./task-reports-helpers.ts";
import { fetchMeetingMinutesForTask, buildTaskSection } from "./task-reports-queries.ts";

const TASK_WITH_JOINS_SQL = `
  SELECT t.id, t.title, t.description, t.department_id, t.assigned_agent_id,
         t.status, t.project_id, t.project_path, t.result, t.source_task_id,
         t.created_at, t.started_at, t.completed_at,
         COALESCE(a.name, '') AS agent_name,
         COALESCE(a.name_ko, '') AS agent_name_ko,
         COALESCE(a.role, '') AS agent_role,
         COALESCE(d.name, '') AS dept_name,
         COALESCE(d.name_ko, '') AS dept_name_ko,
         COALESCE(p.name, '') AS project_name_db,
         COALESCE(p.project_path, '') AS project_path_db,
         COALESCE(p.core_goal, '') AS project_core_goal
  FROM tasks t
  LEFT JOIN agents a ON a.id = t.assigned_agent_id
  LEFT JOIN departments d ON d.id = t.department_id
  LEFT JOIN projects p ON p.id = t.project_id
  WHERE t.id = ?
`;

export function registerOpsTaskReports(ctx: RuntimeContext): void {
  const { app, db, nowMs } = ctx;
  const archivePlanningConsolidatedReport = (ctx as any).archivePlanningConsolidatedReport;

  app.get("/api/task-reports", (_req: any, res: any) => {
    try {
      // 완료된 모든 태스크 포함. 지시한 팀장(루트 태스크 담당)을 목록에 표시하기 위해 루트 담당자 정보 조인
      const rows = db.prepare(`
        SELECT t.id, t.title, t.description, t.department_id, t.assigned_agent_id,
               t.status, t.project_id, t.project_path, t.source_task_id, t.created_at, t.completed_at,
               COALESCE(a.name, '') AS agent_name,
               COALESCE(a.name_ko, '') AS agent_name_ko,
               COALESCE(a.role, '') AS agent_role,
               COALESCE(d.name, '') AS dept_name,
               COALESCE(d.name_ko, '') AS dept_name_ko,
               COALESCE(p.name, '') AS project_name_db,
               COALESCE(NULLIF(TRIM(t.source_task_id), ''), t.id) AS root_task_id,
               COALESCE(lead_ag.id, a.id) AS leader_agent_id,
               COALESCE(lead_ag.name, a.name, '') AS leader_agent_name,
               COALESCE(lead_ag.name_ko, a.name_ko, '') AS leader_agent_name_ko,
               COALESCE(lead_dept.name, d.name, '') AS leader_dept_name,
               COALESCE(lead_dept.name_ko, d.name_ko, '') AS leader_dept_name_ko
        FROM tasks t
        LEFT JOIN agents a ON a.id = t.assigned_agent_id
        LEFT JOIN departments d ON d.id = t.department_id
        LEFT JOIN projects p ON p.id = t.project_id
        LEFT JOIN tasks root ON root.id = COALESCE(NULLIF(TRIM(t.source_task_id), ''), t.id)
        LEFT JOIN agents lead_ag ON lead_ag.id = root.assigned_agent_id
        LEFT JOIN departments lead_dept ON lead_dept.id = lead_ag.department_id
        WHERE t.status = 'done'
        ORDER BY t.completed_at DESC
        LIMIT 100
      `).all() as Array<Record<string, unknown>>;

      const reports = rows.map((row) => ({
        ...row,
        project_name:
          normalizeTaskText(row.project_name_db)
          || normalizeProjectName(row.project_path, normalizeTaskText(row.title) || "General"),
      }));
      res.json({ ok: true, reports });
    } catch (err) {
      console.error("[task-reports]", err);
      res.status(500).json({ ok: false, error: "Failed to fetch reports" });
    }
  });

  app.get("/api/task-reports/:taskId", (req: any, res: any) => {
    const { taskId } = req.params;
    try {
      const taskWithJoins = db.prepare(TASK_WITH_JOINS_SQL).get(taskId) as Record<string, unknown> | undefined;
      if (!taskWithJoins) return res.status(404).json({ ok: false, error: "Task not found" });

      const rootTaskId = normalizeTaskText(taskWithJoins.source_task_id) || String(taskWithJoins.id);
      const rootTask = db.prepare(TASK_WITH_JOINS_SQL).get(rootTaskId) as Record<string, unknown> | undefined;
      if (!rootTask) return res.status(404).json({ ok: false, error: "Root task not found" });

      const relatedTasks = db.prepare(`
        SELECT t.id, t.title, t.description, t.department_id, t.assigned_agent_id,
               t.status, t.project_id, t.project_path, t.result, t.source_task_id,
               t.created_at, t.started_at, t.completed_at,
               COALESCE(a.name, '') AS agent_name,
               COALESCE(a.name_ko, '') AS agent_name_ko,
               COALESCE(a.role, '') AS agent_role,
               COALESCE(d.name, '') AS dept_name,
               COALESCE(d.name_ko, '') AS dept_name_ko,
               COALESCE(p.name, '') AS project_name_db,
               COALESCE(p.project_path, '') AS project_path_db,
               COALESCE(p.core_goal, '') AS project_core_goal
        FROM tasks t
        LEFT JOIN agents a ON a.id = t.assigned_agent_id
        LEFT JOIN departments d ON d.id = t.department_id
        LEFT JOIN projects p ON p.id = t.project_id
        WHERE t.id = ? OR t.source_task_id = ?
        ORDER BY CASE WHEN t.id = ? THEN 0 ELSE 1 END, t.completed_at DESC, t.created_at ASC
      `).all(rootTaskId, rootTaskId, rootTaskId) as Array<Record<string, unknown>>;

      const rootSubtasks = db.prepare(`
        SELECT s.id, s.title, s.status, s.assigned_agent_id, s.target_department_id, s.delegated_task_id, s.completed_at,
               COALESCE(a.name, '') AS agent_name, COALESCE(a.name_ko, '') AS agent_name_ko,
               COALESCE(d.name, '') AS target_dept_name, COALESCE(d.name_ko, '') AS target_dept_name_ko
        FROM subtasks s
        LEFT JOIN agents a ON a.id = s.assigned_agent_id
        LEFT JOIN departments d ON d.id = s.target_department_id
        WHERE s.task_id = ?
        ORDER BY s.created_at ASC
      `).all(rootTaskId) as Array<Record<string, unknown>>;

      const linkedSubtasksByTaskId = new Map<string, Array<Record<string, unknown>>>();
      for (const st of rootSubtasks) {
        const delegatedTaskId = normalizeTaskText(st.delegated_task_id);
        if (!delegatedTaskId) continue;
        const bucket = linkedSubtasksByTaskId.get(delegatedTaskId) ?? [];
        bucket.push(st);
        linkedSubtasksByTaskId.set(delegatedTaskId, bucket);
      }

      const teamReports = relatedTasks.map((item) =>
        buildTaskSection(db, item, linkedSubtasksByTaskId.get(String(item.id)) ?? [])
      );

      const planningSection = teamReports.find((s) => s.task_id === rootTaskId && s.department_id === "planning")
        ?? teamReports.find((s) => s.department_id === "planning")
        ?? teamReports[0]
        ?? null;

      const projectId = normalizeTaskText(rootTask.project_id) || null;
      const projectPath =
        normalizeTaskText(rootTask.project_path_db)
        || normalizeTaskText(rootTask.project_path)
        || null;
      const projectName =
        normalizeTaskText(rootTask.project_name_db)
        || normalizeProjectName(projectPath, normalizeTaskText(rootTask.title) || "General");
      const projectCoreGoal = normalizeTaskText(rootTask.project_core_goal) || null;

      const rootLogs = db.prepare(
        "SELECT kind, message, created_at FROM task_logs WHERE task_id = ? ORDER BY created_at ASC"
      ).all(rootTaskId);
      const rootMinutes = fetchMeetingMinutesForTask(db, rootTaskId);

      const archiveRow = db.prepare(`
        SELECT a.summary_markdown, a.updated_at, a.created_at, a.generated_by_agent_id,
               COALESCE(ag.name, '') AS agent_name,
               COALESCE(ag.name_ko, '') AS agent_name_ko
        FROM task_report_archives a
        LEFT JOIN agents ag ON ag.id = a.generated_by_agent_id
        WHERE a.root_task_id = ?
        ORDER BY a.updated_at DESC
        LIMIT 1
      `).get(rootTaskId) as Record<string, unknown> | undefined;

      const archiveSummaryContent = normalizeTaskText(archiveRow?.summary_markdown);
      const planningArchiveDoc = archiveSummaryContent
        ? sortReportDocuments([{
            id: `archive:${rootTaskId}`,
            title: `${projectName}-planning-consolidated.md`,
            source: "archive",
            path: null,
            mime: "text/markdown",
            size_bytes: archiveSummaryContent.length,
            updated_at: Number(archiveRow?.updated_at ?? archiveRow?.created_at ?? 0) || nowMs(),
            truncated: false,
            text_preview: buildTextPreview(archiveSummaryContent),
            content: archiveSummaryContent,
          }])
        : [];

      const planningSummary = planningSection
        ? {
            title: "Planning Lead Consolidated Summary",
            content: archiveSummaryContent || planningSection.summary || "",
            source_task_id: planningSection.task_id ?? rootTaskId,
            source_agent_name: normalizeTaskText(archiveRow?.agent_name) || planningSection.agent_name,
            source_department_name: planningSection.department_name,
            generated_at: Number(archiveRow?.updated_at ?? archiveRow?.created_at ?? planningSection.completed_at ?? planningSection.created_at ?? nowMs()),
            documents: sortReportDocuments([
              ...planningArchiveDoc,
              ...((planningSection.documents ?? []) as Array<Record<string, unknown>>),
            ]),
          }
        : {
            title: "Planning Lead Consolidated Summary",
            content: archiveSummaryContent || "",
            source_task_id: rootTaskId,
            source_agent_name: normalizeTaskText(archiveRow?.agent_name) || "",
            source_department_name: "",
            generated_at: Number(archiveRow?.updated_at ?? archiveRow?.created_at ?? nowMs()),
            documents: planningArchiveDoc,
          };

      res.json({
        ok: true,
        requested_task_id: String(taskWithJoins.id),
        project: { root_task_id: rootTaskId, project_id: projectId, project_name: projectName, project_path: projectPath, core_goal: projectCoreGoal },
        task: rootTask,
        logs: rootLogs,
        subtasks: rootSubtasks,
        meeting_minutes: rootMinutes,
        planning_summary: planningSummary,
        team_reports: teamReports,
      });
    } catch (err) {
      console.error("[task-reports/:id]", err);
      res.status(500).json({ ok: false, error: "Failed to fetch report detail" });
    }
  });

  app.post("/api/task-reports/:taskId/archive", async (req: any, res: any) => {
    const { taskId } = req.params;
    try {
      if (typeof archivePlanningConsolidatedReport !== "function") {
        return res.status(503).json({ ok: false, error: "archive_generator_unavailable" });
      }
      const row = db.prepare(
        "SELECT id, source_task_id FROM tasks WHERE id = ?"
      ).get(taskId) as { id: string; source_task_id: string | null } | undefined;
      if (!row) return res.status(404).json({ ok: false, error: "Task not found" });

      const rootTaskId = normalizeTaskText(row.source_task_id) || row.id;
      await archivePlanningConsolidatedReport(rootTaskId);

      const archive = db.prepare(`
        SELECT root_task_id, generated_by_agent_id, updated_at
        FROM task_report_archives
        WHERE root_task_id = ?
        ORDER BY updated_at DESC
        LIMIT 1
      `).get(rootTaskId) as { root_task_id: string; generated_by_agent_id: string | null; updated_at: number } | undefined;

      if (!archive) {
        return res.status(500).json({ ok: false, error: "Failed to archive consolidated report" });
      }

      res.json({
        ok: true,
        root_task_id: archive.root_task_id,
        generated_by_agent_id: archive.generated_by_agent_id,
        updated_at: archive.updated_at,
      });
    } catch (err) {
      console.error("[task-reports/:id/archive]", err);
      res.status(500).json({ ok: false, error: "Failed to archive consolidated report" });
    }
  });

  // --- Deliverable files for a task ---
  const DELIVERABLE_EXTS = new Set([".pptx", ".pdf", ".html", ".png", ".jpg", ".jpeg", ".mp4", ".zip", ".md", ".csv", ".xlsx"]);

  app.get("/api/tasks/:id/deliverables", (req: any, res: any) => {
    const taskId = String(req.params.id);
    const task = db.prepare("SELECT project_path, title FROM tasks WHERE id = ?").get(taskId) as any;
    if (!task) return res.status(404).json({ error: "not_found" });
    const projectPath = task.project_path || process.cwd();

    // Collect this task's worktree + related subtask worktrees
    const relatedTaskIds = [taskId];
    try {
      const subs = db.prepare("SELECT delegated_task_id FROM subtasks WHERE task_id = ? AND delegated_task_id IS NOT NULL").all(taskId) as any[];
      for (const s of subs) if (s.delegated_task_id) relatedTaskIds.push(s.delegated_task_id);
      // Also child collaboration tasks
      const children = db.prepare("SELECT id FROM tasks WHERE source_task_id = ?").all(taskId) as any[];
      for (const c of children) relatedTaskIds.push(c.id);
    } catch { /* ignore */ }

    const searchDirs = [
      path.join(projectPath, "output"),
      path.join(projectPath, "slides"),
    ];

    // Only scan worktrees belonging to this task and its subtasks
    const worktreeBase = path.join(projectPath, ".climpire-worktrees");
    if (fs.existsSync(worktreeBase)) {
      for (const tid of relatedTaskIds) {
        const shortId = tid.slice(0, 8);
        const wtPath = path.join(worktreeBase, shortId);
        if (fs.existsSync(wtPath)) {
          searchDirs.push(path.join(wtPath, "output"));
          searchDirs.push(path.join(wtPath, "slides"));
          searchDirs.push(path.join(wtPath, "docs", "reports"));
        }
      }
    }

    console.log(`[deliverables] task=${taskId} project_path=${projectPath} searchDirs=${searchDirs.length}:`, searchDirs.filter((d: string) => fs.existsSync(d)));

    const files: Array<{ name: string; path: string; relPath: string; size: number; modified: number; ext: string }> = [];

    function scanDir(dir: string, depth = 0): void {
      if (depth > 5 || !fs.existsSync(dir)) return;
      try {
        for (const name of fs.readdirSync(dir)) {
          const fullPath = path.join(dir, name);
          try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) { scanDir(fullPath, depth + 1); continue; }
            const ext = path.extname(name).toLowerCase();
            if (!DELIVERABLE_EXTS.has(ext)) continue;
            files.push({
              name,
              path: fullPath,
              relPath: path.relative(projectPath, fullPath).replace(/\\/g, "/"),
              size: stat.size,
              modified: stat.mtimeMs,
              ext,
            });
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }

    for (const dir of searchDirs) { scanDir(dir); }

    files.sort((a, b) => b.modified - a.modified);
    res.json({ files: files.slice(0, 50) });
  });

  // --- Open/download a deliverable file ---
  app.get("/api/deliverables/open", (req: any, res: any) => {
    const filePath = path.resolve(String(req.query.path ?? ""));
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: "file_not_found" });
    }
    // Security: only allow files under known deliverable directories
    const cwd = process.cwd();
    const allowed = [
      path.join(cwd, "output"),
      path.join(cwd, "slides"),
      path.join(cwd, "docs", "reports"),
      path.join(cwd, "dist"),
      path.join(cwd, ".climpire-worktrees"),
    ];
    const isAllowed = allowed.some((dir) => filePath.startsWith(dir + path.sep) || filePath.startsWith(dir + "/"));
    if (!isAllowed) {
      return res.status(403).json({ error: "path_not_allowed" });
    }
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ".pdf": "application/pdf",
      ".html": "text/html",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".mp4": "video/mp4",
      ".zip": "application/zip",
      ".md": "text/markdown",
      ".csv": "text/csv",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
    res.setHeader("Content-Type", mimeMap[ext] ?? "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${path.basename(filePath)}"`);
    fs.createReadStream(filePath).pipe(res);
  });
}
