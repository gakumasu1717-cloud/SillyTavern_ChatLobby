// ============================================
// 채팅 관련 이벤트 핸들러
// ============================================

import { api } from '../api/sillyTavern.js';
import { operationLock } from '../utils/operationLock.js';
import { cache } from '../data/cache.js';
import { storage } from '../data/storage.js';
import { store } from '../data/store.js';
import { lastChatCache } from '../data/lastChatCache.js';
import { refreshChatList, getCurrentCharacter, closeChatPanel } from '../ui/chatList.js';
import { showToast, showConfirm, showAlert } from '../ui/notifications.js';
import { CONFIG } from '../config.js';
import { waitFor, waitForCharacterSelect, waitForElement, waitForChatChanged } from '../utils/waitFor.js';
import { isMobile } from '../utils/eventHelpers.js';
import { startRecentDomObserver } from '../ui/tabView.js';

// ============================================
// 채팅 열기
// ============================================

/**
 * 채팅 열기
 * @param {{ fileName: string, charAvatar: string, charIndex: string }} chatInfo
 * @returns {Promise<void>}
 */
export async function openChat(chatInfo) {
    // 최악 경로: waitForChatChanged(5000) × 2 + 안정화 마진 → 15초로 설정
    // (8초 기본값이면 느린 기기에서 작업 도중 안전해제 → 덮어쓰기 위험)
    const token = operationLock.acquire('openChat', 15000);
    if (!token) return;

    const { fileName, charAvatar, charIndex } = chatInfo;

    console.debug('[ChatHandlers] openChat called:', { fileName, charAvatar, charIndex });

    try {
        if (!charAvatar || !fileName) {
            console.error('[ChatHandlers] Missing chat data');
            showToast('채팅 정보가 올바르지 않습니다.', 'error');
            return;
        }

        const context = api.getContext();
        const characters = context?.characters || [];
        const index = characters.findIndex(c => c.avatar === charAvatar);

        console.debug('[ChatHandlers] Character index:', index);

        if (index === -1) {
            console.error('[ChatHandlers] Character not found');
            showToast('캐릭터를 찾을 수 없습니다.', 'error');
            return;
        }

        // 파일명 정규화 (확장자 제거)
        const chatFileName = fileName.replace('.jsonl', '');

        // ★ 마지막 채팅 시간 갱신은 실제 메시지 송수신 시에만 (index.js의 MESSAGE_SENT/RECEIVED 이벤트)
        // 채팅 열기만으로는 갱신하지 않음 - "최근 채팅순"은 실제 대화한 순서를 의미

        // 이미 같은 캐릭터가 선택되어 있는지 확인
        const currentChar = context.characters?.[context.characterId];
        const isSameCharacter = currentChar?.avatar === charAvatar;

        if (!isSameCharacter) {
            // 다른 캐릭터인 경우에만 전환
            // ★ chat 포인터를 대상 채팅으로 지정해서 전환 → "최근 채팅 로드 → 대상 채팅 재로드" 이중 로드 회피
            console.debug('[ChatHandlers] Different character, selecting...');
            const result = await switchCharacter(index, charAvatar, { chatPointer: chatFileName, token });

            if (result === 'stale') {
                console.warn('[ChatHandlers] openChat became stale, aborting');
                return;
            }
            if (result === 'failed') {
                showToast('캐릭터 선택에 실패했습니다. 다시 시도해주세요.', 'error');
                return;
            }
        } else {
            console.debug('[ChatHandlers] Same character already selected, skipping selectCharacterById');
        }

        // 로비 닫기 (상태 유지하면서)
        closeLobbyKeepState();

        // chat 포인터 트릭으로 이미 대상 채팅이 로드됐으면 재로드 생략
        const ctxAfter = api.getContext();
        const loadedChat = ctxAfter?.characters?.[ctxAfter.characterId]?.chat;
        if (!isSameCharacter && loadedChat === chatFileName) {
            console.debug('[ChatHandlers] Target chat loaded directly (single load)');
            // ST의 openCharacterChat은 캐릭터 카드 전체를 다시 저장해서 "다음에 열 채팅"을 기록한다.
            // 그 대신 chat 필드 하나만 가볍게 기록 (실패해도 동작에는 영향 없음)
            const loadedChar = ctxAfter.characters[ctxAfter.characterId];
            api.saveLastChatPointer(loadedChar.avatar, loadedChar.name, chatFileName);
            return;
        }
        if (!isSameCharacter) {
            console.warn('[ChatHandlers] Direct load missed (loaded:', loadedChat, '), opening target chat again');
        }

        // SillyTavern openCharacterChat 함수 사용
        console.debug('[ChatHandlers] Opening chat:', chatFileName);
        if (typeof context?.openCharacterChat === 'function') {
            try {
                // ⚠️ openCharacterChat은 내부적으로 현재 채팅 저장 → 대상 채팅 로드를 수행
                // 리스너를 먼저 등록하여 save/load 완료를 확인
                const openChatChangedPromise = waitForChatChanged(5000);
                await context.openCharacterChat(chatFileName);
                await openChatChangedPromise;
                console.debug('[ChatHandlers] Chat opened and CHAT_CHANGED confirmed');
                return;
            } catch (err) {
                console.warn('[ChatHandlers] context.openCharacterChat failed:', err);
            }
        }

        // Fallback: 채팅 선택 UI 클릭
        console.debug('[ChatHandlers] Using fallback method...');
        await openChatByFileName(fileName);

    } catch (error) {
        console.error('[ChatHandlers] Failed to open chat:', error);
        showToast('채팅을 열지 못했습니다.', 'error');
    } finally {
        operationLock.release(token);
    }
}

