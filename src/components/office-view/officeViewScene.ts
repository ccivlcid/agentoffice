import { Container, Graphics } from "pixi.js";
import type { MutableRefObject } from "react";
import type { Application, Texture } from "pixi.js";
import type { ThemeMode } from "../../ThemeContext.ts";
import type { UiLanguage } from "../../i18n.ts";
import type {
  Delivery, RoomRect, WallClockVisual, SubCloneBurstParticle,
} from "./officeViewTypes.ts";
import type { SubCloneAnimItem } from "./officeViewAgentTick.ts";
import { destroyNode } from "./officeViewHelpers.ts";
import {
  CEO_ZONE_H, HALLWAY_H, BREAK_ROOM_H, BREAK_ROOM_GAP, ROOMS_PER_ROW,
} from "./officeViewConstants.ts";
import { syncPaletteTheme } from "./officeViewPalette.ts";
import { buildCeoRoom } from "./officeViewScene-ceo.ts";
import { buildDeptRooms, calcDeptRoomHeight } from "./officeViewScene-dept.ts";
import { buildBreakRoom } from "./officeViewScene-break.ts";

/* ================================================================== */
/*  Department / agent data shape (mirrors dataRef)                   */
/* ================================================================== */

export interface OfficeSceneData {
  departments: any[];
  agents: any[];
  tasks: any[];
  subAgents: any[];
  unreadAgentIds?: Set<string>;
  meetingPresence?: any[];
  customDeptThemes?: Record<string, { floor1: number; floor2: number; wall: number; accent: number }>;
}

/* ================================================================== */
/*  buildOfficeScene parameter bag                                     */
/* ================================================================== */

export interface BuildOfficeSceneParams {
  appRef: MutableRefObject<Application | null>;
  texturesRef: MutableRefObject<Record<string, Texture>>;
  dataRef: MutableRefObject<OfficeSceneData>;
  ceoPosRef: MutableRefObject<{ x: number; y: number }>;
  ceoSpriteRef: MutableRefObject<Container | null>;
  crownRef: MutableRefObject<Graphics | null>;
  highlightRef: MutableRefObject<Graphics | null>;
  animItemsRef: MutableRefObject<Array<{
    sprite: Container; status: string;
    baseX: number; baseY: number; particles: Container;
    agentId?: string; cliProvider?: string;
    deskG?: Graphics; bedG?: Graphics; blanketG?: Graphics;
  }>>;
  roomRectsRef: MutableRefObject<RoomRect[]>;
  deliveriesRef: MutableRefObject<Delivery[]>;
  deliveryLayerRef: MutableRefObject<Container | null>;
  prevAssignRef: MutableRefObject<Set<string>>;
  agentPosRef: MutableRefObject<Map<string, { x: number; y: number }>>;
  spriteMapRef: MutableRefObject<Map<string, number>>;
  ceoMeetingSeatsRef: MutableRefObject<Array<{ x: number; y: number }>>;
  totalHRef: MutableRefObject<number>;
  officeWRef: MutableRefObject<number>;
  ceoOfficeRectRef: MutableRefObject<{ x: number; y: number; w: number; h: number } | null>;
  breakRoomRectRef: MutableRefObject<{ x: number; y: number; w: number; h: number } | null>;
  breakAnimItemsRef: MutableRefObject<Array<{ sprite: Container; baseX: number; baseY: number }>>;
  subCloneAnimItemsRef: MutableRefObject<SubCloneAnimItem[]>;
  subCloneBurstParticlesRef: MutableRefObject<SubCloneBurstParticle[]>;
  subCloneSnapshotRef: MutableRefObject<Map<string, { parentAgentId: string; x: number; y: number }>>;
  breakSteamParticlesRef: MutableRefObject<Container | null>;
  breakBubblesRef: MutableRefObject<Container[]>;
  wallClocksRef: MutableRefObject<WallClockVisual[]>;
  wallClockSecondRef: MutableRefObject<number>;
  localeRef: MutableRefObject<UiLanguage>;
  themeRef: MutableRefObject<ThemeMode>;
  themeHighlightTargetIdRef: MutableRefObject<string | null>;
  activeMeetingTaskIdRef: MutableRefObject<string | null>;
  meetingMinutesOpenRef: MutableRefObject<((taskId: string) => void) | undefined>;
  cbRef: MutableRefObject<{
    onSelectAgent: (agent: any) => void;
    onSelectDepartment: (dept: any) => void;
  }>;
  setSceneRevision: (fn: (prev: number) => number) => void;
}

