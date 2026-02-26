import { useState, useEffect, useCallback } from "react";
import type { OAuthAccountInfo } from "../../api";

export type Locale = "ko" | "en";
export type TFunction = (messages: Record<Locale, string>) => string;

export const LANGUAGE_STORAGE_KEY = "climpire.language";
export const LOCALE_TAGS: Record<Locale, string> = {
  ko: "ko-KR",
  en: "en-US",
};

export function normalizeLocale(value: string | null | undefined): Locale | null {
  const code = (value ?? "").toLowerCase();
  if (code.startsWith("ko")) return "ko";
  if (code.startsWith("en")) return "en";
  return null;
}

export function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";
  return (
    normalizeLocale(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)) ??
    normalizeLocale(window.navigator.language) ??
    "en"
  );
}

export function useI18n(preferredLocale?: string) {
  const [locale, setLocale] = useState<Locale>(
    () => normalizeLocale(preferredLocale) ?? detectLocale()
  );

  useEffect(() => {
    const preferred = normalizeLocale(preferredLocale);
    if (preferred) setLocale(preferred);
  }, [preferredLocale]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => {
      setLocale(normalizeLocale(preferredLocale) ?? detectLocale());
    };
    window.addEventListener("storage", sync);
    window.addEventListener("climpire-language-change", sync as EventListener);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(
        "climpire-language-change",
        sync as EventListener
      );
    };
  }, [preferredLocale]);

  const t = useCallback(
    (messages: Record<Locale, string>) => messages[locale] ?? messages.en,
    [locale]
  );

  return { locale, localeTag: LOCALE_TAGS[locale], t };
}

export function roleLabel(role: string, t: TFunction) {
  switch (role) {
    case "team_leader":
      return t({ ko: "팀장", en: "Team Leader" });
    case "senior":
      return t({ ko: "시니어", en: "Senior" });
    case "junior":
      return t({ ko: "주니어", en: "Junior" });
    case "intern":
      return t({ ko: "인턴", en: "Intern" });
    default:
      return role;
  }
}

export function hashSubAgentId(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getSubAgentSpriteNum(subAgentId: string): number {
  return (hashSubAgentId(`${subAgentId}:clone`) % 13) + 1;
}

export const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  idle: { label: "idle", color: "text-green-400", bg: "bg-green-500/20" },
  working: { label: "working", color: "text-blue-400", bg: "bg-blue-500/20" },
  break: { label: "break", color: "text-yellow-400", bg: "bg-yellow-500/20" },
  offline: {
    label: "offline",
    color: "text-slate-400",
    bg: "bg-slate-500/20",
  },
};

export const CLI_LABELS: Record<string, string> = {
  claude: "Claude Code",
  codex: "Codex CLI",
  gemini: "Gemini CLI",
  opencode: "OpenCode",
  copilot: "GitHub Copilot",
  antigravity: "Antigravity",
  api: "API Provider",
};

export const SUBTASK_STATUS_ICON: Record<string, string> = {
  pending: '\u23F3',
  in_progress: '\uD83D\uDD28',
  done: '\u2705',
  blocked: '\uD83D\uDEAB',
};

export function oauthAccountLabel(account: OAuthAccountInfo): string {
  return account.label || account.email || account.id.slice(0, 8);
}

export function statusLabel(status: string, t: TFunction) {
  switch (status) {
    case "idle":
      return t({ ko: "대기중", en: "Idle" });
    case "working":
      return t({ ko: "근무중", en: "Working" });
    case "break":
      return t({ ko: "휴식중", en: "Break" });
    case "offline":
      return t({ ko: "오프라인", en: "Offline" });
    default:
      return status;
  }
}

export function taskStatusLabel(status: string, t: TFunction) {
  switch (status) {
    case "inbox":
      return t({ ko: "수신함", en: "Inbox" });
    case "planned":
      return t({ ko: "계획됨", en: "Planned" });
    case "in_progress":
      return t({ ko: "진행 중", en: "In Progress" });
    case "review":
      return t({ ko: "검토", en: "Review" });
    case "done":
      return t({ ko: "완료", en: "Done" });
    case "pending":
      return t({ ko: "보류", en: "Pending" });
    case "cancelled":
      return t({ ko: "취소", en: "Cancelled" });
    default:
      return status;
  }
}

export function taskTypeLabel(type: string, t: TFunction) {
  switch (type) {
    case "general":
      return t({ ko: "일반", en: "General" });
    case "development":
      return t({ ko: "개발", en: "Development" });
    case "design":
      return t({ ko: "디자인", en: "Design" });
    case "analysis":
      return t({ ko: "분석", en: "Analysis" });
    case "presentation":
      return t({ ko: "발표", en: "Presentation" });
    case "documentation":
      return t({ ko: "문서화", en: "Documentation" });
    default:
      return type;
  }
}
