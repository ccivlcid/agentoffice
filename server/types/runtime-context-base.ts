/**
 * BaseRuntimeContext — properties from the runtimeContext literal (server-main.ts).
 */

import type { IncomingMessage } from "node:http";
import type { DatabaseSync } from "node:sqlite";
import type { Express } from "express";
import type {
  MessageInsertInput,
  StoredMessage,
  MessageIngressAuditInput,
  TaskCreationAuditInput,
} from "./runtime-context-helpers.ts";

export interface BaseRuntimeContext {
  app: Express;
  db: DatabaseSync;
  dbPath: string;
  logsDir: string;
  distDir: string;
  isProduction: boolean;

  nowMs(): number;
  runInTransaction(fn: () => void): void;
  firstQueryValue(value: unknown): string | undefined;

  IN_PROGRESS_ORPHAN_GRACE_MS: number;
  IN_PROGRESS_ORPHAN_SWEEP_MS: number;
  SUBTASK_DELEGATION_SWEEP_MS: number;

  ensureOAuthActiveAccount(provider: string): void;
  getActiveOAuthAccountIds(provider: string): string[];
  setActiveOAuthAccount(provider: string, accountId: string): void;
  setOAuthActiveAccounts(provider: string, accountIds: string[]): void;
  removeActiveOAuthAccount(provider: string, accountId: string): void;

  isIncomingMessageAuthenticated(req: IncomingMessage): boolean;
  isIncomingMessageOriginTrusted(req: IncomingMessage): boolean;

  IdempotencyConflictError: { new (key: string): Error & { readonly key: string } };
  StorageBusyError: {
    new (operation: string, attempts: number): Error & {
      readonly operation: string;
      readonly attempts: number;
    };
  };

  insertMessageWithIdempotency(
    input: MessageInsertInput,
  ): Promise<{ message: StoredMessage; created: boolean }>;
  resolveMessageIdempotencyKey(
    req: { get(name: string): string | undefined },
    body: Record<string, unknown>,
    scope: string,
  ): string | null;
  withSqliteBusyRetry<T>(operation: string, fn: () => T): Promise<T>;

  recordMessageIngressAuditOr503(
    res: { status(code: number): { json(payload: unknown): unknown } },
    input: MessageIngressAuditInput,
  ): boolean;
  recordAcceptedIngressAuditOrRollback(
    res: { status(code: number): { json(payload: unknown): unknown } },
    input: Omit<MessageIngressAuditInput, "messageId">,
    messageId: string,
  ): Promise<boolean>;
  recordTaskCreationAudit(input: TaskCreationAuditInput): void;
  setTaskCreationAuditCompletion(taskId: string, completed: boolean): void;

  WebSocket: typeof import("ws").WebSocket;
  WebSocketServer: typeof import("ws").WebSocketServer;
  express: typeof import("express");

  DEPT_KEYWORDS: Record<string, string[]>;
}
