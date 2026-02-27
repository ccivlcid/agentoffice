# Telegram CEO 지시 및 실시간 작업 업데이트

> 문서 목적: Telegram에서 CEO 지시사항(`$`)을 보내고, 동일 채널에서 실시간 작업 완료 업데이트를 받는 기능의 요구사항·흐름·현재 상태를 정리한다.
> **최종 갱신**: 2026-02-27 — v1.2.3 릴리즈 노트 반영, 코드 기반 현재 상태 갱신.

---

## 1. 개요

### 1.1 목표

- **CEO 지시 전송**: 사용자가 Telegram 등 메신저에서 `$`로 시작하는 메시지를 보내면, HyperClaw가 해당 내용을 업무지시로 수신·처리한다.
- **팀장 회의 선택**: 지시 수신 후 봇이 "팀장 소집 회의를 진행할까요? 1 회의 진행 / 2 회의 없이 바로 실행"을 물어보고, 사용자 선택에 따라 회의 진행 여부가 결정된다.
- **실시간 작업 업데이트**: 지시로 생성된 태스크가 완료되면, **같은 Telegram 대화**에 `[완료]` 형태의 실시간 알림이 전달된다.

### 1.2 사용자 시나리오 (목표 UX)

1. 사용자가 Telegram에서 `$ 응답 테스트중. 확인되면 회신 바람.` 전송.
2. 봇이 **팀장 소집 회의** 선택지를 보여준다.  
   예: `팀장 소집 회의를 진행할까요? 1 회의 진행 (기획팀 주관) 2 회의 없이 바로 실행`
3. 사용자가 `2` 입력 → 회의 없이 바로 실행 선택.
4. 봇이 **업무지시 전달 완료** 메시지 전송.  
   예: `Claw-Empire 업무지시 전달 완료 (회의 생략)`
5. 작업이 완료될 때마다 봇이 **실시간 업데이트**를 같은 채팅방에 전송.  
   예: `[완료] [협업] 응답 테스트중. 확인되면 회신 바람.`  
   예: `[완료] 응답 테스트중. 확인되면 회신 바람.`

---

## 2. 아키텍처 및 역할

### 2.1 참여 구성요소

| 구성요소 | 역할 |
|----------|------|
| **Telegram (사용자)** | `$` 지시 입력, 회의 선택(1/2), 완료 메시지 수신 |
| **메신저 봇 / OpenClaw 게이트웨이** | Telegram ↔ HyperClaw API 중계. 사용자 메시지 → Inbox API 호출, 서버 응답/이벤트 → Telegram 전송 |
| **HyperClaw 서버** | Inbox API로 지시 수신, 팀장 회의 여부 처리, 태스크 위임, 완료 시 푸시 이벤트 제공 |

### 2.2 데이터 흐름 요약

```
[Telegram] --$ 메시지--> [봇] --POST /api/inbox--> [HyperClaw]
                              <-- need_meeting_choice --
[Telegram] <-- "1 or 2?" -- [봇]

[Telegram] --"2"---> [봇] --POST /api/inbox (skipPlannedMeeting:true)--> [HyperClaw]
                              <-- 업무지시 전달 완료 --

... 태스크 실행 ...

[HyperClaw] --태스크 완료 이벤트--> [봇] --"[완료] ..."---> [Telegram]
```

- **지시 수신·확정**: 봇이 `POST /api/inbox`를 2번 호출할 수 있음.  
  - 1차: 지시 저장, `need_meeting_choice: true` 반환 → 봇이 1/2 선택지 표시.  
  - 2차: 동일 지시 + `skipPlannedMeeting: true` → 서버가 위임 실행 후 "업무지시 전달 완료" 반환.
- **실시간 업데이트**: 태스크 완료 시 HyperClaw가 봇/게이트웨이에게 알릴 수 있는 경로(WebSocket·폴링 등)가 필요하다.

---

## 3. API 요구사항

### 3.1 Inbox (CEO 지시 수신)

- **엔드포인트**: `POST /api/inbox`
- **인증**: `x-inbox-secret` 헤더에 `INBOX_WEBHOOK_SECRET` 값과 일치하는 시크릿 전달. 불일치/미설정 시 `401` 또는 `503`.
- **본문 예시** (최소):
  - `source`: 메신저 구분 (예: `"telegram"`)
  - `text`: 원문 (반드시 `$`로 시작하면 지시로 간주)
  - `author`: 발신자 식별자
  - `skipPlannedMeeting`: (선택) `true`면 회의 없이 바로 실행
  - `project_id`, `project_path`, `project_context`: (선택) 프로젝트 매핑

**응답 (목표)**:

