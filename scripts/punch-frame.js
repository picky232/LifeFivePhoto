#!/usr/bin/env node
'use strict';

/**
 * 디자이너가 준 그림에서 사진 자리를 뚫어 프레임 PNG 로 만든다.
 *
 *   node scripts/punch-frame.js <들어온그림> <나갈파일.png>
 *
 * 받은 파일은 사진 자리를 흰색으로 칠해 두었다. 그 흰 자리만 투명하게
 * 바꿔야 하는데, 단순히 "흰 화소를 다 지운다" 로 하면 안 된다 —
 * 마스코트의 흰 옷, 로고의 흰 글자까지 구멍이 난다.
 *
 * 그래서 칸 안쪽에서 시작해 **이어져 있는 흰 자리만** 번져나가며 지운다.
 * 마스코트는 검은 선으로 둘러싸여 있어 바깥 흰색과 이어지지 않으므로 남는다.
 * 캐릭터가 사진 위로 올라가는 디자인이라 이게 중요하다.
 *
 * JPG 도 받으므로 크롬으로 그려서 화소를 읽는다 (Node 에 JPEG 해독기가 없다).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const FRAME_TS = path.join(ROOT, 'client-src', 'src', 'lib', 'frame.ts');

/** 이 값보다 밝으면 사진 자리로 본다. JPG 는 눌린 자국이 있어 조금 낮춘다 */
const WHITE = 238;
/** 칸 테두리에서 이만큼 안쪽을 씨앗으로 삼는다 */
const SEED_INSET = 12;

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const dirs = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
  const hit = dirs
    .map((d) => path.join(d, 'Google', 'Chrome', 'Application', 'chrome.exe'))
    .find((p) => fs.existsSync(p));
  if (!hit) throw new Error('크롬을 못 찾았습니다. CHROME_PATH 로 알려주세요.');
  return hit;
}

async function readSlots() {
  process.removeAllListeners('warning');
  process.on('warning', (w) => {
    if (w.code !== 'MODULE_TYPELESS_PACKAGE_JSON') console.warn(w.message);
  });
  const mod = await import(pathToFileURL(FRAME_TS).href);
  return { page: mod.PAGE, slots: mod.SLOTS };
}

async function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    console.log('쓰는 법: node scripts/punch-frame.js <들어온그림> <나갈파일.png>');
    process.exit(2);
  }
  if (!fs.existsSync(input)) throw new Error(`파일이 없습니다: ${input}`);

  const { page: PAGE, slots } = await readSlots();
  const ext = path.extname(input).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  const dataUrl = `data:${mime};base64,` + fs.readFileSync(input).toString('base64');

  const puppeteer = require(path.join(ROOT, 'server', 'node_modules', 'puppeteer-core'));
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'punch-'));
  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: 'new',
    userDataDir: profileDir,
    args: ['--no-sandbox'],
  });

  try {
    const tab = await browser.newPage();
    await tab.setContent('<!doctype html><meta charset="utf-8"><body style="margin:0"></body>');

    const result = await tab.evaluate(
      async (dataUrl, slots, PAGE, WHITE, SEED_INSET) => {
        const im = await new Promise((res, rej) => {
          const i = new Image();
          i.onload = () => res(i);
          i.onerror = rej;
          i.src = dataUrl;
        });

        const c = document.createElement('canvas');
        c.width = im.width;
        c.height = im.height;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(im, 0, 0);

        const img = g.getImageData(0, 0, c.width, c.height);
        const d = img.data;
        const W = c.width, H = c.height;

        const isOpen = (i) => {
          const a = d[i * 4 + 3];
          if (a < 16) return true; // 이미 뚫려 있다
          return d[i * 4] >= WHITE && d[i * 4 + 1] >= WHITE && d[i * 4 + 2] >= WHITE;
        };

        const seen = new Uint8Array(W * H);
        const report = [];

        for (const s of slots) {
          const x0 = Math.max(0, s.x), y0 = Math.max(0, s.y);
          const x1 = Math.min(W, s.x + s.w), y1 = Math.min(H, s.y + s.h);

          // 칸 안쪽 여러 곳에서 시작한다. 한 곳만 잡으면 마스코트에 막힌 쪽이 남는다.
          const seeds = [];
          for (let ty = 0; ty <= 4; ty++) {
            for (let tx = 0; tx <= 4; tx++) {
              const px = Math.round(x0 + SEED_INSET + ((x1 - x0 - SEED_INSET * 2) * tx) / 4);
              const py = Math.round(y0 + SEED_INSET + ((y1 - y0 - SEED_INSET * 2) * ty) / 4);
              if (px >= x0 && px < x1 && py >= y0 && py < y1) seeds.push(py * W + px);
            }
          }

          let filled = 0;
          const stack = [];
          for (const sd of seeds) if (!seen[sd] && isOpen(sd)) { seen[sd] = 1; stack.push(sd); }

          while (stack.length) {
            const p = stack.pop();
            const px = p % W, py = (p / W) | 0;
            // 칸 밖으로는 번지지 않는다 — 프레임 바깥 흰 부분까지 지우면 안 된다
            if (px < x0 || px >= x1 || py < y0 || py >= y1) continue;
            d[p * 4 + 3] = 0;
            filled++;
            const n = [p - 1, p + 1, p - W, p + W];
            if (px === 0) n[0] = -1;
            if (px === W - 1) n[1] = -1;
            for (const q of n) {
              if (q < 0 || q >= W * H) continue;
              if (seen[q] || !isOpen(q)) continue;
              seen[q] = 1;
              stack.push(q);
            }
          }

          report.push({ n: s.index + 1, filled, area: (x1 - x0) * (y1 - y0) });
        }

        g.putImageData(img, 0, 0);
        return { url: c.toDataURL('image/png'), report, W, H, need: PAGE };
      },
      dataUrl, slots, PAGE, WHITE, SEED_INSET,
    );

    if (result.W !== PAGE.w || result.H !== PAGE.h) {
      console.log(`  ⚠ 크기가 ${result.W}x${result.H} 입니다 (필요 ${PAGE.w}x${PAGE.h})`);
    }

    const buf = Buffer.from(result.url.split(',')[1], 'base64');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, buf);

    console.log(`  ${path.basename(input)} → ${path.basename(output)}  ${Math.round(buf.length / 1024)}KB`);
    for (const r of result.report) {
      const pct = Math.round((r.filled / r.area) * 100);
      console.log(`      칸${r.n}  뚫림 ${pct}%  (${r.filled}px)`);
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
  console.error(`오류: ${e.message}`);
  process.exit(1);
});
