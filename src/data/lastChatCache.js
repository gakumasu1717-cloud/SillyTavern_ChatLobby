// ============================================
// 마지막 채팅 시간 캐시 관리
// SillyTavern의 date_last_chat이 실시간 갱신 안 되는 문제 해결
// ============================================

import { api } from '../api/sillyTavern.js';
import { cache } from './cache.js';

/**
 * 캐릭터별 마지막 채팅 시간 캐시
 */
class LastChatCache {
    constructor() {
        // 캐릭터 아바타 -> 마지막 채팅 타임스탬프
        this.lastChatTimes = new Map();
        this.initialized = false;
        this.initializing = false;
    }
    
    /**
     * 특정 캐릭터의 마지막 채팅 시간 가져오기
     */
    get(charAvatar) {
        return this.lastChatTimes.get(charAvatar) || 0;
    }
    
    /**
     * 특정 캐릭터의 마지막 채팅 시간 설정
     */
    set(charAvatar, timestamp) {
        if (timestamp > 0) {
            this.lastChatTimes.set(charAvatar, timestamp);
        }
    }
    
    /**
     * 현재 시간으로 마지막 채팅 시간 업데이트 (메시지 전송 시)
     */
    updateNow(charAvatar) {
        if (!charAvatar) return;
        this.lastChatTimes.set(charAvatar, Date.now());
        console.log('[LastChatCache] Updated to now:', charAvatar);
    }
    
    /**
     * 채팅 목록에서 마지막 채팅 시간 추출
     */
    extractLastTime(chats) {
        if (!Array.isArray(chats) || chats.length === 0) return 0;
        
        let maxTime = 0;
        for (const chat of chats) {
            const chatTime = this.getChatTimestamp(chat);
            if (chatTime > maxTime) {
                maxTime = chatTime;
            }
        }
        return maxTime;
    }
    
    /**
     * 개별 채팅에서 타임스탬프 추출
     */
    getChatTimestamp(chat) {
        // 1. last_mes가 있으면 사용
        if (chat.last_mes) {
            return typeof chat.last_mes === 'number' 
                ? chat.last_mes 
                : new Date(chat.last_mes).getTime();
        }
        
        // 2. file_name에서 날짜 추출 시도
        if (chat.file_name) {
            const timestamp = this.parseFileNameDate(chat.file_name);
            if (timestamp) return timestamp;
        }
        
        // 3. 기타 필드 확인
        if (chat.date) {
            return typeof chat.date === 'number'
                ? chat.date
                : new Date(chat.date).getTime();
        }
        
        return 0;
    }
    
    /**
     * 파일명에서 날짜 파싱
     * 형식: "2024-12-30@15h30m45s.jsonl" 또는 "캐릭터명 - 2024-12-30@15h30m45s.jsonl"
     */
    parseFileNameDate(fileName) {
        const match = fileName.match(/(\d{4})-(\d{2})-(\d{2})@(\d{2})h(\d{2})m(\d{2})s/);
        if (!match) return null;
        
        const [, year, month, day, hour, min, sec] = match;
        return new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            parseInt(hour),
            parseInt(min),
            parseInt(sec)
        ).getTime();
    }
    
    /**
     * 캐릭터의 채팅 목록을 가져와서 마지막 시간 갱신
     */
    async refreshForCharacter(charAvatar, chats = null) {
        try {
            if (!chats) {
                chats = cache.get('chats', charAvatar);
                if (!chats) {
                    chats = await api.fetchChatsForCharacter(charAvatar);
                }
            }
            
            const lastTime = this.extractLastTime(chats);
            if (lastTime > 0) {
                this.set(charAvatar, lastTime);
            }
            return lastTime;
        } catch (e) {
            console.error('[LastChatCache] Failed to refresh:', charAvatar, e);
            return 0;
        }
    }
    
    /**
     * 모든 캐릭터의 마지막 채팅 시간 초기화
     * 로비 열 때 또는 새로고침 시 호출
     * @returns {Promise<void>} 초기화 완료 시 resolve
     */
    async initializeAll(characters, batchSize = 10) {
        if (this.initializing) {
            console.log('[LastChatCache] Already initializing, skip');
            return;
        }
        
        this.initializing = true;
        console.log('[LastChatCache] Initializing for', characters.length, 'characters');
        
        try {
            // 최근 채팅이 있는 캐릭터만 우선 처리
            const sorted = [...characters].sort((a, b) => 
                (b.date_last_chat || 0) - (a.date_last_chat || 0)
            );
            
            // 상위 30개만 처리 (너무 많으면 느려짐)
            const priority = sorted.slice(0, 30);
            
            for (let i = 0; i < priority.length; i += batchSize) {
                const batch = priority.slice(i, i + batchSize);
                await Promise.all(
                    batch.map(char => this.refreshForCharacter(char.avatar))
                );
            }
            
            this.initialized = true;
            console.log('[LastChatCache] Initialized with', this.lastChatTimes.size, 'entries');
        } finally {
            this.initializing = false;
        }
    }
    
    /**
     * 캐릭터 정렬용 마지막 채팅 시간 가져오기
     * 캐시에 있으면 캐시값, 없으면 context의 date_last_chat 사용
     */
    getForSort(char) {
        const cached = this.get(char.avatar);
        if (cached > 0) return cached;
        
        // fallback: context의 값 사용
        return char.date_last_chat || char.last_mes || 0;
    }
    
    /**
     * 캐시 클리어
     */
    clear() {
        this.lastChatTimes.clear();
        this.initialized = false;
        this.initializing = false;
    }
}

// 싱글톤 인스턴스
export const lastChatCache = new LastChatCache();
