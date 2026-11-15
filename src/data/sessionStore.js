// ============================================
// 세션 저장소 ("봇 안의 봇")
// 한 봇의 채팅을 이름 붙인 묶음(세션)으로 나눠 본다. 채팅 파일은 복사하지 않고
// 파일 이름만 참조한다. 한 채팅이 여러 세션에 동시에 들어갈 수 있다.
// 명세: docs/sessions-spec.md (3~6, 8절)
//
// 저장 위치: IndexedDB (persist.js)
// - chatLobby_sessions      : 봇별 세션 목록 + 채팅 메모
// - chatLobby_sessionImages : 세션 대체 이미지 (본 데이터와 따로 둔다.
//                             세션을 조금 바꿀 때마다 이미지까지 다시 쓰지 않기 위해)
//
// ⚠️ 저장된 값을 모듈 변수에 들고 있지 않는다. persist.js는 init 때 캐시를
//    IndexedDB 값으로 통째로 교체하므로, 항상 persistGet으로 새로 읽는다.
// ⚠️ 이 모듈은 "어떤 채팅이 실제로 있는지"를 모른다. 목록에 없는 파일명을 스스로
//    지우지 않는다 (채팅 목록 요청이 실패해 빈 배열이 오면 세션이 통째로 비워지기 때문).
//    삭제/이름 변경은 removeChat / renameChat 호출로만 반영한다.
// ============================================

import { persistGet, persistSet } from './persist.js';

export const SESSIONS_KEY = 'chatLobby_sessions';
export const SESSION_IMAGES_KEY = 'chatLobby_sessionImages';
/** 가상 세션: 전체 채팅 */
export const SESSION_ALL = 'all';
/** 가상 세션: 어느 세션에도 없는 채팅 */
export const SESSION_UNSORTED = 'unsorted';

const VERSION = 1;
const DEFAULT_SESSION_NAME = '새 세션';
const MEMO_MAX_LENGTH = 2000;
/** 폴더 → 세션 변환 때 건너뛰는 시스템 폴더 ID */
const SYSTEM_FOLDER_IDS = new Set(['favorites', 'uncategorized']);
const ID_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * @typedef {Object} Session
 * @property {string} id - "s_<영숫자>"
 * @property {string} name
 * @property {string[]} chats - .jsonl 없는 파일명. 넣은 순서 유지, 중복 없음
 * @property {number} createdAt
 * @property {number} updatedAt
 */

// ---------- 내부: 형식 검사 / 정규화 ----------

