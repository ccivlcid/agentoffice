/**
 * 뷰/액션/상태별 lucide 아이콘 중앙 매핑
 * UI개편기획서 Phase 1 — 이모지 제거 후 일관된 아이콘 체계
 */

import {
  Building2,
  LayoutDashboard,
  ClipboardList,
  BookOpen,
  Settings,
  Megaphone,
  Users,
  Crown,
  FileBarChart,
  Palette,
  Bot,
  Zap,
  Trophy,
  CheckCircle2,
  Inbox,
  Handshake,
  Search,
  Pause,
  Ban,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Square,
  FolderKanban,
  X,
  RefreshCw,
  Loader2,
  Compass,
  Wrench,
  AlertTriangle,
  Upload,
  Lightbulb,
  MessageSquare,
  Timer,
  Receipt,
  Key,
  Plug,
  Radio,
  Monitor,
  FileText,
  Check,
  Sparkles,
  TrendingUp,
  FlaskConical,
  Rocket,
  Landmark,
  Shield,
  Package,
  User,
  Code,
  Terminal,
  Brain,
  Flame,
  Star,
  Gem,
  Cat,
  Dog,
  Fish,
  Bug,
  Bird,
  Rabbit,
  Heart,
  Target,
  Folder,
  Briefcase,
  Gamepad2,
  Cpu,
  Database,
  Globe,
  HardDrive,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** 에이전트 아바타 피커용 아이콘 (기획서 §7) — 키는 avatar_emoji 필드에 저장 */
export const AVATAR_ICONS: Record<string, LucideIcon> = {
  bot: Bot,
  user: User,
  code: Code,
  terminal: Terminal,
  brain: Brain,
  zap: Zap,
  flame: Flame,
  star: Star,
  gem: Gem,
  cat: Cat,
  dog: Dog,
  fish: Fish,
  bug: Bug,
  bird: Bird,
  rabbit: Rabbit,
  heart: Heart,
  target: Target,
  rocket: Rocket,
  lightbulb: Lightbulb,
  wrench: Wrench,
  palette: Palette,
  barChart: FileBarChart,
  folder: Folder,
  briefcase: Briefcase,
  gamepad: Gamepad2,
  trophy: Trophy,
  shield: Shield,
  cpu: Cpu,
};

/** 스킬 라이브러리 카테고리 아이콘 (기획서 §2.5) */
export const SKILL_CATEGORY_ICONS: Record<string, LucideIcon> = {
  All: BookOpen,
  Frontend: Palette,
  Backend: Wrench,
  Design: Sparkles,
  "AI & Agent": Bot,
  Marketing: TrendingUp,
  "Testing & QA": FlaskConical,
  DevOps: Rocket,
  Productivity: FileText,
  Architecture: Landmark,
  Security: Shield,
  Other: Package,
};

/** 네비게이션 뷰 아이콘 */
export const VIEW_ICONS = {
  office: Building2,
  dashboard: LayoutDashboard,
  tasks: ClipboardList,
  skills: BookOpen,
  settings: Settings,
} as const;

/** 헤더/액션 아이콘 */
export const ACTION_ICONS = {
  announce: Megaphone,
  agents: Users,
  reports: FileBarChart,
  rooms: Palette,
  search: Search,
  edit: Pencil,
  delete: Trash2,
  close: X,
  refresh: RefreshCw,
  loader: Loader2,
  compass: Compass,
  wrench: Wrench,
} as const;

/** 태스크 상태 아이콘 */
export const STATUS_ICONS = {
  inbox: Inbox,
  planned: ClipboardList,
  collaborating: Handshake,
  in_progress: Zap,
  review: Search,
  done: CheckCircle2,
  pending: Pause,
  cancelled: Ban,
} as const;

/** 태스크 카드/공통 액션 */
export const TASK_ACTION_ICONS = {
  link: ExternalLink,
  hide: EyeOff,
  show: Eye,
  pause: Pause,
  stop: Square,
  edit: Pencil,
  delete: Trash2,
  project: FolderKanban,
} as const;

/** 기타 */
export const MISC_ICONS = {
  crown: Crown,
  bot: Bot,
  check: Check,
  alert: AlertTriangle,
  upload: Upload,
  lightbulb: Lightbulb,
  message: MessageSquare,
  timer: Timer,
  receipt: Receipt,
  key: Key,
  plug: Plug,
  radio: Radio,
  monitor: Monitor,
  fileText: FileText,
} as const;

/** MCP 서버 카테고리 아이콘 */
export const MCP_CATEGORY_ICONS: Record<string, LucideIcon> = {
  All: Plug,
  filesystem: HardDrive,
  database: Database,
  api: Globe,
  "dev-tools": Wrench,
  registry: Package,
  other: Package,
};

/** 에이전트 룰 카테고리 아이콘 */
export const RULE_CATEGORY_ICONS: Record<string, LucideIcon> = {
  All: FileText,
  general: FileText,
  coding: Code,
  architecture: Landmark,
  testing: FlaskConical,
  style: Palette,
};

export type ViewIconKey = keyof typeof VIEW_ICONS;
export type ActionIconKey = keyof typeof ACTION_ICONS;
export type StatusIconKey = keyof typeof STATUS_ICONS;
export type TaskActionIconKey = keyof typeof TASK_ACTION_ICONS;
export type MiscIconKey = keyof typeof MISC_ICONS;

/** 단일 진입점: 키로 LucideIcon 반환 */
export function getViewIcon(view: ViewIconKey): LucideIcon {
  return VIEW_ICONS[view];
}

export function getActionIcon(action: ActionIconKey): LucideIcon {
  return ACTION_ICONS[action];
}

export function getStatusIcon(status: StatusIconKey): LucideIcon {
  return STATUS_ICONS[status];
}
