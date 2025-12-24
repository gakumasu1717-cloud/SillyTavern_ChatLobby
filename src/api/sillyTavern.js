// ============================================
// SillyTavern API 호출
// ============================================

import { cache } from '../data/cache.js';

class SillyTavernAPI {
    constructor() {
        this._context = null;
    }
    
    // ============================================
    // 기본 유틸
    // ============================================
    
    getContext() {
        if (!this._context) {
            this._context = window.SillyTavern?.getContext?.() || null;
        }
        return this._context;
    }
    
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
    // 페르소나 API
    // ============================================
    
    async fetchPersonas() {
        // 캐시 우선
        if (cache.isValid('personas')) {
            return cache.get('personas');
        }
        
        // 중복 요청 방지
        return cache.getOrFetch('personas', async () => {
            try {
                const response = await fetch('/api/avatars/get', {
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
    
    async getCurrentPersona() {
        try {
            const personasModule = await import('../../../../personas.js');
            return personasModule.user_avatar || '';
        } catch (e) {
            return '';
        }
    }
    
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
    
    async deletePersona(personaKey) {
        const response = await fetch('/api/avatars/delete', {
            method: 'POST',
            headers: this.getRequestHeaders(),
            body: JSON.stringify({ avatar: personaKey })
        });
        
        if (response.ok) {
            cache.invalidate('personas');
        }
        return response.ok;
    }
    
    // ============================================
    // 캐릭터 API
    // ============================================
    
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
    
    async selectCharacterById(index) {
        const context = this.getContext();
        if (context?.selectCharacterById) {
            await context.selectCharacterById(String(index));
        }
    }
    
    async deleteCharacter(charAvatar) {
        const response = await fetch('/api/characters/delete', {
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
    }
    
    // ============================================
    // 채팅 API
    // ============================================
    
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
                const response = await fetch('/api/characters/chats', {
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
    
    async deleteChat(fileName, charAvatar) {
        const response = await fetch('/api/chats/delete', {
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
    }
    
    // 채팅 수 가져오기 (캐시 활용)
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
            return 0;
        }
    }
}

// 싱글톤 인스턴스
export const api = new SillyTavernAPI();
