// ============================================
// 채팅 담기 창 (명세 7.3 ②): 세션 안의 "+ 채팅 담기"
//
// 그 봇의 모든 채팅을 체크박스 목록으로 보여준다. 이미 세션에 들어 있는 채팅은
// 체크된 상태. 이름/메모로 검색하고, [저장]하면 추가와 제거를 한 번에 반영한다.
//
// ⚠️ 이미 받아 둔 채팅 목록(캐시)만 쓰고 새로 요청하지 않는다.
// ⚠️ 목록에 없는 파일명(지워졌을 수 있는 것)은 화면에 없으므로 제거 대상이 될 수 없다.
//    (저장소의 "자동 정리 금지" 규칙 유지)
// ============================================

import { addChats, getMemo, getSession, getSessionChatSet, removeChats } from '../../data/sessionStore.js';
import { escapeHtml } from '../../utils/textUtils.js';
import { formatDate, getTimestamp } from '../../utils/dateUtils.js';
import { showToast } from '../notifications.js';
import { refreshCurrentChatList } from '../chatList/charChatList.js';
import { onDialog, openSessionDialog } from './sessionOverlay.js';
import { getCharacterChats } from './sessionState.js';

const stripExt = (name) => String(name || '').replace(/\.jsonl$/i, '');

/**
 * @param {string} avatar
 * @param {string} sessionId
 */
export function openChatPicker(avatar, sessionId) {
    const session = getSession(avatar, sessionId);
    if (!session) {
        showToast('세션을 찾을 수 없습니다.', 'error');
        return;
    }

    // 최신순으로 (목록의 기본 정렬과 같게)
    const chats = [...getCharacterChats(avatar)].sort((a, b) => getTimestamp(b) - getTimestamp(a));
    const rows = chats.map((chat) => {
        const name = stripExt(chat.file_name || chat.fileName);
        const ts = getTimestamp(chat);
        return { name, memo: getMemo(avatar, name), when: ts ? formatDate(ts) : '' };
    }).filter((r) => r.name);

    // 화면에 있는 채팅 중 원래 이 세션에 들어 있던 것 (제거 후보는 이 안에서만)
    const inSession = getSessionChatSet(avatar, sessionId);
    const original = new Set(rows.filter((r) => inSession.has(r.name)).map((r) => r.name));
    const selected = new Set(original);

    const dialog = openSessionDialog({
        title: `+ 채팅 담기 — ${session.name}`,
        className: 'chat-picker',
        bodyHtml: `
            <input type="text" class="cp-search" placeholder="🔍 이름/메모 검색" aria-label="채팅 검색">
            <div class="cp-tools">
                <button type="button" class="cp-tool" data-cp-all="1">보이는 것 모두 선택</button>
                <button type="button" class="cp-tool" data-cp-all="0">보이는 것 모두 해제</button>
                <span class="cp-count"></span>
            </div>
            <div class="cp-list">
                ${rows.length === 0 ? '<div class="cp-empty">담을 수 있는 채팅이 없습니다.</div>' : rows.map((r, i) => `
                    <label class="cp-row" data-idx="${i}">
                        <input type="checkbox" data-idx="${i}" ${selected.has(r.name) ? 'checked' : ''}>
                        <span class="cp-main">
                            <span class="cp-name">${escapeHtml(r.name)}</span>
                            ${r.memo ? `<span class="cp-memo">📝 ${escapeHtml(r.memo.replace(/\s+/g, ' '))}</span>` : ''}
                        </span>
                        ${r.when ? `<span class="cp-date">${escapeHtml(r.when)}</span>` : ''}
                    </label>`).join('')}
            </div>
            <div class="cp-none" style="display:none;">검색 결과가 없습니다.</div>
        `,
        footerHtml: `
            <button type="button" class="sd-btn" data-sd-close>취소</button>
            <button type="button" class="sd-btn primary cp-save">저장</button>
        `,
    });

    const search = dialog.body.querySelector('.cp-search');
    const list = dialog.body.querySelector('.cp-list');
    const none = dialog.body.querySelector('.cp-none');
    const countEl = dialog.body.querySelector('.cp-count');
    const rowEls = [...list.querySelectorAll('.cp-row')];

    const updateCount = () => { countEl.textContent = `${selected.size}개 선택`; };

    /** 지금 검색에 걸려 보이는 행들 */
    const visibleRows = () => rowEls.filter((el) => !el.hidden);

    function applySearch() {
        const q = search.value.trim().toLowerCase();
        let shown = 0;
        for (const el of rowEls) {
            const r = rows[Number(el.dataset.idx)];
            const hit = !q || r.name.toLowerCase().includes(q) || r.memo.toLowerCase().includes(q);
            el.hidden = !hit;
            if (hit) shown++;
        }
        none.style.display = rows.length > 0 && shown === 0 ? 'block' : 'none';
    }

    // 체크박스를 연달아 눌러도 쿨다운에 막히지 않도록 일반 change 리스너를 쓴다
    onDialog(list, 'change', (e) => {
        const cb = e.target;
        const r = rows[Number(cb.dataset.idx)];
        if (!r) return;
        if (cb.checked) selected.add(r.name); else selected.delete(r.name);
        updateCount();
    });
    onDialog(search, 'input', applySearch);
    onDialog(dialog.body.querySelector('.cp-tools'), 'click', (e) => {
        const btn = e.target.closest?.('[data-cp-all]');
        if (!btn) return;
        const check = btn.dataset.cpAll === '1';
        for (const el of visibleRows()) {
            const r = rows[Number(el.dataset.idx)];
            const cb = el.querySelector('input');
            cb.checked = check;
            if (check) selected.add(r.name); else selected.delete(r.name);
        }
        updateCount();
    });

    onDialog(dialog.footer.querySelector('.cp-save'), 'click', async () => {
        const add = [...selected].filter((n) => !original.has(n));
        const remove = [...original].filter((n) => !selected.has(n));
        if (add.length === 0 && remove.length === 0) {
            dialog.close();
            showToast('바뀐 것이 없습니다.', 'info');
            return;
        }
        if (!getSession(avatar, sessionId)) {
            dialog.close();
            showToast('세션을 찾을 수 없습니다.', 'error');
            return;
        }
        const added = add.length ? addChats(avatar, sessionId, add) : 0;
        const removed = remove.length ? removeChats(avatar, sessionId, remove) : 0;
        dialog.close();
        showToast(`🗂️ "${session.name}" 세션: ${added}개 담고, ${removed}개 뺐습니다.`, 'success');
        await refreshCurrentChatList();
    });

    updateCount();
    search.focus();
}
