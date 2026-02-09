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
import { openChat } from '../handlers/chatHandlers.js';
import { operationLock } from '../utils/operationLock.js';
import { getLocalDateString } from '../data/calendarStorage.js';

// ============================================
// 디버그 로깅
// ============================================

const DEBUG = true;

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
    
    // DOM이 준비될 때까지 대기 (최대 0.5초로 단축)
    for (let retry = 0; retry < MAX_CACHE_RETRIES; retry++) {
        const recentChatElements = document.querySelectorAll('.recentChat');
        
        if (recentChatElements.length > 0) {
            log(`Found ${recentChatElements.length} .recentChat elements (retry ${retry})`);
            cacheElements(recentChatElements);
            return;
        }
        
        log(`No .recentChat found, retry ${retry + 1}/${MAX_CACHE_RETRIES} in ${CACHE_RETRY_DELAY}ms`);
        await new Promise(r => setTimeout(r, CACHE_RETRY_DELAY));
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
    
    document.querySelectorAll('.lobby-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    
    const characterSection = document.getElementById('chat-lobby-characters');
    const personaBar = document.getElementById('chat-lobby-persona-bar');
    const searchSection = document.getElementById('chat-lobby-search');
    const tagBar = document.getElementById('chat-lobby-tag-bar');
    const collapseBtn = document.getElementById('chat-lobby-collapse-btn');
    
    if (tabId === 'characters') {
        [characterSection, personaBar, searchSection, tagBar, collapseBtn].forEach(el => {
            if (el) el.style.display = '';
        });
        hideAllTabContents();
    } else {
        [characterSection, personaBar, searchSection, tagBar, collapseBtn].forEach(el => {
            if (el) el.style.display = 'none';
        });
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
        if (parsed) {
            if (!chatsByAvatar.has(parsed.avatar)) {
                chatsByAvatar.set(parsed.avatar, []);
            }
            chatsByAvatar.get(parsed.avatar).push({ key, fileName: parsed.fileName });
        }
    }
    
    // API로 채팅 정보 가져오기 (병렬 처리)
    await Promise.allSettled(
        [...chatsByAvatar.entries()].map(async ([avatar, chats]) => {
            try {
                const apiChats = await api.fetchChatsForCharacter(avatar);
                const entityInfo = characters.find(c => c.avatar === avatar);
                const name = entityInfo?.name || avatar.replace(/\.[^.]+$/, '');
                
                for (const { key, fileName } of chats) {
                    // API 응답에서 해당 채팅 찾기
                    const apiChat = apiChats.find(c => 
                        c.file_name === fileName || 
                        c.file_name === fileName.replace('.jsonl', '') ||
                        `${c.file_name}.jsonl` === fileName
                    );
                    
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
    // avatar는 항상 .png, .jpg, .webp 등으로 끝남
    const avatarMatch = key.match(/^(.+?\.(png|jpg|jpeg|gif|webp))_(.+)$/i);
    if (!avatarMatch) {
        // 기존 폴백: lastIndexOf
        const lastUnderscoreIdx = key.lastIndexOf('_');
        if (lastUnderscoreIdx === -1) return null;
        
        const avatar = key.substring(0, lastUnderscoreIdx);
        const fileName = key.substring(lastUnderscoreIdx + 1);
        if (avatar.startsWith('group:')) return null;
        return { avatar, fileName };
    }
    
    const avatar = avatarMatch[1];
    const fileName = avatarMatch[3];
    
    // 그룹은 일단 제외 (API 다름)
    if (avatar.startsWith('group:')) return null;
    
    return { avatar, fileName };
}

function parseChatKey(key, characters, groups) {
    // 키 형식: avatar.png_chatfile.jsonl (아바타에 _가 있을 수 있음)
    // 확장자 기반 파싱으로 정확하게 분리 (이미지 확장자 명시)
    let avatar, fileName;
    
    const avatarMatch = key.match(/^((?:group:)?.+\.(?:png|jpg|jpeg|gif|webp))_(.+)$/i);
    if (avatarMatch) {
        avatar = avatarMatch[1];
        fileName = avatarMatch[2];
    } else {
        // 폴백: lastIndexOf (확장자 없는 특이 케이스)
        const lastUnderscoreIdx = key.lastIndexOf('_');
        if (lastUnderscoreIdx === -1) {
            log(`Invalid key format (no underscore): ${key}`);
            return null;
        }
        avatar = key.substring(0, lastUnderscoreIdx);
        fileName = key.substring(lastUnderscoreIdx + 1);
    }
    
    const isGroup = avatar.startsWith('group:');
    const actualAvatar = isGroup ? avatar.replace('group:', '') : avatar;
    
    let entityInfo = null;
    if (isGroup) {
        entityInfo = groups.find(g => g.id === actualAvatar);
    } else {
        entityInfo = characters.find(c => c.avatar === actualAvatar);
    }
    
    // 캐릭터 못 찾아도 표시
    const name = entityInfo?.name || actualAvatar.replace(/\.[^.]+$/, '');
    
    const cachedTime = lastChatCache.lastChatTimes.get(actualAvatar);
    const lastChatTime = typeof cachedTime === 'number' ? cachedTime : cachedTime?.time || 0;
    
    // 미리보기 데이터 가져오기 - 캐시된 최근 채팅에서 찾기
    let preview = '';
    let messageCount = 0;
    const cachedChat = state.cachedRecentChats.find(c => 
        c.avatar === actualAvatar && (c.file === fileName || c.chatName?.includes(fileName.replace('.jsonl', '')))
    );
    if (cachedChat) {
        preview = cachedChat.preview || '';
        messageCount = cachedChat.messageCount || 0;
    }
    
    return {
        key,
        avatar: actualAvatar,
        fileName,
        file: fileName,
        characterName: name,
        name,
        type: isGroup ? 'group' : 'char',
        isGroup,
        lastChatTime,
        preview,
        messageCount,
        isFavorite: storage.isFavorite(actualAvatar, fileName),
        folderId: storage.getChatFolder(actualAvatar, fileName),
    };
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
            <button class="library-filter-btn folder-manage-btn" id="tab-folder-manage-btn" data-action="open-folder-modal" title="폴더 관리">
                📁
            </button>
        </div>
        <div class="library-content" id="library-content">
            ${state.libraryMode === 'favorites' ? renderFavoritesContent() : renderFoldersContent()}
        </div>
    `;
    
    // 폴더 관리 버튼 제외하고 모드 전환 버튼만 처리
    container.querySelectorAll('.library-filter-btn[data-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            if (mode && state.libraryMode !== mode) {
                state.libraryMode = mode;
                state.currentFolderId = null;
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
    
    bindLibraryChatEvents(container);
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
        </div>
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
        
        // 채팅 열기
        item.querySelector('.chat-content')?.addEventListener('click', () => {
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
    }
}

// ============================================
// 채팅 열기
// ============================================

async function openRecentChat(chat, idx) {
    if (!operationLock.acquire('openRecentChat')) return;
    
    try {
        log('Opening recent chat:', chat.file, chat.avatar);
        
        // index.js의 완전한 closeLobby 호출
        window.dispatchEvent(new CustomEvent('chatlobby:close'));
        
        // DOM이 다시 보이도록 대기 (rAF 2회 체이닝이 더 안정적)
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        
        // selector로 원본 DOM 요소 찾기 (isGroup 처리 포함)
        const selector = chat.isGroup
            ? `.recentChat[data-group="${chat.avatar}"]`
            : `.recentChat[data-file="${chat.file}"][data-avatar="${chat.avatar}"]`;
        const recentEl = document.querySelector(selector);
        
        if (recentEl) {
            log('Found element via selector, clicking');
            recentEl.click();
        } else {
            // 최후 수단: 캐릭터 선택
            log('Element not found, using character select');
            const event = new CustomEvent('lobby:select-character', { 
                detail: { avatar: chat.avatar } 
            });
            document.dispatchEvent(event);
        }
    } catch (e) {
        logError('openRecentChat failed:', e);
        showToast('채팅을 열지 못했습니다.', 'error');
    } finally {
        operationLock.release();
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
    // 리스너도 정리
    if (contextMenuCloseHandler) {
        document.removeEventListener('click', contextMenuCloseHandler);
        contextMenuCloseHandler = null;
    }
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
    menu.style.zIndex = '10001';
    
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
        document.addEventListener('click', contextMenuCloseHandler);
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
    log('Binding tab events');
    document.querySelectorAll('.lobby-tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
}

export function getCurrentTab() {
    return state.currentTab;
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
