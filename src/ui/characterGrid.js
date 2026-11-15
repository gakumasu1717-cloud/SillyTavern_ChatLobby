// ============================================
// 캐릭터 그리드 UI
// ============================================

import { api } from '../api/sillyTavern.js';
import { cache } from '../data/cache.js';
import { storage } from '../data/storage.js';
import { store } from '../data/store.js';
import { lastChatCache } from '../data/lastChatCache.js';
import { saveSnapshot, getLocalDateString, loadSnapshots } from '../data/calendarStorage.js';
import { escapeHtml } from '../utils/textUtils.js';
import { bindDelegatedTouchClick, debounce } from '../utils/eventHelpers.js';
import { showToast } from './notifications.js';
import { closeChatPanel } from './chatList.js';
import { CONFIG } from '../config.js';
import { uiPrefs } from '../data/uiPrefs.js';
import { charAvatarUrl } from '../utils/avatarUrl.js';

// 렌더링 중복 방지
let isRendering = false;
let pendingRender = null;
let renderDebounceTimer = null;
// ⚠️ 디바운스로 취소된 호출의 Promise도 반드시 resolve해야 함
// (안 하면 renderCharacterGrid를 await하는 쪽 - 예: openLobby - 이 영원히 멈춤)
let pendingRenderResolvers = [];

// 캐릭터 선택 중복 방지 (전역)
let isSelectingCharacter = false;

// 점진 렌더 세대 카운터 (재렌더 시 이전 청크 작업 무효화)
let renderGeneration = 0;

// 점진 렌더 설정: 첫 화면은 즉시, 나머지는 rAF 청크로
const INITIAL_RENDER_COUNT = 40;
const RENDER_CHUNK_SIZE = 60;

/**
 * 캐릭터 선택 플래그 리셋 (로비 열 때 호출)
 */
export function resetCharacterSelectLock() {
    isSelectingCharacter = false;
}

// ============================================
// 초기화
// ============================================

/**
 * 캐릭터 선택 핸들러 설정
 * @param {Function} handler - 캐릭터 선택 시 호출되는 콜백
 */
export function setCharacterSelectHandler(handler) {
    store.setCharacterSelectHandler(handler);
}

/**
 * 그룹 선택 핸들러 설정
 * @param {Function} handler - 그룹 선택 시 호출되는 콜백
 */
export function setGroupSelectHandler(handler) {
    store.setGroupSelectHandler(handler);
}

// ============================================
// 캐릭터 그리드 렌더링
// ============================================

/**
 * 캐릭터 그리드 렌더링
 * context.characters를 직접 사용 (항상 최신 데이터)
 * @param {string} [searchTerm=''] - 검색어
 * @param {string|null} [sortOverride=null] - 정렬 옵션 오버라이드
 * @returns {Promise<void>}
 */
export function renderCharacterGrid(searchTerm = '', sortOverride = null) {
    // Debounce: 100ms 내 중복 호출은 마지막 것만 실행
    if (renderDebounceTimer) {
        clearTimeout(renderDebounceTimer);
    }

    return new Promise((resolve) => {
        // 취소되더라도 마지막 실행 완료 시 함께 resolve되도록 누적
        pendingRenderResolvers.push(resolve);

        renderDebounceTimer = setTimeout(async () => {
            renderDebounceTimer = null;
            const resolvers = pendingRenderResolvers;
            pendingRenderResolvers = [];
            try {
                await _doRenderCharacterGrid(searchTerm, sortOverride);
            } finally {
                resolvers.forEach(r => r());
            }
        }, 100);
    });
}

/**
 * 실제 캐릭터 그리드 렌더링 (debounce 후 호출)
 */
async function _doRenderCharacterGrid(searchTerm = '', sortOverride = null) {
    // 렌더링 중복 방지
    if (isRendering) {
        pendingRender = { searchTerm, sortOverride };
        return;
    }
    
    isRendering = true;
    // 락은 openLobby/캐릭터클릭에서 관리 (여기서 설정 안 함)
    
    try {
        const container = document.getElementById('chat-lobby-characters');
        if (!container) return;
        
        // 검색어 저장
        store.setSearchTerm(searchTerm);
        
        // context에서 직접 캐릭터 가져오기 (항상 최신)
        const characters = api.getCharacters();
        
        if (characters.length === 0) {
            container.innerHTML = `
                <div class="lobby-empty-state">
                    <i>👥</i>
                    <div>캐릭터가 없습니다</div>
                    <button onclick="window.chatLobbyRefresh()" style="margin-top:10px;padding:8px 16px;cursor:pointer;">새로고침</button>
                </div>
            `;
            return;
        }
        
        await renderCharacterList(container, characters, searchTerm, sortOverride);
    } finally {
        isRendering = false;
        // 락 해제는 openLobby/캐릭터클릭에서 관리
        
        // 대기 중인 렌더 있으면 실행
        if (pendingRender) {
            const { searchTerm: s, sortOverride: o } = pendingRender;
            pendingRender = null;
            renderCharacterGrid(s, o);
        }
    }
}

/**
 * 캐릭터 목록 렌더링 (내부) - 그룹 포함
 * @param {HTMLElement} container - 컨테이너 요소
 * @param {Array} characters - 캐릭터 배열
 * @param {string} searchTerm - 검색어
 * @param {string|null} sortOverride - 정렬 오버라이드
 * @returns {Promise<void>}
 */