function isPlainObject(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * 객체의 키로 쓰기 안전한지 (__proto__ 로 프로토타입이 바뀌는 사고 방지)
 * @param {any} key
 * @returns {boolean}
 */
function isSafeKey(key) {
    return typeof key === 'string' && key !== '' && key !== '__proto__';
}

/**
 * 파일명 정규화: 끝의 .jsonl 제거 (ST API마다 확장자 포함 여부가 다름)
 * @param {any} name
 * @returns {string}
 */
function normName(name) {
    return typeof name === 'string' ? name.replace(/\.jsonl$/i, '') : '';
}

/**
 * 파일명 목록 정규화: 문자열 하나도 허용, 빈 값 제거, 중복 제거(처음 순서 유지)
 * @param {any} list
 * @returns {string[]}
 */
function normNames(list) {
    const arr = Array.isArray(list) ? list : (typeof list === 'string' ? [list] : []);
    const seen = new Set();
    const out = [];
    for (const item of arr) {
        const n = normName(item);
        if (n && !seen.has(n)) {
            seen.add(n);
            out.push(n);
        }
    }
    return out;
}

function makeEmptyRoot() {
    return { version: VERSION, migratedFromFolders: false, characters: {} };
}

/**
 * 저장된 루트를 읽는다. 형식이 맞지 않으면 "빈 루트"를 돌려준다 (저장하지는 않음).
 * 다음 변경 때 그 빈 루트가 저장되면서 깨진 값이 교체된다.
 * @returns {{version: number, migratedFromFolders: boolean, characters: Object}}
 */
function loadRoot() {
    const raw = persistGet(SESSIONS_KEY, makeEmptyRoot);
    if (!isPlainObject(raw) || raw.version !== VERSION) return makeEmptyRoot();
    if (!isPlainObject(raw.characters)) {
        return { version: VERSION, migratedFromFolders: raw.migratedFromFolders === true, characters: {} };
    }
    return raw;
}

function commitRoot(root) {
    persistSet(SESSIONS_KEY, root);
}

function loadImages() {
    const raw = persistGet(SESSION_IMAGES_KEY, () => ({}));
    return isPlainObject(raw) ? raw : {};
}

function commitImages(images) {
    persistSet(SESSION_IMAGES_KEY, images);
}

function validSession(s) {
    return isPlainObject(s) && typeof s.id === 'string' && s.id !== '';
}

/** 세션의 채팅 목록 (깨져 있으면 빈 배열) */
function chatsOf(session) {
    if (!Array.isArray(session.chats)) return [];
    return session.chats.filter((c) => typeof c === 'string').map(normName).filter(Boolean);
}

/**
 * 읽기용: 한 봇의 항목을 변경 없이 훑어본다.
 * 항목이 깨져 있으면 그 봇만 "세션 0개, 메모 0개"로 취급한다.
 * @returns {{sessions: object[], memos: Object<string,string>}}
 */
function peek(root, avatar) {
    const empty = { sessions: [], memos: {} };
    if (!isSafeKey(avatar) || !hasOwn(root.characters, avatar)) return empty;
    const entry = root.characters[avatar];
    if (!isPlainObject(entry)) return empty;
    return {
        sessions: Array.isArray(entry.sessions) ? entry.sessions.filter(validSession) : [],
        memos: isPlainObject(entry.memos) ? entry.memos : {},
    };
}

/**
 * 쓰기용: 한 봇의 항목을 꺼내며 깨진 부분을 제자리에서 고친다.
 * (고친 값은 호출한 쪽이 commitRoot를 해야 저장된다)
 * @param {object} root
 * @param {string} avatar
 * @param {boolean} create - 없으면 만들지
 * @returns {{sessions: object[], memos: Object<string,string>} | null}
 */
function ensureEntry(root, avatar, create) {
    if (!isSafeKey(avatar)) return null;
    let entry = hasOwn(root.characters, avatar) ? root.characters[avatar] : undefined;
    if (!isPlainObject(entry)) {
        if (!create) return null;
        entry = { sessions: [], memos: {} };
        root.characters[avatar] = entry;
    }
    entry.sessions = Array.isArray(entry.sessions) ? entry.sessions.filter(validSession) : [];
    if (!isPlainObject(entry.memos)) entry.memos = {};
    for (const s of entry.sessions) {
        s.chats = [...new Set(chatsOf(s))];
    }
    return entry;
}

/** 세션도 메모도 없는 봇 항목은 저장에서 제거 */
function pruneEntry(root, avatar) {
    if (!isSafeKey(avatar) || !hasOwn(root.characters, avatar)) return;
    const entry = root.characters[avatar];
    if (!isPlainObject(entry)) return;
    const noSessions = !Array.isArray(entry.sessions) || entry.sessions.length === 0;
    const noMemos = !isPlainObject(entry.memos) || Object.keys(entry.memos).length === 0;
    if (noSessions && noMemos) delete root.characters[avatar];
}

function cloneSession(s) {
    return { ...s, chats: chatsOf(s) };
}

function findSession(entry, sessionId) {
    return entry.sessions.find((s) => s.id === sessionId) || null;
}

/**
 * 새 세션 ID. 모든 봇의 기존 ID와 겹치지 않을 때까지 다시 뽑는다
 * (이미지가 sessionId만으로 저장되어 봇이 달라도 ID가 겹치면 안 된다).
 */
function makeSessionId(root) {
    const used = new Set();
    for (const entry of Object.values(root.characters)) {
        if (!isPlainObject(entry) || !Array.isArray(entry.sessions)) continue;
        for (const s of entry.sessions) {
            if (isPlainObject(s) && typeof s.id === 'string') used.add(s.id);
        }
    }
    // 같은 길이로 몇 번 겹치면 길이를 늘려서 반드시 끝나게 한다
    for (let len = 8; ; len++) {
        for (let i = 0; i < 20; i++) {
            let id = 's_';
            for (let k = 0; k < len; k++) id += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length) % ID_CHARS.length];
            if (!used.has(id)) return id;
        }
    }
}

