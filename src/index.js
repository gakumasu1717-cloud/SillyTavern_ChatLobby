// ============================================
// ChatLobby 메인 진입점
// ============================================

import { CONFIG } from './config.js';
import { cache } from './data/cache.js';
import { storage } from './data/storage.js';
import { store } from './data/store.js';
import { lastChatCache } from './data/lastChatCache.js';
import { api } from './api/sillyTavern.js';
import { createLobbyHTML } from './ui/templates.js';
import { renderPersonaBar } from './ui/personaBar.js';
import { renderCharacterGrid, setCharacterSelectHandler, handleSearch, handleSortChange as handleCharSortChange } from './ui/characterGrid.js';
import { renderChatList, setChatHandlers, handleFilterChange, handleSortChange as handleChatSortChange, toggleBatchMode, updateBatchCount, closeChatPanel } from './ui/chatList.js';
import { openChat, deleteChat, startNewChat, deleteCharacter } from './handlers/chatHandlers.js';
import { openFolderModal, closeFolderModal, addFolder, updateFolderDropdowns } from './handlers/folderHandlers.js';
import { showToast } from './ui/notifications.js';
import { openStatsView, closeStatsView, isStatsViewOpen } from './ui/statsView.js';
import { debounce, isMobile } from './utils/eventHelpers.js';
import { waitFor, waitForCharacterSelect, waitForElement } from './utils/waitFor.js';
import { intervalManager } from './utils/intervalManager.js';
import { openDrawerSafely } from './utils/drawerHelper.js';

