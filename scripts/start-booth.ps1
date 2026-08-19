<#
  부스 운영 시작.

  핫스팟을 켜고 접속 정보를 보여준 뒤 서버를 띄운다.
  이 창을 닫으면 서버도 함께 멈춘다.
#>

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
$serverDir = Join-Path $rootDir 'server'

Write-Host ""
Write-Host "==============================================="
Write-Host "  분경5컷 부스 시작"
Write-Host "==============================================="
Write-Host ""

# ── 사전 점검 ────────────────────────────────────────────
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js 를 찾을 수 없습니다. 설치한 뒤 다시 실행하세요."
  Read-Host "엔터를 누르면 닫힙니다"
  exit 1
}

if (-not (Test-Path (Join-Path $serverDir 'node_modules'))) {
  Write-Host "의존성이 설치되어 있지 않습니다. 설치를 시작합니다..."
  Push-Location $serverDir
  npm install
  Pop-Location
  Write-Host ""
}

# 인증서가 없으면 서버가 HTTP 로 뜨고, 그러면 카메라가 열리지 않는다.
# 행사 도중에 알면 늦으므로 여기서 먼저 잡는다.
$certDir = Join-Path $serverDir 'certs'

if (-not (Test-Path (Join-Path $certDir 'server.pem'))) {
  Write-Host "인증서가 없습니다. 지금 만듭니다..."
  Write-Host "(인증서가 없으면 카메라가 열리지 않습니다)"
  Write-Host ""
  Push-Location $serverDir
  node generate-cert.js
  Pop-Location
  Write-Host ""
}

# 서버가 이미 떠 있으면 Node 가 EADDRINUSE 스택을 그대로 뱉는다.
# 행사 중에 그 화면이 뜨면 원인을 알기 어려우므로 여기서 먼저 알린다.
$busy = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue

if ($busy) {
  Write-Host "3000번 포트를 이미 쓰고 있습니다."
  Write-Host "서버가 다른 창에서 이미 돌고 있을 수 있습니다."
  Write-Host ""

  foreach ($conn in $busy) {
    $owner = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
    if ($owner) {
      Write-Host "  실행 중: $($owner.ProcessName) (PID $($owner.Id))"
    }
  }

  Write-Host ""
  Write-Host "그 창을 닫고 다시 실행하세요."
  Read-Host "엔터를 누르면 닫힙니다"
  exit 1
}

# ── 핫스팟 ───────────────────────────────────────────────
& (Join-Path $scriptDir 'hotspot.ps1') on
Write-Host ""

# ── 서버 ─────────────────────────────────────────────────
Write-Host "-----------------------------------------------"
Write-Host "  서버를 시작합니다. 이 창을 닫으면 멈춥니다."
Write-Host "-----------------------------------------------"
Write-Host ""

Set-Location $serverDir
node server.js
