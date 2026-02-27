// @ts-nocheck
/**
 * MCP server presets and config-file sync helpers.
 */

import fs from "node:fs";
import path from "node:path";
import type { Database } from "better-sqlite3";

export interface McpPreset {
  name: string;
  serverKey: string;
  package: string;
  command: string;
  args: string[];
  category: string;
  description: string;
  descriptionKo: string;
}

export const MCP_PRESETS: McpPreset[] = [
  {
    name: "Filesystem",
    serverKey: "filesystem",
    package: "@anthropic/mcp-server-filesystem",
    command: "npx",
    args: ["-y", "@anthropic/mcp-server-filesystem"],
    category: "filesystem",
    description: "Local filesystem access (read/write/search)",
    descriptionKo: "로컬 파일시스템 접근 (읽기/쓰기/검색)",
  },
  {
    name: "GitHub",
    serverKey: "github",
    package: "@modelcontextprotocol/server-github",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    category: "api",
    description: "GitHub API integration (issues, PRs, repos)",
    descriptionKo: "GitHub API 연동 (이슈, PR, 리포지토리)",
  },
  {
    name: "PostgreSQL",
    serverKey: "postgres",
    package: "@modelcontextprotocol/server-postgres",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres"],
    category: "database",
    description: "PostgreSQL database query",
    descriptionKo: "PostgreSQL 데이터베이스 쿼리",
  },
  {
    name: "SQLite",
    serverKey: "sqlite",
    package: "@modelcontextprotocol/server-sqlite",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sqlite"],
    category: "database",
    description: "SQLite database access",
    descriptionKo: "SQLite 데이터베이스 접근",
  },
  {
    name: "Brave Search",
    serverKey: "brave-search",
    package: "@modelcontextprotocol/server-brave-search",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    category: "api",
    description: "Brave search engine integration",
    descriptionKo: "Brave 검색 엔진 연동",
  },
  {
    name: "Puppeteer",
    serverKey: "puppeteer",
    package: "@anthropic/mcp-server-puppeteer",
    command: "npx",
    args: ["-y", "@anthropic/mcp-server-puppeteer"],
    category: "dev-tools",
    description: "Browser automation (screenshots, scraping)",
    descriptionKo: "브라우저 자동화 (스크린샷, 스크래핑)",
  },
];

interface McpServerRow {
  id: string;
  name: string;
  server_key: string;
  command: string;
  args: string;
  env: string;
  providers: string;
  enabled: number;
}

function readJsonSafe(filePath: string): Record<string, any> | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

export function syncMcpToFiles(db: Database): { synced: string[] } {
  const servers = db.prepare(
    "SELECT * FROM mcp_servers WHERE enabled = 1"
  ).all() as McpServerRow[];

  const byProvider: Record<string, McpServerRow[]> = {};
  for (const s of servers) {
    let providers: string[];
    try { providers = JSON.parse(s.providers); } catch { providers = []; }
    for (const p of providers) {
      (byProvider[p] ??= []).push(s);
    }
  }

  const synced: string[] = [];

  // Claude Code: .claude/settings.local.json → mcpServers
  {
    const settingsPath = path.join(process.cwd(), ".claude", "settings.local.json");
    const existing = readJsonSafe(settingsPath) ?? {};
    const mcpServers: Record<string, any> = {};
    for (const s of byProvider.claude ?? []) {
      const entry: Record<string, any> = { command: s.command };
      try { entry.args = JSON.parse(s.args); } catch { entry.args = []; }
      const env = safeParseObj(s.env);
      if (env && Object.keys(env).length > 0) entry.env = env;
      mcpServers[s.server_key] = entry;
    }
    existing.mcpServers = mcpServers;
    ensureDir(path.dirname(settingsPath));
    fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2), "utf-8");
    synced.push("claude");
  }

  // Cursor: .cursor/mcp.json
  {
    const mcpPath = path.join(process.cwd(), ".cursor", "mcp.json");
    const config: Record<string, any> = { mcpServers: {} };
    for (const s of byProvider.cursor ?? []) {
      const entry: Record<string, any> = { command: s.command };
      try { entry.args = JSON.parse(s.args); } catch { entry.args = []; }
      const env = safeParseObj(s.env);
      if (env && Object.keys(env).length > 0) entry.env = env;
      config.mcpServers[s.server_key] = entry;
    }
    ensureDir(path.dirname(mcpPath));
    fs.writeFileSync(mcpPath, JSON.stringify(config, null, 2), "utf-8");
    synced.push("cursor");
  }

  // Gemini: .gemini/settings.json → mcpServers
  {
    const settingsPath = path.join(process.cwd(), ".gemini", "settings.json");
    const existing = readJsonSafe(settingsPath) ?? {};
    const mcpServers: Record<string, any> = {};
    for (const s of byProvider.gemini ?? []) {
      const entry: Record<string, any> = { command: s.command };
      try { entry.args = JSON.parse(s.args); } catch { entry.args = []; }
      const env = safeParseObj(s.env);
      if (env && Object.keys(env).length > 0) entry.env = env;
      mcpServers[s.server_key] = entry;
    }
    existing.mcpServers = mcpServers;
    ensureDir(path.dirname(settingsPath));
    fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2), "utf-8");
    synced.push("gemini");
  }

  return { synced };
}

function safeParseObj(json: string): Record<string, string> | null {
  try {
    const obj = JSON.parse(json);
    return typeof obj === "object" && obj !== null ? obj : null;
  } catch {
    return null;
  }
}
