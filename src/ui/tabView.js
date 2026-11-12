// ============================================
// ChatLobby 4.0 - 탭 시스템
// 캐릭터 / 최근 / 보관함 (즐겨찾기+폴더 통합)
// ============================================

import { storage } from '../data/storage.js';
import { store } from '../data/store.js';
import { api } from '../api/sillyTavern.js';
import { cache } from '../data/cache.js';
import { lastChatCache } from '../data/lastChatCache.js';
import { escapeHtml, truncateText } from '../utils/textUtils.js';
import { showToast, showConfirm } from './notifications.js';
import { openChat, openGroupChat } from '../handlers/chatHandlers.js';
import { deactivateBatchMode } from './chatList.js';
import { operationLock } from '../utils/operationLock.js';

import { waitForChatChanged } from '../utils/waitFor.js';
import { listeners } from '../utils/listenerManager.js';
import { remindStore } from '../data/remindStore.js';
import { openRemindViewer } from './remindViewer.js';

// ============================================
// 디버그 로깅
// ============================================

// ⚠️ 릴리즈에서는 false 유지 - 저사양 기기에서 광범위한 console.debug는 무시 못 할 비용
const DEBUG = false;

function log(...args) {
    if (DEBUG) console.debug('[TabView]', ...args);
}

function logError(...args) {
    console.error('[TabView]', ...args);
}

// ============================================
// 상태 관리
// ============================================

const state = {
    currentTab: 'characters',
    recentChats: [],
    cachedRecentChats: [],  // 로비 열기 전 캐싱된 최근 채팅
    libraryMode: 'favorites',
    currentFolderId: null,
    libraryChats: [],
    folders: [],
    activeContextMenu: null,
    libraryBatchMode: false,  // 보관함 배치 모드
};

// 탭별 로딩 가드 (전역 isLoading 대신)
const loading = {
    characters: false,
    recent: false,
    library: false,
};

// 컨텍스트 메뉴 리스너 참조 (정리용)
let contextMenuCloseHandler = null;

// DOM 변화 감지용 Observer
let recentDomObserver = null;

const TABS = [
    { id: 'characters', icon: '👥', name: '캐릭터' },
    { id: 'recent', icon: '🕐', name: '최근' },
    { id: 'library', icon: '📚', name: '보관함' },
];

// ============================================
// 로비 열기 전 최근 채팅 캐싱 (export)
// ============================================

const MAX_CACHE_RETRIES = 5;
const CACHE_RETRY_DELAY = 100;

export async function cacheRecentChatsBeforeOpen() {
    // 기존 캐시 백업 (DOM에서 가져오지 못하면 유지)
    const previousCache = [...state.cachedRecentChats];
    state.cachedRecentChats = [];
    
    // 🔥 현재 채팅 중인 캐릭터 정보 먼저 추가 (채팅 화면에서 로비 열 때 필수)
    const context = api.getContext();
    if (context?.characterId !== undefined && context.characterId >= 0) {
        const char = context.characters?.[context.characterId];
        if (char?.avatar) {
            state.cachedRecentChats.push({
                file: char.chat || '',
                avatar: char.avatar,
                isGroup: false,
                characterName: char.name || char.avatar.replace(/\.[^.]+$/, ''),
                chatName: char.chat || '',
                date: '방금',
                preview: '',
                messageCount: char.chat_size || 0,
                thumbnailSrc: `/characters/${encodeURIComponent(char.avatar)}`,
                type: 'char',
                lastChatTime: Date.now(),
            });
            log('Added current character to cache:', char.avatar);
        }
    }
    
    // ★ 채팅이 열려 있으면 ST 첫 화면(.recentChat)이 그려지지 않으므로 기다려도 안 나타남
    // → 한 번만 확인 (예전엔 로비를 열 때마다 0.5초씩 헛대기)
    const chatOpen = (context?.characterId !== undefined && context.characterId !== null && Number(context.characterId) >= 0)
        || !!context?.groupId;
    const maxRetries = chatOpen ? 1 : MAX_CACHE_RETRIES;

    // DOM이 준비될 때까지 대기 (채팅이 없을 때만 최대 0.5초)
    for (let retry = 0; retry < maxRetries; retry++) {
        const recentChatElements = document.querySelectorAll('.recentChat');
        
        if (recentChatElements.length > 0) {
            log(`Found ${recentChatElements.length} .recentChat elements (retry ${retry})`);
            cacheElements(recentChatElements);
            return;
        }
        
        if (retry + 1 < maxRetries) {
            log(`No .recentChat found, retry ${retry + 1}/${maxRetries} in ${CACHE_RETRY_DELAY}ms`);
            await new Promise(r => setTimeout(r, CACHE_RETRY_DELAY));
        }
    }
    
    // DOM에서 못 가져왔으면 이전 캐시 복원
    if (previousCache.length > 0) {
        log('Restoring previous cache:', previousCache.length);
        state.cachedRecentChats = previousCache;
    } else {
        log('No previous cache, will use lastChatCache fallback');
    }
}

function cacheElements(recentChatElements) {
    // 이미 캐싱된 avatar+file 조합 추적 (중복 방지)
    const existingKeys = new Set(
        state.cachedRecentChats.map(c => `${c.avatar}_${c.file}`)
    );
    
    recentChatElements.forEach((el, idx) => {
        try {
            const file = el.getAttribute('data-file') || '';
            const avatar = el.getAttribute('data-avatar') || '';
            
            // 이미 캐싱된 avatar+file 조합이면 스킵
            if (existingKeys.has(`${avatar}_${file}`)) return;
            
            const groupAttr = el.getAttribute('data-group');
            const isGroup = groupAttr !== null && groupAttr !== '';
            
            const characterName = el.querySelector('.characterName')?.textContent?.trim() || '';
            const chatDate = el.querySelector('.chatDate')?.textContent?.trim() || '';
            const chatMessage = el.querySelector('.chatMessage')?.textContent?.trim() || '';
            
            const counterSmall = el.querySelector('.counterBlock small');
            const messageCount = counterSmall?.textContent?.trim() || '0';
            
            const chatNameSpans = el.querySelectorAll('.chatName span');
            let chatName = file;
            if (chatNameSpans.length >= 2) {
                chatName = chatNameSpans[chatNameSpans.length - 1]?.textContent?.trim() || file;
            }
            
            const thumbnailImg = el.querySelector('.avatar img');
            const thumbnailSrc = thumbnailImg?.getAttribute('src') || '';
            
            if (avatar || file) {
                state.cachedRecentChats.push({
                    file,
                    avatar,
                    isGroup,
                    // ST의 recentChat은 data-avatar에 그룹 이미지, data-group에 그룹 ID를 넣음
                    groupId: isGroup ? groupAttr : null,
                    characterName: characterName || avatar.replace(/\.[^.]+$/, ''),
                    chatName,
                    date: chatDate,
                    preview: chatMessage,
                    messageCount: parseInt(messageCount) || 0,
                    thumbnailSrc,
                    type: isGroup ? 'group' : 'char',
                });
            }
        } catch (e) {
            logError(`Error caching recentChat #${idx}:`, e);
        }
    });
    
    log(`Cached ${state.cachedRecentChats.length} recent chats`);
}

// ============================================
// 탭 바 HTML
// ============================================

export function createTabBarHTML() {
    return `
        <nav id="chat-lobby-tabs" class="lobby-tabs header-tabs">
            ${TABS.map(tab => `
                <button class="lobby-tab ${tab.id === 'characters' ? 'active' : ''}" 
                        data-tab="${tab.id}" 
                        title="${tab.name}">
                    <span class="tab-icon">${tab.icon}</span>
                    <span class="tab-name">${tab.name}</span>
                </button>
            `).join('')}
        </nav>
    `;
}