function cleanName(name) {
    return (typeof name === 'string' ? name : '').trim();
}

/** root 안에 세션을 만든다 (저장은 호출한 쪽 책임) */
function createSessionIn(root, avatar, name, chats) {
    const entry = ensureEntry(root, avatar, true);
    const now = Date.now();
    const session = {
        id: makeSessionId(root),
        name: cleanName(name) || DEFAULT_SESSION_NAME,
        chats: normNames(chats),
        createdAt: now,
        updatedAt: now,
    };
    entry.sessions.push(session);
    return session;
}

// ---------- 읽기 ----------

/**
 * 한 봇의 세션 목록 (저장 순서)
 * @param {string} avatar
 * @returns {Session[]}
 */
export function getSessions(avatar) {
    return peek(loadRoot(), avatar).sessions.map(cloneSession);
}

/**
 * @param {string} avatar
 * @param {string} sessionId
 * @returns {Session|null}
 */
export function getSession(avatar, sessionId) {
    const s = peek(loadRoot(), avatar).sessions.find((x) => x.id === sessionId);
    return s ? cloneSession(s) : null;
}

/**
 * @param {string} avatar
 * @returns {boolean}
 */
export function hasSessions(avatar) {
    return peek(loadRoot(), avatar).sessions.length > 0;
}

/**
 * 이 채팅이 들어 있는 세션들
 * @param {string} avatar
 * @param {string} fileName
 * @returns {Session[]}
 */
export function getChatSessions(avatar, fileName) {
    const name = normName(fileName);
    if (!name) return [];
    return peek(loadRoot(), avatar).sessions
        .filter((s) => chatsOf(s).includes(name))
        .map(cloneSession);
}

/**
 * @param {string} avatar
 * @param {string} sessionId
 * @returns {Set<string>} 없는 세션이면 빈 Set
 */
export function getSessionChatSet(avatar, sessionId) {
    const s = peek(loadRoot(), avatar).sessions.find((x) => x.id === sessionId);
    return new Set(s ? chatsOf(s) : []);
}

/**
 * 어느 세션에든 들어 있는 채팅 (이 집합에 없으면 "미분류")
 * @param {string} avatar
 * @returns {Set<string>}
 */
export function getAssignedChatSet(avatar) {
    const set = new Set();
    for (const s of peek(loadRoot(), avatar).sessions) {
        for (const c of chatsOf(s)) set.add(c);
    }
    return set;
}

/**
 * 세션 소속으로 채팅 목록을 거른다. 입력 배열은 바꾸지 않는다.
 * SESSION_ALL은 전부, SESSION_UNSORTED는 어느 세션에도 없는 것만,
 * 모르는 세션 ID는 빈 배열.
 * @param {string} avatar
 * @param {string} sessionId
 * @param {Array<{file_name: string}>} chats
 * @returns {Array<{file_name: string}>}
 */
export function filterChatsBySession(avatar, sessionId, chats) {
    if (!Array.isArray(chats)) return [];
    if (sessionId === SESSION_ALL) return [...chats];
    if (sessionId === SESSION_UNSORTED) {
        const assigned = getAssignedChatSet(avatar);
        return chats.filter((c) => !assigned.has(normName(c && c.file_name)));
    }
    const s = peek(loadRoot(), avatar).sessions.find((x) => x.id === sessionId);
    if (!s) return [];
    const set = new Set(chatsOf(s));
    return chats.filter((c) => set.has(normName(c && c.file_name)));
}

