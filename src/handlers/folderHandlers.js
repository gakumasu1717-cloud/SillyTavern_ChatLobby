// ============================================
// 폴더 관련 이벤트 핸들러
// ============================================

import { storage } from '../data/storage.js';
import { escapeHtml } from '../utils/textUtils.js';
import { getBatchFoldersHTML } from '../ui/templates.js';
import { refreshChatList, isBatchMode, executeBatchMove } from '../ui/chatList.js';
import { showToast, showConfirm, showPrompt } from '../ui/notifications.js';

// ============================================
// 폴더 모달
// ============================================

/**
 * 폴더 모달 열기
 */
export function openFolderModal() {
    const modal = document.getElementById('chat-lobby-folder-modal');
    if (!modal) return;
    
    // 배치 모드일 때 모달 헤더 변경
    const header = modal.querySelector('.folder-modal-header h3');
    const addRow = modal.querySelector('.folder-add-row');
    
    if (isBatchMode()) {
        if (header) header.textContent = '📁 이동할 폴더 선택';
        if (addRow) addRow.style.display = 'none';
    } else {
        if (header) header.textContent = '📁 폴더 관리';
        if (addRow) addRow.style.display = 'flex';
    }
    
    modal.style.display = 'flex';
    refreshFolderList();
}

/**
 * 폴더 모달 닫기
 */
export function closeFolderModal() {
    const modal = document.getElementById('chat-lobby-folder-modal');
    if (modal) modal.style.display = 'none';
}

// ============================================
// 폴더 CRUD
// ============================================

/**
 * 폴더 추가
 */
export function addFolder() {
    const input = document.getElementById('new-folder-name');
    const name = input?.value.trim();
    
    if (!name) {
        showToast('폴더 이름을 입력하세요.', 'warning');
        return;
    }
    
    try {
        storage.addFolder(name);
        input.value = '';
        
        refreshFolderList();
        updateFolderDropdowns();
        showToast(`"${name}" 폴더가 생성되었습니다.`, 'success');
    } catch (error) {
        console.error('[FolderHandlers] Failed to add folder:', error);
        showToast('폴더 추가에 실패했습니다.', 'error');
    }
}

/**
 * 폴더 삭제
 * @param {string} folderId - 폴더 ID
 * @param {string} folderName - 폴더 이름
 * @returns {Promise<void>}
 */
async function deleteFolder(folderId, folderName) {
    const confirmed = await showConfirm(
        `"${folderName}" 폴더를 삭제하시겠습니까?\n\n폴더 안의 채팅들은 미분류로 이동됩니다.`,
        '폴더 삭제',
        true
    );
    
    if (!confirmed) return;
    
    try {
        storage.deleteFolder(folderId);
        refreshFolderList();
        updateFolderDropdowns();
        refreshChatList();
        showToast(`"${folderName}" 폴더가 삭제되었습니다.`, 'success');
    } catch (error) {
        console.error('[FolderHandlers] Failed to delete folder:', error);
        showToast('폴더 삭제에 실패했습니다.', 'error');
    }
}

/**
 * 폴더 이름 변경
 * @param {string} folderId - 폴더 ID
 * @param {string} currentName - 현재 이름
 * @returns {Promise<void>}
 */
async function renameFolder(folderId, currentName) {
    const newName = await showPrompt('새 폴더 이름을 입력하세요:', '폴더 이름 변경', currentName);
    
    if (!newName || newName === currentName) return;
    
    try {
        storage.renameFolder(folderId, newName);
        refreshFolderList();
        updateFolderDropdowns();
        showToast(`폴더 이름이 "${newName}"으로 변경되었습니다.`, 'success');
    } catch (error) {
        console.error('[FolderHandlers] Failed to rename folder:', error);
        showToast('폴더 이름 변경에 실패했습니다.', 'error');
    }
}

// ============================================
// 폴더 목록 UI
// ============================================

/**
 * 폴더 목록 새로고침
 */
export function refreshFolderList() {
    const container = document.getElementById('folder-list');
    if (!container) return;
    
    try {
        const data = storage.load();
        const sorted = [...data.folders].sort((a, b) => a.order - b.order);
        
        let html = '';
        sorted.forEach(f => {
            const isSystem = f.isSystem ? 'system' : '';
            const deleteBtn = f.isSystem ? '' : `<button class="folder-delete-btn" data-id="${f.id}" data-name="${escapeHtml(f.name)}">🗑️</button>`;
            const editBtn = f.isSystem ? '' : `<button class="folder-edit-btn" data-id="${f.id}" data-name="${escapeHtml(f.name)}">✏️</button>`;
            
            // 해당 폴더의 채팅 수 계산
            let count = 0;
            if (f.id === 'favorites') {
                count = data.favorites.length;
            } else {
                count = Object.values(data.chatAssignments).filter(v => v === f.id).length;
            }
            
            html += `
            <div class="folder-item ${isSystem}" data-id="${f.id}">
                <span class="folder-name">${escapeHtml(f.name)}</span>
                <span class="folder-count">${count}개</span>
                ${editBtn}
                ${deleteBtn}
            </div>`;
        });
        
        container.innerHTML = html;
        bindFolderEvents(container);
    } catch (error) {
        console.error('[FolderHandlers] Failed to refresh folder list:', error);
        showToast('폴더 목록을 불러오지 못했습니다.', 'error');
    }
}

/**
 * 폴더 아이템 이벤트 바인딩
 * @param {HTMLElement} container
 */
function bindFolderEvents(container) {
    // 삭제 버튼
    container.querySelectorAll('.folder-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // 폴더 클릭 이벤트 방지
            const folderId = btn.dataset.id;
            const folderName = btn.dataset.name;
            deleteFolder(folderId, folderName);
        });
    });
    
    // 편집 버튼
    container.querySelectorAll('.folder-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // 폴더 클릭 이벤트 방지
            const folderId = btn.dataset.id;
            const currentName = btn.dataset.name;
            renameFolder(folderId, currentName);
        });
    });
    
    // 배치 모드일 때: 폴더 클릭 시 선택한 채팅들 이동
    container.querySelectorAll('.folder-item').forEach(item => {
        item.addEventListener('click', async () => {
            const folderId = item.dataset.id;
            
            if (isBatchMode() && folderId && folderId !== 'favorites') {
                closeFolderModal();
                await executeBatchMove(folderId);
            }
        });
    });
}

// ============================================
// 드롭다운 업데이트
// ============================================

/**
 * 모든 폴더 드롭다운 업데이트
 */
export function updateFolderDropdowns() {
    try {
        const data = storage.load();
        const sorted = [...data.folders].sort((a, b) => a.order - b.order);
        
        // 필터 드롭다운
        const filterSelect = document.getElementById('chat-lobby-folder-filter');
        if (filterSelect) {
            const currentValue = filterSelect.value;
            let html = '<option value="all">📁 전체</option>';
            html += '<option value="favorites">⭐ 즐겨찾기만</option>';
            sorted.forEach(f => {
                if (f.id !== 'favorites') {
                    html += `<option value="${f.id}">${escapeHtml(f.name)}</option>`;
                }
            });
            filterSelect.innerHTML = html;
            filterSelect.value = currentValue;
        }
        
        // 배치 이동 드롭다운
        const batchSelect = document.getElementById('batch-move-folder');
        if (batchSelect) {
            batchSelect.innerHTML = getBatchFoldersHTML();
        }
    } catch (error) {
        console.error('[FolderHandlers] Failed to update dropdowns:', error);
    }
}
