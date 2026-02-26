# UI/UX 전면 개편 기획서

> v2.0 디자인 시스템 | 이모지 제거 + 세련된 아이콘 전환

---

## 0. 진행 현황 (2026-02 기준)

| 단계 | 항목 | 상태 | 비고 |
|------|------|------|------|
| Step 1 | `Icon.tsx` + `constants/icons.ts` 인프라 | ✅ 완료 | `src/components/ui/Icon.tsx`, `src/constants/icons.ts` |
| Step 2 | useAppLabels 아이콘 | ⏳ 생략 가능 | 라벨은 텍스트만 사용 중, 아이콘은 컴포넌트에서 직접 사용 |
| Step 3 | Sidebar + AppHeader | ✅ 완료 | 이미 lucide-react 직접 사용 중 |
| Step 4 | TaskBoard 우선순위 | ✅ 완료 | `priorityIcon` 이모지 제거 → `priorityColor` + CSS 도트, CreateModalForm 반영 |
| Step 4~ | TaskBoard 나머지, Dashboard | ✅ 대시보드 이미 lucide | TaskCard/FilterBar·Dashboard 전부 lucide 사용 중 |
| Step 5 | Skills Library | ✅ 완료 | skillsLibraryHelpers(랭크 뱃지 CSS), SKILL_CATEGORY_ICONS, SkillsLibrary/SkillCard/SkillDeleteConfirm/SkillEditModal/SkillUploadModal 이모지 → lucide |
| Step 6~ | Settings | ✅ 완료 | SettingsPanel 탭(Settings/Monitor/Key/Plug/Radio), 제목 ⚙️→Settings, General 저장✅→CheckCircle2, OAuth/Api/Gateway/Cli 🔄→RefreshCw |
| Step 7 | Agent/Chat/Decision | ✅ 완료 | AgentDetail(X), AgentAvatar(Bot 폴백), AgentDetailAlba/Info/CliEditor/Tasks, ChatPanel/Header/MessageInput/MessageList(Megaphone, ClipboardList, BarChart3, MessageSquare, Hand), DecisionInboxModal(Compass, X), DecisionInboxItemCard(UserCheck, Timer, Receipt, Bot) |
| Step 8 | AgentManagerModal 이모지 피커 | ✅ 완료 | EMOJI_LIST 제거 → AVATAR_ICONS 그리드(AvatarIconPicker), 기본값 bot, 목록 AvatarDisplay, 닫기 ✕→X |
| Step 8 | Office View Pixi | ✅ 완료 | officeViewPalette(휴게실/배지/회의중 텍스트만), scene-ceo(👑→Graphics 크라운), deliveryEffects(🧑‍💼/📋→Graphics), OfficeView CLI(🚀🌌→SVG) |
| Step 9 | Terminal / Project / 모달 잔여 | ✅ 완료 | TerminalMinutesTab(📝→FileText), TerminalProgressStrip(✓→Check), ProjectManagerList·PathPicker(✕→X), CreateModal·Overlays·BulkHideModal·ProjectFlowModal(✕→X), ClassroomTrainingAnimation(📝→FileText) |
| Step 10 | ClassroomTrainingAnimation 장식 | ✅ 완료 | 🦀→Bot 아이콘, PROVIDER_EMOJI→PROVIDER_DOT_CLASS(CSS 원형), ✨→Sparkles 아이콘 |
| Step 11 | 잔여 이모지 제거 + §10 품질 완료 | ✅ 완료 | SettingsPanelShared/CLI_INFO·OAuth 문구, SkillsLibraryProviderLogos, useAppHandlers/useFetchAll/useAppWebSocket(agentAvatar→user), SkillLearnProviderCard/SkillHistory*(📘📙📖🔨🪴→Icon), ProjectManagerForm/ProjectFlowModal/AgentManagerModal, CreateModalForm(★→Star), skillsLibraryHelpers(★→*), 테스트 픽스처(🤖→bot) |

**다음 권장 작업:** §10 품질 기준 충족 완료. (추가 이모지 제거 없음, 빌드 통과.)

**§10 품질 점검 결과 (요약):**
- 이모지 0개: ✅ `src` 내 `.tsx`/`.ts` 이모지 문자 없음 확인.
- crownRef 타입: ✅ `officeViewAgentTick.ts`에서 `Text | null` → `Graphics | null`로 정리 완료.
- 빌드: ✅ `pnpm run build` 성공 (2026-02 기준).

