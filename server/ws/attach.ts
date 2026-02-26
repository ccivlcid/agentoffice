/**
 * WebSocket server attach: create wss and connection handler.
 */

import type { IncomingMessage } from "node:http";
import type { Server } from "node:http";
import { WebSocketServer } from "ws";
import { PKG_VERSION } from "../config/runtime.ts";

export interface WsAttachContext {
  isIncomingMessageOriginTrusted(req: IncomingMessage): boolean;
  isIncomingMessageAuthenticated(req: IncomingMessage): boolean;
  wsClients: Set<import("ws").WebSocket>;
  nowMs(): number;
}

export function attachWebSocketServer(
  server: Server,
  ctx: WsAttachContext,
): WebSocketServer {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws: import("ws").WebSocket, req: IncomingMessage) => {
    if (!ctx.isIncomingMessageOriginTrusted(req) || !ctx.isIncomingMessageAuthenticated(req)) {
      ws.close(1008, "unauthorized");
      return;
    }
    ctx.wsClients.add(ws);
    console.log(`[HyperClaw] WebSocket client connected (total: ${ctx.wsClients.size})`);

    ws.send(
      JSON.stringify({
        type: "connected",
        payload: { version: PKG_VERSION, app: "HyperClaw" },
        ts: ctx.nowMs(),
      }),
    );

    ws.on("close", () => {
      ctx.wsClients.delete(ws);
      console.log(`[HyperClaw] WebSocket client disconnected (total: ${ctx.wsClients.size})`);
    });

    ws.on("error", () => {
      ctx.wsClients.delete(ws);
    });
  });

  return wss;
}
