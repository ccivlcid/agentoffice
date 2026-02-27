import { Graphics, Text, TextStyle, Container } from "pixi.js";
import type { Texture } from "pixi.js";
import type { MutableRefObject } from "react";
import type { RoomRect, WallClockVisual } from "./officeViewTypes.ts";
import type { ThemeMode } from "../../ThemeContext.ts";
import {
  drawTiledFloor,
  drawRoomAtmosphere,
  drawWindow,
  drawPictureFrame,
  drawCeilingLight,
  drawTrashCan,
  drawWallClock,
} from "./officeViewDrawing.ts";
import { drawPlant } from "./officeViewDrawing2.ts";
import { drawBookshelf, drawWhiteboard } from "./officeViewDrawing3.ts";
import { DEPT_THEME_LIGHT, DEPT_THEME_DARK, LOCALE_TEXT, pickLocale } from "./officeViewPalette.ts";
import { COLS_PER_ROW, ROOMS_PER_ROW } from "./officeViewConstants.ts";
import { contrastTextColor } from "./officeViewHelpers.ts";
import { buildAgentSlot } from "./officeViewAgentSlot.ts";
import type { UiLanguage } from "../../i18n.ts";

/* ================================================================== */
/*  Compact room layout constants (3-column grid)                     */
/* ================================================================== */

const D_PAD = 10; // inner room padding (horizontal)
const D_HEADER_H = 36; // top strip for room name + count labels
const D_SLOT_H = 106; // agent slot height (accommodates 46px sprite + desk + labels)

/* How many agent columns fit in a given room width */
function agentColsForWidth(roomW: number): number {
  const available = roomW - 2 * D_PAD;
  return Math.min(COLS_PER_ROW, Math.max(1, Math.floor(available / 66)));
}

/* ================================================================== */
/*  Exported interfaces                                                */
/* ================================================================== */

export interface BuildDeptRoomsParams {
  stage: Container;
  officeW: number;
  departments: any[];
  agents: any[];
  themeRef: MutableRefObject<ThemeMode>;
  texturesRef: MutableRefObject<Record<string, Texture>>;
  spriteMapRef: MutableRefObject<Map<string, number>>;
  animItemsRef: MutableRefObject<
    Array<{
      sprite: Container;
      status: string;
      baseX: number;
      baseY: number;
      particles: Container;
      agentId?: string;
      cliProvider?: string;
      deskG?: Graphics;
      bedG?: Graphics;
      blanketG?: Graphics;
    }>
  >;
  roomRectsRef: MutableRefObject<RoomRect[]>;
  agentPosRef: MutableRefObject<Map<string, { x: number; y: number }>>;
  wallClocksRef: MutableRefObject<WallClockVisual[]>;
  localeRef: MutableRefObject<UiLanguage>;
  startY: number;
  hallwayH: number;
  customDeptThemes?: Record<string, { floor1: number; floor2: number; wall: number; accent: number }>;
  cbRef: MutableRefObject<{ onSelectAgent: (a: any) => void; onSelectDepartment: (d: any) => void }>;
  unreadAgentIds?: Set<string>;
}

export interface DeptLayoutResult {
  /** Y-coordinate right after the last department row (plus hallway gap) */
  nextY: number;
}

/* ================================================================== */
/*  Height helper (used by buildOfficeScene for totalH calculation)   */
/* ================================================================== */

export function calcDeptRoomHeight(agentCount: number, roomW?: number): number {
  const cols = agentColsForWidth(roomW ?? 250);
  const rows = Math.max(1, Math.ceil(agentCount / cols));
  return D_HEADER_H + D_PAD * 2 + rows * D_SLOT_H;
}

/* ================================================================== */
/*  Main room builder — 3-column grid layout                          */
/* ================================================================== */