---

## 1. 개편 목표

| 항목 | AS-IS | TO-BE |
|------|-------|-------|
| 아이콘 시스템 | 이모지 187+개 (50+ 파일) | `lucide-react` SVG 아이콘 (이미 설치됨, 미사용 상태) |
| 시각적 톤 | 캐주얼/게이미피케이션 | 미니멀 + 프로페셔널 |
| 일관성 | 이모지 크기/정렬 불일치 | 통일된 아이콘 사이즈 체계 (14/16/18/20/24px) |
| 접근성 | 이모지 스크린리더 불일치 | `aria-label` 포함된 SVG 아이콘 |
| 오피스뷰 | Pixi Text 이모지 | Pixi Graphics 기반 미니 아이콘 |

---

## 2. 이모지 제거 대상 전체 목록

### 2.1 네비게이션 / 레이아웃

| 파일 | 현재 이모지 | 대체 lucide 아이콘 |
|------|------------|-------------------|
| `useAppLabels.ts` | `🏢` Office | `Building2` |
| `useAppLabels.ts` | `📊` Dashboard | `LayoutDashboard` |
| `useAppLabels.ts` | `📋` Tasks | `ClipboardList` |
| `useAppLabels.ts` | `📚` Skills | `BookOpen` |
| `useAppLabels.ts` | `⚙️` Settings | `Settings` |
| `useAppLabels.ts` | `📢` Announcement | `Megaphone` |
| `useAppLabels.ts` | `🏢` Room Manager | `Palette` |
| `useAppLabels.ts` | `📋` Reports | `FileBarChart` |
| `useAppLabels.ts` | `👥` Agent Manager | `Users` |
| `Sidebar.tsx` | `🏢📚📊📋⚙️` 네비 아이콘 | 위와 동일 |
| `Sidebar.tsx` | `👑` CEO 마커 | `Crown` |
| `App.tsx` | `🏢` 로딩 스피너 | `Building2` |

### 2.2 AppHeader

| 파일 | 현재 이모지 | 대체 lucide 아이콘 |
|------|------------|-------------------|
| `AppHeader.tsx` | `📋` Tasks | `ClipboardList` |
| `AppHeader.tsx` | `⏳` / `🧭` 의사결정 | `Loader2` / `Compass` |
| `AppHeader.tsx` | `📢` 공지 | `Megaphone` |

### 2.3 Dashboard

| 파일 | 현재 이모지 | 대체 lucide 아이콘 |
|------|------------|-------------------|
| `DashboardHudStats.tsx` | `📋` 전체 태스크 | `ClipboardList` |
| `DashboardHudStats.tsx` | `✅` 완료 | `CheckCircle2` |
| `DashboardHudStats.tsx` | `🤖` 에이전트 | `Bot` |
| `DashboardHudStats.tsx` | `⚡` 활성률 | `Zap` |
| `DashboardRankingBoard.tsx` | `🏆` 타이틀 | `Trophy` |
| `DashboardRankingBoard.tsx` | `⚔️` 빈 상태 | `Swords` |
| `DashboardRankingBoard.tsx` | `🥇🥈🥉` 메달 | 숫자 뱃지 (1st/2nd/3rd 컬러 원) |
| `DashboardGuildSquad.tsx` | `🏰` 타이틀 | `Castle` |
| `DashboardMissionLog.tsx` | `📡` 타이틀 | `Radio` |
| `dashboardHelpers.ts` | `⚔️🛡️⭐💎💠👑` 랭크 | CSS 뱃지 (Bronze~Master 그라데이션) |
| `Dashboard.tsx` | `🏢` 부서 | `Building2` |
| `Dashboard.tsx` | `⏰🔔🚀` 기타 | `Clock` / `Bell` / `Rocket` |

### 2.4 TaskBoard

