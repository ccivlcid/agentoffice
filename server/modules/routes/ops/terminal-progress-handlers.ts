// @ts-nocheck
/**
 * Per-provider progress hint handlers for Claude, Codex, OpenCode, Gemini.
 * Extracted from terminal.ts to reduce single-file size.
 */

import type { TerminalProgressHintItem, StreamToolUseState } from "./terminal-helpers.ts";
import {
  summarizeToolUse, summarizeToolResult, extractToolUseFilePath,
  parseJsonObject, capitalizeToolName, normalizeOpencodeInput, clipHint,
} from "./terminal-helpers.ts";

export interface HintBuilderState {
  toolUseMeta: Map<string, { tool: string; summary: string; file_path: string | null }>;
  streamToolUseByIndex: Map<number, StreamToolUseState>;
  emittedToolUseIds: Set<string>;
  emittedToolResultIds: Set<string>;
}

export function createHintBuilderState(): HintBuilderState {
  return {
    toolUseMeta: new Map(),
    streamToolUseByIndex: new Map(),
    emittedToolUseIds: new Set(),
    emittedToolResultIds: new Set(),
  };
}

export function processClaudeLine(j: any, state: HintBuilderState, hints: TerminalProgressHintItem[]): boolean {
  const { toolUseMeta, streamToolUseByIndex, emittedToolUseIds } = state;

  if (j.type === "stream_event") {
    const ev = j.event;
    if (ev?.type === "content_block_start" && ev?.content_block?.type === "tool_use") {
      const idx = Number(ev.index);
      if (Number.isFinite(idx)) {
        streamToolUseByIndex.set(idx, {
          tool_use_id: String(ev.content_block.id || ""),
          tool: String(ev.content_block.name || "Tool"),
          initial_input: ev.content_block.input && typeof ev.content_block.input === "object" ? ev.content_block.input : {},
          input_json: "",
        });
      }
      return true;
    }
    if (ev?.type === "content_block_delta" && ev?.delta?.type === "input_json_delta") {
      const idx = Number(ev.index);
      if (Number.isFinite(idx)) {
        const s = streamToolUseByIndex.get(idx);
        if (s) s.input_json += String(ev.delta.partial_json ?? "");
      }
      return true;
    }
    if (ev?.type === "content_block_stop") {
      const idx = Number(ev.index);
      if (Number.isFinite(idx)) {
        const s = streamToolUseByIndex.get(idx);
        if (s) {
          const parsedInput = parseJsonObject(s.input_json);
          const input = parsedInput && typeof s.initial_input === "object"
            ? { ...s.initial_input, ...parsedInput }
            : (parsedInput || s.initial_input || {});
          const summary = summarizeToolUse(s.tool, input);
          const filePath = extractToolUseFilePath(s.tool, input);
          if (s.tool_use_id && !emittedToolUseIds.has(s.tool_use_id)) {
            emittedToolUseIds.add(s.tool_use_id);
            toolUseMeta.set(s.tool_use_id, { tool: s.tool, summary, file_path: filePath });
            hints.push({ phase: "use", tool: s.tool, summary, file_path: filePath });
          }
          streamToolUseByIndex.delete(idx);
        }
      }
      return true;
    }
    return true; // all stream_event types handled
  }

  if (j.type === "assistant" && Array.isArray(j.message?.content)) {
    for (const block of j.message.content) {
      if (block?.type !== "tool_use") continue;
      const toolUseId = String(block.id || "");
      if (toolUseId && emittedToolUseIds.has(toolUseId)) continue;
      const tool = String(block.name || "Tool");
      const summary = summarizeToolUse(tool, block.input);
      const filePath = extractToolUseFilePath(tool, block.input);
      if (toolUseId) {
        emittedToolUseIds.add(toolUseId);
        toolUseMeta.set(toolUseId, { tool, summary, file_path: filePath });
      }
      hints.push({ phase: "use", tool, summary, file_path: filePath });
    }
    return true;
  }

  if (j.type === "user" && Array.isArray(j.message?.content)) {
    for (const block of j.message.content) {
      if (block?.type !== "tool_result") continue;
      const toolUseId = String(block.tool_use_id || "");
      const meta = toolUseMeta.get(toolUseId);
      const phase = block.is_error ? "error" : "ok";
      const summary = summarizeToolResult(block.content) || meta?.summary || toolUseId || "tool result";
      hints.push({ phase, tool: meta?.tool || "Tool", summary, file_path: meta?.file_path || null });
    }
    return true;
  }

  return false;
}