/**
 * @param {string} sessionId
 * @returns {string|null} dataURL
 */
export function getSessionImage(sessionId) {
    if (!isSafeKey(sessionId)) return null;
    const images = loadImages();
    if (!hasOwn(images, sessionId)) return null;
    const v = images[sessionId];
    return typeof v === 'string' && v !== '' ? v : null;
}

/**
 * @param {string} avatar
 * @param {string} fileName
 * @returns {string} 없으면 ''
 */
export function getMemo(avatar, fileName) {
    const name = normName(fileName);
    if (!isSafeKey(name)) return '';
    const memos = peek(loadRoot(), avatar).memos;
    if (!hasOwn(memos, name)) return '';
    return typeof memos[name] === 'string' ? memos[name] : '';
}

// ---------- 세션 관리 ----------

/**
 * 세션 만들기. 이름은 trim, 비면 '새 세션'.
 * avatar가 올바르지 않으면 null.
 * @param {string} avatar
 * @param {string} name
 * @param {{chats?: string[]}} [options]
 * @returns {Session|null}
 */
export function createSession(avatar, name, { chats = [] } = {}) {
    if (!isSafeKey(avatar)) return null;
    const root = loadRoot();
    const session = createSessionIn(root, avatar, name, chats);
    commitRoot(root);
    return cloneSession(session);
}

/**
 * 이름 바꾸기. 모르는 세션이거나 이름이 비어 있으면 false.
 * @param {string} avatar
 * @param {string} sessionId
 * @param {string} name
 * @returns {boolean}
 */
export function renameSession(avatar, sessionId, name) {
    const clean = cleanName(name);
    if (!clean) return false;
    const root = loadRoot();
    const entry = ensureEntry(root, avatar, false);
    const session = entry && findSession(entry, sessionId);
    if (!session) return false;
    if (session.name !== clean) {
        session.name = clean;
        session.updatedAt = Date.now();
        commitRoot(root);
    }
    return true;
}

/**
 * 세션 삭제. 채팅은 지우지 않는다. 이미지도 같이 제거.
 * @param {string} avatar
 * @param {string} sessionId
 * @returns {boolean}
 */
export function deleteSession(avatar, sessionId) {
    const root = loadRoot();
    const entry = ensureEntry(root, avatar, false);
    if (!entry) return false;
    const idx = entry.sessions.findIndex((s) => s.id === sessionId);
    if (idx < 0) return false;
    entry.sessions.splice(idx, 1);
    pruneEntry(root, avatar);
    commitRoot(root);

    const images = loadImages();
    if (hasOwn(images, sessionId)) {
        delete images[sessionId];
        commitImages(images);
    }
    return true;
}

/**
 * 세션 순서 바꾸기. 목록에 없는 세션은 원래 순서대로 뒤에 둔다.
 * 모르는 ID와 중복 ID는 무시.
 * @param {string} avatar
 * @param {string[]} sessionIds
 * @returns {void}
 */
export function reorderSessions(avatar, sessionIds) {
    if (!Array.isArray(sessionIds)) return;
    const root = loadRoot();
    const entry = ensureEntry(root, avatar, false);
    if (!entry) return;
    const byId = new Map(entry.sessions.map((s) => [s.id, s]));
    const ordered = [];
    for (const id of sessionIds) {
        if (byId.has(id)) {
            ordered.push(byId.get(id));
            byId.delete(id);
        }
    }
    for (const s of entry.sessions) {
        if (byId.has(s.id)) ordered.push(s);
    }
    entry.sessions = ordered;
    commitRoot(root);
}

