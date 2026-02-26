import { Graphics, Text, TextStyle, Container, Sprite } from "pixi.js";
import type { Texture } from "pixi.js";
import type { MutableRefObject } from "react";
import type { WallClockVisual } from "./officeViewTypes.ts";
import type { ThemeMode } from "../../ThemeContext.ts";
import {
  drawTiledFloor,
  drawRoomAtmosphere,
  drawBunting,
  drawWallClock,
  drawWindow,
  drawPictureFrame,
  drawCeilingLight,
  drawTrashCan,
} from "./officeViewDrawing.ts";
import { drawPlant } from "./officeViewDrawing2.ts";
import { drawBookshelf } from "./officeViewDrawing3.ts";
import {
  DEFAULT_CEO_THEME_LIGHT,
  DEFAULT_CEO_THEME_DARK,
  LOCALE_TEXT,
  pickLocale,
} from "./officeViewPalette.ts";
import { CEO_ZONE_H, CEO_SIZE } from "./officeViewConstants.ts";
import type { UiLanguage } from "../../i18n.ts";

const CEO_MEETING_SEAT_COUNT = 6;

/* ================================================================== */
/*  CEO room builder                                                   */
/* ================================================================== */

export interface BuildCeoRoomParams {
  stage: Container;
  officeW: number;
  themeRef: MutableRefObject<ThemeMode>;
  texturesRef: MutableRefObject<Record<string, Texture>>;
  ceoPosRef: MutableRefObject<{ x: number; y: number }>;
  ceoSpriteRef: MutableRefObject<Container | null>;
  crownRef: MutableRefObject<Graphics | null>;
  highlightRef: MutableRefObject<Graphics | null>;
  ceoMeetingSeatsRef: MutableRefObject<Array<{ x: number; y: number }>>;
  ceoOfficeRectRef: MutableRefObject<{ x: number; y: number; w: number; h: number } | null>;
  wallClocksRef: MutableRefObject<WallClockVisual[]>;
  localeRef: MutableRefObject<UiLanguage>;
  cbRef: MutableRefObject<{ onSelectAgent: (a: any) => void; onSelectDepartment: (d: any) => void }>;
}

