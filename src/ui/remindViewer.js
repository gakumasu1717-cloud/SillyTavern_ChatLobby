// ============================================
// 리마인드 뷰어 (이북 리더)
//
// 구조: 채팅 패널(#chat-lobby-chats)과 동일한 메커니즘
// - 템플릿에 고정 존재하는 호스트 + .visible 클래스 토글
//
// 기능:
// - 페이지네이션 + 범위 연장 (마지막 페이지에서 ▶ = 다음 구간 이어 보기)
// - 이어 읽기 (범위/페이지/스크롤 위치 기억) - 리마인드/일반 감상 모두
// - ▶️ 이어서 채팅하기 / 🔖 뷰어 안에서 구간 저장
// - ⚙️ 설정 팝업 (페이지 크기 / 글자 크기 / 읽기 테마 / 정규식 / 백업)
// - 🖍️ 형광펜 (텍스트 선택 → 저장 → 재방문 시 복원, 탭하면 제거)
// - 채팅 목록에서 "뷰어로 감상" (리마인드 없이 전체 감상)
// ============================================

import { api } from '../api/sillyTavern.js';
import { remindStore } from '../data/remindStore.js';
import { highlightStore } from '../data/highlightStore.js';
import { renderMessageHtml } from '../utils/chatTextFormatter.js';
import { escapeHtml } from '../utils/textUtils.js';
import { showToast, showConfirm, showPrompt } from './notifications.js';
import { listeners } from '../utils/listenerManager.js';
import { uiPrefs } from '../data/uiPrefs.js';
import { openChat } from '../handlers/chatHandlers.js';

let isViewerOpen = false;

// 현재 뷰어 세션 상태
let currentRemind = null;       // 리마인드 객체 또는 임시(adhoc) 감상 객체
let currentMessages = null;
let regexEnabled = true;
let pageIndex = 0;

// 현재 보고 있는 범위 (리마인드 범위에서 시작, 연장 가능)
let viewStart = 0;
let viewEnd = 0;

// 마지막으로 렌더된 페이지의 메시지 범위 (뷰어 내 리마인드 추가 기본값)
let lastRenderedRange = { from: 0, to: 0 };

// 진행 저장 디바운스
let progressSaveTimer = null;

// 형광펜 선택 대기 상태
let pendingHighlight = null;
// 팝업 버튼 조작 중 플래그 (선택 collapse로 팝업이 숨겨지는 것 방지)
let hlPopupInteracting = false;
// 팝업 숨김 지연 타이머
let hlHideTimer = null;
// 선택이 활성화된 시각 (모바일 탭-해제 판단용)
let selectionActiveSince = 0;
// selectionchange 디바운스 타이머
let selChangeTimer = null;
// 정규식 iframe lazy hydration 옵저버
let iframeObserver = null;
// "모두" 모드 대용량 안내 토스트 (뷰어 열 때마다 1회)
let warnedLargeAll = false;

// "모두" 모드에서 이 개수를 넘으면 강제 페이지 처리 (모바일 크래시 방지)
const MAX_ALL_RENDER = 150;
const FORCED_PAGE_SIZE = 50;

// 글자 크기 범위
const FONT_MIN = 12;
const FONT_MAX = 24;

// 페이지 크기 옵션 (0 = 모두)
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 0];

// 읽기 테마 옵션
const READER_THEMES = [
    { id: 'auto',  name: '🎨 로비 테마' },
    { id: 'dark',  name: '🌙 다크' },
    { id: 'sepia', name: '📜 세피아' },
    { id: 'paper', name: '🤍 순백' },
];

/**
 * 리마인드로 뷰어 열기
 * @param {string} remindId
 */
export async function openRemindViewer(remindId) {
    const remind = remindStore.get(remindId);
    if (!remind) {
        showToast('리마인드를 찾을 수 없습니다.', 'error');
        return;
    }
    await openViewerWithData(remind);
}

/**
 * 리마인드 없이 채팅 전체를 뷰어로 감상 (채팅 목록 ⋮ 메뉴에서)
 * 진행 위치는 채팅별 임시 ID로 저장되어 이어 읽기도 동작
 * @param {string} avatar
 * @param {string} charName
 * @param {string} fileName
 */
export async function openChatInViewer(avatar, charName, fileName) {
    const cleanName = (fileName || '').replace(/\.jsonl$/i, '');
    await openViewerWithData({
        id: `adhoc_${avatar}::${cleanName}`, // 진행 저장용 안정 키
        avatar,
        charName: charName || avatar.replace(/\.[^.]+$/, ''),
        fileName: cleanName,
        start: null,
        end: null,
        note: '',
        _adhoc: true,
    });
}

/**
 * 뷰어 열기 (공통)
 * @param {Object} remind - 리마인드 또는 임시 감상 객체
 */
