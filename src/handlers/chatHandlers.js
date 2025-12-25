// ============================================
// 채팅 관련 이벤트 핸들러
// ============================================

import { api } from '../api/sillyTavern.js';
import { cache } from '../data/cache.js';
import { storage } from '../data/storage.js';
import { store } from '../data/store.js';
import { refreshChatList, getCurrentCharacter, closeChatPanel } from '../ui/chatList.js';
import { showToast, showConfirm, showAlert } from '../ui/notifications.js';
import { CONFIG } from '../config.js';
import { waitFor, waitForCharacterSelect, waitForElement } from '../utils/waitFor.js';
import { isMobile } from '../utils/eventHelpers.js';

// ============================================
// 채팅 열기
// ============================================

/**
 * 채팅 열기
 * @param {{ fileName: string, charAvatar: string, charIndex: string }} chatInfo
 * @returns {Promise<void>}
 */
export async function openChat(chatInfo) {
    const { fileName, charAvatar, charIndex } = chatInfo;
    
    console.log('[ChatHandlers] openChat called:', { fileName, charAvatar, charIndex });
    
    if (!charAvatar || !fileName) {
        console.error('[ChatHandlers] Missing chat data');
        showToast('채팅 정보가 올바르지 않습니다.', 'error');
        return;
    }
    
    try {
        const context = api.getContext();
        const characters = context?.characters || [];
        const index = characters.findIndex(c => c.avatar === charAvatar);
        
        console.log('[ChatHandlers] Found character at index:', index);
        
        if (index === -1) {
            console.error('[ChatHandlers] Character not found');
            showToast('캐릭터를 찾을 수 없습니다.', 'error');
            return;
        }
        
        // 파일명 정규화 (확장자 제거)
        const chatFileName = fileName.replace('.jsonl', '');
        
        // 1. 캐릭터 선택
        console.log('[ChatHandlers] Selecting character');
        await api.selectCharacterById(index);
        
        // 2. 캐릭터 선택 완료 대기 (조건 확인 방식)
        const charSelected = await waitForCharacterSelect(charAvatar, 2000);
        if (!charSelected) {
            console.warn('[ChatHandlers] Character selection timeout, continuing anyway');
        }
        
        // 3. 로비 닫기 (상태 유지하면서)
        console.log('[ChatHandlers] Closing lobby (keeping state)');
        closeLobbyKeepState();
        
        // 4. SillyTavern openCharacterChat 함수 사용
        if (typeof context?.openCharacterChat === 'function') {
            console.log('[ChatHandlers] Using context.openCharacterChat:', chatFileName);
            try {
                await context.openCharacterChat(chatFileName);
                console.log('[ChatHandlers] ✅ Chat opened via context.openCharacterChat');
                return;
            } catch (err) {
                console.warn('[ChatHandlers] context.openCharacterChat failed:', err);
            }
        }
        
        // 5. Fallback: 채팅 선택 UI 클릭
        console.log('[ChatHandlers] Fallback: clicking chat item in UI');
        await openChatByFileName(fileName);
        
    } catch (error) {
        console.error('[ChatHandlers] Failed to open chat:', error);
        showToast('채팅을 열지 못했습니다.', 'error');
    }
}

/**
 * 파일명으로 채팅 열기 (UI 클릭 방식)
 * @param {string} fileName - 채팅 파일명
 * @returns {Promise<void>}
 */
async function openChatByFileName(fileName) {
    console.log('[ChatHandlers] openChatByFileName called with:', fileName);
    
    const manageChatsBtn = document.getElementById('option_select_chat');
    
    if (!manageChatsBtn) {
        console.error('[ChatHandlers] Chat select button not found');
        showToast('채팅 선택 버튼을 찾을 수 없습니다.', 'error');
        return;
    }
    
    console.log('[ChatHandlers] Clicking option_select_chat button');
    manageChatsBtn.click();
    
    // 채팅 목록이 로드될 때까지 대기 (조건 확인 방식)
    const listLoaded = await waitFor(() => {
        return document.querySelectorAll('.select_chat_block').length > 0;
    }, 3000);
    
    if (!listLoaded) {
        console.error('[ChatHandlers] Chat list did not load');
        showToast('채팅 목록을 불러오지 못했습니다.', 'error');
        return;
    }
    
    // 파일명에서 확장자 제거하고 정규화
    const searchName = fileName.replace('.jsonl', '').trim();
    
    console.log('[ChatHandlers] Searching for:', searchName);
    
    /**
     * 정확한 파일명 매칭
     */
    function isExactMatch(itemName, target) {
        const cleanItem = itemName.replace('.jsonl', '').trim();
        const cleanTarget = target.replace('.jsonl', '').trim();
        return cleanItem === cleanTarget;
    }
    
    // 채팅 목록에서 해당 파일 찾기
    const chatItems = document.querySelectorAll('.select_chat_block');
    console.log('[ChatHandlers] Found', chatItems.length, 'chat items');
    
    for (const item of chatItems) {
        // file_name 속성에서 파일명 가져오기 (SillyTavern 표준)
        const itemFileName = item.getAttribute('file_name') || '';
        
        if (isExactMatch(itemFileName, searchName)) {
            console.log('[ChatHandlers] ✅ MATCH FOUND:', itemFileName);
            
            // jQuery 클릭 (SillyTavern 방식)
            if (window.$) {
                window.$(item).trigger('click');
            } else {
                item.click();
            }
            
            console.log('[ChatHandlers] Click executed');
            return;
        }
    }
    
    console.warn('[ChatHandlers] ❌ Chat not found in list:', fileName);
    showToast('채팅 파일을 찾지 못했습니다.', 'warning');
}