| 파일 | 현재 이모지 | 대체 lucide 아이콘 |
|------|------------|-------------------|
| `taskBoardHelpers.ts` | `📥` inbox | `Inbox` |
| `taskBoardHelpers.ts` | `📋` planned | `ClipboardList` |
| `taskBoardHelpers.ts` | `🤝` collaborating | `Handshake` |
| `taskBoardHelpers.ts` | `⚡` in_progress | `Zap` |
| `taskBoardHelpers.ts` | `🔍` review | `Search` |
| `taskBoardHelpers.ts` | `✅` done | `CheckCircle2` |
| `taskBoardHelpers.ts` | `⏸️` pending | `Pause` |
| `taskBoardHelpers.ts` | `🚫` cancelled | `Ban` |
| `taskBoardHelpers.ts` | `🔴🟡🟢` 우선순위 | CSS 컬러 도트 (`w-2 h-2 rounded-full`) |
| `TaskCard.tsx` | `🔗` 링크 | `ExternalLink` |
| `TaskCard.tsx` | `🙈` 숨기기 | `EyeOff` |
| `TaskCard.tsx` | `⏸⏹` 제어 | `Pause` / `Square` |
| `TaskCard.tsx` | `📝` 편집 | `Pencil` |
| `TaskCard.tsx` | `👁` 복원 | `Eye` |
| `TaskCard.tsx` | `🗑` 삭제 | `Trash2` |
| `FilterBar.tsx` | `🔎` 검색 | `Search` |
| `TaskBoard.tsx` | `🗂` 프로젝트 | `FolderKanban` |

### 2.5 Skills Library

| 파일 | 현재 이모지 | 대체 lucide 아이콘 |
|------|------------|-------------------|
| `skillsLibraryHelpers.ts` | `📚🎨🔧✨🤖📈🧪🚀📝🏗️🔒📦` 카테고리 | `BookOpen`, `Palette`, `Wrench`, `Sparkles`, `Bot`, `TrendingUp`, `FlaskConical`, `Rocket`, `FileText`, `Landmark`, `Shield`, `Package` |
| `skillsLibraryHelpers.ts` | `🥇🥈🥉🏆⭐` 랭크 | CSS 뱃지 (Gold/Silver/Bronze 컬러) |
| `SkillsLibrary.tsx` | `⚠️` 에러 | `AlertTriangle` |
| `SkillsLibrary.tsx` | `📚` 헤더 | `BookOpen` |
| `SkillsLibrary.tsx` | `📄` 업로드 | `Upload` |
| `SkillsLibrary.tsx` | `🔍` 빈 검색 | `Search` |
| `SkillCard.tsx` | `✏️` 편집 | `Pencil` |
| `SkillCard.tsx` | `🗑️` 삭제 | `Trash2` |
| `SkillDeleteConfirm.tsx` | `🗑️` | `Trash2` |
| `SkillEditModal.tsx` | `💡` | `Lightbulb` |
| `SkillLearnProviderCard.tsx` | `📘📙📖🔨` | `BookMarked` / `Hammer` |
| `ClassroomTrainingAnimation.tsx` | 12+ 이모지 | 컬러 도트 + CSS 애니메이션 |
| `SkillHistoryRow.tsx` | `🔨` | `Hammer` |

### 2.6 Agent / Chat / Decision

| 파일 | 현재 이모지 | 대체 lucide 아이콘 |
|------|------------|-------------------|
| `AgentAvatar.tsx` | `🤖` 폴백 | `Bot` |
| `AgentManagerModal.tsx` | 30개 이모지 피커 | lucide 아이콘 그리드 피커 |
| `AgentDetail.tsx` | `✕` 닫기 | `X` |
| `AgentDetailAlba.tsx` | `🧑‍💼🔨✅` | `UserCheck` / `Hammer` / `CheckCircle2` |
| `AgentDetailCliEditor.tsx` | `🔧⚙️✏️` | `Wrench` / `Settings` / `Pencil` |
| `AgentDetailInfo.tsx` | `💬📋` | `MessageSquare` / `ClipboardList` |
| `ChatPanel.tsx` | `📢` | `Megaphone` |
| `ChatMessageList.tsx` | `💬👋` | `MessageSquare` / `Hand` |
| `ChatMessageInput.tsx` | `📋📢📊` | `ClipboardList` / `Megaphone` / `BarChart3` |
| `DecisionInboxModal.tsx` | `🧭✕` | `Compass` / `X` |
| `DecisionInboxItemCard.tsx` | `🧑‍💼⏱️🧾🤖` | `UserCheck` / `Timer` / `Receipt` / `Bot` |

### 2.7 Settings / Terminal / Project

