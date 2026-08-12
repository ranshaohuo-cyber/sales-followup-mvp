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
$Frontend = Join-Path $Root "sales-copilot-preview"
$LanIp = Get-LanIp
$BackendPhoneUrl = "http://" + $LanIp + ":8000"
$FrontendPhoneUrl = "http://" + $LanIp + ":5173"

$env:VITE_API_BASE_URL = $BackendPhoneUrl

Write-Host ""
Write-Host "Frontend ready for phone demo:"
Write-Host "  Computer: http://127.0.0.1:5173"
Write-Host ("  Phone:    " + $FrontendPhoneUrl)
Write-Host ("  API:      " + $env:VITE_API_BASE_URL)
Write-Host ""

Set-Location $Frontend
npm.cmd run dev -- --host 0.0.0.0 --port 5173
