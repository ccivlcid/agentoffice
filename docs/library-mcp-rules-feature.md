# 도서관(Skills Library) — MCP 서버 설치 & 룰 관리 기능 설계

> 작성일: 2026-02-27
> 대상: `src/components/skills-library/`, `server/modules/routes/ops/skills-*`

---

## 1. 현재 도서관 아키텍처 요약

### 기존 구조

```
Skills Library (도서관)
├── 공개 스킬 (skills.sh에서 가져옴)
│   ├── 목록 캐시 (1시간 TTL)
│   └── 상세 정보 스크래핑 (200개 LRU 캐시)
├── 커스텀 스킬 (사용자 등록, DB 저장)
│   ├── CRUD (이름/리포/카테고리/설명)
│   └── .md 파일 업로드 → custom-skills/ 디렉토리
└── 학습 시스템
    ├── `npx skills add` 서브프로세스 실행
    ├── 프로바이더별 대표 에이전트 선택
    ├── 학습 이력 DB (skill_learning_history)
    └── 제거(unlearn): `npx skills remove` + 파일시스템 검증
```

### 스킬 저장 위치 (CLI별)

| CLI Provider | 스킬 디렉토리 | 설정 파일 |
|---|---|---|
| Claude Code | `.claude/skills/` | `.claude/settings.local.json` |
| Codex CLI | `.codex/skills/` | - |
| Gemini CLI | `.gemini/skills/` | - |
| OpenCode | `.opencode/skills/` | - |
| Cursor | `.cursor/skills/` | `.cursor/rules/*.mdc` |
| Copilot | `.copilot/skills/` | - |

### 관련 DB 테이블

- `skill_learning_history` — 학습 이력 (provider, repo, skill_id, status)
- `custom_skills` — 사용자 등록 스킬 (name, skill_id, repo, category)

---

## 2. 추가할 기능 개요

### 2-A. MCP 서버 관리

사용자가 도서관 UI에서 MCP 서버를 **검색 → 설치 → 설정 → 활성/비활성** 할 수 있는 기능.

### 2-B. 룰(Rules) 관리

각 CLI 프로바이더에 적용할 **프로젝트 룰(.mdc 또는 .md)을 생성/편집/삭제**하는 기능.

---

## 3. MCP 서버 관리 기능 설계

### 3.1 MCP란?

Model Context Protocol — AI 에이전트가 외부 도구/데이터 소스에 접근할 수 있게 하는 표준 프로토콜.
각 CLI 도구마다 MCP 설정 형식이 다름:

| CLI | MCP 설정 파일 | 형식 |
|---|---|---|
| Claude Code | `.claude/settings.local.json` → `mcpServers` | JSON (command + args + env) |
| Cursor | `.cursor/mcp.json` | JSON (동일 형식) |
| Codex CLI | (미지원) | - |
| Gemini CLI | `.gemini/settings.json` → `mcpServers` | JSON (유사 형식) |

#### Claude Code MCP 설정 예시
```json
// .claude/settings.local.json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-filesystem", "/path/to/dir"],
      "env": {}
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "ghp_..." }
    }
  }
}
```

#### Cursor MCP 설정 예시
```json
// .cursor/mcp.json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-filesystem", "/path/to/dir"]
    }
  }
}
```

### 3.2 MCP 서버 레지스트리 (데이터 소스)

공개 MCP 서버 목록을 가져올 수 있는 소스:

1. **npmjs.com** — `@modelcontextprotocol/server-*`, `@anthropic/mcp-server-*` 패키지 검색
2. **mcp.so** — MCP 서버 디렉토리 사이트 (스크래핑 또는 API)
3. **GitHub Awesome MCP Servers** — 큐레이션된 목록
4. **내장 프리셋** — 자주 쓰는 MCP 서버를 하드코딩 (Filesystem, GitHub, Postgres, SQLite 등)

> **권장**: 1단계에서는 **내장 프리셋 + 수동 입력**으로 시작하고, 이후 mcp.so 연동 추가.

### 3.3 DB 스키마 추가

