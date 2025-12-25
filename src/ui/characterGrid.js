// ============================================
// 캐릭터 그리드 UI
// ============================================

import { api } from '../api/sillyTavern.js';
import { cache } from '../data/cache.js';
import { storage } from '../data/storage.js';
import { store } from '../data/store.js';
import { escapeHtml } from '../utils/textUtils.js';
import { createTouchClickHandler, debounce } from '../utils/eventHelpers.js';
import { showToast } from './notifications.js';
import { CONFIG } from '../config.js';

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

// ============================================
// 캐릭터 그리드 렌더링
// ============================================

/**
 * 캐릭터 그리드 렌더링
 * @param {string} [searchTerm=''] - 검색어
 * @param {string|null} [sortOverride=null] - 정렬 옵션 오버라이드
 * @returns {Promise<void>}
 */
export async function renderCharacterGrid(searchTerm = '', sortOverride = null) {
    const container = document.getElementById('chat-lobby-characters');
    if (!container) return;
    
    // 검색어 저장
    store.setSearchTerm(searchTerm);
    
    // 캐시된 데이터가 있으면 즉시 렌더링
    const cachedCharacters = cache.get('characters');
    if (cachedCharacters && cachedCharacters.length > 0) {
        await renderCharacterList(container, cachedCharacters, searchTerm, sortOverride);
    } else {
        container.innerHTML = '<div class="lobby-loading">캐릭터 로딩 중...</div>';
    }
    
    try {
        // 최신 데이터 가져오기 (백그라운드)
        const characters = await api.fetchCharacters();
        
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
    } catch (error) {
        console.error('[CharacterGrid] Failed to load characters:', error);
        showToast('캐릭터 목록을 불러오지 못했습니다.', 'error');
        container.innerHTML = `
            <div class="lobby-empty-state">
                <i>⚠️</i>
                <div>캐릭터 로딩 실패</div>
                <button onclick="window.chatLobbyRefresh()" style="margin-top:10px;padding:8px 16px;cursor:pointer;">다시 시도</button>
            </div>
        `;
    }
}

/**
 * 캐릭터 목록 렌더링 (내부)
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
    
    // 정렬
    const sortOption = sortOverride || storage.getCharSortOption();
    filtered = await sortCharacters(filtered, sortOption);
    
    // 드롭다운 동기화
    const sortSelect = document.getElementById('chat-lobby-char-sort');
    if (sortSelect && sortSelect.value !== sortOption) {
        sortSelect.value = sortOption;
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="lobby-empty-state">
                <i>🔍</i>
                <div>검색 결과가 없습니다</div>
            </div>
        `;
        return;
    }
    
    // 원본 인덱스 보존
    const originalCharacters = cache.get('characters') || characters;
    
    container.innerHTML = filtered.map(char => {
        const originalIndex = originalCharacters.indexOf(char);
        return renderCharacterCard(char, originalIndex);
    }).join('');
    
    bindCharacterEvents(container);
}

/**
 * 캐릭터 카드 HTML 생성
 * @param {Object} char - 캐릭터 객체
 * @param {number} index - 원본 인덱스
 * @returns {string}
 */
