// ============================================
// Drawer 헬퍼 (CustomTheme 호환)
// CustomTheme이 .off('click')으로 이벤트 제거해도 동작함
// ============================================

/**
 * Drawer를 안전하게 열기 (CustomTheme 호환)
 * @param {string} drawerId - drawer의 ID (예: 'persona-management-button')
 * @returns {boolean} 성공 여부
 */
export function openDrawerSafely(drawerId) {
    const drawer = document.getElementById(drawerId);
    if (!drawer) {
        console.warn(`[ChatLobby] Drawer not found: ${drawerId}`);
        return false;
    }
    
    const drawerContent = drawer.querySelector('.drawer-content');
    const drawerIcon = drawer.querySelector('.drawer-icon');
    
    if (!drawerContent) {
        console.warn(`[ChatLobby] Drawer content not found in: ${drawerId}`);
        return false;
    }
    
    // 이미 열려있으면 스킵
    if (drawerContent.classList.contains('openDrawer')) {
        return true;
    }
    
    // 다른 drawer들 닫기 (ST 기본 동작)
    document.querySelectorAll('.drawer-content.openDrawer').forEach(el => {
        if (el !== drawerContent) {
            el.classList.remove('openDrawer');
            el.classList.add('closedDrawer');
        }
    });
    document.querySelectorAll('.drawer-icon.openIcon').forEach(el => {
        if (el !== drawerIcon) {
            el.classList.remove('openIcon');
            el.classList.add('closedIcon');
        }
    });
    
    // 대상 drawer 열기 (클래스 직접 조작)
    drawerContent.classList.remove('closedDrawer');
    drawerContent.classList.add('openDrawer');
    
    if (drawerIcon) {
        drawerIcon.classList.remove('closedIcon');
        drawerIcon.classList.add('openIcon');
    }
    
    // CustomTheme 호환: data 속성 업데이트
    drawer.setAttribute('data-st-open', 'true');
    
    return true;
}

/**
 * Drawer를 안전하게 닫기
 * @param {string} drawerId
 * @returns {boolean}
 */
export function closeDrawerSafely(drawerId) {
    const drawer = document.getElementById(drawerId);
    if (!drawer) return false;
    
    const drawerContent = drawer.querySelector('.drawer-content');
    const drawerIcon = drawer.querySelector('.drawer-icon');
    
    if (drawerContent) {
        drawerContent.classList.remove('openDrawer');
        drawerContent.classList.add('closedDrawer');
    }
    
    if (drawerIcon) {
        drawerIcon.classList.remove('openIcon');
        drawerIcon.classList.add('closedIcon');
    }
    
    drawer.setAttribute('data-st-open', 'false');
    
    return true;
}
