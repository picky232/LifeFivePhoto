# LifeFivePhoto (인생오컷)

아이패드 웹에서 사진 8장을 촬영하고 그중 5장을 골라 인생네컷 스타일로 합성한 뒤, 노트북에 저장하는 로컬 도구.

상세 기획은 [기획서.md](기획서.md) 참고.

## 구조

```
[아이패드 · 클라이언트]              [노트북 · 서버 + 핫스팟 호스트]
  촬영 8장 → 5장 선택
  canvas 합성 → 전화번호 입력
        │
        │ GET /          클라이언트 파일 응답
        │◀───────────────
        │ POST /upload   완성 이미지 + 전화번호
        │───────────────▶
                              output/{날짜}/{전화번호}.png 로 저장
```

노트북이 직접 모바일 핫스팟을 켜고, 아이패드는 그 핫스팟에 접속한다. 장소 Wi-Fi나 인터넷에 의존하지 않는다.

| 담당 | 범위 |
|---|---|
| 서버 | `server/`, 핫스팟·인증서·방화벽 등 노트북 환경 |
| 클라이언트 | `client-src/` 촬영·선택·합성 UI |

`client/` 는 `client-src/` 를 빌드한 결과물이다. 행사 노트북에서 빌드 없이 바로 서빙하려고 커밋해 둔다. 클라이언트를 고쳤다면 아래를 거쳐야 반영된다.

```bash
cd client-src
pnpm install
pnpm build
# 빌드 결과를 client/ 로 옮긴다 (없어진 파일까지 정리되도록 미러링)
robocopy out ..\client /MIR
```

## 실행

### 배치 파일 (행사 당일)

준비가 끝난 뒤에는 배치 파일 두 개로 운영한다.

| 파일 | 하는 일 |
|---|---|
| `부스-시작.bat` | 핫스팟 켜기 + 서버 실행 |
| `부스-종료.bat` | 서버 멈추기 + 핫스팟 끄기 |

`부스-시작.bat` 은 핫스팟을 켜고 Wi-Fi 이름, 비밀번호, 접속 주소를 보여준 뒤 서버를 띄운다. 실행 전에 아래를 먼저 확인하고 빠진 것이 있으면 알아서 채운다.

- Node.js 설치 여부
- `server/node_modules` — 없으면 `npm install`
- 인증서 — 없으면 `node generate-cert.js`
- 3000번 포트 — 이미 쓰고 있으면 어떤 프로그램인지 알려주고 멈춘다

서버는 그 창에서 계속 돌아간다. 창을 닫거나 `Ctrl+C` 를 눌러도 멈추지만, 창을 최소화해 잃어버렸을 때는 `부스-종료.bat` 을 쓴다. 3000번 포트를 쥐고 있는 프로세스만 골라 멈추므로 관계없는 프로그램은 건드리지 않는다. 이미 꺼져 있어도 그냥 넘어간다.

아래 절차는 처음 준비할 때나 문제가 생겼을 때 참고한다.

### 0. 노트북 핫스팟 켜기

접속 기기가 붙을 네트워크를 노트북이 직접 만든다.

```
설정 > 네트워크 및 인터넷 > 모바일 핫스팟 > 켜기
```

같은 화면에서 네트워크 이름과 비밀번호를 확인할 수 있다. 핫스팟을 켜면 노트북에 `192.168.137.1`이 부여된다. 이 값은 Windows가 고정으로 지정하므로 장소가 바뀌어도 동일하다.

PowerShell로 조작하려면:

```powershell
[Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime] | Out-Null
[Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime] | Out-Null
$profile = [Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()
$tm = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($profile)

$tm.TetheringOperationalState       # 현재 상태
$tm.StartTetheringAsync()           # 켜기
$tm.StopTetheringAsync()            # 끄기
```

`GetInternetConnectionProfile()`은 노트북에 인터넷 연결이 있어야 값을 반환한다. 핫스팟 자체는 인터넷 없이도 동작하지만, 이 API로 조작하려면 상단 연결이 하나 필요하다.

부여된 주소 확인:

```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object IPAddress -like '192.168.137.*'
```

### 1. 의존성 설치

```bash
cd server
npm install
```

### 2. 인증서 생성

