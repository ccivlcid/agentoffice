// @ts-nocheck

// ---------------------------------------------------------------------------
// CLI stream-json subtask parsing (Claude Code / Codex / Gemini)
// ---------------------------------------------------------------------------

// Codex multi-agent: map thread_id → cli_tool_use_id (item.id from spawn_agent)
export const codexThreadToSubtask = new Map<string, string>();

export function createCliParseHelpers(ctx: {
  db: any;
  createSubtaskFromCli: (...args: any[]) => any;
  completeSubtaskFromCli: (...args: any[]) => any;
}) {
  const { db, createSubtaskFromCli, completeSubtaskFromCli } = ctx;

  function parseAndCreateSubtasks(taskId: string, data: string): void {
    try {
      const lines = data.split("\n").filter(Boolean);
      for (const line of lines) {
        let j: Record<string, unknown>;
        try { j = JSON.parse(line); } catch { continue; }

        // Detect sub-agent spawn: tool_use with tool === "Task" (Claude Code)
        if (j.type === "tool_use" && j.tool === "Task") {
          const toolUseId = (j.id as string) || `sub-${Date.now()}`;
          const existing = db.prepare(
            "SELECT id FROM subtasks WHERE cli_tool_use_id = ?"
          ).get(toolUseId) as { id: string } | undefined;
          if (existing) continue;
          const input = j.input as Record<string, unknown> | undefined;
          const title = (input?.description as string) ||
                        (input?.prompt as string)?.slice(0, 100) ||
                        "Sub-task";
          createSubtaskFromCli(taskId, toolUseId, title);
        }

        // Detect sub-agent completion: tool_result with tool === "Task" (Claude Code)
        if (j.type === "tool_result" && j.tool === "Task") {
          const toolUseId = j.id as string;
          if (!toolUseId) continue;
          completeSubtaskFromCli(toolUseId);
        }

        // ----- Codex multi-agent: spawn_agent / close_agent -----

        // Codex: spawn_agent started → create subtask
        if (j.type === "item.started") {
          const item = j.item as Record<string, unknown> | undefined;
          if (item?.type === "collab_tool_call" && item?.tool === "spawn_agent") {
            const itemId = (item.id as string) || `codex-spawn-${Date.now()}`;
            const existing = db.prepare(
              "SELECT id FROM subtasks WHERE cli_tool_use_id = ?"
            ).get(itemId) as { id: string } | undefined;
            if (!existing) {
              const prompt = (item.prompt as string) || "Sub-agent";
              const title = prompt.split("\n")[0].replace(/^Task:\s*/, "").slice(0, 100);
              createSubtaskFromCli(taskId, itemId, title);
            }
          }
        }

        // Codex: spawn_agent completed → save thread_id mapping
        // Codex: close_agent completed → complete subtask via thread_id
        if (j.type === "item.completed") {
          const item = j.item as Record<string, unknown> | undefined;
          if (item?.type === "collab_tool_call") {
            if (item.tool === "spawn_agent") {
              const itemId = item.id as string;
              const threadIds = (item.receiver_thread_ids as string[]) || [];
              if (itemId && threadIds[0]) {
                codexThreadToSubtask.set(threadIds[0], itemId);
              }
            } else if (item.tool === "close_agent") {
              const threadIds = (item.receiver_thread_ids as string[]) || [];
              for (const tid of threadIds) {
                const origItemId = codexThreadToSubtask.get(tid);
                if (origItemId) {
                  completeSubtaskFromCli(origItemId);
                  codexThreadToSubtask.delete(tid);
                }
              }
            }
          }
        }

        // ----- Gemini: plan-based subtask detection from message -----

        if (j.type === "message" && j.content) {
          const content = j.content as string;
          // Detect plan output: {"subtasks": [...]}
          const planMatch = content.match(/\{"subtasks"\s*:\s*\[.*?\]\}/s);
          if (planMatch) {
            try {
              const plan = JSON.parse(planMatch[0]) as { subtasks: { title: string }[] };
              for (const st of plan.subtasks) {
                const stId = `gemini-plan-${st.title.slice(0, 30).replace(/\s/g, "-")}-${Date.now()}`;
                const existing = db.prepare(
                  "SELECT id FROM subtasks WHERE task_id = ? AND title = ? AND status != 'done'"
                ).get(taskId, st.title) as { id: string } | undefined;
                if (!existing) {
                  createSubtaskFromCli(taskId, stId, st.title);
                }
              }
            } catch { /* ignore malformed JSON */ }
          }
          // Detect completion report: {"subtask_done": "..."}
          const doneMatch = content.match(/\{"subtask_done"\s*:\s*"(.+?)"\}/);
          if (doneMatch) {
            const doneTitle = doneMatch[1];
            const sub = db.prepare(
              "SELECT cli_tool_use_id FROM subtasks WHERE task_id = ? AND title = ? AND status != 'done' LIMIT 1"
            ).get(taskId, doneTitle) as { cli_tool_use_id: string } | undefined;
            if (sub) completeSubtaskFromCli(sub.cli_tool_use_id);
          }
        }
      }
    } catch {
      // Not JSON or not parseable - ignore
    }
  }

  return { parseAndCreateSubtasks };
}
