// ============================================
// SillyTavern API 호출
// ============================================

import { cache } from '../data/cache.js';
import { CONFIG } from '../config.js';
import { sortPersonas } from '../utils/sortUtils.js';
import { getTimestamp } from '../utils/dateUtils.js';

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
                    console.debug('[API] Could not get personas from context or import:', e.message);
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
            console.debug('[API] Failed to get current persona:', e.message);
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
            console.debug('[API] Failed to set persona:', e.message);
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
        
        // forceRefresh면 캐시 무효화 후 새로 요청 (진행 중인 요청에 합류하지 않음)
        if (forceRefresh) {
            cache.invalidate('chats', characterAvatar);
            return this._requestChats(characterAvatar);
        }

        // 같은 캐릭터에 대한 동시 요청은 하나로 합침 (그리드 지연 로딩 + 채팅 패널이 겹칠 때)
        return cache.getOrFetch(`chats:${characterAvatar}`, () => this._requestChats(characterAvatar));
    }

    /**
     * 채팅 목록 실제 요청 + 캐시 저장
     * @param {string} characterAvatar
     * @returns {Promise<Array>}
     */
    async _requestChats(characterAvatar) {
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
            
            // 캐시 저장
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
     * 채팅 메시지 전체 가져오기 (리마인드 뷰어용)
     * @param {string} characterAvatar - 캐릭터 아바타
     * @param {string} fileName - 채팅 파일명 (.jsonl 유무 무관)
     * @returns {Promise<Array|null>} - 메시지 배열 (메타데이터 라인 제외), 실패 시 null
     */
    async getChatMessages(characterAvatar, fileName) {
        try {
            const charDir = characterAvatar.replace(/\.(png|jpg|webp)$/i, '');

            const response = await this.fetchWithRetry('/api/chats/get', {
                method: 'POST',
                headers: this.getRequestHeaders(),
                body: JSON.stringify({
                    ch_name: charDir,
                    file_name: fileName.replace(/\.jsonl$/i, ''),
                    avatar_url: characterAvatar,
                }),
            });

            if (!response.ok) return null;

            const data = await response.json();
            if (!Array.isArray(data) || data.length === 0) return null;

            // [0]은 메타데이터 라인, [1]부터 실제 메시지 (mesid 0 = data[1])
            return data.slice(1);
        } catch (error) {
            console.error('[API] Failed to get chat messages:', error);
            return null;
        }
    }

    /**
     * 채팅 이름 변경
     * 서버는 파일명을 정리(sanitize)할 수 있으므로 실제로 적용된 새 이름을 돌려준다.
     * @param {string} charAvatar - 캐릭터 아바타
     * @param {string} oldFileName - 기존 파일명 (.jsonl 유무 무관)
     * @param {string} newFileName - 새 파일명 (.jsonl 유무 무관)
     * @returns {Promise<string|null>} 실제 새 파일명 (.jsonl 없음), 실패 시 null
     */
    async renameChat(charAvatar, oldFileName, newFileName) {
        try {
            const originalFile = oldFileName.replace(/\.jsonl$/i, '') + '.jsonl';
            const renamedFile = newFileName.replace(/\.jsonl$/i, '') + '.jsonl';

            const response = await this.fetchWithRetry('/api/chats/rename', {
                method: 'POST',
                headers: this.getRequestHeaders(),
                body: JSON.stringify({
                    avatar_url: charAvatar,
                    original_file: originalFile,
                    renamed_file: renamedFile,
                }),
            });

            if (!response.ok) {
                console.error('[API] Rename failed:', response.status);
                return null;
            }

            let data = null;
            try { data = await response.json(); } catch { /* 구버전: 본문 없음 */ }
            if (data?.error) return null;

            cache.invalidate('chats', charAvatar);
            const applied = data?.sanitizedFileName || renamedFile;
            return String(applied).replace(/\.jsonl$/i, '');
        } catch (error) {
            console.error('[API] Failed to rename chat:', error);
            return null;
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
     * 캐릭터의 "마지막 채팅" 기록만 갱신 (다음 실행 시 이 채팅이 열리도록)
     * ST의 openCharacterChat은 카드 전체를 다시 저장(createOrEditCharacter)하지만
     * 여기서는 chat 필드 하나만 바꾼다. 실패해도 채팅 동작에는 영향 없음.
     * @param {string} characterAvatar
     * @param {string} characterName
     * @param {string} chatFileName - .jsonl 없는 파일명
     * @returns {Promise<boolean>}
     */
    async saveLastChatPointer(characterAvatar, characterName, chatFileName) {
        if (!characterAvatar || !characterName || !chatFileName) return false;
        try {
            const response = await fetch('/api/characters/edit-attribute', {
                method: 'POST',
                headers: this.getRequestHeaders(),
                body: JSON.stringify({
                    avatar_url: characterAvatar,
                    ch_name: characterName,
                    field: 'chat',
                    value: chatFileName,
                }),
            });
            if (!response.ok) console.debug('[API] saveLastChatPointer failed:', response.status);
            return response.ok;
        } catch (e) {
            console.debug('[API] saveLastChatPointer error:', e);
            return false;
        }
    }

    /**
     * 삭제한 채팅이 캐릭터의 "마지막 채팅"이었으면 남은 채팅 중 가장 최근 것으로 포인터를 옮김
     * (안 하면 다음에 캐릭터로 들어갈 때 ST가 지워진 이름으로 빈 새 채팅을 만들어
     *  남은 채팅들이 사라진 것처럼 보임)
     * @param {string} charAvatar
     * @param {string[]} deletedNames - 삭제한 파일명들 (.jsonl 유무 무관)
     * @returns {Promise<void>}
     */
    async repointLastChatAfterDelete(charAvatar, deletedNames) {
        const char = this.getCharacters().find(c => c.avatar === charAvatar);
        if (!char) return;
        const deleted = new Set(deletedNames.map(n => String(n).replace(/\.jsonl$/i, '')));
        if (!deleted.has(char.chat)) return;

        try {
            const chats = await this.fetchChatsForCharacter(charAvatar, true);
            const remaining = (Array.isArray(chats) ? chats : [])
                .filter(c => !deleted.has(String(c.file_name || '').replace(/\.jsonl$/i, '')))
                .sort((a, b) => getTimestamp(b) - getTimestamp(a));
            // 남은 채팅이 없으면 그대로 둠 (ST가 들어갈 때 새 채팅을 만드는 게 맞는 동작)
            if (remaining.length === 0) return;

            const latest = String(remaining[0].file_name).replace(/\.jsonl$/i, '');
            char.chat = latest;
            await this.saveLastChatPointer(char.avatar, char.name, latest);
        } catch (e) {
            console.debug('[API] repointLastChatAfterDelete failed:', e);
        }
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
            
            // 병렬 처리로 성능 개선 (최대 5개씩 배치)
            const BATCH_SIZE = 5;
            const allChats = [];
            
            for (let i = 0; i < group.chats.length; i += BATCH_SIZE) {
                const batch = group.chats.slice(i, i + BATCH_SIZE);
                const batchResults = await Promise.all(
                    batch.map(chatId => this._getGroupChatSummary(chatId))
                );
                allChats.push(...batchResults.filter(Boolean));
            }
            
            return allChats;
        } catch (error) {
            console.error('[API] Failed to load group chats:', error);
            return [];
        }
    }
    
    /**
     * 그룹 채팅 하나의 요약 (메시지 수, 마지막 메시지, 마지막 시간)
     * ★ /api/chats/group/info 사용: 서버가 파일을 한 줄씩 읽어 요약만 돌려줌
     *   (예전엔 /api/chats/group/get으로 채팅 파일 전체를 받아서 마지막 메시지만 썼음)
     * 구버전 ST에 info가 없으면 get으로 대체
     * @param {string} chatId
     * @returns {Promise<Object|null>}
     */
    async _getGroupChatSummary(chatId) {
        const body = JSON.stringify({ id: chatId });
        try {
            const infoRes = await fetch('/api/chats/group/info', {
                method: 'POST',
                headers: this.getRequestHeaders(),
                body,
            });
            if (infoRes.ok) {
                const info = await infoRes.json();
                if (!info || info.match === false && !info.file_name) return null;
                return {
                    file_name: chatId,
                    mes: info.mes || '[빈 채팅]',
                    last_mes: info.last_mes || Date.now(),
                    chat_items: typeof info.chat_items === 'number' ? info.chat_items : 0,
                    isGroupChat: true,
                };
            }
            if (infoRes.status !== 404) return null;

            // 구버전 대체: 전체 파일
            const response = await this.fetchWithRetry('/api/chats/group/get', {
                method: 'POST',
                headers: this.getRequestHeaders(),
                body,
            });
            if (!response.ok) return null;
            const messages = await response.json();
            if (!Array.isArray(messages) || messages.length === 0) return null;
            const msgData = Object.hasOwn(messages[0] || {}, 'chat_metadata') ? messages.slice(1) : messages;
            const lastMessage = msgData[msgData.length - 1] || null;
            return {
                file_name: chatId,
                mes: lastMessage?.mes || '[빈 채팅]',
                last_mes: lastMessage?.send_date || Date.now(),
                chat_items: msgData.length,
                isGroupChat: true,
            };
        } catch (e) {
            console.warn(`[API] Failed to load group chat ${chatId}:`, e);
            return null;
        }
    }

    /**
     * 그룹 정보 저장 (ST의 editGroup → /api/groups/edit와 동일한 요청)
     * 채팅 목록/현재 채팅(chat_id)을 바꾼 뒤 기록할 때 사용. 실패해도 채팅 동작에는 영향 없음.
     * @param {Object} group - context.groups의 그룹 객체
     * @returns {Promise<boolean>}
     */
    async saveGroup(group) {
        if (!group?.id) return false;
        try {
            const response = await fetch('/api/groups/edit', {
                method: 'POST',
                headers: this.getRequestHeaders(),
                body: JSON.stringify(group),
            });
            if (response.ok) cache.invalidate('groups');
            return response.ok;
        } catch (e) {
            console.debug('[API] saveGroup error:', e);
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
    
    /**
     * 그룹 채팅 삭제
     * @param {string} groupId - 그룹 ID (캐시 무효화용)
     * @param {string} chatFileName - 채팅 파일명
     * @returns {Promise<boolean>}
     */
    async deleteGroupChat(groupId, chatFileName) {
        try {
            const fileName = chatFileName.replace('.jsonl', '');
            console.debug('[API] deleteGroupChat:', { groupId, fileName });
            
            // SillyTavern API는 id 파라미터에 채팅 파일명을 기대함
            const response = await this.fetchWithRetry('/api/chats/group/delete', {
                method: 'POST',
                headers: this.getRequestHeaders(),
                body: JSON.stringify({
                    id: fileName  // 채팅 파일명 (그룹 ID 아님!)
                })
            });
            
            if (response.ok) {
                console.debug('[API] Group chat deleted successfully');
                // 그룹 캐시 무효화
                cache.invalidate('groups');
                return true;
            }
            
            console.error('[API] Delete failed:', response.status);
            return false;
        } catch (error) {
            console.error('[API] deleteGroupChat error:', error);
            return false;
        }
    }
}

// 싱글톤 인스턴스
export const api = new SillyTavernAPI();
