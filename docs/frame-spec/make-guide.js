'use strict';

/**
 * 분경5컷 프레임 치수 가이드 한 장을 만든다.
 *
 * 인쇄 크기(1200x1800px, 4x6in 300dpi)를 그대로 그려 놓고,
 * 둘레에 치수선과 범례를 붙인 설명용 그림이다.
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
  const { page, close } = await openCanvasPage();

  try {
    const url = await page.evaluate((G) => {
      const MINT = '#81d8d0';
      const KO = '"Malgun Gothic", sans-serif';
      const mm = (px) => (px * 25.4 / 300).toFixed(1);

      const W = 1900, H = 2590, PX = 340, PY = 390;
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

      text('분경5컷 프레임 규격', 100, 122, { size: 52, color: '#15181b', weight: 'bold' });
      text('1200 x 1800 px  ·  4 x 6 in  ·  300 dpi  ·  PNG (배경 투명)', 100, 176, {
        size: 28, color: '#6d6a64',
      });
      g.fillStyle = MINT;
      g.fillRect(100, 208, 150, 6);

      g.save();
      g.translate(PX, PY);

      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, G.W, G.H);
      g.strokeStyle = '#3a3f45';
      g.lineWidth = 3;
      g.strokeRect(0, 0, G.W, G.H);

      // 여백과 간격 - 학과 물품 그릴 자리
      g.fillStyle = 'rgba(129,216,208,0.14)';
      g.fillRect(0, 0, G.W, G.MY);
      g.fillRect(0, G.H - G.MY, G.W, G.MY);
      g.fillRect(0, G.MY, G.MX, G.H - 2 * G.MY);
      g.fillRect(G.W - G.MX, G.MY, G.MX, G.H - 2 * G.MY);
      g.fillRect(G.channel.x, G.MY, G.channel.w, G.H - 2 * G.MY);
      for (let row = 1; row < 3; row++) {
        g.fillRect(G.MX, G.MY + row * (G.CH + G.GY) - G.GY, G.W - 2 * G.MX, G.GY);
      }

      // 재단 여유 3mm
      g.save();
      g.setLineDash([10, 8]);
      g.strokeStyle = '#e04a3f';
      g.lineWidth = 2;
      g.strokeRect(35, 35, G.W - 70, G.H - 70);
      g.restore();

      for (const s of G.slots) {
        g.fillStyle = '#e9f7f5';
        g.fillRect(s.x, s.y, s.w, s.h);
        g.strokeStyle = '#2aa89e';
        g.lineWidth = 3;
        g.strokeRect(s.x, s.y, s.w, s.h);

        text(String(s.n), s.x + s.w / 2, s.y + 190, {
          size: 104, color: '#2aa89e', align: 'center', weight: 'bold',
        });
        text(G.CW + ' x ' + G.CH + ' px', s.x + s.w / 2, s.y + 252, {
          size: 27, color: '#1f5e59', align: 'center', weight: '600',
        });
        text(mm(G.CW) + ' x ' + mm(G.CH) + ' mm', s.x + s.w / 2, s.y + 292, {
          size: 23, color: '#5d8b87', align: 'center',
        });
        text('x ' + s.x + '   y ' + s.y, s.x + s.w / 2, s.y + 340, {
          size: 22, color: '#8aa8a5', align: 'center',
        });
      }

      const b = G.brand;
      g.save();
      g.setLineDash([14, 9]);
      g.strokeStyle = '#8d8d8d';
      g.lineWidth = 3;
      g.strokeRect(b.x, b.y, b.w, b.h);
      g.restore();
      text('로고 칸', b.x + b.w / 2, b.y + 200, { size: 44, color: '#6f6f6f', align: 'center', weight: 'bold' });
      text('사진 안 들어감', b.x + b.w / 2, b.y + 252, { size: 25, color: '#8d8d8d', align: 'center' });
      text(G.CW + ' x ' + G.CH + ' px', b.x + b.w / 2, b.y + 296, { size: 23, color: '#a0a0a0', align: 'center' });

      g.restore();

      function arrow(x1, y1, x2, y2) {
        g.save();
        g.strokeStyle = '#c0392b';
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

      function vdim(x, y1, y2, label) {
        arrow(x, y1, x, y2);
        text(label, x - 18, (y1 + y2) / 2 + 8, { size: 25, color: '#c0392b', align: 'right', weight: '600' });
      }
      function hdim(y, x1, x2, label, align) {
        arrow(x1, y, x2, y);
        text(label, (x1 + x2) / 2, y - 16, {
          size: 25, color: '#c0392b', align: align || 'center', weight: '600',
        });
      }

      // 세로 치수 - 판 왼쪽
      vdim(PX - 40, PY, PY + G.MY, '위 여백 ' + G.MY + 'px');
      vdim(PX - 40, PY + G.MY, PY + G.MY + G.CH, '사진 ' + G.CH + 'px');
      vdim(PX - 40, PY + G.MY + G.CH, PY + G.MY + G.CH + G.GY, '세로 간격 ' + G.GY + 'px');

      // 가로 치수 - 판 위쪽 두 줄
      hdim(PY - 44, PX + G.MX, PX + G.MX + G.CW, '사진 ' + G.CW + 'px');
      hdim(PY - 110, PX, PX + G.MX, '좌우 여백 ' + G.MX + 'px', 'right');
      hdim(PY - 110, PX + G.channel.x, PX + G.channel.x + G.channel.w,
        '가로 간격 ' + G.GX + 'px');

      // 범례
      let ly = PY + G.H + 84;
      text('읽는 법', 100, ly, { size: 32, color: '#15181b', weight: 'bold' });
      ly += 54;
      const legend = [
        ['민트 칸 1~5', '사진이 들어가는 자리. 완성 PNG 에서는 완전히 뚫려 있어야 함 (알파 0)'],
        ['연한 민트 배경', '학과 관련 물품 · 일러스트를 그릴 수 있는 자리'],
        ['회색 점선 칸', '로고 칸. 사진 안 들어감. 자유롭게 디자인'],
        ['빨간 점선', '재단 여유 3mm. 이 밖으로 나간 그림은 잘려 나갈 수 있음'],
      ];
      const chips = ['#e9f7f5', 'rgba(129,216,208,0.32)', '#ffffff', '#ffffff'];
      const edges = ['#2aa89e', '#2aa89e', '#8d8d8d', '#e04a3f'];
      legend.forEach((row, i) => {
        g.fillStyle = chips[i];
        g.fillRect(100, ly - 26, 34, 34);
        g.strokeStyle = edges[i];
        g.lineWidth = 2;
        if (i >= 2) { g.save(); g.setLineDash([6, 5]); g.strokeRect(100, ly - 26, 34, 34); g.restore(); }
        else g.strokeRect(100, ly - 26, 34, 34);

        text(row[0], 156, ly, { size: 26, color: '#15181b', weight: '600' });
        text(row[1], 440, ly, { size: 26, color: '#5f5c56' });
        ly += 46;
      });

      text('사진은 1 → 2 → 3 → 4 → 5 순서로 채워집니다. 칸 좌표는 바꿀 수 없습니다.', 100, ly + 24, {
        size: 26, color: '#8a2f26',
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
