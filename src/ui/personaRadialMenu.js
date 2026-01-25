// ============================================
// 페르소나 원형 메뉴 (Circular Menu)
// 네이버 스타일 중앙 원형 메뉴 + 스크롤 네비게이션
// ============================================

import { api } from '../api/sillyTavern.js';
import { cache } from '../data/cache.js';
import { storage } from '../data/storage.js';
import { escapeHtml } from '../utils/textUtils.js';
import { showToast } from './notifications.js';

// ============================================
// 상태 관리
// ============================================

const state = {
    isOpen: false,
    mode: 'favorites',      // 'favorites' | 'all'
    selectedIndex: 0,       // 현재 선택된 인덱스
    favorites: [],
    allPersonas: [],
    currentPersona: null,
    isInitialized: false,
};

// 설정
const CONFIG = {
    RADIUS: 200,            // 원 반지름 (PC) - 카드와 간격 확보
    RADIUS_MOBILE: 150,     // 원 반지름 (모바일) - 최소 가시성 확보
    RADIUS_Y_RATIO: 0.32,   // Y축 비율 (위가 직선에 가까운 타원)
    ITEM_SIZE: 64,          // 아바타 크기 (PC) - 증가
    ITEM_SIZE_MOBILE: 52,   // 모바일 아바타 크기 - 증가
    ITEM_GAP: 16,           // 아이템 간 최소 갭
    FAB_SIZE: 56,           // FAB 크기
    SCROLL_STEP: 1,         // 한 번에 스크롤하는 개수
    SCROLL_COOLDOWN: 60,    // 스크롤 쿨다운
    ITEM_WIDTH: 50,         // 아이템 간격 (드래그 계산용) - 감도 높임
};

// 페르소나 표시 개수: 7개 고정
function getVisibleCount() {
    return 7;
}

// 현재 반지름 계산
function getRadius() {
    return window.innerWidth <= 768 ? CONFIG.RADIUS_MOBILE : CONFIG.RADIUS;
}

function getItemSize() {
    return window.innerWidth <= 768 ? CONFIG.ITEM_SIZE_MOBILE : CONFIG.ITEM_SIZE;
}

// 화면 폭에 따라 Y ratio 동적 계산 (좁을수록 더 원형에 가깝게)
function getYRatio() {
    const width = window.innerWidth;
    if (width <= 320) return 0.8;
    if (width <= 480) return 0.7;
    if (width <= 768) return 0.6;
    return 0.5; // PC 최소 곡률 0.5
}

// 드래그 상태 (PC용)
let isDragging = false;
let dragStartX = 0;

// 인디케이터 타이머
let indicatorTimer = null;

// 렌더링 스로틀
let renderPending = false;

function scheduleRender() {
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(() => {
        renderItems();
        renderPending = false;
    });
}

// 인디케이터는 이제 center-mode에 통합됨 (별도 표시/숨김 불필요)
function showIndicator() {
    // center-mode에서 자동 업데이트되므로 별도 처리 불필요
}

// ============================================
// DOM 요소 생성
// ============================================

/**
 * 원형 메뉴 HTML 생성
 */
function createMenuHTML() {
    return `
        <div class="persona-menu-overlay" id="persona-menu-overlay"></div>
        <div class="persona-menu-arc" id="persona-menu-arc">
            <div class="persona-arc-items" id="persona-arc-items"></div>
            <div class="persona-arc-center" id="persona-arc-center">
                <button class="persona-scroll-to-current" id="persona-scroll-to-current" title="현재 페르소나로 이동">🎯</button>
                <img src="" alt="" class="persona-center-avatar" id="persona-center-avatar">
                <span class="persona-center-name" id="persona-center-name">페르소나</span>
                <span class="persona-center-mode" id="persona-center-mode">⭐ 즐겨찾기</span>
            </div>
        </div>
        <button class="persona-fab" id="persona-fab" title="페르소나 전환">
            <img src="" alt="" id="persona-fab-avatar">
            <span class="persona-fab-icon" id="persona-fab-icon">👤</span>
        </button>
    `;
}

/**
 * 메뉴 초기화
 */
