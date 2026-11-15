// ============================================
// 세션 선택 창 (명세 7.3 ①): "이 채팅(들)을 어느 세션에 넣을까요"
//
// - 세션마다 체크박스. 선택한 채팅 중 일부만 들어 있으면 중간 상태(—)
//   (중간 상태를 누르면 모두 포함 → 다시 누르면 모두 제외)
// - 맨 아래 "+ 새 세션" 입력. 새 세션은 [적용]을 눌러야 실제로 만들어진다
//   (취소했는데 빈 세션이 남지 않도록)
// - [적용]은 setChatMembership 한 번으로 반영
// 여는 곳: 채팅 ⋮ 메뉴 "세션 지정", 일괄 선택 툴바 "🗂️ 세션"
// ============================================

import { createSession, getSessions, setChatMembership } from '../../data/sessionStore.js';
import { escapeHtml } from '../../utils/textUtils.js';
import { showToast } from '../notifications.js';
import { onDialog, openSessionDialog } from './sessionOverlay.js';

const NAME_MAX_LENGTH = 40;

const stripExt = (name) => String(name || '').replace(/\.jsonl$/i, '');

/**
 * @param {string} avatar
 * @param {string[]} fileNames - 대상 채팅 (.jsonl 유무 무관)
 * @param {{ onApplied?: Function }} [options] - 무언가 실제로 반영된 뒤 한 번 호출 (바뀐 게 없으면 호출 안 함)
 */
