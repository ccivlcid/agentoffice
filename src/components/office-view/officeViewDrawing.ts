import { Graphics, Container } from "pixi.js";
import { blendColor } from "./officeViewHelpers";
import { TILE } from "./officeViewConstants";
import type { WallClockVisual } from "./officeViewTypes";

/* ================================================================== */
/*  Drawing helpers (part 1)                                           */
/* ================================================================== */

export function drawBandGradient(
  g: Graphics,
  x: number, y: number, w: number, h: number,
  from: number, to: number,
  bands: number = 8,
  alpha: number = 1,
): void {
  const safeBands = Math.max(2, bands);
  const bandH = h / safeBands;
  for (let i = 0; i < safeBands; i++) {
    const color = blendColor(from, to, i / (safeBands - 1));
    g.rect(x, y + i * bandH, w, bandH + 0.75).fill({ color, alpha });
  }
}

export function drawBunting(
  parent: Container, x: number, y: number, w: number,
  colorA: number, colorB: number, alpha: number = 0.7,
): void {
  const g = new Graphics();
  g.moveTo(x, y).lineTo(x + w, y).stroke({ width: 1, color: 0x33261a, alpha: 0.6 });
  const flagCount = Math.max(6, Math.floor(w / 24));
  const step = w / flagCount;
  for (let i = 0; i < flagCount; i++) {
    const fx = x + i * step + step / 2;
    const fy = y + (i % 2 === 0 ? 1 : 2.5);
    g.moveTo(fx - 4.2, fy).lineTo(fx + 4.2, fy).lineTo(fx, fy + 6.2)
      .fill({ color: i % 2 === 0 ? colorA : colorB, alpha });
    g.moveTo(fx, fy).lineTo(fx, fy + 1.8).stroke({ width: 0.5, color: 0xffffff, alpha: 0.14 });
  }
  parent.addChild(g);
}

export function drawRoomAtmosphere(
  parent: Container, x: number, y: number, w: number, h: number,
  wallColor: number, accent: number,
): void {
  const g = new Graphics();
  const topPanelH = Math.max(20, Math.min(34, h * 0.22));
  drawBandGradient(
    g, x + 1, y + 1, w - 2, topPanelH,
    blendColor(wallColor, 0xffffff, 0.24),
    blendColor(wallColor, 0xffffff, 0.05),
    7, 0.75,
  );
  g.rect(x + 1, y + topPanelH + 1, w - 2, 1.2).fill({ color: blendColor(wallColor, 0xffffff, 0.3), alpha: 0.28 });
  g.rect(x + 1, y + h - 14, w - 2, 10).fill({ color: blendColor(wallColor, 0x000000, 0.5), alpha: 0.14 });
  g.rect(x + 3, y + h - 14, w - 6, 1).fill({ color: blendColor(accent, 0xffffff, 0.45), alpha: 0.22 });
  parent.addChild(g);
}

export function drawTiledFloor(
  g: Graphics, x: number, y: number, w: number, h: number,
  c1: number, c2: number,
): void {
  for (let ty = 0; ty < h; ty += TILE) {
    for (let tx = 0; tx < w; tx += TILE) {
      const isEven = ((tx / TILE + ty / TILE) & 1) === 0;
      g.rect(x + tx, y + ty, TILE, TILE).fill(isEven ? c1 : c2);
      g.moveTo(x + tx, y + ty).lineTo(x + tx + TILE, y + ty)
        .stroke({ width: 0.3, color: 0xffffff, alpha: 0.15 });
      g.moveTo(x + tx, y + ty).lineTo(x + tx, y + ty + TILE)
        .stroke({ width: 0.3, color: 0xffffff, alpha: 0.10 });
      g.moveTo(x + tx, y + ty + TILE).lineTo(x + tx + TILE, y + ty + TILE)
        .stroke({ width: 0.3, color: 0x8a7a60, alpha: 0.10 });
      g.moveTo(x + tx + TILE, y + ty).lineTo(x + tx + TILE, y + ty + TILE)
        .stroke({ width: 0.3, color: 0x8a7a60, alpha: 0.08 });
    }
  }
}

export function drawAmbientGlow(parent: Container, cx: number, cy: number, radius: number, color: number, alpha: number = 0.15): Graphics {
  const g = new Graphics();
  const steps = 6;
  for (let i = steps; i >= 1; i--) {
    const r = radius * (i / steps);
    const a = alpha * (1 - i / (steps + 1));
    g.ellipse(cx, cy, r, r * 0.6).fill({ color, alpha: a });
  }
  parent.addChild(g);
  return g;
}

