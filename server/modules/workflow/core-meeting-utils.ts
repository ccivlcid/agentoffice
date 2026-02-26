// @ts-nocheck
import { isLang, type Lang } from "../../types/lang.ts";
import { readNonNegativeIntEnv } from "../../db/runtime.ts";
import {
  compactMeetingPromptText,
  formatMeetingTranscriptForPrompt,
  type MeetingTranscriptLine,
} from "./meeting-prompt-utils.ts";

export interface MeetingTranscriptEntry {
  speaker_agent_id?: string;
  speaker: string;
  department: string;
  role: string;
  content: string;
}

export interface MeetingPromptOptions {
  meetingType: "planned" | "review";
  round: number;
  taskTitle: string;
  taskDescription: string | null;
  transcript: MeetingTranscriptEntry[];
  turnObjective: string;
  stanceHint?: string;
  lang: string;
}

// 320 chars is the minimum viable task context (roughly one short paragraph).
export const MEETING_PROMPT_TASK_CONTEXT_MAX_CHARS = Math.max(
  320,
  readNonNegativeIntEnv("MEETING_PROMPT_TASK_CONTEXT_MAX_CHARS", 1200),
);
// Keep at least 4 turns so stance changes can still be inferred.
export const MEETING_TRANSCRIPT_MAX_TURNS = Math.max(
  4,
  readNonNegativeIntEnv("MEETING_TRANSCRIPT_MAX_TURNS", 20),
);
// 72 chars keeps one concise sentence with role/speaker metadata still readable.
export const MEETING_TRANSCRIPT_LINE_MAX_CHARS = Math.max(
  72,
  readNonNegativeIntEnv("MEETING_TRANSCRIPT_LINE_MAX_CHARS", 180),
);
// 720 chars ensures transcript block remains useful while controlling token drift.
export const MEETING_TRANSCRIPT_TOTAL_MAX_CHARS = Math.max(
  720,
  readNonNegativeIntEnv("MEETING_TRANSCRIPT_TOTAL_MAX_CHARS", 2400),
);

const MEETING_BUBBLE_EMPTY = {
  ko: ["의견 공유드립니다."],
  en: ["Sharing thoughts shortly."],
  ja: ["ご意見を共有します。"],
  zh: ["稍后分享意见。"],
};

export function normalizeMeetingLang(value: unknown, getPreferredLanguage: () => string): Lang {
  if (isLang(value)) return value;
  const preferred = getPreferredLanguage();
  return isLang(preferred) ? preferred : "ko";
}

export function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(minMs + Math.random() * Math.max(0, maxMs - minMs));
}

export function getAgentDisplayName(agent: any, lang: string): string {
  return lang === "ko" ? (agent.name_ko || agent.name) : agent.name;
}

export function localeInstruction(lang: string): string {
  switch (lang) {
    case "ja": return "Respond in Japanese.";
    case "zh": return "Respond in Chinese.";
    case "en": return "Respond in English.";
    case "ko":
    default: return "Respond in Korean.";
  }
}

export function collapseRepeatedSentenceCycles(text: string): string {
  const sentences = text
    .split(/(?<=[.!?。！？])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length < 4) return text;

  const total = sentences.length;
  for (let cycleLen = 1; cycleLen <= Math.floor(total / 2); cycleLen += 1) {
    if (total % cycleLen !== 0) continue;
    const repeatCount = total / cycleLen;
    if (repeatCount < 2) continue;
    const pattern = sentences.slice(0, cycleLen);
    let repeated = true;
    for (let i = cycleLen; i < total; i += 1) {
      if (sentences[i] !== pattern[i % cycleLen]) { repeated = false; break; }
    }
    if (!repeated) continue;
    const collapsed = pattern.join(" ").trim();
    if (collapsed.length >= 24) return collapsed;
  }
  return text;
}

