// ============================================
// 캘린더 스냅샷 저장소
// ============================================

const STORAGE_KEY = 'chatLobby_calendar';
const CURRENT_VERSION = 1; // 구조 변경 시 마이그레이션용
const THIS_YEAR = new Date().getFullYear();

// 캐시
let _snapshotsCache = null;

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
        console.log('[Calendar] loadSnapshots: from CACHE');
        return _snapshotsCache;
    }
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            const parsed = JSON.parse(data);
            const version = parsed.version || 0;
            
            // 버전 마이그레이션 (필요시)
            if (version < CURRENT_VERSION) {
                console.log('[Calendar] Migrating data from version', version, 'to', CURRENT_VERSION);
                // 현재는 v0 -> v1: 구조 동일, 버전 필드만 추가
                const migrated = { version: CURRENT_VERSION, snapshots: parsed.snapshots || {} };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
            }
            
            _snapshotsCache = parsed.snapshots || {};
            console.log('[Calendar] loadSnapshots: from localStorage, keys:', Object.keys(_snapshotsCache).length);
            return _snapshotsCache;
        }
    } catch (e) {
        console.error('[Calendar] Failed to load snapshots:', e);
    }
    console.log('[Calendar] loadSnapshots: EMPTY (no data)');
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
 * 오래된 스냅샷 정리 (6개월 이전 삭제)
 */
function cleanOldSnapshots() {
    console.log('[Calendar] Cleaning old snapshots (6 months+)');
    const snapshots = loadSnapshots(true);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const cutoff = getLocalDateString(sixMonthsAgo);
    
    let deleted = 0;
    for (const date of Object.keys(snapshots)) {
        if (date < cutoff) {
            delete snapshots[date];
            deleted++;
        }
    }
    
    console.log('[Calendar] Deleted', deleted, 'old snapshots');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: CURRENT_VERSION, snapshots }));
}

/**
 * 해당 날짜 스냅샷 저장 (덮어쓰기)
 * @param {string} date - YYYY-MM-DD 형식
 * @param {number} total - 전체 채팅 수
 * @param {string} topChar - 1위 캐릭터 아바타
 * @param {Object} byChar - 캐릭터별 채팅수 { avatar: count }
 * @param {boolean} isBaseline - 베이스라인 여부 (작년 날짜 허용)
 */
export function saveSnapshot(date, total, topChar, byChar = {}, isBaseline = false) {
    // 올해 1월 1일 이전 데이터는 저장 안 함 (베이스라인 예외)
    const jan1 = `${THIS_YEAR}-01-01`;
    if (!isBaseline && date < jan1) return;
    
    // 캐시 무효화
    _snapshotsCache = null;
    
    try {
        const snapshots = loadSnapshots(true);
        snapshots[date] = { total, topChar, byChar };
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: CURRENT_VERSION, snapshots }));
        console.log('[Calendar] saveSnapshot:', date, '| total:', total, '| topChar:', topChar);
    } catch (e) {
        // 용량 초과 시 오래된 데이터 정리
        if (e.name === 'QuotaExceededError') {
            console.warn('[Calendar] QuotaExceededError - cleaning old data');
            cleanOldSnapshots();
            // 재시도
            try {
                const snapshots = loadSnapshots(true);
                snapshots[date] = { total, topChar, byChar };
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
 * 해당 날짜 데이터 있는지 확인
 * @param {string} date - YYYY-MM-DD 형식
 * @returns {boolean}
 */
export function hasSnapshot(date) {
    const snapshots = loadSnapshots();
    return !!snapshots[date];
}

/**
 * 전날 대비 증가량 계산
 * @param {string} date - YYYY-MM-DD 형식
 * @returns {number|null} - 증가량 (전날 데이터 없으면 null)
 */
export function getIncrease(date) {
    const snapshots = loadSnapshots();
    const today = snapshots[date];
    
    if (!today) return null;
    
    // 전날 날짜 계산 (로컬 타임존)
    const dateObj = new Date(date + 'T00:00:00');
    dateObj.setDate(dateObj.getDate() - 1);
    const prevDate = getLocalDateString(dateObj);
    
    const prev = snapshots[prevDate];
    
    if (!prev) return null;
    
    return today.total - prev.total;
}

/**
 * 특정 날짜 스냅샷 삭제
 * @param {string} date - YYYY-MM-DD 형식
 */
export function deleteSnapshot(date) {
    try {
        _snapshotsCache = null;
        const snapshots = loadSnapshots(true);
        delete snapshots[date];
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: CURRENT_VERSION, snapshots }));
    } catch (e) {
        console.error('[Calendar] Failed to delete snapshot:', e);
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
