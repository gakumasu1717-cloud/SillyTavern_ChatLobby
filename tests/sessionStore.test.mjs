// sessionStore.js 테스트 (가짜 localStorage / localforage)
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

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
const S = await mod('data/sessionStore.js');

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('ok -', name); }
const reset = () => { ls.clear(); idb.clear(); persist._resetPersistForTest(); };

const A = 'alice.png';
const B = 'bob.png';
const names = (sessions) => sessions.map((s) => s.name);
const chatObjs = (...files) => files.map((f) => ({ file_name: f, extra: 1 }));
const fileNames = (chats) => chats.map((c) => c.file_name);

function deepFreeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
        Object.freeze(o);
        Object.values(o).forEach(deepFreeze);
    }
    return o;
}

// ---- 상수 ----
await test('상수 값', () => {
    assert.equal(S.SESSIONS_KEY, 'chatLobby_sessions');
    assert.equal(S.SESSION_IMAGES_KEY, 'chatLobby_sessionImages');
    assert.equal(S.SESSION_ALL, 'all');
    assert.equal(S.SESSION_UNSORTED, 'unsorted');
});

// ---- 세션 CRUD ----
await test('세션 만들기 / 읽기 / 이름 변경 / 삭제', () => {
    reset();
    assert.equal(S.hasSessions(A), false);
    assert.deepEqual(S.getSessions(A), []);
    const s = S.createSession(A, '  AU  ');
    assert.match(s.id, /^s_[0-9a-z]+$/);
    assert.equal(s.name, 'AU');
    assert.deepEqual(s.chats, []);
    assert.equal(typeof s.createdAt, 'number');
    assert.equal(typeof s.updatedAt, 'number');
    assert.equal(S.hasSessions(A), true);
    assert.equal(S.hasSessions(B), false);
    assert.deepEqual(S.getSession(A, s.id), s);
    assert.equal(S.getSession(A, 'nope'), null);
    assert.equal(S.getSession(B, s.id), null, '다른 봇에서는 안 보임');

    assert.equal(S.renameSession(A, s.id, ' 분기 '), true);
    assert.equal(S.getSession(A, s.id).name, '분기');
    assert.equal(S.renameSession(A, 'nope', 'x'), false);
    assert.equal(S.renameSession(B, s.id, 'x'), false);
    assert.equal(S.renameSession(A, s.id, '   '), false, '빈 이름으로는 바꾸지 않음');
    assert.equal(S.getSession(A, s.id).name, '분기');

    assert.equal(S.deleteSession(A, 'nope'), false);
    assert.equal(S.deleteSession(A, s.id), true);
    assert.equal(S.hasSessions(A), false);
    assert.equal(S.deleteSession(A, s.id), false);
});

await test('빈 이름은 기본 이름 "새 세션"', () => {
    reset();
    assert.equal(S.createSession(A, '').name, '새 세션');
    assert.equal(S.createSession(A, '   ').name, '새 세션');
    assert.equal(S.createSession(A, undefined).name, '새 세션');
    assert.equal(S.createSession(A, null).name, '새 세션');
});

await test('createSession의 chats 옵션: .jsonl 제거, 중복 제거', () => {
    reset();
    const s = S.createSession(A, 'x', { chats: ['c1.jsonl', 'c1', 'c2.JSONL', 'c3'] });
    assert.deepEqual(s.chats, ['c1', 'c2', 'c3']);
});

await test('반환한 세션을 고쳐도 저장된 값은 그대로', () => {
    reset();
    const s = S.createSession(A, 'x', { chats: ['c1'] });
    s.chats.push('hack');
    s.name = 'hack';
    assert.deepEqual(S.getSession(A, s.id).chats, ['c1']);
    assert.equal(S.getSession(A, s.id).name, 'x');
    const list = S.getSessions(A);
    list[0].chats.push('hack2');
    assert.deepEqual(S.getSession(A, s.id).chats, ['c1']);
});

await test('세션 ID는 겹치지 않고, 겹치면 다시 뽑음', () => {
    reset();
    const orig = Math.random;
    try {
        Math.random = () => 0; // 항상 같은 값 → 첫 ID 뒤로는 반드시 충돌
        const s1 = S.createSession(A, 'one');
        const s2 = S.createSession(B, 'two'); // 다른 봇과도 겹치면 안 됨
        const s3 = S.createSession(A, 'three');
        assert.equal(new Set([s1.id, s2.id, s3.id]).size, 3);
        for (const s of [s1, s2, s3]) assert.match(s.id, /^s_[0-9a-z]+$/);
    } finally {
        Math.random = orig;
    }
});

