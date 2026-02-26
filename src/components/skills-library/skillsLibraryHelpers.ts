import { useState, useEffect, useCallback } from "react";
import type {
  SkillEntry,
  SkillLearnJob,
  SkillLearnProvider,
  SkillHistoryProvider,
} from "../../api";
import type { AgentRole, Agent } from "../../types";

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface CategorizedSkill extends SkillEntry {
  category: string;
  installsDisplay: string;
}

export type Locale = "ko" | "en";
export type TFunction = (messages: Record<Locale, string>) => string;

/* ================================================================== */
/*  i18n                                                               */
/* ================================================================== */

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
      window.removeEventListener("climpire-language-change", sync as EventListener);
    };
  }, [preferredLocale]);

  const t = useCallback(
    (messages: Record<Locale, string>) => messages[locale] ?? messages.en,
    [locale]
  );

  return { locale, localeTag: LOCALE_TAGS[locale], t };
}

/* ================================================================== */
/*  Formatting helpers                                                 */
/* ================================================================== */

export function formatInstalls(n: number, localeTag: string): string {
  return new Intl.NumberFormat(localeTag, {
    notation: n >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(n);
}

export function formatFirstSeen(value: string, localeTag: string): string {
  if (!value) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(localeTag, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

export function localizeAuditStatus(status: string, t: TFunction): string {
  const normalized = status.toLowerCase();
  if (normalized === "pass") return t({ ko: "통과", en: "Pass" });
  if (normalized === "warn") return t({ ko: "경고", en: "Warn" });
  if (normalized === "pending") return t({ ko: "대기", en: "Pending" });
  if (normalized === "fail") return t({ ko: "실패", en: "Fail" });
  return status;
}

/* ================================================================== */
/*  Categories                                                         */
/* ================================================================== */

export const CATEGORIES = [
  "All", "Frontend", "Backend", "Design", "AI & Agent", "Marketing",
  "Testing & QA", "DevOps", "Productivity", "Architecture", "Security", "Other",
];

/** 카테고리 아이콘은 constants/icons SKILL_CATEGORY_ICONS 사용 (lucide) */
export const CATEGORY_ICONS: Record<string, string> = {};

export const CATEGORY_COLORS: Record<string, string> = {
  Frontend: "text-blue-400 bg-blue-500/15 border-blue-500/30",
  Backend: "text-green-400 bg-green-500/15 border-green-500/30",
  Design: "text-pink-400 bg-pink-500/15 border-pink-500/30",
  "AI & Agent": "text-purple-400 bg-purple-500/15 border-purple-500/30",
  Marketing: "text-amber-400 bg-amber-500/15 border-amber-500/30",
  "Testing & QA": "text-cyan-400 bg-cyan-500/15 border-cyan-500/30",
  DevOps: "text-orange-400 bg-orange-500/15 border-orange-500/30",
  Productivity: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
  Architecture: "text-indigo-400 bg-indigo-500/15 border-indigo-500/30",
  Security: "text-red-400 bg-red-500/15 border-red-500/30",
  Other: "text-slate-400 bg-slate-500/15 border-slate-500/30",
};

export function categoryLabel(category: string, t: TFunction) {
  switch (category) {
    case "All": return t({ ko: "전체", en: "All" });
    case "Frontend": return t({ ko: "프론트엔드", en: "Frontend" });
    case "Backend": return t({ ko: "백엔드", en: "Backend" });
    case "Design": return t({ ko: "디자인", en: "Design" });
    case "AI & Agent": return t({ ko: "AI & 에이전트", en: "AI & Agent" });
    case "Marketing": return t({ ko: "마케팅", en: "Marketing" });
    case "Testing & QA": return t({ ko: "테스트 & QA", en: "Testing & QA" });
    case "DevOps": return t({ ko: "데브옵스", en: "DevOps" });
    case "Productivity": return t({ ko: "생산성", en: "Productivity" });
    case "Architecture": return t({ ko: "아키텍처", en: "Architecture" });
    case "Security": return t({ ko: "보안", en: "Security" });
    case "Other": return t({ ko: "기타", en: "Other" });
    default: return category;
  }
}

/** 랭크 뱃지: label(1/2/3/* 또는 빈 문자열) + Tailwind color. 메달은 CSS 원형 뱃지로 렌더 */
export function getRankBadge(rank: number): { label: string; color: string; isMedal: boolean } {
  if (rank === 1) return { label: "1", color: "bg-yellow-400 text-yellow-900", isMedal: true };
  if (rank === 2) return { label: "2", color: "bg-slate-300 text-slate-700", isMedal: true };
  if (rank === 3) return { label: "3", color: "bg-amber-600 text-white", isMedal: true };
  if (rank <= 10) return { label: "*", color: "text-amber-400", isMedal: false };
  if (rank <= 50) return { label: "*", color: "text-blue-400", isMedal: false };
  return { label: "", color: "text-slate-500", isMedal: false };
}

/* ================================================================== */
/*  Provider / role helpers                                            */
/* ================================================================== */

export const LEARN_PROVIDER_ORDER: SkillLearnProvider[] = ["claude", "codex", "gemini", "opencode"];
export const LEARNED_PROVIDER_ORDER: SkillHistoryProvider[] = [
  "claude", "codex", "gemini", "opencode", "copilot", "antigravity", "api",
];

export type UnlearnEffect = "pot" | "hammer";

export const ROLE_ORDER: Record<AgentRole, number> = {
  team_leader: 0, senior: 1, junior: 2, intern: 3,
};

export function roleLabel(role: AgentRole, t: TFunction): string {
  if (role === "team_leader") return t({ ko: "팀장", en: "Team Lead" });
  if (role === "senior") return t({ ko: "시니어", en: "Senior" });
  if (role === "junior") return t({ ko: "주니어", en: "Junior" });
  return t({ ko: "인턴", en: "Intern" });
}

export function providerLabel(provider: SkillLearnProvider): string {
  if (provider === "claude") return "Claude Code";
  if (provider === "codex") return "Codex";
  if (provider === "gemini") return "Gemini";
  return "OpenCode";
}

export function learnedProviderLabel(provider: SkillHistoryProvider): string {
  if (provider === "claude") return "Claude Code";
  if (provider === "codex") return "Codex CLI";
  if (provider === "gemini") return "Gemini CLI";
  if (provider === "opencode") return "OpenCode";
  if (provider === "copilot") return "GitHub Copilot";
  if (provider === "antigravity") return "Antigravity";
  return "API Provider";
}

export function learningStatusLabel(status: SkillLearnJob["status"] | null, t: TFunction): string {
  if (status === "queued") return t({ ko: "대기중", en: "Queued" });
  if (status === "running") return t({ ko: "학습중", en: "Running" });
  if (status === "succeeded") return t({ ko: "완료", en: "Succeeded" });
  if (status === "failed") return t({ ko: "실패", en: "Failed" });
  return "-";
}

export function pickRepresentativeForProvider(agents: Agent[], provider: Agent["cli_provider"]): Agent | null {
  const candidates = agents.filter((agent) => agent.cli_provider === provider);
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => {
    const roleGap = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
    if (roleGap !== 0) return roleGap;
    if (b.stats_xp !== a.stats_xp) return b.stats_xp - a.stats_xp;
    return a.id.localeCompare(b.id);
  });
  return sorted[0];
}
