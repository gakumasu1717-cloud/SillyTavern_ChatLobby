// ============================================
// 날짜 유틸리티
// ============================================

/**
 * 타임스탬프를 한국어 날짜로 포맷
 * @param {number|string} timestamp - 타임스탬프 또는 날짜 문자열
 * @returns {string} 포맷된 날짜 (예: "12월 25일")
 */
export function formatDate(timestamp) {
    if (!timestamp) return '';
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleDateString('ko-KR', {
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return '';
    }
}

/**
 * 파일명에서 날짜 파싱
 * 지원 형식:
 * - YYYY-MM-DD@HHhMMmSSs (공백 없음)
 * - YYYY-MM-DD @HHh MMm SSs (공백 있음)
 * - YYYY-MM-DD (날짜만)
 * @param {string} filename - 파일명
 * @returns {number} 타임스탬프 (밀리초), 파싱 실패 시 0
 */
export function parseDateFromFilename(filename) {
    // 형식: YYYY-MM-DD@HHhMMmSSs (공백 없음)
    const m = filename.match(/(\d{4})-(\d{2})-(\d{2})@(\d{2})h(\d{2})m(\d{2})s/);
    if (m) {
        return new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +m[6]).getTime();
    }
    
    // 형식: YYYY-MM-DD @HHh MMm SSs (공백 있음)
    const m2 = filename.match(/(\d{4})-(\d{2})-(\d{2})\s*@\s*(\d{2})h\s*(\d{2})m\s*(\d{2})s/);
    if (m2) {
        return new Date(+m2[1], +m2[2]-1, +m2[3], +m2[4], +m2[5], +m2[6]).getTime();
    }
    
    // 형식: YYYY-MM-DD만 있는 경우
    const m3 = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m3) {
        return new Date(+m3[1], +m3[2]-1, +m3[3]).getTime();
    }
    
    return 0;
}

/**
 * 채팅 객체에서 타임스탬프 추출 (정렬용)
 * 우선순위: last_mes > file_date > 파일명 파싱
 * @param {Object} chat - 채팅 객체
 * @returns {number} 타임스탬프 (없으면 0 - 맨 아래로)
 */
export function getTimestamp(chat) {
    // 1. last_mes 우선 (마지막 메시지 시간)
    if (chat.last_mes) {
        const ts = typeof chat.last_mes === 'number' 
            ? chat.last_mes 
            : new Date(chat.last_mes).getTime();
        if (ts > 0 && !isNaN(ts)) return ts;
    }
    
    // 2. file_date 또는 date 필드
    if (chat.file_date || chat.date) {
        const dateVal = chat.file_date || chat.date;
        const ts = typeof dateVal === 'number'
            ? dateVal
            : new Date(dateVal).getTime();
        if (ts > 0 && !isNaN(ts)) return ts;
    }
    
    // 3. 파일명에서 날짜 파싱 (fallback)
    const fileName = chat.file_name || chat.fileName || '';
    const ts = parseDateFromFilename(fileName);
    if (ts > 0) return ts;
    
    // 4. 없으면 0 반환 (맨 아래로 정렬됨)
    return 0;
}
