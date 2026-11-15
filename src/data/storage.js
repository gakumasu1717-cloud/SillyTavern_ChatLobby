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
    },
    personaRecentUsage: []  // [personaKey, ...] - 최근 사용순 (앞=최근, LRU 큐)
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
                
                // 마이그레이션: .jsonl 확장자 포함된 키 정규화
                if (!this._data._keysMigrated) {
                    let changed = false;
                    
                    // favorites 키 정규화
                    if (this._data.favorites) {
                        this._data.favorites = this._data.favorites.map(key => {
                            if (key.includes('.jsonl')) { changed = true; return key.replace(/\.jsonl/gi, ''); }
                            return key;
                        });
                        // 중복 제거
                        this._data.favorites = [...new Set(this._data.favorites)];
                    }
                    
                    // chatAssignments 키 정규화
                    if (this._data.chatAssignments) {
                        const newAssignments = {};
                        for (const [key, value] of Object.entries(this._data.chatAssignments)) {
                            const normalizedKey = key.replace(/\.jsonl/gi, '');
                            if (normalizedKey !== key) changed = true;
                            newAssignments[normalizedKey] = value;
                        }
                        this._data.chatAssignments = newAssignments;
                    }
                    
                    this._data._keysMigrated = true;
                    if (changed) {
                        console.debug('[Storage] Migrated .jsonl keys');
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
                    console.debug('[Storage] Saved after cleanup');
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
            console.debug(`[Storage] Cleaned chatAssignments: ${assignments.length} → 10000`);
        }
        
        // 2. favorites 크기 제한 (최대 2000개)
        if (data.favorites && data.favorites.length > 2000) {
            data.favorites = data.favorites.slice(-2000);
            console.debug(`[Storage] Cleaned favorites`);
        }
        
        // 3. characterFavorites 크기 제한 (최대 1000개)
        if (data.characterFavorites && data.characterFavorites.length > 1000) {
            data.characterFavorites = data.characterFavorites.slice(-1000);
            console.debug(`[Storage] Cleaned characterFavorites`);
        }
        
        // 4. personaRecentUsage 크기 제한 (최대 200개)
        if (data.personaRecentUsage) {
            // 마이그레이션: 구 Object 형식 → 신 Array(LRU) 형식
            if (!Array.isArray(data.personaRecentUsage)) {
                const entries = Object.entries(data.personaRecentUsage);
                entries.sort((a, b) => b[1] - a[1]);
                data.personaRecentUsage = entries.map(([key]) => key);
            }
            if (data.personaRecentUsage.length > 200) {
                data.personaRecentUsage = data.personaRecentUsage.slice(0, 200);
                console.debug(`[Storage] Cleaned personaRecentUsage`);
            }
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
     * 채팅 키 생성 (.jsonl 확장자 정규화)
     * @param {string} charAvatar - 캐릭터 아바타
     * @param {string} chatFileName - 채팅 파일명
     * @returns {string}
     */
    getChatKey(charAvatar, chatFileName) {
        // .jsonl 확장자 제거하여 키 정규화 (API마다 확장자 포함 여부가 다름)
        const normalizedFileName = (chatFileName || '').replace(/\.jsonl$/i, '');
        return `${charAvatar}::${normalizedFileName}`;
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
     * 채팅 이름 변경 시 로컬 데이터 키 마이그레이션
     * (폴더 배정 + 즐겨찾기가 채팅 키에 묶여 있으므로 함께 이동)
     * @param {string} charAvatar
     * @param {string} oldFileName
     * @param {string} newFileName
     */
    renameChatKey(charAvatar, oldFileName, newFileName) {
        this.update((data) => {
            const oldKey = this.getChatKey(charAvatar, oldFileName);
            const newKey = this.getChatKey(charAvatar, newFileName);
            if (oldKey === newKey) return;

            // 폴더 배정 이동
            if (data.chatAssignments[oldKey] !== undefined) {
                data.chatAssignments[newKey] = data.chatAssignments[oldKey];
                delete data.chatAssignments[oldKey];
            }

            // 즐겨찾기 이동
            const favIndex = data.favorites.indexOf(oldKey);
            if (favIndex > -1) {
                data.favorites[favIndex] = newKey;
            }
        });
    }

    /**
     * 삭제된 캐릭터의 로비 데이터 정리 (폴더 배정, 채팅 즐겨찾기, 캐릭터 즐겨찾기)
     * @param {string} charAvatar
     */
    removeCharacterData(charAvatar) {
        if (!charAvatar) return;
        this.update((data) => {
            const prefix = charAvatar + '::';
            for (const key of Object.keys(data.chatAssignments || {})) {
                if (key.startsWith(prefix)) delete data.chatAssignments[key];
            }
            if (Array.isArray(data.favorites)) {
                data.favorites = data.favorites.filter(key => !key.startsWith(prefix));
            }
            if (Array.isArray(data.characterFavorites)) {
                data.characterFavorites = data.characterFavorites.filter(a => a !== charAvatar);
            }
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
    
    // ============================================
    // 페르소나 최근 사용 기록
    // ============================================
    
    /**
     * 페르소나 사용 기록 저장 (LRU 큐)
     * 이미 있으면 제거 후 맨 앞에 추가, 최대 200개 유지
     * @param {string} personaKey - 페르소나 키
     */
    recordPersonaUsage(personaKey) {
        if (!personaKey) return;

        // 이미 맨 앞이면 쓰기 생략 (이중 기록 호출 시 불필요한 직렬화/저장 방지)
        const current = this.load().personaRecentUsage;
        if (Array.isArray(current) && current[0] === personaKey) return;

        this.update((data) => {
            if (!Array.isArray(data.personaRecentUsage)) data.personaRecentUsage = [];
            const idx = data.personaRecentUsage.indexOf(personaKey);
            if (idx !== -1) data.personaRecentUsage.splice(idx, 1);
            data.personaRecentUsage.unshift(personaKey);
            if (data.personaRecentUsage.length > 200) {
                data.personaRecentUsage.splice(200);
            }
        });
    }
    
    /**
     * 최근 사용 순서 배열 반환 (앞=최근)
     * @returns {string[]}
     */
    getPersonaRecentUsage() {
        const queue = this.load().personaRecentUsage || [];
        return Array.isArray(queue) ? queue : [];
    }
}

// 싱글톤 인스턴스
export const storage = new StorageManager();