async function renderCharacterList(container, characters, searchTerm, sortOverride) {
    let filtered = [...characters];

    // 검색 필터
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(char =>
            (char.name || '').toLowerCase().includes(term)
        );
    }

    // 태그 필터 (AND 조건 - 검색과 함께 적용)
    const selectedTag = store.selectedTag;
    if (selectedTag) {
        filtered = filtered.filter(char => {
            const charTags = getCharacterTags(char);
            return charTags.includes(selectedTag);
        });
    }

    // 태그바 렌더링 (필터 전 전체 캐릭터 기준으로 집계)
    renderTagBar(characters);

    // 최애 코너 렌더링 (필터 전 전체 캐릭터 기준)
    renderHeroCorner(characters);

    // 정렬 옵션
    const sortOption = sortOverride || storage.getCharSortOption();

    // 드롭다운 동기화
    const sortSelect = document.getElementById('chat-lobby-char-sort');
    if (sortSelect && sortSelect.value !== sortOption) {
        sortSelect.value = sortOption;
    }

    // 그룹 가져오기 (검색 필터 적용)
    let groups = [];
    try {
        groups = await api.getGroups();

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            groups = groups.filter(g => (g.name || '').toLowerCase().includes(term));
        }
        // 태그 필터가 있으면 그룹은 제외 (그룹은 태그 없음)
        if (selectedTag) {
            groups = [];
        }
    } catch (e) {
        console.warn('[CharacterGrid] Failed to load groups:', e);
    }

    if (filtered.length === 0 && groups.length === 0) {
        renderGeneration++; // 진행 중인 청크 렌더 무효화
        container.innerHTML = `
            <div class="lobby-empty-state">
                <i>🔍</i>
                <div>검색 결과가 없습니다</div>
            </div>
        `;
        return;
    }

    // 원본 인덱스 보존 (context.characters 기준) - avatar로 O(1) 룩업
    const originalCharacters = api.getCharacters();
    const indexMap = new Map(originalCharacters.map((c, i) => [c.avatar, i]));

    // ★ 캐릭터와 그룹을 통합 배열로 만들어서 함께 정렬
    const allItems = [
        ...filtered.map(char => ({ type: 'character', data: char })),
        ...groups.map(group => ({ type: 'group', data: group }))
    ];

    // 통합 정렬
    const sortedItems = await sortCharactersAndGroups(allItems, sortOption);

    const showBadges = uiPrefs.get('personaBadges');
    const renderItem = (item) => item.type === 'character'
        ? renderCharacterCard(item.data, indexMap.get(item.data.avatar), sortOption, showBadges)
        : renderGroupCard(item.data, sortOption);

    // ★ 점진(청크) 렌더링 - 카드가 많으면 첫 화면만 즉시 그리고
    // 나머지는 rAF 청크로 추가 (모바일 첫 렌더 블로킹 방지)
    // 이벤트는 컨테이너 위임이라 청크 추가 시 재바인딩 불필요
    const gen = ++renderGeneration;

    if (sortedItems.length <= INITIAL_RENDER_COUNT + 20) {
        container.innerHTML = sortedItems.map(renderItem).join('');
        loadChatCountsAsync(filtered, sortOption);
    } else {
        container.innerHTML = sortedItems.slice(0, INITIAL_RENDER_COUNT).map(renderItem).join('');
        // 첫 화면 카드부터 바로 채팅 수 로딩 시작 (청크 렌더 완료를 기다리지 않음)
        loadChatCountsAsync(filtered, sortOption);
        let offset = INITIAL_RENDER_COUNT;

        const appendChunk = () => {
            // 그 사이 다른 렌더가 시작됐으면 중단 (stale 청크 방지)
            if (gen !== renderGeneration) return;

            const chunk = sortedItems.slice(offset, offset + RENDER_CHUNK_SIZE);
            container.insertAdjacentHTML('beforeend', chunk.map(renderItem).join(''));
            offset += RENDER_CHUNK_SIZE;
            observeNewCards(container);

            if (offset < sortedItems.length) {
                requestAnimationFrame(appendChunk);
            }
        };
        requestAnimationFrame(appendChunk);
    }

    // 이벤트 위임 바인딩 (컨테이너에 1회만 - 재렌더와 무관하게 유지)
    ensureGridDelegation();
}

// ============================================
// 최애 코너 (즐겨찾기 히어로 배너)
// ============================================

/**
 * 최애 코너 렌더링
 * 즐겨찾기 캐릭터를 캐릭터 탭 상단에 큰 배너 카드로 표시
 * 테마 메뉴의 "최애 코너" 옵션으로 온오프
 * @param {Array} characters - 전체 캐릭터 배열
 */
function renderHeroCorner(characters) {
    const hero = document.getElementById('chat-lobby-hero');
    if (!hero) return;

    const enabled = uiPrefs.get('showHero');
    const filterActive = !!store.searchTerm || !!store.selectedTag;

    if (!enabled || filterActive) {
        hero.style.display = 'none';
        hero.dataset.hasContent = 'false';
        return;
    }

    const favAvatars = storage.getCharacterFavorites();
    const favChars = favAvatars
        .map(avatar => characters.find(c => c.avatar === avatar))
        .filter(Boolean)
        .slice(0, 10);

    if (favChars.length === 0) {
        hero.style.display = 'none';
        hero.dataset.hasContent = 'false';
        return;
    }

    const indexMap = new Map(characters.map((c, i) => [c.avatar, i]));

    hero.innerHTML = `
        <div class="hero-title">⭐ 최애 코너</div>
        <div class="hero-list">
            ${favChars.map(char => {
                const avatarUrl = charAvatarUrl(char.avatar);
                const chatCount = cache.get('chatCounts', char.avatar);
                const metaText = typeof chatCount === 'number' && chatCount > 0 ? `💬 ${chatCount}개 채팅` : '';
                return `
                <div class="lobby-hero-card"
                     data-char-index="${indexMap.get(char.avatar)}"
                     data-char-avatar="${escapeHtml(char.avatar)}"
                     data-char-name="${escapeHtml(char.name || '')}">
                    <img src="${avatarUrl}" alt="" loading="lazy" decoding="async" draggable="false"
                         onerror="this.src='/img/ai4.png'">
                    <div class="hero-overlay">
                        <span class="hero-name">${escapeHtml(char.name || '')}</span>
                        ${metaText ? `<span class="hero-meta">${metaText}</span>` : ''}
                    </div>
                </div>`;
            }).join('')}
        </div>
    `;
    hero.style.display = '';
    hero.dataset.hasContent = 'true';

    // 위임 바인딩 (1회)
    ensureHeroDelegation();
}

