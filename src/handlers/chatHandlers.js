// ============================================
// 채팅 관련 이벤트 핸들러
// ============================================

import { api } from '../api/sillyTavern.js';
import { cache } from '../data/cache.js';
import { storage } from '../data/storage.js';
import { refreshChatList, getCurrentCharacter, closeChatPanel } from '../ui/chatList.js';

// 채팅 열기
export async function openChat(chatInfo) {
    const { fileName, charAvatar, charIndex } = chatInfo;
    
    if (!charAvatar || !fileName) {
        console.error('[ChatLobby] Missing chat data');
        return;
    }
    
    try {
        const context = api.getContext();
        const characters = context?.characters || [];
        const index = characters.findIndex(c => c.avatar === charAvatar);
        
        if (index === -1) {
            console.error('[ChatLobby] Character not found');
            return;
        }
        
        // 로비 닫기
        closeLobby();
        
        // 캐릭터 선택
        await api.selectCharacterById(index);
        
        // 채팅 열기
        setTimeout(async () => {
            await openChatByFileName(fileName);
        }, 300);
        
    } catch (error) {
        console.error('[ChatLobby] Failed to open chat:', error);
    }
}

// 파일명으로 채팅 열기
async function openChatByFileName(fileName) {
    const manageChatsBtn = document.getElementById('option_select_chat');
    
    if (manageChatsBtn) {
        manageChatsBtn.click();
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 채팅 목록에서 해당 파일 찾기
        const chatItems = document.querySelectorAll('.select_chat_block .ch_name, .past_chat_block, .select_chat_block');
        
        for (const item of chatItems) {
            const itemText = item.textContent || item.dataset?.fileName || '';
            if (itemText.includes(fileName.replace('.jsonl', '')) || itemText.includes(fileName)) {
                item.click();
                console.log('[ChatLobby] Chat selected:', fileName);
                return;
            }
        }
        
        console.log('[ChatLobby] Chat not found in list:', fileName);
    }
}

// 채팅 삭제
export async function deleteChat(chatInfo) {
    const { fileName, charAvatar, element } = chatInfo;
    
    if (!fileName || !charAvatar) {
        console.error('[ChatLobby] Missing chat data for delete');
        return;
    }
    
    if (!confirm(`"${fileName.replace('.jsonl', '')}" 채팅을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
        return;
    }
    
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
                element.style.transition = 'opacity 0.3s, transform 0.3s';
                element.style.opacity = '0';
                element.style.transform = 'translateX(20px)';
                
                setTimeout(() => {
                    element.remove();
                    updateChatCountAfterDelete();
                }, 300);
            } else {
                await refreshChatList();
            }
        } else {
            alert('채팅 삭제에 실패했습니다.');
        }
    } catch (error) {
        console.error('[ChatLobby] Error deleting chat:', error);
        alert('채팅 삭제 중 오류가 발생했습니다.');
    }
}

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

// 새 채팅 시작
export async function startNewChat() {
    const btn = document.getElementById('chat-lobby-new-chat');
    const charIndex = btn?.dataset.charIndex;
    const charAvatar = btn?.dataset.charAvatar;
    const hasChats = btn?.dataset.hasChats === 'true';
    
    if (!charIndex || !charAvatar) {
        console.error('[ChatLobby] No character selected');
        return;
    }
    
    // 캐시 무효화
    cache.invalidate('chats', charAvatar);
    
    closeLobby();
    await api.selectCharacterById(parseInt(charIndex));
    
    // 채팅 기록이 있는 경우에만 새 채팅 버튼 클릭
    if (hasChats) {
        setTimeout(() => {
            const newChatBtn = document.getElementById('option_start_new_chat');
            if (newChatBtn) newChatBtn.click();
        }, 300);
    }
}

// 캐릭터 삭제
export async function deleteCharacter() {
    const char = getCurrentCharacter();
    if (!char) return;
    
    if (!confirm(`"${char.name}" 캐릭터를 삭제하시겠습니까?\n\n모든 채팅 기록도 함께 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`)) {
        return;
    }
    
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
    } else {
        alert('캐릭터 삭제에 실패했습니다.');
    }
}

// 로비 닫기 헬퍼
function closeLobby() {
    const container = document.getElementById('chat-lobby-container');
    const fab = document.getElementById('chat-lobby-fab');
    
    if (container) container.style.display = 'none';
    if (fab) fab.style.display = 'flex';
    
    closeChatPanel();
}
