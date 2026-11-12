// ============================================
// 페르소나 원형 메뉴 (Circular Menu)
// 네이버 스타일 중앙 원형 메뉴 + 스크롤 네비게이션
// ============================================

import { api } from '../api/sillyTavern.js';
import { cache } from '../data/cache.js';
import { storage } from '../data/storage.js';
import { showToast } from './notifications.js';
import { listeners } from '../utils/listenerManager.js';

// ============================================
// 상태 관리
// ============================================

const state = {
    isOpen: false,
    mode: 'favorites',      // 'favorites' | 'recent' | 'all'
    scrollIndex: 0,       // 현재 선택된 인덱스
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
    MOMENTUM_FRICTION: 0.88,    // 관성 감속 (0.85~0.88이 자연스러움)
    MOMENTUM_MULTIPLIER: 8,     // 속도-거리 변환 배수
};

// 이미지 프리로드 캐싱
const preloadedUrls = new Set();

// 현재 모드의 아이템 목록 반환
function getCurrentItems() {
    if (state.mode === 'favorites') return state.favorites;
    if (state.mode === 'recent') {
        const queue = storage.getPersonaRecentUsage();
        const orderMap = new Map(queue.map((k, i) => [k, i]));
        return [...state.allPersonas].sort((a, b) => {
            const ai = orderMap.get(a.key) ?? Infinity;
            const bi = orderMap.get(b.key) ?? Infinity;
            return ai - bi;
        });
    }
    return state.allPersonas;
}

// 최대 스크롤 인덱스 계산 (마지막에서 visibleCount만큼 보이게)
function getMaxScroll() {
    const items = getCurrentItems();
    return Math.max(0, items.length - getVisibleCount());
}

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
    // 재초기화 시 기존 리소스 정리 (이벤트 리스너 누수 방지)
    if (state.isInitialized) {
        cleanupPersonaRadialMenu();
    }
    
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
    console.debug('[PersonaMenu] Initialized');
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
 * 단일 반원 형태로 아이템 배치
 *
 * ★ 성능/디자인: 전체 innerHTML 재생성 대신 노드 풀(in-place) 갱신 방식.
 * - 스크롤 한 칸마다 DOM 파괴/재생성 + 리스너 재바인딩하던 비용 제거
 * - 기존 노드의 CSS 변수(--x/--y/--scale)만 바뀌므로
 *   CSS transition이 살아나 아이템이 부드럽게 미끄러짐
 * - 클릭은 컨테이너에 위임(bindEvents에서 1회 등록)
 */
