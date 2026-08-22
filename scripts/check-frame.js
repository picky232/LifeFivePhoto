#!/usr/bin/env node
'use strict';

/**
 * 프레임 PNG 가 코드의 칸 자리와 맞는지 잰다.
 *
 * 프레임은 사진이 빠진 뼈대 그림이다. 사진 자리는 투명하게 뚫려 있어야 하고,
 * 그 구멍이 client-src/src/lib/frame.ts 의 SLOTS 와 맞아야 한다.
 * 어긋나면 사진이 삐져나오거나 틈으로 바탕이 비치는데, 붙여보기 전에는
 * 눈으로 알기 어렵다. 그래서 숫자로 재둔다.
 *
 *   node scripts/check-frame.js client-src/public/frames/classic.png
 *   node scripts/check-frame.js --template 새프레임-바탕.png
 *
 * 칸 자리는 frame.ts 를 그대로 불러와서 쓴다. 여기서 좌표를 다시 계산하면
 * frame.ts 의 배치가 바뀌었을 때 조용히 갈라진다 — 그러면 도구가 옛 자리를
 * 기준으로 "맞다"고 말하게 된다.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pathToFileURL } = require('url');

const FRAME_TS = path.join(__dirname, '..', 'client-src', 'src', 'lib', 'frame.ts');

/* ── 칸 자리 ─────────────────────────────────────────────── */

/**
 * frame.ts 를 불러온다.
 *
 * Node 는 22.6 부터 .ts 의 타입만 걷어내고 실행할 수 있다. client-src 에
 * package.json 이 type 을 안 적어둬서 "CommonJS 로 못 읽어 ESM 으로 다시 읽는다"는
 * 경고가 뜨는데, 결과에는 영향이 없으므로 그 경고만 걸러낸다.
 */
async function readGeometry() {
  // 걸러낸 것만 빼고 그대로 흘려보낸다. 모아뒀다 나중에 찍으면 이 경고가
  // 다음 틱에 오기 때문에 진짜 경고가 영영 안 나오게 된다.
  process.removeAllListeners('warning');
  process.on('warning', (w) => {
    if (w.code === 'MODULE_TYPELESS_PACKAGE_JSON') return;
    console.warn(w.stack || w.message);
  });

  if (!fs.existsSync(FRAME_TS)) {
    throw new Error(`frame.ts 를 못 찾았습니다: ${FRAME_TS}`);
  }

  let mod;
  try {
    mod = await import(pathToFileURL(FRAME_TS).href);
  } catch (e) {
    throw new Error(
      `frame.ts 를 불러오지 못했습니다 — ${e.message}\n` +
        '  .ts 를 그대로 실행하려면 Node 22.6 이상이 필요합니다 (node --version).',
    );
  }

  const page = mod.PAGE;
  const slots = mod.SLOTS;
  if (!page || typeof page.w !== 'number' || typeof page.h !== 'number') {
    throw new Error('frame.ts 에 PAGE 가 없습니다.');
  }
  if (!Array.isArray(slots) || slots.length === 0) {
    throw new Error('frame.ts 에 SLOTS 가 없습니다.');
  }
  // 칸 자리는 화소 단위라 정수여야 한다. 소수가 섞이면 화소를 셀 때 색인이
  // 소수가 되어 없는 자리를 읽고, 아무 말 없이 틀린 값이 나온다.
  // frame.ts 가 여백·간격으로 나눠서 만드는 값이라 안 나누어떨어지면 이렇게 된다.
  slots.forEach((s, i) => {
    for (const k of ['x', 'y', 'w', 'h']) {
      if (typeof s[k] !== 'number') throw new Error(`SLOTS[${i}] 의 ${k} 가 숫자가 아닙니다.`);
      if (!Number.isInteger(s[k])) {
        throw new Error(
          `SLOTS[${i}] 의 ${k} 가 정수가 아닙니다 (${s[k]}). ` +
            'frame.ts 의 여백·간격이 종이 크기로 나누어떨어지는지 확인하세요.',
        );
      }
    }
  });

  return { page, slots };
}

