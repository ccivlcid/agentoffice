// @ts-nocheck
/**
 * Project rules presets and config-file sync helpers.
 */

import fs from "node:fs";
import path from "node:path";
import type { Database } from "better-sqlite3";

export interface RulePreset {
  name: string;
  title: string;
  titleKo: string;
  description: string;
  descriptionKo: string;
  category: string;
  content: string;
  alwaysApply: boolean;
  globs: string[];
}

export const RULE_PRESETS: RulePreset[] = [
  {
    name: "clean-code",
    title: "Clean Code Guidelines",
    titleKo: "클린 코드 가이드라인",
    description: "DRY, single responsibility, concise code rules",
    descriptionKo: "DRY, 단일 책임, 간결한 코드 작성 규칙",
    category: "coding",
    alwaysApply: true,
    globs: [],
    content: `# Clean Code Guidelines

- Keep single files under 300 lines. Split into modules/components/hooks when exceeded.
- Follow single responsibility principle.
- DRY: extract a function when the same logic repeats 3+ times.
- Comments should focus on "why", not "what" or "how".
- Prefer explicit variable/function names over abbreviations.
- Avoid deep nesting (max 3 levels). Use early returns.`,
  },
  {
    name: "surgical-changes",
    title: "Surgical Changes",
    titleKo: "최소 변경 원칙",
    description: "Only make requested changes, no unnecessary refactoring",
    descriptionKo: "요청된 변경만 수행, 불필요한 리팩토링 금지",
    category: "coding",
    alwaysApply: true,
    globs: [],
    content: `# Surgical Changes

- Only make changes directly requested.
- Do not "improve" adjacent code, comments, or formatting.
- Match existing code style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- Every changed line should trace directly to the user's request.`,
  },
  {
    name: "typescript-strict",
    title: "TypeScript Strict Mode",
    titleKo: "TypeScript 엄격 모드",
    description: "Type safety rules for TypeScript",
    descriptionKo: "타입 안전성 규칙",
    category: "coding",
    alwaysApply: false,
    globs: ["**/*.ts", "**/*.tsx"],
    content: `# TypeScript Strict Rules

- Never use \`any\` — use \`unknown\` instead.
- Always specify return types for exported functions.
- Always null-check before accessing optional properties.
- Minimize \`as\` type assertions.
- Use discriminated unions over type guards when possible.`,
  },
  {
    name: "react-patterns",
    title: "React Patterns",
    titleKo: "React 패턴",
    description: "React component authoring rules",
    descriptionKo: "React 컴포넌트 작성 규칙",
    category: "coding",
    alwaysApply: false,
    globs: ["src/**/*.tsx"],
    content: `# React Patterns

- Use function components + hooks.
- Always define Props interface explicitly.
- Specify useEffect dependency arrays precisely.
- Minimize state — derive values with useMemo instead.
- Prefer composition over prop drilling.`,
  },
];

const MANAGED_MARKER = "<!-- managed-by: climpire-library -->";

interface ProjectRuleRow {
  id: string;
  name: string;
  title: string;
  description: string;
  content: string;
  globs: string;
  always_apply: number;
  providers: string;
  enabled: number;
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function buildMdcFrontmatter(rule: ProjectRuleRow): string {
  const lines: string[] = [];
  if (rule.description) lines.push(`description: ${rule.description}`);
  let globs: string[];
  try { globs = JSON.parse(rule.globs); } catch { globs = []; }
  if (globs.length > 0) lines.push(`globs: ${JSON.stringify(globs)}`);
  if (rule.always_apply) lines.push("alwaysApply: true");
  return lines.join("\n") + "\n";
}

export function syncRulesToFiles(db: Database): { synced: string[] } {
  const rules = db.prepare(
    "SELECT * FROM project_rules WHERE enabled = 1"
  ).all() as ProjectRuleRow[];

  const byProvider: Record<string, ProjectRuleRow[]> = {};
  for (const r of rules) {
    let providers: string[];
    try { providers = JSON.parse(r.providers); } catch { providers = []; }
    for (const p of providers) {
      (byProvider[p] ??= []).push(r);
    }
  }

  const synced: string[] = [];

  // Cursor: .cursor/rules/{name}.mdc
  {
    const rulesDir = path.join(process.cwd(), ".cursor", "rules");
    ensureDir(rulesDir);
    // Remove previously managed files
    cleanManagedFiles(rulesDir, ".mdc");
    for (const r of byProvider.cursor ?? []) {
      const frontmatter = buildMdcFrontmatter(r);
      const content = `---\n${frontmatter}---\n${MANAGED_MARKER}\n\n${r.content}\n`;
      fs.writeFileSync(path.join(rulesDir, `${r.name}.mdc`), content, "utf-8");
    }
    synced.push("cursor");
  }

  // Claude Code: .claude/skills/{name}/SKILL.md
  {
    const skillsDir = path.join(process.cwd(), ".claude", "skills");
    ensureDir(skillsDir);
    cleanManagedSkillDirs(skillsDir);
    for (const r of byProvider.claude ?? []) {
      const dir = path.join(skillsDir, r.name);
      ensureDir(dir);
      const fm = `name: ${r.name}\ndescription: ${r.description || r.title}\n`;
      const content = `---\n${fm}---\n${MANAGED_MARKER}\n\n${r.content}\n`;
      fs.writeFileSync(path.join(dir, "SKILL.md"), content, "utf-8");
    }
    synced.push("claude");
  }

  // Codex: .codex/instructions.md
  writeMergedInstructions(byProvider.codex, ".codex", "instructions.md");
  if (byProvider.codex?.length) synced.push("codex");

  // Gemini: .gemini/STYLE.md
  writeMergedInstructions(byProvider.gemini, ".gemini", "STYLE.md");
  if (byProvider.gemini?.length) synced.push("gemini");

  // OpenCode: .opencode/instructions.md
  writeMergedInstructions(byProvider.opencode, ".opencode", "instructions.md");
  if (byProvider.opencode?.length) synced.push("opencode");

  return { synced };
}

function writeMergedInstructions(rules: ProjectRuleRow[] | undefined, dir: string, filename: string): void {
  if (!rules || rules.length === 0) return;
  const targetDir = path.join(process.cwd(), dir);
  ensureDir(targetDir);
  const merged = `${MANAGED_MARKER}\n\n` + rules.map(r => `# ${r.title || r.name}\n\n${r.content}`).join("\n\n---\n\n") + "\n";
  fs.writeFileSync(path.join(targetDir, filename), merged, "utf-8");
}

function cleanManagedFiles(dirPath: string, ext: string): void {
  try {
    for (const f of fs.readdirSync(dirPath)) {
      if (!f.endsWith(ext)) continue;
      const filePath = path.join(dirPath, f);
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        if (content.includes(MANAGED_MARKER)) fs.unlinkSync(filePath);
      } catch { /* ignore */ }
    }
  } catch { /* dir may not exist */ }
}

function cleanManagedSkillDirs(skillsDir: string): void {
  try {
    for (const d of fs.readdirSync(skillsDir)) {
      const skillMd = path.join(skillsDir, d, "SKILL.md");
      try {
        if (!fs.existsSync(skillMd)) continue;
        const content = fs.readFileSync(skillMd, "utf-8");
        if (content.includes(MANAGED_MARKER)) {
          fs.unlinkSync(skillMd);
          // Remove dir if empty
          try { fs.rmdirSync(path.join(skillsDir, d)); } catch { /* not empty */ }
        }
      } catch { /* ignore */ }
    }
  } catch { /* dir may not exist */ }
}
