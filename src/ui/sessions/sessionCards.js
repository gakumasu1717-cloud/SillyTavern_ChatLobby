// ============================================
// 세션 카드 화면 (명세 7.1) + 세션 관리 메뉴
//
//   [ 전체 채팅 49 ]  [ AU 7 ]  [ 분기 12 ]  [ 미분류 30 ]  [ + 새 세션 ]
//
// 카드의 이미지는 세션 이미지, 없으면 봇 이미지. 채팅 수와 마지막 채팅 시각은
// ⚠️ 세션에 적힌 파일명 수(session.chats.length)가 아니라 실제 채팅 목록을 걸러서 센다
//   (지워진 파일명이 세션에 남아 있을 수 있다).
// 카드와 ⋮ 버튼은 data-action 으로 index.js 라우터 → sessionView.handleSessionAction 으로 간다.
// ============================================

import {
    SESSION_ALL, SESSION_UNSORTED,
    deleteSession, filterChatsBySession, getSession, getSessionImage, getSessions,
    renameSession, setSessionImage,
} from '../../data/sessionStore.js';
import { escapeHtml } from '../../utils/textUtils.js';
import { formatDate, getTimestamp } from '../../utils/dateUtils.js';
import { showToast, showConfirm, showPrompt } from '../notifications.js';
import { refreshCurrentChatList } from '../chatList/charChatList.js';
import { openSessionPopup } from './sessionOverlay.js';
import { bindImageFallback, getSessionImageSrc, pickSessionImage } from './sessionImage.js';
import { getSessionView, showCards } from './sessionState.js';

/**
 * 채팅들 중 가장 최근 시각 (없으면 0)
 * @param {Array} chats
 * @returns {number}
 */
function latestTimestamp(chats) {
    let latest = 0;
    for (const chat of chats) {
        const ts = getTimestamp(chat);
        if (ts > latest) latest = ts;
    }
    return latest;
}

/**
 * 카드 한 장 HTML
 * @param {{ id: string, name: string, count: number, latest: number, avatar: string, real: boolean }} card
 */
function renderCard({ id, name, count, latest, avatar, real }) {
    const when = latest ? formatDate(latest) : '';
    const imgSrc = getSessionImageSrc(avatar, real ? id : null);
    return `
        <div class="session-card ${real ? '' : 'virtual'}" data-action="session-open" data-session-id="${escapeHtml(id)}" role="button" tabindex="0" title="${escapeHtml(name)}">
            <div class="session-card-image">
                <img data-session-img src="${escapeHtml(imgSrc)}" alt="" loading="lazy">
            </div>
            <div class="session-card-info">
                <div class="session-card-name">${escapeHtml(name)}</div>
                <div class="session-card-meta">${count}개${when ? ` · ${escapeHtml(when)}` : ''}</div>
            </div>
            ${real ? `<button type="button" class="session-card-menu" data-action="session-card-menu" data-session-id="${escapeHtml(id)}" title="세션 메뉴" aria-label="세션 메뉴">⋮</button>` : ''}
        </div>
    `;
}

/**
 * 카드 화면 그리기
 * @param {HTMLElement} container - #chat-lobby-chats-list
 * @param {string} avatar
 * @param {Array} chats - 유효한 채팅 전체
 */
