import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
} from "react";
import type { ReactNode } from "react";

export type UiLanguage = "ko" | "en";
export const LANGUAGE_STORAGE_KEY = "climpire.language";
export const LANGUAGE_USER_SET_STORAGE_KEY = "climpire.language.user_set";

export type LangText = {
  ko: string;
  en: string;
  /** @deprecated removed from UI; kept for type compatibility */
  ja?: string;
  /** @deprecated removed from UI; kept for type compatibility */
  zh?: string;
};

type TranslationInput = LangText | string;

export function normalizeLanguage(value?: string | null): UiLanguage {
  const code = (value ?? "").toLowerCase().replace("_", "-");
  if (code === "ko" || code.startsWith("ko-")) return "ko";
  if (code === "en" || code.startsWith("en-")) return "en";
  return "en";
}

export function detectBrowserLanguage(): UiLanguage {
  if (typeof window === "undefined") return "en";
  const candidates = [
    ...(window.navigator.languages ?? []),
    window.navigator.language,
  ];
  for (const lang of candidates) {
    const code = (lang ?? "").toLowerCase().replace("_", "-");
    if (code === "ko" || code.startsWith("ko-")) return "ko";
    if (code === "en" || code.startsWith("en-")) return "en";
  }
  return "en";
}

export function localeFromLanguage(lang: UiLanguage): string {
  switch (lang) {
    case "ko":
      return "ko-KR";
    case "en":
      return "en-US";
    default:
      return "en-US";
  }
}

export function pickLang(lang: UiLanguage, text: LangText): string {
  switch (lang) {
    case "ko":
      return text.ko;
    case "en":
      return text.en;
    default:
      return text.en;
  }
}

export interface I18nContextValue {
  language: UiLanguage;
  locale: string;
  t: (text: TranslationInput) => string;
}

const I18nContext = createContext<I18nContextValue>({
  language: "en",
  locale: "en-US",
  t: (text) => (typeof text === "string" ? text : text.en),
});

interface I18nProviderProps {
  language?: string | null;
  children: ReactNode;
}

export function I18nProvider({ language, children }: I18nProviderProps) {
  const normalizedLanguage = normalizeLanguage(language);
  const locale = useMemo(
    () => localeFromLanguage(normalizedLanguage),
    [normalizedLanguage]
  );
  const t = useCallback(
    (text: TranslationInput) =>
      typeof text === "string" ? text : pickLang(normalizedLanguage, text),
    [normalizedLanguage]
  );

  const value = useMemo(
    () => ({
      language: normalizedLanguage,
      locale,
      t,
    }),
    [normalizedLanguage, locale, t]
  );

  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