export function buildCeoRoom(params: BuildCeoRoomParams): void {
  const {
    stage, officeW, themeRef, texturesRef,
    ceoPosRef, ceoSpriteRef, crownRef, highlightRef,
    ceoMeetingSeatsRef, ceoOfficeRectRef, wallClocksRef, localeRef,
  } = params;

  const isDark = themeRef.current === "dark";
  const theme = isDark ? DEFAULT_CEO_THEME_DARK : DEFAULT_CEO_THEME_LIGHT;
  const locale = localeRef.current as any;

  const room = new Container();
  stage.addChild(room);

  // Floor
  const floorG = new Graphics();
  drawTiledFloor(floorG, 0, 0, officeW, CEO_ZONE_H, theme.floor1, theme.floor2);
  room.addChild(floorG);

  // Room atmosphere / walls
  drawRoomAtmosphere(room, 0, 0, officeW, CEO_ZONE_H, theme.wall, theme.accent);

  // Border
  const borderG = new Graphics();
  borderG.rect(0, 0, officeW, CEO_ZONE_H).stroke({ width: 1.5, color: theme.accent, alpha: 0.35 });
  room.addChild(borderG);

  // Bunting decorations
  drawBunting(room, 0, 6, officeW, theme.accent, 0xffffff, 0.65);

  // Wall clocks
  const clock1 = drawWallClock(room, officeW * 0.25, 14);
  const clock2 = drawWallClock(room, officeW * 0.75, 14);
  wallClocksRef.current.push(clock1, clock2);

  // Windows on left and right walls
  drawWindow(room, 10, 28, 30, 22);
  drawWindow(room, officeW - 40, 28, 30, 22);

  // Bookshelf
  drawBookshelf(room, officeW / 2 - 14, 4);

  // Picture frame
  drawPictureFrame(room, officeW * 0.38, 8);
  drawPictureFrame(room, officeW * 0.6, 8);

  // Plants
  drawPlant(room, 52, CEO_ZONE_H - 14, 0);
  drawPlant(room, officeW - 52, CEO_ZONE_H - 14, 1);

  // Ceiling lights
  drawCeilingLight(room, officeW * 0.33, 0, theme.accent);
  drawCeilingLight(room, officeW * 0.67, 0, theme.accent);

  // Trash can
  drawTrashCan(room, officeW - 16, CEO_ZONE_H - 12);

  // Room label
  const labelText = pickLocale(locale, LOCALE_TEXT.ceoOffice);
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
  label.position.set(officeW / 2, 18);
  room.addChild(label);

  // Collab table label
  const tableLabel = new Text({
    text: pickLocale(locale, LOCALE_TEXT.collabTable),
    style: new TextStyle({
      fontSize: 7,
      fill: isDark ? 0x9090a8 : 0x7a6a40,
      fontFamily: "system-ui, sans-serif",
    }),
  });
  tableLabel.anchor.set(0.5, 0);
  tableLabel.position.set(officeW / 2, 32);
  room.addChild(tableLabel);

  // Collaboration / meeting table in the center
  const tableG = new Graphics();
  const tableW = 160;
  const tableH = 28;
  const tableX = officeW / 2 - tableW / 2;
  const tableY = CEO_ZONE_H - 46;
  tableG.roundRect(tableX + 2, tableY + 3, tableW, tableH, 4).fill({ color: 0x000000, alpha: 0.10 });
  tableG.roundRect(tableX, tableY, tableW, tableH, 4).fill(0xc8a060);
  tableG.roundRect(tableX + 1, tableY + 1, tableW - 2, tableH - 2, 3).fill(0xdab878);
  tableG.roundRect(tableX + 2, tableY + 2, tableW - 4, tableH - 4, 2.5).fill(0xe8cc90);
  tableG.moveTo(tableX + 4, tableY + 2).lineTo(tableX + tableW - 4, tableY + 2)
    .stroke({ width: 0.6, color: 0xfce4b0, alpha: 0.4 });
  room.addChild(tableG);

  // Meeting seats: 3 on top, 3 on bottom of table
  const seats: Array<{ x: number; y: number }> = [];
  const seatSpacing = tableW / (CEO_MEETING_SEAT_COUNT / 2 + 1);
  for (let i = 0; i < CEO_MEETING_SEAT_COUNT / 2; i++) {
    const sx = tableX + seatSpacing * (i + 1);
    seats.push({ x: sx, y: tableY - 10 });      // top row
  }
  for (let i = 0; i < CEO_MEETING_SEAT_COUNT / 2; i++) {
    const sx = tableX + seatSpacing * (i + 1);
    seats.push({ x: sx, y: tableY + tableH + 10 }); // bottom row
  }
  ceoMeetingSeatsRef.current = seats;

  // CEO container — added to stage directly so it renders above all room layers
  const ceoContainer = new Container();
  const textures = texturesRef.current;
  const ceoTex = textures["ceo"];
  if (ceoTex) {
    const ceoSprite = new Sprite(ceoTex);
    ceoSprite.anchor.set(0.5, 1);
    ceoSprite.width = CEO_SIZE;
    ceoSprite.height = CEO_SIZE;
    ceoContainer.addChild(ceoSprite);
  } else {
    // Fallback: colored circle
    const fallback = new Graphics();
    fallback.circle(0, -CEO_SIZE / 2, CEO_SIZE / 2).fill(0xffaa44);
    ceoContainer.addChild(fallback);
  }

  // Crown: Pixi Graphics triangle crown (replaces emoji); bottom at local y=0
  const crown = new Graphics();
  const w = 10;
  const h = 8;
  const fill = isDark ? 0xfacc15 : 0xeab308;
  const stroke = isDark ? 0xca8a04 : 0xa16207;
  crown.moveTo(-w / 2, 0).lineTo(-w / 2 + 2, -h).lineTo(0, -h + 2).lineTo(w / 2 - 2, -h).lineTo(w / 2, 0).closePath().fill({ color: fill, alpha: 0.95 });
  crown.moveTo(-w / 2, 0).lineTo(-w / 2 + 2, -h).lineTo(0, -h + 2).lineTo(w / 2 - 2, -h).lineTo(w / 2, 0).closePath().stroke({ width: 0.8, color: stroke, alpha: 0.8 });
  crown.position.set(0, -CEO_SIZE / 2 + 2);
  ceoContainer.addChild(crown);
  crownRef.current = crown;

  ceoContainer.position.set(ceoPosRef.current.x, ceoPosRef.current.y);
  ceoContainer.zIndex = 10;
  stage.addChild(ceoContainer);
  ceoSpriteRef.current = ceoContainer;

  // Highlight overlay (managed by tick — cleared and redrawn each frame)
  const highlight = new Graphics();
  highlight.eventMode = "none";
  highlight.zIndex = 20;
  stage.addChild(highlight);
  highlightRef.current = highlight;

  // Record CEO office rect
  ceoOfficeRectRef.current = { x: 0, y: 0, w: officeW, h: CEO_ZONE_H };
}
