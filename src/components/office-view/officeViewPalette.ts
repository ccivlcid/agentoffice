import type { RoomTheme, SupportedLocale } from "./officeViewTypes";

/* ================================================================== */
/*  Palette / Themes / Locale Text                                     */
/* ================================================================== */

/* ── Light (day-work) palette ── */
export const OFFICE_PASTEL_LIGHT = {
  creamWhite: 0xf8f3ec,
  creamDeep: 0xebdfcf,
  softMint: 0xbfded5,
  softMintDeep: 0x8fbcb0,
  dustyRose: 0xd5a5ae,
  dustyRoseDeep: 0xb67d89,
  warmSand: 0xd6b996,
  warmWood: 0xb8906d,
  cocoa: 0x6f4d3a,
  ink: 0x2f2530,
  slate: 0x586378,
};

/* ── Dark (late-night coding session) palette ── */
export const OFFICE_PASTEL_DARK = {
  creamWhite: 0x0e1020,
  creamDeep: 0x0c0e1e,
  softMint: 0x122030,
  softMintDeep: 0x0e1a28,
  dustyRose: 0x201020,
  dustyRoseDeep: 0x1a0c1a,
  warmSand: 0x1a1810,
  warmWood: 0x16130c,
  cocoa: 0x140f08,
  ink: 0xc8cee0,
  slate: 0x7888a8,
};

export let OFFICE_PASTEL = OFFICE_PASTEL_LIGHT;

export const DEFAULT_CEO_THEME_LIGHT: RoomTheme = {
  floor1: 0xe5d9b9,
  floor2: 0xdfd0a8,
  wall: 0x998243,
  accent: 0xa77d0c,
};
export const DEFAULT_CEO_THEME_DARK: RoomTheme = {
  floor1: 0x101020,
  floor2: 0x0e0e1c,
  wall: 0x2a2450,
  accent: 0x584818,
};

export const DEFAULT_BREAK_THEME_LIGHT: RoomTheme = {
  floor1: 0xf7e2b7,
  floor2: 0xf6dead,
  wall: 0xa99c83,
  accent: 0xf0c878,
};
export const DEFAULT_BREAK_THEME_DARK: RoomTheme = {
  floor1: 0x141210,
  floor2: 0x10100e,
  wall: 0x302a20,
  accent: 0x4a3c18,
};

export let DEFAULT_CEO_THEME = DEFAULT_CEO_THEME_LIGHT;
export let DEFAULT_BREAK_THEME = DEFAULT_BREAK_THEME_LIGHT;

export const DEPT_THEME_LIGHT: Record<string, RoomTheme> = {
  dev: { floor1: 0xd8e8f5, floor2: 0xcce1f2, wall: 0x6c96b7, accent: 0x5a9fd4 },
  design: { floor1: 0xe8def2, floor2: 0xe1d4ee, wall: 0x9378ad, accent: 0x9a6fc4 },
  planning: { floor1: 0xf0e1c5, floor2: 0xeddaba, wall: 0xae9871, accent: 0xd4a85a },
  operations: { floor1: 0xd0eede, floor2: 0xc4ead5, wall: 0x6eaa89, accent: 0x5ac48a },
  qa: { floor1: 0xf0cbcb, floor2: 0xedc0c0, wall: 0xae7979, accent: 0xd46a6a },
  devsecops: { floor1: 0xf0d5c5, floor2: 0xedcdba, wall: 0xae8871, accent: 0xd4885a },
};
export const DEPT_THEME_DARK: Record<string, RoomTheme> = {
  dev: { floor1: 0x0c1620, floor2: 0x0a121c, wall: 0x1e3050, accent: 0x285890 },
  design: { floor1: 0x120c20, floor2: 0x100a1e, wall: 0x2c1c50, accent: 0x482888 },
  planning: { floor1: 0x18140c, floor2: 0x16120a, wall: 0x3a2c1c, accent: 0x785828 },
  operations: { floor1: 0x0c1a18, floor2: 0x0a1614, wall: 0x1c4030, accent: 0x287848 },
  qa: { floor1: 0x1a0c10, floor2: 0x180a0e, wall: 0x401c1c, accent: 0x782828 },
  devsecops: { floor1: 0x18100c, floor2: 0x160e0a, wall: 0x3a241c, accent: 0x783828 },
};
export let DEPT_THEME = DEPT_THEME_LIGHT;

/** Call once at scene build time to keep all mutable theme exports in sync with the active mode.
 *  Animation ticker imports these as live ES-module bindings, so they see updates immediately. */
export function syncPaletteTheme(isDark: boolean): void {
  OFFICE_PASTEL       = isDark ? OFFICE_PASTEL_DARK       : OFFICE_PASTEL_LIGHT;
  DEFAULT_CEO_THEME   = isDark ? DEFAULT_CEO_THEME_DARK   : DEFAULT_CEO_THEME_LIGHT;
  DEFAULT_BREAK_THEME = isDark ? DEFAULT_BREAK_THEME_DARK : DEFAULT_BREAK_THEME_LIGHT;
  DEPT_THEME          = isDark ? DEPT_THEME_DARK          : DEPT_THEME_LIGHT;
}

