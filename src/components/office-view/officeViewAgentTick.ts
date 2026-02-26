import { Graphics, Text, TextStyle, Sprite } from "pixi.js";
import type { MutableRefObject } from "react";
import type { Container, AnimatedSprite } from "pixi.js";
import type { Delivery, RoomRect, WallClockVisual, SubCloneBurstParticle } from "./officeViewTypes.ts";

/* ================================================================== */
/*  Sub-clone animation item shape                                     */
/* ================================================================== */

export interface SubCloneAnimItem {
  container: Container;
  aura: Graphics;
  cloneVisual: Sprite;
  animated?: AnimatedSprite;
  frameCount: number;
  baseScale: number;
  baseX: number;
  baseY: number;
  phase: number;
  fireworkOffset: number;
}

/* ================================================================== */
/*  Animation tick context type                                        */
/* ================================================================== */

export interface AnimTickRefs {
  tickRef: MutableRefObject<number>;
  keysRef: MutableRefObject<Record<string, boolean>>;
  ceoPosRef: MutableRefObject<{ x: number; y: number }>;
  ceoSpriteRef: MutableRefObject<Container | null>;
  crownRef: MutableRefObject<Graphics | null>;
  highlightRef: MutableRefObject<Graphics | null>;
  officeWRef: MutableRefObject<number>;
  totalHRef: MutableRefObject<number>;
  roomRectsRef: MutableRefObject<RoomRect[]>;
  breakRoomRectRef: MutableRefObject<{ x: number; y: number; w: number; h: number } | null>;
  ceoOfficeRectRef: MutableRefObject<{ x: number; y: number; w: number; h: number } | null>;
  animItemsRef: MutableRefObject<Array<{
    sprite: Container; status: string;
    baseX: number; baseY: number; particles: Container;
    agentId?: string; cliProvider?: string;
    deskG?: Graphics; bedG?: Graphics; blanketG?: Graphics;
  }>>;
  subCloneAnimItemsRef: MutableRefObject<SubCloneAnimItem[]>;
  subCloneBurstParticlesRef: MutableRefObject<SubCloneBurstParticle[]>;
  breakAnimItemsRef: MutableRefObject<Array<{ sprite: Container; baseX: number; baseY: number }>>;
  breakSteamParticlesRef: MutableRefObject<Container | null>;
  breakBubblesRef: MutableRefObject<Container[]>;
  wallClocksRef: MutableRefObject<WallClockVisual[]>;
  wallClockSecondRef: MutableRefObject<number>;
  deliveriesRef: MutableRefObject<Delivery[]>;
  cliUsageRef: MutableRefObject<Record<string, { windows?: Array<{ utilization: number }> }> | null>;
  dataRef: MutableRefObject<{
    meetingPresence?: Array<{ agent_id: string; until: number }>;
    customDeptThemes?: Record<string, { floor1: number; floor2: number; wall: number; accent: number }>;
  }>;
  themeHighlightTargetIdRef: MutableRefObject<string | null>;
  followCeoInView: () => void;
  hashStr: (s: string) => number;
  destroyNode: (node: Container) => void;
  applyWallClockTime: (clock: WallClockVisual, now: Date) => void;
  blendColor: (a: number, b: number, t: number) => number;
  CEO_SPEED: number;
  DELIVERY_SPEED: number;
  TARGET_CHAR_H: number;
  CEO_SIZE: number;
  SUB_CLONE_WAVE_SPEED: number;
  SUB_CLONE_MOVE_X_AMPLITUDE: number;
  SUB_CLONE_MOVE_Y_AMPLITUDE: number;
  SUB_CLONE_FLOAT_DRIFT: number;
  SUB_CLONE_FIREWORK_INTERVAL: number;
  emitSubCloneFireworkBurst: (
    room: Container,
    particles: SubCloneBurstParticle[],
    x: number,
    y: number,
  ) => void;
}

/* ================================================================== */
/*  Agent CLI utilization visual state helper                          */
/* ================================================================== */

export interface AgentUtilArgs {
  tick: number;
  sprite: Container;
  baseX: number;
  baseY: number;
  particles: Container;
  deskG?: Graphics;
  bedG?: Graphics;
  blanketG?: Graphics;
  maxUtil: number;
  isOfflineAgent: boolean;
  TARGET_CHAR_H: number;
}

