// @ts-nocheck
/**
 * Pure utility functions and constants for task reports.
 * Extracted from task-reports.ts to reduce single-file size.
 */

import fs from "node:fs";
import path from "node:path";

export const REPORT_DOC_TEXT_LIMIT = 120_000;
export const REPORT_PREVIEW_LIMIT = 260;
export const TEXT_DOC_EXTENSIONS = new Set([
  ".md", ".markdown", ".txt", ".json", ".yml", ".yaml", ".csv",
  ".log", ".ts", ".tsx", ".js", ".jsx", ".css", ".html", ".xml", ".sql",
]);
export const BINARY_DOC_EXTENSIONS = new Set([".pdf", ".ppt", ".pptx", ".doc", ".docx"]);

export function normalizeTaskText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function buildTextPreview(content: string, maxChars = REPORT_PREVIEW_LIMIT): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars).trimEnd()}...`;
}

export function normalizeProjectName(projectPath: unknown, fallbackTitle = "General"): string {
  const p = normalizeTaskText(projectPath);
  if (!p) return fallbackTitle;
  try {
    const normalized = p.replace(/[\\/]+$/, "");
    const name = path.basename(normalized);
    return name || fallbackTitle;
  } catch {
    return fallbackTitle;
  }
}

export function extractTargetFilePath(description: unknown): string | null {
  const desc = normalizeTaskText(description);
  if (!desc) return null;
  const m = desc.match(/target file path:\s*(.+)/i);
  if (!m?.[1]) return null;
  return m[1].trim().replace(/^['"`]|['"`]$/g, "");
}

export function extractDocumentPathCandidates(texts: string[]): string[] {
  const out = new Set<string>();
  const pattern = /(?:[A-Za-z]:\\|\/)?[^\s"'`<>|]+?\.(?:md|markdown|txt|json|ya?ml|csv|log|pdf|pptx?|docx?)/gi;
  for (const rawText of texts) {
    if (!rawText) continue;
    const matches = rawText.match(pattern) ?? [];
    for (const m of matches) {
      const cleaned = m.replace(/[),.;:]+$/g, "").trim();
      if (cleaned.length > 1) out.add(cleaned);
    }
  }
  return [...out];
}

export function resolveDocumentPath(candidate: string, projectPath: string | null): string {
  if (path.isAbsolute(candidate)) return candidate;
  if (projectPath) return path.resolve(projectPath, candidate);
  return path.resolve(process.cwd(), candidate);
}

export function readReportDocument(pathCandidate: string, projectPath: string | null): Record<string, unknown> | null {
  try {
    const absPath = resolveDocumentPath(pathCandidate, projectPath);
    if (!fs.existsSync(absPath)) return null;
    const stat = fs.statSync(absPath);
    if (!stat.isFile()) return null;

    const ext = path.extname(absPath).toLowerCase();
    const rel = path.relative(process.cwd(), absPath).replace(/\\/g, "/");
    const docId = `file:${rel}`;

    if (BINARY_DOC_EXTENSIONS.has(ext)) {
      return {
        id: docId,
        title: path.basename(absPath),
        source: "file",
        path: rel,
        mime: ext === ".pdf"
          ? "application/pdf"
          : ext === ".ppt" || ext === ".pptx"
          ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
          : "application/octet-stream",
        size_bytes: stat.size,
        updated_at: stat.mtimeMs,
        truncated: false,
        text_preview: `Binary document generated: ${rel}`,
        content: `Binary document generated at ${rel} (${Math.round(stat.size / 1024)} KB).`,
      };
    }

    if (!TEXT_DOC_EXTENSIONS.has(ext) && stat.size > 512_000) {
      return null;
    }

    const raw = fs.readFileSync(absPath, "utf8");
    const truncated = raw.length > REPORT_DOC_TEXT_LIMIT;
    const content = truncated ? `${raw.slice(0, REPORT_DOC_TEXT_LIMIT)}\n\n...[truncated]` : raw;
    return {
      id: docId,
      title: path.basename(absPath),
      source: "file",
      path: rel,
      mime: "text/plain",
      size_bytes: stat.size,
      updated_at: stat.mtimeMs,
      truncated,
      text_preview: buildTextPreview(content),
      content,
    };
  } catch {
    return null;
  }
}

export function documentPriority(doc: Record<string, unknown>): number {
  const joined = `${normalizeTaskText(doc.path)} ${normalizeTaskText(doc.title)}`.toLowerCase();
  if (/\.(md|markdown)\b/.test(joined)) return 0;
  const source = normalizeTaskText(doc.source);
  if (source === "file") return 1;
  if (source === "report_message") return 2;
  if (source === "task_result") return 3;
  return 4;
}

export function sortReportDocuments(docs: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return [...docs].sort((a, b) => {
    const pa = documentPriority(a);
    const pb = documentPriority(b);
    if (pa !== pb) return pa - pb;
    const ua = Number(a.updated_at ?? 0) || 0;
    const ub = Number(b.updated_at ?? 0) || 0;
    if (ua !== ub) return ub - ua;
    return normalizeTaskText(a.title).localeCompare(normalizeTaskText(b.title));
  });
}
