// ============================================
// 형광펜(하이라이트) 저장소
// 리마인드 뷰어에서 선택한 텍스트를 메시지 단위로 저장
// 재방문 시 본문에서 같은 텍스트를 찾아 다시 칠함
// ============================================

import { persistGet, persistSet } from './persist.js';

const STORAGE_KEY = 'chatLobby_highlights';

/**
 * @typedef {Object} Highlight
 * @property {string} id
 * @property {string} avatar - 캐릭터 아바타
 * @property {string} fileName - 채팅 파일명 (.jsonl 제거)
 * @property {number} mesid - 메시지 번호
 * @property {string} text - 칠한 텍스트 (본문 검색용 앵커)
 * @property {number} createdAt
 */

class HighlightStore {
    /**
     * 저장 위치: IndexedDB (persist.js). 값을 따로 들고 있지 않고 매번 persist에서 읽는다.
     */
    _load() {
        let data = persistGet(STORAGE_KEY, () => []);
        if (!Array.isArray(data)) {
            console.warn('[HighlightStore] Stored value was not an array, resetting');
            data = [];
            persistSet(STORAGE_KEY, data);
        }
        return data;
    }

    _save() {
        persistSet(STORAGE_KEY, this._load());
    }

    /**
     * 특정 메시지의 하이라이트 목록
     */
    getForMessage(avatar, fileName, mesid) {
        const clean = (fileName || '').replace(/\.jsonl$/i, '');
        return this._load().filter(h =>
            h.avatar === avatar && h.fileName === clean && h.mesid === mesid);
    }

    /**
     * 하이라이트 추가
     * @returns {Highlight}
     */
    add({ avatar, fileName, mesid, text }) {
        const data = this._load();
        const entry = {
            id: 'hl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            avatar,
            fileName: (fileName || '').replace(/\.jsonl$/i, ''),
            mesid,
            text: text.slice(0, 600),
            createdAt: Date.now(),
        };
        data.push(entry);
        this._save();
        return entry;
    }

    /**
     * 하이라이트 삭제
     */
    remove(id) {
        const data = this._load();
        const idx = data.findIndex(h => h.id === id);
        if (idx === -1) return false;
        data.splice(idx, 1);
        this._save();
        return true;
    }

    /**
     * 채팅 이름 변경 동기화
     */
    renameChat(avatar, oldFileName, newFileName) {
        const oldName = (oldFileName || '').replace(/\.jsonl$/i, '');
        const newName = (newFileName || '').replace(/\.jsonl$/i, '');
        let changed = false;
        for (const h of this._load()) {
            if (h.avatar === avatar && h.fileName === oldName) {
                h.fileName = newName;
                changed = true;
            }
        }
        if (changed) this._save();
    }

    /**
     * 캐릭터 삭제 시 정리
     */
    removeByAvatar(avatar) {
        const data = this._load();
        const before = data.length;
        const kept = data.filter(h => h.avatar !== avatar);
        if (kept.length !== before) persistSet(STORAGE_KEY, kept);
    }
}

export const highlightStore = new HighlightStore();
