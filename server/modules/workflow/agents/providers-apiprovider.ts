// @ts-nocheck
import type { RuntimeContext } from "../../../types/runtime-context.ts";
import fs from "node:fs";
import path from "node:path";
import { decryptSecret } from "../../../oauth/helpers.ts";

export function initApiProviderAgent(ctx: RuntimeContext, streamHelpers: any) {
  const broadcast = ctx.broadcast;
  const normalizeStreamChunk = ctx.normalizeStreamChunk;
  const logsDir = ctx.logsDir;
  const activeProcesses = ctx.activeProcesses;
  const handleTaskRunComplete = (...args: any[]) => ctx.handleTaskRunComplete(...args);
  const db = ctx.db;
  const createSubtaskFromCli = ctx.createSubtaskFromCli;
  const completeSubtaskFromCli = ctx.completeSubtaskFromCli;

  const { createSafeLogStreamOps, parseSSEStream, parseGeminiSSEStream, parseAnthropicSSEStream } = streamHelpers;

  function getApiProviderById(providerId: string): any | null {
    return (db.prepare("SELECT * FROM api_providers WHERE id = ?").get(providerId) as any) ?? null;
  }

  function resolveApiProviderModel(provider: any, requestedModel: string | null): string {
    if (requestedModel) return requestedModel;
    if (provider.models_cache) {
      try {
        const models = JSON.parse(provider.models_cache) as string[];
        if (models.length > 0) return models[0];
      } catch { /* ignore */ }
    }
    throw new Error(
      `No model specified for API provider '${provider.name}'. ` +
      `Please select a model in the agent settings or run a connection test first to cache available models.`
    );
  }

  function normalizeApiBaseUrl(rawUrl: string): string {
    let url = rawUrl.replace(/\/+$/, "");
    url = url.replace(/\/(v\d+)\/(chat\/completions|models|messages)$/i, "/$1");
    url = url.replace(/\/v1beta\/models\/.+$/i, "/v1beta");
    return url;
  }

  function buildApiProviderRequest(
    provider: any,
    model: string,
    prompt: string,
    projectPath: string,
  ): { url: string; headers: Record<string, string>; body: string } {
    const apiKey = provider.api_key_enc ? decryptSecret(provider.api_key_enc) : "";
    const baseUrl = normalizeApiBaseUrl(provider.base_url);

    if (provider.type === "anthropic") {
      const messagesUrl = baseUrl.endsWith("/v1") ? `${baseUrl}/messages` : `${baseUrl}/v1/messages`;
      return {
        url: messagesUrl,
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 16384,
          stream: true,
          messages: [{ role: "user", content: prompt }],
          system: `You are a coding assistant. Project path: ${projectPath}`,
        }),
      };
    }

    if (provider.type === "google") {
      const googleBase = baseUrl.endsWith("/v1beta") ? baseUrl : `${baseUrl}/v1beta`;
      const url = `${googleBase}/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
      return {
        url,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: `You are a coding assistant. Project path: ${projectPath}` }] },
        }),
      };
    }

    const chatUrl = /\/v\d+$/.test(baseUrl) ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
    if (provider.type === "openrouter") {
      headers["HTTP-Referer"] = "https://hyperclaw.app";
      headers["X-Title"] = "HyperClaw";
    }

    return {
      url: chatUrl,
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: `You are a coding assistant. Project path: ${projectPath}` },
          { role: "user", content: prompt },
        ],
        stream: true,
      }),
    };
  }

  async function executeApiProviderAgent(
    prompt: string,
    projectPath: string,
    logStream: fs.WriteStream,
    signal: AbortSignal,
    taskId?: string,
    apiProviderId?: string | null,
    apiModel?: string | null,
    safeWriteOverride?: (text: string) => boolean,
  ): Promise<void> {
    const safeWrite = safeWriteOverride ?? createSafeLogStreamOps(logStream).safeWrite;

    if (!apiProviderId) {
      throw new Error("No API provider configured for this agent. Set api_provider_id first.");
    }

    const provider = getApiProviderById(apiProviderId);
    if (!provider) {
      throw new Error(`API provider not found: ${apiProviderId}`);
    }
    if (!provider.enabled) {
      throw new Error(`API provider '${provider.name}' is disabled.`);
    }

    const model = resolveApiProviderModel(provider, apiModel ?? null);
    const header = `[api:${provider.type}] Provider: ${provider.name}, Model: ${model}\n---\n`;
    safeWrite(header);
    if (taskId) broadcast("cli_output", { task_id: taskId, stream: "stderr", data: header });

    const req = buildApiProviderRequest(provider, model, prompt, projectPath);

    const resp = await fetch(req.url, {
      method: "POST",
      headers: req.headers,
      body: req.body,
      signal,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`API provider '${provider.name}' error (${resp.status}): ${text}`);
    }

    if (provider.type === "anthropic") {
      await parseAnthropicSSEStream(resp.body!, signal, safeWrite, taskId, createSubtaskFromCli, completeSubtaskFromCli);
    } else if (provider.type === "google") {
      await parseGeminiSSEStream(resp.body!, signal, safeWrite, taskId, createSubtaskFromCli, completeSubtaskFromCli);
    } else {
      await parseSSEStream(resp.body!, signal, safeWrite, taskId, createSubtaskFromCli, completeSubtaskFromCli);
    }

    safeWrite(`\n---\n[api:${provider.type}] Done.\n`);
    if (taskId) broadcast("cli_output", { task_id: taskId, stream: "stderr", data: `\n---\n[api:${provider.type}] Done.\n` });
  }

  function launchApiProviderAgent(
    taskId: string,
    apiProviderId: string | null,
    apiModel: string | null,
    prompt: string,
    projectPath: string,
    logPath: string,
    controller: AbortController,
    fakePid: number,
  ): void {
    const logStream = fs.createWriteStream(logPath, { flags: "a" });
    const { safeWrite, safeEnd } = createSafeLogStreamOps(logStream);
    safeWrite(`\n===== task run start ${new Date().toISOString()} | provider=api =====\n`);

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
        await executeApiProviderAgent(prompt, projectPath, logStream, controller.signal, taskId, apiProviderId, apiModel, safeWrite);
      } catch (err: any) {
        exitCode = 1;
        if (err.name !== "AbortError") {
          const msg = normalizeStreamChunk(`[api] Error: ${err.message}\n`);
          safeWrite(msg);
          broadcast("cli_output", { task_id: taskId, stream: "stderr", data: msg });
          console.error(`[HyperClaw] API provider agent error (task ${taskId}): ${err.message}`);
        } else {
          const msg = normalizeStreamChunk(`[api] Aborted by user\n`);
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
    getApiProviderById,
    resolveApiProviderModel,
    normalizeApiBaseUrl,
    buildApiProviderRequest,
    executeApiProviderAgent,
    launchApiProviderAgent,
  };
}
