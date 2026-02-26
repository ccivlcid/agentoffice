// @ts-nocheck
/**
 * Core API: update status check (GitHub releases) and GET /api/update-status.
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import { PKG_VERSION } from "../../../config/runtime.ts";
import { isRemoteVersionNewer, normalizeVersionTag } from "../update-auto-utils.ts";

export type UpdateStatusPayload = {
  current_version: string;
  latest_version: string | null;
  update_available: boolean;
  release_url: string | null;
  checked_at: number;
  enabled: boolean;
  repo: string;
  error: string | null;
};

const UPDATE_CHECK_ENABLED = String(process.env.UPDATE_CHECK_ENABLED ?? "1").trim() !== "0";
const UPDATE_CHECK_REPO = String(process.env.UPDATE_CHECK_REPO ?? "YOUR_ORG/hyperclaw").trim();
const UPDATE_CHECK_TTL_MS = Math.max(60_000, Number(process.env.UPDATE_CHECK_TTL_MS ?? 30 * 60 * 1000) || (30 * 60 * 1000));
const UPDATE_CHECK_TIMEOUT_MS = Math.max(1_000, Number(process.env.UPDATE_CHECK_TIMEOUT_MS ?? 4_000) || 4_000);

let updateStatusCache: UpdateStatusPayload | null = null;
let updateStatusCachedAt = 0;
let updateStatusInFlight: Promise<UpdateStatusPayload> | null = null;

export async function fetchUpdateStatus(forceRefresh = false): Promise<UpdateStatusPayload> {
  const now = Date.now();
  if (!UPDATE_CHECK_ENABLED) {
    return {
      current_version: PKG_VERSION,
      latest_version: null,
      update_available: false,
      release_url: null,
      checked_at: now,
      enabled: false,
      repo: UPDATE_CHECK_REPO,
      error: null,
    };
  }
  const cacheValid = updateStatusCache && now - updateStatusCachedAt < UPDATE_CHECK_TTL_MS;
  if (!forceRefresh && cacheValid && updateStatusCache) return updateStatusCache;
  if (!forceRefresh && updateStatusInFlight) return updateStatusInFlight;

  updateStatusInFlight = (async () => {
    let latestVersion: string | null = null;
    let releaseUrl: string | null = null;
    let error: string | null = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), UPDATE_CHECK_TIMEOUT_MS);
      try {
        const response = await fetch(`https://api.github.com/repos/${UPDATE_CHECK_REPO}/releases/latest`, {
          method: "GET",
          headers: {
            accept: "application/vnd.github+json",
            "user-agent": "hyperclaw-update-check",
          },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`github_http_${response.status}`);
        const body = await response.json().catch(() => null) as { tag_name?: unknown; html_url?: unknown } | null;
        latestVersion = typeof body?.tag_name === "string" ? normalizeVersionTag(body.tag_name) : null;
        releaseUrl = typeof body?.html_url === "string" ? body.html_url : null;
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    const next: UpdateStatusPayload = {
      current_version: PKG_VERSION,
      latest_version: latestVersion,
      update_available: Boolean(latestVersion && isRemoteVersionNewer(latestVersion, PKG_VERSION)),
      release_url: releaseUrl,
      checked_at: Date.now(),
      enabled: true,
      repo: UPDATE_CHECK_REPO,
      error,
    };
    updateStatusCache = next;
    updateStatusCachedAt = Date.now();
    return next;
  })().finally(() => {
    updateStatusInFlight = null;
  });
  return updateStatusInFlight;
}

export function clearUpdateStatusCache(): void {
  updateStatusCachedAt = 0;
  updateStatusCache = null;
}

/**
 * Registers GET /api/update-status and returns fetchUpdateStatus + clearUpdateStatusCache for use by auto-update.
 */
export function registerUpdateStatus(ctx: RuntimeContext): {
  fetchUpdateStatus: typeof fetchUpdateStatus;
  clearUpdateStatusCache: typeof clearUpdateStatusCache;
} {
  const { app } = ctx;
  app.get("/api/update-status", async (req: any, res: any) => {
    const refresh = String(req.query?.refresh ?? "").trim() === "1";
    const status = await fetchUpdateStatus(refresh);
    res.json({ ok: true, ...status });
  });
  return { fetchUpdateStatus, clearUpdateStatusCache };
}