- **1차 요청** (회의 선택 전):  
  `200` + `{ ok: true, need_meeting_choice: true }`  
  → 봇이 "1 회의 진행 / 2 회의 없이 바로 실행" 표시.
- **2차 요청** (`skipPlannedMeeting: true` 등으로 확정):  
  `200` + `{ ok: true, delivered: true, message: "Claw-Empire 업무지시 전달 완료 (회의 생략)" }`  
  → 봇이 해당 문구를 Telegram에 전송.

### 3.2 실시간 작업 업데이트 푸시

- **요구**: 태스크가 `done`으로 바뀔 때, 해당 지시를 보낸 대화(세션)로 **푸시**할 수 있어야 함.
- **구현 방식**:
  - **게이트웨이 API**: `POST /api/gateway/send` 등으로 `sessionKey` + 텍스트를 보내면, 해당 세션(Telegram 채팅)에 메시지 전달.
  - **Telegram 폴링**: 서버가 `getUpdates` 롱 폴링으로 메시지를 자동 수신. 봇 토큰 + 채팅 ID만 설정하면 자동 연결됨 (ngrok/웹훅 불필요).

- **푸시 메시지 형식 (예시)**  
  - `[완료] [협업] <태스크 제목>.`  
  - `[완료] <태스크 제목>.`  
  - (선택) 완료 시각, 담당 에이전트/부서 등 추가 가능.

---

## 4. 현재 프로젝트 상태 (코드 기준 2026-02-27)

### 4.1 Inbox — `POST /api/inbox`

- **상태**: **구현 완료**.
- **위치**: `server/modules/routes/ops/inbox-routes.ts`
- `processInboxPayload()`: 시크릿 검증, `need_meeting_choice` / `skipPlannedMeeting` 2단계 흐름, 프로젝트 바인딩, 지시 위임 전부 구현됨.
- Telegram 폴링(`server/gateway/telegram-polling.ts`)에서 직접 호출.

### 4.2 지시 처리 로직 — `POST /api/directives`

- **상태**: **구현 완료** (앱 내부용).
- **위치**: `server/modules/routes/ops/messages-directive-routes.ts:39-120`
- `skipPlannedMeeting`, `project_id`/`project_path`/`project_context` 등을 지원.
- Inbox 복구 시 이 로직을 재사용하거나, Inbox 전용 경로로 동일 규칙을 적용하면 된다.

### 4.3 내부 메시지 시스템

- **상태**: **구현 완료**.
- **위치**: `server/modules/routes/ops/messages-chat-routes.ts`
- `GET /api/messages` — 메시지 조회 (필터링 지원)
- `POST /api/messages` — 메시지 생성 (CEO → 에이전트)
- `POST /api/announcements` — 공지 생성
- `POST /api/announcements/team-leaders` — 팀장 공지

### 4.4 의사결정 인박스

- **상태**: **구현 완료** (내부용).
- **위치**: `server/modules/routes/ops/messages-inbox-routes.ts:99-134`
- `GET /api/decision-inbox` — 의사결정 항목 조회
- `POST /api/decision-inbox/:id/reply` — 의사결정 응답 처리 (프로젝트 리뷰, 리뷰 라운드, 타임아웃 재개)
- **참고**: 외부 메신저 브리지가 아닌, 앱 내부 의사결정 흐름만 처리.

### 4.5 Gateway / 실시간 푸시

- **`/api/gateway/*`**: 게이트웨이 세션 CRUD 및 메시지 전송 라우트 구현 완료 (`server/modules/routes/ops/gateway-routes.ts`).
- **Telegram 폴링**: `server/gateway/telegram-polling.ts` — 봇 토큰 + 채팅 ID로 자동 연결, `getUpdates` 롱 폴링 방식. 별도 웹훅/ngrok 불필요.
- **`notifyTaskStatus()`**: `server/gateway/client.ts`에 스텁으로 존재.
- **호출 지점** (스텁이므로 실제 동작 없음):
  - `server/modules/workflow/orchestration/finish-review.ts:235` — 태스크 `done` 전환 시
  - `server/modules/workflow/orchestration/run-complete.ts` — 완료 흐름
  - `server/modules/workflow/orchestration/archive.ts` — 아카이브 시
  - `server/modules/workflow/orchestration/report-flow.ts` — 보고 흐름
  - `server/modules/workflow/orchestration/task-execution.ts` — 태스크 실행
- **주입 경로**: `server/modules/workflow.ts:4,24` → RuntimeContext에 주입

### 4.6 메신저 채널 / 세션

- **`messenger_sessions` 테이블**: 구현 완료. 채널, 토큰(암호화), 대상 ID, 표시 이름, 매핑 에이전트 등 저장.
- **`messenger_routes` 테이블**: 구현 완료. 지시 원본과 Telegram 세션 연결 추적.
- **UI**: 설정 → 채널 메시지 탭에서 세션 추가/편집/삭제 가능.

