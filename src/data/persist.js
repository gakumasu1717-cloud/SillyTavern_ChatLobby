// ============================================
// 영속 저장소 (큰 데이터용)
//
// localStorage는 용량이 작고(보통 5MB) 문자열만 저장해서, 큰 데이터를 넣으면
// 다른 확장/ST 설정과 한도를 나눠 쓰다 저장이 실패한다.
// → 큰 데이터는 SillyTavern이 window.localforage로 노출하는 IndexedDB에 둔다.
//
// 사용하는 쪽은 동기 코드라서:
// - 메모리 캐시가 원본 (get/set은 동기)
// - set은 메모리를 바꾸고 디바운스로 IndexedDB에 비동기 저장
// - initPersist()가 시작 시 IndexedDB에서 읽어 오고, 예전 localStorage 데이터가 있으면 옮긴다
// - localforage가 없으면 예전처럼 localStorage에 저장 (폴백)
//
// ⚠️ 모듈은 값을 따로 들고 있지 말고 매번 get()으로 읽을 것
//    (init 때 캐시가 IndexedDB 값으로 교체되기 때문)
// ============================================

const WRITE_DELAY_MS = 400;

/** @type {Map<string, any>} 메모리 캐시 */
const cache = new Map();
/** @type {Set<string>} 저장 대기 중인 키 */
const dirty = new Set();
/** @type {Set<string>} init 전에 메모리에서 수정된 키 (IndexedDB 값으로 덮지 않음) */
const touchedBeforeInit = new Set();
let initialized = false;
let writeTimer = null;
let flushBound = false;

function lf() {
    return (typeof window !== 'undefined' && window.localforage) || null;
}

function readLocalStorage(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        console.warn('[Persist] Corrupt localStorage value ignored:', key);
        return null;
    }
}

function removeLocalStorage(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
}

/**
 * 값 읽기 (동기)
 * @template T
 * @param {string} key
 * @param {() => T} makeDefault - 값이 없을 때 기본값 생성
 * @returns {T}
 */
export function persistGet(key, makeDefault) {
    if (cache.has(key)) return cache.get(key);
    // init 전이거나 localforage가 없는 경우: localStorage에서 읽음
    const value = readLocalStorage(key) ?? makeDefault();
    cache.set(key, value);
    return value;
}

/**
 * 값 저장 (메모리 즉시 + 저장소 비동기)
 * 같은 객체를 수정한 뒤 다시 넘겨도 됨
 * @param {string} key
 * @param {any} value
 */
export function persistSet(key, value) {
    cache.set(key, value);
    dirty.add(key);
    if (!initialized) touchedBeforeInit.add(key);
    scheduleWrite();
}

/**
 * 값 삭제
 * @param {string} key
 */
export function persistRemove(key) {
    cache.delete(key);
    dirty.delete(key);
    removeLocalStorage(key);
    const store = lf();
    if (store) store.removeItem(key).catch(() => {});
}

function scheduleWrite() {
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = setTimeout(flushPersist, WRITE_DELAY_MS);
    bindFlushEvents();
}

/**
 * 대기 중인 저장을 지금 실행
 * @returns {Promise<void>}
 */
export async function flushPersist() {
    if (writeTimer) {
        clearTimeout(writeTimer);
        writeTimer = null;
    }
    const keys = [...dirty];
    dirty.clear();
    const store = lf();

    await Promise.all(keys.map(async (key) => {
        const value = cache.get(key);
        try {
            if (store) {
                await store.setItem(key, value);
            } else {
                localStorage.setItem(key, JSON.stringify(value));
            }
        } catch (e) {
            console.error('[Persist] Save failed:', key, e);
            dirty.add(key); // 다음 기회에 재시도
        }
    }));
}

/**
 * 탭을 닫거나 숨길 때 대기 중인 저장을 밀어냄 (디바운스 중 유실 방지)
 */
function bindFlushEvents() {
    if (flushBound || typeof window === 'undefined') return;
    flushBound = true;
    const flush = () => { if (dirty.size > 0) flushPersist(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush();
    });
}

/**
 * 시작 시 1회: IndexedDB에서 읽어 오고 예전 localStorage 데이터를 옮김
 *
 * 키마다:
 * - IndexedDB에 있음        → 그 값을 사용, localStorage 잔존은 청소
 * - localStorage에만 있음   → IndexedDB로 복사하고 "읽어서 확인된 뒤에만" localStorage 삭제
 * - 둘 다 없음              → 기본값 (나중에 persistGet이 만듦)
 *
 * @param {string[]} keys
 * @returns {Promise<void>}
 */
export async function initPersist(keys) {
    const store = lf();
    if (!store) {
        console.warn('[Persist] window.localforage not found, staying on localStorage');
        initialized = true;
        return;
    }

    await Promise.all(keys.map(async (key) => {
        try {
            const stored = await store.getItem(key);
            if (stored !== null && stored !== undefined) {
                // IndexedDB 값이 항상 우선.
                // init 전에 메모리에서 바뀐 값은 "빈 기본값 + 수정"일 수 있어서, 그걸로 덮으면
                // 저장된 전체를 잃는다 → init 전 수정 한 건을 버리는 쪽이 안전
                if (touchedBeforeInit.has(key)) {
                    console.warn('[Persist] Change made before init was discarded:', key);
                    dirty.delete(key);
                }
                cache.set(key, stored);
                removeLocalStorage(key);
                return;
            }

            const legacy = cache.has(key) ? cache.get(key) : readLocalStorage(key);
            if (legacy === null || legacy === undefined) return;

            await store.setItem(key, legacy);
            const check = await store.getItem(key);
            if (check !== null && check !== undefined) {
                cache.set(key, legacy);
                removeLocalStorage(key);
                console.info('[Persist] Migrated localStorage → IndexedDB:', key);
            }
        } catch (e) {
            // 실패하면 그 키는 localStorage 데이터를 그대로 둠 (다음 시작 때 재시도)
            console.warn('[Persist] Init failed for key, keeping localStorage copy:', key, e);
        }
    }));

    initialized = true;
    touchedBeforeInit.clear();
}

/**
 * 테스트용: 내부 상태 초기화
 */
export function _resetPersistForTest() {
    cache.clear();
    dirty.clear();
    touchedBeforeInit.clear();
    initialized = false;
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = null;
}
