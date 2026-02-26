import { useState, useCallback, useEffect } from 'react';
import type { TaskStatus, TaskType } from '../../types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Locale = 'ko' | 'en';
export type TFunction = (messages: Record<Locale, string>) => string;

export type HideableStatus = typeof HIDEABLE_STATUSES[number];

export type CreateTaskDraft = {
  id: string;
  title: string;
  description: string;
  departmentId: string;
  taskType: TaskType;
  priority: number;
  assignAgentId: string;
  projectId: string;
  projectQuery: string;
  createNewProjectMode: boolean;
  newProjectPath: string;
  updatedAt: number;
};

export type MissingPathPrompt = {
  normalizedPath: string;
  canCreate: boolean;
  nearestExistingParent: string | null;
};

export type FormFeedback = {
  tone: 'error' | 'info';
  message: string;
};

export type ManualPathEntry = {
  name: string;
  path: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

export const LANGUAGE_STORAGE_KEY = 'climpire.language';
export const TASK_CREATE_DRAFTS_STORAGE_KEY = 'climpire.taskCreateDrafts';
export const HIDEABLE_STATUSES = ['done', 'pending', 'cancelled'] as const;

export const LOCALE_TAGS: Record<Locale, string> = {
  ko: 'ko-KR',
  en: 'en-US',
};

export const COLUMNS: {
  status: TaskStatus;
  headerBg: string;
  borderColor: string;
  dotColor: string;
}[] = [
  { status: 'inbox', headerBg: 'bg-slate-800', borderColor: 'border-slate-600', dotColor: 'bg-slate-400' },
  { status: 'planned', headerBg: 'bg-blue-900', borderColor: 'border-blue-700', dotColor: 'bg-blue-400' },
  { status: 'collaborating', headerBg: 'bg-indigo-900', borderColor: 'border-indigo-700', dotColor: 'bg-indigo-400' },
  { status: 'in_progress', headerBg: 'bg-amber-900', borderColor: 'border-amber-700', dotColor: 'bg-amber-400' },
  { status: 'review', headerBg: 'bg-purple-900', borderColor: 'border-purple-700', dotColor: 'bg-purple-400' },
  { status: 'done', headerBg: 'bg-green-900', borderColor: 'border-green-700', dotColor: 'bg-green-400' },
  { status: 'pending', headerBg: 'bg-orange-900', borderColor: 'border-orange-700', dotColor: 'bg-orange-400' },
  { status: 'cancelled', headerBg: 'bg-red-900', borderColor: 'border-red-700', dotColor: 'bg-red-400' },
];

export const STATUS_OPTIONS: TaskStatus[] = [
  'inbox', 'planned', 'collaborating', 'in_progress', 'review', 'done', 'pending', 'cancelled',
];

export const TASK_TYPE_OPTIONS: { value: TaskType; color: string }[] = [
  { value: 'general', color: 'bg-slate-700 text-slate-300' },
  { value: 'development', color: 'bg-cyan-900 text-cyan-300' },
  { value: 'design', color: 'bg-pink-900 text-pink-300' },
  { value: 'analysis', color: 'bg-indigo-900 text-indigo-300' },
  { value: 'presentation', color: 'bg-orange-900 text-orange-300' },
  { value: 'documentation', color: 'bg-teal-900 text-teal-300' },
];

// ── Helper functions ───────────────────────────────────────────────────────────

export function isHideableStatus(status: TaskStatus): status is HideableStatus {
  return (HIDEABLE_STATUSES as readonly TaskStatus[]).includes(status);
}

export function createDraftId(): string {
  if (typeof globalThis !== 'undefined' && typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeTaskType(value: unknown): TaskType {
  if (value === 'general' || value === 'development' || value === 'design'
    || value === 'analysis' || value === 'presentation' || value === 'documentation') {
    return value;
  }
  return 'general';
}

export function loadCreateTaskDrafts(): CreateTaskDraft[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(TASK_CREATE_DRAFTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row) => typeof row === 'object' && row !== null)
      .map((row) => {
        const r = row as Record<string, unknown>;
        return {
          id: typeof r.id === 'string' && r.id ? r.id : createDraftId(),
          title: typeof r.title === 'string' ? r.title : '',
          description: typeof r.description === 'string' ? r.description : '',
          departmentId: typeof r.departmentId === 'string' ? r.departmentId : '',
          taskType: normalizeTaskType(r.taskType),
          priority: typeof r.priority === 'number' ? Math.min(Math.max(Math.trunc(r.priority), 1), 5) : 3,
          assignAgentId: typeof r.assignAgentId === 'string' ? r.assignAgentId : '',
          projectId: typeof r.projectId === 'string' ? r.projectId : '',
          projectQuery: typeof r.projectQuery === 'string' ? r.projectQuery : '',
          createNewProjectMode: Boolean(r.createNewProjectMode),
          newProjectPath: typeof r.newProjectPath === 'string' ? r.newProjectPath : '',
          updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : Date.now(),
        } satisfies CreateTaskDraft;
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 20);
  } catch {
    return [];
  }
}

export function saveCreateTaskDrafts(drafts: CreateTaskDraft[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    TASK_CREATE_DRAFTS_STORAGE_KEY,
    JSON.stringify(drafts.slice(0, 20)),
  );
}

export function normalizeLocale(value: string | null | undefined): Locale | null {
  const code = (value ?? '').toLowerCase();
  if (code.startsWith('ko')) return 'ko';
  if (code.startsWith('en')) return 'en';
  return null;
}

export function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  return (
    normalizeLocale(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)) ??
    normalizeLocale(window.navigator.language) ??
    'en'
  );
}

