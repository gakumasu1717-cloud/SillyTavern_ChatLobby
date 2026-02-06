// ============================================
// 페르소나 바 UI
// ============================================

import { api } from '../api/sillyTavern.js';
import { cache } from '../data/cache.js';
import { storage } from '../data/storage.js';
import { store } from '../data/store.js';
import { escapeHtml } from '../utils/textUtils.js';
import { createTouchClickHandler } from '../utils/eventHelpers.js';
import { openDrawerSafely } from '../utils/drawerHelper.js';
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
    
    // 즐겨찾기 정렬: 즐겨찾기 먼저, 그 안에서는 원래 순서 유지
    const sortedPersonas = [...personas].sort((a, b) => {
        const aFav = storage.isPersonaFavorite(a.key);
        const bFav = storage.isPersonaFavorite(b.key);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return 0;
    });
    
    let html = '';
    sortedPersonas.forEach(persona => {
        const isSelected = persona.key === currentPersona ? 'selected' : '';
        const isFav = storage.isPersonaFavorite(persona.key);
        const favClass = isFav ? 'is-persona-fav' : '';
        const avatarUrl = `/User Avatars/${encodeURIComponent(persona.key)}`;
        html += `
        <div class="persona-item ${isSelected} ${favClass}" data-persona="${escapeHtml(persona.key)}" title="${escapeHtml(persona.name)}">
            <button class="persona-fav-btn" data-persona="${escapeHtml(persona.key)}" title="즐겨찾기">${isFav ? '★' : '☆'}</button>
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
    container.querySelectorAll('.persona-item').forEach((item, index) => {
        const deleteBtn = item.querySelector('.persona-delete-btn');
        const favBtn = item.querySelector('.persona-fav-btn');
        const personaKey = item.dataset.persona;
        
        // 즐겨찾기 버튼 이벤트
        if (favBtn) {
            createTouchClickHandler(favBtn, (e) => {
                e.stopPropagation();
                
                const newFavState = storage.togglePersonaFavorite(personaKey);
                
                // UI 업데이트
                favBtn.textContent = newFavState ? '★' : '☆';
                item.classList.toggle('is-persona-fav', newFavState);
                
                showToast(newFavState ? '즐겨찾기에 추가됨' : '즐겨찾기에서 제거됨', 'success');
                
                // 정렬 반영을 위해 리렌더 (약간의 딜레이)
                setTimeout(() => renderPersonaBar(), 300);
                
            }, { preventDefault: true, stopPropagation: true, debugName: `persona-fav-${index}` });
        }
        
        // 클릭 핸들러 - 바로 선택, 이미 선택됐으면 관리화면
        const handleItemClick = async (e) => {
            if (e.target.closest('.persona-delete-btn')) return;
            if (e.target.closest('.persona-fav-btn')) return;
            if (store.isProcessingPersona) return;
            
            if (item.classList.contains('selected')) {
                openPersonaManagement();
            } else {
                await selectPersona(container, item);
            }
        };
        
        // createTouchClickHandler 사용으로 터치/클릭 통합 (스크롤 vs 클릭 구분 포함)
        createTouchClickHandler(item, handleItemClick, {
            preventDefault: true,
            stopPropagation: false,
            scrollThreshold: 10,
            debugName: `persona-${index}-${personaKey}`
        });
        
        // 삭제 버튼도 createTouchClickHandler 사용
        if (deleteBtn) {
            createTouchClickHandler(deleteBtn, async (e) => {
                const personaName = item.title || personaKey;
                await deletePersona(personaKey, personaName);
            }, {
                preventDefault: true,
                stopPropagation: true,
                debugName: `persona-del-${index}`
            });
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
        
        const personaKey = item.dataset.persona;
        const success = await api.setPersona(personaKey);
        if (success) {
            // 사용 기록 저장 (최근 사용순 정렬용)
            storage.recordPersonaUsage(personaKey);
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
            // 캐시 무효화 후 새 데이터로 리렌더
            cache.invalidate('personas', null, true);
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
    
    // 페르소나 관리 drawer 열기 (CustomTheme 호환)
    setTimeout(() => {
        if (!openDrawerSafely('persona-management-button')) {
            showToast('페르소나 관리를 열 수 없습니다.', 'warning');
        }
    }, CONFIG.timing.menuCloseDelay);
}
