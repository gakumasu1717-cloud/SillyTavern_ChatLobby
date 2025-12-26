// ============================================
// ChatLobby 메인 진입점
// ============================================

import { CONFIG } from './config.js';
import { cache } from './data/cache.js';
import { storage } from './data/storage.js';
import { store } from './data/store.js';
import { api } from './api/sillyTavern.js';
import { createLobbyHTML, getBatchFoldersHTML } from './ui/templates.js';
import { renderPersonaBar } from './ui/personaBar.js';
import { renderCharacterGrid, setCharacterSelectHandler, handleSearch, handleSortChange as handleCharSortChange } from './ui/characterGrid.js';
import { renderChatList, setChatHandlers, handleFilterChange, handleSortChange as handleChatSortChange, toggleBatchMode, executeBatchMove, updateBatchCount, closeChatPanel } from './ui/chatList.js';
import { openChat, deleteChat, startNewChat, deleteCharacter } from './handlers/chatHandlers.js';
import { openFolderModal, closeFolderModal, addFolder, updateFolderDropdowns } from './handlers/folderHandlers.js';
import { showToast } from './ui/notifications.js';
import { debounce, isMobile } from './utils/eventHelpers.js';
import { waitFor, waitForCharacterSelect, waitForElement } from './utils/waitFor.js';

