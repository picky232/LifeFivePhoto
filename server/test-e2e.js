'use strict';

/**
 * 부스 흐름 전체를 브라우저로 한 번 돌려보는 통합 테스트.
 *
 * 클라이언트가 실제로 촬영·합성·업로드까지 마치고, 서버가 그 결과를 파일로
 * 남기는지 확인한다. test-api.js 가 서버 응답만 보는 것과 달리 이쪽은
 * 클라이언트 코드를 실제로 실행한다.
 *
 * 몇 가지 전제:
 * - 설치된 Chrome 을 그대로 쓴다 (puppeteer-core). 브라우저를 따로 받지 않는다.
 * - 서버를 HTTP 로 띄우고 localhost 로 접속한다. Chrome 은 http://localhost 를
 *   보안 컨텍스트로 취급하므로 인증서 없이도 getUserMedia 가 열린다.
 *   실제 아이패드는 HTTPS 와 CA 설치가 필요하며, 그건 이 테스트로 확인할 수 없다.
 * - 카메라는 Chrome 의 가짜 장치를 쓴다. 권한 팝업이 뜨지 않고 결과가 일정하다.
 *
 * 실행: npm run test:e2e
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const PORT = 3444;
const BASE_URL = `http://localhost:${PORT}`;
const SERVER_PATH = path.join(__dirname, 'server.js');
const PHONE = '01099887766';

// 촬영은 8장 × 10초라 1분 20초쯤 걸린다. 넉넉하게 잡는다.
const SHOOT_TIMEOUT_MS = 150000;

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

let outputDir;
let profileDir;
let serverProcess;
let browser;
const serverLog = [];
const steps = [];

function log(message) {
  console.log(`  ${message}`);
}

function todayFolder() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function findChrome() {
  const found = CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate));

  if (!found) {
    throw new Error('Chrome 을 찾지 못했습니다. CHROME_PATH 환경변수로 지정하세요.');
  }

  return found;
}

/** 화면에 특정 문구가 나타날 때까지 기다린다. */
async function waitForText(page, text, timeout = 30000) {
  await page.waitForFunction(
    (needle) => document.body && document.body.innerText.includes(needle),
    { timeout, polling: 500 },
    text
  );
}

/**
 * 글자로 버튼을 찾아 누른다. 비활성 버튼은 건너뛴다.
 *
 * 좌표 클릭 대신 DOM 의 click() 을 부른다. 화면 밖이거나 다른 요소에 가려도
 * 눌리고, React 는 루트에서 이벤트를 받으므로 그대로 동작한다.
 */
async function clickByText(page, text, { exact = false, timeout = 30000 } = {}) {
  await page.waitForFunction(
    (needle, wantExact) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some((b) => {
        if (b.disabled) return false;
        const label = b.innerText.trim();
        return wantExact ? label === needle : label.includes(needle);
      });
    },
    { timeout, polling: 200 },
    text,
    exact
  );

  const clicked = await page.evaluate(
    (needle, wantExact) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const target = buttons.find((b) => {
        if (b.disabled) return false;
        const label = b.innerText.trim();
        return wantExact ? label === needle : label.includes(needle);
      });

      if (!target) return false;
      target.click();
      return true;
    },
    text,
    exact
  );

  if (!clicked) {
    throw new Error(`버튼을 찾지 못했습니다: ${text}`);
  }
}

async function startServer() {
  outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifefivephoto-e2e-'));

  // 인증서 폴더를 없는 경로로 돌려 HTTP 로 뜨게 한다.
  // localhost 는 인증서 없이도 Chrome 이 보안 컨텍스트로 인정한다.
  serverProcess = spawn(process.execPath, [SERVER_PATH], {
    cwd: __dirname,
    env: {
      ...process.env,
      PORT: String(PORT),
      OUTPUT_DIR: outputDir,
      CERT_DIR: path.join(os.tmpdir(), 'lifefivephoto-no-certs'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout.on('data', (chunk) => serverLog.push(chunk.toString()));
  serverProcess.stderr.on('data', (chunk) => serverLog.push(chunk.toString()));

  const deadline = Date.now() + 15000;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) {
        return;
      }
    } catch (err) {
      // 아직 기동 중
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`서버가 시작되지 않았습니다.\n${serverLog.join('')}`);
}

async function startBrowser() {
  profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifefivephoto-profile-'));

  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || findChrome(),
    headless: 'new',
    userDataDir: profileDir,
    args: [
      // 카메라 권한 팝업을 띄우지 않고 가짜 영상을 흘려보낸다
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
      '--no-sandbox',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 1024 });

  return page;
}

async function cleanup() {
  if (browser) {
    // 브라우저가 완전히 닫히기 전에 프로필 폴더를 지우면 Windows 에서 EPERM 이 난다
    await browser.close().catch(() => {});
  }
  if (serverProcess) {
    serverProcess.kill();
  }

  for (const dir of [outputDir, profileDir]) {
    if (!dir) continue;

    // 파일 핸들이 늦게 풀리는 경우가 있어 몇 번 다시 시도한다.
    // 임시 폴더라 못 지워도 테스트 결과에는 영향이 없다.
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
    } catch (err) {
      // 남겨둬도 OS 가 정리한다
    }
  }
}

