// @ts-nocheck
/**
 * CLI model listing helpers: readCodexModelsCache, fetchGeminiModels, toModelInfo.
 * Extracted from cli-models.ts to keep each file under 300 lines.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

export interface CliModelInfoServer {
  slug: string;
  displayName?: string;
  description?: string;
  reasoningLevels?: Array<{ effort: string; description: string }>;
  defaultReasoningLevel?: string;
}

export function readCodexModelsCache(): CliModelInfoServer[] {
  try {
    const cachePath = path.join(os.homedir(), ".codex", "models_cache.json");
    if (!fs.existsSync(cachePath)) return [];
    const raw = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    const modelsArr: Array<{
      slug?: string;
      display_name?: string;
      description?: string;
      visibility?: string;
      priority?: number;
      supported_reasoning_levels?: Array<{ effort: string; description: string }>;
      default_reasoning_level?: string;
    }> = Array.isArray(raw) ? raw : (raw.models || raw.data || []);

    const listModels = modelsArr
      .filter((m) => m.visibility === "list" && m.slug)
      .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));

    return listModels.map((m) => ({
      slug: m.slug!,
      displayName: m.display_name || m.slug!,
      description: m.description,
      reasoningLevels: m.supported_reasoning_levels && m.supported_reasoning_levels.length > 0
        ? m.supported_reasoning_levels
        : undefined,
      defaultReasoningLevel: m.default_reasoning_level || undefined,
    }));
  } catch {
    return [];
  }
}

export function fetchGeminiModels(): CliModelInfoServer[] {
  const FALLBACK: CliModelInfoServer[] = [
    { slug: "gemini-3-pro-preview", displayName: "Gemini 3 Pro Preview" },
    { slug: "gemini-3-flash-preview", displayName: "Gemini 3 Flash Preview" },
    { slug: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro" },
    { slug: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash" },
    { slug: "gemini-2.5-flash-lite", displayName: "Gemini 2.5 Flash Lite" },
  ];

  try {
    const geminiPath = execFileSync("which", ["gemini"], {
      stdio: "pipe", timeout: 5000, encoding: "utf8",
    }).trim();
    if (!geminiPath) return FALLBACK;

    const realPath = fs.realpathSync(geminiPath);
    let dir = path.dirname(realPath);
    let configPath = "";
    for (let i = 0; i < 10; i++) {
      const candidate = path.join(
        dir, "node_modules", "@google", "gemini-cli-core",
        "dist", "src", "config", "defaultModelConfigs.js",
      );
      if (fs.existsSync(candidate)) {
        configPath = candidate;
        break;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }

    if (!configPath) return FALLBACK;

    const content = fs.readFileSync(configPath, "utf8");
    const models: CliModelInfoServer[] = [];
    const entryRegex = /["']([a-z][a-z0-9._-]+)["']\s*:\s*\{([^}]*extends\s*:\s*["']chat-base[^"']*["'][^}]*)\}/g;
    let match;
    while ((match = entryRegex.exec(content)) !== null) {
      const slug = match[1];
      if (slug.startsWith("chat-base")) continue;
      models.push({ slug, displayName: slug });
    }

    return models.length > 0 ? models : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export function toModelInfo(slug: string): CliModelInfoServer {
  return { slug, displayName: slug };
}
