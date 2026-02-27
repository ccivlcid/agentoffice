# Telegram CEO 지시 및 실시간 작업 업데이트

> 문서 목적: Telegram에서 CEO 지시사항(`$`)을 보내고, 동일 채널에서 실시간 작업 완료 업데이트를 받는 기능의 요구사항·흐름·현재 상태를 정리한다.  
> **개발 전 문서화** — 구현은 이 명세를 기준으로 진행한다.

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
- **실시간 업데이트**: 태스크 완료 시 HyperClaw가 봇/게이트웨이에게 알릴 수 있는 경로(웹훅·WebSocket·폴링 등)가 필요하다.

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
- **가능한 방식** (구현 시 선택):
  - **A. 아웃바운드 웹훅**: 서버가 `INBOX_TASK_UPDATE_WEBHOOK` 등으로 설정된 URL로 완료 페이로드를 POST. 봇이 이 URL을 제공하고, 수신 시 Telegram으로 전송.
  - **B. 게이트웨이 API**: `POST /api/gateway/send` 등으로 `sessionKey` + 텍스트를 보내면, 봇/OpenClaw가 해당 세션(Telegram 채팅)에 메시지 전달.
  - **C. WebSocket**: 봇이 WebSocket으로 연결해 `task_update`(status=done) 이벤트를 구독하고, 수신 시 Telegram에 전송.

- **푸시 메시지 형식 (예시)**  
  - `[완료] [협업] <태스크 제목>.`  
  - `[완료] <태스크 제목>.`  
  - (선택) 완료 시각, 담당 에이전트/부서 등 추가 가능.

---

## 4. 현재 프로젝트 상태

### 4.1 Inbox

- **`POST /api/inbox`**: 현재 **410 Gone** 반환.  
  - 메시지: `"Inbox webhook was removed. Implement your own webhook endpoint for directives."`
  - **필요 작업**: 410 제거 후, 위 3.1절 명세에 맞게 Inbox 처리 복구 (시크릿 검증, `need_meeting_choice` / `skipPlannedMeeting` 흐름, 프로젝트 바인딩).

### 4.2 지시 처리 로직

- **`POST /api/directives`**: 앱 내부용 지시 API는 존재하며, `skipPlannedMeeting`, `project_id`/`project_path`/`project_context` 등을 지원.
- Inbox 복구 시 이 로직을 재사용하거나, Inbox 전용 경로로 동일 규칙을 적용하면 된다.

### 4.3 실시간 푸시

- **`/api/gateway/targets`**, **`/api/gateway/send`**: 프론트엔드(`src/api/gateway.ts`)에서 호출하지만, **서버에는 해당 라우트가 없음** (구현되어 있지 않음).
- 태스크 완료 시 푸시를 트리거하는 서버 측 로직(예: `finish-review`, `archive` 등에서의 콜백/웹훅 호출)도 **아직 없음**.

### 4.4 환경 변수

- **`INBOX_WEBHOOK_SECRET`**: Inbox 인증용. 설정 시 `x-inbox-secret`과 비교.
- **`OPENCLAW_CONFIG`**: OpenClaw 설정 경로 (게이트웨이 타깃 탐색 등). 실시간 푸시 구현 시 연동 대상이 될 수 있음.

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

## 7. 요약 체크리스트 (구현 전)

| 항목 | 상태 | 비고 |
|------|------|------|
| Telegram → 봇 → Inbox API 흐름 정리 | ✅ 문서화됨 | 본 문서 §1, §2 |
| POST /api/inbox 명세 (요청/응답) | ✅ 문서화됨 | §3.1 |
| 팀장 회의 선택(1/2) → skipPlannedMeeting 반영 | ✅ 문서화됨 | §2.2, §3.1 |
| 실시간 완료 푸시 요구사항 | ✅ 문서화됨 | §3.2, §5.2 |
| 현재 Inbox 410 상태 | ✅ 문서화됨 | §4.1 |
| 현재 Gateway 미구현 상태 | ✅ 문서화됨 | §4.3 |
| 구현 시 idempotency·세션 연결 참고 | ✅ 문서화됨 | §5.1, §5.2 |

개발은 위 명세와 AGENTS.md를 기준으로 진행하면 된다.