| 파일 | 현재 이모지 | 대체 lucide 아이콘 |
|------|------------|-------------------|
| `SettingsPanel.tsx` | `⚙️🖥🔑🔌📡` 탭 | `Settings` / `Monitor` / `Key` / `Plug` / `Radio` |
| `SettingsPanelGeneral.tsx` | `✅` | `CheckCircle2` |
| `SettingsPanel*` (4개) | `🔄` 새로고침 | `RefreshCw` |
| `TerminalMinutesTab.tsx` | `📝` | `FileText` |
| `TerminalProgressStrip.tsx` | `✓` | `Check` |
| `ProjectManagerList.tsx` | `✕` | `X` |

### 2.8 Office View (Pixi.js)

| 파일 | 현재 이모지 | 대체 방법 |
|------|------------|----------|
| `officeViewPalette.ts` | `☕` 휴게실 | 텍스트만 ("Break Room") |
| `officeViewPalette.ts` | `🤝📣🔎✅⚠📝` 배지 | Pixi Graphics 도형 아이콘 |
| `officeViewScene-ceo.ts` | `👑` CEO 왕관 | Pixi Graphics (삼각 크라운) |
| `officeViewDeliveryEffects.ts` | `🧑‍💼` 미팅 피규어 | 스프라이트 텍스처 폴백 |
| `officeViewDeliveryEffects.ts` | `📋` 문서 | Pixi Graphics (사각형+선) |
| `OfficeView.tsx` | `🚀🌌` CLI 아이콘 | SVG 또는 텍스트 이니셜 |

---

## 3. 아이콘 사이즈 체계

| 용도 | 사이즈 | Tailwind 클래스 |
|------|--------|----------------|
| 인라인 텍스트 | 14px | `w-3.5 h-3.5` |
| 버튼/라벨 | 16px | `w-4 h-4` |
| 네비게이션 | 18px | `w-[18px] h-[18px]` |
| 헤더 액션 | 20px | `w-5 h-5` |
| 페이지 타이틀 | 24px | `w-6 h-6` |

---

## 4. 구현 전략

### Phase 1: 아이콘 인프라 구축
1. `src/components/ui/Icon.tsx` 래퍼 컴포넌트 생성
   - lucide 아이콘을 래핑하여 일관된 사이즈/스타일 적용
   - `size` prop으로 위 체계 자동 적용
2. 아이콘 매핑 상수 파일 (`src/constants/icons.ts`)
   - 뷰/액션/상태별 아이콘 중앙 관리

### Phase 2: React 컴포넌트 이모지 교체 (50+ 파일)
우선순위 순서:
1. **레이아웃** (Sidebar, AppHeader, useAppLabels) - 모든 페이지에 영향
2. **TaskBoard** 계열 - 가장 자주 사용
3. **Dashboard** 계열 - 이모지 밀도 높음
4. **Skills Library** 계열 - 카테고리/랭크 이모지
5. **Agent/Chat/Decision** 계열
6. **Settings/Terminal** 계열

### Phase 3: Office View Pixi.js 이모지 교체
1. `officeViewPalette.ts` 텍스트에서 이모지 접두사 제거
2. `officeViewScene-ceo.ts` 왕관 → Pixi Graphics 삼각 크라운
3. `officeViewDeliveryEffects.ts` 폴백 이모지 → 컬러 원 + 이니셜
4. 미팅 배지 텍스트에서 이모지 접두사 제거

### Phase 4: CSS/스타일 정리
1. 이모지 크기 관련 CSS 제거
2. 랭크 뱃지 이모지 → CSS 그라데이션 뱃지로 교체
3. 우선순위 이모지 도트 → Tailwind 컬러 도트로 교체

---

## 5. 새 컴포넌트 설계

### Icon 래퍼 컴포넌트
```tsx
// src/components/ui/Icon.tsx
import { LucideIcon } from "lucide-react";

interface IconProps {
  icon: LucideIcon;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_MAP = { xs: 14, sm: 16, md: 18, lg: 20, xl: 24 };

export function Icon({ icon: LucideComp, size = "sm", className }: IconProps) {
  const px = SIZE_MAP[size];
  return <LucideComp width={px} height={px} className={className} />;
}
```

