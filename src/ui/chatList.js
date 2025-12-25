// ============================================
// 채팅 목록 UI
// ============================================

import { api } from '../api/sillyTavern.js';
import { cache } from '../data/cache.js';
import { storage } from '../data/storage.js';
import { store } from '../data/store.js';
import { escapeHtml, truncateText } from '../utils/textUtils.js';
import { formatDate, getTimestamp } from '../utils/dateUtils.js';
import { createTouchClickHandler } from '../utils/eventHelpers.js';
import { showToast, showAlert } from './notifications.js';
import { CONFIG } from '../config.js';

// ============================================
// 초기화
// ============================================

/**
 * 채팅 핸들러 설정
 * @param {{ onOpen: Function, onDelete: Function }} handlers
 */
export function setChatHandlers(handlers) {
    store.setChatHandlers(handlers);
}

/**
 * 현재 선택된 캐릭터 반환
 * @returns {Object|null}
 */
export function getCurrentCharacter() {
    return store.currentCharacter;
}

// ============================================
// 채팅 목록 렌더링
// ============================================

/**
 * 채팅 목록 렌더링
 * @param {Object} character - 캐릭터 정보
 * @returns {Promise<void>}
 */
export async function renderChatList(character) {
    store.setCurrentCharacter(character);
    
    const chatsPanel = document.getElementById('chat-lobby-chats');
    const chatsList = document.getElementById('chat-lobby-chats-list');
    
    if (!chatsPanel || !chatsList) return;
    
    // UI 표시
    chatsPanel.classList.add('visible');
    updateChatHeader(character);
    showFolderBar(true);
    
    // 캐시된 데이터가 있으면 즉시 렌더링
    const cachedChats = cache.get('chats', character.avatar);
    if (cachedChats && cachedChats.length > 0) {
        renderChats(chatsList, cachedChats, character.avatar);
    } else {
        chatsList.innerHTML = '<div class="lobby-loading">채팅 로딩 중...</div>';
    }
    
    try {
        // 최신 데이터 가져오기
        const chats = await api.fetchChatsForCharacter(character.avatar);
        
        if (!chats || chats.length === 0) {
            updateChatCount(0);
            chatsList.innerHTML = `
                <div class="lobby-empty-state">
                    <i>💬</i>
                    <div>채팅 기록이 없습니다</div>
                    <div style="font-size: 0.9em; margin-top: 5px;">새 채팅을 시작해보세요!</div>
                </div>
            `;
            return;
        }
        
        renderChats(chatsList, chats, character.avatar);
    } catch (error) {
        console.error('[ChatList] Failed to load chats:', error);
        showToast('채팅 목록을 불러오지 못했습니다.', 'error');
        chatsList.innerHTML = `
            <div class="lobby-empty-state">
                <i>⚠️</i>
                <div>채팅 목록 로딩 실패</div>
                <button onclick="window.chatLobbyRefresh()" style="margin-top:10px;padding:8px 16px;cursor:pointer;">다시 시도</button>
            </div>
        `;
    }
}

/**
 * 채팅 목록 내부 렌더링
 * @param {HTMLElement} container
 * @param {Array|Object} rawChats
 * @param {string} charAvatar
 */
function renderChats(container, rawChats, charAvatar) {
    // 배열로 변환
    let chatArray = normalizeChats(rawChats);
    
    // 유효한 채팅만 필터링
    chatArray = filterValidChats(chatArray);
    
    if (chatArray.length === 0) {
        updateChatCount(0);
        container.innerHTML = `
            <div class="lobby-empty-state">
                <i>💬</i>
                <div>채팅 기록이 없습니다</div>
            </div>
        `;
        return;
    }
    
    // 폴더 필터 적용
    const filterFolder = storage.getFilterFolder();
    if (filterFolder !== 'all') {
        chatArray = filterByFolder(chatArray, charAvatar, filterFolder);
    }
    
    // 정렬 적용
    const sortOption = storage.getSortOption();
    chatArray = sortChats(chatArray, charAvatar, sortOption);
    
    updateChatCount(chatArray.length);
    
    container.innerHTML = chatArray.map((chat, idx) => 
        renderChatItem(chat, charAvatar, idx)
    ).join('');
    
    bindChatEvents(container, charAvatar);
    
    // 드롭다운 동기화
    syncDropdowns(filterFolder, sortOption);
}

