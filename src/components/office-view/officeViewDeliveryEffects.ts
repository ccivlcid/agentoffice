import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { Container, AnimatedSprite, Graphics, Text, TextStyle, Texture } from "pixi.js";
import type { UiLanguage } from "../../i18n.ts";
import type { Delivery } from "./officeViewTypes.ts";
import type { OfficeViewProps } from "./officeViewTypes.ts";
import { trackProcessedId, hashStr, destroyNode } from "./officeViewHelpers.ts";
import { paintMeetingBadge, resolveMeetingDecision } from "./officeViewMeetingHelpers.ts";
import { pickLocale, LOCALE_TEXT } from "./officeViewPalette.ts";

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface DeliveryEffectsRefs {
  deliveryLayerRef: MutableRefObject<Container | null>;
  texturesRef: MutableRefObject<Record<string, Texture>>;
  deliveriesRef: MutableRefObject<Delivery[]>;
  ceoMeetingSeatsRef: MutableRefObject<Array<{ x: number; y: number }>>;
  spriteMapRef: MutableRefObject<Map<string, number>>;
  agentPosRef: MutableRefObject<Map<string, { x: number; y: number }>>;
  processedCrossDeptRef: MutableRefObject<Set<string>>;
  processedCeoOfficeRef: MutableRefObject<Set<string>>;
}

export type DeliveryEffectsProps = Pick<
  OfficeViewProps,
  | "meetingPresence"
  | "crossDeptDeliveries"
  | "onCrossDeptDeliveryProcessed"
  | "ceoOfficeCalls"
  | "onCeoOfficeCallProcessed"
  | "agents"
>;

/* ================================================================== */
/*  Hook                                                               */
/* ================================================================== */

