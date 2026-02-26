

# HAIFeR Agent

**코딩/개발 워크플로우 특화 AI 오케스트레이션**  
CEO 데스크에서 AI 에이전트 제국을 지휘하세요 — **CLI**, **OAuth**, **API 연동** 프로바이더(예: **Claude Code**, **Codex CLI**, **Gemini CLI**, **OpenCode**, **GitHub Copilot**, **Antigravity**)를 하나의 자율 에이전트 가상 회사로 운영하는 로컬 퍼스트 플랫폼



[빠른 시작](#빠른-시작) · [AI 설치 가이드](#ai-installation-guide) · [릴리즈 노트](release/v1.2.0.md) · [$ 디렉티브 (자체 구현)](#dollar-command-logic) · [주요 기능](#주요-기능) · [스크린샷](#스크린샷) · [기술 스택](#기술-스택) · [프로바이더](#cli-프로바이더-설정) · [보안](#보안)

[English](README.md) | **한국어**

> **프로젝트 정보**  
> HAIFeR Agent는 오픈소스 AI 오케스트레이션 프로젝트를 기반으로, 프로젝트별로 커스터마이징한 버전입니다. 원본 오픈소스의 라이선스(Apache 2.0) 및 기여 정책을 존중하며, 문서와 코드 내 브랜드·저장소 참조만 HAIFeR Agent로 통일했습니다. 진행 방안은 [docs/FORK_PROGRESS.md](docs/FORK_PROGRESS.md)를 참고하세요.

---

## HAIFeR Agent란?

HAIFeR Agent는 **코딩/개발 워크플로우에 특화된 AI 오케스트레이션** 플랫폼입니다. **CLI**, **OAuth**, **직접 API 키**로 연결된 AI 코딩 어시스턴트들을 하나의 **가상 소프트웨어 회사**로 묶어, 당신(CEO)이 지시하고 에이전트들이 코드·리포지토리·개발 태스크를 수행하게 합니다. 에이전트들의 부서 협업, 회의, 작업 완수 모습을 픽셀 아트 오피스로 확인할 수 있으며, **태스크 보드·터미널·diff·머지/디스카드**를 통해 개발 결과물을 바로 확인할 수 있습니다. (제품 방향성·리뉴얼 로드맵: [docs/RENEWAL_GUIDE.md](docs/RENEWAL_GUIDE.md))

### 왜 HAIFeR Agent인가?

- **코딩/개발 워크플로우 특화** — 프로젝트(경로) 단위로 작업을 관리하고, 버그 수정·기능 구현·리팩토링·PR 리뷰 같은 개발 태스크에 최적화
- **하나의 인터페이스, 다양한 AI 에이전트** — CLI/OAuth/API 기반 에이전트를 단일 대시보드에서 관리
- **코드 결과물 중심** — 터미널 로그, **diff 뷰**, 머지/디스카드 플로우를 웹에서 바로 확인. CLI로 지시, 웹으로 상태·리뷰·설정
- **로컬 퍼스트 & 프라이버시 보장** — 모든 데이터는 내 PC에. SQLite, 클라우드 의존성 없음
- **스킬 = 코딩 컨텍스트** — 프로젝트/스택별 규칙·가이드(Next.js 컨벤션, 테스트 규칙 등)를 스킬로 로드해 에이전트에게 전달

---

## AI로 설치하기

> **아래 내용을 AI 코딩 에이전트(Claude Code, Codex, Gemini CLI 등)에 붙여넣기만 하세요:**
>
> ```
> Install HAIFeR Agent following the guide at:
> <이 문서(README_ko.md)가 있는 저장소 루트 URL>
> ```
>
> AI가 이 README를 읽고 모든 것을 자동으로 처리합니다.

---

## 최신 릴리즈 (v1.2.0)

- **팀장 회의 전용 채널** — `receiver_type: team_leaders` 전용 채널로 팀장만 수신·응답. "팀장 회의 소집" 시 동일 채팅 UI에서 팀장 전용 컨텍스트로 열리며, 백엔드 `POST /api/announcements/team-leaders` 및 `scheduleTeamLeaderReplies`로 팀장만 응답하도록 구성됩니다.
- **도서관 (Library)** — 스킬 메뉴를 Library로 변경, 스킬 라이브러리 페이지·사이드바에 "도서관" 표기. 상단에 **사용법 및 가이드** 접이식 섹션을 추가해 필터·학습·업로드·등록 방법을 안내합니다.
- **대시보드 및 오피스 UI** — 대시보드 헤더/액션, HUD 접기 상태(`localStorage`), 랭킹/길드/분대 블록, 미션 로그 내비게이션, 부서 카드 클릭 시 오피스 뷰. 사이드바는 Building2 아이콘만 사용(CEO 이미지/왕관 없음).
- **OAuth 보안** — GitHub·Google OAuth 클라이언트 ID/시크릿을 **저장소에 포함하지 않음**. `.env`에 `OAUTH_GOOGLE_CLIENT_ID`, `OAUTH_GOOGLE_CLIENT_SECRET`, `OAUTH_GITHUB_CLIENT_ID`(및 선택적 시크릿)만 설정해 사용합니다.
- **에이전트/부서 CRUD, 스프라이트 #13, 커스텀 스킬 업로드, 모바일 프로젝트 매니저** 등 — 상세는 전체 노트를 참고하세요.
- 상세 문서: [release/v1.2.0.md](release/v1.2.0.md)

---

## 의사결정 인박스 추가 업데이트 (2026-02-22)

- **대표 의사결정 게이트 (라운드 진행)** — 리뷰 라운드는 Decision Inbox에서 대표가 명시적으로 의사결정해야만 다음 라운드로 넘어가며, 그전까지는 대기 상태를 유지합니다.
- **프로젝트 리뷰 시작 문구 정리** — 대표 선택 단계가 필요 없는 단일 활성 항목에서는 기존 요청 문구 대신 `팀장 회의 진행` 액션으로 일관되게 표시됩니다.
- **프로젝트 의사결정 취합 로딩 게이트** — 프로젝트 활성 항목이 모두 Review에 도달하면 먼저 `기획팀장 의견 취합중...` 상태를 표시하고, 취합 완료 전에는 선택지를 노출하지 않습니다.
- **리뷰 라운드1 + 라운드2 의사결정 게이트화** — 두 라운드 모두 `revision_requested` 시점에 의사결정 인박스에서 대기하며, 대표 결정 전 자동 라운드 전환이 발생하지 않습니다.
- **리뷰 의사결정 체리피킹(복수 선택) 지원** — 각 리뷰 의사결정 카드에서 팀장 의견을 여러 개 선택해 보완 작업을 한 번에 실행할 수 있습니다.
- **추가 의견 동시 반영** — 선택한 항목과 함께 추가 보완 의견을 직접 입력해 같은 보완 라운드에 함께 반영할 수 있습니다.
- **다음 라운드 SKIP 지원** — 라운드1 -> 2, 라운드2 -> 3으로 `다음 라운드로 SKIP`을 선택해 중복 신규 항목 생성 없이 흐름을 이어갈 수 있습니다.
- **취합 요약 가독성 + 선택지 가이드 강화** — 기획팀장 취합 요약 줄바꿈을 정리해 가독성을 높였고, 단일 항목 케이스에서는 요약 본문에 현재 선택 가능한 항목을 명시합니다.
- **프로젝트 의사결정 SQL 이력화** — 기획팀장 취합/대표 선택/추가요청/회의 시작 이벤트를 SQL 테이블에 기록하고, 프로젝트관리 `대표 선택사항` 영역에서 확인할 수 있습니다.
- **기획팀장 캐릭터 아이콘 일관성** — 의사결정 카드가 초기 로드/라이브 동기화에서도 기획팀장 메타데이터를 유지하도록 수정해 캐릭터 아이콘과 이모지가 번갈아 보이던 현상을 해결했습니다.
- **보고서 팝업 1회 노출로 정리** — 완료 직후 보고서 팝업을 띄우지 않고, 기획팀장 LLM 최종 취합 보고서 생성 시점에만 1회 노출되도록 변경했습니다.
- **태스크 숨김 상태 마이그레이션 (localStorage -> SQLite)** — 태스크 숨김/해제 상태를 브라우저 localStorage 대신 DB `hidden` 컬럼에 저장하도록 변경하여, 서버 재시작 시 숨김 ID가 삭제되는 버그를 해결했습니다. `PATCH /api/tasks/:id`에 hidden 필드 지원 추가 및 `POST /api/tasks/bulk-hide` 일괄 처리 엔드포인트를 추가했습니다.
- **보고서 이력 페이지네이션** — 보고서 이력 모달에 전체 목록 기준 5개 단위 페이지네이션(하단 이전/다음 컨트롤)을 추가했으며, 각 페이지 내 프로젝트 그룹별 서브 페이지네이션(그룹당 3개)도 유지됩니다.
- 추가 노트: `[docs/releases/v1.1.6.md](docs/releases/v1.1.6.md)`

---

## 스크린샷


|     |
| --- |
|     |


**대시보드** — 실시간 KPI 지표, 에이전트 랭킹, 부서 현황을 한눈에



**칸반 보드** — 부서 및 에이전트 필터가 적용된 드래그 앤 드롭 태스크 관리



**스킬 라이브러리** — 카테고리별로 분류된 600개 이상의 에이전트 스킬 탐색 및 배정



**멀티 프로바이더 CLI** — Claude Code, Codex, Gemini CLI, OpenCode를 모델 선택과 함께 설정



**OAuth 연동** — 암호화된 토큰 저장소가 적용된 안전한 GitHub & Google OAuth



**회의록** — 다중 라운드 검토 승인이 포함된 AI 생성 회의 요약



**외부 연동 (자체 구현)** — 웹 UI·REST API로 `$` CEO 디렉티브 전송 및 태스크 업데이트. 메신저(Telegram/Discord/Slack) 연동은 자체 웹훅/인박스 구현으로 확장 가능



**설정** — 회사명, CEO 이름, 기본 프로바이더 선호(CLI/OAuth/API), 언어 등 환경 설정



**상세 리포트** — 요청 완료 후 보고 팝업, 보고서 이력, 상세 리포트 확인 화면 예시



**PPT 생성 예시** — 보고 요청 기반 PPT 생성 결과 화면 예시



### PPT 샘플 소스

보고서 기반 PPT 생성 기능을 참고하거나 확장할 때 아래 샘플 소스를 활용할 수 있습니다.
사용 경로: **채팅창 > 보고 요청 버튼** 클릭 후 요청 내용을 입력하세요.

- 폴더: `[docs/reports/Sample_Slides](docs/reports/Sample_Slides)`
- 샘플 덱(`.pptx`): `[docs/reports/PPT_Sample.pptx](docs/reports/PPT_Sample.pptx)`
- HTML 슬라이드: `[slide-01.html](docs/reports/Sample_Slides/slide-01.html)`, `[slide-02.html](docs/reports/Sample_Slides/slide-02.html)`, `[slide-03.html](docs/reports/Sample_Slides/slide-03.html)`, `[slide-04.html](docs/reports/Sample_Slides/slide-04.html)`, `[slide-05.html](docs/reports/Sample_Slides/slide-05.html)`, `[slide-06.html](docs/reports/Sample_Slides/slide-06.html)`, `[slide-07.html](docs/reports/Sample_Slides/slide-07.html)`, `[slide-08.html](docs/reports/Sample_Slides/slide-08.html)`, `[slide-09.html](docs/reports/Sample_Slides/slide-09.html)`
- 빌드 스크립트: `[build-pptx.mjs](docs/reports/Sample_Slides/build-pptx.mjs)`, `[build-pptx.cjs](docs/reports/Sample_Slides/build-pptx.cjs)`, `[html2pptx.cjs](docs/reports/Sample_Slides/html2pptx.cjs)`

---

## 주요 기능

코딩/개발 워크플로우 특화 AI 오케스트레이션의 핵심 기능입니다.


| 기능                  | 설명                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| **칸반 태스크 보드**       | Inbox → Planned → In Progress → Review → Done. 개발 작업 단위(버그 수정, 기능 구현, 리팩토링 등)의 생애주기 관리, 드래그 앤 드롭                |
| **터미널 & diff**      | 에이전트 실행 로그 실시간 확인, 코드 변경 diff 뷰, 머지/디스카드로 브랜치 반영 여부 결정                                                          |
| **프로젝트/리포지토리 중심**   | 작업은 항상 프로젝트(경로)에 연결. 프로젝트 선택·브랜치·경로 검증을 플로우에 포함                                                                 |
| **픽셀 아트 오피스**       | 6개 부서에 걸쳐 에이전트들이 이동, 업무, 회의를 진행하는 애니메이션 오피스 뷰 (부가 시각화)                                                          |
| **CEO 채팅 & 디렉티브**   | 팀 리더와의 직접 소통; `$` 디렉티브에서 회의 여부와 작업 경로/컨텍스트(`project_path`, `project_context`) 기반 지시 지원                          |
| **멀티 프로바이더 지원**     | Claude Code, Codex CLI, Gemini CLI, OpenCode, Antigravity — 하나의 대시보드에서 모두 관리                                    |
| **외부 API 프로바이더**    | 설정 > API 탭에서 에이전트를 외부 LLM API(OpenAI, Anthropic, Google, Ollama, OpenRouter, Together, Groq, Cerebras, 커스텀)에 연결 |
| **OAuth 연동**        | 로컬 SQLite에 AES 암호화된 토큰 저장을 사용하는 GitHub & Google OAuth                                                           |
| **실시간 WebSocket**   | 실시간 상태 업데이트, 활동 피드, 에이전트 상태 동기화                                                                                 |
| **활성 에이전트 제어**      | 작업 중 에이전트 상태(프로세스/활동/유휴) 확인 및 멈춘 태스크 강제 중지                                                                      |
| **작업 보고서 시스템**      | 완료 팝업, 보고서 이력, 팀별 보고 드릴다운, 기획팀장 최종 취합 아카이브                                                                      |
| **에이전트 랭킹 & XP**    | 완료된 태스크로 XP를 획득하는 에이전트; 랭킹 보드에서 상위 성과자 추적                                                                       |
| **스킬 라이브러리**        | 프로젝트/스택별 코딩 가이드. 600개 이상 스킬(Frontend, Backend, Design, AI, DevOps, Security 등) 탐색·배정                            |
| **회의 시스템**          | AI 생성 회의록과 다중 라운드 검토가 포함된 계획 및 임시 회의                                                                            |
| **Git Worktree 격리** | 각 에이전트는 독립된 git 브랜치에서 작업하며 CEO 승인 시에만 병합                                                                        |
| **다국어 UI**          | 한국어, 영어, 일본어, 중국어 — 자동 감지 또는 수동 설정                                                                              |
| **외부 연동 (자체 구현)**   | 웹 UI·REST API로 `$` CEO 디렉티브 및 태스크 관리. 메신저 연동은 자체 인박스/웹훅 구현으로 확장 가능                                              |
| **PowerPoint 내보내기** | 회의록과 보고서로부터 프레젠테이션 슬라이드 생성                                                                                      |
| **통신 QA 스크립트**      | `test:comm:`* 스크립트로 CLI/OAuth/API 통신 상태를 재시도/증거 로그와 함께 검증                                                       |
| **인앱 업데이트 알림**      | GitHub 최신 릴리즈를 확인해 새 버전이 있으면 상단 배너로 OS별 `git pull` 안내와 릴리즈 노트 링크 제공                                             |
| **부서 관리**           | 기획, 개발, 디자인, QA/QC, DevSecOps, 운영                                                                               |


---

## 기술 스택


| 레이어          | 기술                                                  |
| ------------ | --------------------------------------------------- |
| **Frontend** | React 19 + Vite 7 + Tailwind CSS 4 + TypeScript 5.9 |
| **픽셀 아트 엔진** | PixiJS 8                                            |
| **Backend**  | Express 5 + SQLite (설정 없는 내장 DB)                    |
| **실시간 통신**   | WebSocket (ws)                                      |
| **유효성 검사**   | Zod 4                                               |
| **아이콘**      | Lucide React                                        |
| **라우팅**      | React Router 7                                      |
| **내보내기**     | PptxGenJS (PowerPoint 생성)                           |


## AI 설치 가이드

> 이 섹션은 AI 코딩 에이전트용입니다. 각 단계마다 검증 명령을 실행한 후 다음 단계로 진행하세요.

### 0단계: 사전 조건 확인

**Windows (PowerShell)** / **macOS·Linux** 공통:

```bash
# Node.js 22+
node -v

# pnpm (없다면 corepack 활성화)
pnpm -v
# 없으면: corepack enable

# Git
git --version
```

### 1단계: 클론 및 의존성 설치

저장소 URL은 본인 포크/조직 주소로 바꾸세요. 폴더명(`haiferagent`)은 클론된 디렉터리 이름에 맞게 사용하세요.

**Windows (PowerShell, 권장)**

```powershell
git clone https://github.com/<YOUR_ORG>/haiferagent.git
cd haiferagent
git submodule update --init --recursive
corepack enable
pnpm install
Copy-Item .env.example .env
# .env 내 OAUTH_ENCRYPTION_SECRET 등 시크릿 값 설정 (__CHANGE_ME__ 교체)
```

**macOS / Linux**

```bash
git clone https://github.com/<YOUR_ORG>/haiferagent.git
cd haiferagent
git submodule update --init --recursive
corepack enable
pnpm install
cp .env.example .env
# .env 내 OAUTH_ENCRYPTION_SECRET 등 시크릿 값 설정 (__CHANGE_ME__ 교체)
```

### 2단계: 셋업 결과 검증

**Windows (PowerShell)**

```powershell
if ((Test-Path .\.env) -and (Test-Path .\scripts\setup.mjs)) { "setup files ok" }
```

**macOS / Linux**

```bash
[ -f .env ] && [ -f scripts/setup.mjs ] && echo "setup files ok"
```

### 3단계: 실행 및 헬스체크

**Windows (PowerShell)** / **macOS·Linux**

```bash
pnpm dev:local
```

다른 터미널에서 API 헬스 확인:

```bash
# PowerShell (Windows)
Invoke-RestMethod -Uri http://127.0.0.1:8790/healthz

# curl 사용 가능 시
curl -s http://127.0.0.1:8790/healthz
```

예상 응답: `{"ok":true,...}`. 프론트엔드는 `http://127.0.0.1:8800` 에서 제공됩니다.

---

## 빠른 시작

**최소 실행:** Node.js 22+, pnpm, `.env`(시크릿 설정)만 있으면 `pnpm dev:local`로 실행 가능합니다. 외부 서비스(OpenClaw 등) 설치는 필요 없습니다.

### 사전 요구사항


| 도구          | 버전    | 설치                                  |
| ----------- | ----- | ----------------------------------- |
| **Node.js** | >= 22 | [nodejs.org](https://nodejs.org/)   |
| **pnpm**    | 최신    | `corepack enable` (Node.js에 내장)     |
| **Git**     | 무관    | [git-scm.com](https://git-scm.com/) |


### 셋업 (의존성 + .env)

저장소 URL의 `<YOUR_ORG>`는 본인 GitHub 사용자명 또는 조직으로 바꾸세요. 폴더명은 클론한 디렉터리 이름(`haiferagent` 등)에 맞게 사용하세요. **외부 의존(OpenClaw 등) 없이** 저장소만으로 실행합니다.


| 플랫폼                      | 명령어                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Windows (PowerShell)** | `git clone https://github.com/<YOUR_ORG>/haiferagent.git; cd haiferagent; git submodule update --init --recursive; corepack enable; pnpm install; Copy-Item .env.example .env`    |
| **macOS / Linux**        | `git clone https://github.com/<YOUR_ORG>/haiferagent.git && cd haiferagent && git submodule update --init --recursive && corepack enable && pnpm install && cp .env.example .env` |


이미 클론되어 있다면:


| 플랫폼                      | 명령어                                                       |
| ------------------------ | --------------------------------------------------------- |
| **Windows (PowerShell)** | `pnpm install` 후 `.env` 없으면 `Copy-Item .env.example .env` |
| **macOS / Linux**        | `pnpm install` 후 `.env` 없으면 `cp .env.example .env`        |


`.env`에서 `OAUTH_ENCRYPTION_SECRET` 등 `__CHANGE_ME__` 플레이스홀더를 실제 시크릿으로 교체한 뒤 `pnpm dev:local`로 실행하세요.

### 수동 셋업 (단계별)

**Windows (PowerShell)**

```powershell
# 1. 저장소 클론 (URL은 본인 저장소로 교체)
git clone https://github.com/<YOUR_ORG>/haiferagent.git
cd haiferagent

# 2. corepack으로 pnpm 활성화
corepack enable

# 3. 의존성 설치
pnpm install

# 4. 로컬 환경 파일 생성
Copy-Item .env.example .env

# 5. 무작위 암호화 시크릿 생성
node -e "const fs=require('fs');const crypto=require('crypto');const p='.env';const c=fs.readFileSync(p,'utf8');fs.writeFileSync(p,c.replace('__CHANGE_ME__',crypto.randomBytes(32).toString('hex')))"

# 6. (선택) AGENTS.md 오케스트레이션 규칙 설정 — Cursor 등 AI 에이전트에서 $ 디렉티브를 쓰려면 실행
pnpm setup -- --port 8790

# 7. 개발 서버 시작
pnpm dev:local
```



**macOS / Linux**

```bash
# 1. 저장소 클론 (URL은 본인 저장소로 교체)
git clone https://github.com/<YOUR_ORG>/haiferagent.git
cd haiferagent

# 2. corepack으로 pnpm 활성화
corepack enable

# 3. 의존성 설치
pnpm install

# 4. 로컬 환경 파일 생성
cp .env.example .env

# 5. 무작위 암호화 시크릿 생성
node -e "
  const fs = require('fs');
  const crypto = require('crypto');
  const p = '.env';
  const content = fs.readFileSync(p, 'utf8');
  fs.writeFileSync(p, content.replace('__CHANGE_ME__', crypto.randomBytes(32).toString('hex')));
"

# 6. (선택) AGENTS.md 오케스트레이션 규칙 설정 — Cursor 등 AI 에이전트에서 $ 디렉티브를 쓰려면 실행
pnpm setup -- --port 8790

# 7. 개발 서버 시작
pnpm dev:local
```



### AGENTS.md 설정 (선택)

Cursor·Claude Code 등 **AI 코딩 에이전트에서 `$` CEO 디렉티브**를 인식하게 하려면 `pnpm setup`을 실행하세요. 웹 UI만 쓴다면 생략해도 됩니다.

`pnpm setup`은 AI 에이전트의 `AGENTS.md`에 **CEO 디렉티브 오케스트레이션 규칙**을 주입합니다. 이를 통해:

- `$` 접두사 **CEO 디렉티브** 해석 및 우선순위 태스크 위임
- HAIFeR Agent REST API 호출로 태스크 생성, 에이전트 배정, 상태 보고
- 안전한 병렬 개발을 위한 독립 git worktree 환경에서 작업

```bash
# 기본: AGENTS.md 위치 자동 감지
pnpm setup

# 커스텀 경로
pnpm setup -- --agents-path /path/to/your/AGENTS.md

# 커스텀 포트
pnpm setup -- --port 8790
```



### `$` 디렉티브 (자체 구현)

채팅 메시지가 `$`로 시작하면 HAIFeR Agent는 **CEO 디렉티브**로 처리합니다. 외부 게이트웨이(OpenClaw) 없이 **웹 UI·REST API만으로** 동작합니다.

1. 웹 채팅 또는 자체 연동 클라이언트에서 `$` 접두사 메시지를 입력/전송합니다.
2. 오케스트레이터가 팀장 회의 진행 여부와 작업 프로젝트 경로·컨텍스트(`project_path`, `project_context`)를 확인합니다.
3. 서버는 이를 `directive`로 저장하고 전체 공지 후 기획팀(및 멘션된 부서)에 위임합니다.
4. 인박스/웹훅(메신저 연동)이 필요하면 프로젝트에서 **자체 API·웹훅 엔드포인트**를 구현해 연동하면 됩니다.

브라우저에서 접속:


| URL                             | 설명                 |
| ------------------------------- | ------------------ |
| `http://127.0.0.1:8800`         | 프론트엔드 (Vite 개발 서버) |
| `http://127.0.0.1:8790`         | 백엔드 API (Express)  |
| `http://127.0.0.1:8790/healthz` | API 헬스 체크          |


---

## 환경 변수

`.env.example`을 `.env`로 복사하세요. 모든 시크릿은 로컬에 저장됩니다 — `.env`는 절대 커밋하지 마세요.


| 변수                                     | 필수 여부  | 설명                                                                        |
| -------------------------------------- | ------ | ------------------------------------------------------------------------- |
| `OAUTH_ENCRYPTION_SECRET`              | **필수** | SQLite의 OAuth 토큰 암호화에 사용                                                  |
| `PORT`                                 | 선택     | 서버 포트 (기본값: `8790`)                                                       |
| `HOST`                                 | 선택     | 바인드 주소 (기본값: `127.0.0.1`)                                                 |
| `API_AUTH_TOKEN`                       | 권장     | 루프백 외부 API/WebSocket 접근용 Bearer 토큰                                        |
| `DB_PATH`                              | 선택     | SQLite 데이터베이스 경로 (기본값: `./haiferagent.sqlite`)                              |
| `LOGS_DIR`                             | 선택     | 로그 디렉토리 (기본값: `./logs`)                                                   |
| `OAUTH_GITHUB_CLIENT_ID`               | 선택     | GitHub OAuth 앱 클라이언트 ID                                                   |
| `OAUTH_GITHUB_CLIENT_SECRET`           | 선택     | GitHub OAuth 앱 클라이언트 시크릿                                                  |
| `OAUTH_GOOGLE_CLIENT_ID`               | 선택     | Google OAuth 클라이언트 ID                                                     |
| `OAUTH_GOOGLE_CLIENT_SECRET`           | 선택     | Google OAuth 클라이언트 시크릿                                                    |
| `OPENAI_API_KEY`                       | 선택     | OpenAI API 키 (Codex용)                                                     |
| `UPDATE_CHECK_ENABLED`                 | 선택     | 인앱 업데이트 확인 배너 활성화 (`1` 기본값, `0`이면 비활성화)                                   |
| `UPDATE_CHECK_REPO`                    | 선택     | 업데이트 확인에 사용할 GitHub 저장소 슬러그 (기본값: `<YOUR_ORG>/haiferagent`)                |
| `UPDATE_CHECK_TTL_MS`                  | 선택     | 업데이트 확인 캐시 TTL(밀리초) (기본값: `1800000`)                                      |
| `UPDATE_CHECK_TIMEOUT_MS`              | 선택     | GitHub 요청 타임아웃(밀리초) (기본값: `4000`)                                         |
| `AUTO_UPDATE_ENABLED`                  | 선택     | `settings.autoUpdateEnabled`가 없을 때 사용할 자동 업데이트 기본값 (`0` 기본값)              |
| `AUTO_UPDATE_CHANNEL`                  | 선택     | 허용 업데이트 채널: `patch`(기본), `minor`, `all`                                   |
| `AUTO_UPDATE_IDLE_ONLY`                | 선택     | `in_progress` 태스크/활성 CLI 프로세스가 없을 때만 적용 (`1` 기본값)                         |
| `AUTO_UPDATE_CHECK_INTERVAL_MS`        | 선택     | 자동 업데이트 확인 주기(밀리초) (기본값: `UPDATE_CHECK_TTL_MS` 따름)                        |
| `AUTO_UPDATE_INITIAL_DELAY_MS`         | 선택     | 서버 시작 후 첫 자동 업데이트 확인까지 대기 시간(밀리초) (기본값 `60000`, 최소 `60000`)               |
| `AUTO_UPDATE_TARGET_BRANCH`            | 선택     | 브랜치 가드 및 `git fetch/pull` 대상으로 사용할 브랜치명 (기본값 `main`)                      |
| `AUTO_UPDATE_GIT_FETCH_TIMEOUT_MS`     | 선택     | 업데이트 적용 중 `git fetch` 타임아웃(밀리초) (기본값 `120000`)                            |
| `AUTO_UPDATE_GIT_PULL_TIMEOUT_MS`      | 선택     | 업데이트 적용 중 `git pull --ff-only` 타임아웃(밀리초) (기본값 `180000`)                   |
| `AUTO_UPDATE_INSTALL_TIMEOUT_MS`       | 선택     | 업데이트 적용 중 `pnpm install --frozen-lockfile` 타임아웃(밀리초) (기본값 `300000`)       |
| `AUTO_UPDATE_COMMAND_OUTPUT_MAX_CHARS` | 선택     | stdout/stderr 캡처 시 메모리에 유지할 최대 문자 수(초과분은 tail 유지, 기본값 `200000`)           |
| `AUTO_UPDATE_TOTAL_TIMEOUT_MS`         | 선택     | 1회 업데이트 적용 전체 타임아웃 상한(밀리초) (기본값 `900000`)                                 |
| `AUTO_UPDATE_RESTART_MODE`             | 선택     | 자동 적용 후 재시작 정책: `notify`(기본), `exit`, `command`                           |
| `AUTO_UPDATE_EXIT_DELAY_MS`            | 선택     | `exit` 모드에서 프로세스 종료 전 대기 시간(밀리초) (기본값 `10000`, 최소 `1200`)                 |
| `AUTO_UPDATE_RESTART_COMMAND`          | 선택     | 재시작 정책이 `command`일 때 실행할 실행파일+인자 형식 명령(셸 메타문자 + 셸 실행기 직접 호출 거부, 서버 권한 실행) |


`API_AUTH_TOKEN`을 활성화하면 원격 브라우저 클라이언트는 런타임에 토큰을 입력합니다. 토큰은 `sessionStorage`에만 저장되며 Vite 빌드 산출물에는 포함되지 않습니다.

---

## 실행 모드

```bash
# 개발 (로컬 전용, 권장)
pnpm dev:local          # 127.0.0.1에 바인딩

# 개발 (네트워크 접근 가능)
pnpm dev                # 0.0.0.0에 바인딩

# 프로덕션 빌드
pnpm build              # TypeScript 검사 + Vite 빌드
pnpm start              # 빌드된 서버 실행

# 헬스 체크
curl -fsS http://127.0.0.1:8790/healthz
```

### 통신 QA 점검 (v1.1.6)

```bash
# 개별 점검
pnpm run test:comm:llm
pnpm run test:comm:oauth
pnpm run test:comm:api

# 통합 점검 (레거시 진입점 포함)
pnpm run test:comm:suite
pnpm run test:comm-status
```

`test:comm:suite`는 기계 판독용 증거를 `logs/`에, 요약 리포트를 `docs/`에 생성합니다.

### 프로젝트 경로 QA 스모크 (v1.1.6)

```bash
# API 인증 토큰 필요
QA_API_AUTH_TOKEN="<API_AUTH_TOKEN>" pnpm run test:qa:project-path
```

`test:qa:project-path`는 경로 보조 API, 프로젝트 생성 흐름, 중복 `project_path` 충돌 응답, 정리(cleanup) 동작을 점검합니다.

### 인앱 업데이트 배너

GitHub에 더 최신 릴리즈가 게시되면, HAIFeR Agent는 UI 상단에 pull 안내와 릴리즈 노트 링크를 포함한 배너를 표시합니다.

- Windows PowerShell: `git pull; pnpm install`
- macOS/Linux 셸: `git pull && pnpm install`
- pull/install 후 서버를 재시작하세요.

### 자동 업데이트 (안전 모드, 옵트인)

릴리즈 동기화를 자동화하려면 보수적 안전 모드 자동 업데이트를 활성화할 수 있습니다.

- `GET /api/update-auto-status` — 자동 업데이트 런타임/설정 상태 조회 (**인증 필요**)
- `POST /api/update-auto-config` — 서버 재시작 없이 자동 업데이트 런타임 토글(`enabled`) 변경 (**인증 필요**)
- `POST /api/update-apply` — 온디맨드 업데이트 파이프라인 실행 (`dry_run` / `force` / `force_confirm` 지원, **인증 필요**)
  - `force=true`는 대부분의 안전 가드를 우회하므로 반드시 `force_confirm=true`를 함께 전달해야 합니다.
  - 단, `dirty_worktree`, `channel_check_unavailable` 가드는 우회되지 않으며 항상 적용이 차단됩니다.
  - 재시작 정책(`notify|exit|command`)은 자동 실행/수동 실행 모두에 동일하게 적용됩니다.
  - `notify` 모드에서는 성공 시 `manual_restart_required` 사유가 결과에 포함됩니다.

기본 동작은 기존과 동일하게 **비활성화(OFF)** 이며, 활성화 시 서버가 바쁘거나 저장소가 fast-forward 가능한 깨끗한 상태가 아니면 자동 적용을 건너뜁니다.
`AUTO_UPDATE_CHANNEL` 값이 잘못되면 경고 로그를 남기고 `patch`로 자동 폴백합니다.

#### 트러블슈팅: `git_pull_failed` / 브랜치 분기(diverged)

적용 결과에 `error: "git_pull_failed"`(또는 `git_fetch_failed`)와 함께 `manual_recovery_may_be_required`가 포함되면 저장소 상태를 운영자가 점검해야 합니다.

1. `GET /api/update-auto-status`의 `runtime.last_result`, `runtime.last_error`를 확인합니다.
2. 서버 저장소에서 분기 상태를 점검합니다.
  - `git fetch origin main`
  - `git status`
  - `git log --oneline --decorate --graph --max-count 20 --all`
3. 팀 운영 정책에 맞게 fast-forward 가능한 깨끗한 상태로 복구합니다(예: 로컬 커밋 rebase 또는 `origin/main` 기준으로 reset).
4. `POST /api/update-apply`를 다시 실행합니다(필요하면 `{"dry_run": true}`로 사전 점검).

자동 업데이트 루프는 설정된 주기대로 계속 동작하며, 저장소가 안전 상태로 돌아오면 다음 주기에서 다시 적용을 시도합니다.

⚠️ `AUTO_UPDATE_RESTART_COMMAND`는 서버 권한으로 실행되는 고권한 기능입니다.
명령 파서는 셸 메타문자(`;`, `|`, `&`, ```, `$`, `<`, `>`)를 거부하고, `sh`/`bash`/`zsh`/`cmd`/`powershell`/`pwsh` 같은 셸 실행기 직접 호출도 차단합니다.
셸/인터프리터 래퍼 없이, 고정된 실행 파일 + 인자 형태로만 설정하세요(동적 입력 조합 금지).

---



## 프로바이더 설정 (CLI / OAuth / API)

HAIFeR Agent는 아래 3가지 방식의 프로바이더를 지원합니다:

- **CLI 도구** — 로컬 CLI 설치 후 프로세스 기반으로 실행
- **OAuth 계정** — 지원 프로바이더를 보안 토큰 교환으로 연결
- **직접 API 키** — **Settings > API** 탭에서 외부 LLM API 직접 연결

CLI 모드로 사용하려면 최소 하나 이상 설치하세요:


| 프로바이더                                                         | 설치                                   | 인증                          |
| ------------------------------------------------------------- | ------------------------------------ | --------------------------- |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | `npm i -g @anthropic-ai/claude-code` | `claude` (안내에 따라 진행)        |
| [Codex CLI](https://github.com/openai/codex)                  | `npm i -g @openai/codex`             | `.env`에 `OPENAI_API_KEY` 설정 |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli)     | `npm i -g @google/gemini-cli`        | 설정 패널에서 OAuth 인증            |
| [OpenCode](https://github.com/opencode-ai/opencode)           | `npm i -g opencode`                  | 프로바이더별 설정                   |


앱 내 **Settings > CLI Tools** 패널에서 프로바이더와 모델을 설정하세요.

또는 CLI 설치 없이 **Settings > API** 탭에서 에이전트를 외부 LLM API에 연결할 수 있습니다. API 키는 로컬 SQLite 데이터베이스에 암호화(AES-256-GCM)되어 저장됩니다 — `.env`나 소스 코드에는 포함되지 않습니다.
스킬 학습/해제 자동화는 현재 CLI 연동 프로바이더를 기준으로 동작합니다.

---

## 프로젝트 구조

아래 구조는 실제 디렉터리와 일치합니다. **단일 파일 300줄 이하** 등 코딩 규칙에 맞춘 리팩토링 계획은 [docs/REFACTOR_PLAN.md](docs/REFACTOR_PLAN.md)를 참고하세요.

```
haiferagent/
├── server/                      # Express 5 + SQLite + WebSocket 백엔드
│   ├── index.ts                 # 서버 진입점
│   ├── server-main.ts           # 라우트·DB·WS 초기화
│   ├── config/
│   │   └── runtime.ts           # PORT, HOST, .env 로드
│   ├── db/
│   │   └── runtime.ts           # SQLite 연결
│   ├── gateway/
│   │   └── client.ts            # 외부 연동 스텁 (자체 구현 시 교체)
│   ├── oauth/
│   │   └── helpers.ts           # OAuth 암호화·PKCE
│   ├── security/
│   │   └── auth.ts              # 인증·CORS
│   ├── ws/
│   │   └── hub.ts               # WebSocket 허브
│   ├── types/
│   │   ├── lang.ts
│   │   └── runtime-context.ts
│   ├── modules/
│   │   ├── routes.ts            # 라우트 등록
│   │   ├── routes/
│   │   │   ├── core.ts          # 부서·에이전트·태스크·OAuth 등
│   │   │   ├── collab.ts        # 협업·CLI·디렉티브
│   │   │   ├── collab/coordination.ts
│   │   │   ├── ops.ts           # KPI·메시지
│   │   │   └── ops/messages.ts  # 인박스·의사결정·메시지 API
│   │   ├── workflow/            # 위임·회의·오케스트레이션
│   │   ├── lifecycle.ts         # 워치독·복구
│   │   └── deferred-runtime.ts
│   └── test/
├── src/                         # React 19 + Vite 프론트엔드
│   ├── main.tsx
│   ├── App.tsx                  # React Router 메인 앱
│   ├── api.ts                   # Frontend API 클라이언트
│   ├── i18n.ts                  # 다국어 (en/ko/ja/zh)
│   ├── index.css
│   ├── ThemeContext.tsx
│   ├── types/
│   │   └── index.ts
│   ├── hooks/
│   │   ├── usePolling.ts
│   │   └── useWebSocket.ts
│   ├── components/
│   │   ├── OfficeView.tsx        # PixiJS 픽셀 아트 오피스
│   │   ├── OfficeRoomManager.tsx
│   │   ├── Dashboard.tsx        # KPI·차트
│   │   ├── TaskBoard.tsx        # 칸반 태스크 보드
│   │   ├── ChatPanel.tsx        # CEO-에이전트 채팅
│   │   ├── SettingsPanel.tsx    # 회사·CLI·API·OAuth 설정
│   │   ├── SkillsLibrary.tsx    # 스킬 라이브러리
│   │   ├── TerminalPanel.tsx    # 실시간 실행 로그
│   │   ├── DecisionInboxModal.tsx # 의사결정 인박스
│   │   ├── chat/                # decision-inbox, decision-request
│   │   └── … (AgentDetail, Sidebar, ReportHistory 등)
│   └── test/
├── public/                      # 정적 자산
│   ├── sprites/                 # 픽셀 아트 에이전트 스프라이트
│   └── *.svg, *.png
├── scripts/
│   ├── setup.mjs                # AGENTS.md 오케스트레이션 규칙 주입 (선택)
│   ├── auto-apply-v1.0.5.mjs    # .env·AGENTS 1회 마이그레이션
│   ├── generate-architecture-report.mjs
│   ├── generate-intro-ppt.mjs   # PPT 샘플 생성
│   ├── preflight-public.sh      # 릴리즈 전 보안 검사
│   ├── verify-security-audit-log.mjs
│   ├── test-comm-status.mjs
│   └── qa/                      # 통신·오피스·경로 QA 스크립트
├── docs/
│   ├── architecture/           # 아키텍처·의존성·소스 트리
│   ├── releases/               # 릴리즈 노트
│   ├── reports/                # PPT 샘플·슬라이드
│   ├── DESIGN.md, RENEWAL_GUIDE.md 등
├── templates/
│   └── AGENTS-empire.md        # 오케스트레이션 규칙 템플릿
├── tests/
│   └── e2e/                    # Playwright E2E
├── index.html
├── vite.config.ts
├── tsconfig.json, tsconfig.app.json, tsconfig.node.json
├── vitest.config.ts, playwright.config.ts
├── .env.example
├── install.sh, install.ps1
└── package.json
```

---

## 보안

HAIFeR Agent는 보안을 최우선으로 설계되었습니다:

- **로컬 퍼스트 아키텍처** — 모든 데이터는 SQLite에 로컬로 저장; 외부 클라우드 서비스 불필요
- **암호화된 OAuth 토큰** — 사용자 OAuth 토큰은 **서버 측 SQLite에만 저장**되며, `OAUTH_ENCRYPTION_SECRET`을 사용해 AES-256-GCM으로 암호화됩니다. 브라우저에는 리프레시 토큰이 전달되지 않습니다
- **OAuth는 환경 변수만 사용** — GitHub·Google OAuth 클라이언트 ID/시크릿은 **저장소에 포함되지 않습니다**. `.env`에 `OAUTH_GOOGLE_CLIENT_ID`, `OAUTH_GOOGLE_CLIENT_SECRET`, `OAUTH_GITHUB_CLIENT_ID`(및 선택적 `OAUTH_GITHUB_CLIENT_SECRET`)를 설정해 OAuth를 활성화하세요. 코드·저장소에는 자격증명을 두지 않습니다
- **소스 코드에 개인 자격증명 없음** — 모든 사용자별 토큰(GitHub, Google OAuth)은 로컬 SQLite에 암호화되어 저장되며, 소스 코드에는 포함되지 않습니다
- **저장소에 시크릿 없음** — 포괄적인 `.gitignore`로 `.env`, `*.pem`, `*.key`, `credentials.json` 등 차단
- **프리플라이트 보안 검사** — 공개 릴리즈 전 `pnpm run preflight:public` 실행으로 작업 트리와 git 히스토리의 유출된 시크릿 스캔
- **기본값은 localhost** — 개발 서버는 `127.0.0.1`에 바인딩되어 네트워크에 노출되지 않음

---

## 기여하기

기여를 환영합니다! 다음 절차를 따라주세요:

1. 저장소를 포크합니다
2. 기능 브랜치를 생성합니다 (`git checkout -b feature/amazing-feature`)
3. 변경 사항을 커밋합니다 (`git commit -m 'Add amazing feature'`)
4. 브랜치에 푸시합니다 (`git push origin feature/amazing-feature`)
5. Pull Request는 기본적으로 `dev` 브랜치로 엽니다 (외부 기여 통합 브랜치)
6. `main`은 유지보수자 승인 긴급 핫픽스에만 사용하고, 이후 `main -> dev` 역병합을 수행합니다

상세 정책: `[CONTRIBUTING.md](CONTRIBUTING.md)`

---

## 라이선스

[Apache 2.0](LICENSE) — 개인 및 상업적 사용 모두 무료.

---



**픽셀과 열정으로 만들었습니다.**

*HAIFeR Agent — AI 에이전트들이 일하러 오는 곳.*

