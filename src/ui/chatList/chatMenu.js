// ============================================
// 채팅 목록 - 채팅별 ⋮ 메뉴 / 리마인드 추가 / 이름 바꾸기
// ============================================

import { api } from '../../api/sillyTavern.js';
import { cache } from '../../data/cache.js';
import { storage } from '../../data/storage.js';
import { escapeHtml } from '../../utils/textUtils.js';
import { listeners } from '../../utils/listenerManager.js';
import { operationLock } from '../../utils/operationLock.js';
import { showToast, showPrompt } from '../notifications.js';
import { remindStore } from '../../data/remindStore.js';
import { highlightStore } from '../../data/highlightStore.js';
import { openChatInViewer } from '../remindViewer.js';
import { refreshCurrentChatList } from './charChatList.js';

// ============================================
// 폴더 이동 메뉴
// ============================================

let activeFolderMenu = null;

/**
 * 채팅 폴더 이동 메뉴 표시
 */
export function showChatFolderMenu(targetBtn, charAvatar, fileName) {
    // 같은 버튼 다시 클릭하면 닫기 (토글)
    if (activeFolderMenu) {
        const prevBtn = activeFolderMenu._targetBtn;
        closeChatFolderMenu();
        if (prevBtn === targetBtn) return; // 같은 버튼이면 닫기만
    }
    
    const data = storage.load();
    const folders = (data.folders || []).filter(f => f.id !== 'favorites' && f.id !== 'uncategorized');
    const currentFolderId = storage.getChatFolder(charAvatar, fileName);
    
    const menu = document.createElement('div');
    menu.className = 'chat-folder-menu';
    menu.innerHTML = `
        <div class="folder-menu-item view-chat-item">
            📖 뷰어로 감상
        </div>
        <div class="folder-menu-item rename-chat-item">
            ✏️ 이름 바꾸기
        </div>
        <div class="folder-menu-item remind-add-item">
            🔖 리마인드 추가
        </div>
        <div class="folder-menu-title">폴더 이동</div>
        <div class="folder-menu-item ${!currentFolderId || currentFolderId === 'uncategorized' ? 'active' : ''}" data-folder-id="">
            📤 폴더에서 제거
        </div>
        ${folders.map(f => `
            <div class="folder-menu-item ${f.id === currentFolderId ? 'active' : ''}" data-folder-id="${f.id}">
                📁 ${escapeHtml(f.name)}
            </div>
        `).join('')}
    `;
    
    // 위치 설정
    const rect = targetBtn.getBoundingClientRect();
    menu.style.cssText = `
        position: fixed;
        top: ${rect.bottom + 4}px;
        right: ${window.innerWidth - rect.right}px;
        z-index: 60000;
        background: var(--lobby-bg-card, #1a1a2e);
        border: 1px solid var(--lobby-border, #333);
        border-radius: 10px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        min-width: 150px;
        overflow: hidden;
    `;
    
    // 로비 컨테이너 안에 추가 (z-index 스택 컨텍스트 안에서 표시)
    const lobbyContainer = document.getElementById('chat-lobby-container') || document.body;
    lobbyContainer.appendChild(menu);
    activeFolderMenu = menu;
    activeFolderMenu._targetBtn = targetBtn; // 토글용 참조 저장
    
    // 뷰어로 감상 (리마인드 생성 없이 처음부터, 이어 읽기 지원)
    menu.querySelector('.view-chat-item')?.addEventListener('click', async () => {
        closeChatFolderMenu();
        const context = api.getContext();
        const char = (context?.characters || []).find(c => c.avatar === charAvatar);
        await openChatInViewer(charAvatar, char?.name || '', fileName);
    });

    // 이름 바꾸기
    menu.querySelector('.rename-chat-item')?.addEventListener('click', async () => {
        closeChatFolderMenu();
        await renameChatPrompt(charAvatar, fileName);
    });

    // 리마인드 추가
    menu.querySelector('.remind-add-item')?.addEventListener('click', async () => {
        closeChatFolderMenu();
        await addRemindPrompt(charAvatar, fileName);
    });

    // 폴더 이동
    menu.querySelectorAll('.folder-menu-item:not(.rename-chat-item):not(.remind-add-item):not(.view-chat-item)').forEach(item => {
        item.addEventListener('click', async () => {
            const folderId = item.dataset.folderId;
            if (folderId) {
                storage.setChatFolder(charAvatar, fileName, folderId);
                const folder = folders.find(f => f.id === folderId);
                showToast(`📁 ${folder?.name || '폴더'}로 이동`, 'success');
            } else {
                storage.setChatFolder(charAvatar, fileName, null);
                showToast('폴더에서 제거됨', 'success');
            }
            closeChatFolderMenu();
            await refreshCurrentChatList();
        });
    });
    
    // 외부 클릭 시 닫기 ('chatFolderMenu' 그룹 - 닫을 때 일괄 해제)
    setTimeout(() => {
        listeners.add('chatFolderMenu', document, 'click', closeFolderMenuOnClickOutside);
    }, 10);
}

function closeFolderMenuOnClickOutside(e) {
    if (activeFolderMenu && !activeFolderMenu.contains(e.target)) {
        closeChatFolderMenu();
    }
}

function closeChatFolderMenu() {
    if (activeFolderMenu) {
        activeFolderMenu.remove();
        activeFolderMenu = null;
    }
    listeners.clear('chatFolderMenu');
}

