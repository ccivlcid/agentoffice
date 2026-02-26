/**
 * OfficeRoomManager용 테마 타입·상수·색상 유틸.
 * 300줄 규칙에 따라 OfficeRoomManager.tsx에서 분리.
 */

export type DeptTheme = { floor1: number; floor2: number; wall: number; accent: number };

export const DEFAULT_THEMES: Record<string, DeptTheme> = {
  dev:        { floor1: 0xd8e8f5, floor2: 0xcce1f2, wall: 0x6c96b7, accent: 0x5a9fd4 },
  design:     { floor1: 0xe8def2, floor2: 0xe1d4ee, wall: 0x9378ad, accent: 0x9a6fc4 },
  planning:   { floor1: 0xf0e1c5, floor2: 0xeddaba, wall: 0xae9871, accent: 0xd4a85a },
  operations: { floor1: 0xd0eede, floor2: 0xc4ead5, wall: 0x6eaa89, accent: 0x5ac48a },
  qa:         { floor1: 0xf0cbcb, floor2: 0xedc0c0, wall: 0xae7979, accent: 0xd46a6a },
  devsecops:  { floor1: 0xf0d5c5, floor2: 0xedcdba, wall: 0xae8871, accent: 0xd4885a },
  ceoOffice:  { floor1: 0xe5d9b9, floor2: 0xdfd0a8, wall: 0x998243, accent: 0xa77d0c },
  breakRoom:  { floor1: 0xf7e2b7, floor2: 0xf6dead, wall: 0xa99c83, accent: 0xf0c878 },
};

export const DEFAULT_TONE = 50;

export const labels = {
  title:    { ko: "사무실 관리",     en: "Office Manager" },
  accent:   { ko: "메인 색상",       en: "Main Color" },
  tone:     { ko: "톤 (밝기)",       en: "Tone (Brightness)" },
  reset:    { ko: "초기화",          en: "Reset" },
  resetAll: { ko: "전체 초기화",     en: "Reset All" },
  close:    { ko: "닫기",            en: "Close" },
  presets:  { ko: "프리셋",          en: "Presets" },
};

export function numToHex(n: number): string {
  return "#" + n.toString(16).padStart(6, "0");
}

export function hexToNum(h: string): number {
  return parseInt(h.replace("#", ""), 16);
}

function blendColor(from: number, to: number, t: number): number {
  const c = Math.max(0, Math.min(1, t));
  const fr = (from >> 16) & 0xff, fg = (from >> 8) & 0xff, fb = from & 0xff;
  const tr = (to >> 16) & 0xff,   tg = (to >> 8) & 0xff,   tb = to & 0xff;
  return (
    (Math.round(fr + (tr - fr) * c) << 16) |
    (Math.round(fg + (tg - fg) * c) << 8)  |
     Math.round(fb + (tb - fb) * c)
  );
}

const TONE_PRESET_STEPS = [15, 25, 35, 45, 55, 65, 75, 85] as const;

export function deriveTheme(accent: number, tone: number): DeptTheme {
  const t = tone / 100;
  return {
    accent,
    floor1: blendColor(accent, 0xffffff, 0.85 - t * 0.004 * 100),
    floor2: blendColor(accent, 0xffffff, 0.78 - t * 0.004 * 100),
    wall:   blendColor(accent, 0x888888, 0.3  + t * 0.004 * 100),
  };
}

export function generateTonePresets(accent: number): Array<{ tone: number; swatch: number }> {
  return TONE_PRESET_STEPS.map((tone) => ({
    tone,
    swatch: deriveTheme(accent, tone).wall,
  }));
}

/** 기존 테마에서 tone 값 역추론 (기본 50) */
export function inferTone(theme: DeptTheme): number {
  const ar = (theme.accent >> 16) & 0xff;
  const af = (theme.floor1 >> 16) & 0xff;
  if (ar === 0xff) return DEFAULT_TONE;
  const r = (af - ar) / (0xff - ar);
  const tone = Math.round(((0.85 - r) / 0.4) * 100);
  return Math.max(0, Math.min(100, isNaN(tone) ? DEFAULT_TONE : tone));
}

export interface DeptState {
  accent: number;
  tone: number;
}

export function initDeptState(
  deptId: string,
  customThemes: Record<string, DeptTheme>
): DeptState {
  const theme = customThemes[deptId] ?? DEFAULT_THEMES[deptId];
  if (!theme) return { accent: 0x5a9fd4, tone: DEFAULT_TONE };
  return { accent: theme.accent, tone: inferTone(theme) };
}
