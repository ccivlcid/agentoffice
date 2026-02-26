# HAIFeR Agent REST API 레퍼런스

> 기본 URL: `http://localhost:8790/api`

---

## 1. 헬스 & 상태

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/health` | 서버 상태 확인 |
| GET | `/update-status` | 앱 업데이트 가용 여부 |
| GET | `/update-auto-status` | 자동 업데이트 설정 확인 |
| POST | `/update-apply` | 대기 중 업데이트 적용 |
| POST | `/update-auto-config` | 자동 업데이트 구성 변경 |

---

## 2. 에이전트 & 부서

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/agents` | 전체 에이전트 목록 |
| GET | `/agents/:id` | 단일 에이전트 상세 |
| GET | `/agents/active` | 작업 중 에이전트 목록 |
| GET | `/agents/cli-processes` | CLI 프로세스 목록 |
| DELETE | `/agents/cli-processes/:pid` | CLI 프로세스 강제 종료 |
| PATCH | `/agents/:id` | 에이전트 수정 (이름, 프로바이더, 성격, 상태) |
| POST | `/agents/:id/spawn` | 에이전트 프로세스 수동 스폰 |
| GET | `/departments` | 부서 목록 |
| GET | `/departments/:id` | 부서 상세 |
| GET | `/meeting-presence` | 회의 참석 현황 |

---

## 3. 태스크 & 서브태스크

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/tasks` | 태스크 목록 (필터: status, department, agent, project) |
| POST | `/tasks` | 태스크 생성 |
| GET | `/tasks/:id` | 태스크 상세 |
| PATCH | `/tasks/:id` | 태스크 수정 |
| DELETE | `/tasks/:id` | 태스크 삭제 |
| POST | `/tasks/:id/run` | 실행 시작 |
| POST | `/tasks/:id/stop` | 실행 중지/취소 |
| POST | `/tasks/:id/resume` | 일시정지 재개 |
| POST | `/tasks/:id/assign` | 에이전트 배정 |
| GET | `/tasks/:id/meeting-minutes` | 회의록 조회 |
| GET | `/tasks/:id/terminal` | 터미널 출력 조회 |
| GET | `/tasks/:id/diff` | Git 변경사항 조회 |
| POST | `/tasks/bulk-hide` | 다수 태스크 숨김 |
| POST | `/tasks/:id/discard` | 변경사항 폐기 |
| POST | `/tasks/:id/merge` | 워크트리 → dev 브랜치 머지 |
| GET | `/subtasks` | 서브태스크 목록 |
| POST | `/tasks/:id/subtasks` | 서브태스크 생성 |
| PATCH | `/subtasks/:id` | 서브태스크 수정 |

---

## 4. 프로젝트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/projects` | 프로젝트 목록 |
| POST | `/projects` | 프로젝트 생성 |
| GET | `/projects/:id` | 프로젝트 상세 |
| PATCH | `/projects/:id` | 프로젝트 수정 |
| DELETE | `/projects/:id` | 프로젝트 삭제 |
| GET | `/projects/:id/branches` | Git 브랜치 목록 |
| GET | `/projects/path-check` | 프로젝트 경로 검증 |
| GET | `/projects/path-suggestions` | 경로 자동완성 |
| GET | `/projects/path-browse` | 파일 시스템 탐색 |
| POST | `/projects/path-native-picker` | 네이티브 피커 열기 |

---

## 5. 메시지 & 채팅

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/messages` | 채팅 메시지 목록 |
| POST | `/messages` | 메시지 전송 |
| POST | `/announcements` | 전사 공지 전송 |
| DELETE | `/messages` | 메시지 삭제 |

---

## 6. 의사결정 Inbox

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/decision-inbox` | 대기 중 의사결정 목록 |
| POST | `/decision-inbox/:id/reply` | 의사결정 응답 제출 |

---

## 7. 디렉티브 (CEO 지시)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/directives` | CEO 디렉티브 생성 |

