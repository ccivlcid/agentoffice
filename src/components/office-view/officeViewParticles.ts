import { Graphics, Container, Text, TextStyle } from "pixi.js";
import type { SubCloneBurstParticle } from "./officeViewTypes";

/* ================================================================== */
/*  Particle burst helpers                                             */
/* ================================================================== */

export function emitSubCloneSmokeBurst(
  target: Container,
  particles: SubCloneBurstParticle[],
  x: number,
  y: number,
  mode: "spawn" | "despawn",
): void {
  const baseColor = mode === "spawn" ? 0xc7d4ec : 0xb7bfd1;
  const strokeColor = mode === "spawn" ? 0xe6edff : 0xd4dae8;
  const puffCount = mode === "spawn" ? 9 : 7;
  for (let i = 0; i < puffCount; i++) {
    const puff = new Graphics();
    const radius = 1.8 + Math.random() * 2.8;
    puff.circle(0, 0, radius).fill({ color: baseColor, alpha: 0.62 + Math.random() * 0.18 });
    puff.circle(0, 0, radius).stroke({ width: 0.6, color: strokeColor, alpha: 0.32 });
    puff.position.set(x + (Math.random() - 0.5) * 10, y - 14 + (Math.random() - 0.5) * 6);
    target.addChild(puff);
    particles.push({
      node: puff,
      vx: (Math.random() - 0.5) * (mode === "spawn" ? 1.4 : 1.1),
      vy: -0.22 - Math.random() * 0.6,
      life: 0,
      maxLife: 20 + Math.floor(Math.random() * 12),
      spin: (Math.random() - 0.5) * 0.1,
      growth: 0.013 + Math.random() * 0.012,
    });
  }

  const flash = new Graphics();
  flash.circle(0, 0, mode === "spawn" ? 5.4 : 4.2).fill({ color: 0xf8fbff, alpha: mode === "spawn" ? 0.52 : 0.42 });
  flash.position.set(x, y - 14);
  target.addChild(flash);
  particles.push({
    node: flash,
    vx: 0,
    vy: -0.16,
    life: 0,
    maxLife: mode === "spawn" ? 14 : 12,
    spin: 0,
    growth: 0.022,
  });

  const burstTxt = new Text({
    text: "펑",
    style: new TextStyle({
      fontSize: 7,
      fill: mode === "spawn" ? 0xeff4ff : 0xdde4f5,
      fontWeight: "bold",
      fontFamily: "system-ui, sans-serif",
      stroke: { color: 0x1f2838, width: 2 },
    }),
  });
  burstTxt.anchor.set(0.5, 0.5);
  burstTxt.position.set(x, y - 24);
  target.addChild(burstTxt);
  particles.push({
    node: burstTxt,
    vx: (Math.random() - 0.5) * 0.35,
    vy: -0.3,
    life: 0,
    maxLife: mode === "spawn" ? 18 : 16,
    spin: (Math.random() - 0.5) * 0.04,
    growth: 0.004,
  });
}

export function emitSubCloneFireworkBurst(
  target: Container,
  particles: SubCloneBurstParticle[],
  x: number,
  y: number,
): void {
  const colors = [0xff6b6b, 0xffc75f, 0x7ce7ff, 0x8cff9f, 0xd7a6ff];
  const sparkCount = 10;
  for (let i = 0; i < sparkCount; i++) {
    const spark = new Graphics();
    const color = colors[Math.floor(Math.random() * colors.length)];
    const radius = 0.85 + Math.random() * 0.6;
    spark.circle(0, 0, radius).fill({ color, alpha: 0.96 });
    spark.circle(0, 0, radius).stroke({ width: 0.45, color: 0xffffff, alpha: 0.5 });
    spark.position.set(x + (Math.random() - 0.5) * 5, y + (Math.random() - 0.5) * 3);
    target.addChild(spark);
    const angle = (Math.PI * 2 * i) / sparkCount + (Math.random() - 0.5) * 0.45;
    const speed = 0.9 + Math.random() * 0.85;
    particles.push({
      node: spark,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.45,
      life: 0,
      maxLife: 16 + Math.floor(Math.random() * 8),
      spin: (Math.random() - 0.5) * 0.08,
      growth: 0.006 + Math.random() * 0.006,
    });
  }
}
