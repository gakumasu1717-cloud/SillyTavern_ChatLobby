// 가짜 SillyTavern 환경 서버
//
//   npm run build && npm run harness        → http://127.0.0.1:8765/
//
// /index.js, /style.css 는 ../../dist 에서, 나머지는 이 폴더에서 제공한다.
// 확장 번들은 실제 ST에서 /scripts/extensions/third-party/<확장>/dist/index.js 에 있고
// '../../../../group-chats.js', '../../../../../script.js' 를 import 한다.
// 여기서는 번들이 /index.js 라서 그 경로들이 /group-chats.js, /script.js 로 풀리고,
// 이 폴더의 가짜 모듈이 대신 응답한다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, '..', '..', 'dist');
const port = Number(process.argv[2]) || 8765;

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
};

http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const name = urlPath === '/' ? '/index.html' : urlPath;
    const base = (name === '/index.js' || name === '/style.css') ? dist : here;
    const file = path.join(base, path.normalize(name).replace(/^([/\\])+/, ''));

    if (!file.startsWith(base) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end('not found');
        return;
    }
    res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => {
    console.log(`ChatLobby harness: http://127.0.0.1:${port}/`);
});