export function drawWindow(parent: Container, x: number, y: number, w: number = 24, h: number = 18): Graphics {
  const g = new Graphics();
  g.roundRect(x + 1.5, y + 1.5, w, h, 2).fill({ color: 0x000000, alpha: 0.12 });
  g.roundRect(x, y, w, h, 2).fill(0x8a7a68);
  g.roundRect(x, y, w, h, 2).stroke({ width: 0.5, color: 0xa09080, alpha: 0.4 });
  const pw = (w - 5) / 2, ph = (h - 5) / 2;
  g.rect(x + 2, y + 2, pw, ph).fill(0x8abcdd);
  g.rect(x + pw + 3, y + 2, pw, ph).fill(0x9accee);
  g.rect(x + 2, y + ph + 3, pw, ph).fill(0x9accee);
  g.rect(x + pw + 3, y + ph + 3, pw, ph).fill(0x8abcdd);
  g.circle(x + 6, y + 5, 1.5).fill({ color: 0xffffff, alpha: 0.2 });
  g.circle(x + 8, y + 5.5, 2.2).fill({ color: 0xffffff, alpha: 0.18 });
  g.circle(x + 10, y + 5.8, 1.8).fill({ color: 0xffffff, alpha: 0.16 });
  g.circle(x + w - 7, y + h - 7, 1.5).fill({ color: 0xffffff, alpha: 0.14 });
  g.circle(x + w - 9, y + h - 6.5, 1.8).fill({ color: 0xffffff, alpha: 0.12 });
  g.rect(x + 2, y + 2, w - 4, h - 4).fill({ color: 0xffe8a0, alpha: 0.10 });
  g.rect(x + w / 2 - 0.6, y + 2, 1.2, h - 4).fill({ color: 0x7a6a58, alpha: 0.4 });
  g.rect(x + 2, y + h / 2 - 0.5, w - 4, 1).fill({ color: 0x7a6a58, alpha: 0.35 });
  g.moveTo(x + 3, y + 3).lineTo(x + 8, y + 3).lineTo(x + 3, y + 6.5).fill({ color: 0xffffff, alpha: 0.28 });
  g.rect(x + pw + 4, y + 3, 3, 2).fill({ color: 0xffffff, alpha: 0.12 });
  g.moveTo(x + 1, y + 1).quadraticCurveTo(x + 3, y + h * 0.4, x + 1, y + h - 2)
    .stroke({ width: 1.5, color: 0xd8b0b8, alpha: 0.35 });
  g.moveTo(x + w - 1, y + 1).quadraticCurveTo(x + w - 3, y + h * 0.4, x + w - 1, y + h - 2)
    .stroke({ width: 1.5, color: 0xd8b0b8, alpha: 0.35 });
  g.roundRect(x, y, w, 2, 1).fill({ color: 0xd8b0b8, alpha: 0.25 });
  g.rect(x - 2, y + h, w + 4, 3).fill(0x8a7a68);
  g.rect(x - 2, y + h, w + 4, 1.2).fill({ color: 0xa09080, alpha: 0.3 });
  g.circle(x + w / 2, y + h - 1, 2).fill(0x7cb898);
  g.circle(x + w / 2 - 1, y + h - 2, 1.5).fill(0x92c8aa);
  g.roundRect(x + w / 2 - 1.5, y + h, 3, 2, 0.5).fill(0xd88060);
  g.moveTo(x, y + h + 3).lineTo(x + w, y + h + 3)
    .lineTo(x + w + 8, y + h + 22).lineTo(x - 8, y + h + 22)
    .fill({ color: 0xffeebb, alpha: 0.05 });
  g.moveTo(x + 2, y + h + 5).lineTo(x + w - 2, y + h + 5)
    .lineTo(x + w + 4, y + h + 16).lineTo(x - 4, y + h + 16)
    .fill({ color: 0xffeebb, alpha: 0.03 });
  g.rect(x + 1, y + h + 3, w - 2, 12).fill({ color: 0xfff4d0, alpha: 0.05 });
  parent.addChild(g);
  return g;
}

