// ============================================
// 세션 화면 상태 (지금 열려 있는 캐릭터 한 명 기준)
//
// - 어느 캐릭터인지, 카드 화면인지 채팅 목록인지, 어떤 세션을 보고 있는지
// - "다음에 이 봇에서 생기는 새 채팅을 세션 X에 넣기" 기억 (명세 6절)
//
// ⚠️ 저장소(sessionStore)의 값은 여기에 들고 있지 않는다. 화면 상태만 둔다.
// ⚠️ 채팅 패널이 닫히거나 다른 캐릭터가 열리면 화면 상태는 초기화된다.
//    새 채팅 기억은 그 초기화와 별개다 (로비가 닫힌 채로 CHAT_CHANGED가 오기 때문).
// ============================================

import { api } from '../../api/sillyTavern.js';
import { cache } from '../../data/cache.js';
import {
    SESSION_ALL, SESSION_UNSORTED,
    addChats, getSession, hasSessions,
} from '../../data/sessionStore.js';
import { normalizeChats, filterValidChats } from '../chatList/chatQuery.js';
import { showToast } from '../notifications.js';

/** 새 채팅 기억이 유효한 시간 */
const NEW_CHAT_TTL_MS = 60 * 1000;

const stripExt = (name) => (typeof name === 'string' ? name.replace(/\.jsonl$/i, '') : '');

/**
 * @typedef {Object} SessionView
 * @property {string|null} avatar
 * @property {'cards'|'list'} mode
 * @property {string} activeId - SESSION_ALL / SESSION_UNSORTED / 실제 세션 ID (list일 때만 의미 있음)
 */

/** @returns {SessionView} */
function emptyView() {
    return { avatar: null, mode: 'list', activeId: SESSION_ALL };
}

let view = emptyView();
/** 마지막으로 그린 (유효한) 채팅 목록. 캐시가 비워진 사이에도 선택 창이 쓸 수 있게 */
let lastChats = { avatar: null, chats: [] };
/** @type {{avatar: string, sessionId: string, at: number, known: Set<string>}|null} */
let pendingNewChat = null;

// ---------- 화면 상태 ----------

/** @returns {SessionView} 복사본 */
export function getSessionView() {
    return { ...view };
}

/**
 * 캐릭터가 열렸을 때 호출. 같은 캐릭터면 보던 화면을 그대로 두고,
 * 다른 캐릭터면 초기화한다 (세션이 있으면 카드 화면부터).
 * @param {string} avatar
 */
export function enterCharacter(avatar) {
    if (view.avatar === avatar) return;
    view = { avatar, mode: hasSessions(avatar) ? 'cards' : 'list', activeId: SESSION_ALL };
    lastChats = { avatar: null, chats: [] };
}

/** 패널이 닫히거나 그룹으로 넘어갈 때 */
export function resetSessionState() {
    view = emptyView();
    lastChats = { avatar: null, chats: [] };
}

export function showCards() {
    view = { ...view, mode: 'cards', activeId: SESSION_ALL };
}

/**
 * 채팅 목록 화면으로 (세션 하나 또는 전체/미분류)
 * @param {string} sessionId
 */
export function showSession(sessionId) {
    view = { ...view, mode: 'list', activeId: sessionId };
}

/** @param {string} id */
export function isRealSessionId(id) {
    return id !== SESSION_ALL && id !== SESSION_UNSORTED && typeof id === 'string' && id !== '';
}

/**
 * 지금 "실제 세션 안"을 보고 있으면 그 세션 ID (새 채팅/빼기 등에서 사용)
 * @param {string} avatar
 * @returns {string|null}
 */
export function getActiveRealSessionId(avatar) {
    if (view.avatar !== avatar || view.mode !== 'list' || !isRealSessionId(view.activeId)) return null;
    return getSession(avatar, view.activeId) ? view.activeId : null;
}

// ---------- 지금 열린 캐릭터의 채팅 목록 ----------

/**
 * 그린 목록을 기억해 둔다 (sessionView가 renderChats 안에서 호출)
 * @param {string} avatar
 * @param {Array} chats - 유효한 채팅만
 */
export function rememberChats(avatar, chats) {
    lastChats = { avatar, chats: Array.isArray(chats) ? chats : [] };
}

/**
 * 이 캐릭터의 유효한 채팅 목록. 이미 받아 둔 캐시를 쓰고 새로 요청하지 않는다.
 * 캐시가 비어 있으면 마지막으로 그린 목록으로 대신한다.
 * @param {string} avatar
 * @returns {Array<{file_name: string}>}
 */
export function getCharacterChats(avatar) {
    const raw = cache.get('chats', avatar);
    if (raw) return filterValidChats(normalizeChats(raw));
    return lastChats.avatar === avatar ? lastChats.chats : [];
}

// ---------- 새 채팅을 세션에 넣기 (명세 6절) ----------

/**
 * 같은 봇에서 ST 버튼으로 새 채팅을 만들 때: 이름을 모르니 "의도"만 기억한다.
 * 이미 있던 채팅 이름을 함께 적어 둔다 — ST의 "새 채팅 시작?" 창을 취소하고
 * 옛 채팅을 여는 경우에 그 채팅이 세션에 들어가면 안 되기 때문.
 *
 * ⚠️ 호출 시점: 채팅 목록 캐시를 무효화하기 전 (무효화하면 기존 목록을 알 수 없다).
 * 기존 목록을 알 수 없으면 기억하지 않는다 (엉뚱한 채팅이 들어가는 것보다 안 넣는 편이 안전).
 *
 * @param {string} avatar
 * @param {string} sessionId
 * @returns {boolean} 기억했는지
 */
export function rememberPendingNewChat(avatar, sessionId) {
    pendingNewChat = null;
    const raw = cache.get('chats', avatar);
    const source = raw ? normalizeChats(raw) : (lastChats.avatar === avatar ? lastChats.chats : null);
    if (!source) return false;
    const known = new Set(source.map((c) => stripExt(c?.file_name || c?.fileName)).filter(Boolean));
    pendingNewChat = { avatar, sessionId, at: Date.now(), known };
    return true;
}

/**
 * CHAT_CHANGED에서 호출. 기억해 둔 의도가 있고 60초 안이며, 지금 열린 채팅이
 * 그 봇의 "원래 없던" 채팅이면 세션에 넣는다.
 * ⚠️ operationLock 중이어도 불려야 한다 (새 채팅 시작 자체가 락 안에서 일어난다).
 */
export function resolvePendingNewChat() {
    const pending = pendingNewChat;
    if (!pending) return;
    if (Date.now() - pending.at > NEW_CHAT_TTL_MS) {
        pendingNewChat = null;
        return;
    }
    try {
        const context = api.getContext();
        if (!context || context.groupId) return;
        const id = context.characterId;
        if (id === undefined || id === null || id < 0) return;
        const char = context.characters?.[id];
        if (!char || char.avatar !== pending.avatar) return;

        const name = stripExt(char.chat);
        // 옛 채팅이 열린 경우는 기억을 유지한다 (진짜 새 채팅 이벤트가 뒤따를 수 있음)
        if (!name || pending.known.has(name)) return;

        pendingNewChat = null;
        const session = getSession(pending.avatar, pending.sessionId);
        if (session && addChats(pending.avatar, pending.sessionId, [name]) > 0) {
            showToast(`🗂️ 새 채팅을 "${session.name}" 세션에 담았습니다.`, 'success');
        }
    } catch (e) {
        console.warn('[Sessions] resolvePendingNewChat failed:', e);
        pendingNewChat = null;
    }
}
