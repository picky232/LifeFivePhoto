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
  @page { size: A4; margin: 14mm 14mm 12mm; }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Malgun Gothic", sans-serif;
    color: #16181a;
    font-size: 10.4pt;
    line-height: 1.5;
    word-break: keep-all;
    overflow-wrap: break-word;
  }

  header { border-bottom: 3px solid #16181a; padding-bottom: 4mm; margin-bottom: 5mm; }
  .kicker { font-size: 9.5pt; letter-spacing: .18em; color: #6c6a66; }
  h1 { margin: 1.5mm 0 1.2mm; font-size: 22pt; letter-spacing: -.01em; }
  .lede { margin: 0; font-size: 11pt; color: #4a4844; }

  h2 {
    margin: 5.5mm 0 2.5mm;
    font-size: 12pt;
    padding-left: 3mm;
    border-left: 4px solid #81d8d0;
  }

  ol.steps { margin: 0; padding: 0; list-style: none; counter-reset: s; }
  ol.steps > li {
    counter-increment: s;
    position: relative;
    padding: 0 0 3.2mm 11mm;
    break-inside: avoid;
  }
  ol.steps > li::before {
    content: counter(s);
    position: absolute; left: 0; top: -0.6mm;
    width: 8mm; height: 8mm;
    background: #16181a; color: #fff;
    font-weight: 700; font-size: 11pt;
    display: flex; align-items: center; justify-content: center;
  }
  ol.steps > li.warn::before { background: #c0392b; }
  .st { font-weight: 700; font-size: 11.2pt; }
  .sd { margin: 1mm 0 0; color: #4a4844; }

  .path {
    display: inline-block;
    margin-top: 1.5mm;
    padding: 1mm 2.5mm;
    background: #f2f0eb;
    border: 1px solid #ddd9d0;
    font-size: 10.5pt;
    font-weight: 700;
  }
  /* 한글 글꼴은 역슬래시를 원화 기호로 그린다. 경로가 잘못 읽히므로
     코드 조각만 영문 고정폭 글꼴을 먼저 쓰게 한다. */
  code {
    background: #f2f0eb; padding: .3mm 1.5mm; font-size: 10pt;
    font-family: Consolas, "Courier New", monospace;
  }

  .note {
    margin-top: 2mm; padding: 3mm 4mm;
    background: #fdf3f1; border-left: 4px solid #c0392b;
    font-size: 10.5pt; color: #7d2b20;
  }
  .tip {
    margin-top: 2mm; padding: 3mm 4mm;
    background: #eefaf8; border-left: 4px solid #2aa89e;
    font-size: 10.5pt; color: #1f5e59;
  }

  table { width: 100%; border-collapse: collapse; font-size: 10.5pt; margin-top: 2mm; }
  th, td { border: 1px solid #ddd9d0; padding: 1.8mm 2.6mm; text-align: left; vertical-align: top; }
  th { background: #f2f0eb; font-weight: 700; white-space: nowrap; }

  /* 문제 해결은 따로 한 장으로 뽑아 손 닿는 곳에 둔다.
     저절로 끊기게 두면 표가 장 사이에서 잘린다. */
  section.next { break-before: page; }
  section.next h2:first-child { margin-top: 0; }

  footer {
    margin-top: 6mm; padding-top: 2.5mm;
    border-top: 1px solid #ddd9d0;
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
  <p class="lede">${lede}</p>
</header>
${body}
<footer><span>분당경영고등학교 · 분경5컷</span><span>${STAMP} 판</span></footer>
</body></html>`;
}

/* ── 1. 인증서 설치 ──────────────────────────────────────── */

const CERT = page(
  '아이패드 인증서 설치',
  '분경5컷 · 접속 기기 준비 · 기기마다 처음 한 번만',
  '이 절차를 마쳐야 사진을 찍을 수 있습니다. 3번을 빼먹으면 카메라가 열리지 않습니다.',
  `
<h2>왜 필요한가</h2>
<p>사파리는 <b>신뢰된 HTTPS 에서만</b> 카메라를 열어줍니다. 부스는 인터넷 없이 노트북 안에서만
도는 서버라 공인 인증서를 받을 수 없어, 노트북이 만든 인증서를 아이패드가 믿도록 한 번 등록해 둡니다.</p>

<h2>준비물</h2>
<table>
  <tr><th>파일</th><td><code>server\\certs\\ca\\rootCA.pem</code> — 노트북에 있습니다</td></tr>
  <tr><th>전달</th><td>에어드롭 · 메일 · 클라우드 중 편한 것</td></tr>
  <tr><th>없으면</th><td>노트북에서 <code>부스-시작.bat</code> 을 한 번 실행하면 자동으로 만들어집니다</td></tr>
</table>

<h2>설치</h2>
<ol class="steps">
  <li>
    <div class="st">파일을 아이패드로 보내고 엽니다</div>
    <p class="sd">“프로파일이 다운로드됨” 알림이 뜹니다. 알림이 사라져도 괜찮습니다 — 설정 안에 남아 있습니다.</p>
  </li>
  <li>
    <div class="st">프로파일을 설치합니다</div>
    <span class="path">설정 › 일반 › VPN 및 기기 관리 › LifeFivePhoto Local CA › 설치</span>
    <p class="sd">암호를 물으면 아이패드 잠금 암호를 넣습니다. “설치” 를 두세 번 더 눌러야 끝납니다.</p>
  </li>
  <li class="warn">
    <div class="st">신뢰를 켭니다 — 가장 많이 빠뜨리는 곳</div>
    <span class="path">설정 › 일반 › 정보 › 인증서 신뢰 설정 › LifeFivePhoto Local CA 켜기</span>
    <div class="note"><b>2번만 하고 끝내면 안 됩니다.</b> 프로파일을 설치해도 이 스위치를 켜지 않으면
    사파리가 인증서를 믿지 않아 카메라가 열리지 않습니다.</div>
  </li>
  <li>
    <div class="st">노트북 핫스팟에 연결합니다</div>
    <p class="sd">노트북 화면에 뜬 Wi-Fi 이름과 비밀번호를 씁니다.</p>
  </li>
  <li>
    <div class="st">사파리에서 주소를 엽니다</div>
    <span class="path">https://192.168.137.1:3000</span>
    <p class="sd">주소창에 자물쇠가 보이고 “카메라를 사용하도록 허용” 을 물으면 성공입니다.</p>
  </li>
</ol>

<div class="tip">카메라 허용은 사파리를 완전히 껐다 켜면 다시 물어볼 수 있습니다. 정상입니다.</div>

<section class="next">
<h2>안 될 때</h2>
<table>
  <tr><th>증상</th><th>볼 곳</th></tr>
  <tr><td>“연결이 비공개 상태가 아닙니다”</td><td>3번 신뢰 스위치가 꺼져 있습니다</td></tr>
  <tr><td>카메라가 안 열림 · 검은 화면</td><td>주소가 <b>https</b> 인지, 자물쇠가 있는지 확인</td></tr>
  <tr><td>목록에 프로파일이 없음</td><td>파일을 다시 보내고 여는 것부터 다시 합니다</td></tr>
  <tr><td>페이지가 아예 안 열림</td><td>Wi-Fi 가 노트북 핫스팟에 붙어 있는지 확인</td></tr>
  <tr><td>인증서 신뢰 설정 항목이 없음</td><td>프로파일 설치(2번)가 끝나지 않았습니다</td></tr>
</table>
</section>
`,
);

/* ── 2. 서버 켜기 ────────────────────────────────────────── */

const SERVER = page(
  '노트북 서버 켜고 끄기',
  '분경5컷 · 운영자용 · 행사 당일',
  '평소에는 배치 파일 두 개면 됩니다. 아래쪽은 문제가 생겼을 때만 봅니다.',
  `
<h2>행사 당일</h2>
<ol class="steps">
  <li>
    <div class="st">노트북에서 <code>부스-시작.bat</code> 을 두 번 누릅니다</div>
    <p class="sd">핫스팟을 켜고 서버를 띄웁니다. 처음이라면 필요한 것을 알아서 채우느라 몇 분 걸립니다.</p>
  </li>
  <li>
    <div class="st">까만 창에 나온 것을 아이패드에 옮깁니다</div>
    <table>
      <tr><th>Wi-Fi 이름</th><td>아이패드 Wi-Fi 목록에서 고릅니다</td></tr>
      <tr><th>비밀번호</th><td>같은 창에 나옵니다</td></tr>
      <tr><th>주소</th><td><code>https://192.168.137.1:3000</code> — 사파리 주소창에 넣습니다</td></tr>
    </table>
  </li>
  <li class="warn">
    <div class="st">그 창을 닫지 않습니다</div>
    <p class="sd">창이 곧 서버입니다. 닫으면 부스가 멈춥니다. 가려두려면 최소화만 합니다.</p>
  </li>
  <li>
    <div class="st">끝나면 <code>부스-종료.bat</code> 을 두 번 누릅니다</div>
    <p class="sd">서버를 멈추고 핫스팟을 끕니다. 이미 꺼져 있어도 그냥 넘어갑니다.</p>
  </li>
</ol>

<div class="tip"><b>사진은 어디에?</b> 바탕화면 <code>output\\날짜\\전화번호.png</code> 로 쌓입니다.
예) <code>output\\2026-08-21\\01012345678.png</code></div>

<h2>부스-시작.bat 이 알아서 하는 것</h2>
<table>
  <tr><th>Node.js</th><td>없으면 알려주고 멈춥니다 (직접 설치해야 합니다)</td></tr>
  <tr><th>준비 파일</th><td><code>server\\node_modules</code> 가 없으면 <code>npm install</code></td></tr>
  <tr><th>인증서</th><td>없으면 <code>node generate-cert.js</code> — 없으면 카메라가 안 열립니다</td></tr>
  <tr><th>3000번 포트</th><td>이미 쓰고 있으면 어느 프로그램인지 알려주고 멈춥니다</td></tr>
</table>

<section class="next">
<h2>안 될 때</h2>
<table>
  <tr><th>증상</th><th>할 일</th></tr>
  <tr><td>3000번 포트를 이미 쓴다고 나옴</td><td>서버가 다른 창에 이미 떠 있습니다. <code>부스-종료.bat</code> 실행 후 다시 시작</td></tr>
  <tr><td>Node.js 를 찾을 수 없다고 나옴</td><td>nodejs.org 에서 LTS 를 설치하고 노트북을 다시 켭니다</td></tr>
  <tr><td>방화벽 창이 뜸</td><td><b>개인 네트워크</b> 를 체크하고 허용합니다 (처음 한 번)</td></tr>
  <tr><td>아이패드가 Wi-Fi 에 못 붙음</td><td>핫스팟을 껐다 켭니다: 설정 › 네트워크 및 인터넷 › 모바일 핫스팟</td></tr>
  <tr><td>페이지는 열리는데 카메라가 안 열림</td><td>아이패드 인증서 문제입니다. 「아이패드 인증서 설치」 안내문 3번을 봅니다</td></tr>
  <tr><td>창을 최소화해 잃어버림</td><td><code>부스-종료.bat</code> 이 3000번을 쥔 것만 골라 멈춥니다</td></tr>
</table>

<h2>손으로 할 때</h2>
<p>배치 파일이 안 될 때만 씁니다. <code>server</code> 폴더에서 차례로 실행합니다.</p>
<table>
  <tr><th>1</th><td><code>npm install</code> — 준비 파일 받기</td></tr>
  <tr><th>2</th><td><code>node generate-cert.js</code> — 인증서 만들기</td></tr>
  <tr><th>3</th><td><code>npm start</code> — 서버 켜기. 접속 주소가 나옵니다</td></tr>
</table>
<p>핫스팟은 <b>설정 › 네트워크 및 인터넷 › 모바일 핫스팟</b> 에서 직접 켭니다.
켜면 노트북에 <code>192.168.137.1</code> 이 붙습니다. 이 값은 윈도우가 고정으로 주므로 장소가 바뀌어도 같습니다.</p>
</section>
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
