// ============================================
// SillyTavern API 호출
// ============================================

import { cache } from '../data/cache.js';
import { CONFIG } from '../config.js';

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} ok - 요청 성공 여부
 * @property {any} data - 응답 데이터
 * @property {string} [error] - 에러 메시지
 */

class SillyTavernAPI {
    constructor() {
        /** @type {Object|null} */
        this._context = null;
    }
    
    // ============================================
    // 기본 유틸
    // ============================================
    
    /**
     * SillyTavern 컨텍스트 가져오기
     * @returns {Object|null}
     */
    getContext() {
        if (!this._context) {
            this._context = window.SillyTavern?.getContext?.() || null;
        }
        return this._context;
    }
    
    /**
     * 요청 헤더 가져오기
     * @returns {Object}
     */
    getRequestHeaders() {
        const context = this.getContext();
        if (context?.getRequestHeaders) {
            return context.getRequestHeaders();
        }
        return {
            'Content-Type': 'application/json',
            'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || '',
        };
    }
    
    // ============================================
    // 재시도 로직이 적용된 fetch
    // ============================================
    
    /**
     * 재시도 로직이 적용된 fetch 요청
     * @param {string} url - 요청 URL
     * @param {RequestInit} options - fetch 옵션
     * @param {number} [retries=CONFIG.ui.retryCount] - 재시도 횟수
     * @returns {Promise<Response>}
     * @throws {Error} 모든 재시도 실패 시
     */
    async fetchWithRetry(url, options, retries = CONFIG.ui.retryCount) {
        let lastError;
        
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const response = await fetch(url, options);
                
                // 5xx 서버 에러는 재시도
                if (response.status >= 500 && attempt < retries) {
                    console.warn(`[API] Server error ${response.status}, retrying... (${attempt + 1}/${retries})`);
                    await this.delay(CONFIG.ui.retryDelay * (attempt + 1));
                    continue;
                }
                
                return response;
            } catch (error) {
                lastError = error;
                
                // 네트워크 에러는 재시도
                if (attempt < retries) {
                    console.warn(`[API] Request failed, retrying... (${attempt + 1}/${retries})`, error.message);
                    await this.delay(CONFIG.ui.retryDelay * (attempt + 1));
                    continue;
                }
            }
        }
        
        throw lastError || new Error('Request failed after retries');
    }
    
    /**
     * 지연 함수
     * @param {number} ms - 지연 시간 (밀리초)
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // ============================================
    // 페르소나 API
    // ============================================
    
    /**
     * 페르소나 목록 가져오기
     * @returns {Promise<Array>}
     */
    async fetchPersonas() {
        // 캐시 우선
        if (cache.isValid('personas')) {
            return cache.get('personas');
        }
        
        // 중복 요청 방지
        return cache.getOrFetch('personas', async () => {
            try {
                const response = await this.fetchWithRetry('/api/avatars/get', {
                    method: 'POST',
                    headers: this.getRequestHeaders(),
                });
                
                if (!response.ok) {
                    console.error('[API] Failed to fetch personas:', response.status);
                    return [];
                }
                
                const avatars = await response.json();
                if (!Array.isArray(avatars)) return [];
                
                // 페르소나 이름 가져오기
                let personaNames = {};
                try {
                    const powerUserModule = await import('../../../../power-user.js');
                    personaNames = powerUserModule.power_user?.personas || {};
                } catch (e) {
                    console.log('[API] Could not import power_user');
                }
                
                const personas = avatars.map(avatarId => ({
                    key: avatarId,
                    name: personaNames[avatarId] || avatarId.replace(/\.(png|jpg|webp)$/i, '')
                }));
                
                // 정렬 (숫자 → 영문 → 한글)
                personas.sort((a, b) => {
                    const aName = a.name.toLowerCase();
                    const bName = b.name.toLowerCase();
                    
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
                });
                
                cache.set('personas', personas);
                return personas;
            } catch (error) {
                console.error('[API] Failed to load personas:', error);
                return [];
            }
        });
    }
    
    /**
     * 현재 페르소나 가져오기
     * @returns {Promise<string>}
     */
    async getCurrentPersona() {
        try {
            const personasModule = await import('../../../../personas.js');
            return personasModule.user_avatar || '';
        } catch (e) {
            return '';
        }
    }
    
    /**
     * 페르소나 설정
     * @param {string} personaKey - 페르소나 키
     * @returns {Promise<boolean>}
     */
    async setPersona(personaKey) {
        try {
            const personasModule = await import('../../../../personas.js');
            if (typeof personasModule.setUserAvatar === 'function') {
                await personasModule.setUserAvatar(personaKey);
                return true;
            }
        } catch (e) {
            // 폴백
            const context = this.getContext();
            if (typeof context?.setUserAvatar === 'function') {
                await context.setUserAvatar(personaKey);
                return true;
            }
        }
        return false;
    }
    
    /**
     * 페르소나 삭제
     * @param {string} personaKey - 페르소나 키
     * @returns {Promise<boolean>}
     */
    async deletePersona(personaKey) {
        try {
            const response = await this.fetchWithRetry('/api/avatars/delete', {
                method: 'POST',
                headers: this.getRequestHeaders(),
                body: JSON.stringify({ avatar: personaKey })
            });
            
            if (response.ok) {
                cache.invalidate('personas');
            }
            return response.ok;
        } catch (error) {
            console.error('[API] Failed to delete persona:', error);
            return false;
        }
    }
    
    // ============================================
    // 캐릭터 API
    // ============================================
    
    /**
     * 캐릭터 목록 가져오기
     * @returns {Promise<Array>}
     */
    async fetchCharacters() {
        // 캐시 우선
        if (cache.isValid('characters')) {
            return cache.get('characters');
        }
        
        const context = this.getContext();
        if (!context) {
            console.error('[API] Context not available');
            return [];
        }
        
        const characters = context.characters || [];
        cache.set('characters', characters);
        return characters;
    }
    
    /**
     * 캐릭터 ID로 선택
     * @param {number|string} index - 캐릭터 인덱스
     * @returns {Promise<void>}
     */
    async selectCharacterById(index) {
        const context = this.getContext();
        if (context?.selectCharacterById) {
            await context.selectCharacterById(String(index));
        }
    }
    
    /**
     * 캐릭터 삭제
     * @param {string} charAvatar - 캐릭터 아바타
     * @returns {Promise<boolean>}
     */
    async deleteCharacter(charAvatar) {
        try {
            const response = await this.fetchWithRetry('/api/characters/delete', {
                method: 'POST',
                headers: this.getRequestHeaders(),
                body: JSON.stringify({
                    avatar_url: charAvatar,
                    delete_chats: true
                })
            });
            
            if (response.ok) {
                cache.invalidate('characters');
                cache.invalidate('chats', charAvatar);
            }
            return response.ok;
        } catch (error) {
            console.error('[API] Failed to delete character:', error);
            return false;
        }
    }
    
    // ============================================
    // 채팅 API
    // ============================================
    
    /**
     * 캐릭터의 채팅 목록 가져오기
     * @param {string} characterAvatar - 캐릭터 아바타
     * @param {boolean} [forceRefresh=false] - 강제 새로고침
     * @returns {Promise<Array>}
     */
    async fetchChatsForCharacter(characterAvatar, forceRefresh = false) {
        if (!characterAvatar) return [];
        
        // 캐시 우선 (forceRefresh가 아닐 때)
        if (!forceRefresh && cache.isValid('chats', characterAvatar)) {
            console.log('[API] Using cached chats for:', characterAvatar);
            return cache.get('chats', characterAvatar);
        }
        
        // 중복 요청 방지
        return cache.getOrFetch(`chats_${characterAvatar}`, async () => {
            try {
                const response = await this.fetchWithRetry('/api/characters/chats', {
                    method: 'POST',
                    headers: this.getRequestHeaders(),
                    body: JSON.stringify({
                        avatar_url: characterAvatar,
                        simple: false
                    }),
                });
                
                if (!response.ok) {
                    console.error('[API] HTTP error:', response.status);
                    return [];
                }
                
                const data = await response.json();
                if (data?.error === true) return [];
                
                const result = data || [];
                cache.set('chats', result, characterAvatar);
                return result;
            } catch (error) {
                console.error('[API] Failed to load chats:', error);
                return [];
            }
        });
    }
    
    /**
     * 채팅 삭제
     * @param {string} fileName - 파일명
     * @param {string} charAvatar - 캐릭터 아바타
     * @returns {Promise<boolean>}
     */
    async deleteChat(fileName, charAvatar) {
        try {
            const response = await this.fetchWithRetry('/api/chats/delete', {
                method: 'POST',
                headers: this.getRequestHeaders(),
                body: JSON.stringify({
                    chatfile: fileName,
                    avatar_url: charAvatar
                }),
            });
            
            if (response.ok) {
                cache.invalidate('chats', charAvatar);
            }
            return response.ok;
        } catch (error) {
            console.error('[API] Failed to delete chat:', error);
            return false;
        }
    }
    
    /**
     * 캐릭터의 채팅 수 가져오기
     * @param {string} characterAvatar - 캐릭터 아바타
     * @returns {Promise<number>}
     */
    async getChatCount(characterAvatar) {
        if (cache.isValid('chatCounts', characterAvatar)) {
            return cache.get('chatCounts', characterAvatar);
        }
        
        try {
            const chats = await this.fetchChatsForCharacter(characterAvatar);
            const count = Array.isArray(chats) ? chats.length : Object.keys(chats || {}).length;
            cache.set('chatCounts', count, characterAvatar);
            return count;
        } catch (e) {
            console.error('[API] Failed to get chat count:', e);
            return 0;
        }
    }
    
    /**
     * 캐릭터 편집 화면 열기
     * @param {number|string} characterIndex - 캐릭터 인덱스
     * @returns {Promise<void>}
     */
    async openCharacterEditor(characterIndex) {
        console.log('[API] Opening character editor for index:', characterIndex);
        
        // 먼저 캐릭터 선택
        await this.selectCharacterById(characterIndex);
        
        // 잠시 대기 후 캐릭터 설정 버튼 클릭
        await this.delay(300);
        
        // 캐릭터 설정/편집 버튼 찾기 및 클릭
        const settingsBtn = document.getElementById('option_settings');
        if (settingsBtn) {
            console.log('[API] Clicking option_settings button');
            settingsBtn.click();
        } else {
            console.warn('[API] option_settings button not found');
        }
    }
    
    /**
     * 특정 채팅 파일 열기 (SillyTavern API 사용)
     * @param {string} fileName - 채팅 파일명
     * @param {string} characterAvatar - 캐릭터 아바타
     * @returns {Promise<boolean>}
     */
    async openChatFile(fileName, characterAvatar) {
        console.log('[API] Opening chat file:', fileName, 'for character:', characterAvatar);
        
        const context = this.getContext();
        
        // 방법 1: SillyTavern context.openChat 사용
        if (context?.openChat) {
            try {
                await context.openChat(fileName);
                console.log('[API] Chat opened via context.openChat');
                return true;
            } catch (e) {
                console.warn('[API] context.openChat failed:', e);
            }
        }
        
        // 방법 2: getChat API 직접 호출
        try {
            // 파일명에서 확장자 제거
            const chatName = fileName.replace('.jsonl', '');
            
            // SillyTavern의 getChat 함수 호출 시도
            if (window.SillyTavern?.getContext) {
                const ctx = window.SillyTavern.getContext();
                
                // 채팅 파일명 설정
                if (typeof window.characters_api_format !== 'undefined') {
                    // 기존 채팅 로드 API
                    const response = await fetch('/api/chats/get', {
                        method: 'POST',
                        headers: this.getRequestHeaders(),
                        body: JSON.stringify({
                            ch_name: characterAvatar.replace(/\.(png|jpg|webp)$/i, ''),
                            file_name: fileName,
                            avatar_url: characterAvatar
                        })
                    });
                    
                    if (response.ok) {
                        console.log('[API] Chat loaded via /api/chats/get');
                        // 페이지 새로고침으로 채팅 적용
                        location.reload();
                        return true;
                    }
                }
            }
        } catch (e) {
            console.warn('[API] Direct chat load failed:', e);
        }
        
        // 방법 3: jQuery로 채팅 목록에서 직접 선택
        return false;
    }
}

// 싱글톤 인스턴스
export const api = new SillyTavernAPI();
