import type { Agent, Task } from "../types";
import { appendCapped, MAX_LIVE_SUBAGENTS, MAX_SUBAGENT_STREAM_TAIL_CHARS,
  MAX_SUBAGENT_STREAM_TRACKED_TASKS, MAX_CODEX_THREAD_BINDINGS,
  CODEX_THREAD_BINDING_TTL_MS, shouldParseCliChunkForSubAgents } from "../appHelpers";
import type { SubAgent } from "../appHelpers";
import { parseCliSubAgentEvents } from "../appWsHelpers";

export type CliOutputHandlerRefs = {
  agentsRef: React.RefObject<Agent[]>;
  tasksRef: React.RefObject<Task[]>;
  subAgentsRef: React.RefObject<SubAgent[]>;
  codexThreadToSubAgentIdRef: React.RefObject<Map<string, string>>;
  codexThreadBindingTsRef: React.RefObject<Map<string, number>>;
  subAgentStreamTailRef: React.RefObject<Map<string, string>>;
  setSubAgents: React.Dispatch<React.SetStateAction<SubAgent[]>>;
};

export function buildCliOutputHandler(refs: CliOutputHandlerRefs) {
  const {
    agentsRef, tasksRef, subAgentsRef,
    codexThreadToSubAgentIdRef, codexThreadBindingTsRef, subAgentStreamTailRef,
    setSubAgents,
  } = refs;

  return (payload: unknown) => {
    const p = payload as { task_id?: string; data?: string };
    if (typeof p.task_id !== "string" || typeof p.data !== "string") return;

    const threadMap = codexThreadToSubAgentIdRef.current;
    const threadTsMap = codexThreadBindingTsRef.current;

    const prune = (now: number) => {
      for (const [tid, ts] of threadTsMap.entries()) {
        if (now - ts <= CODEX_THREAD_BINDING_TTL_MS) continue;
        threadTsMap.delete(tid); threadMap.delete(tid);
      }
      if (threadMap.size <= MAX_CODEX_THREAD_BINDINGS) return;
      const entries = Array.from(threadTsMap.entries()).sort((a, b) => a[1] - b[1]);
      const overflow = threadMap.size - MAX_CODEX_THREAD_BINDINGS;
      for (let i = 0; i < overflow && i < entries.length; i++) {
        threadTsMap.delete(entries[i][0]); threadMap.delete(entries[i][0]);
      }
    };

    const now = Date.now();
    prune(now);

    const tailMap = subAgentStreamTailRef.current;
    const setTail = (taskId: string, raw: string) => {
      const t = raw.length > MAX_SUBAGENT_STREAM_TAIL_CHARS
        ? raw.slice(raw.length - MAX_SUBAGENT_STREAM_TAIL_CHARS) : raw;
      if (!t) { tailMap.delete(taskId); return; }
      if (!tailMap.has(taskId) && tailMap.size >= MAX_SUBAGENT_STREAM_TRACKED_TASKS) {
        const oldest = tailMap.keys().next().value as string | undefined;
        if (oldest) tailMap.delete(oldest);
      }
      tailMap.set(taskId, t);
    };

    const combined = (tailMap.get(p.task_id) ?? "") + p.data;
    let lines: string[];
    const nl = combined.lastIndexOf("\n");
    if (nl < 0) {
      setTail(p.task_id, combined);
      const c = combined.trim();
      if (c && c[0] === "{" && c[c.length - 1] === "}" && shouldParseCliChunkForSubAgents(c)) {
        lines = [c]; setTail(p.task_id, "");
      } else return;
    } else {
      const complete = combined.slice(0, nl);
      setTail(p.task_id, combined.slice(nl + 1));
      if (!shouldParseCliChunkForSubAgents(complete)) return;
      lines = complete.split("\n");
    }

    const knownIds = new Set(subAgentsRef.current.map((s) => s.id));
    const doneIds = new Set(subAgentsRef.current.filter((s) => s.status === "done").map((s) => s.id));
    let cachedParent: string | null | undefined;

    const resolveParent = () => {
      if (cachedParent !== undefined) return cachedParent;
      cachedParent =
        agentsRef.current.find((a) => a.current_task_id === p.task_id)?.id ??
        tasksRef.current.find((t) => t.id === p.task_id)?.assigned_agent_id ?? null;
      return cachedParent;
    };

    const upsert = (id: string, task: string | null) => {
      knownIds.add(id); doneIds.delete(id);
      const parent = resolveParent();
      setSubAgents((prev) => {
        const idx = prev.findIndex((s) => s.id === id);
        if (idx >= 0) {
          const cur = prev[idx];
          const nt = task ?? cur.task;
          const np = cur.parentAgentId || parent || cur.parentAgentId;
          if (cur.task === nt && cur.parentAgentId === np) return prev;
          const next = [...prev]; next[idx] = { ...cur, task: nt, parentAgentId: np }; return next;
        }
        if (!parent) return prev;
        return appendCapped(prev, { id, parentAgentId: parent, task: task ?? "Sub-task", status: "working" as const }, MAX_LIVE_SUBAGENTS);
      });
    };

    const markDone = (id: string) => {
      if (!knownIds.has(id) || doneIds.has(id)) return;
      doneIds.add(id);
      for (const [tid, mid] of threadMap.entries()) {
        if (mid !== id) continue; threadMap.delete(tid); threadTsMap.delete(tid);
      }
      setSubAgents((prev) => {
        const idx = prev.findIndex((s) => s.id === id);
        if (idx < 0 || prev[idx].status === "done") return prev;
        const next = [...prev]; next[idx] = { ...prev[idx], status: "done" as const }; return next;
      });
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line[0] !== "{" || !shouldParseCliChunkForSubAgents(line)) continue;
      let json: Record<string, unknown>;
      try { json = JSON.parse(line) as Record<string, unknown>; } catch { continue; }
      for (const ev of parseCliSubAgentEvents(json)) {
        if (ev.kind === "spawn") { upsert(ev.id, ev.task); continue; }
        if (ev.kind === "done") { markDone(ev.id); continue; }
        if (ev.kind === "bind_thread") {
          threadMap.set(ev.threadId, ev.subAgentId);
          threadTsMap.set(ev.threadId, now);
          if (threadMap.size > MAX_CODEX_THREAD_BINDINGS) prune(now);
          continue;
        }
        const mid = threadMap.get(ev.threadId);
        if (!mid) continue;
        threadMap.delete(ev.threadId); threadTsMap.delete(ev.threadId);
        markDone(mid);
      }
    }
  };
}
