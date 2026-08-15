'use strict';

/**
 * API 명세서 대조 테스트.
 *
 * 서버를 별도 포트와 임시 저장 경로로 직접 띄운 뒤 명세의 각 항목을 검사한다.
 * 실제 output/ 폴더와 3000번 포트는 건드리지 않으므로, 운영 중인 서버가 떠 있어도
 * 함께 실행할 수 있다.
 *
 * 실행: npm test
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');

const HOST = '127.0.0.1';
const PORT = 3443;
const CA_PATH = path.join(__dirname, 'certs', 'ca', 'rootCA.pem');
const SERVER_PATH = path.join(__dirname, 'server.js');

// 서버가 이미지 내용을 해석하지 않으므로 최소 크기의 PNG면 충분하다.
const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

let outputDir;
let serverProcess;
let agent;
const serverLog = [];

const results = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function todayFolder() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function request(method, urlPath, options = {}) {
  const { headers = {}, body = null } = options;

  return new Promise((resolve, reject) => {
    const req = https.request(
      { host: HOST, port: PORT, path: urlPath, method, headers, agent },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        );
      }
    );

    req.on('error', reject);

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

/**
 * 명세서에 적힌 multipart/form-data 형식 그대로 요청 본문을 만든다.
 */
function multipart(fields) {
  const boundary = `----LifeFivePhotoTest${Math.abs(fields.length * 7919 + fields.length)}`;
  const parts = [];

  for (const field of fields) {
    parts.push(Buffer.from(`--${boundary}\r\n`));

    if (field.filename) {
      parts.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${field.name}"; filename="${field.filename}"\r\n` +
            `Content-Type: ${field.contentType}\r\n\r\n`
        )
      );
      parts.push(field.value);
    } else {
      parts.push(Buffer.from(`Content-Disposition: form-data; name="${field.name}"\r\n\r\n`));
      parts.push(Buffer.from(String(field.value)));
    }

    parts.push(Buffer.from('\r\n'));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const body = Buffer.concat(parts);

  return {
    body,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length,
    },
  };
}

function upload({ phone, photo = TEST_PNG, filename = 'capture.png' } = {}) {
  const fields = [];

  if (phone !== undefined) {
    fields.push({ name: 'phone', value: phone });
  }
  if (photo !== null) {
    fields.push({ name: 'photo', filename, contentType: 'image/png', value: photo });
  }

  const { body, headers } = multipart(fields);

  return request('POST', '/upload', { headers, body });
}

function expect(actual, expected, label) {
  const actualText = JSON.stringify(actual);
  const expectedText = JSON.stringify(expected);

  if (actualText !== expectedText) {
    throw new Error(`${label} — 기대: ${expectedText}, 실제: ${actualText}`);
  }
}

async function check(spec, name, fn) {
  try {
    await fn();
    results.push({ spec, name, ok: true });
  } catch (err) {
    results.push({ spec, name, ok: false, message: err.message });
  }
}

