import { useEffect, useState, useCallback } from 'react';

export type Locale = 'ko' | 'en';
export type TFunction = (messages: Record<Locale, string>) => string;

export const LANGUAGE_STORAGE_KEY = 'climpire.language';
export const LOCALE_TAGS: Record<Locale, string> = {
  ko: 'ko-KR',
  en: 'en-US',
};

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

  const t = useCallback((messages: Record<Locale, string>) => messages[locale] ?? messages.en, [locale]);

  return { locale, localeTag: LOCALE_TAGS[locale], t };
}

export function useNow(localeTag: string, t: TFunction) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const date = now.toLocaleDateString(localeTag, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  const time = now.toLocaleTimeString(localeTag, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const hour = now.getHours();
  const briefing =
    hour < 12
      ? t({ ko: '오전 브리핑', en: 'Morning Briefing' })
      : hour < 18
        ? t({ ko: '오후 운영 점검', en: 'Afternoon Ops Check' })
        : t({ ko: '저녁 마감 점검', en: 'Evening Wrap-up' });

  return { date, time, briefing };
}

export function timeAgo(timestamp: number, localeTag: string): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  const rtf = new Intl.RelativeTimeFormat(localeTag, { numeric: 'auto' });
  if (seconds < 60) return rtf.format(-seconds, 'second');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  const days = Math.floor(hours / 24);
  return rtf.format(-days, 'day');
}

// ─── RANK TIER SYSTEM ───
export const RANK_TIERS = [
  { name: 'BRONZE',   nameKo: '브론즈',   minXp: 0,     color: '#CD7F32', glow: 'rgba(205,127,50,0.35)', label: 'B' },
  { name: 'SILVER',   nameKo: '실버',     minXp: 100,   color: '#C0C0C0', glow: 'rgba(192,192,192,0.35)', label: 'S' },
  { name: 'GOLD',     nameKo: '골드',     minXp: 500,   color: '#FFD700', glow: 'rgba(255,215,0,0.35)',   label: 'G' },
  { name: 'PLATINUM', nameKo: '플래티넘', minXp: 2000,  color: '#00c8b4', glow: 'rgba(0,200,180,0.35)',   label: 'P' },
  { name: 'DIAMOND',  nameKo: '다이아',   minXp: 5000,  color: '#7df9ff', glow: 'rgba(125,249,255,0.35)', label: 'D' },
  { name: 'MASTER',   nameKo: '마스터',   minXp: 15000, color: '#c45ff6', glow: 'rgba(196,95,246,0.35)',  label: 'M' },
];

export function getRankTier(xp: number) {
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (xp >= RANK_TIERS[i].minXp) return { ...RANK_TIERS[i], level: i };
  }
  return { ...RANK_TIERS[0], level: 0 };
}

export const STATUS_LABELS: Record<string, { color: string; dot: string }> = {
  inbox:       { color: 'bg-slate-500/20 text-slate-200 border-slate-400/30', dot: 'bg-slate-400' },
  planned:     { color: 'bg-blue-500/20 text-blue-100 border-blue-400/30',   dot: 'bg-blue-400' },
  in_progress: { color: 'bg-amber-500/20 text-amber-100 border-amber-400/30', dot: 'bg-amber-400' },
  review:      { color: 'bg-violet-500/20 text-violet-100 border-violet-400/30', dot: 'bg-violet-400' },
  done:        { color: 'bg-emerald-500/20 text-emerald-100 border-emerald-400/30', dot: 'bg-emerald-400' },
  pending:     { color: 'bg-orange-500/20 text-orange-100 border-orange-400/30', dot: 'bg-orange-400' },
  cancelled:   { color: 'bg-rose-500/20 text-rose-100 border-rose-400/30',   dot: 'bg-rose-400' },
};

export function taskStatusLabel(status: string, t: TFunction) {
  switch (status) {
    case 'inbox':
      return t({ ko: '수신함', en: 'Inbox' });
    case 'planned':
      return t({ ko: '계획됨', en: 'Planned' });
    case 'in_progress':
      return t({ ko: '진행 중', en: 'In Progress' });
    case 'review':
      return t({ ko: '검토 중', en: 'Review' });
    case 'done':
      return t({ ko: '완료', en: 'Done' });
    case 'pending':
      return t({ ko: '보류', en: 'Pending' });
    case 'cancelled':
      return t({ ko: '취소됨', en: 'Cancelled' });
    default:
      return status;
  }
}

export const DEPT_COLORS = [
  { bar: 'from-blue-500 to-cyan-400', badge: 'bg-blue-500/20 text-blue-200 border-blue-400/30' },
  { bar: 'from-violet-500 to-fuchsia-400', badge: 'bg-violet-500/20 text-violet-200 border-violet-400/30' },
  { bar: 'from-emerald-500 to-teal-400', badge: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30' },
  { bar: 'from-amber-500 to-orange-400', badge: 'bg-amber-500/20 text-amber-100 border-amber-400/30' },
  { bar: 'from-rose-500 to-pink-400', badge: 'bg-rose-500/20 text-rose-100 border-rose-400/30' },
  { bar: 'from-cyan-500 to-sky-400', badge: 'bg-cyan-500/20 text-cyan-100 border-cyan-400/30' },
  { bar: 'from-orange-500 to-red-400', badge: 'bg-orange-500/20 text-orange-100 border-orange-400/30' },
  { bar: 'from-teal-500 to-lime-400', badge: 'bg-teal-500/20 text-teal-100 border-teal-400/30' },
];