/**
 * 파일명으로 채팅 열기 (UI 클릭 방식)
 * @param {string} fileName - 채팅 파일명
 * @returns {Promise<void>}
 */
async function openChatByFileName(fileName) {
    
    const manageChatsBtn = document.getElementById('option_select_chat');
    
    if (!manageChatsBtn) {
        console.error('[ChatHandlers] Chat select button not found');
        showToast('채팅 선택 버튼을 찾을 수 없습니다.', 'error');
        return;
    }
    
    manageChatsBtn.click();
    
    // 채팅 목록이 로드될 때까지 대기 (조건 확인 방식)
    const listLoaded = await waitFor(() => {
        return document.querySelectorAll('.select_chat_block').length > 0;
    }, 3000);
    
    if (!listLoaded) {
        console.error('[ChatHandlers] Chat list did not load');
        showToast('채팅 목록을 불러오지 못했습니다.', 'error');
        return;
    }
    
    // 파일명에서 확장자 제거하고 정규화
    const searchName = fileName.replace('.jsonl', '').trim();
    
    
    /**
     * 정확한 파일명 매칭
     */
    function isExactMatch(itemName, target) {
        const cleanItem = itemName.replace('.jsonl', '').trim();
        const cleanTarget = target.replace('.jsonl', '').trim();
        return cleanItem === cleanTarget;
    }
    
    // 채팅 목록에서 해당 파일 찾기
    const chatItems = document.querySelectorAll('.select_chat_block');
    
    for (const item of chatItems) {
        // file_name 속성에서 파일명 가져오기 (SillyTavern 표준)
        const itemFileName = item.getAttribute('file_name') || '';
        
        if (isExactMatch(itemFileName, searchName)) {
            
            // jQuery 클릭 (SillyTavern 방식)
            if (window.$) {
                window.$(item).trigger('click');
            } else {
                item.click();
            }
            
            return;
        }
    }
    
    console.warn('[ChatHandlers] ❌ Chat not found in list:', fileName);
    showToast('채팅 파일을 찾지 못했습니다.', 'warning');
}

// ============================================
// 채팅 삭제
// ============================================

/**
 * 채팅 삭제
 * @param {{ fileName: string, charAvatar: string, element: HTMLElement }} chatInfo
 * @returns {Promise<void>}
 */