await test('reorderSessions: 순서 변경, 목록에 없는 ID는 뒤에 유지, 모르는 ID 무시', () => {
    reset();
    const a = S.createSession(A, 'a');
    const b = S.createSession(A, 'b');
    const c = S.createSession(A, 'c');
    const d = S.createSession(A, 'd');
    S.reorderSessions(A, [c.id, a.id]);
    assert.deepEqual(names(S.getSessions(A)), ['c', 'a', 'b', 'd']);
    S.reorderSessions(A, [d.id, 'ghost', d.id, b.id]);
    assert.deepEqual(names(S.getSessions(A)), ['d', 'b', 'c', 'a']);
    S.reorderSessions(A, []);
    assert.deepEqual(names(S.getSessions(A)), ['d', 'b', 'c', 'a']);
    S.reorderSessions('nobody.png', [a.id]); // 오류 없이 무시
    S.reorderSessions(A, 'not-an-array');
    assert.deepEqual(names(S.getSessions(A)), ['d', 'b', 'c', 'a']);
});

// ---- 소속 ----
await test('다중 소속: 한 채팅이 세션 3개에 들어감', () => {
    reset();
    const s1 = S.createSession(A, 'AU');
    const s2 = S.createSession(A, '분기');
    const s3 = S.createSession(A, '페르소나');
    const s4 = S.createSession(A, '비어 있음');
    S.addChats(A, s1.id, ['chat1']);
    S.addChats(A, s2.id, ['chat1.jsonl']);
    S.addChats(A, s3.id, ['chat1']);
    assert.deepEqual(names(S.getChatSessions(A, 'chat1')), ['AU', '분기', '페르소나']);
    assert.deepEqual(names(S.getChatSessions(A, 'chat1.jsonl')), ['AU', '분기', '페르소나']);
    assert.deepEqual(S.getChatSessions(A, 'other'), []);
    assert.deepEqual(S.getChatSessions(B, 'chat1'), []);
    assert.equal(S.getSessionChatSet(A, s4.id).size, 0);
});

await test('addChats: 중복 제거, 추가된 수 반환, 순서 유지, .jsonl 제거', () => {
    reset();
    const s = S.createSession(A, 'x');
    assert.equal(S.addChats(A, s.id, ['c1', 'c2', 'c2', 'c3.jsonl']), 3);
    assert.equal(S.addChats(A, s.id, ['c2', 'c4', 'c3', 'c1.JSONL']), 1);
    assert.deepEqual(S.getSession(A, s.id).chats, ['c1', 'c2', 'c3', 'c4']);
    assert.equal(S.addChats(A, s.id, []), 0);
    assert.equal(S.addChats(A, 'nope', ['z']), 0);
    assert.equal(S.addChats('nobody.png', s.id, ['z']), 0);
    assert.equal(S.addChats(B, s.id, ['z']), 0);
    assert.equal(S.hasSessions(B), false, '없는 봇에 항목이 생기지 않음');
});

await test('removeChats: 제거된 수 반환', () => {
    reset();
    const s = S.createSession(A, 'x', { chats: ['c1', 'c2', 'c3'] });
    assert.equal(S.removeChats(A, s.id, ['c2.jsonl', 'c9', 'c2']), 1);
    assert.deepEqual(S.getSession(A, s.id).chats, ['c1', 'c3']);
    assert.equal(S.removeChats(A, s.id, ['c9']), 0);
    assert.equal(S.removeChats(A, 'nope', ['c1']), 0);
    assert.equal(S.removeChats('nobody.png', s.id, ['c1']), 0);
    assert.equal(S.removeChats(A, s.id, ['c1', 'c3']), 2);
    assert.deepEqual(S.getSession(A, s.id).chats, [], '채팅이 0개여도 세션은 남음');
    assert.equal(S.hasSessions(A), true);
});