export function useI18n(preferredLocale?: string) {
  const [locale, setLocale] = useState<Locale>(() => normalizeLocale(preferredLocale) ?? detectLocale());

  useEffect(() => {
    const preferred = normalizeLocale(preferredLocale);
    if (preferred) setLocale(preferred);
  }, [preferredLocale]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => {
      setLocale(normalizeLocale(preferredLocale) ?? detectLocale());
    };
    window.addEventListener('storage', sync);
    window.addEventListener('climpire-language-change', sync as EventListener);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('climpire-language-change', sync as EventListener);
    };
  }, [preferredLocale]);

  const t = useCallback(
    (messages: Record<Locale, string>) => messages[locale] ?? messages.en,
    [locale],
  );

  return { locale, localeTag: LOCALE_TAGS[locale], t };
}

// ── Post-it color scheme per task type ────────────────────────────────────────

export interface PostitColor {
  dark: string;
  light: string;
  foldDark: string;
  foldLight: string;
  tapeDark: string;
  tapeLight: string;
}

export const POSTIT_COLORS: Record<TaskType, PostitColor> = {
  general: { dark: "#b8a742", light: "#fef08a", foldDark: "#9a8a30", foldLight: "#eab308", tapeDark: "#d4c96080", tapeLight: "#fde68a90" },
  development: { dark: "#2e6b8a", light: "#bae6fd", foldDark: "#1e5570", foldLight: "#38bdf8", tapeDark: "#5ba3c680", tapeLight: "#7dd3fc90" },
  design: { dark: "#8b3a6a", light: "#fbcfe8", foldDark: "#6f2d55", foldLight: "#ec4899", tapeDark: "#c77daa80", tapeLight: "#f9a8d490" },
  analysis: { dark: "#5b4a8a", light: "#e0d4fd", foldDark: "#483a70", foldLight: "#a78bfa", tapeDark: "#8b78b880", tapeLight: "#c4b5fd90" },
  presentation: { dark: "#a0652e", light: "#fed7aa", foldDark: "#845020", foldLight: "#f97316", tapeDark: "#c99a6080", tapeLight: "#fdba7490" },
  documentation: { dark: "#2e7a6a", light: "#ccfbf1", foldDark: "#1e6050", foldLight: "#14b8a6", tapeDark: "#5baa9a80", tapeLight: "#5eead490" },
};

/** Deterministic rotation angle (-2 to +2 degrees) seeded by task ID. */
export function stickyRotation(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return (h % 500) / 250;
}

// ── Label / badge helpers ──────────────────────────────────────────────────────

export function taskStatusLabel(status: TaskStatus, t: TFunction) {
  switch (status) {
    case 'inbox': return t({ ko: '수신함', en: 'Inbox' });
    case 'planned': return t({ ko: '계획됨', en: 'Planned' });
    case 'in_progress': return t({ ko: '진행 중', en: 'In Progress' });
    case 'review': return t({ ko: '검토', en: 'Review' });
    case 'done': return t({ ko: '완료', en: 'Done' });
    case 'pending': return t({ ko: '보류', en: 'Pending' });
    case 'cancelled': return t({ ko: '취소', en: 'Cancelled' });
    default: return status;
  }
}

export function taskTypeLabel(type: TaskType, t: TFunction) {
  switch (type) {
    case 'general': return t({ ko: '일반', en: 'General' });
    case 'development': return t({ ko: '개발', en: 'Development' });
    case 'design': return t({ ko: '디자인', en: 'Design' });
    case 'analysis': return t({ ko: '분석', en: 'Analysis' });
    case 'presentation': return t({ ko: '발표', en: 'Presentation' });
    case 'documentation': return t({ ko: '문서화', en: 'Documentation' });
    default: return type;
  }
}

export function getTaskTypeBadge(type: TaskType, t: TFunction) {
  const option = TASK_TYPE_OPTIONS.find((entry) => entry.value === type) ?? TASK_TYPE_OPTIONS[0];
  return { ...option, label: taskTypeLabel(option.value, t) };
}

/** 우선순위 수준별 도트용 Tailwind 클래스 (1–5). w-2 h-2 rounded-full과 함께 사용 */
export function priorityColor(p: number) {
  if (p >= 4) return 'bg-red-500';
  if (p >= 2) return 'bg-yellow-500';
  return 'bg-green-500';
}

export function priorityLabel(p: number, t: TFunction) {
  if (p >= 4) return t({ ko: '높음', en: 'High' });
  if (p >= 2) return t({ ko: '중간', en: 'Medium' });
  return t({ ko: '낮음', en: 'Low' });
}

export function timeAgo(ts: number, localeTag: string): string {
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  const rtf = new Intl.RelativeTimeFormat(localeTag, { numeric: 'auto' });
  if (diffSec < 60) return rtf.format(-diffSec, 'second');
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return rtf.format(-diffMin, 'minute');
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return rtf.format(-diffH, 'hour');
  return rtf.format(-Math.floor(diffH / 24), 'day');
}
