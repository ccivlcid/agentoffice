import { Container } from "pixi.js";
import type { ScrollAxis } from "./officeViewTypes";
import { OFFICE_PASTEL } from "./officeViewPalette";
import type { SupportedLocale } from "./officeViewTypes";
import { LOCALE_TEXT, pickLocale } from "./officeViewPalette";

/* ================================================================== */
/*  Pure helper functions                                              */
/* ================================================================== */

export function detachNode(node: Container): void {
  if (node.destroyed) return;
  node.parent?.removeChild(node);
}

/** Remove from parent AND destroy to free GPU/texture memory. */
export function destroyNode(node: Container): void {
  if (node.destroyed) return;
  node.parent?.removeChild(node);
  node.destroy({ children: true });
}

export function trackProcessedId(set: Set<string>, id: string, max = 4000): void {
  set.add(id);
  if (set.size <= max) return;
  const trimCount = set.size - max;
  let removed = 0;
  for (const key of set) {
    set.delete(key);
    removed += 1;
    if (removed >= trimCount) break;
  }
}

export function isScrollableOverflowValue(value: string): boolean {
  return value === "auto" || value === "scroll" || value === "overlay";
}

export function canScrollOnAxis(el: HTMLElement, axis: ScrollAxis): boolean {
  const style = window.getComputedStyle(el);
  if (axis === "y") {
    return isScrollableOverflowValue(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
  }
  return isScrollableOverflowValue(style.overflowX) && el.scrollWidth > el.clientWidth + 1;
}

export function findScrollContainer(start: HTMLElement | null, axis: ScrollAxis): HTMLElement | null {
  let current = start?.parentElement ?? null;
  let fallback: HTMLElement | null = null;
  while (current) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    const overflowX = style.overflowX;
    const hasScrollableStyle = axis === "y"
      ? isScrollableOverflowValue(overflowY)
      : isScrollableOverflowValue(overflowX);
    if (!fallback && hasScrollableStyle) fallback = current;
    if (canScrollOnAxis(current, axis)) return current;
    current = current.parentElement;
  }
  return fallback;
}

export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function blendColor(from: number, to: number, t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  const fr = (from >> 16) & 0xff;
  const fg = (from >> 8) & 0xff;
  const fb = from & 0xff;
  const tr = (to >> 16) & 0xff;
  const tg = (to >> 8) & 0xff;
  const tb = to & 0xff;
  const r = Math.round(fr + (tr - fr) * clamped);
  const g = Math.round(fg + (tg - fg) * clamped);
  const b = Math.round(fb + (tb - fb) * clamped);
  return (r << 16) | (g << 8) | b;
}

export function isLightColor(color: number): boolean {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150;
}

export function contrastTextColor(bgColor: number, darkColor?: number, lightColor?: number): number {
  const dark = darkColor ?? OFFICE_PASTEL.ink;
  const light = lightColor ?? 0xffffff;
  return isLightColor(bgColor) ? dark : light;
}

export function formatReset(iso: string, locale: SupportedLocale): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return pickLocale(locale, LOCALE_TEXT.soon);
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0) {
    if (locale === "ko") return `${h}시간 ${m}분`;
    return `${h}h ${m}m`;
  }
  if (locale === "ko") return `${m}분`;
  return `${m}m`;
}

export function formatPeopleCount(count: number, locale: SupportedLocale): string {
  if (locale === "ko") return `${count}명`;
  return `${count}`;
}

export function formatTaskCount(count: number, locale: SupportedLocale): string {
  if (locale === "ko") return `${count}건`;
  return `${count}`;
}
