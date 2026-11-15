// ============================================
// 캘린더 스냅샷 저장소 (v2: 변경분만 저장)
//
// 예전(v1)에는 날짜마다 "모든 캐릭터의 메시지 수"를 통째로 저장했다.
//   → 캐릭터 수 × 날짜 수만큼 커지고, 저장할 때마다 전체를 다시 썼다.
//
// 지금(v2):
//   base       : 처음 한 번만 저장하는 전체 기준값 { date, byChar: { avatar: count } }
//   snapshots  : 날짜별 { total, topChar, changed: { avatar: count }, lastChatTimes }
//                changed에는 "그날 수가 바뀐 캐릭터"만 들어간다.
//
// 어떤 날 어떤 캐릭터의 수 = 그날 또는 그 이전에 기록된 가장 최근 값 (없으면 base)
//   → 캐릭터별로 (날짜, 수) 목록을 만들어 두고 이분 탐색으로 찾는다 (getCharCount)
//
// 저장 위치: IndexedDB (persist.js)
// ============================================

import { persistGet, persistSet, persistRemove } from './persist.js';

export const CALENDAR_STORAGE_KEY = 'chatLobby_calendar';
const BACKUP_KEY = 'chatLobby_calendar_v1_backup';
const CURRENT_VERSION = 2;
/** v1 백업 보관 기간 */
const BACKUP_KEEP_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * @typedef {Object} DaySnapshot
 * @property {number} total - 그날 기준 전체 메시지 수
 * @property {string} topChar - 그날 가장 많이 늘어난 캐릭터
 * @property {Object<string, number>} changed - 그날 수가 바뀐 캐릭터만 { avatar: count }
 * @property {Object<string, number>} lastChatTimes - 그날 채팅한 캐릭터의 마지막 시각
 */

/**
 * 캐릭터별 (날짜, 수) 색인. 저장 내용이 바뀌면 버리고 다시 만든다.
 * @type {Map<string, Array<[string, number]>>|null}
 */
let countIndex = null;

function emptyData() {
    return { version: CURRENT_VERSION, base: null, snapshots: {} };
}

/**
 * 저장 데이터 (v2). v1 형식이면 그 자리에서 변환한다.
 */
function loadData() {
    let data = persistGet(CALENDAR_STORAGE_KEY, emptyData);
    if (!data || typeof data !== 'object') {
        data = emptyData();
        persistSet(CALENDAR_STORAGE_KEY, data);
    } else if (data.version !== CURRENT_VERSION) {
        data = migrateFromV1(data);
        persistSet(CALENDAR_STORAGE_KEY, data);
        countIndex = null;
    }
    if (!data.snapshots || typeof data.snapshots !== 'object') data.snapshots = {};
    return data;
}

function saveData(data) {
    countIndex = null;
    persistSet(CALENDAR_STORAGE_KEY, data);
}

/**
 * v1 { snapshots: { date: { total, topChar, byChar(전체), lastChatTimes } } } → v2
 * 날짜순으로 훑으면서 직전 상태와 달라진 캐릭터만 changed에 남긴다.
 * total은 "그날까지 알려진 모든 캐릭터 수의 합"으로 다시 계산해 날짜 간 기준을 통일한다.
 * @param {object} old
 */
export function migrateFromV1(old) {
    const oldSnaps = (old && typeof old.snapshots === 'object' && old.snapshots) || {};
    const dates = Object.keys(oldSnaps).sort();
    const result = emptyData();
    if (dates.length === 0) return result;

    // 원본은 일정 기간 백업 (변환에 문제가 있을 때 되돌릴 수 있게)
    try {
        persistSet(BACKUP_KEY, { savedAt: Date.now(), data: old });
    } catch { /* ignore */ }

    /** @type {Object<string, number>} */
    const running = {};
    let runningTotal = 0;

    dates.forEach((date, i) => {
        const snap = oldSnaps[date] || {};
        const byChar = (snap.byChar && typeof snap.byChar === 'object') ? snap.byChar : {};
        const changed = {};

        for (const [avatar, raw] of Object.entries(byChar)) {
            const count = Number(raw) || 0;
            const prev = running[avatar] ?? 0;
            if (count !== prev) {
                runningTotal += count - prev;
                running[avatar] = count;
                if (i > 0) changed[avatar] = count;
            }
        }

        if (i === 0) {
            result.base = { date, byChar: { ...running } };
        }

        result.snapshots[date] = {
            total: runningTotal,
            topChar: snap.topChar || '',
            changed,
            lastChatTimes: (snap.lastChatTimes && typeof snap.lastChatTimes === 'object') ? snap.lastChatTimes : {},
        };
    });

    console.info('[Calendar] Converted', dates.length, 'snapshots to change-only format');
    return result;
}