/* ================================================================== */
/*  Scene builder                                                       */
/* ================================================================== */

export function buildOfficeScene(params: BuildOfficeSceneParams): void {
  const {
    appRef, texturesRef, dataRef,
    ceoPosRef, ceoSpriteRef, crownRef, highlightRef,
    animItemsRef, roomRectsRef, deliveriesRef, deliveryLayerRef,
    prevAssignRef, agentPosRef, spriteMapRef, ceoMeetingSeatsRef,
    totalHRef, officeWRef, ceoOfficeRectRef, breakRoomRectRef,
    breakAnimItemsRef, subCloneAnimItemsRef, subCloneBurstParticlesRef,
    subCloneSnapshotRef, breakSteamParticlesRef, breakBubblesRef,
    wallClocksRef, wallClockSecondRef, localeRef, themeRef,
    cbRef, setSceneRevision,
  } = params;

  const app = appRef.current;
  if (!app) return;

  /* ── 1. Clear stage & reset all mutable refs ── */
  const stage = app.stage;
  stage.sortableChildren = true;
  // Destroy all existing children
  while (stage.children.length > 0) {
    const child = stage.children[0] as Container;
    destroyNode(child);
  }

  animItemsRef.current = [];
  roomRectsRef.current = [];
  prevAssignRef.current = new Set();
  agentPosRef.current = new Map();
  spriteMapRef.current = new Map();
  ceoMeetingSeatsRef.current = [];
  wallClocksRef.current = [];
  wallClockSecondRef.current = -1;
  subCloneAnimItemsRef.current = [];
  subCloneBurstParticlesRef.current = [];
  subCloneSnapshotRef.current = new Map();
  breakAnimItemsRef.current = [];
  breakSteamParticlesRef.current = null;
  breakBubblesRef.current = [];

  /* ── 1.5. Sync palette theme so animation-tick imported bindings are up to date ── */
  const isDark = themeRef.current === "dark";
  syncPaletteTheme(isDark);
  // Keep the WebGL clear color in sync with the corridor tile so resize-clears
  // never flash white (matches the corridorBg tile drawn in step 2.5)
  app.renderer.background.color = isDark ? 0x0c0c18 : 0xcac2b4;
  app.renderer.background.alpha = 1;

  /* ── 2. Layout computation ── */
  const officeW = officeWRef.current;
  const data = dataRef.current;
  const { departments, agents } = data;

  // Per-department room heights (using actual room width for column count)
  const roomW = Math.floor(officeW / ROOMS_PER_ROW);
  const agentCountByDept = new Map<string, number>();
  for (const a of agents) {
    if ((a as any).disabled) continue;
    const deptId = (a as any).department_id;
    agentCountByDept.set(deptId, (agentCountByDept.get(deptId) ?? 0) + 1);
  }
  const deptRoomHeights: number[] = departments.map((dept: any) =>
    calcDeptRoomHeight(agentCountByDept.get(dept.id) ?? 0, roomW),
  );

  // Total height: CEO + HALLWAY + (row-max heights + HALLWAY each) + BREAK_ROOM_GAP + BREAK_ROOM_H
  // Rooms are laid out ROOMS_PER_ROW per horizontal row; row height = max in that row
  let deptTotalH = 0;
  for (let i = 0; i < deptRoomHeights.length; i += ROOMS_PER_ROW) {
    const rowSlice = deptRoomHeights.slice(i, i + ROOMS_PER_ROW);
    deptTotalH += Math.max(...rowSlice) + HALLWAY_H;
  }
  const totalH = CEO_ZONE_H + HALLWAY_H + deptTotalH + BREAK_ROOM_GAP + BREAK_ROOM_H;
  totalHRef.current = totalH;

  /* ── 2.5. Corridor background ── */
  const corridorBg = new Graphics();
  // Two-tone subtle corridor tile pattern
  const cTile = isDark ? 0x0c0c18 : 0xcac2b4;
  const cTile2 = isDark ? 0x0a0a15 : 0xc2bab0;
  const tileSize = 16;
  // Fill base color once, then overlay only alternate tiles (halves draw calls)
  corridorBg.rect(0, 0, officeW, totalH).fill(cTile);
  for (let ty = 0; ty < totalH; ty += tileSize) {
    for (let tx = 0; tx < officeW; tx += tileSize) {
      if (((tx / tileSize + ty / tileSize) & 1) !== 0) {
        corridorBg.rect(tx, ty, tileSize, tileSize).fill(cTile2);
      }
    }
  }
  // Subtle grout lines
  corridorBg.rect(0, 0, officeW, totalH).fill({ color: isDark ? 0x000000 : 0x8a8070, alpha: 0.04 });
  corridorBg.zIndex = -1;
  stage.addChild(corridorBg);

  /* ── 3. CEO office ── */
  buildCeoRoom({
    stage,
    officeW,
    themeRef,
    texturesRef,
    ceoPosRef,
    ceoSpriteRef,
    crownRef,
    highlightRef,
    ceoMeetingSeatsRef,
    ceoOfficeRectRef,
    wallClocksRef,
    localeRef,
    cbRef,
  });

  /* ── 4. Department rooms ── */
  const deptStartY = CEO_ZONE_H + HALLWAY_H;
  const deptResult = buildDeptRooms({
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
    startY: deptStartY,
    hallwayH: HALLWAY_H,
    customDeptThemes: data.customDeptThemes,
    cbRef,
    unreadAgentIds: data.unreadAgentIds,
  });

  /* ── 5. Break room ── */
  const breakRoomY = deptResult.nextY - HALLWAY_H + BREAK_ROOM_GAP;
  buildBreakRoom({
    stage,
    officeW,
    roomY: breakRoomY,
    themeRef,
    breakRoomRectRef,
    breakAnimItemsRef,
    breakSteamParticlesRef,
    breakBubblesRef,
    localeRef,
  });

  /* ── 6. Delivery layer (on top of everything) ── */
  const deliveryLayer = new Container();
  deliveryLayer.zIndex = 30;
  stage.addChild(deliveryLayer);
  deliveryLayerRef.current = deliveryLayer;

  // Clear any stale deliveries that reference old sprite instances
  deliveriesRef.current = [];

  /* ── 7. Resize renderer AFTER all content is built, then force-render immediately.
          HTML canvas pixels are cleared whenever the canvas is resized. Without the
          forced render the canvas stays blank until the next Pixi ticker rAF, causing
          a visible white/blank flash. ── */
  if (app.renderer) {
    // Only resize when dimensions actually changed — avoids unnecessary canvas clear
    const rW = Math.round(app.renderer.width / (app.renderer.resolution ?? 1));
    const rH = Math.round(app.renderer.height / (app.renderer.resolution ?? 1));
    if (rW !== officeW || rH !== totalH) {
      app.renderer.resize(officeW, totalH);
    }
    // Force render immediately so the canvas is never blank before the next ticker frame
    app.renderer.render(stage);
  }

  /* ── 8. Notify React of scene revision ── */
  setSceneRevision((prev) => prev + 1);
}
