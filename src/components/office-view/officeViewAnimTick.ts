import { Graphics } from "pixi.js";
import type { Container } from "pixi.js";
import type { RoomRect } from "./officeViewTypes.ts";
import { DEPT_THEME, DEFAULT_CEO_THEME, DEFAULT_BREAK_THEME } from "./officeViewPalette.ts";
import { tickAgentCliUtilization } from "./officeViewAgentTick.ts";
import type { AnimTickRefs } from "./officeViewAgentTick.ts";

export type { AnimTickRefs } from "./officeViewAgentTick.ts";

/* ================================================================== */
/*  Main animation ticker                                              */
/* ================================================================== */

export function runAnimationTick(ctx: AnimTickRefs): void {
  const {
    tickRef, keysRef, ceoPosRef, ceoSpriteRef, crownRef, highlightRef,
    officeWRef, totalHRef, roomRectsRef, breakRoomRectRef, ceoOfficeRectRef,
    animItemsRef, subCloneAnimItemsRef, subCloneBurstParticlesRef,
    breakAnimItemsRef, breakSteamParticlesRef, breakBubblesRef, wallClocksRef, wallClockSecondRef,
    deliveriesRef, cliUsageRef, dataRef, themeHighlightTargetIdRef, followCeoInView,
    hashStr, destroyNode, applyWallClockTime, blendColor,
    CEO_SPEED, DELIVERY_SPEED, TARGET_CHAR_H, CEO_SIZE,
    SUB_CLONE_WAVE_SPEED, SUB_CLONE_MOVE_X_AMPLITUDE, SUB_CLONE_MOVE_Y_AMPLITUDE,
    SUB_CLONE_FLOAT_DRIFT, SUB_CLONE_FIREWORK_INTERVAL, emitSubCloneFireworkBurst,
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
    let dx = 0, dy = 0;
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
    hl.clear();
    const activeThemeTargetId = themeHighlightTargetIdRef.current;
    if (activeThemeTargetId) {
      const pulse = 0.55 + Math.sin(tick * 0.08) * 0.2;
      let targetRect: { x: number; y: number; w: number; h: number } | null = null;
      let targetAccent = DEPT_THEME.dev?.accent ?? 0x6688ff;
      if (activeThemeTargetId === "ceoOffice") {
        targetRect = ceoOfficeRectRef.current;
        targetAccent = dataRef.current.customDeptThemes?.ceoOffice?.accent ?? DEFAULT_CEO_THEME.accent;
      } else if (activeThemeTargetId === "breakRoom") {
        targetRect = breakRoomRectRef.current;
        targetAccent = dataRef.current.customDeptThemes?.breakRoom?.accent ?? DEFAULT_BREAK_THEME.accent;
      } else {
        const targetRoom = roomRectsRef.current.find((r: RoomRect) => r.dept.id === activeThemeTargetId);
        if (targetRoom) {
          targetRect = { x: targetRoom.x, y: targetRoom.y, w: targetRoom.w, h: targetRoom.h };
          const targetTheme = dataRef.current.customDeptThemes?.[activeThemeTargetId] || DEPT_THEME[activeThemeTargetId] || DEPT_THEME.dev;
          targetAccent = targetTheme?.accent ?? 0x6688ff;
        }
      }
      if (targetRect) {
        hl.roundRect(targetRect.x - 4, targetRect.y - 4, targetRect.w + 8, targetRect.h + 8, 7)
          .stroke({ width: 3.5, color: targetAccent, alpha: pulse });
        hl.roundRect(targetRect.x - 6, targetRect.y - 6, targetRect.w + 12, targetRect.h + 12, 9)
          .stroke({ width: 1.2, color: blendColor(targetAccent, 0xffffff, 0.22), alpha: 0.35 + Math.sin(tick * 0.06) * 0.08 });
      }
    }
    const cx = ceoPosRef.current.x, cy = ceoPosRef.current.y;
    let highlighted = false;
    for (const r of roomRectsRef.current) {
      if (cx >= r.x && cx <= r.x + r.w && cy >= r.y - 10 && cy <= r.y + r.h) {
        const theme = dataRef.current.customDeptThemes?.[r.dept.id] || DEPT_THEME[r.dept.id] || DEPT_THEME.dev;
        hl.roundRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 5)
          .stroke({ width: 3, color: theme?.accent ?? 0x6688ff, alpha: 0.5 + Math.sin(tick * 0.08) * 0.2 });
        highlighted = true; break;
      }
    }
    if (!highlighted) {
      const br = breakRoomRectRef.current;
      if (br && cx >= br.x && cx <= br.x + br.w && cy >= br.y - 10 && cy <= br.y + br.h) {
        const breakThemeHighlight = dataRef.current.customDeptThemes?.breakRoom ?? DEFAULT_BREAK_THEME;
        hl.roundRect(br.x - 2, br.y - 2, br.w + 4, br.h + 4, 5)
          .stroke({ width: 3, color: breakThemeHighlight.accent, alpha: 0.5 + Math.sin(tick * 0.08) * 0.2 });
        highlighted = true;
      }
    }
    if (!highlighted) {
      const cr = ceoOfficeRectRef.current;
      if (cr && cx >= cr.x && cx <= cr.x + cr.w && cy >= cr.y - 10 && cy <= cr.y + cr.h) {
        const ceoThemeHighlight = dataRef.current.customDeptThemes?.ceoOffice ?? DEFAULT_CEO_THEME;
        hl.roundRect(cr.x - 2, cr.y - 2, cr.w + 4, cr.h + 4, 5)
          .stroke({ width: 3, color: ceoThemeHighlight.accent, alpha: 0.5 + Math.sin(tick * 0.08) * 0.2 });
      }
    }
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
      const inMeeting = inMeetingPresence || deliveriesRef.current.some(
        (d) => d.agentId === agentId && d.holdAtSeat && d.arrived,
      );
      sprite.visible = !inMeeting;
      if (inMeeting) continue;
    }
    const maxUtil = cliProvider
      ? (cliUsageRef.current?.[cliProvider]?.windows?.reduce((m, w) => Math.max(m, w.utilization), 0) ?? 0)
      : 0;
    const inBed = maxUtil >= 1.0;
    if (!inBed) {
      const phase = (hashStr(agentId ?? `idx-${idx}`) % 10000) / 10000 * Math.PI * 2;
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
        (p as any)._vy = -0.4 - Math.random() * 0.3; (p as any)._life = 0;
        particles.addChild(p);
      }
      for (let i = particles.children.length - 1; i >= 0; i--) {
        const p = particles.children[i] as any;
        if (p._sweat) continue;
        p._life++; p.position.y += p._vy ?? -0.4; p.position.x += Math.sin(p._life * 0.2) * 0.2;
        p.alpha = Math.max(0, 1 - p._life * 0.03); p.scale.set(Math.max(0.1, 1 - p._life * 0.02));
        if (p._life > 35) { particles.removeChild(p); p.destroy(); }
      }
    }
    if (cliProvider) {
      const usage = cliUsageRef.current?.[cliProvider];
      const maxUtil = usage?.windows?.reduce((m, w) => Math.max(m, w.utilization), 0) ?? 0;
      tickAgentCliUtilization({ tick, sprite, baseX, baseY, particles, deskG, bedG, blanketG, maxUtil, isOfflineAgent: status === "offline", TARGET_CHAR_H });
    }
  }

  // ── Sub-clone floating animations ──
  for (const clone of subCloneAnimItemsRef.current) {
    if (clone.container.destroyed) continue;
    const wave = tick * SUB_CLONE_WAVE_SPEED + clone.phase;
    const driftX = Math.sin(wave * 0.7) * SUB_CLONE_MOVE_X_AMPLITUDE + Math.cos(wave * 0.38 + clone.phase * 0.6) * SUB_CLONE_FLOAT_DRIFT;
    const driftY = Math.sin(wave * 0.95) * SUB_CLONE_MOVE_Y_AMPLITUDE + Math.cos(wave * 0.52 + clone.phase) * (SUB_CLONE_FLOAT_DRIFT * 0.65);
    clone.container.position.x = clone.baseX + driftX; clone.container.position.y = clone.baseY + driftY;
    clone.aura.alpha = 0.1 + (Math.sin(wave * 0.9) + 1) * 0.06;
    clone.cloneVisual.alpha = 0.9 + Math.max(0, Math.sin(wave * 1.9)) * 0.08;
    clone.cloneVisual.rotation = Math.sin(wave * 1.45 + clone.phase) * 0.045;
    const scalePulse = clone.baseScale * (1 + Math.sin(wave * 1.7) * 0.01);
    clone.cloneVisual.scale.set(scalePulse);
    if (clone.animated && clone.frameCount > 1) {
      const frameFloat = ((Math.sin(wave * 2.8) + 1) * 0.5) * clone.frameCount;
      clone.animated.gotoAndStop(Math.min(clone.frameCount - 1, Math.floor(frameFloat)));
    }
    if ((tick + clone.fireworkOffset) % SUB_CLONE_FIREWORK_INTERVAL === 0) {
      const room = clone.container.parent as Container | null;
      if (room) emitSubCloneFireworkBurst(room, subCloneBurstParticlesRef.current, clone.container.position.x, clone.container.position.y - 24);
    }
  }

  // ── Burst particles ──
  const burstParticles = subCloneBurstParticlesRef.current;
  for (let i = burstParticles.length - 1; i >= 0; i--) {
    const p = burstParticles[i];
    p.life += 1; p.node.position.x += p.vx; p.node.position.y += p.vy; p.node.rotation += p.spin;
    p.node.scale.set(p.node.scale.x + p.growth, p.node.scale.y + p.growth);
    p.node.alpha = Math.max(0, 1 - p.life / p.maxLife);
    if (p.life >= p.maxLife || p.node.destroyed) { destroyNode(p.node); burstParticles.splice(i, 1); }
  }

  // ── Break room character idle bobbing ──
  for (let idx = 0; idx < breakAnimItemsRef.current.length; idx++) {
    const { sprite, baseX, baseY } = breakAnimItemsRef.current[idx];
    if (sprite.destroyed) continue;
    const phase = (hashStr(`break-${idx}`) % 10000) / 10000 * Math.PI * 2;
    const bobY = Math.sin(tick * 0.05 + phase) * 1.2;
    const bobX = Math.sin(tick * 0.035 + phase * 1.5) * 0.7;
    sprite.position.x = baseX + bobX;
    sprite.position.y = baseY + bobY;
  }

  // ── Break room ambient ──
  const steamC = breakSteamParticlesRef.current;
  if (steamC) {
    if (tick % 20 === 0 && steamC.children.length < 15) {
      const p = new Graphics(); p.circle(0, 0, 1.5 + Math.random()).fill({ color: 0xffffff, alpha: 0.5 });
      const br = breakRoomRectRef.current;
      if (br) { p.position.set(br.x + 26, br.y + 18); (p as any)._vy = -0.3 - Math.random() * 0.2; (p as any)._life = 0; steamC.addChild(p); }
    }
    for (let i = steamC.children.length - 1; i >= 0; i--) {
      const p = steamC.children[i] as any; p._life++; p.position.y += p._vy ?? -0.3;
      p.position.x += Math.sin(p._life * 0.15) * 0.3; p.alpha = Math.max(0, 0.5 - p._life * 0.016);
      if (p._life > 30) { steamC.removeChild(p); p.destroy(); }
    }
  }
  for (const bubble of breakBubblesRef.current) { bubble.alpha = 0.7 + Math.sin(tick * 0.05) * 0.3; }

  // ── Delivery animations ──
  const deliveries = deliveriesRef.current;
  const now = Date.now();
  for (let i = deliveries.length - 1; i >= 0; i--) {
    const d = deliveries[i];
    if (d.sprite.destroyed) { deliveries.splice(i, 1); continue; }
    if (d.holdAtSeat && d.arrived) {
      if (!d.seatedPoseApplied) {
        for (const child of d.sprite.children) {
          const maybeAnim = child as unknown as { stop?: () => void; gotoAndStop?: (frame: number) => void };
          if (typeof maybeAnim.stop === "function" && typeof maybeAnim.gotoAndStop === "function") {
            maybeAnim.stop(); maybeAnim.gotoAndStop(0);
          }
        }
        d.seatedPoseApplied = true;
      }
      d.sprite.position.set(d.toX, d.toY); d.sprite.alpha = 1;
      if (d.holdUntil && now >= d.holdUntil) { destroyNode(d.sprite); deliveries.splice(i, 1); }
      continue;
    }
    d.progress += d.speed ?? DELIVERY_SPEED;
    if (d.progress >= 1) {
      if (d.holdAtSeat) { d.arrived = true; d.progress = 1; d.sprite.position.set(d.toX, d.toY); d.sprite.alpha = 1; continue; }
      destroyNode(d.sprite); deliveries.splice(i, 1);
    } else if (d.type === "walk") {
      const t = d.progress, ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      d.sprite.position.x = d.fromX + (d.toX - d.fromX) * ease;
      d.sprite.position.y = d.fromY + (d.toY - d.fromY) * ease - Math.abs(Math.sin(t * Math.PI * 12)) * 3;
      if (t < 0.05) d.sprite.alpha = t / 0.05; else if (t > 0.9) d.sprite.alpha = (1 - t) / 0.1; else d.sprite.alpha = 1;
      d.sprite.scale.x = d.toX > d.fromX ? 1 : -1;
    } else {
      const t = d.progress, ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const arc = d.arcHeight ?? -30;
      d.sprite.position.x = d.fromX + (d.toX - d.fromX) * ease;
      d.sprite.position.y = d.fromY + (d.toY - d.fromY) * ease + Math.sin(t * Math.PI) * arc;
      d.sprite.alpha = t > 0.85 ? (1 - t) / 0.15 : 1;
      d.sprite.scale.set(0.8 + Math.sin(t * Math.PI) * 0.3);
    }
  }
}
