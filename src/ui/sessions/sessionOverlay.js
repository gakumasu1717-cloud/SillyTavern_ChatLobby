// ============================================
// 세션 기능 공용 겹침 UI: 대화상자 + 작은 팝업 메뉴
//
// 모두 #chat-lobby-container 안에 붙인다. 모바일(≤850px)에서는 채팅 패널이
// fixed + z-index 10000, 캐릭터 정보 패널이 10020이라 그 위(10050/10060)에 둔다.
// (토스트는 60001로 훨씬 위)
//
// 리스너는 listenerManager 그룹으로 등록하고 닫을 때 전부 해제한다.
// 일부러 createTouchClickHandler / bindDelegatedTouchClick은 쓰지 않는다 —
// 전역 200ms 쿨다운이 체크박스를 연달아 누르는 것을 삼키기 때문.
// ============================================

import { escapeHtml } from '../../utils/textUtils.js';
import { listeners } from '../../utils/listenerManager.js';

const DIALOG_GROUP = 'sessionDialog';
const POPUP_GROUP = 'sessionPopup';

/** @type {{ el: HTMLElement, onClose: Function|null }|null} */
let dialog = null;
/** @type {{ el: HTMLElement, anchor: HTMLElement }|null} */
let popup = null;

function host() {
    return document.getElementById('chat-lobby-container') || document.body;
}

// ============================================
// 대화상자
// ============================================

export function isSessionDialogOpen() {
    return !!dialog;
}

/**
 * 대화상자 닫기 (리스너 해제 + 요소 제거)
 */
export function closeSessionDialog() {
    if (!dialog) return;
    const { el, onClose } = dialog;
    dialog = null;
    listeners.clear(DIALOG_GROUP);
    el.remove();
    if (typeof onClose === 'function') {
        try { onClose(); } catch (e) { console.warn('[Sessions] dialog onClose failed:', e); }
    }
}

/**
 * 대화상자 열기. 한 번에 하나만 열린다 (이미 열려 있으면 먼저 닫음).
 * 배경을 누르면 닫힌다. ESC는 index.js의 키 핸들러가 closeTopSessionLayer로 닫는다.
 *
 * @param {Object} opts
 * @param {string} opts.title - 일반 문자열 (여기서 이스케이프)
 * @param {string} [opts.className]
 * @param {string} [opts.bodyHtml] - 호출한 쪽에서 이미 이스케이프한 HTML
 * @param {string} [opts.footerHtml]
 * @param {Function} [opts.onClose]
 * @returns {{ el: HTMLElement, body: HTMLElement, footer: HTMLElement, close: Function }}
 */
export function openSessionDialog({ title, className = '', bodyHtml = '', footerHtml = '', onClose = null }) {
    closeSessionDialog();
    closeSessionPopup();

    const backdrop = document.createElement('div');
    backdrop.className = 'session-dialog-backdrop';
    backdrop.innerHTML = `
        <div class="session-dialog ${escapeHtml(className)}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
            <div class="session-dialog-header">
                <h3>${escapeHtml(title)}</h3>
                <button type="button" class="session-dialog-x" data-sd-close aria-label="닫기">✕</button>
            </div>
            <div class="session-dialog-body">${bodyHtml}</div>
            <div class="session-dialog-footer">${footerHtml}</div>
        </div>
    `;
    host().appendChild(backdrop);
    dialog = { el: backdrop, onClose };

    // 안에서 시작한 드래그(텍스트 선택 등)가 배경에서 끝나도 닫히지 않게 눌린 위치를 기억
    let downOnBackdrop = false;
    listeners.add(DIALOG_GROUP, backdrop, 'pointerdown', (e) => {
        downOnBackdrop = e.target === backdrop;
    });
    listeners.add(DIALOG_GROUP, backdrop, 'click', (e) => {
        if (e.target === backdrop && downOnBackdrop) {
            closeSessionDialog();
            return;
        }
        if (e.target.closest?.('[data-sd-close]')) closeSessionDialog();
    });

    return {
        el: backdrop,
        body: backdrop.querySelector('.session-dialog-body'),
        footer: backdrop.querySelector('.session-dialog-footer'),
        close: closeSessionDialog,
    };
}

/**
 * 대화상자 안쪽 요소의 리스너 등록 (닫을 때 대화상자 그룹과 함께 해제됨)
 * @param {EventTarget} target
 * @param {string} type
 * @param {Function} handler
 * @param {any} [options]
 */
export function onDialog(target, type, handler, options) {
    listeners.add(DIALOG_GROUP, target, type, handler, options);
}

// ============================================
// 작은 팝업 메뉴 (⋮ 버튼용)
// ============================================

export function isSessionPopupOpen() {
    return !!popup;
}

export function closeSessionPopup() {
    if (!popup) return;
    popup.el.remove();
    popup = null;
    listeners.clear(POPUP_GROUP);
}

/**
 * 버튼 옆에 팝업 메뉴를 연다. 같은 버튼을 다시 누르면 닫힌다.
 * @param {HTMLElement} anchor
 * @param {Array<{ label: string, onSelect: Function, danger?: boolean }>} items
 */
export function openSessionPopup(anchor, items) {
    const sameAnchor = popup?.anchor === anchor;
    closeSessionPopup();
    if (sameAnchor || !anchor || !items?.length) return;

    const menu = document.createElement('div');
    menu.className = 'session-popup';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = items.map((item, i) => `
        <button type="button" role="menuitem" class="session-popup-item ${item.danger ? 'danger' : ''}" data-popup-index="${i}">${escapeHtml(item.label)}</button>
    `).join('');
    host().appendChild(menu);

    // 화면 밖으로 나가지 않게 위치 보정
    const rect = anchor.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const margin = 8;
    let top = rect.bottom + 4;
    if (top + menuRect.height > window.innerHeight - margin) {
        top = Math.max(margin, rect.top - menuRect.height - 4);
    }
    let left = rect.right - menuRect.width;
    left = Math.min(Math.max(margin, left), Math.max(margin, window.innerWidth - menuRect.width - margin));
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;

    popup = { el: menu, anchor };

    listeners.add(POPUP_GROUP, menu, 'click', (e) => {
        const btn = e.target.closest?.('[data-popup-index]');
        if (!btn) return;
        const item = items[Number(btn.dataset.popupIndex)];
        closeSessionPopup();
        try {
            const result = item?.onSelect?.();
            if (result && typeof result.catch === 'function') {
                result.catch((err) => console.error('[Sessions] popup action failed:', err));
            }
        } catch (err) {
            console.error('[Sessions] popup action failed:', err);
        }
    });
    // 바깥을 누르면 닫기. 같은 버튼을 누른 경우는 위쪽 sameAnchor 토글에 맡긴다
    listeners.add(POPUP_GROUP, document, 'pointerdown', (e) => {
        if (menu.contains(e.target) || anchor.contains(e.target)) return;
        closeSessionPopup();
    }, true);
}

// ============================================
// 한꺼번에 닫기
// ============================================

/**
 * ESC용: 가장 위의 것 하나만 닫는다 (팝업 → 대화상자)
 * @returns {boolean} 닫은 것이 있는지
 */
export function closeTopSessionLayer() {
    if (popup) {
        closeSessionPopup();
        return true;
    }
    if (dialog) {
        closeSessionDialog();
        return true;
    }
    return false;
}

/** 로비/패널을 닫을 때: 전부 닫기 */
export function closeAllSessionLayers() {
    closeSessionPopup();
    closeSessionDialog();
}
