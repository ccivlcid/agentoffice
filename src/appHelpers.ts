import type { CompanySettings, MeetingReviewDecision, RoomTheme } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import {
  LANGUAGE_STORAGE_KEY,
  LANGUAGE_USER_SET_STORAGE_KEY,
  normalizeLanguage,
} from "./i18n";

// ── Sub-agent & UI types ─────────────────────────────────────────────────────

export interface SubAgent {
  id: string;
  parentAgentId: string;
  task: string;
  status: "working" | "done";
}

export interface CrossDeptDelivery {
  id: string;
  fromAgentId: string;
  toAgentId: string;
}

export interface CeoOfficeCall {
  id: string;
  fromAgentId: string;
  seatIndex: number;
  phase: "kickoff" | "review";
  action?: "arrive" | "speak" | "dismiss";
  line?: string;
  decision?: MeetingReviewDecision;
  taskId?: string;
  instant?: boolean;
  holdUntil?: number;
}

export interface OAuthCallbackResult {
  provider: string | null;
  error: string | null;
}

export type View = "office" | "dashboard" | "tasks" | "skills" | "settings";
export type TaskPanelTab = "terminal" | "minutes";
export type RuntimeOs = "windows" | "mac" | "linux" | "unknown";
export type RoomThemeMap = Record<string, RoomTheme>;

export type CliSubAgentEvent =
  | { kind: "spawn"; id: string; task: string | null }
  | { kind: "done"; id: string }
  | { kind: "bind_thread"; threadId: string; subAgentId: string }
  | { kind: "close_thread"; threadId: string };

// ── Constants ────────────────────────────────────────────────────────────────

export const MAX_LIVE_MESSAGES = 600;
export const MAX_LIVE_SUBTASKS = 2000;
export const MAX_LIVE_SUBAGENTS = 600;
export const MAX_CROSS_DEPT_DELIVERIES = 240;
export const MAX_CEO_OFFICE_CALLS = 480;
export const MAX_SUBAGENT_TASK_LABEL_CHARS = 100;
export const MAX_SUBAGENT_STREAM_TAIL_CHARS = 16_000;
export const MAX_SUBAGENT_STREAM_TRACKED_TASKS = 180;
export const MAX_CODEX_THREAD_BINDINGS = 2000;
export const CODEX_THREAD_BINDING_TTL_MS = 30 * 60 * 1000;
export const UPDATE_BANNER_DISMISS_STORAGE_KEY = "climpire_update_banner_dismissed";
export const ROOM_THEMES_STORAGE_KEY = "climpire_room_themes";

export const SUB_AGENT_PARSE_MARKERS = [
  "\"Task\"", "\"spawn_agent\"", "\"close_agent\"", "\"tool_use\"",
  "\"tool_result\"", "\"collab_tool_call\"", "\"item.started\"",
  "\"item.completed\"", "\"tool_name\"", "\"tool_id\"", "\"callID\"",
] as const;

// ── Pure data helpers ────────────────────────────────────────────────────────

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  return value as Record<string, unknown>;
}

export function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const items: string[] = [];
  for (const raw of value) {
    const parsed = asNonEmptyString(raw);
    if (parsed) items.push(parsed);
  }
  return items;
}

export function isSubAgentToolName(value: unknown): boolean {
  const name = asNonEmptyString(value)?.toLowerCase();
  return name === "task" || name === "spawn_agent" || name === "spawnagent";
}

export function extractTaskLabel(value: unknown): string | null {
  if (typeof value === "string") {
    const firstLine = value.split("\n")[0]?.trim() ?? "";
    return firstLine ? firstLine.slice(0, MAX_SUBAGENT_TASK_LABEL_CHARS) : null;
  }
  const obj = asRecord(value);
  if (!obj) return null;
  const raw =
    asNonEmptyString(obj.description) ?? asNonEmptyString(obj.prompt) ??
    asNonEmptyString(obj.task) ?? asNonEmptyString(obj.message) ??
    asNonEmptyString(obj.command);
  if (!raw) return null;
  const firstLine = raw.split("\n")[0]?.trim() ?? "";
  return firstLine ? firstLine.slice(0, MAX_SUBAGENT_TASK_LABEL_CHARS) : null;
}

export function shouldParseCliChunkForSubAgents(chunk: string): boolean {
  for (const marker of SUB_AGENT_PARSE_MARKERS) {
    if (chunk.includes(marker)) return true;
  }
  return false;
}

export function appendCapped<T>(prev: T[], item: T, max: number): T[] {
  const next = prev.length >= max ? prev.slice(prev.length - max + 1) : prev.slice();
  next.push(item);
  return next;
}

// ── Room theme helpers ───────────────────────────────────────────────────────

export function isRoomTheme(value: unknown): value is RoomTheme {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.floor1 === "number" && Number.isFinite(v.floor1) &&
    typeof v.floor2 === "number" && Number.isFinite(v.floor2) &&
    typeof v.wall === "number" && Number.isFinite(v.wall) &&
    typeof v.accent === "number" && Number.isFinite(v.accent)
  );
}

export function isRoomThemeMap(value: unknown): value is RoomThemeMap {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value).every(isRoomTheme);
}

export function readStoredRoomThemes(): { themes: RoomThemeMap; hasStored: boolean } {
  if (typeof window === "undefined") return { themes: {}, hasStored: false };
  try {
    const raw = window.localStorage.getItem(ROOM_THEMES_STORAGE_KEY);
    if (!raw) return { themes: {}, hasStored: false };
    const parsed: unknown = JSON.parse(raw);
    if (!isRoomThemeMap(parsed)) return { themes: {}, hasStored: false };
    return { themes: parsed, hasStored: true };
  } catch {
    return { themes: {}, hasStored: false };
  }
}

// ── Settings / language helpers ──────────────────────────────────────────────

export function mergeSettingsWithDefaults(
  settings?: Partial<CompanySettings> | null
): CompanySettings {
  return {
    ...DEFAULT_SETTINGS,
    ...(settings ?? {}),
    language: normalizeLanguage(settings?.language ?? DEFAULT_SETTINGS.language),
    providerModelConfig: {
      ...(DEFAULT_SETTINGS.providerModelConfig ?? {}),
      ...(settings?.providerModelConfig ?? {}),
    },
  };
}

export function isUserLanguagePinned(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(LANGUAGE_USER_SET_STORAGE_KEY) === "1";
}

export function readStoredClientLanguage(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (!raw) return null;
  return normalizeLanguage(raw);
}

export function detectRuntimeOs(): RuntimeOs {
  if (typeof window === "undefined") return "unknown";
  const ua = (window.navigator.userAgent || "").toLowerCase();
  const platform = (window.navigator.platform || "").toLowerCase();
  if (platform.includes("win") || ua.includes("windows")) return "windows";
  if (platform.includes("mac") || ua.includes("mac os")) return "mac";
  if (platform.includes("linux") || ua.includes("linux")) return "linux";
  return "unknown";
}

export function isForceUpdateBannerEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("force_update_banner") === "1";
  } catch {
    return false;
  }
}

export function syncClientLanguage(language: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizeLanguage(language));
  window.dispatchEvent(new Event("climpire-language-change"));
}
