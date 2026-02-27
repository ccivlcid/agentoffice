import type { MutableRefObject } from "react";
import type { Delivery } from "./officeViewTypes.ts";

/* ================================================================== */
/*  Delivery animation tick — extracted from officeViewAnimTick.ts     */
/* ================================================================== */

export interface DeliveryTickParams {
  deliveriesRef: MutableRefObject<Delivery[]>;
  DELIVERY_SPEED: number;
  destroyNode: (node: any) => void;
}

export function tickDeliveries(p: DeliveryTickParams): void {
  const { deliveriesRef, DELIVERY_SPEED, destroyNode } = p;
  const deliveries = deliveriesRef.current;
  const now = Date.now();

  for (let i = deliveries.length - 1; i >= 0; i--) {
    const d = deliveries[i];
    if (d.sprite.destroyed) {
      deliveries.splice(i, 1);
      continue;
    }
    if (d.holdAtSeat && d.arrived) {
      if (!d.seatedPoseApplied) {
        for (const child of d.sprite.children) {
          const maybeAnim = child as unknown as { stop?: () => void; gotoAndStop?: (frame: number) => void };
          if (typeof maybeAnim.stop === "function" && typeof maybeAnim.gotoAndStop === "function") {
            maybeAnim.stop();
            maybeAnim.gotoAndStop(0);
          }
        }
        d.seatedPoseApplied = true;
      }
      d.sprite.position.set(d.toX, d.toY);
      d.sprite.alpha = 1;
      if (d.holdUntil && now >= d.holdUntil) {
        destroyNode(d.sprite);
        deliveries.splice(i, 1);
      }
      continue;
    }
    d.progress += d.speed ?? DELIVERY_SPEED;
    if (d.progress >= 1) {
      if (d.holdAtSeat) {
        d.arrived = true;
        d.progress = 1;
        d.sprite.position.set(d.toX, d.toY);
        d.sprite.alpha = 1;
        continue;
      }
      destroyNode(d.sprite);
      deliveries.splice(i, 1);
    } else if (d.type === "walk") {
      const t = d.progress,
        ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      d.sprite.position.x = d.fromX + (d.toX - d.fromX) * ease;
      d.sprite.position.y = d.fromY + (d.toY - d.fromY) * ease - Math.abs(Math.sin(t * Math.PI * 12)) * 3;
      if (t < 0.05) d.sprite.alpha = t / 0.05;
      else if (t > 0.9) d.sprite.alpha = (1 - t) / 0.1;
      else d.sprite.alpha = 1;
      d.sprite.scale.x = d.toX > d.fromX ? 1 : -1;
    } else {
      const t = d.progress,
        ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const arc = d.arcHeight ?? -30;
      d.sprite.position.x = d.fromX + (d.toX - d.fromX) * ease;
      d.sprite.position.y = d.fromY + (d.toY - d.fromY) * ease + Math.sin(t * Math.PI) * arc;
      d.sprite.alpha = t > 0.85 ? (1 - t) / 0.15 : 1;
      d.sprite.scale.set(0.8 + Math.sin(t * Math.PI) * 0.3);
    }
  }
}
