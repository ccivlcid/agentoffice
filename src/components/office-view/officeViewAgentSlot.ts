import { Graphics, Text, TextStyle, Container, Sprite } from "pixi.js";
import type { Texture } from "pixi.js";
import type { MutableRefObject } from "react";
import { drawDesk, drawChair } from "./officeViewDrawing2.ts";
import { DESK_W, DESK_H } from "./officeViewConstants.ts";
import { hashStr } from "./officeViewHelpers.ts";
import { LOCALE_TEXT, pickLocale } from "./officeViewPalette.ts";

/* ================================================================== */
/*  Agent slot rendering — extracted from officeViewScene-dept.ts      */
/* ================================================================== */

const D_SLOT_H = 106;
const STATUS_DOT_COLORS: Record<string, number> = {
  working: 0x34d399,
  idle: 0x94a3b8,
  break: 0xfbbf24,
  offline: 0x475569,
};
const CHAIR_COLORS = [0x8a7a9a, 0x7a9a8a, 0x9a8a7a, 0x7a8a9a, 0x9a7a8a];

export interface AgentSlotParams {
  room: Container;
  agent: any;
  slotX: number;
  slotY: number;
  slotW: number;
  roomX: number;
  roomY: number;
  spriteIdx: number;
  isDark: boolean;
  locale: any;
  texturesRef: MutableRefObject<Record<string, Texture>>;
  cbRef: MutableRefObject<{ onSelectAgent: (a: any) => void }>;
  unreadAgentIds?: Set<string>;
}

export interface AgentSlotAnimItem {
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
}

export function buildAgentSlot(p: AgentSlotParams): {
  animItem: AgentSlotAnimItem;
  stagePos: { x: number; y: number };
} {
  const {
    room,
    agent,
    slotX,
    slotY,
    slotW,
    roomX,
    roomY,
    spriteIdx,
    isDark,
    locale,
    texturesRef,
    cbRef,
    unreadAgentIds,
  } = p;

  /* Desk + Chair */
  const deskX = slotX + (slotW - DESK_W) / 2;
  const deskY = slotY + D_SLOT_H - DESK_H - 14;
  const deskG = drawDesk(room, deskX, deskY, agent.status === "working");
  drawChair(room, deskX + DESK_W / 2, deskY + DESK_H + 8, CHAIR_COLORS[hashStr(agent.id) % CHAIR_COLORS.length]);

  /* Sprite container */
  const baseX = deskX + DESK_W / 2;
  const baseY = deskY - 8;
  const spriteContainer = new Container();
  spriteContainer.position.set(baseX, baseY);

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

  /* Name label + status dot */
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
  const statusDot = new Graphics();
  statusDot.circle(-agentLabel.width / 2 - 4, 6, 2).fill(STATUS_DOT_COLORS[agent.status] ?? 0x94a3b8);
  spriteContainer.addChild(statusDot);

  /* Role badge */
  const roleKey = agent.role as string | undefined;
  const roleMap = LOCALE_TEXT.role as Record<string, Record<string, string>>;
  if (roleKey && roleMap[roleKey]) {
    const roleText = pickLocale(locale, roleMap[roleKey] as any);
    const roleLabel = new Text({
      text: String(roleText),
      style: new TextStyle({ fontSize: 5.5, fill: isDark ? 0x8890a8 : 0x8a7a90, fontFamily: "system-ui, sans-serif" }),
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

  /* Bed + Blanket (shown by tickAgentCliUtilization when util ≥ 100%) */
  const bedCY = baseY + 10;
  const bedG = new Graphics();
  bedG.roundRect(baseX - 26, bedCY - 12, 58, 22, 3).fill(0xb89060);
  bedG.roundRect(baseX - 25, bedCY - 11, 56, 20, 2).fill(0xf0e8dc);
  bedG.roundRect(baseX - 26, bedCY - 12, 7, 22, 2).fill(0xa07840);
  bedG.roundRect(baseX - 24, bedCY - 9, 12, 16, 3).fill(0xfffff0);
  bedG.roundRect(baseX - 24, bedCY - 9, 12, 16, 3).stroke({ width: 0.4, color: 0xddddcc });
  bedG.visible = false;
  room.addChild(bedG);

  const blanketG = new Graphics();
  blanketG.roundRect(baseX - 6, bedCY - 11, 38, 20, 2).fill({ color: 0x8ab4d8, alpha: 0.9 });
  blanketG.roundRect(baseX - 6, bedCY - 11, 38, 6, 1).fill({ color: 0xb8d8f0, alpha: 0.4 });
  blanketG.roundRect(baseX - 4, bedCY - 9, 6, 3, 1).fill({ color: 0xffffff, alpha: 0.08 });
  blanketG.visible = false;
  room.addChild(blanketG);

  /* Particles + sprite in room */
  const particles = new Container();
  room.addChild(particles);
  room.addChild(spriteContainer);

  /* Click handler */
  spriteContainer.eventMode = "static";
  spriteContainer.cursor = "pointer";
  spriteContainer.on("pointerdown", (e) => {
    e.stopPropagation();
    cbRef.current.onSelectAgent(agent);
  });

  return {
    animItem: {
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
    },
    stagePos: { x: roomX + baseX, y: roomY + baseY },
  };
}
