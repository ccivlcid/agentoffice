import { Graphics, Container } from "pixi.js";
import { blendColor } from "./officeViewHelpers";
import { OFFICE_PASTEL } from "./officeViewPalette";
import { DESK_W, DESK_H } from "./officeViewConstants";

/* ================================================================== */
/*  Drawing helpers (part 2) — desk, chair, plant                     */
/* ================================================================== */

export function drawDesk(parent: Container, dx: number, dy: number, working: boolean): Graphics {
  const g = new Graphics();
  g.ellipse(dx + DESK_W / 2, dy + DESK_H + 4, DESK_W / 2 + 6, 6).fill({ color: 0x000000, alpha: 0.06 });
  g.ellipse(dx + DESK_W / 2, dy + DESK_H + 3, DESK_W / 2 + 4, 5).fill({ color: 0x000000, alpha: 0.10 });
  g.ellipse(dx + DESK_W / 2, dy + DESK_H + 2, DESK_W / 2 + 2, 3.5).fill({ color: 0x000000, alpha: 0.12 });
  g.roundRect(dx + 3, dy + DESK_H - 2, 3, 6, 1).fill(0xb89060);
  g.roundRect(dx + DESK_W - 6, dy + DESK_H - 2, 3, 6, 1).fill(0xb89060);
  g.roundRect(dx, dy, DESK_W, DESK_H, 3).fill(0xbe9860);
  g.roundRect(dx + 1, dy + 1, DESK_W - 2, DESK_H - 2, 2).fill(0xd4b478);
  g.roundRect(dx + 2, dy + 2, DESK_W - 4, DESK_H - 4, 1.5).fill(0xe0c490);
  g.roundRect(dx + 2, dy + 2, DESK_W - 4, 6, 1).fill({ color: 0xf5dca0, alpha: 0.25 });
  for (let i = 0; i < 4; i++) {
    const w = 0.25 + (i % 2) * 0.1;
    g.moveTo(dx + 4, dy + 5 + i * 5.5).lineTo(dx + DESK_W - 4, dy + 5 + i * 5.5)
      .stroke({ width: w, color: 0xc4a060, alpha: 0.2 });
  }
  g.moveTo(dx + 2, dy + 1).lineTo(dx + DESK_W - 2, dy + 1)
    .stroke({ width: 0.6, color: 0xf0d890, alpha: 0.45 });
  g.moveTo(dx + 2, dy + DESK_H - 1).lineTo(dx + DESK_W - 2, dy + DESK_H - 1)
    .stroke({ width: 0.5, color: 0xa88050, alpha: 0.2 });
  g.roundRect(dx + DESK_W / 2 - 10, dy + 2, 20, 7, 1.5).fill(0x788498);
  g.roundRect(dx + DESK_W / 2 - 10, dy + 2, 20, 7, 1.5).stroke({ width: 0.3, color: 0x5c6a80, alpha: 0.5 });
  g.moveTo(dx + DESK_W / 2 - 8, dy + 2.5).lineTo(dx + DESK_W / 2 + 8, dy + 2.5)
    .stroke({ width: 0.4, color: 0xffffff, alpha: 0.1 });
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 6; c++) {
      g.roundRect(dx + DESK_W / 2 - 8 + c * 2.8, dy + 3.2 + r * 2.6, 2, 1.6, 0.3).fill(0xd4d9e6);
    }
  }
  g.roundRect(dx + DESK_W / 2 - 5, dy + 3.2 + 5.2, 10, 1.4, 0.3).fill(0xd4d9e6);
  g.ellipse(dx + 7, dy + 14, 6, 2).fill({ color: OFFICE_PASTEL.cocoa, alpha: 0.06 });
  g.rect(dx + 3, dy + 3, 9, 10).fill(0xf0e8dc);
  g.rect(dx + 3.5, dy + 2.5, 8.5, 10).fill(0xf4ede3);
  g.rect(dx + 4, dy + 2, 9, 10.5).fill(0xfffbf4);
  for (let i = 0; i < 4; i++) {
    const lw = 3 + (i * 1.7 % 4);
    g.moveTo(dx + 5, dy + 4 + i * 2.2).lineTo(dx + 5 + lw, dy + 4 + i * 2.2)
      .stroke({ width: 0.35, color: 0xb0a898, alpha: 0.3 + (i % 2) * 0.1 });
  }
  g.moveTo(dx + 11, dy + 3).lineTo(dx + 11, dy + 7)
    .stroke({ width: 0.5, color: 0xaaaaaa, alpha: 0.5 });
  g.moveTo(dx + 11, dy + 3).quadraticCurveTo(dx + 13, dy + 3, dx + 13, dy + 5)
    .stroke({ width: 0.5, color: 0xaaaaaa, alpha: 0.5 });
  g.ellipse(dx + DESK_W - 8, dy + 8.5, 4.5, 1.8).fill({ color: OFFICE_PASTEL.cocoa, alpha: 0.07 });
  g.circle(dx + DESK_W - 8, dy + 7, 4.2).fill(0xf0dee5);
  g.circle(dx + DESK_W - 8, dy + 7, 4.2).stroke({ width: 0.5, color: 0xc5a0b0 });
  g.circle(dx + DESK_W - 8, dy + 7, 2.8).fill(0x8a6248);
  g.circle(dx + DESK_W - 8, dy + 7, 2.8).stroke({ width: 0.3, color: 0xa07050, alpha: 0.4 });
  g.moveTo(dx + DESK_W - 3.8, dy + 5.5)
    .quadraticCurveTo(dx + DESK_W - 1.5, dy + 7, dx + DESK_W - 3.8, dy + 8.5)
    .stroke({ width: 0.9, color: 0xd7c0c9 });
  g.moveTo(dx + DESK_W - 9, dy + 3).quadraticCurveTo(dx + DESK_W - 10, dy + 1, dx + DESK_W - 9, dy - 0.5)
    .stroke({ width: 0.4, color: 0xcccccc, alpha: 0.2 });
  g.moveTo(dx + DESK_W - 7, dy + 3).quadraticCurveTo(dx + DESK_W - 6, dy + 1, dx + DESK_W - 7, dy - 0.5)
    .stroke({ width: 0.4, color: 0xcccccc, alpha: 0.15 });
  const mx = dx + DESK_W / 2 - 10;
  const my = dy + DESK_H - 16;
  g.ellipse(mx + 10, my + 13, 11, 2.5).fill({ color: OFFICE_PASTEL.cocoa, alpha: 0.07 });
  g.roundRect(mx, my, 20, 13, 2).fill(0x3e4858);
  g.roundRect(mx, my, 20, 13, 2).stroke({ width: 0.6, color: 0x5a6678 });
  g.roundRect(mx + 1.5, my + 1, 17, 10, 1).fill(working ? 0x89c8b9 : 0x1e2836);
  if (working) {
    const codeColors = [0xe1fff8, 0xf8d876, 0xa8d8ea, 0xf0b8c8];
    for (let i = 0; i < 4; i++) {
      const lineW = 3 + (i * 2.3 % 7);
      const indent = i === 2 ? 2 : 0;
      g.moveTo(mx + 3.5 + indent, my + 2.5 + i * 2.2).lineTo(mx + 3.5 + indent + lineW, my + 2.5 + i * 2.2)
        .stroke({ width: 0.7, color: codeColors[i % codeColors.length], alpha: 0.6 });
    }
    g.rect(mx + 4, my + 2.5, 0.5, 1.5).fill({ color: 0xffffff, alpha: 0.5 });
    g.ellipse(mx + 10, my + 15, 12, 3).fill({ color: 0xa3ded1, alpha: 0.06 });
  } else {
    g.circle(mx + 5, my + 4, 0.5).fill({ color: 0xffffff, alpha: 0.15 });
    g.circle(mx + 13, my + 6, 0.4).fill({ color: 0xffffff, alpha: 0.12 });
    g.circle(mx + 9, my + 8, 0.3).fill({ color: 0xffffff, alpha: 0.1 });
  }
  g.circle(mx + 10, my + 0.5, 0.6).fill({ color: 0x44dd66, alpha: 0.3 });
  g.rect(mx + 8, my - 2.5, 4, 3).fill(0x4e5a70);
  g.roundRect(mx + 5, my - 4, 10, 2, 1).fill(0x5e6a82);
  g.roundRect(mx + 5, my - 4, 10, 1, 1).fill({ color: 0x7a88a0, alpha: 0.3 });
  g.roundRect(dx + DESK_W - 7, dy + DESK_H - 11, 5, 7, 1.5).fill(0x9ab8c8);
  g.roundRect(dx + DESK_W - 7, dy + DESK_H - 11, 5, 7, 1.5).stroke({ width: 0.3, color: 0x7a9aac, alpha: 0.4 });
  g.rect(dx + DESK_W - 6.5, dy + DESK_H - 15, 1, 5).fill(0xffcb76);
  g.rect(dx + DESK_W - 5.5, dy + DESK_H - 14, 1, 4).fill(0xd5a5ae);
  g.rect(dx + DESK_W - 4.5, dy + DESK_H - 13.5, 1, 3.5).fill(0x8abfd0);
  g.roundRect(mx + 15, my + 1, 4, 4, 0.5).fill(0xf8dea8);
  g.roundRect(mx + 15.5, my + 0.5, 3.5, 3.5, 0.5).fill(0xfce8c0);
  g.moveTo(mx + 16, my + 2.5).lineTo(mx + 18, my + 2.5).stroke({ width: 0.3, color: 0xa5804f, alpha: 0.4 });
  g.moveTo(mx + 16, my + 3.5).lineTo(mx + 17.5, my + 3.5).stroke({ width: 0.3, color: 0xa5804f, alpha: 0.3 });
  g.circle(dx + 3, dy + DESK_H - 4, 2.5).fill(0x7cb898);
  g.circle(dx + 2, dy + DESK_H - 5, 1.8).fill(0x92c8aa);
  g.circle(dx + 4, dy + DESK_H - 5, 1.5).fill(0x9dd9c2);
  g.roundRect(dx + 1, dy + DESK_H - 2, 4, 2.5, 0.8).fill(0xd88060);
  parent.addChild(g);
  return g;
}

