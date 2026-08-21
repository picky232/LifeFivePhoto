'use strict';

/**
 * 장식 없는 흰 바탕 틀. 사진 칸 다섯 개만 뚫려 있다.
 *
 * 디자이너가 위에 그림을 얹기 시작할 바탕이자, 그대로 써도 되는 프레임이다.
 * 미리보기는 사진이 제대로 뚫린 자리에 들어가는지 확인용이다.
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
    const files = await page.evaluate(async (G) => {
      function make(w, h) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        return { c, g: c.getContext('2d') };
      }

      const out = {};

      // 흰 바탕 + 사진 칸 뚫기
      const r = make(G.W, G.H);
      r.g.fillStyle = '#ffffff';
      r.g.fillRect(0, 0, G.W, G.H);
      r.g.save();
      r.g.globalCompositeOperation = 'destination-out';
      for (const s of G.slots) r.g.fillRect(s.x, s.y, s.w, s.h);
      r.g.restore();
      out['06_빈틀_흰바탕.png'] = r.c.toDataURL('image/png');

      // 예시 사진을 채운 모습
      const palettes = [
        ['#2b5876', '#4e4376'], ['#c94b4b', '#4b134f'], ['#0f9b8e', '#065a60'],
        ['#e65c00', '#f9d423'], ['#360033', '#0b8793'],
      ];
      const samples = [0, 1, 2, 3, 4].map((i) => {
        const s = make(G.CW, G.CH);
        const grd = s.g.createLinearGradient(0, 0, G.CW, G.CH);
        grd.addColorStop(0, palettes[i][0]);
        grd.addColorStop(1, palettes[i][1]);
        s.g.fillStyle = grd;
        s.g.fillRect(0, 0, G.CW, G.CH);
        s.g.fillStyle = 'rgba(255,255,255,0.13)';
        s.g.beginPath();
        s.g.arc(G.CW / 2, G.CH * 0.40, 86, 0, Math.PI * 2);
        s.g.fill();
        s.g.fillRect(G.CW / 2 - 112, G.CH * 0.60, 224, 195);
        s.g.font = 'bold 30px "Malgun Gothic", sans-serif';
        s.g.fillStyle = 'rgba(255,255,255,0.78)';
        s.g.textAlign = 'center';
        s.g.fillText('사진 ' + (i + 1), G.CW / 2, G.CH - 30);
        return s.c;
      });

      const frame = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = out['06_빈틀_흰바탕.png'];
      });

      const p = make(G.W, G.H);
      p.g.fillStyle = '#ffffff';
      p.g.fillRect(0, 0, G.W, G.H);
      G.slots.forEach((s, i) => p.g.drawImage(samples[i], s.x, s.y, s.w, s.h));
      p.g.drawImage(frame, 0, 0, G.W, G.H);
      out['07_빈틀_미리보기.png'] = p.c.toDataURL('image/png');

      return out;
    }, GEOM);

    writeAll(outDir, files);
  } finally {
    await close();
  }
}

main().catch((e) => {
  console.error('실패:', e.message);
  process.exit(1);
});
