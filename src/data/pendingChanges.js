// ============================================
// 대기 중인 변경사항 관리 (배치 처리)
// ============================================

import { api } from '../api/sillyTavern.js';
import { cache } from './cache.js';

/**
 * 대기 중인 즐겨찾기 변경사항
 * @type {Map<string, boolean>}
 */
const pendingFavorites = new Map();

/**
 * 즐겨찾기 변경을 대기열에 추가 (로컬만)
 * @param {string} avatar - 캐릭터 아바타
 * @param {boolean} newState - 새로운 즐겨찾기 상태
 */
export function queueFavoriteChange(avatar, newState) {
    pendingFavorites.set(avatar, newState);
    
    // 로컬 메모리도 즉시 업데이트 (UI 반영용)
    const context = api.getContext();
    const char = context?.characters?.find(c => c.avatar === avatar);
    if (char) {
        char.fav = newState;
        if (char.data) {
            char.data.fav = newState;
        }
        if (char.data?.extensions) {
            char.data.extensions.fav = newState;
        }
    }
}

/**
 * 대기 중인 변경사항이 있는지 확인
 * @returns {boolean}
 */
export function hasPendingChanges() {
    return pendingFavorites.size > 0;
}

/**
 * 대기 중인 변경사항 개수
 * @returns {number}
 */
export function getPendingCount() {
    return pendingFavorites.size;
}

/**
 * 대기 중인 모든 즐겨찾기 변경사항을 서버에 저장
 * 로비를 벗어날 때 호출
 * @returns {Promise<boolean>}
 */
export async function flushFavoriteChanges() {
    if (pendingFavorites.size === 0) {
        return true;
    }
    
    console.log(`[PendingChanges] Flushing ${pendingFavorites.size} favorite changes...`);
    
    const changes = [...pendingFavorites.entries()];
    let allSuccess = true;
    
    for (const [avatar, state] of changes) {
        try {
            const context = api.getContext();
            const char = context?.characters?.find(c => c.avatar === avatar);
            
            if (!char) {
                console.warn(`[PendingChanges] Character not found: ${avatar}`);
                continue;
            }
            
            // API 호출
            const response = await fetch('/api/characters/edit-attribute', {
                method: 'POST',
                headers: api.getRequestHeaders(),
                body: JSON.stringify({
                    avatar_url: avatar,
                    ch_name: char.name,
                    field: 'fav',
                    value: state
                })
            });
            
            if (response.ok) {
                pendingFavorites.delete(avatar);
                console.log(`[PendingChanges] Saved ${avatar} = ${state}`);
            } else {
                console.error(`[PendingChanges] Failed to save ${avatar}:`, response.status);
                allSuccess = false;
            }
        } catch (error) {
            console.error(`[PendingChanges] Error saving ${avatar}:`, error);
            allSuccess = false;
        }
    }
    
    // 모든 변경 후 SillyTavern characters 배열 갱신
    if (changes.length > 0) {
        try {
            // 방법 1: SillyTavern의 getCharacters 함수 직접 호출
            const stGetCharacters = window.SillyTavern?.getContext?.()?.getCharacters 
                                 || window.getCharacters;
            
            if (typeof stGetCharacters === 'function') {
                console.log('[PendingChanges] Calling SillyTavern getCharacters()...');
                await stGetCharacters();
            } else {
                // 방법 2: API 직접 호출
                console.log('[PendingChanges] Calling /api/characters/all directly...');
                const response = await fetch('/api/characters/all', {
                    method: 'POST',
                    headers: api.getRequestHeaders(),
                    body: JSON.stringify({})
                });
                
                if (response.ok) {
                    const newCharacters = await response.json();
                    // SillyTavern의 characters 배열 직접 갱신
                    const context = api.getContext();
                    if (context?.characters) {
                        context.characters.splice(0, context.characters.length, ...newCharacters);
                    }
                }
            }
        } catch (error) {
            console.error('[PendingChanges] Failed to refresh characters:', error);
        }
        
        cache.invalidate('characters');
    }
    
    console.log(`[PendingChanges] Flush complete. Remaining: ${pendingFavorites.size}`);
    return allSuccess;
}

/**
 * 대기 중인 변경사항 모두 취소
 */
export function clearPendingChanges() {
    pendingFavorites.clear();
}

/**
 * 특정 캐릭터의 현재 즐겨찾기 상태 (pending 포함)
 * @param {string} avatar - 캐릭터 아바타
 * @returns {boolean|null} pending이 있으면 그 값, 없으면 null
 */
export function getPendingState(avatar) {
    if (pendingFavorites.has(avatar)) {
        return pendingFavorites.get(avatar);
    }
    return null;
}