### 4.7 환경 변수

- **`INBOX_WEBHOOK_SECRET`**: Inbox 인증용. 설정 시 `x-inbox-secret`과 비교.
- **`OAUTH_ENCRYPTION_SECRET`**: 메신저 세션 토큰 암호화(AES-256-GCM)에 사용. 메신저 세션 구현 완료.

---

## 5. 구현 시 참고사항

### 5.1 Inbox 복구 시

- **idempotency**: 동일 지시에 대해 "회의 선택 요청"과 "확정( skipPlannedMeeting )" 두 번 호출이 올 수 있으므로, `(source, author, text)` 기반 idempotency로 중복 생성 방지 및 2차 요청 시 위임 실행 처리.
- **프로젝트 바인딩**: AGENTS.md에 따라 기존/신규 프로젝트 선택 후 `project_id`/`project_path`/`project_context`를 Inbox 본문에 넣어 보내는 것은 **봇(오케스트레이터)** 책임. 서버는 수신한 값을 그대로 지시 위임 옵션에 반영하면 됨.

### 5.2 실시간 푸시 시

- **세션 연결**: 지시가 들어온 Inbox 요청에 `gateway_session_key` 또는 `reply_to` 같은 필드가 있으면, 해당 지시로 생성된 태스크 완료 시 같은 세션(Telegram 채팅)으로만 푸시하도록 연결할 수 있음.
- **루트 태스크 기준**: 위임된 서브태스크까지 모두 완료된 경우 등, "완료" 알림을 보낼 단위(루트 태스크 1건 vs. 각 서브태스크)를 정책으로 정해 두는 것이 좋음.

### 5.3 메시지 다국어

- 팀장 회의 선택 문구, "업무지시 전달 완료", "[완료]" 메시지 등은 AGENTS.md의 언어 규칙에 맞춰 사용자 언어(ko/en/ja/zh)로 응답하는 것이 좋음. 봇이 `author` 또는 별도 필드로 언어를 넘기면 서버에서 활용 가능.

---

## 6. 문서/규칙 참고

- **CEO 지시 플로우 (프로젝트·회의 선택·Inbox 호출)**: `AGENTS.md` — "CEO Directive (`$` prefix)", "Step 2: Project branch", "Step 3: Ask about team leader meeting", "Step 4: Send directive to server".
- **인박스 시크릿 해석**: `AGENTS.md` — INBOX_SECRET_DISCOVERY_V2 스크립트.
- **프론트 게이트웨이 사용처**: `src/api/gateway.ts` — `getGatewayTargets`, `sendGatewayMessage` (백엔드 라우트 미구현).

---

## 7. 요약 체크리스트

| 항목 | 문서화 | 구현 | 비고 |
|------|--------|------|------|
| Telegram → 봇 → Inbox API 흐름 정리 | ✅ | ✅ 완료 | §1, §2 |
| POST /api/inbox 명세 (요청/응답) | ✅ | ✅ 완료 | §3.1, §4.1 |
| 팀장 회의 선택(1/2) → skipPlannedMeeting | ✅ | ✅ 완료 | §2.2, §4.2 |
| 실시간 완료 푸시 요구사항 | ✅ | ⚠️ 스텁 연결만 | §3.2, §4.5 |
| Gateway 라우트 (`/api/gateway/*`) | ✅ | ✅ 완료 | §4.5 |
| 메신저 세션 DB·라우트 | ✅ | ✅ 완료 | §4.6 |
| Telegram 폴링 (getUpdates) | ✅ | ✅ 완료 | §4.5 |
| 내부 메시지 시스템 (`/api/messages`) | — | ✅ 완료 | §4.3 |
| 의사결정 인박스 (`/api/decision-inbox`) | — | ✅ 완료 | §4.4 |
| notifyTaskStatus 호출 지점 배치 | — | ⚠️ 스텁 연결만 | §4.5 |
| 구현 시 idempotency·세션 연결 참고 | ✅ | ✅ 완료 | §5.1, §5.2 |

개발은 위 명세와 AGENTS.md를 기준으로 진행하면 된다.

---

## 8. v1.2.3 릴리즈 노트 — 외부 메신저 연동 (계획/목표)

