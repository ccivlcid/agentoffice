// @ts-nocheck
import type { RuntimeContext } from "../types/runtime-context.ts";
import { HOST, PKG_VERSION, PORT } from "../config/runtime.ts";
import { installStaticMiddleware } from "../middleware/static.ts";
import { attachWebSocketServer } from "../ws/attach.ts";
import { rotateBreaks } from "./lifecycle/breaks.ts";
import {
  recoverOrphanInProgressTasks,
  recoverInterruptedWorkflowOnStartup,
  sweepPendingSubtaskDelegations,
} from "./lifecycle/recovery.ts";
import { autoAssignAgentProviders } from "./lifecycle/auto-assign.ts";
import { startTelegramPolling, stopAllPolling } from "../gateway/telegram-polling.ts";

export function startLifecycle(ctx: RuntimeContext): void {
  const {
    IN_PROGRESS_ORPHAN_SWEEP_MS,
    SUBTASK_DELEGATION_SWEEP_MS,
    activeProcesses,
    app,
    db,
    dbPath,
    distDir,
    endTaskExecutionSession,
    getDecryptedOAuthToken,
    isIncomingMessageAuthenticated,
    isIncomingMessageOriginTrusted,
    isProduction,
    killPidTree,
    nowMs,
    refreshGoogleToken,
    rollbackTaskWorktree,
    stopRequestedTasks,
    wsClients,
  } = ctx as any;

  // ---------------------------------------------------------------------------
  // Production: serve React UI from dist/
  // ---------------------------------------------------------------------------
  installStaticMiddleware(app, distDir, isProduction);

  // ---------------------------------------------------------------------------
  // Timers: breaks, recovery, delegation sweep, auto-assign
  // ---------------------------------------------------------------------------
  setTimeout(() => rotateBreaks(ctx), 5_000);
  setInterval(() => rotateBreaks(ctx), 60_000);
  setTimeout(() => recoverInterruptedWorkflowOnStartup(ctx), 3_000);
  setInterval(() => recoverOrphanInProgressTasks(ctx, "interval"), IN_PROGRESS_ORPHAN_SWEEP_MS);
  setTimeout(() => sweepPendingSubtaskDelegations(ctx), 4_000);
  setInterval(() => sweepPendingSubtaskDelegations(ctx), SUBTASK_DELEGATION_SWEEP_MS);
  setTimeout(() => autoAssignAgentProviders(ctx), 4_000);
  setTimeout(() => startTelegramPolling(ctx), 2_000);

  // ---------------------------------------------------------------------------
  // Start HTTP server + WebSocket
  // ---------------------------------------------------------------------------
  const server = app.listen(PORT, HOST, () => {
    console.log(`[HyperClaw] v${PKG_VERSION} listening on http://${HOST}:${PORT} (db: ${dbPath})`);
    if (isProduction) {
      console.log(`[HyperClaw] mode: production (serving UI from ${distDir})`);
    } else {
      console.log(`[HyperClaw] mode: development (UI served by Vite on separate port)`);
    }
  });

  setInterval(
    async () => {
      try {
        const cred = getDecryptedOAuthToken("google_antigravity");
        if (!cred || !cred.refreshToken) return;
        const expiresAtMs = cred.expiresAt && cred.expiresAt < 1e12 ? cred.expiresAt * 1000 : cred.expiresAt;
        if (!expiresAtMs) return;
        if (expiresAtMs < Date.now() + 5 * 60_000) {
          await refreshGoogleToken(cred);
          console.log("[oauth] Background refresh: Antigravity token renewed");
        }
      } catch (err) {
        console.error("[oauth] Background refresh failed:", err instanceof Error ? err.message : err);
      }
    },
    5 * 60 * 1000,
  );

  const wss = attachWebSocketServer(server, {
    isIncomingMessageOriginTrusted,
    isIncomingMessageAuthenticated,
    wsClients,
    nowMs,
  });

  // ---------------------------------------------------------------------------
  // Graceful shutdown
  // ---------------------------------------------------------------------------
  function gracefulShutdown(signal: string): void {
    console.log(`\n[HyperClaw] ${signal} received. Shutting down gracefully...`);
    stopAllPolling();

    for (const [taskId, child] of activeProcesses) {
      console.log(`[HyperClaw] Stopping process for task ${taskId} (pid: ${child.pid})`);
      stopRequestedTasks.add(taskId);
      if (child.pid) {
        killPidTree(child.pid);
      }
      activeProcesses.delete(taskId);

      rollbackTaskWorktree(taskId, "server_shutdown");

      const task = db.prepare("SELECT assigned_agent_id FROM tasks WHERE id = ?").get(taskId) as
        | {
            assigned_agent_id: string | null;
          }
        | undefined;
      if (task?.assigned_agent_id) {
        db.prepare("UPDATE agents SET status = 'idle', current_task_id = NULL WHERE id = ?").run(
          task.assigned_agent_id,
        );
      }
      db.prepare("UPDATE tasks SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = 'in_progress'").run(
        nowMs(),
        taskId,
      );
      endTaskExecutionSession(taskId, "server_shutdown");
    }

    for (const ws of wsClients) {
      ws.close(1001, "Server shutting down");
    }
    wsClients.clear();

    wss.close(() => {
      server.close(() => {
        try {
          db.close();
        } catch {
          /* ignore */
        }
        console.log("[HyperClaw] Shutdown complete.");
        process.exit(0);
      });
    });

    setTimeout(() => {
      console.error("[HyperClaw] Forced exit after timeout.");
      process.exit(1);
    }, 5000).unref();
  }

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

  process.once("SIGUSR2", () => {
    try {
      db.close();
    } catch {
      /* ignore */
    }
    process.kill(process.pid!, "SIGUSR2");
  });
}
