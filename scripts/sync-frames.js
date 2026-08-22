#!/usr/bin/env node
'use strict';

/**
 * 디자이너가 폴더에 넣어둔 프레임을 앱에 반영한다.
 *
 *   node scripts/sync-frames.js            한 번 훑고 바뀐 것만 반영
 *   node scripts/sync-frames.js --watch    폴더를 지켜보다 바뀌면 알아서
 *   node scripts/sync-frames.js --from "D:\\어딘가\\Frame"
 *
 * 프레임이 오갈 때마다 같은 일을 손으로 되풀이했다 — 뚫고, 칸에 맞는지 재고,
 * 흰 테를 재고, 빌드하고, client 로 미러링한다. 한 단계라도
 * 빠뜨리면 화면에 반영이 안 되거나 사진 가장자리에 흰 테가 생긴다.
 *
 * 칸 자리가 안 맞으면 **넣지 않고 멈춘다.** 넣어두면 그 자리에 바탕이 비쳐
 * 인쇄하고 나서야 알게 된다.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const FRAMES_DIR = path.join(ROOT, 'client-src', 'public', 'frames');
// public 안에 두면 빌드 결과물에 섞여 client/ 까지 따라간다. 밖에 둔다.
const STAMP = path.join(ROOT, '.frame-sync.json');

/** 폴더에 놓인 파일 이름과 앱 안의 프레임을 잇는다 */
const MAP = [
  { source: 'frame_01.png', id: 'mint' },
  { source: 'frame_02.png', id: 'neon' },
  { source: 'frame_dark.png', id: 'dark' },
];

const DEFAULT_FROM = 'C:\\Users\\user\\Desktop\\분경오컷 작업가이드폴더\\Frame';

/* ── 잔손 ────────────────────────────────────────────────── */

const args = process.argv.slice(2);
const watch = args.includes('--watch');
const fromIdx = args.indexOf('--from');
const FROM = fromIdx >= 0 ? args[fromIdx + 1] : DEFAULT_FROM;

const say = (s) => console.log(s);
const hash = (f) => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');

function node(scriptArgs, quiet = true) {
  const r = spawnSync(process.execPath, scriptArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  });
  if (!quiet && r.stdout) process.stdout.write(r.stdout);
  return r;
}

function readStamp() {
  try { return JSON.parse(fs.readFileSync(STAMP, 'utf8')); } catch { return {}; }
}
function writeStamp(s) {
  fs.writeFileSync(STAMP, JSON.stringify(s, null, 2));
}

/* 프레임 그림의 흰 테는 재서 알려주기만 한다. 고르는 화면은 프레임을
   통째로 보여준다 — 자르지 않는다. */

/* ── 한 장 반영 ──────────────────────────────────────────── */

