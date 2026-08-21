'use strict';

/**
 * 치수 가이드 그대로 만든 프레임 예시 2종과, 예시 사진을 채운 미리보기를 만든다.
 *
 * 사진 다섯 칸은 destination-out 으로 실제로 뚫어서 알파 0 이 되게 한다.
 * 그래야 인쇄 합성에서 사진 위에 뿌연 막이 끼지 않는다.
 */

const path = require('path');
const {
  brandDataUrl,
  openCanvasPage,
  outDirFromArgs,
  writeAll,
} = require(path.join(__dirname, 'common.js'));
const GEOM = require(path.join(__dirname, 'geom.js'));

async function main() {
  const outDir = outDirFromArgs();

  const assets = {
    symbol: brandDataUrl('symbol.png'),
    mascots: [
      brandDataUrl('dept-accounting.png'),
      brandDataUrl('dept-smart.png'),
      brandDataUrl('dept-it.png'),
      brandDataUrl('dept-hotel.png'),
      brandDataUrl('dept-design.png'),
    ],
  };

  const { page, close } = await openCanvasPage();

  try {
    const files = await page.evaluate(async (assets, G) => {
      const DEPTS = [
        { name: '회계금융과', color: '#787cb6' },
        { name: '스마트경영과', color: '#1189ca' },
        { name: '인공지능개발과', color: '#0db04b' },
        { name: '스마트호텔관광과', color: '#f48020' },
        { name: '그래픽디자인과', color: '#81d8d0' },
      ];
      const MINT = '#81d8d0';
      const KO = '"Malgun Gothic", sans-serif';

      function make(w, h) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        return { c, g: c.getContext('2d') };
      }

      function punch(g) {
        g.save();
        g.globalCompositeOperation = 'destination-out';
        for (const s of G.slots) g.fillRect(s.x, s.y, s.w, s.h);
        g.restore();
      }

      function text(g, str, x, y, opt) {
        const o = opt || {};
        const size = o.size || 24;
        const align = o.align || 'left';
        const track = o.track || 0;
        g.save();
        g.font = (o.weight || 'normal') + ' ' + size + 'px ' + KO;
        g.fillStyle = o.color || '#000';
        g.textBaseline = 'alphabetic';
        if (!track) {
          g.textAlign = align;
          g.fillText(str, x, y);
          g.restore();
          return;
        }
        g.textAlign = 'left';
        const chars = Array.from(str);
        let total = 0;
        for (const ch of chars) total += g.measureText(ch).width + track;
        total -= track;
        let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
        for (const ch of chars) { g.fillText(ch, cx, y); cx += g.measureText(ch).width + track; }
        g.restore();
      }

      function loadImg(src) {
        return new Promise((res, rej) => {
          const im = new Image();
          im.onload = () => res(im);
          im.onerror = rej;
          im.src = src;
        });
      }

      /** 가로세로비를 지키며 상자 안에 넣는다 */
      function fit(g, im, bx, by, bw, bh, alpha) {
        const r = Math.min(bw / im.width, bh / im.height);
        const w = im.width * r, h = im.height * r;
        g.save();
        g.globalAlpha = alpha === undefined ? 1 : alpha;
        g.drawImage(im, bx + (bw - w) / 2, by + (bh - h) / 2, w, h);
        g.restore();
      }

      const symbol = await loadImg(assets.symbol);
      const mascots = await Promise.all(assets.mascots.map(loadImg));

      const out = {};
      const chanX = G.channel.x + G.channel.w / 2;
      const S = G.safeBox; // 잘려도 남는 자리

      // ── 예시 A — 학과 띠 (어두운 바탕) ───────────────────────
      {
        const r = make(G.W, G.H);
        const c = r.c, g = r.g;

        const bg = g.createLinearGradient(0, 0, 0, G.H);
        bg.addColorStop(0, '#14171a');
        bg.addColorStop(1, '#0c0e10');
        g.fillStyle = bg;
        g.fillRect(0, 0, G.W, G.H);

        g.strokeStyle = 'rgba(129,216,208,0.30)';
        g.lineWidth = 2;
        g.strokeRect(S.x + 6, S.y + 6, S.w - 12, S.h - 12);

        text(g, '분당경영고등학교 학과 홍보 부스', G.W / 2, S.y + 46, {
          size: 24, color: 'rgba(240,238,233,0.55)', align: 'center', track: 5,
        });

        // 좌우 여백에 학과 마스코트 — 디자이너가 다른 물품으로 바꿀 자리.
        // 여백이 80px 이라 마스코트도 그만큼 좁게 들어간다.
        // 좌우 여백은 52px 뿐이라 마스코트가 안 들어간다. 잘리지 않는
        // 아래 여백에 한 줄로 늘어놓는다.
        const step = S.w / 5;
        mascots.forEach((m, i) => fit(g, m, S.x + i * step + step / 2 - 31, 1552, 60, 72, 0.26));

        // 가운데 통로 — 점선과 학과 색 점
        g.save();
        g.setLineDash([6, 14]);
        g.strokeStyle = 'rgba(129,216,208,0.28)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(chanX, G.MY);
        g.lineTo(chanX, G.H - G.MY);
        g.stroke();
        g.restore();
        DEPTS.forEach((d, i) => {
          g.fillStyle = d.color;
          g.beginPath();
          g.arc(chanX, 300 + i * 270, 8, 0, Math.PI * 2);
          g.fill();
        });

        // 칸 테두리 + 학과 이름표
        G.slots.forEach((s, i) => {
          g.strokeStyle = 'rgba(129,216,208,0.45)';
          g.lineWidth = 2;
          g.strokeRect(s.x - 6, s.y - 6, s.w + 12, s.h + 12);

          const d = DEPTS[i];
          g.fillStyle = d.color;
          g.fillRect(s.x, s.y - 28, 72, 8);
          text(g, d.name, s.x + 84, s.y - 20, { size: 18, color: d.color, weight: '600' });
        });

        // 로고 칸
        const b = G.brand;
        g.fillStyle = 'rgba(255,255,255,0.035)';
        g.fillRect(b.x, b.y, b.w, b.h);
        g.strokeStyle = 'rgba(129,216,208,0.45)';
        g.lineWidth = 2;
        g.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);

        fit(g, symbol, b.x + b.w / 2 - 48, b.y + 34, 96, 96);
        text(g, '분경5컷', b.x + b.w / 2, b.y + 236, { size: 66, color: MINT, align: 'center', weight: 'bold' });
        g.fillStyle = 'rgba(129,216,208,0.55)';
        g.fillRect(b.x + b.w / 2 - 50, b.y + 262, 100, 3);
        text(g, '분당경영고등학교', b.x + b.w / 2, b.y + 312, {
          size: 24, color: 'rgba(240,238,233,0.55)', align: 'center', track: 3,
        });

        // 아래 여백 학과 색 띠
        const bandW = S.w / 5;
        DEPTS.forEach((d, i) => {
          g.fillStyle = d.color;
          g.fillRect(S.x + i * bandW, 1638, bandW - 6, 7);
        });
        text(g, 'BUNDANG GYEONGYEONG HIGH SCHOOL', G.W / 2, 1676, {
          size: 17, color: 'rgba(240,238,233,0.32)', align: 'center', track: 4,
        });

        punch(g);
        out['02_예시A_학과띠.png'] = c.toDataURL('image/png');
      }

      // ── 예시 B — 필름 (밝은 바탕) ────────────────────────────
      {
        const r = make(G.W, G.H);
        const c = r.c, g = r.g;

        g.fillStyle = '#f7f5f0';
        g.fillRect(0, 0, G.W, G.H);

        // 좌우 필름 구멍 — 여백 80px 안에 들어가도록 좁게
        g.fillStyle = '#e4dfd5';
        for (let y = S.y + 8; y < S.y + S.h - 30; y += 68) {
          for (const cx of [S.x + 7, S.x + S.w - 43]) {
            g.beginPath();
            g.roundRect(cx, y, 36, 26, 7);
            g.fill();
          }
        }

        g.fillStyle = MINT;
        g.fillRect(G.W / 2 - 90, S.y + 22, 180, 4);
        text(g, '분당경영고등학교 학과 홍보 부스', G.W / 2, S.y + 70, {
          size: 22, color: '#8b8478', align: 'center', track: 4,
        });

        // 가운데 통로 눈금
        g.strokeStyle = '#ddd7cb';
        g.lineWidth = 2;
        for (let y = G.MY + 20; y < G.H - G.MY - 20; y += 34) {
          g.beginPath();
          g.moveTo(chanX - 7, y);
          g.lineTo(chanX + 7, y);
          g.stroke();
        }

        // 칸 테두리 + 학과 색 밑줄
        G.slots.forEach((s, i) => {
          g.strokeStyle = '#d2ccc1';
          g.lineWidth = 2;
          g.strokeRect(s.x - 5, s.y - 5, s.w + 10, s.h + 10);

          const d = DEPTS[i];
          g.fillStyle = d.color;
          g.fillRect(s.x, s.y + s.h + 16, 110, 6);
          text(g, d.name, s.x + 122, s.y + s.h + 24, { size: 17, color: '#7d766a', weight: '600' });
        });

        // 로고 칸
        const b = G.brand;
        g.fillStyle = '#ffffff';
        g.fillRect(b.x, b.y, b.w, b.h);
        g.strokeStyle = '#ded8cd';
        g.lineWidth = 2;
        g.strokeRect(b.x - 5, b.y - 5, b.w + 10, b.h + 10);

        fit(g, symbol, b.x + b.w / 2 - 46, b.y + 36, 92, 92);
        text(g, '분경5컷', b.x + b.w / 2, b.y + 236, { size: 66, color: '#1c1f22', align: 'center', weight: 'bold' });
        g.fillStyle = MINT;
        g.fillRect(b.x + b.w / 2 - 50, b.y + 262, 100, 5);
        text(g, '분당경영고등학교', b.x + b.w / 2, b.y + 312, {
          size: 24, color: '#8b8478', align: 'center', track: 3,
        });

        const bandW = S.w / 5;
        DEPTS.forEach((d, i) => {
          g.fillStyle = d.color;
          g.fillRect(S.x + i * bandW, 1638, bandW - 8, 7);
        });
        text(g, '2026 학과 홍보 부스', G.W / 2, 1672, {
          size: 18, color: '#a9a294', align: 'center', track: 3,
        });

        punch(g);
        out['04_예시B_필름.png'] = c.toDataURL('image/png');
      }

      // ── 예시 사진을 채운 미리보기 ─────────────────────────────
      {
        const palettes = [
          ['#2b5876', '#4e4376'], ['#c94b4b', '#4b134f'], ['#0f9b8e', '#065a60'],
          ['#e65c00', '#f9d423'], ['#360033', '#0b8793'],
        ];
        const sample = (i) => {
          const r = make(G.CW, G.CH);
          const c = r.c, g = r.g;
          const grd = g.createLinearGradient(0, 0, G.CW, G.CH);
          grd.addColorStop(0, palettes[i][0]);
          grd.addColorStop(1, palettes[i][1]);
          g.fillStyle = grd;
          g.fillRect(0, 0, G.CW, G.CH);
          g.fillStyle = 'rgba(255,255,255,0.13)';
          g.beginPath();
          g.arc(G.CW / 2, G.CH * 0.40, 86, 0, Math.PI * 2);
          g.fill();
          g.fillRect(G.CW / 2 - 112, G.CH * 0.60, 224, 195);
          text(g, '사진 ' + (i + 1), G.CW / 2, G.CH - 30, {
            size: 30, color: 'rgba(255,255,255,0.78)', align: 'center', weight: 'bold',
          });
          return c;
        };
        const samples = [0, 1, 2, 3, 4].map(sample);

        const pairs = [
          ['02_예시A_학과띠.png', '03_예시A_미리보기.png'],
          ['04_예시B_필름.png', '05_예시B_미리보기.png'],
        ];
        for (const p of pairs) {
          const frame = await loadImg(out[p[0]]);
          const r = make(G.W, G.H);
          const c = r.c, g = r.g;
          g.fillStyle = '#ffffff';
          g.fillRect(0, 0, G.W, G.H);
          G.slots.forEach((s, i) => g.drawImage(samples[i], s.x, s.y, s.w, s.h));
          g.drawImage(frame, 0, 0, G.W, G.H);
          out[p[1]] = c.toDataURL('image/png');
        }
      }

      return out;
    }, assets, GEOM);

    writeAll(outDir, files);
  } finally {
    await close();
  }
}

main().catch((e) => {
  console.error('실패:', e.message);
  process.exit(1);
});
