// @ts-nocheck
/**
 * Core API: project path utility routes (path-check, path-suggestions, path-native-picker, path-browse).
 * Extracted from projects.ts to keep each file under 300 lines.
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import fs from "node:fs";
import path from "node:path";
import {
  PROJECT_PATH_ALLOWED_ROOTS,
  pathInsideRoot,
  isPathInsideAllowedRoots,
  getContainingAllowedRoot,
  inspectDirectoryPath,
  collectProjectPathSuggestions,
  resolveInitialBrowsePath,
  pickNativeDirectoryPath,
} from "./project-path.ts";

export function registerCoreProjectsPaths(
  ctx: RuntimeContext,
  normalizeProjectPathInput: (raw: unknown) => string | null
): void {
  const { app, firstQueryValue, normalizeTextField } = ctx;

  app.get("/api/projects/path-check", (req, res) => {
    const raw = firstQueryValue(req.query.path);
    const normalized = normalizeProjectPathInput(raw);
    if (!normalized) return res.status(400).json({ error: "project_path_required" });
    if (!isPathInsideAllowedRoots(normalized)) {
      return res.status(403).json({
        error: "project_path_outside_allowed_roots",
        allowed_roots: PROJECT_PATH_ALLOWED_ROOTS,
      });
    }
    const inspected = inspectDirectoryPath(normalized);
    res.json({
      ok: true,
      normalized_path: normalized,
      exists: inspected.exists,
      is_directory: inspected.isDirectory,
      can_create: inspected.canCreate,
      nearest_existing_parent: inspected.nearestExistingParent,
    });
  });

  app.get("/api/projects/path-suggestions", (req, res) => {
    const q = normalizeTextField(firstQueryValue(req.query.q)) ?? "";
    const parsedLimit = Number(firstQueryValue(req.query.limit) ?? "30");
    const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(50, Math.trunc(parsedLimit))) : 30;
    const paths = collectProjectPathSuggestions(q, limit);
    res.json({ ok: true, paths });
  });

  app.post("/api/projects/path-native-picker", async (_req, res) => {
    try {
      const picked = await pickNativeDirectoryPath();
      if (picked.cancelled) return res.json({ ok: false, cancelled: true });
      if (!picked.path) return res.status(400).json({ error: "native_picker_unavailable" });

      const normalized = normalizeProjectPathInput(picked.path);
      if (!normalized) return res.status(400).json({ error: "project_path_required" });
      if (!isPathInsideAllowedRoots(normalized)) {
        return res.status(403).json({
          error: "project_path_outside_allowed_roots",
          allowed_roots: PROJECT_PATH_ALLOWED_ROOTS,
        });
      }
      try {
        if (!fs.statSync(normalized).isDirectory()) {
          return res.status(400).json({ error: "project_path_not_directory" });
        }
      } catch {
        return res.status(400).json({ error: "project_path_not_found" });
      }
      return res.json({ ok: true, path: normalized, source: picked.source });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: "native_picker_failed", reason: message });
    }
  });

  app.get("/api/projects/path-browse", (req, res) => {
    const raw = firstQueryValue(req.query.path);
    const currentPath = resolveInitialBrowsePath(raw, normalizeProjectPathInput);
    if (!isPathInsideAllowedRoots(currentPath)) {
      return res.status(403).json({
        error: "project_path_outside_allowed_roots",
        allowed_roots: PROJECT_PATH_ALLOWED_ROOTS,
      });
    }
    let entries: Array<{ name: string; path: string }> = [];
    try {
      const dirents = fs.readdirSync(currentPath, { withFileTypes: true });
      entries = dirents
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((entry) => ({ name: entry.name, path: path.join(currentPath, entry.name) }));
    } catch {
      entries = [];
    }
    const MAX_ENTRIES = 300;
    const truncated = entries.length > MAX_ENTRIES;
    const containingRoot = getContainingAllowedRoot(currentPath);
    const candidateParent = path.dirname(currentPath);
    const parent =
      candidateParent !== currentPath &&
      (!containingRoot || pathInsideRoot(candidateParent, containingRoot))
        ? candidateParent
        : null;
    res.json({
      ok: true,
      current_path: currentPath,
      parent_path: parent !== currentPath ? parent : null,
      entries: entries.slice(0, MAX_ENTRIES),
      truncated,
    });
  });
}
