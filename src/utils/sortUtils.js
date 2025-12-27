// ============================================
// 정렬 유틸리티
// ============================================

/**
 * 한국어 우선 정렬 비교 함수 (숫자 → 영문 → 한글)
 * @param {string} a - 첫 번째 문자열
 * @param {string} b - 두 번째 문자열
 * @returns {number} 정렬 순서
 */
export function koreanSort(a, b) {
    const aName = (a || '').toLowerCase();
    const bName = (b || '').toLowerCase();
    
    const getType = (str) => {
        const c = str.charAt(0);
        if (/[0-9]/.test(c)) return 0;
        if (/[a-z]/.test(c)) return 1;
        if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(c)) return 2;
        return 3;
    };
    
    const typeA = getType(aName);
    const typeB = getType(bName);
    if (typeA !== typeB) return typeA - typeB;
    return aName.localeCompare(bName, 'ko');
}

/**
 * 페르소나 배열 정렬
 * @param {Array<{name: string, key: string}>} personas - 페르소나 배열
 * @returns {Array} 정렬된 배열
 */
export function sortPersonas(personas) {
    return [...personas].sort((a, b) => koreanSort(a.name, b.name));
}