async function openViewerWithData(remind) {
    closeRemindViewer(); // 기존 뷰어 정리

    const overlay = document.getElementById('chat-lobby-remind-viewer');
    if (!overlay) {
        showToast('뷰어를 열 수 없습니다. 로비를 다시 열어주세요.', 'error');
        return;
    }

    currentRemind = remind;
    currentMessages = null;
    regexEnabled = true;
    pageIndex = 0;
    pendingHighlight = null;
    warnedLargeAll = false;

    const rangeText = remind._adhoc
        ? '전체 감상'
        : (remind.start !== null || remind.end !== null)
            ? `#${remind.start ?? 0} ~ ${remind.end !== null ? '#' + remind.end : '끝'}`
            : '전체';

    const pageSize = getPageSize();
    const fontSize = getFontSize();
    const readerTheme = getReaderTheme();

    overlay.innerHTML = `
        <div class="remind-viewer-panel" data-reader-theme="${readerTheme}">
            <header class="remind-viewer-header" id="remind-viewer-header">
                <div class="remind-viewer-toprow">
                    <div class="remind-viewer-title">
                        <span class="remind-viewer-char">${escapeHtml(remind.charName || '')}</span>
                        <span class="remind-viewer-file">${escapeHtml(remind.fileName)} · ${escapeHtml(rangeText)}</span>
                        ${remind.note ? `<span class="remind-viewer-note">🔖 ${escapeHtml(remind.note)}</span>` : ''}
                    </div>
                    <div class="remind-viewer-topbtns">
                        <button class="remind-viewer-btn" id="remind-continue-chat" title="이 채팅 이어서 하기">▶️ 이어 채팅</button>
                        <button class="remind-viewer-btn" id="remind-add-here" title="현재 보는 구간을 리마인드로 저장">🔖</button>
                        <button class="remind-viewer-btn" id="remind-settings-toggle" title="뷰어 설정">⚙️</button>
                        <button class="remind-viewer-close" title="닫기">✕</button>
                    </div>
                </div>
                <div class="remind-viewer-pagrow">
                    <button class="remind-viewer-btn" id="remind-page-prev10" title="10페이지 앞으로 (Shift+←)">«</button>
                    <button class="remind-viewer-btn" id="remind-page-prev" title="이전 페이지 (범위 앞도 이어서 불러옴)">◀</button>
                    <span class="remind-page-label" id="remind-page-label">-</span>
                    <button class="remind-viewer-btn" id="remind-page-next" title="다음 페이지 (범위 끝나면 이어서 불러옴)">▶</button>
                    <button class="remind-viewer-btn" id="remind-page-next10" title="10페이지 뒤로 (Shift+→)">»</button>
                </div>
                <div class="remind-settings-pop" id="remind-settings-pop" style="display:none;">
                    <div class="remind-set-row">
                        <span class="remind-set-label">페이지당</span>
                        <select class="remind-viewer-select" id="remind-page-size">
                            ${PAGE_SIZE_OPTIONS.map(n => `
                                <option value="${n}" ${n === pageSize ? 'selected' : ''}>${n === 0 ? '모두' : n + '개씩'}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="remind-set-row">
                        <span class="remind-set-label">글자 크기</span>
                        <div class="remind-set-inline">
                            <button class="remind-viewer-btn" id="remind-font-minus">A−</button>
                            <span class="remind-page-label" id="remind-font-label">${fontSize}px</span>
                            <button class="remind-viewer-btn" id="remind-font-plus">A＋</button>
                        </div>
                    </div>
                    <div class="remind-set-row">
                        <span class="remind-set-label">읽기 테마</span>
                        <select class="remind-viewer-select" id="remind-theme-select">
                            ${READER_THEMES.map(t => `
                                <option value="${t.id}" ${t.id === readerTheme ? 'selected' : ''}>${t.name}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="remind-set-row remind-set-actions">
                        <button class="remind-viewer-btn" id="remind-viewer-regex" title="ST 정규식 스크립트 적용 켜기/끄기">✨ 정규식 ON</button>
                        <button class="remind-viewer-btn" id="remind-viewer-export" title="이 구간 전체를 텍스트 파일로 백업">💾 백업</button>
                    </div>
                </div>
            </header>
            <div class="remind-viewer-body">
                <div class="remind-viewer-loading">📖 채팅을 불러오는 중...</div>
            </div>
            <div class="remind-scrollbar" id="remind-scrollbar">
                <div class="remind-scroll-thumb" id="remind-scroll-thumb"></div>
            </div>
            <div class="remind-hl-popup" id="remind-hl-popup" style="display:none;">
                <button id="remind-hl-save">🖍️ 형광펜</button>
                <button id="remind-hl-clear" title="선택 해제">✕</button>
            </div>
            <div class="remind-lightbox" id="remind-lightbox">
                <div class="remind-lightbox-backdrop"></div>
                <div class="remind-lightbox-content">
                    <img class="remind-lightbox-img" src="" alt="">
                    <div class="remind-lightbox-caption"></div>
                    <button class="remind-lightbox-close" title="닫기">✕</button>
                </div>
            </div>
        </div>
    `;

    overlay.classList.add('visible');
    isViewerOpen = true;

    applyFontSize(fontSize);

    // ===== 이벤트 바인딩 =====
    listeners.add('remindViewer', overlay.querySelector('.remind-viewer-close'), 'click', closeRemindViewer);
    listeners.add('remindViewer', overlay.querySelector('#remind-viewer-regex'), 'click', toggleRegex);
    listeners.add('remindViewer', overlay.querySelector('#remind-viewer-export'), 'click', exportCurrentRange);
    listeners.add('remindViewer', overlay.querySelector('#remind-continue-chat'), 'click', continueChat);
    listeners.add('remindViewer', overlay.querySelector('#remind-add-here'), 'click', addRemindFromViewer);

    // 설정 팝업 토글
    listeners.add('remindViewer', overlay.querySelector('#remind-settings-toggle'), 'click', (e) => {
        e.stopPropagation();
        toggleSettingsPop();
    });

    // 페이지네이션 (+범위 연장)
    listeners.add('remindViewer', overlay.querySelector('#remind-page-prev'), 'click', () => changePage(-1));
    listeners.add('remindViewer', overlay.querySelector('#remind-page-next'), 'click', () => changePage(1));
    listeners.add('remindViewer', overlay.querySelector('#remind-page-prev10'), 'click', () => changePage(-PAGE_JUMP));
    listeners.add('remindViewer', overlay.querySelector('#remind-page-next10'), 'click', () => changePage(PAGE_JUMP));
    listeners.add('remindViewer', overlay.querySelector('#remind-page-size'), 'change', (e) => {
        uiPrefs.set('viewerPageSize', parseInt(e.target.value, 10) || 0);
        pageIndex = 0;
        renderMessages();
    });

    // 글자 크기
    listeners.add('remindViewer', overlay.querySelector('#remind-font-minus'), 'click', () => changeFontSize(-1));
    listeners.add('remindViewer', overlay.querySelector('#remind-font-plus'), 'click', () => changeFontSize(1));

    // 읽기 테마
    listeners.add('remindViewer', overlay.querySelector('#remind-theme-select'), 'change', (e) => {
        uiPrefs.set('viewerTheme', e.target.value);
        const panel = overlay.querySelector('.remind-viewer-panel');
        if (panel) panel.dataset.readerTheme = e.target.value;
    });

    // 패널 밖(어두운 영역) 클릭 시 닫기
    listeners.add('remindViewer', overlay, 'click', (e) => {
        if (e.target === overlay) closeRemindViewer();
    });
    listeners.add('remindViewer', document, 'keydown', handleViewerKeydown);

    const viewerBody = overlay.querySelector('.remind-viewer-body');

    // 자동 숨김 플로팅 헤더 + 진행 위치 저장
    let lastScrollTop = 0;
    listeners.add('remindViewer', viewerBody, 'scroll', () => {
        const header = document.getElementById('remind-viewer-header');
        if (header) {
            const st = viewerBody.scrollTop;
            if (st < 40) {
                header.classList.remove('header-hidden');
            } else if (st > lastScrollTop + 6) {
                header.classList.add('header-hidden');
                hideSettingsPop();
            } else if (st < lastScrollTop - 6) {
                header.classList.remove('header-hidden');
            }
            lastScrollTop = st;
        }
        scheduleProgressSave();
        hideHighlightPopup();
        updateScrollThumb();
    }, { passive: true });

    // 커스텀 스크롤 핸들 (홀드 드래그로 빠른 위치 이동)
    bindScrollThumb(overlay, viewerBody);

    // 본문 클릭: 선택 해제 → 설정 팝업 닫기 → 형광펜 제거 → 이미지 라이트박스
    listeners.add('remindViewer', viewerBody, 'click', async (e) => {
        hideSettingsPop();

        // 모바일: 텍스트 선택이 살아있는 상태에서 본문을 탭하면 선택 해제
        // (일부 WebView가 기본 동작으로 안 풀어줘서 직접 처리.
        //  500ms 가드 - PC에서 드래그 직후 발생하는 click이 방금 만든 선택을 지우는 것 방지)
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && selectionActiveSince
            && Date.now() - selectionActiveSince > 500) {
            clearTextSelection();
            return; // 이 탭은 선택 해제로 소비
        }

        const mark = e.target.closest('.remind-highlight');
        if (mark) {
            e.preventDefault();
            e.stopPropagation();
            const hlId = mark.dataset.hlId;
            const confirmed = await showConfirm('이 형광펜을 지울까요?');
            if (confirmed && hlId) {
                highlightStore.remove(hlId);
                unwrapHighlight(hlId);
            }
            return;
        }

        const img = e.target.closest('img');
        if (img) {
            e.preventDefault();
            e.stopPropagation();
            openLightbox(img.src, img.alt || img.title || '');
        }
    });

    // 형광펜: 텍스트 선택 감지
    // - PC: mouseup 즉시
    // - 모바일: 길게 눌러 선택/핸들 조정은 touchend가 안 잡히는 경우가 많아
    //   document의 selectionchange로 감지해야 안정적
    listeners.add('remindViewer', viewerBody, 'mouseup', () => setTimeout(handleTextSelection, 10));
    listeners.add('remindViewer', document, 'selectionchange', () => {
        if (!isViewerOpen) return;
        if (selChangeTimer) clearTimeout(selChangeTimer);
        selChangeTimer = setTimeout(handleTextSelection, 180);
    });

    // 팝업 버튼: mousedown preventDefault로 선택 collapse 방지 (서식 툴바 표준 트릭)
    const hlPopup = overlay.querySelector('#remind-hl-popup');
    listeners.add('remindViewer', hlPopup, 'mousedown', (e) => {
        e.preventDefault();
        hlPopupInteracting = true;
    });
    listeners.add('remindViewer', hlPopup, 'touchstart', () => {
        hlPopupInteracting = true;
    }, { passive: true });
    listeners.add('remindViewer', overlay.querySelector('#remind-hl-save'), 'click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        saveHighlightFromSelection();
        hlPopupInteracting = false;
    });
    listeners.add('remindViewer', overlay.querySelector('#remind-hl-clear'), 'click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        clearTextSelection();
        hlPopupInteracting = false;
    });

    // 라이트박스
    listeners.add('remindViewer', overlay.querySelector('.remind-lightbox-backdrop'), 'click', closeLightbox);
    listeners.add('remindViewer', overlay.querySelector('.remind-lightbox-close'), 'click', closeLightbox);

    // 이미지 로드 실패 폴백
    listeners.add('remindViewer', viewerBody, 'error', (e) => {
        const img = e.target;
        if (img?.tagName === 'IMG' && img.closest('.remind-image-container')) {
            img.closest('.remind-image-container').innerHTML =
                `<div class="remind-image-fallback">🖼️ ${escapeHtml(img.alt || '이미지를 찾을 수 없음')}</div>`;
        }
    }, true);

    // 정규식 iframe 높이 통신
    listeners.add('remindViewer', window, 'message', (e) => {
        if (e.data?.type !== 'remind-iframe-resize' || typeof e.data.height !== 'number') return;
        const iframes = document.querySelectorAll('#chat-lobby-remind-viewer iframe.remind-regex-iframe');
        for (const frame of iframes) {
            if (frame.contentWindow === e.source) {
                const h = Math.ceil(e.data.height);
                frame.style.height = (h > 20 ? h : 400) + 'px';
                break;
            }
        }
    });

    // ===== 데이터 로드 + 렌더 =====
    const body = overlay.querySelector('.remind-viewer-body');
    try {
        const messages = await api.getChatMessages(remind.avatar, remind.fileName);
        if (!messages || messages.length === 0) {
            body.innerHTML = '<div class="remind-viewer-loading">⚠️ 채팅을 불러오지 못했습니다. (파일이 삭제되었거나 이름이 바뀌었을 수 있어요)</div>';
            return;
        }
        currentMessages = messages;

        // 보기 범위 초기화 (+ 채팅 길이를 벗어난 저장값 자동 보정)
        const total = messages.length;
        viewStart = Math.max(0, remind.start ?? 0);
        viewEnd = Math.min(total - 1, remind.end ?? total - 1);

        const progress = remindStore.getProgress(remind.id);
        if (progress) {
            viewStart = Math.max(0, progress.viewStart ?? viewStart);
            viewEnd = Math.max(viewStart, progress.viewEnd ?? viewEnd);
            pageIndex = Math.max(0, progress.pageIndex ?? 0);
        }

        // ★ 범위가 채팅 길이를 통째로 벗어나면 (괴상한 숫자 입력 등) 끝 구간으로 보정
        if (viewStart > total - 1) {
            viewStart = Math.max(0, total - (getPageSize() || 20));
            viewEnd = total - 1;
            pageIndex = 0;
            showToast(`범위가 채팅 길이(${total}개)를 벗어나 끝 구간으로 이동했어요.`, 'warning');
        }
        viewEnd = Math.min(total - 1, viewEnd);

        renderMessages();

        // 스크롤 위치 복원
        if (progress?.scrollTop > 0) {
            body.scrollTop = progress.scrollTop;
        }
    } catch (e) {
        console.error('[RemindViewer] Load failed:', e);
        body.innerHTML = '<div class="remind-viewer-loading">⚠️ 채팅 로딩 중 오류가 발생했습니다.</div>';
    }
}