/**
 * 캐릭터 카드 HTML 생성 - 넷플릭스 스타일 + 호버 정보
 * @param {Object} char - 캐릭터 객체
 * @param {number} index - 원본 인덱스
 * @param {string} sortOption - 정렬 옵션
 * @param {boolean} [showBadges=true] - 마지막 페르소나 배지 표시 여부
 * @returns {string}
 */
function renderCharacterCard(char, index, sortOption = 'recent', showBadges = true) {
    const avatarUrl = char.avatar ? charAvatarUrl(char.avatar) : '/img/ai4.png';
    const name = char.name || 'Unknown';
    const safeAvatar = escapeHtml(char.avatar || '');

    const isFav = isFavoriteChar(char);

    // 마지막 사용 페르소나 배지 (표시 옵션 + 기록 있을 때만)
    let personaBadge = '';
    if (showBadges) {
        const lastPersona = lastChatCache.getPersona(char.avatar);
        if (lastPersona) {
            const personaName = lastPersona.replace(/\.[^.]+$/, '');
            personaBadge = `<img class="char-persona-badge"
                src="/User Avatars/${encodeURIComponent(lastPersona)}"
                alt="" loading="lazy" decoding="async" draggable="false"
                title="마지막 페르소나: ${escapeHtml(personaName)}"
                onerror="this.remove()">`;
        }
    }
    
    // 최근 채팅순 정렬 + 오늘 날짜인 경우에만 시간 표시
    let lastChatTimeStr = '';
    if (sortOption === 'recent') {
        const lastChatTime = lastChatCache.getForSort(char);
        if (lastChatTime > 0) {
            const now = new Date();
            const lastDate = new Date(lastChatTime);
            const isToday = now.toDateString() === lastDate.toDateString();
            
            if (isToday) {
                const hours = lastDate.getHours();
                const minutes = String(lastDate.getMinutes()).padStart(2, '0');
                lastChatTimeStr = `${hours}:${minutes}`;
            }
        }
    }
    
    // 채팅 수 (캐시에서 가져오기, 없으면 API 응답 필드 사용)
    const cachedChatCount = cache.get('chatCounts', char.avatar);
    // 메시지 수 (chat_items 합계)
    const cachedMessageCount = cache.get('messageCounts', char.avatar);
    
    // null/undefined가 아닌 숫자인지 확인
    const hasCount = typeof cachedChatCount === 'number';
    const hasMessageCount = typeof cachedMessageCount === 'number';
    
    const chatCountText = hasCount 
        ? (cachedChatCount > 0 ? `${cachedChatCount}개 채팅` : '채팅 없음')
        : '로딩 중...';
    const messageCountText = hasMessageCount
        ? (cachedMessageCount > 0 ? `${cachedMessageCount}개 메시지` : '')
        : '';
    
    // 즐겨찾기 버튼
    const favBtn = `<button class="char-fav-btn" data-char-avatar="${safeAvatar}" title="즐겨찾기 토글">${isFav ? '★' : '☆'}</button>`;
    
    return `
    <div class="lobby-char-card ${isFav ? 'is-char-fav' : ''}" 
         data-char-index="${index}" 
         data-char-avatar="${safeAvatar}" 
         data-char-name="${escapeHtml(name)}"
         data-is-fav="${isFav}"
         draggable="false">
        ${favBtn}
        ${personaBadge}
        <img class="lobby-char-avatar"
             src="${avatarUrl}"
             alt="${escapeHtml(name)}"
             loading="lazy"
             decoding="async"
             draggable="false"
             onerror="this.src='/img/ai4.png'">
        <div class="lobby-char-name">
            <span class="char-name-text">${escapeHtml(name)}${lastChatTimeStr ? ` <span class="char-last-time">${lastChatTimeStr}</span>` : ''}</span>
            <div class="char-hover-info">
                <div class="info-row">
                    <span class="info-icon">💬</span>
                    <span class="info-value chat-count-value">${chatCountText}</span>
                </div>
                ${messageCountText ? `
                <div class="info-row">
                    <span class="info-icon">📝</span>
                    <span class="info-value message-count-value">${messageCountText}</span>
                </div>
                ` : ''}
            </div>
        </div>
    </div>
    `;
}

// ============================================
// 채팅 수 지연 로딩
// ★ 예전엔 그리드를 그릴 때마다 "모든 캐릭터"의 채팅 목록(무거운 API)을 5개씩 요청했음
//   (캐릭터가 많으면 로비 열 때마다 수십~수백 개 요청 → 들낙이 느린 주원인)
//   이제 화면에 보이는(또는 곧 보일) 카드만 요청한다.
// ============================================

const COUNT_CONCURRENCY = 3;
let countObserver = null;
/** @type {string[]} */
let countQueue = [];
const countQueued = new Set();
let countActive = 0;
let countSortOption = 'recent';
let snapshotTimer = null;

/**
 * 카드가 보이면 채팅 수를 불러오도록 등록
 * @param {Array} characters - 렌더된 캐릭터 배열
 * @param {string} sortOption - 정렬 옵션
 */