### 아이콘 상수 매핑
```ts
// src/constants/icons.ts
import {
  Building2, LayoutDashboard, ClipboardList, BookOpen, Settings,
  Megaphone, Users, Crown, Bot, Zap, Trophy, CheckCircle2, ...
} from "lucide-react";

export const VIEW_ICONS = {
  office: Building2,
  dashboard: LayoutDashboard,
  tasks: ClipboardList,
  skills: BookOpen,
  settings: Settings,
} as const;

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
} as const;

export const STATUS_ICONS = {
  inbox: Inbox,
  planned: ClipboardList,
  in_progress: Zap,
  review: Search,
  done: CheckCircle2,
  pending: Pause,
  cancelled: Ban,
} as const;
```

---

## 6. 랭크/우선순위 뱃지 대체 디자인

### 랭크 뱃지 (이모지 → CSS)
| 기존 | 신규 |
|------|------|
| `⚔️` Bronze | `bg-amber-700 text-amber-100` 원형 뱃지 + "B" |
| `🛡️` Silver | `bg-slate-400 text-white` 원형 뱃지 + "S" |
| `⭐` Gold | `bg-yellow-500 text-yellow-900` 원형 뱃지 + "G" |
| `💎` Platinum | `bg-cyan-400 text-cyan-900` 원형 뱃지 + "P" |
| `💠` Diamond | `bg-blue-400 text-blue-900` 원형 뱃지 + "D" |
| `👑` Master | `bg-purple-500 text-white` 원형 뱃지 + Crown 아이콘 |

### 우선순위 도트 (이모지 → CSS)
| 기존 | 신규 |
|------|------|
| `🔴` High | `<span className="w-2 h-2 rounded-full bg-red-500" />` |
| `🟡` Medium | `<span className="w-2 h-2 rounded-full bg-yellow-500" />` |
| `🟢` Low | `<span className="w-2 h-2 rounded-full bg-green-500" />` |

### 메달 (이모지 → CSS)
| 기존 | 신규 |
|------|------|
| `🥇` 1st | `bg-yellow-400` 원 + "1" |
| `🥈` 2nd | `bg-slate-300` 원 + "2" |
| `🥉` 3rd | `bg-amber-600` 원 + "3" |

---

## 7. Agent 이모지 피커 대체

`AgentManagerModal.tsx`의 30개 이모지 피커를 lucide 아이콘 그리드로 교체:

```
Bot, User, Code, Terminal, Brain, Zap, Flame, Star,
Gem, Cat, Dog, Fish, Bug, Penguin, Bird, Squirrel,
Rabbit, Heart, Target, Rocket, Lightbulb, Wrench,
Palette, BarChart3, Folder, Briefcase, Gamepad2, Trophy,
Shield, Cpu
```

---

## 8. 파일 변경 범위 요약

| 카테고리 | 파일 수 | 주요 파일 |
|----------|---------|----------|
| 신규 생성 | 2 | `ui/Icon.tsx`, `constants/icons.ts` |
| 레이아웃 | 4 | Sidebar, AppHeader, App, useAppLabels |
| Dashboard | 6 | Dashboard + 5개 서브컴포넌트 |
| TaskBoard | 7 | TaskBoard + 6개 서브컴포넌트 |
| Skills | 10 | SkillsLibrary + 9개 서브컴포넌트 |
| Agent/Chat | 12 | Agent/Chat/Decision 계열 |
| Settings | 7 | SettingsPanel + 6개 탭 |
| Terminal | 2 | TerminalMinutesTab, TerminalProgressStrip |
| Project | 2 | ProjectManagerList, ProjectManagerPathPicker |
| Office View | 4 | palette, scene-ceo, deliveryEffects, OfficeView |
| Hooks | 3 | useAppHandlers, useAppWebSocket, useFetchAll |
| **합계** | **~59** | |

---

## 9. 작업 예상 순서

```
Step 1: Icon.tsx + icons.ts 인프라 생성
Step 2: useAppLabels.ts 아이콘 교체 (전체 네비 영향)
Step 3: Sidebar.tsx + AppHeader.tsx
Step 4: taskBoardHelpers.ts + TaskCard.tsx + FilterBar.tsx
Step 5: Dashboard 계열 6파일
Step 6: skillsLibraryHelpers.ts + SkillsLibrary 계열
Step 7: Agent/Chat/Decision 계열
Step 8: Settings 계열
Step 9: Terminal + Project 계열
Step 10: officeViewPalette.ts 이모지 제거
Step 11: officeViewScene-ceo.ts 왕관 교체
Step 12: officeViewDeliveryEffects.ts 폴백 교체
Step 13: OfficeView.tsx CLI 아이콘
Step 14: AgentManagerModal 이모지 피커 → 아이콘 피커
Step 15: CSS 정리 + 최종 검증
```

