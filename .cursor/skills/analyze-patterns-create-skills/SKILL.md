---
name: analyze-patterns-create-skills
description: Analyzes development patterns in codebases, configs, and workflows and produces Cursor Agent Skills (SKILL.md). Use when the user wants to create skills from existing patterns, document team conventions as skills, or derive skills from code/rule analysis.
---

# 개발 패턴 분석 → 스킬 생성

코드베이스·설정·워크플로우에서 **개발 패턴**을 추출하고, Cursor Agent Skill(SKILL.md) 형식으로 정리할 때 이 스킬을 적용한다.

## 사용 시점

- "개발 패턴 분석해서 스킬 만들어줘", "이 프로젝트 패턴으로 스킬 만들어줘"
- 팀 컨벤션·코딩 규칙을 스킬로 남기고 싶을 때
- 기존 규칙 파일(.mdc, README, docs)을 스킬로 변환할 때
- 반복되는 작업 흐름을 스킬로 문서화할 때

## 1단계: 패턴 수집

다음 소스를 순서대로 살펴본다.

| 소스 | 확인할 내용 |
|------|-------------|
| `.cursor/rules/*.mdc` | 네이밍, 구조, 검증, 보안 등 규칙 |
| `README.md`, `docs/` | 프로젝트 구조, 실행 방법, 컨벤션 |
| `*.config.js`, `tsconfig`, `pyproject.toml` | 도구/언어별 설정 패턴 |
| 대표 서비스/API/컴포넌트 코드 | 디렉터리 구조, 네이밍, 에러 처리, 로깅 |
| 기존 스킬 `~/.cursor/skills-cursor/create-skill/SKILL.md` | 스킬 작성 형식(프론트매터, 설명, 단계) |

- **규칙**: "무조건 ~한다", "~하지 않는다", "~할 때는 ~한다" 같은 문장을 추출한다.
- **워크플로우**: "먼저 A → 그 다음 B → 검증 C" 같은 단계를 정리한다.
- **예시**: 코드 스니펫, 커밋/메시지 형식, 템플릿이 있으면 그대로 수집한다.

## 2단계: 스킬 범위와 이름 정하기

- **한 스킬 = 한 목적**. "코드 품질 + API + 배포"를 한 스킬에 넣지 말고, 목적별로 나눈다.
- **이름**: 소문자, 하이픈, 64자 이내. 동사/목적이 드러나게 (예: `fastapi-routes`, `react-form-validation`).
- **설명(description)**:
  - 3인칭으로 작성. "~한다 / ~할 때 사용한다" 형태.
  - **무엇을(WHAT)** 하는지 + **언제(WHEN)** 적용할지 포함.
  - 트리거가 될 키워드 포함 (예: FastAPI, 라우트 추가, Pydantic, 스키마).

## 3단계: SKILL.md 골격 작성

create-skill 규칙에 맞춘 최소 골격:

```markdown
---
name: <kebab-case-name>
description: <한 줄: 무엇을 하는지 + "Use when ..." 트리거>
---

# <표제>

## Instructions
(필수 단계만. 300줄 이하 권장)

## Examples
(입력/출력 또는 코드 예시 1~2개)
```

- **Instructions**: "~할 때 다음을 따른다" 형태로, 체크리스트·단계·조건 분기 가능.
- **Examples**: 실제 코드/메시지 예시가 있으면 품질이 올라감. 추상적 설명보다 구체 예 1~2개.
- **진행적 공개**: 자세한 내용은 `reference.md` 등 별도 파일로 두고 SKILL.md에서는 한 단계만 링크.

## 4단계: 패턴 → 지문 변환 규칙

수집한 패턴을 스킬 문장으로 바꿀 때:

- **금지/필수 규칙** → "반드시 ~한다" / "~하지 않는다"로 한 문장씩.
- **설정/값** → "~인 경우 X를 쓴다", "기본값은 Y다" 형태.
- **순서가 있는 작업** → "1) A 2) B 3) C" 또는 체크리스트.
- **여러 방식이 있는 경우** → "기본은 A, 예외적으로 B일 때는 C"처럼 한 가지 기본 + 예외만 명시.

용어는 스킬 전체에서 하나로 통일 (예: "API 엔드포인트" vs "라우트" 중 하나만 사용).

## 5단계: 검증 체크리스트

스킬을 넘기기 전에 확인:

- [ ] `name`은 소문자·하이픈·64자 이내
- [ ] `description`에 WHAT + WHEN(트리거) 포함, 3인칭
- [ ] 본문 500줄 미만, 핵심만 SKILL.md에
- [ ] 파일 참조는 SKILL.md에서 한 단계 깊이만 (예: `[reference.md](reference.md)`)
- [ ] 스크립트/경로는 슬래시 사용 (`scripts/helper.py`)

## 출력물

- 생성할 스킬 경로: 프로젝트 스킬은 `.cursor/skills/<skill-name>/SKILL.md`, 개인 스킬은 사용자 지정에 따름.
- 필요하면 `reference.md`, `examples.md`를 같은 디렉터리에 두고 SKILL.md에서 링크.

## 추가 자료

- 패턴 유형(규칙/워크플로우/템플릿) 정리: [reference.md](reference.md)
- 스킬 작성 형식·설명·예시 패턴: `~/.cursor/skills-cursor/create-skill/SKILL.md` 참고.
- 이 스킬은 "패턴 분석 → 스킬 생성" 흐름만 담당한다. 실제 코드/설정 변경은 사용자 요청에 따라 별도로 수행한다.
