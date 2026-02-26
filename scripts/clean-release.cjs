"use strict";
const fs = require("fs");
const path = require("path");
// electron-builder 출력 폴더만 정리 (release는 건드리지 않음 → 이전 빌드가 잠겨 있어도 새 빌드 성공)
const releaseDir = path.join(__dirname, "..", "release-new");
if (fs.existsSync(releaseDir)) {
  try {
    fs.rmSync(releaseDir, { recursive: true, force: true, maxRetries: 2 });
    console.log("[clean-release] Removed release-new/");
  } catch (err) {
    console.warn("[clean-release] Could not remove release-new/ (folder may be in use). Continuing; if build fails, close HyperClaw.exe and retry.");
  }
}
