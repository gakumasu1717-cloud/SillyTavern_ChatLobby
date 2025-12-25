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
        
        // 로비 닫기
        console.log('[ChatHandlers] Closing lobby');
        closeLobby();
        
        // 캐릭터 선택
        console.log('[ChatHandlers] Selecting character by id:', index);
        await api.selectCharacterById(index);
        
        // 채팅 열기 - 더 긴 딜레이로 SillyTavern이 준비되도록
        console.log('[ChatHandlers] Waiting before opening chat file...');
        setTimeout(async () => {
            console.log('[ChatHandlers] Now calling openChatByFileName');
            await openChatByFileName(fileName);
        }, CONFIG.timing.drawerOpenDelay); // menuCloseDelay(300) 대신 drawerOpenDelay(500) 사용
        
    } catch (error) {
        console.error('[ChatHandlers] Failed to open chat:', error);
        showToast('채팅을 열지 못했습니다.', 'error');
    }
}

/**
 * 파일명으로 채팅 열기
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
    
    // 채팅 목록이 로드될 때까지 대기 (폴링 방식으로 개선)
    const maxWaitTime = 3000; // 최대 3초 대기
    const pollInterval = 100; // 100ms 간격으로 확인
    let waited = 0;
    
    while (waited < maxWaitTime) {
        const chatItems = document.querySelectorAll('.select_chat_block');
        if (chatItems.length > 0) {
            console.log('[ChatHandlers] Chat list loaded, found', chatItems.length, 'items after', waited, 'ms');
            break;
        }
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        waited += pollInterval;
    }
    
    // 파일명에서 확장자 제거하고 정규화
    const searchName = fileName.replace('.jsonl', '').trim();
    const searchNameWithExt = fileName.endsWith('.jsonl') ? fileName : fileName + '.jsonl';
    
    console.log('[ChatHandlers] Searching for:', { searchName, searchNameWithExt });
    
    /**
     * 정확한 파일명 매칭 (부분 매칭 대신 정확한 매칭)
     * @param {string} itemName - 비교할 파일명
     * @param {string} target - 찾으려는 파일명
     * @returns {boolean}
     */
    function isExactMatch(itemName, target) {
        const cleanItem = itemName.replace('.jsonl', '').trim();
        const cleanTarget = target.replace('.jsonl', '').trim();
        return cleanItem === cleanTarget;
    }
    
    // 채팅 목록에서 해당 파일 찾기 - 정확한 매칭 우선
    const chatSelectors = [
        '.select_chat_block',
        '.past_chat_block', 
        '[data-file-name]'
    ];
    
    for (const selector of chatSelectors) {
        const chatItems = document.querySelectorAll(selector);
        console.log('[ChatHandlers] Checking selector:', selector, 'found', chatItems.length, 'items');
        
        for (let i = 0; i < chatItems.length; i++) {
            const item = chatItems[i];
            
            // data-file-name 속성에서 파일명 가져오기 (가장 정확)
            const itemFileName = item.dataset?.fileName || '';
            
            // .select_chat_block_filename 요소에서 파일명 가져오기
            const fileNameEl = item.querySelector('.select_chat_block_filename');
            const displayName = fileNameEl?.textContent?.trim() || '';
            
            console.log(`[ChatHandlers] Item ${i}:`, { 
                itemFileName, 
                displayName,
                matchesSearchName: isExactMatch(itemFileName, searchName) || isExactMatch(displayName, searchName)
            });
            
            // 정확한 매칭 시도
            if (isExactMatch(itemFileName, searchName) || isExactMatch(itemFileName, searchNameWithExt)) {
                console.log('[ChatHandlers] ✅ MATCH FOUND via itemFileName:', itemFileName);
                await clickChatItemAndVerify(item, fileName);
                return;
            }
            
            if (displayName && isExactMatch(displayName, searchName)) {
                console.log('[ChatHandlers] ✅ MATCH FOUND via displayName:', displayName);
                await clickChatItemAndVerify(item, fileName);
                return;
            }
        }
    }
    
    console.warn('[ChatHandlers] ❌ Chat not found in list:', fileName);
    showToast('채팅 파일을 찾지 못했습니다.', 'warning');
}

/**
 * 채팅 아이템 클릭 후 로드 확인
 * @param {HTMLElement} item - 클릭할 채팅 아이템
 * @param {string} fileName - 기대하는 파일명
 * @returns {Promise<void>}
 */
async function clickChatItemAndVerify(item, fileName) {
    console.log('[ChatHandlers] Clicking chat item...');
    
    // 현재 채팅 파일명 저장 (비교용)
    const context = api.getContext();
    const currentChat = context?.chatId || '';
    console.log('[ChatHandlers] Current chat before click:', currentChat);
    
    // 클릭 실행
    item.click();
    
    // 클릭 후 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 채팅 선택 드로어가 닫히는지 확인
    const drawer = document.getElementById('select_chat_popup');
    if (drawer && drawer.style.display !== 'none') {
        console.log('[ChatHandlers] Drawer still open, waiting...');
        
        // 드로어가 닫힐 때까지 대기 (최대 2초)
        let waitCount = 0;
        while (drawer.style.display !== 'none' && waitCount < 20) {
            await new Promise(resolve => setTimeout(resolve, 100));
            waitCount++;
        }
        
        if (drawer.style.display !== 'none') {
            console.warn('[ChatHandlers] Drawer did not close, trying alternative click');
            // 대체 방법: 직접 이벤트 디스패치
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            item.dispatchEvent(clickEvent);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    // 채팅이 실제로 변경되었는지 확인
    const newContext = api.getContext();
    const newChat = newContext?.chatId || '';
    console.log('[ChatHandlers] Chat after click:', newChat);
    
    if (newChat !== currentChat) {
        console.log('[ChatHandlers] ✅ Chat successfully changed');
    } else {
        console.warn('[ChatHandlers] ⚠️ Chat may not have changed');
    }
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
        
        closeLobby();
        await api.selectCharacterById(parseInt(charIndex));
        
        // 채팅 기록이 있는 경우에만 새 채팅 버튼 클릭
        if (hasChats) {
            setTimeout(() => {
                const newChatBtn = document.getElementById('option_start_new_chat');
                if (newChatBtn) newChatBtn.click();
            }, CONFIG.timing.menuCloseDelay);
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
 * 캐릭터 삭제
 * @returns {Promise<void>}
 */
export async function deleteCharacter() {
    const char = getCurrentCharacter();
    if (!char) {
        showToast('삭제할 캐릭터가 선택되지 않았습니다.', 'error');
        return;
    }
    
    const confirmed = await showConfirm(
        `"${char.name}" 캐릭터를 삭제하시겠습니까?\n\n모든 채팅 기록도 함께 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`,
        '캐릭터 삭제',
        true
    );
    
    if (!confirmed) return;
    
    try {
        const success = await api.deleteCharacter(char.avatar);
        
        if (success) {
            // 로비 데이터 정리
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
            
            // 캐릭터 그리드 새로고침
            const { renderCharacterGrid } = await import('../ui/characterGrid.js');
            await renderCharacterGrid();
            
            showToast(`"${char.name}" 캐릭터가 삭제되었습니다.`, 'success');
        } else {
            showToast('캐릭터 삭제에 실패했습니다.', 'error');
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
 * 로비 닫기
 */
function closeLobby() {
    const container = document.getElementById('chat-lobby-container');
    const fab = document.getElementById('chat-lobby-fab');
    
    if (container) container.style.display = 'none';
    if (fab) fab.style.display = 'flex';
    
    store.setLobbyOpen(false);
    closeChatPanel();
}
