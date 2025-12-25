// ============================================
// 토스트 알림 및 커스텀 모달 UI
// ============================================

import { CONFIG } from '../config.js';

/**
 * @typedef {'success' | 'error' | 'warning' | 'info'} ToastType
 */

/**
 * @typedef {Object} ModalOptions
 * @property {string} title - 모달 제목
 * @property {string} message - 모달 메시지
 * @property {string} [confirmText='확인'] - 확인 버튼 텍스트
 * @property {string} [cancelText='취소'] - 취소 버튼 텍스트
 * @property {boolean} [showCancel=true] - 취소 버튼 표시 여부
 * @property {boolean} [dangerous=false] - 위험 액션 여부 (빨간 버튼)
 * @property {string} [inputPlaceholder] - 입력 필드 플레이스홀더 (prompt용)
 * @property {string} [inputValue=''] - 입력 필드 기본값
 */

// ============================================
// 토스트 알림
// ============================================

let toastContainer = null;

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
                z-index: 10002;
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
        </style>
    `;
    document.body.appendChild(toastContainer);
}

/**
 * 토스트 알림 표시
 * @param {string} message - 메시지
 * @param {ToastType} [type='info'] - 토스트 타입
 * @param {number} [duration] - 표시 시간 (ms)
 */
export function showToast(message, type = 'info', duration = CONFIG.timing.toastDuration) {
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
 * 토스트 제거
 * @param {HTMLElement} toast
 */
function removeToast(toast) {
    if (!toast.parentNode) return;
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), CONFIG.timing.animationDuration);
}

/**
 * HTML 이스케이프
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============================================
// 브라우저 네이티브 alert/confirm/prompt 사용
// ============================================

/**
 * 커스텀 알림창 (alert 대체)
 * @param {string} message - 메시지
 * @param {string} [title='알림'] - 제목
 * @returns {Promise<void>}
 */
export function showAlert(message, title = '알림') {
    // 브라우저 네이티브 alert 사용
    const fullMessage = title ? `[${title}]\n\n${message}` : message;
    alert(fullMessage);
    return Promise.resolve();
}

/**
 * 커스텀 확인창 (confirm 대체)
 * @param {string} message - 메시지
 * @param {string} [title='확인'] - 제목
 * @param {boolean} [dangerous=false] - 위험 액션 여부
 * @returns {Promise<boolean>}
 */
export function showConfirm(message, title = '확인', dangerous = false) {
    // 브라우저 네이티브 confirm 사용 (CSS 문제 회피)
    const fullMessage = title ? `[${title}]\n\n${message}` : message;
    return Promise.resolve(confirm(fullMessage));
}

/**
 * 커스텀 입력창 (prompt 대체)
 * @param {string} message - 메시지
 * @param {string} [title='입력'] - 제목
 * @param {string} [defaultValue=''] - 기본값
 * @returns {Promise<string|null>}
 */
export function showPrompt(message, title = '입력', defaultValue = '') {
    // 브라우저 네이티브 prompt 사용
    const fullMessage = title ? `[${title}]\n\n${message}` : message;
    const result = prompt(fullMessage, defaultValue);
    return Promise.resolve(result);
}
