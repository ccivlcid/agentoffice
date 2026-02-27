import type { Graphics } from "pixi.js";
import type { MutableRefObject } from "react";
import type { RoomRect } from "./officeViewTypes.ts";
import { DEPT_THEME, DEFAULT_CEO_THEME, DEFAULT_BREAK_THEME } from "./officeViewPalette.ts";

/* ================================================================== */
/*  Highlight overlay tick — extracted from officeViewAnimTick.ts       */
/* ================================================================== */

export interface HighlightTickParams {
  tick: number;
  hl: Graphics;
  themeHighlightTargetIdRef: MutableRefObject<string | null>;
  ceoOfficeRectRef: MutableRefObject<{ x: number; y: number; w: number; h: number } | null>;
  breakRoomRectRef: MutableRefObject<{ x: number; y: number; w: number; h: number } | null>;
  roomRectsRef: MutableRefObject<RoomRect[]>;
  dataRef: MutableRefObject<{ customDeptThemes?: Record<string, any>; [k: string]: any }>;
  ceoPosRef: MutableRefObject<{ x: number; y: number }>;
  blendColor: (a: number, b: number, t: number) => number;
}

export function tickHighlightOverlay(p: HighlightTickParams): void {
  const {
    tick,
    hl,
    themeHighlightTargetIdRef,
    ceoOfficeRectRef,
    breakRoomRectRef,
    roomRectsRef,
    dataRef,
    ceoPosRef,
    blendColor,
  } = p;
  hl.clear();

  /* Theme customisation highlight ring */
  const activeThemeTargetId = themeHighlightTargetIdRef.current;
  if (activeThemeTargetId) {
    const pulse = 0.55 + Math.sin(tick * 0.08) * 0.2;
    let targetRect: { x: number; y: number; w: number; h: number } | null = null;
    let targetAccent = DEPT_THEME.dev?.accent ?? 0x6688ff;
    if (activeThemeTargetId === "ceoOffice") {
      targetRect = ceoOfficeRectRef.current;
      targetAccent = dataRef.current.customDeptThemes?.ceoOffice?.accent ?? DEFAULT_CEO_THEME.accent;
    } else if (activeThemeTargetId === "breakRoom") {
      targetRect = breakRoomRectRef.current;
      targetAccent = dataRef.current.customDeptThemes?.breakRoom?.accent ?? DEFAULT_BREAK_THEME.accent;
    } else {
      const targetRoom = roomRectsRef.current.find((r: RoomRect) => r.dept.id === activeThemeTargetId);
      if (targetRoom) {
        targetRect = { x: targetRoom.x, y: targetRoom.y, w: targetRoom.w, h: targetRoom.h };
        const targetTheme =
          dataRef.current.customDeptThemes?.[activeThemeTargetId] || DEPT_THEME[activeThemeTargetId] || DEPT_THEME.dev;
        targetAccent = targetTheme?.accent ?? 0x6688ff;
      }
    }
    if (targetRect) {
      hl.roundRect(targetRect.x - 4, targetRect.y - 4, targetRect.w + 8, targetRect.h + 8, 7).stroke({
        width: 3.5,
        color: targetAccent,
        alpha: pulse,
      });
      hl.roundRect(targetRect.x - 6, targetRect.y - 6, targetRect.w + 12, targetRect.h + 12, 9).stroke({
        width: 1.2,
        color: blendColor(targetAccent, 0xffffff, 0.22),
        alpha: 0.35 + Math.sin(tick * 0.06) * 0.08,
      });
    }
  }

  /* CEO proximity highlight */
  const cx = ceoPosRef.current.x,
    cy = ceoPosRef.current.y;
  let highlighted = false;
  for (const r of roomRectsRef.current) {
    if (cx >= r.x && cx <= r.x + r.w && cy >= r.y - 10 && cy <= r.y + r.h) {
      const theme = dataRef.current.customDeptThemes?.[r.dept.id] || DEPT_THEME[r.dept.id] || DEPT_THEME.dev;
      hl.roundRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 5).stroke({
        width: 3,
        color: theme?.accent ?? 0x6688ff,
        alpha: 0.5 + Math.sin(tick * 0.08) * 0.2,
      });
      highlighted = true;
      break;
    }
  }
  if (!highlighted) {
    const br = breakRoomRectRef.current;
    if (br && cx >= br.x && cx <= br.x + br.w && cy >= br.y - 10 && cy <= br.y + br.h) {
      const breakThemeHighlight = dataRef.current.customDeptThemes?.breakRoom ?? DEFAULT_BREAK_THEME;
      hl.roundRect(br.x - 2, br.y - 2, br.w + 4, br.h + 4, 5).stroke({
        width: 3,
        color: breakThemeHighlight.accent,
        alpha: 0.5 + Math.sin(tick * 0.08) * 0.2,
      });
      highlighted = true;
    }
  }
  if (!highlighted) {
    const cr = ceoOfficeRectRef.current;
    if (cr && cx >= cr.x && cx <= cr.x + cr.w && cy >= cr.y - 10 && cy <= cr.y + cr.h) {
      const ceoThemeHighlight = dataRef.current.customDeptThemes?.ceoOffice ?? DEFAULT_CEO_THEME;
      hl.roundRect(cr.x - 2, cr.y - 2, cr.w + 4, cr.h + 4, 5).stroke({
        width: 3,
        color: ceoThemeHighlight.accent,
        alpha: 0.5 + Math.sin(tick * 0.08) * 0.2,
      });
    }
  }
}
