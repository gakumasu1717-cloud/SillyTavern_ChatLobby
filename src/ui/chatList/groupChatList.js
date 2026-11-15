// ============================================
// 채팅 목록 - 그룹 채팅 목록
// ============================================

import { api } from '../../api/sillyTavern.js';
import { storage } from '../../data/storage.js';
import { store } from '../../data/store.js';
import { escapeHtml, truncateText } from '../../utils/textUtils.js';
import { formatDate } from '../../utils/dateUtils.js';
import { createTouchClickHandler } from '../../utils/eventHelpers.js';
import { showToast, showConfirm } from '../notifications.js';
import { filterByFolder, sortChats } from './chatQuery.js';
import { updateChatCount, updateHasChats, showFolderBar, hidePersonaQuickButton } from './panelHeader.js';

// ============================================
// 그룹 채팅 목록
// ============================================

/**
 * 그룹 채팅 목록 렌더링
 * @param {Object} group - 그룹 정보
 * @returns {Promise<void>}
 */
export async function renderGroupChatList(group) {
    console.debug('[ChatList] renderGroupChatList called:', { 
        groupId: group?.id, 
        groupName: group?.name,
        currentGroupId: store.currentGroup?.id,
        isPanelVisible: document.getElementById('chat-lobby-chats')?.classList.contains('visible')
    });
    
    if (!group || !group.id) {
        console.error('[ChatList] Invalid group data:', group);
        return;
    }
    
    const chatsPanel = document.getElementById('chat-lobby-chats');
    const chatsList = document.getElementById('chat-lobby-chats-list');
    
    // 이미 같은 그룹의 채팅 패널이 열려있으면 렌더 스킵 (토글 동작)
    if (store.currentGroup?.id === group.id && chatsPanel?.classList.contains('visible')) {
        console.debug('[ChatList] Same group already visible, toggling off');
        chatsPanel.classList.remove('visible');
        store.setCurrentGroup(null);
        return;
    }
    
    // 캐릭터 대신 그룹 설정
    store.setCurrentCharacter(null);
    store.setCurrentGroup(group);
    
    if (!chatsPanel || !chatsList) {
        console.error('[ChatList] Chat panel elements not found');
        return;
    }
    
    // UI 표시
    chatsPanel.classList.add('visible');
    updateGroupChatHeader(group);
    showFolderBar(true);  // 그룹도 폴더 기능 활성화
    
    // ★ 그룹 채팅에서는 페르소나 퀵버튼 숨기기
    hidePersonaQuickButton();
    
    // 로딩 표시
    chatsList.innerHTML = '<div class="lobby-loading">채팅 로딩 중...</div>';
    
    try {
        const chats = await api.getGroupChats(group.id);
        
        if (!chats || chats.length === 0) {
            updateChatCount(0);
            chatsList.innerHTML = `
                <div class="lobby-empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:var(--text-muted,#888);padding:40px;">
                    <i>💬</i>
                    <div>그룹 채팅 기록이 없습니다</div>
                    <div style="font-size: 0.9em; margin-top: 5px;">새 채팅을 시작해보세요!</div>
                </div>
            `;
            return;
        }
        
        renderGroupChats(chatsList, chats, group);
    } catch (error) {
        console.error('[ChatList] Failed to load group chats:', error);
        showToast('그룹 채팅 목록을 불러오지 못했습니다.', 'error');
        chatsList.innerHTML = `
            <div class="lobby-empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:var(--text-muted,#888);padding:40px;">
                <i>⚠️</i>
                <div>그룹 채팅 목록 로딩 실패</div>
            </div>
        `;
    }
}

/**
 * 그룹 채팅 헤더 업데이트
 * @param {Object} group
 */