export function drawChair(parent: Container, cx: number, cy: number, color: number): void {
  const g = new Graphics();
  const chairBase = blendColor(color, OFFICE_PASTEL.creamWhite, 0.18);
  const chairMid = blendColor(color, OFFICE_PASTEL.creamWhite, 0.08);
  const chairShadow = blendColor(color, OFFICE_PASTEL.ink, 0.22);
  const chairDark = blendColor(color, OFFICE_PASTEL.ink, 0.35);
  g.ellipse(cx, cy + 5, 18, 6).fill({ color: OFFICE_PASTEL.cocoa, alpha: 0.08 });
  g.circle(cx - 8, cy + 3, 1.5).fill({ color: 0x555555, alpha: 0.3 });
  g.circle(cx + 8, cy + 3, 1.5).fill({ color: 0x555555, alpha: 0.3 });
  g.circle(cx, cy + 4, 1.5).fill({ color: 0x555555, alpha: 0.3 });
  g.ellipse(cx, cy, 16, 10).fill({ color: OFFICE_PASTEL.cocoa, alpha: 0.06 });
  g.ellipse(cx, cy, 15, 9).fill(chairBase);
  g.ellipse(cx, cy, 15, 9).stroke({ width: 1, color: chairShadow, alpha: 0.25 });
  g.ellipse(cx - 1, cy - 1.5, 11, 5.5).fill({ color: 0xffffff, alpha: 0.12 });
  g.ellipse(cx, cy + 3, 10, 3).fill({ color: chairShadow, alpha: 0.08 });
  g.ellipse(cx, cy, 10, 6).stroke({ width: 0.3, color: chairShadow, alpha: 0.12 });
  g.roundRect(cx - 17, cy - 5, 5, 13, 2.5).fill(chairMid);
  g.roundRect(cx - 17, cy - 5, 5, 13, 2.5).stroke({ width: 0.5, color: chairShadow, alpha: 0.2 });
  g.roundRect(cx + 12, cy - 5, 5, 13, 2.5).fill(chairMid);
  g.roundRect(cx + 12, cy - 5, 5, 13, 2.5).stroke({ width: 0.5, color: chairShadow, alpha: 0.2 });
  g.roundRect(cx - 16, cy - 4.5, 3, 1, 0.5).fill({ color: 0xffffff, alpha: 0.12 });
  g.roundRect(cx + 13, cy - 4.5, 3, 1, 0.5).fill({ color: 0xffffff, alpha: 0.12 });
  g.roundRect(cx - 14, cy - 13, 28, 7, 4).fill(chairShadow);
  g.roundRect(cx - 14, cy - 13, 28, 7, 4).stroke({ width: 0.8, color: chairDark, alpha: 0.25 });
  g.roundRect(cx - 12, cy - 12, 24, 2.5, 2).fill({ color: blendColor(chairBase, 0xffffff, 0.4), alpha: 0.4 });
  g.roundRect(cx - 10, cy - 9, 20, 2, 1).fill({ color: chairBase, alpha: 0.3 });
  g.ellipse(cx, cy - 0.5, 9, 3.2).fill({ color: blendColor(chairBase, OFFICE_PASTEL.softMint, 0.22), alpha: 0.5 });
  parent.addChild(g);
}

