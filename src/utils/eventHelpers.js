// ============================================
// 이벤트 헬퍼 - 터치/클릭 중복 방지
// ============================================

import { CONFIG } from '../config.js';
import { listeners } from './listenerManager.js';

/**
 * @typedef {Object} TouchClickOptions
 * @property {boolean} [preventDefault=true] - 기본 동작 방지
 * @property {boolean} [stopPropagation=true] - 이벤트 전파 중지
 * @property {number} [scrollThreshold=10] - 스크롤 감지 임계값 (px)
 */

/**
 * 모바일 디바이스 여부 확인
 * @returns {boolean} 모바일이면 true
 */
export const isMobile = () => 
    window.innerWidth <= CONFIG.ui.mobileBreakpoint || ('ontouchstart' in window);

/**
 * 디바운스 함수 생성
 * @param {Function} func - 실행할 함수
 * @param {number} [wait=CONFIG.ui.debounceWait] - 대기 시간 (ms)
 * @returns {Function} 디바운스된 함수
 */
export function debounce(func, wait = CONFIG.ui.debounceWait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 전역 클릭 쿨다운 (모든 채팅/캐릭터 아이템 공유)
let globalLastClickTime = 0;
const GLOBAL_CLICK_COOLDOWN = 500;

/**
 * 터치/클릭 통합 핸들러 생성
 * 모바일에서 터치 이벤트와 클릭 이벤트 중복 방지
 * 스크롤 중 클릭 방지
 * @param {HTMLElement} element - 대상 요소
 * @param {Function} handler - 이벤트 핸들러
 * @param {TouchClickOptions} [options={}] - 옵션
 */
export function createTouchClickHandler(element, handler, options = {}) {
    const { 
        preventDefault = true, 
        stopPropagation = true, 
        scrollThreshold = 10,
        debugName = 'unknown'
    } = options;
    
    let touchStartX = 0;
    let touchStartY = 0;
    let isScrolling = false;
    let touchHandled = false;
    let lastHandleTime = 0;
    
    /**
     * 래핑된 핸들러
     * @param {Event} e
     * @param {string} source - 이벤트 소스 (touch/click)
     */
    const wrappedHandler = (e, source) => {
        const now = Date.now();
        
        // 전역 쿨다운 체크 (다른 요소의 핸들러도 포함)
        if (now - globalLastClickTime < GLOBAL_CLICK_COOLDOWN) {
            return;
        }
        
        // 즉시 전역 시간 갱신 (다른 요소의 동시 클릭 차단)
        globalLastClickTime = now;
        
        // 요소별 중복 실행 방지 (300ms 내 중복 무시 - 빠른 클릭 방지)
        if (now - lastHandleTime < 300) {
            return;
        }
        
        if (isScrolling) {
            return;
        }
        
        lastHandleTime = now;
        
        if (preventDefault) e.preventDefault();
        if (stopPropagation) e.stopPropagation();
        
        try {
            handler(e);
        } catch (error) {
            console.error(`[EventHelper] ${debugName}: Handler error:`, error);
        }
    };
    
    element.addEventListener('touchstart', (e) => {
        touchHandled = false;
        isScrolling = false;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });
    
    element.addEventListener('touchmove', (e) => {
        // 가로 OR 세로 움직임 감지
        const deltaX = Math.abs(e.touches[0].clientX - touchStartX);
        const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
        
        if (deltaX > scrollThreshold || deltaY > scrollThreshold) {
            isScrolling = true;
        }
    }, { passive: true });
    
    element.addEventListener('touchend', (e) => {
        if (!isScrolling) {
            touchHandled = true;
            wrappedHandler(e, 'touchend');
        }
        isScrolling = false;
    });
    
    element.addEventListener('click', (e) => {
        if (!touchHandled) {
            wrappedHandler(e, 'click');
        } else {
        }
        touchHandled = false;
    });
}

/**
 * 위임형 터치/클릭 핸들러 (컨테이너 1회 바인딩)
 *
 * createTouchClickHandler를 아이템마다 N번 바인딩하는 대신,
 * 컨테이너에 4개(touchstart/move/end/click)만 걸고 라우터 함수가 분기한다.
 * - 카드 수백 개 × 리스너 4개 → 리스너 4개 (렌더마다 재바인딩 불필요)
 * - innerHTML 재렌더에도 바인딩 유지
 *
 * @param {HTMLElement} container - 위임 대상 컨테이너 (영속 요소)
 * @param {(e: Event) => boolean} route - 라우터. 처리했으면 true 반환
 *   (true일 때만 preventDefault/stopPropagation 적용 → 미처리 클릭은 그대로 통과)
 * @param {{ group?: string, scrollThreshold?: number, debugName?: string }} [options]
 */
export function bindDelegatedTouchClick(container, route, options = {}) {
    const {
        group = 'delegated',
        scrollThreshold = 10,
        debugName = 'delegated',
    } = options;

    if (!container) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let isScrolling = false;
    let touchHandled = false;

    const wrappedRoute = (e) => {
        const now = Date.now();

        // 전역 쿨다운 체크 (요소별 핸들러와 동일한 정책 공유)
        if (now - globalLastClickTime < GLOBAL_CLICK_COOLDOWN) return;
        if (isScrolling) return;

        let handled = false;
        try {
            handled = route(e) === true;
        } catch (error) {
            console.error(`[EventHelper] ${debugName}: Route error:`, error);
        }

        if (handled) {
            // 처리된 경우에만 쿨다운 갱신 + 기본동작 차단
            globalLastClickTime = now;
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
        }
        return handled;
    };

    listeners.add(group, container, 'touchstart', (e) => {
        touchHandled = false;
        isScrolling = false;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    listeners.add(group, container, 'touchmove', (e) => {
        const deltaX = Math.abs(e.touches[0].clientX - touchStartX);
        const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
        if (deltaX > scrollThreshold || deltaY > scrollThreshold) {
            isScrolling = true;
        }
    }, { passive: true });

    listeners.add(group, container, 'touchend', (e) => {
        if (!isScrolling) {
            touchHandled = wrappedRoute(e) === true;
        }
        isScrolling = false;
    });

    listeners.add(group, container, 'click', (e) => {
        if (!touchHandled) {
            wrappedRoute(e);
        }
        touchHandled = false;
    });
}

