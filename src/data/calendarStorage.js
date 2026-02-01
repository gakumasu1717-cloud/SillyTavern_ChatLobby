// ============================================
// 캘린더 스냅샷 저장소
// ============================================

const STORAGE_KEY = 'chatLobby_calendar';
const CURRENT_VERSION = 2; // v2: 아바타명 해시 압축
const THIS_YEAR = new Date().getFullYear();

// 캐시
let _snapshotsCache = null;

/**
 * 아바타명 해시 (djb2) - 용량 절약용
 * @param {string} str
 * @returns {string}
 */
function hashAvatar(str) {
    if (!str) return '';
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    return hash.toString(36);
}

/**
 * byChar/lastChatTimes 객체 압축 (아바타명 → 해시)
 * @param {Object} obj
 * @returns {Object}
 */
function compressAvatarKeys(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const result = {};
    for (const [avatar, value] of Object.entries(obj)) {
        result[hashAvatar(avatar)] = value;
    }
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
 * 전체 스냅샷 객체 로드 (캐싱)
 * @param {boolean} forceRefresh - 캐시 무시하고 새로 로드
 * @returns {Object} - { 'YYYY-MM-DD': { total, topChar, byChar } }
 */
export function loadSnapshots(forceRefresh = false) {
    if (_snapshotsCache && !forceRefresh) {
        return _snapshotsCache;
    }
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            const parsed = JSON.parse(data);
            const version = parsed.version || 0;
            
            // 버전 마이그레이션
            if (version < CURRENT_VERSION) {
                console.log('[Calendar] Migrating data from version', version, 'to', CURRENT_VERSION);
                // v1 → v2: 기존 데이터의 아바타명 해시 압축
                const oldSnapshots = parsed.snapshots || {};
                const newSnapshots = {};
                for (const [date, snap] of Object.entries(oldSnapshots)) {
                    newSnapshots[date] = {
                        total: snap.total,
                        topChar: snap.topChar ? hashAvatar(snap.topChar) : '',
                        byChar: snap.byChar ? compressAvatarKeys(snap.byChar) : {},
                        lastChatTimes: snap.lastChatTimes ? compressAvatarKeys(snap.lastChatTimes) : {}
                    };
                }
                const migrated = { version: CURRENT_VERSION, snapshots: newSnapshots };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
                _snapshotsCache = newSnapshots;
                return _snapshotsCache;
            }
            
            _snapshotsCache = parsed.snapshots || {};
            return _snapshotsCache;
        }
    } catch (e) {
        console.error('[Calendar] Failed to load snapshots:', e);
    }
    _snapshotsCache = {};
    return _snapshotsCache;
}

/**
 * 특정 날짜 스냅샷 반환
 * @param {string} date - YYYY-MM-DD 형식
 * @returns {{ total: number, topChar: string, byChar?: Object }|null}
 */
export function getSnapshot(date) {
    const snapshots = loadSnapshots();
    return snapshots[date] || null;
}

/**
 * 오래된 스냅샷 정리 (2년 이전만 삭제 - 장기 컨텐츠용)
 * 캘린더는 1년치 볼 수 있도록 보관
 */
function cleanOldSnapshots() {
    console.log('[Calendar] Cleaning old snapshots (2 years+)');
    const snapshots = loadSnapshots(true);
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const cutoff = getLocalDateString(twoYearsAgo);
    
    let deleted = 0;
    for (const date of Object.keys(snapshots)) {
        if (date < cutoff) {
            delete snapshots[date];
            deleted++;
        }
    }
    
    if (deleted > 0) {
        console.log('[Calendar] Deleted', deleted, 'old snapshots (2+ years)');
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: CURRENT_VERSION, snapshots }));
    }
}

/**
 * 해당 날짜 스냅샷 저장 (덮어쓰기)
 * @param {string} date - YYYY-MM-DD 형식
 * @param {number} total - 전체 채팅 수
 * @param {string} topChar - 1위 캐릭터 아바타
 * @param {Object} byChar - 캐릭터별 채팅수 { avatar: count }
 * @param {Object} lastChatTimes - 캐릭터별 마지막 채팅 시간 { avatar: timestamp }
 * @param {boolean} isBaseline - 베이스라인 여부 (작년 날짜 허용)
 */
export function saveSnapshot(date, total, topChar, byChar = {}, lastChatTimes = {}, isBaseline = false) {
    // 올해 1월 1일 이전 데이터는 저장 안 함 (베이스라인 예외)
    const jan1 = `${THIS_YEAR}-01-01`;
    if (!isBaseline && date < jan1) return;
    
    // 캐시 무효화
    _snapshotsCache = null;
    
    try {
        const snapshots = loadSnapshots(true);
        
        // 🔥 아바타명 해시 압축
        const compressedByChar = compressAvatarKeys(byChar);
        const compressedLastChatTimes = compressAvatarKeys(lastChatTimes);
        const compressedTopChar = topChar ? hashAvatar(topChar) : '';
        
        // 기존 스냅샷의 lastChatTimes와 병합 (새 값이 우선)
        const existingTimes = snapshots[date]?.lastChatTimes || {};
        const mergedLastChatTimes = { ...existingTimes, ...compressedLastChatTimes };
        
        snapshots[date] = { total, topChar: compressedTopChar, byChar: compressedByChar, lastChatTimes: mergedLastChatTimes };
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: CURRENT_VERSION, snapshots }));
        console.log('[Calendar] saveSnapshot:', date, '| total:', total, '| topChar:', compressedTopChar, '| lastChatTimes count:', Object.keys(mergedLastChatTimes).length);
    } catch (e) {
        // 용량 초과 시 오래된 데이터 정리
        if (e.name === 'QuotaExceededError') {
            console.warn('[Calendar] QuotaExceededError - cleaning old data');
            cleanOldSnapshots();
            // 재시도 (압축 로직 동일하게 적용)
            try {
                const snapshots = loadSnapshots(true);
                const compByChar = compressAvatarKeys(byChar);
                const compLastChatTimes = compressAvatarKeys(lastChatTimes);
                const compTopChar = topChar ? hashAvatar(topChar) : '';
                const existingTimes = snapshots[date]?.lastChatTimes || {};
                const mergedTimes = { ...existingTimes, ...compLastChatTimes };
                snapshots[date] = { total, topChar: compTopChar, byChar: compByChar, lastChatTimes: mergedTimes };
                localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: CURRENT_VERSION, snapshots }));
            } catch (e2) {
                console.error('[Calendar] Still failed after cleanup:', e2);
            }
        } else {
            console.error('[Calendar] Failed to save snapshot:', e);
        }
    }
}

/**
 * 전체 스냅샷 삭제
 */
export function clearAllSnapshots() {
    try {
        _snapshotsCache = null;
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.error('[Calendar] Failed to clear snapshots:', e);
    }
}