export function drawPlant(parent: Container, x: number, y: number, variant: number = 0): void {
  const g = new Graphics();
  g.ellipse(x, y + 8, 8, 3).fill({ color: OFFICE_PASTEL.cocoa, alpha: 0.10 });
  g.ellipse(x, y + 7, 7, 2.5).fill({ color: OFFICE_PASTEL.cocoa, alpha: 0.07 });
  g.roundRect(x - 5, y, 10, 7, 2).fill(0xd07858);
  g.roundRect(x - 4.5, y + 0.5, 9, 6, 1.5).fill(0xd88060);
  g.roundRect(x - 4, y + 1, 8, 5, 1.5).fill(0xe89070);
  g.roundRect(x - 3, y + 2, 6, 1, 0.5).fill({ color: 0xffffff, alpha: 0.08 });
  g.roundRect(x - 6, y - 1.5, 12, 3.5, 1.8).fill(0xe08060);
  g.roundRect(x - 5.5, y - 1, 11, 2, 1.2).fill(0xf0a080);
  g.roundRect(x - 5, y - 1, 10, 1.2, 1).fill({ color: 0xffffff, alpha: 0.12 });
  g.roundRect(x - 4, y + 4, 8, 1, 0.5).fill({ color: 0xc06848, alpha: 0.3 });
  g.ellipse(x, y, 4.5, 1.8).fill(0x5e4530);
  g.ellipse(x - 1, y + 0.2, 2.5, 1).fill({ color: 0x7a5840, alpha: 0.5 });
  g.circle(x + 2.5, y - 0.3, 0.7).fill({ color: 0x8a6a50, alpha: 0.4 });
  if (variant % 4 === 0) {
    g.rect(x - 0.4, y - 2, 0.8, 3).fill(0x6aaa88);
    g.circle(x, y - 4, 6.5).fill(0x78bfa4);
    g.circle(x - 3, y - 6, 4.5).fill(0x89cfb5);
    g.circle(x + 3, y - 6.5, 4).fill(0x89cfb5);
    g.circle(x, y - 8.5, 4).fill(0x9dd9c2);
    g.circle(x - 2, y - 10, 2.8).fill(0xb7e7d5);
    g.circle(x + 2.5, y - 9.5, 2.2).fill(0xb7e7d5);
    g.moveTo(x, y - 4).lineTo(x, y - 8).stroke({ width: 0.3, color: 0x5e9f7f, alpha: 0.3 });
    g.moveTo(x - 2, y - 6).lineTo(x - 4, y - 8).stroke({ width: 0.2, color: 0x5e9f7f, alpha: 0.2 });
    g.moveTo(x + 2, y - 6).lineTo(x + 4, y - 8).stroke({ width: 0.2, color: 0x5e9f7f, alpha: 0.2 });
    g.circle(x + 2, y - 7, 1.8).fill({ color: 0xffffff, alpha: 0.18 });
    g.circle(x - 2, y - 9.5, 1.2).fill({ color: 0xffffff, alpha: 0.12 });
  } else if (variant % 4 === 1) {
    g.roundRect(x - 2.5, y - 12, 5, 12, 2.5).fill(0x6eaa88);
    g.roundRect(x - 2, y - 10, 4, 10, 2).fill(0x82bc9a);
    g.roundRect(x - 1.5, y - 9, 3, 8, 1.5).fill(0x92c8aa);
    g.moveTo(x - 1, y - 11).lineTo(x - 1, y - 1).stroke({ width: 0.25, color: 0x5a9a78, alpha: 0.3 });
    g.moveTo(x + 1, y - 11).lineTo(x + 1, y - 1).stroke({ width: 0.25, color: 0x5a9a78, alpha: 0.3 });
    g.roundRect(x - 7, y - 7, 5, 2.5, 1.2).fill(0x72b090);
    g.roundRect(x - 7, y - 10, 2.5, 5, 1.2).fill(0x82bc9a);
    g.roundRect(x + 2, y - 5, 5, 2.5, 1.2).fill(0x72b090);
    g.roundRect(x + 4.5, y - 8, 2.5, 5, 1.2).fill(0x82bc9a);
    for (let i = 0; i < 5; i++) {
      g.circle(x + (i % 2 === 0 ? 2.5 : -2.5), y - 2 - i * 2, 0.3).fill({ color: 0xd8d0c0, alpha: 0.4 });
    }
    g.circle(x, y - 13, 2).fill(0xe3a8b2);
    g.circle(x - 1.2, y - 13.5, 1.5).fill(0xedb8c2);
    g.circle(x + 1.2, y - 13.5, 1.5).fill(0xedb8c2);
    g.circle(x, y - 13, 1).fill(0xf6d57a);
  } else if (variant % 4 === 2) {
    g.rect(x - 0.5, y - 9, 1, 9).fill(0x6aaa88);
    g.rect(x - 2.5, y - 6, 0.8, 5).fill(0x7ab898);
    g.rect(x + 2, y - 5, 0.8, 4).fill(0x7ab898);
    g.circle(x, y - 3.5, 5).fill(0x6eaa88);
    g.circle(x - 3.5, y - 5.5, 3.5).fill(0x82bc9a);
    g.circle(x + 3.5, y - 5.5, 3).fill(0x82bc9a);
    g.circle(x, y - 7, 3).fill(0x92c8aa);
    g.circle(x, y - 10, 3).fill(0xe09aaa);
    g.circle(x - 1, y - 10.5, 1.8).fill(0xeaacb8);
    g.circle(x + 1, y - 10.5, 1.8).fill(0xeaacb8);
    g.circle(x, y - 10, 1.5).fill(0xf6d685);
    g.circle(x - 4, y - 8, 2.5).fill(0x9fbede);
    g.circle(x - 4, y - 8, 1.2).fill(0xf8efba);
    g.circle(x + 3.5, y - 8.5, 2).fill(0xf2b28a);
    g.circle(x + 3.5, y - 8.5, 1).fill(0xf7df97);
    g.circle(x + 1.5, y - 12, 1.2).fill(0xe8a0b0);
  } else {
    const leafColors = [0x5e9a78, 0x6eaa88, 0x7cb898, 0x5a9070];
    for (let i = 0; i < 4; i++) {
      const lx = x + (i - 1.5) * 2.5;
      const lh = 10 + (i % 2) * 3;
      g.moveTo(lx, y).lineTo(lx - 1.5, y - lh * 0.6).lineTo(lx, y - lh).lineTo(lx + 1.5, y - lh * 0.6).lineTo(lx, y)
        .fill(leafColors[i]);
      g.moveTo(lx, y).lineTo(lx, y - lh + 1).stroke({ width: 0.3, color: 0xb8e0c8, alpha: 0.25 });
    }
    g.moveTo(x - 2, y - 8).lineTo(x - 3, y - 5).stroke({ width: 0.3, color: 0xc8d8a8, alpha: 0.25 });
  }
  parent.addChild(g);
}