export function buildDeptRooms(params: BuildDeptRoomsParams): DeptLayoutResult {
  const {
    stage,
    officeW,
    departments,
    agents,
    themeRef,
    texturesRef,
    spriteMapRef,
    animItemsRef,
    roomRectsRef,
    agentPosRef,
    wallClocksRef,
    localeRef,
    startY,
    hallwayH,
    customDeptThemes,
    cbRef,
    unreadAgentIds,
  } = params;

  const isDark = themeRef.current === "dark";
  const deptThemeMap = isDark ? DEPT_THEME_DARK : DEPT_THEME_LIGHT;
  const locale = localeRef.current as any;

  /* ── Sprite index assignment: use agent.sprite_number when set, else deterministic by sorted id ── */
  const sortedAgents = [...agents].filter((a: any) => !a.disabled).sort((a: any, b: any) => a.id.localeCompare(b.id));
  const spriteIndexMap = new Map<string, number>();
  sortedAgents.forEach((agent: any, idx) => {
    const si = Math.min(13, Math.max(1, Number(agent.sprite_number) || (idx % 13) + 1));
    spriteIndexMap.set(agent.id, si);
    spriteMapRef.current.set(agent.id, si);
  });

  /* ── Multi-column grid geometry ── */
  const roomsPerRow = ROOMS_PER_ROW;
  const baseRoomW = Math.floor(officeW / roomsPerRow);

  let currentY = startY;
  let deptIdx = 0;

  while (deptIdx < departments.length) {
    const rowDepts: any[] = departments.slice(deptIdx, deptIdx + roomsPerRow);

    /* Row height = tallest room in this row */
    const rowH = rowDepts.reduce(
      (maxH: number, dept: any) => {
        const count = agents.filter((a: any) => a.department_id === dept.id && !a.disabled).length;
        return Math.max(maxH, calcDeptRoomHeight(count, baseRoomW));
      },
      calcDeptRoomHeight(0, baseRoomW),
    );

    rowDepts.forEach((dept: any, colIdx: number) => {
      const roomX = colIdx * baseRoomW;
      /* Last room in a full row fills remaining pixels to avoid 1px gaps */
      const roomW = colIdx === roomsPerRow - 1 && rowDepts.length === roomsPerRow ? officeW - roomX : baseRoomW;
      const roomY = currentY;
      const roomH = rowH;
      const globalDeptIdx = deptIdx + colIdx;

      const deptAgents: any[] = agents.filter((a: any) => a.department_id === dept.id && !a.disabled);
      const agentCount = deptAgents.length;
      const maxCols = agentColsForWidth(roomW);
      const slotW = Math.floor((roomW - 2 * D_PAD) / maxCols);

      /* ── Theme ── */
      const customTheme = customDeptThemes?.[dept.id];
      const deptKey = (dept.id || "").toLowerCase();
      const baseTheme = deptThemeMap[deptKey] ??
        deptThemeMap["dev"] ?? { floor1: 0xd8e8f5, floor2: 0xcce1f2, wall: 0x6c96b7, accent: 0x5a9fd4 };
      const theme = customTheme ?? baseTheme;

      /* ── Room container ── */
      const room = new Container();
      room.position.set(roomX, roomY);
      stage.addChild(room);

      /* ── Floor ── */
      const floorG = new Graphics();
      drawTiledFloor(floorG, 0, 0, roomW, roomH, theme.floor1, theme.floor2);
      room.addChild(floorG);

      /* ── Wall atmosphere ── */
      drawRoomAtmosphere(room, 0, 0, roomW, roomH, theme.wall, theme.accent);

      /* ── Room border ── */
      const borderG = new Graphics();
      borderG.rect(0, 0, roomW, roomH).stroke({ width: 1.5, color: theme.accent, alpha: 0.35 });
      room.addChild(borderG);

      /* ── Windows ── */
      if (roomW >= 110) {
        drawWindow(room, 5, 16, 22, 16);
        if (roomW >= 190) drawWindow(room, roomW - 27, 16, 22, 16);
      }

      /* ── Bookshelf / whiteboard (alternating per dept) ── */
      if (roomW >= 130) {
        if (globalDeptIdx % 2 === 0) drawBookshelf(room, roomW / 2 - 14, 2);
        else drawWhiteboard(room, roomW / 2 - 19, 1);
      }

      /* ── Picture frames ── */
      if (roomW >= 160) {
        drawPictureFrame(room, roomW * 0.22, 6);
        drawPictureFrame(room, roomW * 0.68, 6);
      }

      /* ── Ceiling lights ── */
      drawCeilingLight(room, roomW * 0.33, 0, theme.accent);
      drawCeilingLight(room, roomW * 0.67, 0, theme.accent);

      /* ── Corner plants ── */
      drawPlant(room, 14, roomH - 10, globalDeptIdx % 4);
      if (roomW >= 140) drawPlant(room, roomW - 14, roomH - 10, (globalDeptIdx + 2) % 4);

      /* ── Trash can ── */
      drawTrashCan(room, roomW - 10, roomH - 10);

      /* ── Wall clock ── */
      if (roomW >= 130) {
        const clk = drawWallClock(room, roomW * 0.5, 12);
        wallClocksRef.current.push(clk);
      }

      /* ── Department name badge ── */
      const deptName = dept.name ?? dept.slug ?? `Dept ${globalDeptIdx + 1}`;
      const nameLabel = new Text({
        text: deptName.toUpperCase(),
        style: new TextStyle({
          fontSize: 8,
          fill: contrastTextColor(theme.accent),
          fontFamily: "system-ui, sans-serif",
          fontWeight: "bold",
          letterSpacing: 0.8,
        }),
      });
      nameLabel.anchor.set(0.5, 0.5);
      const badgeW = nameLabel.width + 16;
      const badgeH = 14;
      const badgeX = roomW / 2 - badgeW / 2;
      const badgeY = 12;
      const badgeG = new Graphics();
      badgeG.roundRect(badgeX, badgeY, badgeW, badgeH, 4).fill({ color: theme.accent, alpha: 0.9 });
      badgeG.roundRect(badgeX, badgeY, badgeW, badgeH, 4).stroke({ width: 0.6, color: 0xffffff, alpha: 0.15 });
      room.addChild(badgeG);
      nameLabel.position.set(roomW / 2, badgeY + badgeH / 2);
      room.addChild(nameLabel);

      /* ── People count label ── */
      const peopleLabel = new Text({
        text: `${agentCount} ${pickLocale(locale, LOCALE_TEXT.statsEmployees)}`,
        style: new TextStyle({
          fontSize: 6.5,
          fill: isDark ? 0x9090a8 : 0x7a6a80,
          fontFamily: "system-ui, sans-serif",
        }),
      });
      peopleLabel.anchor.set(0.5, 0);
      peopleLabel.position.set(roomW / 2, badgeY + badgeH + 2);
      room.addChild(peopleLabel);

      /* ── Agent desk slots ── */
      const colCount = Math.min(agentCount, maxCols);
      const totalSlotW = colCount * slotW;
      const slotOffsetX = Math.max(0, (roomW - 2 * D_PAD - totalSlotW) / 2);

      deptAgents.forEach((agent: any, agentSlotIdx: number) => {
        const col = agentSlotIdx % maxCols;
        const row = Math.floor(agentSlotIdx / maxCols);
        const slotX = D_PAD + slotOffsetX + col * slotW;
        const slotY = D_HEADER_H + D_PAD + row * D_SLOT_H;
        const spriteIdx = spriteIndexMap.get(agent.id) ?? 1;

        const { animItem, stagePos } = buildAgentSlot({
          room,
          agent,
          slotX,
          slotY,
          slotW,
          roomX,
          roomY: roomY,
          spriteIdx,
          isDark,
          locale,
          texturesRef,
          cbRef,
          unreadAgentIds,
        });
        animItemsRef.current.push(animItem);
        agentPosRef.current.set(agent.id, stagePos);
      });

      /* Room click (fires when clicking empty room area) */
      room.eventMode = "static";
      room.on("pointerdown", () => cbRef.current.onSelectDepartment(dept));

      /* Room rect stored as stage-absolute coords */
      roomRectsRef.current.push({ dept, x: roomX, y: roomY, w: roomW, h: roomH });
    });

    currentY += rowH + hallwayH;
    deptIdx += rowDepts.length;
  }

  return { nextY: currentY };
}
