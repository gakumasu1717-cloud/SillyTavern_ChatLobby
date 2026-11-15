// ============================================
// 캐릭터 아바타 URL (캐시 무효화 포함)
//
// 캐릭터 이미지를 바꿔도 파일명(avatar)은 그대로라서 브라우저가 옛 이미지를
// 캐시에서 계속 보여줄 수 있다. 편집된 캐릭터는 URL 뒤에 버전(?v=)을 붙여서
// 새로 받게 한다. 버전은 새로고침 후에도 유지되도록 localStorage에 저장.
// ============================================

const STORAGE_KEY = 'chatLobby_avatarVersions';
const MAX_ENTRIES = 300;

/** @type {Map<string, number>} */
let versions = new Map();
try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) versions = new Map(Object.entries(JSON.parse(raw)));
} catch { /* 저장소 사용 불가 → 메모리만 */ }

function persist() {
    try {
        // 오래된 것부터 버림
        while (versions.size > MAX_ENTRIES) {
            versions.delete(versions.keys().next().value);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(versions)));
    } catch { /* ignore */ }
}

/**
 * 캐릭터 아바타 URL
 * @param {string} avatar - 캐릭터 avatar 파일명
 * @returns {string}
 */
export function charAvatarUrl(avatar) {
    const base = `/characters/${encodeURIComponent(avatar || '')}`;
    const v = versions.get(avatar);
    return v ? `${base}?v=${v}` : base;
}

/**
 * 캐릭터가 편집됐음을 기록 (다음 렌더부터 새 이미지를 받음)
 * @param {string} avatar
 */
export function bumpAvatarVersion(avatar) {
    if (!avatar) return;
    versions.delete(avatar);
    versions.set(avatar, Date.now());
    persist();
}

/**
 * 삭제된 캐릭터 정리
 * @param {string} avatar
 */
export function forgetAvatarVersion(avatar) {
    if (versions.delete(avatar)) persist();
}
