// ============================================
// 이벤트 헬퍼 - 터치/클릭 중복 방지
// ============================================

import { CONFIG } from '../config.js';

// 모바일 감지
export const isMobile = () => 
    window.innerWidth <= CONFIG.ui.mobileBreakpoint || ('ontouchstart' in window);

// 디바운스
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

// 터치/클릭 통합 핸들러 생성
export function createTouchClickHandler(element, handler, options = {}) {
    const { preventDefault = true, stopPropagation = true, scrollThreshold = 10 } = options;
    
    let touchStartY = 0;
    let isScrolling = false;
    let touchHandled = false;
    
    const wrappedHandler = (e) => {
        if (isScrolling) return;
        if (preventDefault) e.preventDefault();
        if (stopPropagation) e.stopPropagation();
        handler(e);
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
            wrappedHandler(e);
        }
        isScrolling = false;
    });
    
    element.addEventListener('click', (e) => {
        if (!touchHandled) {
            wrappedHandler(e);
        }
        touchHandled = false;
    });
}

// 스크롤 무시하는 터치 핸들러 (버튼용)
export function createButtonHandler(element, handler) {
    createTouchClickHandler(element, handler, {
        preventDefault: true,
        stopPropagation: true,
        scrollThreshold: 10
    });
}

// 카드/리스트 아이템용 핸들러
export function createCardHandler(element, handler) {
    createTouchClickHandler(element, handler, {
        preventDefault: false,
        stopPropagation: false,
        scrollThreshold: 10
    });
}
