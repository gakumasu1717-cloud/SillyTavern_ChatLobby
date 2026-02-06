// ============================================
// 텍스트 유틸리티
// ============================================

/**
 * HTML 특수문자 이스케이프
 * @param {string} text - 원본 텍스트
 * @returns {string} 이스케이프된 텍스트
 */
const HTML_ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>"']/g, ch => HTML_ESCAPE_MAP[ch]);
}

/**
 * 텍스트 길이 제한 (말줄임표 추가)
 * @param {string} text - 원본 텍스트
 * @param {number} maxLength - 최대 길이
 * @returns {string} 잘린 텍스트
 */
export function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * 파일 크기 포맷팅
 * @param {number} bytes - 바이트 수
 * @returns {string} 포맷된 크기 (예: "1.5MB")
 */
export function formatFileSize(bytes) {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return '';
    bytes = Number(bytes);
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}
