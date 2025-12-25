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
import { debounce, isMobile } from './utils/eventHelpers.js';

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
        
        // 백그라운드 프리로딩 시작
        startBackgroundPreload();
        
        // 옵션 메뉴에 버튼 추가
        addLobbyToOptionsMenu();
        
        console.log('[ChatLobby] Extension initialized');
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
     */
    function openLobby() {
        // 스택 트레이스로 호출 위치 확인
        console.log('[ChatLobby] Opening lobby... called from:');
        console.trace();
        
        // 이미 열려있고 채팅 패널이 표시 중이면 무시
        const chatsPanel = document.getElementById('chat-lobby-chats');
        if (store.isLobbyOpen && chatsPanel?.classList.contains('visible')) {
            console.log('[ChatLobby] Lobby already open with chat panel, ignoring openLobby call');
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
            
            // 캐시된 데이터로 즉시 렌더링 (캐시 있으면 0ms)
            renderPersonaBar();
            renderCharacterGrid();
            
            // 폴더 드롭다운 업데이트
            updateFolderDropdowns();
            
            console.log('[ChatLobby] Lobby opened, handler status:', !!store.onCharacterSelect);
        }
    }
    
    /**
     * 로비 닫기
     */
    function closeLobby() {
        const container = document.getElementById('chat-lobby-container');
        const fab = document.getElementById('chat-lobby-fab');
        
        if (container) container.style.display = 'none';
        if (fab) fab.style.display = 'flex';
        
        store.setLobbyOpen(false);
        store.reset();
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
        
        // 캐릭터 카드나 채팅 아이템 클릭은 무시 (각자 핸들러가 있음)
        if (target.closest('.lobby-char-card') || target.closest('.lobby-chat-item')) {
            console.log('[EventDelegation] Ignoring click on card/chat item');
            return;
        }
        
        // data-action 속성으로 액션 분기
        const actionEl = target.closest('[data-action]');
        if (actionEl) {
            handleAction(actionEl.dataset.action, actionEl, e);
            return;
        }
        
        // ID 기반 분기 (기존 HTML과 호환)
        const id = target.id || target.closest('[id]')?.id;
        
        // 로비 컨테이너 내부 클릭은 무시 (의도치 않은 ID 매칭 방지)
        if (target.closest('#chat-lobby-container') && !target.closest('button') && !target.closest('[data-action]')) {
            // 버튼이 아닌 컨테이너 내부 클릭은 무시
            if (!['chat-lobby-fab', 'chat-lobby-close', 'chat-lobby-chats-back', 'chat-lobby-refresh', 
                  'chat-lobby-new-chat', 'chat-lobby-delete-char', 'chat-lobby-import-char', 
                  'chat-lobby-add-persona', 'chat-panel-avatar', 'chat-lobby-batch-mode',
                  'batch-move-btn', 'batch-cancel-btn', 'chat-lobby-folder-manage', 
                  'folder-modal-close', 'add-folder-btn'].includes(id)) {
                return;
            }
        }
        
        console.log('[EventDelegation] handleBodyClick - id:', id);
        
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
                handleOpenCharSettings();
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
     * 새로고침 처리
     */
    async function handleRefresh() {
        cache.invalidateAll();
        await renderPersonaBar();
        await renderCharacterGrid();
    }
    
    /**
     * 캐릭터 임포트 처리
     */
    function handleImportCharacter() {
        closeLobby();
        setTimeout(() => {
            const importBtn = document.getElementById('character_import_button');
            if (importBtn) importBtn.click();
        }, CONFIG.timing.menuCloseDelay);
    }
    
    /**
     * 페르소나 추가 처리
     */
    function handleAddPersona() {
        closeLobby();
        setTimeout(() => {
            const personaDrawer = document.getElementById('persona-management-button');
            const drawerIcon = personaDrawer?.querySelector('.drawer-icon');
            if (drawerIcon) drawerIcon.click();
            
            setTimeout(() => {
                const createBtn = document.getElementById('create_dummy_persona');
                if (createBtn) createBtn.click();
            }, CONFIG.timing.drawerOpenDelay);
        }, CONFIG.timing.menuCloseDelay);
    }
    
    /**
     * 캐릭터 설정 열기
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
