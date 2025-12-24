// ============================================
// 캐시 관리 - 메모리 캐시 + 백그라운드 프리로딩
// ============================================

import { CONFIG } from '../config.js';

class CacheManager {
    constructor() {
        // 캐시 저장소
        this.stores = {
            chats: new Map(),        // 캐릭터별 채팅 목록
            chatCounts: new Map(),   // 캐릭터별 채팅 수
            personas: null,          // 페르소나 목록
            characters: null,        // 캐릭터 목록
        };
        
        // 캐시 타임스탬프
        this.timestamps = {
            chats: new Map(),
            chatCounts: 0,
            personas: 0,
            characters: 0,
        };
        
        // 프리로딩 상태
        this.preloadStatus = {
            personas: false,
            characters: false,
        };
        
        // 로딩 중인 Promise 저장 (중복 요청 방지)
        this.pendingRequests = new Map();
    }
    
    // ============================================
    // 범용 캐시 메서드
    // ============================================
    
    isValid(type, key = null) {
        const duration = CONFIG.cache[`${type}Duration`];
        const now = Date.now();
        
        if (key !== null) {
            // Map 형태 캐시 (chats, chatCounts)
            const timestamp = this.timestamps[type].get(key);
            return timestamp && (now - timestamp < duration);
        } else {
            // 단일 값 캐시 (personas, characters)
            return this.timestamps[type] && (now - this.timestamps[type] < duration);
        }
    }
    
    get(type, key = null) {
        if (key !== null) {
            return this.stores[type].get(key);
        }
        return this.stores[type];
    }
    
    set(type, data, key = null) {
        const now = Date.now();
        
        if (key !== null) {
            this.stores[type].set(key, data);
            this.timestamps[type].set(key, now);
        } else {
            this.stores[type] = data;
            this.timestamps[type] = now;
        }
    }
    
    invalidate(type, key = null) {
        if (key !== null) {
            this.stores[type].delete(key);
            this.timestamps[type].delete(key);
        } else if (type) {
            if (this.stores[type] instanceof Map) {
                this.stores[type].clear();
                this.timestamps[type].clear();
            } else {
                this.stores[type] = null;
                this.timestamps[type] = 0;
            }
        }
    }
    
    invalidateAll() {
        Object.keys(this.stores).forEach(type => {
            this.invalidate(type);
        });
    }
    
    // ============================================
    // 중복 요청 방지 (같은 요청이 진행 중이면 그 Promise 반환)
    // ============================================
    
    async getOrFetch(key, fetchFn) {
        // 이미 진행 중인 요청이 있으면 그걸 반환
        if (this.pendingRequests.has(key)) {
            return this.pendingRequests.get(key);
        }
        
        // 새 요청 시작
        const promise = fetchFn().finally(() => {
            this.pendingRequests.delete(key);
        });
        
        this.pendingRequests.set(key, promise);
        return promise;
    }
    
    // ============================================
    // 프리로딩 (백그라운드에서 미리 로딩)
    // ============================================
    
    async preloadAll(api) {
        console.log('[Cache] Starting preload...');
        
        // 병렬로 프리로딩
        const promises = [];
        
        if (!this.preloadStatus.personas) {
            promises.push(
                this.preloadPersonas(api).then(() => {
                    this.preloadStatus.personas = true;
                    console.log('[Cache] Personas preloaded');
                })
            );
        }
        
        if (!this.preloadStatus.characters) {
            promises.push(
                this.preloadCharacters(api).then(() => {
                    this.preloadStatus.characters = true;
                    console.log('[Cache] Characters preloaded');
                })
            );
        }
        
        await Promise.all(promises);
        console.log('[Cache] Preload complete');
    }
    
    async preloadPersonas(api) {
        if (this.isValid('personas')) return;
        
        try {
            const personas = await api.fetchPersonas();
            this.set('personas', personas);
        } catch (e) {
            console.error('[Cache] Failed to preload personas:', e);
        }
    }
    
    async preloadCharacters(api) {
        if (this.isValid('characters')) return;
        
        try {
            const characters = await api.fetchCharacters();
            this.set('characters', characters);
        } catch (e) {
            console.error('[Cache] Failed to preload characters:', e);
        }
    }
    
    // 자주 사용하는 캐릭터의 채팅 목록도 프리로딩
    async preloadRecentChats(api, recentCharacters) {
        const promises = recentCharacters.slice(0, 5).map(async (char) => {
            if (!this.isValid('chats', char.avatar)) {
                try {
                    const chats = await api.fetchChatsForCharacter(char.avatar);
                    this.set('chats', chats, char.avatar);
                } catch (e) {
                    // 무시
                }
            }
        });
        
        await Promise.all(promises);
    }
}

// 싱글톤 인스턴스
export const cache = new CacheManager();
