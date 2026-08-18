'use strict';

/**
 * 부스 화면을 방향별로 캡처한다.
 *
 * 세로와 가로에서 각 단계가 어떻게 보이는지 비교하려고 만들었다.
 * test-e2e.js 와 같은 방식으로 서버를 띄우고 브라우저를 몰아간다.
 *
 * 실행: node screenshot-booth.js [출력폴더]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const PORT = 3445;
const BASE_URL = `http://localhost:${PORT}`;
const SERVER_PATH = path.join(__dirname, 'server.js');
const OUT_DIR = process.argv[2] || path.join(__dirname, '..', 'screenshots');

const PHONE = '01011112222';

// iPad Air 11형 기준. 세로와 가로를 같은 기기로 맞춰야 비교가 된다.
const ORIENTATIONS = [
  { name: 'portrait', label: '세로', width: 820, height: 1180 },
  { name: 'landscape', label: '가로', width: 1180, height: 820 },
];

// 경로를 문자열로 적으면 역슬래시가 이스케이프로 먹힌다. path.join 으로 만든다.
const CHROME_CANDIDATES = [
  path.join('C:', 'Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join('C:', 'Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
];

let outputDir;
let profileDir;
let serverProcess;
let browser;

function findChrome() {
  const found = CHROME_CANDIDATES.find((c) => fs.existsSync(c));
  if (!found) throw new Error('Chrome 을 찾지 못했습니다.');
  return found;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForText(page, text, timeout = 30000) {
  await page.waitForFunction(
    (needle) => document.body && document.body.innerText.includes(needle),
    { timeout, polling: 400 },
    text
  );
}

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

  await page.evaluate(
    (needle, wantExact) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const target = buttons.find((b) => {
        if (b.disabled) return false;
        const label = b.innerText.trim();
        return wantExact ? label === needle : label.includes(needle);
      });
      if (target) target.click();
    },
    text,
    exact
  );
}

async function startServer() {
  outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifefivephoto-shot-'));

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

  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) return;
    } catch (e) {
      /* 기동 중 */
    }
    await sleep(300);
  }

  throw new Error('서버가 시작되지 않았습니다.');
}

async function capture(page, dir, order, name) {
  const file = path.join(dir, `${String(order).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file });
  console.log(`    ${path.basename(file)}`);
}

async function walk(orientation) {
  const dir = path.join(OUT_DIR, orientation.name);
  fs.mkdirSync(dir, { recursive: true });

  console.log(`\n  [${orientation.label}] ${orientation.width}x${orientation.height}`);

  const page = await browser.newPage();
  await page.setViewport({ width: orientation.width, height: orientation.height });
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(700);

  await capture(page, dir, 1, 'idle');

  await clickByText(page, '시작하기');
  await sleep(600);
  await capture(page, dir, 2, 'splash');

  await waitForText(page, '이렇게 합니다');
  await sleep(400);
  await capture(page, dir, 3, 'guide');

  await clickByText(page, '촬영 시작');
  await sleep(3000);
  await capture(page, dir, 4, 'shoot');

  await waitForText(page, '마음에 드는', 150000);
  await sleep(600);
  await capture(page, dir, 5, 'select-empty');

  const thumbs = await page.$$('button img');
  for (let i = 0; i < 5; i++) {
    await thumbs[i].click();
    await sleep(120);
  }
  await sleep(400);
  await capture(page, dir, 6, 'select-full');

  // 고르기 화면의 버튼은 "이 사진으로 만들기",
  // 미리보기 화면의 버튼이 "선택 완료" 다. 순서를 바꾸면 못 찾는다.
  await clickByText(page, '이 사진으로 만들기');
  await waitForText(page, '이렇게 나옵니다');
  await page.waitForSelector('img[alt="완성된 인생네컷"]', { timeout: 60000 });
  await sleep(600);
  await capture(page, dir, 7, 'preview');

  await clickByText(page, '선택 완료');
  await waitForText(page, '번호를 눌러주세요');
  await sleep(400);
  await capture(page, dir, 8, 'phone-empty');

  for (const digit of PHONE) {
    await clickByText(page, digit, { exact: true, timeout: 8000 });
  }
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) =>
      x.innerText.includes('삭제합니다')
    );
    if (b) b.click();
  });
  await sleep(400);
  await capture(page, dir, 9, 'phone-filled');

  await clickByText(page, '확인', { exact: true });
  await waitForText(page, '요청했습니다', 90000);
  await sleep(500);
  await capture(page, dir, 10, 'printing-done');

  await clickByText(page, '확인');
  await waitForText(page, '다 됐어요');
  await sleep(500);
  await capture(page, dir, 11, 'done');

  await page.close();
}

async function main() {
  console.log('');
  console.log('부스 화면 캡처');
  console.log('-'.repeat(60));

  try {
    await startServer();

    profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifefivephoto-shot-profile-'));
    browser = await puppeteer.launch({
      executablePath: process.env.CHROME_PATH || findChrome(),
      headless: 'new',
      userDataDir: profileDir,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
        '--no-sandbox',
      ],
    });

    for (const orientation of ORIENTATIONS) {
      await walk(orientation);
    }

    console.log('');
    console.log('-'.repeat(60));
    console.log(`저장 위치: ${OUT_DIR}`);
    console.log('');
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (serverProcess) serverProcess.kill();
    for (const d of [outputDir, profileDir]) {
      if (d) {
        try {
          fs.rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
        } catch (e) {
          /* 임시 폴더라 남아도 괜찮다 */
        }
      }
    }
  }
}

main().catch((err) => {
  console.error('캡처 실패:', err.message);
  process.exit(1);
});
