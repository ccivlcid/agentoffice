// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const CONTEXT_IGNORE_DIRS = new Set([
  "node_modules", "dist", "build", ".next", ".nuxt", "out", "__pycache__",
  ".git", ".climpire-worktrees", ".climpire", "vendor", ".venv", "venv",
  "coverage", ".cache", ".turbo", ".parcel-cache", "target", "bin", "obj",
]);

const CONTEXT_IGNORE_FILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb",
  ".DS_Store", "Thumbs.db",
]);

export function buildFileTree(dir: string, prefix = "", depth = 0, maxDepth = 4): string[] {
  if (depth >= maxDepth) return [`${prefix}...`];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  entries = entries
    .filter(e => !e.isSymbolicLink())
    .filter(e => !e.name.startsWith(".") || e.name === ".env.example")
    .filter(e => !CONTEXT_IGNORE_DIRS.has(e.name) && !CONTEXT_IGNORE_FILES.has(e.name))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  const lines: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const isLast = i === entries.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const childPrefix = isLast ? "    " : "│   ";
    if (e.isDirectory()) {
      lines.push(`${prefix}${connector}${e.name}/`);
      lines.push(...buildFileTree(path.join(dir, e.name), prefix + childPrefix, depth + 1, maxDepth));
    } else {
      lines.push(`${prefix}${connector}${e.name}`);
    }
  }
  return lines;
}

export function detectTechStack(projectPath: string): string[] {
  const stack: string[] = [];
  try {
    const pkgPath = path.join(projectPath, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      const sv = (v: unknown) => String(v ?? "").replace(/[\n\r]/g, "").slice(0, 20);
      if (allDeps.react) stack.push(`React ${sv(allDeps.react)}`);
      if (allDeps.next) stack.push(`Next.js ${sv(allDeps.next)}`);
      if (allDeps.vue) stack.push(`Vue ${sv(allDeps.vue)}`);
      if (allDeps.svelte) stack.push("Svelte");
      if (allDeps.express) stack.push("Express");
      if (allDeps.fastify) stack.push("Fastify");
      if (allDeps.typescript) stack.push("TypeScript");
      if (allDeps.tailwindcss) stack.push("Tailwind CSS");
      if (allDeps.vite) stack.push("Vite");
      if (allDeps.webpack) stack.push("Webpack");
      if (allDeps.prisma || allDeps["@prisma/client"]) stack.push("Prisma");
      if (allDeps.drizzle) stack.push("Drizzle");
      const runtime = pkg.engines?.node ? `Node.js ${sv(pkg.engines.node)}` : "Node.js";
      if (!stack.some(s => s.startsWith("Node"))) stack.unshift(runtime);
    }
  } catch { /* ignore parse errors */ }
  try { if (fs.existsSync(path.join(projectPath, "requirements.txt"))) stack.push("Python"); } catch {}
  try { if (fs.existsSync(path.join(projectPath, "go.mod"))) stack.push("Go"); } catch {}
  try { if (fs.existsSync(path.join(projectPath, "Cargo.toml"))) stack.push("Rust"); } catch {}
  try { if (fs.existsSync(path.join(projectPath, "pom.xml"))) stack.push("Java (Maven)"); } catch {}
  try { if (fs.existsSync(path.join(projectPath, "build.gradle")) || fs.existsSync(path.join(projectPath, "build.gradle.kts"))) stack.push("Java (Gradle)"); } catch {}
  return stack;
}

export function getKeyFiles(projectPath: string): string[] {
  const keyPatterns = [
    "package.json", "tsconfig.json", "vite.config.ts", "vite.config.js",
    "next.config.js", "next.config.ts", "webpack.config.js",
    "Dockerfile", "docker-compose.yml", "docker-compose.yaml",
    ".env.example", "Makefile", "CMakeLists.txt",
  ];
  const result: string[] = [];

  for (const p of keyPatterns) {
    const fullPath = path.join(projectPath, p);
    try {
      if (fs.existsSync(fullPath)) {
        const stat = fs.statSync(fullPath);
        result.push(`${p} (${stat.size} bytes)`);
      }
    } catch {}
  }

  const srcDirs = ["src", "server", "app", "lib", "pages", "components", "api"];
  for (const d of srcDirs) {
    const dirPath = path.join(projectPath, d);
    try {
      if (fs.statSync(dirPath).isDirectory()) {
        let count = 0;
        const countFiles = (dir: string, depth = 0) => {
          if (depth > 10) return;
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const e of entries) {
            if (CONTEXT_IGNORE_DIRS.has(e.name) || e.isSymbolicLink()) continue;
            if (e.isDirectory()) countFiles(path.join(dir, e.name), depth + 1);
            else count++;
          }
        };
        countFiles(dirPath);
        result.push(`${d}/ (${count} files)`);
      }
    } catch {}
  }

  return result;
}

function buildProjectContextContent(projectPath: string): string {
  const sections: string[] = [];
  const projectName = path.basename(projectPath);

  sections.push(`# Project: ${projectName}\n`);

  const techStack = detectTechStack(projectPath);
  if (techStack.length) {
    sections.push(`## Tech Stack\n${techStack.join(", ")}\n`);
  }

  const tree = buildFileTree(projectPath);
  if (tree.length) {
    sections.push(`## File Structure\n\`\`\`\n${tree.join("\n")}\n\`\`\`\n`);
  }

  const keyFiles = getKeyFiles(projectPath);
  if (keyFiles.length) {
    sections.push(`## Key Files\n${keyFiles.map(f => `- ${f}`).join("\n")}\n`);
  }

  for (const readmeName of ["README.md", "readme.md", "README.rst"]) {
    const readmePath = path.join(projectPath, readmeName);
    try {
      if (fs.existsSync(readmePath)) {
        const lines = fs.readFileSync(readmePath, "utf8").split("\n").slice(0, 20);
        sections.push(`## README (first 20 lines)\n${lines.join("\n")}\n`);
        break;
      }
    } catch {}
  }

  return sections.join("\n");
}