export async function initPersonaRadialMenu() {
    if (state.isInitialized) return;
    
    // 기존 요소 제거
    const existing = document.getElementById('persona-radial-container');
    if (existing) existing.remove();
    
    // 로비 컨테이너 찾기
    const lobbyContainer = document.getElementById('chat-lobby-container');
    if (!lobbyContainer) {
        console.warn('[PersonaMenu] Lobby container not found');
        return;
    }
    
    // 컨테이너 생성
    const container = document.createElement('div');
    container.id = 'persona-radial-container';
    container.innerHTML = createMenuHTML();
    lobbyContainer.appendChild(container);
    
    // 이벤트 바인딩
    bindEvents();
    
    // 데이터 로드
    await loadPersonas();
    await updateFabAvatar();
    
    state.isInitialized = true;
    console.log('[PersonaMenu] Initialized');
}

// ============================================
// 데이터 로드
// ============================================

async function loadPersonas() {
    try {
        const personas = await api.fetchPersonas();
        state.allPersonas = personas || [];
        state.favorites = state.allPersonas.filter(p => storage.isPersonaFavorite(p.key));
    } catch (e) {
        state.allPersonas = [];
        state.favorites = [];
    }
}

async function updateFabAvatar() {
    const fabAvatar = document.getElementById('persona-fab-avatar');
    const fabIcon = document.getElementById('persona-fab-icon');
    if (!fabAvatar || !fabIcon) return;
    
    try {
        state.currentPersona = await api.getCurrentPersona();
        if (state.currentPersona) {
            fabAvatar.src = `/User Avatars/${encodeURIComponent(state.currentPersona)}`;
            fabAvatar.style.display = 'block';
            fabIcon.style.display = 'none';
            fabAvatar.onerror = () => {
                fabAvatar.style.display = 'none';
                fabIcon.style.display = 'flex';
            };
        } else {
            fabAvatar.style.display = 'none';
            fabIcon.style.display = 'flex';
        }
    } catch (e) {
        fabAvatar.style.display = 'none';
        fabIcon.style.display = 'flex';
    }
}

// ============================================
// 원형 메뉴 렌더링
// ============================================

/**
 * 단일 반원 형태로 아이템 배치 (아이템 간 최소 20px 갭)
 */