export const LOCALE_TEXT = {
  ceoOffice: { ko: "CEO 오피스", en: "CEO OFFICE" },
  collabTable: { ko: "6인 협업 테이블", en: "6P COLLAB TABLE" },
  statsEmployees: { ko: "직원", en: "Staff" },
  statsWorking: { ko: "작업중", en: "Working" },
  statsProgress: { ko: "진행", en: "In Progress" },
  statsDone: { ko: "완료", en: "Done" },
  hint: {
    ko: "WASD/방향키/가상패드: CEO 이동  |  Enter: 상호작용",
    en: "WASD/Arrow/Virtual Pad: CEO Move  |  Enter: Interact",
},
  mobileEnter: { ko: "Enter", en: "Enter" },
  mobileInteract: { ko: "상호작용", en: "Interact" },
  mobileMoveUp: { ko: "위로 이동", en: "Move up" },
  mobileMoveDown: { ko: "아래로 이동", en: "Move down" },
  mobileMoveLeft: { ko: "왼쪽으로 이동", en: "Move left" },
  mobileMoveRight: { ko: "오른쪽으로 이동", en: "Move right" },
  noAssignedAgent: { ko: "배정된 직원 없음", en: "No assigned staff" },
  breakRoom: { ko: "휴게실", en: "Break Room" },
  breakRoomSubtitle: { ko: "팀 배정이 안 된 에이전트", en: "Unassigned agents" },
  hireAgent: { ko: "에이전트 고용", en: "Hire agent" },
  officeCardTitle: { ko: "팀 · 에이전트", en: "Teams & Agents" },
  officeCardSubtitle: { ko: "에이전트를 눌러 상세·채팅·업무 배정", en: "Click agent for detail, chat, or assign work" },
  chatWithLead: { ko: "팀장과 채팅", en: "Chat with lead" },
  noAgentsInDept: { ko: "배정된 직원 없음", en: "No assigned staff" },
  agentCountOne: { ko: "명", en: " agent" },
  agentCountMany: { ko: "명", en: " agents" },
  role: {
    team_leader: { ko: "팀장", en: "Lead" },
    senior: { ko: "시니어", en: "Senior" },
    junior: { ko: "주니어", en: "Junior" },
    intern: { ko: "인턴", en: "Intern" },
    part_time: { ko: "알바", en: "Part-time" },
  },
  partTime: { ko: "알바", en: "Part-time" },
  collabBadge: { ko: "협업", en: "Collaboration" },
  meetingBadgeKickoff: { ko: "회의", en: "Meeting" },
  meetingBadgeReviewing: { ko: "검토중", en: "Reviewing" },
  meetingBadgeApproved: { ko: "승인", en: "Approval" },
  meetingBadgeHold: { ko: "보류", en: "Hold" },
  kickoffLines: {
    ko: ["유관부서 영향도 확인중", "리스크/의존성 공유중", "일정/우선순위 조율중", "담당 경계 정의중"],
    en: ["Checking cross-team impact", "Sharing risks/dependencies", "Aligning schedule/priorities", "Defining ownership boundaries"],
  },
  reviewLines: {
    ko: ["보완사항 반영 확인중", "최종안 Approved 검토중", "수정 아이디어 공유중", "결과물 교차 검토중"],
    en: ["Verifying follow-up updates", "Reviewing final approval draft", "Sharing revision ideas", "Cross-checking deliverables"],

  },
  meetingTableHint: {
    ko: "회의 중: 테이블 클릭해 회의록 보기",
    en: "Meeting live: click table for minutes",
},
  cliUsageTitle: { ko: "CLI 사용량", en: "CLI Usage" },
  cliConnected: { ko: "연결됨", en: "connected" },
  cliRefreshTitle: { ko: "사용량 새로고침", en: "Refresh usage data" },
  cliNotSignedIn: { ko: "로그인되지 않음", en: "not signed in" },
  cliNoApi: { ko: "사용량 API 없음", en: "no usage API" },
  cliUnavailable: { ko: "사용 불가", en: "unavailable" },
  cliLoading: { ko: "불러오는 중...", en: "loading..." },
  cliResets: { ko: "리셋까지", en: "resets" },
  cliNoData: { ko: "데이터 없음", en: "no data" },
  cliExpandTitle: { ko: "펼치기", en: "Expand" },
  cliCollapseTitle: { ko: "접기", en: "Collapse" },
  soon: { ko: "곧", en: "soon" },
  /** 팀장 회의 소집 (기획서 Phase 1) */
  conveneTeamLeaderMeeting: { ko: "팀장 회의 소집", en: "Convene team leader meeting" },
  conveneTeamLeaderMeetingA11y: { ko: "팀장만 소집하여 회의 시작", en: "Convene meeting with team leaders only" },
  noTeamLeaders: { ko: "등록된 팀장이 없습니다.", en: "No team leaders registered." },
  noTeamLeadersHint: { ko: "에이전트 관리에서 역할을 팀장으로 설정하세요.", en: "Set agent role to team leader in Agent Manager." },
  openAgentManager: { ko: "에이전트 관리", en: "Agent Manager" },
  dismiss: { ko: "닫기", en: "Dismiss" },
};

export const BREAK_CHAT_MESSAGES: Record<SupportedLocale, string[]> = {
  ko: [
    "커피 한 잔 더~", "오늘 점심 뭐 먹지?", "아 졸려...",
    "주말에 뭐 해?", "이번 프로젝트 힘들다ㅋ", "카페라떼 최고!",
    "오늘 날씨 좋다~", "야근 싫어ㅠ", "맛있는 거 먹고 싶다",
    "조금만 쉬자~", "ㅋㅋㅋㅋ", "간식 왔다!", "5분만 더~",
    "힘내자 파이팅!", "에너지 충전 중...", "집에 가고 싶다~",
  ],
  en: [
    "One more cup of coffee~", "What should we eat for lunch?", "So sleepy...",
    "Any weekend plans?", "This project is tough lol", "Cafe latte wins!",
    "Nice weather today~", "I hate overtime...", "Craving something tasty",
    "Let's take a short break~", "LOL", "Snacks are here!", "5 more minutes~",
    "Let's go, fighting!", "Recharging energy...", "I want to go home~",
  ],
};

export function pickLocale<T>(locale: SupportedLocale, map: Record<SupportedLocale, T>): T {
  return map[locale] ?? map.ko;
}