await test('setChatMembership: add + remove 한 번에', () => {
    reset();
    const s1 = S.createSession(A, 's1', { chats: ['c1', 'c2'] });
    const s2 = S.createSession(A, 's2', { chats: ['c1'] });
    const s3 = S.createSession(A, 's3');
    S.setChatMembership(A, ['c1', 'c2.jsonl'], { add: [s3.id], remove: [s1.id] });
    assert.deepEqual(S.getSession(A, s1.id).chats, []);
    assert.deepEqual(S.getSession(A, s2.id).chats, ['c1']);
    assert.deepEqual(S.getSession(A, s3.id).chats, ['c1', 'c2']);
    // 이미 들어 있는 것은 중복 없이
    S.setChatMembership(A, ['c1', 'c5'], { add: [s2.id, s3.id] });
    assert.deepEqual(S.getSession(A, s2.id).chats, ['c1', 'c5']);
    assert.deepEqual(S.getSession(A, s3.id).chats, ['c1', 'c2', 'c5']);
    // 모르는 ID 무시, 옵션 생략 가능
    S.setChatMembership(A, ['c1'], { add: ['ghost'], remove: ['ghost2'] });
    S.setChatMembership(A, ['c1']);
    S.setChatMembership(A, ['c1'], null);
    S.setChatMembership('nobody.png', ['c1'], { add: [s1.id] });
    assert.deepEqual(S.getSession(A, s3.id).chats, ['c1', 'c2', 'c5']);
});

await test('setChatMembership: 같은 ID가 add와 remove 양쪽에 있으면 remove가 이김', () => {
    reset();
    const s1 = S.createSession(A, 's1', { chats: ['c1'] });
    const s2 = S.createSession(A, 's2');
    S.setChatMembership(A, ['c1', 'c2'], { add: [s1.id, s2.id], remove: [s1.id] });
    assert.deepEqual(S.getSession(A, s1.id).chats, []);
    assert.deepEqual(S.getSession(A, s2.id).chats, ['c1', 'c2']);
    S.setChatMembership(A, ['c3'], { add: [s2.id], remove: [s2.id] });
    assert.deepEqual(S.getSession(A, s2.id).chats, ['c1', 'c2'], '들어 있지 않던 것은 추가도 안 됨');
});

await test('setChatMembership: 여러 세션 변경이 한 번에 반영됨', async () => {
    reset();
    await persist.initPersist([S.SESSIONS_KEY]);
    const s1 = S.createSession(A, 's1', { chats: ['c1'] });
    const s2 = S.createSession(A, 's2');
    const s3 = S.createSession(A, 's3');
    await persist.flushPersist();
    idb.delete(S.SESSIONS_KEY);
    S.setChatMembership(A, ['c1', 'c2'], { add: [s2.id, s3.id], remove: [s1.id] });
    await persist.flushPersist(); // 이 한 번의 flush에 세 세션 변경이 모두 들어 있음
    const stored = idb.get(S.SESSIONS_KEY).characters[A].sessions;
    assert.deepEqual(stored.map((s) => s.chats), [[], ['c1', 'c2'], ['c1', 'c2']]);
});

await test('filterChatsBySession: 실제 세션 / all / unsorted / 모르는 ID / .jsonl', () => {
    reset();
    const s1 = S.createSession(A, 's1', { chats: ['c1', 'c2'] });
    const s2 = S.createSession(A, 's2', { chats: ['c2', 'c3'] });
    const chats = chatObjs('c1.jsonl', 'c2.jsonl', 'c3.jsonl', 'c4.jsonl', 'c5');
    const frozen = Object.freeze([...chats]);

    assert.deepEqual(fileNames(S.filterChatsBySession(A, s1.id, frozen)), ['c1.jsonl', 'c2.jsonl']);
    assert.deepEqual(fileNames(S.filterChatsBySession(A, s2.id, frozen)), ['c2.jsonl', 'c3.jsonl']);
    const all = S.filterChatsBySession(A, S.SESSION_ALL, frozen);
    assert.deepEqual(fileNames(all), fileNames(chats));
    assert.notEqual(all, frozen, '새 배열');
    assert.deepEqual(fileNames(S.filterChatsBySession(A, S.SESSION_UNSORTED, frozen)), ['c4.jsonl', 'c5']);
    assert.deepEqual(S.filterChatsBySession(A, 'ghost', frozen), []);
    assert.deepEqual(S.filterChatsBySession(B, s1.id, frozen), []);
    // 같은 객체를 돌려줌 (복제 아님)
    assert.equal(S.filterChatsBySession(A, s1.id, frozen)[0], chats[0]);
    // 세션이 없는 봇의 unsorted는 전부
    assert.equal(S.filterChatsBySession(B, S.SESSION_UNSORTED, frozen).length, 5);
    // 입력이 이상해도 던지지 않음
    assert.deepEqual(S.filterChatsBySession(A, s1.id, null), []);
    // file_name이 없는 항목이 섞여 있어도 던지지 않음 (c1은 s1에 있으니 빠지고 나머지 둘은 미분류)
    assert.equal(S.filterChatsBySession(A, S.SESSION_UNSORTED, [{ file_name: 'c1' }, null, {}]).length, 2);
});