// ============================================
// 채팅 삭제
// ============================================

/**
 * 채팅 삭제
 * @param {{ fileName: string, charAvatar: string, element: HTMLElement }} chatInfo
 * @returns {Promise<void>}
 */
export async function deleteChat(chatInfo) {
    const { fileName, charAvatar, element } = chatInfo;
    
    if (!fileName || !charAvatar) {
        console.error('[ChatHandlers] Missing chat data for delete');
        showToast('삭제할 채팅 정보가 없습니다.', 'error');
        return;
    }
    
    // 삭제 전 실제 존재 여부 확인 (이중 클릭/레이스컨디션 방지)
    const cachedChats = cache.get('chats', charAvatar);
    const chatExists = cachedChats?.some(c => 
        (c.file_name || c.fileName) === fileName
    );
    
    if (!chatExists) {
        showToast('이미 삭제되었거나 찾을 수 없는 채팅입니다.', 'warning');
        if (element) element.remove();
        return;
    }
    
    const displayName = fileName.replace('.jsonl', '');
    const confirmed = await showConfirm(
        `"${displayName}" 채팅을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`,
        '채팅 삭제',
        true
    );
    
    if (!confirmed) return;
    
    try {
        const success = await api.deleteChat(fileName, charAvatar);
        
        if (success) {
            // 로컬 데이터 정리
            const data = storage.load();
            const key = storage.getChatKey(charAvatar, fileName);
            
            delete data.chatAssignments[key];
            const favIndex = data.favorites.indexOf(key);
            if (favIndex > -1) {
                data.favorites.splice(favIndex, 1);
            }
            storage.save(data);
            
            // UI에서 제거
            if (element) {
                element.style.transition = `opacity ${CONFIG.timing.animationDuration}ms, transform ${CONFIG.timing.animationDuration}ms`;
                element.style.opacity = '0';
                element.style.transform = 'translateX(20px)';
                
                setTimeout(() => {
                    element.remove();
                    updateChatCountAfterDelete();
                }, CONFIG.timing.animationDuration);
            } else {
                await refreshChatList();
            }
            
            showToast('채팅이 삭제되었습니다.', 'success');
        } else {
            showToast('채팅 삭제에 실패했습니다.', 'error');
        }
    } catch (error) {
        console.error('[ChatHandlers] Error deleting chat:', error);
        showToast('채팅 삭제 중 오류가 발생했습니다.', 'error');
    }
}

/**
 * 삭제 후 채팅 수 업데이트
 */
function updateChatCountAfterDelete() {
    const remaining = document.querySelectorAll('.lobby-chat-item').length;
    const countEl = document.getElementById('chat-panel-count');
    
    if (countEl) {
        countEl.textContent = remaining > 0 ? `${remaining}개 채팅` : '채팅 없음';
    }
    
    if (remaining === 0) {
        const chatsList = document.getElementById('chat-lobby-chats-list');
        if (chatsList) {
            chatsList.innerHTML = `
                <div class="lobby-empty-state">
                    <i>💬</i>
                    <div>채팅 기록이 없습니다</div>
                </div>
            `;
        }
    }
}

// ============================================
// 새 채팅 시작
// ============================================

/**
 * 새 채팅 시작
 * @returns {Promise<void>}
 */
export async function startNewChat() {
    const btn = document.getElementById('chat-lobby-new-chat');
    const charIndex = btn?.dataset.charIndex;
    const charAvatar = btn?.dataset.charAvatar;
    const hasChats = btn?.dataset.hasChats === 'true';
    
    if (!charIndex || !charAvatar) {
        console.error('[ChatHandlers] No character selected');
        showToast('캐릭터가 선택되지 않았습니다.', 'error');
        return;
    }
    
    try {
        // 캐시 무효화
        cache.invalidate('chats', charAvatar);
        
        // 로비 닫기 (상태 유지)
        closeLobbyKeepState();
        
        await api.selectCharacterById(parseInt(charIndex));
        
        // 캐릭터 선택 완료 대기
        await waitForCharacterSelect(charAvatar, 2000);
        
        // 채팅 기록이 있는 경우에만 새 채팅 버튼 클릭
        if (hasChats) {
            const newChatBtn = await waitForElement('#option_start_new_chat', 1000);
            if (newChatBtn) newChatBtn.click();
        }
    } catch (error) {
        console.error('[ChatHandlers] Failed to start new chat:', error);
        showToast('새 채팅을 시작하지 못했습니다.', 'error');
    }
}

