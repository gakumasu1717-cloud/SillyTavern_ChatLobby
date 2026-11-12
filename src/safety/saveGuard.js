// ============================================
// 채팅 덮어쓰기 가드
//
// SillyTavern의 /api/chats/save 요청을 가로채 "실제 대화가 들어있는 파일을
// 엉뚱한 내용으로 덮어쓰려는" 저장을 막는다.
//
// 막는 경우 (ST 소스 기준):
//  1) 채팅 로드 실패 → ST가 인사말 1개짜리 새 채팅을 만들고 무결성 표식(integrity)
//     없이 저장 → 서버는 표식이 없으면 검사를 건너뛰므로 원본이 인사말로 덮어써짐
//  2) 다른 채팅의 내용이 이 파일로 저장되려 함 (integrity 불일치)
//     → 서버가 거부하면 ST가 "페이지 새로고침" 팝업을 띄우고 location.reload()
//
// 막으면: 원본 파일은 그대로 두고, 저장하려던 내용은 복구본 파일로 따로 저장한 뒤
// 페이지 새로고침 대신 현재 채팅만 다시 불러온다.
//
// ★ 원칙: 판단이 애매하거나 검사 중 오류가 나면 무조건 통과(fail-open).
//   정상 저장을 막는 것은 덮어쓰기만큼 위험하다.
// ============================================

const SAVE_PATH = '/api/chats/save';
const GET_PATH = '/api/chats/get';

/** 같은 파일에 대한 자동 복구 시도 제한 (로드 실패가 반복될 때 무한 루프 방지) */
const MAX_RECOVERIES = 2;
const RECOVERY_WINDOW_MS = 60000;

let rawFetch = null;
let originalFetch = null;
let guardedFetch = null;
let enabled = true;
/** @type {Map<string, number[]>} 파일별 자동 복구 시각 */
const recoveryLog = new Map();
let recoveryTimer = null;

// ============================================
// 판단 로직 (순수 함수 - 테스트 가능)
// ============================================

/**
 * 메시지 수 (헤더 제외)
 * @param {Array|undefined} chat - [header, ...messages]
 */
function messageCount(chat) {
    return Array.isArray(chat) && chat.length > 0 ? chat.length - 1 : 0;
}

/**
 * 같은 메시지인지 (삭제로 줄어든 경우 판별용)
 */
function isSameMessage(a, b) {
    if (!a || !b) return false;
    return String(a.send_date ?? '') === String(b.send_date ?? '')
        && String(a.mes ?? '') === String(b.mes ?? '');
}

/**
 * 서버 확인이 필요한 저장인지 (대부분의 정상 저장은 여기서 바로 통과)
 * @param {object} payload - 저장 요청 본문
 * @returns {boolean}
 */
export function needsServerCheck(payload) {
    const chat = payload?.chat;
    if (!Array.isArray(chat) || payload.force === true) return false;
    const slug = chat[0]?.chat_metadata?.integrity;
    // 무결성 표식이 없거나, 메시지가 1개 이하로 줄어드는 저장만 검사
    return !slug || messageCount(chat) <= 1;
}

/**
 * 저장을 허용할지 판단
 * @param {object} payload - 저장하려는 본문 { chat: [header, ...] }
 * @param {Array|null} serverChat - 서버에 있는 현재 파일 내용 ([header, ...]), 확인 실패 시 null
 * @returns {{ allow: boolean, reason: string }}
 */
export function decideSave(payload, serverChat) {
    if (!needsServerCheck(payload)) return { allow: true, reason: 'normal' };
    if (!Array.isArray(serverChat)) return { allow: true, reason: 'server-unknown' };

    const outgoing = payload.chat;
    const outCount = messageCount(outgoing);
    const serverCount = messageCount(serverChat);

    // 서버 파일에 잃을 대화가 없음 (새 채팅, 인사말만 있는 채팅)
    if (serverCount <= 1) return { allow: true, reason: 'nothing-to-lose' };

    const slug = outgoing[0]?.chat_metadata?.integrity;
    const serverSlug = serverChat[0]?.chat_metadata?.integrity;

    if (!slug) return { allow: false, reason: 'no-integrity' };

    if (serverSlug) {
        // 같은 채팅에서 메시지를 지운 경우 → 정상
        if (slug === serverSlug) return { allow: true, reason: 'same-chat' };
        return { allow: false, reason: 'integrity-mismatch' };
    }

    // 무결성 표식이 없는 옛날 파일: 첫 메시지가 같으면 사용자가 지운 것
    if (outCount === 1 && isSameMessage(outgoing[1], serverChat[1])) {
        return { allow: true, reason: 'legacy-trimmed' };
    }
    return { allow: false, reason: 'legacy-replaced' };
}

