<#
  부스 운영 종료.

  3000번 포트를 쓰는 서버를 멈추고 핫스팟을 끈다.
  서버 창을 찾지 못하거나 최소화해 잃어버렸을 때 쓴다.
#>

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "==============================================="
Write-Host "  분경5컷 부스 종료"
Write-Host "==============================================="
Write-Host ""

# ── 서버 ─────────────────────────────────────────────────
# 포트를 쥐고 있는 프로세스만 고른다. 이름으로 찾으면 관계없는
# node 프로그램까지 같이 끄게 된다.
$listeners = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue

if (-not $listeners) {
  Write-Host "서버가 실행 중이지 않습니다."
} else {
  $pids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($processId in $pids) {
    $target = Get-Process -Id $processId -ErrorAction SilentlyContinue

    if (-not $target) {
      continue
    }

    Write-Host "서버를 멈추는 중: $($target.ProcessName) (PID $processId)"

    try {
      Stop-Process -Id $processId -Force -ErrorAction Stop
    } catch {
      Write-Host "  멈추지 못했습니다: $($_.Exception.Message)"
    }
  }

  # 포트가 풀릴 때까지 잠깐 기다린다
  for ($i = 0; $i -lt 10; $i++) {
    Start-Sleep -Milliseconds 300
    if (-not (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)) {
      break
    }
  }

  if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
    Write-Host "3000번 포트가 아직 열려 있습니다. 서버 창을 직접 닫아주세요."
  } else {
    Write-Host "서버를 멈췄습니다."
  }
}

Write-Host ""

# ── 핫스팟 ───────────────────────────────────────────────
& (Join-Path $scriptDir 'hotspot.ps1') off

Write-Host ""
Write-Host "-----------------------------------------------"
Write-Host "  정리했습니다."
Write-Host "-----------------------------------------------"
Write-Host ""