/* ── PNG ─────────────────────────────────────────────────── */

function decode(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) {
    throw new Error('PNG 파일이 아닙니다. 프레임은 투명이 되는 PNG 여야 합니다 (JPG 불가).');
  }

  let pos = 8;
  let ihdr = null;
  let trns = null;
  const idat = [];

  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      ihdr = {
        w: data.readUInt32BE(0),
        h: data.readUInt32BE(4),
        depth: data[8],
        color: data[9],
        interlace: data[12],
      };
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'tRNS') trns = data;
    else if (type === 'IEND') break;
    pos += 12 + len;
  }

  if (!ihdr) throw new Error('PNG 머리 정보를 읽지 못했습니다.');
  if (ihdr.depth !== 8) throw new Error(`8비트 PNG 만 잽니다 (이 파일은 ${ihdr.depth}비트).`);
  if (ihdr.interlace) throw new Error('인터레이스 PNG 는 잴 수 없습니다. 저장할 때 꺼주세요.');

  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ihdr.color];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = ihdr.w * ch;
  const out = Buffer.alloc(ihdr.h * stride);

  // 스캔라인마다 필터가 걸려 있어 되돌린다
  for (let y = 0; y < ihdr.h; y++) {
    const ft = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= ch ? prev[i - ch] : 0;
      let v = src[i];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 0xff;
    }
  }

  const alpha = new Uint8Array(ihdr.w * ihdr.h);
  let hasAlpha = true;
  for (let i = 0; i < ihdr.w * ihdr.h; i++) {
    if (ihdr.color === 6) alpha[i] = out[i * 4 + 3];
    else if (ihdr.color === 4) alpha[i] = out[i * 2 + 1];
    else if (ihdr.color === 3) {
      const idx = out[i];
      alpha[i] = trns && idx < trns.length ? trns[idx] : 255;
    } else {
      alpha[i] = 255;
      hasAlpha = false;
    }
  }

  // 밝기도 같이 뽑는다 — 가장자리 흰 테를 재는 데 쓴다
  const light = new Uint8Array(ihdr.w * ihdr.h);
  for (let i = 0; i < light.length; i++) {
    if (ihdr.color === 6) light[i] = Math.min(out[i * 4], out[i * 4 + 1], out[i * 4 + 2]);
    else if (ihdr.color === 2) light[i] = Math.min(out[i * 3], out[i * 3 + 1], out[i * 3 + 2]);
    else if (ihdr.color === 4) light[i] = out[i * 2];
    else light[i] = out[i];
  }

  return { w: ihdr.w, h: ihdr.h, alpha, light, hasAlpha };
}

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  let c = -1;
  const body = out.subarray(4, 8 + data.length);
  for (let i = 0; i < body.length; i++) c = CRC[(c ^ body[i]) & 0xff] ^ (c >>> 8);
  out.writeUInt32BE((c ^ -1) >>> 0, 8 + data.length);
  return out;
}

/* ── 재기 ────────────────────────────────────────────────── */

const CLEAR = 16; // 이 값보다 투명하면 "뚫렸다"고 본다
const SLACK = 1; // 가장자리 1px 은 그림 저장할 때 생기는 흐림으로 본다
const PROBE = 24; // 칸 밖으로 몇 px 까지 새는지 살펴볼 깊이

/**
 * 이만큼도 안 뚫렸으면 안 뚫린 것으로 본다.
 *
 * 딱 0 으로만 걸러내면 화소 몇 개가 우연히 비친 그림이 "뚫림 0%" 라고
 * 찍히면서 통과한다. 사진이 사실상 다 가려지는데도 그렇다.
 */
const MIN_OPEN = 0.02;

const SIDE_KO = { left: '왼쪽', right: '오른쪽', top: '위', bottom: '아래' };

