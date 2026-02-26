/**
 * Static file serving and SPA fallback for production.
 */

import path from "node:path";
import express from "express";
import type { Express } from "express";

export function installStaticMiddleware(
  app: Express,
  distDir: string,
  isProduction: boolean,
): void {
  if (!isProduction) return;

  app.use(express.static(distDir));
  app.get("/{*splat}", (req: { path: string }, res: { status: (code: number) => { json: (payload: unknown) => unknown }; sendFile: (p: string) => unknown }) => {
    if (req.path.startsWith("/api/") || req.path === "/health" || req.path === "/healthz") {
      return res.status(404).json({ error: "not_found" });
    }
    res.sendFile(path.join(distDir, "index.html"));
  });
}
