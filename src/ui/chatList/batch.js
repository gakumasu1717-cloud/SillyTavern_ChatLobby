// ============================================
// 채팅 목록 - 배치 모드
// ============================================

import { api } from '../../api/sillyTavern.js';
import { cache } from '../../data/cache.js';
import { storage } from '../../data/storage.js';
import { store } from '../../data/store.js';
import { operationLock } from '../../utils/operationLock.js';
import { showToast, showAlert, showConfirm } from '../notifications.js';
import { getFoldersOptionsHTML } from '../templates.js';
import { refreshCurrentChatList } from './charChatList.js';
import { removeChat as removeSessionChat } from '../../data/sessionStore.js';
import { openSessionPicker } from '../sessions/sessionPicker.js';

// ============================================
// 배치 모드
// ============================================

/**
 * 배치 모드 토글
 */
export function toggleBatchMode() {
    const isActive = store.toggleBatchMode();
    
    const chatsList = document.getElementById('chat-lobby-chats-list');
    const toolbar = document.getElementById('chat-lobby-batch-toolbar');
    const batchBtn = document.getElementById('chat-lobby-batch-mode');
    
    
    if (isActive) {
        chatsList?.classList.add('batch-mode');
        toolbar?.classList.add('visible');
        batchBtn?.classList.add('active');
        chatsList?.querySelectorAll('.chat-checkbox').forEach(cb => cb.style.display = 'block');
    } else {
        chatsList?.classList.remove('batch-mode');
        toolbar?.classList.remove('visible');
        batchBtn?.classList.remove('active');
        chatsList?.querySelectorAll('.chat-checkbox').forEach(cb => {
            cb.style.display = 'none';
            cb.querySelector('input').checked = false;
        });
    }
    
    updateBatchCount();
}

/**
 * 배치 선택 수 업데이트
 */
export function updateBatchCount() {
    const count = document.querySelectorAll('.chat-select-cb:checked').length;
    const countSpan = document.getElementById('batch-selected-count');
    if (countSpan) countSpan.textContent = `${count}개 선택`;
}

/**
 * 배치 전체 선택/해제
 */
export function batchSelectAll() {
    const checkboxes = document.querySelectorAll('.chat-select-cb');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(cb => {
        cb.checked = !allChecked;
    });
    
    updateBatchCount();
}

/**
 * 일괄 선택 모드로 들어가면서 주어진 채팅들을 미리 선택 ("같은 분기 전체 선택"용)
 * 지금 목록에 그려져 있는 채팅만 고를 수 있다.
 * @param {string[]} fileNames - .jsonl 유무 무관
 * @returns {number} 실제로 선택된 수
 */
export function enterBatchModeWithSelection(fileNames) {
    if (!store.batchModeActive) toggleBatchMode();
    
    const strip = (n) => String(n || '').replace(/\.jsonl$/i, '');
    const wanted = new Set((fileNames || []).map(strip));
    let selected = 0;
    document.querySelectorAll('#chat-lobby-chats-list .lobby-chat-item').forEach(item => {
        const cb = item.querySelector('.chat-select-cb');
        if (!cb) return;
        cb.checked = wanted.has(strip(item.dataset.fileName));
        if (cb.checked) selected++;
    });
    updateBatchCount();
    return selected;
}

/**
 * 선택한 채팅들을 세션에 지정 (세션 선택 창을 연다)
 */
export async function executeBatchSession() {
    const avatar = store.currentCharacter?.avatar;
    const names = Array.from(document.querySelectorAll('.chat-select-cb:checked'))
        .map(cb => cb.closest('.lobby-chat-item')?.dataset.fileName)
        .filter(Boolean);
    
    if (!avatar) {
        showToast('세션은 캐릭터 채팅에서만 쓸 수 있습니다.', 'info');
        return;
    }
    if (names.length === 0) {
        await showAlert('세션에 담을 채팅을 선택하세요.');
        return;
    }
    
    openSessionPicker(avatar, names, {
        onApplied: async () => {
            // 이동과 마찬가지로 적용이 끝나면 선택 모드를 끝내고 목록을 다시 그린다
            if (store.batchModeActive) toggleBatchMode();
            await refreshCurrentChatList();
        }
    });
}

/**
 * 배치 이동 실행
 * @param {string} targetFolder
 */
export async function executeBatchMove(targetFolder) {
    
    if (!targetFolder) {
        await showAlert('이동할 폴더를 선택하세요.');
        return;
    }
    
    const checked = document.querySelectorAll('.chat-select-cb:checked');
    
    const keys = [];
    
    checked.forEach((cb, idx) => {
        const item = cb.closest('.lobby-chat-item');
        if (item) {
            const key = storage.getChatKey(item.dataset.charAvatar, item.dataset.fileName);
            keys.push(key);
        }
    });
    
    
    if (keys.length === 0) {
        await showAlert('이동할 채팅을 선택하세요.');
        return;
    }
    
    storage.moveChatsBatch(keys, targetFolder);
    
    toggleBatchMode();
    showToast(`${keys.length}개 채팅이 이동되었습니다.`, 'success');
    
    // 폴더 필터 드롭다운 업데이트 (캐릭터 캐시는 유지)
    const filterSelect = document.getElementById('chat-lobby-folder-filter');
    if (filterSelect) {
        const currentValue = filterSelect.value;
        filterSelect.innerHTML = getFoldersOptionsHTML(currentValue);
    }
    
    // 채팅 목록만 재렌더 (캐시된 채팅 데이터로 필터/정렬만 다시 적용)
    await refreshCurrentChatList();
    
}

