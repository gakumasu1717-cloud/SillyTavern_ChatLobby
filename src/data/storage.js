// ============================================
// localStorage 관리 - 영구 저장 데이터
// ============================================

import { CONFIG, DEFAULT_DATA } from '../config.js';

class StorageManager {
    constructor() {
        this._data = null; // 메모리 캐시
    }
    
    // 데이터 로드 (메모리 캐시 우선)
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
    
    // 데이터 저장
    save(data) {
        try {
            this._data = data;
            localStorage.setItem(CONFIG.storageKey, JSON.stringify(data));
        } catch (e) {
            console.error('[Storage] Failed to save:', e);
        }
    }
    
    // 데이터 업데이트 (load → update → save 한번에)
    update(updater) {
        const data = this.load();
        const result = updater(data);
        this.save(data);
        return result;
    }
    
    // 캐시 초기화 (다시 localStorage에서 읽게)
    invalidate() {
        this._data = null;
    }
    
    // ============================================
    // 헬퍼 메서드
    // ============================================
    
    getChatKey(charAvatar, chatFileName) {
        return `${charAvatar}_${chatFileName}`;
    }
    
    // 폴더 관련
    getFolders() {
        return this.load().folders;
    }
    
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
    
    renameFolder(folderId, newName) {
        return this.update((data) => {
            const folder = data.folders.find(f => f.id === folderId);
            if (!folder || folder.isSystem) return false;
            folder.name = newName;
            return true;
        });
    }
    
    // 채팅-폴더 할당
    assignChatToFolder(charAvatar, chatFileName, folderId) {
        this.update((data) => {
            const key = this.getChatKey(charAvatar, chatFileName);
            data.chatAssignments[key] = folderId;
        });
    }
    
    getChatFolder(charAvatar, chatFileName) {
        const data = this.load();
        const key = this.getChatKey(charAvatar, chatFileName);
        return data.chatAssignments[key] || 'uncategorized';
    }
    
    // 즐겨찾기
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
    
    isFavorite(charAvatar, chatFileName) {
        const data = this.load();
        const key = this.getChatKey(charAvatar, chatFileName);
        return data.favorites.includes(key);
    }
    
    // 정렬/필터 옵션
    getSortOption() {
        return this.load().sortOption || 'recent';
    }
    
    setSortOption(option) {
        this.update((data) => { data.sortOption = option; });
    }
    
    getCharSortOption() {
        return this.load().charSortOption || 'recent';
    }
    
    setCharSortOption(option) {
        this.update((data) => { data.charSortOption = option; });
    }
    
    getFilterFolder() {
        return this.load().filterFolder || 'all';
    }
    
    setFilterFolder(folderId) {
        this.update((data) => { data.filterFolder = folderId; });
    }
    
    // 다중 채팅 이동
    moveChatsBatch(chatKeys, targetFolderId) {
        this.update((data) => {
            chatKeys.forEach(key => {
                data.chatAssignments[key] = targetFolderId;
            });
        });
    }
}

// 싱글톤 인스턴스
export const storage = new StorageManager();