function renderCharacterCard(char, index) {
    const avatarUrl = char.avatar ? `/characters/${encodeURIComponent(char.avatar)}` : '/img/ai4.png';
    const name = char.name || 'Unknown';
    const safeAvatar = (char.avatar || '').replace(/"/g, '&quot;');
    
    const isFav = isFavoriteChar(char);
    const favBadge = isFav ? '<span class="char-fav-badge">⭐</span>' : '';
    
    return `
    <div class="lobby-char-card ${isFav ? 'is-char-fav' : ''}" 
         data-char-index="${index}" 
         data-char-avatar="${safeAvatar}" 
         data-is-fav="${isFav}">
        ${favBadge}
        <img class="lobby-char-avatar" src="${avatarUrl}" alt="${name}" onerror="this.src='/img/ai4.png'">
        <div class="lobby-char-name">${escapeHtml(name)}</div>
    </div>
    `;
}

/**
 * 캐릭터가 즐겨찾기인지 확인
 * @param {Object} char - 캐릭터 객체
 * @returns {boolean}
 */
function isFavoriteChar(char) {
    return !!(char.fav === true || char.fav === 'true' || char.data?.extensions?.fav);
}

/**
 * 캐릭터 정렬
 * @param {Array} characters - 캐릭터 배열
 * @param {string} sortOption - 정렬 옵션
 * @returns {Promise<Array>}
 */
async function sortCharacters(characters, sortOption) {
    if (sortOption === 'chats') {
        // 채팅 수 정렬 - 캐시된 데이터만 사용 (N+1 문제 방지)
        // 캐시가 없으면 0으로 처리, 추가 API 호출 없음
        const results = characters.map(char => {
            // 캐시에서 직접 가져오기 (비동기 없음)
            const cachedCount = cache.get('chatCounts', char.avatar);
            return { 
                char, 
                count: cachedCount,  // undefined 유지 (캐시 미스 구분용)
                hasCache: cachedCount !== undefined
            };
        });
        
        results.sort((a, b) => {
            // 1. 즐겨찾기 우선
            if (isFavoriteChar(a.char) !== isFavoriteChar(b.char)) {
                return isFavoriteChar(a.char) ? -1 : 1;
            }
            
            // 2. 캐시 미스는 맨 뒤로
            if (a.hasCache && !b.hasCache) return -1;
            if (!a.hasCache && b.hasCache) return 1;
            if (!a.hasCache && !b.hasCache) return 0;
            
            // 3. 채팅 수 내림차순
            return b.count - a.count;
        });
        
        return results.map(item => item.char);
    }
    
    const sorted = [...characters];
    
    sorted.sort((a, b) => {
        // 즐겨찾기 우선
        if (isFavoriteChar(a) !== isFavoriteChar(b)) {
            return isFavoriteChar(a) ? -1 : 1;
        }
        
        if (sortOption === 'name') {
            return (a.name || '').localeCompare(b.name || '', 'ko');
        }
        
        if (sortOption === 'created') {
            const aDate = a.create_date || a.date_added || 0;
            const bDate = b.create_date || b.date_added || 0;
            return bDate - aDate;
        }
        
        // 기본: 최근 채팅순
        const aDate = a.date_last_chat || a.last_mes || 0;
        const bDate = b.date_last_chat || b.last_mes || 0;
        return bDate - aDate;
    });
    
    return sorted;
}

/**
 * 캐릭터 카드 이벤트 바인딩
 * @param {HTMLElement} container
 */
function bindCharacterEvents(container) {
    container.querySelectorAll('.lobby-char-card').forEach((card, index) => {
        const charName = card.querySelector('.lobby-char-name')?.textContent || 'Unknown';
        
        createTouchClickHandler(card, () => {
            console.log('[CharacterGrid] Card click handler fired for:', charName);
            
            // 기존 선택 해제
            container.querySelectorAll('.lobby-char-card.selected').forEach(el => {
                el.classList.remove('selected');
            });
            
            // 새로 선택
            card.classList.add('selected');
            
            // 캐릭터 정보 구성
            const characterData = {
                index: card.dataset.charIndex,
                avatar: card.dataset.charAvatar,
                name: charName,
                avatarSrc: card.querySelector('.lobby-char-avatar')?.src || ''
            };
            
            console.log('[CharacterGrid] Character data:', characterData);
            
            // 콜백 호출
            const handler = store.onCharacterSelect;
            if (handler && typeof handler === 'function') {
                console.log('[CharacterGrid] Calling onCharacterSelect handler');
                try {
                    handler(characterData);
                } catch (error) {
                    console.error('[CharacterGrid] Handler error:', error);
                }
            } else {
                console.error('[CharacterGrid] onCharacterSelect handler not available!', {
                    handler: handler,
                    handlerType: typeof handler
                });
            }
        }, { preventDefault: true, stopPropagation: true, debugName: `char-${index}-${charName}` });
    });
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
