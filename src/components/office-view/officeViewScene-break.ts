import { Graphics, Text, TextStyle, Container } from "pixi.js";
import type { MutableRefObject } from "react";
import type { ThemeMode } from "../../ThemeContext.ts";
import {
  drawTiledFloor,
  drawRoomAtmosphere,
  drawBunting,
  drawWaterCooler,
  drawCeilingLight,
  drawTrashCan,
} from "./officeViewDrawing.ts";
import { drawPlant } from "./officeViewDrawing2.ts";
import {
  drawCoffeeMachine,
  drawSofa,
  drawCoffeeTable,
  drawHighTable,
  drawVendingMachine,
} from "./officeViewDrawing3.ts";
import {
  DEFAULT_BREAK_THEME_LIGHT,
  DEFAULT_BREAK_THEME_DARK,
  LOCALE_TEXT,
  pickLocale,
} from "./officeViewPalette.ts";
import { BREAK_ROOM_H } from "./officeViewConstants.ts";
import type { UiLanguage } from "../../i18n.ts";

/* ================================================================== */
/*  Break room builder                                                 */
/* ================================================================== */

export interface BuildBreakRoomParams {
  stage: Container;
  officeW: number;
  roomY: number;
  themeRef: MutableRefObject<ThemeMode>;
  breakRoomRectRef: MutableRefObject<{ x: number; y: number; w: number; h: number } | null>;
  breakAnimItemsRef: MutableRefObject<Array<{ sprite: Container; baseX: number; baseY: number }>>;
  breakSteamParticlesRef: MutableRefObject<Container | null>;
  breakBubblesRef: MutableRefObject<Container[]>;
  localeRef: MutableRefObject<UiLanguage>;
}

export function buildBreakRoom(params: BuildBreakRoomParams): void {
  const {
    stage, officeW, roomY, themeRef,
    breakRoomRectRef, breakSteamParticlesRef, breakBubblesRef, localeRef,
  } = params;

  const isDark = themeRef.current === "dark";
  const theme = isDark ? DEFAULT_BREAK_THEME_DARK : DEFAULT_BREAK_THEME_LIGHT;
  const locale = localeRef.current as any;

  const room = new Container();
  room.position.set(0, roomY);
  stage.addChild(room);

  // Floor
  const floorG = new Graphics();
  drawTiledFloor(floorG, 0, 0, officeW, BREAK_ROOM_H, theme.floor1, theme.floor2);
  room.addChild(floorG);

  // Atmosphere / walls
  drawRoomAtmosphere(room, 0, 0, officeW, BREAK_ROOM_H, theme.wall, theme.accent);

  // Border
  const borderG = new Graphics();
  borderG.rect(0, 0, officeW, BREAK_ROOM_H).stroke({ width: 1.5, color: theme.accent, alpha: 0.4 });
  room.addChild(borderG);

  // Festive bunting
  drawBunting(room, 0, 6, officeW, theme.accent, 0xffffff, 0.6);

  // Ceiling lights
  drawCeilingLight(room, officeW * 0.25, 0, theme.accent);
  drawCeilingLight(room, officeW * 0.75, 0, theme.accent);

  // Room label
  const labelText = pickLocale(locale, LOCALE_TEXT.breakRoom);
  const label = new Text({
    text: labelText,
    style: new TextStyle({
      fontSize: 9,
      fill: isDark ? 0xc8cee0 : 0x5a4a20,
      fontFamily: "system-ui, sans-serif",
      fontWeight: "bold",
      letterSpacing: 1.2,
    }),
  });
  label.anchor.set(0.5, 0);
  label.position.set(officeW / 2, 14);
  room.addChild(label);

  // ── Left sofa group ──
  // Sofa starts at x≈66, with BREAK_SPOTS anchored at x=86, 110, 134
  const sofaColor = isDark ? 0x7878a8 : 0xd4a0b8;
  const leftSofaX = 66;
  const leftSofaY = 52;
  drawSofa(room, leftSofaX, leftSofaY, sofaColor);

  // Coffee table between sofas (centered around x=officeW/2)
  const tableX = officeW / 2 - 18;
  drawCoffeeTable(room, tableX, 56);

  // ── Right sofa group ──
  // BREAK_SPOTS for right sofa: x=-112 and x=-82 (offset from right edge)
  // Sofa is 80px wide; right sofa at officeW - 80 - 18 ≈ officeW - 98
  const rightSofaX = officeW - 98;
  const rightSofaY = 52;
  drawSofa(room, rightSofaX, rightSofaY, sofaColor);

  // ── Coffee machine ──
  // BREAK_SPOT x=30 means at x=30 from left
  const coffeeMachineX = 10;
  const coffeeMachineY = 28;
  drawCoffeeMachine(room, coffeeMachineX, coffeeMachineY);

  // Steam particles container — added to STAGE (not room) so that the
  // animation tick can spawn particles using stage-absolute breakRoomRect coords.
  const steamContainer = new Container();
  steamContainer.zIndex = 5;
  stage.addChild(steamContainer);
  breakSteamParticlesRef.current = steamContainer;

  // ── High table ──
  // BREAK_SPOTS: x=-174 and x=-144 (from right edge)
  // High table at officeW - 210 approximately
  const highTableX = officeW - 210;
  const highTableY = 42;
  drawHighTable(room, highTableX, highTableY);

  // ── Vending machine ──
  const vendingX = officeW - 30;
  const vendingY = 20;
  drawVendingMachine(room, vendingX - 22, vendingY);

  // ── Water cooler ──
  const waterCoolerX = 45;
  const waterCoolerY = 36;
  drawWaterCooler(room, waterCoolerX, waterCoolerY);

  // Water cooler bubble graphics (alpha-animated in tick)
  const bubble1 = new Container();
  const b1g = new Graphics();
  b1g.circle(waterCoolerX + 2, waterCoolerY - 4, 1.5).fill({ color: 0xaaddff, alpha: 0.6 });
  b1g.circle(waterCoolerX + 5, waterCoolerY - 7, 1).fill({ color: 0xaaddff, alpha: 0.4 });
  bubble1.addChild(b1g);
  room.addChild(bubble1);
  const bubble2 = new Container();
  const b2g = new Graphics();
  b2g.circle(waterCoolerX + 3, waterCoolerY - 10, 1.2).fill({ color: 0xaaddff, alpha: 0.5 });
  b2g.circle(waterCoolerX + 6, waterCoolerY - 2, 0.8).fill({ color: 0xaaddff, alpha: 0.3 });
  bubble2.addChild(b2g);
  room.addChild(bubble2);
  breakBubblesRef.current.push(bubble1, bubble2);

  // Plants in corners
  drawPlant(room, 8, BREAK_ROOM_H - 14, 2);
  drawPlant(room, officeW - 8, BREAK_ROOM_H - 14, 3);

  // Trash cans
  drawTrashCan(room, 14, BREAK_ROOM_H - 12);
  drawTrashCan(room, officeW - 14, BREAK_ROOM_H - 12);

  // Record break room rect
  breakRoomRectRef.current = { x: 0, y: roomY, w: officeW, h: BREAK_ROOM_H };
}