// ============================================
// 요청 파싱
// ============================================

function isSaveRequest(input, init) {
    if (typeof input !== 'string') return false;
    if (String(init?.method || 'GET').toUpperCase() !== 'POST') return false;
    const path = input.split('?')[0];
    return path === SAVE_PATH || path.endsWith(SAVE_PATH);
}

/**
 * 저장 요청 본문 읽기 (ST는 큰 본문을 gzip으로 압축해 보냄)
 * @returns {Promise<object|null>}
 */
async function readPayload(init) {
    const body = init?.body;
    if (typeof body === 'string') return JSON.parse(body);
    if (!body) return null;

    const headers = new Headers(init.headers || {});
    if (headers.get('Content-Encoding') !== 'gzip') return null;
    if (typeof DecompressionStream === 'undefined') return null;

    const stream = new Blob([body]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(stream).text());
}

function getRequestHeaders() {
    const context = window.SillyTavern?.getContext?.();
    return context?.getRequestHeaders?.() || { 'Content-Type': 'application/json' };
}

/**
 * 서버에 있는 파일 내용 가져오기 (가드 자신은 거치지 않음)
 * @returns {Promise<Array|null>}
 */
async function fetchServerChat(payload) {
    const response = await originalFetch(GET_PATH, {
        method: 'POST',
        headers: getRequestHeaders(),
        cache: 'no-cache',
        body: JSON.stringify({
            ch_name: payload.ch_name,
            file_name: payload.file_name,
            avatar_url: payload.avatar_url,
        }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    // 파일이 없으면 서버는 {} 또는 []를 돌려줌 → 빈 배열로 취급
    return Array.isArray(data) ? data : [];
}

// ============================================
// 차단 처리
// ============================================

function notify(message, type = 'warning', sticky = false) {
    const toastr = window.toastr;
    if (toastr?.[type]) {
        toastr[type](message, 'Chat Lobby 저장 가드', sticky ? { timeOut: 0, extendedTimeOut: 0 } : { timeOut: 8000 });
    } else {
        console.warn('[SaveGuard]', message);
    }
}

function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * 막힌 저장 내용을 복구본 파일로 따로 저장
 * @returns {Promise<string|null>} 복구본 파일명
 */
async function saveRescueCopy(payload) {
    const rescueName = `${payload.file_name} [복구 ${stamp()}]`;
    try {
        const response = await originalFetch(SAVE_PATH, {
            method: 'POST',
            headers: getRequestHeaders(),
            cache: 'no-cache',
            body: JSON.stringify({ ...payload, file_name: rescueName, force: false }),
        });
        return response.ok ? rescueName : null;
    } catch (e) {
        console.error('[SaveGuard] Rescue copy failed:', e);
        return null;
    }
}

function isGenerating() {
    const stopBtn = document.getElementById('mes_stop');
    return !!stopBtn && stopBtn.offsetParent !== null;
}

/**
 * 현재 채팅을 서버 파일로 다시 불러오기 (페이지 새로고침 대신)
 * 같은 파일에서 짧은 시간에 반복되면 중단 (로드 실패가 계속되는 경우)
 * @returns {boolean} 재로드를 예약했는지
 */
function scheduleChatReload(fileKey) {
    const now = Date.now();
    const recent = (recoveryLog.get(fileKey) || []).filter(t => now - t < RECOVERY_WINDOW_MS);
    if (recent.length >= MAX_RECOVERIES) {
        notify('채팅을 계속 불러오지 못하고 있습니다. 원본 파일은 보호 중이니, 서버 연결을 확인한 뒤 채팅을 다시 열어주세요.', 'error', true);
        return false;
    }
    recent.push(now);
    recoveryLog.set(fileKey, recent);

    if (recoveryTimer) clearTimeout(recoveryTimer);
    let waited = 0;
    const tryReload = () => {
        // 생성 중에는 다시 불러오지 않음 (최대 60초 대기)
        if (isGenerating() && waited < 60000) {
            waited += 500;
            recoveryTimer = setTimeout(tryReload, 500);
            return;
        }
        recoveryTimer = null;
        const context = window.SillyTavern?.getContext?.();
        context?.reloadCurrentChat?.().catch?.(e => console.error('[SaveGuard] Chat reload failed:', e));
    };
    // ST의 saveChatConditional이 끝난 뒤(isChatSaving 해제) 실행되도록 약간 지연
    recoveryTimer = setTimeout(tryReload, 300);
    return true;
}

async function handleBlocked(payload, reason) {
    const outCount = messageCount(payload.chat);
    console.warn('[SaveGuard] Blocked chat save:', { file: payload.file_name, reason, outgoingMessages: outCount });

    let rescueName = null;
    if (outCount > 1) {
        rescueName = await saveRescueCopy(payload);
    }

    const willReload = scheduleChatReload(`${payload.avatar_url}::${payload.file_name}`);
    const rescueText = rescueName ? `\n저장하려던 내용은 "${rescueName}"에 따로 저장했습니다.` : '';
    const reloadText = willReload ? '\n채팅을 다시 불러옵니다.' : '';
    notify(`"${payload.file_name}" 채팅이 덮어써지는 것을 막았습니다. 원본은 그대로입니다.${rescueText}${reloadText}`);

    // ST에는 저장 성공으로 응답 → ST의 "새로고침" 팝업/에러 토스트를 띄우지 않음
    return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

// ============================================
// fetch 래퍼
// ============================================

async function guardedFetchImpl(input, init) {
    if (!enabled || !isSaveRequest(input, init)) {
        return originalFetch(input, init);
    }

    let payload = null;
    try {
        payload = await readPayload(init);
    } catch (e) {
        console.debug('[SaveGuard] Could not read save payload, passing through:', e);
    }
    if (!payload) return originalFetch(input, init);

    // 1) 사전 검사 (무결성 표식 없음 / 1개 이하로 줄어드는 저장)
    if (needsServerCheck(payload)) {
        let decision = { allow: true, reason: 'check-failed' };
        try {
            const serverChat = await fetchServerChat(payload);
            decision = decideSave(payload, serverChat);
        } catch (e) {
            console.debug('[SaveGuard] Server check failed, passing through:', e);
        }
        if (!decision.allow) return handleBlocked(payload, decision.reason);
    }

    // 2) 서버의 무결성 거부 응답 가로채기 (ST의 페이지 새로고침 방지)
    const response = await originalFetch(input, init);
    if (response.status === 400) {
        try {
            const data = await response.clone().json();
            if (data?.error === 'integrity') {
                return handleBlocked(payload, 'server-integrity');
            }
        } catch { /* JSON 아님 → 그대로 반환 */ }
    }
    return response;
}

/**
 * 가드 설치 (중복 설치 안전)
 */
export function installSaveGuard() {
    if (guardedFetch && window.fetch === guardedFetch) return;
    rawFetch = window.fetch;
    originalFetch = (input, init) => rawFetch.call(window, input, init);
    guardedFetch = function chatLobbyGuardedFetch(input, init) {
        return guardedFetchImpl(input, init);
    };
    window.fetch = guardedFetch;
    enabled = true;
    console.info('[SaveGuard] Installed');
}

/**
 * 가드 해제
 * 다른 확장이 그 위에 fetch를 또 감쌌으면 체인을 끊지 않고 비활성화만 함
 */
export function uninstallSaveGuard() {
    if (!guardedFetch) return;
    if (window.fetch === guardedFetch) {
        window.fetch = rawFetch;
        guardedFetch = null;
    } else {
        enabled = false;
    }
    if (recoveryTimer) {
        clearTimeout(recoveryTimer);
        recoveryTimer = null;
    }
}

/** 콘솔용 켜기/끄기 */
export function setSaveGuardEnabled(value) {
    enabled = !!value;
    console.info('[SaveGuard]', enabled ? 'enabled' : 'disabled');
}