await test('getAssignedChatSet', () => {
    reset();
    assert.equal(S.getAssignedChatSet(A).size, 0);
    S.createSession(A, 's1', { chats: ['c1', 'c2'] });
    S.createSession(A, 's2', { chats: ['c2', 'c3'] });
    S.createSession(B, 'other', { chats: ['zz'] });
    assert.deepEqual([...S.getAssignedChatSet(A)].sort(), ['c1', 'c2', 'c3']);
    assert.deepEqual([...S.getAssignedChatSet(B)], ['zz']);
});

// ---- 메모 ----
await test('메모: 저장 / 읽기 / trim / 2000자 / 삭제', () => {
    reset();
    assert.equal(S.getMemo(A, 'c1'), '');
    S.setMemo(A, 'c1.jsonl', '  hello  ');
    assert.equal(S.getMemo(A, 'c1'), 'hello');
    assert.equal(S.getMemo(A, 'c1.jsonl'), 'hello');
    assert.equal(S.getMemo(B, 'c1'), '');
    S.setMemo(A, 'c1', 'x'.repeat(2500));
    assert.equal(S.getMemo(A, 'c1').length, 2000);
    S.setMemo(A, 'c1', 'x'.repeat(2000));
    assert.equal(S.getMemo(A, 'c1').length, 2000);
    S.setMemo(A, 'c1', '   ');
    assert.equal(S.getMemo(A, 'c1'), '');
    S.setMemo(A, 'c2', 'keep');
    S.setMemo(A, 'c2', '');
    assert.equal(S.getMemo(A, 'c2'), '');
    S.setMemo(A, 'nope', ''); // 없는 메모 삭제는 무시
    S.setMemo(A, 'c3', undefined);
    assert.equal(S.getMemo(A, 'c3'), '');
});

await test('메모는 세션과 무관하게 채팅 단위로 저장됨', () => {
    reset();
    S.setMemo(A, 'c1', 'note');
    assert.equal(S.hasSessions(A), false);
    assert.equal(S.getMemo(A, 'c1'), 'note');
});

// ---- 이름 변경 / 삭제 ----
await test('renameChat: 모든 세션과 메모를 새 이름으로 옮김', () => {
    reset();
    const s1 = S.createSession(A, 's1', { chats: ['x', 'old', 'y'] });
    const s2 = S.createSession(A, 's2', { chats: ['old'] });
    const s3 = S.createSession(A, 's3', { chats: ['y'] });
    S.setMemo(A, 'old', 'my memo');
    S.renameChat(A, 'old.jsonl', 'new.jsonl');
    assert.deepEqual(S.getSession(A, s1.id).chats, ['x', 'new', 'y'], '자리 유지');
    assert.deepEqual(S.getSession(A, s2.id).chats, ['new']);
    assert.deepEqual(S.getSession(A, s3.id).chats, ['y']);
    assert.equal(S.getMemo(A, 'new'), 'my memo');
    assert.equal(S.getMemo(A, 'old'), '');
});

await test('renameChat: old === new 이면 아무 일도 없음 (.jsonl 차이만 있어도)', () => {
    reset();
    const s = S.createSession(A, 's', { chats: ['c1'] });
    S.setMemo(A, 'c1', 'm');
    const snap = JSON.stringify(persist.persistGet(S.SESSIONS_KEY, () => null));
    S.renameChat(A, 'c1', 'c1');
    S.renameChat(A, 'c1', 'c1.jsonl');
    assert.equal(JSON.stringify(persist.persistGet(S.SESSIONS_KEY, () => null)), snap);
    assert.deepEqual(S.getSession(A, s.id).chats, ['c1']);
    assert.equal(S.getMemo(A, 'c1'), 'm');
    S.renameChat(A, '', 'z');
    S.renameChat(A, 'c1', '');
    S.renameChat('nobody.png', 'c1', 'c2');
    assert.deepEqual(S.getSession(A, s.id).chats, ['c1']);
});

