// @ts-nocheck
import type { RuntimeContext } from "../../../types/runtime-context.ts";
import fs from "node:fs";
import path from "node:path";

export function initAntigravityAgent(ctx: RuntimeContext, oauthHelpers: any, streamHelpers: any, copilotHelpers: any) {
  const broadcast = ctx.broadcast;
  const normalizeStreamChunk = ctx.normalizeStreamChunk;
  const logsDir = ctx.logsDir;
  const activeProcesses = ctx.activeProcesses;
  const handleTaskRunComplete = (...args: any[]) => ctx.handleTaskRunComplete(...args);
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
    refreshGoogleToken,
    loadCodeAssistProject,
    ANTIGRAVITY_ENDPOINTS,
  } = oauthHelpers;

  const { createSafeLogStreamOps, parseGeminiSSEStream } = streamHelpers;
  const { executeCopilotAgent } = copilotHelpers;

  function resolveAntigravityModel(rawModel: string): string {
    let model = rawModel;
    if (model.includes("antigravity-")) {
      model = model.slice(model.indexOf("antigravity-") + "antigravity-".length);
    } else if (model.includes("/")) {
      model = model.split("/").pop()!;
    }
    return model;
  }

  async function executeAntigravityAgent(
    prompt: string,
    logStream: fs.WriteStream,
    signal: AbortSignal,
    taskId?: string,
    preferredAccountId?: string | null,
    safeWriteOverride?: (text: string) => boolean,
  ): Promise<void> {
    const safeWrite = safeWriteOverride ?? createSafeLogStreamOps(logStream).safeWrite;
    const modelConfig = getProviderModelConfig();
    const defaultRawModel = modelConfig.antigravity?.model || "google/antigravity-gemini-2.5-pro";
    const autoSwap = getOAuthAutoSwapEnabled();
    const preferred = getPreferredOAuthAccounts("google_antigravity")
      .filter((a) => Boolean(a.accessToken || a.refreshToken));
    const baseAccounts = prioritizeOAuthAccount(preferred, preferredAccountId);
    const hasPinnedAccount = Boolean(preferredAccountId) && baseAccounts.some((a) => a.id === preferredAccountId);
    const accounts = hasPinnedAccount ? baseAccounts : rotateOAuthAccounts("google_antigravity", baseAccounts);
    if (accounts.length === 0) {
      throw new Error("No Google OAuth token found. Connect Antigravity first.");
    }

    const maxAttempts = autoSwap ? accounts.length : Math.min(accounts.length, 1);
    let lastError: Error | null = null;

    for (let i = 0; i < maxAttempts; i += 1) {
      const account = accounts[i];
      const accountName = getOAuthAccountDisplayName(account);
      const rawModel = account.modelOverride || defaultRawModel;
      const model = resolveAntigravityModel(rawModel);

      const header = `[antigravity] Account: ${accountName}${account.modelOverride ? ` (model override: ${rawModel})` : ""}\n`;
      safeWrite(header);
      if (taskId) broadcast("cli_output", { task_id: taskId, stream: "stderr", data: header });

      try {
        safeWrite(`[antigravity] Refreshing token...\n`);
        if (taskId) broadcast("cli_output", { task_id: taskId, stream: "stderr", data: "[antigravity] Refreshing token...\n" });
        const accessToken = await refreshGoogleToken(account);

        safeWrite(`[antigravity] Discovering project...\n`);
        if (taskId) broadcast("cli_output", { task_id: taskId, stream: "stderr", data: "[antigravity] Discovering project...\n" });
        const projectId = await loadCodeAssistProject(accessToken, signal);
        safeWrite(`[antigravity] Model: ${model}, Project: ${projectId}\n---\n`);
        if (taskId) broadcast("cli_output", { task_id: taskId, stream: "stderr", data: `[antigravity] Model: ${model}, Project: ${projectId}\n---\n` });

        const baseEndpoint = ANTIGRAVITY_ENDPOINTS[0];
        const url = `${baseEndpoint}/v1internal:streamGenerateContent?alt=sse`;
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            "User-Agent": `antigravity/1.15.8 ${process.platform === "darwin" ? "darwin/arm64" : "linux/amd64"}`,
            "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
            "Client-Metadata": JSON.stringify({ ideType: "ANTIGRAVITY", platform: process.platform === "win32" ? "WINDOWS" : "MACOS", pluginType: "GEMINI" }),
          },
          body: JSON.stringify({
            project: projectId,
            model,
            requestType: "agent",
            userAgent: "antigravity",
            requestId: `agent-${crypto.randomUUID()}`,
            request: {
              contents: [{ role: "user", parts: [{ text: prompt }] }],
            },
          }),
          signal,
        });

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Antigravity API error (${resp.status}): ${text}`);
        }

        await parseGeminiSSEStream(resp.body!, signal, safeWrite, taskId, createSubtaskFromCli, completeSubtaskFromCli);
        markOAuthAccountSuccess(account.id!);
        if (i > 0 && autoSwap && account.id) {
          setActiveOAuthAccount("google_antigravity", account.id);
          const swapMsg = `[antigravity] Promoted account in active pool: ${accountName}\n`;
          safeWrite(swapMsg);
          if (taskId) broadcast("cli_output", { task_id: taskId, stream: "stderr", data: swapMsg });
        }
        safeWrite(`\n---\n[antigravity] Done.\n`);
        if (taskId) broadcast("cli_output", { task_id: taskId, stream: "stderr", data: "\n---\n[antigravity] Done.\n" });
        return;
      } catch (err: any) {
        if (signal.aborted || err?.name === "AbortError") throw err;
        const msg = err?.message ? String(err.message) : String(err);
        markOAuthAccountFailure(account.id!, msg);
        const failMsg = `[antigravity] Account ${accountName} failed: ${msg}\n`;
        safeWrite(failMsg);
        if (taskId) broadcast("cli_output", { task_id: taskId, stream: "stderr", data: failMsg });
        lastError = err instanceof Error ? err : new Error(msg);
        if (autoSwap && i + 1 < maxAttempts) {
          const nextName = getOAuthAccountDisplayName(accounts[i + 1]);
          const swapMsg = `[antigravity] Trying fallback account: ${nextName}\n`;
          safeWrite(swapMsg);
          if (taskId) broadcast("cli_output", { task_id: taskId, stream: "stderr", data: swapMsg });
        }
      }
    }

    throw lastError ?? new Error("No runnable Antigravity account available.");
  }

  function launchHttpAgent(
    taskId: string,
    agent: "copilot" | "antigravity",
    prompt: string,
    projectPath: string,
    logPath: string,
    controller: AbortController,
    fakePid: number,
    preferredOAuthAccountId?: string | null,
  ): void {
    const logStream = fs.createWriteStream(logPath, { flags: "a" });
    const { safeWrite, safeEnd } = createSafeLogStreamOps(logStream);
    safeWrite(`\n===== task run start ${new Date().toISOString()} | provider=${agent} =====\n`);

    const promptPath = path.join(logsDir, `${taskId}.prompt.txt`);
    fs.writeFileSync(promptPath, prompt, "utf8");

    const mockProc = {
      pid: fakePid,
      kill: () => { controller.abort(); return true; },
    } as unknown as any;
    activeProcesses.set(taskId, mockProc);

    const runTask = (async () => {
      let exitCode = 0;
      try {
        if (agent === "copilot") {
          await executeCopilotAgent(prompt, projectPath, logStream, controller.signal, taskId, preferredOAuthAccountId ?? null, safeWrite);
        } else {
          await executeAntigravityAgent(prompt, logStream, controller.signal, taskId, preferredOAuthAccountId ?? null, safeWrite);
        }
      } catch (err: any) {
        exitCode = 1;
        if (err.name !== "AbortError") {
          const msg = normalizeStreamChunk(`[${agent}] Error: ${err.message}\n`);
          safeWrite(msg);
          broadcast("cli_output", { task_id: taskId, stream: "stderr", data: msg });
          console.error(`[HyperClaw] HTTP agent error (${agent}, task ${taskId}): ${err.message}`);
        } else {
          const msg = normalizeStreamChunk(`[${agent}] Aborted by user\n`);
          safeWrite(msg);
          broadcast("cli_output", { task_id: taskId, stream: "stderr", data: msg });
        }
      } finally {
        await new Promise<void>((resolve) => safeEnd(resolve));
        try { fs.unlinkSync(promptPath); } catch { /* ignore */ }
        handleTaskRunComplete(taskId, exitCode);
      }
    })();

    runTask.catch(() => {});
  }

  return {
    resolveAntigravityModel,
    executeAntigravityAgent,
    launchHttpAgent,
  };
}
