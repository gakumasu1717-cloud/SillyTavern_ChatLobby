// ============================================
// 캐시 관리 - 메모리 캐시 + 백그라운드 프리로딩
// ============================================

import { CONFIG } from '../config.js';

/** 캐릭터별 캐시 최대 개수 (LRU) */
const CACHE_LIMITS = {
    chats: 40,
};

/**
 * @typedef {'chats' | 'chatCounts' | 'personas' | 'characters'} CacheType
 */

/**
 * 메모리 캐시 관리 클래스
 * - 타입별 캐시 저장소
 * - 캐시 만료 관리
 * - 중복 요청 방지
 * - 백그라운드 프리로딩
 */
class CacheManager {
    constructor() {
        /**
         * 캐시 저장소
         * @type {{ chats: Map, chatCounts: Map, personas: Array|null, characters: Array|null }}
         */
        this.stores = {
            chats: new Map(),        // 캐릭터별 채팅 목록
            chatCounts: new Map(),   // 캐릭터별 채팅 수
            messageCounts: new Map(), // 캐릭터별 메시지 수
            personas: null,          // 페르소나 목록
            characters: null,        // 캐릭터 목록
        };
        
        /**
         * 캐시 타임스탬프
         * @type {{ chats: Map, chatCounts: Map, personas: number, characters: number }}
         */
        this.timestamps = {
            chats: new Map(),
            chatCounts: new Map(),
            messageCounts: new Map(),
            personas: 0,
            characters: 0,
        };
        
        /**
         * 프리로딩 완료 상태
         * @type {{ personas: boolean, characters: boolean }}
         */
        this.preloadStatus = {
            personas: false,
            characters: false,
        };
        
        /**
         * 로딩 중인 Promise (중복 요청 방지)
         * @type {Map<string, Promise>}
         */
        this.pendingRequests = new Map();
    }
    
    // ============================================
    // 범용 캐시 메서드
    // ============================================
    
    /**
     * 캐시 유효성 확인
     * @param {CacheType} type - 캐시 타입
     * @param {string|null} [key=null] - 서브 키 (chats, chatCounts용)
     * @returns {boolean}
     */
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
    
    /**
     * 캐시 데이터 가져오기
     * @param {CacheType} type - 캐시 타입
     * @param {string|null} [key=null] - 서브 키
     * @returns {*}
     */
    get(type, key = null) {
        if (key !== null) {
            return this.stores[type].get(key);
        }
        return this.stores[type];
    }
    
    /**
     * 캐시 데이터 저장
     * @param {CacheType} type - 캐시 타입
     * @param {*} data - 저장할 데이터
     * @param {string|null} [key=null] - 서브 키
     */
    set(type, data, key = null) {
        const now = Date.now();
        
        if (key !== null) {
            const store = this.stores[type];
            // 삭제 후 다시 넣어 Map 순서를 "최근 사용" 순으로 유지
            store.delete(key);
            store.set(key, data);
            this.timestamps[type].set(key, now);

            // ★ 채팅 목록은 캐릭터당 데이터가 커서 무한히 쌓이면 메모리가 계속 늘어남
            // → 가장 오래된 것부터 버림 (채팅 수/메시지 수 같은 숫자 캐시는 작으니 유지)
            const limit = CACHE_LIMITS[type];
            if (limit && store.size > limit) {
                const oldestKey = store.keys().next().value;
                store.delete(oldestKey);
                this.timestamps[type].delete(oldestKey);
            }
        } else {
            this.stores[type] = data;
            this.timestamps[type] = now;
        }
    }
    
    /**
     * 캐시 무효화
     * @param {CacheType} [type] - 캐시 타입 (없으면 전체)
     * @param {string|null} [key=null] - 서브 키
     * @param {boolean} [clearPending=false] - pending request도 제거할지
     */
    invalidate(type, key = null, clearPending = false) {
        if (key !== null) {
            this.stores[type].delete(key);
            this.timestamps[type].delete(key);
            if (clearPending) {
                this.pendingRequests.delete(`${type}:${key}`);
            }
        } else if (type) {
            if (this.stores[type] instanceof Map) {
                this.stores[type].clear();
                this.timestamps[type].clear();
            } else {
                this.stores[type] = null;
                this.timestamps[type] = 0;
            }
            if (clearPending) {
                this.pendingRequests.delete(type);
            }
        }
    }
    
    /**
     * 캐시 무효화
     * @param {string} [type] - 특정 타입만 무효화, 없으면 전체
     */
    invalidateAll(type = null) {
        if (type) {
            this.invalidate(type);
        } else {
            Object.keys(this.stores).forEach(t => this.invalidate(t));
        }
    }
    
    // ============================================
    // 중복 요청 방지
    // ============================================
    
    /**
     * 중복 요청 방지 fetch
     * 같은 키로 진행 중인 요청이 있으면 그 Promise 반환
     * @param {string} key - 요청 식별 키
     * @param {() => Promise<*>} fetchFn - fetch 함수
     * @returns {Promise<*>}
     */
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
    
    /**
     * 모든 데이터 프리로딩
     * @param {Object} api - API 인스턴스
     * @returns {Promise<void>}
     */
    async preloadAll(api) {
        
        // 병렬로 프리로딩
        const promises = [];
        
        if (!this.preloadStatus.personas) {
            promises.push(
                this.preloadPersonas(api).then(() => {
                    this.preloadStatus.personas = true;
                })
            );
        }
        
        if (!this.preloadStatus.characters) {
            promises.push(
                this.preloadCharacters(api).then(() => {
                    this.preloadStatus.characters = true;
                })
            );
        }
        
        await Promise.all(promises);
    }
    
    /**
     * 페르소나 프리로딩
     * @param {Object} api
     * @returns {Promise<void>}
     */
    async preloadPersonas(api) {
        if (this.isValid('personas')) return;
        
        try {
            const personas = await api.fetchPersonas();
            this.set('personas', personas);
        } catch (e) {
            console.error('[Cache] Failed to preload personas:', e);
        }
    }
    
    /**
     * 캐릭터 프리로딩
     * @param {Object} api
     * @returns {Promise<void>}
     */
    async preloadCharacters(api) {
        if (this.isValid('characters')) return;
        
        try {
            const characters = await api.fetchCharacters();
            this.set('characters', characters);
        } catch (e) {
            console.error('[Cache] Failed to preload characters:', e);
        }
    }
    
    /**
     * 최근 캐릭터들의 채팅 프리로딩
     * @param {Object} api
     * @param {Array} recentCharacters - 최근 캐릭터 배열
     * @returns {Promise<void>}
     */
    async preloadRecentChats(api, recentCharacters) {
        
        const promises = recentCharacters.map(async (char) => {
            if (this.isValid('chats', char.avatar)) return;
            
            try {
                const chats = await api.fetchChatsForCharacter(char.avatar);
                this.set('chats', chats, char.avatar);
            } catch (e) {
                console.error('[Cache] Failed to preload chats for', char.name, e);
            }
        });
        
        await Promise.all(promises);
    }
}

// 싱글톤 인스턴스
export const cache = new CacheManager();