Safari의 카메라 API(`getUserMedia`)는 신뢰된 HTTPS에서만 동작하므로 로컬 인증서가 필요하다.

```bash
node generate-cert.js
```

`server/certs/` 아래에 CA와 서버 인증서가 생성된다. 이 폴더는 저장소에 포함되지 않으므로 각자 한 번씩 실행해야 한다. CA가 이미 있으면 기존 CA를 재사용한다.

### 3. 서버 실행

```bash
npm start
```

기동 시 접속 가능한 주소가 출력된다. 노트북 핫스팟을 켠 상태라면 `https://192.168.137.1:3000`이 포함된다.

인증서가 없으면 HTTP로 기동하고 경고를 출력한다. 이 경우 카메라 API는 동작하지 않는다.

### 4. 접속 기기에 CA 설치 (최초 1회)

`server/certs/ca/rootCA.pem`을 접속할 기기로 전달한 뒤:

```
1. 파일을 열면 "프로파일이 다운로드됨" 알림이 뜬다
2. 설정 > 일반 > VPN 및 기기 관리 > 해당 프로파일 > 설치
3. 설정 > 일반 > 정보 > 인증서 신뢰 설정 > LifeFivePhoto Local CA 켜기
```

3번을 빼먹으면 프로파일을 설치해도 Safari가 인증서를 신뢰하지 않는다.

### 5. 방화벽 (Windows, 최초 1회)

3000/TCP 인바운드 허용 규칙이 필요하다. 서버 첫 실행 시 뜨는 방화벽 대화상자에서 "개인 네트워크"를 체크하고 허용하면 된다.

## API

베이스 주소: `https://192.168.137.1:3000`

### `GET /`

`client/` 폴더의 정적 파일을 서빙한다.

### `POST /upload`

완성 이미지와 전화번호를 업로드한다.

**요청** — `multipart/form-data`

| 필드 | 타입 | 설명 |
|---|---|---|
| `photo` | File (Blob) | `image/png`, `canvas.toBlob()` 결과 |
| `phone` | 문자열 | 전화번호. 숫자만 추출해 9~11자리만 허용하며 하이픈은 자동 제거된다 |

**응답**

```json
// 200
{ "success": true, "filename": "2026-08-13/01012345678.png" }

// 400 — 전화번호 또는 이미지 누락, 형식 오류, 용량 초과(20MB)
{ "success": false, "error": "전화번호가 없습니다." }

// 500 — 저장 실패
{ "success": false, "error": "파일 저장에 실패했습니다." }
```

같은 날 같은 번호로 다시 업로드하면 덮어쓰지 않고 `01012345678_2.png` 형태로 저장한다.

### `GET /health`

```json
{ "status": "ok" }
```

## 테스트

두 가지가 있다. 둘 다 별도 포트와 임시 저장 경로를 쓰므로, 운영 중인 서버가 3000번에서 돌고 있어도 함께 실행할 수 있고 실제 저장 폴더도 건드리지 않는다.

### API 명세 대조

```bash
cd server
npm test
```

명세의 각 항목을 검사한다(16개). 서버 기동부터 정리까지 자동으로 하며, 실패가 하나라도 있으면 종료 코드 1을 반환한다. 인증서가 없으면 실행되지 않으므로 먼저 `node generate-cert.js`를 실행한다.

### 부스 흐름 통합 테스트

```bash
cd server
npm run test:e2e
```

브라우저를 띄워 촬영부터 저장까지 실제로 한 바퀴 돌린다. 8장 촬영이 10초 간격이라 약 100초 걸린다.

설치된 Chrome 을 그대로 쓴다(`puppeteer-core`). 카메라는 Chrome 의 가짜 장치를 써서 권한 창이 뜨지 않는다. 서버는 HTTP 로 띄우고 `localhost` 로 접속하는데, Chrome 이 `http://localhost` 를 보안 컨텍스트로 취급하므로 인증서 없이도 `getUserMedia` 가 열린다.

Chrome 이 기본 경로에 없으면 `CHROME_PATH` 환경변수로 지정한다.

이 테스트는 클라이언트와 서버가 맞물리는지를 확인할 뿐, iOS Safari 의 인증서 처리까지 검증하지는 않는다.

## 노트북에서 직접 확인하기

접속 기기 없이 서버만 확인할 때 쓴다.

