// @ts-nocheck

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function initializeCollabPaths(deps: {
  db: any;
  normalizeTextField: any;
}) {
  const { db, normalizeTextField } = deps;

  /**
   * Detect project path from CEO message.
   * Recognizes:
   * 1. Absolute paths: /home/user/Projects/foo, ~/Projects/bar
   * 2. Project names: "climpire 프로젝트", "claw-kanban에서"
   * 3. Known project directories under ~/Projects
   */
  function detectProjectPath(message: string): string | null {
    const homeDir = os.homedir();
    const projectsDir = path.join(homeDir, "Projects");
    const projectsDirLower = path.join(homeDir, "projects");

    // 1. Explicit absolute path in message
    const absMatch = message.match(/(?:^|\s)(\/[\w./-]+)/);
    if (absMatch) {
      const p = absMatch[1];
      // Check if it's a real directory
      try {
        if (fs.statSync(p).isDirectory()) return p;
      } catch {}
      // Check parent directory
      const parent = path.dirname(p);
      try {
        if (fs.statSync(parent).isDirectory()) return parent;
      } catch {}
    }

    // 2. ~ path
    const tildeMatch = message.match(/~\/([\w./-]+)/);
    if (tildeMatch) {
      const expanded = path.join(homeDir, tildeMatch[1]);
      try {
        if (fs.statSync(expanded).isDirectory()) return expanded;
      } catch {}
    }

    // 3. Scan known project directories and match by name
    let knownProjects: string[] = [];
    for (const pDir of [projectsDir, projectsDirLower]) {
      try {
        const entries = fs.readdirSync(pDir, { withFileTypes: true });
        knownProjects = knownProjects.concat(
          entries.filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => e.name)
        );
      } catch {}
    }

    // Match project names in the message (case-insensitive)
    const msgLower = message.toLowerCase();
    for (const proj of knownProjects) {
      if (msgLower.includes(proj.toLowerCase())) {
        // Return the actual path
        const fullPath = path.join(projectsDir, proj);
        try {
          if (fs.statSync(fullPath).isDirectory()) return fullPath;
        } catch {}
        const fullPathLower = path.join(projectsDirLower, proj);
        try {
          if (fs.statSync(fullPathLower).isDirectory()) return fullPathLower;
        } catch {}
      }
    }

    return null;
  }

  /**
   * Resolve project path (canonical-first):
   * 1) task.project_id -> projects.project_path
   * 2) task.project_path
   * 3) detect from description/title
   * 4) process.cwd()
   */
  function resolveProjectPath(task: {
    project_id?: string | null;
    project_path?: string | null;
    description?: string | null;
    title?: string;
  }): string {
    const projectId = String(task.project_id ?? "").trim();
    if (projectId) {
      const row = db.prepare(`
        SELECT project_path
        FROM projects
        WHERE id = ?
        LIMIT 1
      `).get(projectId) as { project_path: string | null } | undefined;
      const canonical = String(row?.project_path ?? "").trim();
      if (canonical) {
        const detectedCanonical = detectProjectPath(canonical);
        return detectedCanonical || canonical;
      }
    }

    const taskProjectPath = String(task.project_path ?? "").trim();
    if (taskProjectPath) {
      const detectedTaskPath = detectProjectPath(taskProjectPath);
      return detectedTaskPath || taskProjectPath;
    }

    const detected = detectProjectPath(task.description || "") || detectProjectPath(task.title || "");
    return detected || process.cwd();
  }

  function getLatestKnownProjectPath(): string | null {
    const row = db.prepare(`
      SELECT project_path
      FROM tasks
      WHERE project_path IS NOT NULL AND TRIM(project_path) != ''
      ORDER BY updated_at DESC
      LIMIT 1
    `).get() as { project_path: string | null } | undefined;
    const candidate = normalizeTextField(row?.project_path ?? null);
    if (!candidate) return null;
    try {
      if (fs.statSync(candidate).isDirectory()) return candidate;
    } catch {}
    return null;
  }

  function getDefaultProjectRoot(): string {
    const homeDir = os.homedir();
    const candidates = [
      path.join(homeDir, "Projects"),
      path.join(homeDir, "projects"),
      process.cwd(),
    ];
    for (const candidate of candidates) {
      try {
        if (fs.statSync(candidate).isDirectory()) return candidate;
      } catch {}
    }
    return process.cwd();
  }

  function resolveDirectiveProjectPath(
    ceoMessage: string,
    options: any = {},
  ): { projectPath: string | null; source: string } {
    const explicitProjectId = normalizeTextField((options as { projectId?: unknown }).projectId);
    if (explicitProjectId) {
      const projectById = db.prepare(`
        SELECT project_path
        FROM projects
        WHERE id = ?
        LIMIT 1
      `).get(explicitProjectId) as { project_path: string | null } | undefined;
      const byIdPath = normalizeTextField(projectById?.project_path);
      if (byIdPath) {
        const detectedByIdPath = detectProjectPath(byIdPath) || byIdPath;
        return { projectPath: detectedByIdPath, source: "project_id" };
      }
    }

    const explicitProjectPath = normalizeTextField(options.projectPath);
    if (explicitProjectPath) {
      const detected = detectProjectPath(explicitProjectPath);
      if (detected) return { projectPath: detected, source: "project_path" };
    }

    const contextHint = normalizeTextField(options.projectContext);
    if (contextHint) {
      const detectedFromContext = detectProjectPath(contextHint);
      if (detectedFromContext) return { projectPath: detectedFromContext, source: "project_context" };

      const existingProjectHint = /기존\s*프로젝트|기존\s*작업|existing project|same project|current project|ongoing project|既存.*プロジェクト|現在.*プロジェクト|之前项目|当前项目/i
        .test(contextHint);
      if (existingProjectHint) {
        const latest = getLatestKnownProjectPath();
        if (latest) return { projectPath: latest, source: "recent_project" };
      }

      const newProjectHint = /신규\s*프로젝트|새\s*프로젝트|new project|greenfield|from scratch|新規.*プロジェクト|新项目/i
        .test(contextHint);
      if (newProjectHint) {
        return { projectPath: getDefaultProjectRoot(), source: "new_project_default" };
      }
    }

    const detectedFromMessage = detectProjectPath(ceoMessage);
    if (detectedFromMessage) return { projectPath: detectedFromMessage, source: "message" };

    return { projectPath: null, source: "none" };
  }

  return {
    detectProjectPath,
    resolveProjectPath,
    getLatestKnownProjectPath,
    getDefaultProjectRoot,
    resolveDirectiveProjectPath,
  };
}