function apply(entry) {
  const src = path.join(FROM, entry.source);
  const dest = path.join(FRAMES_DIR, entry.id + '.png');

  /* 옆자리에서 만들어 검사한 뒤에야 제자리에 넣는다.
     예전에는 곧바로 덮어쓰고 검사에서 걸리면 지웠는데, 그러면 멀쩡히 쓰던
     프레임까지 사라져 고르는 화면에 "불러오지 못했습니다" 가 떴다. 새 파일이
     못 쓸 것이면 쓰던 것을 그대로 두는 편이 맞다. */
  const tmp = dest + '.new';

  try {
    if (path.extname(src).toLowerCase() === '.png') {
      fs.copyFileSync(src, tmp);
    } else {
      // 흰 칸을 뚫어 PNG 로 바꾼다 (마스코트는 남는다)
      const r = node([path.join(__dirname, 'punch-frame.js'), src, tmp]);
      if (r.status !== 0) throw new Error(`뚫기 실패: ${(r.stderr || r.stdout || '').trim().split('\n').pop()}`);
    }

    // 칸 자리에 맞는지
    const check = node([path.join(__dirname, 'check-frame.js'), tmp]);
    if (check.status !== 0) {
      const why = (check.stdout || '').split('\n').filter((l) => l.includes('✗')).slice(0, 2).join(' / ');
      const kept = fs.existsSync(dest) ? ' (쓰던 것은 그대로 둡니다)' : '';
      throw new Error(`칸 자리가 안 맞습니다${kept} — ${why || '자세한 것은 check-frame.js 로'}`);
    }

    // 가장자리 흰 테 — 알려주기만 한다
    const m = node([path.join(__dirname, 'check-frame.js'), '--measure', '--json', tmp]);
    if (m.status !== 0) throw new Error('재기 실패');
    const info = JSON.parse(m.stdout)[0];

    fs.renameSync(tmp, dest);

    return {
      id: entry.id,
      trim: info.trim,
      holes: info.holes.length,
    };
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

/* ── 한 바퀴 ─────────────────────────────────────────────── */

function sweep() {
  if (!fs.existsSync(FROM)) {
    say(`  폴더가 없습니다: ${FROM}`);
    return false;
  }

  const stamp = readStamp();
  const done = [];
  const failed = [];
  let touched = false;

  for (const entry of MAP) {
    const src = path.join(FROM, entry.source);
    if (!fs.existsSync(src)) continue;

    const h = hash(src);
    if (stamp[entry.source] === h) continue; // 그대로다

    try {
      const r = apply(entry);
      stamp[entry.source] = h;
      touched = true;
      done.push(r);
    } catch (e) {
      failed.push({ id: entry.id, source: entry.source, why: e.message });
    }
  }

  if (!touched && !failed.length) return false;

  for (const d of done) {
    const t = d.trim
      ? `흰 테 위 ${d.trim.top} 아래 ${d.trim.bottom} 왼 ${d.trim.left} 오른 ${d.trim.right}`
      : '흰 테 없음';
    say(`  ${d.id}  들어감 · 칸 ${d.holes}개 · ${t}`);
  }
  for (const f of failed) {
    say(`  ${f.id}  ✗ ${f.source} — ${f.why}`);
  }

  if (touched) {
    say('  빌드 중...');
    try {
      // 인자를 따로 넘기면서 shell 을 켜면 따옴표 처리가 안 돼 경고가 나고,
      // shell 없이 npx.cmd 를 부르면 윈도우에서 EINVAL 로 죽는다.
      // 명령을 한 줄로 넘기면 둘 다 피한다.
      execSync('npx --yes pnpm@10.30.2 build', {
        cwd: path.join(ROOT, 'client-src'), stdio: 'pipe',
      });
    } catch (e) {
      say('  ✗ 빌드 실패 — client/ 는 그대로 둡니다');
      say('    ' + String(e.stdout || e.message).trim().split('\n').slice(-3).join('\n    '));
      return true;
    }

    const r = spawnSync('robocopy', ['out', '..\\client', '/MIR', '/NFL', '/NDL', '/NJH', '/NP'], {
      cwd: path.join(ROOT, 'client-src'), encoding: 'utf8',
    });
    // robocopy 는 8 미만이면 정상이다 (0=변화없음, 1=복사, 3=복사+삭제)
    if ((r.status ?? 0) >= 8) {
      say('  ✗ client/ 로 옮기지 못했습니다');
      return true;
    }
    writeStamp(stamp);
    say('  반영 완료 — client/ 까지 갱신했습니다');
  } else {
    writeStamp(stamp);
  }

  return true;
}

/* ── 실행 ────────────────────────────────────────────────── */

function main() {
  say('');
  say(`  가져올 곳: ${FROM}`);

  const did = sweep();
  if (!did) say('  바뀐 프레임이 없습니다');

  if (!watch) { say(''); return; }

  say('  지켜보는 중 — 파일을 덮어쓰면 알아서 반영합니다 (Ctrl+C 로 멈춤)');
  say('');

  let busy = false;
  let timer = null;
  const kick = () => {
    clearTimeout(timer);
    // 파일을 쓰는 도중에 읽지 않도록 잠깐 기다린다
    timer = setTimeout(() => {
      if (busy) return;
      busy = true;
      try {
        const at = new Date().toTimeString().slice(0, 8);
        if (sweep()) say(`  (${at})`);
      } catch (e) {
        say('  ✗ ' + e.message);
      } finally {
        busy = false;
      }
    }, 1200);
  };

  fs.watch(FROM, { persistent: true }, kick);
}

main();