```sql
CREATE TABLE IF NOT EXISTS mcp_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                    -- 표시 이름 (예: "Filesystem")
  server_key TEXT NOT NULL UNIQUE,       -- 설정 키 (예: "filesystem")
  package TEXT NOT NULL DEFAULT '',      -- npm 패키지 (예: "@anthropic/mcp-server-filesystem")
  command TEXT NOT NULL DEFAULT 'npx',   -- 실행 명령 (npx, node, python 등)
  args TEXT NOT NULL DEFAULT '[]',       -- JSON 배열 (예: ["-y", "@anthropic/..."])
  env TEXT NOT NULL DEFAULT '{}',        -- JSON 객체 (환경변수)
  description TEXT NOT NULL DEFAULT '',  -- 설명
  category TEXT,                         -- 카테고리 (filesystem, database, api, dev-tools 등)
  enabled INTEGER NOT NULL DEFAULT 1,    -- 활성 여부
  providers TEXT NOT NULL DEFAULT '[]',  -- 적용 CLI 프로바이더 JSON 배열 ["claude","cursor"]
  source TEXT NOT NULL DEFAULT 'manual', -- 'preset' | 'manual' | 'registry'
  created_at INTEGER DEFAULT (unixepoch()*1000),
  updated_at INTEGER DEFAULT (unixepoch()*1000)
);
```

### 3.4 백엔드 API 엔드포인트

| Method | Path | 설명 |
|---|---|---|
| `GET` | `/api/mcp-servers` | 등록된 MCP 서버 목록 |
| `POST` | `/api/mcp-servers` | 새 MCP 서버 추가 |
| `PUT` | `/api/mcp-servers/:id` | MCP 서버 수정 |
| `DELETE` | `/api/mcp-servers/:id` | MCP 서버 삭제 |
| `POST` | `/api/mcp-servers/:id/toggle` | 활성/비활성 토글 |
| `POST` | `/api/mcp-servers/sync` | DB → 설정 파일 동기화 (실제 파일 생성/수정) |
| `GET` | `/api/mcp-servers/presets` | 내장 프리셋 목록 반환 |

#### 핵심 로직: 설정 파일 동기화

```typescript
// server/modules/routes/ops/mcp-servers.ts (신규)

async function syncMcpToConfigFiles(db: Database): Promise<void> {
  const servers = db.prepare(
    "SELECT * FROM mcp_servers WHERE enabled = 1"
  ).all() as McpServerRow[];

  // 프로바이더별로 그룹핑
  const byProvider: Record<string, McpServerRow[]> = {};
  for (const s of servers) {
    const providers: string[] = JSON.parse(s.providers);
    for (const p of providers) {
      (byProvider[p] ??= []).push(s);
    }
  }

  // Claude Code: .claude/settings.local.json
  if (byProvider.claude) {
    const settingsPath = path.join(process.cwd(), ".claude", "settings.local.json");
    const existing = readJsonSafe(settingsPath) ?? {};
    existing.mcpServers = {};
    for (const s of byProvider.claude) {
      existing.mcpServers[s.server_key] = {
        command: s.command,
        args: JSON.parse(s.args),
        ...(s.env !== "{}" ? { env: JSON.parse(s.env) } : {}),
      };
    }
    fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2));
  }

  // Cursor: .cursor/mcp.json
  if (byProvider.cursor) {
    const mcpPath = path.join(process.cwd(), ".cursor", "mcp.json");
    const config: Record<string, any> = { mcpServers: {} };
    for (const s of byProvider.cursor) {
      config.mcpServers[s.server_key] = {
        command: s.command,
        args: JSON.parse(s.args),
        ...(s.env !== "{}" ? { env: JSON.parse(s.env) } : {}),
      };
    }
    fs.mkdirSync(path.dirname(mcpPath), { recursive: true });
    fs.writeFileSync(mcpPath, JSON.stringify(config, null, 2));
  }

  // Gemini: .gemini/settings.json (비슷한 패턴)
}
```

### 3.5 프론트엔드 컴포넌트 구조

도서관에 새 탭(또는 섹션)으로 추가:

```
SkillsLibrary.tsx
├── 기존 탭: 스킬 (Skills)
├── 새 탭: MCP 서버 (MCP Servers)     ← 신규
│   ├── McpServerList.tsx             ← MCP 서버 카드 목록
│   ├── McpServerCard.tsx             ← 개별 카드 (이름, 패키지, 상태 토글)
│   ├── McpServerEditModal.tsx        ← 추가/편집 모달
│   ├── McpServerPresetPicker.tsx     ← 프리셋에서 빠르게 추가
│   └── useMcpServers.ts             ← CRUD 훅
└── 새 탭: 룰 (Rules)                 ← 신규 (아래 섹션 참조)
```

#### McpServerCard 디자인 컨셉

```
┌──────────────────────────────────────────────┐
│  📦 Filesystem                     [ON/OFF]  │
│  @anthropic/mcp-server-filesystem             │
│  프로바이더: Claude · Cursor                   │
│  ─────────────────────────────────────────── │
│  npx -y @anthropic/mcp-server-filesystem ...  │
│                          [편집] [삭제]         │
└──────────────────────────────────────────────┘
```

#### McpServerEditModal 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| 이름 | text | 표시 이름 |
| 서버 키 | text | 설정 파일 내 키 (자동 생성 가능) |
| 패키지 | text | npm 패키지명 또는 실행 파일 경로 |
| 명령어 | select | npx / node / python / 직접 입력 |
| 인자 | text[] | 실행 인자 목록 (동적 추가/삭제) |
| 환경변수 | key-value[] | 필요한 환경변수 (API 키 등) |
| 카테고리 | select | filesystem / database / api / dev-tools / other |
| 적용 프로바이더 | checkbox[] | claude / cursor / gemini / opencode |

### 3.6 MCP 프리셋 목록 (1단계)

```typescript
export const MCP_PRESETS = [
  {
    name: "Filesystem",
    serverKey: "filesystem",
    package: "@anthropic/mcp-server-filesystem",
    command: "npx",
    args: ["-y", "@anthropic/mcp-server-filesystem"],
    category: "filesystem",
    description: "로컬 파일시스템 접근 (읽기/쓰기/검색)",
    needsConfig: [{ key: "path", label: "디렉토리 경로", type: "text" }],
  },
  {
    name: "GitHub",
    serverKey: "github",
    package: "@modelcontextprotocol/server-github",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    category: "api",
    description: "GitHub API 연동 (이슈, PR, 리포지토리)",
    needsConfig: [{ key: "GITHUB_TOKEN", label: "GitHub Token", type: "env" }],
  },
  {
    name: "PostgreSQL",
    serverKey: "postgres",
    package: "@modelcontextprotocol/server-postgres",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres"],
    category: "database",
    description: "PostgreSQL 데이터베이스 쿼리",
    needsConfig: [{ key: "connection_string", label: "Connection URL", type: "arg" }],
  },
  {
    name: "SQLite",
    serverKey: "sqlite",
    package: "@modelcontextprotocol/server-sqlite",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sqlite"],
    category: "database",
    description: "SQLite 데이터베이스 접근",
    needsConfig: [{ key: "db_path", label: "DB 파일 경로", type: "arg" }],
  },
  {
    name: "Brave Search",
    serverKey: "brave-search",
    package: "@modelcontextprotocol/server-brave-search",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    category: "api",
    description: "Brave 검색 엔진 연동",
    needsConfig: [{ key: "BRAVE_API_KEY", label: "Brave API Key", type: "env" }],
  },
  {
    name: "Puppeteer",
    serverKey: "puppeteer",
    package: "@anthropic/mcp-server-puppeteer",
    command: "npx",
    args: ["-y", "@anthropic/mcp-server-puppeteer"],
    category: "dev-tools",
    description: "브라우저 자동화 (스크린샷, 웹 스크래핑)",
    needsConfig: [],
  },
];
```

---

## 4. 룰(Rules) 관리 기능 설계

### 4.1 현재 룰 시스템 현황

