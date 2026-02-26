// @ts-nocheck
import { createHash } from "node:crypto";
import { BUILTIN_GOOGLE_CLIENT_ID, BUILTIN_GOOGLE_CLIENT_SECRET, encryptSecret } from "../../../oauth/helpers.ts";

export function initOAuthTokenHelpers(db: any, nowMs: () => number, ANTIGRAVITY_ENDPOINTS: string[], ANTIGRAVITY_DEFAULT_PROJECT: string) {
  let copilotTokenCache: { token: string; baseUrl: string; expiresAt: number; sourceHash: string } | null = null;
  let antigravityProjectCache: { projectId: string; tokenHash: string } | null = null;

  async function refreshGoogleToken(credential: any): Promise<string> {
    const expiresAtMs = credential.expiresAt && credential.expiresAt < 1e12
      ? credential.expiresAt * 1000
      : credential.expiresAt;
    if (credential.accessToken && expiresAtMs && expiresAtMs > Date.now() + 60_000) {
      return credential.accessToken;
    }
    if (!credential.refreshToken) {
      throw new Error("Google OAuth token expired and no refresh_token available");
    }
    const clientId = process.env.OAUTH_GOOGLE_CLIENT_ID ?? BUILTIN_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.OAUTH_GOOGLE_CLIENT_SECRET ?? BUILTIN_GOOGLE_CLIENT_SECRET;
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: credential.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Google token refresh failed (${resp.status}): ${text}`);
    }
    const data = await resp.json() as { access_token: string; expires_in?: number };
    const newExpiresAt = data.expires_in ? Date.now() + data.expires_in * 1000 : null;
    const now = nowMs();
    const accessEnc = encryptSecret(data.access_token);
    if (credential.id) {
      db.prepare(`
        UPDATE oauth_accounts
        SET access_token_enc = ?, expires_at = ?, updated_at = ?, last_success_at = ?, last_error = NULL, last_error_at = NULL
        WHERE id = ?
      `).run(accessEnc, newExpiresAt, now, now, credential.id);
    }
    db.prepare(
      "UPDATE oauth_credentials SET access_token_enc = ?, expires_at = ?, updated_at = ? WHERE provider = 'google_antigravity'"
    ).run(accessEnc, newExpiresAt, now);
    return data.access_token;
  }

  async function exchangeCopilotToken(githubToken: string): Promise<{ token: string; baseUrl: string; expiresAt: number }> {
    const sourceHash = createHash("sha256").update(githubToken).digest("hex").slice(0, 16);
    if (copilotTokenCache
        && copilotTokenCache.expiresAt > Date.now() + 5 * 60_000
        && copilotTokenCache.sourceHash === sourceHash) {
      return copilotTokenCache;
    }
    const resp = await fetch("https://api.github.com/copilot_internal/v2/token", {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/json",
        "User-Agent": "climpire",
      },
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Copilot token exchange failed (${resp.status}): ${text}`);
    }
    const data = await resp.json() as { token: string; expires_at: number; endpoints?: { api?: string } };
    let baseUrl = "https://api.individual.githubcopilot.com";
    const proxyMatch = data.token.match(/proxy-ep=([^;]+)/);
    if (proxyMatch) {
      baseUrl = `https://${proxyMatch[1].replace(/^proxy\./, "api.")}`;
    }
    if (data.endpoints?.api) {
      baseUrl = data.endpoints.api.replace(/\/$/, "");
    }
    const expiresAt = data.expires_at * 1000;
    copilotTokenCache = { token: data.token, baseUrl, expiresAt, sourceHash };
    return copilotTokenCache;
  }

  async function loadCodeAssistProject(accessToken: string, signal?: AbortSignal): Promise<string> {
    const tokenHash = createHash("sha256").update(accessToken).digest("hex").slice(0, 16);
    if (antigravityProjectCache && antigravityProjectCache.tokenHash === tokenHash) {
      return antigravityProjectCache.projectId;
    }
    for (const endpoint of ANTIGRAVITY_ENDPOINTS) {
      try {
        const resp = await fetch(`${endpoint}/v1internal:loadCodeAssist`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "User-Agent": "google-api-nodejs-client/9.15.1",
            "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
            "Client-Metadata": JSON.stringify({ ideType: "ANTIGRAVITY", platform: process.platform === "win32" ? "WINDOWS" : "MACOS", pluginType: "GEMINI" }),
          },
          body: JSON.stringify({
            metadata: { ideType: "ANTIGRAVITY", platform: process.platform === "win32" ? "WINDOWS" : "MACOS", pluginType: "GEMINI" },
          }),
          signal,
        });
        if (!resp.ok) continue;
        const data = await resp.json() as any;
        const proj = data?.cloudaicompanionProject?.id ?? data?.cloudaicompanionProject;
        if (typeof proj === "string" && proj) {
          antigravityProjectCache = { projectId: proj, tokenHash };
          return proj;
        }
      } catch { /* try next endpoint */ }
    }
    antigravityProjectCache = { projectId: ANTIGRAVITY_DEFAULT_PROJECT, tokenHash };
    return ANTIGRAVITY_DEFAULT_PROJECT;
  }

  return { refreshGoogleToken, exchangeCopilotToken, loadCodeAssistProject };
}
