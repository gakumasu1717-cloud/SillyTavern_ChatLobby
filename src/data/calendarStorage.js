// ============================================
// 캘린더 스냅샷 저장소
// ============================================

const STORAGE_KEY = 'chatLobby_calendar';
const CURRENT_VERSION = 3; // v3: 아바타명 압축 롤백 + 정리 최적화
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
 * byChar/lastChatTimes 정리 (0값 제거)
 * @param {Object} obj
 * @returns {Object}
 */
function cleanZeroValues(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value && value !== 0) {
            result[key] = value;
        }
    }
    return result;
}

/**
 * 오래된 스냅샷 상세 정보 정리 (30일 이전은 total만 유지)
 * @param {Object} snapshots
 * @returns {Object}
 */
function trimOldSnapshotDetails(snapshots) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = getLocalDateString(thirtyDaysAgo);
    
    for (const date of Object.keys(snapshots)) {
        if (date < cutoff) {
            // 30일 이전 스냅샷은 total만 유지 (용량 절약)
            const snap = snapshots[date];
            snapshots[date] = { total: snap.total, topChar: snap.topChar };
        }
    }
    return snapshots;
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
                // v2 → v3: 해시 압축 제거 불가 (복원 불가), 기존 데이터 유지
                // 새 데이터는 원본 아바타명으로 저장됨
                const snapshots = parsed.snapshots || {};
                // 오래된 스냅샷 상세 정보 정리
                trimOldSnapshotDetails(snapshots);
                const migrated = { version: CURRENT_VERSION, snapshots };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
                _snapshotsCache = snapshots;
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
        
        // 🔥 0값 제거로 용량 절약 (원본 아바타명 유지)
        const cleanedByChar = cleanZeroValues(byChar);
        const cleanedLastChatTimes = cleanZeroValues(lastChatTimes);
        
        // 기존 스냅샷의 lastChatTimes와 병합 (새 값이 우선)
        const existingTimes = snapshots[date]?.lastChatTimes || {};
        const mergedLastChatTimes = { ...existingTimes, ...cleanedLastChatTimes };
        
        snapshots[date] = { total, topChar, byChar: cleanedByChar, lastChatTimes: mergedLastChatTimes };
        
        // 오래된 스냅샷 상세 정보 정리 (30일 이전)
        trimOldSnapshotDetails(snapshots);
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: CURRENT_VERSION, snapshots }));
        console.log('[Calendar] saveSnapshot:', date, '| total:', total, '| topChar:', topChar, '| lastChatTimes count:', Object.keys(mergedLastChatTimes).length);
    } catch (e) {
        // 용량 초과 시 오래된 데이터 정리
        if (e.name === 'QuotaExceededError') {
            console.warn('[Calendar] QuotaExceededError - cleaning old data');
            cleanOldSnapshots();
            // 재시도
            try {
                const snapshots = loadSnapshots(true);
                const cleanedByChar = cleanZeroValues(byChar);
                const cleanedLastChatTimes = cleanZeroValues(lastChatTimes);
                const existingTimes = snapshots[date]?.lastChatTimes || {};
                const mergedTimes = { ...existingTimes, ...cleanedLastChatTimes };
                snapshots[date] = { total, topChar, byChar: cleanedByChar, lastChatTimes: mergedTimes };
                trimOldSnapshotDetails(snapshots);
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
