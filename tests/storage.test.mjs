// persist.js + calendarStorage.js 테스트 (가짜 localStorage / localforage)
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const src = process.argv[2] || path.join(here, '..', 'src');
const mod = (rel) => import(pathToFileURL(path.join(src, rel)).href);

// ---- 가짜 브라우저 저장소 ----
const ls = new Map();
globalThis.localStorage = {
    getItem: (k) => (ls.has(k) ? ls.get(k) : null),
    setItem: (k, v) => { ls.set(k, String(v)); },
    removeItem: (k) => { ls.delete(k); },
};
const idb = new Map();
globalThis.window = globalThis;
globalThis.document = { addEventListener() {}, visibilityState: 'visible' };
globalThis.addEventListener = () => {};
globalThis.localforage = {
    getItem: async (k) => (idb.has(k) ? structuredClone(idb.get(k)) : null),
    setItem: async (k, v) => { idb.set(k, structuredClone(v)); return v; },
    removeItem: async (k) => { idb.delete(k); },
};

const persist = await mod('data/persist.js');
const cal = await mod('data/calendarStorage.js');

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('ok -', name); }
const reset = () => { ls.clear(); idb.clear(); persist._resetPersistForTest(); cal.clearAllSnapshots(); persist._resetPersistForTest(); idb.clear(); ls.clear(); };

await test('localStorage 데이터가 IndexedDB로 옮겨지고 localStorage에서 지워짐', async () => {
    reset();
    ls.set('chatLobby_reminds', JSON.stringify([{ id: 'r1', avatar: 'a.png' }]));
    await persist.initPersist(['chatLobby_reminds']);
    assert.deepEqual(idb.get('chatLobby_reminds'), [{ id: 'r1', avatar: 'a.png' }]);
    assert.equal(ls.has('chatLobby_reminds'), false);
    assert.equal(persist.persistGet('chatLobby_reminds', () => []).length, 1);
});

await test('저장은 IndexedDB로 가고 localStorage는 쓰지 않음', async () => {
    reset();
    await persist.initPersist(['k']);
    persist.persistSet('k', { a: 1 });
    await persist.flushPersist();
    assert.deepEqual(idb.get('k'), { a: 1 });
    assert.equal(ls.has('k'), false);
});

await test('IndexedDB 값이 있으면 그 값이 우선 (init 전 수정은 버림)', async () => {
    reset();
    idb.set('k', ['stored']);
    persist.persistSet('k', ['pre-init']);
    await persist.initPersist(['k']);
    assert.deepEqual(persist.persistGet('k', () => []), ['stored']);
});

// ---- 캘린더 ----
function makeV1(days, chars) {
    // 날짜마다 전 캐릭터의 수를 통째로 저장하던 예전 형식
    const snapshots = {};
    const counts = Object.fromEntries(chars.map((c, i) => [c, 100 + i]));
    for (let d = 0; d < days; d++) {
        const date = `2026-${String(Math.floor(d / 28) + 1).padStart(2, '0')}-${String((d % 28) + 1).padStart(2, '0')}`;
        // 하루에 캐릭터 2명만 바뀜
        const a = chars[d % chars.length];
        const b = chars[(d * 7 + 3) % chars.length];
        counts[a] += 5;
        counts[b] += 2;
        snapshots[date] = {
            total: Object.values(counts).reduce((x, y) => x + y, 0),
            topChar: a,
            byChar: { ...counts },
            lastChatTimes: { [a]: 1000 + d },
        };
    }
    return { version: 1, snapshots };
}