await test('renameChat: 새 이름이 이미 세션에 있으면 중복 없이 합침', () => {
    reset();
    const s = S.createSession(A, 's', { chats: ['a', 'b'] });
    S.renameChat(A, 'a', 'b');
    assert.deepEqual(S.getSession(A, s.id).chats, ['b']);
});

await test('removeChat: 모든 세션과 메모에서 제거', () => {
    reset();
    const s1 = S.createSession(A, 's1', { chats: ['c1', 'c2'] });
    const s2 = S.createSession(A, 's2', { chats: ['c1'] });
    S.setMemo(A, 'c1', 'm');
    S.setMemo(A, 'c2', 'keep');
    S.removeChat(A, 'c1.jsonl');
    assert.deepEqual(S.getSession(A, s1.id).chats, ['c2']);
    assert.deepEqual(S.getSession(A, s2.id).chats, []);
    assert.equal(S.getMemo(A, 'c1'), '');
    assert.equal(S.getMemo(A, 'c2'), 'keep');
    S.removeChat(A, 'never-there');
    S.removeChat('nobody.png', 'c1');
    assert.equal(S.hasSessions('nobody.png'), false);
});

await test('removeCharacter: 세션·메모·이미지 전부 제거, 다른 봇은 그대로', () => {
    reset();
    const a1 = S.createSession(A, 'a1');
    const a2 = S.createSession(A, 'a2');
    const b1 = S.createSession(B, 'b1', { chats: ['k'] });
    S.setMemo(A, 'c1', 'm');
    S.setSessionImage(a1.id, 'data:image/jpeg;base64,AAA');
    S.setSessionImage(a2.id, 'data:image/jpeg;base64,BBB');
    S.setSessionImage(b1.id, 'data:image/jpeg;base64,CCC');
    S.removeCharacter(A);
    assert.deepEqual(S.getSessions(A), []);
    assert.equal(S.getMemo(A, 'c1'), '');
    assert.equal(S.getSessionImage(a1.id), null);
    assert.equal(S.getSessionImage(a2.id), null);
    assert.equal(S.getSessionImage(b1.id), 'data:image/jpeg;base64,CCC');
    assert.deepEqual(S.getSession(B, b1.id).chats, ['k']);
    assert.equal('alice.png' in persist.persistGet(S.SESSIONS_KEY, () => null).characters, false);
    S.removeCharacter('nobody.png'); // 오류 없음
});

await test('deleteSession은 그 세션의 이미지만 지움', () => {
    reset();
    const s1 = S.createSession(A, 's1');
    const s2 = S.createSession(A, 's2');
    S.setSessionImage(s1.id, 'data:image/jpeg;base64,AAA');
    S.setSessionImage(s2.id, 'data:image/jpeg;base64,BBB');
    S.deleteSession(A, s1.id);
    assert.equal(S.getSessionImage(s1.id), null);
    assert.equal(S.getSessionImage(s2.id), 'data:image/jpeg;base64,BBB');
});

await test('세션 이미지: 저장 / null로 제거', () => {
    reset();
    assert.equal(S.getSessionImage('s_none'), null);
    S.setSessionImage('s_x', 'data:image/jpeg;base64,AAA');
    assert.equal(S.getSessionImage('s_x'), 'data:image/jpeg;base64,AAA');
    S.setSessionImage('s_x', null);
    assert.equal(S.getSessionImage('s_x'), null);
    assert.deepEqual(persist.persistGet(S.SESSION_IMAGES_KEY, () => null), {});
    S.setSessionImage('s_none', null); // 없는 이미지 제거는 무시
});

