# "우리의 철학" PPT — 슬라이드별 카피 원고

> **작성**: 피터 틸 (기획팀)
> **기준**: PPT_PHILOSOPHY_EXEC_PLAN.md
> **디자인 시스템**: 다크 테마 #0f0f0f, Pretendard, 960×540pt, 액센트 #FF6347

---

## Slide 01 — 표지

**상단 로고바**
- 로고 + "Claw Empire" | 우측: "OPEN SOURCE"

**메인 타이틀**
- 서브헤더(액센트): `OUR PHILOSOPHY`
- 타이틀(80pt, 화이트): `Claw Empire`
- 서브타이틀(18pt, 그레이): `Coding-Specialized AI Agent Orchestration`

**푸터**
- Version: v1.1.9 | License: Apache 2.0 | Repository: github.com/claw-empire

---

## Slide 02 — Contents

**좌측**: "Our Philosophy" (56pt, 화이트)

**우측 목차** (번호 뱃지 #FF6347):
1. Why We Built This
2. Code Is the Outcome
3. Your Data, Your Machine
4. Command in Developer's Language
5. How It Works
6. Get Started

---

## Slide 03 — Why We Built This

**헤더**: `[01]` Why We Built This

**좌측 텍스트**:
> "AI coding tools are everywhere.
> But orchestration — managing multiple agents
> across real codebases — doesn't exist yet."

**우측 3-카드** (배경 #1a1a1a):

| 카드 | 라벨(액센트) | 본문 |
|------|-------------|------|
| 1 | ONE-SHOT | Existing tools run one prompt at a time. No persistent workflow. |
| 2 | CLOUD-LOCKED | Your code goes to someone else's server. No data sovereignty. |
| 3 | BLACK BOX | You can't see what changed. No diff, no log, no audit trail. |

---

## Slide 04 — Code Is the Outcome (핵심 메시지 M1)

**헤더**: `[02]` Code Is the Outcome

**좌측 텍스트**:
- 헤드카피(32pt, 액센트): `Every task produces`
- 헤드카피(32pt, 화이트): `a visible diff.`
- 본문(14pt, 그레이):
  "No black boxes. Every agent action generates terminal logs, code diffs, and artifacts you can inspect, merge, or discard — right from the dashboard."

**우측**: diff 뷰 목업 이미지
- 파일명: `src/api/tasks.ts`
- 녹색 라인(추가), 빨간 라인(삭제)
- 하단 버튼: `[Merge]` `[Discard]` `[View Full]`

---

## Slide 05 — Your Data, Your Machine (핵심 메시지 M2)

**헤더**: `[03]` Your Data, Your Machine

**중앙 다이어그램** (수평 플로우):
```
[Your PC] → [SQLite DB] → [AI Agents] → [Code Output]
     ↑                                        ↓
     └──────── Everything stays here ──────────┘
```

**하단 3-카드**:

| 카드 | 라벨(액센트) | 본문 |
|------|-------------|------|
| 1 | LOCAL | All data on your machine. SQLite, not cloud. |
| 2 | PRIVATE | Zero telemetry. No data leaves your PC. |
| 3 | YOURS | Full control. Export, backup, delete anytime. |

---

## Slide 06 — Command in Developer's Language (핵심 메시지 M3)

**헤더**: `[04]` Command in Developer's Language

**좌측: CLI 코드블록** (모노스페이스, 배경 #1a1a1a):
```
$ claw task create --type "refactor"
  --project ./my-app
  --agent senior-dev
  --prompt "Split api.ts into domain modules"

✓ Task #42 created → assigned to senior-dev
✓ Agent running on branch: refactor/api-split
```

**우측: 웹 대시보드 스크린샷**
- 태스크 보드 (Inbox → Planned → In Progress → Review → Done)
- 하단 텍스트(14pt, 그레이):
  "Instruct from terminal. Monitor from web. Your workflow stays intact."

---

## Slide 07 — How It Works

**헤더**: `[05]` How It Works

**수평 타임라인** (5단계, 각 단계 아이콘 + 라벨):

```
 Inbox  →  Planned  →  In Progress  →  Review  →  Done
  📥         📋           ⚙️            🔍         ✅
 CEO가     회의로      에이전트가     diff 확인    머지
 지시 등록  계획 확정   코드 작성      & 코드 리뷰  완료
```

**하단 보충**:
"Every stage is visible. Every output is a diff. Every decision is yours."

---

## Slide 08 — Architecture & Tech Stack

**헤더**: `[06]` Architecture & Tech Stack

**기술 스택 그리드** (2×3, 각 셀 아이콘 + 이름 + 한줄 설명):

| | Col 1 | Col 2 | Col 3 |
|---|-------|-------|-------|
| **Row 1** | **Vite** — Instant dev server & build | **Express** — API-first backend | **PixiJS 8** — Pixel-art office view |
| **Row 2** | **SQLite** — Local-first data store | **6 AI Providers** — Claude, Codex, Gemini, Grok, DeepSeek, Local | **Skills/Plugins** — Project-specific coding rules |

---

## Slide 09 — Office View

**풀스크린 레이아웃** — 오피스뷰 스크린샷이 전체 배경

**오버레이 텍스트** (하단 좌측, 반투명 배경):
- 헤드카피(28pt, 화이트): `See your agents work.`
- 본문(14pt, 그레이): `Pixel-art office simulation. Each agent has a desk, status, and visible task progress.`

---

## Slide 10 — Get Started

**중앙 정렬 CTA**:

**헤드카피(42pt, 화이트)**:
`Build Your Empire.`

**설치 명령어** (모노스페이스, 배경 #1a1a1a):
```
git clone https://github.com/claw-empire/claw-empire.git
cd claw-empire && npm install
npm run dev
```

**CTA 버튼** (액센트 배경):
`★ Star on GitHub`

**푸터**:
- Apache 2.0 | Open Source | Contributions Welcome
- "Local-first. Developer-first. Your empire, your rules."

---

## 디자인팀 전달 메모

1. **모든 슬라이드**는 기존 Sample_Slides 디자인 시스템 준수 (다크 #0f0f0f, 카드 #1a1a1a, 액센트 #FF6347, Pretendard)
2. **Slide 04**: diff 뷰 목업은 실제 프로젝트 코드 기반으로 제작 요청
3. **Slide 06**: CLI 코드블록은 실제 동작 가능한 명령어 형식 (claw CLI)
4. **Slide 09**: 오피스뷰 스크린샷은 다크 모드 기준, 에이전트 3-4명이 보이는 장면
5. **스크린샷 없을 시**: placeholder + `[SCREENSHOT PENDING]` 태그 삽입, 후속 교체