function renderItems() {
    const container = document.getElementById('persona-arc-items');
    if (!container) return;

    // 모드별 아이템 결정 (헬퍼 함수 사용)
    let items = getCurrentItems();

    // 즐겨찾기 없으면 자동으로 최근 사용순 모드로 전환
    if (items.length === 0 && state.mode === 'favorites') {
        state.mode = 'recent';
        items = getCurrentItems();
        updateMode();
    }

    if (items.length === 0) {
        container.innerHTML = `<div class="persona-arc-empty">페르소나 없음</div>`;
        updateCenterDisplay();
        updateIndicator(0, 0);
        return;
    }

    // 빈 상태 표시가 남아있으면 제거 (노드 풀 시작점 정리)
    if (container.querySelector('.persona-arc-empty')) {
        container.innerHTML = '';
    }

    // 스크롤 인덱스 정규화 (마지막에서 visibleCount만큼 보이게)
    const maxScroll = getMaxScroll();
    state.scrollIndex = Math.min(Math.max(0, state.scrollIndex), maxScroll);

    // 보이는 아이템 계산
    const visibleCount_ = getVisibleCount();
    const visibleItems = items.slice(state.scrollIndex, state.scrollIndex + visibleCount_);

    // 중앙에는 항상 현재 선택된 페르소나 표시
    updateCenterDisplay();

    const radius = getRadius();
    const itemSize = getItemSize();
    const yRatio = getYRatio(); // 화면 폭에 따라 동적 계산
    const itemCount = visibleItems.length;

    // 사용 가능한 각도 범위 (패딩 고려)
    const paddingAngle = 0.15; // 양쪽 끝 패딩
    const usableAngle = Math.PI - paddingAngle * 2;

    // 노드 풀 크기 맞추기
    while (container.children.length > itemCount) {
        container.lastElementChild.remove();
    }
    while (container.children.length < itemCount) {
        const btn = document.createElement('button');
        btn.className = 'persona-arc-item';
        btn.innerHTML = `<img src="" alt="" draggable="false"><span class="persona-arc-fallback">👤</span><span class="persona-arc-label"></span>`;
        container.appendChild(btn);
    }

    visibleItems.forEach((persona, i) => {
        const btn = container.children[i];

        // 균등 배치 (양쪽 패딩 포함)
        const progress = itemCount > 1 ? i / (itemCount - 1) : 0.5;
        const angle = Math.PI - paddingAngle - progress * usableAngle;

        const x = Math.cos(angle) * radius;
        const y = -Math.sin(angle) * radius * yRatio;

        const displayName = persona.name || persona.key.replace(/\.[^.]+$/, '');

        // 중앙 거리 기반 스케일/투명도
        const distFromCenter = Math.abs(i - Math.floor(itemCount / 2));
        const maxDist = Math.floor(itemCount / 2);
        const normalizedDist = maxDist > 0 ? distFromCenter / maxDist : 0;
        const scale = Math.max(0.8, 1 - normalizedDist * 0.15);
        const opacity = Math.max(0.6, 1 - normalizedDist * 0.25);
        const zIndex = itemCount - distFromCenter;

        btn.dataset.key = persona.key;
        btn.dataset.name = displayName;
        btn.classList.toggle('is-fav', storage.isPersonaFavorite(persona.key));
        btn.classList.toggle('is-current', persona.key === state.currentPersona);
        btn.style.setProperty('--x', `${x}px`);
        btn.style.setProperty('--y', `${y}px`);
        btn.style.setProperty('--scale', String(scale));
        btn.style.setProperty('--opacity', String(opacity));
        btn.style.setProperty('--z', String(zIndex));
        btn.style.setProperty('--size', `${itemSize}px`);

        // 이미지는 src가 바뀔 때만 갱신 (불필요한 재로드 방지)
        const img = btn.querySelector('img');
        const fallback = btn.querySelector('.persona-arc-fallback');
        const newSrc = `/User Avatars/${encodeURIComponent(persona.key)}`;
        if (img.dataset.src !== newSrc) {
            img.dataset.src = newSrc;
            // 노드 재사용 시 이전 페르소나의 에러 상태 리셋
            img.style.display = '';
            if (fallback) fallback.style.display = '';
            img.src = newSrc;
        }

        const label = btn.querySelector('.persona-arc-label');
        if (label.textContent !== displayName) label.textContent = displayName;
    });

    // 인디케이터 업데이트
    updateIndicator(items.length, maxScroll);

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
    const modeText = state.mode === 'favorites' ? '⭐' : state.mode === 'recent' ? '🕐' : '👥';
    const modeLabel = state.mode === 'favorites' ? '즐겨찾기' : state.mode === 'recent' ? '최근 사용' : '전체';
    
    // 스크롤 가능한 경우에만 숫자 표시
    if (totalItems > visibleCount) {
        centerMode.textContent = `${modeText} ${state.scrollIndex + 1}/${totalItems}`;
    } else {
        centerMode.textContent = `${modeText} ${modeLabel}`;
    }
}

// 현재 페르소나로 스크롤
function scrollToCurrentPersona() {
    // ⚠️ getCurrentItems() 사용 - recent 모드의 정렬 순서를 반영해야
    // 올바른 인덱스로 스크롤됨 (이전에는 recent 모드에서 엉뚱한 위치로 이동)
    const items = getCurrentItems();
    const idx = items.findIndex(p => p.key === state.currentPersona);
    if (idx >= 0) {
        state.scrollIndex = Math.max(0, idx - Math.floor(getVisibleCount() / 2));
        renderItems();
    }
}

// 앞뒤 이미지 프리로딩 (이미 로드된 URL은 스킵)
function preloadNearbyImages() {
    const items = getCurrentItems();
    const start = Math.max(0, state.scrollIndex - 3);
    const end = Math.min(items.length, state.scrollIndex + getVisibleCount() + 3);
    
    for (let i = start; i < end; i++) {
        const url = `/User Avatars/${encodeURIComponent(items[i].key)}`;
        if (!preloadedUrls.has(url)) {
            preloadedUrls.add(url);
            new Image().src = url;
        }
    }
}

