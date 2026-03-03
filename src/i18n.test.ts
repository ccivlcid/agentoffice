import { describe, it, expect } from "vitest";
import { normalizeLanguage, detectBrowserLanguage } from "./i18n";

describe("normalizeLanguage", () => {
  it("normalizes ko variants", () => {
    expect(normalizeLanguage("ko")).toBe("ko");
    expect(normalizeLanguage("ko-KR")).toBe("ko");
    expect(normalizeLanguage("ko_KR")).toBe("ko");
  });

  it("normalizes en variants", () => {
    expect(normalizeLanguage("en")).toBe("en");
    expect(normalizeLanguage("en-US")).toBe("en");
    expect(normalizeLanguage("en-GB")).toBe("en");
  });

  it("falls back to en for unknown", () => {
    expect(normalizeLanguage("fr")).toBe("en");
    expect(normalizeLanguage("")).toBe("en");
  });
});

describe("detectBrowserLanguage", () => {
  it("returns a valid language string", () => {
    const lang = detectBrowserLanguage();
    expect(["ko", "en", "ja", "zh"]).toContain(lang);
  });
});
