// @ts-nocheck

import type { RuntimeContext } from "../../types/runtime-context.ts";
import { registerCoreDepartments } from "./core/departments.ts";
import { registerCoreGitHub } from "./core/github.ts";
import { registerCoreProjects } from "./core/projects.ts";
import { registerCoreAgents } from "./core/agents.ts";
import { registerCoreTasks } from "./core/tasks.ts";
import { registerCoreHealthUpdate } from "./core/health-update.ts";

export function registerRoutesPartA(ctx: RuntimeContext): Record<string, never> {
  // ---------------------------------------------------------------------------
  // Health & Update (core/health-update.ts)
  // ---------------------------------------------------------------------------
  registerCoreHealthUpdate(ctx);

  // ---------------------------------------------------------------------------
  // Departments (core/departments.ts)
  // ---------------------------------------------------------------------------
  registerCoreDepartments(ctx);

  // ---------------------------------------------------------------------------
  // Projects (core/projects.ts)
  // ---------------------------------------------------------------------------
  registerCoreProjects(ctx);

  // ---------------------------------------------------------------------------
  // Agents (core/agents.ts)
  // ---------------------------------------------------------------------------
  registerCoreAgents(ctx);

  // ---------------------------------------------------------------------------
  // Tasks / Subtasks (core/tasks.ts)
  // ---------------------------------------------------------------------------
  registerCoreTasks(ctx);

  // ---------------------------------------------------------------------------
  // GitHub (core/github.ts)
  // ---------------------------------------------------------------------------
  registerCoreGitHub(ctx);

  return {};
}
