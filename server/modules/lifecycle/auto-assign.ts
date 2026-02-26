// @ts-nocheck
import type { RuntimeContext } from "../../types/runtime-context.ts";

export async function autoAssignAgentProviders(ctx: RuntimeContext): Promise<void> {
  const { db, broadcast, detectAllCli } = ctx as any;

  const autoAssignRow = db.prepare(
    "SELECT value FROM settings WHERE key = 'autoAssign'"
  ).get() as { value: string } | undefined;
  if (!autoAssignRow || autoAssignRow.value === "false") return;

  const cliStatus = await detectAllCli();
  const authenticated = Object.entries(cliStatus)
    .filter(([, s]) => s.installed && s.authenticated)
    .map(([name]) => name);

  if (authenticated.length === 0) {
    console.log("[HyperClaw] Auto-assign skipped: no authenticated CLI providers");
    return;
  }

  const dpRow = db.prepare(
    "SELECT value FROM settings WHERE key = 'defaultProvider'"
  ).get() as { value: string } | undefined;
  const defaultProv = dpRow?.value?.replace(/"/g, "") || "claude";
  const fallback = authenticated.includes(defaultProv) ? defaultProv : authenticated[0];

  const agents = db.prepare("SELECT id, name, cli_provider FROM agents").all() as Array<{
    id: string;
    name: string;
    cli_provider: string | null;
  }>;

  let count = 0;
  for (const agent of agents) {
    const prov = agent.cli_provider || "";
    if (prov === "copilot" || prov === "antigravity" || prov === "api") continue;
    if (authenticated.includes(prov)) continue;

    db.prepare("UPDATE agents SET cli_provider = ? WHERE id = ?").run(fallback, agent.id);
    broadcast("agent_status", db.prepare("SELECT * FROM agents WHERE id = ?").get(agent.id));
    console.log(`[HyperClaw] Auto-assigned ${agent.name}: ${prov || "none"} → ${fallback}`);
    count++;
  }
  if (count > 0) console.log(`[HyperClaw] Auto-assigned ${count} agent(s)`);
}