export function useOfficeDeliveryEffects(
  props: DeliveryEffectsProps,
  refs: DeliveryEffectsRefs,
  language: UiLanguage,
  sceneRevision: number,
): void {
  const {
    deliveryLayerRef, texturesRef, deliveriesRef, ceoMeetingSeatsRef,
    spriteMapRef, agentPosRef, processedCrossDeptRef, processedCeoOfficeRef,
  } = refs;

  // Wrap inline callback props in refs so useEffect deps stay stable.
  // Without this, inline arrow functions from App.tsx change every render,
  // causing these effects to re-run unnecessarily on every poll cycle.
  const onCrossDeptProcessedRef = useRef(props.onCrossDeptDeliveryProcessed);
  onCrossDeptProcessedRef.current = props.onCrossDeptDeliveryProcessed;
  const onCeoOfficeProcessedRef = useRef(props.onCeoOfficeCallProcessed);
  onCeoOfficeProcessedRef.current = props.onCeoOfficeCallProcessed;

  // Track speech bubble timeouts so they can be cleared on unmount
  const pendingBubbleTimeoutsRef = useRef<number[]>([]);
  useEffect(() => {
    return () => {
      for (const tid of pendingBubbleTimeoutsRef.current) clearTimeout(tid);
      pendingBubbleTimeoutsRef.current = [];
    };
  }, []);

  // ── Meeting presence (agents seated in CEO office meeting) ──
  useEffect(() => {
    const dlLayer = deliveryLayerRef.current;
    const textures = texturesRef.current;
    const seats = ceoMeetingSeatsRef.current;
    if (!dlLayer || seats.length === 0) return;
    const now = Date.now();
    const rows = (props.meetingPresence ?? []).filter((row) => row.until >= now);
    const activeByAgent = new Map(rows.map((row) => [row.agent_id, row]));
    for (const row of rows) {
      const seat = seats[row.seat_index % seats.length];
      if (!seat) continue;
      const decision = resolveMeetingDecision(row.phase, row.decision);
      const existing = deliveriesRef.current.find((d) => d.agentId === row.agent_id && d.holdAtSeat && !d.sprite.destroyed);
      if (existing) {
        existing.meetingSeatIndex = row.seat_index;
        existing.holdUntil = row.until;
        existing.toX = seat.x; existing.toY = seat.y;
        existing.arrived = true; existing.progress = 1; existing.seatedPoseApplied = false;
        existing.meetingDecision = decision;
        existing.sprite.position.set(seat.x, seat.y); existing.sprite.alpha = 1;
        if (existing.badgeGraphics && existing.badgeText)
          paintMeetingBadge(existing.badgeGraphics, existing.badgeText, language, row.phase, decision);
        continue;
      }
      const spriteNum = spriteMapRef.current.get(row.agent_id) ?? ((hashStr(row.agent_id) % 13) + 1);
      const dc = new Container();
      const frames: Texture[] = [];
      for (let f = 1; f <= 3; f++) {
        const key = `${spriteNum}-D-${f}`;
        if (textures[key]) frames.push(textures[key]);
      }
      if (frames.length > 0) {
        const animSprite = new AnimatedSprite(frames);
        animSprite.anchor.set(0.5, 1);
        animSprite.scale.set(44 / animSprite.texture.height);
        animSprite.gotoAndStop(0);
        dc.addChild(animSprite);
      } else {
        const fb = new Graphics();
        fb.circle(0, -18, 8).fill(0x6b7280);
        fb.roundRect(-6, -8, 12, 14, 2).fill(0x4b5563);
        fb.position.set(0, 0);
        dc.addChild(fb);
      }
      const badge = new Graphics(); dc.addChild(badge);
      const badgeText = new Text({ text: "", style: new TextStyle({ fontSize: 7, fill: 0x111111, fontWeight: "bold", fontFamily: "system-ui, sans-serif" }) });
      badgeText.anchor.set(0.5, 0.5); badgeText.position.set(0, 10.5); dc.addChild(badgeText);
      paintMeetingBadge(badge, badgeText, language, row.phase, decision);
      dc.position.set(seat.x, seat.y); dlLayer.addChild(dc);
      deliveriesRef.current.push({
        sprite: dc, fromX: seat.x, fromY: seat.y, toX: seat.x, toY: seat.y,
        progress: 1, speed: 0.0048, type: "walk", agentId: row.agent_id, holdAtSeat: true,
        holdUntil: row.until, arrived: true, meetingSeatIndex: row.seat_index,
        meetingDecision: decision, badgeGraphics: badge, badgeText,
      });
    }
    for (let i = deliveriesRef.current.length - 1; i >= 0; i--) {
      const d = deliveriesRef.current[i];
      if (!d.holdAtSeat || !d.agentId || !d.arrived) continue;
      if (activeByAgent.has(d.agentId)) continue;
      destroyNode(d.sprite); deliveriesRef.current.splice(i, 1);
    }
  }, [props.meetingPresence, language, sceneRevision, deliveryLayerRef, texturesRef, deliveriesRef, ceoMeetingSeatsRef, spriteMapRef]);

  // ── Cross-department deliveries ──
  useEffect(() => {
    if (!props.crossDeptDeliveries?.length) return;
    const dlLayer = deliveryLayerRef.current;
    const textures = texturesRef.current;
    if (!dlLayer) return;
    for (const cd of props.crossDeptDeliveries) {
      if (processedCrossDeptRef.current.has(cd.id)) continue;
      trackProcessedId(processedCrossDeptRef.current, cd.id);
      const fromPos = agentPosRef.current.get(cd.fromAgentId);
      const toPos = agentPosRef.current.get(cd.toAgentId);
      if (!fromPos || !toPos) { onCrossDeptProcessedRef.current?.(cd.id); continue; }
      const dc = new Container();
      const spriteNum = spriteMapRef.current.get(cd.fromAgentId) ?? ((hashStr(cd.fromAgentId) % 13) + 1);
      const frames: Texture[] = [];
      for (let f = 1; f <= 3; f++) {
        const key = `${spriteNum}-D-${f}`;
        if (textures[key]) frames.push(textures[key]);
      }
      if (frames.length > 0) {
        const animSprite = new AnimatedSprite(frames);
        animSprite.anchor.set(0.5, 1); animSprite.scale.set(44 / animSprite.texture.height);
        animSprite.animationSpeed = 0.12; animSprite.play(); dc.addChild(animSprite);
      } else {
        const fb = new Graphics();
        fb.circle(0, -18, 8).fill(0x6b7280);
        fb.roundRect(-6, -8, 12, 14, 2).fill(0x4b5563);
        fb.position.set(0, 0);
        dc.addChild(fb);
      }
      const docHolder = new Container();
      const docG = new Graphics();
      docG.roundRect(-6, -8, 12, 16, 1.5).fill(0xfefce8).stroke({ width: 0.8, color: 0xd4d4d4 });
      docG.moveTo(-4, -4).lineTo(4, -4).stroke({ width: 0.6, color: 0x737373 });
      docG.moveTo(-4, 0).lineTo(2, 0).stroke({ width: 0.6, color: 0x737373 });
      docG.moveTo(-4, 4).lineTo(3, 4).stroke({ width: 0.6, color: 0x737373 });
      docHolder.addChild(docG);
      docHolder.position.set(0, -50);
      dc.addChild(docHolder);
      const badge = new Graphics();
      badge.roundRect(-16, 3, 32, 13, 4).fill({ color: 0xf59e0b, alpha: 0.9 });
      badge.roundRect(-16, 3, 32, 13, 4).stroke({ width: 1, color: 0xd97706, alpha: 0.5 });
      dc.addChild(badge);
      const badgeText = new Text({ text: pickLocale(language, LOCALE_TEXT.collabBadge), style: new TextStyle({ fontSize: 7, fill: 0x000000, fontWeight: "bold", fontFamily: "system-ui, sans-serif" }) });
      badgeText.anchor.set(0.5, 0.5); badgeText.position.set(0, 9.5); dc.addChild(badgeText);
      dc.position.set(fromPos.x, fromPos.y); dlLayer.addChild(dc);
      deliveriesRef.current.push({ sprite: dc, fromX: fromPos.x, fromY: fromPos.y, toX: toPos.x, toY: toPos.y, progress: 0, speed: 0.005, type: "walk" });
      onCrossDeptProcessedRef.current?.(cd.id);
    }
  }, [props.crossDeptDeliveries, language, deliveryLayerRef, texturesRef, deliveriesRef, agentPosRef, spriteMapRef, processedCrossDeptRef]);

  // ── CEO office calls ──
  useEffect(() => {
    if (!props.ceoOfficeCalls?.length) return;
    const dlLayer = deliveryLayerRef.current;
    const textures = texturesRef.current;
    if (!dlLayer) return;
    const seats = ceoMeetingSeatsRef.current;

    const pickLine = (call: NonNullable<typeof props.ceoOfficeCalls>[0]) => {
      const provided = call.line?.trim();
      if (provided) return provided;
      const pool = call.phase === "review" ? pickLocale(language, LOCALE_TEXT.reviewLines) : pickLocale(language, LOCALE_TEXT.kickoffLines);
      return pool[hashStr(`${call.fromAgentId}-${call.id}`) % pool.length];
    };

    const renderSpeechBubble = (x: number, y: number, phase: "kickoff" | "review", line: string) => {
      const bubble = new Container();
      const bubbleText = new Text({ text: line, style: new TextStyle({ fontSize: 7, fill: 0x2b2b2b, fontFamily: "system-ui, sans-serif", wordWrap: true, wordWrapWidth: 120, breakWords: true }) });
      bubbleText.anchor.set(0.5, 1);
      const bw = Math.min(bubbleText.width + 12, 122), bh = bubbleText.height + 8, by = -62;
      const bubbleG = new Graphics();
      bubbleG.roundRect(-bw / 2, by - bh, bw, bh, 4).fill(0xfff8e8);
      bubbleG.roundRect(-bw / 2, by - bh, bw, bh, 4).stroke({ width: 1, color: phase === "review" ? 0x34d399 : 0xf59e0b, alpha: 0.6 });
      bubbleG.moveTo(-3, by).lineTo(0, by + 4).lineTo(3, by).fill(0xfff8e8);
      bubble.addChild(bubbleG); bubbleText.position.set(0, by - 4); bubble.addChild(bubbleText);
      bubble.position.set(x, y - 6); dlLayer.addChild(bubble);
      const tid = window.setTimeout(() => {
        destroyNode(bubble);
        pendingBubbleTimeoutsRef.current = pendingBubbleTimeoutsRef.current.filter(t => t !== tid);
      }, 2800);
      pendingBubbleTimeoutsRef.current.push(tid);
    };

    for (const call of props.ceoOfficeCalls) {
      if (processedCeoOfficeRef.current.has(call.id)) continue;
      if (call.action === "dismiss") {
        trackProcessedId(processedCeoOfficeRef.current, call.id);
        for (let i = deliveriesRef.current.length - 1; i >= 0; i--) {
          const d = deliveriesRef.current[i];
          if (d.agentId === call.fromAgentId && d.holdAtSeat) { destroyNode(d.sprite); deliveriesRef.current.splice(i, 1); }
        }
        onCeoOfficeProcessedRef.current?.(call.id); continue;
      }
      const seat = seats.length > 0 ? seats[call.seatIndex % seats.length] : null;
      if (!seat) continue;
      if (call.action === "speak") {
        trackProcessedId(processedCeoOfficeRef.current, call.id);
        const line = pickLine(call);
        const decision = resolveMeetingDecision(call.phase, call.decision, line);
        renderSpeechBubble(seat.x, seat.y, call.phase, line);
        if (call.phase === "review") {
          const attendee = deliveriesRef.current.find((d) => d.agentId === call.fromAgentId && d.holdAtSeat && !d.sprite.destroyed);
          if (attendee) {
            attendee.meetingDecision = decision;
            if (attendee.badgeGraphics && attendee.badgeText)
              paintMeetingBadge(attendee.badgeGraphics, attendee.badgeText, language, call.phase, decision);
          }
        }
        onCeoOfficeProcessedRef.current?.(call.id); continue;
      }
      const fromPos = agentPosRef.current.get(call.fromAgentId);
      if (!fromPos) continue;
      trackProcessedId(processedCeoOfficeRef.current, call.id);
      const dc = new Container();
      const spriteNum = spriteMapRef.current.get(call.fromAgentId) ?? ((hashStr(call.fromAgentId) % 13) + 1);
      const frames: Texture[] = [];
      for (let f = 1; f <= 3; f++) { const key = `${spriteNum}-D-${f}`; if (textures[key]) frames.push(textures[key]); }
      if (frames.length > 0) {
        const animSprite = new AnimatedSprite(frames);
        animSprite.anchor.set(0.5, 1); animSprite.scale.set(44 / animSprite.texture.height);
        animSprite.animationSpeed = 0.12; animSprite.play(); dc.addChild(animSprite);
      } else {
        const fb = new Graphics();
        fb.circle(0, -18, 8).fill(0x6b7280);
        fb.roundRect(-6, -8, 12, 14, 2).fill(0x4b5563);
        fb.position.set(0, 0);
        dc.addChild(fb);
      }
      const badge = new Graphics(); dc.addChild(badge);
      const decision = resolveMeetingDecision(call.phase, call.decision, call.line);
      const badgeText = new Text({ text: "", style: new TextStyle({ fontSize: 7, fill: 0x111111, fontWeight: "bold", fontFamily: "system-ui, sans-serif" }) });
      badgeText.anchor.set(0.5, 0.5); badgeText.position.set(0, 10.5); dc.addChild(badgeText);
      paintMeetingBadge(badge, badgeText, language, call.phase, decision);
      dc.position.set(fromPos.x, fromPos.y); dlLayer.addChild(dc);
      for (let i = deliveriesRef.current.length - 1; i >= 0; i--) {
        const d = deliveriesRef.current[i];
        if (d.agentId !== call.fromAgentId) continue;
        destroyNode(d.sprite); deliveriesRef.current.splice(i, 1);
      }
      deliveriesRef.current.push({
        sprite: dc, fromX: fromPos.x, fromY: fromPos.y, toX: seat.x, toY: seat.y, progress: 0,
        speed: 0.0048, type: "walk", agentId: call.fromAgentId, holdAtSeat: true,
        holdUntil: call.holdUntil ?? (Date.now() + 600_000), meetingSeatIndex: call.seatIndex,
        meetingDecision: decision, badgeGraphics: badge, badgeText,
      });
      onCeoOfficeProcessedRef.current?.(call.id);
    }
  }, [props.ceoOfficeCalls, language, props.agents,
      deliveryLayerRef, texturesRef, deliveriesRef, ceoMeetingSeatsRef, spriteMapRef, agentPosRef, processedCeoOfficeRef]);
}
