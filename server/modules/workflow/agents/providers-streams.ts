// @ts-nocheck
import type { RuntimeContext } from "../../../types/runtime-context.ts";
import fs from "node:fs";

export function initStreamHelpers(ctx: RuntimeContext) {
  const broadcast = ctx.broadcast;
  const normalizeStreamChunk = ctx.normalizeStreamChunk;
  const db = ctx.db;

  function parseHttpAgentSubtasks(taskId: string, textChunk: string, accum: { buf: string }, createSubtaskFromCli: any, completeSubtaskFromCli: any): void {
    accum.buf += textChunk;
    if (!accum.buf.includes("}")) return;

    const planMatch = accum.buf.match(/\{"subtasks"\s*:\s*\[.*?\]\}/s);
    if (planMatch) {
      try {
        const plan = JSON.parse(planMatch[0]) as { subtasks: { title: string }[] };
        for (const st of plan.subtasks) {
          const stId = `http-plan-${st.title.slice(0, 30).replace(/\s/g, "-")}-${Date.now()}`;
          const existing = db.prepare(
            "SELECT id FROM subtasks WHERE task_id = ? AND title = ? AND status != 'done'"
          ).get(taskId, st.title) as { id: string } | undefined;
          if (!existing) {
            createSubtaskFromCli(taskId, stId, st.title);
          }
        }
      } catch { /* ignore malformed JSON */ }
      accum.buf = accum.buf.slice(accum.buf.indexOf(planMatch[0]) + planMatch[0].length);
    }

    const doneMatch = accum.buf.match(/\{"subtask_done"\s*:\s*"(.+?)"\}/);
    if (doneMatch) {
      const doneTitle = doneMatch[1];
      const sub = db.prepare(
        "SELECT cli_tool_use_id FROM subtasks WHERE task_id = ? AND title = ? AND status != 'done' LIMIT 1"
      ).get(taskId, doneTitle) as { cli_tool_use_id: string } | undefined;
      if (sub) completeSubtaskFromCli(sub.cli_tool_use_id);
      accum.buf = accum.buf.slice(accum.buf.indexOf(doneMatch[0]) + doneMatch[0].length);
    }

    if (accum.buf.length > 2048) {
      accum.buf = accum.buf.slice(-1024);
    }
  }

  function createSafeLogStreamOps(logStream: any): {
    safeWrite: (text: string) => boolean;
    safeEnd: (onDone?: () => void) => void;
    isClosed: () => boolean;
  } {
    let ended = false;
    const isClosed = () => ended || Boolean(logStream?.destroyed || logStream?.writableEnded || logStream?.closed);
    const safeWrite = (text: string): boolean => {
      if (!text || isClosed()) return false;
      try {
        logStream.write(text);
        return true;
      } catch {
        ended = true;
        return false;
      }
    };
    const safeEnd = (onDone?: () => void): void => {
      if (isClosed()) {
        ended = true;
        onDone?.();
        return;
      }
      ended = true;
      try {
        logStream.end(() => onDone?.());
      } catch {
        onDone?.();
      }
    };
    return { safeWrite, safeEnd, isClosed };
  }

  async function parseSSEStream(
    body: ReadableStream<Uint8Array>,
    signal: AbortSignal,
    safeWrite: (text: string) => boolean,
    taskId?: string,
    createSubtaskFromCli?: any,
    completeSubtaskFromCli?: any,
  ): Promise<void> {
    const decoder = new TextDecoder();
    let buffer = "";
    const subtaskAccum = { buf: "" };

    const processLine = (trimmed: string) => {
      if (!trimmed || trimmed.startsWith(":")) return;
      if (!trimmed.startsWith("data: ")) return;
      if (trimmed === "data: [DONE]") return;
      try {
        const data = JSON.parse(trimmed.slice(6));
        const delta = data.choices?.[0]?.delta;
        if (delta?.content) {
          const text = normalizeStreamChunk(delta.content);
          if (!text) return;
          safeWrite(text);
          if (taskId) {
            broadcast("cli_output", { task_id: taskId, stream: "stdout", data: text });
            if (createSubtaskFromCli && completeSubtaskFromCli) {
              parseHttpAgentSubtasks(taskId, text, subtaskAccum, createSubtaskFromCli, completeSubtaskFromCli);
            }
          }
        }
      } catch { /* ignore */ }
    };

    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      if (signal.aborted) break;
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) processLine(line.trim());
    }
    if (buffer.trim()) processLine(buffer.trim());
  }

  async function parseGeminiSSEStream(
    body: ReadableStream<Uint8Array>,
    signal: AbortSignal,
    safeWrite: (text: string) => boolean,
    taskId?: string,
    createSubtaskFromCli?: any,
    completeSubtaskFromCli?: any,
  ): Promise<void> {
    const decoder = new TextDecoder();
    let buffer = "";
    const subtaskAccum = { buf: "" };

    const processLine = (trimmed: string) => {
      if (!trimmed || trimmed.startsWith(":")) return;
      if (!trimmed.startsWith("data: ")) return;
      try {
        const data = JSON.parse(trimmed.slice(6));
        const candidates = data.response?.candidates ?? data.candidates;
        if (Array.isArray(candidates)) {
          for (const candidate of candidates) {
            const parts = candidate?.content?.parts;
            if (Array.isArray(parts)) {
              for (const part of parts) {
                if (part.text) {
                  const text = normalizeStreamChunk(part.text);
                  if (!text) continue;
                  safeWrite(text);
                  if (taskId) {
                    broadcast("cli_output", { task_id: taskId, stream: "stdout", data: text });
                    if (createSubtaskFromCli && completeSubtaskFromCli) {
                      parseHttpAgentSubtasks(taskId, text, subtaskAccum, createSubtaskFromCli, completeSubtaskFromCli);
                    }
                  }
                }
              }
            }
          }
        }
      } catch { /* ignore */ }
    };

    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      if (signal.aborted) break;
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) processLine(line.trim());
    }
    if (buffer.trim()) processLine(buffer.trim());
  }

  async function parseAnthropicSSEStream(
    body: ReadableStream<Uint8Array>,
    signal: AbortSignal,
    safeWrite: (text: string) => boolean,
    taskId?: string,
    createSubtaskFromCli?: any,
    completeSubtaskFromCli?: any,
  ): Promise<void> {
    const decoder = new TextDecoder();
    let buffer = "";
    const subtaskAccum = { buf: "" };

    const processLine = (trimmed: string) => {
      if (!trimmed || trimmed.startsWith(":")) return;
      if (!trimmed.startsWith("data: ")) return;
      if (trimmed === "data: [DONE]") return;
      try {
        const data = JSON.parse(trimmed.slice(6));
        if (data.type === "content_block_delta" && data.delta?.text) {
          const text = normalizeStreamChunk(data.delta.text);
          if (!text) return;
          safeWrite(text);
          if (taskId) {
            broadcast("cli_output", { task_id: taskId, stream: "stdout", data: text });
            if (createSubtaskFromCli && completeSubtaskFromCli) {
              parseHttpAgentSubtasks(taskId, text, subtaskAccum, createSubtaskFromCli, completeSubtaskFromCli);
            }
          }
        }
        if (data.type === "message_delta" && data.delta?.stop_reason) {
          // stream finished
        }
      } catch { /* ignore */ }
    };

    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      if (signal.aborted) break;
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) processLine(line.trim());
    }
    if (buffer.trim()) processLine(buffer.trim());
  }

  return {
    parseHttpAgentSubtasks,
    createSafeLogStreamOps,
    parseSSEStream,
    parseGeminiSSEStream,
    parseAnthropicSSEStream,
  };
}
