// @ts-nocheck
/**
 * Core API: health check, update status, and auto-update routes.
 * Composes health.ts, update-status.ts, and auto-update.ts.
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import { registerCoreHealth } from "./health.ts";
import { registerUpdateStatus } from "./update-status.ts";
import { registerAutoUpdate } from "./auto-update.ts";

export function registerCoreHealthUpdate(ctx: RuntimeContext): void {
  registerCoreHealth(ctx);
  const { fetchUpdateStatus, clearUpdateStatusCache } = registerUpdateStatus(ctx);
  registerAutoUpdate(ctx, fetchUpdateStatus, clearUpdateStatusCache);
}