> 출처: [클로제국 1.2.3 릴리즈 공지](https://gall.dcinside.com/mgallery/board/view/?id=thesingularity&no=998516&search_head=120&page=1) (2026-02-27)
>
> **주의**: 아래 항목은 v1.2.3의 **목표 기능 목록**이다. 현재 코드베이스(`main` 브랜치)에는 대부분 미구현 상태이므로, 구현 시 이 명세를 참고한다.

### 8.1 통합 내장 메신저 채널

- 런타임, 라우팅, 게이트웨이 및 UI 전반에서 사용되는 **공유 메신저 채널 카탈로그** 추가.
- **내장 채널** (정규화된 이름):
  - `telegram`, `whatsapp`, `discord`, `googlechat`, `slack`, `signal`, `imessage`
- **런타임 구성**: SQLite `settings.messengerChannels` 키에 JSON으로 저장, 서버·UI에서 일관 사용.
- **토큰 보안**: 메신저 세션 토큰은 AES-256-GCM으로 암호화 저장 (`OAUTH_ENCRYPTION_SECRET`, 레거시 대체: `SESSION_SECRET`), 전송 시에만 복호화.

### 8.2 설정 탭 UX 재설계 (채팅 세션)

- 채널별 분산 편집 → 통합 **"채팅 추가" / "채팅 편집" 모달** UX.
- 세션 생성/편집/삭제 시 채널, 토큰, 대상, 이름, 활성화 플래그, 매핑된 에이전트를 한 곳에서 관리.
- 모달에서 확인 시 **즉시 저장** (별도 전체 저장 불필요).
- 채팅 목록에 매핑된 에이전트 **아바타 + 이름** 표시.
- 채널 메시징 탭 상단에 **등록 안내 도움말** 문구 추가.

### 8.3 채널 격리형 태스크 릴레이

- 작업 릴레이는 `[messenger-route] <channel>:<target>` 태그로 **원래 경로에 고정**.
- 릴레이 메시지 유형 확장:
  - `report` — 완료 보고서
  - `chat` — 일반 채팅
  - `status_update` — 상태 변경 알림
- **채널 간 확산 방지**: 회의 시작/진행/완료 메시지는 발신 채널로만 전달.
- **메모리 내 경로 캐시**: TTL + 최대 크기 안전장치 적용.

### 8.4 의사결정 메신저 브리지

- 의사결정 요청이 작업/프로젝트 컨텍스트의 **동일 전달 경로**를 통해 전달.
- **중복 방지**: 재시도/재시작 시 중복 알림 방지를 위한 영구 중복 제거 표시기.
- **메신저 내 숫자 응답** 지원:
  - 단일 선택: `1`
  - 멀티 선택 (리뷰 라운드): `1,3` 또는 `1 3`
- **구문 분석**: 다국어 지원, 경로 인식, 기존 결정 처리기 연동.
- 응답 ACK/ERR은 동일 메신저 채널/대상으로 회신.
- 보류 중인 결정이 **없을 때** 숫자 채팅은 일반 대화 흐름 유지 (가로채기 없음).

### 8.5 의사결정 메시지 가독성 개선

- 메신저 표시 형식 변경:
  - 간략한 요약문 + 간결한 옵션 미리보기 + 숫자 응답 안내.
- 운영자 화면에서 과도한 기술적 토큰 노이즈 제거.
- 호환성을 위해 내부적으로 토큰 기반 응답 구문 분석은 유지.

### 8.6 다이렉트 채팅 워크플로 및 보안 강화

- 직접 채팅 프로젝트 진행 시 **기존/신규 프로젝트 선택 의무화** (작업 전 단계).
- 다국어 의도/프로젝트 유형 대체 기능 개선 (반복 프롬프트 감소).
- **경로 보안**: `PROJECT_PATH_ALLOWED_ROOTS`로 허용된 루트만 프로젝트 경로 생성 가능 (경로 탐색 방지).
- 중복 문장 정규화 완화, 런타임 DB 타입 지정 강화 (`db: any` → 엄격한 타입).

### 8.7 메신저 완료 보고서 가독성

- 긴 완료 보고서 → **간결한 메신저 요약**으로 변환:
  - 제목 + 주요 결과
  - 진행 상황 요약 (가용 시)
  - "Claw-Empire 채팅에서 자세한 내용 확인" 링크
- 보고서 첫 줄에 에이전트 식별 정보 (아바타 + 이름) 사용 (고정 자동완성 문구 대체).
- 메신저 가독성 ↑ + 앱 내 채팅 스레드에 전체 세부 정보 보존.

### 8.8 API 및 동작 참고

- 다이렉트 메신저 엔드포인트: `/api/messenger/*` (구현 시 추가 필요).
- `/api/inbox`: 의사결정 응답 브리지 처리를 일반 채팅 응답 예약 **전에** 수행.
- 메신저 세션 페이로드: 세션별 `agentId` 매핑 지원.
- `.env` 메신저 토큰/채널 변수는 더 이상 기본 경로가 아님 → **UI/DB 설정이 정식 런타임 소스**.