| CLI | 룰 파일 | 형식 | 적용 범위 |
|---|---|---|---|
| Cursor | `.cursor/rules/*.mdc` | MDC (YAML frontmatter + Markdown) | glob 패턴 또는 항상 적용 |
| Claude Code | `.claude/skills/*/SKILL.md` | Markdown (YAML frontmatter) | 전역 적용 |
| Codex CLI | `.codex/instructions.md` | 일반 Markdown | 전역 적용 |
| Gemini CLI | `.gemini/STYLE.md` | 일반 Markdown | 전역 적용 |
| OpenCode | `.opencode/instructions.md` | 일반 Markdown | 전역 적용 |

#### Cursor MDC 형식 예시
```markdown
---
description: HAIFeR Agent 레포 전용 규칙
globs: ["server/**", "src/**"]
alwaysApply: false
---

# 규칙 제목

- 규칙 내용 1
- 규칙 내용 2
```

#### Claude SKILL.md 형식 예시
```markdown
---
name: karpathy-guidelines
description: LLM 코딩 가이드라인
license: MIT
---

# 가이드라인 내용
...
```

### 4.2 DB 스키마 추가

```sql
CREATE TABLE IF NOT EXISTS project_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                         -- 룰 이름 (예: "clean-code")
  title TEXT NOT NULL DEFAULT '',             -- 표시 제목 (예: "클린 코드 가이드라인")
  description TEXT NOT NULL DEFAULT '',       -- 설명 (frontmatter description)
  content TEXT NOT NULL DEFAULT '',           -- 마크다운 본문
  category TEXT DEFAULT 'general',            -- general | coding | architecture | testing | style
  globs TEXT NOT NULL DEFAULT '[]',           -- JSON 배열, 적용 대상 glob 패턴
  always_apply INTEGER NOT NULL DEFAULT 0,    -- 항상 적용 여부
  providers TEXT NOT NULL DEFAULT '[]',       -- 적용 CLI 프로바이더 JSON 배열
  enabled INTEGER NOT NULL DEFAULT 1,         -- 활성 여부
  source TEXT NOT NULL DEFAULT 'manual',      -- 'manual' | 'preset' | 'imported'
  created_at INTEGER DEFAULT (unixepoch()*1000),
  updated_at INTEGER DEFAULT (unixepoch()*1000)
);
```

### 4.3 백엔드 API 엔드포인트

| Method | Path | 설명 |
|---|---|---|
| `GET` | `/api/rules` | 등록된 룰 목록 |
| `POST` | `/api/rules` | 새 룰 추가 |
| `PUT` | `/api/rules/:id` | 룰 수정 |
| `DELETE` | `/api/rules/:id` | 룰 삭제 |
| `POST` | `/api/rules/:id/toggle` | 활성/비활성 토글 |
| `POST` | `/api/rules/sync` | DB → 각 CLI 설정 파일로 동기화 |
| `POST` | `/api/rules/import` | 기존 .mdc / .md 파일에서 가져오기 |
| `GET` | `/api/rules/presets` | 내장 프리셋 룰 목록 |

#### 핵심 로직: 룰 파일 동기화

