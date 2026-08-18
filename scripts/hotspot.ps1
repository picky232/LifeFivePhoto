<#
  모바일 핫스팟을 켜고 끈다.

  사용법:
    powershell -File hotspot.ps1 on
    powershell -File hotspot.ps1 off
    powershell -File hotspot.ps1 status
#>
param(
  [ValidateSet('on', 'off', 'status')]
  [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'

function Get-TetheringManager {
  [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager, Windows.Networking.NetworkOperators, ContentType = WindowsRuntime] | Out-Null
  [Windows.Networking.Connectivity.NetworkInformation, Windows.Networking.Connectivity, ContentType = WindowsRuntime] | Out-Null

  # 이 API 는 인터넷 연결 프로파일이 있어야 만들 수 있다.
  # 핫스팟 자체는 인터넷 없이도 동작하지만, 여기서는 상단 연결이 하나 필요하다.
  $connection = [Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()

  if (-not $connection) {
    return $null
  }

  return [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($connection)
}

# 켜고 끄는 전환이 끝날 때까지 기다린다.
# 무선 어댑터를 다시 잡는 과정이라 30초를 넘길 때가 있어 넉넉히 잡는다.
function Wait-Settled($manager, [int]$TimeoutSeconds = 90) {
  for ($i = 0; $i -lt $TimeoutSeconds; $i++) {
    if ($manager.TetheringOperationalState -ne 'InTransition') {
      break
    }
    Start-Sleep -Seconds 1
  }

  return $manager.TetheringOperationalState
}

function Get-HotspotAddress {
  $found = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -like '192.168.137.*' -or $_.IPAddress -like '192.168.138.*' } |
    Select-Object -First 1

  if ($found) { return $found.IPAddress }
  return $null
}

function Show-Info($manager) {
  $state = $manager.TetheringOperationalState
  Write-Host "핫스팟 상태 : $state"

  if ($state -ne 'On') {
    return
  }

  $ap = $manager.GetCurrentAccessPointConfiguration()
  $ip = Get-HotspotAddress

  Write-Host "Wi-Fi 이름  : $($ap.Ssid)"
  Write-Host "비밀번호    : $($ap.Passphrase)"

  if ($ip) {
    Write-Host "접속 주소   : https://$ip`:3000"
  } else {
    Write-Host "접속 주소   : 아직 주소가 잡히지 않았습니다. 잠시 후 다시 확인하세요."
  }
}

$manager = Get-TetheringManager

if (-not $manager) {
  Write-Host ""
  Write-Host "핫스팟을 조작할 수 없습니다."
  Write-Host "노트북이 인터넷에 연결되어 있어야 이 기능을 쓸 수 있습니다."
  Write-Host "Wi-Fi 나 휴대폰 테더링에 먼저 연결한 뒤 다시 실행하세요."
  Write-Host "또는 설정 > 네트워크 및 인터넷 > 모바일 핫스팟 에서 직접 켜도 됩니다."
  Write-Host ""
  exit 1
}

switch ($Action) {
  'on' {
    if ($manager.TetheringOperationalState -eq 'On') {
      Write-Host "핫스팟이 이미 켜져 있습니다."
    } else {
      Write-Host "핫스팟을 켜는 중... (수십 초 걸릴 수 있습니다)"
      $manager.StartTetheringAsync() | Out-Null
      Wait-Settled $manager | Out-Null
    }

    Show-Info $manager

    if ($manager.TetheringOperationalState -ne 'On') {
      Write-Host ""
      Write-Host "핫스팟이 켜지지 않았습니다. 설정 > 네트워크 및 인터넷 > 모바일 핫스팟 에서 직접 켜보세요."
      exit 1
    }
  }

  'off' {
    if ($manager.TetheringOperationalState -eq 'Off') {
      Write-Host "핫스팟이 이미 꺼져 있습니다."
    } else {
      Write-Host "핫스팟을 끄는 중..."
      $manager.StopTetheringAsync() | Out-Null
      Wait-Settled $manager | Out-Null
      Write-Host "핫스팟 상태 : $($manager.TetheringOperationalState)"
    }
  }

  'status' {
    Show-Info $manager
  }
}
