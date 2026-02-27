// @ts-nocheck
/**
 * MCP Registry — fetches MCP servers from the official registry.
 * GET /api/mcp-registry?search=&limit=&cursor=
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";

export interface McpRegistryEntry {
  name: string;
  title: string;
  description: string;
  repoUrl: string;
  websiteUrl: string;
  version: string;
  iconUrl: string;
  packages: Array<{
    registryType: string;
    identifier: string;
    transportType: string;
    envVars: Array<{ name: string; description: string; isSecret: boolean }>;
  }>;
  remotes: Array<{ type: string; url: string }>;
  publishedAt: string;
  updatedAt: string;
}

const REGISTRY_URL = "https://registry.modelcontextprotocol.io/v0/servers";
const REGISTRY_CACHE_TTL = 3600_000; // 1 hour

let cachedAll: { data: McpRegistryEntry[]; loadedAt: number } | null = null;

function parseEntry(raw: any): McpRegistryEntry {
  const s = raw.server ?? raw;
  const meta = raw._meta?.["io.modelcontextprotocol.registry/official"] ?? {};
  return {
    name: s.name ?? "",
    title: s.title ?? s.name ?? "",
    description: s.description ?? "",
    repoUrl: s.repository?.url ?? "",
    websiteUrl: s.websiteUrl ?? "",
    version: s.version ?? "",
    iconUrl: s.icons?.[0]?.src ?? "",
    packages: (s.packages ?? []).map((p: any) => ({
      registryType: p.registryType ?? "",
      identifier: p.identifier ?? "",
      transportType: p.transport?.type ?? "stdio",
      envVars: (p.environmentVariables ?? []).map((e: any) => ({
        name: e.name ?? "",
        description: e.description ?? "",
        isSecret: Boolean(e.isSecret),
      })),
    })),
    remotes: (s.remotes ?? []).map((r: any) => ({
      type: r.type ?? "",
      url: r.url ?? "",
    })),
    publishedAt: meta.publishedAt ?? "",
    updatedAt: meta.updatedAt ?? "",
  };
}

async function fetchAllFromRegistry(): Promise<McpRegistryEntry[]> {
  const all: McpRegistryEntry[] = [];
  let cursor: string | undefined;
  const limit = 100;
  const maxPages = 20;

  for (let page = 0; page < maxPages; page++) {
    const url = new URL(REGISTRY_URL);
    url.searchParams.set("limit", String(limit));
    if (cursor) url.searchParams.set("cursor", cursor);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const resp = await fetch(url.toString(), { signal: controller.signal });
      clearTimeout(timeout);
      if (!resp.ok) break;
      const json = await resp.json();
      const servers = json.servers ?? [];
      for (const entry of servers) {
        all.push(parseEntry(entry));
      }
      cursor = json.metadata?.nextCursor;
      if (!cursor || servers.length < limit) break;
    } catch {
      clearTimeout(timeout);
      break;
    }
  }
  return all;
}

export function registerOpsMcpRegistry(ctx: RuntimeContext): void {
  const { app } = ctx;

  app.get("/api/mcp-registry", async (req: any, res: any) => {
    const search = String(req.query.search ?? "").trim().toLowerCase();

    // Use cached data if fresh
    if (!cachedAll || Date.now() - cachedAll.loadedAt >= REGISTRY_CACHE_TTL) {
      const data = await fetchAllFromRegistry();
      if (data.length > 0) {
        cachedAll = { data, loadedAt: Date.now() };
      }
    }

    let entries = cachedAll?.data ?? [];
    if (search) {
      entries = entries.filter(
        (e) =>
          e.name.toLowerCase().includes(search) ||
          e.title.toLowerCase().includes(search) ||
          e.description.toLowerCase().includes(search),
      );
    }

    res.json({ ok: true, servers: entries, total: cachedAll?.data?.length ?? 0 });
  });
}
