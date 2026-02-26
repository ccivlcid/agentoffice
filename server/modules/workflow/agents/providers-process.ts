// @ts-nocheck
import { execFileSync } from "node:child_process";

export function initProcessHelpers() {

  function killPidTree(pid: number): void {
    if (pid <= 0) return;

    if (process.platform === "win32") {
      try {
        execFileSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore", timeout: 8000 });
      } catch { /* ignore */ }
      return;
    }

    const signalTree = (sig: NodeJS.Signals) => {
      try { process.kill(-pid, sig); } catch { /* ignore */ }
      try { process.kill(pid, sig); } catch { /* ignore */ }
    };
    const isAlive = () => isPidAlive(pid);

    signalTree("SIGTERM");
    setTimeout(() => {
      if (isAlive()) signalTree("SIGKILL");
    }, 1200);
  }

  function isPidAlive(pid: number): boolean {
    if (pid <= 0) return false;
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  function interruptPidTree(pid: number): void {
    if (pid <= 0) return;

    if (process.platform === "win32") {
      try { execFileSync("taskkill", ["/pid", String(pid), "/T"], { stdio: "ignore", timeout: 8000 }); } catch { /* ignore */ }
      setTimeout(() => {
        if (isPidAlive(pid)) {
          try { execFileSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore", timeout: 8000 }); } catch { /* ignore */ }
        }
      }, 1200);
      return;
    }

    const signalTree = (sig: NodeJS.Signals) => {
      try { process.kill(-pid, sig); } catch { /* ignore */ }
      try { process.kill(pid, sig); } catch { /* ignore */ }
    };

    signalTree("SIGINT");
    setTimeout(() => {
      if (isPidAlive(pid)) signalTree("SIGTERM");
    }, 1200);
    setTimeout(() => {
      if (isPidAlive(pid)) signalTree("SIGKILL");
    }, 2600);
  }

  return {
    killPidTree,
    isPidAlive,
    interruptPidTree,
  };
}
