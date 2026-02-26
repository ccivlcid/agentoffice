// @ts-nocheck
import type { RuntimeContext } from "../../../types/runtime-context.ts";
import fs from "node:fs";

export function initCopilotAgent(ctx: RuntimeContext, oauthHelpers: any, streamHelpers: any) {
  const broadcast = ctx.broadcast;
  const createSubtaskFromCli = ctx.createSubtaskFromCli;
  const completeSubtaskFromCli = ctx.completeSubtaskFromCli;

  const {
    getPreferredOAuthAccounts,
    getOAuthAccountDisplayName,
    getProviderModelConfig,
    getOAuthAutoSwapEnabled,
    prioritizeOAuthAccount,
    rotateOAuthAccounts,
    markOAuthAccountSuccess,
    markOAuthAccountFailure,
    exchangeCopilotToken,
  } = oauthHelpers;

  const { createSafeLogStreamOps, parseSSEStream } = streamHelpers;

  function resolveCopilotModel(rawModel: string): string {
    return rawModel.includes("/") ? rawModel.split("/").pop()! : rawModel;
  }

  async function executeCopilotAgent(
    prompt: string,
    projectPath: string,
    logStream: fs.WriteStream,
    signal: AbortSignal,
    taskId?: string,
    preferredAccountId?: string | null,
    safeWriteOverride?: (text: string) => boolean,
  ): Promise<void> {
    const safeWrite = safeWriteOverride ?? createSafeLogStreamOps(logStream).safeWrite;
    const modelConfig = getProviderModelConfig();
    const defaultRawModel = modelConfig.copilot?.model || "github-copilot/gpt-4o";
    const autoSwap = getOAuthAutoSwapEnabled();
    const preferred = getPreferredOAuthAccounts("github").filter((a) => Boolean(a.accessToken));
    const baseAccounts = prioritizeOAuthAccount(preferred, preferredAccountId);
    const hasPinnedAccount = Boolean(preferredAccountId) && baseAccounts.some((a) => a.id === preferredAccountId);
    const accounts = hasPinnedAccount ? baseAccounts : rotateOAuthAccounts("github", baseAccounts);
    if (accounts.length === 0) {
      throw new Error("No GitHub OAuth token found. Connect GitHub Copilot first.");
    }

    const maxAttempts = autoSwap ? accounts.length : Math.min(accounts.length, 1);
    let lastError: Error | null = null;

    for (let i = 0; i < maxAttempts; i += 1) {
      const account = accounts[i];
      if (!account.accessToken) continue;
      const accountName = getOAuthAccountDisplayName(account);
      const rawModel = account.modelOverride || defaultRawModel;
      const model = resolveCopilotModel(rawModel);

      const header = `[copilot] Account: ${accountName}${account.modelOverride ? ` (model override: ${rawModel})` : ""}\n`;
      safeWrite(header);
      if (taskId) broadcast("cli_output", { task_id: taskId, stream: "stderr", data: header });

      try {
        safeWrite("[copilot] Exchanging Copilot token...\n");
        if (taskId) broadcast("cli_output", { task_id: taskId, stream: "stderr", data: "[copilot] Exchanging Copilot token...\n" });
        const { token, baseUrl } = await exchangeCopilotToken(account.accessToken);
        safeWrite(`[copilot] Model: ${model}, Base: ${baseUrl}\n---\n`);
        if (taskId) broadcast("cli_output", { task_id: taskId, stream: "stderr", data: `[copilot] Model: ${model}, Base: ${baseUrl}\n---\n` });

        const resp = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "Editor-Version": "climpire/1.0.0",
            "Copilot-Integration-Id": "vscode-chat",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: `You are a coding assistant. Project path: ${projectPath}` },
              { role: "user", content: prompt },
            ],
            stream: true,
          }),
          signal,
        });

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Copilot API error (${resp.status}): ${text}`);
        }

        await parseSSEStream(resp.body!, signal, safeWrite, taskId, createSubtaskFromCli, completeSubtaskFromCli);
        markOAuthAccountSuccess(account.id!);
        if (i > 0 && autoSwap && account.id) {
          setActiveOAuthAccount("github", account.id);
          const swapMsg = `[copilot] Promoted account in active pool: ${accountName}\n`;
          safeWrite(swapMsg);
          if (taskId) broadcast("cli_output", { task_id: taskId, stream: "stderr", data: swapMsg });
        }
        safeWrite(`\n---\n[copilot] Done.\n`);
        if (taskId) broadcast("cli_output", { task_id: taskId, stream: "stderr", data: "\n---\n[copilot] Done.\n" });
        return;
      } catch (err: any) {
        if (signal.aborted || err?.name === "AbortError") throw err;
        const msg = err?.message ? String(err.message) : String(err);
        markOAuthAccountFailure(account.id!, msg);
        const failMsg = `[copilot] Account ${accountName} failed: ${msg}\n`;
        safeWrite(failMsg);
        if (taskId) broadcast("cli_output", { task_id: taskId, stream: "stderr", data: failMsg });
        lastError = err instanceof Error ? err : new Error(msg);
        if (autoSwap && i + 1 < maxAttempts) {
          const nextName = getOAuthAccountDisplayName(accounts[i + 1]);
          const swapMsg = `[copilot] Trying fallback account: ${nextName}\n`;
          safeWrite(swapMsg);
          if (taskId) broadcast("cli_output", { task_id: taskId, stream: "stderr", data: swapMsg });
        }
      }
    }

    throw lastError ?? new Error("No runnable GitHub Copilot account available.");
  }

  return {
    resolveCopilotModel,
    executeCopilotAgent,
  };
}