/**
 * 칸 하나를 잰다.
 *
 * 예전에는 칸 가운데에서 십자로 한 줄씩 훑어 구멍의 네모를 잡았다. 그 방법은
 * 구멍이 반듯한 네모일 때만 맞는다. 사진 위로 걸치는 장식(테이프·리본)이
 * 가운데를 가로지르면 "안 뚫렸다"고 잘못 말한다 — 기획서가 허용하는 디자인인데도.
 *
 * 그래서 지금은 네모를 잡지 않고 세 가지를 따로 센다.
 *   뚫린 넓이   칸 안에서 실제로 비어 있는 비율
 *   덮인 가장자리 네 변에서 프레임이 몇 px 을 덮고 있는지
 *   새는 자리   칸 밖으로 구멍이 얼마나 나갔는지 (이것만 잘못이다)
 */
function measureSlot(img, s, all, page) {
  const at = (x, y) => img.alpha[y * img.w + x];
  const clear = (x, y) => at(x, y) < CLEAR;

  const x0 = Math.max(0, s.x);
  const y0 = Math.max(0, s.y);
  const x1 = Math.min(img.w, s.x + s.w);
  const y1 = Math.min(img.h, s.y + s.h);
  if (x1 <= x0 || y1 <= y0) return { outside: true };

  // 뚫린 넓이
  let open = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) if (clear(x, y)) open++;
  }
  const ratio = open / (s.w * s.h);

  // 덮인 가장자리 — 변에서부터 "통째로 불투명한 줄"이 몇 줄 이어지는지
  const covered = { left: 0, right: 0, top: 0, bottom: 0 };
  const colOpaque = (x) => {
    for (let y = y0; y < y1; y++) if (clear(x, y)) return false;
    return true;
  };
  const rowOpaque = (y) => {
    for (let x = x0; x < x1; x++) if (clear(x, y)) return false;
    return true;
  };
  while (covered.left < x1 - x0 && colOpaque(x0 + covered.left)) covered.left++;
  while (covered.right < x1 - x0 && colOpaque(x1 - 1 - covered.right)) covered.right++;
  while (covered.top < y1 - y0 && rowOpaque(y0 + covered.top)) covered.top++;
  while (covered.bottom < y1 - y0 && rowOpaque(y1 - 1 - covered.bottom)) covered.bottom++;

  // 새는 자리 — 칸 바깥으로 몇 px 까지 투명한 자리가 이어지는지.
  // 이웃 칸이나 종이 끝을 넘어가지 않도록 살펴볼 깊이를 미리 줄인다.
  const overlapV = (o) => o.y < s.y + s.h && s.y < o.y + o.h;
  const overlapH = (o) => o.x < s.x + s.w && s.x < o.x + o.w;
  const room = {
    left: s.x,
    right: page.w - (s.x + s.w),
    top: s.y,
    bottom: page.h - (s.y + s.h),
  };
  for (const o of all) {
    if (o === s) continue;
    if (overlapV(o) && o.x + o.w <= s.x) room.left = Math.min(room.left, s.x - (o.x + o.w));
    if (overlapV(o) && o.x >= s.x + s.w) room.right = Math.min(room.right, o.x - (s.x + s.w));
    if (overlapH(o) && o.y + o.h <= s.y) room.top = Math.min(room.top, s.y - (o.y + o.h));
    if (overlapH(o) && o.y >= s.y + s.h) room.bottom = Math.min(room.bottom, o.y - (s.y + s.h));
  }

  const spill = { left: 0, right: 0, top: 0, bottom: 0 };
  const anyClearCol = (x) => {
    for (let y = y0; y < y1; y++) if (x >= 0 && x < img.w && clear(x, y)) return true;
    return false;
  };
  const anyClearRow = (y) => {
    for (let x = x0; x < x1; x++) if (y >= 0 && y < img.h && clear(x, y)) return true;
    return false;
  };
  const depth = (side) => Math.max(0, Math.min(PROBE, room[side]));
  for (let d = 1; d <= depth('left'); d++) { if (!anyClearCol(s.x - d)) break; spill.left = d; }
  for (let d = 1; d <= depth('right'); d++) { if (!anyClearCol(s.x + s.w - 1 + d)) break; spill.right = d; }
  for (let d = 1; d <= depth('top'); d++) { if (!anyClearRow(s.y - d)) break; spill.top = d; }
  for (let d = 1; d <= depth('bottom'); d++) { if (!anyClearRow(s.y + s.h - 1 + d)) break; spill.bottom = d; }

  return { ratio, covered, spill, room };
}