export async function deleteChat(chatInfo) {
    const { fileName, charAvatar, element } = chatInfo;
    /** @type {number|null} */
    let token = null;
    
    if (!fileName || !charAvatar) {
        console.error('[ChatHandlers] Missing chat data for delete');
        showToast('삭제할 채팅 정보가 없습니다.', 'error');
        return;
    }
    
    // 🔥 현재 열린 채팅인지 확인 (삭제 방지)
    const context = api.getContext();
    const currentChatFile = context?.characters?.[context?.characterId]?.chat;
    const fileNameWithoutExt = fileName.replace('.jsonl', '');
    
    if (currentChatFile === fileNameWithoutExt) {
        showToast('현재 열린 채팅은 삭제할 수 없습니다.\n다른 채팅으로 이동 후 삭제해주세요.', 'warning');
        return;
    }
    
    // 삭제 확인 (락 획득 전 — 대화상자 동안 락 점유 방지)
    const displayName = fileName.replace('.jsonl', '');
    const confirmed = await showConfirm(
        `"${displayName}" 채팅을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`,
        '채팅 삭제',
        true
    );
    
    if (!confirmed) return;
    
    // 확인 후 락 획득 (다른 채팅 작업과 동시 실행 방지)
    token = operationLock.acquire('deleteChat', 10000);
    if (!token) {
        showToast('다른 작업이 진행 중입니다.', 'warning');
        return;
    }

    try {
        const success = await api.deleteChat(fileName, charAvatar);
        
        if (success) {
            // 로컬 데이터 정리
            const data = storage.load();
            const key = storage.getChatKey(charAvatar, fileName);
            delete data.chatAssignments[key];
            const favIndex = data.favorites.indexOf(key);
            if (favIndex > -1) {
                data.favorites.splice(favIndex, 1);
            }
            storage.save(data);
            
            // 캐시 무효화
            cache.invalidate('chats', charAvatar);
            
            // UI에서 해당 요소만 제거 (전체 리렌더 X)
            if (element) {
                element.style.transition = 'opacity 0.2s, transform 0.2s';
                element.style.opacity = '0';
                element.style.transform = 'translateX(20px)';
                setTimeout(() => {
                    if (element?.parentNode) {
                        element.remove();
                    }
                    updateChatCountAfterDelete();
                }, 200);
            }
            
            // ⚠️ 여기서 reloadCurrentChat()을 부르지 않음
            // 삭제 대상은 "현재 열린 채팅이 아닌" 파일(위에서 확인)이므로 현재 채팅을 다시 불러올 이유가 없고,
            // 불필요한 리로드는 편집 중이던 내용을 날릴 수 있음

            showToast('채팅이 삭제되었습니다.', 'success');
        } else {
            showToast('채팅 삭제에 실패했습니다.', 'error');
        }
    } catch (error) {
        console.error('[ChatHandlers] Error deleting chat:', error);
        showToast('채팅 삭제 중 오류가 발생했습니다.', 'error');
    } finally {
        operationLock.release(token);
    }
}

/**
 * 삭제 후 채팅 수 업데이트
 */
function updateChatCountAfterDelete() {
    const remaining = document.querySelectorAll('.lobby-chat-item').length;
    const countEl = document.getElementById('chat-panel-count');
    
    if (countEl) {
        countEl.textContent = remaining > 0 ? `${remaining}개 채팅` : '채팅 없음';
    }
    
    if (remaining === 0) {
        const chatsList = document.getElementById('chat-lobby-chats-list');
        if (chatsList) {
            chatsList.innerHTML = `
                <div class="lobby-empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:var(--text-muted,#888);padding:40px;">
                    <i>💬</i>
                    <div>채팅 기록이 없습니다</div>
                </div>
            `;
        }
    }
}

// ============================================
// 캐릭터 전환
// ============================================

/**
 * 지금 ST에서 선택된 캐릭터가 대상인지
 */
function isCharacterSelected(charIndexNum, charAvatar) {
    const ctx = api.getContext();
    return String(ctx?.characterId) === String(charIndexNum)
        && ctx?.characters?.[ctx.characterId]?.avatar === charAvatar;
}

