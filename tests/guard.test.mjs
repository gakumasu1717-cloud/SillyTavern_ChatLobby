// SaveGuard 동작 테스트 (가짜 ST 서버 + 가짜 window)
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
const guardPath = process.argv[2] || path.join(here, '..', 'src', 'safety', 'saveGuard.js');

// ---- 가짜 서버 (ST 서버의 integrity 검사 재현) ----
const files = new Map(); // key: avatar::file -> array [header, ...msgs]
const key = (b) => `${b.avatar_url}::${b.file_name}`;
const calls = [];
async function parseBody(init) {
    if (typeof init.body === 'string') return JSON.parse(init.body);
    const stream = new Blob([init.body]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(stream).text());
}
let failGet = false;
async function fakeServer(url, init = {}) {
    calls.push(url);
    if (url === '/api/chats/group/get') {
        const b = JSON.parse(init.body);
        return Response.json(files.get(`group::${b.id}`) ?? []);
    }
    if (url === '/api/chats/group/save') {
        const b = await parseBody(init);
        const k = `group::${b.id}`;
        const existing = files.get(k);
        const slug = b.chat?.[0]?.chat_metadata?.integrity;
        const fileSlug = existing?.[0]?.chat_metadata?.integrity;
        if (!b.force && slug && existing && existing.length && fileSlug && fileSlug !== slug) {
            return Response.json({ error: 'integrity' }, { status: 400 });
        }
        files.set(k, b.chat);
        return Response.json({ ok: true });
    }
    if (url === '/api/chats/get') {
        if (failGet) throw new Error('network down');
        const b = JSON.parse(init.body);
        return Response.json(files.get(key(b)) ?? {});
    }
    if (url === '/api/chats/save') {
        const b = await parseBody(init);
        const existing = files.get(key(b));
        const slug = b.chat?.[0]?.chat_metadata?.integrity;
        const fileSlug = existing?.[0]?.chat_metadata?.integrity;
        if (!b.force && slug && existing && existing.length && fileSlug && fileSlug !== slug) {
            return Response.json({ error: 'integrity' }, { status: 400 });
        }
        files.set(key(b), b.chat);
        return Response.json({ ok: true });
    }
    return new Response('other', { status: 200 });
}

// ---- 가짜 브라우저 환경 ----
const toasts = [];
let reloads = 0;
globalThis.window = globalThis;
globalThis.document = { getElementById: () => null };
globalThis.toastr = {
    warning: (m) => toasts.push(['warning', m]),
    error: (m) => toasts.push(['error', m]),
};
globalThis.SillyTavern = {
    getContext: () => ({
        getRequestHeaders: () => ({ 'Content-Type': 'application/json' }),
        reloadCurrentChat: async () => { reloads++; },
    }),
};
globalThis.fetch = fakeServer;

const guard = await import(pathToFileURL(guardPath).href);
guard.installSaveGuard();

const AV = 'alice.png';
const msg = (i, extra = {}) => ({ name: 'x', mes: `m${i}`, send_date: `d${i}`, ...extra });
const chatOf = (slug, n, start = 0) => [{ chat_metadata: slug ? { integrity: slug } : {} }, ...Array.from({ length: n }, (_, i) => msg(start + i))];
const save = (file, chat, extra = {}) => fetch('/api/chats/save', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ch_name: 'Alice', file_name: file, avatar_url: AV, chat, ...extra }),
});
const wait = (ms) => new Promise(r => setTimeout(r, ms));
let passed = 0;
async function test(name, fn) {
    toasts.length = 0;
    await fn();
    passed++;
    console.log('ok -', name);
}

await test('일반 저장은 서버 확인 없이 통과', async () => {
    files.set(`${AV}::chatA`, chatOf('A', 10));
    calls.length = 0;
    const r = await save('chatA', chatOf('A', 11));
    assert.equal(r.status, 200);
    assert.equal(files.get(`${AV}::chatA`).length, 12);
    assert.deepEqual(calls, ['/api/chats/save']);
});

await test('로드 실패 후 인사말(표식 없음) 저장 → 차단, 원본 유지, 채팅 재로드', async () => {
    const r = await save('chatA', chatOf(null, 1, 100));
    assert.equal(r.status, 200);
    assert.equal((await r.json()).ok, true);
    assert.equal(files.get(`${AV}::chatA`).length, 12, '원본 그대로');
    assert.equal(toasts[0][0], 'warning');
    await wait(400);
    assert.equal(reloads, 1);
});