function renderItems() {
    const container = document.getElementById('persona-arc-items');
    if (!container) return;
    
    let items = state.mode === 'favorites' ? state.favorites : state.allPersonas;
    
    // 즐겨찾기 없으면 자동으로 전체 모드로 전환
    if (items.length === 0 && state.mode === 'favorites') {
        state.mode = 'all';
        items = state.allPersonas;
        updateMode();
    }
    
    if (items.length === 0) {
        container.innerHTML = `<div class="persona-arc-empty">페르소나 없음</div>`;
        updateCenterDisplay();
        updateIndicator(0, 0);
        return;
    }
    
    // 스크롤 인덱스 정규화
    const maxScroll = Math.max(0, items.length - 1);
    state.selectedIndex = Math.min(Math.max(0, state.selectedIndex), maxScroll);
    
    // 보이는 아이템 계산
    const visibleCount_ = getVisibleCount();
    const visibleItems = items.slice(state.selectedIndex, state.selectedIndex + visibleCount_);
    
    // 중앙에는 항상 현재 선택된 페르소나 표시
    updateCenterDisplay();
    
    let html = '';
    const radius = getRadius();
    const itemSize = getItemSize();
    const yRatio = getYRatio(); // 화면 폭에 따라 동적 계산
    const itemCount = visibleItems.length;
    
    // 아이템 간 최소 갭 20px 보장을 위한 각도 계산
    // 호 길이 = radius * π (반원)
    // 필요한 호 길이 = itemCount * (itemSize + gap)
    const arcLength = radius * Math.PI;
    const requiredSpace = itemCount * (itemSize + CONFIG.ITEM_GAP);
    
    // 사용 가능한 각도 범위 (패딩 고려)
    const paddingAngle = 0.15; // 양쪽 끝 패딩
    const usableAngle = Math.PI - paddingAngle * 2;
    
    visibleItems.forEach((persona, i) => {
        // 균등 배치 (양쪽 패딩 포함)
        const progress = itemCount > 1 ? i / (itemCount - 1) : 0.5;
        const angle = Math.PI - paddingAngle - progress * usableAngle;
        
        const x = Math.cos(angle) * radius;
        const y = -Math.sin(angle) * radius * yRatio;
        
        const avatarUrl = `/User Avatars/${encodeURIComponent(persona.key)}`;
        const isFav = storage.isPersonaFavorite(persona.key) ? 'is-fav' : '';
        const isCurrent = persona.key === state.currentPersona ? 'is-current' : '';
        const displayName = persona.name || persona.key.replace(/\.[^.]+$/, '');
        
        // 중앙 거리 기반 스케일/투명도
        const distFromCenter = Math.abs(i - Math.floor(itemCount / 2));
        const maxDist = Math.floor(itemCount / 2);
        const normalizedDist = maxDist > 0 ? distFromCenter / maxDist : 0;
        const scale = Math.max(0.8, 1 - normalizedDist * 0.15);
        const opacity = Math.max(0.6, 1 - normalizedDist * 0.25);
        const zIndex = itemCount - distFromCenter;
        
        html += `
            <button class="persona-arc-item ${isFav} ${isCurrent}"
                    data-key="${escapeHtml(persona.key)}"
                    data-name="${escapeHtml(displayName)}"
                    style="--x:${x}px; --y:${y}px; --scale:${scale}; --opacity:${opacity}; --z:${zIndex}; --size:${itemSize}px;">
                <img src="${avatarUrl}" alt=""
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <span class="persona-arc-fallback">👤</span>
                <span class="persona-arc-label">${escapeHtml(displayName)}</span>
            </button>
        `;
    });
    
    container.innerHTML = html;
    
    // SVG 인디케이터 업데이트
    updateIndicator(items.length, maxScroll);
    
    // 이벤트 바인딩
    container.querySelectorAll('.persona-arc-item').forEach(item => {
        item.addEventListener('click', handleItemClick);
        item.addEventListener('mouseenter', handleItemHover);
    });
    
    // 앞뒤 이미지 프리로딩
    preloadNearbyImages();
}

/**
 * 인디케이터 업데이트 - center-mode에 숫자 표시
 */
function updateIndicator(totalItems, maxScroll) {
    const centerMode = document.getElementById('persona-center-mode');
    if (!centerMode) return;
    
    const visibleCount = getVisibleCount();
    const modeText = state.mode === 'favorites' ? '⭐' : '👥';
    
    // 스크롤 가능한 경우에만 숫자 표시
    if (totalItems > visibleCount) {
        centerMode.textContent = `${modeText} ${state.selectedIndex + 1}/${totalItems}`;
    } else {
        centerMode.textContent = state.mode === 'favorites' ? '⭐ 즐겨찾기' : '👥 전체';
    }
}

// 현재 페르소나로 스크롤
function scrollToCurrentPersona() {
    const items = state.mode === 'favorites' ? state.favorites : state.allPersonas;
    const idx = items.findIndex(p => p.key === state.currentPersona);
    if (idx >= 0) {
        state.selectedIndex = Math.max(0, idx - Math.floor(getVisibleCount() / 2));
        renderItems();
    }
}

// 앞뒤 이미지 프리로딩 (DOM 안 건드림)
function preloadNearbyImages() {
    const items = state.mode === 'favorites' ? state.favorites : state.allPersonas;
    const start = Math.max(0, state.selectedIndex - 3);
    const end = Math.min(items.length, state.selectedIndex + getVisibleCount() + 3);
    
    for (let i = start; i < end; i++) {
        const img = new Image();
        img.src = `/User Avatars/${encodeURIComponent(items[i].key)}`;
    }
}

function updateMode() {
    const centerMode = document.getElementById('persona-center-mode');
    if (centerMode) centerMode.textContent = state.mode === 'favorites' ? '⭐ 즐겨찾기' : '👥 전체';
}

// ============================================
// 메뉴 열기/닫기
// ============================================