export function renderSessionCards(container, avatar, chats) {
    const total = chats.length;
    const cards = [{
        id: SESSION_ALL, name: '전체 채팅', count: total, latest: latestTimestamp(chats), avatar, real: false,
    }];

    for (const session of getSessions(avatar)) {
        const own = filterChatsBySession(avatar, session.id, chats);
        cards.push({
            id: session.id, name: session.name, count: own.length, latest: latestTimestamp(own), avatar, real: true,
        });
    }

    // 미분류는 1개 이상이고 전체보다 적을 때만 (전부 미분류이면 "전체 채팅"과 같으니 생략)
    const unsorted = filterChatsBySession(avatar, SESSION_UNSORTED, chats);
    if (unsorted.length >= 1 && unsorted.length < total) {
        cards.push({
            id: SESSION_UNSORTED, name: '미분류', count: unsorted.length, latest: latestTimestamp(unsorted), avatar, real: false,
        });
    }

    container.innerHTML = `
        <div class="session-cards">
            ${cards.map(renderCard).join('')}
            <button type="button" class="session-card session-card-new" data-action="session-new">
                <span class="session-card-new-plus">＋</span>
                <span>새 세션</span>
            </button>
        </div>
    `;
    bindImageFallback(container);
    // 카드는 div[role=button]이라 키보드(Enter/Space)로도 열리게 한다 (래퍼는 innerHTML과 함께 사라짐)
    container.querySelector('.session-cards')?.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const card = e.target.closest?.('.session-card[data-action]');
        if (!card || e.target !== card) return;
        e.preventDefault();
        card.click();
    });
    container.scrollTop = 0;
}

// ============================================
// 세션 관리 (이름 바꾸기 / 이미지 / 삭제) — 카드 ⋮ 와 세션 줄 ⋮ 가 함께 쓴다
// ============================================

/**
 * 세션 ⋮ 메뉴 열기
 * @param {HTMLElement} anchor
 * @param {string} avatar
 * @param {string} sessionId
 */
export function openSessionManageMenu(anchor, avatar, sessionId) {
    const session = getSession(avatar, sessionId);
    if (!session) return;

    const items = [
        { label: '✏️ 이름 바꾸기', onSelect: () => renameSessionPrompt(avatar, sessionId) },
        { label: '🖼️ 이미지 바꾸기', onSelect: () => changeSessionImage(sessionId) },
    ];
    if (getSessionImage(sessionId)) {
        items.push({ label: '↩️ 봇 이미지로 되돌리기', onSelect: () => resetSessionImage(sessionId) });
    }
    items.push({ label: '🗑️ 세션 삭제', danger: true, onSelect: () => deleteSessionConfirm(avatar, sessionId) });

    openSessionPopup(anchor, items);
}

async function renameSessionPrompt(avatar, sessionId) {
    const session = getSession(avatar, sessionId);
    if (!session) return;
    const input = await showPrompt('새 세션 이름을 입력하세요.', '✏️ 세션 이름 바꾸기', session.name);
    if (input === null) return;
    if (!renameSession(avatar, sessionId, input)) {
        showToast('세션 이름은 비워 둘 수 없습니다.', 'warning');
        return;
    }
    await refreshCurrentChatList();
}

async function changeSessionImage(sessionId) {
    const changed = await pickSessionImage(sessionId);
    if (changed) await refreshCurrentChatList();
}

async function resetSessionImage(sessionId) {
    setSessionImage(sessionId, null);
    showToast('봇 이미지로 되돌렸습니다.', 'success');
    await refreshCurrentChatList();
}

async function deleteSessionConfirm(avatar, sessionId) {
    const session = getSession(avatar, sessionId);
    if (!session) return;
    const confirmed = await showConfirm(
        `"${session.name}" 세션을 삭제하시겠습니까?\n\n채팅은 지워지지 않습니다. 이 세션 묶음만 사라지고, 채팅은 "전체 채팅"에 그대로 남습니다.`,
        '세션 삭제',
        true
    );
    if (!confirmed) return;

    if (!deleteSession(avatar, sessionId)) {
        showToast('세션을 삭제하지 못했습니다.', 'error');
        return;
    }
    showToast(`"${session.name}" 세션을 삭제했습니다. 채팅은 그대로입니다.`, 'success');

    // 지금 그 세션 안을 보고 있었다면 카드 화면으로 (세션이 더는 없으면 sessionView가 전체 목록으로 돌린다)
    const view = getSessionView();
    if (view.mode === 'list' && view.activeId === sessionId) showCards();
    await refreshCurrentChatList();
}