function loadChatCountsAsync(characters, sortOption = 'recent') {
    countSortOption = sortOption;
    const container = document.getElementById('chat-lobby-characters');
    if (!container) return;

    // 구형 브라우저: 예전처럼 전체 순차 로딩
    if (typeof IntersectionObserver === 'undefined') {
        characters.forEach(char => enqueueChatCount(char.avatar));
        return;
    }

    if (countObserver) countObserver.disconnect();
    // 대기열은 새 렌더 기준으로 다시 만듦 (진행 중인 요청은 그대로 끝까지)
    countQueue = [];
    countQueued.clear();

    // root: null(뷰포트) → 어떤 조상이 스크롤하든 실제로 보이는지 기준으로 판단
    countObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            countObserver?.unobserve(entry.target);
            enqueueChatCount(entry.target.dataset.charAvatar);
        }
    }, { root: null, rootMargin: '400px 0px' });

    container.querySelectorAll('.lobby-char-card[data-char-avatar]').forEach(card => {
        card.dataset.countObserved = '1';
        if (typeof cache.get('chatCounts', card.dataset.charAvatar) === 'number') return;
        countObserver.observe(card);
    });
}

/**
 * 청크 렌더로 나중에 추가된 카드도 관찰 대상에 추가
 * @param {HTMLElement} container
 */
function observeNewCards(container) {
    if (!countObserver) return;
    container.querySelectorAll('.lobby-char-card[data-char-avatar]:not([data-count-observed])').forEach(card => {
        card.dataset.countObserved = '1';
        if (typeof cache.get('chatCounts', card.dataset.charAvatar) === 'number') return;
        countObserver.observe(card);
    });
}

function enqueueChatCount(avatar) {
    if (!avatar || countQueued.has(avatar)) return;
    if (typeof cache.get('chatCounts', avatar) === 'number') return;
    countQueued.add(avatar);
    countQueue.push(avatar);
    pumpChatCounts();
}

function pumpChatCounts() {
    while (countActive < COUNT_CONCURRENCY && countQueue.length > 0) {
        const avatar = countQueue.shift();
        countActive++;
        loadOneChatCount(avatar)
            .catch(e => console.error('[CharacterGrid] Failed to load chat count:', avatar, e))
            .finally(() => {
                countActive--;
                countQueued.delete(avatar);
                if (countQueue.length > 0) {
                    pumpChatCounts();
                } else if (countActive === 0) {
                    scheduleSnapshot();
                }
            });
    }
}

/**
 * 대기열이 비면 오늘 스냅샷 저장 (연달아 스크롤할 때 여러 번 저장하지 않도록 디바운스)
 */
function scheduleSnapshot() {
    if (snapshotTimer) clearTimeout(snapshotTimer);
    snapshotTimer = setTimeout(() => {
        snapshotTimer = null;
        saveTodaySnapshotFromCache();
    }, 1500);
}

/**
 * 캐릭터 하나의 채팅 수를 불러와 카드에 반영
 * @param {string} avatar
 */
async function loadOneChatCount(avatar) {
    const chats = await api.fetchChatsForCharacter(avatar);
    const chatArray = Array.isArray(chats) ? chats : (typeof chats === 'object' && chats ? Object.values(chats) : []);
    const count = chatArray.length;
    const messageCount = chatArray.reduce((sum, chat) => sum + (chat.chat_items || 0), 0);

    cache.set('chatCounts', count, avatar);
    cache.set('messageCounts', messageCount, avatar);

    // ★ lastChatCache에도 마지막 채팅 시간 갱신 (재접속 정렬 정확도 향상)
    if (chatArray.length > 0) {
        await lastChatCache.refreshForCharacter(avatar, chatArray);
    }

    const card = document.querySelector(`.lobby-char-card[data-char-avatar="${CSS.escape(avatar)}"]`);
    if (!card) return;

    // 최근 채팅순 정렬 + 오늘 날짜인 경우에만 시간 표시
    if (countSortOption === 'recent' && chatArray.length > 0) {
        const lastTime = lastChatCache.get(avatar);
        if (lastTime > 0) {
            const lastDate = new Date(lastTime);
            if (new Date().toDateString() === lastDate.toDateString()) {
                const nameTextEl = card.querySelector('.char-name-text');
                if (nameTextEl && !nameTextEl.querySelector('.char-last-time')) {
                    const timeSpan = document.createElement('span');
                    timeSpan.className = 'char-last-time';
                    timeSpan.textContent = ` ${lastDate.getHours()}:${String(lastDate.getMinutes()).padStart(2, '0')}`;
                    nameTextEl.appendChild(timeSpan);
                }
            }
        }
    }

    const chatValueEl = card.querySelector('.chat-count-value');
    if (chatValueEl) {
        chatValueEl.textContent = count > 0 ? `${count}개 채팅` : '채팅 없음';
    }

    // 메시지 수 업데이트 (요소가 없으면 추가)
    const hoverInfo = card.querySelector('.char-hover-info');
    if (hoverInfo && messageCount > 0) {
        const messageRow = hoverInfo.querySelector('.message-count-value');
        if (!messageRow) {
            const newRow = document.createElement('div');
            newRow.className = 'info-row';
            newRow.innerHTML = `
                <span class="info-icon">📝</span>
                <span class="info-value message-count-value">${messageCount}개 메시지</span>
            `;
            hoverInfo.appendChild(newRow);
        } else {
            messageRow.textContent = `${messageCount}개 메시지`;
        }
    }
}

/**
 * 🔥 캐시에서 오늘 스냅샷 저장 (필요시 API fallback)
 * loadChatCountsAsync 완료 후 호출됨
 */
