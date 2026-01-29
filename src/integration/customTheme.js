// ============================================
// CustomTheme 사이드바/햄버거 메뉴 통합
// ============================================

import { intervalManager } from '../utils/intervalManager.js';
import { CONFIG } from '../config.js';

// MutationObserver 참조 (cleanup용)
let hamburgerObserver = null;

/**
 * CustomTheme 사이드바/햄버거 메뉴에 Chat Lobby 버튼 추가
 * - 사이드바(PC): 컨테이너 나타날 때까지 대기 후 한 번만 추가
 * - 햄버거(모바일): MutationObserver로 드롭다운 변화 감지, CustomTheme이 empty() 후 다시 추가
 * @param {Function} openLobbyFn - 로비 열기 함수
 * @returns {boolean}
 */
export function initCustomThemeIntegration(openLobbyFn) {
    // 중복 초기화 방지 플래그
    if (window._chatLobbyCustomThemeInit) return true;
    window._chatLobbyCustomThemeInit = true;
    
    // Custom Tavern 이벤트 위임 (document에서 캡처)
    document.addEventListener('click', (e) => {
        const customTavernBtn = e.target.closest('[data-drawer-id="st-chatlobby-sidebar-btn"]');
        if (customTavernBtn) {
            e.preventDefault();
            e.stopPropagation();
            openLobbyFn();
            return;
        }
    }, true); // capture phase
    
    // 1. 사이드바 버튼 추가 (PC) - CustomTheme drawer 구조 사용
    const addSidebarButton = () => {
        const container = document.getElementById('st-sidebar-top-container');
        if (!container) return false;
        if (document.getElementById('st-chatlobby-sidebar-btn')) return true; // 이미 있음
        
        const btn = document.createElement('div');
        btn.id = 'st-chatlobby-sidebar-btn';
        btn.className = 'drawer st-moved-drawer';
        btn.innerHTML = `
            <div class="drawer-toggle">
                <div class="drawer-icon fa-solid fa-comments closedIcon" title="Chat Lobby"></div>
                <span class="st-sidebar-label">Chat Lobby</span>
            </div>
        `;
        btn.querySelector('.drawer-toggle').addEventListener('click', () => openLobbyFn());
        container.appendChild(btn);
        return true;
    };
    
    // 2. 햄버거 버튼 추가 (모바일)
    const addHamburgerButton = () => {
        const dropdown = document.getElementById('st-hamburger-dropdown-content');
        if (!dropdown) return false;
        if (document.getElementById('st-chatlobby-hamburger-btn')) return true; // 이미 있음
        
        const btn = document.createElement('div');
        btn.id = 'st-chatlobby-hamburger-btn';
        btn.className = 'st-dropdown-item';
        btn.innerHTML = `
            <i class="fa-solid fa-comments"></i>
            <span>Chat Lobby</span>
        `;
        btn.addEventListener('click', () => {
            openLobbyFn();
            // 드롭다운 닫기
            document.getElementById('st-hamburger-dropdown')?.classList.remove('st-dropdown-open');
        });
        dropdown.appendChild(btn);
        return true;
    };
    
    // 3. 햄버거 MutationObserver 설정 (CustomTheme이 empty() 호출 시 다시 추가)
    const setupHamburgerObserver = () => {
        const dropdown = document.getElementById('st-hamburger-dropdown-content');
        if (!dropdown) {
            // 드롭다운 없으면 500ms 후 재시도 (최대 20회)
            if (!setupHamburgerObserver._attempts) setupHamburgerObserver._attempts = 0;
            if (++setupHamburgerObserver._attempts < 20) {
                setTimeout(setupHamburgerObserver, 500);
            }
            return;
        }
        
        // 초기 추가
        addHamburgerButton();
        
        // 기존 observer 정리
        if (hamburgerObserver) {
            hamburgerObserver.disconnect();
            hamburgerObserver = null;
        }
        
        // DOM 변화 감지 (CustomTheme이 empty() 후 다시 채울 때)
        hamburgerObserver = new MutationObserver(() => {
            // 버튼이 없으면 다시 추가
            if (!document.getElementById('st-chatlobby-hamburger-btn')) {
                addHamburgerButton();
            }
        });
        hamburgerObserver.observe(dropdown, { childList: true });
    };
    
    // 4. 사이드바: 즉시 시도 → 실패 시 polling (최대 20회, 10초)
    if (!addSidebarButton()) {
        let attempts = 0;
        const interval = intervalManager.set(() => {
            attempts++;
            if (addSidebarButton() || attempts >= 20) {
                intervalManager.clear(interval);
            }
        }, 500);
    }
    
    // 5. 햄버거 Observer 설정
    setupHamburgerObserver();
    
    return true;
}

/**
 * 통합 UI 정리 (MutationObserver 등)
 */
export function cleanupCustomThemeIntegration() {
    // MutationObserver 정리
    if (hamburgerObserver) {
        hamburgerObserver.disconnect();
        hamburgerObserver = null;
    }
    
    // 플래그 초기화 (확장 재로드 대비)
    window._chatLobbyCustomThemeInit = false;
}