---

## 8. GitHub 연동

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/github/status` | GitHub 인증 상태 |
| GET | `/github/repos` | 사용자 저장소 목록 |
| GET | `/github/repos/:owner/:repo/branches` | 저장소 브랜치 목록 |
| POST | `/github/clone` | 저장소 클론 시작 |
| GET | `/github/clone/:cloneId` | 클론 진행상황 조회 |

---

## 9. API 프로바이더

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api-providers` | 프로바이더 목록 |
| POST | `/api-providers` | 프로바이더 생성 |
| PUT | `/api-providers/:id` | 프로바이더 수정 |
| DELETE | `/api-providers/:id` | 프로바이더 삭제 |
| POST | `/api-providers/:id/test` | 연결 테스트 |
| GET | `/api-providers/:id/models` | 모델 목록 조회 |
| GET | `/api-providers/presets` | 프리셋 프로바이더 목록 |

---

## 10. OAuth & 인증

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/oauth/start` | OAuth 플로우 시작 |
| GET | `/oauth/callback/github-copilot` | GitHub Copilot 콜백 |
| GET | `/oauth/callback/antigravity` | Google Antigravity 콜백 |
| POST | `/oauth/github-copilot/device-start` | Device Flow 시작 |
| POST | `/oauth/github-copilot/device-poll` | Device Flow 폴링 |
| GET | `/oauth/status` | OAuth 연결 상태 |
| GET | `/oauth/models` | OAuth 프로바이더 모델 |
| POST | `/oauth/disconnect` | 계정 연결 해제 |
| POST | `/oauth/accounts/activate` | 계정 활성화 |
| PUT | `/oauth/accounts/:id` | 계정 설정 수정 |
| POST | `/oauth/refresh` | 토큰 리프레시 |

---

## 11. 스킬

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/skills` | 학습된 스킬 목록 |
| GET | `/skills/available` | 학습 가능 스킬 목록 |
| GET | `/skills/detail` | 스킬 상세 메타데이터 |
| GET | `/skills/history` | 학습 이력 |
| POST | `/skills/learn` | 스킬 학습 시작 |
| GET | `/skills/learn/:jobId` | 학습 작업 상태 |
| POST | `/skills/unlearn` | 스킬 제거 |

---

## 12. CLI & 모델

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/cli-models` | CLI 프로바이더 모델 목록 |
| GET | `/cli-status` | 설치된 CLI 도구 감지 |
| GET | `/cli-usage` | CLI 사용량 통계 |
| POST | `/cli-usage/refresh` | 사용량 데이터 새로고침 |

---

## 13. 태스크 리포트 & 분석

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/task-reports` | 태스크 리포트 목록 |
| GET | `/task-reports/:taskId` | 태스크 리포트 상세 |
| POST | `/task-reports/:taskId/archive` | 리포트 아카이브 |
| GET | `/stats` | 사용량 통계 |

---

## 14. 설정 & 기타

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/settings` | 전체 설정 조회 |
| PUT | `/settings` | 설정 업데이트 |
| GET | `/worktrees` | 활성 워크트리 목록 |

---

## 15. WebSocket 이벤트

| 이벤트 | 배칭 | 설명 |
|--------|------|------|
| `connected` | - | 연결 성공, 버전 정보 |
| `task_update` | 즉시 | 태스크 상태/메타 변경 |
| `agent_status` | 즉시 | 에이전트 상태 변경 |
| `new_message` | 즉시 | 새 채팅 메시지 |
| `cli_output` | 250ms | CLI 실시간 출력 |
| `subtask_update` | 150ms | 서브태스크 상태 변경 |
| `cross_dept_delivery` | 즉시 | 부서간 태스크 전달 |
| `ceo_office_call` | 즉시 | 회의 시그널 |
| `chat_stream` | 즉시 | 스트리밍 채팅 컨텐츠 |
| `task_report` | 즉시 | 리포트 생성 |