function check(file, geometry) {
  const { page, slots } = geometry;
  const img = decode(file);

  console.log(`${file}`);
  console.log(`  크기 ${img.w}x${img.h}  (필요 ${page.w}x${page.h})`);

  let ok = true;

  if (img.w !== page.w || img.h !== page.h) {
    console.log('  ✗ 크기가 다릅니다. 합성할 때 강제로 늘려 그리므로 칸이 통째로 어긋납니다.');
    ok = false;
  }
  if (!img.hasAlpha) {
    console.log('  ✗ 알파 채널이 없습니다. 사진 자리가 뚫리지 않아 사진이 안 보입니다.');
    return false;
  }

  slots.forEach((s, i) => {
    const label = `칸${i + 1}`;
    const place = `칸 ${s.x},${s.y} ${s.w}x${s.h}`;
    const m = measureSlot(img, s, slots, page);

    if (m.outside) {
      console.log(`  ${label}  ✗ ${place} — 그림 밖입니다`);
      ok = false;
      return;
    }

    const pct = Math.round(m.ratio * 100);

    if (m.ratio < MIN_OPEN) {
      const how = m.ratio === 0 ? '한 군데도 안 뚫려 있습니다' : `${pct}% 밖에 안 뚫려 있습니다`;
      console.log(`  ${label}  ✗ ${place} — ${how}. 사진이 통째로 가려집니다`);
      ok = false;
      return;
    }

    // 칸 밖으로 새는 것만 잘못이다. 그 틈으로 프레임 뒤 바탕이 비친다.
    const leaks = Object.keys(m.spill).filter((k) => m.spill[k] > SLACK);
    if (leaks.length) {
      const detail = leaks.map((k) => `${SIDE_KO[k]} ${m.spill[k]}px`).join(' · ');
      const capped = leaks.some((k) => m.spill[k] >= Math.min(PROBE, m.room[k]));
      console.log(
        `  ${label}  ✗ ${place} — 구멍이 칸 밖으로 나갔습니다 (${detail}${capped ? ' 이상' : ''}). 바탕이 비칩니다`,
      );
      ok = false;
      return;
    }

    // 덮는 것은 잘못이 아니다. 다만 얼마나 덮는지는 알려준다 —
    // 모르고 넘어가면 사진이 잘려 나간 걸 인쇄하고 나서야 안다.
    const c = m.covered;
    const parts = [];
    for (const k of ['top', 'bottom', 'left', 'right']) {
      if (c[k] > SLACK) parts.push(`${SIDE_KO[k]} ${c[k]}px`);
    }
    const big =
      c.left + c.right > s.w * 0.25 || c.top + c.bottom > s.h * 0.25;

    console.log(
      `  ${label}  ${big ? '⚠' : '·'} ${place}  뚫림 ${pct}%` +
        (parts.length ? `  덮음 ${parts.join(' · ')}` : '') +
        (big ? '  ← 사진이 많이 가려집니다. 의도한 것인지 확인하세요' : ''),
    );
  });

  console.log(ok ? '  → 그대로 쓸 수 있습니다' : '  → 고쳐야 합니다');
  return ok;
}

/* ── 재기(--measure) ─────────────────────────────────────── */

/**
 * 그림에 실제로 뚫린 자리와 가장자리 흰 테를 잰다.
 *
 * check 는 "지금 칸에 맞는가" 만 답한다. 새 프레임이 다른 자리에 뚫려 있으면
 * "안 뚫렸다" 고만 하고 어디에 뚫려 있는지는 말해주지 않는다. 프레임이 오갈
 * 때마다 그걸 따로 재고 있었기에 여기 붙인다.
 *
 * 흰 테는 frames.ts 의 trim 에 그대로 넣는 값이다 — 인쇄에는 있어야 하고
 * 고르는 화면에서만 감춘다.
 */
