// ============================================
// 페르소나 바 UI
// ============================================

import { api } from '../api/sillyTavern.js';
import { cache } from '../data/cache.js';
import { store } from '../data/store.js';
import { escapeHtml } from '../utils/textUtils.js';
import { createTouchClickHandler } from '../utils/eventHelpers.js';
import { showToast, showConfirm } from './notifications.js';
import { CONFIG } from '../config.js';

// ============================================
// 페르소나 바 렌더링
// ============================================

/**
 * 페르소나 바 렌더링
 * @returns {Promise<void>}
 */
export async function renderPersonaBar() {
    const container = document.getElementById('chat-lobby-persona-list');
    if (!container) return;
    
    // 캐시된 데이터가 있으면 즉시 렌더링
    const cachedPersonas = cache.get('personas');
    if (cachedPersonas && cachedPersonas.length > 0) {
        await renderPersonaList(container, cachedPersonas);
    } else {
        container.innerHTML = '<div class="lobby-loading">로딩 중...</div>';
    }
    
    try {
        // 최신 데이터 가져오기 (캐시 없거나 만료 시)
        const personas = await api.fetchPersonas();
        
        if (personas.length === 0) {
            container.innerHTML = '<div class="persona-empty">페르소나 없음</div>';
            return;
        }
        
        await renderPersonaList(container, personas);
    } catch (error) {
        console.error('[PersonaBar] Failed to load personas:', error);
        showToast('페르소나 목록을 불러오지 못했습니다.', 'error');
        container.innerHTML = '<div class="persona-empty">로딩 실패</div>';
    }
}

/**
 * 페르소나 목록 렌더링 (내부)
 * @param {HTMLElement} container
 * @param {Array} personas
 * @returns {Promise<void>}
 */
async function renderPersonaList(container, personas) {
    let currentPersona = '';
    try {
        currentPersona = await api.getCurrentPersona();
    } catch (e) {
        console.warn('[PersonaBar] Could not get current persona');
    }
    
    let html = '';
    personas.forEach(persona => {
        const isSelected = persona.key === currentPersona ? 'selected' : '';
        const avatarUrl = `/User Avatars/${encodeURIComponent(persona.key)}`;
        html += `
        <div class="persona-item ${isSelected}" data-persona="${escapeHtml(persona.key)}" title="${escapeHtml(persona.name)}">
            <img class="persona-avatar" src="${avatarUrl}" alt="" onerror="this.outerHTML='<div class=persona-avatar>👤</div>'">
            <span class="persona-name">${escapeHtml(persona.name)}</span>
            <button class="persona-delete-btn" data-persona="${escapeHtml(persona.key)}" title="페르소나 삭제">×</button>
        </div>`;
    });
    
    container.innerHTML = html;
    bindPersonaEvents(container);
}

/**
 * 페르소나 이벤트 바인딩
 * @param {HTMLElement} container
 */
function bindPersonaEvents(container) {
    container.querySelectorAll('.persona-item').forEach(item => {
        const deleteBtn = item.querySelector('.persona-delete-btn');
        
        // 전체 아이템 클릭 - 바로 선택, 이미 선택됐으면 관리화면
        const handleItemClick = async (e) => {
            // 삭제 버튼 클릭은 무시
            if (e.target.closest('.persona-delete-btn')) return;
            if (store.isProcessingPersona) return;
            
            if (item.classList.contains('selected')) {
                // 이미 선택된 페르소나 → 관리 화면으로
                openPersonaManagement();
            } else {
                // 선택 안 된 페르소나 → 바로 선택
                await selectPersona(container, item);
            }
        };
        
        // PC: click 이벤트
        item.addEventListener('click', handleItemClick);
        
        // 모바일: touchend 이벤트 (터치 후 바로 반응)
        item.addEventListener('touchend', (e) => {
            // 스크롤 중이면 무시
            if (e.cancelable) {
                e.preventDefault();
            }
            handleItemClick(e);
        }, { passive: false });
        
        // 삭제 버튼은 별도 처리
        if (deleteBtn) {
            const handleDelete = async (e) => {
                e.stopPropagation();
                e.preventDefault();
                const personaKey = deleteBtn.dataset.persona;
                const personaName = item.title || personaKey;
                await deletePersona(personaKey, personaName);
            };
            
            deleteBtn.addEventListener('click', handleDelete);
            deleteBtn.addEventListener('touchend', (e) => {
                e.stopPropagation();
                if (e.cancelable) e.preventDefault();
                handleDelete(e);
            }, { passive: false });
        }
    });
}

// ============================================
// 페르소나 액션
// ============================================

/**
 * 페르소나 선택
 * @param {HTMLElement} container
 * @param {HTMLElement} item
 * @returns {Promise<void>}
 */
async function selectPersona(container, item) {
    if (store.isProcessingPersona) return;
    store.setProcessingPersona(true);
    
    try {
        container.querySelectorAll('.persona-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        
        const success = await api.setPersona(item.dataset.persona);
        if (success) {
            showToast(`페르소나가 변경되었습니다.`, 'success');
        }
    } catch (error) {
        console.error('[PersonaBar] Failed to select persona:', error);
        showToast('페르소나 변경에 실패했습니다.', 'error');
        // 선택 롤백
        item.classList.remove('selected');
    } finally {
        store.setProcessingPersona(false);
    }
}

/**
 * 페르소나 삭제
 * @param {string} personaKey - 페르소나 키
 * @param {string} personaName - 페르소나 이름
 * @returns {Promise<void>}
 */
async function deletePersona(personaKey, personaName) {
    const confirmed = await showConfirm(
        `"${personaName}" 페르소나를 삭제하시겠습니까?`,
        '페르소나 삭제',
        true
    );
    
    if (!confirmed) return;
    
    try {
        const success = await api.deletePersona(personaKey);
        if (success) {
            showToast(`"${personaName}" 페르소나가 삭제되었습니다.`, 'success');
            await renderPersonaBar();
        } else {
            showToast('페르소나 삭제에 실패했습니다.', 'error');
        }
    } catch (error) {
        console.error('[PersonaBar] Failed to delete persona:', error);
        showToast('페르소나 삭제 중 오류가 발생했습니다.', 'error');
    }
}

/**
 * 페르소나 관리 화면 열기
 */
function openPersonaManagement() {
    // 로비 닫기
    const container = document.getElementById('chat-lobby-container');
    const fab = document.getElementById('chat-lobby-fab');
    const overlay = document.getElementById('chat-lobby-overlay');
    
    if (container) container.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
    if (fab) fab.style.display = 'flex';
    store.setLobbyOpen(false);
    
    // 페르소나 관리 drawer 열기
    setTimeout(() => {
        const personaDrawer = document.getElementById('persona-management-button');
        if (!personaDrawer) {
            console.warn('[PersonaBar] Persona management button not found');
            showToast('페르소나 관리 버튼을 찾을 수 없습니다.', 'warning');
            return;
        }
        
        const drawerIcon = personaDrawer.querySelector('.drawer-icon');
        if (drawerIcon) {
            // drawer가 닫혀있을 때만 클릭
            if (!drawerIcon.classList.contains('openIcon')) {
                drawerIcon.click();
                console.log('[PersonaBar] Opening persona management drawer');
            } else {
                console.log('[PersonaBar] Drawer already open');
            }
        } else {
            // drawer-icon이 없으면 버튼 자체를 클릭
            personaDrawer.click();
        }
    }, CONFIG.timing.menuCloseDelay);
}