/**
 * 뷰어 닫기
 */
export function closeRemindViewer() {
    if (isViewerOpen) saveProgressNow();

    const overlay = document.getElementById('chat-lobby-remind-viewer');
    if (overlay) {
        overlay.classList.remove('visible');
        overlay.innerHTML = '';
    }
    if (progressSaveTimer) {
        clearTimeout(progressSaveTimer);
        progressSaveTimer = null;
    }
    if (hlHideTimer) {
        clearTimeout(hlHideTimer);
        hlHideTimer = null;
    }
    if (selChangeTimer) {
        clearTimeout(selChangeTimer);
        selChangeTimer = null;
    }
    if (iframeObserver) {
        iframeObserver.disconnect();
        iframeObserver = null;
    }
    listeners.clear('remindViewer');
    isViewerOpen = false;
    currentRemind = null;
    currentMessages = null;
    pendingHighlight = null;
    hlPopupInteracting = false;
    selectionActiveSince = 0;
}

/**
 * ESC 처리용: 최상위 레이어(라이트박스 → 설정팝업 → 뷰어) 하나만 닫기
 * @returns {boolean} 닫은 게 있으면 true
 */
export function closeTopRemindLayer() {
    if (!isViewerOpen) return false;

    const lb = document.getElementById('remind-lightbox');
    if (lb?.classList.contains('active')) {
        closeLightbox();
        return true;
    }
    const pop = document.getElementById('remind-settings-pop');
    if (pop && pop.style.display !== 'none') {
        hideSettingsPop();
        return true;
    }
    closeRemindViewer();
    return true;
}

