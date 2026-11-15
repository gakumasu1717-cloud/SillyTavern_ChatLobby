// ============================================
// 채팅 목록 - 채팅 행 렌더링
// ============================================

import { storage } from '../../data/storage.js';
import { escapeHtml, truncateText } from '../../utils/textUtils.js';

/**
 * 채팅 아이템 HTML 생성
 * @param {Object} chat
 * @param {string} charAvatar
 * @param {number} index
 * @returns {string}
 */
export function renderChatItem(chat, charAvatar, index) {
    const fileName = chat.file_name || chat.fileName || chat.name || `chat_${index}`;
    const displayName = fileName.replace('.jsonl', '');
    
    // 미리보기
    const preview = chat.preview || chat.mes || chat.last_message || '채팅 기록';
    
    // 메시지 수
    const messageCount = chat.chat_items || chat.message_count || chat.mes_count || 0;
    
    // 즐겨찾기/폴더 상태
    const isFav = storage.isFavorite(charAvatar, fileName);
    const folderId = storage.getChatFolder(charAvatar, fileName);
    const data = storage.load();
    const folder = data.folders.find(f => f.id === folderId);
    const folderName = folder?.name || '';
    
    // 툴팁용 미리보기 (전체 표시)
    const tooltipPreview = preview;
    const safeAvatar = escapeHtml(charAvatar || '');
    const safeFileName = escapeHtml(fileName || '');
    // 툴팁용 전문 - Base64 인코딩 (따옴표 문제 방지)
    const safeFullPreview = tooltipPreview ? btoa(unescape(encodeURIComponent(tooltipPreview))) : '';
    
    // 브랜치 정보 (분기로 보기 모드일 때 _branchInfo가 있음)
    const branchInfo = chat._branchInfo;
    const branchDepth = branchInfo?.depth || 0;
    const isBranch = branchInfo && !branchInfo.isOriginal;
    const branchPoint = branchInfo?.branchPoint || 0;
    
    // 브랜치면 왼쪽에 갭(margin) 추가 + 색상 변경
    const depthIndent = isBranch ? Math.min(branchDepth, 5) * 16 : 0;
    const indentStyle = isBranch ? `margin-left: ${depthIndent}px;` : '';
    const branchClass = branchInfo ? 'branch-mode' : '';
    const branchBadge = isBranch 
        ? `<span class="branch-badge" title="분기점: ${branchPoint}번째 메시지">↳ 분기${branchPoint > 0 ? ` @${branchPoint}` : ''}</span>`
        : '';
    
    return `
    <div class="lobby-chat-item ${isFav ? 'is-favorite' : ''} ${branchClass} ${isBranch ? 'is-branch' : ''}" 
         data-file-name="${safeFileName}" 
         data-char-avatar="${safeAvatar}" 
         data-chat-index="${index}" 
         data-folder-id="${folderId}"
         data-branch-depth="${branchDepth}"
         data-branch-point="${branchPoint}"
         data-full-preview-encoded="${safeFullPreview}"
         style="${indentStyle}">
        <label class="chat-checkbox" style="display:none;"><input type="checkbox" class="chat-select-cb"></label>
        <button class="chat-fav-btn" title="즐겨찾기">${isFav ? '★' : '☆'}</button>
        <div class="chat-content">
            <div class="chat-name">${branchBadge}${escapeHtml(displayName)}</div>
            <div class="chat-preview">${escapeHtml(truncateText(preview, 80))}</div>
            <div class="chat-meta">
                ${messageCount > 0 ? `<span>💬 ${messageCount}개</span>` : ''}
                ${folderName && folderId !== 'uncategorized' ? `<span class="chat-folder-tag">${escapeHtml(folderName)}</span>` : ''}
            </div>
        </div>
        <div class="chat-actions">
            <button class="chat-folder-btn" title="폴더 이동">⋮</button>
            <button class="chat-delete-btn" title="채팅 삭제">🗑️</button>
        </div>
    </div>
    `;
}