export function openSessionPicker(avatar, fileNames, { onApplied = null } = {}) {
    const names = [...new Set((fileNames || []).map(stripExt).filter(Boolean))];
    if (!avatar || names.length === 0) {
        showToast('세션에 담을 채팅을 먼저 선택하세요.', 'warning');
        return;
    }

    const sessions = getSessions(avatar);
    /** 세션별로 선택한 채팅 중 몇 개가 이미 들어 있는지 */
    const have = new Map(sessions.map((s) => {
        const set = new Set(s.chats);
        return [s.id, names.filter((n) => set.has(n)).length];
    }));
    /** 사용자가 건드린 세션: 'all' | 'none' (건드리지 않으면 현재 상태 유지) */
    const desired = new Map();
    /** 새로 만들 세션 */
    const newRows = [];

    const subtitle = names.length === 1
        ? escapeHtml(names[0])
        : `${names.length}개 채팅`;

    const dialog = openSessionDialog({
        title: '🗂️ 세션 지정',
        className: 'session-picker',
        bodyHtml: `
            <div class="sp-target" title="${names.length === 1 ? escapeHtml(names[0]) : ''}">${subtitle}</div>
            <div class="sp-hint">체크한 세션에 담깁니다. ${names.length > 1 ? '<b>—</b> 표시는 선택한 채팅 중 일부만 들어 있다는 뜻입니다.' : ''}</div>
            <div class="sp-list"></div>
            <div class="sp-new-row">
                <input type="text" class="sp-new-input" maxlength="${NAME_MAX_LENGTH}" placeholder="+ 새 세션 이름" aria-label="새 세션 이름">
                <button type="button" class="sp-new-add">추가</button>
            </div>
        `,
        footerHtml: `
            <button type="button" class="sd-btn" data-sd-close>취소</button>
            <button type="button" class="sd-btn primary sp-apply">적용</button>
        `,
    });

    const list = dialog.body.querySelector('.sp-list');
    const input = dialog.body.querySelector('.sp-new-input');

    function renderRows() {
        const rows = sessions.map((s) => {
            const k = have.get(s.id) || 0;
            const countText = names.length > 1 ? `<span class="sp-count">${k}/${names.length}</span>` : '';
            return `
                <label class="sp-row">
                    <input type="checkbox" data-sid="${escapeHtml(s.id)}">
                    <span class="sp-name" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</span>
                    ${countText}
                </label>`;
        });
        newRows.forEach((row, i) => {
            rows.push(`
                <label class="sp-row sp-new">
                    <input type="checkbox" data-new="${i}" ${row.checked ? 'checked' : ''}>
                    <span class="sp-name" title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</span>
                    <span class="sp-tag">새 세션</span>
                    <button type="button" class="sp-remove" data-remove-new="${i}" title="빼기" aria-label="새 세션 빼기">✕</button>
                </label>`);
        });
        list.innerHTML = rows.length
            ? rows.join('')
            : '<div class="sp-empty">아직 세션이 없습니다. 아래에서 첫 세션을 만들어 보세요.</div>';

        // 체크 상태는 속성이 아니라 프로퍼티로 (중간 상태는 프로퍼티로만 표현 가능)
        sessions.forEach((s) => {
            const cb = list.querySelector(`input[data-sid="${CSS.escape(s.id)}"]`);
            if (!cb) return;
            const k = have.get(s.id) || 0;
            const want = desired.get(s.id);
            if (want === 'all') { cb.checked = true; cb.indeterminate = false; }
            else if (want === 'none') { cb.checked = false; cb.indeterminate = false; }
            else if (k === 0) { cb.checked = false; cb.indeterminate = false; }
            else if (k === names.length) { cb.checked = true; cb.indeterminate = false; }
            else { cb.checked = false; cb.indeterminate = true; }
        });
    }

    function addNewName(raw) {
        const name = String(raw || '').trim().slice(0, NAME_MAX_LENGTH);
        if (!name) return false;
        const existing = sessions.find((s) => s.name === name);
        if (existing) {
            desired.set(existing.id, 'all');
            showToast(`이미 있는 세션이라 "${name}"을 체크했습니다.`, 'info');
        } else if (!newRows.some((r) => r.name === name)) {
            newRows.push({ name, checked: true });
        }
        renderRows();
        return true;
    }

    // 체크박스를 연달아 눌러도 쿨다운에 막히지 않도록 일반 change 리스너를 쓴다
    onDialog(list, 'change', (e) => {
        const cb = e.target;
        if (cb.dataset.sid) {
            desired.set(cb.dataset.sid, cb.checked ? 'all' : 'none');
            cb.indeterminate = false;
        } else if (cb.dataset.new !== undefined) {
            const row = newRows[Number(cb.dataset.new)];
            if (row) row.checked = cb.checked;
        }
    });
    onDialog(list, 'click', (e) => {
        const btn = e.target.closest?.('[data-remove-new]');
        if (!btn) return;
        e.preventDefault();
        newRows.splice(Number(btn.dataset.removeNew), 1);
        renderRows();
    });

    const commitInput = () => {
        if (addNewName(input.value)) input.value = '';
        input.focus();
    };
    onDialog(dialog.body.querySelector('.sp-new-add'), 'click', commitInput);
    onDialog(input, 'keydown', (e) => {
        // 한글 조합 중 Enter는 글자 확정용이라 무시
        if (e.key === 'Enter' && !e.isComposing) {
            e.preventDefault();
            commitInput();
        }
    });

    onDialog(dialog.footer.querySelector('.sp-apply'), 'click', () => {
        // 입력칸에 적어 두고 [추가]를 안 눌렀어도 함께 반영
        if (input.value.trim()) {
            addNewName(input.value);
            input.value = '';
        }

        const addIds = [];
        const removeIds = [];
        for (const s of sessions) {
            const k = have.get(s.id) || 0;
            const want = desired.get(s.id);
            if (want === 'all' && k < names.length) addIds.push(s.id);
            else if (want === 'none' && k > 0) removeIds.push(s.id);
        }
        let createdAll = true;
        for (const row of newRows) {
            if (!row.checked) continue;
            const created = createSession(avatar, row.name);
            if (created) addIds.push(created.id);
            else createdAll = false;
        }
        if (!createdAll) showToast('일부 새 세션을 만들지 못했습니다.', 'error');

        if (addIds.length === 0 && removeIds.length === 0) {
            dialog.close();
            if (createdAll) showToast('바뀐 것이 없습니다.', 'info');
            return;
        }

        setChatMembership(avatar, names, { add: addIds, remove: removeIds });
        dialog.close();
        showToast(`🗂️ 세션을 지정했습니다. (${addIds.length + removeIds.length}개 세션에 반영)`, 'success');
        if (typeof onApplied === 'function') {
            try {
                const result = onApplied();
                if (result && typeof result.catch === 'function') result.catch((err) => console.error('[Sessions] onApplied failed:', err));
            } catch (err) {
                console.error('[Sessions] onApplied failed:', err);
            }
        }
    });

    renderRows();
    // 세션이 하나도 없으면 바로 이름부터 적을 수 있게
    if (sessions.length === 0) input.focus();
}
