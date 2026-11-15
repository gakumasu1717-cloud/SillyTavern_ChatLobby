// ============================================
// 봇 여러 개 선택 → 한 번에 삭제
//
// 선택 모드에서는 카드를 눌러도 채팅 목록이 열리지 않고 선택만 토글된다.
// 선택은 avatar 기준으로 기억하므로 검색/정렬로 그리드가 다시 그려져도 유지된다.
// ============================================

import { api } from '../api/sillyTavern.js';
import { cache } from '../data/cache.js';
import { storage } from '../data/storage.js';
import { operationLock } from '../utils/operationLock.js';
import { escapeHtml } from '../utils/textUtils.js';
import { showToast, showConfirm } from './notifications.js';
import { removeCharacter as removeSessionCharacter } from '../data/sessionStore.js';

const BAR_ID = 'chat-lobby-char-batch-bar';

let active = false;
/** @type {Set<string>} 선택된 캐릭터 avatar */
const selected = new Set();

export function isCharBatchMode() {
    return active;
}

export function isCharBatchSelected(avatar) {
    return active && selected.has(avatar);
}

function grid() {
    return document.getElementById('chat-lobby-characters');
}

function refreshGrid() {
    window.dispatchEvent(new CustomEvent('chatlobby:refresh-grid'));
}

/**
 * 선택 모드 켜기/끄기
 * @param {boolean} [force]
 */
export function toggleCharBatchMode(force) {
    const next = typeof force === 'boolean' ? force : !active;
    if (next === active) return;
    active = next;
    selected.clear();

    document.getElementById('chat-lobby-container')?.classList.toggle('char-batch-mode', active);
    document.getElementById('chat-lobby-char-batch-btn')?.classList.toggle('active', active);
    grid()?.querySelectorAll('.batch-selected').forEach(el => el.classList.remove('batch-selected'));

    if (active) {
        renderBar();
    } else {
        document.getElementById(BAR_ID)?.remove();
    }
}

/**
 * 카드 선택 토글 (그리드 클릭 라우터에서 호출)
 * @param {HTMLElement} card
 */
export function toggleCharBatchCard(card) {
    const avatar = card?.dataset.charAvatar;
    if (!active || !avatar) return;

    if (selected.has(avatar)) {
        selected.delete(avatar);
    } else {
        selected.add(avatar);
    }
    // 같은 캐릭터의 카드가 그리드와 최애 코너에 둘 다 있을 수 있음
    document.querySelectorAll(`.lobby-char-card[data-char-avatar="${CSS.escape(avatar)}"]`)
        .forEach(el => el.classList.toggle('batch-selected', selected.has(avatar)));
    updateBar();
}

function renderBar() {
    document.getElementById(BAR_ID)?.remove();
    const host = document.getElementById('chat-lobby-left');
    if (!host) return;

    const bar = document.createElement('div');
    bar.id = BAR_ID;
    bar.innerHTML = `
        <span class="char-batch-count" id="chat-lobby-char-batch-count">0개 선택</span>
        <div class="char-batch-actions">
            <button data-action="char-batch-select-all" title="지금 목록에 보이는 봇 전부 선택">전체 선택</button>
            <button data-action="char-batch-clear">선택 해제</button>
            <button class="char-batch-delete" data-action="char-batch-delete" disabled>🗑️ 삭제</button>
            <button data-action="toggle-char-batch" title="선택 모드 끝내기">✕</button>
        </div>
    `;
    host.appendChild(bar);
}

function updateBar() {
    const count = document.getElementById('chat-lobby-char-batch-count');
    if (count) count.textContent = `${selected.size}개 선택`;
    const del = document.querySelector(`#${BAR_ID} .char-batch-delete`);
    if (del) del.disabled = selected.size === 0;
}

/**
 * 지금 그리드에 그려진 캐릭터 전부 선택 (검색/태그 필터가 걸려 있으면 그 결과만)
 */
export function charBatchSelectAll() {
    if (!active) return;
    grid()?.querySelectorAll('.lobby-char-card[data-char-avatar]:not(.lobby-skeleton-card)').forEach(card => {
        selected.add(card.dataset.charAvatar);
        card.classList.add('batch-selected');
    });
    updateBar();
}

export function charBatchClear() {
    selected.clear();
    grid()?.querySelectorAll('.batch-selected').forEach(el => el.classList.remove('batch-selected'));
    updateBar();
}

/**
 * 선택한 봇 삭제 (채팅 포함)
 */
export async function charBatchDelete() {
    if (!active || selected.size === 0) return;

    const characters = api.getCharacters();
    const targets = [...selected]
        .map(avatar => characters.find(c => c.avatar === avatar))
        .filter(Boolean);
    if (targets.length === 0) {
        showToast('삭제할 봇을 찾을 수 없습니다.', 'error');
        return;
    }

    const names = targets.slice(0, 8).map(c => `· ${c.name}`).join('\n');
    const more = targets.length > 8 ? `\n… 외 ${targets.length - 8}개` : '';
    const confirmed = await showConfirm(
        `선택한 봇 ${targets.length}개와 그 채팅을 전부 삭제하시겠습니까?\n\n${names}${more}\n\n이 작업은 되돌릴 수 없습니다.`,
        '봇 일괄 삭제',
        true
    );
    if (!confirmed) return;

    // 캐릭터당 채팅 폴더 삭제까지 걸리는 시간 고려 (최대 3분)
    const token = operationLock.acquire('batchDeleteCharacters', Math.min(180000, 20000 + targets.length * 3000));
    if (!token) {
        showToast('다른 작업이 진행 중입니다.', 'warning');
        return;
    }

    try {
        showToast(`봇 ${targets.length}개 삭제 중...`, 'info');
        const avatars = targets.map(c => c.avatar);
        const { deleted, failed } = await api.deleteCharacters(avatars);

        // 로비 쪽 데이터 정리 (ST 이벤트로도 정리되지만, 대체 경로에서는 이벤트가 없음)
        for (const avatar of deleted) {
            storage.removeCharacterData(avatar);
            removeSessionCharacter(avatar);
            cache.invalidate('chats', avatar);
            cache.invalidate('chatCounts', avatar);
            cache.invalidate('messageCounts', avatar);
        }
        cache.invalidate('characters');

        if (failed.length === 0) {
            showToast(`봇 ${deleted.length}개를 삭제했습니다.`, 'success');
        } else {
            const failedNames = failed
                .map(avatar => targets.find(c => c.avatar === avatar)?.name || avatar)
                .slice(0, 5).map(escapeHtml).join(', ');
            showToast(`${deleted.length}개 삭제, ${failed.length}개 실패 (${failedNames})`, 'warning', 6000);
        }

        toggleCharBatchMode(false);
        refreshGrid();
    } catch (error) {
        console.error('[CharBatch] Bulk delete failed:', error);
        showToast('봇 삭제 중 오류가 발생했습니다.', 'error');
    } finally {
        operationLock.release(token);
    }
}