export function processCodexLine(j: any, state: HintBuilderState, hints: TerminalProgressHintItem[]): boolean {
  const { toolUseMeta, emittedToolUseIds } = state;

  if (j.type === "item.started" && j.item && typeof j.item === "object") {
    const item = j.item as any;
    if (item.type === "command_execution" || item.type === "collab_tool_call") {
      const rawId = String(item.id || "");
      const toolUseId = rawId ? `codex:${rawId}` : "";
      const tool = item.type === "command_execution" ? "Bash" : String(item.tool || "Tool");
      const input = item.type === "command_execution"
        ? { command: String(item.command || "") }
        : (item.arguments && typeof item.arguments === "object" ? item.arguments : (item.input && typeof item.input === "object" ? item.input : {}));
      const summary = summarizeToolUse(tool, input);
      const filePath = extractToolUseFilePath(tool, input);
      if (toolUseId && emittedToolUseIds.has(toolUseId)) return true;
      if (toolUseId) {
        emittedToolUseIds.add(toolUseId);
        toolUseMeta.set(toolUseId, { tool, summary, file_path: filePath });
      }
      hints.push({ phase: "use", tool, summary, file_path: filePath });
      return true;
    }
    return false;
  }

  if (j.type === "item.completed" && j.item && typeof j.item === "object") {
    const item = j.item as any;
    if (item.type === "command_execution" || item.type === "collab_tool_call") {
      const rawId = String(item.id || "");
      const toolUseId = rawId ? `codex:${rawId}` : "";
      const meta = toolUseId ? toolUseMeta.get(toolUseId) : undefined;
      const tool = meta?.tool || (item.type === "command_execution" ? "Bash" : String(item.tool || "Tool"));
      const fallbackInput = item.type === "command_execution"
        ? { command: String(item.command || "") }
        : (item.arguments && typeof item.arguments === "object" ? item.arguments : (item.input && typeof item.input === "object" ? item.input : {}));
      const isError = item.status === "failed" || item.status === "error" || (typeof item.exit_code === "number" && item.exit_code !== 0);
      const phase = isError ? "error" : "ok";
      const summary = summarizeToolResult(item.aggregated_output) || summarizeToolResult(item.output) || summarizeToolResult(item.error) || meta?.summary || summarizeToolUse(tool, fallbackInput) || "tool result";
      hints.push({ phase, tool, summary, file_path: meta?.file_path || extractToolUseFilePath(tool, fallbackInput) || null });
      return true;
    }
    if (item.type === "file_change" && Array.isArray(item.changes)) {
      const changedPaths = item.changes.map((row: any) => (typeof row?.path === "string" ? row.path.trim() : "")).filter(Boolean);
      if (changedPaths.length > 0) {
        const phase = item.status === "failed" || item.status === "error" ? "error" : "ok";
        hints.push({ phase, tool: "Edit", summary: clipHint(changedPaths.slice(0, 2).join(", "), 180), file_path: changedPaths[0] || null });
      }
      return true;
    }
    return false;
  }

  return false;
}

export function processOpenCodeLine(j: any, state: HintBuilderState, hints: TerminalProgressHintItem[]): boolean {
  if (j.type !== "tool_use" || j.part?.type !== "tool") return false;
  const { toolUseMeta, emittedToolUseIds, emittedToolResultIds } = state;

  const part = j.part as any;
  const rawCallId = typeof part.callID === "string" ? part.callID.trim() : (typeof part.callId === "string" ? part.callId.trim() : (typeof part.call_id === "string" ? part.call_id.trim() : ""));
  const toolUseId = rawCallId ? `opencode:${rawCallId}` : "";
  const tool = capitalizeToolName(String(part.tool || "Tool"));
  const input = normalizeOpencodeInput(part.state?.input);
  const summary = summarizeToolUse(tool, input);
  const filePath = extractToolUseFilePath(tool, input);
  const status = part.state?.status;
  const statusKey = toolUseId && (status === "completed" || status === "error") ? `${toolUseId}:${status}` : "";

  if (toolUseId && emittedToolUseIds.has(toolUseId)) {
    if (statusKey && !emittedToolResultIds.has(statusKey)) {
      const isError = status === "error";
      const resultSummary = summarizeToolResult(part.state?.output) || summarizeToolResult(part.state?.error) || summary;
      emittedToolResultIds.add(statusKey);
      hints.push({ phase: isError ? "error" : "ok", tool, summary: resultSummary, file_path: filePath });
    }
    return true;
  }
  if (toolUseId) {
    emittedToolUseIds.add(toolUseId);
    toolUseMeta.set(toolUseId, { tool, summary, file_path: filePath });
  }
  hints.push({ phase: "use", tool, summary, file_path: filePath });
  if (status === "completed" || status === "error") {
    const isError = status === "error";
    const resultSummary = summarizeToolResult(part.state?.output) || summarizeToolResult(part.state?.error) || summary;
    if (statusKey) emittedToolResultIds.add(statusKey);
    hints.push({ phase: isError ? "error" : "ok", tool, summary: resultSummary, file_path: filePath });
  }
  return true;
}

export function processGeminiLine(j: any, state: HintBuilderState, hints: TerminalProgressHintItem[]): boolean {
  const { toolUseMeta, emittedToolUseIds } = state;

  if (j.type === "tool_use" && typeof j.tool_name === "string") {
    const rawToolId = typeof j.tool_id === "string" ? j.tool_id.trim() : "";
    const toolUseId = rawToolId ? `gemini:${rawToolId}` : "";
    const tool = String(j.tool_name || "Tool");
    const input = j.parameters && typeof j.parameters === "object" ? j.parameters : {};
    const summary = summarizeToolUse(tool, input);
    const filePath = extractToolUseFilePath(tool, input);
    if (toolUseId && emittedToolUseIds.has(toolUseId)) return true;
    if (toolUseId) {
      emittedToolUseIds.add(toolUseId);
      toolUseMeta.set(toolUseId, { tool, summary, file_path: filePath });
    }
    hints.push({ phase: "use", tool, summary, file_path: filePath });
    return true;
  }

  if (j.type === "tool_result") {
    const rawToolId = typeof j.tool_id === "string" ? j.tool_id.trim() : "";
    const toolUseId = rawToolId ? `gemini:${rawToolId}` : "";
    const meta = toolUseId ? toolUseMeta.get(toolUseId) : undefined;
    const status = typeof j.status === "string" ? j.status.toLowerCase() : "";
    const phase = status === "error" || status === "failed" || j.is_error === true ? "error" : "ok";
    const summary = summarizeToolResult(j.output) || summarizeToolResult(j.error) || meta?.summary || rawToolId || "tool result";
    hints.push({ phase, tool: meta?.tool || "Tool", summary, file_path: meta?.file_path || null });
    return true;
  }

  return false;
}
