import { Graphics, Text, TextStyle, Container, Sprite } from "pixi.js";
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
import { drawDesk, drawChair, drawPlant } from "./officeViewDrawing2.ts";
import { drawBookshelf, drawWhiteboard } from "./officeViewDrawing3.ts";
import {
  DEPT_THEME_LIGHT,
  DEPT_THEME_DARK,
  LOCALE_TEXT,
  pickLocale,
} from "./officeViewPalette.ts";
import {
  COLS_PER_ROW,
  DESK_W,
  DESK_H,
  ROOMS_PER_ROW,
} from "./officeViewConstants.ts";
import { hashStr, contrastTextColor } from "./officeViewHelpers.ts";
import type { UiLanguage } from "../../i18n.ts";

/* ================================================================== */
/*  Compact room layout constants (3-column grid)                     */
/* ================================================================== */

const D_PAD = 10;         // inner room padding (horizontal)
const D_HEADER_H = 36;    // top strip for room name + count labels
const D_SLOT_H = 106;     // agent slot height (accommodates 46px sprite + desk + labels)

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
  animItemsRef: MutableRefObject<Array<{
    sprite: Container; status: string;
    baseX: number; baseY: number; particles: Container;
    agentId?: string; cliProvider?: string;
    deskG?: Graphics; bedG?: Graphics; blanketG?: Graphics;
  }>>;
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
    stage, officeW, departments, agents, themeRef, texturesRef,
    spriteMapRef, animItemsRef, roomRectsRef, agentPosRef,
    wallClocksRef, localeRef, startY, hallwayH, customDeptThemes, cbRef,
    unreadAgentIds,
  } = params;

  const isDark = themeRef.current === "dark";
  const deptThemeMap = isDark ? DEPT_THEME_DARK : DEPT_THEME_LIGHT;
  const locale = localeRef.current as any;

  /* ── Sprite index assignment (deterministic, based on sorted agent ids) ── */
  const sortedAgentIds = [...agents]
    .filter((a: any) => !a.disabled)
    .sort((a: any, b: any) => a.id.localeCompare(b.id))
    .map((a: any) => a.id);
  const spriteIndexMap = new Map<string, number>();
  sortedAgentIds.forEach((id, idx) => {
    const si = (idx % 13) + 1;
    spriteIndexMap.set(id, si);
    spriteMapRef.current.set(id, si);
  });

  /* ── Multi-column grid geometry ── */
  const roomsPerRow = ROOMS_PER_ROW;
  const baseRoomW = Math.floor(officeW / roomsPerRow);

  let currentY = startY;
  let deptIdx = 0;

  while (deptIdx < departments.length) {
    const rowDepts: any[] = departments.slice(deptIdx, deptIdx + roomsPerRow);

    /* Row height = tallest room in this row */
    const rowH = rowDepts.reduce((maxH: number, dept: any) => {
      const count = agents.filter((a: any) => a.department_id === dept.id && !a.disabled).length;
      return Math.max(maxH, calcDeptRoomHeight(count, baseRoomW));
    }, calcDeptRoomHeight(0, baseRoomW));

    rowDepts.forEach((dept: any, colIdx: number) => {
      const roomX = colIdx * baseRoomW;
      /* Last room in a full row fills remaining pixels to avoid 1px gaps */
      const roomW = (colIdx === roomsPerRow - 1 && rowDepts.length === roomsPerRow)
        ? officeW - roomX
        : baseRoomW;
      const roomY = currentY;
      const roomH = rowH;
      const globalDeptIdx = deptIdx + colIdx;

      const deptAgents: any[] = agents.filter(
        (a: any) => a.department_id === dept.id && !a.disabled,
      );
      const agentCount = deptAgents.length;
      const maxCols = agentColsForWidth(roomW);
      const slotW = Math.floor((roomW - 2 * D_PAD) / maxCols);

      /* ── Theme ── */
      const customTheme = customDeptThemes?.[dept.id];
      const deptKey = (dept.id || "").toLowerCase();
      const baseTheme = deptThemeMap[deptKey]
        ?? deptThemeMap["dev"]
        ?? { floor1: 0xd8e8f5, floor2: 0xcce1f2, wall: 0x6c96b7, accent: 0x5a9fd4 };
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

        /* Desk — centered horizontally in slot */
        const deskX = slotX + (slotW - DESK_W) / 2;
        const deskY = slotY + D_SLOT_H - DESK_H - 14;
        const working = agent.status === "working";
        const deskG = drawDesk(room, deskX, deskY, working);

        /* Chair */
        const chairColors = [0x8a7a9a, 0x7a9a8a, 0x9a8a7a, 0x7a8a9a, 0x9a7a8a];
        drawChair(room, deskX + DESK_W / 2, deskY + DESK_H + 8,
          chairColors[hashStr(agent.id) % chairColors.length]);

        /* Agent sprite container */
        const baseX = deskX + DESK_W / 2;
        const baseY = deskY - 8;
        const spriteContainer = new Container();
        spriteContainer.position.set(baseX, baseY);

        const spriteIdx = spriteIndexMap.get(agent.id) ?? 1;
        const tex = texturesRef.current[`${spriteIdx}-D-1`] as Texture | undefined;
        if (tex) {
          const sp = new Sprite(tex);
          sp.anchor.set(0.5, 1);
          sp.width = 36;
          sp.height = 46;
          spriteContainer.addChild(sp);
        } else {
          const fb = new Graphics();
          fb.circle(0, -18, 13).fill(0x4488cc + (hashStr(agent.id) % 0x1000) * 0x100);
          spriteContainer.addChild(fb);
        }

        /* Agent name label */
        const agentLabel = new Text({
          text: agent.name ?? agent.id ?? "",
          style: new TextStyle({
            fontSize: 6,
            fill: isDark ? 0xc0c8d8 : 0x2f2530,
            fontFamily: "system-ui, sans-serif",
            align: "center",
          }),
        });
        agentLabel.anchor.set(0.5, 0);
        agentLabel.position.set(0, 2);
        spriteContainer.addChild(agentLabel);

        /* Agent role badge */
        const roleKey = agent.role as string | undefined;
        const roleMap = LOCALE_TEXT.role as Record<string, Record<string, string>>;
        if (roleKey && roleMap[roleKey]) {
          const roleText = pickLocale(locale, roleMap[roleKey] as any);
          const roleLabel = new Text({
            text: String(roleText),
            style: new TextStyle({
              fontSize: 5.5,
              fill: isDark ? 0x8890a8 : 0x8a7a90,
              fontFamily: "system-ui, sans-serif",
            }),
          });
          roleLabel.anchor.set(0.5, 0);
          roleLabel.position.set(0, 10);
          spriteContainer.addChild(roleLabel);
        }

        /* Unread notification dot */
        if (unreadAgentIds?.has(agent.id)) {
          const dot = new Graphics();
          dot.circle(16, -38, 3.5).fill(0xff3333);
          dot.circle(16, -38, 2).fill({ color: 0xff6666, alpha: 0.6 });
          spriteContainer.addChild(dot);
        }

        /* Bed graphic — hidden by default, shown when CLI util ≥ 100%       */
        /* bedCY formula matches tickAgentCliUtilization: baseY - 8 + 18     */
        const bedCY = baseY + 10;
        const bedG = new Graphics();
        bedG.roundRect(baseX - 26, bedCY - 12, 58, 22, 3).fill(0xb89060);
        bedG.roundRect(baseX - 25, bedCY - 11, 56, 20, 2).fill(0xf0e8dc);
        bedG.roundRect(baseX - 26, bedCY - 12, 7, 22, 2).fill(0xa07840);
        bedG.roundRect(baseX - 24, bedCY - 9, 12, 16, 3).fill(0xfffff0);
        bedG.roundRect(baseX - 24, bedCY - 9, 12, 16, 3).stroke({ width: 0.4, color: 0xddddcc });
        bedG.visible = false;
        room.addChild(bedG);

        /* Blanket graphic */
        const blanketG = new Graphics();
        blanketG.roundRect(baseX - 6, bedCY - 11, 38, 20, 2).fill({ color: 0x8ab4d8, alpha: 0.9 });
        blanketG.roundRect(baseX - 6, bedCY - 11, 38, 6, 1).fill({ color: 0xb8d8f0, alpha: 0.4 });
        blanketG.roundRect(baseX - 4, bedCY - 9, 6, 3, 1).fill({ color: 0xffffff, alpha: 0.08 });
        blanketG.visible = false;
        room.addChild(blanketG);

        /* Particles container */
        const particles = new Container();
        room.addChild(particles);
        room.addChild(spriteContainer);

        /* Agent click — stopPropagation prevents room click from also firing */
        spriteContainer.eventMode = "static";
        spriteContainer.cursor = "pointer";
        spriteContainer.on("pointerdown", (e) => {
          e.stopPropagation();
          cbRef.current.onSelectAgent(agent);
        });

        animItemsRef.current.push({
          sprite: spriteContainer,
          status: agent.status ?? "idle",
          baseX,
          baseY,
          particles,
          agentId: agent.id,
          cliProvider: agent.cli_provider,
          deskG,
          bedG,
          blanketG,
        });

        /* Store stage-absolute position for delivery targeting */
        agentPosRef.current.set(agent.id, { x: roomX + baseX, y: roomY + baseY });
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
