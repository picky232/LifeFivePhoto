'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const express = require('express');
const multer = require('multer');

const PORT = 3000;
const ROOT_DIR = path.join(__dirname, '..');
const CLIENT_DIR = path.join(ROOT_DIR, 'client');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const CERT_DIR = path.join(__dirname, 'certs');

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const app = express();

// 업로드를 메모리로 받은 뒤 직접 파일로 쓴다.
// 저장 파일명이 phone 필드에 의존하는데, multipart 필드 순서는 클라이언트가 보장하지 않으므로
// multer의 diskStorage filename 콜백 시점에 phone이 없을 수 있다.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

app.use(express.static(CLIENT_DIR));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/upload', upload.single('photo'), (req, res) => {
  const phone = normalizePhone(req.body.phone);

  if (!phone) {
    return res.status(400).json({ success: false, error: '전화번호가 없습니다.' });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, error: '이미지 파일이 없습니다.' });
  }

  try {
    const dateFolder = todayFolder();
    const targetDir = path.join(OUTPUT_DIR, dateFolder);
    fs.mkdirSync(targetDir, { recursive: true });

    const fileName = uniqueFileName(targetDir, phone);
    fs.writeFileSync(path.join(targetDir, fileName), req.file.buffer);

    const savedPath = `${dateFolder}/${fileName}`;
    console.log(`저장 완료: ${savedPath} (${req.file.buffer.length} bytes)`);

    res.json({ success: true, filename: savedPath });
  } catch (err) {
    console.error('저장 실패:', err);
    res.status(500).json({ success: false, error: '파일 저장에 실패했습니다.' });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? '이미지 용량이 너무 큽니다.'
        : '업로드 형식이 올바르지 않습니다.';
    return res.status(400).json({ success: false, error: message });
  }

  console.error('처리 중 오류:', err);
  res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
});

/**
 * 전화번호에서 숫자만 남기고 형식을 검사한다.
 * 이 값이 그대로 파일명이 되므로, 숫자 외 문자를 허용하면 상위 경로 이동 등
 * 의도하지 않은 위치에 파일이 쓰일 수 있다. 검사를 통과하지 못하면 null.
 */
function normalizePhone(raw) {
  if (typeof raw !== 'string') {
    return null;
  }

  const digits = raw.replace(/\D/g, '');
  return /^\d{9,11}$/.test(digits) ? digits : null;
}

function todayFolder() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * 같은 날 같은 번호로 다시 촬영한 경우 기존 파일을 덮어쓰지 않고
 * 01012345678_2.png 형태로 번호를 붙인다.
 */
function uniqueFileName(dir, phone) {
  if (!fs.existsSync(path.join(dir, `${phone}.png`))) {
    return `${phone}.png`;
  }

  let index = 2;
  while (fs.existsSync(path.join(dir, `${phone}_${index}.png`))) {
    index += 1;
  }

  return `${phone}_${index}.png`;
}

/**
 * server/certs 폴더에서 mkcert가 만든 인증서 쌍을 찾는다.
 * mkcert는 <이름>.pem / <이름>-key.pem 형태로 파일을 만든다.
 */
function loadCredentials() {
  if (!fs.existsSync(CERT_DIR)) {
    return null;
  }

  const files = fs.readdirSync(CERT_DIR).filter((name) => name.endsWith('.pem'));
  const keyFile = files.find((name) => name.endsWith('-key.pem')) || files.find((name) => name === 'key.pem');
  const certFile = files.find((name) => name !== keyFile && !name.endsWith('-key.pem'));

  if (!keyFile || !certFile) {
    return null;
  }

  return {
    key: fs.readFileSync(path.join(CERT_DIR, keyFile)),
    cert: fs.readFileSync(path.join(CERT_DIR, certFile)),
  };
}

function localAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((info) => info && info.family === 'IPv4' && !info.internal)
    .map((info) => info.address);
}

function printStartup(protocol) {
  console.log('');
  console.log(`인생오컷 서버 실행 중 (${protocol.toUpperCase()}, 포트 ${PORT})`);
  console.log(`저장 위치: ${OUTPUT_DIR}`);
  console.log('아이패드 접속 주소 후보:');

  for (const address of localAddresses()) {
    console.log(`  ${protocol}://${address}:${PORT}`);
  }

  if (protocol === 'http') {
    console.log('');
    console.log('경고: 인증서가 없어 HTTP로 실행되었습니다.');
    console.log('      Safari의 카메라 기능(getUserMedia)은 HTTPS에서만 동작합니다.');
    console.log('      server/certs 폴더에 mkcert 인증서를 넣고 다시 실행하세요.');
  }

  console.log('');
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const credentials = loadCredentials();

if (credentials) {
  https.createServer(credentials, app).listen(PORT, () => printStartup('https'));
} else {
  http.createServer(app).listen(PORT, () => printStartup('http'));
}
