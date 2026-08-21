'use strict';

/**
 * 행사장에 붙이거나 들고 다닐 A4 안내문을 뽑는다.
 *
 * 내용은 README 의 절차를 그대로 옮긴 것이다. 문서를 고치면 여기도 같이 고쳐야
 * 한다 — 종이는 한번 뽑으면 저절로 안 바뀌므로 날짜를 찍어 어느 판인지 남긴다.
 *
 *   node docs/guides/make-guides.js [내보낼 폴더] [찍을 날짜 YYYY-MM-DD]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CHROME_DIRS = [
  process.env.PROGRAMFILES,
  process.env['PROGRAMFILES(X86)'],
  process.env.LOCALAPPDATA,
].filter(Boolean);

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const found = CHROME_DIRS.map((d) =>
    path.join(d, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ).find((p) => fs.existsSync(p));
  if (!found) throw new Error('크롬을 못 찾았습니다. CHROME_PATH 로 알려주세요.');
  return found;
}

function defaultOutDir() {
  const home = os.homedir();
  const desktop =
    [
      path.join(home, 'Desktop'),
      path.join(home, 'OneDrive', 'Desktop'),
      path.join(home, 'OneDrive', '바탕 화면'),
    ].find((d) => fs.existsSync(d)) || home;
  return path.join(desktop, 'output', '분경5컷_가이드');
}

const OUT_DIR = process.argv[2] || defaultOutDir();
/** 종이에 찍을 날짜. 넘기지 않으면 오늘로 한다 */
const STAMP = process.argv[3] || new Date().toISOString().slice(0, 10);

/* ── 종이 꾸밈 ───────────────────────────────────────────── */

const CSS = `
  @page { size: A4; margin: 13mm 13mm 10mm; }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Malgun Gothic", sans-serif;
    color: #16181a;
    font-size: 11.5pt;
    line-height: 1.45;
    word-break: keep-all;
    overflow-wrap: break-word;
  }

  header { border-bottom: 3px solid #16181a; padding-bottom: 3.5mm; margin-bottom: 5mm; }
  .kicker { font-size: 10pt; letter-spacing: .16em; color: #6c6a66; }
  h1 { margin: 1.5mm 0 0; font-size: 26pt; letter-spacing: -.01em; }

  h2 {
    margin: 5.5mm 0 2.5mm;
    font-size: 11.5pt;
    padding-left: 2.5mm;
    border-left: 4px solid #81d8d0;
    color: #4a4844;
  }

  ol.steps { margin: 0; padding: 0; list-style: none; counter-reset: s; }
  ol.steps > li {
    counter-increment: s;
    position: relative;
    padding: 0 0 4.5mm 13mm;
    break-inside: avoid;
  }
  ol.steps > li::before {
    content: counter(s);
    position: absolute; left: 0; top: 0;
    width: 9.5mm; height: 9.5mm;
    background: #16181a; color: #fff;
    font-weight: 700; font-size: 13pt;
    display: flex; align-items: center; justify-content: center;
  }
  ol.steps > li.warn::before { background: #c0392b; }
  .st { font-weight: 700; font-size: 13.5pt; line-height: 1.3; }
  .st.red { color: #c0392b; }

  .path {
    display: inline-block;
    margin-top: 2mm;
    padding: 1.6mm 3mm;
    background: #f2f0eb;
    border: 1px solid #ddd9d0;
    font-size: 11.5pt;
    font-weight: 700;
  }
  /* 한글 글꼴은 역슬래시를 원화 기호로 그린다. 경로가 잘못 읽히므로
     코드 조각만 영문 고정폭 글꼴을 먼저 쓰게 한다. */
  /* 경로의 역슬래시는 &#92; 로 적는다. 템플릿 문자열 안에서 \r 같은 것이
     제어문자로 먹혀 글자가 통째로 사라진 적이 있다. */
  code {
    background: #f2f0eb; padding: .4mm 1.6mm; font-size: 11pt;
    font-family: Consolas, "Courier New", monospace; font-weight: 700;
  }
  .big { font-size: 13pt; }

  table { width: 100%; border-collapse: collapse; font-size: 11pt; margin-top: 1mm; }
  th, td { border: 1px solid #ddd9d0; padding: 2.2mm 3mm; text-align: left; vertical-align: middle; }
  th { background: #f2f0eb; font-weight: 700; white-space: nowrap; width: 32%; }

  footer {
    position: fixed; bottom: 0; left: 0; right: 0;
    padding-top: 2.5mm; border-top: 1px solid #ddd9d0;
    font-size: 9pt; color: #8a8781;
    display: flex; justify-content: space-between;
  }
`;