export function tickAgentCliUtilization(args: AgentUtilArgs): void {
  const { tick, sprite, baseX, baseY, particles, deskG, bedG, blanketG, maxUtil, isOfflineAgent, TARGET_CHAR_H } = args;
  if (maxUtil >= 1.0) {
    const bedCX = baseX, bedCY = baseY - 8 + 18, headX = bedCX - TARGET_CHAR_H / 2 + 6;
    sprite.rotation = -Math.PI / 2; sprite.position.set(headX + TARGET_CHAR_H - 6, bedCY); sprite.alpha = 0.85;
    const child0 = sprite.children[0]; if (child0 instanceof Sprite) child0.tint = 0xff6666;
    if (deskG) deskG.visible = false;
    if (bedG && !bedG.visible) {
      bedG.visible = true;
      const room = sprite.parent;
      if (room) { const bedIdx = room.children.indexOf(bedG); if (bedIdx >= 0) { room.removeChild(sprite); room.addChildAt(sprite, bedIdx + 1); } }
    }
    if (blanketG && !blanketG.visible) {
      blanketG.visible = true;
      const room = sprite.parent;
      if (room) { const sprIdx = room.children.indexOf(sprite); if (sprIdx >= 0) { room.removeChild(blanketG); room.addChildAt(blanketG, sprIdx + 1); } }
    }
    if (tick % 40 === 0 && particles.children.length < 30) {
      const star = new Graphics(); star.star(0, 0, 5, 3, 1.5, 0).fill({ color: 0xffdd44, alpha: 0.8 });
      star.position.set(headX, bedCY - 22);
      (star as any)._sweat = true; (star as any)._dizzy = true;
      (star as any)._offset = Math.random() * Math.PI * 2; (star as any)._life = 0;
      particles.addChild(star);
    }
    if (tick % 80 === 0 && particles.children.length < 30) {
      const zz = new Text({ text: "z", style: new TextStyle({ fontSize: 7 + Math.random() * 3, fill: 0xaaaacc, fontFamily: "monospace" }) });
      zz.anchor.set(0.5, 0.5); zz.position.set(headX + 6, bedCY - 18);
      (zz as any)._sweat = true; (zz as any)._life = 0;
      particles.addChild(zz);
    }
  } else if (maxUtil >= 0.8) {
    sprite.rotation = 0; sprite.alpha = 1;
    const child0 = sprite.children[0]; if (child0 instanceof Sprite) child0.tint = 0xff9999;
    if (deskG) deskG.visible = true; if (bedG) bedG.visible = false; if (blanketG) blanketG.visible = false;
    if (tick % 40 === 0 && particles.children.length < 20) {
      const drop = new Graphics();
      drop.moveTo(0, 0).lineTo(-1.8, 4).quadraticCurveTo(0, 6.5, 1.8, 4).lineTo(0, 0).fill({ color: 0x7ec8e3, alpha: 0.85 });
      drop.circle(0, 3.8, 1.2).fill({ color: 0xbde4f4, alpha: 0.5 });
      drop.position.set(baseX + 8, baseY - 36);
      (drop as any)._sweat = true; (drop as any)._life = 0; particles.addChild(drop);
    }
  } else if (maxUtil >= 0.6) {
    sprite.rotation = 0; sprite.alpha = 1;
    const child0 = sprite.children[0]; if (child0 instanceof Sprite) child0.tint = 0xffffff;
    if (deskG) deskG.visible = true; if (bedG) bedG.visible = false; if (blanketG) blanketG.visible = false;
    if (tick % 55 === 0 && particles.children.length < 20) {
      const drop = new Graphics();
      drop.moveTo(0, 0).lineTo(-1.8, 4).quadraticCurveTo(0, 6.5, 1.8, 4).lineTo(0, 0).fill({ color: 0x7ec8e3, alpha: 0.85 });
      drop.circle(0, 3.8, 1.2).fill({ color: 0xbde4f4, alpha: 0.5 });
      drop.position.set(baseX + 8, baseY - 36);
      (drop as any)._sweat = true; (drop as any)._life = 0; particles.addChild(drop);
    }
  } else {
    sprite.rotation = 0; sprite.alpha = isOfflineAgent ? 0.3 : 1;
    const child0 = sprite.children[0]; if (child0 instanceof Sprite) child0.tint = isOfflineAgent ? 0x888899 : 0xffffff;
    if (deskG) deskG.visible = true; if (bedG) bedG.visible = false; if (blanketG) blanketG.visible = false;
  }
  for (let i = particles.children.length - 1; i >= 0; i--) {
    const p = particles.children[i] as any; if (!p._sweat) continue; p._life++;
    if (p._dizzy) {
      const headPX = baseX - TARGET_CHAR_H / 2 + 10, bedCY2 = baseY - 8 + 18, angle = tick * 0.08 + p._offset;
      p.position.x = headPX + Math.cos(angle) * 14; p.position.y = bedCY2 - 22 + Math.sin(angle * 0.7) * 4;
      p.alpha = 0.7 + Math.sin(tick * 0.1) * 0.3;
    } else {
      p.position.y += 0.45; p.position.x += Math.sin(p._life * 0.15) * 0.15;
      p.alpha = Math.max(0, 0.85 - p._life * 0.022);
    }
    if (p._life > 38) { particles.removeChild(p); p.destroy(); }
  }
}
