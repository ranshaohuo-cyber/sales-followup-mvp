Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Frontend = Join-Path $Root "sales-copilot-preview"

Write-Host "Starting frontend at http://127.0.0.1:5173"
Set-Location $Frontend
npm.cmd run dev -- --host 127.0.0.1 --port 5173