```typescript
// server/modules/routes/ops/rules.ts (신규)

async function syncRulesToConfigFiles(db: Database): Promise<void> {
  const rules = db.prepare(
    "SELECT * FROM project_rules WHERE enabled = 1"
  ).all() as ProjectRuleRow[];

  const byProvider: Record<string, ProjectRuleRow[]> = {};
  for (const r of rules) {
    const providers: string[] = JSON.parse(r.providers);
    for (const p of providers) {
      (byProvider[p] ??= []).push(r);
    }
  }

  // Cursor: .cursor/rules/{name}.mdc
  if (byProvider.cursor) {
    const rulesDir = path.join(process.cwd(), ".cursor", "rules");
    fs.mkdirSync(rulesDir, { recursive: true });
    // 기존 관리 룰 제거 (managed marker로 식별)
    cleanManagedFiles(rulesDir, ".mdc");
    for (const r of byProvider.cursor) {
      const frontmatter = buildMdcFrontmatter(r);
      const content = `---\n${frontmatter}---\n\n${r.content}`;
      fs.writeFileSync(path.join(rulesDir, `${r.name}.mdc`), content);
    }
  }

  // Claude Code: .claude/skills/{name}/SKILL.md
  if (byProvider.claude) {
    const skillsDir = path.join(process.cwd(), ".claude", "skills");
    fs.mkdirSync(skillsDir, { recursive: true });
    for (const r of byProvider.claude) {
      const dir = path.join(skillsDir, r.name);
      fs.mkdirSync(dir, { recursive: true });
      const frontmatter = `name: ${r.name}\ndescription: ${r.description}\n`;
      const content = `---\n${frontmatter}---\n\n${r.content}`;
      fs.writeFileSync(path.join(dir, "SKILL.md"), content);
    }
  }

  // Codex: .codex/instructions.md (단일 파일 — 모든 룰 병합)
  if (byProvider.codex) {
    const instrPath = path.join(process.cwd(), ".codex", "instructions.md");
    fs.mkdirSync(path.dirname(instrPath), { recursive: true });
    const merged = byProvider.codex.map(r => `# ${r.title}\n\n${r.content}`).join("\n\n---\n\n");
    fs.writeFileSync(instrPath, merged);
  }

  // Gemini: .gemini/STYLE.md (단일 파일)
  if (byProvider.gemini) {
    const stylePath = path.join(process.cwd(), ".gemini", "STYLE.md");
    fs.mkdirSync(path.dirname(stylePath), { recursive: true });
    const merged = byProvider.gemini.map(r => `# ${r.title}\n\n${r.content}`).join("\n\n---\n\n");
    fs.writeFileSync(stylePath, merged);
  }
}

function buildMdcFrontmatter(rule: ProjectRuleRow): string {
  const lines: string[] = [];
  if (rule.description) lines.push(`description: ${rule.description}`);
  const globs = JSON.parse(rule.globs) as string[];
  if (globs.length > 0) lines.push(`globs: ${JSON.stringify(globs)}`);
  if (rule.always_apply) lines.push("alwaysApply: true");
  return lines.join("\n") + "\n";
}
```

### 4.4 프론트엔드 컴포넌트 구조

```
SkillsLibrary.tsx
└── 새 탭: 룰 (Rules)
    ├── RulesList.tsx                  ← 룰 카드 목록
    ├── RuleCard.tsx                   ← 개별 룰 카드
    ├── RuleEditModal.tsx              ← 룰 생성/편집 모달 (마크다운 에디터)
    ├── RuleImportModal.tsx            ← 기존 .mdc/.md에서 가져오기
    ├── RulePresetPicker.tsx           ← 프리셋 룰 선택
    └── useRules.ts                   ← CRUD 훅