// ============================================
// 탭 전환
// ============================================

export function switchTab(tabId) {
    if (state.currentTab === tabId) return;
    
    log('Switching tab:', state.currentTab, '->', tabId);
    state.currentTab = tabId;
    
    // 탭 전환 시 배치 모드 자동 해제
    deactivateBatchMode();
    state.libraryBatchMode = false;
    
    document.querySelectorAll('.lobby-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    
    const characterSection = document.getElementById('chat-lobby-characters');
    const personaBar = document.getElementById('chat-lobby-persona-bar');
    const searchSection = document.getElementById('chat-lobby-search');
    const tagBar = document.getElementById('chat-lobby-tag-bar');
    const collapseBtn = document.getElementById('chat-lobby-collapse-btn');
    
    const heroCorner = document.getElementById('chat-lobby-hero');

    if (tabId === 'characters') {
        [characterSection, personaBar, searchSection, tagBar, collapseBtn].forEach(el => {
            if (el) el.style.display = '';
        });
        hideAllTabContents();
        // 최애 코너는 캐릭터 탭에서만 (내용 있을 때)
        if (heroCorner) {
            heroCorner.style.display = heroCorner.dataset.hasContent === 'true' ? '' : 'none';
        }
    } else {
        [characterSection, personaBar, searchSection, tagBar, collapseBtn].forEach(el => {
            if (el) el.style.display = 'none';
        });
        if (heroCorner) heroCorner.style.display = 'none';
        showTabContent(tabId);
    }
    
    closeContextMenu();
}

function hideAllTabContents() {
    document.querySelectorAll('.tab-content').forEach(el => {
        el.style.display = 'none';
    });
}

function showTabContent(tabId) {
    hideAllTabContents();
    
    let container = document.querySelector(`.tab-content[data-tab="${tabId}"]`);
    if (!container) {
        container = createTabContentContainer(tabId);
    }
    
    if (container) {
        container.style.display = 'flex';
        loadTabData(tabId);
    }
}

function createTabContentContainer(tabId) {
    const leftPanel = document.getElementById('chat-lobby-left');
    if (!leftPanel) return null;
    
    const container = document.createElement('div');
    container.className = 'tab-content';
    container.dataset.tab = tabId;
    container.innerHTML = `<div class="tab-loading">⏳ 로딩 중...</div>`;
    leftPanel.appendChild(container);
    
    return container;
}

// ============================================
// 데이터 로드
// ============================================

async function loadTabData(tabId) {
    // characters 탭은 별도 로딩 로직 없음
    if (tabId === 'characters') return;
    
    // 탭별 로딩 가드 (다른 탭 로딩이 최근 탭을 막지 않음)
    if (loading[tabId]) return;
    loading[tabId] = true;
    
    try {
        switch (tabId) {
            case 'recent':
                loadRecentChats();
                renderRecentView();
                break;
            case 'library':
                await loadLibrary();
                renderLibraryView();
                break;
        }
    } catch (e) {
        logError(`Failed to load ${tabId}:`, e);
        showToast('데이터 로드 실패', 'error');
    } finally {
        loading[tabId] = false;
    }
}

// ============================================
// 최근 채팅 뷰
// ============================================

// 🔥 export 추가 - 로비 열 때 직접 호출 가능
export function loadRecentChats() {
    // 캐싱된 데이터 사용 (없으면 새로 가져오기)
    if (state.cachedRecentChats.length > 0) {
        state.recentChats = state.cachedRecentChats;
        log(`Using ${state.recentChats.length} cached recent chats`);
    } else {
        // 백업: 새로 DOM에서 가져오기 시도
        log('No cached chats, trying to re-cache from DOM');
        const recentChatElements = document.querySelectorAll('.recentChat');
        if (recentChatElements.length > 0) {
            cacheElements(recentChatElements);
            state.recentChats = state.cachedRecentChats;
            log(`Re-cached ${state.recentChats.length} recent chats from DOM`);
        } else {
            log('No .recentChat elements, using lastChatCache fallback');
            state.recentChats = getRecentFromCache();
        }
    }
}

function getRecentFromCache() {
    const recentFromCache = [];
    const context = api.getContext();
    const characters = context?.characters || [];
    const groups = context?.groups || [];
    
    // 캐릭터별 최근 채팅
    lastChatCache.lastChatTimes.forEach((entry, avatar) => {
        const time = typeof entry === 'number' ? entry : entry?.time || 0;
        const char = characters.find(c => c.avatar === avatar);
        
        if (char) {
            // 시간을 날짜 문자열로 변환
            let dateStr = '';
            if (time > 0) {
                const date = new Date(time);
                const now = new Date();
                const diffMs = now - date;
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                
                if (diffDays === 0) {
                    // 오늘: 시간만 표시
                    dateStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
                } else if (diffDays === 1) {
                    dateStr = '어제';
                } else if (diffDays < 7) {
                    dateStr = `${diffDays}일 전`;
                } else {
                    dateStr = date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
                }
            }
            
            recentFromCache.push({
                avatar,
                characterName: char.name || avatar.replace(/\.[^.]+$/, ''),
                chatName: char.chat || '',
                date: dateStr,
                preview: '',
                messageCount: char.chat_size || 0,
                lastChatTime: time,
                type: 'char',
                isGroup: false,
                file: char.chat || '',
                thumbnailSrc: `/characters/${encodeURIComponent(avatar)}`,
            });
        }
    });
    
    // 그룹도 추가 (date_last_chat이 있는 경우)
    groups.forEach(group => {
        if (group.date_last_chat) {
            const time = new Date(group.date_last_chat).getTime();
            if (time > 0) {
                recentFromCache.push({
                    avatar: group.id,
                    characterName: group.name || group.id,
                    chatName: group.chat_id || '',
                    date: '',
                    preview: '',
                    messageCount: 0,
                    lastChatTime: time,
                    type: 'group',
                    isGroup: true,
                    file: group.chat_id || '',
                    thumbnailSrc: '',
                });
            }
        }
    });
    
    recentFromCache.sort((a, b) => b.lastChatTime - a.lastChatTime);
    return recentFromCache.slice(0, 30);
}

function renderRecentView() {
    const container = document.querySelector('.tab-content[data-tab="recent"]');
    if (!container) return;
    
    if (state.recentChats.length === 0) {
        container.innerHTML = `
            <div class="tab-empty">
                <span class="empty-icon">🕐</span>
                <p>최근 채팅 기록이 없습니다</p>
                <small>캐릭터와 대화를 시작해보세요</small>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="tab-header">
            <h3>🕐 최근 채팅 (${state.recentChats.length})</h3>
        </div>
        <div class="tab-chat-list" id="tab-recent-list"></div>
    `;
    
    const listEl = container.querySelector('#tab-recent-list');
    state.recentChats.forEach((chat, idx) => {
        const item = createChatItem(chat, idx, 'recent');
        listEl.appendChild(item);
    });
}

// ============================================
// 보관함 뷰 (즐겨찾기 + 폴더)
// ============================================

async function loadLibrary() {
    log('Loading library...');
    
    const data = storage.load();
    const context = api.getContext();
    const characters = context?.characters || [];
    const groups = context?.groups || [];
    
    // 폴더 로드 - favorites, uncategorized 폴더 제외!
    state.folders = [...(data.folders || [])]
        .filter(f => f.id !== 'favorites' && f.id !== 'uncategorized')
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    
    // 각 폴더의 채팅 수 계산
    const assignments = data.chatAssignments || {};
    state.folders = state.folders.map(folder => {
        let count = 0;
        for (const folderId of Object.values(assignments)) {
            if (folderId === folder.id) count++;
        }
        return { ...folder, chatCount: count };
    });
    
    log(`Loaded ${state.folders.length} folders (excluding favorites)`);
    
    // 채팅 수집
    state.libraryChats = [];
    
    // 수집할 키 목록
    let keysToLoad = [];
    
    if (state.libraryMode === 'reminds') {
        // 리마인드 모드는 remindStore에서 직접 렌더 (채팅 API 불필요)
        return;
    }

    if (state.libraryMode === 'favorites') {
        keysToLoad = data.favorites || [];
        log(`Loading ${keysToLoad.length} favorites`);
    } else if (state.currentFolderId) {
        log(`Loading chats for folder: ${state.currentFolderId}`);
        for (const [key, folderId] of Object.entries(assignments)) {
            if (folderId === state.currentFolderId) {
                keysToLoad.push(key);
            }
        }
    }
    
    // 캐릭터별로 그룹화하여 API 호출 최소화
    const chatsByAvatar = new Map();
    for (const key of keysToLoad) {
        const parsed = parseKeyBasic(key);
        log(`parseKeyBasic("${key}") =>`, parsed);
        if (parsed) {
            if (!chatsByAvatar.has(parsed.avatar)) {
                chatsByAvatar.set(parsed.avatar, []);
            }
            chatsByAvatar.get(parsed.avatar).push({ key, fileName: parsed.fileName });
        }
    }
    log(`chatsByAvatar: ${chatsByAvatar.size} avatars`);
    
    // API로 채팅 정보 가져오기 (병렬 처리)
    await Promise.allSettled(
        [...chatsByAvatar.entries()].map(async ([avatar, chats]) => {
            try {
                const apiChats = await api.fetchChatsForCharacter(avatar);

                const entityInfo = characters.find(c => c.avatar === avatar);
                const name = entityInfo?.name || avatar.replace(/\.[^.]+$/, '');
                
                for (const { key, fileName } of chats) {
                    // API 응답에서 해당 채팅 찾기 (키는 .jsonl 없음, API는 .jsonl 있음)
                    const apiChat = apiChats.find(c => {
                        const apiName = c.file_name || '';
                        return apiName === fileName || 
                            apiName === `${fileName}.jsonl` ||
                            apiName.replace(/\.jsonl$/i, '') === fileName;
                    });

                    
                    const cachedTime = lastChatCache.lastChatTimes.get(avatar);
                    const lastChatTime = typeof cachedTime === 'number' ? cachedTime : cachedTime?.time || 0;
                    
                    state.libraryChats.push({
                        key,
                        avatar,
                        fileName,
                        file: fileName,
                        characterName: name,
                        name,
                        type: 'char',
                        isGroup: false,
                        lastChatTime,
                        preview: apiChat?.mes || apiChat?.preview || '',
                        messageCount: apiChat?.chat_items || 0,
                        isFavorite: storage.isFavorite(avatar, fileName),
                        folderId: storage.getChatFolder(avatar, fileName),
                    });
                }
            } catch (e) {
                logError(`Failed to fetch chats for ${avatar}:`, e);
            }
        })
    );
    
    state.libraryChats.sort((a, b) => b.lastChatTime - a.lastChatTime);
    log(`Loaded ${state.libraryChats.length} library chats`);
}

// 키에서 avatar와 fileName만 추출 (확장자 기반 파싱 - _ 포함 아바타명 지원)
function parseKeyBasic(key) {
    // getChatKey 형식: "avatar::fileName" (:: 구분자)
    const sepIdx = key.indexOf('::');
    if (sepIdx === -1) return null;
    
    const avatar = key.substring(0, sepIdx);
    const fileName = key.substring(sepIdx + 2);
    
    if (!avatar || !fileName) return null;
    
    // 그룹은 일단 제외 (API 다름)
    if (avatar.startsWith('group:')) return null;
    
    return { avatar, fileName };
}

function renderLibraryView() {
    const container = document.querySelector('.tab-content[data-tab="library"]');
    if (!container) return;
    
    if (state.currentFolderId) {
        renderFolderDetail(container);
        return;
    }
    
    container.innerHTML = `
        <div class="library-filter-bar">
            <button class="library-filter-btn ${state.libraryMode === 'favorites' ? 'active' : ''}"
                    data-mode="favorites">
                ⭐ 즐겨찾기
            </button>
            <button class="library-filter-btn ${state.libraryMode === 'folders' ? 'active' : ''}"
                    data-mode="folders">
                📁 폴더
            </button>
            <button class="library-filter-btn ${state.libraryMode === 'reminds' ? 'active' : ''}"
                    data-mode="reminds">
                🔖 리마인드
            </button>
            <button class="library-filter-btn folder-manage-btn" id="tab-folder-manage-btn" data-action="open-folder-modal" title="폴더 관리">
                📁
            </button>
            ${state.libraryMode === 'favorites' && state.libraryChats.length > 0 ? `
                <button class="library-filter-btn library-batch-btn ${state.libraryBatchMode ? 'active' : ''}" id="library-batch-toggle" title="배치 모드">☑️</button>
            ` : ''}
        </div>
        ${state.libraryBatchMode ? `
            <div class="library-batch-toolbar">
                <span class="library-batch-count">0개 선택</span>
                <button class="library-batch-btn-action" id="library-batch-select-all">☑ 전체</button>
                <button class="library-batch-btn-action library-batch-delete" id="library-batch-delete">🗑️ 삭제</button>
                <button class="library-batch-btn-action library-batch-move" id="library-batch-move">📁 이동</button>
                <button class="library-batch-btn-action library-batch-cancel" id="library-batch-cancel">취소</button>
            </div>
        ` : ''}
        <div class="library-content" id="library-content">
            ${state.libraryMode === 'reminds' ? renderRemindsContent()
                : state.libraryMode === 'favorites' ? renderFavoritesContent()
                : renderFoldersContent()}
        </div>
    `;
    
    // 폴더 관리 버튼 제외하고 모드 전환 버튼만 처리
    container.querySelectorAll('.library-filter-btn[data-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            if (mode && state.libraryMode !== mode) {
                state.libraryMode = mode;
                state.currentFolderId = null;
                state.libraryBatchMode = false;
                loadLibrary().then(() => renderLibraryView());
            }
        });
    });
    
    container.querySelectorAll('.folder-card').forEach(card => {
        card.addEventListener('click', () => {
            state.currentFolderId = card.dataset.folderId;
            loadLibrary().then(() => renderLibraryView());
        });
    });
    
    // 폴더 관리 버튼
    container.querySelector('#tab-folder-manage-btn')?.addEventListener('click', () => {
        const event = new CustomEvent('lobby:open-folder-modal');
        document.dispatchEvent(event);
    });
    
    // 배치 모드 토글
    container.querySelector('#library-batch-toggle')?.addEventListener('click', () => {
        state.libraryBatchMode = !state.libraryBatchMode;
        renderLibraryView();
    });
    
    // 배치 모드 버튼들
    container.querySelector('#library-batch-select-all')?.addEventListener('click', libraryBatchSelectAll);
    container.querySelector('#library-batch-delete')?.addEventListener('click', libraryBatchDelete);
    container.querySelector('#library-batch-move')?.addEventListener('click', () => libraryBatchShowMoveMenu(container.querySelector('#library-batch-move')));
    container.querySelector('#library-batch-cancel')?.addEventListener('click', () => {
        state.libraryBatchMode = false;
        renderLibraryView();
    });
    
    if (state.libraryMode === 'reminds') {
        bindRemindEvents(container);
    } else {
        bindLibraryChatEvents(container);
    }
}