/**
 * 세션 이미지 저장 (null/빈 값이면 제거). 크기 줄이기는 호출한 쪽이 한다.
 * @param {string} sessionId
 * @param {string|null} dataUrl
 * @returns {void}
 */
export function setSessionImage(sessionId, dataUrl) {
    if (!isSafeKey(sessionId)) return;
    const images = loadImages();
    if (dataUrl === null || dataUrl === undefined || dataUrl === '') {
        if (!hasOwn(images, sessionId)) return;
        delete images[sessionId];
    } else if (typeof dataUrl === 'string') {
        images[sessionId] = dataUrl;
    } else {
        return;
    }
    commitImages(images);
}

// ---------- 소속 변경 ----------

/**
 * 세션에 채팅 추가 (이미 있는 것은 건너뜀)
 * @param {string} avatar
 * @param {string} sessionId
 * @param {string[]} fileNames
 * @returns {number} 실제로 추가된 수
 */
export function addChats(avatar, sessionId, fileNames) {
    const names = normNames(fileNames);
    if (names.length === 0) return 0;
    const root = loadRoot();
    const entry = ensureEntry(root, avatar, false);
    const session = entry && findSession(entry, sessionId);
    if (!session) return 0;
    const have = new Set(session.chats);
    let added = 0;
    for (const n of names) {
        if (!have.has(n)) {
            have.add(n);
            session.chats.push(n);
            added++;
        }
    }
    if (added > 0) {
        session.updatedAt = Date.now();
        commitRoot(root);
    }
    return added;
}

/**
 * 세션에서 채팅 빼기 (채팅 파일은 그대로)
 * @param {string} avatar
 * @param {string} sessionId
 * @param {string[]} fileNames
 * @returns {number} 실제로 빠진 수
 */
export function removeChats(avatar, sessionId, fileNames) {
    const names = new Set(normNames(fileNames));
    if (names.size === 0) return 0;
    const root = loadRoot();
    const entry = ensureEntry(root, avatar, false);
    const session = entry && findSession(entry, sessionId);
    if (!session) return 0;
    const before = session.chats.length;
    session.chats = session.chats.filter((c) => !names.has(c));
    const removed = before - session.chats.length;
    if (removed > 0) {
        session.updatedAt = Date.now();
        commitRoot(root);
    }
    return removed;
}

/**
 * 여러 채팅을 여러 세션에 한 번에 넣고 빼기 (세션 선택 창의 "적용").
 * 저장은 한 번. 같은 ID가 add와 remove 양쪽에 있으면 remove가 이긴다.
 * 모르는 세션 ID는 무시.
 * @param {string} avatar
 * @param {string[]} fileNames
 * @param {{add?: string[], remove?: string[]}} [change]
 * @returns {void}
 */
export function setChatMembership(avatar, fileNames, change) {
    const { add = [], remove = [] } = isPlainObject(change) ? change : {};
    const names = normNames(fileNames);
    if (names.length === 0) return;
    const removeIds = new Set(Array.isArray(remove) ? remove : []);
    const addIds = new Set((Array.isArray(add) ? add : []).filter((id) => !removeIds.has(id)));
    if (addIds.size === 0 && removeIds.size === 0) return;

    const root = loadRoot();
    const entry = ensureEntry(root, avatar, false);
    if (!entry) return;
    const nameSet = new Set(names);
    const now = Date.now();
    let changed = false;

    for (const s of entry.sessions) {
        if (removeIds.has(s.id)) {
            const before = s.chats.length;
            s.chats = s.chats.filter((c) => !nameSet.has(c));
            if (s.chats.length !== before) {
                s.updatedAt = now;
                changed = true;
            }
        } else if (addIds.has(s.id)) {
            const have = new Set(s.chats);
            let added = 0;
            for (const n of names) {
                if (!have.has(n)) {
                    s.chats.push(n);
                    added++;
                }
            }
            if (added > 0) {
                s.updatedAt = now;
                changed = true;
            }
        }
    }
    if (changed) commitRoot(root);
}