---

## 10. 품질 기준

- [x] 모든 `.tsx`/`.ts` 파일에서 이모지 문자 0개
- [x] `lucide-react` 아이콘으로 100% 대체
- [x] 아이콘 사이즈 체계 (xs/sm/md/lg/xl) 준수
- [x] 다크/라이트 모드 모두 정상 표시
- [x] Pixi.js 오피스뷰 이모지 → Graphics/텍스트 대체
- [x] TypeScript 컴파일 에러 0개
- [x] Vite 빌드 성공

---

## 11. 오피스 화면 개편 (권장 방향)

> 현재 오피스 뷰는 Pixi.js 기반 픽셀 시뮬레이션(CEO·부서·에이전트·배달·휴게실·벽시계 등) + React 오버레이(모바일 가상 패드, CLI 사용량 패널)로 구성되어 있음. 개편 시 참고용 전략.

### 11.1 현재 구조 요약

| 레이어 | 역할 | 주요 파일 |
|--------|------|-----------|
| **React** | `OfficeView.tsx` — 캔버스 컨테이너, 가상 패드, CliUsagePanel | `OfficeView.tsx`, `office-view/CliUsagePanel.tsx` |
| **Pixi 훅** | 캔버스 초기화·씬 구축·애니메이션 틱 | `useOfficePixi.ts`, `useOfficeInput.ts` |
| **씬/연출** | CEO실·부서실·휴게실·배달·파티클·벽시계 | `officeViewScene*.ts`, `officeViewDeliveryEffects.ts`, `officeViewAgentTick.ts`, `officeViewParticles.ts` |
| **테마/로케일** | 라이트/다크 팔레트, 부서 테마, 다국어 문구 | `officeViewPalette.ts` |

### 11.2 개편 방향 (택일 또는 조합)

| 방향 | 내용 | 난이도 | 비고 |
|------|------|--------|------|
| **A. 시각 리프레시** | 팔레트·부서 색상 정리, 픽셀 비율/해상도 조정, CEO/에이전트 스프라이트 개선 | 중 | 기존 Pixi 구조 유지, `officeViewPalette`·스프라이트 에셋 위주 |
| **B. UX 개선** | 클릭/호버 피드백 강화, 부서·에이전트 툴팁/라벨, 모바일 패드 위치/크기 조정, 접근성(포커스·aria) | 중하 | React 오버레이 + Pixi 히트 영역 정리 |
| **C. 레이아웃 재구성** | 캔버스 상단에 제목/필터 바 추가, CliUsagePanel 접이식·탭화, 좌측 미니맵/목차 | 중 | `OfficeView.tsx` 레이아웃 분리 + CSS/반응형 |
| **D. 성능** | 에이전트/파티클 풀링, 드로우콜 축소, 저사양 시 효과 축소 옵션 | 중상 | `officeViewAnimTick`·씬 빌드 로직 리팩터 |
| **E. 기능 확장** | 새 룸 타입, 미니게임·이벤트, 오피스 설정(줌/스크롤 기본값) | 상 | 기획·데이터 구조 확장 후 씬 빌드에 반영 |

### 11.3 권장 진행 순서

1. **목표 정의** — “브랜드 톤 강화 / 모바일 사용성 / 성능” 등 1~2개 우선 목표 정하기.
2. **A 또는 B부터** — 시각 리프레시(A) 또는 UX 개선(B)으로 사용자 체감을 먼저 올리고, 필요 시 레이아웃(C)·성능(D) 순으로 확장.
3. **문서화** — 변경 범위(팔레트/스프라이트/새 컴포넌트)를 이 문서 §11 하위에 “오피스 개편 Step N”으로 기록해 이모지 개편처럼 체크리스트로 관리.

원하시면 “A만”, “B+C”, “A+B+레이아웃” 등 구체 조합에 맞춰 단계별 작업 목록(체크리스트)을 만들어 드리겠습니다.

