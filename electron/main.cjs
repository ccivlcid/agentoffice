"use strict";

const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const net = require("net");

const PORT = 8790;
const HOST = "127.0.0.1";
const POLL_MS = 50;
const WAIT_READY_MS = 30_000;

/** @type {import("child_process").ChildProcess | null} */
let serverProcess = null;
/** @type {fs.WriteStream | null} */
let logStream = null;

function getLogDir() {
  try {
    if (app.isPackaged) {
      return path.join(path.dirname(process.execPath), "logs");
    }
    return path.join(process.cwd(), "logs");
  } catch {
    return process.cwd();
  }
}

function log(msg, ...args) {
  const line = "[Electron] " + (args.length ? require("util").format(msg, ...args) : msg) + "\n";
  process.stdout.write(line);
  try {
    if (!logStream) {
      const logDir = getLogDir();
      fs.mkdirSync(logDir, { recursive: true });
      const logPath = path.join(logDir, "electron-main.log");
      logStream = fs.createWriteStream(logPath, { flags: "a" });
      logStream.write(new Date().toISOString() + " Log file: " + logPath + "\n");
    }
    logStream.write(new Date().toISOString() + " " + line);
  } catch (e) {
    process.stderr.write(String(e) + "\n");
  }
}

function getAppRoot() {
  if (app.isPackaged) {
    return app.getAppPath();
  }
  return process.cwd();
}

function isPortInUse(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const onDone = (inUse) => {
      socket.destroy();
      resolve(inUse);
    };
    socket.setTimeout(200);
    socket.on("connect", () => onDone(true));
    socket.on("timeout", () => onDone(false));
    socket.on("error", () => onDone(false));
    socket.connect(port, host);
  });
}

function waitForServer() {
  const deadline = Date.now() + WAIT_READY_MS;
  return new Promise((resolve, reject) => {
    const tick = async () => {
      if (Date.now() > deadline) {
        reject(new Error("Server did not become ready in time"));
        return;
      }
      const inUse = await isPortInUse(HOST, PORT);
      if (inUse) {
        resolve();
        return;
      }
      setTimeout(tick, POLL_MS);
    };
    tick();
  });
}

function startServer() {
  const appRoot = getAppRoot();
  const env = {
    ...process.env,
    PORT: String(PORT),
    HOST,
    NODE_ENV: "production",
  };

  if (app.isPackaged) {
    const userData = app.getPath("userData");
    env.DB_PATH = path.join(userData, "hyperclaw.sqlite");
    env.LOGS_DIR = path.join(userData, "logs");
    const bundledNode = path.join(process.resourcesPath, "node", "node.exe");
    const nodePath = fs.existsSync(bundledNode) ? bundledNode : "node";
    const serverEntry = path.join(appRoot, "dist-server", "index.cjs");
    log("Packaged: appRoot=%s nodePath=%s serverEntry=%s", appRoot, nodePath, serverEntry);
    if (!fs.existsSync(serverEntry)) {
      throw new Error("dist-server/index.js not found at " + serverEntry);
    }
    serverProcess = spawn(nodePath, [serverEntry], {
      cwd: appRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } else {
    const tsxPath = path.join(appRoot, "node_modules", "tsx", "dist", "cli.mjs");
    const serverEntry = path.join(appRoot, "server", "index.ts");
    serverProcess = spawn("node", [tsxPath, serverEntry], {
      cwd: appRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  serverProcess.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
    if (logStream) logStream.write(chunk);
  });
  serverProcess.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
    if (logStream) logStream.write(chunk);
  });
  serverProcess.on("error", (err) => {
    log("Server process error: %s", err.message);
  });
  serverProcess.on("exit", (code, signal) => {
    if (code != null && code !== 0) {
      log("Server exited code=%s signal=%s", code, signal);
    }
    serverProcess = null;
  });

  return waitForServer();
}

function killServer() {
  if (serverProcess && serverProcess.pid) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const url = `http://${HOST}:${PORT}`;
  win.loadURL(url);

  win.on("closed", () => {
    killServer();
  });
}

process.on("uncaughtException", (err) => {
  log("uncaughtException: %s\n%s", err.message, err.stack);
  app.quit(1);
});
process.on("unhandledRejection", (reason, p) => {
  log("unhandledRejection: %s", reason);
});

app.whenReady().then(async () => {
  log("app.whenReady");
  try {
    await startServer();
    log("Server ready, creating window");
    createWindow();
  } catch (err) {
    log("Failed to start: %s\n%s", err.message, err.stack);
    app.quit(1);
  }
});

app.on("window-all-closed", () => {
  killServer();
  app.quit();
});

app.on("before-quit", () => {
  killServer();
});