// ============================================
// 캐릭터 삭제
// ============================================

/**
 * 캐릭터 삭제 (SillyTavern 내장 함수 사용)
 * @returns {Promise<void>}
 */
export async function deleteCharacter() {
    // store 대신 버튼의 dataset에서 직접 가져오기 (레이스컨디션 방지)
    const deleteBtn = document.getElementById('chat-lobby-delete-char');
    const charAvatar = deleteBtn?.dataset.charAvatar;
    const charName = deleteBtn?.dataset.charName;
    
    if (!charAvatar) {
        showToast('삭제할 캐릭터가 선택되지 않았습니다.', 'error');
        return;
    }
    
    // context에서 실제 캐릭터 객체 확인 (최신 상태)
    const context = api.getContext();
    const char = context?.characters?.find(c => c.avatar === charAvatar);
    
    if (!char) {
        showToast('캐릭터를 찾을 수 없습니다. 이미 삭제되었을 수 있어요.', 'error');
        closeChatPanel();
        return;
    }
    
    // 사용자 확인
    const confirmed = await showConfirm(
        `"${char.name}" 캐릭터와 모든 채팅을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`
    );
    
    if (!confirmed) {
        return;
    }
    
    try {
        // 로비 데이터 먼저 정리
        const data = storage.load();
        const prefix = char.avatar + '_';
        
        Object.keys(data.chatAssignments).forEach(key => {
            if (key.startsWith(prefix)) {
                delete data.chatAssignments[key];
            }
        });
        
        data.favorites = data.favorites.filter(key => !key.startsWith(prefix));
        storage.save(data);
        
        // UI 리셋
        closeChatPanel();
        
        // SillyTavern 내장 deleteCharacter 함수 사용 시도
        const context = api.getContext();
        
        if (typeof context?.deleteCharacter === 'function') {
            // SillyTavern 내장 함수 사용 (context.characters 자동 갱신됨)
            console.log('[ChatLobby] Using SillyTavern deleteCharacter function');
            await context.deleteCharacter(char.avatar, { deleteChats: true });
        } else {
            // Fallback: 직접 API 호출 후 getCharacters로 갱신
            console.log('[ChatLobby] Using direct API call');
            const headers = api.getRequestHeaders();
            const avatarUrl = char.avatar.endsWith('.png') ? char.avatar : `${char.avatar}.png`;
            
            const response = await fetch('/api/characters/delete', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    avatar_url: avatarUrl,
                    delete_chats: true
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[ChatLobby] Delete response:', response.status, errorText);
                throw new Error(`Delete failed: ${response.status} - ${errorText}`);
            }
            
            // API 삭제 성공 후 SillyTavern의 characters 배열 갱신
            if (typeof context?.getCharacters === 'function') {
                console.log('[ChatLobby] Refreshing characters via getCharacters()');
                await context.getCharacters();
            }
        }
        
        // 캐시 무효화
        cache.invalidate('characters');
        cache.invalidate('chats', char.avatar);
        
        showToast(`"${char.name}" 캐릭터가 삭제되었습니다.`, 'success');
        
        // 그리드 새로고침 (로비가 열려있으면)
        const overlay = document.getElementById('chat-lobby-overlay');
        if (overlay?.style.display === 'flex') {
            // 동적 import로 순환 참조 방지
            const { renderCharacterGrid } = await import('../ui/characterGrid.js');
            await renderCharacterGrid();
        }
        
    } catch (error) {
        console.error('[ChatHandlers] Failed to delete character:', error);
        showToast('캐릭터 삭제 중 오류가 발생했습니다.', 'error');
    }
}

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 로비 닫기 (상태 유지)
 * - 채팅을 열면서 닫을 때 사용
 * - 캐싱된 상태를 유지하여 다시 열 때 빠르게 복원
 * - store.reset()을 호출하지 않음
 */
function closeLobbyKeepState() {
    const container = document.getElementById('chat-lobby-container');
    const fab = document.getElementById('chat-lobby-fab');
    
    if (container) container.style.display = 'none';
    if (fab) fab.style.display = 'flex';
    
    store.setLobbyOpen(false);
    closeChatPanel();
    // 주의: store.reset()을 호출하지 않음 - 상태 유지
}