export function normalizeConversationReply(
  raw: string,
  prettyStreamJsonFn: (raw: string) => string,
  maxChars = 420,
  opts: { maxSentences?: number } = {},
): string {
  if (!raw.trim()) return "";
  const parsed = prettyStreamJsonFn(raw);
  let text = parsed.trim() ? parsed : raw;
  text = text
    .replace(/^\[(init|usage|mcp|thread)\][^\n]*$/gim, "")
    .replace(/^\[reasoning\]\s*/gim, "")
    .replace(/\[(tool|result|output|spawn_agent|agent_done|one-shot-error)[^\]]*\]/gi, " ")
    .replace(/^\[(copilot|antigravity)\][^\n]*$/gim, "")
    .replace(/\{"type"\s*:\s*"(?:step_finish|step-finish|tool_use|tool_result|thinking|reasoning|text|content)"[^\n]*\}/gm, " ")
    .replace(/^!?\s*permission requested:.*auto-rejecting\s*$/gim, "")
    .replace(/\b(Crafting|Formulating|Composing|Thinking|Analyzing)\b[^.!?。！？]{0,80}\b(message|reply)\s*/gi, "")
    .replace(/\b(I need to|Let me|I'll|I will|First, I'?ll)\b[^.!?。！？]{0,140}\b(analy[sz]e|examin|inspect|check|review|look at)\b[^.!?。！？]*[.!?。！？]?/gi, " ")
    .replace(/\b(current codebase|relevant files|quickly examine|let me quickly|analyze the current project)\b[^.!?。！？]*[.!?。！？]?/gi, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/(?:^|\s)(find|ls|rg|grep|cat|head|tail|sed|awk|npm|pnpm|yarn|node|git|cd|pwd)\s+[^\n]+/gi, " ")
    .replace(/---+/g, " ")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";

  text = collapseRepeatedSentenceCycles(text);

  const sentenceLimit = typeof opts.maxSentences === "number" ? Math.max(0, Math.floor(opts.maxSentences)) : 2;
  if (sentenceLimit !== 0) {
    const sentenceParts = text.split(/(?<=[.!?。！？])\s+/).map((s) => s.trim()).filter(Boolean);
    const uniqueParts: string[] = [];
    for (const part of sentenceParts) {
      if (!uniqueParts.includes(part)) uniqueParts.push(part);
      if (uniqueParts.length >= sentenceLimit) break;
    }
    if (uniqueParts.length > 0) text = uniqueParts.join(" ");
  }

  if (text.length > maxChars) return `${text.slice(0, maxChars - 1).trimEnd()}…`;
  return text;
}

export function findLatestTranscriptContentByAgent(
  transcript: MeetingTranscriptEntry[],
  agentId: string,
): string {
  for (let i = transcript.length - 1; i >= 0; i -= 1) {
    const row = transcript[i];
    if (row.speaker_agent_id === agentId) return row.content;
  }
  return "";
}

export function compactTaskDescriptionForMeeting(taskDescription: string | null): string {
  if (!taskDescription) return "";
  const marker = "[PROJECT MEMO]";
  const markerIdx = taskDescription.indexOf(marker);
  const base = markerIdx >= 0 ? taskDescription.slice(0, markerIdx) : taskDescription;
  return compactMeetingPromptText(base, MEETING_PROMPT_TASK_CONTEXT_MAX_CHARS);
}

export function summarizeForMeetingBubble(
  text: string,
  normalizeConversationReplyFn: (raw: string, prettyFn: (r: string) => string, maxChars?: number) => string,
  prettyStreamJsonFn: (raw: string) => string,
  pickLFn: (obj: any, lang: string) => string,
  getPreferredLanguageFn: () => string,
  maxChars = 96,
  lang?: Lang,
): string {
  const useLang = lang ?? (getPreferredLanguageFn() as Lang);
  const cleaned = normalizeConversationReplyFn(text, prettyStreamJsonFn, maxChars + 24)
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return pickLFn(MEETING_BUBBLE_EMPTY, useLang);
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars - 1).trimEnd()}…`;
}

export function formatMeetingTranscript(
  transcript: MeetingTranscriptEntry[],
  summarizeFn: (text: string, maxChars?: number) => string,
  lang: Lang,
): string {
  const lines: MeetingTranscriptLine[] = transcript.map((row) => ({
    speaker: row.speaker,
    department: row.department,
    role: row.role,
    content: row.content,
  }));
  return formatMeetingTranscriptForPrompt(lines, {
    maxTurns: MEETING_TRANSCRIPT_MAX_TURNS,
    maxLineChars: MEETING_TRANSCRIPT_LINE_MAX_CHARS,
    maxTotalChars: MEETING_TRANSCRIPT_TOTAL_MAX_CHARS,
    summarize: (text, maxChars) => summarizeFn(text, maxChars),
  });
}

// Re-export signal/decision helpers from sibling module so callers have one import path
export {
  isInternalWorkNarration,
  fallbackTurnReply,
  buildAgentReplyText,
  clipFailureDetail,
  extractRunFailureDetail,
  detectRunFailure,
  buildRunFailureReply,
  isMvpDeferralSignal,
  isHardBlockSignal,
  hasApprovalAgreementSignal,
  isDeferrableReviewHold,
  classifyMeetingReviewDecision,
  wantsReviewRevision,
  type ReplyKind,
  type RunFailureKind,
} from "./core-meeting-signals.ts";