function updateMode() {
    const centerMode = document.getElementById('persona-center-mode');
    if (centerMode) {
        if (state.mode === 'favorites') {
            centerMode.textContent = '⭐ 즐겨찾기';
        } else if (state.mode === 'recent') {
            centerMode.textContent = '🕐 최근 사용';
        } else {
            centerMode.textContent = '👥 전체';
        }
    }
}

// ============================================
// 모드 전환 (통합)
// ============================================

function setMode(nextMode) {
    state.mode = nextMode;
    state.scrollIndex = 0;
    renderItems();
    updateMode();
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
    state.scrollIndex = 0;

    // 현재 페르소나 근처로 스크롤 (모드별 정렬 순서 반영)
    const items = getCurrentItems();
    const idx = items.findIndex(p => p.key === state.currentPersona);
    if (idx >= 0) {
        state.scrollIndex = Math.max(0, idx - Math.floor(getVisibleCount() / 2));
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
    state.scrollIndex = 0;
    
    arc.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    fab.classList.remove('open');
}

function toggleMode() {
    const next = state.mode === 'favorites' ? 'recent'
               : state.mode === 'recent' ? 'all'
               : 'favorites';
    setMode(next);
}

// ============================================
// 네비게이션
// ============================================

/**
 * 햅틱 피드백 (모바일) - 다이얼이 한 칸 이동할 때마다 짧은 진동
 */
function hapticTick() {
    try {
        if (navigator.vibrate) navigator.vibrate(5);
    } catch (e) { /* ignore */ }
}

/**
 * 스크롤 인덱스 변경 (공통 진입점) - 변경 시 렌더 + 햅틱
 * @param {number} newIndex
 * @returns {boolean} - 실제로 변경됐는지
 */
function setScrollIndex(newIndex) {
    const maxScroll = getMaxScroll();
    const clamped = Math.max(0, Math.min(maxScroll, newIndex));
    if (clamped === state.scrollIndex) return false;
    state.scrollIndex = clamped;
    scheduleRender();
    hapticTick();
    return true;
}

function scrollPrev() {
    setScrollIndex(state.scrollIndex - CONFIG.SCROLL_STEP);
}

function scrollNext() {
    setScrollIndex(state.scrollIndex + CONFIG.SCROLL_STEP);
}

// ============================================
// 이벤트 핸들러
// ============================================

/**
 * FAB = 열기/닫기 토글 (모드 순환은 중앙 버튼의 역할)
 * 이전에는 FAB 재클릭이 모드를 순환시켜 "다시 누르면 닫힐 것"이라는
 * 일반적인 기대와 어긋났음
 */
function handleFabClick(e) {
    e.preventDefault();
    e.stopPropagation();

    if (state.isOpen) {
        closeMenu();
    } else {
        openMenu();
    }
}

/**
 * 아이템 클릭 (컨테이너 위임)
 */
async function handleItemsContainerClick(e) {
    const item = e.target.closest('.persona-arc-item');
    if (!item) return;

    e.preventDefault();
    e.stopPropagation();

    // 드래그 중이면 무시
    if (isDragging) return;

    const key = item.dataset.key;
    if (!key) return;

    // 클릭 = 바로 적용
    await applyPersona(key);
}

/**
 * 아이템 이미지 로드 실패 폴백 (capture 단계 위임)
 */
function handleItemsContainerError(e) {
    const img = e.target;
    if (img?.tagName !== 'IMG') return;
    img.style.display = 'none';
    const fallback = img.nextElementSibling;
    if (fallback) fallback.style.display = 'flex';
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
        if (state.mode === 'favorites') {
            centerMode.textContent = '⭐ 즐겨찾기';
        } else if (state.mode === 'recent') {
            centerMode.textContent = '🕐 최근 사용';
        } else {
            centerMode.textContent = '👥 전체';
        }
    }
}