// ---------- 메모 ----------

/**
 * 채팅 메모 저장. trim 후 2000자로 자르고, 비면 삭제.
 * @param {string} avatar
 * @param {string} fileName
 * @param {string} text
 * @returns {void}
 */
export function setMemo(avatar, fileName, text) {
    const name = normName(fileName);
    if (!isSafeKey(avatar) || !isSafeKey(name)) return;
    // 글자 수는 코드포인트 기준 (이모지 중간에서 잘리지 않게)
    const memo = Array.from((typeof text === 'string' ? text : '').trim()).slice(0, MEMO_MAX_LENGTH).join('');

    const root = loadRoot();
    if (memo === '') {
        const entry = ensureEntry(root, avatar, false);
        if (!entry || !hasOwn(entry.memos, name)) return;
        delete entry.memos[name];
        pruneEntry(root, avatar);
        commitRoot(root);
        return;
    }
    const entry = ensureEntry(root, avatar, true);
    if (hasOwn(entry.memos, name) && entry.memos[name] === memo) return;
    entry.memos[name] = memo;
    commitRoot(root);
}

// ---------- 채팅/캐릭터 변화 반영 (명세 6절) ----------

/**
 * 채팅 이름 변경: 모든 세션의 소속과 메모를 새 이름으로 옮긴다.
 * old === new 이거나 이름이 비어 있으면 아무 일도 하지 않는다.
 * 새 이름이 이미 어떤 세션에 들어 있으면 중복 없이 옛 이름만 뺀다.
 * 새 이름에 이미 메모가 있으면 그 메모를 두고 옛 메모는 버린다 (한쪽은 사라질 수밖에 없다).
 * @param {string} avatar
 * @param {string} oldFileName
 * @param {string} newFileName
 * @returns {void}
 */
export function renameChat(avatar, oldFileName, newFileName) {
    const oldName = normName(oldFileName);
    const newName = normName(newFileName);
    if (!oldName || !newName || oldName === newName) return;

    const root = loadRoot();
    const entry = ensureEntry(root, avatar, false);
    if (!entry) return;
    const now = Date.now();
    let changed = false;

    for (const s of entry.sessions) {
        const idx = s.chats.indexOf(oldName);
        if (idx < 0) continue;
        if (s.chats.includes(newName)) {
            s.chats.splice(idx, 1);
        } else {
            s.chats[idx] = newName;
        }
        s.updatedAt = now;
        changed = true;
    }

    if (isSafeKey(oldName) && hasOwn(entry.memos, oldName)) {
        if (isSafeKey(newName) && !hasOwn(entry.memos, newName)) {
            entry.memos[newName] = entry.memos[oldName];
        }
        delete entry.memos[oldName];
        changed = true;
    }
    if (changed) commitRoot(root);
}

/**
 * 채팅 삭제: 모든 세션과 메모에서 제거
 * @param {string} avatar
 * @param {string} fileName
 * @returns {void}
 */
export function removeChat(avatar, fileName) {
    const name = normName(fileName);
    if (!name) return;
    const root = loadRoot();
    const entry = ensureEntry(root, avatar, false);
    if (!entry) return;
    const now = Date.now();
    let changed = false;

    for (const s of entry.sessions) {
        const before = s.chats.length;
        s.chats = s.chats.filter((c) => c !== name);
        if (s.chats.length !== before) {
            s.updatedAt = now;
            changed = true;
        }
    }
    if (isSafeKey(name) && hasOwn(entry.memos, name)) {
        delete entry.memos[name];
        changed = true;
    }
    if (changed) {
        pruneEntry(root, avatar);
        commitRoot(root);
    }
}

/**
 * 캐릭터 삭제: 그 봇의 세션·메모·이미지 전부 제거.
 * 항목이 깨져 있어도 읽을 수 있는 세션 ID의 이미지는 같이 지운다.
 * @param {string} avatar
 * @returns {void}
 */
