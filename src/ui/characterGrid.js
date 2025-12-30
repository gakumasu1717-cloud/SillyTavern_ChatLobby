// ============================================
// 캐릭터 그리드 UI
// ============================================

import { api } from '../api/sillyTavern.js';
import { cache } from '../data/cache.js';
import { storage } from '../data/storage.js';
import { store } from '../data/store.js';
import { lastChatCache } from '../data/lastChatCache.js';
import { escapeHtml } from '../utils/textUtils.js';
import { createTouchClickHandler, debounce } from '../utils/eventHelpers.js';
import { showToast } from './notifications.js';
import { closeChatPanel } from './chatList.js';
import { CONFIG } from '../config.js';

// 렌더링 중복 방지
let isRendering = false;
let pendingRender = null;

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
    console.log('[RENDER] renderCharacterGrid called', { searchTerm, sortOverride, stack: new Error().stack?.split('\n').slice(1, 4).join(' <- ') });
    
    // 렌더링 중복 방지
    if (isRendering) {
        console.log('[RENDER] renderCharacterGrid BLOCKED (already rendering)');
        pendingRender = { searchTerm, sortOverride };
        return;
    }
    
    isRendering = true;
    
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
        
        // 대기 중인 렌더 있으면 실행
        if (pendingRender) {
            const { searchTerm: s, sortOverride: o } = pendingRender;
            pendingRender = null;
            renderCharacterGrid(s, o);
        }
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
    
    // 원본 인덱스 보존 (context.characters 기준) - Map으로 O(1) 룩업
    const originalCharacters = api.getCharacters();
    const indexMap = new Map(originalCharacters.map((c, i) => [c, i]));
    
    container.innerHTML = filtered.map(char => {
        return renderCharacterCard(char, indexMap.get(char));
    }).join('');
    
    bindCharacterEvents(container);
}

/**
 * 캐릭터 카드 HTML 생성 - 넷플릭스 스타일 + 호버 정보
 * @param {Object} char - 캐릭터 객체
 * @param {number} index - 원본 인덱스
 * @returns {string}
 */
function renderCharacterCard(char, index) {
    const avatarUrl = char.avatar ? `/characters/${encodeURIComponent(char.avatar)}` : '/img/ai4.png';
    const name = char.name || 'Unknown';
    const safeAvatar = escapeHtml(char.avatar || '');
    
    const isFav = isFavoriteChar(char);
    
    // 캐시에서 채팅 수 가져오기 (없으면 0)
    const chatCount = cache.get('chatCounts', char.avatar) || 0;
    
    // 캐시에서 메시지 수 가져오기 (없으면 계산)
    let messageCount = cache.get('messageCounts', char.avatar);
    if (typeof messageCount !== 'number') {
        messageCount = char.chat_size || 0;
    }
    
    // 즐겨찾기 버튼
    const favBtn = `<button class="char-fav-btn" data-char-avatar="${safeAvatar}" title="즐겨찾기 토글">${isFav ? '⭐' : '☆'}</button>`;
    
    return `
    <div class="lobby-char-card ${isFav ? 'is-char-fav' : ''}" 
         data-char-index="${index}" 
         data-char-avatar="${safeAvatar}" 
         data-is-fav="${isFav}">
        ${favBtn}
        <img class="lobby-char-avatar" 
             src="${avatarUrl}" 
             alt="${escapeHtml(name)}" 
             loading="lazy"
             onerror="this.src='/img/ai4.png'">
        <div class="lobby-char-name">
            <span class="char-name-text">${escapeHtml(name)}</span>
            <div class="char-hover-info">
                <div class="info-row">
                    <span class="info-icon">💬</span>
                    <span class="info-value">${chatCount}개 채팅</span>
                </div>
                <div class="info-row">
                    <span class="info-icon">📝</span>
                    <span class="info-value">${messageCount.toLocaleString()}개 메시지</span>
                </div>
            </div>
        </div>
    </div>
    `;
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
 * 캐릭터 정렬
 * @param {Array} characters - 캐릭터 배열
 * @param {string} sortOption - 정렬 옵션
 * @returns {Promise<Array>}
 */
async function sortCharacters(characters, sortOption) {
    
    if (sortOption === 'chats') {
        // 채팅 수 정렬 - 배치로 API 호출 (동시 요청 제한)
        const BATCH_SIZE = 5;
        const results = [];
        
        for (let i = 0; i < characters.length; i += BATCH_SIZE) {
            const batch = characters.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.all(
                batch.map(async (char) => {
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
                })
            );
            results.push(...batchResults);
        }
        
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
        
        // 기본: 최근 채팅순 (lastChatCache 우선 사용)
        const aDate = lastChatCache.getForSort(a);
        const bDate = lastChatCache.getForSort(b);
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
        const charNameEl = card.querySelector('.char-name-text');
        const charName = charNameEl?.textContent || card.querySelector('.lobby-char-name')?.textContent || 'Unknown';
        const charAvatar = card.dataset.charAvatar;
        const favBtn = card.querySelector('.char-fav-btn');
        
        // 즐겨찾기 버튼 이벤트 - 로컬 스토리지만 사용 (API 호출 없음)
        if (favBtn) {
            createTouchClickHandler(favBtn, (e) => {
                e.stopPropagation();
                
                // 로컬 스토리지에 토글
                const newFavState = storage.toggleCharacterFavorite(charAvatar);
                
                // UI 업데이트
                favBtn.textContent = newFavState ? '⭐' : '☆';
                card.dataset.isFav = newFavState.toString();
                card.classList.toggle('is-char-fav', newFavState);
                
                console.log(`[CharacterGrid] Favorite toggled: ${charAvatar} = ${newFavState}`);
                showToast(newFavState ? '즐겨찾기에 추가됨' : '즐겨찾기에서 제거됨', 'success');
                
            }, { preventDefault: true, stopPropagation: true, debugName: `char-fav-${index}` });
        }
        
        // 캐릭터 카드 클릭 (선택)
        createTouchClickHandler(card, () => {
            // 즐겨찾기 버튼 클릭은 무시 (위에서 처리됨)
            
            // 채팅 패널이 열려있고 같은 캐릭터면 닫기
            const chatsPanel = document.getElementById('chat-lobby-chats');
            const isPanelVisible = chatsPanel?.classList.contains('visible');
            const isSameCharacter = store.currentCharacter?.avatar === charAvatar;
            
            console.log('[CharacterGrid] Card clicked:', { 
                charAvatar, 
                currentAvatar: store.currentCharacter?.avatar, 
                isPanelVisible, 
                isSameCharacter 
            });
            
            if (isPanelVisible && isSameCharacter) {
                console.log('[CharacterGrid] Closing panel - same character re-clicked');
                card.classList.remove('selected');
                closeChatPanel();
                return;
            }
            
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
            
            
            // 콜백 호출
            const handler = store.onCharacterSelect;
            if (handler && typeof handler === 'function') {
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
    
    // 이벤트 바인딩
    bindTagEvents(container);
}

/**
 * 태그 이벤트 바인딩
 * @param {HTMLElement} container - 태그 목록 컨테이너
 */
function bindTagEvents(container) {
    // 태그 클릭
    container.querySelectorAll('.lobby-tag-item').forEach(item => {
        createTouchClickHandler(item, () => {
            const tag = item.dataset.tag;
            
            // 같은 태그 클릭 시 필터 해제
            if (store.selectedTag === tag) {
                store.setSelectedTag(null);
            } else {
                store.setSelectedTag(tag);
            }
            
            // 리렌더
            renderCharacterGrid(store.searchTerm);
        }, { debugName: `tag-${item.dataset.tag}` });
    });
}