```powershell
$ca = "server/certs/ca/rootCA.pem"

curl.exe -s --ssl-revoke-best-effort --cacert $ca https://192.168.137.1:3000/health

curl.exe -s --ssl-revoke-best-effort --cacert $ca -X POST https://192.168.137.1:3000/upload `
  -F "phone=01012345678" -F "photo=@테스트.png;type=image/png"
```

`--ssl-revoke-best-effort`가 필요한 이유: Windows의 curl은 schannel 백엔드를 쓰는데, 인증서의 폐기 목록(CRL) 배포 지점을 찾으려다 실패해 `CERT_TRUST_REVOCATION_STATUS_UNKNOWN` 오류를 낸다. 자체 서명 CA에는 CRL 배포 지점이 없으므로 정상이며, 인증서 자체의 문제가 아니다. iOS Safari는 사용자가 설치한 루트 인증서에 이 검사를 하지 않으므로 실제 사용에는 영향이 없다.

테스트로 만든 파일은 `output/` 아래에 남으므로 확인 후 정리한다.

## 저장 위치

바탕화면의 `output` 폴더에 저장한다. 행사 중에 운영자가 사진을 찾아 인쇄해야 하므로 프로젝트 폴더 안쪽보다 바탕화면이 빠르다.

```
바탕화면/output/
└── 2026-08-13/          업로드 시점 기준 날짜 폴더, 자동 생성
    └── 01012345678.png  전화번호가 파일명
```

경로는 홈 디렉터리를 기준으로 찾는다. OneDrive 백업으로 바탕화면이 옮겨간 경우도 함께 살펴본다. 서버 기동 시 실제 저장 위치가 출력된다.

다른 곳에 저장하려면 `OUTPUT_DIR` 환경변수로 덮어쓴다.

```bash
OUTPUT_DIR=D:\photos npm start
```

전화번호와 얼굴 사진이 담기므로 저장 폴더는 공개 저장소에 올리지 않는다.

## 검증 상태

**서버 (`npm test`, 16개 항목)**

| 항목 | 결과 |
|---|---|
| 핫스팟 IP | `192.168.137.1` 부여 확인 |
| HTTPS 기동 | 인증서가 rootCA로 검증됨 |
| `GET /` | 200, `text/html` |
| 없는 정적 파일 | 404 |
| 없는 화면 | 404, 클라이언트 404 페이지로 응답 |
| `GET /health` | 200, `{"status":"ok"}` |
| `POST /upload` 정상 | 200, 응답 경로에 파일 저장 확인 (바이트 단위 일치) |
| 전화번호 하이픈 | 자동 제거 후 숫자만 파일명에 사용 |
| `POST /upload` 전화번호·이미지 누락 | 400 |
| 전화번호 형식 위반 | 400 (비숫자, 자릿수 미달) |
| 경로 조작 시도 | 400, 상위 경로에 파일 미생성 확인 |
| 용량 초과 (20MB) | 400 |
| 같은 번호 재업로드 | `_2` 접미사로 별도 저장 |

**부스 흐름 (`npm run test:e2e`, 9단계)**

브라우저에서 촬영 8장, 5장 선택, 합성(1200×1800), 번호 입력, 업로드, 저장까지 통과.

**실기기 (iOS)**

CA 설치 후 iPhone Safari 에서 촬영부터 업로드까지 동작을 확인했다. 인증서가 신뢰되지 않으면 `getUserMedia` 가 막혀 촬영 자체가 되지 않으므로, 업로드된 파일이 남았다는 것은 인증서 설치가 유효했다는 뜻이다.

**미검증**

- 아이패드 화면 크기에서의 레이아웃 (지금까지 확인은 iPhone 과 노트북 브라우저 기준)
- 장소 이동 후 핫스팟 재구성 시 동작
- 여러 명이 연달아 사용할 때의 안정성

## 저장소에 포함하지 않는 것

| 대상 | 이유 |
|---|---|
| `server/certs/` | CA·서버 개인키. 유출 시 인증서 사칭 및 통신 복호화 가능 |
| `output/` | 전화번호와 얼굴 사진 |
| `node_modules/` | `npm install`로 복원 |

핫스팟 SSID와 비밀번호도 저장소에 기록하지 않는다.