function openMenu() {
    const arc = document.getElementById('persona-menu-arc');
    const overlay = document.getElementById('persona-menu-overlay');
    const fab = document.getElementById('persona-fab');
    if (!arc || !fab) return;
    
    state.isOpen = true;
    state.selectedIndex = 0;
    
    // 현재 페르소나 근처로 스크롤
    const items = state.mode === 'favorites' ? state.favorites : state.allPersonas;
    const idx = items.findIndex(p => p.key === state.currentPersona);
    if (idx >= 0) {
        state.selectedIndex = Math.max(0, idx - Math.floor(getVisibleCount() / 2));
    }
    
    arc.classList.add('open');
    if (overlay) overlay.classList.add('open');
    fab.classList.add('open');
    
    renderItems();
    updateMode();
}

function closeMenu() {
    const arc = document.getElementById('persona-menu-arc');
    const overlay = document.getElementById('persona-menu-overlay');
    const fab = document.getElementById('persona-fab');
    if (!arc || !fab) return;
    
    state.isOpen = false;
    state.mode = 'favorites';
    state.selectedIndex = 0;
    
    arc.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    fab.classList.remove('open');
}

function toggleMode() {
    state.mode = state.mode === 'favorites' ? 'all' : 'favorites';
    state.selectedIndex = 0;
    renderItems();
    updateMode();
}

// ============================================
// 네비게이션
// ============================================

function scrollPrev() {
    if (state.selectedIndex > 0) {
        state.selectedIndex = Math.max(0, state.selectedIndex - CONFIG.SCROLL_STEP);
        scheduleRender();
        showIndicator();
    }
}

function scrollNext() {
    const items = state.mode === 'favorites' ? state.favorites : state.allPersonas;
    const maxScroll = Math.max(0, items.length - 1); // 끝까지 스크롤 가능
    if (state.selectedIndex < maxScroll) {
        state.selectedIndex = Math.min(maxScroll, state.selectedIndex + CONFIG.SCROLL_STEP);
        scheduleRender();
        showIndicator();
    }
}

// ============================================
// 이벤트 핸들러
// ============================================

function handleFabClick(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (!state.isOpen) {
        openMenu();
    } else if (state.mode === 'favorites') {
        toggleMode();
    } else {
        closeMenu();
    }
}

async function handleItemClick(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // 드래그 중이면 무시
    if (isDragging) return;
    
    const item = e.currentTarget;
    const key = item.dataset.key;
    
    if (!key) return;
    
    // 클릭 = 바로 적용
    await applyPersona(key);
}

function handleItemHover(e) {
    // 호버 시 중앙 표시 변경하지 않음 - 현재 선택된 페르소나만 표시
}

function updateCenterDisplay() {
    const centerName = document.getElementById('persona-center-name');
    const centerAvatar = document.getElementById('persona-center-avatar');
    const centerMode = document.getElementById('persona-center-mode');
    
    // 현재 선택된 페르소나 찾기
    const currentKey = state.currentPersona;
    const persona = state.allPersonas.find(p => p.key === currentKey);
    
    if (centerName) {
        if (persona) {
            const name = persona.name || persona.key.replace(/\.[^.]+$/, '');
            centerName.textContent = name;
        } else if (currentKey) {
            centerName.textContent = currentKey.replace(/\.[^.]+$/, '');
        } else {
            centerName.textContent = '페르소나 없음';
        }
    }
    if (centerAvatar) {
        if (currentKey) {
            centerAvatar.src = `/User Avatars/${encodeURIComponent(currentKey)}`;
            centerAvatar.style.display = 'block';
            centerAvatar.onerror = () => { centerAvatar.style.display = 'none'; };
        } else {
            centerAvatar.style.display = 'none';
        }
    }
    if (centerMode) {
        centerMode.textContent = state.mode === 'favorites' ? '⭐ 즐겨찾기' : '👥 전체';
    }
}

async function applyPersona(key) {
    try {
        await api.setPersona(key);
        showToast(`페르소나: ${key.replace(/\.[^.]+$/, '')}`, 'success');
        state.currentPersona = key;
        await updateFabAvatar();
        updateCenterDisplay();
        renderItems(); // 선택 표시 업데이트
        // closeMenu(); ← 메뉴 닫지 않음
    } catch (e) {
        showToast('페르소나 전환 실패', 'error');
    }
}

function handleOverlayClick(e) {
    // 드래그 안 했을 때만 닫기
    if (!touchMoved && !isDragging) {
        e.preventDefault();
        closeMenu();
    }
    touchMoved = false;
}

