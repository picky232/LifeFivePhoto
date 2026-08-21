'use strict';

/**
 * 분경5컷 프레임 치수 가이드 한 장을 만든다.
 *
 * 인쇄 크기(1200x1800px)를 그대로 그려 놓고, 둘레에 치수선과 범례를 붙인다.
 * 잘려나가는 자리를 눈에 보이게 칠하는 것이 이 그림의 핵심이다 —
 * 종이는 캔버스보다 작고, 인화기 여백까지 더해져 가장자리가 사라진다.
 */

const fs = require('fs');
const path = require('path');
const {
  openCanvasPage,
  outDirFromArgs,
  writeAll,
} = require(path.join(__dirname, 'common.js'));
const GEOM = require(path.join(__dirname, 'geom.js'));

async function main() {
  const outDir = outDirFromArgs();
  const { page, close } = await openCanvasPage();

  try {
    const url = await page.evaluate((G) => {
      const MINT = '#81d8d0';
      const KO = '"Malgun Gothic", sans-serif';
      const mm = (px) => (px * 25.4 / 300).toFixed(1);

      const W = 1900, H = 2720, PX = 340, PY = 420;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const g = c.getContext('2d');

      function text(str, x, y, opt) {
        const o = opt || {};
        g.save();
        g.font = (o.weight || 'normal') + ' ' + (o.size || 24) + 'px ' + KO;
        g.fillStyle = o.color || '#000';
        g.textBaseline = 'alphabetic';
        g.textAlign = o.align || 'left';
        g.fillText(str, x, y);
        g.restore();
      }

      g.fillStyle = '#fbfaf8';
      g.fillRect(0, 0, W, H);

      /* ── 머리글 ─────────────────────────────────────────── */
      text('분경5컷 프레임 규격', 100, 122, { size: 52, color: '#15181b', weight: 'bold' });
      text('캔버스 1200 x 1800 px · 4 x 6인치 · 300dpi · PNG(배경 투명)', 100, 176, {
        size: 27, color: '#6d6a64',
      });
      text('테두리는 흰색으로 비웁니다 — 위아래 7mm · 좌우 4mm', 100, 216, {
        size: 27, color: '#c0392b', weight: '600',
      });
      g.fillStyle = MINT;
      g.fillRect(100, 248, 150, 6);

      /* ── 판 ─────────────────────────────────────────────── */
      g.save();
      g.translate(PX, PY);

      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, G.W, G.H);

      // 잘려나가는 자리
      const s = G.safeBox;
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, G.W, s.y);
      g.fillRect(0, s.y + s.h, G.W, G.H - (s.y + s.h));
      g.fillRect(0, s.y, s.x, s.h);
      g.fillRect(s.x + s.w, s.y, G.W - (s.x + s.w), s.h);

      // 흰색만 두면 판 바탕과 구분이 안 된다. 옅은 빗금으로 자리를 표시한다
      g.save();
      g.beginPath();
      g.rect(0, 0, G.W, G.H);
      g.rect(s.x, s.y, s.w, s.h);
      g.clip('evenodd');
      g.strokeStyle = 'rgba(120,120,120,0.22)';
      g.lineWidth = 2;
      for (let i = -G.H; i < G.W; i += 22) {
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i + G.H, G.H); g.stroke();
      }
      g.restore();

      // 디자인해도 되는 자리 (안전선 안쪽에서 칸을 뺀 나머지)
      g.save();
      g.beginPath();
      g.rect(s.x, s.y, s.w, s.h);
      for (const t of G.slots) g.rect(t.x, t.y, t.w, t.h);
      g.rect(G.brand.x, G.brand.y, G.brand.w, G.brand.h);
      g.clip('evenodd');
      g.fillStyle = 'rgba(129,216,208,0.20)';
      g.fillRect(s.x, s.y, s.w, s.h);
      g.restore();

      // 안전선
      g.save();
      g.setLineDash([12, 8]);
      g.strokeStyle = '#c0392b';
      g.lineWidth = 3;
      g.strokeRect(s.x, s.y, s.w, s.h);
      g.restore();

      // 판 테두리
      g.strokeStyle = '#3a3f45';
      g.lineWidth = 3;
      g.strokeRect(0, 0, G.W, G.H);

      // 사진 칸
      for (const t of G.slots) {
        g.fillStyle = '#e9f7f5';
        g.fillRect(t.x, t.y, t.w, t.h);
        g.strokeStyle = '#2aa89e';
        g.lineWidth = 3;
        g.strokeRect(t.x, t.y, t.w, t.h);

        text(String(t.n), t.x + t.w / 2, t.y + 160, {
          size: 92, color: '#2aa89e', align: 'center', weight: 'bold',
        });
        text(G.CW + ' x ' + G.CH + ' px', t.x + t.w / 2, t.y + 216, {
          size: 26, color: '#1f5e59', align: 'center', weight: '600',
        });
        text(mm(G.CW) + ' x ' + mm(G.CH) + ' mm', t.x + t.w / 2, t.y + 254, {
          size: 22, color: '#5d8b87', align: 'center',
        });
        text('x ' + t.x + '   y ' + t.y, t.x + t.w / 2, t.y + 300, {
          size: 21, color: '#8aa8a5', align: 'center',
        });
      }

      // 로고 칸
      const b = G.brand;
      g.save();
      g.setLineDash([14, 9]);
      g.strokeStyle = '#8d8d8d';
      g.lineWidth = 3;
      g.strokeRect(b.x, b.y, b.w, b.h);
      g.restore();
      text('로고 칸', b.x + b.w / 2, b.y + 170, { size: 40, color: '#6f6f6f', align: 'center', weight: 'bold' });
      text('사진 안 들어감', b.x + b.w / 2, b.y + 218, { size: 24, color: '#8d8d8d', align: 'center' });
      text(G.CW + ' x ' + G.CH + ' px', b.x + b.w / 2, b.y + 260, { size: 22, color: '#a0a0a0', align: 'center' });

      g.restore();

      /* ── 치수선 ─────────────────────────────────────────── */
      function arrow(x1, y1, x2, y2, color) {
        g.save();
        g.strokeStyle = color || '#c0392b';
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
        const vertical = x1 === x2;
        for (const p of [[x1, y1], [x2, y2]]) {
          g.beginPath();
          if (vertical) { g.moveTo(p[0] - 9, p[1]); g.lineTo(p[0] + 9, p[1]); }
          else { g.moveTo(p[0], p[1] - 9); g.lineTo(p[0], p[1] + 9); }
          g.stroke();
        }
        g.restore();
      }
      function vdim(x, y1, y2, label, color) {
        arrow(x, y1, x, y2, color);
        text(label, x - 18, (y1 + y2) / 2 + 8, {
          size: 24, color: color || '#c0392b', align: 'right', weight: '600',
        });
      }
      function hdim(y, x1, x2, label, align, color) {
        arrow(x1, y, x2, y, color);
        text(label, (x1 + x2) / 2, y - 16, {
          size: 24, color: color || '#c0392b', align: align || 'center', weight: '600',
        });
      }

      const t0 = G.slots[0];
      vdim(PX - 40, PY, PY + G.SAFE_Y, '흰 테 ' + G.SAFE_Y + 'px (' + mm(G.SAFE_Y) + 'mm)', '#c0392b');
      vdim(PX - 40, PY + G.SAFE_Y, PY + t0.y, '여백 ' + G.MY + 'px', '#7a6f66');
      vdim(PX - 40, PY + t0.y, PY + t0.y + G.CH, '사진 ' + G.CH + 'px', '#1f5e59');
      vdim(PX - 40, PY + t0.y + G.CH, PY + t0.y + G.CH + G.GY, '간격 ' + G.GY + 'px', '#7a6f66');

      hdim(PY - 44, PX + t0.x, PX + t0.x + G.CW, '사진 ' + G.CW + 'px', 'center', '#1f5e59');
      hdim(PY - 110, PX, PX + G.SAFE_X, '흰 테 ' + G.SAFE_X + 'px (' + mm(G.SAFE_X) + 'mm)', 'right', '#c0392b');
      hdim(PY - 110, PX + G.channel.x, PX + G.channel.x + G.channel.w,
        '간격 ' + G.GX + 'px', 'center', '#7a6f66');

      /* ── 범례 ───────────────────────────────────────────── */
      let ly = PY + G.H + 80;
      text('읽는 법', 100, ly, { size: 32, color: '#15181b', weight: 'bold' });
      ly += 52;

      const legend = [
        ['흰 테', '#ffffff', '#c0392b', '흰색으로 비웁니다 (위아래 ' + mm(G.SAFE_Y) + 'mm · 좌우 ' + mm(G.SAFE_X) + 'mm). 여기에는 아무것도 넣지 않습니다'],
        ['빨간 점선', '#ffffff', '#c0392b', '흰 테의 안쪽 끝. 디자인은 이 선 안쪽에만 넣습니다'],
        ['민트 칸 1~5', '#e9f7f5', '#2aa89e', '사진이 들어가는 자리. 완성 PNG 에서는 완전히 뚫려 있어야 합니다 (알파 0)'],
        ['연한 민트 배경', '#d5f0ec', '#2aa89e', '학과 관련 물품·일러스트를 그릴 수 있는 자리'],
        ['회색 점선 칸', '#ffffff', '#8d8d8d', '로고 칸. 사진 안 들어감. 자유롭게 디자인'],
      ];
      for (const [k, fill, edge, desc] of legend) {
        g.fillStyle = fill;
        g.fillRect(100, ly - 25, 32, 32);
        g.save();
        g.strokeStyle = edge;
        g.lineWidth = 2;
        if (edge === '#c0392b' || edge === '#8d8d8d') g.setLineDash([6, 5]);
        g.strokeRect(100, ly - 25, 32, 32);
        g.restore();

        text(k, 150, ly, { size: 25, color: '#15181b', weight: '600' });
        text(desc, 400, ly, { size: 25, color: '#5f5c56' });
        ly += 44;
      }

      ly += 14;
      text('사진은 1 → 2 → 3 → 4 → 5 순서로 채워집니다. 칸 좌표는 바꿀 수 없습니다.', 100, ly, {
        size: 26, color: '#8a2f26', weight: '600',
      });
      ly += 40;
      text('용지(100 x 148mm)가 캔버스(101.6 x 152.4mm)보다 작아 세로가 더 많이 잘립니다 (4.4mm 대 1.6mm).', 100, ly, {
        size: 24, color: '#6d6a64',
      });
      ly += 34;
      text('위아래를 더 넓게 잡은 것은 그래서입니다. 흰 테는 조금 틀어져 잘려도 원래 그런 디자인으로 보입니다.', 100, ly, {
        size: 24, color: '#6d6a64',
      });

      return c.toDataURL('image/png');
    }, GEOM);

    writeAll(outDir, { '01_틀_치수가이드.png': url });
  } finally {
    await close();
  }
}

main().catch((e) => {
  console.error('실패:', e.message);
  process.exit(1);
});