/**
 * 배치 삭제 실행
 */
export async function executeBatchDelete() {
    const checked = document.querySelectorAll('.chat-select-cb:checked');
    
    if (checked.length === 0) {
        await showAlert('삭제할 채팅을 선택하세요.');
        return;
    }
    
    // 현재 열린 채팅 확인
    const context = api.getContext();
    const currentChatFile = context?.characters?.[context?.characterId]?.chat;
    
    // 선택된 채팅 정보 수집
    const chatItems = [];
    checked.forEach(cb => {
        const item = cb.closest('.lobby-chat-item');
        if (item) {
            chatItems.push({
                fileName: item.dataset.fileName,
                charAvatar: item.dataset.charAvatar,
                element: item
            });
        }
    });
    
    // 현재 열린 채팅이 포함되어 있는지 확인
    const hasCurrentChat = chatItems.some(c => {
        const nameWithoutExt = c.fileName.replace('.jsonl', '');
        return currentChatFile === nameWithoutExt;
    });
    
    if (hasCurrentChat) {
        await showAlert('현재 열린 채팅이 선택에 포함되어 있습니다.\n현재 채팅은 삭제할 수 없으니 선택을 해제하세요.');
        return;
    }
    
    // 삭제 확인
    const confirmed = await showConfirm(
        `선택한 ${chatItems.length}개 채팅을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`,
        '배치 삭제',
        true
    );
    
    if (!confirmed) return;
    
    // 순차 삭제는 개수에 비례해 오래 걸림 → 개수 기반 타임아웃 (최대 2분)
    const token = operationLock.acquire('batchDelete', Math.min(120000, 10000 + chatItems.length * 1500));
    if (!token) {
        showToast('다른 작업이 진행 중입니다.', 'warning');
        return;
    }

    let successCount = 0;
    let failCount = 0;
    /** @type {Array<{fileName: string, charAvatar: string}>} */
    const deletedOk = [];
    
    try {
        for (const chat of chatItems) {
            try {
                const success = await api.deleteChat(chat.fileName, chat.charAvatar);
                if (success) {
                    successCount++;
                    deletedOk.push(chat);
                    
                    // 로컬 데이터 정리
                    const data = storage.load();
                    const key = storage.getChatKey(chat.charAvatar, chat.fileName);
                    delete data.chatAssignments[key];
                    const favIndex = data.favorites.indexOf(key);
                    if (favIndex > -1) {
                        data.favorites.splice(favIndex, 1);
                    }
                    storage.save(data);
                    // 세션 소속/메모도 함께 정리
                    removeSessionChat(chat.charAvatar, chat.fileName);
                } else {
                    failCount++;
                }
            } catch (e) {
                console.error('[BatchDelete] Failed to delete:', chat.fileName, e);
                failCount++;
            }
        }
        
        // 캐시 무효화 (관련 캐릭터들)
        const avatarSet = new Set(chatItems.map(c => c.charAvatar));
        avatarSet.forEach(avatar => cache.invalidate('chats', avatar));

        // 지운 채팅 중 캐릭터의 "마지막 채팅"이 있으면 포인터를 남은 최신 채팅으로
        for (const avatar of avatarSet) {
            const names = deletedOk.filter(c => c.charAvatar === avatar).map(c => c.fileName);
            if (names.length === 0) continue;
            await api.repointLastChatAfterDelete(avatar, names);
        }
        
        // 배치 모드 종료
        toggleBatchMode();
        
        if (failCount === 0) {
            showToast(`${successCount}개 채팅이 삭제되었습니다.`, 'success');
        } else {
            showToast(`${successCount}개 삭제 완료, ${failCount}개 실패`, 'warning');
        }
        
        // 채팅 목록 새로고침
        await refreshCurrentChatList(true);
        
    } catch (error) {
        console.error('[BatchDelete] Error:', error);
        showToast('배치 삭제 중 오류가 발생했습니다.', 'error');
    } finally {
        operationLock.release(token);
    }
}

/**
 * 배치 모드 활성화 여부
 * @returns {boolean}
 */
export function isBatchMode() {
    return store.batchModeActive;
}

/**
 * 배치 모드 강제 해제 (로비 닫기/탭 전환/캐릭터 변경 시)
 */
export function deactivateBatchMode() {
    if (!store.batchModeActive) return;
    store.setBatchMode(false);
    
    const chatsList = document.getElementById('chat-lobby-chats-list');
    const toolbar = document.getElementById('chat-lobby-batch-toolbar');
    const batchBtn = document.getElementById('chat-lobby-batch-mode');
    
    chatsList?.classList.remove('batch-mode');
    toolbar?.classList.remove('visible');
    batchBtn?.classList.remove('active');
    chatsList?.querySelectorAll('.chat-checkbox').forEach(cb => {
        cb.style.display = 'none';
        const input = cb.querySelector('input');
        if (input) input.checked = false;
    });
    updateBatchCount();
}
