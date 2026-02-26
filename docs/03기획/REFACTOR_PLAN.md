# HAIFeR Agent 리팩토링 계획 (코딩 규칙 정렬)

README_ko.md의 **프로젝트 구조**를 실제 디렉터리와 대조하고, **단일 파일 300줄 이하** 등 코딩 규칙에 맞춰 리팩토링을 진행하기 위한 계획서입니다.

---

## 1. 프로젝트 구조 대조 결과

### 1.1 README vs 실제

| README (haiferagent/) | 실제 | 비고 |
|----------------------|------|------|
| `server/` (Express 5 + SQLite + WS) | ✅ 존재 | index.ts, server-main.ts, config/, db/, gateway/, oauth/, security/, ws/, types/, modules/, test/ |
| `src/` (React 19 + Vite) | ✅ 존재 | main.tsx, App.tsx, api.ts, i18n.ts, components/, hooks/, types/, test/ |
| `public/`, `scripts/`, `docs/`, `templates/`, `tests/` | ✅ 존재 | 구조 일치 |
| 루트: index.html, vite.config.ts, tsconfig*.json, package.json | ✅ 일치 | |

**결론:** README_ko.md에 적힌 프로젝트 구조는 **현재 레포와 일치**합니다. 구조 변경 없이 **파일 단위 분리(300줄 제한)** 에 집중하면 됩니다.

### 1.2 코딩 규칙 적용 범위

- `.cursor/rules/project-rules.mdc`는 **HAIFeR Web IDE**(Next.js + FastAPI, apps/web, apps/api-backend)용입니다.
- **HAIFeR Agent** 본 레포(Express + Vite/React, server/ + src/)에는 아래만 공통 적용하는 것을 권장합니다.
  - **단일 파일 300줄 이하** — 초과 시 모듈/컴포넌트/훅으로 분리
  - **DRY, 단일 책임**, 주석은 이유 위주
  - **네이밍**: 프론트 컴포넌트·페이지 PascalCase 또는 kebab-case, 유틸·훅 camelCase / 백엔드(server/)는 기존 TypeScript 관례 유지(파일명 kebab 또는 그대로, 클래스 PascalCase, 함수 camelCase)
  - **Git**: Conventional Commits, feature/·fix/ 브랜치

---

## 2. 300줄 초과 파일 목록 (우선순위)

리팩토링 시 **의존성·영향도**를 고려해 단계를 나누는 것을 권장합니다.  
**기준:** `pnpm run check:lines` (scripts/check-line-count.mjs) — 2025-02 기준 32개 파일 초과.

### 2.1 백엔드 (server/)

| 순위 | 파일 | 줄 수 | 분리 방향 제안 |
|------|------|-------|----------------|
| 1 | `server/modules/routes/core.ts` | 3,772 | 태스크/에이전트/부서/프로젝트별 핸들러·유틸로 분리 (예: core/tasks.ts, core/agents.ts, core/departments.ts) |
| 2 | `server/modules/routes/ops/messages.ts` | 2,689 | 인박스/의사결정/메시지 타입별로 모듈 분리 |
| 3 | `server/modules/workflow/core.ts` | 2,601 | worktree, merge, project-context 등 기능 단위 파일로 분리 |
| 4 | `server/modules/routes/collab.ts` | 2,529 | 디렉티브/위임/CLI 연동 등 역할별 분리 |
| 5 | `server/modules/workflow/orchestration.ts` | 2,219 | 라운드/리뷰/위임 단계별 또는 orchestration/ 하위 모듈로 분리 |
| 6 | `server/server-main.ts` | 1,822 | 라우트 등록·미들웨어·WS 초기화를 별도 모듈로 이전 |
| 7 | `server/modules/workflow/agents/providers.ts` | 1,811 | 프로바이더별 또는 타입별 파일 분리 |
| 8 | `server/modules/workflow/agents.ts` | 1,256 | 에이전트 목록·상태·배정 등 역할별 분리 |
| 9 | `server/modules/workflow/orchestration/meetings.ts` | 1,229 | 회의 생성/요약/라운드 등 하위 모듈 분리 |
| 10 | `server/modules/routes/collab/coordination.ts` | 1,196 | 위임/코디네이션 단위로 분리 |
| 11 | `server/modules/routes/ops/oauth.ts` | 876 | OAuth 콜백/토큰/연동 단위로 분리 |
| 12 | `server/modules/routes/ops/terminal.ts` | 691 | 터미널 세션/로그/명령 단위로 분리 |
| 13 | `server/modules/routes/ops/task-reports.ts` | 542 | 리포트 생성/조회/포맷 단위로 분리 |
| 14 | `server/modules/routes/ops/skills-learn.ts` | 435 | 스킬 학습/등록 단위로 분리 |
| 15 | `server/modules/routes/ops/cli-models.ts` | 304 | 모델 목록/설정 단위로 분리 (300줄 근접) |

### 2.2 프론트엔드 (src/)

