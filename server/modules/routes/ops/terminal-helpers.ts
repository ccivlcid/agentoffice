// @ts-nocheck
/**
 * Types and utility functions for terminal progress hints.
 * Extracted from terminal.ts to reduce single-file size.
 */

export type TerminalProgressHintPhase = "use" | "ok" | "error";

export interface TerminalProgressHintItem {
  phase: TerminalProgressHintPhase;
  tool: string;
  summary: string;
  file_path: string | null;
}

export interface StreamToolUseState {
  tool_use_id: string;
  tool: string;
  initial_input: any;
  input_json: string;
}

export function clipHint(text: string, max = 160): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

export function pickFirstNonEmptyLine(value: string): string {
  for (const line of value.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function extractPathLikeToken(text: string): string | null {
  const m = text.match(/(?:[A-Za-z]:\\|\/)[^\s"'`<>|]+/);
  return m ? m[0] : null;
}

export function normalizeShellCommand(command: string): string {
  const trimmed = command.trim();
  if (!trimmed) return "";
  const wrapped = trimmed.match(/^(?:\S*\/)?(?:bash|zsh|sh)\s+-lc\s+([\s\S]+)$/);
  if (!wrapped) return trimmed;
  let inner = wrapped[1].trim();
  if (
    (inner.startsWith("'") && inner.endsWith("'"))
    || (inner.startsWith("\"") && inner.endsWith("\""))
  ) {
    inner = inner.slice(1, -1);
  }
  return inner.trim() || trimmed;
}

export function extractToolUseFilePath(toolName: string, input: any): string | null {
  if (!input || typeof input !== "object") return null;
  if (typeof input.file_path === "string" && input.file_path.trim()) return input.file_path.trim();
  if (typeof input.path === "string" && input.path.trim()) return input.path.trim();
  if (Array.isArray(input.paths)) {
    const first = input.paths.find((v: unknown) => typeof v === "string" && v.trim());
    if (typeof first === "string") return first.trim();
  }
  if (toolName === "Bash" && typeof input.command === "string") {
    const normalizedCommand = normalizeShellCommand(input.command);
    return extractPathLikeToken(normalizedCommand) || extractPathLikeToken(input.command) || null;
  }
  return null;
}

export function summarizeToolUse(toolName: string, input: any): string {
  if (!input || typeof input !== "object") return toolName;
  if (typeof input.description === "string" && input.description.trim()) return clipHint(input.description, 180);
  if (typeof input.file_path === "string" && input.file_path.trim()) return clipHint(input.file_path, 180);
  if (typeof input.path === "string" && input.path.trim()) return clipHint(input.path, 180);
  if (typeof input.command === "string" && input.command.trim()) {
    const normalizedCommand = normalizeShellCommand(input.command);
    return clipHint(normalizedCommand || input.command, 180);
  }
  if (typeof input.prompt === "string" && input.prompt.trim()) return clipHint(input.prompt, 180);
  return toolName;
}

export function summarizeToolResult(content: unknown): string {
  if (typeof content === "string") return clipHint(pickFirstNonEmptyLine(content), 180);
  if (Array.isArray(content)) {
    for (const item of content) {
      if (typeof item === "string" && item.trim()) return clipHint(pickFirstNonEmptyLine(item), 180);
      if (item && typeof item === "object") {
        const text = (item as any).text;
        if (typeof text === "string" && text.trim()) return clipHint(pickFirstNonEmptyLine(text), 180);
      }
    }
  }
  if (content && typeof content === "object") {
    const obj = content as Record<string, unknown>;
    for (const key of ["message", "error", "output", "stdout", "stderr", "text"]) {
      const value = obj[key];
      if (typeof value === "string" && value.trim()) return clipHint(pickFirstNonEmptyLine(value), 180);
    }
  }
  return "";
}

export function parseJsonObject(value: string): any | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function capitalizeToolName(name: string): string {
  if (!name) return "Tool";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function normalizeOpencodeInput(input: any): any {
  if (!input || typeof input !== "object") return input;
  const normalized: any = { ...input };
  if (typeof input.filePath === "string" && !input.file_path) {
    normalized.file_path = input.filePath;
  }
  return normalized;
}