### 11.4 오피스 개편 실행 체크리스트 (B·C 위주)

| Step | 항목 | 상태 | 비고 |
|------|------|------|------|
| Step 1 | 오피스 뷰 상단 힌트/제목 바 | ✅ 완료 | 캔버스 위 제목·조작 힌트, LOCALE_TEXT.hint 활용 |
| Step 2 | CliUsagePanel 접이식 | ✅ 완료 | 접기/펼치기 버튼(ChevronUp/Down), 기본 펼침, climpire.office.cliUsageCollapsed 저장 |
| Step 3 | 모바일 가상 패드 접근성·스타일 | ✅ 완료 | ChevronUp/Down/Left/Right, 로케일 aria-label(mobileMoveUp 등), role=group |
| Step 4 | 캔버스 포커스/키보드 안내 | ✅ 완료 | focus-visible:ring-2 ring-amber-400, role=application, title=힌트 |

---

## 12. 오피스 전면 개편 (비픽셀) — 아이디어

> 픽셀 스프라이트 대신 다른 비주얼로 오피스 뷰를 바꾸고 싶을 때 선택할 수 있는 방향 정리.

### 12.1 옵션 비교

| 옵션 | 비주얼 | 기술 스택 | 장점 | 단점 |
|------|--------|-----------|------|------|
| **V. 벡터 미니멀** | 방=둥근 사각형, 인물=원+이니셜/아이콘, CEO=강조된 원(드래그 이동) | Pixi Graphics 또는 **SVG** | 픽셀 에셋 불필요, 해상도 무관, 기존 상호작용(방 클릭·CEO 이동) 유지 가능 | 기존 Pixi 씬 전부 벡터로 다시 그리기 필요 |
| **C. 카드/그리드** | 오피스 = 부서 카드 그리드, 카드 안에 에이전트 아바타·이름·상태 | **React + Tailwind** 만 (캔버스 제거) | 구현 단순, 반응형·접근성 좋음, Icon/AgentAvatar 재사용 | "걷는" 느낌 없음, 공간감 약함 |
| **I. 아이소메트릭** | 2.5D 아이소 룸(평면 타일), 캐릭터=단순 기하 도형 | Pixi Graphics 또는 **CSS 3D** | 독특한 공간감, 픽셀 아닌 새 look | 레이아웃/좌표 계산 복잡, 에셋 또는 도형 디자인 필요 |
| **B. 블루프린트/다이어그램** | 오피스 = 플로우차트(노드=부서/휴게실, 엣지=연결), 에이전트=노드 위 뱃지 | React + **SVG 또는 React Flow 계열** | 매우 프로페셔널/테크 톤, 확장(새 룸·연결) 쉬움 | 게임성·캐주얼함 감소 |
| **3. 로우폴리 3D** | 단순 3D 오피스(박스 룸, 로우폴리 캐릭터) | **Three.js** | 임팩트 큼, 최신감 | 의존성·구현량·성능 부담 큼 |

### 12.2 추천 우선순위

1. **빠르게 전환하고 싶다** → **C. 카드/그리드**  
   - Pixi 제거, React만으로 부서·에이전트 그리드 + 클릭 시 상세/채팅. 기존 API·상태 그대로 사용 가능.

2. **공간감은 유지하되 픽셀만 없애고 싶다** → **V. 벡터 미니멀**  
   - Pixi 유지, 스프라이트 대신 `Graphics`(원/라운드렉/선) + 텍스트/이니셜. CEO 이동·방 하이라이트·배달 연출은 로직 재사용.

3. **인상만 확 바꾸고 싶다** → **I. 아이소메트릭** 또는 **B. 블루프린트**  
   - 아이소: 게임 같은 공간감 유지. 블루프린트: 대시보드/플로우 툴 느낌.

### 12.3 다음 단계

- 위 표에서 **하나 선택** 후, 해당 옵션만 골라 "오피스 전면 개편 Step 1: ~" 형태로 작업 목록을 나누면 됨.
- **C. 카드/그리드** 선택 시: **설계 문서화를 선행**했음. → [`docs/09UIUX/오피스뷰-카드그리드-설계.md`](오피스뷰-카드그리드-설계.md) 참고 후, 해당 문서의 §8 마이그레이션 순서대로 구현 진행.
