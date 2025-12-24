// ============================================
// 날짜 유틸리티
// ============================================

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

// 파일명에서 날짜 파싱
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

// 날짜 정렬용 timestamp 추출
export function getTimestamp(chat) {
    const fileName = chat.file_name || chat.fileName || '';
    let ts = parseDateFromFilename(fileName);
    
    if (!ts && chat.last_mes) {
        ts = typeof chat.last_mes === 'number' 
            ? chat.last_mes 
            : new Date(chat.last_mes).getTime();
    }
    
    return ts || 0;
}