/**
 * 로컬 날짜 문자열 반환 (타임존 안전)
 * @param {Date} date
 * @returns {string} YYYY-MM-DD
 */
export function getLocalDateString(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * 캘린더 저장소 초기화 (persist 초기화 뒤에 1회)
 * - v1 데이터 변환, 오래된 스냅샷/백업 정리
 * @returns {Promise<void>}
 */
export async function initCalendarStorage() {
    loadData();
    try {
        cleanOldSnapshots();
        const backup = persistGet(BACKUP_KEY, () => null);
        if (backup?.savedAt && Date.now() - backup.savedAt > BACKUP_KEEP_MS) {
            persistRemove(BACKUP_KEY);
        }
    } catch (e) {
        console.warn('[Calendar] Cleanup failed:', e);
    }
}

// ============================================
// 읽기
// ============================================

/**
 * 날짜별 스냅샷 전체 (요약 정보)
 * ⚠️ 캐릭터별 수는 여기 없음(changed는 바뀐 캐릭터만) → getCharCount / getFullByChar 사용
 * @returns {Object<string, DaySnapshot>}
 */
export function loadSnapshots() {
    return loadData().snapshots;
}

/**
 * 특정 날짜 스냅샷 반환
 * @param {string} date - YYYY-MM-DD
 * @returns {DaySnapshot|null}
 */
export function getSnapshot(date) {
    return loadData().snapshots[date] || null;
}

function buildIndex() {
    const data = loadData();
    /** @type {Map<string, Array<[string, number]>>} */
    const index = new Map();
    const push = (avatar, date, count) => {
        let list = index.get(avatar);
        if (!list) {
            list = [];
            index.set(avatar, list);
        }
        list.push([date, count]);
    };

    if (data.base?.byChar) {
        for (const [avatar, count] of Object.entries(data.base.byChar)) {
            // base는 가장 이른 값이므로 날짜 ''로 넣어 항상 맨 앞에 오게 함
            push(avatar, '', Number(count) || 0);
        }
    }
    for (const date of Object.keys(data.snapshots).sort()) {
        const changed = data.snapshots[date]?.changed;
        if (!changed) continue;
        for (const [avatar, count] of Object.entries(changed)) {
            push(avatar, date, Number(count) || 0);
        }
    }
    return index;
}

function getIndex() {
    if (!countIndex) countIndex = buildIndex();
    return countIndex;
}

/**
 * 어떤 날 기준 캐릭터의 메시지 수 (그날 또는 그 이전의 가장 최근 기록)
 * @param {string} avatar
 * @param {string} date - YYYY-MM-DD
 * @param {boolean} [inclusive=true] - false면 그날은 빼고 그 이전 값
 * @returns {number} 기록이 없으면 0
 */
export function getCharCount(avatar, date, inclusive = true) {
    const list = getIndex().get(avatar);
    if (!list || list.length === 0) return 0;

    // 조건(날짜 <= date 또는 < date)을 만족하는 마지막 항목을 이분 탐색
    let lo = 0;
    let hi = list.length - 1;
    let found = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const d = list[mid][0];
        const ok = inclusive ? d <= date : d < date;
        if (ok) {
            found = mid;
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    return found === -1 ? 0 : list[found][1];
}

/**
 * 이 캐릭터의 기록이 하나라도 있는지 (기준값 포함)
 * @param {string} avatar
 * @returns {boolean}
 */
export function hasCharHistory(avatar) {
    return getIndex().has(avatar);
}

/**
 * 어떤 날 기준 모든 캐릭터의 메시지 수 (필요할 때만 계산)
 * @param {string} date
 * @returns {Object<string, number>}
 */
export function getFullByChar(date) {
    const result = {};
    for (const avatar of getIndex().keys()) {
        const count = getCharCount(avatar, date);
        if (count > 0) result[avatar] = count;
    }
    return result;
}

// ============================================
// 쓰기
// ============================================

/**
 * 오래된 스냅샷 정리 (2년 이전 삭제)
 * 지워지는 날짜의 변경분은 base에 합쳐서, 남은 날짜의 계산이 달라지지 않게 한다.
 */
function cleanOldSnapshots() {
    const data = loadData();
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const cutoff = getLocalDateString(twoYearsAgo);

    const oldDates = Object.keys(data.snapshots).filter(d => d < cutoff).sort();
    if (oldDates.length === 0) return;

    if (!data.base) data.base = { date: oldDates[0], byChar: {} };
    for (const date of oldDates) {
        Object.assign(data.base.byChar, data.snapshots[date]?.changed || {});
        data.base.date = date;
        delete data.snapshots[date];
    }
    console.debug('[Calendar] Folded', oldDates.length, 'old snapshots into base');
    saveData(data);
}

/**
 * 해당 날짜 스냅샷 저장
 *
 * counts에는 "지금 값을 아는 캐릭터"만 넣으면 된다 (전부일 필요 없음).
 * 그날 이전 기록과 달라진 캐릭터만 changed에 남는다.
 * 같은 날 다시 저장하면 그날의 변경분을 합친다.
 *
 * @param {string} date - YYYY-MM-DD
 * @param {Object} info
 * @param {Object<string, number>} info.counts - 캐릭터별 현재 메시지 수 { avatar: count }
 * @param {string} [info.topChar] - 1위 캐릭터 (없으면 그날 가장 많이 늘어난 캐릭터로 계산)
 * @param {Object<string, number>} [info.backfill] - 이력이 전혀 없던 "기존" 캐릭터의 현재 수.
 *   변경분으로 치지 않고 기준값(base)에만 넣는다. (처음 본 날 전체 수가 한꺼번에
 *   "늘어난 것"으로 잡히는 것 방지. 이미 이력이 있는 캐릭터는 무시됨)
 * @param {Object<string, number>} [info.lastChatTimes] - 캐릭터별 마지막 채팅 시각
 * @param {boolean} [info.isBaseline=false] - 기준값 저장 (작년 날짜 허용)
 * @returns {DaySnapshot|null}
 */
export function saveSnapshot(date, { counts = {}, backfill = {}, topChar = '', lastChatTimes = {}, isBaseline = false } = {}) {
    // 올해 1월 1일 이전 데이터는 저장 안 함 (기준값 예외)
    const jan1 = `${new Date().getFullYear()}-01-01`;
    if (!isBaseline && date < jan1) return null;

    const data = loadData();
    const cleanCounts = sanitizeCounts(counts);

    // 첫 저장: 전체를 기준값으로
    if (!data.base) {
        Object.assign(cleanCounts, sanitizeCounts(backfill));
        data.base = { date, byChar: { ...cleanCounts } };
        data.snapshots[date] = {
            total: Object.values(cleanCounts).reduce((a, b) => a + b, 0),
            topChar: topChar || topOf(cleanCounts),
            changed: {},
            lastChatTimes: { ...lastChatTimes },
        };
        saveData(data);
        return data.snapshots[date];
    }

    // 이력이 없던 기존 캐릭터는 기준값에만 추가
    let backfilled = false;
    for (const [avatar, count] of Object.entries(sanitizeCounts(backfill))) {
        if (!getIndex().has(avatar) && !(avatar in cleanCounts)) {
            data.base.byChar[avatar] = count;
            backfilled = true;
        }
    }
    if (backfilled) countIndex = null;

    const existing = data.snapshots[date];
    const changed = { ...(existing?.changed || {}) };
    const increases = {};

    for (const [avatar, count] of Object.entries(cleanCounts)) {
        const before = getCharCount(avatar, date, false); // 그날 이전 값
        if (count !== before) {
            changed[avatar] = count;
            increases[avatar] = count - before;
        } else {
            delete changed[avatar]; // 그날 바뀌었다가 원래대로 돌아온 경우
        }
    }

    // 그날 이전 합계 + 그날 변경분
    const prevTotal = totalBefore(data, date);
    let delta = 0;
    for (const [avatar, count] of Object.entries(changed)) {
        delta += count - getCharCount(avatar, date, false);
    }

    data.snapshots[date] = {
        total: prevTotal + delta,
        topChar: topChar || topOf(increases) || existing?.topChar || '',
        changed,
        lastChatTimes: { ...(existing?.lastChatTimes || {}), ...lastChatTimes },
    };
    saveData(data);
    return data.snapshots[date];
}

function sanitizeCounts(counts) {
    const clean = {};
    for (const [avatar, raw] of Object.entries(counts || {})) {
        const count = Number(raw);
        if (avatar && Number.isFinite(count) && count >= 0) clean[avatar] = count;
    }
    return clean;
}

/**
 * 그날 이전의 가장 최근 합계 (스냅샷이 없으면 base 합계)
 */
function totalBefore(data, date) {
    let best = null;
    for (const d of Object.keys(data.snapshots)) {
        if (d < date && (best === null || d > best)) best = d;
    }
    if (best !== null) return data.snapshots[best].total || 0;
    return Object.values(data.base?.byChar || {}).reduce((a, b) => a + (Number(b) || 0), 0);
}

function topOf(map) {
    let top = '';
    let max = 0;
    for (const [avatar, value] of Object.entries(map)) {
        if (value > max) {
            max = value;
            top = avatar;
        }
    }
    return top;
}

/**
 * 삭제된 캐릭터의 기록을 정리하지는 않는다 (과거 합계가 그대로 유지돼야 하므로).
 * 전체 스냅샷 삭제만 제공.
 */
export function clearAllSnapshots() {
    countIndex = null;
    persistSet(CALENDAR_STORAGE_KEY, emptyData());
}
