import { Graphics, Sprite } from "pixi.js";
import type { Container } from "pixi.js";
import { tickAgentCliUtilization } from "./officeViewAgentTick.ts";
import type { AnimTickRefs } from "./officeViewAgentTick.ts";
import { tickHighlightOverlay } from "./officeViewHighlightTick.ts";
import { tickDeliveries } from "./officeViewDeliveryTick.ts";

export type { AnimTickRefs } from "./officeViewAgentTick.ts";

/* ================================================================== */
/*  Main animation ticker                                              */
/* ================================================================== */

export function runAnimationTick(ctx: AnimTickRefs): void {
  const {
    tickRef,
    keysRef,
    ceoPosRef,
    ceoSpriteRef,
    crownRef,
    highlightRef,
    officeWRef,
    totalHRef,
    roomRectsRef,
    breakRoomRectRef,
    ceoOfficeRectRef,
    animItemsRef,
    subCloneAnimItemsRef,
    subCloneBurstParticlesRef,
    breakAnimItemsRef,
    breakSteamParticlesRef,
    breakBubblesRef,
    wallClocksRef,
    wallClockSecondRef,
    deliveriesRef,
    cliUsageRef,
    dataRef,
    themeHighlightTargetIdRef,
    followCeoInView,
    hashStr,
    destroyNode,
    applyWallClockTime,
    blendColor,
    CEO_SPEED,
    DELIVERY_SPEED,
    TARGET_CHAR_H,
    CEO_SIZE,
    SUB_CLONE_WAVE_SPEED,
    SUB_CLONE_MOVE_X_AMPLITUDE,
    SUB_CLONE_MOVE_Y_AMPLITUDE,
    SUB_CLONE_FLOAT_DRIFT,
    SUB_CLONE_FIREWORK_INTERVAL,
    emitSubCloneFireworkBurst,
  } = ctx;

  const tick = ++tickRef.current;
  const keys = keysRef.current;
  const ceo = ceoSpriteRef.current;

  // ── Wall clocks ──
  const wallClockNow = new Date();
  const wallClockSecond = wallClockNow.getHours() * 3600 + wallClockNow.getMinutes() * 60 + wallClockNow.getSeconds();
  if (wallClockSecondRef.current !== wallClockSecond) {
    wallClockSecondRef.current = wallClockSecond;
    for (const clock of wallClocksRef.current) applyWallClockTime(clock, wallClockNow);
  }

  // ── CEO movement ──
  if (ceo) {
    let dx = 0,
      dy = 0;
    if (keys["ArrowLeft"] || keys["KeyA"]) dx -= CEO_SPEED;
    if (keys["ArrowRight"] || keys["KeyD"]) dx += CEO_SPEED;
    if (keys["ArrowUp"] || keys["KeyW"]) dy -= CEO_SPEED;
    if (keys["ArrowDown"] || keys["KeyS"]) dy += CEO_SPEED;
    if (dx || dy) {
      ceoPosRef.current.x = Math.max(28, Math.min(officeWRef.current - 28, ceoPosRef.current.x + dx));
      ceoPosRef.current.y = Math.max(18, Math.min(totalHRef.current - 28, ceoPosRef.current.y + dy));
      ceo.position.set(ceoPosRef.current.x, ceoPosRef.current.y);
      followCeoInView();
    }
    const crown = crownRef.current;
    if (crown) {
      crown.position.y = -CEO_SIZE / 2 + 2 + Math.sin(tick * 0.06) * 2;
      crown.rotation = Math.sin(tick * 0.03) * 0.06;
    }
  }

  // ── Highlight overlay ──
  const hl = highlightRef.current;
  if (hl) {
    tickHighlightOverlay({
      tick,
      hl,
      themeHighlightTargetIdRef,
      ceoOfficeRectRef,
      breakRoomRectRef,
      roomRectsRef,
      dataRef,
      ceoPosRef,
      blendColor,
    });
  }

  // ── Agent desk animations ──
  const meetingNow = Date.now();
  const meetingPresenceList = dataRef.current.meetingPresence ?? [];
  const inMeetingAgentIds = new Set<string>();
  for (const row of meetingPresenceList) {
    if (row.until >= meetingNow) inMeetingAgentIds.add(row.agent_id);
  }
  for (let idx = 0; idx < animItemsRef.current.length; idx++) {
    const item = animItemsRef.current[idx];
    const { sprite, status, baseX, baseY, particles, agentId, cliProvider, deskG, bedG, blanketG } = item;
    if (agentId) {
      const inMeetingPresence = inMeetingAgentIds.has(agentId);
      const inMeeting =
        inMeetingPresence || deliveriesRef.current.some((d) => d.agentId === agentId && d.holdAtSeat && d.arrived);
      sprite.visible = !inMeeting;
      if (inMeeting) continue;
    }
    const maxUtil = cliProvider
      ? (cliUsageRef.current?.[cliProvider]?.windows?.reduce((m, w) => Math.max(m, w.utilization), 0) ?? 0)
      : 0;
    const inBed = maxUtil >= 1.0;
    if (!inBed) {
      const phase = ((hashStr(agentId ?? `idx-${idx}`) % 10000) / 10000) * Math.PI * 2;
      const bobY = Math.sin(tick * 0.045 + phase) * 1.4;
      const bobX = Math.sin(tick * 0.032 + phase * 1.6) * 0.8;
      sprite.position.x = baseX + bobX;
      sprite.position.y = baseY + bobY;
    } else {
      sprite.position.x = baseX;
      sprite.position.y = baseY;
    }
    if (status === "working") {
      if (tick % 10 === 0 && particles.children.length < 20) {
        const p = new Graphics();
        const colors = [0x55aaff, 0x55ff88, 0xffaa33, 0xff5577, 0xaa77ff];
        p.star(0, 0, 4, 2, 1, 0).fill(colors[Math.floor(Math.random() * colors.length)]);
        p.position.set(baseX + (Math.random() - 0.5) * 24, baseY - 16 - Math.random() * 8);
        (p as any)._vy = -0.4 - Math.random() * 0.3;
        (p as any)._life = 0;
        particles.addChild(p);
      }
      for (let i = particles.children.length - 1; i >= 0; i--) {
        const p = particles.children[i] as any;
        if (p._sweat) continue;
        p._life++;
        p.position.y += p._vy ?? -0.4;
        p.position.x += Math.sin(p._life * 0.2) * 0.2;
        p.alpha = Math.max(0, 1 - p._life * 0.03);
        p.scale.set(Math.max(0.1, 1 - p._life * 0.02));
        if (p._life > 35) {
          particles.removeChild(p);
          p.destroy();
        }
      }
    }
    if (cliProvider) {
      const usage = cliUsageRef.current?.[cliProvider];
      const maxUtil = usage?.windows?.reduce((m, w) => Math.max(m, w.utilization), 0) ?? 0;
      tickAgentCliUtilization({
        tick,
        sprite,
        baseX,
        baseY,
        particles,
        deskG,
        bedG,
        blanketG,
        maxUtil,
        isOfflineAgent: status === "offline",
        TARGET_CHAR_H,
      });
    } else {
      // Non-CLI agents: apply status-based tint (offline → dim, others → normal)
      const child0 = sprite.children[0];
      if (child0 instanceof Sprite) child0.tint = status === "offline" ? 0x888899 : 0xffffff;
      sprite.alpha = status === "offline" ? 0.3 : 1;
    }
  }

  // ── Sub-clone floating animations ──
  for (const clone of subCloneAnimItemsRef.current) {
    if (clone.container.destroyed) continue;
    const wave = tick * SUB_CLONE_WAVE_SPEED + clone.phase;
    const driftX =
      Math.sin(wave * 0.7) * SUB_CLONE_MOVE_X_AMPLITUDE +
      Math.cos(wave * 0.38 + clone.phase * 0.6) * SUB_CLONE_FLOAT_DRIFT;
    const driftY =
      Math.sin(wave * 0.95) * SUB_CLONE_MOVE_Y_AMPLITUDE +
      Math.cos(wave * 0.52 + clone.phase) * (SUB_CLONE_FLOAT_DRIFT * 0.65);
    clone.container.position.x = clone.baseX + driftX;
    clone.container.position.y = clone.baseY + driftY;
    clone.aura.alpha = 0.1 + (Math.sin(wave * 0.9) + 1) * 0.06;
    clone.cloneVisual.alpha = 0.9 + Math.max(0, Math.sin(wave * 1.9)) * 0.08;
    clone.cloneVisual.rotation = Math.sin(wave * 1.45 + clone.phase) * 0.045;
    const scalePulse = clone.baseScale * (1 + Math.sin(wave * 1.7) * 0.01);
    clone.cloneVisual.scale.set(scalePulse);
    if (clone.animated && clone.frameCount > 1) {
      const frameFloat = (Math.sin(wave * 2.8) + 1) * 0.5 * clone.frameCount;
      clone.animated.gotoAndStop(Math.min(clone.frameCount - 1, Math.floor(frameFloat)));
    }
    if ((tick + clone.fireworkOffset) % SUB_CLONE_FIREWORK_INTERVAL === 0) {
      const room = clone.container.parent as Container | null;
      if (room)
        emitSubCloneFireworkBurst(
          room,
          subCloneBurstParticlesRef.current,
          clone.container.position.x,
          clone.container.position.y - 24,
        );
    }
  }

  // ── Burst particles ──
  const burstParticles = subCloneBurstParticlesRef.current;
  for (let i = burstParticles.length - 1; i >= 0; i--) {
    const p = burstParticles[i];
    p.life += 1;
    p.node.position.x += p.vx;
    p.node.position.y += p.vy;
    p.node.rotation += p.spin;
    p.node.scale.set(p.node.scale.x + p.growth, p.node.scale.y + p.growth);
    p.node.alpha = Math.max(0, 1 - p.life / p.maxLife);
    if (p.life >= p.maxLife || p.node.destroyed) {
      destroyNode(p.node);
      burstParticles.splice(i, 1);
    }
  }

  // ── Break room character idle bobbing ──
  for (let idx = 0; idx < breakAnimItemsRef.current.length; idx++) {
    const { sprite, baseX, baseY } = breakAnimItemsRef.current[idx];
    if (sprite.destroyed) continue;
    const phase = ((hashStr(`break-${idx}`) % 10000) / 10000) * Math.PI * 2;
    const bobY = Math.sin(tick * 0.05 + phase) * 1.2;
    const bobX = Math.sin(tick * 0.035 + phase * 1.5) * 0.7;
    sprite.position.x = baseX + bobX;
    sprite.position.y = baseY + bobY;
  }

  // ── Break room ambient ──
  const steamC = breakSteamParticlesRef.current;
  if (steamC) {
    if (tick % 20 === 0 && steamC.children.length < 15) {
      const p = new Graphics();
      p.circle(0, 0, 1.5 + Math.random()).fill({ color: 0xffffff, alpha: 0.5 });
      const br = breakRoomRectRef.current;
      if (br) {
        p.position.set(br.x + 26, br.y + 18);
        (p as any)._vy = -0.3 - Math.random() * 0.2;
        (p as any)._life = 0;
        steamC.addChild(p);
      }
    }
    for (let i = steamC.children.length - 1; i >= 0; i--) {
      const p = steamC.children[i] as any;
      p._life++;
      p.position.y += p._vy ?? -0.3;
      p.position.x += Math.sin(p._life * 0.15) * 0.3;
      p.alpha = Math.max(0, 0.5 - p._life * 0.016);
      if (p._life > 30) {
        steamC.removeChild(p);
        p.destroy();
      }
    }
  }
  for (const bubble of breakBubblesRef.current) {
    bubble.alpha = 0.7 + Math.sin(tick * 0.05) * 0.3;
  }

  // ── Delivery animations ──
  tickDeliveries({ deliveriesRef, DELIVERY_SPEED, destroyNode });
}