// ---- 빈 항목 정리 ----
await test('세션 0개 + 메모 0개가 된 봇 항목은 저장에서 제거', () => {
    reset();
    const root = () => persist.persistGet(S.SESSIONS_KEY, () => null);
    const s = S.createSession(A, 's');
    assert.ok(A in root().characters);
    S.deleteSession(A, s.id);
    assert.equal(A in root().characters, false);

    S.setMemo(A, 'c1', 'm');
    assert.ok(A in root().characters, '메모만 있어도 항목 유지');
    const s2 = S.createSession(A, 's2');
    S.deleteSession(A, s2.id);
    assert.ok(A in root().characters, '세션은 없어도 메모가 있으면 유지');
    S.setMemo(A, 'c1', '');
    assert.equal(A in root().characters, false);

    S.setMemo(A, 'c1', 'm');
    S.removeChat(A, 'c1');
    assert.equal(A in root().characters, false);

    S.setMemo(A, 'c1', 'm');
    S.removeCharacter(A);
    assert.equal(A in root().characters, false);
});

// ---- 깨진 데이터 ----
await test('깨진 루트 (객체 아님 / 버전 다름)는 빈 것으로 취급하고 계속 동작', () => {
    for (const bad of ['garbage', 42, null, [], { version: 2, characters: { [A]: { sessions: [{ id: 's_1', name: 'x', chats: [] }] } } }, { version: 1, characters: 'str' }]) {
        reset();
        persist.persistSet(S.SESSIONS_KEY, bad);
        assert.deepEqual(S.getSessions(A), [], JSON.stringify(bad));
        assert.equal(S.hasSessions(A), false);
        assert.equal(S.getMemo(A, 'c'), '');
        assert.equal(S.getAssignedChatSet(A).size, 0);
        assert.deepEqual(S.filterChatsBySession(A, S.SESSION_UNSORTED, chatObjs('a')).length, 1);
        assert.equal(S.deleteSession(A, 's_1'), false);
        S.removeChat(A, 'c');
        S.removeCharacter(A);
        // 쓰기는 정상 동작
        const s = S.createSession(A, 'fresh', { chats: ['c1'] });
        assert.deepEqual(names(S.getSessions(A)), ['fresh']);
        assert.deepEqual(S.getSession(A, s.id).chats, ['c1']);
    }
});

await test('깨진 봇 항목은 그 봇만 빈 것으로 취급, 다른 봇은 정상', () => {
    reset();
    const good = S.createSession(B, 'good', { chats: ['k'] });
    const root = persist.persistGet(S.SESSIONS_KEY, () => null);
    root.characters[A] = { sessions: 'oops', memos: 5 };
    root.characters['c.png'] = 'string entry';
    root.characters['d.png'] = { sessions: [null, 7, { id: 's_ok', name: 'ok', chats: 'bad' }, { name: 'no id' }], memos: [] };

    assert.deepEqual(S.getSessions(A), []);
    assert.equal(S.hasSessions(A), false);
    assert.equal(S.getMemo(A, 'x'), '');
    assert.deepEqual(S.getSessions('c.png'), []);
    assert.deepEqual(S.getSessions(B).map((s) => s.id), [good.id]);
    // 일부만 깨진 항목: 읽을 수 있는 세션만 보이고 chats가 깨졌으면 빈 목록
    assert.deepEqual(S.getSessions('d.png').map((s) => [s.id, s.chats]), [['s_ok', []]]);

    // 쓰기: 깨진 봇도 새로 시작할 수 있고, 다른 봇은 영향 없음
    const fresh = S.createSession(A, 'fresh');
    S.setMemo(A, 'x', 'memo');
    assert.deepEqual(names(S.getSessions(A)), ['fresh']);
    assert.equal(S.getMemo(A, 'x'), 'memo');
    assert.equal(S.addChats(A, fresh.id, ['z']), 1);
    assert.deepEqual(S.getSession(B, good.id).chats, ['k']);
    // 깨진 봇 삭제도 던지지 않음
    S.removeCharacter('c.png');
    S.removeCharacter('d.png');
    S.removeChat('c.png', 'x');
});

await test('깨진 이미지 저장소도 던지지 않음', () => {
    reset();
    persist.persistSet(S.SESSION_IMAGES_KEY, 'junk');
    assert.equal(S.getSessionImage('s_1'), null);
    const s = S.createSession(A, 's');
    S.setSessionImage(s.id, 'data:image/png;base64,AA');
    assert.equal(S.getSessionImage(s.id), 'data:image/png;base64,AA');
    persist.persistSet(S.SESSION_IMAGES_KEY, { [s.id]: 123 });
    assert.equal(S.getSessionImage(s.id), null);
});