await test('gzip 압축된 같은 요청도 차단', async () => {
    const body = JSON.stringify({ ch_name: 'Alice', file_name: 'chatA', avatar_url: AV, chat: chatOf(null, 1, 100) });
    const gz = new Uint8Array(await new Response(new Blob([body]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    const r = await fetch('/api/chats/save', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' }, body: gz });
    assert.equal(r.status, 200);
    assert.equal(files.get(`${AV}::chatA`).length, 12);
});

await test('새 채팅(파일 없음) 인사말 저장 → 통과', async () => {
    const r = await save('chatNew', chatOf('N', 1));
    assert.equal(r.status, 200);
    assert.equal(files.get(`${AV}::chatNew`).length, 2);
});

await test('같은 채팅에서 1개만 남기고 삭제 → 통과', async () => {
    files.set(`${AV}::chatB`, chatOf('B', 8));
    await save('chatB', chatOf('B', 1));
    assert.equal(files.get(`${AV}::chatB`).length, 2);
});

await test('다른 채팅 내용이 덮어쓰려 함(서버 integrity 거부) → 새로고침 대신 복구본 저장', async () => {
    files.set(`${AV}::chatC`, chatOf('C', 6));
    const r = await save('chatC', chatOf('A', 9));
    assert.equal(r.status, 200, 'ST에 400을 넘기지 않음 → 새로고침 팝업 없음');
    assert.equal(files.get(`${AV}::chatC`).length, 7, '원본 그대로');
    const rescue = [...files.keys()].find(k => k.startsWith(`${AV}::chatC [복구 `));
    assert.ok(rescue, '복구본 생성');
    assert.equal(files.get(rescue).length, 10);
});

await test('표식 없는 옛날 파일: 첫 메시지 같으면 통과, 새 인사말이면 차단', async () => {
    files.set(`${AV}::legacy`, chatOf(null, 5));
    await save('legacy', chatOf('L', 1, 0));
    assert.equal(files.get(`${AV}::legacy`).length, 2, '같은 첫 메시지 → 사용자 삭제로 보고 통과');
    files.set(`${AV}::legacy2`, chatOf(null, 5));
    await save('legacy2', chatOf('L2', 1, 50));
    assert.equal(files.get(`${AV}::legacy2`).length, 6, '다른 인사말 → 차단');
});

await test('서버 확인 실패하면 통과 (정상 저장을 막지 않음)', async () => {
    files.set(`${AV}::chatD`, chatOf('D', 4));
    failGet = true;
    await save('chatD', chatOf(null, 1, 70));
    failGet = false;
    assert.equal(files.get(`${AV}::chatD`).length, 2);
});

await test('force 저장(사용자가 OVERWRITE 확인)은 그대로 통과', async () => {
    files.set(`${AV}::chatE`, chatOf('E', 4));
    await save('chatE', chatOf(null, 1, 80), { force: true });
    assert.equal(files.get(`${AV}::chatE`).length, 2);
});

await test('같은 파일에서 차단이 반복되면 자동 재로드 중단 + 오류 안내', async () => {
    files.set(`${AV}::chatF`, chatOf('F', 5));
    const before = reloads;
    await save('chatF', chatOf(null, 1, 90)); await wait(350);
    await save('chatF', chatOf(null, 1, 91)); await wait(350);
    await save('chatF', chatOf(null, 1, 92)); await wait(350);
    assert.equal(reloads - before, 2);
    assert.ok(toasts.some(t => t[0] === 'error'));
    assert.equal(files.get(`${AV}::chatF`).length, 6);
});

const gsave = (id, chat) => fetch('/api/chats/group/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, chat }) });

await test('그룹: 일반 저장 통과', async () => {
    files.set('group::g1', chatOf('G', 5));
    await gsave('g1', chatOf('G', 6));
    assert.equal(files.get('group::g1').length, 7);
});

await test('그룹: 로드 실패 후 인사말(표식 없음) 덮어쓰기 차단', async () => {
    await gsave('g1', chatOf(null, 1, 200));
    assert.equal(files.get('group::g1').length, 7);
    assert.ok(toasts.some(t => t[1].includes('"g1"')));
});

await test('그룹: integrity 불일치 → 복구본 저장, 원본 유지', async () => {
    files.set('group::g2', chatOf('X', 4));
    const r = await gsave('g2', chatOf('Y', 6));
    assert.equal(r.status, 200);
    assert.equal(files.get('group::g2').length, 5);
    assert.ok([...files.keys()].some(k => k.startsWith('group::g2 [복구 ')));
});

await test('그룹: 새 그룹 채팅(파일 없음) 인사말 저장 통과', async () => {
    await gsave('gNew', chatOf('N2', 2));
    assert.equal(files.get('group::gNew').length, 3);
});

await test('저장 외 요청은 그대로 통과', async () => {
    const r = await fetch('/api/characters/all', { method: 'POST', body: '{}' });
    assert.equal(await r.text(), 'other');
});

await test('해제하면 원래 fetch 복원', async () => {
    guard.uninstallSaveGuard();
    assert.equal(globalThis.fetch, fakeServer);
});

console.log(`\n${passed} passed`);