/**
 * 채팅 데이터 정규화
 * @param {Array|Object} chats
 * @returns {Array}
 */
function normalizeChats(chats) {
    if (Array.isArray(chats)) return chats;
    
    if (typeof chats === 'object') {
        return Object.entries(chats).map(([key, value]) => {
            if (typeof value === 'object') {
                return { ...value, file_name: value.file_name || key };
            }
            return { file_name: key, ...value };
        });
    }
    
    return [];
}

/**
 * 유효한 채팅만 필터링
 * @param {Array} chats
 * @returns {Array}
 */
function filterValidChats(chats) {
    return chats.filter(chat => {
        const fileName = chat?.file_name || chat?.fileName || '';
        const hasJsonl = fileName.includes('.jsonl');
        const hasDatePattern = /\d{4}-\d{2}-\d{2}/.test(fileName);
        return fileName && 
               (hasJsonl || hasDatePattern) &&
               !fileName.startsWith('chat_') &&
               fileName.toLowerCase() !== 'error';
    });
}

/**
 * 폴더별 필터링
 * @param {Array} chats
 * @param {string} charAvatar
 * @param {string} filterFolder
 * @returns {Array}
 */
function filterByFolder(chats, charAvatar, filterFolder) {
    const data = storage.load();
    
    return chats.filter(chat => {
        const fn = chat.file_name || chat.fileName || '';
        const key = storage.getChatKey(charAvatar, fn);
        
        if (filterFolder === 'favorites') {
            return data.favorites.includes(key);
        }
        
        const assigned = data.chatAssignments[key] || 'uncategorized';
        return assigned === filterFolder;
    });
}

/**
 * 채팅 정렬
 * @param {Array} chats
 * @param {string} charAvatar
 * @param {string} sortOption
 * @returns {Array}
 */
function sortChats(chats, charAvatar, sortOption) {
    const data = storage.load();
    
    return [...chats].sort((a, b) => {
        const fnA = a.file_name || '';
        const fnB = b.file_name || '';
        
        // 즐겨찾기 우선
        const keyA = storage.getChatKey(charAvatar, fnA);
        const keyB = storage.getChatKey(charAvatar, fnB);
        const favA = data.favorites.includes(keyA) ? 0 : 1;
        const favB = data.favorites.includes(keyB) ? 0 : 1;
        if (favA !== favB) return favA - favB;
        
        if (sortOption === 'name') {
            return fnA.localeCompare(fnB, 'ko');
        }
        
        if (sortOption === 'messages') {
            const msgA = a.message_count || a.mes_count || a.chat_items || 0;
            const msgB = b.message_count || b.mes_count || b.chat_items || 0;
            return msgB - msgA;
        }
        
        // 기본: 날짜순
        return getTimestamp(b) - getTimestamp(a);
    });
}

/**
 * 채팅 아이템 HTML 생성
 * @param {Object} chat
 * @param {string} charAvatar
 * @param {number} index
 * @returns {string}
 */
