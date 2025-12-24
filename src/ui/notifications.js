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
                z-index: 100001;
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
// 커스텀 모달 (alert/confirm/prompt 대체)
// ============================================

let modalContainer = null;

/**
 * 모달 컨테이너 초기화
 */
function initModalContainer() {
    if (modalContainer) return;
    
    modalContainer = document.createElement('div');
    modalContainer.id = 'chat-lobby-modal-container';
    modalContainer.innerHTML = `
        <style>
            #chat-lobby-modal-container {
                display: none;
                position: fixed;
                inset: 0;
                z-index: 100002;
                background: rgba(0,0,0,0.6);
                justify-content: center;
                align-items: center;
            }
            .chat-lobby-modal {
                background: var(--SmartThemeBlurTintColor, #2a2a2a);
                border-radius: 12px;
                padding: 24px;
                min-width: 320px;
                max-width: 450px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.4);
                animation: modalFadeIn 0.2s ease;
            }
            .chat-lobby-modal-title {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 12px;
                color: var(--SmartThemeBodyColor, #fff);
            }
            .chat-lobby-modal-message {
                font-size: 14px;
                color: var(--SmartThemeBodyColor, #ccc);
                margin-bottom: 20px;
                line-height: 1.5;
                white-space: pre-wrap;
            }
            .chat-lobby-modal-input {
                width: 100%;
                padding: 10px 12px;
                border: 1px solid var(--SmartThemeBorderColor, #444);
                border-radius: 6px;
                background: var(--SmartThemeBlurTintColor, #1a1a1a);
                color: var(--SmartThemeBodyColor, #fff);
                font-size: 14px;
                margin-bottom: 20px;
                box-sizing: border-box;
            }
            .chat-lobby-modal-input:focus {
                outline: none;
                border-color: var(--SmartThemeQuoteColor, #888);
            }
            .chat-lobby-modal-buttons {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
            .chat-lobby-modal-btn {
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: opacity 0.2s;
            }
            .chat-lobby-modal-btn:hover { opacity: 0.8; }
            .chat-lobby-modal-btn.cancel {
                background: var(--SmartThemeBorderColor, #444);
                color: var(--SmartThemeBodyColor, #fff);
            }
            .chat-lobby-modal-btn.confirm {
                background: var(--SmartThemeQuoteColor, #4a9eff);
                color: #fff;
            }
            .chat-lobby-modal-btn.confirm.dangerous {
                background: #f44336;
            }
            @keyframes modalFadeIn {
                from { transform: scale(0.9); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
        </style>
        <div class="chat-lobby-modal">
            <div class="chat-lobby-modal-title"></div>
            <div class="chat-lobby-modal-message"></div>
            <input type="text" class="chat-lobby-modal-input" style="display:none;">
            <div class="chat-lobby-modal-buttons">
                <button class="chat-lobby-modal-btn cancel">취소</button>
                <button class="chat-lobby-modal-btn confirm">확인</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalContainer);
}

/**
 * 커스텀 알림창 (alert 대체)
 * @param {string} message - 메시지
 * @param {string} [title='알림'] - 제목
 * @returns {Promise<void>}
 */
export function showAlert(message, title = '알림') {
    return showModal({
        title,
        message,
        showCancel: false,
        confirmText: '확인'
    });
}

/**
 * 커스텀 확인창 (confirm 대체)
 * @param {string} message - 메시지
 * @param {string} [title='확인'] - 제목
 * @param {boolean} [dangerous=false] - 위험 액션 여부
 * @returns {Promise<boolean>}
 */
export function showConfirm(message, title = '확인', dangerous = false) {
    return showModal({
        title,
        message,
        showCancel: true,
        dangerous,
        confirmText: dangerous ? '삭제' : '확인',
        cancelText: '취소'
    }).then(result => result === true);
}

/**
 * 커스텀 입력창 (prompt 대체)
 * @param {string} message - 메시지
 * @param {string} [title='입력'] - 제목
 * @param {string} [defaultValue=''] - 기본값
 * @returns {Promise<string|null>}
 */
export function showPrompt(message, title = '입력', defaultValue = '') {
    return showModal({
        title,
        message,
        showCancel: true,
        inputPlaceholder: '',
        inputValue: defaultValue
    });
}

/**
 * 모달 표시
 * @param {ModalOptions} options
 * @returns {Promise<boolean|string|null>}
 */
function showModal(options) {
    initModalContainer();
    
    return new Promise((resolve) => {
        const modal = modalContainer.querySelector('.chat-lobby-modal');
        const titleEl = modal.querySelector('.chat-lobby-modal-title');
        const messageEl = modal.querySelector('.chat-lobby-modal-message');
        const inputEl = modal.querySelector('.chat-lobby-modal-input');
        const cancelBtn = modal.querySelector('.chat-lobby-modal-btn.cancel');
        const confirmBtn = modal.querySelector('.chat-lobby-modal-btn.confirm');
        
        // 내용 설정
        titleEl.textContent = options.title || '알림';
        messageEl.textContent = options.message || '';
        
        // 입력 필드
        if (options.inputPlaceholder !== undefined) {
            inputEl.style.display = 'block';
            inputEl.placeholder = options.inputPlaceholder;
            inputEl.value = options.inputValue || '';
            setTimeout(() => inputEl.focus(), 100);
        } else {
            inputEl.style.display = 'none';
        }
        
        // 버튼 설정
        cancelBtn.style.display = options.showCancel !== false ? 'block' : 'none';
        cancelBtn.textContent = options.cancelText || '취소';
        confirmBtn.textContent = options.confirmText || '확인';
        confirmBtn.classList.toggle('dangerous', options.dangerous === true);
        
        // 이벤트 핸들러
        const cleanup = () => {
            modalContainer.style.display = 'none';
            cancelBtn.onclick = null;
            confirmBtn.onclick = null;
            inputEl.onkeydown = null;
        };
        
        cancelBtn.onclick = () => {
            cleanup();
            resolve(options.inputPlaceholder !== undefined ? null : false);
        };
        
        confirmBtn.onclick = () => {
            cleanup();
            if (options.inputPlaceholder !== undefined) {
                const value = inputEl.value.trim();
                resolve(value || null);
            } else {
                resolve(true);
            }
        };
        
        // Enter로 확인
        inputEl.onkeydown = (e) => {
            if (e.key === 'Enter') {
                confirmBtn.click();
            } else if (e.key === 'Escape') {
                cancelBtn.click();
            }
        };
        
        // ESC로 닫기
        const escHandler = (e) => {
            if (e.key === 'Escape' && modalContainer.style.display === 'flex') {
                cancelBtn.click();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        
        // 표시
        modalContainer.style.display = 'flex';
    });
}