(function() {
    'use strict';
    
    console.log('[ChatLobby] Loading extension...');
    
    // ============================================
    // 초기화
    // ============================================
    
    /**
     * 익스텐션 초기화
     * @returns {Promise<void>}
     */
    async function init() {
        console.log('[ChatLobby] Initializing...');
        
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
        
        console.log('[ChatLobby] Extension initialized');
    }
    
    /**
     * SillyTavern 이벤트 리스닝 설정
     * 캐릭터 삭제/추가/수정 등의 이벤트를 감지하여 캐시 무효화
     */
    function setupSillyTavernEvents() {
        const context = window.SillyTavern?.getContext?.();
        if (!context?.eventSource) {
            console.warn('[ChatLobby] SillyTavern eventSource not found');
            return;
        }
        
        const { eventSource, eventTypes } = context;
        
        // 캐릭터 삭제 시 캐시 무효화
        eventSource.on(eventTypes.CHARACTER_DELETED, () => {
            console.log('[ChatLobby] Character deleted, invalidating cache');
            cache.invalidate('characters');
            // 로비가 열려있으면 새로고침
            if (isLobbyOpen()) {
                renderCharacterGrid(store.searchTerm);
            }
        });
        
        // 캐릭터 수정 시 (즐겨찾기 포함)
        if (eventTypes.CHARACTER_EDITED) {
            eventSource.on(eventTypes.CHARACTER_EDITED, () => {
                console.log('[ChatLobby] Character edited, refreshing grid');
                cache.invalidate('characters');
                if (isLobbyOpen()) {
                    renderCharacterGrid(store.searchTerm);
                }
            });
        }
        
        // 캐릭터 추가 시 (임포트 포함)
        if (eventTypes.CHARACTER_ADDED) {
            eventSource.on(eventTypes.CHARACTER_ADDED, () => {
                console.log('[ChatLobby] Character added, refreshing grid');
                cache.invalidate('characters');
                if (isLobbyOpen()) {
                    renderCharacterGrid(store.searchTerm);
                }
            });
        }
        
        // 채팅 변경 시 (새 캐릭터 선택 포함)
        eventSource.on(eventTypes.CHAT_CHANGED, () => {
            console.log('[ChatLobby] Chat changed, invalidating character cache');
            cache.invalidate('characters');
        });
        
        console.log('[ChatLobby] SillyTavern events registered');
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
     * context.characters를 직접 사용하므로 캐시 무효화 불필요
     */
    function openLobby() {
        console.log('[ChatLobby] Opening lobby...');
        
        // 이미 열려있고 채팅 패널이 표시 중이면 무시
        const chatsPanel = document.getElementById('chat-lobby-chats');
        if (store.isLobbyOpen && chatsPanel?.classList.contains('visible')) {
            console.log('[ChatLobby] Lobby already open with chat panel, ignoring');
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
                    console.log('[ChatLobby] Auto-selecting current character:', currentChar.name);
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
            
            console.log('[ChatLobby] Lobby opened, handler status:', !!store.onCharacterSelect);
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
            console.log('[EventDelegation] FAB clicked');
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
        
        // ID 기반 분기 (기존 HTML과 호환)
        const clickedEl = target.closest('button, [id]');
        const id = clickedEl?.id || target.id;
        
        if (!id) return;
        
        console.log('[EventDelegation] Lobby click - id:', id);
        
        switch (id) {
            case 'chat-lobby-fab':
                openLobby();
                break;
            case 'chat-lobby-close':
                closeLobby();
                break;
            case 'chat-lobby-chats-back':
                if (isMobile()) closeChatPanel();
                break;
            case 'chat-lobby-refresh':
                handleRefresh();
                break;
            case 'chat-lobby-new-chat':
                startNewChat();
                break;
            case 'chat-lobby-delete-char':
                deleteCharacter();
                break;
            case 'chat-lobby-import-char':
                handleImportCharacter();
                break;
            case 'chat-lobby-add-persona':
                handleAddPersona();
                break;
            case 'chat-panel-avatar':
                // 선택된 캐릭터 화면으로 이동
                handleGoToCharacter();
                break;
            case 'chat-lobby-batch-mode':
                toggleBatchMode();
                break;
            case 'batch-move-btn':
                handleBatchMove();
                break;
            case 'batch-cancel-btn':
                toggleBatchMode();
                break;
            case 'chat-lobby-folder-manage':
                openFolderModal();
                break;
            case 'folder-modal-close':
                closeFolderModal();
                break;
            case 'add-folder-btn':
                addFolder();
                break;
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
            case 'toggle-batch':
                toggleBatchMode();
                break;
            // 필요에 따라 추가
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
        console.log('[ChatLobby] Force refresh - invalidating all cache');
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
     * SillyTavern 이벤트가 context.characters를 자동 업데이트하므로
     * 다음 렌더링 시 자동 반영됨
     */
    function handleImportCharacter() {
        // 임포트 버튼 클릭 (로비는 유지)
        const importBtn = document.getElementById('character_import_button');
        if (importBtn) {
            importBtn.click();
            // 임포트 완료 후 사용자가 로비로 돌아오면 
            // context.characters에서 최신 데이터 가져옴
        }
    }
    
    /**
     * 페르소나 추가 처리
     * 드로어 열어서 더미 페르소나 만들기
     */
    async function handleAddPersona() {
        // 드로어 열기
        const personaDrawer = document.getElementById('persona-management-button');
        const drawerIcon = personaDrawer?.querySelector('.drawer-icon');
        if (!drawerIcon) return;
        
        drawerIcon.click();
        
        // 버튼이 나타날 때까지 대기
        const createBtn = await waitForElement('#create_dummy_persona', 2000);
        if (createBtn) {
            createBtn.click();
            // 페르소나 추가 후 캐시 무효화
            cache.invalidate('personas');
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
        
        console.log('[ChatLobby] Opening character editor for:', character.name);
        
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
        console.log('[ChatLobby] isAlreadySelected:', isAlreadySelected, 'context.characterId:', context.characterId, 'index:', index);
        
        if (!isAlreadySelected) {
            // 다른 캐릭터면 선택 먼저
            await api.selectCharacterById(index);
            
            // 캐릭터 선택 완료 대기 (조건 확인 방식)
            const charSelected = await waitForCharacterSelect(character.avatar, 2000);
            if (!charSelected) {
                console.warn('[ChatLobby] Character selection timeout');
            }
        }
        
        // 바로 드로어 열기
        const rightNavIcon = document.getElementById('rightNavDrawerIcon');
        if (rightNavIcon) {
            console.log('[ChatLobby] Clicking rightNavDrawerIcon');
            rightNavIcon.click();
        } else {
            console.warn('[ChatLobby] rightNavDrawerIcon not found');
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
    
    /**
     * 배치 이동 처리
     */
    function handleBatchMove() {
        const folder = document.getElementById('batch-move-folder')?.value;
        executeBatchMove(folder);
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
        console.log('[ChatLobby] Added to options menu');
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
                console.log('[ChatLobby] SillyTavern context ready after', attempt * interval, 'ms');
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