function measure(file, asJson) {
  const img = decode(file);
  const at = (x, y) => img.alpha[y * img.w + x];
  const clear = (x, y) => at(x, y) < CLEAR;

  if (!asJson) {
    console.log(`${file}`);
    console.log(`  크기 ${img.w}x${img.h}`);
  }

  if (!img.hasAlpha) {
    if (asJson) return { file, w: img.w, h: img.h, hasAlpha: false, holes: [], trim: null };
    console.log('  알파 채널이 없습니다 — 뚫린 자리가 없습니다.');
    console.log('  사진 자리가 흰색이라면 scripts/punch-frame.js 로 뚫으세요.');
    return null;
  }

  // 뚫린 덩어리를 찾는다
  const seen = new Uint8Array(img.w * img.h);
  const holes = [];
  for (let start = 0; start < img.w * img.h; start++) {
    if (seen[start] || at(start % img.w, (start / img.w) | 0) >= CLEAR) continue;
    let x0 = start % img.w, x1 = x0, y0 = (start / img.w) | 0, y1 = y0, area = 0;
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const p = stack.pop();
      const px = p % img.w, py = (p / img.w) | 0;
      area++;
      if (px < x0) x0 = px;
      if (px > x1) x1 = px;
      if (py < y0) y0 = py;
      if (py > y1) y1 = py;
      const near = [];
      if (px > 0) near.push(p - 1);
      if (px < img.w - 1) near.push(p + 1);
      if (py > 0) near.push(p - img.w);
      if (py < img.h - 1) near.push(p + img.w);
      for (const q of near) {
        if (seen[q] || at(q % img.w, (q / img.w) | 0) >= CLEAR) continue;
        seen[q] = 1;
        stack.push(q);
      }
    }
    // 사진 칸만 남긴다. 글자 사이 틈 같은 작은 구멍은 뺀다
    if (area < 20000) continue;
    holes.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  holes.sort((a, b) => a.y - b.y || a.x - b.x);

  if (!asJson) {
    console.log(`  뚫린 자리 ${holes.length}개`);
    for (const h of holes) {
      console.log(`      ${String(h.x).padStart(4)}, ${String(h.y).padStart(4)}   ${h.w} x ${h.h}`);
    }
  }

  // 가장자리 흰 테 — 흰색이거나 뚫린 자리를 '빈 자리' 로 본다
  const blank = (x, y) => clear(x, y) || img.light[y * img.w + x] > 246;
  const rowBlank = (y) => {
    for (let x = 0; x < img.w; x++) if (!blank(x, y)) return false;
    return true;
  };
  const colBlank = (x) => {
    for (let y = 0; y < img.h; y++) if (!blank(x, y)) return false;
    return true;
  };
  let top = 0; while (top < img.h && rowBlank(top)) top++;
  let bottom = 0; while (bottom < img.h && rowBlank(img.h - 1 - bottom)) bottom++;
  let left = 0; while (left < img.w && colBlank(left)) left++;
  let right = 0; while (right < img.w && colBlank(img.w - 1 - right)) right++;

  const trim = top || bottom || left || right ? { top, right, bottom, left } : null;
  if (asJson) return { file, w: img.w, h: img.h, hasAlpha: true, holes, trim };

  console.log('');
  if (trim) {
    console.log('  가장자리 흰 테 — frames.ts 의 trim 에 그대로 넣는 값');
    console.log(`      trim: { top: ${top}, right: ${right}, bottom: ${bottom}, left: ${left} }`);
  } else {
    console.log('  가장자리 흰 테 없음 — trim 은 적지 않아도 됩니다');
  }
  return null;
}

/* ── 바탕 만들기 ─────────────────────────────────────────── */

