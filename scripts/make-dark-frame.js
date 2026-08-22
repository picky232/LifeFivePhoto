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

      // 로고 칸
      const b = C.BRAND;
      text('분경5컷', b.x + 6, b.y + 190, { size: 96, color: GREEN, weight: '800' });

      const pillY = b.y + b.h - 92;
      g.fillStyle = GREEN;
      g.beginPath();
      g.roundRect(b.x + 6, pillY, b.w - 12, 74, 10);
      g.fill();
      text(C.SCHOOL, b.x + 32, pillY + 48, { size: 32, color: INK, weight: '700' });

      const sw = 46;
      g.drawImage(symbol, b.x + b.w - 12 - sw - 18, pillY + (74 - sw) / 2, sw, sw);

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
