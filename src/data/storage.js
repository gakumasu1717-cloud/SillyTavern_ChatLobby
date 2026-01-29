// ============================================
// localStorage 관리 - 영구 저장 데이터
// ============================================

import { CONFIG } from '../config.js';

/**
 * 기본 데이터 구조
 * @type {Object}
 */
const DEFAULT_DATA = {
    folders: [
        { id: 'favorites', name: '⭐ 즐겨찾기', isSystem: true, order: 0 },
        { id: 'uncategorized', name: '📁 미분류', isSystem: true, order: 999 }
    ],
    chatAssignments: {},
    favorites: [],
    characterFavorites: [],  // 캐릭터 즐겨찾기 (avatar 목록)
    sortOption: 'recent',
    filterFolder: 'all',
    collapsedFolders: [],
    charSortOption: 'recent',  // 기본값: 최근 채팅순
    autoFavoriteRules: {
        recentDays: 0,
    }
};

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
        
        // 다른 탭에서 변경 감지
        window.addEventListener('storage', (e) => {
            if (e.key === CONFIG.storageKey) {
                this._data = null; // 캐시 무효화
            }
        });
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
                
                // 마이그레이션: 존재하지 않는 폴더가 필터로 설정되어 있으면 'all'로 리셋
                if (this._data.filterFolder && this._data.filterFolder !== 'all') {
                    const folderExists = this._data.folders?.some(f => f.id === this._data.filterFolder);
                    if (!folderExists) {
                        this._data.filterFolder = 'all';
                        this.save(this._data);
                    }
                }
                
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
            
            // QuotaExceededError인 경우 자동 정리 시도
            if (e.name === 'QuotaExceededError') {
                console.warn('[Storage] Quota exceeded, cleaning up old data...');
                this.cleanup(data);
                
                // 정리 후 다시 저장 시도
                try {
                    localStorage.setItem(CONFIG.storageKey, JSON.stringify(data));
                    console.log('[Storage] Saved after cleanup');
                    return;
                } catch (e2) {
                    console.error('[Storage] Still failed after cleanup:', e2);
                }
            }
            
            // 사용자에게 알림
            if (typeof window !== 'undefined') {
                import('../ui/notifications.js').then(({ showToast }) => {
                    showToast('저장 공간이 부족합니다. 오래된 데이터를 정리해주세요.', 'error');
                }).catch(() => {});
            }
        }
    }
    
    /**
     * 오래된/불필요한 데이터 정리
     * 장기 사용자를 고려해 제한 넉넉하게 설정
     * @param {LobbyData} data
     */
    cleanup(data) {
        // 1. chatAssignments 크기 제한 (최대 10000개 - 채팅 2000개 × 캐릭터 5명 정도)
        const assignments = Object.entries(data.chatAssignments || {});
        if (assignments.length > 10000) {
            const toKeep = assignments.slice(-10000);  // 최근 10000개만 유지
            data.chatAssignments = Object.fromEntries(toKeep);
            console.log(`[Storage] Cleaned chatAssignments: ${assignments.length} → 10000`);
        }
        
        // 2. favorites 크기 제한 (최대 2000개)
        if (data.favorites && data.favorites.length > 2000) {
            data.favorites = data.favorites.slice(-2000);
            console.log(`[Storage] Cleaned favorites`);
        }
        
        // 3. characterFavorites 크기 제한 (최대 1000개)
        if (data.characterFavorites && data.characterFavorites.length > 1000) {
            data.characterFavorites = data.characterFavorites.slice(-1000);
            console.log(`[Storage] Cleaned characterFavorites`);
        }
        
        this._data = data;
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
            if (folderId) {
                data.chatAssignments[key] = folderId;
            } else {
                delete data.chatAssignments[key];
            }
        });
    }
    
    /**
     * 채팅을 폴더에 할당 (alias)
     */
    setChatFolder(charAvatar, chatFileName, folderId) {
        this.assignChatToFolder(charAvatar, chatFileName, folderId);
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
        this.update((data) => {
            chatKeys.forEach(key => {
                data.chatAssignments[key] = targetFolderId;
            });
        });
    }
    
    // ============================================
    // 캐릭터 즐겨찾기 (로컬 전용)
    // ============================================
    
    /**
     * 캐릭터가 즐겨찾기인지 확인
     * @param {string} avatar - 캐릭터 아바타
     * @returns {boolean}
     */
    isCharacterFavorite(avatar) {
        const data = this.load();
        return (data.characterFavorites || []).includes(avatar);
    }
    
    /**
     * 캐릭터 즐겨찾기 토글
     * @param {string} avatar - 캐릭터 아바타
     * @returns {boolean} 새로운 즐겨찾기 상태
     */
    toggleCharacterFavorite(avatar) {
        return this.update((data) => {
            if (!data.characterFavorites) data.characterFavorites = [];
            
            const index = data.characterFavorites.indexOf(avatar);
            if (index === -1) {
                data.characterFavorites.push(avatar);
                return true;
            } else {
                data.characterFavorites.splice(index, 1);
                return false;
            }
        });
    }
    
    /**
     * 캐릭터 즐겨찾기 설정
     * @param {string} avatar - 캐릭터 아바타
     * @param {boolean} isFav - 즐겨찾기 여부
     */
    setCharacterFavorite(avatar, isFav) {
        this.update((data) => {
            if (!data.characterFavorites) data.characterFavorites = [];
            
            const index = data.characterFavorites.indexOf(avatar);
            if (isFav && index === -1) {
                data.characterFavorites.push(avatar);
            } else if (!isFav && index !== -1) {
                data.characterFavorites.splice(index, 1);
            }
        });
    }
    
    /**
     * 모든 캐릭터 즐겨찾기 목록
     * @returns {string[]}
     */
    getCharacterFavorites() {
        return this.load().characterFavorites || [];
    }
    
    // ============================================
    // 그룹 즐겨찾기 (로컬 전용)
    // ============================================
    
    /**
     * 그룹이 즐겨찾기인지 확인
     * @param {string} groupId - 그룹 ID
     * @returns {boolean}
     */
    isGroupFavorite(groupId) {
        const data = this.load();
        return (data.groupFavorites || []).includes(groupId);
    }
    
    /**
     * 그룹 즐겨찾기 토글
     * @param {string} groupId - 그룹 ID
     * @returns {boolean} 새로운 즐겨찾기 상태
     */
    toggleGroupFavorite(groupId) {
        return this.update((data) => {
            if (!data.groupFavorites) data.groupFavorites = [];
            
            const index = data.groupFavorites.indexOf(groupId);
            if (index === -1) {
                data.groupFavorites.push(groupId);
                return true;
            } else {
                data.groupFavorites.splice(index, 1);
                return false;
            }
        });
    }
    
    // ============================================
    // 페르소나 즐겨찾기 (로컬 전용)
    // ============================================
    
    /**
     * 페르소나가 즐겨찾기인지 확인
     * @param {string} personaKey - 페르소나 키
     * @returns {boolean}
     */
    isPersonaFavorite(personaKey) {
        const data = this.load();
        return (data.personaFavorites || []).includes(personaKey);
    }
    
    /**
     * 페르소나 즐겨찾기 토글
     * @param {string} personaKey - 페르소나 키
     * @returns {boolean} 새로운 즐겨찾기 상태
     */
    togglePersonaFavorite(personaKey) {
        return this.update((data) => {
            if (!data.personaFavorites) data.personaFavorites = [];
            
            const index = data.personaFavorites.indexOf(personaKey);
            if (index === -1) {
                data.personaFavorites.push(personaKey);
                return true;
            } else {
                data.personaFavorites.splice(index, 1);
                return false;
            }
        });
    }
    
    /**
     * 모든 페르소나 즐겨찾기 목록
     * @returns {string[]}
     */
    getPersonaFavorites() {
        return this.load().personaFavorites || [];
    }
}

// 싱글톤 인스턴스
export const storage = new StorageManager();
