// ============================================
// 세션 화면 조율 (명세 7절)
//
// 채팅 패널의 목록 영역이 가질 수 있는 세 가지 모습을 정한다.
//   · 세션이 없는 봇      → 예전과 같은 전체 목록 (+ 필터 줄의 `🗂️ 세션` 버튼 하나)
//   · 세션이 있는 봇 처음 → 세션 카드 화면
//   · 세션 하나/전체/미분류 → 세션 줄 + 거른 채팅 목록
//
// 기존 코드는 아래 함수들을 몇 군데서 부르기만 한다 (charChatList / index.js).
// ⚠️ 어떤 이유로든 여기서 예외가 나면 "전체 채팅" 목록으로 떨어져야 한다 (명세 8절).
// ============================================

import {
    SESSION_ALL, SESSION_UNSORTED,
    createSession, filterChatsBySession, getSession, hasSessions,
} from '../../data/sessionStore.js';
import { store } from '../../data/store.js';
import { showToast, showPrompt } from '../notifications.js';
import { refreshCurrentChatList } from '../chatList/charChatList.js';
import { updateChatCount } from '../chatList/panelHeader.js';
import { deactivateBatchMode } from '../chatList/batch.js';
import { renderSessionCards, openSessionManageMenu } from './sessionCards.js';
import { renderSessionBar, hideSessionBar, setSessionStartButtonVisible } from './sessionBar.js';
import { openChatPicker } from './chatPicker.js';
import { closeAllSessionLayers } from './sessionOverlay.js';
import {
    enterCharacter, getSessionView, isRealSessionId, rememberChats,
    resetSessionState, showCards, showSession,
} from './sessionState.js';

const PANEL_ID = 'chat-lobby-chats';

// ============================================
// 화면 겉모습 (패널 클래스 / 세션 줄 / 시작 버튼)
// ============================================

/** 카드 화면에서는 정렬/폴더 필터 줄이 의미가 없어 CSS가 숨긴다 */
function setCardsChrome(on) {
    document.getElementById(PANEL_ID)?.classList.toggle('session-view-cards', on);
}

/** 세션 관련 겉모습을 전부 걷어낸다 (다른 캐릭터/그룹으로 넘어갈 때 잔상 방지) */
export function resetSessionChrome() {
    setCardsChrome(false);
    hideSessionBar();
    setSessionStartButtonVisible(false);
}

/**
 * 캐릭터 채팅 패널이 (다시) 열릴 때 호출
 * @param {string} avatar
 */
export function beginCharacterView(avatar) {
    try {
        enterCharacter(avatar);
        resetSessionChrome();
    } catch (e) {
        console.error('[Sessions] beginCharacterView failed:', e);
    }
}

/**
 * 패널을 닫거나 그룹으로 넘어갈 때: 상태 초기화 + 열린 대화상자/메뉴 닫기 + 겉모습 정리
 */
export function resetSessionView() {
    closeAllSessionLayers();
    resetSessionState();
    resetSessionChrome();
}

// ============================================
// 렌더 단계 (charChatList.renderChats가 부른다)
// ============================================

/**
 * 세션 상태에 맞춰 화면을 준비한다.
 * @param {HTMLElement} container - #chat-lobby-chats-list
 * @param {string} avatar
 * @param {Array} chats - 유효한 채팅 전체 (폴더 필터/정렬 전)
 * @returns {{ handled: boolean, chats: Array }}
 *   handled=true면 이 화면을 이미 그렸으니 호출한 쪽은 더 그리지 않는다.
 *   handled=false면 chats(세션으로 거른 목록)를 기존 방식대로 필터/정렬해서 그린다.
 */
