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
    
    if (!charAvatar || !fileName) {
        console.error('[ChatHandlers] Missing chat data');
        showToast('채팅 정보가 올바르지 않습니다.', 'error');
        return;
    }
    
    try {
        const context = api.getContext();
        const characters = context?.characters || [];
        const index = characters.findIndex(c => c.avatar === charAvatar);
        
        if (index === -1) {
            console.error('[ChatHandlers] Character not found');
            showToast('캐릭터를 찾을 수 없습니다.', 'error');
            return;
        }
        
        // 로비 닫기
        closeLobby();
        
        // 캐릭터 선택
        await api.selectCharacterById(index);
        
        // 채팅 열기
        setTimeout(async () => {
            await openChatByFileName(fileName);
        }, CONFIG.timing.menuCloseDelay);
        
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
    const manageChatsBtn = document.getElementById('option_select_chat');
    
    if (!manageChatsBtn) {
        console.error('[ChatHandlers] Chat select button not found');
        showToast('채팅 선택 버튼을 찾을 수 없습니다.', 'error');
        return;
    }
    
    manageChatsBtn.click();
    
    // 채팅 목록이 로드될 때까지 대기
    await new Promise(resolve => setTimeout(resolve, CONFIG.timing.drawerOpenDelay));
    
    // 파일명에서 확장자 제거하고 정규화
    const searchName = fileName.replace('.jsonl', '').trim();
    
    // 채팅 목록에서 해당 파일 찾기 - 여러 셀렉터 시도
    const chatSelectors = [
        '.select_chat_block',
        '.past_chat_block', 
        '[data-file-name]',
        '.ch_name'
    ];
    
    for (const selector of chatSelectors) {
        const chatItems = document.querySelectorAll(selector);
        
        for (const item of chatItems) {
            const itemText = item.textContent?.trim() || '';
            const itemFileName = item.dataset?.fileName || '';
            
            // 파일명 매칭 (확장자 유무 모두 체크)
            if (itemText.includes(searchName) || 
                itemFileName.includes(searchName) ||
                itemFileName.includes(fileName)) {
                item.click();
                console.log('[ChatHandlers] Chat selected:', fileName, 'via', selector);
                return;
            }
        }
    }
    
    console.warn('[ChatHandlers] Chat not found in list:', fileName);
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