/**
 * 캐릭터 전환 (모든 전환은 이 함수를 거친다)
 *
 * selectCharacterById는 characters[i].chat이 가리키는 채팅을 로드한다.
 * chatPointer를 주면 전환 직전에 포인터를 바꿔 그 채팅을 바로 로드하게 한다.
 *
 * ⚠️ ST는 채팅 저장 중이거나 생성 중이면 전환하지 않고 그냥 리턴한다.
 * 그때 바꾼 포인터를 그대로 두면 캐릭터의 "마지막 채팅"이 엉뚱한 파일로 남아
 * 최근 채팅이 사라진 것처럼 보이므로, 전환이 실패하면 반드시 원래 값으로 되돌린다.
 *
 * @param {number} charIndexNum - 캐릭터 인덱스
 * @param {string} charAvatar - 캐릭터 아바타 (검증용)
 * @param {{ chatPointer?: string|null, token?: number|null }} [options]
 * @returns {Promise<'ok'|'failed'|'stale'>}
 */
export async function switchCharacter(charIndexNum, charAvatar, { chatPointer = null, token = null } = {}) {
    const context = api.getContext();
    if (context?.characters?.[charIndexNum]?.avatar !== charAvatar) return 'failed';

    // ★ 지연 로딩(shallow) 캐릭터는 전환 전에 전체 데이터를 먼저 받아둔다.
    // ST의 getChat()은 내부에서 unshallowCharacter()를 부르는데, 이게 characters[i]를
    // 서버에서 받은 새 객체로 통째로 교체한다 → 미리 바꿔둔 chat 포인터가 사라짐
    // → 마지막(무거운) 채팅이 먼저 열리고 대상 채팅을 또 여는 "이중 로딩"의 원인이었음.
    // 먼저 받아두면 getChat 안의 unshallow는 아무것도 안 하므로 포인터가 유지된다.
    if (typeof chatPointer === 'string' && context.characters[charIndexNum].shallow
        && typeof context.unshallowCharacter === 'function') {
        try {
            await context.unshallowCharacter(charIndexNum);
        } catch (e) {
            console.warn('[ChatHandlers] unshallowCharacter failed:', e);
        }
        if (token !== null && !operationLock.isCurrent(token)) return 'stale';
    }

    // unshallow로 객체가 교체됐을 수 있으므로 다시 읽음
    const targetChar = api.getContext()?.characters?.[charIndexNum];
    if (!targetChar || targetChar.avatar !== charAvatar) return 'failed';

    const originalPointer = targetChar.chat;
    const pointerChanged = typeof chatPointer === 'string'
        && typeof originalPointer === 'string'
        && chatPointer !== originalPointer;
    if (pointerChanged) {
        targetChar.chat = chatPointer;
    }

    // 전환이 일어나지 않았으면 포인터 원복 (전환된 뒤에는 절대 건드리지 않음)
    const restoreIfNotSwitched = () => {
        if (pointerChanged && !isCharacterSelected(charIndexNum, charAvatar) && targetChar.chat === chatPointer) {
            targetChar.chat = originalPointer;
            console.warn('[ChatHandlers] Switch did not happen, restored chat pointer:', originalPointer);
        }
    };

    try {
        // ⚠️ 리스너 먼저 등록 → 그 다음 호출 (호출이 끝나면 CHAT_CHANGED는 이미 발행된 뒤)
        const chatChangedPromise = waitForChatChanged(5000);
        await api.selectCharacterById(charIndexNum);
        const chatChanged = await chatChangedPromise;

        if (!chatChanged) {
            const selected = await waitForCharacterSelect(charAvatar, 2000);
            if (!selected) {
                restoreIfNotSwitched();
                return 'failed';
            }
        }
    } catch (error) {
        console.error('[ChatHandlers] selectCharacterById failed:', error);
        restoreIfNotSwitched();
        return 'failed';
    }

    if (token !== null && !operationLock.isCurrent(token)) return 'stale';

    // 추가 안정화 마진 (save flush 대기)
    await new Promise(r => setTimeout(r, 300));
    return (token === null || operationLock.isCurrent(token)) ? 'ok' : 'stale';
}

