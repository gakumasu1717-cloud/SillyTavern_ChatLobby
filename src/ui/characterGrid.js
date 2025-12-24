// ============================================
// 캐릭터 그리드 UI
// ============================================

import { api } from '../api/sillyTavern.js';
import { cache } from '../data/cache.js';
import { storage } from '../data/storage.js';
import { escapeHtml } from '../utils/textUtils.js';
import { createTouchClickHandler, debounce } from '../utils/eventHelpers.js';
import { CONFIG } from '../config.js';

// 캐릭터 선택 시 콜백 (외부에서 설정)
let onCharacterSelect = null;

export function setCharacterSelectHandler(handler) {
    onCharacterSelect = handler;
}

export async function renderCharacterGrid(searchTerm = '', sortOverride = null) {
    const container = document.getElementById('chat-lobby-characters');
    if (!container) return;
    
    // 캐시된 데이터가 있으면 즉시 렌더링
    const cachedCharacters = cache.get('characters');
    if (cachedCharacters && cachedCharacters.length > 0) {
        renderCharacterList(container, cachedCharacters, searchTerm, sortOverride);
    } else {
        container.innerHTML = '<div class="lobby-loading">캐릭터 로딩 중...</div>';
    }
    
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
    
    renderCharacterList(container, characters, searchTerm, sortOverride);
}

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

function renderCharacterCard(char, index) {
    const avatarUrl = char.avatar ? `/characters/${encodeURIComponent(char.avatar)}` : '/img/ai4.png';
    const name = char.name || 'Unknown';
    const safeAvatar = (char.avatar || '').replace(/"/g, '&quot;');
    
    const isFav = !!(char.fav === true || char.fav === 'true' || char.data?.extensions?.fav);
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

async function sortCharacters(characters, sortOption) {
    const isFav = (char) => !!(char.fav === true || char.fav === 'true' || char.data?.extensions?.fav);
    
    if (sortOption === 'chats') {
        // 채팅 수 정렬 - 비동기
        const chatCounts = await Promise.all(
            characters.map(async (char) => {
                const count = await api.getChatCount(char.avatar);
                return { char, count };
            })
        );
        
        chatCounts.sort((a, b) => {
            if (isFav(a.char) !== isFav(b.char)) return isFav(a.char) ? -1 : 1;
            return b.count - a.count;
        });
        
        return chatCounts.map(item => item.char);
    }
    
    const sorted = [...characters];
    
    sorted.sort((a, b) => {
        // 즐겨찾기 우선
        if (isFav(a) !== isFav(b)) return isFav(a) ? -1 : 1;
        
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

function bindCharacterEvents(container) {
    container.querySelectorAll('.lobby-char-card').forEach(card => {
        createTouchClickHandler(card, () => {
            // 기존 선택 해제
            container.querySelectorAll('.lobby-char-card.selected').forEach(el => {
                el.classList.remove('selected');
            });
            
            // 새로 선택
            card.classList.add('selected');
            
            // 콜백 호출
            if (onCharacterSelect) {
                onCharacterSelect({
                    index: card.dataset.charIndex,
                    avatar: card.dataset.charAvatar,
                    name: card.querySelector('.lobby-char-name').textContent,
                    avatarSrc: card.querySelector('.lobby-char-avatar').src
                });
            }
        }, { preventDefault: false, stopPropagation: false });
    });
}

// 검색 핸들러 (디바운스 적용)
export const handleSearch = debounce((searchTerm) => {
    renderCharacterGrid(searchTerm);
}, CONFIG.ui.debounceWait);

// 정렬 변경 핸들러
export function handleSortChange(sortOption) {
    storage.setCharSortOption(sortOption);
    const searchInput = document.getElementById('chat-lobby-search-input');
    const searchTerm = searchInput?.value || '';
    renderCharacterGrid(searchTerm, sortOption);
}
