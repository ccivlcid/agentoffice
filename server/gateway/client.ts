/**
 * Gateway / external messenger integration stubs.
 * OpenClaw gateway was removed; override these or add your own webhook implementation.
 */

export function notifyTaskStatus(
  _taskId: string,
  _title: string,
  _status: string,
  _lang?: string,
): void {
  // No-op: implement your own notification (e.g. webhook) if needed.
}

export async function gatewayHttpInvoke(_req: {
  tool: string;
  action?: string;
  args?: Record<string, unknown>;
}): Promise<unknown> {
  throw new Error("gateway not configured");
}