await test('이상한 avatar / 파일명은 던지지 않고 무시', () => {
    reset();
    for (const bad of [undefined, null, '', 42, {}, '__proto__']) {
        assert.deepEqual(S.getSessions(bad), []);
        assert.equal(S.hasSessions(bad), false);
        assert.equal(S.createSession(bad, 'x'), null);
        assert.equal(S.addChats(bad, 's_1', ['c']), 0);
        S.setMemo(bad, 'c', 'm');
        S.removeCharacter(bad);
    }
    S.setMemo(A, '__proto__', 'm');
    assert.equal(S.getMemo(A, '__proto__'), '');
    assert.equal({}.m, undefined, '프로토타입 오염 없음');
});

// ---- 마이그레이션 ----
const makeLobby = () => ({
    folders: [
        { id: 'favorites', name: '⭐ 즐겨찾기', isSystem: true, order: 0 },
        { id: 'uncategorized', name: '📁 미분류', isSystem: true, order: 999 },
        { id: 'f1', name: 'AU', isSystem: false, order: 1 },
        { id: 'f2', name: '분기', isSystem: false, order: 2 },
    ],
    chatAssignments: {
        'alice.png::chat1': 'f1',
        'alice.png::chat2.jsonl': 'f1',
        'alice.png::chat3': 'f2',
        'bob.png::chat9': 'f1',
    },
    favorites: ['alice.png::chat1'],
});

await test('마이그레이션: 기본 동작', () => {
    reset();
    const lobby = deepFreeze(makeLobby());
    const r = S.migrateFoldersToSessions(lobby);
    assert.deepEqual(r, { created: 3, skipped: false });
    assert.deepEqual(S.getSessions(A).map((s) => [s.name, s.chats]), [['AU', ['chat1', 'chat2']], ['분기', ['chat3']]]);
    assert.deepEqual(S.getSessions(B).map((s) => [s.name, s.chats]), [['AU', ['chat9']]]);
    assert.equal(persist.persistGet(S.SESSIONS_KEY, () => null).migratedFromFolders, true);
});

await test('마이그레이션: lobbyData를 수정하지 않음', () => {
    reset();
    const lobby = makeLobby();
    const copy = structuredClone(lobby);
    S.migrateFoldersToSessions(lobby);
    assert.deepEqual(lobby, copy);
    // 동결된 객체로도 통과하는지는 위 테스트가 확인
});

await test('마이그레이션: 시스템 폴더 / 모르는 폴더 ID / group_ 아바타 건너뜀', () => {
    reset();
    const lobby = deepFreeze({
        folders: [
            { id: 'favorites', name: '⭐ 즐겨찾기', isSystem: true },
            { id: 'uncategorized', name: '📁 미분류', isSystem: true },
            { id: 'f1', name: 'AU' },
        ],
        chatAssignments: {
            'alice.png::c1': 'favorites',
            'alice.png::c2': 'uncategorized',
            'alice.png::c3': 'deleted-folder',
            'group_123::g1': 'f1',
            'group_abc.png::g2': 'f1',
            'alice.png::c4': 'f1',
            'no-separator': 'f1',
            'alice.png::': 'f1',
        },
    });
    const r = S.migrateFoldersToSessions(lobby);
    assert.deepEqual(r, { created: 1, skipped: false });
    assert.deepEqual(S.getSessions(A).map((s) => [s.name, s.chats]), [['AU', ['c4']]]);
    assert.deepEqual(Object.keys(persist.persistGet(S.SESSIONS_KEY, () => null).characters), [A]);
});

await test('마이그레이션: 같은 이름의 세션은 새로 만들지 않고 합침', () => {
    reset();
    // 1) 이미 있는 세션에 합침
    const existing = S.createSession(A, 'AU', { chats: ['chat1', 'old'] });
    const r = S.migrateFoldersToSessions(makeLobby());
    assert.deepEqual(r, { created: 2, skipped: false }, 'alice의 AU는 새로 안 만듦: 분기 + bob의 AU');
    const sessions = S.getSessions(A);
    assert.deepEqual(names(sessions), ['AU', '분기']);
    assert.equal(sessions[0].id, existing.id);
    assert.deepEqual(sessions[0].chats, ['chat1', 'old', 'chat2'], '중복 없이 뒤에 추가');

    // 2) 이름이 같은 폴더 두 개는 한 세션으로
    reset();
    const lobby = {
        folders: [{ id: 'x', name: '같은이름' }, { id: 'y', name: ' 같은이름 ' }],
        chatAssignments: { 'alice.png::a': 'x', 'alice.png::b': 'y' },
    };
    assert.deepEqual(S.migrateFoldersToSessions(lobby), { created: 1, skipped: false });
    assert.deepEqual(S.getSessions(A).map((s) => [s.name, s.chats]), [['같은이름', ['a', 'b']]]);
});

