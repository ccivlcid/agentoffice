// @ts-nocheck
import { getAgentDisplayName } from "./core-meeting-utils.ts";

export type ReplyKind = "opening" | "feedback" | "summary" | "approval" | "direct";
export type RunFailureKind = "permission" | "stale_file" | "tool_calls_only" | "timeout" | "generic";

export function isInternalWorkNarration(text: string): boolean {
  return /\b(I need to|Let me|I'll|I will|analy[sz]e|examin|inspect|check files|run command|current codebase|relevant files)\b/i.test(text);
}

export function fallbackTurnReply(kind: ReplyKind, lang: string, agent?: any): string {
  const name = agent ? getAgentDisplayName(agent, lang) : "";
  switch (kind) {
    case "opening":
      if (lang === "en") return `${name}: Kickoff noted. Please share concise feedback in order.`;
      if (lang === "ja") return `${name}: キックオフを開始します。順番に簡潔なフィードバックを共有してください。`;
      if (lang === "zh") return `${name}: 现在开始会议，请各位按顺序简要反馈。`;
      return `${name}: 킥오프 회의를 시작합니다. 순서대로 핵심 피드백을 간단히 공유해주세요.`;
    case "feedback":
      if (lang === "en") return `${name}: We have identified key gaps and a top-priority validation item before execution.`;
      if (lang === "ja") return `${name}: 着手前の補完項目と最優先の検証課題を確認しました。`;
      if (lang === "zh") return `${name}: 已确认执行前的补充项与最高优先验证课题。`;
      return `${name}: 착수 전 보완 항목과 최우선 검증 과제를 확인했습니다.`;
    case "summary":
      if (lang === "en") return `${name}: I will consolidate all leader feedback and proceed with the agreed next step.`;
      if (lang === "ja") return `${name}: 各チームリーダーの意見を統合し、合意した次のステップへ進めます。`;
      if (lang === "zh") return `${name}: 我将汇总各负责人意见，并按约定进入下一步。`;
      return `${name}: 각 팀장 의견을 취합해 합의된 다음 단계로 진행하겠습니다.`;
    case "approval":
      if (lang === "en") return `${name}: Decision noted. We will proceed according to the current meeting conclusion.`;
      if (lang === "ja") return `${name}: 本会議の結論に従って進行します。`;
      if (lang === "zh") return `${name}: 已确认决策，将按本轮会议结论执行。`;
      return `${name}: 본 회의 결론에 따라 진행하겠습니다.`;
    case "direct":
    default:
      if (lang === "en") return `${name}: Acknowledged. Proceeding with the requested direction.`;
      if (lang === "ja") return `${name}: 承知しました。ご指示の方向で進めます。`;
      if (lang === "zh") return `${name}: 收到，将按您的指示推进。`;
      return `${name}: 확인했습니다. 요청하신 방향으로 진행하겠습니다.`;
  }
}

export function buildAgentReplyText(
  lang: string,
  agent: any | undefined,
  messages: { ko: string; en: string; ja: string; zh: string },
): string {
  const body = lang === "en" ? messages.en : lang === "ja" ? messages.ja : lang === "zh" ? messages.zh : messages.ko;
  const name = agent ? getAgentDisplayName(agent, lang) : "";
  return name ? `${name}: ${body}` : body;
}

export function clipFailureDetail(value: string, max = 180): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

export function extractRunFailureDetail(rawText: string, runError?: string): string {
  const candidates: string[] = [];
  if (runError && runError.trim()) candidates.push(runError.trim());
  for (const line of rawText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    candidates.push(trimmed);
  }
  for (const candidate of candidates) {
    let line = candidate
      .replace(/^\[(?:one-shot-error|tool-error)\]\s*/i, "")
      .replace(/^error:\s*/i, "")
      .trim();
    if (!line) continue;
    if (line.startsWith("{")) continue;
    if (/^(permission requested:|auto-rejecting)/i.test(line)) continue;
    if (/^(type=|sessionid=|timestamp=)/i.test(line)) continue;
    return clipFailureDetail(line);
  }
  return "";
}

export function detectRunFailure(rawText: string, runError?: string): RunFailureKind | null {
  const source = [runError || "", rawText || ""].filter(Boolean).join("\n");
  if (!source.trim()) return null;
  if (/auto-rejecting|permission.*rejected|rejected permission|external_directory|user rejected permission/i.test(source)) return "permission";
  if (/modified since it was last read|read the file again before modifying/i.test(source)) return "stale_file";
  if (/"type"\s*:\s*"(?:step_finish|step-finish)".*"reason"\s*:\s*"tool-calls"/i.test(source)) return "tool_calls_only";
  if (/timeout after|timed out|request timed out/i.test(source)) return "timeout";
  if (runError || /\[(?:one-shot-error|tool-error)\]/i.test(source) || /^error:/im.test(source)) return "generic";
  return null;
}

export function buildRunFailureReply(kind: RunFailureKind, lang: string, agent?: any, detail = ""): string {
  if (kind === "permission") {
    return buildAgentReplyText(lang, agent, {
      ko: "파일 접근 권한에 의해 작업이 차단되었습니다. 프로젝트 디렉터리 설정을 확인해주세요.",
      en: "The requested operation was blocked by a file-access permission. Please check the project directory settings.",
      ja: "ファイルアクセス権限により操作がブロックされました。プロジェクトディレクトリ設定を確認してください。",
      zh: "操作因文件访问权限被阻止，请检查项目目录设置。",
    });
  }
  if (kind === "stale_file") {
    return buildAgentReplyText(lang, agent, {
      ko: "파일이 읽은 뒤 변경되어 작업이 중단되었습니다. 파일을 다시 읽고 재시도해주세요.",
      en: "The file changed after it was read, so the operation was stopped. Please re-read the file and retry.",
      ja: "読み取り後にファイルが変更されたため、処理が停止しました。再読込して再試行してください。",
      zh: "文件在读取后被修改，操作已中止。请重新读取该文件后再试。",
    });
  }
  if (kind === "tool_calls_only") {
    return buildAgentReplyText(lang, agent, {
      ko: "도구 호출 단계에서 종료되어 최종 답변이 생성되지 않았습니다. 다시 시도해주세요.",
      en: "The run ended at tool-calls without producing a final reply. Please retry.",
      ja: "ツール呼び出し段階で終了し、最終回答が生成されませんでした。再試行してください。",
      zh: "执行在工具调用阶段结束，未生成最终回复。请重试。",
    });
  }
  if (kind === "timeout") {
    return buildAgentReplyText(lang, agent, {
      ko: "응답 생성 시간이 초과되어 작업이 중단되었습니다. 잠시 후 다시 시도해주세요.",
      en: "Response generation timed out, so the run was stopped. Please try again shortly.",
      ja: "応답生成がタイムアウトしたため処理を停止しました。しばらくして再試行してください。",
      zh: "回复生成超时，任务已中止。请稍后重试。",
    });
  }
  const suffix = detail ? ` (${detail})` : "";
  return buildAgentReplyText(lang, agent, {
    ko: `CLI 실행 중 오류가 발생했습니다${suffix}.`,
    en: `CLI execution failed${suffix}.`,
    ja: `CLI 実行中にエラーが発生しました${suffix}。`,
    zh: `CLI 执行失败${suffix}。`,
  });
}

export function isMvpDeferralSignal(text: string): boolean {
  return /mvp|범위\s*초과|실환경|프로덕션|production|post[-\s]?merge|post[-\s]?release|안정화\s*단계|stabilization|모니터링|monitoring|sla|체크리스트|checklist|문서화|runbook|후속\s*(개선|처리|모니터링)|defer|deferred|later\s*phase|다음\s*단계|배포\s*후/i.test(text);
}

export function isHardBlockSignal(text: string): boolean {
  return /최종\s*승인\s*불가|배포\s*불가|절대\s*불가|중단|즉시\s*중단|반려|cannot\s+(approve|ship|release)|must\s+fix\s+before|hard\s+blocker|critical\s+blocker|p0|data\s+loss|security\s+incident|integrity\s+broken|audit\s*fail|build\s*fail|무결성\s*(훼손|깨짐)|데이터\s*손실|보안\s*사고|치명/i.test(text);
}

export function hasApprovalAgreementSignal(text: string): boolean {
  return /승인|approve|approved|동의|agree|agreed|lgtm|go\s+ahead|merge\s+approve|병합\s*승인|전환\s*동의|조건부\s*승인/i.test(text);
}

export function isDeferrableReviewHold(text: string): boolean {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return false;
  if (!isMvpDeferralSignal(cleaned)) return false;
  if (isHardBlockSignal(cleaned)) return false;
  return true;
}

export function classifyMeetingReviewDecision(text: string): any {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "reviewing";
  const hasApprovalAgreement = hasApprovalAgreementSignal(cleaned);
  const hasMvpDeferral = isMvpDeferralSignal(cleaned);
  const hasHardBlock = isHardBlockSignal(cleaned);
  const hasApprovalSignal = /(승인|통과|문제없|진행.?가능|배포.?가능|approve|approved|lgtm|ship\s+it|go\s+ahead|承認|批准|通过|可发布)/i.test(cleaned);
  const hasNoRiskSignal = /(리스크\s*(없|없음|없습니다|없는|없이)|위험\s*(없|없음|없습니다|없는|없이)|문제\s*없|이슈\s*없|no\s+risk|without\s+risk|risk[-\s]?free|no\s+issue|no\s+blocker|リスク(は)?(ありません|なし|無し)|問題ありません|无风险|没有风险|無風險|无问题)/i.test(cleaned);
  const hasConditionalOrHoldSignal = /(조건부|보완|수정|보류|리스크|미흡|미완|추가.?필요|재검토|중단|불가|hold|revise|revision|changes?\s+requested|required|pending|risk|block|missing|incomplete|not\s+ready|保留|修正|风险|补充|未完成|暂缓|差し戻し)/i.test(cleaned);

  if (hasApprovalSignal && hasNoRiskSignal) return "approved";
  if ((hasApprovalAgreement || hasApprovalSignal) && hasMvpDeferral && !hasHardBlock) return "approved";
  if (hasConditionalOrHoldSignal) {
    if ((hasApprovalAgreement || hasApprovalSignal) && hasMvpDeferral && !hasHardBlock) return "approved";
    return "hold";
  }
  if (hasApprovalSignal || hasNoRiskSignal || hasApprovalAgreement) return "approved";
  return "reviewing";
}

export function wantsReviewRevision(content: string): boolean {
  return classifyMeetingReviewDecision(content) === "hold";
}
