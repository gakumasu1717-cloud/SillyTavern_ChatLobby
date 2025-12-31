// ============================================
// 캘린더 스냅샷 저장소
// ============================================

const STORAGE_KEY = 'chatLobby_calendar';
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
 * @returns {Object} - { 'YYYY-MM-DD': { total, topChar } }
 */
export function loadSnapshots(forceRefresh = false) {
    if (_snapshotsCache && !forceRefresh) {
        return _snapshotsCache;
    }
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            const parsed = JSON.parse(data);
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
 * @returns {{ total: number, topChar: string }|null}
 */
export function getSnapshot(date) {
    const snapshots = loadSnapshots();
    return snapshots[date] || null;
}

/**
 * 해당 날짜 스냅샷 저장 (덮어쓰기)
 * @param {string} date - YYYY-MM-DD 형식
 * @param {number} total - 전체 채팅 수
 * @param {string} topChar - 1위 캐릭터 아바타
 */
export function saveSnapshot(date, total, topChar) {
    // 올해 1월 1일 이전 데이터는 저장 안 함
    const jan1 = `${THIS_YEAR}-01-01`;
    if (date < jan1) return;
    
    try {
        // 캐시 무효화
        _snapshotsCache = null;
        
        const snapshots = loadSnapshots(true);
        snapshots[date] = { total, topChar };
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ snapshots }));
    } catch (e) {
        console.error('[Calendar] Failed to save snapshot:', e);
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
