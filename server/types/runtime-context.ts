/**
 * Typed interface for the runtime context assembled in server-main.ts.
 * Re-exports all context types; composite RuntimeContext for IDE/IntelliSense.
 *
 * Module files keep `// @ts-nocheck` — these types have no compile-time effect.
 */

export type {
  MessageInsertInput,
  StoredMessage,
  MessageIngressAuditOutcome,
  MessageIngressAuditInput,
  TaskCreationAuditInput,
} from "./runtime-context-helpers.ts";

export type { BaseRuntimeContext } from "./runtime-context-base.ts";
export type { WorkflowCoreExports } from "./runtime-context-workflow-core.ts";
export type { WorkflowAgentExports } from "./runtime-context-workflow-agent.ts";
export type { WorkflowOrchestrationExports } from "./runtime-context-workflow-orchestration.ts";
export type { RouteCollabExports } from "./runtime-context-route-collab.ts";
export type { RouteOpsExports } from "./runtime-context-route-ops.ts";
export type { RuntimeContextAutoAugmented } from "./runtime-context-augmented.ts";

import type { BaseRuntimeContext } from "./runtime-context-base.ts";
import type { WorkflowCoreExports } from "./runtime-context-workflow-core.ts";
import type { WorkflowAgentExports } from "./runtime-context-workflow-agent.ts";
import type { WorkflowOrchestrationExports } from "./runtime-context-workflow-orchestration.ts";
import type { RouteCollabExports } from "./runtime-context-route-collab.ts";
import type { RouteOpsExports } from "./runtime-context-route-ops.ts";
import type { RuntimeContextAutoAugmented } from "./runtime-context-augmented.ts";

export type RuntimeContext = BaseRuntimeContext &
  WorkflowCoreExports &
  WorkflowAgentExports &
  WorkflowOrchestrationExports &
  RouteCollabExports &
  RouteOpsExports &
  RuntimeContextAutoAugmented;