function handleViewerKeydown(e) {
    if (!isViewerOpen) return;

    // ⚠️ ESC는 여기서 처리하지 않음!
    // index.js의 전역 keydown(closeTopRemindLayer)이 먼저 실행되므로,
    // 여기서 또 닫으면 ESC 한 번에 레이어가 두 개씩 닫히는 버그가 됨

    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

    // 셀렉트/입력 포커스 중에는 페이지 넘김 금지 (설정 팝업 조작과 충돌)
    const tag = e.target?.tagName;
    if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;

    // 라이트박스가 떠 있는 동안에도 금지 (뒤에서 페이지가 넘어가는 혼란 방지)
    const lb = document.getElementById('remind-lightbox');
    if (lb?.classList.contains('active')) return;

    // Shift+방향키는 10페이지씩
    const step = e.shiftKey ? PAGE_JUMP : 1;
    changePage(e.key === 'ArrowLeft' ? -step : step);
}

// ============================================
// 설정 팝업
// ============================================

function toggleSettingsPop() {
    const pop = document.getElementById('remind-settings-pop');
    if (!pop) return;
    pop.style.display = pop.style.display === 'none' ? 'block' : 'none';
}

function hideSettingsPop() {
    const pop = document.getElementById('remind-settings-pop');
    if (pop) pop.style.display = 'none';
}

// ============================================
// 설정 (글자 / 페이지 / 테마)
// ============================================

function getFontSize() {
    const v = parseInt(uiPrefs.get('viewerFontSize'), 10);
    return Math.min(FONT_MAX, Math.max(FONT_MIN, isNaN(v) ? 15 : v));
}

function getPageSize() {
    const v = parseInt(uiPrefs.get('viewerPageSize'), 10);
    return PAGE_SIZE_OPTIONS.includes(v) ? v : 10;
}

/**
 * 실효 페이지 크기 - "모두" 모드라도 메시지가 너무 많으면 강제 페이지 처리
 * (한 번에 수백 메시지 + 정규식 iframe 렌더 → 모바일 크래시 방지)
 * @param {number} rangeLength - 현재 보기 범위의 메시지 수
 */
function getEffectivePageSize(rangeLength) {
    const ps = getPageSize();
    if (ps === 0 && rangeLength > MAX_ALL_RENDER) {
        if (!warnedLargeAll) {
            warnedLargeAll = true;
            showToast(`메시지가 ${rangeLength}개라 ${FORCED_PAGE_SIZE}개씩 나눠 표시합니다.`, 'info');
        }
        return FORCED_PAGE_SIZE;
    }
    return ps;
}

function getReaderTheme() {
    const v = uiPrefs.get('viewerTheme');
    return READER_THEMES.some(t => t.id === v) ? v : 'auto';
}

function applyFontSize(px) {
    const panel = document.querySelector('#chat-lobby-remind-viewer .remind-viewer-panel');
    if (panel) panel.style.setProperty('--remind-font', `${px}px`);
    const label = document.getElementById('remind-font-label');
    if (label) label.textContent = `${px}px`;
}

function changeFontSize(delta) {
    const next = Math.min(FONT_MAX, Math.max(FONT_MIN, getFontSize() + delta));
    uiPrefs.set('viewerFontSize', next);
    applyFontSize(next);
}

function toggleRegex() {
    regexEnabled = !regexEnabled;
    const btn = document.getElementById('remind-viewer-regex');
    if (btn) {
        btn.textContent = regexEnabled ? '✨ 정규식 ON' : '✨ 정규식 OFF';
        btn.classList.toggle('off', !regexEnabled);
    }
    renderMessages(true);
}

