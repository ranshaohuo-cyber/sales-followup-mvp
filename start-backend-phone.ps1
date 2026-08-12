Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-LanIp {
  $lines = ipconfig
  foreach ($line in $lines) {
    if ($line -match "IPv4.*?:\s*([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)") {
      $ip = $Matches[1]
      if ($ip -and $ip -notlike "127.*" -and $ip -notlike "169.254.*") {
        return $ip
      }
    }
  }
  throw "No LAN IPv4 address found. Please connect this computer to WiFi."
}

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root "backend"
$Python = Join-Path $Backend ".venv\Scripts\python.exe"
$LanIp = Get-LanIp
$BackendPhoneUrl = "http://" + $LanIp + ":8000"
$FrontendPhoneUrl = "http://" + $LanIp + ":5173"

if (-not (Test-Path $Python)) {
  Write-Host "Creating backend virtual environment..."
  python -m venv (Join-Path $Backend ".venv")
}

Write-Host "Installing backend dependencies..."
& $Python -m pip install -r (Join-Path $Backend "requirements.txt")

$env:CORS_ORIGINS = '["http://localhost:5173","http://127.0.0.1:5173","' + $FrontendPhoneUrl + '"]'

Write-Host ""
Write-Host "Backend ready for phone demo:"
Write-Host ("  Local:  http://127.0.0.1:8000")
Write-Host ("  Phone:  " + $BackendPhoneUrl)
Write-Host ""

Set-Location $Backend
& $Python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