/** 얹어놓고 자리를 보라고 만드는 것이라 비쳐야 한다. 이 값이 255 면 쓸모가 없다. */
const TEMPLATE_ALPHA = 0x66;

function template(outFile, geometry) {
  const { page, slots } = geometry;

  // 판 밖으로 나간 칸이 있으면 조용히 안 뚫린 바탕이 나온다 (Buffer 는 범위를
  // 벗어난 쓰기를 그냥 버린다). 그런 바탕은 쓸모가 없으므로 미리 멈춘다.
  slots.forEach((s, i) => {
    if (s.x < 0 || s.y < 0 || s.x + s.w > page.w || s.y + s.h > page.h) {
      throw new Error(
        `칸${i + 1} 이 판 밖으로 나갑니다 — 칸 ${s.x},${s.y} ${s.w}x${s.h}, 판 ${page.w}x${page.h}. frame.ts 를 확인하세요.`,
      );
    }
  });

  const px = Buffer.alloc(page.w * page.h * 4);

  // 전체를 반투명 회색으로 채운다. 디자인 위에 얹어놓고 자리를 맞추기 좋게.
  for (let i = 0; i < page.w * page.h; i++) {
    px[i * 4] = 0x20;
    px[i * 4 + 1] = 0x20;
    px[i * 4 + 2] = 0x20;
    px[i * 4 + 3] = TEMPLATE_ALPHA;
  }
  // 칸은 완전히 뚫는다
  for (const s of slots) {
    for (let y = s.y; y < s.y + s.h; y++) {
      for (let x = s.x; x < s.x + s.w; x++) px[(y * page.w + x) * 4 + 3] = 0;
    }
  }

  const stride = page.w * 4;
  const raw = Buffer.alloc(page.h * (stride + 1));
  for (let y = 0; y < page.h; y++) {
    raw[y * (stride + 1)] = 0;
    px.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(page.w, 0);
  ihdr.writeUInt32BE(page.h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  fs.writeFileSync(
    outFile,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );

  console.log(`${outFile} 를 만들었습니다  ${page.w}x${page.h}`);
  console.log('뚫린 자리 (여기에 사진이 들어갑니다)');
  slots.forEach((s, i) => {
    console.log(`  칸${i + 1}  ${s.x}, ${s.y}   ${s.w} x ${s.h}`);
  });
}

/* ── 실행 ────────────────────────────────────────────────── */

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('쓰는 법');
    console.log('  node scripts/check-frame.js <프레임.png> [...]   자리가 맞는지 잰다');
    console.log('  node scripts/check-frame.js --measure <프레임.png>   뚫린 자리와 흰 테를 잰다');
    console.log('  node scripts/check-frame.js --template <출력.png>  칸만 뚫린 바탕을 만든다');
    process.exit(2);
  }

  try {
    const geometry = await readGeometry();

    if (args[0] === '--measure') {
      const asJson = args.includes('--json');
      const rest = args.slice(1).filter((a) => a !== '--json');
      if (!rest.length) throw new Error('잴 파일을 적어주세요.');
      if (asJson) {
        console.log(JSON.stringify(rest.map((f) => measure(f, true)), null, 2));
        return;
      }
      for (const f of rest) { measure(f, false); console.log(''); }
      return;
    }

    if (args[0] === '--template') {
      const out = args[1];
      if (!out) throw new Error('만들 파일 이름을 적어주세요.');
      template(out, geometry);
      return;
    }
    // 한 파일이 깨졌다고 나머지를 건너뛰면, 여러 장을 한 번에 넘겼을 때
    // 뒤쪽 파일이 멀쩡한지 알 수 없게 된다. 파일마다 따로 잡는다.
    let allOk = true;
    for (const f of args) {
      try {
        if (!check(f, geometry)) allOk = false;
      } catch (e) {
        console.log(`${f}`);
        console.log(`  ✗ ${e.message}`);
        allOk = false;
      }
      console.log('');
    }
    process.exit(allOk ? 0 : 1);
  } catch (e) {
    console.error(`오류: ${e.message}`);
    process.exit(2);
  }
}

main();