async function saveTodaySnapshotFromCache() {
    try {
        const today = getLocalDateString();
        const characters = api.getCharacters();
        
        if (!characters || characters.length === 0) return;
        
        // 최근 스냅샷 (오늘 것 / 오늘 이전 최근 7일 중 가장 최근 것)
        const snapshots = loadSnapshots();
        const todaySnapshot = snapshots[today] || null;
        let recentSnapshot = null;
        const checkDate = new Date();
        for (let i = 0; i < 7; i++) {
            checkDate.setDate(checkDate.getDate() - 1);
            const dateStr = getLocalDateString(checkDate);
            if (snapshots[dateStr]) {
                recentSnapshot = snapshots[dateStr];
                break;
            }
        }

        // 캐시에서 데이터 수집
        // ★ 채팅 수는 이제 화면에 보인 카드만 불러오므로 일부 캐릭터는 값이 없을 수 있음
        //   → 그런 캐릭터는 오늘/최근 스냅샷의 값을 그대로 써서 합계가 줄어들지 않게 함
        const byChar = {};
        let totalMessages = 0;
        
        characters.forEach(char => {
            let msgCount = cache.get('messageCounts', char.avatar);
            if (typeof msgCount !== 'number') {
                msgCount = todaySnapshot?.byChar?.[char.avatar]
                    ?? recentSnapshot?.byChar?.[char.avatar]
                    ?? 0;
            }
            if (msgCount > 0) {
                byChar[char.avatar] = msgCount;
                totalMessages += msgCount;
            }
        });
        
        // lastChatTimes - 오늘 날짜만
        const lastChatTimes = {};
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayStartMs = todayStart.getTime();

        // ⚠️ 네트워크 호출 금지 - 이전 구현은 캐시 미스 캐릭터 전부에 대해
        // 무제한 병렬 API 호출을 날려 로비 열기 직후 요청 폭주를 일으켰음.
        // 스냅샷은 메모리에 있는 데이터만으로 계산 (없는 캐릭터는 다음 기회에 채워짐)
        for (const char of characters) {
            let lastTime = lastChatCache.get(char.avatar);

            // 캐시 미스면 이미 받아둔 채팅 목록에서만 추출 (네트워크 X)
            if (lastTime === 0) {
                const cachedChats = cache.get('chats', char.avatar);
                if (Array.isArray(cachedChats) && cachedChats.length > 0) {
                    lastTime = lastChatCache.extractLastTime(cachedChats);
                    if (lastTime > 0) lastChatCache.set(char.avatar, lastTime);
                }
            }

            if (lastTime >= todayStartMs) {
                lastChatTimes[char.avatar] = lastTime;
            }
        }
        
        // 가장 증가한 캐릭터 찾기 (이전 스냅샷과 비교)
        let topChar = '';
        let maxIncrease = -Infinity;
        
        const baseByChar = recentSnapshot?.byChar || {};
        
        for (const [avatar, msgCount] of Object.entries(byChar)) {
            const prev = baseByChar[avatar] || 0;
            const increase = msgCount - prev;
            if (increase > maxIncrease) {
                maxIncrease = increase;
                topChar = avatar;
            }
        }
        
        // 기준 없으면 메시지 1위
        if (!topChar) {
            const sorted = Object.entries(byChar).sort((a, b) => b[1] - a[1]);
            topChar = sorted[0]?.[0] || '';
        }
        
        saveSnapshot(today, totalMessages, topChar, byChar, lastChatTimes);
        console.debug('[CharacterGrid] Snapshot saved from cache');
        
    } catch (e) {
        console.error('[CharacterGrid] Failed to save snapshot:', e);
    }
}

/**
 * 캐릭터가 즐겨찾기인지 확인 (로컬 스토리지 기준)
 * @param {Object} char - 캐릭터 객체
 * @returns {boolean}
 */
function isFavoriteChar(char) {
    // 로컬 스토리지에서 확인 (SillyTavern API 안 쓰는 독립 방식)
    return storage.isCharacterFavorite(char.avatar);
}

/**
 * 캐릭터와 그룹 통합 정렬
 * @param {Array} items - { type: 'character' | 'group', data: object }[]
 * @param {string} sortOption - 정렬 옵션 ('recent', 'name', 'chats')
 * @returns {Promise<Array>}
 */
async function sortCharactersAndGroups(items, sortOption) {
    
    if (sortOption === 'chats') {
        // 메시지 수 정렬 - 캐릭터는 메시지 수, 그룹은 채팅 수로
        const BATCH_SIZE = 5;
        const results = [];
        
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            const batch = items.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.all(
                batch.map(async (item) => {
                    if (item.type === 'group') {
                        // 그룹은 채팅 수 사용 + 즐겨찾기 지원
                        const chatCount = Array.isArray(item.data.chats) ? item.data.chats.length : 0;
                        const isFav = storage.isGroupFavorite(item.data.id);
                        return { item, count: chatCount, isFav };
                    }
                    
                    // 캐릭터는 메시지 수 사용
                    const char = item.data;
                    let count = cache.get('messageCounts', char.avatar);
                    
                    if (typeof count !== 'number') {
                        try {
                            await api.fetchChatsForCharacter(char.avatar);
                            count = cache.get('messageCounts', char.avatar) || 0;
                        } catch (e) {
                            count = 0;
                        }
                    }
                    
                    return { item, count, isFav: isFavoriteChar(char) };
                })
            );
            results.push(...batchResults);
        }
        
        results.sort((a, b) => {
            // 1. 즐겨찾기 우선 (캐릭터만)
            if (a.isFav !== b.isFav) {
                return a.isFav ? -1 : 1;
            }
            // 2. 메시지/채팅 수 내림차순
            if (b.count !== a.count) {
                return b.count - a.count;
            }
            // 3. 이름순
            const nameA = a.item.data.name || '';
            const nameB = b.item.data.name || '';
            return nameA.localeCompare(nameB, 'ko');
        });
        
        return results.map(r => r.item);
    }
    
    // recent 또는 name 정렬
    const sorted = [...items];
    
    sorted.sort((a, b) => {
        // 즐겨찾기 우선 (캐릭터 + 그룹 모두)
        const aFav = a.type === 'character' ? isFavoriteChar(a.data) : storage.isGroupFavorite(a.data.id);
        const bFav = b.type === 'character' ? isFavoriteChar(b.data) : storage.isGroupFavorite(b.data.id);
        if (aFav !== bFav) {
            return aFav ? -1 : 1;
        }
        
        if (sortOption === 'name') {
            const nameA = a.data.name || '';
            const nameB = b.data.name || '';
            return nameA.localeCompare(nameB, 'ko');
        }
        
        // 기본: 최근 채팅순
        // 캐릭터: lastChatCache 사용
        // 그룹: date_last_chat 필드 사용 (SillyTavern 서버에서 제공)
        let aDate = 0;
        let bDate = 0;
        
        if (a.type === 'character') {
            aDate = lastChatCache.getForSort(a.data);
        } else {
            // date_last_chat은 밀리초 타임스탬프 (숫자)
            aDate = a.data.date_last_chat || 0;
        }
        
        if (b.type === 'character') {
            bDate = lastChatCache.getForSort(b.data);
        } else {
            bDate = b.data.date_last_chat || 0;
        }
        
        return bDate - aDate;
    });
    
    return sorted;
}

