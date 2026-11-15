// ============================================
// 채팅 목록 - 미리보기 툴팁
// ============================================

import { isMobile } from '../../utils/eventHelpers.js';
import { listeners } from '../../utils/listenerManager.js';

// ============================================
// 툴팁 관련 변수
// ============================================

// Race Condition 방지는 operationLock으로 처리

let tooltipElement = null;
let tooltipTimeout = null;
let currentTooltipTarget = null;
let tooltipEventsInitialized = false;  // 이벤트 위임 등록 여부
let lastMouseX = 0;  // 마지막 마우스 X 좌표
let lastMouseY = 0;  // 마지막 마우스 Y 좌표

/**
 * 툴팁 요소 생성 (한 번만)
 */
function ensureTooltipElement() {
    if (tooltipElement) return tooltipElement;
    
    tooltipElement = document.createElement('div');
    tooltipElement.id = 'chat-preview-tooltip';
    tooltipElement.className = 'chat-preview-tooltip';
    tooltipElement.style.cssText = `
        position: fixed;
        display: none;
        max-width: 400px;
        max-height: 300px;
        padding: 12px 16px;
        background: rgba(20, 20, 30, 0.95);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 10px;
        color: #e0e0e0;
        font-size: 13px;
        line-height: 1.6;
        z-index: 100000;
        overflow-y: auto;
        overflow-x: hidden;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        pointer-events: none;
        white-space: pre-wrap;
        word-break: break-word;
        backdrop-filter: blur(10px);
    `;
    
    // 스크롤바 스타일 추가
    const style = document.createElement('style');
    style.textContent = `
        .chat-preview-tooltip::-webkit-scrollbar {
            width: 6px;
        }
        .chat-preview-tooltip::-webkit-scrollbar-track {
            background: rgba(255,255,255,0.05);
            border-radius: 3px;
        }
        .chat-preview-tooltip::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.2);
            border-radius: 3px;
        }
        .chat-preview-tooltip::-webkit-scrollbar-thumb:hover {
            background: rgba(255,255,255,0.3);
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(tooltipElement);
    return tooltipElement;
}

/**
 * 툴팁 표시
 * @param {string} content - 표시할 내용
 */
function showTooltip(content) {
    const tooltip = ensureTooltipElement();
    tooltip.textContent = content;
    tooltip.style.display = 'block';
    
    // 마지막 마우스 좌표 사용 (타이머 지연 후에도 정확한 위치)
    tooltip.style.left = `${lastMouseX + 15}px`;
    tooltip.style.top = `${lastMouseY + 15}px`;
}

/**
 * 툴팁 숨김
 */
function hideTooltip() {
    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
        tooltipTimeout = null;
    }
    if (tooltipElement) {
        tooltipElement.style.display = 'none';
    }
    currentTooltipTarget = null;
}

/**
 * 채팅 아이템에 툴팁 이벤트 바인딩 (PC 전용) - 이벤트 위임 방식
 * 로비 전체 컨테이너에 등록하여 탭 뷰에서도 동작
 * @param {HTMLElement} container
 */
export function bindTooltipEvents(container) {
    // 모바일에서는 비활성화
    if (isMobile()) {
        return;
    }
    
    // 이미 이벤트 위임이 등록되어 있으면 스킵 (메모리 누수 방지)
    if (tooltipEventsInitialized) {
        return;
    }
    
    // 로비 전체 컨테이너에 이벤트 등록 (chatList + tabView 모두 커버)
    const lobbyContainer = document.getElementById('chat-lobby-container');
    if (!lobbyContainer) return;
    
    // 이벤트 위임: 로비 컨테이너에 한 번만 등록 ('tooltip' 그룹)
    listeners.add('tooltip', lobbyContainer, 'mouseover', handleTooltipMouseOver);
    listeners.add('tooltip', lobbyContainer, 'mouseout', handleTooltipMouseOut);
    listeners.add('tooltip', lobbyContainer, 'mousemove', handleTooltipMouseMove);
    listeners.add('tooltip', lobbyContainer, 'wheel', handleTooltipWheel, { passive: false });

    tooltipEventsInitialized = true;
}

/**
 * 툴팁 mouseover 핸들러 (이벤트 위임)
 */
function handleTooltipMouseOver(e) {
    // 마우스 좌표 즉시 저장
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    
    const item = e.target.closest('.lobby-chat-item');
    if (!item) return;
    
    // 같은 아이템이면 스킵
    if (currentTooltipTarget === item) return;
    
    // Base64 인코딩된 preview 디코딩 (없으면 일반 fullPreview 사용)
    let fullPreview = '';
    if (item.dataset.fullPreviewEncoded) {
        try {
            fullPreview = decodeURIComponent(escape(atob(item.dataset.fullPreviewEncoded)));
        } catch (e) {
            fullPreview = '';
        }
    } else if (item.dataset.fullPreview) {
        fullPreview = item.dataset.fullPreview;
    }
    if (!fullPreview) return;
    
    // 이전 타이머 취소
    hideTooltip();
    currentTooltipTarget = item;
    
    // 딜레이 후 툴팁 표시 (300ms)
    tooltipTimeout = setTimeout(() => {
        if (currentTooltipTarget === item && fullPreview) {
            showTooltip(fullPreview);
        }
    }, 300);
}

/**
 * 툴팁 mouseout 핸들러 (이벤트 위임)
 */
function handleTooltipMouseOut(e) {
    const item = e.target.closest('.lobby-chat-item');
    if (!item) return;
    
    // relatedTarget이 같은 아이템 내부면 무시
    const relatedItem = e.relatedTarget?.closest('.lobby-chat-item');
    if (relatedItem === item) return;
    
    if (currentTooltipTarget === item) {
        hideTooltip();
    }
}

/**
 * 툴팁 wheel 핸들러 - 채팅 아이템 위에서 휠 돌리면 tooltip 스크롤
 */
function handleTooltipWheel(e) {
    // 툴팁이 표시 중일 때만 처리
    if (!tooltipElement || tooltipElement.style.display !== 'block') return;
    
    // 스크롤이 필요한지 확인
    const hasScroll = tooltipElement.scrollHeight > tooltipElement.clientHeight;
    if (!hasScroll) return;
    
    // 채팅 아이템 위에서 휠 이벤트 발생 시 tooltip 스크롤
    const item = e.target.closest('.lobby-chat-item');
    if (item && currentTooltipTarget === item) {
        e.preventDefault();
        e.stopPropagation();
        tooltipElement.scrollTop += e.deltaY;
    }
}

/**
 * 툴팁 mousemove 핸들러 (이벤트 위임)
 */
function handleTooltipMouseMove(e) {
    // 마지막 마우스 좌표 항상 저장 (타이머 지연 후에도 사용)
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    
    const item = e.target.closest('.lobby-chat-item');
    if (!item) return;
    
    // 툴팁이 표시 중이면 위치 업데이트
    if (tooltipElement && tooltipElement.style.display === 'block' && currentTooltipTarget === item) {
        tooltipElement.style.left = `${e.clientX + 15}px`;
        tooltipElement.style.top = `${e.clientY + 15}px`;
    }
}

// ============================================
// Cleanup
// ============================================

/**
 * 툴팁 정리 (메모리 누수 방지)
 * 로비 닫힐 때 호출
 */
export function cleanupTooltip() {
    hideTooltip();

    // 이벤트 위임 리스너 제거 (그룹 일괄)
    listeners.clear('tooltip');
    tooltipEventsInitialized = false;
    
    if (tooltipElement && tooltipElement.parentNode) {
        tooltipElement.parentNode.removeChild(tooltipElement);
    }
    tooltipElement = null;
    currentTooltipTarget = null;
}
