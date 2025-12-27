// ============================================
// ChatLobby 메인 진입점
// ============================================

import { CONFIG } from './config.js';
import { cache } from './data/cache.js';
import { storage } from './data/storage.js';
import { store } from './data/store.js';
import { api } from './api/sillyTavern.js';
import { createLobbyHTML } from './ui/templates.js';
import { renderPersonaBar } from './ui/personaBar.js';
import { renderCharacterGrid, setCharacterSelectHandler, handleSearch, handleSortChange as handleCharSortChange } from './ui/characterGrid.js';
import { renderChatList, setChatHandlers, handleFilterChange, handleSortChange as handleChatSortChange, toggleBatchMode, updateBatchCount, closeChatPanel } from './ui/chatList.js';
import { openChat, deleteChat, startNewChat, deleteCharacter } from './handlers/chatHandlers.js';
import { openFolderModal, closeFolderModal, addFolder, updateFolderDropdowns } from './handlers/folderHandlers.js';
import { showToast } from './ui/notifications.js';
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
        setTimeout(() => addToCustomThemeSidebar(), 1000);
        
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
    function openLobby() {
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
            
            // 렌더링 (context에서 직접 가져오므로 항상 최신)
            renderPersonaBar();
            renderCharacterGrid();
            
            // 폴더 드롭다운 업데이트
            updateFolderDropdowns();
            
            // 현재 채팅 중인 캐릭터 자동 선택
            const currentContext = api.getContext();
            if (currentContext?.characterId !== undefined && currentContext.characterId >= 0) {
                const currentChar = currentContext.characters?.[currentContext.characterId];
                if (currentChar) {
                    // 렌더링 완료 후 선택
                    setTimeout(() => {
                        const charCard = document.querySelector(
                            `.lobby-char-card[data-char-avatar="${currentChar.avatar}"]`
                        );
                        if (charCard) {
                            charCard.classList.add('selected');
                            // 채팅 목록도 로드
                            const characterData = {
                                index: currentContext.characterId,
                                avatar: currentChar.avatar,
                                name: currentChar.name,
                                avatarSrc: `/characters/${encodeURIComponent(currentChar.avatar)}`
                            };
                            renderChatList(characterData);
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
    function closeLobby() {
        const container = document.getElementById('chat-lobby-container');
        const fab = document.getElementById('chat-lobby-fab');
        
        if (container) container.style.display = 'none';
        if (fab) fab.style.display = 'flex';
        
        // 🧹 모든 interval 정리 (메모리 누수 방지)
        intervalManager.clearAll();
        
        store.setLobbyOpen(false);
        store.reset(); // 상태 초기화
        closeChatPanel();
    }
    
    // 전역 새로고침 함수
    window.chatLobbyRefresh = async function() {
        cache.invalidateAll();
        await renderPersonaBar();
        await renderCharacterGrid();
    };
    
    // ============================================
    // 이벤트 위임 (Event Delegation)
    // ============================================
    
    /**
     * 이벤트 위임 설정
     * getElementById 대신 상위 컨테이너에서 이벤트를 위임 처리
     */
    function setupEventDelegation() {
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
    function handleAction(action, el, e) {
        switch (action) {
            case 'open-lobby':
                openLobby();
                break;
            case 'close-lobby':
                closeLobby();
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
            case 'import-char':
                handleImportCharacter();
                break;
            case 'add-persona':
                handleAddPersona();
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
                if (isMobile()) closeChatPanel();
                break;
            case 'go-to-character':
                handleGoToCharacter();
                break;
        }
    }
    
    /**
     * 키보드 이벤트 핸들러
     * @param {KeyboardEvent} e
     */
    function handleKeydown(e) {
        if (e.key === 'Escape') {
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
     * CustomTheme 사이드바에 Chat Lobby 버튼 추가
     * CustomTheme 확장이 있으면 사이드바에 버튼 추가
     */
    function addToCustomThemeSidebar() {
        // CustomTheme 사이드바 찾기 (여러 가능한 셀렉터)
        const sidebar = document.querySelector('#st-custom-sidebar, .st-sidebar, [data-st-sidebar]');
        if (!sidebar) return false;
        
        // 이미 추가됐으면 스킵
        if (document.getElementById('st-chatlobby-sidebar-btn')) return true;
        
        // 버튼 컨테이너 찾기
        const sidebarTop = sidebar.querySelector('.st-sidebar-top, .sidebar-top, .st-sidebar-items');
        if (!sidebarTop) return false;
        
        // 버튼 만들기
        const btn = document.createElement('div');
        btn.id = 'st-chatlobby-sidebar-btn';
        btn.className = 'st-sidebar-item';
        btn.title = 'Chat Lobby';
        btn.innerHTML = `
            <i class="fa-solid fa-comments"></i>
            <span class="st-sidebar-label">채팅 로비</span>
        `;
        btn.style.cssText = 'cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 8px 12px;';
        btn.addEventListener('click', () => {
            openLobby();
        });
        
        // 사이드바에 추가
        sidebarTop.appendChild(btn);
        
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