// ============================================
// 이벤트 위임 (그리드/히어로/태그바에 각 1회 바인딩)
// 카드별 N개 리스너 → 컨테이너 단위 위임으로 통합
// ============================================

/**
 * 그리드 컨테이너 위임 바인딩 (1회)
 * dataset 가드 - DOM이 재생성되는 확장 재로드 시에도 안전
 */
function ensureGridDelegation() {
    const grid = document.getElementById('chat-lobby-characters');
    if (!grid || grid.dataset.delegated === 'true') return;
    grid.dataset.delegated = 'true';

    bindDelegatedTouchClick(grid, routeGridEvent, {
        group: 'characterGrid',
        debugName: 'character-grid',
    });
}

/**
 * 히어로(최애 코너) 컨테이너 위임 바인딩 (1회)
 */
function ensureHeroDelegation() {
    const hero = document.getElementById('chat-lobby-hero');
    if (!hero || hero.dataset.delegated === 'true') return;
    hero.dataset.delegated = 'true';

    bindDelegatedTouchClick(hero, routeGridEvent, {
        group: 'characterGrid',
        debugName: 'hero-corner',
    });
}

/**
 * 그리드/히어로 공용 라우터
 * 우선순위: 즐겨찾기 버튼 → 그룹 카드 → 캐릭터/히어로 카드
 * @param {Event} e
 * @returns {boolean} 처리 여부
 */
function routeGridEvent(e) {
    const favBtn = e.target.closest('.char-fav-btn');
    if (favBtn) {
        if (favBtn.classList.contains('group-fav-btn')) {
            handleGroupFavClick(favBtn);
        } else {
            handleCharFavClick(favBtn);
        }
        return true;
    }

    const groupCard = e.target.closest('.lobby-group-card');
    if (groupCard) {
        handleGroupCardClick(groupCard);
        return true;
    }

    const charCard = e.target.closest('.lobby-char-card, .lobby-hero-card');
    if (charCard) {
        handleCharCardClick(charCard);
        return true;
    }

    return false;
}

/**
 * 캐릭터 즐겨찾기 토글
 * @param {HTMLElement} favBtn
 */
function handleCharFavClick(favBtn) {
    const card = favBtn.closest('.lobby-char-card');
    const charAvatar = favBtn.dataset.charAvatar || card?.dataset.charAvatar;
    if (!charAvatar) return;

    const newFavState = storage.toggleCharacterFavorite(charAvatar);

    if (card) {
        favBtn.textContent = newFavState ? '★' : '☆';
        card.dataset.isFav = newFavState.toString();
        card.classList.toggle('is-char-fav', newFavState);
    }

    showToast(newFavState ? '즐겨찾기에 추가됨' : '즐겨찾기에서 제거됨', 'success');

    // 최애 코너 동기화
    renderHeroCorner(api.getCharacters());
}

/**
 * 그룹 즐겨찾기 토글
 * @param {HTMLElement} favBtn
 */
function handleGroupFavClick(favBtn) {
    const card = favBtn.closest('.lobby-group-card');
    const groupId = favBtn.dataset.groupId || card?.dataset.groupId;
    if (!groupId) return;

    const newFavState = storage.toggleGroupFavorite(groupId);

    if (card) {
        favBtn.textContent = newFavState ? '★' : '☆';
        card.dataset.isFav = newFavState.toString();
        card.classList.toggle('is-char-fav', newFavState);
    }

    showToast(newFavState ? '즐겨찾기에 추가됨' : '즐겨찾기에서 제거됨', 'success');
}

/**
 * 캐릭터 카드 클릭 (그리드 카드 + 히어로 카드 공용)
 * @param {HTMLElement} card
 */
