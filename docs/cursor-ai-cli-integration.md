# Cursor AI CLI 연동 가이드

> 작성일: 2026-02-27

## 개요

Cursor AI는 VS Code 기반의 AI 코드 에디터이며, CLI 도구(`agent`)를 별도로 제공합니다.
Claude Code CLI와 함께 사용하여 생산성을 극대화할 수 있습니다.

---

## 1. Cursor CLI (`agent` 명령어)

Cursor는 터미널에서 직접 실행 가능한 AI 코딩 에이전트를 제공합니다.

### 설치

**Windows (PowerShell):**
```powershell
irm 'https://cursor.com/install?win32=true' | iex
```

**macOS / Linux / WSL:**
```bash
curl https://cursor.com/install -fsS | bash
```

설치 후 확인:
```bash
agent --version
```

> Cursor 구독이 필요합니다.

### 주요 명령어

| 명령어 | 설명 |
|--------|------|
| `agent` | 대화형 AI 세션 시작 |
| `agent "프롬프트"` | 초기 지시와 함께 시작 |
| `agent ls` | 이전 대화 목록 |
| `agent resume` | 마지막 대화 재개 |
| `agent --continue` | 이전 세션 이어서 진행 |
| `agent --resume="chat-id"` | 특정 대화 재개 |
| `agent --mode plan` | Plan 모드 (설계 후 코딩) |
| `agent --mode ask` | Ask 모드 (읽기 전용 탐색) |

### 비대화형 실행 (스크립팅/CI)

```bash
agent -p "auth 모듈 리팩터링" --model "gpt-5.2" --output-format text
```

### 클라우드 에이전트

`&`를 메시지 앞에 붙이거나 `-c` / `--cloud` 플래그로 클라우드에서 백그라운드 실행:
```bash
agent -c "전체 테스트 스위트 실행 후 결과 정리"
```

---

## 2. Cursor 에디터 셸 명령어

에디터를 터미널에서 여는 명령어 (VS Code의 `code`와 동일):

```bash
# 설치: Ctrl+Shift+P > "Install 'cursor' to shell"
cursor file.js           # 파일 열기
cursor path/to/folder/   # 폴더 열기
cursor -n .              # 새 창으로 열기
cursor -w file.js        # 창 닫힐 때까지 대기
```

---

## 3. Claude Code CLI + Cursor 연동 방법

### 방법 A: Cursor 터미널에서 Claude Code 실행

Cursor는 VS Code 포크이므로, 내장 터미널에서 `claude` 명령어를 바로 실행할 수 있습니다.

```
Cursor 에디터 > 터미널 열기 (Ctrl+`) > claude 입력
```

- Cursor의 IDE 기능(탭 완성, 인라인 편집, Cmd+K)과
- Claude Code의 자율 터미널 에이전트를 동시에 활용

### 방법 B: Claude Code VS Code 확장 설치

Claude Code의 VS Code 확장은 Cursor에서도 호환됩니다.

1. Cursor에서 확장(Extensions) 패널 열기
2. "Claude Code" 검색 후 설치
3. 사이드 패널에서 Claude Code 사용

### 방법 C: 듀얼 도구 워크플로우 (권장)

| 도구 | 적합한 작업 |
|------|------------|
| **Cursor** | 탐색적 코딩, 빠른 편집, 실시간 탭 완성, 인라인 페어 프로그래밍 |
| **Claude Code** | 대규모 멀티파일 리팩터링, 자율 테스트 생성, 문서화, 프레임워크 업그레이드 |

> 실무에서 가장 생산적인 조합으로 보고되고 있습니다.

---

## 4. Cursor Cloud Agents API

프로그래밍 방식으로 Cursor 에이전트를 제어하는 REST API:

| 엔드포인트 | 설명 |
|-----------|------|
| `POST /v0/agents` | 새 클라우드 에이전트 생성 |
| `GET /v0/agents/{id}` | 에이전트 상태 확인 |
| `POST /v0/agents/{id}/followup` | 후속 지시 추가 |
| `GET /v0/agents/{id}/conversation` | 대화 기록 조회 |
| `GET /v0/models` | 사용 가능한 모델 목록 |

인증: Cursor Dashboard에서 발급한 API 키로 Basic Auth.

### 예시: API로 에이전트 실행

```bash
curl -X POST https://api.cursor.com/v0/agents \
  -H "Authorization: Basic $(echo -n ':YOUR_API_KEY' | base64)" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "src/auth 모듈의 보안 취약점 검토",
    "model": "gpt-5.2"
  }'
```

---

## 5. MCP (Model Context Protocol) 공유

Cursor와 Claude Code 모두 MCP 서버를 지원합니다.
동일한 MCP 서버에 연결하면 도구 간 컨텍스트 공유가 가능합니다.

> 단, Cursor Cloud Agents API에서는 아직 MCP 미지원.

---

## 6. Git/CI 연동

Cursor CLI를 Git hook이나 CI 파이프라인에 통합:

```bash
# .git/hooks/pre-commit 예시
agent -p "이 변경사항의 보안 이슈를 검토해줘" --output-format text
```

---

## 요약 비교

| 방법 | 설명 | 용도 |
|------|------|------|
| `cursor` 셸 명령 | 에디터에서 파일/폴더 열기 | 빠른 파일 접근 |
| `agent` CLI | 터미널 AI 코딩 에이전트 | 터미널 우선 작업 |
| `agent -p` (비대화형) | 스크립트/자동화 실행 | CI/CD, 배치 작업 |
| `agent --cloud` | 클라우드 에이전트 핸드오프 | 장시간 백그라운드 작업 |
| Cloud Agents API | HTTP REST API | 커스텀 도구, 대시보드 |
| Cursor 터미널에서 `claude` | Claude Code를 Cursor 안에서 실행 | 듀얼 도구 워크플로우 |
| Claude Code 확장 | Cursor에 Claude Code 확장 설치 | 사이드 패널 AI 어시스턴트 |
| MCP 서버 | 도구 간 컨텍스트 공유 | 크로스 도구 데이터 공유 |

---

## 참고 문서

- [Cursor CLI 개요](https://cursor.com/docs/cli/overview)
- [Cursor CLI 설치](https://cursor.com/docs/cli/installation)
- [Cursor 셸 명령어](https://cursor.com/docs/configuration/shell)
- [Cursor Cloud Agents API](https://cursor.com/docs/cloud-agent/api/endpoints)
- [Cursor CLI 블로그](https://cursor.com/blog/cli)
- [Claude Code in VS Code/Cursor](https://code.claude.com/docs/en/vs-code)
