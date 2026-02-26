// @ts-nocheck
/**
 * OAuth flow routes: start, callbacks for GitHub and Google Antigravity.
 * Extracted from oauth.ts to reduce single-file size.
 */

import { randomUUID, createHash } from "node:crypto";
import {
  BUILTIN_GITHUB_CLIENT_ID, BUILTIN_GOOGLE_CLIENT_ID, BUILTIN_GOOGLE_CLIENT_SECRET,
  OAUTH_BASE_URL, appendOAuthQuery, b64url, pkceVerifier, sanitizeOAuthRedirect, encryptSecret, decryptSecret,
} from "../../../oauth/helpers.ts";
import type { UpsertOAuthInput } from "./oauth-credentials.ts";

type FlowCtx = {
  db: any;
  firstQueryValue: Function;
};

type CredService = {
  consumeOAuthState: (stateId: string, provider: string) => { verifier_enc: string; redirect_to: string | null } | null;
  upsertOAuthCredential: (input: UpsertOAuthInput) => string;
};

function startGitHubOAuth(db: any, redirectTo: string | undefined, callbackPath: string): string {
  const clientId = process.env.OAUTH_GITHUB_CLIENT_ID ?? BUILTIN_GITHUB_CLIENT_ID;
  if (!clientId) throw new Error("missing_OAUTH_GITHUB_CLIENT_ID");
  const stateId = randomUUID();
  const safeRedirect = sanitizeOAuthRedirect(redirectTo);
  db.prepare("INSERT INTO oauth_states (id, provider, created_at, verifier_enc, redirect_to) VALUES (?, ?, ?, ?, ?)")
    .run(stateId, "github", Date.now(), "none", safeRedirect);
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${OAUTH_BASE_URL}${callbackPath}`);
  url.searchParams.set("state", stateId);
  url.searchParams.set("scope", "read:user user:email repo");
  return url.toString();
}

function startGoogleAntigravityOAuth(db: any, redirectTo: string | undefined, callbackPath: string): string {
  const clientId = process.env.OAUTH_GOOGLE_CLIENT_ID ?? BUILTIN_GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("missing_OAUTH_GOOGLE_CLIENT_ID");
  const stateId = randomUUID();
  const verifier = pkceVerifier();
  const safeRedirect = sanitizeOAuthRedirect(redirectTo);
  db.prepare("INSERT INTO oauth_states (id, provider, created_at, verifier_enc, redirect_to) VALUES (?, ?, ?, ?, ?)")
    .run(stateId, "google_antigravity", Date.now(), encryptSecret(verifier), safeRedirect);
  const challenge = b64url(createHash("sha256").update(verifier, "ascii").digest());
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", `${OAUTH_BASE_URL}${callbackPath}`);
  url.searchParams.set("scope", ["https://www.googleapis.com/auth/cloud-platform", "openid", "email", "profile"].join(" "));
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", stateId);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

async function handleGitHubCallback(cred: CredService, code: string, stateId: string, callbackPath: string): Promise<{ redirectTo: string }> {
  const stateRow = cred.consumeOAuthState(stateId, "github");
  if (!stateRow) throw new Error("Invalid or expired state");
  const redirectTo = stateRow.redirect_to || "/";
  const clientId = process.env.OAUTH_GITHUB_CLIENT_ID ?? BUILTIN_GITHUB_CLIENT_ID;
  const clientSecret = process.env.OAUTH_GITHUB_CLIENT_SECRET;
  const tokenBody: Record<string, string> = { client_id: clientId, code, redirect_uri: `${OAUTH_BASE_URL}${callbackPath}` };
  if (clientSecret) tokenBody.client_secret = clientSecret;
  const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(tokenBody), signal: AbortSignal.timeout(10000),
  });
  const tokenData = await tokenResp.json() as { access_token?: string; error?: string; scope?: string };
  if (!tokenData.access_token) throw new Error(tokenData.error || "No access token received");
  let email: string | null = null;
  try {
    const emailResp = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, "User-Agent": "climpire", Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(5000),
    });
    if (emailResp.ok) {
      const emails = await emailResp.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
      const primary = emails.find((e) => e.primary && e.verified);
      if (primary) email = primary.email;
    }
  } catch { /* best-effort */ }
  cred.upsertOAuthCredential({ provider: "github", source: "web-oauth", email, scope: tokenData.scope?.trim() || null, access_token: tokenData.access_token, refresh_token: null, expires_at: null });
  return { redirectTo: appendOAuthQuery(redirectTo.startsWith("/") ? `${OAUTH_BASE_URL}${redirectTo}` : redirectTo, "oauth", "github-copilot") };
}

async function handleGoogleAntigravityCallback(cred: CredService, code: string, stateId: string, callbackPath: string): Promise<{ redirectTo: string }> {
  const stateRow = cred.consumeOAuthState(stateId, "google_antigravity");
  if (!stateRow) throw new Error("Invalid or expired state");
  const redirectTo = stateRow.redirect_to || "/";
  const clientId = process.env.OAUTH_GOOGLE_CLIENT_ID ?? BUILTIN_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.OAUTH_GOOGLE_CLIENT_SECRET ?? BUILTIN_GOOGLE_CLIENT_SECRET;
  const verifier = decryptSecret(stateRow.verifier_enc);
  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: `${OAUTH_BASE_URL}${callbackPath}`, grant_type: "authorization_code", code_verifier: verifier }),
    signal: AbortSignal.timeout(10000),
  });
  const tokenData = await tokenResp.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; scope?: string };
  if (!tokenData.access_token) throw new Error(tokenData.error || "No access token received");
  let email: string | null = null;
  try {
    const userResp = await fetch("https://www.googleapis.com/oauth2/v1/userinfo?alt=json", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }, signal: AbortSignal.timeout(8000),
    });
    if (userResp.ok) {
      const ui = await userResp.json() as { email?: string };
      if (ui?.email) email = ui.email;
    }
  } catch { /* best-effort */ }
  const expiresAt = tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : null;
  cred.upsertOAuthCredential({ provider: "google_antigravity", source: "web-oauth", email, scope: tokenData.scope || "openid email profile", access_token: tokenData.access_token, refresh_token: tokenData.refresh_token || null, expires_at: expiresAt });
  return { redirectTo: appendOAuthQuery(redirectTo.startsWith("/") ? `${OAUTH_BASE_URL}${redirectTo}` : redirectTo, "oauth", "antigravity") };
}

export function registerOAuthFlow(app: any, ctx: FlowCtx, cred: CredService): void {
  const { db, firstQueryValue } = ctx;

  app.get("/api/oauth/start", (req: any, res: any) => {
    const provider = firstQueryValue(req.query.provider);
    const redirectTo = sanitizeOAuthRedirect(firstQueryValue(req.query.redirect_to));
    try {
      let authorizeUrl: string;
      if (provider === "github-copilot") {
        authorizeUrl = startGitHubOAuth(db, redirectTo, "/api/oauth/callback/github-copilot");
      } else if (provider === "antigravity") {
        authorizeUrl = startGoogleAntigravityOAuth(db, redirectTo, "/api/oauth/callback/antigravity");
      } else {
        return res.status(400).json({ error: `Unsupported provider: ${provider}` });
      }
      res.redirect(302, authorizeUrl);
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/api/oauth/callback/github-copilot", async (req: any, res: any) => {
    const code = firstQueryValue(req.query.code);
    const state = firstQueryValue(req.query.state);
    const error = firstQueryValue(req.query.error);
    if (error || !code || !state) {
      const redirectUrl = new URL("/", OAUTH_BASE_URL);
      redirectUrl.searchParams.set("oauth_error", error || "missing_code");
      return res.redirect(redirectUrl.toString());
    }
    try {
      const result = await handleGitHubCallback(cred, code, state, "/api/oauth/callback/github-copilot");
      res.redirect(result.redirectTo);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[OAuth] GitHub/Copilot callback error:", msg);
      const redirectUrl = new URL("/", OAUTH_BASE_URL);
      redirectUrl.searchParams.set("oauth_error", msg);
      res.redirect(redirectUrl.toString());
    }
  });

  app.get("/api/oauth/callback/antigravity", async (req: any, res: any) => {
    const code = firstQueryValue(req.query.code);
    const state = firstQueryValue(req.query.state);
    const error = firstQueryValue(req.query.error);
    if (error || !code || !state) {
      const redirectUrl = new URL("/", OAUTH_BASE_URL);
      redirectUrl.searchParams.set("oauth_error", error || "missing_code");
      return res.redirect(redirectUrl.toString());
    }
    try {
      const result = await handleGoogleAntigravityCallback(cred, code, state, "/api/oauth/callback/antigravity");
      res.redirect(result.redirectTo);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[OAuth] Antigravity callback error:", msg);
      const redirectUrl = new URL("/", OAUTH_BASE_URL);
      redirectUrl.searchParams.set("oauth_error", msg);
      res.redirect(redirectUrl.toString());
    }
  });
}