async function startServer() {
  if (!fs.existsSync(CA_PATH)) {
    throw new Error(`CA 인증서가 없습니다: ${CA_PATH}\n먼저 node generate-cert.js 를 실행하세요.`);
  }

  agent = new https.Agent({ ca: fs.readFileSync(CA_PATH) });
  outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifefivephoto-test-'));

  serverProcess = spawn(process.execPath, [SERVER_PATH], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(PORT), OUTPUT_DIR: outputDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout.on('data', (chunk) => serverLog.push(chunk.toString()));
  serverProcess.stderr.on('data', (chunk) => serverLog.push(chunk.toString()));

  const deadline = Date.now() + 15000;

  while (Date.now() < deadline) {
    try {
      const res = await request('GET', '/health');
      if (res.status === 200) {
        return;
      }
    } catch (err) {
      // 아직 기동 중
    }

    await sleep(300);
  }

  throw new Error(`서버가 시작되지 않았습니다.\n${serverLog.join('')}`);
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (outputDir) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
}

async function runTests() {
  const today = todayFolder();

  await check('GET /health', '200과 {"status":"ok"} 응답', async () => {
    const res = await request('GET', '/health');
    expect(res.status, 200, '상태 코드');
    expect(JSON.parse(res.body), { status: 'ok' }, '본문');
  });

  await check('GET /', '200과 text/html 응답', async () => {
    const res = await request('GET', '/');
    expect(res.status, 200, '상태 코드');

    if (!res.headers['content-type'] || !res.headers['content-type'].includes('text/html')) {
      throw new Error(`Content-Type — 기대: text/html 포함, 실제: ${res.headers['content-type']}`);
    }
  });

  await check('GET /camera.js', '없는 정적 파일은 404', async () => {
    // 명세상 client/ 폴더의 정적 리소스는 그대로 서빙되고, 없으면 404여야 한다.
    // camera.js 는 클라이언트 구현이 들어오기 전이라 아직 존재하지 않는다.
    const res = await request('GET', '/camera.js');
    expect(res.status, 404, '상태 코드');
  });

  await check('GET /정적파일', '한글 경로도 없으면 404', async () => {
    const res = await request('GET', encodeURI('/존재하지-않는-파일.js'));
    expect(res.status, 404, '상태 코드');
  });

  await check('POST /upload', '정상 업로드 시 200과 저장 경로 반환', async () => {
    const res = await upload({ phone: '01012345678' });
    expect(res.status, 200, '상태 코드');
    expect(
      JSON.parse(res.body),
      { success: true, filename: `${today}/01012345678.png` },
      '본문'
    );
  });

  await check('POST /upload', '응답한 경로에 파일이 실제로 저장됨', async () => {
    const saved = path.join(outputDir, today, '01012345678.png');

    if (!fs.existsSync(saved)) {
      throw new Error(`파일이 없습니다: ${saved}`);
    }
    if (!fs.readFileSync(saved).equals(TEST_PNG)) {
      throw new Error('저장된 파일 내용이 전송한 이미지와 다릅니다.');
    }
  });

  await check('POST /upload', '하이픈이 섞인 전화번호는 숫자만 남김', async () => {
    const res = await upload({ phone: '010-3333-4444' });
    expect(res.status, 200, '상태 코드');
    expect(
      JSON.parse(res.body),
      { success: true, filename: `${today}/01033334444.png` },
      '본문'
    );
  });

  await check('POST /upload', '같은 번호 재업로드 시 덮어쓰지 않고 _2 저장', async () => {
    const res = await upload({ phone: '01012345678' });
    expect(res.status, 200, '상태 코드');
    expect(
      JSON.parse(res.body),
      { success: true, filename: `${today}/01012345678_2.png` },
      '본문'
    );
  });

  await check('POST /upload', '전화번호 누락 시 400', async () => {
    const res = await upload({});
    expect(res.status, 400, '상태 코드');
    expect(JSON.parse(res.body), { success: false, error: '전화번호가 없습니다.' }, '본문');
  });

  await check('POST /upload', '이미지 누락 시 400', async () => {
    const res = await upload({ phone: '01012345678', photo: null });
    expect(res.status, 400, '상태 코드');
    expect(JSON.parse(res.body), { success: false, error: '이미지 파일이 없습니다.' }, '본문');
  });

  await check('POST /upload', '숫자가 아닌 전화번호는 400', async () => {
    const res = await upload({ phone: 'abcdefghijk' });
    expect(res.status, 400, '상태 코드');
    expect(JSON.parse(res.body), { success: false, error: '전화번호가 없습니다.' }, '본문');
  });

  await check('POST /upload', '자릿수가 모자란 전화번호는 400', async () => {
    const res = await upload({ phone: '0101234' });
    expect(res.status, 400, '상태 코드');
  });

  await check('POST /upload', '경로 조작 시도는 400이고 파일이 생기지 않음', async () => {
    const res = await upload({ phone: '../../evil' });
    expect(res.status, 400, '상태 코드');

    const escaped = path.join(outputDir, '..', 'evil.png');

    if (fs.existsSync(escaped)) {
      throw new Error(`상위 경로에 파일이 생성되었습니다: ${escaped}`);
    }
  });

  await check('POST /upload', '용량 초과(20MB) 시 400', async () => {
    const oversized = Buffer.alloc(21 * 1024 * 1024, 1);
    const res = await upload({ phone: '01055556666', photo: oversized });
    expect(res.status, 400, '상태 코드');

    const body = JSON.parse(res.body);
    expect(body.success, false, 'success 필드');
  });

  await check('HTTPS', '서버 인증서가 rootCA로 검증됨', async () => {
    // 이 파일의 모든 요청은 rootCA를 신뢰 목록으로 지정한 agent를 쓴다.
    // 인증서가 유효하지 않거나 SAN에 127.0.0.1이 없으면 위 검사들이 먼저 실패한다.
    const res = await request('GET', '/health');
    expect(res.status, 200, '상태 코드');
  });
}

function report() {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  const specWidth = Math.max(...results.map((r) => r.spec.length));

  console.log('');
  console.log('API 명세서 대조 결과');
  console.log('-'.repeat(78));

  for (const result of results) {
    const mark = result.ok ? 'PASS' : 'FAIL';
    console.log(`  ${mark}  ${result.spec.padEnd(specWidth)}  ${result.name}`);

    if (!result.ok) {
      console.log(`        ${result.message}`);
    }
  }

  console.log('-'.repeat(78));
  console.log(`  통과 ${passed} / 전체 ${results.length}${failed ? ` (실패 ${failed})` : ''}`);
  console.log('');

  return failed === 0;
}

async function main() {
  try {
    await startServer();
    await runTests();
  } catch (err) {
    console.error('테스트 실행 실패:', err.message);
    stopServer();
    process.exit(1);
  }

  stopServer();

  if (!report()) {
    process.exit(1);
  }
}

main();