async function handleCharCardClick(card) {
    // 로비 락 상태면 클릭 차단
    if (store.isLobbyLocked) return;

    // 이미 처리 중이거나 렌더링 중이면 무시
    if (isSelectingCharacter || isRendering) return;

    const charAvatar = card.dataset.charAvatar;
    const charName = card.dataset.charName || 'Unknown';
    if (!charAvatar) return;

    isSelectingCharacter = true;
    store.setLobbyLocked(true);

    try {
        const gridContainer = document.getElementById('chat-lobby-characters');

        // 채팅 패널이 열려있고 같은 캐릭터면 닫기 (토글)
        const chatsPanel = document.getElementById('chat-lobby-chats');
        const isPanelVisible = chatsPanel?.classList.contains('visible');
        const isSameCharacter = store.currentCharacter?.avatar === charAvatar;

        if (isPanelVisible && isSameCharacter) {
            gridContainer?.querySelectorAll('.lobby-char-card.selected').forEach(el => {
                el.classList.remove('selected');
            });
            closeChatPanel();
            return;
        }

        // 기존 선택 해제
        gridContainer?.querySelectorAll('.lobby-char-card.selected').forEach(el => {
            el.classList.remove('selected');
        });

        // 새로 선택 표시 (히어로 카드 클릭이면 그리드의 해당 카드에 표시)
        const gridCard = card.classList.contains('lobby-hero-card')
            ? gridContainer?.querySelector(`.lobby-char-card[data-char-avatar="${CSS.escape(charAvatar)}"]`)
            : card;
        gridCard?.classList.add('selected');

        // 캐릭터 정보 구성
        // ⚠️ querySelector('img')는 금지 - 카드의 첫 img가 페르소나 배지일 수 있음
        // (채팅 패널 헤더에 페르소나 이미지가 뜨던 버그의 원인)
        const characterData = {
            index: card.dataset.charIndex,
            avatar: charAvatar,
            name: charName,
            avatarSrc: card.querySelector('.lobby-char-avatar')?.src
                || charAvatarUrl(charAvatar),
        };

        // 콜백 호출
        const handler = store.onCharacterSelect;
        if (handler && typeof handler === 'function') {
            await handler(characterData);
        } else {
            console.error('[CharacterGrid] onCharacterSelect handler not available!');
        }
    } catch (error) {
        console.error('[CharacterGrid] Handler error:', error);
    } finally {
        store.setLobbyLocked(false);
        // 처리 완료 후 플래그 해제 (약간의 딜레이로 빠른 재클릭 방지)
        setTimeout(() => {
            isSelectingCharacter = false;
        }, 300);
    }
}

/**
 * 그룹 카드 클릭
 * @param {HTMLElement} card
 */
async function handleGroupCardClick(card) {
    const groupId = card.dataset.groupId;
    if (!groupId) return;

    store.setLobbyLocked(true);

    try {
        const gridContainer = document.getElementById('chat-lobby-characters');

        // 채팅 패널이 열려있고 같은 그룹이면 닫기 (토글)
        const chatsPanel = document.getElementById('chat-lobby-chats');
        const isPanelVisible = chatsPanel?.classList.contains('visible');
        const isSameGroup = store.currentGroup?.id === groupId;

        if (isPanelVisible && isSameGroup) {
            card.classList.remove('selected');
            closeChatPanel();
            return;
        }

        // 다른 그룹이면 현재 상태 초기화 (중복 호출 방지)
        if (!isSameGroup) {
            store.setCurrentGroup(null);
            store.setCurrentCharacter(null);
        }

        // 기존 선택 해제 (캐릭터 + 그룹 모두)
        gridContainer?.querySelectorAll('.lobby-char-card.selected, .lobby-group-card.selected').forEach(el => {
            el.classList.remove('selected');
        });

        // 새로 선택
        card.classList.add('selected');

        // 그룹 정보 가져오기
        const groups = await api.getGroups();
        const group = groups.find(g => g.id === groupId);

        if (group) {
            const handler = store.onGroupSelect;
            if (handler && typeof handler === 'function') {
                await handler(group);
            }
        }
    } catch (error) {
        console.error('[CharacterGrid] Group handler error:', error);
    } finally {
        store.setLobbyLocked(false);
    }
}

// ============================================
// 검색/정렬 핸들러
// ============================================

/**
 * 검색 핸들러 (디바운스 적용)
 * @type {Function}
 */
export const handleSearch = debounce((searchTerm) => {
    renderCharacterGrid(searchTerm);
}, CONFIG.ui.debounceWait);

/**
 * 정렬 변경 핸들러
 * @param {string} sortOption - 정렬 옵션
 */
export function handleSortChange(sortOption) {
    storage.setCharSortOption(sortOption);
    const searchTerm = store.searchTerm;
    renderCharacterGrid(searchTerm, sortOption);
}

// ============================================
// 태그 관련 함수
// ============================================

/**
 * 캐릭터의 태그 가져오기 (SillyTavern 원본에서)
 * @param {Object} char - 캐릭터 객체
 * @returns {string[]}
 */
function getCharacterTags(char) {
    // SillyTavern 태그 구조: char.tags 또는 context.tagMap 사용
    const context = api.getContext();
    
    // 1. context.tagMap에서 태그 가져오기 (SillyTavern 표준)
    if (context?.tagMap && context?.tags && char.avatar) {
        const charTags = context.tagMap[char.avatar] || [];
        return charTags.map(tagId => {
            const tag = context.tags.find(t => t.id === tagId);
            return tag?.name || '';
        }).filter(Boolean);
    }
    
    // 2. Fallback: char.tags 직접 사용
    if (Array.isArray(char.tags)) {
        return char.tags;
    }
    
    return [];
}

/**
 * 전체 캐릭터의 태그 집계
 * @param {Array} characters - 캐릭터 배열
 * @returns {Array<{tag: string, count: number}>}
 */
function aggregateTags(characters) {
    const tagCounts = {};
    
    characters.forEach(char => {
        const tags = getCharacterTags(char);
        tags.forEach(tag => {
            if (tag) {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            }
        });
    });
    
    // 개수순 정렬
    return Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([tag, count]) => ({ tag, count }));
}

/**
 * 태그바 렌더링
 * @param {Array} characters - 전체 캐릭터 배열
 */
