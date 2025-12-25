// ============================================
// 이벤트 헬퍼 - 터치/클릭 중복 방지
// ============================================

import { CONFIG } from '../config.js';

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
        
        // 중복 실행 방지 (100ms 내 중복 무시)
        if (now - lastHandleTime < 100) {
            console.log(`[EventHelper] ${debugName}: Duplicate ${source} event ignored`);
            return;
        }
        
        if (isScrolling) {
            console.log(`[EventHelper] ${debugName}: ${source} ignored (scrolling)`);
            return;
        }
        
        lastHandleTime = now;
        console.log(`[EventHelper] ${debugName}: ${source} event fired`);
        
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
        touchStartY = e.touches[0].clientY;
    }, { passive: true });
    
    element.addEventListener('touchmove', (e) => {
        if (Math.abs(e.touches[0].clientY - touchStartY) > scrollThreshold) {
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
            console.log(`[EventHelper] ${debugName}: click ignored (touch already handled)`);
        }
        touchHandled = false;
    });
}

/**
 * 버튼용 터치 핸들러 (스크롤 무시)
 * @param {HTMLElement} element - 버튼 요소
 * @param {Function} handler - 클릭 핸들러
 */
export function createButtonHandler(element, handler) {
    createTouchClickHandler(element, handler, {
        preventDefault: true,
        stopPropagation: true,
        scrollThreshold: 10
    });
}

/**
 * 카드/리스트 아이템용 핸들러 (이벤트 전파 허용)
 * @param {HTMLElement} element - 카드 요소
 * @param {Function} handler - 클릭 핸들러
 */
export function createCardHandler(element, handler) {
    createTouchClickHandler(element, handler, {
        preventDefault: false,
        stopPropagation: false,
        scrollThreshold: 10
    });
}
