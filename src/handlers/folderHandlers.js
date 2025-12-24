// ============================================
// 폴더 관련 이벤트 핸들러
// ============================================

import { storage } from '../data/storage.js';
import { escapeHtml } from '../utils/textUtils.js';
import { getBatchFoldersHTML } from '../ui/templates.js';
import { refreshChatList } from '../ui/chatList.js';

// 폴더 모달 열기
export function openFolderModal() {
    const modal = document.getElementById('chat-lobby-folder-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    refreshFolderList();
}

// 폴더 모달 닫기
export function closeFolderModal() {
    const modal = document.getElementById('chat-lobby-folder-modal');
    if (modal) modal.style.display = 'none';
}

// 폴더 추가
export function addFolder() {
    const input = document.getElementById('new-folder-name');
    const name = input?.value.trim();
    
    if (!name) return;
    
    storage.addFolder(name);
    input.value = '';
    
    refreshFolderList();
    updateFolderDropdowns();
}

// 폴더 목록 새로고침
export function refreshFolderList() {
    const container = document.getElementById('folder-list');
    if (!container) return;
    
    const data = storage.load();
    const sorted = [...data.folders].sort((a, b) => a.order - b.order);
    
    let html = '';
    sorted.forEach(f => {
        const isSystem = f.isSystem ? 'system' : '';
        const deleteBtn = f.isSystem ? '' : `<button class="folder-delete-btn" data-id="${f.id}">🗑️</button>`;
        const editBtn = f.isSystem ? '' : `<button class="folder-edit-btn" data-id="${f.id}">✏️</button>`;
        
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
}

function bindFolderEvents(container) {
    // 삭제 버튼
    container.querySelectorAll('.folder-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const folderId = btn.dataset.id;
            if (confirm('이 폴더를 삭제하시겠습니까?\n폴더 안의 채팅들은 미분류로 이동됩니다.')) {
                storage.deleteFolder(folderId);
                refreshFolderList();
                updateFolderDropdowns();
                refreshChatList();
            }
        });
    });
    
    // 편집 버튼
    container.querySelectorAll('.folder-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const folderId = btn.dataset.id;
            const folderItem = btn.closest('.folder-item');
            const nameSpan = folderItem.querySelector('.folder-name');
            const currentName = nameSpan.textContent;
            
            const newName = prompt('새 폴더 이름:', currentName);
            if (newName && newName.trim() && newName !== currentName) {
                storage.renameFolder(folderId, newName.trim());
                refreshFolderList();
                updateFolderDropdowns();
            }
        });
    });
}

// 모든 폴더 드롭다운 업데이트
export function updateFolderDropdowns() {
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
                html += `<option value="${f.id}">${f.name}</option>`;
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
}