export function drawWallClock(parent: Container, x: number, y: number): WallClockVisual {
  const clock = new Container();
  clock.position.set(x, y);
  const g = new Graphics();
  g.circle(1, 1, 8).fill({ color: 0x000000, alpha: 0.12 });
  g.circle(0, 0, 8).fill(0xdddddd);
  g.circle(0, 0, 8).stroke({ width: 1.8, color: 0x555555 });
  g.circle(0, 0, 6.5).fill(0xfcfcf8);
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI * 2) / 12 - Math.PI / 2;
    const r = 5.2;
    const isCardinal = i % 3 === 0;
    g.circle(Math.cos(angle) * r, Math.sin(angle) * r, isCardinal ? 0.6 : 0.35).fill(0x333333);
  }
  clock.addChild(g);
  const hourHand = new Graphics();
  hourHand.moveTo(0, 0).lineTo(0, -3.5).stroke({ width: 1, color: 0x222222 });
  clock.addChild(hourHand);
  const minuteHand = new Graphics();
  minuteHand.moveTo(0, 0).lineTo(0, -5.2).stroke({ width: 0.7, color: 0x444444 });
  clock.addChild(minuteHand);
  const secondHand = new Graphics();
  secondHand.moveTo(0, 1.6).lineTo(0, -5.8).stroke({ width: 0.35, color: 0xcc3333 });
  clock.addChild(secondHand);
  const center = new Graphics();
  center.circle(0, 0, 1).fill(0xcc3333);
  center.circle(0, 0, 0.5).fill(0xff5555);
  clock.addChild(center);
  const visual: WallClockVisual = { hourHand, minuteHand, secondHand };
  applyWallClockTime(visual, new Date());
  parent.addChild(clock);
  return visual;
}

export function applyWallClockTime(clock: WallClockVisual, now: Date): void {
  const minuteValue = now.getMinutes() + now.getSeconds() / 60;
  const hourValue = (now.getHours() % 12) + minuteValue / 60;
  const secondValue = now.getSeconds() + now.getMilliseconds() / 1000;
  clock.minuteHand.rotation = (minuteValue / 60) * Math.PI * 2;
  clock.hourHand.rotation = (hourValue / 12) * Math.PI * 2;
  clock.secondHand.rotation = (secondValue / 60) * Math.PI * 2;
}

export function drawPictureFrame(parent: Container, x: number, y: number): Graphics {
  const g = new Graphics();
  g.roundRect(x, y, 16, 12, 1).fill(0x8b6914);
  g.rect(x + 1.5, y + 1.5, 13, 9).fill(0x445577);
  g.rect(x + 1.5, y + 7, 13, 3.5).fill(0x448844);
  g.circle(x + 11, y + 4, 1.5).fill(0xffdd44);
  parent.addChild(g);
  return g;
}

export function drawRug(parent: Container, cx: number, cy: number, w: number, h: number, color: number): Graphics {
  const g = new Graphics();
  g.roundRect(cx - w / 2, cy - h / 2, w, h, 3).fill({ color, alpha: 0.3 });
  g.roundRect(cx - w / 2 + 2, cy - h / 2 + 2, w - 4, h - 4, 2)
    .stroke({ width: 0.8, color, alpha: 0.2 });
  g.roundRect(cx - w / 2 + 5, cy - h / 2 + 5, w - 10, h - 10, 1)
    .stroke({ width: 0.4, color: 0xffffff, alpha: 0.06 });
  parent.addChild(g);
  return g;
}

export function drawCeilingLight(parent: Container, x: number, y: number, color: number): Graphics {
  const g = new Graphics();
  g.ellipse(x, y + 10, 20, 6).fill({ color: 0xfff5dd, alpha: 0.04 });
  g.rect(x - 2, y, 4, 3).fill(0x908070);
  g.rect(x - 5, y + 3, 10, 2).fill(0xb8a890);
  g.rect(x - 1, y + 1, 2, 2).fill({ color: 0xffffff, alpha: 0.2 });
  g.ellipse(x, y + 8, 16, 5).fill({ color, alpha: 0.06 });
  g.ellipse(x, y + 7, 10, 3.5).fill({ color, alpha: 0.10 });
  g.ellipse(x, y + 6, 5, 2).fill({ color: 0xfff5dd, alpha: 0.08 });
  parent.addChild(g);
  return g;
}

export function drawTrashCan(parent: Container, x: number, y: number): Graphics {
  const g = new Graphics();
  g.roundRect(x - 4, y, 8, 10, 1).fill(0x777788);
  g.roundRect(x - 4.5, y - 1, 9, 2, 1).fill(0x888899);
  g.roundRect(x - 2, y - 3, 4, 3, 0.5).fill(0xeeeeee);
  parent.addChild(g);
  return g;
}

export function drawWaterCooler(parent: Container, x: number, y: number): Graphics {
  const g = new Graphics();
  g.roundRect(x - 5, y + 10, 10, 14, 1).fill(0xdddddd);
  g.roundRect(x - 4, y, 8, 12, 3).fill(0x88ccff);
  g.roundRect(x - 4, y, 8, 12, 3).stroke({ width: 0.5, color: 0x66aadd });
  g.rect(x - 3, y + 3, 6, 8).fill({ color: 0x44aaff, alpha: 0.4 });
  g.rect(x + 3, y + 16, 3, 2).fill(0x999999);
  parent.addChild(g);
  return g;
}
