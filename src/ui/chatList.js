// ============================================
// 채팅 목록 UI
// ============================================

import { api } from '../api/sillyTavern.js';
import { cache } from '../data/cache.js';
import { storage } from '../data/storage.js';
import { store } from '../data/store.js';
import { escapeHtml, truncateText } from '../utils/textUtils.js';
import { formatDate, getTimestamp } from '../utils/dateUtils.js';
import { createTouchClickHandler, isMobile } from '../utils/eventHelpers.js';
import { showToast, showAlert } from './notifications.js';
import { CONFIG } from '../config.js';
import { getFoldersOptionsHTML } from './templates.js';

// ============================================
// 툴팁 관련 변수
// ============================================

let tooltipElement = null;
let tooltipTimeout = null;
let currentTooltipTarget = null;
let tooltipEventsInitialized = false;  // 이벤트 위임 등록 여부

/**
 * 툴팁 요소 생성 (한 번만)
 */
function ensureTooltipElement() {
    if (tooltipElement) return tooltipElement;
    
    tooltipElement = document.createElement('div');
    tooltipElement.id = 'chat-preview-tooltip';
    tooltipElement.className = 'chat-preview-tooltip';
    tooltipElement.style.cssText = `
        position: fixed;
        display: none;
        max-width: 400px;
        max-height: 300px;
        padding: 12px 16px;
        background: rgba(20, 20, 30, 0.95);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 10px;
        color: #e0e0e0;
        font-size: 13px;
        line-height: 1.6;
        z-index: 100000;
        overflow-y: auto;
        overflow-x: hidden;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        pointer-events: none;
        white-space: pre-wrap;
        word-break: break-word;
        backdrop-filter: blur(10px);
    `;
    
    // 스크롤바 스타일 추가
    const style = document.createElement('style');
    style.textContent = `
        .chat-preview-tooltip::-webkit-scrollbar {
            width: 6px;
        }
        .chat-preview-tooltip::-webkit-scrollbar-track {
            background: rgba(255,255,255,0.05);
            border-radius: 3px;
        }
        .chat-preview-tooltip::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.2);
            border-radius: 3px;
        }
        .chat-preview-tooltip::-webkit-scrollbar-thumb:hover {
            background: rgba(255,255,255,0.3);
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(tooltipElement);
    return tooltipElement;
}

/**
 * 툴팁 표시
 * @param {string} content - 표시할 내용
 * @param {MouseEvent} e - 마우스 이벤트
 */
function showTooltip(content, e) {
    const tooltip = ensureTooltipElement();
    tooltip.textContent = content;
    tooltip.style.display = 'block';
    
    // 마우스 커서 우측 아래에 고정
    tooltip.style.left = `${e.clientX + 15}px`;
    tooltip.style.top = `${e.clientY + 15}px`;
}

/**
 * 툴팁 숨김
 */
function hideTooltip() {
    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
        tooltipTimeout = null;
    }
    if (tooltipElement) {
        tooltipElement.style.display = 'none';
    }
    currentTooltipTarget = null;
}

/**
 * 채팅 아이템에 툴팁 이벤트 바인딩 (PC 전용) - 이벤트 위임 방식
 * @param {HTMLElement} container
 */
function bindTooltipEvents(container) {
    // 모바일에서는 비활성화
    if (isMobile()) {
        return;
    }
    
    // 이미 이벤트 위임이 등록되어 있으면 스킵 (메모리 누수 방지)
    if (tooltipEventsInitialized) {
        return;
    }
    
    const chatsList = document.getElementById('chat-lobby-chats-list');
    if (!chatsList) return;
    
    // 이벤트 위임: container에 한 번만 등록
    chatsList.addEventListener('mouseover', handleTooltipMouseOver);
    chatsList.addEventListener('mouseout', handleTooltipMouseOut);
    chatsList.addEventListener('mousemove', handleTooltipMouseMove);
    chatsList.addEventListener('wheel', handleTooltipWheel, { passive: false });
    
    tooltipEventsInitialized = true;
}

/**
 * 툴팁 mouseover 핸들러 (이벤트 위임)
 */
function handleTooltipMouseOver(e) {
    const item = e.target.closest('.lobby-chat-item');
    if (!item) return;
    
    // 같은 아이템이면 스킵
    if (currentTooltipTarget === item) return;
    
    const fullPreview = item.dataset.fullPreview || '';
    if (!fullPreview) return;
    
    // 이전 타이머 취소
    hideTooltip();
    currentTooltipTarget = item;
    
    // 딜레이 후 툴팁 표시 (300ms)
    tooltipTimeout = setTimeout(() => {
        if (currentTooltipTarget === item && fullPreview) {
            showTooltip(fullPreview, e);
        }
    }, 300);
}

/**
 * 툴팁 mouseout 핸들러 (이벤트 위임)
 */
function handleTooltipMouseOut(e) {
    const item = e.target.closest('.lobby-chat-item');
    if (!item) return;
    
    // relatedTarget이 같은 아이템 내부면 무시
    const relatedItem = e.relatedTarget?.closest('.lobby-chat-item');
    if (relatedItem === item) return;
    
    if (currentTooltipTarget === item) {
        hideTooltip();
    }
}

/**
 * 툴팁 wheel 핸들러 - 채팅 아이템 위에서 휠 돌리면 tooltip 스크롤
 */
function handleTooltipWheel(e) {
    // 툴팁이 표시 중일 때만 처리
    if (!tooltipElement || tooltipElement.style.display !== 'block') return;
    
    // 스크롤이 필요한지 확인
    const hasScroll = tooltipElement.scrollHeight > tooltipElement.clientHeight;
    if (!hasScroll) return;
    
    // 채팅 아이템 위에서 휠 이벤트 발생 시 tooltip 스크롤
    const item = e.target.closest('.lobby-chat-item');
    if (item && currentTooltipTarget === item) {
        e.preventDefault();
        e.stopPropagation();
        tooltipElement.scrollTop += e.deltaY;
    }
}

/**
 * 툴팁 mousemove 핸들러 (이벤트 위임)
 */
function handleTooltipMouseMove(e) {
    const item = e.target.closest('.lobby-chat-item');
    if (!item) return;
    
    // 툴팁이 표시 중이면 위치 업데이트
    if (tooltipElement && tooltipElement.style.display === 'block' && currentTooltipTarget === item) {
        tooltipElement.style.left = `${e.clientX + 15}px`;
        tooltipElement.style.top = `${e.clientY + 15}px`;
    }
}

// ============================================
// Cleanup
// ============================================

/**
 * 툴팁 정리 (메모리 누수 방지)
 * 로비 닫힐 때 호출
 */
export function cleanupTooltip() {
    hideTooltip();
    
    // 이벤트 위임 리스너 제거
    const chatsList = document.getElementById('chat-lobby-chats-list');
    if (chatsList && tooltipEventsInitialized) {
        chatsList.removeEventListener('mouseover', handleTooltipMouseOver);
        chatsList.removeEventListener('mouseout', handleTooltipMouseOut);
        chatsList.removeEventListener('mousemove', handleTooltipMouseMove);
        chatsList.removeEventListener('wheel', handleTooltipWheel);
    }
    tooltipEventsInitialized = false;
    
    if (tooltipElement && tooltipElement.parentNode) {
        tooltipElement.parentNode.removeChild(tooltipElement);
    }
    tooltipElement = null;
    currentTooltipTarget = null;
}

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
    if (!character || !character.avatar) {
        console.error('[ChatList] Invalid character data:', character);
        return;
    }
    
    const chatsPanel = document.getElementById('chat-lobby-chats');
    const chatsList = document.getElementById('chat-lobby-chats-list');
    
    // 이미 같은 캐릭터의 채팅 패널이 열려있으면 렌더 스킵
    if (store.currentCharacter?.avatar === character.avatar && chatsPanel?.classList.contains('visible')) {
        return;
    }
    
    store.setCurrentCharacter(character);
    
    if (!chatsPanel || !chatsList) {
        console.error('[ChatList] Chat panel elements not found');
        return;
    }
    
    // UI 표시
    chatsPanel.classList.add('visible');
    updateChatHeader(character);
    showFolderBar(true);
    
    // 캐시된 데이터가 있고 유효하면 즉시 렌더링 (번첩임 방지)
    const cachedChats = cache.get('chats', character.avatar);
    
    if (cachedChats && cachedChats.length > 0 && cache.isValid('chats', character.avatar)) {
        renderChats(chatsList, cachedChats, character.avatar);
        return; // 캐시 유효하면 API 호출 안 함
    }
    
    // 캐시 없으면 로딩 표시 후 API 호출
    chatsList.innerHTML = '<div class="lobby-loading">채팅 로딩 중...</div>';
    
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
    
    // 💡 hasChats는 필터 전 전체 수로 설정 (새 채팅 버튼용)
    const totalChatCount = chatArray.length;
    updateHasChats(totalChatCount);
    
    if (chatArray.length === 0) {
        console.log('[renderChats] No valid chats, showing empty state');
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
    
    // 필터 결과가 0이면 빈 상태 표시
    if (chatArray.length === 0) {
        container.innerHTML = `
            <div class="lobby-empty-state">
                <i>📁</i>
                <div>이 폴더에는 채팅이 없습니다</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = chatArray.map((chat, idx) => 
        renderChatItem(chat, charAvatar, idx)
    ).join('');
    
    bindChatEvents(container, charAvatar);
    
    // PC에서 툴팁 이벤트 바인딩
    bindTooltipEvents(container);
    
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
        // 날짜 패턴 체크 제거 - 사용자가 채팅 이름을 변경해도 정상 인식되도록
        return fileName && 
               hasJsonl &&
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
    
    const result = chats.filter(chat => {
        const fn = chat.file_name || chat.fileName || '';
        const key = storage.getChatKey(charAvatar, fn);
        
        if (filterFolder === 'favorites') {
            const isFav = data.favorites.includes(key);
            return isFav;
        }
        
        const assigned = data.chatAssignments[key] || 'uncategorized';
        const match = assigned === filterFolder;
        return match;
    });
    
    return result;
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
    
    // 툴팁용 미리보기 (10000자까지)
    const tooltipPreview = truncateText(preview, 10000);
    const safeAvatar = escapeHtml(charAvatar || '');
    const safeFileName = escapeHtml(fileName || '');
    // 툴팁용 전문 (HTML 이스케이프)
    const safeFullPreview = escapeHtml(tooltipPreview);
    
    return `
    <div class="lobby-chat-item ${isFav ? 'is-favorite' : ''}" 
         data-file-name="${safeFileName}" 
         data-char-avatar="${safeAvatar}" 
         data-chat-index="${index}" 
         data-folder-id="${folderId}"
         data-full-preview="${safeFullPreview}">
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
    const items = container.querySelectorAll('.lobby-chat-item');
    console.log('[ChatList] bindChatEvents: items count =', items.length, 'charAvatar =', charAvatar);
    
    items.forEach((item, index) => {
        const chatContent = item.querySelector('.chat-content');
        const favBtn = item.querySelector('.chat-fav-btn');
        const delBtn = item.querySelector('.chat-delete-btn');
        const fileName = item.dataset.fileName;
        
        console.log('[ChatList] Binding item', index, ':', { fileName, hasChatContent: !!chatContent });
        
        if (!chatContent) {
            console.error('[ChatList] chatContent not found for item', index);
            return;
        }
        
        // 채팅 열기
        createTouchClickHandler(chatContent, () => {
            console.log('[ChatList] Chat item clicked!', { fileName, charAvatar: item.dataset.charAvatar });
            
            if (store.batchModeActive) {
                const cb = item.querySelector('.chat-select-cb');
                if (cb) {
                    cb.checked = !cb.checked;
                    updateBatchCount();
                }
                return;
            }
            
            const handlers = store.chatHandlers;
            console.log('[ChatList] handlers =', handlers, 'onOpen =', !!handlers?.onOpen);
            
            if (handlers?.onOpen) {
                // currentCharacter가 null인 경우 dataset에서 가져오기
                const charIndex = store.currentCharacter?.index || item.dataset.charIndex || null;
                
                const chatInfo = {
                    fileName: item.dataset.fileName,
                    charAvatar: item.dataset.charAvatar,
                    charIndex: charIndex
                };
                
                console.log('[ChatList] Calling onOpen:', chatInfo);
                handlers.onOpen(chatInfo);
            } else {
                console.error('[ChatList] onOpen handler not available!');
            }
        }, { preventDefault: true, stopPropagation: true, debugName: `chat-${index}` });
        
        // 즐겨찾기 토글
        createTouchClickHandler(favBtn, () => {
            const fn = item.dataset.fileName;
            const isNowFav = storage.toggleFavorite(charAvatar, fn);
            favBtn.textContent = isNowFav ? '⭐' : '☆';
            item.classList.toggle('is-favorite', isNowFav);
        }, { debugName: `fav-${index}` });
        
        // 삭제
        createTouchClickHandler(delBtn, () => {
            const handlers = store.chatHandlers;
            if (handlers?.onDelete) {
                handlers.onDelete({
                    fileName: item.dataset.fileName,
                    charAvatar: item.dataset.charAvatar,
                    element: item
                });
            }
        }, { debugName: `del-${index}` });
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
function updateChatCount(count) {
    const el = document.getElementById('chat-panel-count');
    if (el) el.textContent = count > 0 ? `${count}개 채팅` : '채팅 없음';
}

/**
 * hasChats 업데이트 (필터 전 전체 수, 새 채팅 버튼용)
 * @param {number} totalCount
 */
function updateHasChats(totalCount) {
    const newChatBtn = document.getElementById('chat-lobby-new-chat');
    if (newChatBtn) newChatBtn.dataset.hasChats = totalCount > 0 ? 'true' : 'false';
}

/**
 * 폴더 바 표시/숨김
 * @param {boolean} visible
 */
function showFolderBar(visible) {
    const filtersSection = document.getElementById('chat-lobby-filters');
    if (filtersSection) filtersSection.style.display = visible ? 'block' : 'none';
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
    refreshCurrentChatList();
}

/**
 * 정렬 옵션 변경
 * @param {string} sortValue
 */
export function handleSortChange(sortValue) {
    storage.setSortOption(sortValue);
    refreshCurrentChatList();
}

/**
 * 현재 채팅 목록 새로고침 (정렬/필터 변경 시)
 */
export async function refreshCurrentChatList() {
    const character = store.currentCharacter;
    if (!character) return;
    
    const chatsList = document.getElementById('chat-lobby-chats-list');
    if (!chatsList) return;
    
    // 캐시된 데이터로 바로 다시 렌더링
    const cachedChats = cache.get('chats', character.avatar);
    if (cachedChats) {
        // 캐시가 있으면 즉시 렌더링 (빈 배열도 렌더링)
        renderChats(chatsList, cachedChats, character.avatar);
    } else {
        // 캐시가 없으면 전체 재렌더
        await renderChatList(character);
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
    
    checked.forEach((cb, idx) => {
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
    
    // 폴더 필터 드롭다운 업데이트 (캐릭터 캐시는 유지)
    const filterSelect = document.getElementById('chat-lobby-folder-filter');
    if (filterSelect) {
        const currentValue = filterSelect.value;
        filterSelect.innerHTML = getFoldersOptionsHTML(currentValue);
    }
    
    // 채팅 목록만 재렌더 (캐시된 채팅 데이터로 필터/정렬만 다시 적용)
    await refreshCurrentChatList();
    
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
    store.setCurrentGroup(null);
}

// ============================================
// 그룹 채팅 목록
// ============================================

/**
 * 그룹 채팅 목록 렌더링
 * @param {Object} group - 그룹 정보
 * @returns {Promise<void>}
 */
export async function renderGroupChatList(group) {
    console.log('[ChatList] renderGroupChatList called:', { 
        groupId: group?.id, 
        groupName: group?.name,
        currentGroupId: store.currentGroup?.id,
        isPanelVisible: document.getElementById('chat-lobby-chats')?.classList.contains('visible')
    });
    
    if (!group || !group.id) {
        console.error('[ChatList] Invalid group data:', group);
        return;
    }
    
    const chatsPanel = document.getElementById('chat-lobby-chats');
    const chatsList = document.getElementById('chat-lobby-chats-list');
    
    // 이미 같은 그룹의 채팅 패널이 열려있으면 렌더 스킵 (토글 동작)
    if (store.currentGroup?.id === group.id && chatsPanel?.classList.contains('visible')) {
        console.log('[ChatList] Same group already visible, toggling off');
        chatsPanel.classList.remove('visible');
        store.setCurrentGroup(null);
        return;
    }
    
    // 캐릭터 대신 그룹 설정
    store.setCurrentCharacter(null);
    store.setCurrentGroup(group);
    
    if (!chatsPanel || !chatsList) {
        console.error('[ChatList] Chat panel elements not found');
        return;
    }
    
    // UI 표시
    chatsPanel.classList.add('visible');
    updateGroupChatHeader(group);
    showFolderBar(false);  // 그룹은 폴더 기능 비활성화
    
    // 로딩 표시
    chatsList.innerHTML = '<div class="lobby-loading">채팅 로딩 중...</div>';
    
    try {
        const chats = await api.getGroupChats(group.id);
        
        if (!chats || chats.length === 0) {
            updateChatCount(0);
            chatsList.innerHTML = `
                <div class="lobby-empty-state">
                    <i>💬</i>
                    <div>그룹 채팅 기록이 없습니다</div>
                    <div style="font-size: 0.9em; margin-top: 5px;">새 채팅을 시작해보세요!</div>
                </div>
            `;
            return;
        }
        
        renderGroupChats(chatsList, chats, group);
    } catch (error) {
        console.error('[ChatList] Failed to load group chats:', error);
        showToast('그룹 채팅 목록을 불러오지 못했습니다.', 'error');
        chatsList.innerHTML = `
            <div class="lobby-empty-state">
                <i>⚠️</i>
                <div>그룹 채팅 목록 로딩 실패</div>
            </div>
        `;
    }
}

/**
 * 그룹 채팅 헤더 업데이트
 * @param {Object} group
 */
function updateGroupChatHeader(group) {
    const headerTitle = document.getElementById('chat-panel-name');
    const headerAvatar = document.getElementById('chat-panel-avatar');
    const deleteBtn = document.getElementById('chat-lobby-delete-char');
    const newChatBtn = document.getElementById('chat-lobby-new-chat');
    
    if (headerTitle) {
        headerTitle.textContent = group.name || '그룹';
    }
    
    if (headerAvatar) {
        headerAvatar.src = api.getGroupAvatarUrl(group);
        headerAvatar.alt = group.name || '그룹';
        headerAvatar.style.display = 'block';
    }
    
    // 그룹에서는 캐릭터 삭제 버튼 숨기기
    if (deleteBtn) {
        deleteBtn.style.display = 'none';
    }
    
    // 새 채팅 버튼 활성화 (그룹용 데이터 저장)
    if (newChatBtn) {
        newChatBtn.style.display = 'block';
        newChatBtn.dataset.groupId = group.id;
        newChatBtn.dataset.groupName = group.name || '그룹';
        newChatBtn.dataset.isGroup = 'true';
        // 캐릭터 데이터 초기화 (그룹으로 인식하도록)
        delete newChatBtn.dataset.charIndex;
        delete newChatBtn.dataset.charAvatar;
    }
}

/**
 * 그룹 채팅 목록 내부 렌더링
 * @param {HTMLElement} container
 * @param {Array} chats
 * @param {Object} group
 */
function renderGroupChats(container, chats, group) {
    updateChatCount(chats.length);
    updateHasChats(chats.length);
    
    // 날짜순 정렬 (최신순)
    const sortedChats = chats.sort((a, b) => {
        const dateA = a.last_mes ? new Date(a.last_mes).getTime() : 0;
        const dateB = b.last_mes ? new Date(b.last_mes).getTime() : 0;
        return dateB - dateA;
    });
    
    let html = '';
    
    for (const chat of sortedChats) {
        const fileName = chat.file_name || '';
        // 파일명에서 날짜 부분 추출해서 보기 좋게 표시
        const displayName = formatGroupChatName(fileName);
        const lastMes = chat.last_mes ? formatDate(chat.last_mes) : '';
        const mesCount = chat.chat_items || 0;
        const preview = chat.mes || '';
        const safePreview = escapeHtml(truncateText(preview, 10000));
        
        html += `
        <div class="lobby-chat-item" 
             data-group-id="${escapeHtml(group.id)}"
             data-chat-file="${escapeHtml(fileName)}"
             data-full-preview="${safePreview}">
            <div class="chat-content">
                <div class="chat-name">${escapeHtml(displayName)}</div>
                <div class="chat-preview">${escapeHtml(truncateText(preview, 80))}</div>
                <div class="chat-meta">
                    ${mesCount > 0 ? `<span>💬 ${mesCount}개</span>` : ''}
                    ${lastMes ? `<span>🕐 ${lastMes}</span>` : ''}
                </div>
            </div>
        </div>
        `;
    }
    
    container.innerHTML = html || `
        <div class="lobby-empty-state">
            <i>💬</i>
            <div>그룹 채팅이 없습니다</div>
        </div>
    `;
    
    // 그룹 채팅 클릭 이벤트 바인딩
    bindGroupChatEvents(container, group);
}

/**
 * 그룹 채팅 파일명을 보기 좋게 포맷
 * @param {string} fileName - 예: "2026-01-07@16h48m17s"
 * @returns {string}
 */
function formatGroupChatName(fileName) {
    // .jsonl 제거
    let name = fileName.replace('.jsonl', '');
    
    // 날짜 패턴 매칭 (2026-01-07@16h48m17s)
    const dateMatch = name.match(/(\d{4}-\d{2}-\d{2})@(\d{2})h(\d{2})m(\d{2})s/);
    if (dateMatch) {
        const [, date, hour, min] = dateMatch;
        return `${date} ${hour}:${min}`;
    }
    
    return name;
}

/**
 * 그룹 채팅 이벤트 바인딩 - 캐릭터 채팅과 동일한 플로우!
 * 순서: 그룹 선택 → 대기 → 로비 닫기 → 채팅 열기
 * @param {HTMLElement} container
 * @param {Object} group
 */
function bindGroupChatEvents(container, group) {
    container.querySelectorAll('.lobby-chat-item').forEach((item, index) => {
        const chatContent = item.querySelector('.chat-content');
        const chatFile = item.dataset.chatFile;
        
        if (!chatContent || !chatFile) return;
        
        // 채팅 열기 - 일반 캐릭터 채팅 열기와 동일한 플로우!
        createTouchClickHandler(chatContent, async () => {
            try {
                console.log('[ChatList] Opening group chat:', { groupId: group.id, chatFile });
                
                const context = api.getContext();
                const chatFileName = chatFile.replace('.jsonl', '');
                
                // 1. 그룹 선택 (캐릭터의 selectCharacterById와 동일한 역할)
                console.log('[ChatList] Selecting group...');
                let groupSelected = false;
                
                // 방법 1: openGroupById 시도
                if (typeof context?.openGroupById === 'function') {
                    try {
                        await context.openGroupById(group.id, false); // 기본 채팅 안 열기
                        await new Promise(resolve => setTimeout(resolve, 300));
                        // 실제로 선택됐는지 확인
                        if (context.groupId === group.id) {
                            groupSelected = true;
                            console.log('[ChatList] Group selected via openGroupById');
                        }
                    } catch (e) {
                        console.warn('[ChatList] openGroupById failed:', e);
                    }
                }
                
                // 방법 2: UI 클릭 (항상 시도)
                if (!groupSelected) {
                    console.log('[ChatList] Trying UI click fallback...');
                    // 정확한 선택자: .group_select[data-grid="${id}"]
                    const groupCard = document.querySelector(`.group_select[data-grid="${group.id}"]`);
                    
                    if (groupCard) {
                        console.log('[ChatList] Found group card:', groupCard);
                        // jQuery 클릭 (SillyTavern 방식)
                        if (window.$) {
                            window.$(groupCard).trigger('click');
                        } else {
                            groupCard.click();
                        }
                        await new Promise(resolve => setTimeout(resolve, 500));
                        groupSelected = true;
                        console.log('[ChatList] Group selected via UI click');
                    } else {
                        console.error('[ChatList] Group card not found. Looking for:', `.group_select[data-grid="${group.id}"]`);
                    }
                }
                
                if (!groupSelected) {
                    console.error('[ChatList] All group selection methods failed');
                    showToast('그룹 선택에 실패했습니다.', 'error');
                    return;
                }
                
                // 2. 그룹 선택 완료 대기 (waitForCharacterSelect와 동일)
                console.log('[ChatList] Waiting for group selection...');
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // 3. 로비 닫기 (closeLobbyKeepState와 동일)
                console.log('[ChatList] Closing lobby...');
                const overlay = document.getElementById('chat-lobby-overlay');
                const lobbyContainer = document.getElementById('chat-lobby-container');
                const fab = document.getElementById('chat-lobby-fab');
                const chatsPanel = document.getElementById('chat-lobby-chats');
                
                if (overlay) overlay.style.display = 'none';
                if (lobbyContainer) lobbyContainer.style.display = 'none';
                if (fab) fab.style.display = 'flex';
                if (chatsPanel) chatsPanel.classList.remove('visible');
                
                store.setCurrentGroup(null);
                store.setCurrentCharacter(null);
                store.setLobbyOpen(false);
                
                // 4. 그룹 채팅 열기 (openCharacterChat과 동일한 역할)
                console.log('[ChatList] Opening chat:', chatFileName);
                
                if (typeof context?.openGroupChat === 'function') {
                    try {
                        await context.openGroupChat(chatFileName);
                        console.log('[ChatList] Group chat opened successfully');
                        return;
                    } catch (err) {
                        console.warn('[ChatList] context.openGroupChat failed:', err);
                    }
                }
                
                // 5. Fallback: group-chats 모듈
                try {
                    const groupChatsModule = await import('../../../../group-chats.js');
                    if (typeof groupChatsModule.openGroupChat === 'function') {
                        await groupChatsModule.openGroupChat(chatFileName);
                        console.log('[ChatList] Group chat opened via module');
                        return;
                    }
                } catch (e) {
                    console.warn('[ChatList] group-chats import failed:', e);
                }
                
                // 6. Fallback: UI 클릭 방식
                console.log('[ChatList] Using UI fallback...');
                const manageChatsBtn = document.getElementById('option_select_chat');
                if (manageChatsBtn) {
                    manageChatsBtn.click();
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    const chatItems = document.querySelectorAll('.select_chat_block');
                    for (const chatItem of chatItems) {
                        const itemFileName = chatItem.getAttribute('file_name') || '';
                        if (itemFileName.includes(chatFileName)) {
                            if (window.$) {
                                window.$(chatItem).trigger('click');
                            } else {
                                chatItem.click();
                            }
                            console.log('[ChatList] Group chat opened via UI click');
                            return;
                        }
                    }
                }
                
                showToast('그룹 채팅을 열지 못했습니다.', 'error');
                
            } catch (error) {
                console.error('[ChatList] Failed to open group chat:', error);
                showToast('그룹 채팅을 열지 못했습니다.', 'error');
            }
        }, { preventDefault: true, stopPropagation: true, debugName: `group-chat-${index}` });
    });
}
