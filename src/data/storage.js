// ============================================
// localStorage 관리 - 영구 저장 데이터
// ============================================

import { CONFIG, DEFAULT_DATA } from '../config.js';

/**
 * @typedef {Object} LobbyData
 * @property {Array<{id: string, name: string, isSystem: boolean, order: number}>} folders
 * @property {Object<string, string>} chatAssignments - 채팅 키 → 폴더 ID
 * @property {string[]} favorites - 즐겨찾기 채팅 키 목록
 * @property {string} sortOption - 채팅 정렬 옵션
 * @property {string} filterFolder - 폴더 필터
 * @property {string[]} collapsedFolders - 접힌 폴더 목록
 * @property {string} charSortOption - 캐릭터 정렬 옵션
 */

/**
 * localStorage 관리 클래스
 */
class StorageManager {
    constructor() {
        /** @type {LobbyData|null} */
        this._data = null; // 메모리 캐시
    }
    
    /**
     * 데이터 로드 (메모리 캐시 우선)
     * @returns {LobbyData}
     */
    load() {
        if (this._data) return this._data;
        
        try {
            const saved = localStorage.getItem(CONFIG.storageKey);
            if (saved) {
                const data = JSON.parse(saved);
                this._data = { ...DEFAULT_DATA, ...data };
                return this._data;
            }
        } catch (e) {
            console.error('[Storage] Failed to load:', e);
        }
        
        this._data = { ...DEFAULT_DATA };
        return this._data;
    }
    
    /**
     * 데이터 저장
     * @param {LobbyData} data
     */
    save(data) {
        try {
            this._data = data;
            localStorage.setItem(CONFIG.storageKey, JSON.stringify(data));
        } catch (e) {
            console.error('[Storage] Failed to save:', e);
            
            // 사용자에게 알림 (QuotaExceededError 등)
            if (typeof window !== 'undefined') {
                import('../ui/notifications.js').then(({ showToast }) => {
                    showToast('데이터 저장에 실패했습니다. 저장 공간을 확인해주세요.', 'error');
                }).catch(() => {
                    // notifications 로드 실패 시 alert fallback
                    alert('데이터 저장에 실패했습니다.');
                });
            }
        }
    }
    
    /**
     * 데이터 업데이트 (load → update → save 한번에)
     * @param {(data: LobbyData) => *} updater - 업데이트 함수
     * @returns {*} updater의 반환값
     */
    update(updater) {
        const data = this.load();
        const result = updater(data);
        this.save(data);
        return result;
    }
    
    /**
     * 캐시 초기화 (다시 localStorage에서 읽게)
     */
    invalidate() {
        this._data = null;
    }
    
    // ============================================
    // 헬퍼 메서드
    // ============================================
    
    /**
     * 채팅 키 생성
     * @param {string} charAvatar - 캐릭터 아바타
     * @param {string} chatFileName - 채팅 파일명
     * @returns {string}
     */
    getChatKey(charAvatar, chatFileName) {
        return `${charAvatar}_${chatFileName}`;
    }
    
    // ============================================
    // 폴더 관련
    // ============================================
    
    /**
     * 폴더 목록 가져오기
     * @returns {Array}
     */
    getFolders() {
        return this.load().folders;
    }
    
    /**
     * 폴더 추가
     * @param {string} name - 폴더 이름
     * @returns {string} 생성된 폴더 ID
     */
    addFolder(name) {
        return this.update((data) => {
            const id = 'folder_' + Date.now();
            const maxOrder = Math.max(
                ...data.folders
                    .filter(f => !f.isSystem || f.id !== 'uncategorized')
                    .map(f => f.order),
                0
            );
            data.folders.push({ id, name, isSystem: false, order: maxOrder + 1 });
            return id;
        });
    }
    
    /**
     * 폴더 삭제
     * @param {string} folderId - 폴더 ID
     * @returns {boolean} 성공 여부
     */
    deleteFolder(folderId) {
        return this.update((data) => {
            const folder = data.folders.find(f => f.id === folderId);
            if (!folder || folder.isSystem) return false;
            
            // 해당 폴더의 채팅들을 미분류로 이동
            Object.keys(data.chatAssignments).forEach(key => {
                if (data.chatAssignments[key] === folderId) {
                    data.chatAssignments[key] = 'uncategorized';
                }
            });
            
            data.folders = data.folders.filter(f => f.id !== folderId);
            return true;
        });
    }
    
