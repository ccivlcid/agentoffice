// @ts-nocheck
/**
 * HTTP route handlers for auto-update: status, config, apply.
 * Extracted from auto-update.ts to reduce single-file size.
 */

import { isAuthenticated } from "../../../security/auth.ts";
import { needsForceConfirmation } from "../update-auto-policy.ts";
import type { UpdateApplyResult } from "./auto-update-helpers.ts";
import {
  AUTO_UPDATE_CHANNEL, AUTO_UPDATE_RESTART_MODE,
  autoUpdateState, parseUpdateBooleanFlag,
} from "./auto-update-helpers.ts";

type UpdateRouteService = {
  refreshAutoUpdateActiveState(): void;
  readAutoUpdateEnabledSetting(): boolean;
  writeAutoUpdateEnabledSetting(enabled: boolean): void;
  applyUpdateNow(forceRefresh?: boolean): Promise<UpdateApplyResult>;
  clearUpdateStatusCache(): void;
  getActive(): boolean;
};

export function registerAutoUpdateRoutes(app: any, svc: UpdateRouteService): void {
  app.get("/api/update-auto-status", (_req: any, res: any) => {
    svc.refreshAutoUpdateActiveState();
    res.json({
      ok: true,
      active: svc.getActive(),
      enabled: svc.readAutoUpdateEnabledSetting(),
      running: autoUpdateState.running,
      last_checked_at: autoUpdateState.last_checked_at,
      last_result: autoUpdateState.last_result,
      last_error: autoUpdateState.last_error,
      last_runtime_error: autoUpdateState.last_runtime_error,
      next_check_at: autoUpdateState.next_check_at,
      channel: AUTO_UPDATE_CHANNEL,
      restart_mode: AUTO_UPDATE_RESTART_MODE,
    });
  });

  app.post("/api/update-auto-config", (req: any, res: any) => {
    if (!isAuthenticated(req)) { res.status(401).json({ ok: false, error: "unauthorized" }); return; }
    const enabled = req.body?.enabled;
    if (typeof enabled === "boolean") {
      svc.writeAutoUpdateEnabledSetting(enabled);
      svc.refreshAutoUpdateActiveState();
    }
    res.json({ ok: true, enabled: svc.readAutoUpdateEnabledSetting() });
  });

  app.post("/api/update-apply", async (req: any, res: any) => {
    if (!isAuthenticated(req)) { res.status(401).json({ ok: false, error: "unauthorized" }); return; }
    const force = parseUpdateBooleanFlag(req.body?.force);
    const forceConfirmed = parseUpdateBooleanFlag(req.body?.force_confirmed);
    if (needsForceConfirmation(force, forceConfirmed)) {
      res.status(400).json({ ok: false, error: "force_confirmation_required", message: "force=true requires force_confirmed=true" });
      return;
    }
    try {
      const result = await svc.applyUpdateNow(true);
      res.json({ ok: result.status !== "error" && result.status !== "skipped", ...result });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, status: "error", error: msg });
    } finally {
      svc.clearUpdateStatusCache();
    }
  });
}