// ============================================
// 새 채팅 시작
// ============================================

/**
 * 새 채팅 시작 (캐릭터 또는 그룹)
 * @returns {Promise<void>}
 */
export async function startNewChat() {
    // select(5s) + 마진 + 버튼 대기 → 15초
    const token = operationLock.acquire('startNewChat', 15000);
    if (!token) return;

    try {
        const btn = document.getElementById('chat-lobby-new-chat');

        // 그룹인지 캐릭터인지 확인
        const isGroup = btn?.dataset.isGroup === 'true';

        if (isGroup) {
            await startNewGroupChat(btn, token);
        } else {
            await startNewCharacterChat(btn, token);
        }
    } finally {
        operationLock.release(token);
    }
}

/**
 * ST와 같은 형식의 채팅 파일명용 시각 문자열 (RossAscends-mods.humanizedDateTime과 동일)
 * 예: 2026-11-12@18h05m09s042ms
 * @param {number} [timestamp]
 * @returns {string}
 */
function humanizedDateTime(timestamp = Date.now()) {
    const d = new Date(timestamp);
    const p = (n, len = 2) => String(n).padStart(len, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
        + `@${p(d.getHours())}h${p(d.getMinutes())}m${p(d.getSeconds())}s${p(d.getMilliseconds(), 3)}ms`;
}

/**
 * 캐릭터 새 채팅 시작
 *
 * 다른 캐릭터: 아직 없는 새 파일명으로 chat 포인터를 지정해서 전환한다.
 *   ST는 파일이 없으면 인사말로 새 채팅을 만들고 저장한다
 *   (ST 자체도 채팅 기록이 없는 카드에 같은 방식으로 이름을 붙임: getCharacters 참고)
 *   → 기존 채팅을 하나도 불러오지 않고 새 채팅 한 번만 로드.
 *   예전엔 "가장 짧은 채팅 로드 → 새 채팅 생성"으로 두 번 로드했음.
 * 같은 캐릭터: 이미 열려 있으므로 ST 기본 새 채팅 버튼 사용 (한 번 로드)
 *
 * @param {HTMLElement} btn - 새 채팅 버튼
 * @param {number|null} token - operationLock 토큰
 * @returns {Promise<void>}
 */
async function startNewCharacterChat(btn, token = null) {
    const charIndex = btn?.dataset.charIndex;
    const charAvatar = btn?.dataset.charAvatar;

    // NaN 처리 포함한 유효성 검사
    const charIndexNum = parseInt(charIndex, 10);
    if (!charAvatar || isNaN(charIndexNum) || charIndexNum < 0) {
        console.error('[ChatHandlers] No character selected or invalid index');
        showToast('캐릭터가 선택되지 않았습니다.', 'error');
        return;
    }

    try {
        // 로비 닫기 (상태 유지)
        closeLobbyKeepState();

        const context = api.getContext();
        const currentChar = context?.characters?.[context.characterId];
        const isSameCharacter = currentChar?.avatar === charAvatar;

        // 새 채팅이 생기므로 목록 캐시 무효화
        cache.invalidate('chats', charAvatar);
        cache.invalidate('chatCounts', charAvatar);

        if (isSameCharacter) {
            const newChatBtn = await waitForElement('#option_start_new_chat', 1000);
            if (newChatBtn) newChatBtn.click();
            return;
        }

        const charName = context?.characters?.[charIndexNum]?.name || '';
        if (!charName) {
            showToast('캐릭터를 찾을 수 없습니다.', 'error');
            return;
        }
        const newChatName = `${charName} - ${humanizedDateTime()}`;

        const result = await switchCharacter(charIndexNum, charAvatar, { chatPointer: newChatName, token });
        if (result === 'stale') {
            console.warn('[ChatHandlers] startNewCharacterChat became stale, aborting');
            return;
        }
        if (result === 'failed') {
            showToast('새 채팅을 시작하지 못했습니다. 다시 시도해주세요.', 'error');
            return;
        }

        const ctxAfter = api.getContext();
        const loadedChar = ctxAfter?.characters?.[ctxAfter.characterId];
        if (loadedChar?.avatar === charAvatar && loadedChar.chat === newChatName) {
            console.debug('[ChatHandlers] New chat created directly (single load):', newChatName);
            // 다음 실행 때도 이 채팅이 열리도록 chat 필드만 기록
            api.saveLastChatPointer(loadedChar.avatar, loadedChar.name, newChatName);
        } else {
            console.warn('[ChatHandlers] New chat pointer was not kept (loaded:', loadedChar?.chat, ')');
        }
    } catch (error) {
        console.error('[ChatHandlers] Failed to start new chat:', error);
        showToast('새 채팅을 시작하지 못했습니다.', 'error');
    }
}

/**
 * 그룹 새 채팅 시작
 * @param {HTMLElement} btn - 새 채팅 버튼
 * @param {number|null} token - operationLock 토큰
 * @returns {Promise<void>}
 */
async function startNewGroupChat(btn, token = null) {
    const groupId = btn?.dataset.groupId;
    const groupName = btn?.dataset.groupName;

    if (!groupId) {
        console.error('[ChatHandlers] No group selected');
        showToast('그룹이 선택되지 않았습니다.', 'error');
        return;
    }

    console.debug('[ChatHandlers] Starting new group chat:', { groupId, groupName });

    try {
        // 1. 그룹 선택 (UI 클릭 방식 - 정확한 선택자 사용)
        const groupCard = document.querySelector(`.group_select[data-grid="${groupId}"]`);

        if (!groupCard) {
            console.error('[ChatHandlers] Group card not found:', groupId);
            showToast('그룹을 찾을 수 없습니다.', 'error');
            return;
        }

        console.debug('[ChatHandlers] Found group card, clicking...');
        // ⚠️ 리스너 먼저 등록 → 클릭 (고정 딜레이 대신 이벤트 기반 대기)
        const chatChangedPromise = waitForChatChanged(5000);
        if (window.$) {
            window.$(groupCard).trigger('click');
        } else {
            groupCard.click();
        }

        // 2. 그룹 선택(채팅 로드) 완료 대기
        await chatChangedPromise;

        // 안전 타임아웃 발동 여부 확인 (이후 단계 중단)
        if (token !== null && !operationLock.isCurrent(token)) {
            console.warn('[ChatHandlers] startNewGroupChat became stale, aborting');
            return;
        }

        // 3. 로비 닫기
        closeLobbyKeepState();

        // 4. 새 채팅 버튼 클릭
        const newChatBtn = await waitForElement('#option_start_new_chat', 1000);
        if (newChatBtn) {
            console.debug('[ChatHandlers] Clicking new chat button');
            newChatBtn.click();
        } else {
            console.error('[ChatHandlers] New chat button not found');
            showToast('새 채팅 버튼을 찾을 수 없습니다.', 'error');
        }

    } catch (error) {
        console.error('[ChatHandlers] Failed to start new group chat:', error);
        showToast('그룹 새 채팅을 시작하지 못했습니다.', 'error');
    }
}

// ============================================
// 캐릭터 삭제
// ============================================

/**
 * 캐릭터 삭제 (SillyTavern 내장 함수 사용)
 * @returns {Promise<void>}
 */
export async function deleteCharacter() {
    // store 대신 버튼의 dataset에서 직접 가져오기 (레이스컨디션 방지)
    const deleteBtn = document.getElementById('chat-lobby-delete-char');
    const charAvatar = deleteBtn?.dataset.charAvatar;
    const charName = deleteBtn?.dataset.charName;
    
    if (!charAvatar) {
        showToast('삭제할 캐릭터가 선택되지 않았습니다.', 'error');
        return;
    }
    
    // context에서 실제 캐릭터 객체 확인 (최신 상태)
    const context = api.getContext();
    const char = context?.characters?.find(c => c.avatar === charAvatar);
    
    if (!char) {
        showToast('캐릭터를 찾을 수 없습니다. 이미 삭제되었을 수 있어요.', 'error');
        closeChatPanel();
        return;
    }
    
    // 사용자 확인 (락 획득 전)
    const confirmed = await showConfirm(
        `"${char.name}" 캐릭터와 모든 채팅을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`
    );
    
    if (!confirmed) {
        return;
    }
    
    // 확인 후 락 획득 (캐릭터 + 전체 채팅 삭제는 오래 걸릴 수 있음)
    const token = operationLock.acquire('deleteCharacter', 20000);
    if (!token) {
        showToast('다른 작업이 진행 중입니다.', 'warning');
        return;
    }
    
    try {
        // 로비 데이터 먼저 정리
        const data = storage.load();
        const prefix = char.avatar + '::';
        
        Object.keys(data.chatAssignments).forEach(key => {
            if (key.startsWith(prefix)) {
                delete data.chatAssignments[key];
            }
        });
        
        data.favorites = data.favorites.filter(key => !key.startsWith(prefix));
        storage.save(data);
        
        // UI 리셋
        closeChatPanel();
        
        // SillyTavern 내장 deleteCharacter 함수 사용 시도
        // (위에서 가져온 context 재사용 - 레이스 컨디션 방지)
        if (typeof context?.deleteCharacter === 'function') {
            // SillyTavern 내장 함수 사용 (context.characters 자동 갱신됨)
            await context.deleteCharacter(char.avatar, { deleteChats: true });
        } else {
            // Fallback: 직접 API 호출 후 getCharacters로 갱신
            const headers = api.getRequestHeaders();
            const avatarUrl = char.avatar.endsWith('.png') ? char.avatar : `${char.avatar}.png`;
            
            const response = await fetch('/api/characters/delete', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    avatar_url: avatarUrl,
                    delete_chats: true
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[ChatLobby] Delete response:', response.status, errorText);
                throw new Error(`Delete failed: ${response.status} - ${errorText}`);
            }
            
            // API 삭제 성공 후 SillyTavern의 characters 배열 갱신
            if (typeof context?.getCharacters === 'function') {
                await context.getCharacters();
            }
        }
        
        // 캐시 무효화
        cache.invalidate('characters');
        cache.invalidate('chats', char.avatar);
        
        showToast(`"${char.name}" 캐릭터가 삭제되었습니다.`, 'success');
        
        // 그리드 새로고침 (로비가 열려있으면)
        const overlay = document.getElementById('chat-lobby-overlay');
        if (overlay?.style.display === 'flex') {
            // 이벤트로 순환 참조 방지
            window.dispatchEvent(new CustomEvent('chatlobby:refresh-grid'));
        }
        
    } catch (error) {
        console.error('[ChatHandlers] Failed to delete character:', error);
        showToast('캐릭터 삭제 중 오류가 발생했습니다.', 'error');
    } finally {
        operationLock.release(token);
    }
}

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 로비 닫기 (상태 유지)
 * - 채팅을 열면서 닫을 때 사용
 * - 캐싱된 상태를 유지하여 다시 열 때 빠르게 복원
 * - store.reset()을 호출하지 않음
 */
function closeLobbyKeepState() {
    const overlay = document.getElementById('chat-lobby-overlay');
    const container = document.getElementById('chat-lobby-container');
    const fab = document.getElementById('chat-lobby-fab');
    
    if (overlay) overlay.style.display = 'none';
    if (container) container.style.display = 'none';
    if (fab) fab.style.display = 'flex';
    
    // CustomTheme 사이드바 버튼 상태 초기화
    const sidebarBtn = document.getElementById('st-chatlobby-sidebar-btn');
    if (sidebarBtn) {
        const icon = sidebarBtn.querySelector('.drawer-icon');
        icon?.classList.remove('openIcon');
        icon?.classList.add('closedIcon');
    }
    
    store.setLobbyOpen(false);
    closeChatPanel();
    // 주의: store.reset()을 호출하지 않음 - 상태 유지

    // 🔥 로비 닫힐 때 DOM 감시 시작 (채팅 변경 감지)
    startRecentDomObserver();
}