await test('마이그레이션: 두 번째 호출은 { created: 0, skipped: true }이고 아무것도 바꾸지 않음', () => {
    reset();
    const lobby = makeLobby();
    S.migrateFoldersToSessions(lobby);
    const snap = JSON.stringify(persist.persistGet(S.SESSIONS_KEY, () => null));
    assert.deepEqual(S.migrateFoldersToSessions(lobby), { created: 0, skipped: true });
    assert.deepEqual(S.migrateFoldersToSessions(lobby), { created: 0, skipped: true });
    assert.equal(JSON.stringify(persist.persistGet(S.SESSIONS_KEY, () => null)), snap);
    // 사용자가 세션을 지운 뒤에도 되살아나지 않음
    const first = S.getSessions(A)[0];
    S.deleteSession(A, first.id);
    S.migrateFoldersToSessions(lobby);
    assert.equal(S.getSession(A, first.id), null);
});

await test('마이그레이션: 폴더가 없어도 플래그는 true', () => {
    for (const lobby of [{ folders: [], chatAssignments: {} }, {}, null, undefined, { folders: 'bad', chatAssignments: [] }]) {
        reset();
        assert.deepEqual(S.migrateFoldersToSessions(lobby), { created: 0, skipped: false });
        assert.equal(persist.persistGet(S.SESSIONS_KEY, () => null).migratedFromFolders, true);
        assert.deepEqual(S.migrateFoldersToSessions(lobby), { created: 0, skipped: true });
    }
});

await test('마이그레이션: 깨진 저장값 위에서도 동작', () => {
    reset();
    persist.persistSet(S.SESSIONS_KEY, 'garbage');
    assert.deepEqual(S.migrateFoldersToSessions(makeLobby()), { created: 3, skipped: false });
    assert.equal(S.getSessions(A).length, 2);
});

// ---- 저장 ----
await test('변경한 데이터가 flushPersist 뒤 localforage(IndexedDB)에 실제로 저장됨', async () => {
    reset();
    await persist.initPersist([S.SESSIONS_KEY, S.SESSION_IMAGES_KEY]);
    const s = S.createSession(A, 'AU', { chats: ['c1.jsonl', 'c2'] });
    S.setMemo(A, 'c1', 'memo');
    S.setSessionImage(s.id, 'data:image/jpeg;base64,AAA');
    await persist.flushPersist();

    const stored = idb.get(S.SESSIONS_KEY);
    assert.equal(stored.version, 1);
    assert.equal(stored.migratedFromFolders, false);
    assert.deepEqual(stored.characters[A].sessions.map((x) => [x.id, x.name, x.chats]), [[s.id, 'AU', ['c1', 'c2']]]);
    assert.deepEqual(stored.characters[A].memos, { c1: 'memo' });
    assert.deepEqual(idb.get(S.SESSION_IMAGES_KEY), { [s.id]: 'data:image/jpeg;base64,AAA' });
    assert.equal(ls.has(S.SESSIONS_KEY), false, 'localStorage는 쓰지 않음');

    // 다시 불러오면 같은 값 (모듈이 값을 따로 들고 있지 않음)
    persist._resetPersistForTest();
    await persist.initPersist([S.SESSIONS_KEY, S.SESSION_IMAGES_KEY]);
    assert.deepEqual(S.getSession(A, s.id).chats, ['c1', 'c2']);
    assert.equal(S.getMemo(A, 'c1'), 'memo');
    assert.equal(S.getSessionImage(s.id), 'data:image/jpeg;base64,AAA');

    // 삭제도 저장에 반영
    S.deleteSession(A, s.id);
    S.setMemo(A, 'c1', '');
    await persist.flushPersist();
    assert.equal(A in idb.get(S.SESSIONS_KEY).characters, false);
    assert.deepEqual(idb.get(S.SESSION_IMAGES_KEY), {});
});

reset(); // 대기 중인 저장 타이머 정리
console.log(`\n${passed} passed`);
