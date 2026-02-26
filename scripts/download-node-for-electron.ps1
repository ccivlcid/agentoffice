# Node 22 Windows x64를 build/node/에 받아서 Electron 패키징 시 함께 번들합니다.
# 실행: .\scripts\download-node-for-electron.ps1
$NODE_VERSION = "v22.22.0"
$NODE_ZIP = "node-$NODE_VERSION-win-x64.zip"
$URL = "https://nodejs.org/dist/$NODE_VERSION/$NODE_ZIP"
$ROOT = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$BUILD_DIR = Join-Path $ROOT "build"
$BUILD_NODE = Join-Path $BUILD_DIR "node"
$ZIP_PATH = Join-Path $env:TEMP $NODE_ZIP

Write-Host "[download-node] Downloading $URL ..."
New-Item -ItemType Directory -Force -Path $BUILD_DIR | Out-Null
Invoke-WebRequest -Uri $URL -OutFile $ZIP_PATH -UseBasicParsing

Write-Host "[download-node] Extracting to $BUILD_NODE ..."
if (Test-Path $BUILD_NODE) { Remove-Item $BUILD_NODE -Recurse -Force }
Expand-Archive -Path $ZIP_PATH -DestinationPath $BUILD_DIR -Force
$EXTRACTED = Join-Path $BUILD_DIR "node-$NODE_VERSION-win-x64"
Rename-Item $EXTRACTED $BUILD_NODE

Remove-Item $ZIP_PATH -Force -ErrorAction SilentlyContinue
$nodeExe = Join-Path $BUILD_NODE "node.exe"
if (Test-Path $nodeExe) {
  Write-Host "[download-node] Done. node.exe at $nodeExe"
} else {
  Write-Error "[download-node] node.exe not found after extract."
  exit 1
}
