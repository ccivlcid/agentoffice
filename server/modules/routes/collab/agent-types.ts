// @ts-nocheck

import type { Lang } from "../../../types/lang.ts";
import { isLang } from "../../../types/lang.ts";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Shared types, constants, and low-level messaging/language helpers
// ---------------------------------------------------------------------------

export interface AgentRow {
  id: string;
  name: string;
  name_ko: string;
  role: string;
  personality: string | null;
  status: string;
  department_id: string | null;
  current_task_id: string | null;
  avatar_emoji: string;
  cli_provider: string | null;
  oauth_account_id: string | null;
  api_provider_id: string | null;
  api_model: string | null;
}

export const ROLE_PRIORITY: Record<string, number> = {
  team_leader: 0, senior: 1, junior: 2, intern: 3,
};

export const ROLE_LABEL: Record<string, string> = {
  team_leader: "팀장", senior: "시니어", junior: "주니어", intern: "인턴",
};

export const DEPT_KEYWORDS: Record<string, string[]> = {
  dev:        ["개발", "코딩", "프론트", "백엔드", "API", "서버", "코드", "버그", "프로그램", "앱", "웹"],
  design:     ["디자인", "UI", "UX", "목업", "피그마", "아이콘", "로고", "배너", "레이아웃", "시안"],
  planning:   ["기획", "전략", "분석", "리서치", "보고서", "PPT", "발표", "시장", "조사", "제안"],
  operations: ["운영", "배포", "인프라", "모니터링", "서버관리", "CI", "CD", "DevOps", "장애"],
  qa:         ["QA", "QC", "품질", "테스트", "검수", "버그리포트", "회귀", "자동화테스트", "성능테스트", "리뷰"],
  devsecops:  ["보안", "취약점", "인증", "SSL", "방화벽", "해킹", "침투", "파이프라인", "컨테이너", "도커", "쿠버네티스", "암호화"],
};

export type L10n = Record<Lang, string[]>;

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function l(ko: string[], en: string[], ja?: string[], zh?: string[]): L10n {
  return {
    ko,
    en,
    ja: ja ?? en.map(s => s),
    zh: zh ?? en.map(s => s),
  };
}

export function pickL(pool: L10n, lang: Lang): string {
  const arr = pool[lang];
  return arr[Math.floor(Math.random() * arr.length)];
}

export const ROLE_LABEL_L10N: Record<string, Record<Lang, string>> = {
  team_leader: { ko: "팀장", en: "Team Lead", ja: "チームリーダー", zh: "组长" },
  senior:      { ko: "시니어", en: "Senior", ja: "シニア", zh: "高级" },
  junior:      { ko: "주니어", en: "Junior", ja: "ジュニア", zh: "初级" },
  intern:      { ko: "인턴", en: "Intern", ja: "インターン", zh: "实习生" },
};

export function getRoleLabel(role: string, lang: Lang): string {
  return ROLE_LABEL_L10N[role]?.[lang] ?? ROLE_LABEL[role] ?? role;
}

// ---------------------------------------------------------------------------
// initializeAgentTypes: returns lang/messaging helpers bound to runtime deps
// ---------------------------------------------------------------------------

export function initializeAgentTypes(deps: {
  db: any;
  nowMs: () => number;
  broadcast: any;
}) {
  const { db, nowMs, broadcast } = deps;

  function readSettingString(key: string): string | undefined {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
    if (!row) return undefined;
    try {
      const parsed = JSON.parse(row.value);
      return typeof parsed === "string" ? parsed : row.value;
    } catch {
      return row.value;
    }
  }

  function getPreferredLanguage(): Lang {
    const settingLang = readSettingString("language");
    return isLang(settingLang) ? settingLang : "en";
  }

  function detectLang(text: string): Lang {
    const ko = text.match(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g)?.length ?? 0;
    const ja = text.match(/[\u3040-\u309F\u30A0-\u30FF]/g)?.length ?? 0;
    const zh = text.match(/[\u4E00-\u9FFF]/g)?.length ?? 0;
    const total = text.replace(/\s/g, "").length || 1;
    if (ko / total > 0.15) return "ko";
    if (ja / total > 0.15) return "ja";
    if (zh / total > 0.3) return "zh";
    return "en";
  }

  function resolveLang(text?: string, fallback?: Lang): Lang {
    const settingLang = readSettingString("language");
    if (isLang(settingLang)) return settingLang;
    const trimmed = typeof text === "string" ? text.trim() : "";
    if (trimmed) return detectLang(trimmed);
    return fallback ?? getPreferredLanguage();
  }

  function sendAgentMessage(
    agent: AgentRow,
    content: string,
    messageType: string = "chat",
    receiverType: string = "agent",
    receiverId: string | null = null,
    taskId: string | null = null,
  ): void {
    const id = randomUUID();
    const t = nowMs();
    db.prepare(`
      INSERT INTO messages (id, sender_type, sender_id, receiver_type, receiver_id, content, message_type, task_id, created_at)
      VALUES (?, 'agent', ?, ?, ?, ?, ?, ?, ?)
    `).run(id, agent.id, receiverType, receiverId, content, messageType, taskId, t);

    broadcast("new_message", {
      id,
      sender_type: "agent",
      sender_id: agent.id,
      receiver_type: receiverType,
      receiver_id: receiverId,
      content,
      message_type: messageType,
      task_id: taskId,
      created_at: t,
      sender_name: agent.name,
      sender_avatar: agent.avatar_emoji ?? "🤖",
    });
  }

  return { getPreferredLanguage, detectLang, resolveLang, sendAgentMessage };
}
