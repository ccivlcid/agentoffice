// @ts-nocheck
/**
 * Core API: tasks and subtasks CRUD, run, stop, resume, assign.
 *
 * This file re-exports registerCoreTasks and delegates to sub-modules:
 *   - tasks-queries.ts   : GET /api/tasks, GET /api/tasks/:id, GET /api/tasks/:id/meeting-minutes, GET /api/subtasks
 *   - tasks-create.ts    : POST /api/tasks, PATCH /api/tasks/:id, POST /api/tasks/bulk-hide, DELETE /api/tasks/:id
 *   - tasks-subtasks.ts  : POST /api/tasks/:id/subtasks, PATCH /api/subtasks/:id, POST /api/tasks/:id/assign
 *   - tasks-run.ts       : POST /api/tasks/:id/run
 *   - tasks-git-info.ts  : GET /api/tasks/:id/git-info
 *   - tasks-stop.ts      : POST /api/tasks/:id/stop, POST /api/tasks/:id/resume
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import { registerTaskQueries } from "./tasks-queries.ts";
import { registerTaskCreate } from "./tasks-create.ts";
import { registerTaskSubtasks } from "./tasks-subtasks.ts";
import { registerTaskRun } from "./tasks-run.ts";
import { registerTaskGitInfo } from "./tasks-git-info.ts";
import { registerTaskStop } from "./tasks-stop.ts";
import { registerTaskTimeline } from "./tasks-timeline.ts";
import { registerTaskClone } from "./tasks-clone.ts";

export function registerCoreTasks(ctx: RuntimeContext): void {
  registerTaskQueries(ctx);
  registerTaskCreate(ctx);
  registerTaskSubtasks(ctx);
  registerTaskRun(ctx);
  registerTaskGitInfo(ctx);
  registerTaskStop(ctx);
  registerTaskTimeline(ctx);
  registerTaskClone(ctx);
}