function handleKeydown(e) {
    if (!state.isOpen) return;
    
    switch (e.key) {
        case 'Escape':
            e.preventDefault();
            closeMenu();
            break;
        case 'ArrowUp':
        case 'ArrowLeft':
            e.preventDefault();
            scrollPrev();
            break;
        case 'ArrowDown':
        case 'ArrowRight':
            e.preventDefault();
            scrollNext();
            break;
    }
}

function handleWheel(e) {
    if (!state.isOpen) return;
    e.preventDefault();
    
    // 쿨다운 없이 바로 스크롤 (촤르륵)
    const direction = e.deltaY > 0 ? 1 : -1;
    const items = state.mode === 'favorites' ? state.favorites : state.allPersonas;
    const maxScroll = Math.max(0, items.length - 1);
    
    const newIndex = Math.max(0, Math.min(maxScroll, state.selectedIndex + direction));
    if (newIndex !== state.selectedIndex) {
        state.selectedIndex = newIndex;
        scheduleRender();
        showIndicator();
    }
}

// 터치 스와이프 (수평) - 관성 스크롤 포함
let touchStartX = 0;
let touchMoved = false;
let lastTouchX = 0;
let lastTouchTime = 0;
let touchVelocity = 0;
let momentumTimer = null;

function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX;
    lastTouchX = touchStartX;
    lastTouchTime = Date.now();
    touchMoved = false;
    touchVelocity = 0;
    
    // 관성 스크롤 중이면 중지
    if (momentumTimer) {
        cancelAnimationFrame(momentumTimer);
        momentumTimer = null;
    }
}

function handleTouchMove(e) {
    if (!state.isOpen) return;
    e.preventDefault();
    
    touchMoved = true;
    
    const currentX = e.touches[0].clientX;
    const currentTime = Date.now();
    const deltaX = lastTouchX - currentX;  // 왼쪽으로 드래그 = 양수
    const deltaTime = currentTime - lastTouchTime;
    
    // 속도 계산 (관성용) - 이동평균
    if (deltaTime > 0) {
        const instantVelocity = deltaX / deltaTime;
        touchVelocity = touchVelocity * 0.6 + instantVelocity * 0.4;
    }
    
    lastTouchX = currentX;
    lastTouchTime = currentTime;
    
    // 드래그 중 즉시 인덱스 이동 (감도 향상: 30px)
    const threshold = 30;
    const items = state.mode === 'favorites' ? state.favorites : state.allPersonas;
    const maxScroll = Math.max(0, items.length - 1);
    
    const accumulatedDelta = touchStartX - currentX;
    const steps = Math.floor(Math.abs(accumulatedDelta) / threshold);
    
    if (steps > 0) {
        const direction = accumulatedDelta > 0 ? 1 : -1;
        const targetIndex = Math.max(0, Math.min(maxScroll, state.selectedIndex + direction));
        
        if (targetIndex !== state.selectedIndex) {
            state.selectedIndex = targetIndex;
            scheduleRender();
        }
        
        // 시작점 재설정
        touchStartX = currentX;
    }
}

function handleTouchEnd(e) {
    if (!touchMoved) return;
    
    // 관성 스크롤 시작 (속도가 충분하면)
    if (Math.abs(touchVelocity) > 0.3) {
        startMomentumScroll();
    }
    
    touchMoved = false;
    touchVelocity = 0;
}

function startMomentumScroll() {
    const friction = 0.92;
    const minVelocity = 0.05;
    let velocity = touchVelocity;
    let accumulated = 0;
    
    function tick() {
        velocity *= friction;
        
        if (Math.abs(velocity) < minVelocity) {
            momentumTimer = null;
            return;
        }
        
        // 속도를 거리로 변환
        accumulated += velocity * 8;
        
        const items = state.mode === 'favorites' ? state.favorites : state.allPersonas;
        const maxScroll = Math.max(0, items.length - 1);
        const threshold = 30;
        
        if (Math.abs(accumulated) >= threshold) {
            const direction = accumulated > 0 ? 1 : -1;
            const newIndex = Math.max(0, Math.min(maxScroll, state.selectedIndex + direction));
            
            if (newIndex !== state.selectedIndex) {
                state.selectedIndex = newIndex;
                scheduleRender();
            } else {
                // 끝에 도달하면 멈춤
                momentumTimer = null;
                return;
            }
            
            accumulated = 0;
        }
        
        momentumTimer = requestAnimationFrame(tick);
    }
    
    momentumTimer = requestAnimationFrame(tick);
}