(function() {
    'use strict';
    
    
    // ============================================
    // 이벤트 핸들러 참조 저장 (cleanup용)
    // ============================================
    let eventHandlers = null;
    let eventsRegistered = false;
    
    // ============================================
    // 초기화
    // ============================================
    
    /**
     * 익스텐션 초기화
     * @returns {Promise<void>}
     */
    async function init() {
        
        // 기존 UI 제거
        removeExistingUI();
        
        // UI 삽입
        document.body.insertAdjacentHTML('beforeend', createLobbyHTML());
        
        // FAB 버튼 표시
        const fab = document.getElementById('chat-lobby-fab');
        if (fab) {
            fab.style.display = 'flex';
        }
        
        // 핸들러 연결
        setupHandlers();
        
        // 이벤트 위임 설정
        setupEventDelegation();
        
        // SillyTavern 이벤트 리스닝
        setupSillyTavernEvents();
        
        // 백그라운드 프리로딩 시작
        startBackgroundPreload();
        
        // 옵션 메뉴에 버튼 추가
        addLobbyToOptionsMenu();
        
        // CustomTheme 사이드바에 버튼 추가 (있으면)
        setTimeout(() => addToCustomThemeSidebar(), CONFIG.timing.initDelay);
        
    }
    
    /**
     * SillyTavern 이벤트 리스닝 설정
     * 캐릭터 삭제/추가/수정 등의 이벤트를 감지하여 캐시 무효화
     * 중복 등록 방지 + cleanup 지원
     */
    function setupSillyTavernEvents() {
        const context = window.SillyTavern?.getContext?.();
        if (!context?.eventSource) {
            console.warn('[ChatLobby] SillyTavern eventSource not found');
            return;
        }
        
        // 이미 등록되어 있으면 스킵
        if (eventsRegistered) {
            return;
        }
        
        const { eventSource, eventTypes } = context;
        
        // 핸들러 함수들을 별도로 정의 (off 호출 가능하도록)
        eventHandlers = {
            onCharacterDeleted: () => {
                cache.invalidate('characters');
                if (isLobbyOpen()) {
                    renderCharacterGrid(store.searchTerm);
                }
            },
            onCharacterEdited: () => {
                cache.invalidate('characters');
            },
            onCharacterAdded: () => {
                cache.invalidate('characters');
                if (isLobbyOpen()) {
                    renderCharacterGrid(store.searchTerm);
                }
            },
            onChatChanged: () => {
                cache.invalidate('characters');
                cache.invalidate('chats');
                // 리렌더 제거 - 삭제는 deleteChat에서 element.remove()로 처리
            },
            // 메시지 전송 시 해당 캐릭터의 마지막 채팅 시간 갱신
            onMessageSent: () => {
                const context = api.getContext();
                const currentChar = context?.characters?.[context?.characterId];
                if (currentChar?.avatar) {
                    lastChatCache.updateNow(currentChar.avatar);
                    console.log('[ChatLobby] Message sent, updated lastChatCache for:', currentChar.name);
                }
            },
            // 메시지 수신 시에도 갱신
            onMessageReceived: () => {
                const context = api.getContext();
                const currentChar = context?.characters?.[context?.characterId];
                if (currentChar?.avatar) {
                    lastChatCache.updateNow(currentChar.avatar);
                }
            }
        };
        
        // 이벤트 등록
        eventSource.on(eventTypes.CHARACTER_DELETED, eventHandlers.onCharacterDeleted);
        
        if (eventTypes.CHARACTER_EDITED) {
            eventSource.on(eventTypes.CHARACTER_EDITED, eventHandlers.onCharacterEdited);
        }
        
        if (eventTypes.CHARACTER_ADDED) {
            eventSource.on(eventTypes.CHARACTER_ADDED, eventHandlers.onCharacterAdded);
        }
        
        eventSource.on(eventTypes.CHAT_CHANGED, eventHandlers.onChatChanged);
        
        // 메시지 이벤트 등록 (마지막 채팅 시간 실시간 갱신)
        if (eventTypes.MESSAGE_SENT) {
            eventSource.on(eventTypes.MESSAGE_SENT, eventHandlers.onMessageSent);
        }
        if (eventTypes.MESSAGE_RECEIVED) {
            eventSource.on(eventTypes.MESSAGE_RECEIVED, eventHandlers.onMessageReceived);
        }
        if (eventTypes.USER_MESSAGE_RENDERED) {
            eventSource.on(eventTypes.USER_MESSAGE_RENDERED, eventHandlers.onMessageSent);
        }
        if (eventTypes.CHARACTER_MESSAGE_RENDERED) {
            eventSource.on(eventTypes.CHARACTER_MESSAGE_RENDERED, eventHandlers.onMessageReceived);
        }
        
        eventsRegistered = true;
    }
    
    /**
     * SillyTavern 이벤트 리스너 정리
     * 확장 재로드 시 호출
     */
    function cleanupSillyTavernEvents() {
        if (!eventHandlers || !eventsRegistered) return;
        
        const context = window.SillyTavern?.getContext?.();
        if (!context?.eventSource) return;
        
        const { eventSource, eventTypes } = context;
        
        try {
            eventSource.off?.(eventTypes.CHARACTER_DELETED, eventHandlers.onCharacterDeleted);
            eventSource.off?.(eventTypes.CHARACTER_EDITED, eventHandlers.onCharacterEdited);
            eventSource.off?.(eventTypes.CHARACTER_ADDED, eventHandlers.onCharacterAdded);
            eventSource.off?.(eventTypes.CHAT_CHANGED, eventHandlers.onChatChanged);
            
            // 메시지 이벤트 정리
            eventSource.off?.(eventTypes.MESSAGE_SENT, eventHandlers.onMessageSent);
            eventSource.off?.(eventTypes.MESSAGE_RECEIVED, eventHandlers.onMessageReceived);
            eventSource.off?.(eventTypes.USER_MESSAGE_RENDERED, eventHandlers.onMessageSent);
            eventSource.off?.(eventTypes.CHARACTER_MESSAGE_RENDERED, eventHandlers.onMessageReceived);
            
            eventsRegistered = false;
            eventHandlers = null;
        } catch (e) {
            console.warn('[ChatLobby] Failed to cleanup events:', e);
        }
    }
    
    /**
     * 로비가 열려있는지 확인
     */
    function isLobbyOpen() {
        return store.isLobbyOpen;
    }
    
    /**
     * 기존 UI 요소 제거
     */
    function removeExistingUI() {
        ['chat-lobby-overlay', 'chat-lobby-fab', 'chat-lobby-folder-modal', 'chat-lobby-global-tooltip'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
    }
    
    /**
     * 핸들러 설정
     */
    function setupHandlers() {
        // 캐릭터 선택 시 채팅 목록 렌더링
        setCharacterSelectHandler((character) => {
            renderChatList(character);
        });
        
        // 채팅 열기/삭제 핸들러
        setChatHandlers({
            onOpen: openChat,
            onDelete: deleteChat
        });
    }
    
    // ============================================
    // 백그라운드 프리로딩
    // ============================================
    
    /**
     * 백그라운드 프리로딩 시작
     */
    async function startBackgroundPreload() {
        // 약간의 딜레이 후 프리로딩 (메인 스레드 블로킹 방지)
        setTimeout(async () => {
            await cache.preloadAll(api);
            
            // 최근 사용 캐릭터들의 채팅도 프리로딩
            const characters = cache.get('characters');
            if (characters && characters.length > 0) {
                // 최근 채팅순으로 정렬된 상위 5개
                const recent = [...characters]
                    .sort((a, b) => (b.date_last_chat || 0) - (a.date_last_chat || 0))
                    .slice(0, 5);
                await cache.preloadRecentChats(api, recent);
            }
        }, CONFIG.timing.preloadDelay);
    }
    
    // ============================================
    // 로비 열기/닫기
    // ============================================
    
    /**
     * 로비 열기
     * 캐시는 이벤트로 동기화함 (onChatChanged)
     */
    async function openLobby() {
        // 이미 열려있고 채팅 패널이 표시 중이면 무시
        const chatsPanel = document.getElementById('chat-lobby-chats');
        if (store.isLobbyOpen && chatsPanel?.classList.contains('visible')) {
            return;
        }
        
        const overlay = document.getElementById('chat-lobby-overlay');
        const container = document.getElementById('chat-lobby-container');
        const fab = document.getElementById('chat-lobby-fab');
        
        if (overlay) {
            overlay.style.display = 'flex';
            if (container) container.style.display = 'flex';
            if (fab) fab.style.display = 'none';
            
            // 핸들러가 설정되어 있는지 확인
            if (!store.onCharacterSelect) {
                console.warn('[ChatLobby] Handler not set, re-running setupHandlers');
                setupHandlers();
            }
            
            // 상태 초기화 (이전 선택 정보 클리어, 핸들러는 유지)
            store.reset();
            store.setLobbyOpen(true);
            
            // SillyTavern 캐릭터 목록 최신화
            try {
                const context = api.getContext();
                if (typeof context?.getCharacters === 'function') {
                    await context.getCharacters();
                }
            } catch (error) {
                console.warn('[ChatLobby] Failed to refresh characters:', error);
            }
            
            // 폴더 필터 강제 리셋 (버그 방지)
            // 존재하지 않는 폴더로 필터링되어 채팅이 안 보이는 문제 해결
            const data = storage.load();
            if (data.filterFolder && data.filterFolder !== 'all' && data.filterFolder !== 'favorites' && data.filterFolder !== 'uncategorized') {
                const folderExists = data.folders?.some(f => f.id === data.filterFolder);
                if (!folderExists) {
                    storage.setFilterFolder('all');
                }
            }
            
            // 배치 모드 리셋
            if (store.batchModeActive) {
                toggleBatchMode();
            }
            
            // 채팅 패널 닫기 (이전 캐릭터 선택 상태 클리어)
            closeChatPanel();
            
            // 마지막 채팅 시간 캐시 초기화 후 렌더링 (한 번에 같이)
            const characters = api.getCharacters();
            
            // 캐시 초기화가 필요하면 먼저 완료
            if (characters.length > 0 && !lastChatCache.initialized) {
                await lastChatCache.initializeAll(characters);
            }
            
            // 페르소나 바와 캐릭터 그리드를 동시에 렌더링 (한 번에 같이)
            await Promise.all([
                renderPersonaBar(),
                renderCharacterGrid()
            ]);
            
            // 페르소나 바 휠 스크롤 설정
            setupPersonaWheelScroll();
            
            // 폴더 드롭다운 업데이트
            updateFolderDropdowns();
            
            // 현재 채팅 중인 캐릭터 자동 선택 (UI만 표시, 채팅목록은 렌더X)
            const currentContext = api.getContext();
            if (currentContext?.characterId !== undefined && currentContext.characterId >= 0) {
                const currentChar = currentContext.characters?.[currentContext.characterId];
                if (currentChar) {
                    // 렌더링 완료 후 선택 표시만
                    setTimeout(() => {
                        const charCard = document.querySelector(
                            `.lobby-char-card[data-char-avatar="${currentChar.avatar}"]`
                        );
                        if (charCard) {
                            charCard.classList.add('selected');
                            // 채팅 목록 렌더 제거 - 사용자가 직접 클릭할 때만 표시
                        }
                    }, 200);
                }
            }
            
        }
    }
    
    /**
     * 로비 닫기 (상태 초기화)
     * - 로비를 완전히 닫을 때 사용
     * - 캐릭터/채팅 선택 상태를 초기화함
     * - ESC 키, 닫기 버튼, 오버레이 클릭 시 사용
     */
    async function closeLobby() {
        const container = document.getElementById('chat-lobby-container');
        const fab = document.getElementById('chat-lobby-fab');
        
        if (container) container.style.display = 'none';
        if (fab) fab.style.display = 'flex';
        
        // 🧹 모든 interval 정리 (메모리 누수 방지)
        intervalManager.clearAll();
        
        // CustomTheme 사이드바 버튼 상태 초기화
        const sidebarBtn = document.getElementById('st-chatlobby-sidebar-btn');
        if (sidebarBtn) {
            const icon = sidebarBtn.querySelector('.drawer-icon');
            icon?.classList.remove('openIcon');
            icon?.classList.add('closedIcon');
        }
        
        store.setLobbyOpen(false);
        store.reset(); // 상태 초기화
        closeChatPanel();
    }
    
    // 전역 API (네임스페이스 정리)
    window.ChatLobby = window.ChatLobby || {};
    window.ChatLobby.refresh = async function() {
        cache.invalidateAll();
        lastChatCache.clear();  // 마지막 채팅 캐시도 클리어
        
        // SillyTavern의 캐릭터 목록 강제 갱신
        const context = api.getContext();
        if (typeof context?.getCharacters === 'function') {
            await context.getCharacters();
        }
        
        // 마지막 채팅 시간 캐시 재초기화
        const characters = api.getCharacters();
        if (characters.length > 0) {
            await lastChatCache.initializeAll(characters);
        }
        
        await renderPersonaBar();
        await renderCharacterGrid();
    };
    // 하위 호환성 유지
    window.chatLobbyRefresh = window.ChatLobby.refresh;
    
    // ============================================
    // 이벤트 위임 (Event Delegation)
    // ============================================
    
    // 이벤트 리스너 중복 등록 방지 플래그
    let eventsInitialized = false;
    
    /**
     * 이벤트 위임 설정
     * getElementById 대신 상위 컨테이너에서 이벤트를 위임 처리
     */
    function setupEventDelegation() {
        if (eventsInitialized) return;
        eventsInitialized = true;
        
        // FAB 버튼 (document.body에 위임)
        document.body.addEventListener('click', handleBodyClick);
        
        // 키보드 이벤트
        document.addEventListener('keydown', handleKeydown);
        
        // 검색 입력 (input 이벤트는 위임이 잘 안되므로 직접 바인딩)
        const searchInput = document.getElementById('chat-lobby-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
        }
        
        // 드롭다운 change 이벤트도 직접 바인딩
        bindDropdownEvents();
        
        // 순환참조 방지용 이벤트 리스너
        window.addEventListener('chatlobby:refresh-grid', () => {
            renderCharacterGrid(store.searchTerm);
        });
    }
    
    /**
     * 페르소나 바 마우스 휠 가로 스크롤 설정
     */
    function setupPersonaWheelScroll() {
        const personaList = document.getElementById('chat-lobby-persona-list');
        if (!personaList) return;
        
        // 이미 바인딩되어 있으면 스킵
        if (personaList.dataset.wheelBound) return;
        personaList.dataset.wheelBound = 'true';
        
        personaList.addEventListener('wheel', (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                personaList.scrollLeft += e.deltaY;
            }
        }, { passive: false });
    }
    
    /**
     * 상단 영역 접기/펼치기 토글
     */
    function toggleCollapse() {
        const leftPanel = document.getElementById('chat-lobby-left');
        const collapseBtn = document.getElementById('chat-lobby-collapse-btn');
        if (!leftPanel || !collapseBtn) return;
        
        const isCollapsed = leftPanel.classList.toggle('collapsed');
        collapseBtn.textContent = isCollapsed ? '▼' : '▲';
        
        // localStorage에 저장
        localStorage.setItem('chatlobby-collapsed', isCollapsed.toString());
    }
    
    /**
     * 테마 토글 (다크/라이트)
     */
    function toggleTheme() {
        const container = document.getElementById('chat-lobby-container');
        const themeBtn = document.getElementById('chat-lobby-theme-toggle');
        if (!container || !themeBtn) return;
        
        const isCurrentlyDark = container.classList.contains('dark-mode');
        
        if (isCurrentlyDark) {
            container.classList.remove('dark-mode');
            container.classList.add('light-mode');
            themeBtn.textContent = '🌙';
            localStorage.setItem('chatlobby-theme', 'light');
        } else {
            container.classList.remove('light-mode');
            container.classList.add('dark-mode');
            themeBtn.textContent = '☀️';
            localStorage.setItem('chatlobby-theme', 'dark');
        }
    }
    
    /**
     * body 클릭 이벤트 핸들러 (이벤트 위임)
     * @param {MouseEvent} e
     */
    function handleBodyClick(e) {
        const target = e.target;
        
        // FAB 버튼은 로비 외부에 있으므로 별도 처리
        if (target.id === 'chat-lobby-fab' || target.closest('#chat-lobby-fab')) {
            openLobby();
            return;
        }
        
        // 로비 컨테이너 내부 클릭만 처리
        const lobbyContainer = target.closest('#chat-lobby-container');
        const folderModal = target.closest('#chat-lobby-folder-modal');
        
        if (!lobbyContainer && !folderModal) {
            // 로비 외부 클릭은 무시
            return;
        }
        
        // 캐릭터 카드나 채팅 아이템 클릭은 무시 (각자 핸들러가 있음)
        if (target.closest('.lobby-char-card') || target.closest('.lobby-chat-item')) {
            return;
        }
        
        // data-action 속성으로 액션 분기
        const actionEl = target.closest('[data-action]');
        if (actionEl) {
            handleAction(actionEl.dataset.action, actionEl, e);
            return;
        }
    }
    
    /**
     * data-action 기반 액션 처리
     * @param {string} action - 액션 이름
     * @param {HTMLElement} el - 트리거 요소
     * @param {Event} e - 이벤트 객체
     */
    async function handleAction(action, el, e) {
        switch (action) {
            case 'open-lobby':
                openLobby();
                break;
            case 'close-lobby':
                await closeLobby();
                break;
            case 'open-stats':
                openStatsView();
                break;
            case 'close-stats':
                closeStatsView();
                break;
            case 'refresh':
                handleRefresh();
                break;
            case 'new-chat':
                startNewChat();
                break;
            case 'delete-char':
                deleteCharacter();
                break;
            case 'add-persona':
                handleAddPersona();
                break;
            case 'import-char':
                handleImportCharacter();
                break;
            case 'toggle-batch':
                toggleBatchMode();
                break;
            case 'batch-cancel':
                toggleBatchMode();
                break;
            case 'open-folder-modal':
                openFolderModal();
                break;
            case 'close-folder-modal':
                closeFolderModal();
                break;
            case 'add-folder':
                addFolder();
                break;
            case 'close-chat-panel':
                // CSS에서 850px 이하일 때만 버튼이 보이므로, 조건 체크 불필요
                closeChatPanel();
                break;
            case 'go-to-character':
                handleGoToCharacter();
                break;
            case 'toggle-collapse':
                toggleCollapse();
                break;
            case 'toggle-theme':
                toggleTheme();
                break;
        }
    }
    
    /**
     * 키보드 이벤트 핸들러
     * @param {KeyboardEvent} e
     */
    function handleKeydown(e) {
        if (e.key === 'Escape') {
            // 통계 화면 열려있으면 먼저 닫기
            if (isStatsViewOpen()) {
                closeStatsView();
                return;
            }
            
            const folderModal = document.getElementById('chat-lobby-folder-modal');
            if (folderModal?.style.display === 'flex') {
                closeFolderModal();
            } else if (store.isLobbyOpen) {
                closeLobby();
            }
        }
        
        // 폴더 추가 Enter 키
        if (e.key === 'Enter' && e.target.id === 'new-folder-name') {
            addFolder();
        }
    }
    
    /**
     * 드롭다운 이벤트 바인딩
     */
    function bindDropdownEvents() {
        // 캐릭터 정렬
        document.getElementById('chat-lobby-char-sort')?.addEventListener('change', (e) => {
            handleCharSortChange(e.target.value);
        });
        
        // 채팅 필터
        document.getElementById('chat-lobby-folder-filter')?.addEventListener('change', (e) => {
            handleFilterChange(e.target.value);
        });
        
        // 채팅 정렬
        document.getElementById('chat-lobby-chat-sort')?.addEventListener('change', (e) => {
            handleChatSortChange(e.target.value);
        });
        
        // 배치 체크박스 변경 (위임)
        document.getElementById('chat-lobby-chats-list')?.addEventListener('change', (e) => {
            if (e.target.classList.contains('chat-select-cb')) {
                updateBatchCount();
            }
        });
    }
    
    // ============================================
    // 액션 핸들러
    // ============================================
    
    /**
     * 새로고침 처리 - 캐시 완전 무효화 후 강제 리로드
     */
    async function handleRefresh() {
        cache.invalidateAll();
        
        // 강제로 API 재호출 (forceRefresh=true)
        await api.fetchPersonas();
        await api.fetchCharacters(true);
        
        await renderPersonaBar();
        await renderCharacterGrid();
        
        showToast('새로고침 완료', 'success');
    }
    
    // ============================================
    // 임포트/페르소나 - 로비 상시 실행 방식
    // ============================================
    
    /**
     * 캐릭터 임포트 처리
     * 로비를 닫지 않고 임포트 버튼만 클릭
     * 캐릭터 수 변화 감지하여 직접 리렌더
     */
    function handleImportCharacter() {
        const importBtn = document.getElementById('character_import_button');
        if (!importBtn) return;
        
        // 현재 캐릭터 아바타 목록 저장 (숫자만 비교 X)
        const beforeAvatars = new Set(
            api.getCharacters().map(c => c.avatar)
        );
        
        importBtn.click();
        
        let attempts = 0;
        const maxAttempts = 10; // 5초 (500ms * 10)
        
        const checkInterval = intervalManager.set(async () => {
            attempts++;
            
            const currentChars = api.getCharacters();
            // 새로운 아바타가 있는지 확인 (더 정확함)
            const newChar = currentChars.find(c => !beforeAvatars.has(c.avatar));
            
            if (newChar) {
                intervalManager.clear(checkInterval);
                cache.invalidate('characters');
                if (isLobbyOpen()) {
                    await renderCharacterGrid(store.searchTerm);
                }
                showToast(`"${newChar.name}" 캐릭터가 추가되었습니다!`, 'success');
                return;
            }
            
            // 타임아웃
            if (attempts >= maxAttempts) {
                intervalManager.clear(checkInterval);
                // 사용자에게 알리지 않음 (취소했을 수도 있으니까)
            }
        }, 500);
    }
    
    /**
     * 페르소나 추가 처리
     * 드로어 열어서 더미 페르소나 만들기
     * 사용자가 이름 입력 후 확인하면 드로어가 닫히므로 그때 리렌더
     */
    async function handleAddPersona() {
        // 드로어 열기 (CustomTheme 호환 - 클릭 대신 클래스 조작)
        if (!openDrawerSafely('persona-management-button')) {
            showToast('페르소나 관리를 열 수 없습니다.', 'error');
            return;
        }
        
        // 버튼이 나타날 때까지 대기
        const createBtn = await waitForElement('#create_dummy_persona', 2000);
        if (createBtn) {
            createBtn.click();
            cache.invalidate('personas');
            
            // 페르소나 드로어가 닫힐 때까지 감시 (최대 30초)
            // intervalManager 사용
            let checkCount = 0;
            const maxChecks = 60; // 500ms * 60 = 30초
            
            const checkDrawerClosed = intervalManager.set(() => {
                checkCount++;
                const drawer = document.getElementById('persona-management-button');
                const isOpen = drawer?.classList.contains('openDrawer') || 
                               drawer?.querySelector('.drawer-icon.openIcon');
                
                
                if (!isOpen || checkCount >= maxChecks) {
                    intervalManager.clear(checkDrawerClosed);
                    
                    if (checkCount >= maxChecks) {
                    } else {
                    }
                    
                    cache.invalidate('personas');
                    if (isLobbyOpen()) {
                        renderPersonaBar();
                    }
                }
            }, 500);
        } else {
            showToast('페르소나 생성 버튼을 찾을 수 없습니다', 'error');
        }
    }
    
    /**
     * 선택된 캐릭터 편집 화면으로 이동 (봇카드 관리 화면)
     */
    async function handleGoToCharacter() {
        const character = store.currentCharacter;
        if (!character) {
            console.warn('[ChatLobby] No character selected');
            return;
        }
        
        
        // 캐릭터 선택
        const context = api.getContext();
        const characters = context?.characters || [];
        const index = characters.findIndex(c => c.avatar === character.avatar);
        
        if (index === -1) {
            console.error('[ChatLobby] Character not found:', character.avatar);
            return;
        }
        
        // 로비 닫기 (상태 초기화)
        closeLobby();
        
        // 이미 선택된 캐릭터인지 확인
        const isAlreadySelected = (context.characterId === index);
        
        if (!isAlreadySelected) {
            // 다른 캐릭터면 선택 먼저
            await api.selectCharacterById(index);
            
            // 캐릭터 선택 완료 대기 (조건 확인 방식)
            const charSelected = await waitForCharacterSelect(character.avatar, 2000);
            if (!charSelected) {
                console.warn('[ChatLobby] Character selection timeout');
            }
        }
        
        // 바로 드로어 열기 (CustomTheme 호환 - 클릭 대신 클래스 조작)
        if (!openDrawerSafely('rightNavHolder')) {
            // fallback: rightNavDrawerIcon 클릭 시도
            const rightNavIcon = document.getElementById('rightNavDrawerIcon');
            if (rightNavIcon) {
                rightNavIcon.click();
            } else {
                console.warn('[ChatLobby] Could not open character drawer');
            }
        }
    }
    
    /**
     * 캐릭터 설정 열기 (미사용)
     */
    function handleOpenCharSettings() {
        closeLobby();
        setTimeout(() => {
            const charInfoBtn = document.getElementById('option_settings');
            if (charInfoBtn) charInfoBtn.click();
        }, CONFIG.timing.menuCloseDelay);
    }
    
    // ============================================
    // 옵션 메뉴에 버튼 추가
    // ============================================
    
    /**
     * 옵션 메뉴에 Chat Lobby 버튼 추가
     */
    function addLobbyToOptionsMenu() {
        const optionsMenu = document.getElementById('options');
        if (!optionsMenu) {
            setTimeout(addLobbyToOptionsMenu, CONFIG.timing.initDelay);
            return;
        }
        
        if (document.getElementById('option_chat_lobby')) return;
        
        const lobbyOption = document.createElement('a');
        lobbyOption.id = 'option_chat_lobby';
        lobbyOption.innerHTML = '<i class="fa-solid fa-comments"></i> Chat Lobby';
        lobbyOption.style.cssText = 'cursor: pointer;';
        lobbyOption.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // 옵션 메뉴 닫기
            const optionsContainer = document.getElementById('options');
            if (optionsContainer) optionsContainer.style.display = 'none';
            
            openLobby();
        });
        
        optionsMenu.insertBefore(lobbyOption, optionsMenu.firstChild);
    }
    
    /**
     * CustomTheme 사이드바/햄버거 메뉴에 Chat Lobby 버튼 추가
     * - 사이드바(PC): 컨테이너 나타날 때까지 대기 후 한 번만 추가
     * - 햄버거(모바일): MutationObserver로 드롭다운 변화 감지, CustomTheme이 empty() 후 다시 추가
     */
    function addToCustomThemeSidebar() {
        // 중복 초기화 방지 플래그
        if (window._chatLobbyCustomThemeInit) return true;
        window._chatLobbyCustomThemeInit = true;
        
        // 1. 사이드바 버튼 추가 (PC) - CustomTheme drawer 구조 사용
        const addSidebarButton = () => {
            const container = document.getElementById('st-sidebar-top-container');
            if (!container) return false;
            if (document.getElementById('st-chatlobby-sidebar-btn')) return true; // 이미 있음
            
            const btn = document.createElement('div');
            btn.id = 'st-chatlobby-sidebar-btn';
            btn.className = 'drawer st-moved-drawer';
            btn.innerHTML = `
                <div class="drawer-toggle">
                    <div class="drawer-icon fa-solid fa-comments closedIcon" title="Chat Lobby"></div>
                    <span class="st-sidebar-label">Chat Lobby</span>
                </div>
            `;
            btn.querySelector('.drawer-toggle').addEventListener('click', () => openLobby());
            container.appendChild(btn);
            return true;
        };
        
        // 2. 햄버거 버튼 추가 (모바일)
        const addHamburgerButton = () => {
            const dropdown = document.getElementById('st-hamburger-dropdown-content');
            if (!dropdown) return false;
            if (document.getElementById('st-chatlobby-hamburger-btn')) return true; // 이미 있음
            
            const btn = document.createElement('div');
            btn.id = 'st-chatlobby-hamburger-btn';
            btn.className = 'st-dropdown-item';
            btn.innerHTML = `
                <i class="fa-solid fa-comments"></i>
                <span>Chat Lobby</span>
            `;
            btn.addEventListener('click', () => {
                openLobby();
                // 드롭다운 닫기
                document.getElementById('st-hamburger-dropdown')?.classList.remove('st-dropdown-open');
            });
            dropdown.appendChild(btn);
            return true;
        };
        
        // 3. 햄버거 MutationObserver 설정 (CustomTheme이 empty() 호출 시 다시 추가)
        const setupHamburgerObserver = () => {
            const dropdown = document.getElementById('st-hamburger-dropdown-content');
            if (!dropdown) {
                // 드롭다운 없으면 500ms 후 재시도 (최대 20회)
                if (!setupHamburgerObserver._attempts) setupHamburgerObserver._attempts = 0;
                if (++setupHamburgerObserver._attempts < 20) {
                    setTimeout(setupHamburgerObserver, 500);
                }
                return;
            }
            
            // 초기 추가
            addHamburgerButton();
            
            // DOM 변화 감지 (CustomTheme이 empty() 후 다시 채울 때)
            const observer = new MutationObserver(() => {
                // 버튼이 없으면 다시 추가
                if (!document.getElementById('st-chatlobby-hamburger-btn')) {
                    addHamburgerButton();
                }
            });
            observer.observe(dropdown, { childList: true });
        };
        
        // 4. 사이드바: 즉시 시도 → 실패 시 polling (최대 20회, 10초)
        if (!addSidebarButton()) {
            let attempts = 0;
            const interval = intervalManager.set(() => {
                attempts++;
                if (addSidebarButton() || attempts >= 20) {
                    intervalManager.clear(interval);
                }
            }, 500);
        }
        
        // 5. 햄버거 Observer 설정
        setupHamburgerObserver();
        
        return true;
    }

    // ============================================
    // DOM 로드 후 초기화
    // ============================================
    
    /**
     * SillyTavern 컨텍스트가 준비될 때까지 대기
     * @param {number} maxAttempts - 최대 시도 횟수
     * @param {number} interval - 시도 간격 (ms)
     * @returns {Promise<boolean>} 성공 여부
     */
    async function waitForSillyTavern(maxAttempts = 30, interval = 500) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const context = window.SillyTavern?.getContext?.();
            if (context && context.characters) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        console.error('[ChatLobby] SillyTavern context not available after', maxAttempts * interval, 'ms');
        return false;
    }
    
    /**
     * 초기화 완료 후 로비 자동 열기
     */
    async function initAndOpen() {
        // SillyTavern 컨텍스트가 준비될 때까지 대기
        const isReady = await waitForSillyTavern();
        if (!isReady) {
            console.error('[ChatLobby] Cannot initialize - SillyTavern not ready');
            return;
        }
        
        await init();
        // 초기화 완료 후 로비 자동 열기
        setTimeout(() => {
            openLobby();
        }, 100);
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(initAndOpen, CONFIG.timing.initDelay));
    } else {
        setTimeout(initAndOpen, CONFIG.timing.initDelay);
    }
    
})();