    /**
     * 폴더 이름 변경
     * @param {string} folderId - 폴더 ID
     * @param {string} newName - 새 이름
     * @returns {boolean} 성공 여부
     */
    renameFolder(folderId, newName) {
        return this.update((data) => {
            const folder = data.folders.find(f => f.id === folderId);
            if (!folder || folder.isSystem) return false;
            folder.name = newName;
            return true;
        });
    }
    
    // ============================================
    // 채팅-폴더 할당
    // ============================================
    
    /**
     * 채팅을 폴더에 할당
     * @param {string} charAvatar
     * @param {string} chatFileName
     * @param {string} folderId
     */
    assignChatToFolder(charAvatar, chatFileName, folderId) {
        this.update((data) => {
            const key = this.getChatKey(charAvatar, chatFileName);
            data.chatAssignments[key] = folderId;
        });
    }
    
    /**
     * 채팅이 속한 폴더 가져오기
     * @param {string} charAvatar
     * @param {string} chatFileName
     * @returns {string} 폴더 ID
     */
    getChatFolder(charAvatar, chatFileName) {
        const data = this.load();
        const key = this.getChatKey(charAvatar, chatFileName);
        return data.chatAssignments[key] || 'uncategorized';
    }
    
    // ============================================
    // 즐겨찾기
    // ============================================
    
    /**
     * 즐겨찾기 토글
     * @param {string} charAvatar
     * @param {string} chatFileName
     * @returns {boolean} 새 즐겨찾기 상태
     */
    toggleFavorite(charAvatar, chatFileName) {
        return this.update((data) => {
            const key = this.getChatKey(charAvatar, chatFileName);
            const index = data.favorites.indexOf(key);
            if (index > -1) {
                data.favorites.splice(index, 1);
                return false;
            }
            data.favorites.push(key);
            return true;
        });
    }
    
    /**
     * 즐겨찾기 여부 확인
     * @param {string} charAvatar
     * @param {string} chatFileName
     * @returns {boolean}
     */
    isFavorite(charAvatar, chatFileName) {
        const data = this.load();
        const key = this.getChatKey(charAvatar, chatFileName);
        return data.favorites.includes(key);
    }
    
    // ============================================
    // 정렬/필터 옵션
    // ============================================
    
    /**
     * 채팅 정렬 옵션 가져오기
     * @returns {string}
     */
    getSortOption() {
        return this.load().sortOption || 'recent';
    }
    
    /**
     * 채팅 정렬 옵션 설정
     * @param {string} option
     */
    setSortOption(option) {
        this.update((data) => { data.sortOption = option; });
    }
    
    /**
     * 캐릭터 정렬 옵션 가져오기
     * @returns {string}
     */
    getCharSortOption() {
        return this.load().charSortOption || 'recent';
    }
    
    /**
     * 캐릭터 정렬 옵션 설정
     * @param {string} option
     */
    setCharSortOption(option) {
        this.update((data) => { data.charSortOption = option; });
    }
    
    /**
     * 폴더 필터 가져오기
     * @returns {string}
     */
    getFilterFolder() {
        return this.load().filterFolder || 'all';
    }
    
    /**
     * 폴더 필터 설정
     * @param {string} folderId
     */
    setFilterFolder(folderId) {
        this.update((data) => { data.filterFolder = folderId; });
    }
    
    /**
     * 다중 채팅 폴더 이동
     * @param {string[]} chatKeys - 채팅 키 배열
     * @param {string} targetFolderId - 대상 폴더 ID
     */
    moveChatsBatch(chatKeys, targetFolderId) {
        console.log('[Storage] ========== MOVE BATCH START ==========');
        console.log('[Storage] chatKeys:', chatKeys);
        console.log('[Storage] targetFolderId:', targetFolderId);
        
        this.update((data) => {
            console.log('[Storage] Before update - chatAssignments:', JSON.stringify(data.chatAssignments));
            
            chatKeys.forEach(key => {
                const oldFolder = data.chatAssignments[key] || 'uncategorized';
                console.log(`[Storage] Moving "${key}": ${oldFolder} -> ${targetFolderId}`);
                data.chatAssignments[key] = targetFolderId;
            });
            
            console.log('[Storage] After update - chatAssignments:', JSON.stringify(data.chatAssignments));
        });
        
        console.log('[Storage] ========== MOVE BATCH END ==========');
    }
}

// 싱글톤 인스턴스
export const storage = new StorageManager();
