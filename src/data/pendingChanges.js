// ============================================
// 대기 중인 변경사항 관리
// 즐겨찾기는 즉시 저장 방식으로 변경됨
// 이 파일은 하위 호환성을 위해 빈 함수만 export
// ============================================

/**
 * @deprecated 즐겨찾기는 이제 즉시 저장됨
 */
export function queueFavoriteChange(avatar, newState) {
    // no-op: 즉시 저장 방식으로 변경됨
}

/**
 * @deprecated 즐겨찾기는 이제 즉시 저장됨
 */
export function hasPendingChanges() {
    return false;
}

/**
 * @deprecated 즐겨찾기는 이제 즉시 저장됨
 */
export function getPendingCount() {
    return 0;
}

/**
 * @deprecated 즐겨찾기는 이제 즉시 저장됨
 */
export async function flushFavoriteChanges() {
    return true;
}

/**
 * @deprecated 즐겨찾기는 이제 즉시 저장됨
 */
export function clearPendingChanges() {
    // no-op
}

/**
 * @deprecated 즐겨찾기는 이제 즉시 저장됨
 */
export function getPendingState(avatar) {
    return null;
}
