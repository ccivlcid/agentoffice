import type { MeetingReviewDecision } from "../../types";
import type { UiLanguage } from "../../i18n";
import type { Graphics, Container, Text } from "pixi.js";

/* ================================================================== */
/*  Types & Interfaces                                                 */
/* ================================================================== */

export interface SubAgent {
  id: string;
  parentAgentId: string;
  task: string;
  status: "working" | "done";
}

export interface CrossDeptDelivery {
  id: string;
  fromAgentId: string;
  toAgentId: string;
}

export interface CeoOfficeCall {
  id: string;
  fromAgentId: string;
  seatIndex: number;
  phase: "kickoff" | "review";
  action?: "arrive" | "speak" | "dismiss";
  line?: string;
  decision?: MeetingReviewDecision;
  holdUntil?: number;
}

import type { Department, Agent, Task, MeetingPresence } from "../../types";

export interface OfficeViewProps {
  departments: Department[];
  agents: Agent[];
  tasks: Task[];
  subAgents: SubAgent[];
  meetingPresence?: MeetingPresence[];
  activeMeetingTaskId?: string | null;
  unreadAgentIds?: Set<string>;
  crossDeptDeliveries?: CrossDeptDelivery[];
  onCrossDeptDeliveryProcessed?: (id: string) => void;
  ceoOfficeCalls?: CeoOfficeCall[];
  onCeoOfficeCallProcessed?: (id: string) => void;
  onOpenActiveMeetingMinutes?: (taskId: string) => void;
  customDeptThemes?: Record<string, { floor1: number; floor2: number; wall: number; accent: number }>;
  themeHighlightTargetId?: string | null;
  onSelectAgent: (agent: Agent) => void;
  onSelectDepartment: (dept: Department) => void;
  /** 휴게실에서 에이전트 고용(추가) 시 호출. 전달 시 휴게실 카드에 "에이전트 고용" 버튼 노출 */
  onHireAgent?: () => void;
  /** 팀장 회의 소집 클릭 시 호출(팀장 1명 이상). 기획: docs/09UIUX/오피스뷰-팀장회의소집-기획서.md */
  onConveneTeamLeaderMeeting?: () => void;
  /** 팀장 0명 빈 상태에서 "에이전트 관리" 클릭 시 호출 */
  onOpenAgentManager?: () => void;
  /** 드래그 앤 드롭으로 에이전트 부서 이동 시 호출 (null = 휴게실) */
  onMoveAgent?: (agentId: string, targetDeptId: string | null) => void;
}

export interface Delivery {
  sprite: Container;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
  arcHeight?: number;
  speed?: number;
  type?: "throw" | "walk";
  agentId?: string;
  holdAtSeat?: boolean;
  holdUntil?: number;
  arrived?: boolean;
  seatedPoseApplied?: boolean;
  meetingSeatIndex?: number;
  meetingDecision?: MeetingReviewDecision;
  badgeGraphics?: Graphics;
  badgeText?: Text;
}

export interface RoomRect {
  dept: Department;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WallClockVisual {
  hourHand: Graphics;
  minuteHand: Graphics;
  secondHand: Graphics;
}

export type ScrollAxis = "x" | "y";

export const MOBILE_MOVE_CODES = {
  up: ["ArrowUp", "KeyW"],
  down: ["ArrowDown", "KeyS"],
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
} as const;

export type MobileMoveDirection = keyof typeof MOBILE_MOVE_CODES;
export type RoomTheme = { floor1: number; floor2: number; wall: number; accent: number };
export type SupportedLocale = UiLanguage;

export type SubCloneBurstParticle = {
  node: Container;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  spin: number;
  growth: number;
};
