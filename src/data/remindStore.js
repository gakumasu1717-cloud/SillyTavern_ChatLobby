// ============================================
// 리마인드(북마크) 저장소
// "이 채팅의 120~130 구간 서사가 좋았으니 나중에 다시 봐야지"
// 채팅 단위 또는 메시지 범위 단위로 메모와 함께 저장
// ============================================

import { persistGet, persistSet } from './persist.js';

const STORAGE_KEY = 'chatLobby_reminds';
const PROGRESS_KEY = 'chatLobby_remindProgress';
const PROGRESS_MAX_ENTRIES = 150;

/**
 * @typedef {Object} Remind
 * @property {string} id - 고유 ID
 * @property {string} avatar - 캐릭터 아바타
 * @property {string} charName - 캐릭터 이름 (표시용)
 * @property {string} fileName - 채팅 파일명 (.jsonl 제거)
 * @property {number|null} start - 시작 메시지 번호 (mesid, 0-based). null = 전체
 * @property {number|null} end - 끝 메시지 번호 (포함). null = 전체/끝까지
 * @property {string} note - 메모
 * @property {number} createdAt - 생성 시각 (ms)
 */

class RemindStore {
    /**
     * 저장 위치: IndexedDB (persist.js). 값을 따로 들고 있지 않고 매번 persist에서 읽는다.
     */
    _load() {
        let data = persistGet(STORAGE_KEY, () => []);
        if (!Array.isArray(data)) {
            console.warn('[RemindStore] Stored value was not an array, resetting');
            data = [];
            persistSet(STORAGE_KEY, data);
        }
        return data;
    }

    _save() {
        persistSet(STORAGE_KEY, this._load());
    }

    /**
     * 전체 목록 (최신순)
     * @returns {Remind[]}
     */
    getAll() {
        return [...this._load()].sort((a, b) => b.createdAt - a.createdAt);
    }

    /**
     * 리마인드 추가
     * @param {Omit<Remind, 'id'|'createdAt'>} remind
     * @returns {Remind}
     */
    add(remind) {
        const data = this._load();
        const entry = {
            ...remind,
            id: 'rm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            createdAt: Date.now(),
        };
        data.push(entry);
        this._save();
        return entry;
    }

    /**
     * 리마인드 삭제
     * @param {string} id
     * @returns {boolean}
     */
    remove(id) {
        const data = this._load();
        const idx = data.findIndex(r => r.id === id);
        if (idx === -1) return false;
        data.splice(idx, 1);
        this._save();
        this.removeProgress(id);
        return true;
    }

    // ============================================
    // 읽기 진행 위치 (이어 읽기)
    // ============================================

    _loadProgress() {
        try {
            const raw = localStorage.getItem(PROGRESS_KEY);
            const data = raw ? JSON.parse(raw) : {};
            return (data && typeof data === 'object') ? data : {};
        } catch (e) {
            return {};
        }
    }

    _saveProgress(map) {
        try {
            // 오래된 항목 정리 (최대 개수 초과 시)
            const keys = Object.keys(map);
            if (keys.length > PROGRESS_MAX_ENTRIES) {
                keys.sort((a, b) => (map[a].ts || 0) - (map[b].ts || 0));
                for (const k of keys.slice(0, keys.length - PROGRESS_MAX_ENTRIES)) {
                    delete map[k];
                }
            }
            localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
        } catch (e) {
            console.warn('[RemindStore] Failed to save progress:', e);
        }
    }

    /**
     * 읽기 진행 위치 조회
     * @param {string} id - 리마인드 ID
     * @returns {{viewStart:number, viewEnd:number, pageIndex:number, scrollTop:number}|null}
     */
    getProgress(id) {
        return this._loadProgress()[id] || null;
    }

    /**
     * 읽기 진행 위치 저장 (연장된 범위 포함)
     */
    setProgress(id, progress) {
        const map = this._loadProgress();
        map[id] = { ...progress, ts: Date.now() };
        this._saveProgress(map);
    }

    removeProgress(id) {
        const map = this._loadProgress();
        if (map[id]) {
            delete map[id];
            this._saveProgress(map);
        }
    }

    /**
     * ID로 조회
     * @param {string} id
     * @returns {Remind|null}
     */
    get(id) {
        return this._load().find(r => r.id === id) || null;
    }

    /**
     * 채팅 이름 변경 시 동기화
     * @param {string} avatar
     * @param {string} oldFileName
     * @param {string} newFileName
     */
    renameChat(avatar, oldFileName, newFileName) {
        const oldName = (oldFileName || '').replace(/\.jsonl$/i, '');
        const newName = (newFileName || '').replace(/\.jsonl$/i, '');
        let changed = false;
        for (const r of this._load()) {
            if (r.avatar === avatar && r.fileName === oldName) {
                r.fileName = newName;
                changed = true;
            }
        }
        if (changed) this._save();
    }

    /**
     * 캐릭터 삭제 시 정리
     * @param {string} avatar
     */
    removeByAvatar(avatar) {
        const data = this._load();
        const before = data.length;
        const kept = data.filter(r => r.avatar !== avatar);
        if (kept.length !== before) persistSet(STORAGE_KEY, kept);
    }
}

export const remindStore = new RemindStore();
