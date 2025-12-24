// ============================================
// 페르소나 바 UI
// ============================================

import { api } from '../api/sillyTavern.js';
import { cache } from '../data/cache.js';
import { escapeHtml } from '../utils/textUtils.js';
import { createTouchClickHandler } from '../utils/eventHelpers.js';

let isProcessingPersona = false;

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
    
    // 최신 데이터 가져오기 (캐시 없거나 만료 시)
    const personas = await api.fetchPersonas();
    
    if (personas.length === 0) {
        container.innerHTML = '<div class="persona-empty">페르소나 없음</div>';
        return;
    }
    
    await renderPersonaList(container, personas);
}

async function renderPersonaList(container, personas) {
    const currentPersona = await api.getCurrentPersona();
    
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

function bindPersonaEvents(container) {
    container.querySelectorAll('.persona-item').forEach(item => {
        const avatarImg = item.querySelector('.persona-avatar');
        const nameSpan = item.querySelector('.persona-name');
        const deleteBtn = item.querySelector('.persona-delete-btn');
        
        // 아바타 클릭 - 선택된 페르소나면 관리화면, 아니면 선택
        if (avatarImg) {
            createTouchClickHandler(avatarImg, async () => {
                if (isProcessingPersona) return;
                
                if (item.classList.contains('selected')) {
                    openPersonaManagement();
                } else {
                    await selectPersona(container, item);
                }
            });
            avatarImg.style.cursor = 'pointer';
        }
        
        // 이름 클릭 - 페르소나 선택
        if (nameSpan) {
            createTouchClickHandler(nameSpan, async () => {
                if (item.classList.contains('selected')) return;
                await selectPersona(container, item);
            });
            nameSpan.style.cursor = 'pointer';
        }
        
        // 삭제 버튼
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await deletePersona(deleteBtn.dataset.persona, item.title);
            });
        }
    });
}

async function selectPersona(container, item) {
    if (isProcessingPersona) return;
    isProcessingPersona = true;
    
    try {
        container.querySelectorAll('.persona-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        await api.setPersona(item.dataset.persona);
    } finally {
        isProcessingPersona = false;
    }
}

async function deletePersona(personaKey, personaName) {
    if (!confirm(`"${personaName}" 페르소나를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
        return;
    }
    
    const success = await api.deletePersona(personaKey);
    if (success) {
        await renderPersonaBar();
    } else {
        alert('페르소나 삭제에 실패했습니다.');
    }
}

function openPersonaManagement() {
    // 로비 닫기
    const container = document.getElementById('chat-lobby-container');
    const fab = document.getElementById('chat-lobby-fab');
    if (container) container.style.display = 'none';
    if (fab) fab.style.display = 'flex';
    
    // 페르소나 관리 drawer 열기
    setTimeout(() => {
        const personaDrawer = document.getElementById('persona-management-button');
        if (personaDrawer) {
            const drawerIcon = personaDrawer.querySelector('.drawer-icon');
            if (drawerIcon && !drawerIcon.classList.contains('openIcon')) {
                drawerIcon.click();
            }
        }
    }, 300);
}
