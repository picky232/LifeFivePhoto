# LifeFivePhoto

## 실행 전 설명 규칙

명령(Bash / PowerShell)을 실행하거나 파일을 생성·수정·삭제하기 전에, 무엇을 할 것인지 한두 줄로 먼저 설명한다.

설명에 포함할 내용:

- **무엇을**: 실행할 명령 또는 수정할 파일 경로
- **왜**: 그 작업이 필요한 이유
- **결과**: 이 작업으로 무엇이 바뀌는지

형식은 짧게 유지한다. 여러 명령을 연달아 실행할 때는 각 명령마다 반복하지 말고, 묶음 단위로 한 번만 설명한다.

읽기 전용 작업(파일 읽기, 검색, 디렉터리 목록 조회)은 설명을 생략해도 된다.

### 되돌릴 수 없는 작업

다음 작업은 설명만으로 진행하지 말고, 실행 전에 반드시 사용자 확인을 받는다.

- 파일·디렉터리 삭제 (`rm`, `Remove-Item`)
- `git push --force`, `git reset --hard`
- 원격 서버로의 배포 또는 전송
- 시스템 설정 변경, 패키지 전역 설치

### 예시

```
package.json 의존성 설치. node_modules 생성됨.
> npm install
```

```
src/auth.ts 수정. 토큰 만료 비교가 `<` 라서 경계값에서 통과함. `<=` 로 변경.
```

## 프로젝트 메모

- 언어: 한국어로 응답.
- 아이패드 웹에서 사진 8장을 찍어 5장을 고르고, 프레임을 얹어 노트북에 저장하는 로컬 도구. 상세는 `기획서.md`, 실행 방법은 `README.md`.

### 자주 쓰는 명령

```bash
# 서버 (노트북)
cd server && npm install
npm start                 # 3000번 포트
npm test                  # API 명세 대조 (16항목)
npm run test:e2e          # 부스 흐름 통합 (10단계, 크롬 필요)

# 클라이언트
cd client-src && pnpm install
pnpm lint
pnpm build
robocopy out ..\client /MIR   # 빌드 결과를 client/ 로 미러링

# 프레임
node scripts/check-frame.js client-src/public/frames/classic.png
node docs/frame-spec/make-guide.js
```

`client/` 는 `client-src/` 의 빌드 결과물이고 커밋해 둔다. **클라이언트를 고쳤으면 빌드와 미러링까지 해야 반영된다.**

### 손대면 안 되는 것

- `server/certs/`, `output/` 은 저장소에서 제외한다. 키와 손님 사진이 들어 있다.
- 프레임 칸 좌표의 기준은 `client-src/src/lib/frame.ts` 의 `SLOTS` 하나다. 문서·도구는 그 값을 따라간다.