// ============================================
// 이어 읽기 (진행 위치 저장)
// ============================================

function scheduleProgressSave() {
    if (progressSaveTimer) clearTimeout(progressSaveTimer);
    progressSaveTimer = setTimeout(saveProgressNow, 600);
}

function saveProgressNow() {
    if (!currentRemind) return;
    const body = document.querySelector('#chat-lobby-remind-viewer .remind-viewer-body');
    remindStore.setProgress(currentRemind.id, {
        viewStart,
        viewEnd,
        pageIndex,
        scrollTop: body ? Math.round(body.scrollTop) : 0,
    });
}

// ============================================
// 데이터 슬라이스 / 페이지네이션 / 범위 연장
// ============================================

function getCurrentSlice() {
    if (!currentRemind || !currentMessages) return null;
    return {
        slice: currentMessages.slice(viewStart, viewEnd + 1),
        start: viewStart,
    };
}

function getTotalPages(rangeLength) {
    const pageSize = getEffectivePageSize(rangeLength);
    if (pageSize === 0) return 1;
    return Math.max(1, Math.ceil(rangeLength / pageSize));
}

/** 건너뛰기 버튼(« »)이 한 번에 넘기는 페이지 수 */
const PAGE_JUMP = 10;

/**
 * 페이지 이동 + 범위 연장 (이어서 보기)
 * @param {number} delta - 이동할 페이지 수 (음수 = 앞으로). ±1은 ◀▶, ±PAGE_JUMP는 «»
 *
 * 보기 범위 안에서는 pageIndex만 옮기고, 범위 끝을 넘어가는 만큼은 범위를 늘려서 이어 본다.
 */
function changePage(delta) {
    const data = getCurrentSlice();
    if (!data || !currentMessages || !delta) return;

    const total = currentMessages.length;
    const rangeLength = data.slice.length;
    const pageSize = getEffectivePageSize(rangeLength);
    const chunk = pageSize || 20;
    const totalPages = getTotalPages(rangeLength);
    let steps = Math.abs(delta);
    let moved = false;
    let extendedTo = null;

    if (delta > 0) {
        // 1) 범위 안에서 이동
        const inRange = Math.min(steps, totalPages - 1 - pageIndex);
        if (inRange > 0) {
            pageIndex += inRange;
            steps -= inRange;
            moved = true;
        }
        // 2) 남은 만큼 범위를 뒤로 늘림
        if (steps > 0 && viewEnd < total - 1) {
            if (pageSize === 0) {
                viewEnd = Math.min(total - 1, viewEnd + chunk * steps);
            } else {
                // 마지막 페이지가 덜 찬 상태면 첫 한 걸음은 그 페이지를 채우는 데 씀
                // (그냥 다음 페이지로 넘기면 채워진 부분을 건너뛰게 됨)
                const lastPagePartial = rangeLength % pageSize !== 0;
                const targetPage = pageIndex + steps - (lastPagePartial ? 1 : 0);
                viewEnd = Math.min(total - 1, viewStart + (targetPage + 1) * pageSize - 1);
                const newTotalPages = Math.ceil((viewEnd - viewStart + 1) / pageSize);
                pageIndex = Math.min(newTotalPages - 1, targetPage);
            }
            extendedTo = `~#${viewEnd}`;
            moved = true;
        }
    } else {
        const inRange = Math.min(steps, pageIndex);
        if (inRange > 0) {
            pageIndex -= inRange;
            steps -= inRange;
            moved = true;
        }
        // 남은 만큼 범위를 앞으로 늘림 → 늘어난 범위의 첫 페이지가 목표 페이지
        if (steps > 0 && viewStart > 0) {
            viewStart = Math.max(0, viewStart - chunk * steps);
            pageIndex = 0;
            extendedTo = `#${viewStart}~`;
            moved = true;
        }
    }

    if (!moved) return;
    if (extendedTo) {
        showToast(`📖 ${delta > 0 ? '다음' : '이전'} 구간 이어 보기 (${extendedTo})`, 'info', 1500);
    }

    renderMessages();
    scheduleProgressSave();
}

/**
 * 메시지 본문 (백업용 - 원문 기준)
 * ⚠️ mes 우선 - ST 표시 기준과 동일 (스와이프 배열은 mes가 비었을 때만 폴백)
 * autopic 등이 mes에만 이미지를 덧붙이는 경우가 있어 swipes 우선 시 이미지 누락됨
 */
function resolveMes(msg) {
    const mes = msg.mes || '';
    if (mes.trim()) return mes;
    if (Array.isArray(msg.swipes) && typeof msg.swipe_id === 'number'
        && msg.swipes[msg.swipe_id] !== undefined) {
        return msg.swipes[msg.swipe_id];
    }
    return mes;
}

// ============================================
// 이어서 채팅하기 / 뷰어 내 리마인드 추가
// ============================================

async function continueChat() {
    const r = currentRemind;
    if (!r) return;

    const context = api.getContext();
    const charIndex = (context?.characters || []).findIndex(c => c.avatar === r.avatar);
    if (charIndex === -1) {
        showToast('캐릭터를 찾을 수 없습니다.', 'error');
        return;
    }

    saveProgressNow();
    const info = { fileName: r.fileName, charAvatar: r.avatar, charIndex: String(charIndex) };
    closeRemindViewer();

    await openChat(info);
}