function renderChatItem(chat, charAvatar, index) {
    const fileName = chat.file_name || chat.fileName || chat.name || `chat_${index}`;
    const displayName = fileName.replace('.jsonl', '');
    
    // 미리보기
    const preview = chat.preview || chat.mes || chat.last_message || '채팅 기록';
    
    // 메시지 수
    const messageCount = chat.chat_items || chat.message_count || chat.mes_count || 0;
    
    // 즐겨찾기/폴더 상태
    const isFav = storage.isFavorite(charAvatar, fileName);
    const folderId = storage.getChatFolder(charAvatar, fileName);
    const data = storage.load();
    const folder = data.folders.find(f => f.id === folderId);
    const folderName = folder?.name || '';
    
    const tooltipPreview = truncateText(preview, 500);
    const safeAvatar = (charAvatar || '').replace(/"/g, '&quot;');
    const safeFileName = (fileName || '').replace(/"/g, '&quot;');
    
    return `
    <div class="lobby-chat-item ${isFav ? 'is-favorite' : ''}" 
         data-file-name="${safeFileName}" 
         data-char-avatar="${safeAvatar}" 
         data-chat-index="${index}" 
         data-folder-id="${folderId}">
        <div class="chat-checkbox" style="display:none;">
            <input type="checkbox" class="chat-select-cb">
        </div>
        <button class="chat-fav-btn" title="즐겨찾기">${isFav ? '⭐' : '☆'}</button>
        <div class="chat-content">
            <div class="chat-name">${escapeHtml(displayName)}</div>
            <div class="chat-preview">${escapeHtml(truncateText(preview, 80))}</div>
            <div class="chat-meta">
                ${messageCount > 0 ? `<span>💬 ${messageCount}개</span>` : ''}
                ${folderName && folderId !== 'uncategorized' ? `<span class="chat-folder-tag">${escapeHtml(folderName)}</span>` : ''}
            </div>
        </div>
        <button class="chat-delete-btn" title="채팅 삭제">🗑️</button>
    </div>
    `;
}

/**
 * 채팅 아이템 이벤트 바인딩
 * @param {HTMLElement} container
 * @param {string} charAvatar
 */
function bindChatEvents(container, charAvatar) {
    container.querySelectorAll('.lobby-chat-item').forEach(item => {
        const chatContent = item.querySelector('.chat-content');
        const favBtn = item.querySelector('.chat-fav-btn');
        const delBtn = item.querySelector('.chat-delete-btn');
        
        // 채팅 열기
        createTouchClickHandler(chatContent, () => {
            if (store.batchModeActive) {
                const cb = item.querySelector('.chat-select-cb');
                if (cb) {
                    cb.checked = !cb.checked;
                    updateBatchCount();
                }
                return;
            }
            
            const handlers = store.chatHandlers;
            if (handlers.onOpen) {
                handlers.onOpen({
                    fileName: item.dataset.fileName,
                    charAvatar: item.dataset.charAvatar,
                    charIndex: store.currentCharacter?.index
                });
            }
        }, { preventDefault: false });
        
        // 즐겨찾기 토글
        createTouchClickHandler(favBtn, () => {
            const fn = item.dataset.fileName;
            const isNowFav = storage.toggleFavorite(charAvatar, fn);
            favBtn.textContent = isNowFav ? '⭐' : '☆';
            item.classList.toggle('is-favorite', isNowFav);
        });
        
        // 삭제
        createTouchClickHandler(delBtn, () => {
            const handlers = store.chatHandlers;
            if (handlers.onDelete) {
                handlers.onDelete({
                    fileName: item.dataset.fileName,
                    charAvatar: item.dataset.charAvatar,
                    element: item
                });
            }
        });
    });
}

// ============================================
// UI 헬퍼
// ============================================

/**
 * 채팅 헤더 업데이트
 * @param {Object} character
 */
function updateChatHeader(character) {
    const avatarImg = document.getElementById('chat-panel-avatar');
    const nameEl = document.getElementById('chat-panel-name');
    const deleteBtn = document.getElementById('chat-lobby-delete-char');
    const newChatBtn = document.getElementById('chat-lobby-new-chat');
    
    if (avatarImg) {
        avatarImg.style.display = 'block';
        avatarImg.src = character.avatarSrc;
    }
    if (nameEl) nameEl.textContent = character.name;
    if (deleteBtn) deleteBtn.style.display = 'block';
    if (newChatBtn) {
        newChatBtn.style.display = 'block';
        newChatBtn.dataset.charIndex = character.index;
        newChatBtn.dataset.charAvatar = character.avatar;
    }
    
    document.getElementById('chat-panel-count').textContent = '채팅 로딩 중...';
}

/**
 * 채팅 수 업데이트
 * @param {number} count
 */
function updateChatCount(count) {
    const el = document.getElementById('chat-panel-count');
    if (el) el.textContent = count > 0 ? `${count}개 채팅` : '채팅 없음';
    
    const newChatBtn = document.getElementById('chat-lobby-new-chat');
    if (newChatBtn) newChatBtn.dataset.hasChats = count > 0 ? 'true' : 'false';
}

/**
 * 폴더 바 표시/숨김
 * @param {boolean} visible
 */
function showFolderBar(visible) {
    const bar = document.getElementById('chat-lobby-folder-bar');
    if (bar) bar.style.display = visible ? 'flex' : 'none';
}

/**
 * 드롭다운 동기화
 * @param {string} filterValue
 * @param {string} sortValue
 */
function syncDropdowns(filterValue, sortValue) {
    const filterSelect = document.getElementById('chat-lobby-folder-filter');
    const sortSelect = document.getElementById('chat-lobby-chat-sort');
    
    if (filterSelect) filterSelect.value = filterValue;
    if (sortSelect) sortSelect.value = sortValue;
}

// ============================================
// 필터/정렬 변경 핸들러
// ============================================

/**
 * 폴더 필터 변경
 * @param {string} filterValue
 */
export function handleFilterChange(filterValue) {
    storage.setFilterFolder(filterValue);
    const character = store.currentCharacter;
    if (character) {
        renderChatList(character);
    }
}

/**
 * 정렬 옵션 변경
 * @param {string} sortValue
 */
export function handleSortChange(sortValue) {
    storage.setSortOption(sortValue);
    const character = store.currentCharacter;
    if (character) {
        renderChatList(character);
    }
}

// ============================================
// 배치 모드
// ============================================

/**
 * 배치 모드 토글
 */
export function toggleBatchMode() {
    const isActive = store.toggleBatchMode();
    
    const chatsList = document.getElementById('chat-lobby-chats-list');
    const toolbar = document.getElementById('chat-lobby-batch-toolbar');
    const batchBtn = document.getElementById('chat-lobby-batch-mode');
    
    if (isActive) {
        chatsList?.classList.add('batch-mode');
        toolbar?.classList.add('visible');
        batchBtn?.classList.add('active');
        chatsList?.querySelectorAll('.chat-checkbox').forEach(cb => cb.style.display = 'block');
    } else {
        chatsList?.classList.remove('batch-mode');
        toolbar?.classList.remove('visible');
        batchBtn?.classList.remove('active');
        chatsList?.querySelectorAll('.chat-checkbox').forEach(cb => {
            cb.style.display = 'none';
            cb.querySelector('input').checked = false;
        });
    }
    
    updateBatchCount();
}

/**
 * 배치 선택 수 업데이트
 */
export function updateBatchCount() {
    const count = document.querySelectorAll('.chat-select-cb:checked').length;
    const countSpan = document.getElementById('batch-selected-count');
    if (countSpan) countSpan.textContent = `${count}개 선택`;
}

/**
 * 배치 이동 실행
 * @param {string} targetFolder
 */
export async function executeBatchMove(targetFolder) {
    if (!targetFolder) {
        await showAlert('이동할 폴더를 선택하세요.');
        return;
    }
    
    const checked = document.querySelectorAll('.chat-select-cb:checked');
    const keys = [];
    
    checked.forEach(cb => {
        const item = cb.closest('.lobby-chat-item');
        if (item) {
            const key = storage.getChatKey(item.dataset.charAvatar, item.dataset.fileName);
            keys.push(key);
        }
    });
    
    if (keys.length === 0) {
        await showAlert('이동할 채팅을 선택하세요.');
        return;
    }
    
    storage.moveChatsBatch(keys, targetFolder);
    toggleBatchMode();
    showToast(`${keys.length}개 채팅이 이동되었습니다.`, 'success');
    
    const character = store.currentCharacter;
    if (character) {
        renderChatList(character);
    }
}

/**
 * 배치 모드 활성화 여부
 * @returns {boolean}
 */
export function isBatchMode() {
    return store.batchModeActive;
}

// ============================================
// 채팅 목록 관리
// ============================================

/**
 * 채팅 목록 새로고침
 * @returns {Promise<void>}
 */
export async function refreshChatList() {
    const character = store.currentCharacter;
    if (character) {
        cache.invalidate('chats', character.avatar);
        await renderChatList(character);
    }
}

/**
 * 채팅 패널 닫기
 */
export function closeChatPanel() {
    const chatsPanel = document.getElementById('chat-lobby-chats');
    if (chatsPanel) chatsPanel.classList.remove('visible');
    store.setCurrentCharacter(null);
}