| 순위 | 파일 | 줄 수 | 분리 방향 제안 |
|------|------|-------|----------------|
| 1 | `src/components/OfficeView.tsx` | 3,986 | PixiJS 씬/에이전트/룸/UI 블록별 컴포넌트·훅으로 분리 (예: OfficeCanvas.tsx, OfficeAgents.tsx, useOfficeScene.ts) |
| 2 | `src/components/TaskBoard.tsx` | 3,194 | 칸반 컬럼/카드/드래그/필터를 컴포넌트·훅으로 분리 |
| 3 | `src/App.tsx` | 2,365 | 라우트·레이아웃·전역 상태를 페이지/레이아웃 컴포넌트와 훅으로 분리 |
| 4 | `src/components/SkillsLibrary.tsx` | 1,553 | 목록/카드/필터/모달을 하위 컴포넌트로 분리 |
| 5 | `src/components/ProjectManagerModal.tsx` | 1,345 | 폼/리스트/탭 단위로 분리 |
| 6 | `src/components/ChatPanel.tsx` | 1,170 | 메시지 목록/입력/디렉티브 UI 등으로 분리 |
| 7 | `src/components/Dashboard.tsx` | 943 | KPI/차트/위젯 컴포넌트로 분리 |
| 8 | `src/components/GitHubImportPanel.tsx` | 784 | 단계별 또는 하위 컴포넌트로 분리 |
| 9 | `src/components/AgentDetail.tsx` | 710 | 섹션별 컴포넌트로 분리 |
| 10 | `src/components/SettingsPanel.tsx` | 616 | 탭별 컴포넌트 추가 분리 (일부 완료) |
| 11 | `src/components/SkillHistoryPanel.tsx` | 508 | 목록/아이템 컴포넌트로 분리 |
| 12 | `src/components/DecisionInboxModal.tsx` | 500 | 카드/액션/필터 등으로 분리 |
| 13 | `src/components/TerminalPanel.tsx` | 497 | 로그 뷰/컨트롤 분리 |
| 14 | `src/components/SettingsPanelOAuth.tsx` | 389 | 작은 블록만 분리 |
| 15 | `src/components/SettingsPanelApi.tsx` | 376 | 동일 |
| 16 | `src/components/TaskReportPopup.tsx` | 311 | 동일 |
| 17 | `src/api/client.ts` | 305 | 요청/인터셉터 등 단위로 분리 (300줄 근접) |

---

## 3. 리팩토링 진행 순서 제안

1. **1단계 (영향 최소)**  
   - 백엔드: `server/types/runtime-context.ts`, `server/modules/lifecycle.ts`  
   - 프론트: `OfficeRoomManager.tsx`, `TaskReportPopup.tsx`, `AgentStatusPanel.tsx`  
   → 300줄 근처 파일부터 분리해 패턴을 정한 뒤, 테스트·실행으로 회귀 여부 확인.

2. **2단계 (핵심 UI)**  
   - `SettingsPanel.tsx` → 탭별 컴포넌트 (SettingsCompany.tsx, SettingsCli.tsx 등)  
   - `api.ts` → `api/` 디렉터리 + 도메인별 파일  
   - `server/server-main.ts` → 초기화/라우트/미들웨어 모듈 분리  

3. **3단계 (대형 라우트/워크플로)**  
   - `server/modules/routes/ops.ts` → `ops/` 하위에 기능별 파일  
   - `server/modules/routes/core.ts` → `core/` 하위에 태스크·에이전트·부서 등  
   - `server/modules/workflow/core.ts` → worktree, merge, context 등 분리  

4. **4단계 (대형 컴포넌트)**  
   - `OfficeView.tsx` → 씬/캔버스/에이전트/룸 컴포넌트·훅  
   - `TaskBoard.tsx` → 칸반 컬럼/카드/드래그 훅·컴포넌트  
   - `App.tsx` → 레이아웃·라우트·전역 상태 훅  

각 단계 후 `pnpm dev:local` 및 기존 테스트로 동작을 확인하는 것을 권장합니다.

---

## 4. 체크리스트 (진행 시 참고)

### 4.0 단계별 요약

