// ============================================
// 채팅 ⋮ 메뉴에 들어가는 세션 항목 (명세 7.3 ③)
//
//   🗂️ 세션 지정 / 🌳 같은 분기 전체 선택 / 📝 메모 / ➖ 이 세션에서 빼기(세션 안에서만)
//
// chatMenu.js는 renderSessionMenuItems()의 HTML을 메뉴에 끼우고
// bindSessionMenuItems()를 한 번 부를 뿐, 세션 로직은 여기에 있다.
// ============================================

import { SESSION_ALL, removeChats } from '../../data/sessionStore.js';
import { getBranchFamily } from '../../utils/branchGroup.js';
import { showToast } from '../notifications.js';
import { refreshCurrentChatList } from '../chatList/charChatList.js';
import { enterBatchModeWithSelection } from '../chatList/batch.js';
import { openChatMemoEditor } from './chatMemo.js';
import { openSessionPicker } from './sessionPicker.js';
import { getActiveRealSessionId, getCharacterChats, getSessionView, showSession } from './sessionState.js';

const stripExt = (name) => String(name || '').replace(/\.jsonl$/i, '');

/**
 * 메뉴에 끼울 HTML (정적 문자열뿐이라 사용자 입력이 들어가지 않는다)
 * @param {string} avatar
 * @returns {string}
 */
export function renderSessionMenuItems(avatar) {
    const inSession = !!getActiveRealSessionId(avatar);
    return `
        <div class="folder-menu-item session-menu-item" data-session-menu="assign">🗂️ 세션 지정</div>
        <div class="folder-menu-item session-menu-item" data-session-menu="branch">🌳 같은 분기 전체 선택</div>
        <div class="folder-menu-item session-menu-item" data-session-menu="memo">📝 메모</div>
        ${inSession ? '<div class="folder-menu-item session-menu-item" data-session-menu="remove">➖ 이 세션에서 빼기</div>' : ''}
    `;
}

/**
 * 메뉴 항목 동작 연결 (메뉴 요소가 지워질 때 함께 사라지는 리스너 하나)
 * @param {HTMLElement} menu
 * @param {string} avatar
 * @param {string} fileName
 * @param {Function} closeMenu
 */
export function bindSessionMenuItems(menu, avatar, fileName, closeMenu) {
    menu.addEventListener('click', (e) => {
        const item = e.target.closest?.('[data-session-menu]');
        if (!item) return;
        closeMenu();
        const kind = item.dataset.sessionMenu;
        if (kind === 'assign') {
            openSessionPicker(avatar, [fileName], { onApplied: () => refreshCurrentChatList() });
        } else if (kind === 'branch') {
            selectSameBranch(avatar, fileName).catch((err) => console.error('[Sessions] selectSameBranch failed:', err));
        } else if (kind === 'memo') {
            openChatMemoEditor(avatar, fileName);
        } else if (kind === 'remove') {
            removeFromActiveSession(avatar, fileName);
        }
    });
}

async function removeFromActiveSession(avatar, fileName) {
    const sessionId = getActiveRealSessionId(avatar);
    if (!sessionId) return;
    const removed = removeChats(avatar, sessionId, [fileName]);
    showToast(removed > 0 ? '➖ 이 세션에서 뺐습니다. (채팅은 그대로입니다)' : '이미 이 세션에 없는 채팅입니다.', removed > 0 ? 'success' : 'info');
    await refreshCurrentChatList();
}

/**
 * 같은 분기(뿌리 + 모든 후손)를 일괄 선택 모드로 한꺼번에 선택
 * @param {string} avatar
 * @param {string} fileName
 */
async function selectSameBranch(avatar, fileName) {
    const family = getBranchFamily(avatar, fileName);
    if (family === null) {
        showToast('분기 정보가 없습니다.\n정렬을 "🌳 분기"로 바꿔 먼저 분석하세요.', 'info', 5000);
        return;
    }

    // 실제로 존재하는 채팅만 (분기 정보에는 지워진 채팅 이름이 남아 있을 수 있다)
    const existing = new Set(getCharacterChats(avatar).map((c) => stripExt(c.file_name || c.fileName)));
    const members = [...family].filter((n) => existing.has(n));
    if (members.length <= 1) {
        showToast('이 채팅과 같은 분기에 속한 다른 채팅이 없습니다.', 'info');
        return;
    }

    // 세션 안에서는 그 세션에 없는 분기 채팅이 목록에 없어 고를 수 없다 → 전체 채팅으로 이동
    const view = getSessionView();
    let movedToAll = false;
    if (view.mode === 'list' && view.activeId !== SESSION_ALL) {
        showSession(SESSION_ALL);
        await refreshCurrentChatList();
        movedToAll = true;
    }

    const selected = enterBatchModeWithSelection(members);
    if (selected < members.length) {
        showToast(`같은 분기 ${members.length}개 중 ${selected}개를 선택했습니다.\n(폴더 필터로 가려진 채팅은 제외)`, 'info', 5000);
    } else if (movedToAll) {
        showToast(`같은 분기 ${selected}개를 선택했습니다. (전체 채팅으로 이동했어요)`, 'success');
    } else {
        showToast(`같은 분기 ${selected}개를 선택했습니다.`, 'success');
    }
}