export function removeCharacter(avatar) {
    if (!isSafeKey(avatar)) return;
    const root = loadRoot();
    if (!hasOwn(root.characters, avatar)) return;

    const entry = root.characters[avatar];
    const ids = isPlainObject(entry) && Array.isArray(entry.sessions)
        ? entry.sessions.filter(validSession).map((s) => s.id)
        : [];
    delete root.characters[avatar];
    commitRoot(root);

    const images = loadImages();
    let imagesChanged = false;
    for (const id of ids) {
        if (hasOwn(images, id)) {
            delete images[id];
            imagesChanged = true;
        }
    }
    if (imagesChanged) commitImages(images);
}

// ---------- 마이그레이션 (명세 5절) ----------

/**
 * 기존 폴더(chatLobby_data의 folders / chatAssignments)를 봇별 세션으로 변환한다.
 * lobbyData는 읽기만 하고 수정하지 않는다. 여러 번 불러도 결과가 같다.
 *
 * - 시스템 폴더(favorites, uncategorized), folders에 없는 ID, 그룹 채팅(group_)은 건너뜀
 * - (봇, 폴더)마다 그 폴더 이름으로 세션을 만들고, 같은 봇에 같은 이름의 세션이 이미 있으면 거기에 합침
 * - 세션은 chatAssignments에 처음 나타난 순서대로 만들어진다
 * - 끝나면 migratedFromFolders = true (폴더가 하나도 없어도)
 * @param {{folders?: Array<{id: string, name: string}>, chatAssignments?: Object<string,string>}} lobbyData
 * @returns {{created: number, skipped: boolean}}
 */
export function migrateFoldersToSessions(lobbyData) {
    const root = loadRoot();
    if (root.migratedFromFolders === true) return { created: 0, skipped: true };

    const folderNames = new Map();
    const folders = isPlainObject(lobbyData) && Array.isArray(lobbyData.folders) ? lobbyData.folders : [];
    for (const f of folders) {
        if (!isPlainObject(f) || typeof f.id !== 'string' || SYSTEM_FOLDER_IDS.has(f.id)) continue;
        if (!folderNames.has(f.id)) folderNames.set(f.id, cleanName(f.name));
    }

    const assignments = isPlainObject(lobbyData) && isPlainObject(lobbyData.chatAssignments)
        ? lobbyData.chatAssignments
        : {};

    // (봇, 폴더) → 채팅 목록. Map은 처음 나타난 순서를 유지한다.
    /** @type {Map<string, {avatar: string, folderId: string, files: string[]}>} */
    const groups = new Map();
    for (const [key, folderId] of Object.entries(assignments)) {
        if (typeof folderId !== 'string' || !folderNames.has(folderId)) continue;
        const sep = key.indexOf('::');
        if (sep <= 0) continue;
        const avatar = key.slice(0, sep);
        const file = normName(key.slice(sep + 2));
        if (!file || avatar.startsWith('group_') || !isSafeKey(avatar)) continue;
        const gKey = avatar + '\u0000' + folderId;
        if (!groups.has(gKey)) groups.set(gKey, { avatar, folderId, files: [] });
        groups.get(gKey).files.push(file);
    }

    let created = 0;
    for (const { avatar, folderId, files } of groups.values()) {
        const name = folderNames.get(folderId) || DEFAULT_SESSION_NAME;
        const entry = ensureEntry(root, avatar, true);
        let session = entry.sessions.find((s) => s.name === name);
        if (!session) {
            session = createSessionIn(root, avatar, name, files);
            created++;
            continue;
        }
        const have = new Set(session.chats);
        let added = 0;
        for (const f of normNames(files)) {
            if (!have.has(f)) {
                have.add(f);
                session.chats.push(f);
                added++;
            }
        }
        if (added > 0) session.updatedAt = Date.now();
    }

    root.migratedFromFolders = true;
    commitRoot(root);
    return { created, skipped: false };
}
