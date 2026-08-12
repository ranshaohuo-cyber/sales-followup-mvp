Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root "backend"
$Python = Join-Path $Backend ".venv\Scripts\python.exe"

if (-not (Test-Path $Python)) {
  Write-Host "Creating backend virtual environment..."
  python -m venv (Join-Path $Backend ".venv")
}

Write-Host "Installing backend dependencies..."
& $Python -m pip install -r (Join-Path $Backend "requirements.txt")

Write-Host "Starting backend at http://127.0.0.1:8000"
Set-Location $Backend
& $Python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