function updateGroupChatHeader(group) {
    const headerTitle = document.getElementById('chat-panel-name');
    const headerAvatar = document.getElementById('chat-panel-avatar');
    const deleteBtn = document.getElementById('chat-lobby-delete-char');
    const newChatBtn = document.getElementById('chat-lobby-new-chat');
    
    if (headerTitle) {
        headerTitle.textContent = group.name || '그룹';
    }
    
    if (headerAvatar) {
        headerAvatar.src = api.getGroupAvatarUrl(group);
        headerAvatar.alt = group.name || '그룹';
        headerAvatar.style.display = 'block';
    }
    
    // 그룹에서는 캐릭터 삭제 버튼 숨기기
    if (deleteBtn) {
        deleteBtn.style.display = 'none';
    }
    
    // 새 채팅 버튼 활성화 (그룹용 데이터 저장)
    if (newChatBtn) {
        newChatBtn.style.display = 'block';
        newChatBtn.dataset.groupId = group.id;
        newChatBtn.dataset.groupName = group.name || '그룹';
        newChatBtn.dataset.isGroup = 'true';
        // 캐릭터 데이터 초기화 (그룹으로 인식하도록)
        delete newChatBtn.dataset.charIndex;
        delete newChatBtn.dataset.charAvatar;
    }
}

/**
 * 그룹 채팅 목록 내부 렌더링 - 일반 채팅과 동일한 로직 사용
 * @param {HTMLElement} container
 * @param {Array} chats
 * @param {Object} group
 */
