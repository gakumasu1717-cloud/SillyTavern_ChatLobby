// ============================================
// 알림 시스템 (브라우저 Notification API + Fallback Toast)
// 모바일에서 토스트가 안 뜨는 문제 해결
// ============================================

import { CONFIG } from '../config.js';
import { escapeHtml } from '../utils/textUtils.js';

/**
 * @typedef {'success' | 'error' | 'warning' | 'info'} ToastType
 */

// ============================================
// 브라우저 알림 + 토스트 알림 통합
// ============================================

let toastContainer = null;
let notificationPermission = 'default';

/**
 * 브라우저 알림 권한 요청
 */
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.debug('[Notification] Browser does not support notifications');
        return 'denied';
    }
    
    if (Notification.permission === 'granted') {
        notificationPermission = 'granted';
        return 'granted';
    }
    
    if (Notification.permission !== 'denied') {
        try {
            const permission = await Notification.requestPermission();
            notificationPermission = permission;
            return permission;
        } catch (e) {
            console.warn('[Notification] Permission request failed:', e);
            return 'denied';
        }
    }
    
    notificationPermission = Notification.permission;
    return Notification.permission;
}

/**
 * 브라우저 알림 표시
 * @param {string} message - 메시지
 * @param {ToastType} type - 타입
 * @returns {boolean} 알림 표시 성공 여부
 */
function showBrowserNotification(message, type) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        return false;
    }
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    const titles = {
        success: 'Success',
        error: 'Error',
        warning: 'Warning',
        info: 'Info'
    };
    
    try {
        const notification = new Notification(`${icons[type]} ${titles[type]}`, {
            body: message,
            icon: '/favicon.ico',
            tag: `chatlobby-${type}-${Date.now()}`,
            requireInteraction: false,
            silent: type !== 'error'
        });
        
        // 3초 후 자동 닫기
        setTimeout(() => notification.close(), 3000);
        
        return true;
    } catch (e) {
        console.warn('[Notification] Failed to show notification:', e);
        return false;
    }
}

/**
 * 토스트 컨테이너 초기화
 */
function initToastContainer() {
    if (toastContainer) return;
    
    toastContainer = document.createElement('div');
    toastContainer.id = 'chat-lobby-toast-container';
    toastContainer.innerHTML = `
        <style>
            #chat-lobby-toast-container {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 60001;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            }
            .chat-lobby-toast {
                background: var(--SmartThemeBlurTintColor, #2a2a2a);
                color: var(--SmartThemeBodyColor, #fff);
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                gap: 10px;
                pointer-events: auto;
                animation: toastSlideIn 0.3s ease;
                max-width: 350px;
                font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;
            }
            .chat-lobby-toast.success { border-left: 4px solid #4caf50; }
            .chat-lobby-toast.error { border-left: 4px solid #f44336; }
            .chat-lobby-toast.warning { border-left: 4px solid #ff9800; }
            .chat-lobby-toast.info { border-left: 4px solid #2196f3; }
            .chat-lobby-toast.fade-out {
                animation: toastSlideOut 0.3s ease forwards;
            }
            .chat-lobby-toast-icon {
                font-size: 18px;
            }
            .chat-lobby-toast-message {
                flex: 1;
                font-size: 14px;
            }
            .chat-lobby-toast-close {
                background: none;
                border: none;
                color: inherit;
                cursor: pointer;
                opacity: 0.6;
                font-size: 16px;
            }
            .chat-lobby-toast-close:hover { opacity: 1; }
            @keyframes toastSlideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes toastSlideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            
            /* 모바일에서도 토스트 표시되도록 강화 */
            @media (max-width: 768px) {
                #chat-lobby-toast-container {
                    left: 10px;
                    right: 10px;
                    bottom: 80px;
                }
                .chat-lobby-toast {
                    max-width: 100%;
                }
            }
        </style>
    `;
    document.body.appendChild(toastContainer);
}

/**
 * 토스트 알림 표시 (DOM 기반)
 * @param {string} message - 메시지
 * @param {ToastType} type - 타입
 * @param {number} duration - 표시 시간
 */
function showDOMToast(message, type, duration) {
    initToastContainer();
    
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    
    const toast = document.createElement('div');
    toast.className = `chat-lobby-toast ${type}`;
    toast.innerHTML = `
        <span class="chat-lobby-toast-icon">${icons[type]}</span>
        <span class="chat-lobby-toast-message">${escapeHtml(message)}</span>
        <button class="chat-lobby-toast-close">×</button>
    `;
    
    const closeBtn = toast.querySelector('.chat-lobby-toast-close');
    closeBtn.addEventListener('click', () => removeToast(toast));
    
    toastContainer.appendChild(toast);
    
    // 자동 제거
    setTimeout(() => removeToast(toast), duration);
}

/**
 * 통합 알림 표시
 * 1. 브라우저 알림 권한이 있으면 Notification API 사용
 * 2. 권한이 없거나 실패하면 DOM 토스트 사용
 * 3. 모바일에서는 둘 다 시도
 * 
 * @param {string} message - 메시지
 * @param {ToastType} [type='info'] - 토스트 타입
 * @param {number} [duration] - 표시 시간 (ms)
 */
export function showToast(message, type = 'info', duration = CONFIG.timing.toastDuration) {
    // DOM 토스트는 항상 표시 (화면에 보이는 범용 피드백)
    showDOMToast(message, type, duration);
}

/**
 * 알림 권한 요청 (최초 1회 호출용)
 * 로비 열 때 호출하면 좋음
 */
export async function initNotifications() {
    await requestNotificationPermission();
}

/**
 * 토스트 제거
 * @param {HTMLElement} toast
 */
function removeToast(toast) {
    if (!toast.parentNode) return;
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), CONFIG.timing.animationDuration);
}

// ============================================
// 다이얼로그 (브라우저 네이티브)
// ============================================

/**
 * 알림창 표시
 * @param {string} message - 메시지
 * @param {string} [title='알림'] - 제목
 * @returns {Promise<void>}
 */
export function showAlert(message, title = '알림') {
    const fullMessage = title ? `[${title}]\n\n${message}` : message;
    alert(fullMessage);
    return Promise.resolve();
}

/**
 * 확인창 표시
 * @param {string} message - 메시지
 * @param {string} [title='확인'] - 제목
 * @param {boolean} [_dangerous=false] - 미사용 (호환성 유지)
 * @returns {Promise<boolean>}
 */
export function showConfirm(message, title = '확인', _dangerous = false) {
    const fullMessage = title ? `[${title}]\n\n${message}` : message;
    return Promise.resolve(confirm(fullMessage));
}

/**
 * 입력창 표시
 * @param {string} message - 메시지
 * @param {string} [title='입력'] - 제목
 * @param {string} [defaultValue=''] - 기본값
 * @returns {Promise<string|null>}
 */
export function showPrompt(message, title = '입력', defaultValue = '') {
    const fullMessage = title ? `[${title}]\n\n${message}` : message;
    return Promise.resolve(prompt(fullMessage, defaultValue));
}