export function prepareSessionView(container, avatar, chats) {
    try {
        // 채팅이 하나도 없으면 세션 화면 없이 기존 빈 상태를 쓴다
        if (!chats.length) {
            resetSessionChrome();
            return { handled: false, chats };
        }

        enterCharacter(avatar);
        rememberChats(avatar, chats);
        const sessionsExist = hasSessions(avatar);

        // 상태가 현실과 어긋났으면 바로잡는다 (세션이 전부 지워졌거나, 보던 세션이 사라졌거나)
        let view = getSessionView();
        if (!sessionsExist) {
            showSession(SESSION_ALL);
        } else if (view.mode === 'list' && isRealSessionId(view.activeId) && !getSession(avatar, view.activeId)) {
            showCards();
        }
        view = getSessionView();

        // 세션이 없는 봇: 예전과 같은 목록 + `🗂️ 세션` 버튼 하나
        if (!sessionsExist) {
            setCardsChrome(false);
            hideSessionBar();
            setSessionStartButtonVisible(true);
            return { handled: false, chats };
        }
        setSessionStartButtonVisible(false);

        // 카드 화면
        if (view.mode === 'cards') {
            deactivateBatchMode(); // 일괄 선택 체크박스는 채팅 행에만 있다
            setCardsChrome(true);
            hideSessionBar();
            updateChatCount(chats.length);
            renderSessionCards(container, avatar, chats);
            return { handled: true, chats };
        }

        // 채팅 목록 (세션/전체/미분류)
        setCardsChrome(false);
        const filtered = filterChatsBySession(avatar, view.activeId, chats);
        const session = isRealSessionId(view.activeId) ? getSession(avatar, view.activeId) : null;
        renderSessionBar(avatar, view.activeId, session?.name || '', filtered.length);

        if (filtered.length === 0) {
            updateChatCount(0);
            container.innerHTML = renderEmptySession(view.activeId);
            return { handled: true, chats: filtered };
        }
        return { handled: false, chats: filtered };
    } catch (e) {
        // 세션 화면이 실패해도 채팅 목록은 떠야 한다
        console.error('[Sessions] Session view failed, falling back to the full list:', e);
        try {
            showSession(SESSION_ALL);
            resetSessionChrome();
        } catch { /* 정리 중 실패는 무시 */ }
        return { handled: false, chats };
    }
}

function renderEmptySession(sessionId) {
    const real = isRealSessionId(sessionId);
    return `
        <div class="session-empty-state">
            <i>${real ? '🗂️' : '💬'}</i>
            <div>${real ? '이 세션에는 아직 채팅이 없습니다' : '미분류 채팅이 없습니다'}</div>
            ${real ? '<button type="button" class="session-empty-add" data-action="session-add-chats">+ 채팅 담기</button>' : ''}
        </div>
    `;
}

// ============================================
// data-action 라우터 (index.js의 handleAction default에서 부른다)
// ============================================

/**
 * @param {string} action
 * @param {HTMLElement} el
 * @returns {Promise<boolean>} 세션 액션이었는지
 */
export async function handleSessionAction(action, el) {
    const avatar = store.currentCharacter?.avatar;

    switch (action) {
        case 'session-start':
            if (avatar) await createSessionFlow(avatar, { enter: true });
            return true;
        case 'session-new':
            if (avatar) await createSessionFlow(avatar, { enter: false });
            return true;
        case 'session-open':
            if (!avatar) return true;
            showSession(el.dataset.sessionId || SESSION_ALL);
            await refreshCurrentChatList();
            document.getElementById('chat-lobby-chats-list')?.scrollTo?.(0, 0);
            return true;
        case 'session-back':
            if (!avatar) return true;
            showCards();
            await refreshCurrentChatList();
            return true;
        case 'session-card-menu':
            if (avatar) openSessionManageMenu(el, avatar, el.dataset.sessionId);
            return true;
        case 'session-bar-menu': {
            const view = getSessionView();
            if (avatar && isRealSessionId(view.activeId)) openSessionManageMenu(el, avatar, view.activeId);
            return true;
        }
        case 'session-add-chats': {
            const view = getSessionView();
            if (avatar && isRealSessionId(view.activeId)) openChatPicker(avatar, view.activeId);
            return true;
        }
        default:
            return false;
    }
}

/**
 * 새 세션 만들기 (이름은 한 줄이라 native prompt)
 * @param {string} avatar
 * @param {{ enter: boolean }} options - 만든 뒤 그 세션 안으로 들어갈지
 */
async function createSessionFlow(avatar, { enter }) {
    const input = await showPrompt('새 세션 이름을 입력하세요.\n예: AU, 분기, 같은 페르소나', '🗂️ 새 세션', '');
    if (input === null) return;
    // 입력하는 동안 다른 캐릭터로 넘어갔으면 중단
    if (store.currentCharacter?.avatar !== avatar) return;

    const session = createSession(avatar, input);
    if (!session) {
        showToast('세션을 만들지 못했습니다.', 'error');
        return;
    }
    showToast(`🗂️ "${session.name}" 세션을 만들었습니다.`, 'success');
    if (enter) showSession(session.id);
    await refreshCurrentChatList();
}
