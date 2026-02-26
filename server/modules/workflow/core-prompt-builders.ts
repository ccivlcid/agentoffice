// @ts-nocheck
import {
  getAgentDisplayName,
  normalizeConversationReply,
} from "./core-meeting-utils.ts";
import {
  detectRunFailure,
  extractRunFailureDetail,
  buildRunFailureReply,
  fallbackTurnReply,
  isInternalWorkNarration,
  type ReplyKind,
} from "./core-meeting-signals.ts";
import type { OneShotRunResult } from "./core-oneshot.ts";

export function buildMeetingPrompt(
  agent: any,
  opts: any,
  deps: {
    getDeptName: (id: string) => string;
    getRoleLabel: (role: string, lang: string) => string;
    getDeptRoleConstraint: (id: string, name: string) => string;
    getRecentConversationContext: (agentId: string, limit?: number) => string;
    getAgentDisplayNameFn: (agent: any, lang: string) => string;
    localeInstructionFn: (lang: string) => string;
    compactTaskDescriptionFn: (desc: string | null) => string;
    formatMeetingTranscriptFn: (transcript: any[], lang: string) => string;
    normalizeMeetingLangFn: (val: unknown) => string;
  },
): string {
  const lang = deps.normalizeMeetingLangFn(opts.lang);
  const deptName = deps.getDeptName(agent.department_id ?? "");
  const role = deps.getRoleLabel(agent.role, lang);
  const deptConstraint = agent.department_id ? deps.getDeptRoleConstraint(agent.department_id, deptName) : "";
  const recentCtx = deps.getRecentConversationContext(agent.id, 8);
  const meetingLabel = opts.meetingType === "planned" ? "Planned Approval" : "Review Consensus";
  const compactTaskContext = deps.compactTaskDescriptionFn(opts.taskDescription);
  return [
    `[CEO OFFICE ${meetingLabel}]`,
    `Task: ${opts.taskTitle}`,
    compactTaskContext ? `Task context: ${compactTaskContext}` : "",
    `Round: ${opts.round}`,
    `You are ${deps.getAgentDisplayNameFn(agent, lang)} (${deptName} ${role}).`,
    agent.personality ? `Personality / role in replies: ${agent.personality}. Reply in character.` : "",
    deptConstraint,
    deps.localeInstructionFn(lang),
    "Output rules:",
    "- Return one natural chat message only (no JSON, no markdown).",
    "- Keep it concise: 1-3 sentences.",
    "- Make your stance explicit and actionable.",
    opts.stanceHint ? `Required stance: ${opts.stanceHint}` : "",
    `Current turn objective: ${opts.turnObjective}`,
    "",
    "[Meeting transcript so far]",
    deps.formatMeetingTranscriptFn(opts.transcript, lang),
    recentCtx,
  ].filter(Boolean).join("\n");
}

export function buildDirectReplyPrompt(
  agent: any,
  ceoMessage: string,
  messageType: string,
  deps: {
    resolveLang: (text: string) => string;
    getDeptName: (id: string) => string;
    getRoleLabel: (role: string, lang: string) => string;
    getDeptRoleConstraint: (id: string, name: string) => string;
    getRecentConversationContext: (agentId: string, limit?: number) => string;
    getAgentDisplayNameFn: (agent: any, lang: string) => string;
    localeInstructionFn: (lang: string) => string;
  },
): { prompt: string; lang: string } {
  const lang = deps.resolveLang(ceoMessage);
  const deptName = deps.getDeptName(agent.department_id ?? "");
  const role = deps.getRoleLabel(agent.role, lang);
  const deptConstraint = agent.department_id ? deps.getDeptRoleConstraint(agent.department_id, deptName) : "";
  const recentCtx = deps.getRecentConversationContext(agent.id, 12);
  const typeHint = messageType === "report"
    ? "CEO requested a report update."
    : messageType === "task_assign"
      ? "CEO assigned a task. Confirm understanding and concrete next step."
      : "CEO sent a direct chat message.";
  const prompt = [
    "[CEO 1:1 Conversation]",
    `You are ${deps.getAgentDisplayNameFn(agent, lang)} (${deptName} ${role}).`,
    agent.personality ? `Personality: ${agent.personality}. Respond in character in your reply.` : "",
    deptConstraint,
    deps.localeInstructionFn(lang),
    "Output rules:",
    "- Return one direct response message only (no JSON, no markdown).",
    "- Keep it concise and practical (1-3 sentences). Respond in line with your Personality above.",
    `Message type: ${messageType}`,
    `Conversation intent: ${typeHint}`,
    "",
    `CEO message: ${ceoMessage}`,
    recentCtx,
  ].filter(Boolean).join("\n");
  return { prompt, lang };
}

export function buildCliFailureMessage(agent: any, lang: string, error?: string): string {
  const name = getAgentDisplayName(agent, lang);
  if (lang === "en") return `${name}: CLI response failed (${error || "unknown error"}).`;
  if (lang === "ja") return `${name}: CLI応答の生成に失敗しました（${error || "不明なエラー"}）。`;
  if (lang === "zh") return `${name}: CLI回复生成失败（${error || "未知错误"}）。`;
  return `${name}: CLI 응답 생성에 실패했습니다 (${error || "알 수 없는 오류"}).`;
}

export function chooseSafeReply(
  run: OneShotRunResult,
  lang: string,
  kind: ReplyKind,
  prettyStreamJsonFn: (raw: string) => string,
  detectLangFn: (text: string) => string,
  agent?: any,
): string {
  const maxReplyChars = kind === "direct" ? 12000 : 2000;
  const rawText = run.text || "";
  const failureKind = detectRunFailure(rawText, run.error);
  if (failureKind) {
    const detail = failureKind === "generic" ? extractRunFailureDetail(rawText, run.error) : "";
    return buildRunFailureReply(failureKind, lang, agent, detail);
  }
  const cleaned = normalizeConversationReply(rawText, prettyStreamJsonFn, maxReplyChars, { maxSentences: 0 });
  if (!cleaned) return fallbackTurnReply(kind, lang, agent);
  if (/timeout after|CLI 응답 생성에 실패|response failed|one-shot-error/i.test(cleaned)) {
    return fallbackTurnReply(kind, lang, agent);
  }
  if (isInternalWorkNarration(cleaned)) return fallbackTurnReply(kind, lang, agent);
  if ((lang === "ko" || lang === "ja" || lang === "zh") && detectLangFn(cleaned) === "en" && cleaned.length > 20) {
    return fallbackTurnReply(kind, lang, agent);
  }
  return cleaned;
}