export function generateProjectContext(projectPath: string, isGitRepo: (p: string) => boolean): string {
  const climpireDir = path.join(projectPath, ".climpire");
  const contextPath = path.join(climpireDir, "project-context.md");
  const metaPath = path.join(climpireDir, "project-context.meta");

  if (isGitRepo(projectPath)) {
    try {
      const currentHead = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: projectPath, stdio: "pipe", timeout: 5000,
      }).toString().trim();

      if (fs.existsSync(metaPath) && fs.existsSync(contextPath)) {
        const cachedHead = fs.readFileSync(metaPath, "utf8").trim();
        if (cachedHead === currentHead) {
          return fs.readFileSync(contextPath, "utf8");
        }
      }

      const content = buildProjectContextContent(projectPath);

      fs.mkdirSync(climpireDir, { recursive: true });
      fs.writeFileSync(contextPath, content, "utf8");
      fs.writeFileSync(metaPath, currentHead, "utf8");
      console.log(`[HyperClaw] Generated project context: ${contextPath}`);
      return content;
    } catch (err) {
      console.warn(`[HyperClaw] Failed to generate project context: ${err}`);
    }
  }

  try {
    if (fs.existsSync(contextPath)) {
      const stat = fs.statSync(contextPath);
      if (Date.now() - stat.mtimeMs < 5 * 60 * 1000) {
        return fs.readFileSync(contextPath, "utf8");
      }
    }
    const content = buildProjectContextContent(projectPath);
    fs.mkdirSync(climpireDir, { recursive: true });
    fs.writeFileSync(contextPath, content, "utf8");
    return content;
  } catch {
    return "";
  }
}

export function getRecentChanges(projectPath: string, taskId: string, db: any, isGitRepo: (p: string) => boolean): string {
  const parts: string[] = [];

  if (isGitRepo(projectPath)) {
    try {
      const log = execFileSync("git", ["log", "--oneline", "-10"], {
        cwd: projectPath, stdio: "pipe", timeout: 5000,
      }).toString().trim();
      if (log) parts.push(`### Recent Commits\n${log}`);
    } catch {}

    try {
      const worktreeList = execFileSync("git", ["worktree", "list", "--porcelain"], {
        cwd: projectPath, stdio: "pipe", timeout: 5000,
      }).toString().trim();

      const currentBranch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
        cwd: projectPath, stdio: "pipe", timeout: 5000,
      }).toString().trim();

      const worktreeLines: string[] = [];
      const blocks = worktreeList.split("\n\n");
      for (const block of blocks) {
        const branchMatch = block.match(/branch refs\/heads\/(climpire\/[^\s]+)/);
        if (branchMatch) {
          const branch = branchMatch[1];
          try {
            const stat = execFileSync("git", ["diff", `${currentBranch}...${branch}`, "--stat", "--stat-width=60"], {
              cwd: projectPath, stdio: "pipe", timeout: 5000,
            }).toString().trim();
            if (stat) worktreeLines.push(`  ${branch}:\n${stat}`);
          } catch {}
        }
      }
      if (worktreeLines.length) {
        parts.push(`### Active Worktree Changes (other agents)\n${worktreeLines.join("\n")}`);
      }
    } catch {}
  }

  try {
    const recentTasks = db.prepare(`
      SELECT t.id, t.title, a.name AS agent_name, t.updated_at FROM tasks t
      LEFT JOIN agents a ON t.assigned_agent_id = a.id
      WHERE t.project_path = ? AND t.status = 'done' AND t.id != ?
      ORDER BY t.updated_at DESC LIMIT 3
    `).all(projectPath, taskId) as Array<{
      id: string; title: string; agent_name: string | null; updated_at: number;
    }>;

    if (recentTasks.length) {
      const taskLines = recentTasks.map(t => `- ${t.title} (by ${t.agent_name || "unknown"})`);
      parts.push(`### Recently Completed Tasks\n${taskLines.join("\n")}`);
    }
  } catch {}

  if (!parts.length) return "";
  return parts.join("\n\n");
}

export function ensureClaudeMd(projectPath: string, worktreePath: string): void {
  if (fs.existsSync(path.join(projectPath, "CLAUDE.md"))) return;

  const climpireDir = path.join(projectPath, ".climpire");
  const claudeMdSrc = path.join(climpireDir, "CLAUDE.md");
  const claudeMdDst = path.join(worktreePath, "CLAUDE.md");

  if (!fs.existsSync(claudeMdSrc)) {
    const techStack = detectTechStack(projectPath);
    const keyFiles = getKeyFiles(projectPath);
    const projectName = path.basename(projectPath);

    const content = [
      `# ${projectName}`,
      "",
      techStack.length ? `**Stack:** ${techStack.join(", ")}` : "",
      "",
      keyFiles.length ? `**Key files:** ${keyFiles.slice(0, 10).join(", ")}` : "",
      "",
      "This file was auto-generated by Claw Empire to provide project context.",
    ].filter(Boolean).join("\n");

    fs.mkdirSync(climpireDir, { recursive: true });
    fs.writeFileSync(claudeMdSrc, content, "utf8");
    console.log(`[HyperClaw] Generated CLAUDE.md: ${claudeMdSrc}`);
  }

  try {
    fs.copyFileSync(claudeMdSrc, claudeMdDst);
  } catch (err) {
    console.warn(`[HyperClaw] Failed to copy CLAUDE.md to worktree: ${err}`);
  }
}
