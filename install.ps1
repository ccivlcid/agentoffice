param(
  [string]$AgentsPath = "",
  [int]$Port = 0,
  [switch]$Start
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js 22+ is required. Install from https://nodejs.org/"
}
if (-not (Get-Command corepack -ErrorAction SilentlyContinue)) {
  throw "corepack is required (bundled with Node.js)."
}

corepack enable | Out-Null
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  corepack prepare pnpm@latest --activate | Out-Null
}

Write-Host "[HyperClaw] Installing dependencies..."
pnpm install

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "[HyperClaw] Created .env from .env.example — please set OAUTH_ENCRYPTION_SECRET etc."
}

Write-Host "[HyperClaw] Done. Run: pnpm dev:local"
if ($Start) {
  pnpm dev:local
}