async function addRemindFromViewer() {
    const r = currentRemind;
    if (!r) return;

    const defaultRange = `${lastRenderedRange.from}-${lastRenderedRange.to}`;
    const rangeInput = await showPrompt(
        '저장할 메시지 범위 (현재 보는 페이지가 기본값)\n예: 120-130 / 120 / 비우면 전체',
        '🔖 이 구간 리마인드로 저장',
        defaultRange
    );
    if (rangeInput === null) return;

    let start = null;
    let end = null;
    const trimmed = rangeInput.trim();
    if (trimmed) {
        const match = trimmed.match(/^(\d+)\s*[-~]\s*(\d+)$/) || trimmed.match(/^(\d+)$/);
        if (!match) {
            showToast('범위 형식이 올바르지 않습니다. 예: 120-130', 'error');
            return;
        }
        start = parseInt(match[1], 10);
        end = match[2] !== undefined ? parseInt(match[2], 10) : start;
        if (end < start) [start, end] = [end, start];

        // 채팅 길이 기준 보정 (배포용 안전망)
        if (currentMessages) {
            const total = currentMessages.length;
            if (start > total - 1) {
                showToast(`이 채팅은 #${total - 1}까지만 있어요. 범위를 확인해주세요.`, 'error');
                return;
            }
            if (end > total - 1) end = total - 1;
        }
    }

    const note = await showPrompt('메모를 남겨주세요.', '🔖 리마인드 메모', '');
    if (note === null) return;

    remindStore.add({
        avatar: r.avatar,
        charName: r.charName,
        fileName: r.fileName,
        start,
        end,
        note: note.trim(),
    });

    showToast(`🔖 리마인드 저장됨${start !== null ? ` (#${start}~#${end})` : ''}`, 'success');
}

// ============================================
// 형광펜
// ============================================

function hideHighlightPopup() {
    if (hlHideTimer) {
        clearTimeout(hlHideTimer);
        hlHideTimer = null;
    }
    const popup = document.getElementById('remind-hl-popup');
    if (popup) popup.style.display = 'none';
}

/**
 * 팝업 지연 숨김 - 선택이 collapse된 직후 팝업 버튼을 누르는 순간을 허용
 * (즉시 숨기면 팝업 탭 → 선택 해제 → 팝업 사라짐 → 클릭 무효가 됨)
 */
function scheduleHideHighlightPopup() {
    if (hlHideTimer) clearTimeout(hlHideTimer);
    hlHideTimer = setTimeout(() => {
        hlHideTimer = null;
        if (!hlPopupInteracting) {
            hideHighlightPopup();
            pendingHighlight = null;
            selectionActiveSince = 0;
        }
    }, 280);
}

/**
 * 선택 강제 해제 (✕ 버튼 / 본문 탭)
 */
function clearTextSelection() {
    try {
        window.getSelection()?.removeAllRanges();
    } catch (e) { /* ignore */ }
    pendingHighlight = null;
    selectionActiveSince = 0;
    hideHighlightPopup();
}

function handleTextSelection() {
    const popup = document.getElementById('remind-hl-popup');
    const panel = document.querySelector('#chat-lobby-remind-viewer .remind-viewer-panel');
    if (!popup || !panel) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        scheduleHideHighlightPopup();
        return;
    }

    const text = sel.toString().trim();
    if (!text || text.length < 2 || text.length > 600) {
        scheduleHideHighlightPopup();
        return;
    }

    const range = sel.getRangeAt(0);
    const anchor = range.commonAncestorContainer;
    const anchorEl = anchor.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor;
    const article = anchorEl?.closest?.('.remind-msg');
    if (!article || !article.dataset.mesid) {
        scheduleHideHighlightPopup();
        return;
    }

    // 유효한 선택 → 숨김 예약 취소 + 활성 시각 기록
    if (hlHideTimer) {
        clearTimeout(hlHideTimer);
        hlHideTimer = null;
    }
    if (!selectionActiveSince) selectionActiveSince = Date.now();

    pendingHighlight = {
        mesid: parseInt(article.dataset.mesid, 10),
        text,
    };

    const rect = range.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const left = Math.min(panelRect.width - 130, Math.max(8, rect.left - panelRect.left));
    const top = Math.min(panelRect.height - 50, rect.bottom - panelRect.top + 8);
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
    popup.style.display = 'flex';
}

function saveHighlightFromSelection() {
    if (!pendingHighlight || !currentRemind) {
        hideHighlightPopup();
        return;
    }

    const { mesid, text } = pendingHighlight;
    const entry = highlightStore.add({
        avatar: currentRemind.avatar,
        fileName: currentRemind.fileName,
        mesid,
        text,
    });

    const article = document.querySelector(`#chat-lobby-remind-viewer .remind-msg[data-mesid="${mesid}"] .remind-msg-body`);
    if (article) {
        wrapTextOccurrence(article, text, entry.id);
    }

    window.getSelection()?.removeAllRanges();
    pendingHighlight = null;
    selectionActiveSince = 0;
    hideHighlightPopup();
    showToast('🖍️ 형광펜 저장됨 (탭하면 제거)', 'success', 1800);
}

function wrapTextOccurrence(rootEl, searchText, hlId) {
    if (!rootEl || !searchText) return false;

    const full = rootEl.textContent;
    const idx = full.indexOf(searchText);
    if (idx === -1) return false;
    const endIdx = idx + searchText.length;

    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
    let pos = 0;
    const targets = [];
    while (walker.nextNode()) {
        const node = walker.currentNode;
        const len = node.nodeValue.length;
        const nodeStart = pos;
        const nodeEnd = pos + len;
        if (nodeEnd > idx && nodeStart < endIdx) {
            targets.push({
                node,
                from: Math.max(0, idx - nodeStart),
                to: Math.min(len, endIdx - nodeStart),
            });
        }
        pos = nodeEnd;
        if (pos >= endIdx) break;
    }

    for (const t of targets) {
        try {
            const range = document.createRange();
            range.setStart(t.node, t.from);
            range.setEnd(t.node, t.to);
            const mark = document.createElement('mark');
            mark.className = 'remind-highlight';
            mark.dataset.hlId = hlId;
            range.surroundContents(mark);
        } catch (e) { /* 노드 경계 충돌 시 해당 조각만 건너뜀 */ }
    }
    return targets.length > 0;
}

function unwrapHighlight(hlId) {
    document.querySelectorAll(`#chat-lobby-remind-viewer mark[data-hl-id="${CSS.escape(hlId)}"]`)
        .forEach(mark => {
            while (mark.firstChild) {
                mark.parentNode.insertBefore(mark.firstChild, mark);
            }
            mark.remove();
        });
}

function applySavedHighlights(body) {
    if (!currentRemind) return;
    body.querySelectorAll('.remind-msg[data-mesid]').forEach(article => {
        const mesid = parseInt(article.dataset.mesid, 10);
        const hls = highlightStore.getForMessage(currentRemind.avatar, currentRemind.fileName, mesid);
        if (hls.length === 0) return;
        const msgBody = article.querySelector('.remind-msg-body');
        if (!msgBody) return;
        for (const hl of hls) {
            wrapTextOccurrence(msgBody, hl.text, hl.id);
        }
    });
}

// ============================================
// 라이트박스
// ============================================

function openLightbox(src, alt) {
    const lb = document.getElementById('remind-lightbox');
    if (!lb) return;
    lb.querySelector('.remind-lightbox-img').src = src;
    lb.querySelector('.remind-lightbox-img').alt = alt;
    lb.querySelector('.remind-lightbox-caption').textContent = alt;
    lb.classList.add('active');
}

function closeLightbox() {
    const lb = document.getElementById('remind-lightbox');
    if (lb) lb.classList.remove('active');
}

// ============================================
// 커스텀 스크롤 핸들 (홀드해서 자유롭게 내리는 스크롤바)
// 모바일 네이티브 스크롤바는 얇아서 못 잡으므로 큰 드래그 핸들 제공
// ============================================

/**
 * 본문 스크롤 위치에 맞춰 thumb 크기/위치 갱신
 */
function updateScrollThumb() {
    const body = document.querySelector('#chat-lobby-remind-viewer .remind-viewer-body');
    const bar = document.getElementById('remind-scrollbar');
    const thumb = document.getElementById('remind-scroll-thumb');
    if (!body || !bar || !thumb) return;

    const { scrollTop, scrollHeight, clientHeight } = body;

    // 스크롤할 게 없으면 숨김
    if (scrollHeight <= clientHeight + 4) {
        bar.style.display = 'none';
        return;
    }
    bar.style.display = 'block';

    const track = bar.clientHeight;
    const thumbH = Math.max(44, Math.round(track * (clientHeight / scrollHeight)));
    const maxThumbTop = track - thumbH;
    const maxScroll = scrollHeight - clientHeight;
    const top = maxScroll > 0 ? Math.round((scrollTop / maxScroll) * maxThumbTop) : 0;

    thumb.style.height = `${thumbH}px`;
    thumb.style.transform = `translateY(${top}px)`;
}

/**
 * 스크롤 핸들 드래그 바인딩 (pointer 이벤트 - PC/모바일 통합)
 */
function bindScrollThumb(overlay, body) {
    const bar = overlay.querySelector('#remind-scrollbar');
    const thumb = overlay.querySelector('#remind-scroll-thumb');
    if (!bar || !thumb) return;

    let dragging = false;
    let startY = 0;
    let startScrollTop = 0;

    const onMove = (e) => {
        if (!dragging) return;
        e.preventDefault();
        const track = bar.clientHeight;
        const thumbH = thumb.offsetHeight;
        const maxThumbTop = track - thumbH;
        const maxScroll = body.scrollHeight - body.clientHeight;
        if (maxThumbTop <= 0 || maxScroll <= 0) return;

        const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0;
        const deltaY = clientY - startY;
        const ratio = maxScroll / maxThumbTop;
        body.scrollTop = startScrollTop + deltaY * ratio;
    };

    const onUp = (e) => {
        if (!dragging) return;
        dragging = false;
        thumb.classList.remove('dragging');
        try { thumb.releasePointerCapture?.(e.pointerId); } catch (err) { /* ignore */ }
    };

    listeners.add('remindViewer', thumb, 'pointerdown', (e) => {
        dragging = true;
        startY = e.clientY;
        startScrollTop = body.scrollTop;
        thumb.classList.add('dragging');
        try { thumb.setPointerCapture?.(e.pointerId); } catch (err) { /* ignore */ }
        e.preventDefault();
        e.stopPropagation();
    });
    listeners.add('remindViewer', thumb, 'pointermove', onMove);
    listeners.add('remindViewer', thumb, 'pointerup', onUp);
    listeners.add('remindViewer', thumb, 'pointercancel', onUp);

    // 트랙(빈 영역) 클릭 시 그 위치로 점프
    listeners.add('remindViewer', bar, 'pointerdown', (e) => {
        if (e.target !== bar) return; // thumb 클릭은 제외
        const rect = bar.getBoundingClientRect();
        const clickRatio = (e.clientY - rect.top) / rect.height;
        const maxScroll = body.scrollHeight - body.clientHeight;
        body.scrollTop = clickRatio * maxScroll;
    });
}

// ============================================
// 렌더링
// ============================================

function renderMessages(keepScroll = false) {
    const body = document.querySelector('#chat-lobby-remind-viewer .remind-viewer-body');
    const data = getCurrentSlice();
    if (!body || !data) return;

    const { slice, start } = data;

    if (slice.length === 0) {
        body.innerHTML = `<div class="remind-viewer-loading">⚠️ 해당 범위에 메시지가 없습니다. (채팅 길이: ${currentMessages.length})<br><small>◀ 버튼으로 이전 구간을 불러올 수 있어요.</small></div>`;
        updatePageControls(0, 0);
        return;
    }

    const pageSize = getEffectivePageSize(slice.length);
    const totalPages = getTotalPages(slice.length);
    pageIndex = Math.min(totalPages - 1, Math.max(0, pageIndex));

    const pageStart = pageSize === 0 ? 0 : pageIndex * pageSize;
    const pageSlice = pageSize === 0 ? slice : slice.slice(pageStart, pageStart + pageSize);

    const userName = currentMessages.find(m => m.is_user)?.name || 'User';
    const charName = currentRemind.charName
        || currentMessages.find(m => !m.is_user && !m.is_system)?.name
        || 'Character';

    const prevScroll = body.scrollTop;

    let html = '';
    pageSlice.forEach((msg, i) => {
        const mesid = start + pageStart + i;

        let formatted = renderMessageHtml(msg, {
            characterName: charName,
            userName: userName,
            charAvatar: currentRemind.avatar,
            applyRegex: regexEnabled,
        });

        // 빈 응답(빈 메시지/빈 스와이프)도 자리를 차지하게 플레이스홀더 표시
        // → "빈 응답 채팅에서 메시지가 누락된 것처럼 보이던" 문제 해소
        if (!formatted || !formatted.trim()) {
            formatted = '<div class="remind-empty-msg">— 빈 응답 —</div>';
        }

        const roleClass = msg.is_user ? 'is-user' : (msg.is_system ? 'is-system' : 'is-char');
        html += `
        <article class="remind-msg ${roleClass}" data-mesid="${mesid}">
            <div class="remind-msg-meta">
                <span class="remind-msg-name">${escapeHtml(msg.name || (msg.is_user ? userName : charName))}</span>
                <span class="remind-msg-id">#${mesid}</span>
            </div>
            <div class="remind-msg-body">${formatted}</div>
        </article>`;
    });

    body.innerHTML = html;
    body.scrollTop = keepScroll ? prevScroll : 0;

    const rangeFrom = start + pageStart;
    const rangeTo = start + pageStart + pageSlice.length - 1;
    lastRenderedRange = { from: rangeFrom, to: rangeTo };
    updatePageControls(totalPages, slice.length, rangeFrom, rangeTo);

    document.getElementById('remind-viewer-header')?.classList.remove('header-hidden');
    hideHighlightPopup();
    hideSettingsPop();

    hydrateRegexIframes(body);
    applySavedHighlights(body);

    // 스크롤 핸들 갱신 (렌더 직후 + 이미지 로드로 높이 바뀔 수 있어 지연 1회 더)
    updateScrollThumb();
    setTimeout(updateScrollThumb, 300);
}

function updatePageControls(totalPages, rangeLength, rangeFrom = 0, rangeTo = 0) {
    const label = document.getElementById('remind-page-label');
    const prevBtn = document.getElementById('remind-page-prev');
    const nextBtn = document.getElementById('remind-page-next');
    const total = currentMessages?.length || 0;

    if (label) {
        if (rangeLength === 0) {
            label.textContent = '-';
        } else if (totalPages <= 1) {
            label.textContent = `#${rangeFrom}~#${rangeTo}`;
        } else {
            label.textContent = `#${rangeFrom}~#${rangeTo} (${pageIndex + 1}/${totalPages})`;
        }
    }

    const atStart = pageIndex <= 0 && viewStart <= 0;
    const atEnd = pageIndex >= totalPages - 1 && viewEnd >= total - 1;
    if (prevBtn) prevBtn.disabled = atStart;
    if (nextBtn) nextBtn.disabled = atEnd;
    const prev10Btn = document.getElementById('remind-page-prev10');
    const next10Btn = document.getElementById('remind-page-next10');
    if (prev10Btn) prev10Btn.disabled = atStart;
    if (next10Btn) next10Btn.disabled = atEnd;
}

/**
 * iframe 하나에 내용 주입 (base64 → srcdoc)
 */
function hydrateOneIframe(iframe) {
    const b64 = iframe.getAttribute('data-remind-html');
    iframe.removeAttribute('data-remind-html');
    if (!b64) return;

    try {
        iframe.srcdoc = decodeURIComponent(escape(atob(b64)));
    } catch (e) {
        console.warn('[RemindViewer] iframe srcdoc set failed:', e);
        iframe.replaceWith(Object.assign(document.createElement('div'), {
            className: 'remind-html-notice',
            textContent: '🧩 HTML 블록을 표시하지 못했습니다.',
        }));
        return;
    }

    iframe.addEventListener('load', () => {
        setTimeout(() => {
            if (!iframe.style.height || iframe.style.height === '0px') {
                iframe.style.height = '400px';
            }
        }, 800);
    });
}

/**
 * 정규식 iframe lazy hydration
 * ⚠️ 한 번에 전부 srcdoc 주입 금지!
 * iframe 하나하나가 스크립트+옵저버가 도는 통짜 브라우징 컨텍스트라,
 * 큰 채팅에서 수십 개를 동시에 살리면 모바일 WebView가 메모리 초과로 죽음(튕김).
 * → IntersectionObserver로 화면 근처(±600px)에 온 것만 그때그때 생성
 */
function hydrateRegexIframes(scope) {
    // 이전 페이지의 옵저버 정리
    if (iframeObserver) {
        iframeObserver.disconnect();
        iframeObserver = null;
    }

    const frames = scope.querySelectorAll('iframe.remind-regex-iframe[data-remind-html]');
    if (frames.length === 0) return;

    // 구형 브라우저 폴백: 옵저버 없으면 즉시 하이드레이션 (기존 동작)
    if (typeof IntersectionObserver === 'undefined') {
        frames.forEach(hydrateOneIframe);
        return;
    }

    iframeObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                iframeObserver?.unobserve(entry.target);
                hydrateOneIframe(entry.target);
            }
        }
    }, { root: scope, rootMargin: '600px 0px' });

    frames.forEach(f => iframeObserver.observe(f));
}

// ============================================
// 백업 (.txt 다운로드)
// ============================================

function exportCurrentRange() {
    const data = getCurrentSlice();
    if (!data || data.slice.length === 0) {
        showToast('내보낼 메시지가 없습니다.', 'warning');
        return;
    }

    const { slice, start } = data;
    const r = currentRemind;
    const rangeText = `#${viewStart}~#${viewEnd}`;

    let text = `🔖 ${r.charName} - ${r.fileName} (${rangeText})\n`;
    if (r.note) text += `메모: ${r.note}\n`;
    text += `백업일: ${new Date().toLocaleString('ko-KR')}\n`;
    text += '='.repeat(40) + '\n\n';

    slice.forEach((msg, i) => {
        text += `[#${start + i}] ${msg.name || (msg.is_user ? 'User' : r.charName)}\n`;
        text += resolveMes(msg) + '\n\n';
        text += '-'.repeat(40) + '\n\n';
    });

    const safeName = `${r.charName}_${r.fileName}_${rangeText}`.replace(/[\\/:*?"<>|#~\s]+/g, '_');
    const blob = new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `remind_${safeName}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showToast('💾 텍스트 파일로 백업했습니다.', 'success');
}
