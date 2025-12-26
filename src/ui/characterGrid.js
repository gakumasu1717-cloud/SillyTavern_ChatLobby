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
 * context.characters를 직접 사용 (항상 최신 데이터)
 * @param {string} [searchTerm=''] - 검색어
 * @param {string|null} [sortOverride=null] - 정렬 옵션 오버라이드
 * @returns {Promise<void>}
 */
export async function renderCharacterGrid(searchTerm = '', sortOverride = null) {
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
    
    // 원본 인덱스 보존 (context.characters 기준)
    const originalCharacters = api.getCharacters();
    
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
    // 즐겨찾기 버튼 (클릭 가능)
    const favBtn = `<button class="char-fav-btn" data-char-avatar="${safeAvatar}" title="즐겨찾기 토글">${isFav ? '⭐' : '☆'}</button>`;
    
    return `
    <div class="lobby-char-card ${isFav ? 'is-char-fav' : ''}" 
         data-char-index="${index}" 
         data-char-avatar="${safeAvatar}" 
         data-is-fav="${isFav}">
        ${favBtn}
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
    console.log('[CharacterGrid] ========== SORT START ==========');
    console.log('[CharacterGrid] sortOption:', sortOption);
    console.log('[CharacterGrid] characters count:', characters.length);
    
    if (sortOption === 'chats') {
        // 채팅 수 정렬 - 캐시 없으면 API 호출해서 가져옴
        const results = await Promise.all(characters.map(async (char) => {
            // 캐시 먼저 확인
            let count = cache.get('chatCounts', char.avatar);
            
            // 캐시 없으면 API 호출
            if (typeof count !== 'number') {
                try {
                    count = await api.getChatCount(char.avatar);
                } catch (e) {
                    console.error('[CharacterGrid] Failed to get chat count for:', char.name, e);
                    count = 0;
                }
            }
            
            return { char, count };
        }));
        
        results.sort((a, b) => {
            // 1. 즐겨찾기 우선
            if (isFavoriteChar(a.char) !== isFavoriteChar(b.char)) {
                return isFavoriteChar(a.char) ? -1 : 1;
            }
            
            // 2. 채팅 수 내림차순 (같으면 이름순)
            if (b.count !== a.count) {
                return b.count - a.count;
            }
            
            // 3. 채팅 수 같으면 이름순
            return (a.char.name || '').localeCompare(b.char.name || '', 'ko');
        });
        
        console.log('[CharacterGrid] Sorted by chats, first 5:', results.slice(0, 5).map(r => ({ name: r.char.name, count: r.count, fav: isFavoriteChar(r.char) })));
        console.log('[CharacterGrid] ========== SORT END ==========');
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
        
        // 기본: 최근 채팅순
        const aDate = a.date_last_chat || a.last_mes || 0;
        const bDate = b.date_last_chat || b.last_mes || 0;
        return bDate - aDate;
    });
    
    console.log('[CharacterGrid] Sorted by', sortOption, ', first 5:', sorted.slice(0, 5).map(c => ({ name: c.name, fav: isFavoriteChar(c), date: c.date_last_chat })));
    console.log('[CharacterGrid] ========== SORT END ==========');
    return sorted;
}

/**
 * 캐릭터 카드 이벤트 바인딩
 * @param {HTMLElement} container
 */
function bindCharacterEvents(container) {
    container.querySelectorAll('.lobby-char-card').forEach((card, index) => {
        const charName = card.querySelector('.lobby-char-name')?.textContent || 'Unknown';
        const charAvatar = card.dataset.charAvatar;
        const favBtn = card.querySelector('.char-fav-btn');
        
        // 즐겨찾기 버튼 이벤트 - SillyTavern의 #favorite_button 클릭으로 연동
        if (favBtn) {
            createTouchClickHandler(favBtn, async (e) => {
                e.stopPropagation();
                
                console.log('[CharacterGrid] ========== FAVORITE TOGGLE START ==========');
                console.log('[CharacterGrid] Target:', charName, charAvatar);
                
                // 해당 캐릭터의 인덱스 찾기
                const context = api.getContext();
                const characters = context?.characters || [];
                const charIndex = characters.findIndex(c => c.avatar === charAvatar);
                
                console.log('[CharacterGrid] Character index:', charIndex);
                
                if (charIndex === -1) {
                    console.error('[CharacterGrid] Character not found:', charAvatar);
                    showToast('캐릭터를 찾을 수 없습니다.', 'error');
                    return;
                }
                
                // 현재 즐겨찾기 상태 확인 (UI 업데이트용)
                const currentFav = card.dataset.isFav === 'true';
                const newFavState = !currentFav;
                
                console.log('[CharacterGrid] Current fav:', currentFav, '-> New fav:', newFavState);
                
                try {
                    // API로 직접 즐겨찾기 토글 (캐릭터 선택 없이)
                    const success = await api.toggleCharacterFavorite(charAvatar, newFavState);
                    
                    if (success) {
                        // UI 즉시 업데이트 (리렌더 없이)
                        console.log('[CharacterGrid] Updating UI only (no re-render)');
                        favBtn.textContent = newFavState ? '⭐' : '☆';
                        card.dataset.isFav = newFavState.toString();
                        card.classList.toggle('is-char-fav', newFavState);
                        
                        showToast(newFavState ? '즐겨찾기에 추가되었습니다.' : '즐겨찾기에서 제거되었습니다.', 'success');
                        console.log('[CharacterGrid] ========== FAVORITE TOGGLE END ==========');
                    } else {
                        console.error('[CharacterGrid] API call failed');
                        showToast('즐겨찾기 변경에 실패했습니다.', 'error');
                    }
                } catch (error) {
                    console.error('[CharacterGrid] Favorite toggle error:', error);
                    showToast('즐겨찾기 변경에 실패했습니다.', 'error');
                }
            }, { preventDefault: true, stopPropagation: true, debugName: `char-fav-${index}` });
        }
        
        // 캐릭터 카드 클릭 (선택)
        createTouchClickHandler(card, () => {
            // 즐겨찾기 버튼 클릭은 무시 (위에서 처리됨)
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
