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
 * 칸 좌표는 frame.ts 에서 읽어온다. 여기 따로 적어두면 언젠가 갈라진다.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const FRAME_TS = path.join(__dirname, '..', 'client-src', 'src', 'lib', 'frame.ts');

/* ── 칸 자리 ─────────────────────────────────────────────── */

function readGeometry() {
  let src;
  try {
    src = fs.readFileSync(FRAME_TS, 'utf8');
  } catch {
    throw new Error(`frame.ts 를 못 찾았습니다: ${FRAME_TS}`);
  }

  const num = (re, what) => {
    const m = src.match(re);
    if (!m) throw new Error(`frame.ts 에서 ${what} 를 못 읽었습니다. 형식이 바뀌었는지 확인하세요.`);
    return Number(m[1]);
  };

  const dpi = num(/PRINT_DPI\s*=\s*(\d+)/, 'PRINT_DPI');
  const inchW = num(/PAGE_INCH\s*=\s*\{\s*w:\s*(\d+)/, 'PAGE_INCH.w');
  const inchH = num(/PAGE_INCH\s*=\s*\{[^}]*h:\s*(\d+)/, 'PAGE_INCH.h');
  const margin = num(/const MARGIN\s*=\s*(\d+)/, 'MARGIN');
  const gap = num(/const GAP\s*=\s*(\d+)/, 'GAP');
  const cols = num(/const COLS\s*=\s*(\d+)/, 'COLS');
  const rows = num(/const ROWS\s*=\s*(\d+)/, 'ROWS');

  const page = { w: inchW * dpi, h: inchH * dpi };
  const cut = {
    w: (page.w - margin * 2 - gap * (cols - 1)) / cols,
    h: (page.h - margin * 2 - gap * (rows - 1)) / rows,
  };

  // frame.ts 와 같은 좌3·우2 배치
  const cell = (c, r) => ({
    x: margin + c * (cut.w + gap),
    y: margin + r * (cut.h + gap),
    w: cut.w,
    h: cut.h,
  });
  const slots = [0, 1, 2, 3, 4].map((i) =>
    Object.assign({ index: i }, cell(i < 3 ? 0 : 1, i < 3 ? i : i - 3)),
  );

  return { page, cut, slots };
}

/* ── PNG ─────────────────────────────────────────────────── */

function decode(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) {
    throw new Error('PNG 파일이 아닙니다. 프레임은 투명이 되는 PNG 여야 합니다 (JPG 불가).');
  }

  let pos = 8;
  let ihdr = null;
  let plte = null;
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
    else if (type === 'PLTE') plte = data;
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

  return { w: ihdr.w, h: ihdr.h, alpha, hasAlpha, color: ihdr.color };
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

function check(file) {
  const { page, slots } = readGeometry();
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

  const at = (x, y) => img.alpha[y * img.w + x];

  for (const s of slots) {
    const cx = Math.round(s.x + s.w / 2);
    const cy = Math.round(s.y + s.h / 2);

    if (cx >= img.w || cy >= img.h) {
      console.log(`  칸${s.index + 1}  ✗ 그림 밖입니다`);
      ok = false;
      continue;
    }
    if (at(cx, cy) >= CLEAR) {
      console.log(`  칸${s.index + 1}  ✗ 가운데가 안 뚫려 있습니다 — 사진이 가려집니다`);
      ok = false;
      continue;
    }

    // 칸 가운데에서 밖으로 훑어 구멍의 경계를 찾는다
    let l = cx; while (l > 0 && at(l - 1, cy) < CLEAR) l--;
    let r = cx; while (r < img.w - 1 && at(r + 1, cy) < CLEAR) r++;
    let t = cy; while (t > 0 && at(cx, t - 1) < CLEAR) t--;
    let b = cy; while (b < img.h - 1 && at(cx, b + 1) < CLEAR) b++;

    const hole = { x: l, y: t, w: r - l + 1, h: b - t + 1 };

    // 구멍이 칸보다 큰 쪽이 문제다. 그 틈으로 바탕이 비친다.
    // 작은 건 프레임이 사진 가장자리를 덮는 것이라 의도된 경우가 많다
    // (지금 프레임도 아래쪽을 학과 이름표 띠로 덮는다).
    const over = {
      left: s.x - hole.x,
      top: s.y - hole.y,
      right: hole.x + hole.w - (s.x + s.w),
      bottom: hole.y + hole.h - (s.y + s.h),
    };
    const spill = Math.max(over.left, over.top, over.right, over.bottom);
    const covered = {
      left: Math.max(0, hole.x - s.x),
      top: Math.max(0, hole.y - s.y),
      right: Math.max(0, s.x + s.w - (hole.x + hole.w)),
      bottom: Math.max(0, s.y + s.h - (hole.y + hole.h)),
    };

    const mark = spill > 1 ? '✗' : '·';
    if (spill > 1) ok = false;

    console.log(
      `  칸${s.index + 1}  ${mark} 칸 ${s.x},${s.y} ${s.w}x${s.h}` +
        `  구멍 ${hole.x},${hole.y} ${hole.w}x${hole.h}` +
        (spill > 1 ? `  → 구멍이 ${spill}px 큽니다 (바탕이 비칩니다)` : '') +
        (covered.bottom > 1 ? `  아래 ${covered.bottom}px 덮음` : ''),
    );
  }

  console.log(ok ? '  → 그대로 쓸 수 있습니다' : '  → 고쳐야 합니다');
  return ok;
}

/* ── 바탕 만들기 ─────────────────────────────────────────── */

function template(outFile) {
  const { page, slots } = readGeometry();
  const px = Buffer.alloc(page.w * page.h * 4);

  // 전체를 반투명 회색으로 채운다. 디자인 위에 얹어보고 자리를 맞추기 좋게.
  for (let i = 0; i < page.w * page.h; i++) {
    px[i * 4] = 0x20;
    px[i * 4 + 1] = 0x20;
    px[i * 4 + 2] = 0x20;
    px[i * 4 + 3] = 0xff;
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
  for (const s of slots) {
    console.log(`  칸${s.index + 1}  ${s.x}, ${s.y}   ${s.w} x ${s.h}`);
  }
}

/* ── 실행 ────────────────────────────────────────────────── */

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('쓰는 법');
    console.log('  node scripts/check-frame.js <프레임.png> [...]   자리가 맞는지 잰다');
    console.log('  node scripts/check-frame.js --template <출력.png>  칸만 뚫린 바탕을 만든다');
    process.exit(2);
  }

  try {
    if (args[0] === '--template') {
      const out = args[1];
      if (!out) throw new Error('만들 파일 이름을 적어주세요.');
      template(out);
      return;
    }
    let allOk = true;
    for (const f of args) {
      if (!check(f)) allOk = false;
      console.log('');
    }
    process.exit(allOk ? 0 : 1);
  } catch (e) {
    console.error(`오류: ${e.message}`);
    process.exit(2);
  }
}

main();
