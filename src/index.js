// ============================================
// ChatLobby 메인 진입점
// ============================================

import { CONFIG } from './config.js';
import { cache } from './data/cache.js';
import { storage } from './data/storage.js';
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
        
        // 이벤트 리스너 등록
        bindEvents();
        
        // 백그라운드 프리로딩 시작
        startBackgroundPreload();
        
        // 옵션 메뉴에 버튼 추가
        addLobbyToOptionsMenu();
        
        console.log('[ChatLobby] Extension initialized');
    }
    
    function removeExistingUI() {
        ['chat-lobby-overlay', 'chat-lobby-fab', 'chat-lobby-folder-modal', 'chat-lobby-global-tooltip'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
    }
    
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
        }, 2000);
    }
    
    // ============================================
    // 로비 열기/닫기
    // ============================================
    
    function openLobby() {
        const overlay = document.getElementById('chat-lobby-overlay');
        const container = document.getElementById('chat-lobby-container');
        const fab = document.getElementById('chat-lobby-fab');
        
        if (overlay) {
            overlay.style.display = 'flex';
            if (container) container.style.display = 'flex';
            if (fab) fab.style.display = 'none';
            
            // 배치 모드 리셋
            const batchBtn = document.getElementById('chat-lobby-batch-mode');
            if (batchBtn?.classList.contains('active')) {
                toggleBatchMode();
            }
            
            // 캐시된 데이터로 즉시 렌더링 (캐시 있으면 0ms)
            renderPersonaBar();
            renderCharacterGrid();
            
            // 폴더 드롭다운 업데이트
            updateFolderDropdowns();
        }
    }
    
    function closeLobby() {
        const container = document.getElementById('chat-lobby-container');
        const fab = document.getElementById('chat-lobby-fab');
        
        if (container) container.style.display = 'none';
        if (fab) fab.style.display = 'flex';
        
        closeChatPanel();
    }
    
    // 전역 새로고침 함수
    window.chatLobbyRefresh = async function() {
        cache.invalidateAll();
        await renderPersonaBar();
        await renderCharacterGrid();
    };
    
    // ============================================
    // 이벤트 바인딩
    // ============================================
    
    function bindEvents() {
        // FAB 버튼
        document.getElementById('chat-lobby-fab')?.addEventListener('click', openLobby);
        
        // 닫기 버튼
        document.getElementById('chat-lobby-close')?.addEventListener('click', closeLobby);
        
        // 뒤로 가기 (모바일)
        document.getElementById('chat-lobby-chats-back')?.addEventListener('click', () => {
            if (isMobile()) {
                closeChatPanel();
            }
        });
        
        // 새로고침
        document.getElementById('chat-lobby-refresh')?.addEventListener('click', async () => {
            cache.invalidateAll();
            await renderPersonaBar();
            await renderCharacterGrid();
        });
        
        // 새 채팅
        document.getElementById('chat-lobby-new-chat')?.addEventListener('click', startNewChat);
        
        // 캐릭터 삭제
        document.getElementById('chat-lobby-delete-char')?.addEventListener('click', deleteCharacter);
        
        // 캐릭터 임포트
        document.getElementById('chat-lobby-import-char')?.addEventListener('click', () => {
            closeLobby();
            setTimeout(() => {
                const importBtn = document.getElementById('character_import_button');
                if (importBtn) importBtn.click();
            }, 300);
        });
        
        // 페르소나 추가
        document.getElementById('chat-lobby-add-persona')?.addEventListener('click', () => {
            closeLobby();
            setTimeout(() => {
                const personaDrawer = document.getElementById('persona-management-button');
                const drawerIcon = personaDrawer?.querySelector('.drawer-icon');
                if (drawerIcon) drawerIcon.click();
                
                setTimeout(() => {
                    const createBtn = document.getElementById('create_dummy_persona');
                    if (createBtn) createBtn.click();
                }, 500);
            }, 300);
        });
        
        // 캐릭터 아바타 클릭 (설정 열기)
        document.getElementById('chat-panel-avatar')?.addEventListener('click', () => {
            closeLobby();
            setTimeout(() => {
                const charInfoBtn = document.getElementById('option_settings');
                if (charInfoBtn) charInfoBtn.click();
            }, 300);
        });
        
        // 검색
        const searchInput = document.getElementById('chat-lobby-search-input');
        searchInput?.addEventListener('input', (e) => {
            handleSearch(e.target.value);
        });
        
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
        
        // 배치 모드
        document.getElementById('chat-lobby-batch-mode')?.addEventListener('click', toggleBatchMode);
        
        // 배치 이동
        document.getElementById('batch-move-btn')?.addEventListener('click', () => {
            const folder = document.getElementById('batch-move-folder')?.value;
            executeBatchMove(folder);
        });
        
        // 배치 취소
        document.getElementById('batch-cancel-btn')?.addEventListener('click', toggleBatchMode);
        
        // 배치 체크박스 변경
        document.getElementById('chat-lobby-chats-list')?.addEventListener('change', (e) => {
            if (e.target.classList.contains('chat-select-cb')) {
                updateBatchCount();
            }
        });
        
        // 폴더 관리
        document.getElementById('chat-lobby-folder-manage')?.addEventListener('click', openFolderModal);
        document.getElementById('folder-modal-close')?.addEventListener('click', closeFolderModal);
        document.getElementById('add-folder-btn')?.addEventListener('click', addFolder);
        document.getElementById('new-folder-name')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') addFolder();
        });
        
        // ESC로 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const folderModal = document.getElementById('chat-lobby-folder-modal');
                if (folderModal?.style.display === 'flex') {
                    closeFolderModal();
                } else {
                    const overlay = document.getElementById('chat-lobby-overlay');
                    if (overlay?.style.display !== 'none') {
                        closeLobby();
                    }
                }
            }
        });
    }
    
    // ============================================
    // 옵션 메뉴에 버튼 추가
    // ============================================
    
    function addLobbyToOptionsMenu() {
        const optionsMenu = document.getElementById('options');
        if (!optionsMenu) {
            setTimeout(addLobbyToOptionsMenu, 1000);
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
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1000));
    } else {
        setTimeout(init, 1000);
    }
    
})();
