// ============================================
// 마지막 채팅 시간 캐시 관리
// SillyTavern의 date_last_chat이 실시간 갱신 안 되는 문제 해결
// + 재접속 시에도 실제 채팅 기록 기준 정렬 지원
// + 페르소나 정보 추가 저장
// ============================================

import { api } from '../api/sillyTavern.js';
import { cache } from './cache.js';

// localStorage 키
const STORAGE_KEY = 'chatLobby_lastChatTimes';

/**
 * 캐릭터별 마지막 채팅 시간 캐시
 * - 메모리 캐시 + localStorage 영구 저장
 * - 재접속 시에도 정확한 정렬 지원
 * - 페르소나 정보 함께 저장
 */
class LastChatCache {
    constructor() {
        // 캐릭터 아바타 -> { time: number, persona: string|null }
        this.lastChatTimes = new Map();
        this.initialized = false;
        this.initializing = false;
        this._dirty = false;
        this._loadFromStorage();
    }

    /**
     * localStorage에서 캐시 복원 (하위 호환성 지원)
     */
    _loadFromStorage() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                if (data && typeof data === 'object') {
                    Object.entries(data).forEach(([avatar, value]) => {
                        // 하위 호환: 숫자면 객체로 변환
                        if (typeof value === 'number') {
                            this.lastChatTimes.set(avatar, { time: value, persona: null });
                        } else if (value && typeof value === 'object') {
                            this.lastChatTimes.set(avatar, {
                                time: value.time || 0,
                                persona: value.persona || null
                            });
                        }
                    });
                    console.log('[LastChatCache] Restored', this.lastChatTimes.size, 'entries from storage');
                }
            }
        } catch (e) {
            console.warn('[LastChatCache] Failed to load from storage:', e);
        }
    }

    /**
     * localStorage에 캐시 저장 (debounced)
     */
    _saveToStorage() {
        if (!this._dirty) return;
        try {
            const data = {};
            this.lastChatTimes.forEach((value, avatar) => {
                data[avatar] = value;
            });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            this._dirty = false;
        } catch (e) {
            console.warn('[LastChatCache] Failed to save to storage:', e);
        }
    }

    /**
     * 저장 예약 (debounce)
     */
    _scheduleSave() {
        this._dirty = true;
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => this._saveToStorage(), 1000);
    }

    /**
     * 특정 캐릭터의 마지막 채팅 시간 가져오기
     */
    get(charAvatar) {
        const entry = this.lastChatTimes.get(charAvatar);
        if (!entry) return 0;
        // 하위 호환: 숫자면 그대로 반환
        if (typeof entry === 'number') return entry;
        return entry.time || 0;
    }

    /**
     * 특정 캐릭터의 마지막 페르소나 가져오기
     */
    getPersona(charAvatar) {
        const entry = this.lastChatTimes.get(charAvatar);
        if (!entry || typeof entry === 'number') return null;
        return entry.persona || null;
    }

    /**
     * 특정 캐릭터의 마지막 채팅 시간 설정 (기존 페르소나 유지)
     */
    set(charAvatar, timestamp) {
        if (timestamp <= 0) return;
        const existing = this.lastChatTimes.get(charAvatar);
        const currentTime = (typeof existing === 'number') ? existing : (existing?.time || 0);
        const currentPersona = (typeof existing === 'object') ? existing.persona : null;

        if (timestamp > currentTime) {
            this.lastChatTimes.set(charAvatar, {
                time: timestamp,
                persona: currentPersona
            });
            this._scheduleSave();
        }
    }

    /**
     * 현재 시간 + 현재 페르소나로 업데이트 (메시지 송신 시)
     */
    updateNow(charAvatar) {
        if (!charAvatar) return;

        // 현재 페르소나 가져오기
        let currentPersona = null;
        try {
            const context = window.SillyTavern?.getContext?.();
            currentPersona = context?.user_avatar || null;
        } catch (e) {
            console.warn('[LastChatCache] Could not get current persona');
        }

        this.lastChatTimes.set(charAvatar, {
            time: Date.now(),
            persona: currentPersona
        });
        this._scheduleSave();
        console.log('[LastChatCache] Updated to now:', charAvatar, 'persona:', currentPersona);
    }

    /**
     * 채팅 목록에서 마지막 채팅 시간 추출
     */
    extractLastTime(chats) {
        if (!Array.isArray(chats) || chats.length === 0) return 0;
        let maxTime = 0;
        for (const chat of chats) {
            const chatTime = this.getChatTimestamp(chat);
            if (chatTime > maxTime) maxTime = chatTime;
        }
        return maxTime;
    }

    /**
     * 개별 채팅에서 타임스탬프 추출
     */
    getChatTimestamp(chat) {
        if (chat.last_mes) {
            return typeof chat.last_mes === 'number'
                ? chat.last_mes
                : new Date(chat.last_mes).getTime();
        }
        if (chat.file_name) {
            const timestamp = this.parseFileNameDate(chat.file_name);
            if (timestamp) return timestamp;
        }
        if (chat.date) {
            return typeof chat.date === 'number'
                ? chat.date
                : new Date(chat.date).getTime();
        }
        return 0;
    }

    /**
     * 파일명에서 날짜 파싱
     */
    parseFileNameDate(fileName) {
        const match = fileName.match(/(\d{4})-(\d{2})-(\d{2})@(\d{2})h(\d{2})m(\d{2})s/);
        if (!match) return null;
        const [, year, month, day, hour, min, sec] = match;
        return new Date(
            parseInt(year), parseInt(month) - 1, parseInt(day),
            parseInt(hour), parseInt(min), parseInt(sec)
        ).getTime();
    }

    /**
     * 캐릭터의 채팅 목록을 가져와서 마지막 시간 갱신
     */
    async refreshForCharacter(charAvatar, chats = null, forceRefresh = false) {
        try {
            if (!chats) {
                chats = cache.get('chats', charAvatar);
                if (!chats) {
                    chats = await api.fetchChatsForCharacter(charAvatar);
                }
            }
            let lastTime = this.extractLastTime(chats);
            if (lastTime === 0 && !forceRefresh) {
                const cached = this.get(charAvatar);
                if (cached > 0) return cached;
            }
            if (lastTime === 0 && Array.isArray(chats) && chats.length > 0) {
                const chatsToCheck = chats.slice(0, 3);
                const fallbackPromises = chatsToCheck.map(async (chat) => {
                    const chatTime = this.getChatTimestamp(chat);
                    if (chatTime > 0) return chatTime;
                    if (chat.file_name) {
                        try {
                            const lastMsgDate = await api.getChatLastMessageDate(charAvatar, chat.file_name);
                            if (lastMsgDate > 0) return lastMsgDate;
                        } catch (e) {}
                    }
                    return 0;
                });
                const times = await Promise.all(fallbackPromises);
                lastTime = Math.max(...times, 0);
            }
            if (lastTime > 0) this.set(charAvatar, lastTime);
            return lastTime;
        } catch (e) {
            console.error('[LastChatCache] Failed to refresh:', charAvatar, e);
            return 0;
        }
    }

    /**
     * 모든 캐릭터의 마지막 채팅 시간 초기화
     */
    async initializeAll(characters, batchSize = 5) {
        if (this._initPromise) {
            console.log('[LastChatCache] Already initializing, waiting for existing...');
            return this._initPromise;
        }
        this._initPromise = this._doInitializeAll(characters, batchSize)
            .finally(() => { this._initPromise = null; });
        return this._initPromise;
    }

    async _doInitializeAll(characters, batchSize) {
        console.log('[LastChatCache] Initializing for', characters.length, 'characters');
        try {
            for (let i = 0; i < characters.length; i += batchSize) {
                const batch = characters.slice(i, i + batchSize);
                await Promise.all(batch.map(async (char) => {
                    const cached = this.get(char.avatar);
                    if (cached > 0) return;
                    if (char.date_last_chat) {
                        this.set(char.avatar, char.date_last_chat);
                        return;
                    }
                }));
                if (i + batchSize < characters.length) {
                    await new Promise(r => setTimeout(r, 10));
                }
            }
            this.initialized = true;
            this._saveToStorage();
            console.log('[LastChatCache] Initialized with', this.lastChatTimes.size, 'entries');
        } catch (e) {
            console.error('[LastChatCache] Initialization failed:', e);
            this.initialized = true;
        }
    }

    /**
     * 캐릭터 정렬용 마지막 채팅 시간 가져오기
     */
    getForSort(char) {
        const cached = this.get(char.avatar);
        if (cached > 0) return cached;
        return char.date_last_chat || 0;
    }

    /**
     * 채팅 열기 시 마지막 시간 갱신
     */
    markOpened(charAvatar) {
        if (!charAvatar) return;
        this.updateNow(charAvatar);
    }

    /**
     * 채팅 열기만으로는 캐시를 갱신하지 않음
     */
    markViewed(charAvatar) {
        console.log('[LastChatCache] markViewed (no update):', charAvatar);
    }

    /**
     * 캐시 클리어
     */
    clear() {
        this.lastChatTimes.clear();
        this.initialized = false;
        this.initializing = false;
        this._dirty = false;
        if (this._saveTimer) clearTimeout(this._saveTimer);
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            console.warn('[LastChatCache] Failed to clear storage:', e);
        }
    }

    /**
     * 특정 캐릭터 삭제
     */
    remove(charAvatar) {
        if (!charAvatar) return;
        if (this.lastChatTimes.has(charAvatar)) {
            this.lastChatTimes.delete(charAvatar);
            this._scheduleSave();
            console.log('[LastChatCache] Removed:', charAvatar);
        }
    }

    /**
     * 삭제된 캐릭터들 정리
     */
    cleanupDeleted(existingCharacters) {
        if (!existingCharacters || !Array.isArray(existingCharacters)) return;
        const existingAvatars = new Set(existingCharacters.map(c => c.avatar));
        let cleaned = 0;
        for (const avatar of this.lastChatTimes.keys()) {
            if (!existingAvatars.has(avatar)) {
                this.lastChatTimes.delete(avatar);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log('[LastChatCache] Cleaned', cleaned, 'deleted characters');
            this._scheduleSave();
        }
    }
}

export const lastChatCache = new LastChatCache();