```

#### RuleCard 디자인 컨셉

```
┌──────────────────────────────────────────────┐
│  📝 클린 코드 가이드라인           [ON/OFF]  │
│  코딩 스타일, 단일 책임, DRY 원칙             │
│  적용: server/** · src/**                    │
│  프로바이더: Claude · Cursor · Codex          │
│                          [편집] [삭제]        │
└──────────────────────────────────────────────┘
```

#### RuleEditModal 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| 이름 | text | 파일명 (영문, kebab-case) |
| 제목 | text | 표시 제목 |
| 설명 | text | frontmatter description |
| 카테고리 | select | general / coding / architecture / testing / style |
| 적용 패턴 | text[] | glob 패턴 (예: `server/**`, `src/**/*.tsx`) |
| 항상 적용 | toggle | alwaysApply 여부 |
| 적용 프로바이더 | checkbox[] | claude / cursor / codex / gemini / opencode |
| 본문 | textarea | 마크다운 에디터 (모나코 또는 textarea) |

### 4.5 룰 프리셋 목록 (1단계)

```typescript
export const RULE_PRESETS = [
  {
    name: "clean-code",
    title: "클린 코드 가이드라인",
    description: "DRY, 단일 책임, 간결한 코드 작성 규칙",
    category: "coding",
    content: `# 클린 코드 가이드라인\n\n- 단일 파일 300줄 이하 유지\n- 단일 책임 원칙 준수\n- DRY: 동일 로직 3번 이상 반복 시 함수 추출\n- 주석은 "왜"에 집중 (무엇/어떻게는 코드가 설명)`,
    alwaysApply: true,
    globs: [],
  },
  {
    name: "surgical-changes",
    title: "최소 변경 원칙",
    description: "요청된 변경만 수행, 불필요한 리팩토링 금지",
    category: "coding",
    content: `# 최소 변경 원칙 (Surgical Changes)\n\n- 요청된 변경만 수행\n- 인접 코드 "개선" 금지\n- 기존 스타일 따르기\n- 관련 없는 데드코드는 멘션만 (삭제 금지)`,
    alwaysApply: true,
    globs: [],
  },
  {
    name: "typescript-strict",
    title: "TypeScript 엄격 모드",
    description: "타입 안전성 규칙",
    category: "coding",
    content: `# TypeScript 엄격 규칙\n\n- any 사용 금지 (unknown 사용)\n- 반환 타입 명시\n- null check 필수\n- as 캐스팅 최소화`,
    alwaysApply: false,
    globs: ["**/*.ts", "**/*.tsx"],
  },
  {
    name: "react-patterns",
    title: "React 패턴",
    description: "React 컴포넌트 작성 규칙",
    category: "coding",
    content: `# React 패턴\n\n- 함수 컴포넌트 + 훅 사용\n- Props 인터페이스 명시\n- useEffect 의존성 배열 정확히 지정\n- 상태 최소화 (파생값은 useMemo)`,
    alwaysApply: false,
    globs: ["src/**/*.tsx"],
  },
];
```

---

## 5. 도서관 탭 구조 변경

### 현재
```
[스킬]
```

### 변경 후
```
[스킬] [MCP 서버] [룰]
```

### SkillsLibrary.tsx 수정 방향

```tsx
const [activeTab, setActiveTab] = useState<"skills" | "mcp" | "rules">("skills");

