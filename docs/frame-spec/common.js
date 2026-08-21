'use strict';

/**
 * 프레임 틀 만드는 스크립트들이 함께 쓰는 것 — 저장소 위치, 크롬, 내보낼 폴더.
 *
 * 경로를 스크립트마다 적어두면 사람이 바뀌거나 저장소를 다른 데 받았을 때
 * 전부 안 돈다. 여기서 한 번만 찾는다.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

/** 저장소 뿌리 — 이 파일이 docs/frame-spec 안에 있다는 것을 기준으로 잡는다 */
const ROOT = path.join(__dirname, '..', '..');

/** 학과 마스코트와 학교 심벌이 있는 곳 */
const BRAND_DIR = path.join(ROOT, 'client', 'brand');

/**
 * 크롬 실행 파일.
 *
 * 캔버스로 그림을 그리는 데만 쓴다. 설치 위치가 사람마다 달라서 몇 군데를
 * 훑고, 못 찾으면 CHROME_PATH 로 알려달라고 한다.
 */
function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  const dirs = [
    process.env.PROGRAMFILES,
    process.env['PROGRAMFILES(X86)'],
    process.env.LOCALAPPDATA,
  ].filter(Boolean);

  const found = dirs
    .map((d) => path.join(d, 'Google', 'Chrome', 'Application', 'chrome.exe'))
    .find((p) => fs.existsSync(p));

  if (!found) {
    throw new Error(
      '크롬을 못 찾았습니다. 설치 위치를 CHROME_PATH 로 알려주세요.\n' +
        '  예) CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"',
    );
  }
  return found;
}

/**
 * puppeteer-core 를 가져온다.
 *
 * 이 폴더에는 node_modules 를 두지 않는다. 서버가 이미 갖고 있는 것을 빌려 쓴다 —
 * 같은 것을 두 벌 받아두면 판이 갈라진다.
 */
function loadPuppeteer() {
  const at = path.join(ROOT, 'server', 'node_modules', 'puppeteer-core');
  try {
    return require(at);
  } catch {
    throw new Error(`puppeteer-core 가 없습니다. server 폴더에서 npm install 을 먼저 하세요.\n  찾은 곳: ${at}`);
  }
}

/**
 * 내보낼 폴더.
 *
 * 결과물은 저장소에 넣지 않는다 — 다 합쳐 4MB 가 넘고, 언제든 다시 뽑을 수 있다.
 * 서버가 사진을 저장하는 곳과 같은 규칙으로 바탕화면을 찾는다.
 */
function defaultOutDir() {
  const home = os.homedir();
  const desktop =
    [
      path.join(home, 'Desktop'),
      path.join(home, 'OneDrive', 'Desktop'),
      path.join(home, 'OneDrive', '바탕 화면'),
    ].find((d) => fs.existsSync(d)) || home;
  return path.join(desktop, 'output', '분경5컷_프레임_틀');
}

/** 첫 번째 인자로 받되, 없으면 바탕화면 output 밑으로 보낸다 */
function outDirFromArgs() {
  return process.argv[2] || defaultOutDir();
}

/** 그림 파일을 data: 주소로 바꾼다 — 크롬 안에서 바로 불러 쓰려고 */
function brandDataUrl(file) {
  const at = path.join(BRAND_DIR, file);
  if (!fs.existsSync(at)) throw new Error(`그림을 못 찾았습니다: ${at}`);
  return 'data:image/png;base64,' + fs.readFileSync(at).toString('base64');
}

/** 캔버스만 쓰는 빈 페이지를 띄운다 */
async function openCanvasPage() {
  const puppeteer = loadPuppeteer();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-spec-'));

  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: 'new',
    userDataDir: profileDir,
    args: ['--no-sandbox', '--force-device-scale-factor=1'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 400, height: 400 });
  await page.setContent('<!doctype html><meta charset="utf-8"><body style="margin:0"></body>');

  const close = async () => {
    await browser.close().catch(() => {});
    try {
      fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
    } catch {
      /* 임시 폴더라 지워지지 않아도 그만이다 */
    }
  };

  return { page, close };
}

/** data: 주소로 받은 그림들을 파일로 쓴다 */
function writeAll(outDir, files) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const name of Object.keys(files).sort()) {
    const buf = Buffer.from(files[name].split(',')[1], 'base64');
    fs.writeFileSync(path.join(outDir, name), buf);
    console.log(`  ${name}  ${Math.round(buf.length / 1024)}KB`);
  }
}

module.exports = {
  ROOT,
  BRAND_DIR,
  chromePath,
  loadPuppeteer,
  defaultOutDir,
  outDirFromArgs,
  brandDataUrl,
  openCanvasPage,
  writeAll,
};
