#!/usr/bin/env node
'use strict';

/**
 * 검정 바탕 프레임을 만든다.
 *
 *   node scripts/make-dark-frame.js <나갈파일.png>
 *
 * 사진 자리는 뚫고, 그 위에 학과 이름표와 마스코트를 얹는다. 이름표가 사진
 * 아래쪽에 걸치고 마스코트가 사진 위로 올라오는 구성이라, 뚫은 다음에 그린다.
 *
 * 칸 자리와 학과 순서는 코드에서 그대로 가져온다 — 여기 따로 적으면 명단이
 * 바뀌었을 때 화면에서 안내한 학과와 종이에 찍힌 학과가 달라진다.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'client-src', 'src', 'lib');
const BRAND_DIR = path.join(ROOT, 'client', 'brand');

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const dirs = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
  const hit = dirs
    .map((d) => path.join(d, 'Google', 'Chrome', 'Application', 'chrome.exe'))
    .find((p) => fs.existsSync(p));
  if (!hit) throw new Error('크롬을 못 찾았습니다. CHROME_PATH 로 알려주세요.');
  return hit;
}

function dataUrl(file) {
  return 'data:image/png;base64,' + fs.readFileSync(path.join(BRAND_DIR, file)).toString('base64');
}

async function main() {
  const output = process.argv[2];
  if (!output) {
    console.log('쓰는 법: node scripts/make-dark-frame.js <나갈파일.png>');
    process.exit(2);
  }

  process.removeAllListeners('warning');
  process.on('warning', (w) => {
    if (w.code !== 'MODULE_TYPELESS_PACKAGE_JSON') console.warn(w.message);
  });

  const frame = await import(pathToFileURL(path.join(SRC, 'frame.ts')).href);
  const depts = await import(pathToFileURL(path.join(SRC, 'departments.ts')).href);

  const cfg = {
    PAGE: { w: frame.PAGE.w, h: frame.PAGE.h },
    SLOTS: frame.SLOTS.map((s) => ({ index: s.index, x: s.x, y: s.y, w: s.w, h: s.h })),
    BRAND: { ...frame.BRAND_CELL },
    DEPTS: depts.DEPARTMENTS.map((d) => ({
      name: d.name,
      accent: d.accent,
      mascot: dataUrl(path.basename(d.mascot)),
    })),
    SCHOOL: depts.SCHOOL_NAME,
    symbol: dataUrl('symbol.png'),
    qr: dataUrl('qr-pr.png'),
    // 만든 곳 — 다른 프레임에 적힌 것과 같은 순서로 둔다
    CREDIT: '홍보기획부 × 인공지능개발과 × 그래픽디자인과',
    TAGLINE: '상상이 현실이 되는',
  };

  const puppeteer = require(path.join(ROOT, 'server', 'node_modules', 'puppeteer-core'));
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dark-'));
  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: 'new',
    userDataDir: profileDir,
    args: ['--no-sandbox', '--force-device-scale-factor=1'],
  });

  try {
    const tab = await browser.newPage();
    await tab.setContent('<!doctype html><meta charset="utf-8"><body style="margin:0"></body>');

    const url = await tab.evaluate(async (C) => {
      const KO = '"Malgun Gothic", sans-serif';
      const INK = '#0d0d0d';
      const GREEN = '#4fdd9a';

      const load = (src) =>
        new Promise((res, rej) => {
          const i = new Image();
          i.onload = () => res(i);
          i.onerror = rej;
          i.src = src;
        });

      const c = document.createElement('canvas');
      c.width = C.PAGE.w;
      c.height = C.PAGE.h;
      const g = c.getContext('2d');

      function text(str, x, y, o) {
        g.save();
        g.font = `${o.weight || 'normal'} ${o.size}px ${KO}`;
        g.fillStyle = o.color;
        g.textAlign = o.align || 'left';
        g.textBaseline = 'alphabetic';
        g.fillText(str, x, y);
        g.restore();
      }

      /** 가로세로비를 지키며 상자 안에 바닥을 맞춰 넣는다 */
      function fitBottom(im, bx, by, bw, bh) {
        const r = Math.min(bw / im.width, bh / im.height);
        const w = im.width * r, h = im.height * r;
        g.drawImage(im, bx + (bw - w) / 2, by + bh - h, w, h);
      }

      // 바탕
      g.fillStyle = INK;
      g.fillRect(0, 0, C.PAGE.w, C.PAGE.h);

      // 사진 자리를 뚫는다
      g.save();
      g.globalCompositeOperation = 'destination-out';
      for (const s of C.SLOTS) g.fillRect(s.x, s.y, s.w, s.h);
      g.restore();

      // 뚫은 뒤에 얹는다 — 이름표와 마스코트는 사진 위로 올라와야 한다
      const mascots = await Promise.all(C.DEPTS.map((d) => load(d.mascot)));
      const symbol = await load(C.symbol);

      const BAR = 86; // 이름표 띠 높이
      C.SLOTS.forEach((s, i) => {
        const d = C.DEPTS[i];
        const by = s.y + s.h - BAR;

        g.fillStyle = INK;
        g.fillRect(s.x, by, s.w, BAR);

        // 학과 색 표시
        g.fillStyle = d.accent;
        g.fillRect(s.x + 22, by + 22, 10, BAR - 44);

        text(d.name, s.x + 46, by + BAR / 2 + 12, {
          size: 33, color: '#ffffff', weight: '700',
        });

        // 마스코트는 띠 위에 걸터앉아 사진을 조금 가린다
        fitBottom(mascots[i], s.x + s.w - 190, by - 128, 175, 210);
      });

      /* ── 로고 칸 ─────────────────────────────────────────
         가운데를 축으로 위에서 아래로: 곡선 문구 · 이름 · 학교 · 만든 곳.
         QR 은 이 흐름에 끼우지 않고 오른쪽 아래 구석에 따로 앉힌다. */
      const b = C.BRAND;
      const cx = b.x + b.w / 2;

      /** 글자를 원호 위에 한 자씩 세워 그린다 */
      function arcText(str, ax, ay, radius, size, color) {
        g.save();
        g.font = `600 ${size}px ${KO}`;
        g.fillStyle = color;
        g.textAlign = 'center';
        g.textBaseline = 'alphabetic';

        const chars = [...str];
        // 글자마다 폭이 달라 균등 분할하면 자간이 들쭉날쭉해진다.
        // 폭을 재서 호의 길이로 나눈다.
        const widths = chars.map((ch) => g.measureText(ch).width);
        const total = widths.reduce((s, w) => s + w, 0) + (chars.length - 1) * size * 0.18;
        const span = total / radius; // 호가 차지하는 각도
        let angle = -span / 2;

        for (let i = 0; i < chars.length; i++) {
          const step = widths[i] / radius;
          angle += step / 2;
          g.save();
          g.translate(ax, ay);
          g.rotate(angle);
          g.translate(0, -radius);
          g.fillText(chars[i], 0, 0);
          g.restore();
          angle += step / 2 + (size * 0.18) / radius;
        }
        g.restore();
      }

      /* QR 크기는 취향이 아니라 계산으로 정한다.
         이 QR 은 41칸이고, 종이에서 한 칸이 0.4mm 아래로 내려가면 초점이 맞아도
         카메라가 못 읽는다. 캔버스 1200px 이 종이 100mm 이므로 한 칸 5px 이면
         0.417mm 다. 여백(quiet zone)은 표준대로 사방 4칸을 둔다 — 검정 바탕에
         딱 붙이면 파인더를 못 찾는다.
         그래서 흰 네모는 (41 + 4 + 4) x 5 = 245px 이 되고, 오른쪽 아래
         구석을 통째로 차지한다. 위 요소들은 그 위로 비켜 앉힌다. */
      const MOD = 5, QUIET = 4, MODULES = 41;
      const QS = MODULES * MOD;                 // 205
      const QPAD = QUIET * MOD;                 // 20
      const QBOX = QS + QPAD * 2;               // 245
      const qx = b.x + b.w - QBOX;
      const qy = b.y + b.h - QBOX;

      // 위로 볼록한 호가 되도록 중심을 아래에 둔다
      arcText(C.TAGLINE, cx, b.y + 30 + 250, 250, 24, 'rgba(255,255,255,0.70)');

      text('분경5컷', cx, b.y + 124, {
        size: 78, color: GREEN, weight: '800', align: 'center',
      });

      // 학교 띠는 QR 흰 네모 위쪽 선(b.y+212)에 닿지 않게 올려 둔다
      const pillW = 264, pillH = 52;
      const pillY = b.y + 146;
      g.fillStyle = GREEN;
      g.beginPath();
      g.roundRect(cx - pillW / 2, pillY, pillW, pillH, 8);
      g.fill();
      const sw = 32;
      text(C.SCHOOL, cx - 12, pillY + 35, { size: 23, color: INK, weight: '700', align: 'center' });
      g.drawImage(symbol, cx + pillW / 2 - sw - 14, pillY + (pillH - sw) / 2, sw, sw);

      // 만든 곳 — QR 왼쪽에 두 줄로. 한 줄로 늘어놓으면 QR 에 가린다.
      const creditX = b.x + (qx - b.x) / 2;
      text('홍보기획부', creditX, qy + 76, {
        size: 17, color: 'rgba(255,255,255,0.55)', align: 'center',
      });
      text('× 인공지능개발과', creditX, qy + 102, {
        size: 17, color: 'rgba(255,255,255,0.55)', align: 'center',
      });
      text('× 그래픽디자인과', creditX, qy + 128, {
        size: 17, color: 'rgba(255,255,255,0.55)', align: 'center',
      });

      // 흰 여백을 두고 얹는다 — 검정에 딱 붙이면 스캔이 잘 안 붙는다.
      // 모서리를 둥글리지 않는다. 여백을 깎으면 그만큼 quiet zone 이 준다.
      const qrImg = await load(C.qr);
      g.fillStyle = '#ffffff';
      g.fillRect(qx, qy, QBOX, QBOX);
      // 칸 경계가 흐려지지 않게 보간을 끈다 (820px 을 205px 로, 정확히 4:1)
      g.imageSmoothingEnabled = false;
      g.drawImage(qrImg, qx + QPAD, qy + QPAD, QS, QS);
      g.imageSmoothingEnabled = true;

return c.toDataURL('image/png');
    }, cfg);

    const buf = Buffer.from(url.split(',')[1], 'base64');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, buf);
    console.log(`  ${path.basename(output)}  ${Math.round(buf.length / 1024)}KB`);
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
  console.error(`오류: ${e.message}`);
  process.exit(1);
});