// ============================================
// 리마인드 추가
// ============================================

/**
 * 리마인드 추가 (범위 + 메모 입력)
 * "이 채팅의 120~130 서사가 좋았으니 나중에 다시 봐야지" 용도
 * @param {string} charAvatar
 * @param {string} fileName
 */
async function addRemindPrompt(charAvatar, fileName) {
    const cleanName = fileName.replace(/\.jsonl$/i, '');

    // 범위 입력 (mesid 기준, 비우면 전체)
    const rangeInput = await showPrompt(
        '저장할 메시지 범위를 입력하세요. (메시지 번호 기준)\n예: 120-130 / 120 (한 메시지) / 비우면 전체',
        '🔖 리마인드 추가',
        ''
    );
    if (rangeInput === null) return; // 취소

    let start = null;
    let end = null;
    const trimmed = rangeInput.trim();
    if (trimmed) {
        const match = trimmed.match(/^(\d+)\s*[-~]\s*(\d+)$/) || trimmed.match(/^(\d+)$/);
        if (!match) {
            showToast('범위 형식이 올바르지 않습니다. 예: 120-130', 'error');
            return;
        }
        start = parseInt(match[1], 10);
        end = match[2] !== undefined ? parseInt(match[2], 10) : start;
        if (end < start) [start, end] = [end, start];
    }

    const note = await showPrompt(
        '메모를 남겨주세요. (왜 좋았는지, 어떤 장면인지)',
        '🔖 리마인드 메모',
        ''
    );
    if (note === null) return; // 취소

    const context = api.getContext();
    const char = (context?.characters || []).find(c => c.avatar === charAvatar);

    remindStore.add({
        avatar: charAvatar,
        charName: char?.name || charAvatar.replace(/\.[^.]+$/, ''),
        fileName: cleanName,
        start,
        end,
        note: note.trim(),
    });

    const rangeText = start !== null ? ` (#${start}~#${end})` : '';
    showToast(`🔖 리마인드 저장됨${rangeText}\n보관함 탭에서 다시 볼 수 있어요.`, 'success');
}

// ============================================
// 채팅 이름 바꾸기
// ============================================

/**
 * 채팅 이름 변경 (입력 → 검증 → API → 로컬 키 마이그레이션)
 * @param {string} charAvatar
 * @param {string} fileName
 */
async function renameChatPrompt(charAvatar, fileName) {
    const currentName = fileName.replace(/\.jsonl$/i, '');

    // 현재 열린 채팅은 ST 내부 포인터(char.chat)가 꼬이므로 차단
    const context = api.getContext();
    const currentChatFile = context?.characters?.[context?.characterId]?.chat;
    if (currentChatFile === currentName) {
        showToast('현재 열린 채팅은 이름을 바꿀 수 없습니다.\n다른 채팅으로 이동 후 시도해주세요.', 'warning');
        return;
    }

    const input = await showPrompt('새 채팅 이름을 입력하세요.', '✏️ 이름 바꾸기', currentName);
    if (input === null) return; // 취소

    const newName = input.trim().replace(/\.jsonl$/i, '');
    if (!newName || newName === currentName) return;

    // 파일명 금지 문자 검사
    if (/[\\/:*?"<>|]/.test(newName)) {
        showToast('파일명에 사용할 수 없는 문자가 있습니다: \\ / : * ? " < > |', 'error');
        return;
    }

    // 중복 이름 검사 (캐시된 목록 기준)
    const chats = cache.get('chats', charAvatar);
    if (Array.isArray(chats) && chats.some(c =>
        (c.file_name || '').replace(/\.jsonl$/i, '') === newName)) {
        showToast('같은 이름의 채팅이 이미 있습니다.', 'error');
        return;
    }

    const token = operationLock.acquire('renameChat', 10000);
    if (!token) {
        showToast('다른 작업이 진행 중입니다.', 'warning');
        return;
    }

    try {
        // 서버가 파일명을 정리할 수 있으므로 실제 적용된 이름을 사용
        const appliedName = await api.renameChat(charAvatar, currentName, newName);
        if (appliedName) {
            // 폴더 배정/즐겨찾기/리마인드/형광펜 키 함께 이동
            storage.renameChatKey(charAvatar, currentName, appliedName);
            remindStore.renameChat(charAvatar, currentName, appliedName);
            highlightStore.renameChat(charAvatar, currentName, appliedName);

            // ★ 이 채팅이 캐릭터의 "마지막 채팅"이었으면 포인터도 옮김
            // (안 하면 다음에 캐릭터로 들어갈 때 ST가 옛 이름으로 빈 새 채팅을 만들어
            //  채팅이 사라진 것처럼 보임 - ST도 이름 변경 시 포인터를 갱신함)
            const char = api.getContext()?.characters?.find(c => c.avatar === charAvatar);
            if (char && char.chat === currentName) {
                char.chat = appliedName;
                api.saveLastChatPointer(char.avatar, char.name, appliedName);
            }

            showToast(`이름 변경: "${appliedName}"`, 'success');
            await refreshCurrentChatList(true);
        } else {
            showToast('이름 변경에 실패했습니다.', 'error');
        }
    } catch (e) {
        console.error('[ChatList] Rename failed:', e);
        showToast('이름 변경 중 오류가 발생했습니다.', 'error');
    } finally {
        operationLock.release(token);
    }
}