// ============================================
// 리마인드 모드 (좋았던 채팅/구간 모아보기)
// ============================================

function renderRemindsContent() {
    const reminds = remindStore.getAll();

    if (reminds.length === 0) {
        return `
            <div class="tab-empty">
                <span class="empty-icon">🔖</span>
                <p>저장된 리마인드가 없습니다</p>
                <small>채팅 목록의 ⋮ 메뉴에서 "리마인드 추가"로<br>좋았던 구간을 저장해보세요</small>
            </div>
        `;
    }

    return `
        <div class="remind-list">
            ${reminds.map(r => {
                const rangeText = r.start !== null
                    ? `#${r.start}~#${r.end}`
                    : '전체';
                const date = new Date(r.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
                return `
                <div class="remind-item" data-remind-id="${escapeHtml(r.id)}">
                    <div class="remind-item-avatar">
                        <img src="/characters/${encodeURIComponent(r.avatar)}" alt="" loading="lazy"
                             onerror="this.parentElement.innerHTML='🔖'">
                    </div>
                    <div class="remind-item-info">
                        <div class="remind-item-title">
                            ${escapeHtml(r.charName)}
                            <span class="remind-item-range">${escapeHtml(rangeText)}</span>
                        </div>
                        <div class="remind-item-file">${escapeHtml(r.fileName)}</div>
                        ${r.note ? `<div class="remind-item-note">${escapeHtml(r.note)}</div>` : ''}
                    </div>
                    <div class="remind-item-side">
                        <span class="remind-item-date">${date}</span>
                        <button class="remind-item-delete" title="삭제">🗑️</button>
                    </div>
                </div>`;
            }).join('')}
        </div>
    `;
}

/**
 * 리마인드 목록 이벤트 바인딩 (클릭=뷰어, 삭제)
 * @param {HTMLElement} container
 */
function bindRemindEvents(container) {
    container.querySelectorAll('.remind-item').forEach(item => {
        const id = item.dataset.remindId;

        item.querySelector('.remind-item-delete')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            const confirmed = await showConfirm('이 리마인드를 삭제하시겠습니까?\n(채팅 자체는 삭제되지 않습니다)');
            if (confirmed) {
                remindStore.remove(id);
                showToast('리마인드 삭제됨', 'success');
                renderLibraryView();
            }
        });

        item.addEventListener('click', () => {
            openRemindViewer(id);
        });
    });
}

function renderFavoritesContent() {
    if (state.libraryChats.length === 0) {
        return `
            <div class="tab-empty">
                <span class="empty-icon">⭐</span>
                <p>즐겨찾기한 채팅이 없습니다</p>
                <small>채팅 목록에서 ☆를 눌러 추가하세요</small>
            </div>
        `;
    }
    
    return `
        <div class="tab-chat-list">
            ${state.libraryChats.map((chat, idx) => createChatItemHTML(chat, idx, 'library')).join('')}
        </div>
    `;
}

function renderFoldersContent() {
    return `
        ${state.folders.length === 0 ? `
            <div class="tab-empty">
                <span class="empty-icon">📁</span>
                <p>폴더가 없습니다</p>
                <small>� 버튼을 눌러 폴더를 추가하세요</small>
            </div>
        ` : `
            <div class="folder-list">
                ${state.folders.map(folder => `
                    <div class="folder-card" data-folder-id="${folder.id}">
                        <span class="folder-icon">📁</span>
                        <div class="folder-info">
                            <span class="folder-name">${escapeHtml(folder.name)}</span>
                            <span class="folder-count">${folder.chatCount}개 채팅</span>
                        </div>
                        <span class="folder-arrow">›</span>
                    </div>
                `).join('')}
            </div>
        `}
    `;
}

function renderFolderDetail(container) {
    const folder = state.folders.find(f => f.id === state.currentFolderId);
    const folderName = folder?.name || '폴더';
    
    container.innerHTML = `
        <div class="tab-header">
            <button class="tab-back-btn">← 뒤로</button>
            <h3>📁 ${escapeHtml(folderName)} (${state.libraryChats.length})</h3>
            <button class="library-filter-btn folder-manage-btn" id="tab-folder-manage-btn-detail" title="폴더 관리">📁</button>
            ${state.libraryChats.length > 0 ? `
                <button class="library-filter-btn library-batch-btn ${state.libraryBatchMode ? 'active' : ''}" id="library-batch-toggle-detail" title="배치 모드">☑️</button>
            ` : ''}
        </div>
        ${state.libraryBatchMode ? `
            <div class="library-batch-toolbar">
                <span class="library-batch-count">0개 선택</span>
                <button class="library-batch-btn-action" id="library-batch-select-all">☑ 전체</button>
                <button class="library-batch-btn-action library-batch-delete" id="library-batch-delete">🗑️ 삭제</button>
                <button class="library-batch-btn-action library-batch-move" id="library-batch-move">📁 이동</button>
                <button class="library-batch-btn-action library-batch-cancel" id="library-batch-cancel">취소</button>
            </div>
        ` : ''}
        <div class="tab-chat-list">
            ${state.libraryChats.length > 0 
                ? state.libraryChats.map((chat, idx) => createChatItemHTML(chat, idx, 'library')).join('')
                : '<div class="tab-empty-small">이 폴더에 채팅이 없습니다</div>'
            }
        </div>
    `;
    
    container.querySelector('.tab-back-btn')?.addEventListener('click', () => {
        state.currentFolderId = null;
        state.libraryMode = 'folders';
        loadLibrary().then(() => renderLibraryView());
    });
    
    // 폴더 관리 버튼
    container.querySelector('#tab-folder-manage-btn-detail')?.addEventListener('click', () => {
        const event = new CustomEvent('lobby:open-folder-modal');
        document.dispatchEvent(event);
    });
    
    // 배치 모드 토글
    container.querySelector('#library-batch-toggle-detail')?.addEventListener('click', () => {
        state.libraryBatchMode = !state.libraryBatchMode;
        renderLibraryView();
    });
    
    // 배치 모드 버튼들
    container.querySelector('#library-batch-select-all')?.addEventListener('click', libraryBatchSelectAll);
    container.querySelector('#library-batch-delete')?.addEventListener('click', libraryBatchDelete);
    container.querySelector('#library-batch-move')?.addEventListener('click', () => libraryBatchShowMoveMenu(container.querySelector('#library-batch-move')));
    container.querySelector('#library-batch-cancel')?.addEventListener('click', () => {
        state.libraryBatchMode = false;
        renderLibraryView();
    });
    
    bindLibraryChatEvents(container);
}

// ============================================
// 채팅 아이템 생성 (기존 UI와 동일)
// ============================================

function createChatItem(chat, idx, source) {
    const isFav = storage.isFavorite(chat.avatar, chat.file);
    const folderId = storage.getChatFolder(chat.avatar, chat.file);
    const data = storage.load();
    const folder = data.folders?.find(f => f.id === folderId);
    const folderName = (folder && folderId !== 'uncategorized') ? folder.name : '';
    
    const item = document.createElement('div');
    item.className = `lobby-chat-item ${isFav ? 'is-favorite' : ''}`;
    item.dataset.avatar = chat.avatar;
    item.dataset.file = chat.file || '';
    item.dataset.idx = idx;
    item.dataset.source = source;
    
    const displayName = chat.chatName || chat.file?.replace('.jsonl', '') || '';
    const charName = chat.characterName || chat.avatar?.replace(/\.[^.]+$/, '') || '';
    
    // 아바타 이미지 URL 생성
    const avatarSrc = chat.thumbnailSrc || (chat.avatar ? `/characters/${chat.avatar}` : '');
    const avatarHTML = avatarSrc 
        ? `<div class="chat-avatar-lg"><img src="${escapeHtml(avatarSrc)}" alt="" onerror="this.parentElement.innerHTML='👤'"></div>`
        : `<div class="chat-avatar-lg">👤</div>`;
    
    // 한 줄로: 캐릭터명 - 채팅명
    const titleLine = displayName ? `${escapeHtml(charName)} - ${escapeHtml(displayName)}` : escapeHtml(charName);
    
    item.innerHTML = `
        <button class="chat-fav-btn" title="즐겨찾기">${isFav ? '★' : '☆'}</button>
        ${avatarHTML}
        <div class="chat-content">
            <div class="chat-title-line">${titleLine}</div>
            ${chat.preview ? `<div class="chat-preview">${escapeHtml(truncateText(chat.preview, 60))}</div>` : ''}
            <div class="chat-meta">
                ${chat.messageCount > 0 ? `<span>💬 ${chat.messageCount}</span>` : ''}
                ${chat.date ? `<span>${escapeHtml(chat.date)}</span>` : ''}
                ${folderName ? `<span class="chat-folder-tag">${escapeHtml(folderName)}</span>` : ''}
            </div>
        </div>
        <div class="chat-actions">
            <button class="chat-folder-btn" title="폴더 이동">⋮</button>
            <button class="chat-delete-btn" title="삭제">🗑️</button>
        </div>
    `;
    
    // 채팅 열기
    item.querySelector('.chat-content').addEventListener('click', () => {
        openRecentChat(chat, idx);
    });
    
    // 즐겨찾기 토글
    item.querySelector('.chat-fav-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const newState = storage.toggleFavorite(chat.avatar, chat.file);
        item.classList.toggle('is-favorite', newState);
        item.querySelector('.chat-fav-btn').textContent = newState ? '★' : '☆';
        showToast(newState ? '⭐ 즐겨찾기 추가' : '즐겨찾기 해제', 'success');
    });
    
    // 삭제 버튼
    item.querySelector('.chat-delete-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        await handleDeleteChat(chat.avatar, chat.file, item);
    });
    
    // 폴더 이동 버튼
    item.querySelector('.chat-folder-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        showFolderMenu(e.target, chat.avatar, chat.file);
    });
    
    return item;
}

function createChatItemHTML(chat, idx, source) {
    const fileKey = chat.fileName || chat.file;
    const isFav = chat.isFavorite ?? storage.isFavorite(chat.avatar, fileKey);
    const folderId = chat.folderId ?? storage.getChatFolder(chat.avatar, fileKey);
    const data = storage.load();
    const folder = data.folders?.find(f => f.id === folderId);
    const folderName = (folder && folderId !== 'uncategorized') ? folder.name : '';
    
    const displayName = fileKey?.replace('.jsonl', '') || chat.chatName || '';
    const charName = chat.characterName || chat.name || chat.avatar?.replace(/\.[^.]+$/, '') || '';
    const timeAgo = chat.lastChatTime ? getTimeAgo(chat.lastChatTime) : '';
    const preview = chat.preview || chat.lastMessage || '';
    
    // 아바타 이미지 URL 생성
    const avatarSrc = chat.thumbnailSrc || (chat.avatar ? `/characters/${chat.avatar}` : '');
    const avatarHTML = avatarSrc 
        ? `<div class="chat-avatar-lg"><img src="${escapeHtml(avatarSrc)}" alt="" onerror="this.parentElement.innerHTML='👤'"></div>`
        : `<div class="chat-avatar-lg">👤</div>`;
    
    // 한 줄로: 캐릭터명 - 채팅명
    const titleLine = displayName ? `${escapeHtml(charName)} - ${escapeHtml(displayName)}` : escapeHtml(charName);
    
    // data-full-preview는 따옴표 충돌 방지를 위해 Base64 인코딩 (모던 방식)
    const encodedPreview = preview ? safeBase64Encode(preview) : '';
    
    return `
        <div class="lobby-chat-item ${isFav ? 'is-favorite' : ''}" 
             data-avatar="${escapeHtml(chat.avatar)}"
             data-file="${escapeHtml(fileKey || '')}"
             data-key="${escapeHtml(chat.key || '')}"
             data-idx="${idx}"
             data-source="${source}"
             data-full-preview-encoded="${encodedPreview}">
            ${state.libraryBatchMode ? `<label class="chat-checkbox" style="display:flex;"><input type="checkbox" class="library-select-cb"></label>` : ''}
            <button class="chat-fav-btn" title="즐겨찾기">${isFav ? '★' : '☆'}</button>
            ${avatarHTML}
            <div class="chat-content">
                <div class="chat-title-line">${titleLine}</div>
                ${preview ? `<div class="chat-preview">${escapeHtml(truncateText(preview, 60))}</div>` : ''}
                <div class="chat-meta">
                    ${timeAgo ? `<span>${timeAgo}</span>` : ''}
                    ${folderName ? `<span class="chat-folder-tag">${escapeHtml(folderName)}</span>` : ''}
                </div>
            </div>
            <div class="chat-actions">
                <button class="chat-folder-btn" title="폴더 이동">⋮</button>
                <button class="chat-delete-btn" title="삭제">🗑️</button>
            </div>
        </div>
    `;
}

function bindLibraryChatEvents(container) {
    container.querySelectorAll('.lobby-chat-item').forEach(item => {
        const avatar = item.dataset.avatar;
        const fileName = item.dataset.file;
        const idx = parseInt(item.dataset.idx) || 0;
        
        // 배치 모드: 체크박스 변경 시 카운트 업데이트
        item.querySelector('.library-select-cb')?.addEventListener('change', () => {
            updateLibraryBatchCount();
        });
        
        // 채팅 열기 (배치 모드에서는 체크박스 토글)
        item.querySelector('.chat-content')?.addEventListener('click', () => {
            if (state.libraryBatchMode) {
                const cb = item.querySelector('.library-select-cb');
                if (cb) { cb.checked = !cb.checked; updateLibraryBatchCount(); }
                return;
            }
            log('Opening library chat:', avatar, fileName);
            openLibraryChat(avatar, fileName);
        });
        
        // 즐겨찾기 토글
        item.querySelector('.chat-fav-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const newState = storage.toggleFavorite(avatar, fileName);
            item.classList.toggle('is-favorite', newState);
            item.querySelector('.chat-fav-btn').textContent = newState ? '★' : '☆';
            showToast(newState ? '⭐ 즐겨찾기 추가' : '즐겨찾기 해제', 'success');
            
            // 즐겨찾기 모드에서 해제 시 제거
            if (state.libraryMode === 'favorites' && !newState) {
                item.remove();
            }
        });
        
        // 삭제 버튼
        item.querySelector('.chat-delete-btn')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            await handleDeleteChat(avatar, fileName, item);
        });
        
        // 폴더 이동 버튼
        item.querySelector('.chat-folder-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            showFolderMenu(e.target, avatar, fileName);
        });
    });
}

// ============================================
// 보관함 배치 모드
// ============================================

function updateLibraryBatchCount() {
    const count = document.querySelectorAll('.library-select-cb:checked').length;
    const countEl = document.querySelector('.library-batch-count');
    if (countEl) countEl.textContent = `${count}개 선택`;
}

function libraryBatchSelectAll() {
    const checkboxes = document.querySelectorAll('.library-select-cb');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => { cb.checked = !allChecked; });
    updateLibraryBatchCount();
}

async function libraryBatchDelete() {
    const checked = document.querySelectorAll('.library-select-cb:checked');
    if (checked.length === 0) {
        showToast('삭제할 채팅을 선택하세요.', 'warning');
        return;
    }
    
    const confirmed = await showConfirm(
        `선택한 ${checked.length}개 채팅을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`,
        '배치 삭제',
        true
    );
    if (!confirmed) return;
    
    // 순차 삭제는 개수에 비례해 오래 걸림 → 개수 기반 타임아웃 (최대 2분)
    const token = operationLock.acquire('libraryBatchDelete', Math.min(120000, 10000 + checked.length * 1500));
    if (!token) {
        showToast('다른 작업이 진행 중입니다.', 'warning');
        return;
    }

    try {
        // 현재 열린 채팅 확인
        const context = api.getContext();
        const currentChatFile = context?.characters?.[context?.characterId]?.chat;
        
        const items = [];
        checked.forEach(cb => {
            const item = cb.closest('.lobby-chat-item');
            if (item) {
                items.push({
                    avatar: item.dataset.avatar,
                    fileName: item.dataset.file,
                    element: item,
                });
            }
        });
        
        let successCount = 0;
        let skipCount = 0;
        
        for (const { avatar, fileName, element } of items) {
            const fileNameWithoutExt = fileName.replace('.jsonl', '');
            if (currentChatFile === fileNameWithoutExt) {
                skipCount++;
                continue;
            }
            
            try {
                const success = await api.deleteChat(fileName, avatar);
                if (success) {
                    // 로컬 데이터 정리
                    const data = storage.load();
                    const key = storage.getChatKey(avatar, fileName);
                    delete data.chatAssignments[key];
                    const favIndex = data.favorites.indexOf(key);
                    if (favIndex > -1) data.favorites.splice(favIndex, 1);
                    storage.save(data);
                    cache.invalidate('chats', avatar);
                    successCount++;
                }
            } catch (e) {
                logError('Batch delete failed for:', fileName, e);
            }
        }
        
        let msg = `${successCount}개 채팅 삭제 완료`;
        if (skipCount > 0) msg += ` (${skipCount}개 스킵: 현재 열린 채팅)`;
        showToast(msg, successCount > 0 ? 'success' : 'warning');
        
        state.libraryBatchMode = false;
        await loadLibrary();
        renderLibraryView();
    } finally {
        operationLock.release(token);
    }
}

function libraryBatchShowMoveMenu(targetBtn) {
    if (!targetBtn) return;
    closeContextMenu();
    
    const checked = document.querySelectorAll('.library-select-cb:checked');
    if (checked.length === 0) {
        showToast('이동할 채팅을 선택하세요.', 'warning');
        return;
    }
    
    const data = storage.load();
    const folders = (data.folders || []).filter(f => f.id !== 'favorites' && f.id !== 'uncategorized');
    
    if (folders.length === 0) {
        showToast('이동할 폴더가 없습니다. 폴더를 먼저 만들어주세요.', 'warning');
        return;
    }
    
    const menu = document.createElement('div');
    menu.className = 'folder-context-menu';
    menu.innerHTML = `
        <div class="folder-menu-title">${checked.length}개 채팅 이동</div>
        <div class="folder-menu-item" data-folder-id="">
            📤 폴더에서 제거
        </div>
        ${folders.map(f => `
            <div class="folder-menu-item" data-folder-id="${f.id}">
                📁 ${escapeHtml(f.name)}
            </div>
        `).join('')}
    `;
    
    const rect = targetBtn.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.zIndex = 'var(--z-modal, 60000)';
    
    document.body.appendChild(menu);
    
    const menuRect = menu.getBoundingClientRect();
    if (rect.bottom + menuRect.height > window.innerHeight - 10) {
        menu.style.top = `${Math.max(10, rect.top - menuRect.height - 4)}px`;
    } else {
        menu.style.top = `${rect.bottom + 4}px`;
    }
    if (rect.right > window.innerWidth - menuRect.width - 10) {
        menu.style.left = `${Math.max(10, rect.left - menuRect.width + rect.width)}px`;
    } else {
        menu.style.left = `${rect.left}px`;
    }
    
    state.activeContextMenu = menu;
    
    menu.querySelectorAll('.folder-menu-item').forEach(item => {
        item.addEventListener('click', async () => {
            const folderId = item.dataset.folderId;
            const checkedNow = document.querySelectorAll('.library-select-cb:checked');
            
            checkedNow.forEach(cb => {
                const chatItem = cb.closest('.lobby-chat-item');
                if (chatItem) {
                    const avatar = chatItem.dataset.avatar;
                    const fileName = chatItem.dataset.file;
                    if (folderId) {
                        storage.setChatFolder(avatar, fileName, folderId);
                    } else {
                        storage.setChatFolder(avatar, fileName, null);
                    }
                }
            });
            
            const folder = folders.find(f => f.id === folderId);
            const msg = folderId
                ? `${checkedNow.length}개 채팅이 📁 ${folder?.name || '폴더'}로 이동`
                : `${checkedNow.length}개 채팅이 폴더에서 제거됨`;
            showToast(msg, 'success');
            
            closeContextMenu();
            state.libraryBatchMode = false;
            await loadLibrary();
            renderLibraryView();
        });
    });
    
    setTimeout(() => {
        contextMenuCloseHandler = function(e) {
            if (!menu.contains(e.target)) closeContextMenu();
        };
        listeners.add('tabContextMenu', document, 'click', contextMenuCloseHandler);
    }, 10);
}

// ============================================
// 채팅 삭제
// ============================================

async function handleDeleteChat(avatar, fileName, itemElement) {
    // 현재 열린 채팅인지 확인
    const context = api.getContext();
    const currentChatFile = context?.characters?.[context?.characterId]?.chat;
    const fileNameWithoutExt = fileName.replace('.jsonl', '');
    
    if (currentChatFile === fileNameWithoutExt) {
        showToast('현재 열린 채팅은 삭제할 수 없습니다.', 'warning');
        return;
    }
    
    // 삭제 확인
    const displayName = fileName.replace('.jsonl', '');
    const confirmed = await showConfirm(
        `"${displayName}" 채팅을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`,
        '채팅 삭제',
        true
    );
    
    if (!confirmed) return;
    
    // 확인 후 락 획득
    const token = operationLock.acquire('handleDeleteChat', 10000);
    if (!token) {
        showToast('다른 작업이 진행 중입니다.', 'warning');
        return;
    }

    try {
        const success = await api.deleteChat(fileName, avatar);
        
        if (success) {
            // 로컬 데이터 정리
            const data = storage.load();
            const key = storage.getChatKey(avatar, fileName);
            delete data.chatAssignments[key];
            const favIndex = data.favorites.indexOf(key);
            if (favIndex > -1) {
                data.favorites.splice(favIndex, 1);
            }
            storage.save(data);
            
            // 캐시 무효화
            cache.invalidate('chats', avatar);
            
            // UI에서 제거
            if (itemElement) {
                itemElement.style.transition = 'opacity 0.2s, transform 0.2s';
                itemElement.style.opacity = '0';
                itemElement.style.transform = 'translateX(20px)';
                setTimeout(() => {
                    itemElement.remove();
                }, 200);
            }
            
            showToast('채팅이 삭제되었습니다.', 'success');
        } else {
            showToast('채팅 삭제에 실패했습니다.', 'error');
        }
    } catch (e) {
        logError('Delete chat failed:', e);
        showToast('채팅 삭제 중 오류가 발생했습니다.', 'error');
    } finally {
        operationLock.release(token);
    }
}

// ============================================
// 채팅 열기
// ============================================

export async function openRecentChat(chat, idx) {
    // waitForChatChanged(8000) + 마진 → 12초
    const token = operationLock.acquire('openRecentChat', 12000);
    if (!token) return;

    try {
        log('Opening recent chat:', chat.file, chat.avatar);

        // index.js의 완전한 closeLobby 호출
        window.dispatchEvent(new CustomEvent('chatlobby:close'));

        // ★ 캐릭터 채팅은 ST 첫 화면의 최근 채팅을 대신 클릭하지 않고 openChat으로 직접 연다.
        // ST 자체 핸들러(openRecentCharacterChat)는 "캐릭터 선택(마지막 채팅 로드) → 대상 채팅 열기"라
        // 구조적으로 두 번 로드한다. openChat은 대상 채팅 하나만 로드한다.
        // 그룹 채팅도 같은 이유로 직접 연다 (data-group = 그룹 ID)
        if (chat.isGroup && chat.groupId && chat.file) {
            operationLock.release(token);
            await openGroupChat(chat.groupId, chat.file);
            return;
        }

        if (!chat.isGroup && chat.avatar && chat.file) {
            const charIndex = (api.getContext()?.characters || []).findIndex(c => c.avatar === chat.avatar);
            if (charIndex !== -1) {
                // openChat이 자체 락을 쓰므로 현재 락은 먼저 해제
                operationLock.release(token);
                await openChat({
                    fileName: chat.file,
                    charAvatar: chat.avatar,
                    charIndex: String(charIndex),
                });
                return;
            }
        }

        // DOM이 다시 보이도록 대기 (rAF 2회 체이닝이 더 안정적)
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        // selector로 원본 DOM 요소 찾기 (isGroup 처리 포함)
        const selector = chat.isGroup
            ? `.recentChat[data-group="${chat.groupId || chat.avatar}"]`
            : `.recentChat[data-file="${chat.file}"][data-avatar="${chat.avatar}"]`;
        const recentEl = document.querySelector(selector);

        if (recentEl) {
            log('Found element via selector, clicking');
            // ⚠️ 고정 딜레이 대신 이벤트 기반 대기 - 느린 기기에서 락 조기 해제 방지
            const chatChangedPromise = waitForChatChanged(8000);
            recentEl.click();
            await chatChangedPromise;
        } else {
            // 최후 수단: openChat 핸들러로 직접 열기 (캐릭터 채팅인 경우)
            if (!chat.isGroup && chat.avatar && chat.file) {
                log('Element not found, opening via openChat handler');
                const context = api.getContext();
                const charIndex = (context?.characters || []).findIndex(c => c.avatar === chat.avatar);
                if (charIndex !== -1) {
                    // openChat이 자체 락을 쓰므로 현재 락은 먼저 해제
                    operationLock.release(token);
                    await openChat({
                        fileName: chat.file,
                        charAvatar: chat.avatar,
                        charIndex: String(charIndex),
                    });
                    return;
                }
            }
            // 그래도 안 되면 캐릭터 선택 이벤트로 폴백
            log('Falling back to character select event');
            const event = new CustomEvent('lobby:select-character', {
                detail: { avatar: chat.avatar }
            });
            document.dispatchEvent(event);

            await new Promise(r => setTimeout(r, 800));
        }
    } catch (e) {
        logError('openRecentChat failed:', e);
        showToast('채팅을 열지 못했습니다.', 'error');
    } finally {
        operationLock.release(token);
    }
}

async function openLibraryChat(avatar, fileName) {
    log('Opening library chat:', avatar, fileName);
    
    if (!avatar || !fileName) {
        showToast('채팅 정보가 올바르지 않습니다.', 'error');
        return;
    }
    
    // chatHandlers.openChat 사용
    const context = api.getContext();
    const characters = context?.characters || [];
    const charIndex = characters.findIndex(c => c.avatar === avatar);
    
    if (charIndex === -1) {
        showToast('캐릭터를 찾을 수 없습니다.', 'error');
        return;
    }
    
    // openChat 호출 (로비 닫기 포함)
    await openChat({
        fileName,
        charAvatar: avatar,
        charIndex: String(charIndex)
    });
}

function closeLobby() {
    // index.js의 완전한 closeLobby 호출 (상태 정리 포함)
    window.dispatchEvent(new CustomEvent('chatlobby:close'));
}

// ============================================
// 컨텍스트 메뉴
// ============================================

function closeContextMenu() {
    if (state.activeContextMenu) {
        state.activeContextMenu.remove();
        state.activeContextMenu = null;
    }
    // 리스너도 정리 (그룹 일괄)
    listeners.clear('tabContextMenu');
    contextMenuCloseHandler = null;
}

function showFolderMenu(targetBtn, avatar, fileName) {
    closeContextMenu();
    
    const data = storage.load();
    const folders = (data.folders || []).filter(f => f.id !== 'favorites' && f.id !== 'uncategorized');
    const currentFolderId = storage.getChatFolder(avatar, fileName);
    
    const menu = document.createElement('div');
    menu.className = 'folder-context-menu';
    menu.innerHTML = `
        <div class="folder-menu-title">폴더 이동</div>
        <div class="folder-menu-item ${!currentFolderId ? 'active' : ''}" data-folder-id="">
            📤 폴더에서 제거
        </div>
        ${folders.map(f => `
            <div class="folder-menu-item ${f.id === currentFolderId ? 'active' : ''}" data-folder-id="${f.id}">
                📁 ${escapeHtml(f.name)}
            </div>
        `).join('')}
        <div class="folder-menu-item new-folder">
            ➕ 새 폴더 만들기
        </div>
    `;
    
    // 위치 설정 (화면 경계 체크)
    const rect = targetBtn.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.zIndex = 'var(--z-modal, 60000)';
    
    document.body.appendChild(menu);
    
    // 메뉴 크기 측정 후 위치 조정
    const menuRect = menu.getBoundingClientRect();
    
    // 세로 위치: 아래로 벗어나면 위로
    if (rect.bottom + menuRect.height > window.innerHeight - 10) {
        menu.style.top = `${Math.max(10, rect.top - menuRect.height - 4)}px`;
    } else {
        menu.style.top = `${rect.bottom + 4}px`;
    }
    
    // 가로 위치: 오른쪽 벗어나면 왼쪽으로
    if (rect.right > window.innerWidth - menuRect.width - 10) {
        menu.style.left = `${Math.max(10, rect.left - menuRect.width + rect.width)}px`;
    } else {
        menu.style.left = `${rect.left}px`;
    }
    
    state.activeContextMenu = menu;
    
    // 이벤트
    menu.querySelectorAll('.folder-menu-item:not(.new-folder)').forEach(item => {
        item.addEventListener('click', () => {
            const folderId = item.dataset.folderId;
            if (folderId) {
                storage.setChatFolder(avatar, fileName, folderId);
                const folder = folders.find(f => f.id === folderId);
                showToast(`📁 ${folder?.name || '폴더'}로 이동`, 'success');
            } else {
                storage.setChatFolder(avatar, fileName, null);
                showToast('폴더에서 제거됨', 'success');
            }
            closeContextMenu();
            refreshCurrentTab();
        });
    });
    
    menu.querySelector('.new-folder')?.addEventListener('click', () => {
        closeContextMenu();
        // 기존 폴더 모달 열기
        const event = new CustomEvent('lobby:open-folder-modal', { 
            detail: { avatar, fileName } 
        });
        document.dispatchEvent(event);
    });
    
    // 외부 클릭 시 닫기 (리스너 참조 저장)
    setTimeout(() => {
        contextMenuCloseHandler = function(e) {
            if (!menu.contains(e.target)) {
                closeContextMenu();
            }
        };
        listeners.add('tabContextMenu', document, 'click', contextMenuCloseHandler);
    }, 10);
}

// ============================================
// 유틸리티
// ============================================

// 모던 Base64 인코딩 (deprecated unescape 대체)
function safeBase64Encode(str) {
    try {
        const bytes = new TextEncoder().encode(str);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    } catch (e) {
        return '';
    }
}

function getTimeAgo(timestamp) {
    if (!timestamp) return '';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '방금';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    
    return new Date(timestamp).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

// ============================================
// 외부 API
// ============================================

export function bindTabEvents() {
    // ⚠️ openLobby마다 호출되므로 중복 등록 가드 필수
    // (이전에는 로비를 열 때마다 탭에 리스너가 하나씩 쌓였음)
    const tabBar = document.getElementById('chat-lobby-tabs');
    if (!tabBar || tabBar.dataset.bound === 'true') return;
    tabBar.dataset.bound = 'true';

    log('Binding tab events (delegated)');
    listeners.add('tabBar', tabBar, 'click', (e) => {
        const tab = e.target.closest('.lobby-tab');
        if (tab?.dataset.tab) switchTab(tab.dataset.tab);
    });
}

export function refreshCurrentTab() {
    log('Refreshing current tab:', state.currentTab);
    if (state.currentTab !== 'characters') {
        loadTabData(state.currentTab);
    }
}

export function injectContextMenuStyles() {
    if (document.getElementById('tab-context-menu-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'tab-context-menu-styles';
    style.textContent = `
        /* 탭 채팅 목록 - 기존 채팅 목록 UI와 유사 */
        .tab-chat-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding: 8px;
        }
        
        .tab-chat-list .lobby-chat-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 12px;
            background: var(--lobby-bg-card);
            border: 1px solid var(--lobby-border);
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.15s ease;
        }
        
        .tab-chat-list .lobby-chat-item:hover {
            background: var(--lobby-bg-hover);
            border-color: var(--lobby-accent);
        }
        
        .tab-chat-list .lobby-chat-item.is-favorite {
            border-left: 4px solid var(--lobby-accent);
        }
        
        /* 큰 라운드 네모 아바타 */
        .tab-chat-list .chat-avatar-lg {
            width: 52px;
            height: 52px;
            border-radius: 10px;
            overflow: hidden;
            flex-shrink: 0;
            background: var(--lobby-bg-hover);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
        }
        
        .tab-chat-list .chat-avatar-lg img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .tab-chat-list .chat-content {
            flex: 1;
            min-width: 0;
            cursor: pointer;
        }
        
        .tab-chat-list .chat-title-line {
            font-size: 13px;
            font-weight: 500;
            color: var(--lobby-text);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .tab-chat-list .chat-preview {
            font-size: 12px;
            color: var(--lobby-text-secondary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-top: 3px;
        }
        
        .tab-chat-list .chat-meta {
            display: flex;
            gap: 8px;
            font-size: 11px;
            color: var(--lobby-text-secondary);
            margin-top: 4px;
        }
        
        .tab-chat-list .chat-folder-tag {
            background: var(--lobby-accent);
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
        }
        
        /* 액션 버튼들 - 항상 표시 */
        .tab-chat-list .chat-actions {
            display: flex;
            flex-direction: column;
            gap: 4px;
            flex-shrink: 0;
        }
        
        .tab-chat-list .chat-actions button {
            background: var(--lobby-bg-hover);
            border: 1px solid var(--lobby-border);
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            padding: 6px 8px;
            color: var(--lobby-text-secondary);
            transition: all 0.15s;
        }
        
        .tab-chat-list .chat-actions button:hover {
            background: var(--lobby-bg-card);
            color: var(--lobby-text);
        }
        
        .tab-chat-list .lobby-chat-item.is-favorite .chat-fav-btn {
            color: var(--star-color, #ffd700);
            text-shadow: 0 0 8px var(--star-glow, rgba(255, 215, 0, 0.6));
        }
        
        .tab-chat-list .chat-delete-btn:hover {
            color: #ff6b6b !important;
            border-color: #ff6b6b;
        }
        
        .tab-chat-list .chat-folder-btn:hover {
            color: var(--lobby-accent) !important;
        }
        
        /* 폴더 컨텍스트 메뉴 - 항상 다크 테마 */
        .folder-context-menu {
            background: #2f2f2f !important;
            border: 1px solid #404040 !important;
            border-radius: 10px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
            min-width: 160px;
            overflow: hidden;
        }
        
        .folder-menu-title {
            padding: 10px 14px;
            font-size: 12px;
            font-weight: 600;
            color: #A3A3A3 !important;
            border-bottom: 1px solid #404040 !important;
        }
        
        .folder-menu-item {
            padding: 10px 14px;
            font-size: 13px;
            color: #FFFFFF !important;
            cursor: pointer;
            transition: background 0.15s;
        }
        
        .folder-menu-item:hover {
            background: #404040 !important;
        }
        
        .folder-menu-item.active {
            background: #E50914 !important;
            color: white !important;
        }
        
        .folder-menu-item.new-folder {
            border-top: 1px solid #404040 !important;
            color: #E50914 !important;
        }
    `;
    
    document.head.appendChild(style);
}

// ============================================
// DOM 변화 감지 (로비 닫혀있을 때 .recentChat 변화 감지)
// ============================================

/**
 * 디바운스 헬퍼
 */
function debounce(fn, delay) {
    let timer = null;
    return function(...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * 로비 닫혀있을 때 .recentChat DOM 변화 감지 시작
 */
export function startRecentDomObserver() {
    // 이미 감시 중이면 무시
    if (recentDomObserver) return;
    
    // #rm_print_characters_block에서만 감시 (body 폴백 제거 - 성능 문제)
    const container = document.querySelector('#rm_print_characters_block');
    if (!container) {
        log('[Observer] Target container #rm_print_characters_block not found, skipping');
        return;
    }
    
    const debouncedUpdate = debounce(() => {
        const els = document.querySelectorAll('.recentChat');
        if (els.length > 0) {
            log('[Observer] .recentChat changed, updating cache');
            state.cachedRecentChats = [];  // 기존 캐시 클리어
            cacheElements(els);
        }
    }, 300);
    
    recentDomObserver = new MutationObserver(debouncedUpdate);
    recentDomObserver.observe(container, { 
        childList: true, 
        subtree: true 
    });
    
    log('[Observer] Started watching .recentChat DOM changes');
}

/**
 * 로비 열릴 때 감지 중지
 */
export function stopRecentDomObserver() {
    if (recentDomObserver) {
        recentDomObserver.disconnect();
        recentDomObserver = null;
        log('[Observer] Stopped watching .recentChat DOM changes');
    }
}
