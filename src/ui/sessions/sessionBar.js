// ============================================
// 세션 줄 (명세 7.2): 채팅 목록 위의 한 줄
//
//   ← 세션 목록   [이미지] AU · 7개            [+ 채팅 담기]  [⋮]
//
// - 세션이 있는 봇에서 목록을 볼 때만 보인다 (전체/미분류 보기에서는 + 채팅 담기, ⋮ 없음)
// - 세션이 없는 봇에는 이 줄 대신 필터 줄의 `🗂️ 세션` 버튼 하나만 둔다
// 버튼은 data-action으로 index.js 라우터 → sessionView.handleSessionAction 으로 간다.
// ============================================

import { SESSION_ALL, SESSION_UNSORTED } from '../../data/sessionStore.js';
import { escapeHtml } from '../../utils/textUtils.js';
import { getSessionImageSrc, bindImageFallback } from './sessionImage.js';
import { isRealSessionId } from './sessionState.js';

const BAR_ID = 'chat-lobby-session-bar';
const START_BTN_ID = 'chat-lobby-session-start';

const VIRTUAL_NAMES = {
    [SESSION_ALL]: '전체 채팅',
    [SESSION_UNSORTED]: '미분류',
};

/**
 * 세션 줄 그리기
 * @param {string} avatar
 * @param {string} sessionId - SESSION_ALL / SESSION_UNSORTED / 실제 ID
 * @param {string} name - 실제 세션이면 세션 이름 (가상 세션은 무시)
 * @param {number} count - 이 세션에 들어 있는 (실제로 존재하는) 채팅 수
 */
export function renderSessionBar(avatar, sessionId, name, count) {
    const bar = document.getElementById(BAR_ID);
    if (!bar) return;

    const real = isRealSessionId(sessionId);
    const title = real ? name : (VIRTUAL_NAMES[sessionId] || '');
    const imgSrc = getSessionImageSrc(avatar, real ? sessionId : null);

    bar.innerHTML = `
        <button type="button" class="session-bar-back" data-action="session-back" title="세션 목록으로">← 세션 목록</button>
        <div class="session-bar-title">
            <img class="session-bar-img" data-session-img src="${escapeHtml(imgSrc)}" alt="">
            <span class="session-bar-name" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
            <span class="session-bar-count">· ${count}개</span>
        </div>
        ${real ? `
        <div class="session-bar-actions">
            <button type="button" class="session-bar-add" data-action="session-add-chats" title="이 세션에 담을 채팅 고르기">+ 채팅 담기</button>
            <button type="button" class="session-bar-menu" data-action="session-bar-menu" title="세션 메뉴" aria-label="세션 메뉴">⋮</button>
        </div>` : ''}
    `;
    bindImageFallback(bar);
    bar.style.display = 'flex';
}

export function hideSessionBar() {
    const bar = document.getElementById(BAR_ID);
    if (!bar) return;
    bar.style.display = 'none';
    bar.innerHTML = '';
}

/**
 * 세션이 없는 봇의 `🗂️ 세션` 버튼 표시/숨김
 * @param {boolean} visible
 */
export function setSessionStartButtonVisible(visible) {
    const btn = document.getElementById(START_BTN_ID);
    if (btn) btn.style.display = visible ? 'inline-flex' : 'none';
}