function page(title, kicker, lede, body) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>${title}</title><style>${CSS}</style></head><body>
<header>
  <div class="kicker">${kicker}</div>
  <h1>${title}</h1>
  ${lede ? `<p class="lede">${lede}</p>` : ''}
</header>
${body}
<footer><span>분당경영고등학교 · 분경5컷</span><span>${STAMP} 판</span></footer>
</body></html>`;
}

/* ── 1. 인증서 설치 ──────────────────────────────────────── */

const CERT = page(
  '아이패드 인증서 설치',
  '분경5컷 · 기기마다 처음 한 번만',
  '',
  `
<h2>준비</h2>
<table>
  <tr><th>보낼 파일</th><td><code>server&#92;certs&#92;ca&#92;rootCA.pem</code> (노트북)</td></tr>
  <tr><th>보내는 법</th><td>에어드롭 · 메일 · 클라우드</td></tr>
</table>

<h2>설치</h2>
<ol class="steps">
  <li>
    <div class="st">아이패드에서 그 파일을 연다</div>
  </li>
  <li>
    <div class="st">프로파일을 설치한다</div>
    <span class="path">설정 › 일반 › VPN 및 기기 관리 › LifeFivePhoto Local CA › 설치</span>
  </li>
  <li class="warn">
    <div class="st red">인증서 신뢰를 켠다 — 빠뜨리면 카메라가 안 열린다</div>
    <span class="path">설정 › 일반 › 정보 › 인증서 신뢰 설정 › LifeFivePhoto Local CA 켜기</span>
  </li>
  <li>
    <div class="st">노트북 핫스팟 Wi-Fi 에 연결한다</div>
  </li>
  <li>
    <div class="st">사파리에서 주소를 연다</div>
    <span class="path">https://192.168.137.1:3000</span>
  </li>
</ol>

<h2>됐는지 확인</h2>
<p class="big">주소창에 <b>자물쇠</b>가 보이고 <b>카메라 허용</b>을 물으면 끝.</p>

<h2>안 되면</h2>
<table>
  <tr><th>연결이 비공개가 아님</th><td>3번이 꺼져 있다</td></tr>
  <tr><th>카메라가 안 열림</th><td>3번이 꺼져 있다 · 주소가 https 인지 본다</td></tr>
  <tr><th>페이지가 안 열림</th><td>Wi-Fi 가 노트북 핫스팟인지 본다</td></tr>
  <tr><th>프로파일이 안 보임</th><td>파일을 다시 보내고 1번부터</td></tr>
</table>
`,
);

/* ── 2. 서버 켜기 ────────────────────────────────────────── */

const SERVER = page(
  '노트북 서버 켜고 끄기',
  '분경5컷 · 행사 당일',
  '',
  `
<h2>순서</h2>
<ol class="steps">
  <li>
    <div class="st">노트북에서 <code>부스-시작.bat</code> 을 두 번 누른다</div>
  </li>
  <li>
    <div class="st">까만 창에 뜬 Wi-Fi 이름과 비밀번호로 아이패드를 연결한다</div>
  </li>
  <li>
    <div class="st">사파리에서 주소를 연다</div>
    <span class="path">https://192.168.137.1:3000</span>
  </li>
  <li class="warn">
    <div class="st red">까만 창을 닫지 않는다 — 그 창이 서버다</div>
  </li>
  <li>
    <div class="st">끝나면 <code>부스-종료.bat</code> 을 두 번 누른다</div>
  </li>