async function applyPersona(key) {
    try {
        await api.setPersona(key);
        
        // 사용 기록 저장 (최근 사용순 정렬용)
        storage.recordPersonaUsage(key);
        
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
    setScrollIndex(state.scrollIndex + direction);
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

    const accumulatedDelta = touchStartX - currentX;
    const steps = Math.floor(Math.abs(accumulatedDelta) / threshold);

    // steps만큼 한번에 이동 (빠른 스와이프 대응)
    if (steps > 0) {
        const direction = accumulatedDelta > 0 ? 1 : -1;
        setScrollIndex(state.scrollIndex + direction * steps);

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
    
    // click 이벤트보다 늦게 리셋해야 오버레이가 닫히지 않음
    setTimeout(() => { touchMoved = false; }, 50);
    touchVelocity = 0;
}

function startMomentumScroll() {
    const friction = CONFIG.MOMENTUM_FRICTION;
    const minVelocity = 0.05;
    let velocity = touchVelocity;
    let accumulated = 0;
    
    function tick() {
        velocity *= friction;
        
        if (Math.abs(velocity) < minVelocity) {
            momentumTimer = null;
            return;
        }
        
        // 속도를 거리로 변환 (CONFIG 상수 사용)
        accumulated += velocity * CONFIG.MOMENTUM_MULTIPLIER;
        
        const maxScroll = getMaxScroll();
        const threshold = 30;
        
        if (Math.abs(accumulated) >= threshold) {
            const direction = accumulated > 0 ? 1 : -1;
            const moved = setScrollIndex(state.scrollIndex + direction);

            if (!moved) {
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

    if (Math.abs(pcAccumulatedDrag) >= threshold) {
        const direction = pcAccumulatedDrag > 0 ? 1 : -1;
        setScrollIndex(state.scrollIndex + direction);
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
    const itemsContainer = document.getElementById('persona-arc-items');

    // ★ 전부 'radialMenu' 그룹으로 등록 → cleanup에서 한 번에 해제
    const G = 'radialMenu';

    listeners.add(G, fab, 'click', handleFabClick);

    // 아이템 클릭/이미지 에러는 컨테이너 위임 (노드 풀 갱신 방식과 호환)
    listeners.add(G, itemsContainer, 'click', handleItemsContainerClick);
    listeners.add(G, itemsContainer, 'error', handleItemsContainerError, true);

    listeners.add(G, scrollBtn, 'click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        scrollToCurrentPersona();
    });

    if (overlay) {
        listeners.add(G, overlay, 'click', handleOverlayClick);
        // 오버레이에서도 스크롤 가능하게!
        listeners.add(G, overlay, 'wheel', handleWheel, { passive: false });
        listeners.add(G, overlay, 'touchstart', handleTouchStart, { passive: true });
        listeners.add(G, overlay, 'touchmove', handleTouchMove, { passive: false });
        listeners.add(G, overlay, 'touchend', handleTouchEnd, { passive: true });
        listeners.add(G, overlay, 'mousedown', handleMouseDown);
    }

    listeners.add(G, center, 'click', handleCenterClick);

    if (arc) {
        // 휠 스크롤
        listeners.add(G, arc, 'wheel', handleWheel, { passive: false });

        // 터치 스와이프 (수평)
        listeners.add(G, arc, 'touchstart', handleTouchStart, { passive: true });
        listeners.add(G, arc, 'touchmove', handleTouchMove, { passive: false });
        listeners.add(G, arc, 'touchend', handleTouchEnd, { passive: true });

        // PC 드래그
        listeners.add(G, arc, 'mousedown', handleMouseDown);
    }

    // 글로벌 키보드 이벤트
    listeners.add(G, document, 'keydown', handleKeydown);

    // blur 시 드래그 리스너 정리 (탭 전환 등에서 mouseup 누락 방지)
    listeners.add(G, window, 'blur', handleWindowBlur);
}

// 창 포커스 해제 시 드래그 상태 정리
function handleWindowBlur() {
    if (isDragging) {
        isDragging = false;
        pcAccumulatedDrag = 0;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }
    // 관성 스크롤도 정지
    if (momentumTimer) {
        cancelAnimationFrame(momentumTimer);
        momentumTimer = null;
    }
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
    // 그룹 일괄 해제 (bindEvents에서 등록한 전체)
    listeners.clear('radialMenu');

    // 드래그 중 동적으로 추가된 transient 리스너 정리
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    isDragging = false;

    // 관성 스크롤 정지
    if (momentumTimer) {
        cancelAnimationFrame(momentumTimer);
        momentumTimer = null;
    }

    // 프리로드 캐시 정리
    preloadedUrls.clear();

    const container = document.getElementById('persona-radial-container');
    if (container) container.remove();
    state.isInitialized = false;
}

