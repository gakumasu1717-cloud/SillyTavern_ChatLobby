// ============================================
// 채팅 메모 편집 (여러 줄 입력이 필요해서 native prompt 대신 작은 대화상자)
//
// 메모는 채팅 단위이고 세션과 무관하다 (세션이 없는 봇에서도 쓴다).
// 저장하면 목록 전체를 다시 그리지 않고 그 행의 메모 줄만 갱신한다
// (일괄 선택 중에 메모를 고쳐도 선택이 풀리지 않게).
// ============================================

import { getMemo, setMemo } from '../../data/sessionStore.js';
import { escapeHtml } from '../../utils/textUtils.js';
import { showToast } from '../notifications.js';
import { onDialog, openSessionDialog } from './sessionOverlay.js';
import { refreshMemoLine } from './sessionBadges.js';

/** sessionStore.setMemo가 자르는 길이와 같게 */
const MEMO_MAX_LENGTH = 2000;

/**
 * @param {string} avatar
 * @param {string} fileName
 */
export function openChatMemoEditor(avatar, fileName) {
    const name = String(fileName || '').replace(/\.jsonl$/i, '');
    if (!avatar || !name) return;
    const current = getMemo(avatar, name);

    const dialog = openSessionDialog({
        title: '📝 채팅 메모',
        className: 'chat-memo',
        bodyHtml: `
            <div class="memo-target" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
            <textarea class="memo-text" rows="6" maxlength="${MEMO_MAX_LENGTH}" placeholder="이 채팅에 대한 메모 (예: AU 설정, 어디까지 봤는지)" aria-label="메모"></textarea>
            <div class="memo-counter"></div>
        `,
        footerHtml: `
            ${current ? '<button type="button" class="sd-btn danger memo-clear">메모 지우기</button>' : ''}
            <button type="button" class="sd-btn" data-sd-close>취소</button>
            <button type="button" class="sd-btn primary memo-save">저장</button>
        `,
    });

    const textarea = dialog.body.querySelector('.memo-text');
    const counter = dialog.body.querySelector('.memo-counter');
    textarea.value = current;

    const updateCounter = () => { counter.textContent = `${textarea.value.length} / ${MEMO_MAX_LENGTH}`; };
    onDialog(textarea, 'input', updateCounter);

    const finish = (text, message) => {
        setMemo(avatar, name, text);
        dialog.close();
        refreshMemoLine(avatar, name);
        showToast(message, 'success');
    };
    onDialog(dialog.footer.querySelector('.memo-save'), 'click', () => {
        const text = textarea.value;
        finish(text, text.trim() ? '📝 메모를 저장했습니다.' : '📝 메모를 지웠습니다.');
    });
    const clearBtn = dialog.footer.querySelector('.memo-clear');
    if (clearBtn) onDialog(clearBtn, 'click', () => finish('', '📝 메모를 지웠습니다.'));

    updateCounter();
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}
