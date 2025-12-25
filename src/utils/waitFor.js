// ============================================
// 조건 대기 유틸리티
// ============================================

/**
 * 조건이 충족될 때까지 대기
 * @param {() => boolean} conditionFn - 조건 함수
 * @param {number} [timeout=3000] - 최대 대기 시간 (ms)
 * @param {number} [interval=50] - 폴링 간격 (ms)
 * @returns {Promise<boolean>} 조건 충족 여부
 */
export async function waitFor(conditionFn, timeout = 3000, interval = 50) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try {
            if (conditionFn()) return true;
        } catch (e) {
            // 조건 함수 에러는 무시하고 계속 시도 (디버깅시 활성화)
            // console.debug('[waitFor] Condition check failed:', e.message);
        }
        await new Promise(r => setTimeout(r, interval));
    }
    return false; // 타임아웃 시 false 반환 (에러 대신)
}

/**
 * 요소가 나타날 때까지 대기
 * @param {string} selector - CSS 선택자
 * @param {number} [timeout=3000] - 최대 대기 시간 (ms)
 * @returns {Promise<Element|null>} 찾은 요소 또는 null
 */
export async function waitForElement(selector, timeout = 3000) {
    const found = await waitFor(() => document.querySelector(selector) !== null, timeout);
    return found ? document.querySelector(selector) : null;
}

/**
 * 캐릭터 선택이 완료될 때까지 대기
 * @param {string} expectedAvatar - 예상되는 캐릭터 아바타
 * @param {number} [timeout=3000] - 최대 대기 시간 (ms)
 * @returns {Promise<boolean>}
 */
export async function waitForCharacterSelect(expectedAvatar, timeout = 3000) {
    return waitFor(() => {
        const context = window.SillyTavern?.getContext?.();
        if (!context) return false;
        
        const currentChar = context.characters?.[context.characterId];
        return currentChar?.avatar === expectedAvatar;
    }, timeout);
}

/**
 * 채팅 UI가 로드될 때까지 대기
 * @param {number} [timeout=3000] - 최대 대기 시간 (ms)
 * @returns {Promise<boolean>}
 */
export async function waitForChatUI(timeout = 3000) {
    return waitFor(() => {
        // 채팅 메시지 영역이 있거나, 채팅 선택 팝업이 있는지 확인
        return document.querySelector('#chat') !== null ||
               document.querySelectorAll('.select_chat_block').length > 0;
    }, timeout);
}