// PC 드래그 - 누적 드래그 방식
let pcAccumulatedDrag = 0;

function handleMouseDown(e) {
    if (!state.isOpen) return;
    if (e.target.closest('.persona-arc-item')) return; // 아이템 클릭은 무시
    
    isDragging = true;
    pcAccumulatedDrag = 0;
    dragStartX = e.clientX;
    e.preventDefault();
    
    // 드래그 시작할 때만 리스너 추가
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
}

function handleMouseMove(e) {
    if (!isDragging) return;
    
    const deltaX = dragStartX - e.clientX;
    dragStartX = e.clientX;
    pcAccumulatedDrag += deltaX;
    
    // 일정 거리 누적되면 인덱스 이동
    const threshold = CONFIG.ITEM_WIDTH;
    const items = state.mode === 'favorites' ? state.favorites : state.allPersonas;
    const maxScroll = Math.max(0, items.length - 1);
    
    if (Math.abs(pcAccumulatedDrag) >= threshold) {
        const direction = pcAccumulatedDrag > 0 ? 1 : -1;
        const newIndex = Math.max(0, Math.min(maxScroll, state.selectedIndex + direction));
        
        if (newIndex !== state.selectedIndex) {
            state.selectedIndex = newIndex;
            scheduleRender();
        }
        
        pcAccumulatedDrag = 0;
    }
}

function handleMouseUp() {
    if (isDragging) {
        isDragging = false;
        pcAccumulatedDrag = 0;
        
        // 드래그 끝나면 리스너 제거
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }
}

function bindEvents() {
    const fab = document.getElementById('persona-fab');
    const overlay = document.getElementById('persona-menu-overlay');
    const arc = document.getElementById('persona-menu-arc');
    const center = document.getElementById('persona-arc-center');
    const scrollBtn = document.getElementById('persona-scroll-to-current');
    
    if (fab) fab.addEventListener('click', handleFabClick);
    if (scrollBtn) scrollBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        scrollToCurrentPersona();
    });
    if (overlay) {
        overlay.addEventListener('click', handleOverlayClick);
        // 오버레이에서도 스크롤 가능하게!
        overlay.addEventListener('wheel', handleWheel, { passive: false });
        overlay.addEventListener('touchstart', handleTouchStart, { passive: true });
        overlay.addEventListener('touchmove', handleTouchMove, { passive: false });
        overlay.addEventListener('touchend', handleTouchEnd, { passive: true });
        overlay.addEventListener('mousedown', handleMouseDown);
    }
    if (center) center.addEventListener('click', handleCenterClick);
    
    if (arc) {
        // 휠 스크롤
        arc.addEventListener('wheel', handleWheel, { passive: false });
        
        // 터치 스와이프 (수평)
        arc.addEventListener('touchstart', handleTouchStart, { passive: true });
        arc.addEventListener('touchmove', handleTouchMove, { passive: false });
        arc.addEventListener('touchend', handleTouchEnd, { passive: true });
        
        // PC 드래그
        arc.addEventListener('mousedown', handleMouseDown);
    }
    
    // 글로벌 키보드 이벤트
    document.addEventListener('keydown', handleKeydown);
}

function handleCenterClick(e) {
    e.preventDefault();
    e.stopPropagation();
    toggleMode();
}

// ============================================
// 외부 API
// ============================================

export async function refreshPersonaRadialMenu() {
    await loadPersonas();
    await updateFabAvatar();
    if (state.isOpen) renderItems();
}

export function cleanupPersonaRadialMenu() {
    document.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    const container = document.getElementById('persona-radial-container');
    if (container) container.remove();
    state.isInitialized = false;
}

export function setFabVisibility(show) {
    const fab = document.getElementById('persona-fab');
    if (fab) fab.style.display = show ? 'flex' : 'none';
}