await test('v1 → v2 변환: 모든 날짜·캐릭터의 값이 원래와 같고 크기가 크게 줄어듦', async () => {
    reset();
    const chars = Array.from({ length: 200 }, (_, i) => `char${i}.png`);
    const v1 = makeV1(120, chars);
    idb.set(cal.CALENDAR_STORAGE_KEY, v1);
    await persist.initPersist([cal.CALENDAR_STORAGE_KEY, 'chatLobby_calendar_v1_backup']);
    await cal.initCalendarStorage();

    for (const [date, snap] of Object.entries(v1.snapshots)) {
        for (const c of chars) {
            assert.equal(cal.getCharCount(c, date), snap.byChar[c], `${date} ${c}`);
        }
        assert.equal(cal.getSnapshot(date).total, snap.total);
        assert.equal(cal.getSnapshot(date).topChar, snap.topChar);
        assert.deepEqual(cal.getFullByChar(date), snap.byChar);
    }
    await persist.flushPersist();
    const before = JSON.stringify(v1).length;
    const after = JSON.stringify(idb.get(cal.CALENDAR_STORAGE_KEY)).length;
    console.log(`   size: ${before} → ${after} bytes (${(100 * after / before).toFixed(1)}%)`);
    assert.ok(after < before * 0.1);
    assert.equal(idb.get(cal.CALENDAR_STORAGE_KEY).version, 2);
    assert.ok(idb.has('chatLobby_calendar_v1_backup'), 'v1 백업 보관');
});

await test('바뀐 봇만 저장 + 합계/증가량 계산', async () => {
    reset();
    await persist.initPersist([cal.CALENDAR_STORAGE_KEY]);
    const y = new Date().getFullYear();
    cal.saveSnapshot(`${y}-03-01`, { counts: { 'a.png': 10, 'b.png': 20, 'c.png': 30 } });
    const d2 = cal.saveSnapshot(`${y}-03-02`, { counts: { 'a.png': 15, 'b.png': 20, 'c.png': 30 } });
    assert.deepEqual(d2.changed, { 'a.png': 15 }, 'a만 바뀜');
    assert.equal(d2.total, 65);
    assert.equal(d2.topChar, 'a.png');
    // 수를 아는 봇만 넘겨도 됨
    const d3 = cal.saveSnapshot(`${y}-03-03`, { counts: { 'c.png': 37 } });
    assert.deepEqual(d3.changed, { 'c.png': 37 });
    assert.equal(d3.total, 72);
    assert.equal(cal.getCharCount('a.png', `${y}-03-03`), 15);
    assert.equal(cal.getCharCount('c.png', `${y}-03-03`, false), 30);
    // 저장된 날짜별 데이터에 전체 맵이 없어야 함
    const raw = persist.persistGet(cal.CALENDAR_STORAGE_KEY, () => null);
    assert.equal('byChar' in raw.snapshots[`${y}-03-02`], false);
});

await test('같은 날 다시 저장하면 그날 변경분을 합침 (합계 중복 없음)', async () => {
    const y = new Date().getFullYear();
    const again = cal.saveSnapshot(`${y}-03-03`, { counts: { 'a.png': 18, 'c.png': 40 } });
    assert.deepEqual(again.changed, { 'c.png': 40, 'a.png': 18 });
    assert.equal(again.total, 65 + (40 - 30) + (18 - 15));
    const back = cal.saveSnapshot(`${y}-03-03`, { counts: { 'a.png': 15 } });
    assert.deepEqual(back.changed, { 'c.png': 40 }, '원래대로 돌아온 봇은 변경분에서 빠짐');
});

await test('기록이 없던 기존 봇은 기준값에만 추가 (증가로 안 잡힘), 새 봇은 증가로 잡힘', async () => {
    const y = new Date().getFullYear();
    const before = cal.getSnapshot(`${y}-03-03`).total;
    const d4 = cal.saveSnapshot(`${y}-03-04`, { counts: { 'new.png': 4 }, backfill: { 'old.png': 500 } });
    assert.deepEqual(d4.changed, { 'new.png': 4 });
    assert.equal(d4.total, before + 4);
    assert.equal(cal.hasCharHistory('old.png'), true);
    assert.equal(cal.getCharCount('old.png', `${y}-03-01`), 500, '기준값이라 처음부터 있던 것으로 취급');
    const d5 = cal.saveSnapshot(`${y}-03-05`, { counts: { 'old.png': 510 } });
    assert.deepEqual(d5.changed, { 'old.png': 510 });
    assert.equal(d5.total, d4.total + 10);
});

await test('전체 삭제', async () => {
    cal.clearAllSnapshots();
    assert.deepEqual(cal.loadSnapshots(), {});
    assert.equal(cal.getCharCount('a.png', '2099-01-01'), 0);
});

console.log(`\n${passed} passed`);
