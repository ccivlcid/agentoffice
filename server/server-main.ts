// @ts-nocheck
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import type { BaseRuntimeContext, RuntimeContext } from "./types/runtime-context.ts";

import {
  DIST_DIR,
  IS_PRODUCTION,
} from "./config/runtime.ts";
import {
  IN_PROGRESS_ORPHAN_GRACE_MS,
  IN_PROGRESS_ORPHAN_SWEEP_MS,
  SUBTASK_DELEGATION_SWEEP_MS,
  initializeDatabaseRuntime,
} from "./db/runtime.ts";
import {
  installSecurityMiddleware,
  isIncomingMessageAuthenticated,
  isIncomingMessageOriginTrusted,
} from "./security/auth.ts";
import {
  assertRuntimeFunctionsResolved,
  createDeferredRuntimeProxy,
} from "./modules/deferred-runtime.ts";
import { ROUTE_RUNTIME_HELPER_KEYS } from "./modules/runtime-helper-keys.ts";
import { startLifecycle } from "./modules/lifecycle.ts";
import { registerApiRoutes } from "./modules/routes.ts";
import { initializeWorkflow } from "./modules/workflow.ts";

// Sub-module imports
import {
  makeRunInTransaction,
  nowMs,
  firstQueryValue,
  readSettingString as readSettingStringRaw,
} from "./init/helpers.ts";
import {
  createSecurityAuditLogger,
} from "./init/security-audit.ts";
export type { TaskCreationAuditInput } from "./init/security-audit.ts";
import {
  IdempotencyConflictError,
  StorageBusyError,
  withSqliteBusyRetry,
  resolveMessageIdempotencyKey,
  makeInsertMessageWithIdempotency,
  makeRollbackMessageInsertAfterAuditFailure,
  makeRecordAcceptedIngressAuditOrRollback,
} from "./init/message-idempotency.ts";
import { createSchema } from "./init/schema.ts";
import {
  runMigrationspart1,
  migrateOAuthActiveAccountsTable,
  migrateLegacyOAuthCredentialsToAccounts,
  getActiveOAuthAccountIds as getActiveOAuthAccountIdsRaw,
  setActiveOAuthAccount as setActiveOAuthAccountRaw,
  removeActiveOAuthAccount as removeActiveOAuthAccountRaw,
  setOAuthActiveAccounts as setOAuthActiveAccountsRaw,
  ensureOAuthActiveAccount as ensureOAuthActiveAccountRaw,
} from "./init/migrations-part1.ts";
import {
  runMigrationsPart2,
  migrateMessagesDirectiveType,
  migrateMessagesReceiverTypeTeamLeaders,
  migrateLegacyTasksStatusSchema,
  repairLegacyTaskForeignKeys,
  ensureMessagesIdempotencySchema,
} from "./init/migrations-part2.ts";
import {
  seedDefaultData,
  seedDefaultSettings,
  seedDepartmentOrderAndAgents,
  migrateAgentNamesToFamous,
  removeDuplicateAgents,
} from "./init/seed-data.ts";

// ---------------------------------------------------------------------------
// App + DB bootstrap
// ---------------------------------------------------------------------------
const app = express();
installSecurityMiddleware(app);

const { dbPath, db, logsDir } = initializeDatabaseRuntime();
const distDir = DIST_DIR;
const isProduction = IS_PRODUCTION;

// ---------------------------------------------------------------------------
// Core helpers (bound to db instance)
// ---------------------------------------------------------------------------
const runInTransaction = makeRunInTransaction(db);
const readSettingString = (key: string) => readSettingStringRaw(db, key);

// ---------------------------------------------------------------------------
// Schema + Migrations
// ---------------------------------------------------------------------------
createSchema(db);
runMigrationspart1(db);
migrateOAuthActiveAccountsTable(db);
migrateLegacyOAuthCredentialsToAccounts(db);
runMigrationsPart2(db);
migrateMessagesDirectiveType(db);
migrateMessagesReceiverTypeTeamLeaders(db);
migrateLegacyTasksStatusSchema(db);
repairLegacyTaskForeignKeys(db);
ensureMessagesIdempotencySchema(db);

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------
seedDefaultData(db);
migrateAgentNamesToFamous(db);
removeDuplicateAgents(db);
seedDefaultSettings(db);
seedDepartmentOrderAndAgents(db);

// ---------------------------------------------------------------------------
// OAuth helpers (bound to db instance)
// ---------------------------------------------------------------------------
const getActiveOAuthAccountIds = (provider: string) =>
  getActiveOAuthAccountIdsRaw(db, provider);

const setActiveOAuthAccount = (provider: string, accountId: string) =>
  setActiveOAuthAccountRaw(db, provider, accountId);

const removeActiveOAuthAccount = (provider: string, accountId: string) =>
  removeActiveOAuthAccountRaw(db, provider, accountId);

const setOAuthActiveAccounts = (provider: string, accountIds: string[]) =>
  setOAuthActiveAccountsRaw(db, runInTransaction, provider, accountIds);

const ensureOAuthActiveAccount = (provider: string) =>
  ensureOAuthActiveAccountRaw(db, provider);

// ---------------------------------------------------------------------------
// Security audit + message ingress
// ---------------------------------------------------------------------------
const { recordMessageIngressAuditOr503, recordTaskCreationAudit, setTaskCreationAuditCompletion } =
  createSecurityAuditLogger(logsDir, { nowMs, db });

const insertMessageWithIdempotency = makeInsertMessageWithIdempotency(db);
const rollbackMessageInsertAfterAuditFailure = makeRollbackMessageInsertAfterAuditFailure(db);
const recordAcceptedIngressAuditOrRollback = makeRecordAcceptedIngressAuditOrRollback(
  recordMessageIngressAuditOr503,
  rollbackMessageInsertAfterAuditFailure,
);

// ---------------------------------------------------------------------------
// Runtime context assembly
// ---------------------------------------------------------------------------
const runtimeContext: Record<string, any> & BaseRuntimeContext = {
  app,
  db,
  dbPath,
  logsDir,
  distDir,
  isProduction,
  nowMs,
  runInTransaction,
  firstQueryValue,
  readSettingString,

  IN_PROGRESS_ORPHAN_GRACE_MS,
  IN_PROGRESS_ORPHAN_SWEEP_MS,
  SUBTASK_DELEGATION_SWEEP_MS,

  ensureOAuthActiveAccount,
  getActiveOAuthAccountIds,
  setActiveOAuthAccount,
  setOAuthActiveAccounts,
  removeActiveOAuthAccount,
  isIncomingMessageAuthenticated,
  isIncomingMessageOriginTrusted,

  IdempotencyConflictError,
  StorageBusyError,
  insertMessageWithIdempotency,
  resolveMessageIdempotencyKey,
  withSqliteBusyRetry,
  recordMessageIngressAuditOr503,
  recordAcceptedIngressAuditOrRollback,
  recordTaskCreationAudit,
  setTaskCreationAuditCompletion,

  WebSocket,
  WebSocketServer,
  express,

  DEPT_KEYWORDS: {},
};

const runtimeProxy = createDeferredRuntimeProxy(runtimeContext);

Object.assign(runtimeContext, initializeWorkflow(runtimeProxy as RuntimeContext));
Object.assign(runtimeContext, registerApiRoutes(runtimeContext as RuntimeContext));

assertRuntimeFunctionsResolved(runtimeContext, ROUTE_RUNTIME_HELPER_KEYS, "route helper wiring");

startLifecycle(runtimeContext as RuntimeContext);
