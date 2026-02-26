// @ts-nocheck
/**
 * Core API: health check routes only.
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import { PKG_VERSION } from "../../../config/runtime.ts";

export function registerCoreHealth(ctx: RuntimeContext): void {
  const { app, dbPath } = ctx;
  const buildHealthPayload = () => ({
    ok: true,
    version: PKG_VERSION,
    app: "HyperClaw",
    dbPath,
  });
  app.get("/health", (_req: any, res: any) => res.json(buildHealthPayload()));
  app.get("/healthz", (_req: any, res: any) => res.json(buildHealthPayload()));
  app.get("/api/health", (_req: any, res: any) => res.json(buildHealthPayload()));
}