function renderTagBar(characters) {
    const container = document.getElementById('chat-lobby-tag-list');
    if (!container) return;
    
    const tags = aggregateTags(characters);
    
    if (tags.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    const selectedTag = store.selectedTag;
    
    // 횡스크롤이니까 제한 없이 다 보여주기
    container.innerHTML = tags.map(({ tag, count }) => {
        const isActive = selectedTag === tag;
        return `<span class="lobby-tag-item ${isActive ? 'active' : ''}" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}<span class="lobby-tag-count">(${count})</span></span>`;
    }).join('');

    // 이벤트 위임 바인딩 (1회)
    ensureTagDelegation(container);
}

/**
 * 태그바 위임 바인딩 (1회)
 * @param {HTMLElement} container - 태그 목록 컨테이너
 */
function ensureTagDelegation(container) {
    if (container.dataset.delegated === 'true') return;
    container.dataset.delegated = 'true';

    bindDelegatedTouchClick(container, (e) => {
        const item = e.target.closest('.lobby-tag-item');
        if (!item) return false;

        const tag = item.dataset.tag;

        // 같은 태그 클릭 시 필터 해제
        if (store.selectedTag === tag) {
            store.setSelectedTag(null);
        } else {
            store.setSelectedTag(tag);
        }

        // 리렌더
        renderCharacterGrid(store.searchTerm);
        return true;
    }, { group: 'characterGrid', debugName: 'tag-bar' });
}

// ============================================
// 그룹 카드 렌더링
// ============================================

/**
 * 그룹 카드 HTML 생성
 * @param {Object} group - 그룹 객체
 * @param {string} sortOption - 정렬 옵션
 * @returns {string}
 */
function renderGroupCard(group, sortOption = 'recent') {
    const name = group.name || 'Unknown Group';
    const memberCount = Array.isArray(group.members) ? group.members.length : 0;
    const chatCount = Array.isArray(group.chats) ? group.chats.length : 0;
    
    // 즐겨찾기 상태
    const isFav = storage.isGroupFavorite(group.id);
    
    // 마지막 채팅 시간 (최근순 정렬 + 오늘인 경우에만 표시)
    let lastChatTimeStr = '';
    if (sortOption === 'recent' && group.date_last_chat) {
        const lastTime = new Date(group.date_last_chat);
        const now = new Date();
        const isToday = now.toDateString() === lastTime.toDateString();
        
        // 오늘 채팅한 경우에만 시간 표시
        if (isToday) {
            const hours = lastTime.getHours();
            const minutes = String(lastTime.getMinutes()).padStart(2, '0');
            lastChatTimeStr = `${hours}:${minutes}`;
        }
    }
    
    // 멤버 아바타 그리드 생성 (최대 4명)
    const members = group.members || [];
    const avatarGridHtml = renderMemberAvatarGrid(members.slice(0, 4), memberCount);
    
    // 즐겨찾기 버튼
    const favBtn = `<button class="char-fav-btn group-fav-btn" data-group-id="${escapeHtml(group.id)}" title="즐겨찾기 토글">${isFav ? '★' : '☆'}</button>`;
    
    return `
    <div class="lobby-char-card lobby-group-card ${isFav ? 'is-char-fav' : ''}" data-group-id="${escapeHtml(group.id)}" data-is-fav="${isFav}">
        ${favBtn}
        <div class="group-avatar-grid">
            ${avatarGridHtml}
        </div>
        <div class="lobby-char-name">
            <span class="char-name-text">${escapeHtml(name)}${lastChatTimeStr ? ` <span class="char-last-time">${lastChatTimeStr}</span>` : ''}</span>
            <div class="char-hover-info">
                <div class="info-row">
                    <span class="info-icon">👥</span>
                    <span class="info-value">${memberCount}명</span>
                </div>
                <div class="info-row">
                    <span class="info-icon">💬</span>
                    <span class="info-value">${chatCount}개 채팅</span>
                </div>
            </div>
        </div>
        <div class="group-member-badge">👥 ${memberCount}</div>
    </div>
    `;
}

/**
 * 멤버 아바타 그리드 HTML 생성 (카카오톡 스타일)
 * @param {Array} members - 멤버 아바타 배열 (최대 4개)
 * @param {number} totalCount - 전체 멤버 수
 * @returns {string}
 */
function renderMemberAvatarGrid(members, totalCount) {
    const count = members.length;
    
    if (count === 0) {
        // 멤버 없으면 기본 아이콘
        return `<div class="grid-single"><img src="/img/ai4.png" alt="그룹" draggable="false"></div>`;
    }
    
    if (count === 1) {
        // 1명이면 단독 표시
        const avatar = members[0];
        const avatarUrl = charAvatarUrl(avatar);
        return `<div class="grid-single"><img src="${avatarUrl}" alt="member" draggable="false" onerror="this.src='/img/ai4.png'"></div>`;
    }
    
    if (count === 2) {
        // 2명이면 가로 2분할
        return `<div class="grid-two">${members.map(avatar => {
            const avatarUrl = charAvatarUrl(avatar);
            return `<img src="${avatarUrl}" alt="member" draggable="false" onerror="this.src='/img/ai4.png'">`;
        }).join('')}</div>`;
    }
    
    if (count === 3) {
        // 3명이면 위 1 + 아래 2
        const avatarUrl0 = charAvatarUrl(members[0]);
        const avatarUrl1 = charAvatarUrl(members[1]);
        const avatarUrl2 = charAvatarUrl(members[2]);
        return `
            <div class="grid-three">
                <div class="grid-top"><img src="${avatarUrl0}" alt="member" draggable="false" onerror="this.src='/img/ai4.png'"></div>
                <div class="grid-bottom">
                    <img src="${avatarUrl1}" alt="member" draggable="false" onerror="this.src='/img/ai4.png'">
                    <img src="${avatarUrl2}" alt="member" draggable="false" onerror="this.src='/img/ai4.png'">
                </div>
            </div>
        `;
    }
    
    // 4명 이상이면 2x2 그리드
    return `<div class="grid-four">${members.slice(0, 4).map(avatar => {
        const avatarUrl = charAvatarUrl(avatar);
        return `<img src="${avatarUrl}" alt="member" draggable="false" onerror="this.src='/img/ai4.png'">`;
    }).join('')}</div>`;
}