async function run() {
  const page = await startBrowser();
  const consoleErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  log('페이지 여는 중...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });

  const secure = await page.evaluate(() => ({
    isSecureContext: window.isSecureContext,
    hasGetUserMedia: Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
  }));

  if (!secure.isSecureContext || !secure.hasGetUserMedia) {
    throw new Error(`보안 컨텍스트가 아닙니다: ${JSON.stringify(secure)}`);
  }
  steps.push('보안 컨텍스트 확인 (getUserMedia 사용 가능)');

  log('시작 화면...');
  await clickByText(page, '시작하기');
  steps.push('시작 화면에서 진입');

  log('안내 화면 (카메라 켜지는 중)...');
  await waitForText(page, '이렇게 합니다');

  const cameraFailed = await page.evaluate(() =>
    document.body.innerText.includes('카메라를 열 수 없습니다')
  );

  if (cameraFailed) {
    throw new Error('클라이언트가 카메라를 열지 못했습니다.');
  }
  steps.push('카메라 열림 (안내 화면에 오류 없음)');

  await clickByText(page, '촬영 시작');

  log('촬영 중 (8장 × 10초, 약 80초)...');
  await waitForText(page, '마음에 드는', SHOOT_TIMEOUT_MS);
  steps.push('8장 촬영 완료');

  log('5장 고르는 중...');
  const thumbnails = await page.$$('button img');

  if (thumbnails.length < 8) {
    throw new Error(`촬영본이 8장이 아닙니다: ${thumbnails.length}장`);
  }

  for (let i = 0; i < 5; i++) {
    await thumbnails[i].click();
  }
  steps.push(`촬영본 ${thumbnails.length}장 중 5장 선택`);

  await clickByText(page, '이 사진으로 만들기');

  log('프레임 고르는 중...');
  await waitForText(page, '어떤 프레임으로 할까요');
  // 프레임마다 견본을 합성하므로 버튼이 열릴 때까지 시간이 걸린다
  await clickByText(page, '이 프레임으로', { timeout: 90000 });
  steps.push('프레임 선택');

  log('합성 결과 확인 중...');
  await waitForText(page, '이렇게 나옵니다');

  // 합성은 화면이 뜬 뒤 비동기로 끝난다. 결과가 붙을 때까지 기다린다.
  try {
    await page.waitForSelector('img[alt="완성된 분경5컷"]', { timeout: 60000 });
  } catch (err) {
    const shown = await page.evaluate(() => document.body.innerText);
    throw new Error(`합성 결과가 나오지 않았습니다. 화면 내용: ${shown.slice(0, 300)}`);
  }

  const frameSize = await page.evaluate(async () => {
    const img = document.querySelector('img[alt="완성된 분경5컷"]');
    if (!img) return null;
    if (!img.complete) {
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    }
    return { w: img.naturalWidth, h: img.naturalHeight };
  });

  if (!frameSize || !frameSize.w) {
    throw new Error('합성 이미지를 읽지 못했습니다.');
  }
  steps.push(`합성 완료 (${frameSize.w}×${frameSize.h})`);

  await clickByText(page, '선택 완료');

  log('전화번호 입력 중...');
  await waitForText(page, '번호를 눌러주세요');

  // 숫자판은 글자가 정확히 한 자다. 부분 일치로 찾으면 안내 문구가 든 다른
  // 버튼까지 걸리므로 완전 일치로 누른다.
  for (const digit of PHONE) {
    await clickByText(page, digit, { exact: true, timeout: 10000 });
  }

  const shown = await page.evaluate(() => document.body.innerText);
  const formatted = '010-9988-7766';

  if (!shown.includes(formatted)) {
    throw new Error(`번호가 입력되지 않았습니다. 화면에서 ${formatted} 를 찾지 못했습니다.`);
  }

  // 동의 항목을 눌러야 전송 버튼이 열린다
  const agreed = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const consent = buttons.find((b) => b.innerText.includes('삭제합니다'));
    if (!consent) return false;
    consent.click();
    return true;
  });

  if (!agreed) {
    throw new Error('동의 항목을 찾지 못했습니다.');
  }
  steps.push(`번호 ${formatted} 입력 및 동의`);

  await clickByText(page, '확인', { exact: true });

  log('업로드 중...');
  await waitForText(page, '요청했습니다', 90000);
  steps.push('업로드 성공 (클라이언트가 완료 화면으로 진행)');

  const expected = path.join(outputDir, todayFolder(), `${PHONE}.png`);

  if (!fs.existsSync(expected)) {
    const found = fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir, { recursive: true }).join(', ')
      : '(폴더 없음)';
    throw new Error(`저장 파일이 없습니다: ${expected}\n실제 내용: ${found}`);
  }

  const saved = fs.statSync(expected);
  const header = fs.readFileSync(expected).subarray(0, 8);
  const isPng = header.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  if (!isPng) {
    throw new Error('저장된 파일이 PNG 가 아닙니다.');
  }
  steps.push(
    `서버에 저장 확인: ${todayFolder()}/${PHONE}.png (${(saved.size / 1024 / 1024).toFixed(2)} MB, PNG)`
  );

  if (consoleErrors.length) {
    log('');
    log('브라우저 콘솔 오류:');
    for (const err of consoleErrors.slice(0, 5)) {
      log(`  ${err}`);
    }
  }

  return consoleErrors;
}

async function main() {
  console.log('');
  console.log('부스 흐름 통합 테스트');
  console.log('-'.repeat(78));

  let failure = null;
  let consoleErrors = [];

  try {
    await startServer();
    consoleErrors = await run();
  } catch (err) {
    failure = err;
  }

  await cleanup();

  console.log('-'.repeat(78));

  for (const step of steps) {
    console.log(`  PASS  ${step}`);
  }

  if (failure) {
    console.log(`  FAIL  ${failure.message}`);
    console.log('-'.repeat(78));
    console.log('');
    process.exit(1);
  }

  console.log('-'.repeat(78));
  console.log(`  전 과정 통과 (${steps.length}단계)`);

  if (consoleErrors.length) {
    console.log(`  참고: 브라우저 콘솔 오류 ${consoleErrors.length}건`);
  }

  console.log('');
}

main();