return (
  <div>
    {/* 탭 헤더 */}
    <div className="flex gap-1 border-b border-slate-700">
      <TabButton active={activeTab === "skills"} onClick={() => setActiveTab("skills")}>
        {t({ ko: "스킬", en: "Skills" })}
      </TabButton>
      <TabButton active={activeTab === "mcp"} onClick={() => setActiveTab("mcp")}>
        {t({ ko: "MCP 서버", en: "MCP Servers" })}
      </TabButton>
      <TabButton active={activeTab === "rules"} onClick={() => setActiveTab("rules")}>
        {t({ ko: "룰", en: "Rules" })}
      </TabButton>
    </div>

    {/* 탭 콘텐츠 */}
    {activeTab === "skills" && <SkillsTab ... />}
    {activeTab === "mcp" && <McpServerList ... />}
    {activeTab === "rules" && <RulesList ... />}
  </div>
);
```

---

## 6. 구현 순서 (단계별)

### Phase 1: DB + API (백엔드)

1. `server/init/schema-extended.ts`에 `mcp_servers`, `project_rules` 테이블 추가
2. `server/modules/routes/ops/mcp-servers.ts` 신규 생성 — CRUD + 동기화 API
3. `server/modules/routes/ops/rules.ts` 신규 생성 — CRUD + 동기화 API
4. `server/index.ts`에 라우트 등록

### Phase 2: 프론트엔드 API 클라이언트

5. `src/api/mcp-servers.ts` 신규 — MCP 서버 CRUD 타입 + 함수
6. `src/api/rules.ts` 신규 — 룰 CRUD 타입 + 함수
7. `src/api/index.ts`에 re-export 추가

### Phase 3: 프론트엔드 훅

8. `src/components/skills-library/useMcpServers.ts` — MCP 서버 CRUD 훅
9. `src/components/skills-library/useRules.ts` — 룰 CRUD 훅

### Phase 4: 프론트엔드 UI

10. `McpServerCard.tsx`, `McpServerList.tsx`, `McpServerEditModal.tsx`, `McpServerPresetPicker.tsx`
11. `RuleCard.tsx`, `RulesList.tsx`, `RuleEditModal.tsx`, `RulePresetPicker.tsx`
12. `SkillsLibrary.tsx` 탭 구조 변경

### Phase 5: 동기화 & 검증

13. MCP 설정 파일 동기화 테스트 (`.claude/settings.local.json`, `.cursor/mcp.json`)
14. 룰 파일 동기화 테스트 (`.cursor/rules/*.mdc`, `.claude/skills/*/SKILL.md`)
15. 기존 설정 파일 import 기능 구현

---

## 7. 파일 목록 (신규 생성)

| 경로 | 설명 |
|---|---|
| `server/modules/routes/ops/mcp-servers.ts` | MCP 서버 CRUD + 동기화 API |
| `server/modules/routes/ops/rules.ts` | 룰 CRUD + 동기화 API |
| `src/api/mcp-servers.ts` | MCP 서버 API 클라이언트 |
| `src/api/rules.ts` | 룰 API 클라이언트 |
| `src/components/skills-library/useMcpServers.ts` | MCP 서버 상태 훅 |
| `src/components/skills-library/useRules.ts` | 룰 상태 훅 |
| `src/components/skills-library/McpServerList.tsx` | MCP 서버 목록 UI |
| `src/components/skills-library/McpServerCard.tsx` | MCP 서버 카드 UI |
| `src/components/skills-library/McpServerEditModal.tsx` | MCP 서버 편집 모달 |
| `src/components/skills-library/McpServerPresetPicker.tsx` | MCP 프리셋 선택기 |
| `src/components/skills-library/RulesList.tsx` | 룰 목록 UI |
| `src/components/skills-library/RuleCard.tsx` | 룰 카드 UI |
| `src/components/skills-library/RuleEditModal.tsx` | 룰 편집 모달 |
| `src/components/skills-library/RulePresetPicker.tsx` | 룰 프리셋 선택기 |

## 8. 파일 목록 (수정)

| 경로 | 변경 내용 |
|---|---|
| `server/init/schema-extended.ts` | `mcp_servers`, `project_rules` 테이블 DDL 추가 |
| `server/index.ts` 또는 route 등록 파일 | 새 라우트 등록 |
| `src/api/index.ts` | 새 API 모듈 re-export |
| `src/components/skills-library/SkillsLibrary.tsx` | 3-탭 구조로 변경 |
| `src/components/skills-library/skillsLibraryHelpers.ts` | MCP/룰 관련 타입·헬퍼 추가 (또는 별도 파일) |

---

## 9. 주의사항

### 설정 파일 충돌 방지

- **기존 수동 편집 설정 보존**: 동기화 시 `.claude/settings.local.json`의 `permissions` 등 기존 필드를 유지하고 `mcpServers`만 덮어쓰기
- **관리 마커**: 도서관에서 생성한 룰 파일에 주석 마커 추가하여 수동 생성 파일과 구분
  ```markdown
  <!-- managed-by: climpire-library -->
  ```
- `.cursor/rules/`의 기존 수동 `.mdc` 파일은 import 후에도 원본 보존

### 보안

- MCP 서버 env에 API 키/토큰이 포함될 수 있으므로:
  - DB에 저장 시 민감 값은 마스킹 표시 (`ghp_****...1234`)
  - 프론트엔드 응답에서 env 값은 마스킹 처리
  - 편집 시에만 원본 값 입력 가능

### 파일 크기 제한

- 룰 본문: 최대 10,000자
- MCP args: 최대 20개 항목
- env: 최대 10개 키-값 쌍

---

## 10. 향후 확장

1. **MCP 서버 레지스트리 연동**: mcp.so / npm 검색으로 MCP 서버 자동 검색·설치
2. **룰 마켓플레이스**: skills.sh처럼 공개 룰 공유 플랫폼 연동
3. **에이전트별 룰 적용**: 특정 에이전트에만 룰 적용 (현재는 프로바이더 단위)
4. **MCP 서버 상태 모니터링**: 연결 상태, 에러 로그 표시
5. **룰 버전 관리**: 변경 이력 추적, 이전 버전 복원
6. **AI 추천**: 프로젝트 구조를 분석하여 적합한 MCP 서버/룰 자동 추천