function renderGroupChats(container, chats, group) {
    // 그룹용 가상 avatar (저장소 키로 사용)
    const groupAvatar = `group_${group.id}`;
    
    // 전체 채팅 수
    const totalChatCount = chats.length;
    updateHasChats(totalChatCount);
    
    if (chats.length === 0) {
        updateChatCount(0);
        container.innerHTML = `
            <div class="lobby-empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:var(--text-muted,#888);padding:40px;">
                <i>💬</i>
                <div>그룹 채팅이 없습니다</div>
            </div>
        `;
        return;
    }
    
    // 폴더 필터 적용
    const filterFolder = storage.getFilterFolder();
    let filteredChats = [...chats];
    if (filterFolder !== 'all') {
        filteredChats = filterByFolder(filteredChats, groupAvatar, filterFolder);
    }
    
    // 정렬 적용
    const sortOption = storage.getSortOption();
    filteredChats = sortChats(filteredChats, groupAvatar, sortOption);
    
    updateChatCount(filteredChats.length);
    
    // 필터 결과가 0이면 빈 상태 표시
    if (filteredChats.length === 0) {
        container.innerHTML = `
            <div class="lobby-empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:var(--text-muted,#888);padding:40px;">
                <i>📁</i>
                <div>이 폴더에는 채팅이 없습니다</div>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    for (const chat of filteredChats) {
        const fileName = chat.file_name || '';
        const displayName = formatGroupChatName(fileName);
        const lastMes = chat.last_mes ? formatDate(chat.last_mes) : '';
        const mesCount = chat.chat_items || 0;
        const preview = chat.mes || chat.preview || chat.last_message || '채팅 기록';
        const safePreview = preview ? btoa(unescape(encodeURIComponent(preview))) : '';  // Base64 인코딩
        
        // 즐겨찾기/폴더 상태 (일반 채팅과 동일하게)
        const isFav = storage.isFavorite(groupAvatar, fileName);
        const folderId = storage.getChatFolder(groupAvatar, fileName);
        const data = storage.load();
        const folder = data.folders.find(f => f.id === folderId);
        const folderName = folder?.name || '';
        
        html += `
        <div class="lobby-chat-item ${isFav ? 'is-favorite' : ''}" 
             data-group-id="${escapeHtml(group.id)}"
             data-chat-file="${escapeHtml(fileName)}"
             data-folder-id="${folderId}"
             data-full-preview-encoded="${safePreview}">
            <button class="chat-fav-btn" title="즐겨찾기">${isFav ? '★' : '☆'}</button>
            <div class="chat-content">
                <div class="chat-name">${escapeHtml(displayName)}</div>
                <div class="chat-preview">${escapeHtml(truncateText(preview, 80))}</div>
                <div class="chat-meta">
                    ${mesCount > 0 ? `<span>💬 ${mesCount}개</span>` : ''}
                    ${lastMes ? `<span>🕐 ${lastMes}</span>` : ''}
                    ${folderName && folderId !== 'uncategorized' ? `<span class="chat-folder-tag">${escapeHtml(folderName)}</span>` : ''}
                </div>
            </div>
            <button class="chat-delete-btn" title="채팅 삭제">🗑️</button>
        </div>
        `;
    }
    
    container.innerHTML = html || `
        <div class="lobby-empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:var(--text-muted,#888);padding:40px;">
            <i>💬</i>
            <div>그룹 채팅이 없습니다</div>
        </div>
    `;
    
    // 그룹 채팅 클릭 이벤트 바인딩
    bindGroupChatEvents(container, group);
}

/**
 * 그룹 채팅 파일명을 보기 좋게 포맷
 * @param {string} fileName - 예: "2026-01-07@16h48m17s"
 * @returns {string}
 */
function formatGroupChatName(fileName) {
    // .jsonl 제거
    let name = fileName.replace('.jsonl', '');
    
    // 날짜 패턴 매칭 (2026-01-07@16h48m17s)
    const dateMatch = name.match(/(\d{4}-\d{2}-\d{2})@(\d{2})h(\d{2})m(\d{2})s/);
    if (dateMatch) {
        const [, date, hour, min] = dateMatch;
        return `${date} ${hour}:${min}`;
    }
    
    return name;
}

/**
 * 그룹 채팅 이벤트 바인딩 - 캐릭터 채팅과 동일한 플로우!
 * 순서: 그룹 선택 → 대기 → 로비 닫기 → 채팅 열기
 * @param {HTMLElement} container
 * @param {Object} group
 */
function bindGroupChatEvents(container, group) {
    const groupAvatar = `group_${group.id}`;  // 저장소 키용
    
    container.querySelectorAll('.lobby-chat-item').forEach((item, index) => {
        const chatContent = item.querySelector('.chat-content');
        const favBtn = item.querySelector('.chat-fav-btn');
        const delBtn = item.querySelector('.chat-delete-btn');
        const chatFile = item.dataset.chatFile;
        
        if (!chatContent || !chatFile) return;
        
        // 즐겨찾기 토글 (일반 채팅과 동일)
        if (favBtn) {
            createTouchClickHandler(favBtn, () => {
                const isNowFav = storage.toggleFavorite(groupAvatar, chatFile);
                favBtn.textContent = isNowFav ? '★' : '☆';
                item.classList.toggle('is-favorite', isNowFav);
            }, { debugName: `group-fav-${index}` });
        }
        
        // 채팅 열기 - chatHandlers.openGroupChat이 대상 채팅 하나만 로드 (락/로비 닫기 포함)
        createTouchClickHandler(chatContent, async () => {
            const onOpenGroup = store.chatHandlers?.onOpenGroup;
            if (typeof onOpenGroup !== 'function') {
                console.error('[ChatList] onOpenGroup handler not set');
                return;
            }
            store.setCurrentGroup(null);
            store.setCurrentCharacter(null);
            await onOpenGroup(group.id, chatFile);
        }, { preventDefault: true, stopPropagation: true, debugName: `group-chat-${index}` });
        
        // 삭제 버튼 이벤트
        if (delBtn) {
            createTouchClickHandler(delBtn, async () => {
                const confirmed = await showConfirm(`"${formatGroupChatName(chatFile)}" 채팅을 삭제하시겠습니까?`);
                if (!confirmed) return;
                
                try {
                    // 그룹 채팅 삭제 API 호출
                    const success = await api.deleteGroupChat(group.id, chatFile);
                    if (success) {
                        item.remove();
                        showToast('채팅이 삭제되었습니다.', 'success');
                        // 채팅 수 업데이트
                        const remaining = container.querySelectorAll('.lobby-chat-item').length;
                        updateChatCount(remaining);
                        if (remaining === 0) {
                            container.innerHTML = `
                                <div class="lobby-empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:var(--text-muted,#888);padding:40px;">
                                    <i>💬</i>
                                    <div>그룹 채팅이 없습니다</div>
                                </div>
                            `;
                        }
                    } else {
                        showToast('채팅 삭제에 실패했습니다.', 'error');
                    }
                } catch (error) {
                    console.error('[ChatList] Failed to delete group chat:', error);
                    showToast('채팅 삭제 중 오류가 발생했습니다.', 'error');
                }
            }, { preventDefault: true, stopPropagation: true, debugName: `group-del-${index}` });
        }
    });
}