</ol>

<h2>사진 저장 위치</h2>
<p class="big">바탕화면 <code>output&#92;날짜&#92;전화번호.png</code></p>

<h2>안 되면</h2>
<table>
  <tr><th>3000번을 이미 쓴다</th><td><code>부스-종료.bat</code> 실행 후 다시 시작</td></tr>
  <tr><th>Node.js 가 없다</th><td>nodejs.org 에서 LTS 설치 후 재부팅</td></tr>
  <tr><th>방화벽 창이 뜸</th><td><b>개인 네트워크</b> 체크하고 허용</td></tr>
  <tr><th>아이패드가 Wi-Fi 에 못 붙음</th><td>설정 › 네트워크 및 인터넷 › 모바일 핫스팟 껐다 켜기</td></tr>
  <tr><th>페이지는 열리나 카메라가 안 열림</th><td>「아이패드 인증서 설치」 3번</td></tr>
  <tr><th>까만 창을 잃어버림</th><td><code>부스-종료.bat</code> 이 알아서 멈춘다</td></tr>
</table>
`,
);

/* ── 뽑기 ────────────────────────────────────────────────── */

async function main() {
  const puppeteer = require(path.join(ROOT, 'server', 'node_modules', 'puppeteer-core'));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guides-'));
  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: 'new',
    userDataDir: profileDir,
    args: ['--no-sandbox'],
  });

  const docs = [
    { name: '가이드_1_아이패드-인증서-설치', html: CERT },
    { name: '가이드_2_노트북-서버-켜고끄기', html: SERVER },
  ];

  try {
    for (const d of docs) {
      const page = await browser.newPage();
      await page.setContent(d.html, { waitUntil: 'load' });
      // 화면용 색이 아니라 종이에 그대로 나오게 한다
      await page.emulateMediaType('print');

      // 첫 장(절차)이 한 장에 들어가는지 잰다. 문제 해결은 일부러 다음 장으로 넘긴다.
      const mm = await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.style.cssText = 'height:100mm;position:absolute;visibility:hidden';
        document.body.appendChild(probe);
        const pxPerMm = probe.getBoundingClientRect().height / 100;
        probe.remove();

        const next = document.querySelector('section.next');
        const end = next ? next.getBoundingClientRect().top : document.body.getBoundingClientRect().bottom;
        return Math.round((end - document.body.getBoundingClientRect().top) / pxPerMm);
      });
      const room = 297 - 14 - 12;
      const fit = mm <= room ? `1쪽 절차 ${mm}/${room}mm` : `1쪽이 ${mm - room}mm 넘침`;

      const pdf = path.join(OUT_DIR, d.name + '.pdf');
      await page.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true });

      // 미리 보기 쉽게 그림으로도 남긴다 (A4 210x297mm 를 150dpi 로)
      // A4 인쇄 폭(210-28=182mm)을 96dpi 로 환산한 값. 넓게 잡으면 줄바꿈이 달라진다
      await page.setViewport({ width: 688, height: 1024, deviceScaleFactor: 2 });
      const png = path.join(OUT_DIR, d.name + '.png');
      await page.screenshot({ path: png, fullPage: true });

      await page.close();
      const kb = (f) => Math.round(fs.statSync(f).size / 1024) + 'KB';
      const pages = (fs.readFileSync(pdf).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
      console.log(`  ${d.name}`);
      console.log(`    ${pages}쪽 · pdf ${kb(pdf)} · png ${kb(png)}   ${fit}`);
    }
  } finally {
    await browser.close().catch(() => {});
    try {
      fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
    } catch {
      /* 임시 폴더 */
    }
  }
}

main().catch((e) => {
  console.error('실패:', e.message);
  process.exit(1);
});
