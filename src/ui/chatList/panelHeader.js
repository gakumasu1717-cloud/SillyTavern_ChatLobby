// ============================================
// 채팅 목록 - 패널 헤더 / 필터 바 / 페르소나 퀵버튼
// ============================================

import { api } from '../../api/sillyTavern.js';
import { escapeHtml } from '../../utils/textUtils.js';

// ============================================
// UI 헬퍼
// ============================================

/**
 * 채팅 헤더 업데이트
 * @param {Object} character
 */
export function updateChatHeader(character) {
    const avatarImg = document.getElementById('chat-panel-avatar');
    const nameEl = document.getElementById('chat-panel-name');
    const deleteBtn = document.getElementById('chat-lobby-delete-char');
    const newChatBtn = document.getElementById('chat-lobby-new-chat');
    
    if (avatarImg) {
        avatarImg.style.display = 'block';
        avatarImg.src = character.avatarSrc;
    }
    if (nameEl) nameEl.textContent = character.name;
    if (deleteBtn) {
        deleteBtn.style.display = 'block';
        deleteBtn.dataset.charAvatar = character.avatar;  // 레이스컨디션 방지
        deleteBtn.dataset.charName = character.name;
    }
    if (newChatBtn) {
        newChatBtn.style.display = 'block';
        newChatBtn.dataset.charIndex = character.index;
        newChatBtn.dataset.charAvatar = character.avatar;
        newChatBtn.dataset.isGroup = 'false';  // 캐릭터로 표시
        // 그룹 데이터 초기화
        delete newChatBtn.dataset.groupId;
        delete newChatBtn.dataset.groupName;
    }
    
    document.getElementById('chat-panel-count').textContent = '채팅 로딩 중...';
    
    // 캐릭터 태그 표시
    renderCharacterTags(character.avatar);
}

/**
 * 캐릭터의 태그 가져오기 (SillyTavern 원본에서)
 * @param {string} charAvatar - 캐릭터 아바타 파일명
 * @returns {string[]}
 */
function getCharacterTags(charAvatar) {
    const context = api.getContext();
    if (!context?.tagMap || !context?.tags || !charAvatar) {
        return [];
    }
    
    const tagIds = context.tagMap[charAvatar] || [];
    return tagIds.map(tagId => {
        const tag = context.tags.find(t => t.id === tagId);
        return tag?.name || null;
    }).filter(Boolean);
}

/**
 * 캐릭터 태그바 렌더링
 * @param {string} charAvatar - 캐릭터 아바타 파일명
 */
function renderCharacterTags(charAvatar) {
    const filtersSection = document.getElementById('chat-lobby-filters');
    const container = document.getElementById('chat-lobby-char-tags');
    if (!container || !filtersSection) return;
    
    const tags = getCharacterTags(charAvatar);
    
    // 필터 섹션 표시
    filtersSection.style.display = 'block';
    
    if (tags.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
    } else {
        container.style.display = 'flex';
        container.innerHTML = tags.map(tag => 
            `<span class="lobby-char-tag">#${escapeHtml(tag)}</span>`
        ).join('');
    }
}

/**
 * 채팅 수 업데이트 (필터 후 표시용)
 * @param {number} count
 */
export function updateChatCount(count) {
    const el = document.getElementById('chat-panel-count');
    if (el) el.textContent = count > 0 ? `${count}개 채팅` : '채팅 없음';
}

/**
 * hasChats 업데이트 (필터 전 전체 수, 새 채팅 버튼용)
 * @param {number} totalCount
 */
export function updateHasChats(totalCount) {
    const newChatBtn = document.getElementById('chat-lobby-new-chat');
    if (newChatBtn) newChatBtn.dataset.hasChats = totalCount > 0 ? 'true' : 'false';
}

/**
 * 폴더 바 표시/숨김
 * @param {boolean} visible
 */
export function showFolderBar(visible) {
    const filtersSection = document.getElementById('chat-lobby-filters');
    if (filtersSection) filtersSection.style.display = visible ? 'block' : 'none';
}

/**
 * 드롭다운 동기화
 * @param {string} filterValue
 * @param {string} sortValue
 */
export function syncDropdowns(filterValue, sortValue) {
    const filterSelect = document.getElementById('chat-lobby-folder-filter');
    const sortSelect = document.getElementById('chat-lobby-chat-sort');
    
    if (filterSelect) filterSelect.value = filterValue;
    if (sortSelect) sortSelect.value = sortValue;
}

// ============================================
// 페르소나 퀵버튼
// ============================================

// ============================================
// 페르소나 퀵버튼
// ============================================

/**
 * 페르소나 퀵버튼 업데이트
 * @param {string} charAvatar - 캐릭터 아바타
 */
export function updatePersonaQuickButton(charAvatar) {
    console.debug('[ChatList] updatePersonaQuickButton called:', charAvatar);
    const btn = document.getElementById('chat-lobby-persona-quick');
    const img = btn ? btn.querySelector('.persona-quick-avatar') : null;
    console.debug('[ChatList] Button found:', !!btn, 'Image found:', !!img);
    if (!btn || !img) return;
    
    // lastChatCache에서 마지막 페르소나 가져오기 (동적 import 방지를 위해 전역에서 가져옴)
    const lastPersona = window._chatLobbyLastChatCache ? window._chatLobbyLastChatCache.getPersona(charAvatar) : null;
    
    if (lastPersona) {
        img.src = '/User Avatars/' + encodeURIComponent(lastPersona);
        img.alt = lastPersona.replace(/\.[^/.]+$/, '');
        btn.dataset.persona = lastPersona;
        btn.dataset.charAvatar = charAvatar;
        btn.title = '페르소나 전환: ' + img.alt;
        btn.style.display = 'flex';
    } else {
        btn.style.display = 'none';
    }
}

/**
 * 페르소나 퀵버튼 숨기기 (그룹 채팅 등에서 사용)
 */
export function hidePersonaQuickButton() {
    const btn = document.getElementById('chat-lobby-persona-quick');
    if (btn) btn.style.display = 'none';
}
