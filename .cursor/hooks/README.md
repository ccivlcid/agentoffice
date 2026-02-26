# Hooks – 오류 체크 및 자동 테스트

**Git 훅은 사용하지 않습니다.** Cursor 공식 **Agent Hooks**만 사용해, 개발이 끝날 때 **오류 체크(lint, type-check) + 자동 테스트(test)** 를 실행합니다.

---

## Cursor Agent Hooks (공식 문서 기준)

- **문서**: [Third Party Hooks \| Cursor Docs](https://cursor.com/docs/agent/third-party-hooks)
- **설정 파일**: `.cursor/hooks.json` (프로젝트), `~/.cursor/hooks.json` (사용자)
- **실행 시점**: 에이전트 라이프사이클 이벤트(세션 종료, 작업 중단 등)
- **차단**: 훅 스크립트가 **exit code 2**로 종료하면 해당 액션이 차단됨 (이 프로젝트는 차단하지 않고 결과만 보고)

---

## 오류 체크 + 자동 테스트 실행 시점

| 이벤트 | 실행 시점 | 동작 |
|--------|------------|------|
| **sessionEnd** | Cursor 에이전트 세션이 끝날 때 | `pnpm run check` 실행 (lint → type-check → test) |
| **stop** | 에이전트 작업이 중단될 때 | `pnpm run check` 실행 |

**check** 내용: `lint` → `type-check` → `test` 순서 실행, 하나라도 실패하면 중단하고 exit code 전달.

---

## 설정 요약

| 항목 | 경로/값 |
|------|---------|
| 훅 설정 | `.cursor/hooks.json` |
| 실행 스크립트 | `scripts/hooks/run-check.js` (Node로 `pnpm run check` 호출) |
| 수동 실행 | 터미널에서 `pnpm run check` |

---

## 현재 적용 중인 룰·규칙

| 파일 | 적용 내용 |
|------|-----------|
| `.cursor/rules/project-rules.mdc` | 프로젝트 공통(구조, pnpm, PowerShell, 300줄, 네이밍, 커밋 규칙) |
| `.cursor/rules/clean-code.mdc` | 상수/네이밍/주석/단일책임/DRY/파일 300줄/테스트 |
| `.cursor/rules/codequality.mdc` | 검증·파일별 수정·요약 금지·기존 코드 유지 |
| `.cursor/rules/fastapi.mdc`, `api-backend.mdc` | FastAPI·타입·독스트링·예외·로깅·SQL 인젝션 |
| `.cursor/rules/nextjs.mdc`, `web-frontend.mdc`, `react.mdc`, `tailwind.mdc` | Next.js·Tailwind·React·컨벤션 |
| `.cursor/rules/erd.mdc`, `project-progress.mdc` | Oracle ERD·진행 현황 |

---

## 사용하는 프로젝트 커맨드

| 명령 | 용도 |
|------|------|
| `pnpm run check` | 오류 체크 + 테스트 한 번에 (훅에서 자동 호출) |
| `pnpm lint`, `pnpm type-check`, `pnpm test` | 개별 실행 (수동) |
| 기타 | `.cursor/commands/project-commands.md` 참고 |

---

## Cursor 훅 이벤트 참고 (문서 기준)

| Cursor 훅 | 설명 |
|-----------|------|
| `beforeSubmitPrompt` | 프롬프트 제출 직전 |
| `preToolUse` / `postToolUse` | 도구 실행 직전/직후 |
| `stop` | 에이전트 작업 중단 시 |
| `sessionStart` / `sessionEnd` | 세션 시작/종료 시 |
| `preCompact` | 컨텍스트 압축 직전 |

이 프로젝트에서는 **sessionEnd**와 **stop**에서만 `run-check.js`를 실행합니다.
