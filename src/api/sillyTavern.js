// ============================================
// SillyTavern API 호출
// ============================================

import { cache } from '../data/cache.js';
import { CONFIG } from '../config.js';
import { sortPersonas } from '../utils/sortUtils.js';

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} ok - 요청 성공 여부
 * @property {any} data - 응답 데이터
 * @property {string} [error] - 에러 메시지
 */

class SillyTavernAPI {
    constructor() {
        // 캐싱 제거됨 - 항상 최신 context 사용
    }
    
    // ============================================
    // 기본 유틸
    // ============================================
    
    /**
     * SillyTavern 컨텍스트 가져오기 (캐싱 없음 - 항상 최신)
     * @returns {Object|null}
     */
    getContext() {
        // 캐싱 제거! 항상 최신 context 사용 (삭제 후 동기화 문제 방지)
        return window.SillyTavern?.getContext?.() || null;
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
                
                // 페르소나 이름 가져오기 (context 우선, fallback으로 상대경로 import)
                let personaNames = {};
                try {
                    // 우선: SillyTavern context에서 가져오기
                    const context = this.getContext();
                    if (context?.power_user?.personas) {
                        personaNames = context.power_user.personas;
                    } else {
                        // fallback: 직접 import (구조 변경 시 터질 수 있음)
                        const powerUserModule = await import('../../../../power-user.js');
                        personaNames = powerUserModule.power_user?.personas || {};
                    }
                } catch (e) {
                    console.warn('[API] Could not get personas from context or import:', e.message);
                }
                
                const personas = avatars.map(avatarId => ({
                    key: avatarId,
                    name: personaNames[avatarId] || avatarId.replace(/\.(png|jpg|webp)$/i, '')
                }));
                
                // 정렬 (숫자 → 영문 → 한글) - sortUtils 사용
                const sortedPersonas = sortPersonas(personas);
                
                cache.set('personas', sortedPersonas);
                return sortedPersonas;
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
            // 우선: context에서 가져오기
            const context = this.getContext();
            if (context?.user_avatar) {
                return context.user_avatar;
            }
            // fallback: 직접 import
            const personasModule = await import('../../../../personas.js');
            return personasModule.user_avatar || '';
        } catch (e) {
            console.warn('[API] Failed to get current persona:', e.message);
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
            // 우선: context에서 setUserAvatar 사용
            const context = this.getContext();
            if (typeof context?.setUserAvatar === 'function') {
                await context.setUserAvatar(personaKey);
                return true;
            }
            // fallback: 직접 import
            const personasModule = await import('../../../../personas.js');
            if (typeof personasModule.setUserAvatar === 'function') {
                await personasModule.setUserAvatar(personaKey);
                return true;
            }
        } catch (e) {
            console.warn('[API] Failed to set persona:', e.message);
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
                // 캐시 무효화 + pending request 제거
                cache.invalidate('personas', null, true);
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
     * context.characters를 직접 사용 (이미 메모리에 있음, 캐싱 불필요)
     * @returns {Array}
     */
    getCharacters() {
        const context = this.getContext();
        return context?.characters || [];
    }
    
    /**
     * 캐릭터 목록 가져오기 (비동기 호환용 - 기존 코드 호환)
     * @returns {Promise<Array>}
     */
    async fetchCharacters() {
        return this.getCharacters();
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
            return cache.get('chats', characterAvatar);
        }
        
        // 중복 요청 방지
        const cacheKey = `chats_${characterAvatar}`;
        return cache.getOrFetch(cacheKey, async () => {
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
                
                // API 응답이 객체(숫자 키) 또는 배열일 수 있음
                let result;
                if (Array.isArray(data)) {
                    result = data;
                } else if (data && typeof data === 'object') {
                    // 객체인 경우 배열로 변환 (SillyTavern 형식)
                    result = Object.values(data);
                } else {
                    result = [];
                }
                
                // 캐시 저장 (키 형식 통일: chats, characterAvatar)
                cache.set('chats', result, characterAvatar);
                
                // 채팅 수 캐시
                const count = result.length;
                cache.set('chatCounts', count, characterAvatar);
                
                // 메시지 수 합계 (chat_items 합산)
                const messageCount = result.reduce((sum, chat) => {
                    return sum + (chat.chat_items || 0);
                }, 0);
                cache.set('messageCounts', messageCount, characterAvatar);
                
                return result;
            } catch (error) {
                console.error('[API] Failed to load chats:', error);
                return [];
            }
        });
    }
    
    /**
     * 채팅 생성일 가져오기 (첫 메시지의 send_date)
     * 파일명에 날짜가 없을 때 fallback으로 사용
     * @param {string} characterAvatar - 캐릭터 아바타
     * @param {string} fileName - 채팅 파일명
     * @returns {Promise<Date|null>}
     */
    async getChatCreatedDate(characterAvatar, fileName) {
        try {
            const chatName = fileName.replace('.jsonl', '');
            const charDir = characterAvatar.replace(/\.(png|jpg|webp)$/i, '');
            
            const response = await this.fetchWithRetry('/api/chats/get', {
                method: 'POST',
                headers: this.getRequestHeaders(),
                body: JSON.stringify({
                    ch_name: charDir,
                    file_name: chatName,
                    avatar_url: characterAvatar
                }),
            });
            
            if (!response.ok) {
                return null;
            }
            
            const chatData = await response.json();
            
            // 첫 번째 메시지 (인덱스 0은 메타데이터, 1부터 실제 메시지)
            if (Array.isArray(chatData) && chatData.length > 1) {
                const firstMessage = chatData[1];
                
                if (firstMessage?.send_date) {
                    // 숫자면 그대로 사용
                    if (typeof firstMessage.send_date === 'number') {
                        return new Date(firstMessage.send_date);
                    }
                    // 문자열이면 am/pm 앞에 공백 추가 후 파싱
                    const fixedStr = String(firstMessage.send_date).replace(/(\d+)(am|pm)/i, '$1 $2');
                    const date = new Date(fixedStr);
                    if (!isNaN(date.getTime())) {
                        return date;
                    }
                }
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }
    
    /**
     * 채팅의 마지막 메시지 시간 가져오기 (파일명 변경된 채팅용)
     * @param {string} characterAvatar - 캐릭터 아바타
     * @param {string} fileName - 채팅 파일명 (.jsonl)
     * @returns {Promise<number>} - 마지막 메시지의 타임스탬프 (ms), 없으면 0
     */
    async getChatLastMessageDate(characterAvatar, fileName) {
        try {
            const charDir = characterAvatar.replace(/\.(png|jpg|webp)$/i, '');
            
            const response = await this.fetchWithRetry('/api/chats/get', {
                method: 'POST',
                headers: this.getRequestHeaders(),
                body: JSON.stringify({
                    ch_name: charDir,
                    file_name: fileName.replace('.jsonl', ''),
                    avatar_url: characterAvatar
                }),
            });
            
            if (!response.ok) return 0;
            
            const data = await response.json();
            
            // 채팅 데이터가 배열인 경우 마지막 메시지 확인
            if (Array.isArray(data) && data.length > 0) {
                // 마지막 메시지 (배열의 끝)
                const lastMessage = data[data.length - 1];
                
                if (lastMessage.send_date) {
                    if (typeof lastMessage.send_date === 'number') {
                        return lastMessage.send_date;
                    }
                    // 문자열이면 am/pm 앞에 공백 추가 후 파싱
                    const fixedStr = String(lastMessage.send_date).replace(/(\d+)(am|pm)/i, '$1 $2');
                    const date = new Date(fixedStr);
                    if (!isNaN(date.getTime())) {
                        return date.getTime();
                    }
                }
            }
            
            return 0;
        } catch (error) {
            console.warn('[API] Failed to get chat last message date:', error);
            return 0;
        }
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
        
        // 먼저 캐릭터 선택
        await this.selectCharacterById(characterIndex);
        
        // 잠시 대기 후 캐릭터 설정 버튼 클릭
        await this.delay(300);
        
        // 캐릭터 설정/편집 버튼 찾기 및 클릭
        const settingsBtn = document.getElementById('option_settings');
        if (settingsBtn) {
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
        
        const context = this.getContext();
        
        // 방법 1: SillyTavern context.openChat 사용
        if (context?.openChat) {
            try {
                await context.openChat(fileName);
                return true;
            } catch (e) {
                console.warn('[API] context.openChat failed:', e);
            }
        }
        
        // 방법 2: getChat API 직접 호출 (fallback)
        try {
            // 파일명에서 확장자 제거
            const chatName = fileName.replace('.jsonl', '');
            
            // SillyTavern의 getChat 함수 호출 시도
            if (window.SillyTavern?.getContext) {
                const ctx = window.SillyTavern.getContext();
                
                // 기존 채팅 로드 API 직접 호출
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
                    // 페이지 새로고침으로 채팅 적용
                    location.reload();
                    return true;
                }
            }
        } catch (e) {
            console.warn('[API] Direct chat load failed:', e);
        }
        
        // 방법 3: jQuery로 채팅 목록에서 직접 선택
        return false;
    }
    
    // ============================================
    // 그룹 채팅 API
    // ============================================
    
    /**
     * 그룹 목록 가져오기
     * @returns {Promise<Array>}
     */
    async getGroups() {
        // 캐시 우선
        if (cache.isValid('groups')) {
            return cache.get('groups');
        }
        
        return cache.getOrFetch('groups', async () => {
            try {
                // SillyTavern context에서 groups 가져오기
                const context = this.getContext();
                if (context?.groups && Array.isArray(context.groups)) {
                    cache.set('groups', context.groups);
                    return context.groups;
                }
                
                // Fallback: API 직접 호출
                const response = await this.fetchWithRetry('/api/groups/all', {
                    method: 'POST',
                    headers: this.getRequestHeaders(),
                });
                
                if (!response.ok) {
                    console.error('[API] Failed to fetch groups:', response.status);
                    return [];
                }
                
                const groups = await response.json();
                cache.set('groups', groups);
                return groups;
            } catch (error) {
                console.error('[API] Failed to load groups:', error);
                return [];
            }
        });
    }
    
    /**
     * 그룹 채팅 목록 가져오기 (과거 채팅들)
     * @param {string} groupId - 그룹 ID
     * @returns {Promise<Array>}
     */
    async getGroupChats(groupId) {
        try {
            const groups = await this.getGroups();
            const group = groups.find(g => g.id === groupId);
            
            if (!group || !Array.isArray(group.chats)) {
                return [];
            }
            
            const chats = [];
            
            for (const chatId of group.chats) {
                try {
                    // 각 채팅의 메시지 로드
                    const response = await this.fetchWithRetry('/api/chats/group/get', {
                        method: 'POST',
                        headers: this.getRequestHeaders(),
                        body: JSON.stringify({ id: chatId }),
                    });
                    
                    if (!response.ok) continue;
                    
                    const messages = await response.json();
                    if (!Array.isArray(messages) || messages.length === 0) continue;
                    
                    // 헤더 제거
                    const hasHeader = messages[0] && Object.hasOwn(messages[0], 'chat_metadata');
                    const msgData = hasHeader ? messages.slice(1) : messages;
                    
                    const chatItems = msgData.length;
                    const lastMessage = msgData.length ? msgData[msgData.length - 1] : null;
                    const lastMes = lastMessage?.mes || '[빈 채팅]';
                    const lastDate = lastMessage?.send_date || Date.now();
                    
                    chats.push({
                        file_name: chatId,
                        mes: lastMes,
                        last_mes: lastDate,
                        chat_items: chatItems,
                        isGroupChat: true,
                    });
                } catch (e) {
                    console.warn(`[API] Failed to load group chat ${chatId}:`, e);
                }
            }
            
            return chats;
        } catch (error) {
            console.error('[API] Failed to load group chats:', error);
            return [];
        }
    }
    
    /**
     * 그룹 열기
     * @param {string} groupId - 그룹 ID
     * @returns {Promise<boolean>}
     */
    async openGroup(groupId) {
        try {
            const context = this.getContext();
            
            // SillyTavern의 openGroupById 함수 사용
            if (typeof context?.openGroupById === 'function') {
                await context.openGroupById(groupId);
                return true;
            }
            
            // Fallback: 직접 import 시도
            try {
                const groupChatsModule = await import('../../../../group-chats.js');
                if (typeof groupChatsModule.openGroupById === 'function') {
                    await groupChatsModule.openGroupById(groupId);
                    return true;
                }
            } catch (e) {
                console.warn('[API] Could not import group-chats module:', e);
            }
            
            // Fallback: jQuery 클릭
            const groupElement = document.querySelector(`.group_select[data-grid="${groupId}"]`);
            if (groupElement) {
                groupElement.click();
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('[API] Failed to open group:', error);
            return false;
        }
    }
    
    /**
     * 그룹 채팅 열기
     * @param {string} groupId - 그룹 ID
     * @param {string} chatId - 채팅 ID (파일명)
     * @returns {Promise<boolean>}
     */
    async openGroupChat(groupId, chatId) {
        try {
            const context = this.getContext();
            const chatFileName = chatId.replace('.jsonl', '');
            
            console.log('[API] openGroupChat:', { groupId, chatFileName });
            
            // 1. 그룹 선택 - 여러 방법 시도
            let groupSelected = false;
            
            // 방법 A: selectGroupById
            if (typeof context?.selectGroupById === 'function') {
                try {
                    await context.selectGroupById(groupId);
                    groupSelected = true;
                    console.log('[API] Group selected via selectGroupById');
                } catch (e) {
                    console.warn('[API] selectGroupById failed:', e);
                }
            }
            
            // 방법 B: openGroupById (기본 채팅 안 열기)
            if (!groupSelected && typeof context?.openGroupById === 'function') {
                try {
                    await context.openGroupById(groupId, false);
                    groupSelected = true;
                    console.log('[API] Group selected via openGroupById');
                } catch (e) {
                    console.warn('[API] openGroupById failed:', e);
                }
            }
            
            // 방법 C: UI 클릭
            if (!groupSelected) {
                const groupCard = document.querySelector(
                    `.group_select[grid="${groupId}"], .group_select_container[grid="${groupId}"]`
                );
                if (groupCard) {
                    groupCard.click();
                    groupSelected = true;
                    console.log('[API] Group selected via UI click');
                }
            }
            
            if (!groupSelected) {
                console.error('[API] Failed to select group');
                return false;
            }
            
            // 그룹 선택 완료 대기
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // 2. 그룹 채팅 열기
            // 방법 A: context.openGroupChat
            if (typeof context?.openGroupChat === 'function') {
                try {
                    await context.openGroupChat(chatFileName);
                    console.log('[API] Chat opened via context.openGroupChat');
                    return true;
                } catch (e) {
                    console.warn('[API] context.openGroupChat failed:', e);
                }
            }
            
            // 방법 B: group-chats 모듈
            try {
                const groupChatsModule = await import('../../../../group-chats.js');
                if (typeof groupChatsModule.openGroupChat === 'function') {
                    await groupChatsModule.openGroupChat(chatFileName);
                    console.log('[API] Chat opened via group-chats module');
                    return true;
                }
            } catch (e) {
                console.warn('[API] group-chats import failed:', e);
            }
            
            // 방법 C: UI 클릭 방식
            return await this.openGroupChatByUI(groupId, chatFileName);
            
        } catch (error) {
            console.error('[API] Failed to open group chat:', error);
            return false;
        }
    }
    
    /**
     * UI 클릭 방식으로 그룹 채팅 열기
     * @param {string} groupId - 그룹 ID
     * @param {string} chatFileName - 채팅 파일명
     * @returns {Promise<boolean>}
     */
    async openGroupChatByUI(groupId, chatFileName) {
        try {
            console.log('[API] openGroupChatByUI:', { groupId, chatFileName });
            
            // 채팅 관리 버튼 클릭
            const manageChatsBtn = document.getElementById('option_select_chat');
            if (!manageChatsBtn) {
                console.error('[API] option_select_chat not found');
                return false;
            }
            
            manageChatsBtn.click();
            
            // 채팅 목록 로드 대기 (최대 3초)
            let attempts = 0;
            while (attempts < 30) {
                await new Promise(resolve => setTimeout(resolve, 100));
                const chatItems = document.querySelectorAll('.select_chat_block');
                if (chatItems.length > 0) break;
                attempts++;
            }
            
            // 채팅 목록에서 해당 채팅 찾기
            const chatItems = document.querySelectorAll('.select_chat_block');
            for (const item of chatItems) {
                const itemFileName = item.getAttribute('file_name') || '';
                const itemText = item.querySelector('.select_chat_block_filename')?.textContent || '';
                
                // 파일명 또는 표시명으로 매칭
                if (itemFileName.includes(chatFileName) || itemText.includes(chatFileName)) {
                    // jQuery 클릭 시도 (SillyTavern 방식)
                    if (window.$) {
                        window.$(item).trigger('click');
                    } else {
                        item.click();
                    }
                    console.log('[API] Chat opened via UI click');
                    return true;
                }
            }
            
            console.warn('[API] Chat not found in list:', chatFileName);
            return false;
        } catch (e) {
            console.error('[API] openGroupChatByUI failed:', e);
            return false;
        }
    }
    
    /**
     * 그룹 아바타 URL 가져오기
     * @param {Object} group - 그룹 객체
     * @returns {string} 아바타 URL
     */
    getGroupAvatarUrl(group) {
        if (!group) return '/img/five.png';
        
        // 커스텀 아바타가 있으면 사용
        if (group.avatar_url && group.avatar_url !== '') {
            return group.avatar_url;
        }
        
        // 멤버 아바타 콜라주용 첫 번째 멤버
        if (Array.isArray(group.members) && group.members.length > 0) {
            const firstMember = group.members[0];
            return `/characters/${encodeURIComponent(firstMember)}`;
        }
        
        return '/img/five.png';
    }
}

// 싱글톤 인스턴스
export const api = new SillyTavernAPI();
