// ============================================
// 채팅 행에 붙는 세션 표시: 소속 세션 칩 + 메모 한 줄
//
// chatItem.js가 문자열 HTML을 만들 때 호출한다. 사용자 입력(세션 이름, 메모)은
// 전부 여기서 escapeHtml을 거친다. 어떤 이유로든 실패하면 빈 문자열을 돌려줘서
// 채팅 행 자체는 항상 그려지게 한다.
// ============================================

import { SESSION_ALL, getChatSessions, getMemo } from '../../data/sessionStore.js';
import { escapeHtml } from '../../utils/textUtils.js';
import { getSessionView } from './sessionState.js';

/** 칩이 너무 길어지지 않게 보여줄 최대 개수 */
const MAX_CHIPS = 3;

/**
 * "전체 채팅"을 볼 때만 각 채팅이 속한 세션 이름을 작은 칩으로 보여준다
 * @param {string} avatar
 * @param {string} fileName
 * @returns {string}
 */
export function renderSessionChips(avatar, fileName) {
    try {
        const view = getSessionView();
        if (view.avatar !== avatar || view.mode !== 'list' || view.activeId !== SESSION_ALL) return '';
        const sessions = getChatSessions(avatar, fileName);
        if (sessions.length === 0) return '';
        const shown = sessions.slice(0, MAX_CHIPS)
            .map((s) => `<span class="chat-session-chip" title="${escapeHtml(s.name)}">🗂️ ${escapeHtml(s.name)}</span>`);
        if (sessions.length > MAX_CHIPS) {
            const rest = sessions.slice(MAX_CHIPS).map((s) => s.name).join(', ');
            shown.push(`<span class="chat-session-chip more" title="${escapeHtml(rest)}">+${sessions.length - MAX_CHIPS}</span>`);
        }
        return shown.join('');
    } catch (e) {
        console.warn('[Sessions] renderSessionChips failed:', e);
        return '';
    }
}

/**
 * 메모가 있으면 미리보기 아래 한 줄
 * @param {string} avatar
 * @param {string} fileName
 * @returns {string}
 */
export function renderMemoLine(avatar, fileName) {
    try {
        const memo = getMemo(avatar, fileName);
        if (!memo) return '';
        const oneLine = memo.replace(/\s+/g, ' ').trim();
        return `<div class="chat-memo-line" title="${escapeHtml(memo)}">📝 ${escapeHtml(oneLine)}</div>`;
    } catch (e) {
        console.warn('[Sessions] renderMemoLine failed:', e);
        return '';
    }
}

/**
 * 메모를 고친 뒤 목록 전체를 다시 그리지 않고 그 행의 메모 줄만 바꾼다
 * (일괄 선택 중에 메모를 고쳐도 선택이 풀리지 않도록)
 * @param {string} avatar
 * @param {string} fileName
 */
export function refreshMemoLine(avatar, fileName) {
    const name = String(fileName).replace(/\.jsonl$/i, '');
    const items = document.querySelectorAll('#chat-lobby-chats-list .lobby-chat-item');
    for (const item of items) {
        if (item.dataset.charAvatar !== avatar) continue;
        if (String(item.dataset.fileName || '').replace(/\.jsonl$/i, '') !== name) continue;
        item.querySelector('.chat-memo-line')?.remove();
        const html = renderMemoLine(avatar, fileName);
        if (html) item.querySelector('.chat-preview')?.insertAdjacentHTML('afterend', html);
        break;
    }
}