- [x] 1단계: 소규모 파일 분리 (OfficeRoomManager, AgentStatusPanel, TaskReportPopup 완료)
- [x] 1단계: server lifecycle 분리 (lifecycle/breaks.ts, recovery.ts, auto-assign.ts + lifecycle.ts 축소)
- [x] 1단계: server types/runtime-context.ts 분리 (helpers, base, workflow-*, route-*, augmented + re-export)
- [x] 2단계: SettingsPanel (General/Cli/Gateway/OAuth/API 탭 컴포넌트 분리 완료 — SettingsPanelOAuth.tsx, SettingsPanelApi.tsx 추가)
- [x] 2단계: api.ts → src/api/ (client, departments, agents, tasks, projects, messages, settings, oauth, skills, gateway, api-providers, task-reports, active-agents, github + index)
- [x] 2단계: server-main 미들웨어·WS 분리 (server/middleware/static.ts, server/ws/attach.ts; lifecycle에서 사용)
- [x] 3단계: 백엔드 300줄 초과 파일 전체 분리 완료 (ops.ts, core.ts, workflow/core.ts, collab.ts, orchestration.ts, server-main.ts, agents.ts, agents/providers.ts, meetings.ts, coordination.ts, oauth.ts, terminal.ts, task-reports.ts, messages.ts, tasks.ts, auto-update.ts, worktree.ts — 모두 300줄 이하 달성)
- [x] 4단계: OfficeView, TaskBoard, App.tsx 분리 완료 — 프론트엔드 전체 파일 300줄 이하 달성 (2026-02)
- [x] 전체: 단일 파일 300줄 이하 **점검 완료** — 백엔드 모든 파일 300줄 이하 달성 (2026-02)
- [x] (선택) haiferagent 전용 `.cursor/rules` — `.cursor/rules/haiferagent.mdc` (server/ + src/ 구조 및 300줄 규칙 명시)

### 4.1 300줄 초과 파일 체크리스트 (`pnpm run check:lines` 기준)

리팩토링 완료 시 해당 항목을 `[x]`로 변경하고, `pnpm run check:lines`로 재점검.

**백엔드 (server/)**

- [x] `server/modules/routes/core.ts` (health-update 분리 적용, 300줄 이하 달성)
- [x] `server/modules/routes/ops/messages.ts` (2,689 → 13개 파일, 최대 274줄)
- [x] `server/modules/routes/core/tasks.ts` (1,235 → 7개 파일, 최대 298줄)
- [x] `server/modules/workflow/core.ts` (1,846 → 8개 파일, 최대 299줄)
- [x] `server/modules/routes/core/auto-update.ts` (565 → 3개 파일, 최대 158줄)
- [x] `server/modules/workflow/worktree.ts` (779 → 5개 파일, 최대 139줄)
- [x] `server/modules/routes/collab.ts` (2,529 → 18개 파일, 최대 297줄)
- [x] `server/modules/workflow/orchestration.ts` (2,219 → 14개 파일, 최대 299줄)
- [x] `server/server-main.ts` (1,822 → 11개 파일, 최대 264줄)
- [x] `server/modules/workflow/agents/providers.ts` (1,811 → 10개 파일, 최대 269줄)
- [x] `server/modules/workflow/agents.ts` (1,256 → 7개 파일, 최대 299줄)
- [x] `server/modules/workflow/orchestration/meetings.ts` (1,229 → 7개 파일, 최대 287줄)
- [x] `server/modules/routes/collab/coordination.ts` (1,196 → 8개 파일, 최대 277줄)
- [x] `server/modules/routes/ops/oauth.ts` (876 → 5개 파일, 최대 182줄)
- [x] `server/modules/routes/ops/terminal.ts` (691 → 4개 파일, 최대 233줄)
- [x] `server/modules/routes/ops/task-reports.ts` (542 → 3개 파일, 최대 251줄)

**프론트엔드 (src/) — 17개**

- [x] `src/components/OfficeView.tsx` (3,986) → office-view/ 분리 완료; useOfficePixi.ts 추가 분리 (244줄)
- [x] `src/components/TaskBoard.tsx` (3,194) → task-board/ 분리 완료 (204줄)
- [x] `src/App.tsx` (2,365) → hooks/useAppHandlers.ts 등 분리 완료 (266줄)
- [x] `src/components/SkillsLibrary.tsx` (1,553) → skills-library/ 분리 완료 (296줄)
- [x] `src/components/ProjectManagerModal.tsx` (1,345) → project-manager/ 분리 완료 (174줄)
- [x] `src/components/ChatPanel.tsx` (1,170) → chat-panel/ 분리 완료 (298줄)
- [x] `src/components/Dashboard.tsx` (943) → dashboard/ 분리 완료 (253줄)
- [x] `src/components/GitHubImportPanel.tsx` (784) → github/ 분리 완료 (165줄)
- [x] `src/components/AgentDetail.tsx` (710) → agent-detail/ 분리 완료 (282줄)
- [x] `src/components/SettingsPanel.tsx` (616) → useSettingsPanelOAuth.ts + useSettingsPanelApi.ts + useSettingsPanelGateway.ts 분리 완료 (177줄)
- [x] `src/components/SkillHistoryPanel.tsx` (508) → skill-history/ 분리 완료 (257줄)
- [x] `src/components/DecisionInboxModal.tsx` (500) → DecisionInboxItemCard + DecisionInboxFollowup 분리 완료 (212줄)
- [x] `src/components/TerminalPanel.tsx` (497) → terminal/ 분리 완료 (239줄)

이 문서는 `docs/REFACTOR_PLAN.md` 로 두고, 단계별로 완료 시 체크리스트를 갱신하면 됩니다.
