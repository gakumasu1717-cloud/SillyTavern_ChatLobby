// ============================================
// 채팅 목록 UI
// ============================================

import { api } from '../api/sillyTavern.js';
import { cache } from '../data/cache.js';
import { storage } from '../data/storage.js';
import { store } from '../data/store.js';
import { escapeHtml, truncateText } from '../utils/textUtils.js';
import { formatDate, getTimestamp } from '../utils/dateUtils.js';
import { createTouchClickHandler, isMobile } from '../utils/eventHelpers.js';
import { showToast, showAlert, showConfirm } from './notifications.js';
import { CONFIG } from '../config.js';
import { getFoldersOptionsHTML } from './templates.js';
import { lastChatCache } from '../data/lastChatCache.js';
import { operationLock } from '../utils/operationLock.js';
import { 
    analyzeBranches, 
    needsBranchAnalysis 
} from '../utils/branchAnalyzer.js';
import { getAllBranches, getAllFingerprints } from '../data/branchCache.js';

// ============================================
// 툴팁 관련 변수
// ============================================

// Race Condition 방지는 operationLock으로 처리

let tooltipElement = null;
let tooltipTimeout = null;
let currentTooltipTarget = null;
let tooltipEventsInitialized = false;  // 이벤트 위임 등록 여부
let lastMouseX = 0;  // 마지막 마우스 X 좌표
let lastMouseY = 0;  // 마지막 마우스 Y 좌표

/**
 * 툴팁 요소 생성 (한 번만)
 */
function ensureTooltipElement() {
    if (tooltipElement) return tooltipElement;
    
    tooltipElement = document.createElement('div');
    tooltipElement.id = 'chat-preview-tooltip';
    tooltipElement.className = 'chat-preview-tooltip';
    tooltipElement.style.cssText = `
        position: fixed;
        display: none;
        max-width: 400px;
        max-height: 300px;
        padding: 12px 16px;
        background: rgba(20, 20, 30, 0.95);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 10px;
        color: #e0e0e0;
        font-size: 13px;
        line-height: 1.6;
        z-index: 100000;
        overflow-y: auto;
        overflow-x: hidden;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        pointer-events: none;
        white-space: pre-wrap;
        word-break: break-word;
        backdrop-filter: blur(10px);
    `;
    
    // 스크롤바 스타일 추가
    const style = document.createElement('style');
    style.textContent = `
        .chat-preview-tooltip::-webkit-scrollbar {
            width: 6px;
        }
        .chat-preview-tooltip::-webkit-scrollbar-track {
            background: rgba(255,255,255,0.05);
            border-radius: 3px;
        }
        .chat-preview-tooltip::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.2);
            border-radius: 3px;
        }
        .chat-preview-tooltip::-webkit-scrollbar-thumb:hover {
            background: rgba(255,255,255,0.3);
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(tooltipElement);
    return tooltipElement;
}

/**
 * 툴팁 표시
 * @param {string} content - 표시할 내용
 */
function showTooltip(content) {
    const tooltip = ensureTooltipElement();
    tooltip.textContent = content;
    tooltip.style.display = 'block';
    
    // 마지막 마우스 좌표 사용 (타이머 지연 후에도 정확한 위치)
    tooltip.style.left = `${lastMouseX + 15}px`;
    tooltip.style.top = `${lastMouseY + 15}px`;
}

/**
 * 툴팁 숨김
 */
function hideTooltip() {
    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
        tooltipTimeout = null;
    }
    if (tooltipElement) {
        tooltipElement.style.display = 'none';
    }
    currentTooltipTarget = null;
}

/**
 * 채팅 아이템에 툴팁 이벤트 바인딩 (PC 전용) - 이벤트 위임 방식
 * 로비 전체 컨테이너에 등록하여 탭 뷰에서도 동작
 * @param {HTMLElement} container
 */
function bindTooltipEvents(container) {
    // 모바일에서는 비활성화
    if (isMobile()) {
        return;
    }
    
    // 이미 이벤트 위임이 등록되어 있으면 스킵 (메모리 누수 방지)
    if (tooltipEventsInitialized) {
        return;
    }
    
    // 로비 전체 컨테이너에 이벤트 등록 (chatList + tabView 모두 커버)
    const lobbyContainer = document.getElementById('chat-lobby-container');
    if (!lobbyContainer) return;
    
    // 이벤트 위임: 로비 컨테이너에 한 번만 등록
    lobbyContainer.addEventListener('mouseover', handleTooltipMouseOver);
    lobbyContainer.addEventListener('mouseout', handleTooltipMouseOut);
    lobbyContainer.addEventListener('mousemove', handleTooltipMouseMove);
    lobbyContainer.addEventListener('wheel', handleTooltipWheel, { passive: false });
    
    tooltipEventsInitialized = true;
}

/**
 * 툴팁 mouseover 핸들러 (이벤트 위임)
 */
function handleTooltipMouseOver(e) {
    // 마우스 좌표 즉시 저장
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    
    const item = e.target.closest('.lobby-chat-item');
    if (!item) return;
    
    // 같은 아이템이면 스킵
    if (currentTooltipTarget === item) return;
    
    // Base64 인코딩된 preview 디코딩 (없으면 일반 fullPreview 사용)
    let fullPreview = '';
    if (item.dataset.fullPreviewEncoded) {
        try {
            fullPreview = decodeURIComponent(escape(atob(item.dataset.fullPreviewEncoded)));
        } catch (e) {
            fullPreview = '';
        }
    } else if (item.dataset.fullPreview) {
        fullPreview = item.dataset.fullPreview;
    }
    if (!fullPreview) return;
    
    // 이전 타이머 취소
    hideTooltip();
    currentTooltipTarget = item;
    
    // 딜레이 후 툴팁 표시 (300ms)
    tooltipTimeout = setTimeout(() => {
        if (currentTooltipTarget === item && fullPreview) {
            showTooltip(fullPreview);
        }
    }, 300);
}

/**
 * 툴팁 mouseout 핸들러 (이벤트 위임)
 */
function handleTooltipMouseOut(e) {
    const item = e.target.closest('.lobby-chat-item');
    if (!item) return;
    
    // relatedTarget이 같은 아이템 내부면 무시
    const relatedItem = e.relatedTarget?.closest('.lobby-chat-item');
    if (relatedItem === item) return;
    
    if (currentTooltipTarget === item) {
        hideTooltip();
    }
}

/**
 * 툴팁 wheel 핸들러 - 채팅 아이템 위에서 휠 돌리면 tooltip 스크롤
 */
function handleTooltipWheel(e) {
    // 툴팁이 표시 중일 때만 처리
    if (!tooltipElement || tooltipElement.style.display !== 'block') return;
    
    // 스크롤이 필요한지 확인
    const hasScroll = tooltipElement.scrollHeight > tooltipElement.clientHeight;
    if (!hasScroll) return;
    
    // 채팅 아이템 위에서 휠 이벤트 발생 시 tooltip 스크롤
    const item = e.target.closest('.lobby-chat-item');
    if (item && currentTooltipTarget === item) {
        e.preventDefault();
        e.stopPropagation();
        tooltipElement.scrollTop += e.deltaY;
    }
}

/**
 * 툴팁 mousemove 핸들러 (이벤트 위임)
 */
function handleTooltipMouseMove(e) {
    // 마지막 마우스 좌표 항상 저장 (타이머 지연 후에도 사용)
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    
    const item = e.target.closest('.lobby-chat-item');
    if (!item) return;
    
    // 툴팁이 표시 중이면 위치 업데이트
    if (tooltipElement && tooltipElement.style.display === 'block' && currentTooltipTarget === item) {
        tooltipElement.style.left = `${e.clientX + 15}px`;
        tooltipElement.style.top = `${e.clientY + 15}px`;
    }
}

// ============================================
// Cleanup
// ============================================

/**
 * 툴팁 정리 (메모리 누수 방지)
 * 로비 닫힐 때 호출
 */
export function cleanupTooltip() {
    hideTooltip();
    
    // 이벤트 위임 리스너 제거 (로비 컨테이너에서)
    const lobbyContainer = document.getElementById('chat-lobby-container');
    if (lobbyContainer && tooltipEventsInitialized) {
        lobbyContainer.removeEventListener('mouseover', handleTooltipMouseOver);
        lobbyContainer.removeEventListener('mouseout', handleTooltipMouseOut);
        lobbyContainer.removeEventListener('mousemove', handleTooltipMouseMove);
        lobbyContainer.removeEventListener('wheel', handleTooltipWheel);
    }
    tooltipEventsInitialized = false;
    
    if (tooltipElement && tooltipElement.parentNode) {
        tooltipElement.parentNode.removeChild(tooltipElement);
    }
    tooltipElement = null;
    currentTooltipTarget = null;
}

// ============================================
// 초기화
// ============================================

/**
 * 채팅 핸들러 설정
 * @param {{ onOpen: Function, onDelete: Function }} handlers
 */
export function setChatHandlers(handlers) {
    store.setChatHandlers(handlers);
}

/**
 * 현재 선택된 캐릭터 반환
 * @returns {Object|null}
 */
export function getCurrentCharacter() {
    return store.currentCharacter;
}

// ============================================
// 채팅 목록 렌더링
// ============================================

/**
 * 채팅 목록 렌더링
 * @param {Object} character - 캐릭터 정보
 * @returns {Promise<void>}
 */
export async function renderChatList(character) {
    console.debug('[ChatList] renderChatList called:', character?.avatar);
    
    if (!character || !character.avatar) {
        console.error('[ChatList] Invalid character data:', character);
        return;
    }
    
    const chatsPanel = document.getElementById('chat-lobby-chats');
    const chatsList = document.getElementById('chat-lobby-chats-list');
    
    console.debug('[ChatList] chatsPanel:', !!chatsPanel, 'chatsList:', !!chatsList);
    console.debug('[ChatList] currentCharacter:', store.currentCharacter?.avatar);
    console.debug('[ChatList] panelVisible:', chatsPanel?.classList.contains('visible'));
    
    // 이미 같은 캐릭터의 채팅 패널이 열려있고 캐시도 유효하면 렌더 스킵
    if (store.currentCharacter?.avatar === character.avatar 
        && chatsPanel?.classList.contains('visible')
        && cache.isValid('chats', character.avatar)) {
        console.debug('[ChatList] Skipping - same character already visible with valid cache');
        return;
    }
    
    store.setCurrentCharacter(character);
    
    if (!chatsPanel || !chatsList) {
        console.error('[ChatList] Chat panel elements not found');
        return;
    }
    
    // UI 표시
    chatsPanel.classList.add('visible');
    updateChatHeader(character);
    showFolderBar(true);
    
    // 🔥 분기 버튼 초기 visibility 설정 (저장된 정렬 옵션 확인)
    const savedSortOption = storage.getSortOption();
    const branchRefreshBtn = document.getElementById('chat-lobby-branch-refresh');
    if (branchRefreshBtn) {
        branchRefreshBtn.style.display = savedSortOption === 'branch' ? 'flex' : 'none';
    }

    // 페르소나 퀵버튼 업데이트
    console.debug('[ChatList] Updating persona quick button for:', character.avatar);
    updatePersonaQuickButton(character.avatar);
    
    // 캐시된 데이터가 있고 유효하면 즉시 렌더링 (번첩임 방지)
    const cachedChats = cache.get('chats', character.avatar);
    
    if (cachedChats && cachedChats.length > 0 && cache.isValid('chats', character.avatar)) {
        renderChats(chatsList, cachedChats, character.avatar);
        return; // 캐시 유효하면 API 호출 안 함
    }
    
    // 캐시 없으면 로딩 표시 후 API 호출
    chatsList.innerHTML = '<div class="lobby-loading">채팅 로딩 중...</div>';
    
    try {
        // 최신 데이터 가져오기
        const chats = await api.fetchChatsForCharacter(character.avatar);
        
        if (!chats || chats.length === 0) {
            updateChatCount(0);
            chatsList.innerHTML = `
                <div class="lobby-empty-state">
                    <i>💬</i>
                    <div>채팅 기록이 없습니다</div>
                    <div style="font-size: 0.9em; margin-top: 5px;">새 채팅을 시작해보세요!</div>
                </div>
            `;
            return;
        }
        
        renderChats(chatsList, chats, character.avatar);
    } catch (error) {
        console.error('[ChatList] Failed to load chats:', error);
        showToast('채팅 목록을 불러오지 못했습니다.', 'error');
        chatsList.innerHTML = `
            <div class="lobby-empty-state">
                <i>⚠️</i>
                <div>채팅 목록 로딩 실패</div>
                <button onclick="window.chatLobbyRefresh()" style="margin-top:10px;padding:8px 16px;cursor:pointer;">다시 시도</button>
            </div>
        `;
    }
}

/**
 * 채팅 목록 내부 렌더링
 * @param {HTMLElement} container
 * @param {Array|Object} rawChats
 * @param {string} charAvatar
 * @param {boolean} [skipAutoAnalyze=false] - 재귀 방지용
 */
function renderChats(container, rawChats, charAvatar, skipAutoAnalyze = false) {
    // 배열로 변환
    let chatArray = normalizeChats(rawChats);
    
    // 유효한 채팅만 필터링
    chatArray = filterValidChats(chatArray);
    
    // 💡 hasChats는 필터 전 전체 수로 설정 (새 채팅 버튼용)
    const totalChatCount = chatArray.length;
    updateHasChats(totalChatCount);
    
    if (chatArray.length === 0) {
        console.debug('[renderChats] No valid chats, showing empty state');
        updateChatCount(0);
        container.innerHTML = `
            <div class="lobby-empty-state">
                <i>💬</i>
                <div>채팅 기록이 없습니다</div>
            </div>
        `;
        return;
    }
    
    // 폴더 필터 적용
    const filterFolder = storage.getFilterFolder();
    if (filterFolder !== 'all') {
        chatArray = filterByFolder(chatArray, charAvatar, filterFolder);
    }
    
    // 정렬 적용
    const sortOption = storage.getSortOption();
    chatArray = sortChats(chatArray, charAvatar, sortOption);
    
    updateChatCount(chatArray.length);
    
    // 필터 결과가 0이면 빈 상태 표시
    if (chatArray.length === 0) {
        container.innerHTML = `
            <div class="lobby-empty-state">
                <i>📁</i>
                <div>이 폴더에는 채팅이 없습니다</div>
            </div>
        `;
        return;
    }
    
    // 브랜치 모드면 분석 버튼 추가 또는 자동 분석
    let branchAnalyzeBtn = '';
    if (sortOption === 'branch' && chatArray.length >= 2) {
        const needsAnalysis = needsBranchAnalysis(charAvatar, chatArray);
        if (needsAnalysis && !skipAutoAnalyze) {
            // 새 채팅이 적으면 자동 분석, 많으면 버튼 표시
            const newCount = countNewChatsForAnalysis(charAvatar, chatArray);
            
            if (newCount > 0 && newCount <= 3) {
                // 자동 백그라운드 분석 (3개 이하)
                setTimeout(() => {
                    autoAnalyzeBranches(container, charAvatar, chatArray);
                }, 100);
                branchAnalyzeBtn = `
                    <div class="branch-analyze-bar" data-char-avatar="${escapeHtml(charAvatar)}">
                        <span class="branch-analyze-status">⏳ 새 채팅 ${newCount}개 자동 분석 중...</span>
                    </div>
                `;
            } else if (newCount > 3) {
                branchAnalyzeBtn = `
                    <div class="branch-analyze-bar" data-char-avatar="${escapeHtml(charAvatar)}">
                        <button class="branch-analyze-btn" title="채팅 내용을 분석하여 분기 관계를 파악합니다">
                            🔍 분기 분석하기 (${newCount}개)
                        </button>
                        <span class="branch-analyze-status"></span>
                    </div>
                `;
            }
        }
    }
    
    container.innerHTML = branchAnalyzeBtn + chatArray.map((chat, idx) => 
        renderChatItem(chat, charAvatar, idx)
    ).join('');
    
    // 브랜치 분석 버튼 이벤트
    bindBranchAnalyzeEvents(container, charAvatar, chatArray);
    
    bindChatEvents(container, charAvatar);
    
    // PC에서 툴팁 이벤트 바인딩
    bindTooltipEvents(container);
    
    // 드롭다운 동기화
    syncDropdowns(filterFolder, sortOption);
}

/**
 * 브랜치 분석 버튼 이벤트 바인딩
 * @param {HTMLElement} container
 * @param {string} charAvatar
 * @param {Array} chats
 */
function bindBranchAnalyzeEvents(container, charAvatar, chats) {
    const btn = container.querySelector('.branch-analyze-btn');
    const statusEl = container.querySelector('.branch-analyze-status');
    
    if (!btn) return;
    
    btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = '⏳ 분석 중...';
        
        try {
            await analyzeBranches(charAvatar, chats, (progress) => {
                const percent = Math.round(progress * 100);
                if (statusEl) {
                    statusEl.textContent = `${percent}%`;
                }
            });
            
            showToast('분기 분석 완료! 목록을 새로고침합니다.', 'success');
            
            // 분석 완료 후 다시 렌더링
            const analyzeBar = container.querySelector('.branch-analyze-bar');
            if (analyzeBar) analyzeBar.remove();
            
            // 현재 캐릭터 채팅 목록 다시 렌더링 (skipAutoAnalyze=true로 재귀 방지)
            const cachedChats = cache.get('chats', charAvatar);
            if (cachedChats) {
                renderChats(container, cachedChats, charAvatar, true);
            }
        } catch (e) {
            console.error('[BranchAnalyze] Error:', e);
            showToast('분기 분석 실패', 'error');
            btn.disabled = false;
            btn.textContent = '🔍 분기 분석하기';
        }
    });
}

/**
 * 분석이 필요한 새 채팅 수 카운트
 * @param {string} charAvatar
 * @param {Array} chats
 * @returns {number}
 */
function countNewChatsForAnalysis(charAvatar, chats) {
    const fingerprints = getAllFingerprints(charAvatar);
    let count = 0;
    
    for (const chat of chats) {
        const fn = chat.file_name || '';
        if (!fingerprints[fn]) {
            count++;
        }
    }
    
    return count;
}

/**
 * 자동 백그라운드 분석 (새 채팅이 적을 때)
 * @param {HTMLElement} container
 * @param {string} charAvatar
 * @param {Array} chats
 */
async function autoAnalyzeBranches(container, charAvatar, chats) {
    if (chats.length < 2) return;
    try {
        await analyzeBranches(charAvatar, chats);
        
        // 분석 완료 후 캐릭터가 바뀌었는지 확인 (stale data 방지)
        if (store.currentCharacter?.avatar !== charAvatar) {
            console.debug('[AutoBranchAnalyze] Character changed during analysis, skipping re-render');
            return;
        }
        
        // 분석 완료 후 다시 렌더링 (skipAutoAnalyze=true로 재귀 방지)
        const cachedChats = cache.get('chats', charAvatar);
        if (cachedChats) {
            renderChats(container, cachedChats, charAvatar, true);
        }
    } catch (e) {
        console.error('[AutoBranchAnalyze] Error:', e);
        // 자동 분석 실패 시 버튼으로 전환
        const statusEl = container.querySelector('.branch-analyze-status');
        if (statusEl) {
            statusEl.innerHTML = `<button class="branch-analyze-btn">🔍 분기 분석하기</button>`;
            bindBranchAnalyzeEvents(container, charAvatar, chats);
        }
    }
}

/**
 * 채팅 데이터 정규화
 * @param {Array|Object} chats
 * @returns {Array}
 */
function normalizeChats(chats) {
    if (Array.isArray(chats)) return [...chats];
    
    if (typeof chats === 'object') {
        return Object.entries(chats).map(([key, value]) => {
            if (typeof value === 'object') {
                return { ...value, file_name: value.file_name || key };
            }
            return { file_name: key, ...value };
        });
    }
    
    return [];
}

/**
 * 유효한 채팅만 필터링
 * @param {Array} chats
 * @returns {Array}
 */
function filterValidChats(chats) {
    return chats.filter(chat => {
        const fileName = chat?.file_name || chat?.fileName || '';
        const hasJsonl = fileName.includes('.jsonl');
        // 날짜 패턴 체크 제거 - 사용자가 채팅 이름을 변경해도 정상 인식되도록
        return fileName && 
               hasJsonl &&
               !fileName.startsWith('chat_') &&
               fileName.toLowerCase() !== 'error';
    });
}

/**
 * 폴더별 필터링
 * @param {Array} chats
 * @param {string} charAvatar
 * @param {string} filterFolder
 * @returns {Array}
 */
function filterByFolder(chats, charAvatar, filterFolder) {
    
    const data = storage.load();
    
    const result = chats.filter(chat => {
        const fn = chat.file_name || chat.fileName || '';
        const key = storage.getChatKey(charAvatar, fn);
        
        if (filterFolder === 'favorites') {
            const isFav = data.favorites.includes(key);
            return isFav;
        }
        
        const assigned = data.chatAssignments[key] || 'uncategorized';
        const match = assigned === filterFolder;
        return match;
    });
    
    return result;
}

/**
 * 채팅 정렬
 * @param {Array} chats
 * @param {string} charAvatar
 * @param {string} sortOption
 * @returns {Array}
 */
function sortChats(chats, charAvatar, sortOption) {
    const data = storage.load();
    
        // 분기로 보기 모드 - 캐시된 브랜치 정보 사용
        if (sortOption === 'branch') {
            return sortByBranchTreeCached(chats, charAvatar, data);
        }
        
        return [...chats].sort((a, b) => {
            const fnA = a.file_name || '';
            const fnB = b.file_name || '';
            
            // 즐겨찾기 우선
            const keyA = storage.getChatKey(charAvatar, fnA);
            const keyB = storage.getChatKey(charAvatar, fnB);
            const favA = data.favorites.includes(keyA) ? 0 : 1;
            const favB = data.favorites.includes(keyB) ? 0 : 1;
            if (favA !== favB) return favA - favB;
            
            if (sortOption === 'name') {
                return fnA.localeCompare(fnB, 'ko');
            }
            
            if (sortOption === 'messages') {
                const msgA = a.message_count || a.mes_count || a.chat_items || 0;
                const msgB = b.message_count || b.mes_count || b.chat_items || 0;
                return msgB - msgA;
            }
            
            // 기본: 날짜순
            return getTimestamp(b) - getTimestamp(a);
        });
    }

    /**
     * 채팅 파일명에서 브랜치 정보 파싱 (파일명 기반 - 백업용)
     * 패턴:
     * - 원본: "해루 - 2026-01-07@23h38m10s.jsonl"
     * - 브랜치: "Branch #5 - 2026-01-20@01h10m03s.jsonl"
     * 
     * @param {string} fileName
     * @returns {{ branch: string|null, depth: number, isOriginal: boolean }}
     */
    function parseBranchInfoFromName(fileName) {
        const cleanName = fileName.replace('.jsonl', '');
        
        // Branch #숫자 또는 Branch #숫자-숫자 패턴 찾기
        const branchMatch = cleanName.match(/^Branch\s*#(\d+(?:-\d+)*)\s*-/i);
        
        if (!branchMatch) {
            return { branch: null, depth: 0, isOriginal: true };
        }
        
        const branchPart = branchMatch[1];
        const branchSegments = branchPart.split('-');
        
        return {
            branch: branchPart,
            depth: branchSegments.length,
            isOriginal: false
        };
    }

    /**
     * 캐시된 브랜치 정보 사용하여 트리 구조로 정렬
     * @param {Array} chats
     * @param {string} charAvatar
     * @param {Object} data - storage 데이터
     * @returns {Array}
     */
    function sortByBranchTreeCached(chats, charAvatar, data) {
        const branches = getAllBranches(charAvatar);
        
        // 각 채팅에 브랜치 정보 추가
        const chatsWithBranch = chats.map(chat => {
            const fileName = chat.file_name || '';
            const branchInfo = branches[fileName];
            
            // 캐시에 있으면 사용, 없으면 파일명으로 판단
            if (branchInfo) {
                return {
                    ...chat,
                    _branchInfo: {
                        parentChat: branchInfo.parentChat,
                        branchPoint: branchInfo.branchPoint,
                        depth: branchInfo.depth || 1,
                        isOriginal: false
                    }
                };
            } else {
                // 캐시 없음 → 그룹 루트이거나 미분석 채팅 → 항상 original 취급
                // (분석된 브랜치는 반드시 캐시에 존재하므로, 캐시 미스 = 루트)
                return {
                    ...chat,
                    _branchInfo: {
                        parentChat: null,
                        branchPoint: 0,
                        depth: 0,
                        isOriginal: true
                    }
                };
            }
        });
        
        // 원본과 브랜치 분리
        const originals = chatsWithBranch.filter(c => c._branchInfo.isOriginal);
        const branchList = chatsWithBranch.filter(c => !c._branchInfo.isOriginal);
        
        // 원본: 즐겨찾기 우선, 날짜순
        originals.sort((a, b) => {
            const fnA = a.file_name || '';
            const fnB = b.file_name || '';
            const keyA = storage.getChatKey(charAvatar, fnA);
            const keyB = storage.getChatKey(charAvatar, fnB);
            const favA = data.favorites.includes(keyA) ? 0 : 1;
            const favB = data.favorites.includes(keyB) ? 0 : 1;
            if (favA !== favB) return favA - favB;
            return getTimestamp(b) - getTimestamp(a);
        });
        
        // 브랜치: depth 순 → 날짜순
        branchList.sort((a, b) => {
            const depthDiff = a._branchInfo.depth - b._branchInfo.depth;
            if (depthDiff !== 0) return depthDiff;
            return getTimestamp(b) - getTimestamp(a);
        });
        
        // 트리 구조로 재배치: 재귀적으로 부모-자식 체인 따라가기
        const result = [];
        const usedBranches = new Set();
        
        /**
         * 재귀적으로 자식 브랜치 추가
         * @param {string} parentFileName
         */
        function addChildBranches(parentFileName) {
            // 이 부모의 직접 자식들 찾기
            const children = branchList.filter(b => 
                b._branchInfo.parentChat === parentFileName && !usedBranches.has(b.file_name)
            );
            
            // depth 순, 날짜순 정렬
            children.sort((a, b) => {
                const depthDiff = a._branchInfo.depth - b._branchInfo.depth;
                if (depthDiff !== 0) return depthDiff;
                return getTimestamp(b) - getTimestamp(a);
            });
            
            for (const child of children) {
                result.push(child);
                usedBranches.add(child.file_name);
                
                // 이 자식의 자식도 재귀적으로 추가
                addChildBranches(child.file_name);
            }
        }
        
        // 각 원본에 대해 트리 구성
        for (const original of originals) {
            result.push(original);
            addChildBranches(original.file_name);
        }
        
        // 남은 브랜치 (부모를 못 찾은 경우 - 원본이 삭제됐거나)
        for (const branch of branchList) {
            if (!usedBranches.has(branch.file_name)) {
                result.push(branch);
                usedBranches.add(branch.file_name);
                // 이 고아 브랜치의 자식들도 추가
                addChildBranches(branch.file_name);
            }
        }
        
        return result;
    }

/**
 * 채팅 아이템 HTML 생성
 * @param {Object} chat
 * @param {string} charAvatar
 * @param {number} index
 * @returns {string}
 */
function renderChatItem(chat, charAvatar, index) {
    const fileName = chat.file_name || chat.fileName || chat.name || `chat_${index}`;
    const displayName = fileName.replace('.jsonl', '');
    
    // 미리보기
    const preview = chat.preview || chat.mes || chat.last_message || '채팅 기록';
    
    // 메시지 수
    const messageCount = chat.chat_items || chat.message_count || chat.mes_count || 0;
    
    // 즐겨찾기/폴더 상태
    const isFav = storage.isFavorite(charAvatar, fileName);
    const folderId = storage.getChatFolder(charAvatar, fileName);
    const data = storage.load();
    const folder = data.folders.find(f => f.id === folderId);
    const folderName = folder?.name || '';
    
    // 툴팁용 미리보기 (전체 표시)
    const tooltipPreview = preview;
    const safeAvatar = escapeHtml(charAvatar || '');
    const safeFileName = escapeHtml(fileName || '');
    // 툴팁용 전문 - Base64 인코딩 (따옴표 문제 방지)
    const safeFullPreview = tooltipPreview ? btoa(unescape(encodeURIComponent(tooltipPreview))) : '';
    
    // 브랜치 정보 (분기로 보기 모드일 때 _branchInfo가 있음)
    const branchInfo = chat._branchInfo;
    const branchDepth = branchInfo?.depth || 0;
    const isBranch = branchInfo && !branchInfo.isOriginal;
    const branchPoint = branchInfo?.branchPoint || 0;
    
    // 브랜치면 왼쪽에 갭(margin) 추가 + 색상 변경
    const depthIndent = isBranch ? Math.min(branchDepth, 5) * 16 : 0;
    const indentStyle = isBranch ? `margin-left: ${depthIndent}px;` : '';
    const branchClass = branchInfo ? 'branch-mode' : '';
    const branchBadge = isBranch 
        ? `<span class="branch-badge" title="분기점: ${branchPoint}번째 메시지">↳ 분기${branchPoint > 0 ? ` @${branchPoint}` : ''}</span>`
        : '';
    
    return `
    <div class="lobby-chat-item ${isFav ? 'is-favorite' : ''} ${branchClass} ${isBranch ? 'is-branch' : ''}" 
         data-file-name="${safeFileName}" 
         data-char-avatar="${safeAvatar}" 
         data-chat-index="${index}" 
         data-folder-id="${folderId}"
         data-branch-depth="${branchDepth}"
         data-branch-point="${branchPoint}"
         data-full-preview-encoded="${safeFullPreview}"
         style="${indentStyle}">
        <button class="chat-fav-btn" title="즐겨찾기">${isFav ? '★' : '☆'}</button>
        <div class="chat-content">
            <div class="chat-name">${branchBadge}${escapeHtml(displayName)}</div>
            <div class="chat-preview">${escapeHtml(truncateText(preview, 80))}</div>
            <div class="chat-meta">
                ${messageCount > 0 ? `<span>💬 ${messageCount}개</span>` : ''}
                ${folderName && folderId !== 'uncategorized' ? `<span class="chat-folder-tag">${escapeHtml(folderName)}</span>` : ''}
            </div>
        </div>
        <div class="chat-actions">
            <button class="chat-folder-btn" title="폴더 이동">⋮</button>
            <button class="chat-delete-btn" title="채팅 삭제">🗑️</button>
        </div>
    </div>
    `;
}

/**
 * 채팅 아이템 이벤트 바인딩
 * @param {HTMLElement} container
 * @param {string} charAvatar
 */
function bindChatEvents(container, charAvatar) {
    const items = container.querySelectorAll('.lobby-chat-item');
    console.debug('[ChatList] bindChatEvents: items count =', items.length, 'charAvatar =', charAvatar);
    
    items.forEach((item, index) => {
        const chatContent = item.querySelector('.chat-content');
        const favBtn = item.querySelector('.chat-fav-btn');
        const delBtn = item.querySelector('.chat-delete-btn');
        const fileName = item.dataset.fileName;
        
        console.debug('[ChatList] Binding item', index, ':', { fileName, hasChatContent: !!chatContent });
        
        if (!chatContent) {
            console.error('[ChatList] chatContent not found for item', index);
            return;
        }
        
        // 채팅 열기
        createTouchClickHandler(chatContent, () => {
            console.debug('[ChatList] Chat item clicked!', { fileName, charAvatar: item.dataset.charAvatar });
            
            if (store.batchModeActive) {
                const cb = item.querySelector('.chat-select-cb');
                if (cb) {
                    cb.checked = !cb.checked;
                    updateBatchCount();
                }
                return;
            }
            
            const handlers = store.chatHandlers;
            console.debug('[ChatList] handlers =', handlers, 'onOpen =', !!handlers?.onOpen);
            
            if (handlers?.onOpen) {
                // currentCharacter가 null인 경우 dataset에서 가져오기
                const charIndex = store.currentCharacter?.index || item.dataset.charIndex || null;
                
                const chatInfo = {
                    fileName: item.dataset.fileName,
                    charAvatar: item.dataset.charAvatar,
                    charIndex: charIndex
                };
                
                console.debug('[ChatList] Calling onOpen:', chatInfo);
                handlers.onOpen(chatInfo);
            } else {
                console.error('[ChatList] onOpen handler not available!');
            }
        }, { preventDefault: true, stopPropagation: true, debugName: `chat-${index}` });
        
        // 즐겨찾기 토글
        createTouchClickHandler(favBtn, () => {
            const fn = item.dataset.fileName;
            const isNowFav = storage.toggleFavorite(charAvatar, fn);
            favBtn.textContent = isNowFav ? '★' : '☆';
            item.classList.toggle('is-favorite', isNowFav);
        }, { debugName: `fav-${index}` });
        
        // 폴더 이동 버튼
        const folderBtn = item.querySelector('.chat-folder-btn');
        if (folderBtn) {
            createTouchClickHandler(folderBtn, (e) => {
                e.stopPropagation();
                showChatFolderMenu(folderBtn, charAvatar, fileName);
            }, { debugName: `folder-${index}` });
        }
        
        // 삭제
        createTouchClickHandler(delBtn, () => {
            const handlers = store.chatHandlers;
            if (handlers?.onDelete) {
                handlers.onDelete({
                    fileName: item.dataset.fileName,
                    charAvatar: item.dataset.charAvatar,
                    element: item
                });
            }
        }, { debugName: `del-${index}` });
    });
}

// ============================================
// UI 헬퍼
// ============================================

/**
 * 채팅 헤더 업데이트
 * @param {Object} character
 */
function updateChatHeader(character) {
    const avatarImg = document.getElementById('chat-panel-avatar');
    const nameEl = document.getElementById('chat-panel-name');
    const deleteBtn = document.getElementById('chat-lobby-delete-char');
    const newChatBtn = document.getElementById('chat-lobby-new-chat');
    
    if (avatarImg) {
        avatarImg.style.display = 'block';
        avatarImg.src = character.avatarSrc;
    }
    if (nameEl) nameEl.textContent = character.name;
    if (deleteBtn) {
        deleteBtn.style.display = 'block';
        deleteBtn.dataset.charAvatar = character.avatar;  // 레이스컨디션 방지
        deleteBtn.dataset.charName = character.name;
    }
    if (newChatBtn) {
        newChatBtn.style.display = 'block';
        newChatBtn.dataset.charIndex = character.index;
        newChatBtn.dataset.charAvatar = character.avatar;
        newChatBtn.dataset.isGroup = 'false';  // 캐릭터로 표시
        // 그룹 데이터 초기화
        delete newChatBtn.dataset.groupId;
        delete newChatBtn.dataset.groupName;
    }
    
    document.getElementById('chat-panel-count').textContent = '채팅 로딩 중...';
    
    // 캐릭터 태그 표시
    renderCharacterTags(character.avatar);
}

/**
 * 캐릭터의 태그 가져오기 (SillyTavern 원본에서)
 * @param {string} charAvatar - 캐릭터 아바타 파일명
 * @returns {string[]}
 */
function getCharacterTags(charAvatar) {
    const context = api.getContext();
    if (!context?.tagMap || !context?.tags || !charAvatar) {
        return [];
    }
    
    const tagIds = context.tagMap[charAvatar] || [];
    return tagIds.map(tagId => {
        const tag = context.tags.find(t => t.id === tagId);
        return tag?.name || null;
    }).filter(Boolean);
}

/**
 * 캐릭터 태그바 렌더링
 * @param {string} charAvatar - 캐릭터 아바타 파일명
 */
function renderCharacterTags(charAvatar) {
    const filtersSection = document.getElementById('chat-lobby-filters');
    const container = document.getElementById('chat-lobby-char-tags');
    if (!container || !filtersSection) return;
    
    const tags = getCharacterTags(charAvatar);
    
    // 필터 섹션 표시
    filtersSection.style.display = 'block';
    
    if (tags.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
    } else {
        container.style.display = 'flex';
        container.innerHTML = tags.map(tag => 
            `<span class="lobby-char-tag">#${escapeHtml(tag)}</span>`
        ).join('');
    }
}

/**
 * 채팅 수 업데이트 (필터 후 표시용)
 * @param {number} count
 */
function updateChatCount(count) {
    const el = document.getElementById('chat-panel-count');
    if (el) el.textContent = count > 0 ? `${count}개 채팅` : '채팅 없음';
}

/**
 * hasChats 업데이트 (필터 전 전체 수, 새 채팅 버튼용)
 * @param {number} totalCount
 */
function updateHasChats(totalCount) {
    const newChatBtn = document.getElementById('chat-lobby-new-chat');
    if (newChatBtn) newChatBtn.dataset.hasChats = totalCount > 0 ? 'true' : 'false';
}

/**
 * 폴더 바 표시/숨김
 * @param {boolean} visible
 */
function showFolderBar(visible) {
    const filtersSection = document.getElementById('chat-lobby-filters');
    if (filtersSection) filtersSection.style.display = visible ? 'block' : 'none';
}

/**
 * 드롭다운 동기화
 * @param {string} filterValue
 * @param {string} sortValue
 */
function syncDropdowns(filterValue, sortValue) {
    const filterSelect = document.getElementById('chat-lobby-folder-filter');
    const sortSelect = document.getElementById('chat-lobby-chat-sort');
    
    if (filterSelect) filterSelect.value = filterValue;
    if (sortSelect) sortSelect.value = sortValue;
}

// ============================================
// 필터/정렬 변경 핸들러
// ============================================

/**
 * 폴더 필터 변경
 * @param {string} filterValue
 */
export function handleFilterChange(filterValue) {
    storage.setFilterFolder(filterValue);
    refreshCurrentChatList();
}

// ============================================
// 폴더 이동 메뉴
// ============================================

let activeFolderMenu = null;

/**
 * 채팅 폴더 이동 메뉴 표시
 */
function showChatFolderMenu(targetBtn, charAvatar, fileName) {
    // 기존 메뉴 닫기
    if (activeFolderMenu) {
        activeFolderMenu.remove();
        activeFolderMenu = null;
    }
    
    const data = storage.load();
    const folders = (data.folders || []).filter(f => f.id !== 'favorites' && f.id !== 'uncategorized');
    const currentFolderId = storage.getChatFolder(charAvatar, fileName);
    
    const menu = document.createElement('div');
    menu.className = 'chat-folder-menu';
    menu.innerHTML = `
        <div class="folder-menu-title">폴더 이동</div>
        <div class="folder-menu-item ${!currentFolderId ? 'active' : ''}" data-folder-id="">
            📤 폴더에서 제거
        </div>
        ${folders.map(f => `
            <div class="folder-menu-item ${f.id === currentFolderId ? 'active' : ''}" data-folder-id="${f.id}">
                📁 ${escapeHtml(f.name)}
            </div>
        `).join('')}
    `;
    
    // 위치 설정
    const rect = targetBtn.getBoundingClientRect();
    menu.style.cssText = `
        position: fixed;
        top: ${rect.bottom + 4}px;
        right: ${window.innerWidth - rect.right}px;
        z-index: 10001;
        background: var(--lobby-bg-card, #1a1a2e);
        border: 1px solid var(--lobby-border, #333);
        border-radius: 10px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        min-width: 150px;
        overflow: hidden;
    `;
    
    document.body.appendChild(menu);
    activeFolderMenu = menu;
    
    // 이벤트
    menu.querySelectorAll('.folder-menu-item').forEach(item => {
        item.addEventListener('click', async () => {
            const folderId = item.dataset.folderId;
            if (folderId) {
                storage.setChatFolder(charAvatar, fileName, folderId);
                const folder = folders.find(f => f.id === folderId);
                showToast(`📁 ${folder?.name || '폴더'}로 이동`, 'success');
            } else {
                storage.setChatFolder(charAvatar, fileName, null);
                showToast('폴더에서 제거됨', 'success');
            }
            closeChatFolderMenu();
            await refreshCurrentChatList();
        });
    });
    
    // 외부 클릭 시 닫기
    setTimeout(() => {
        document.addEventListener('click', closeFolderMenuOnClickOutside);
    }, 10);
}

function closeFolderMenuOnClickOutside(e) {
    if (activeFolderMenu && !activeFolderMenu.contains(e.target)) {
        closeChatFolderMenu();
    }
}

function closeChatFolderMenu() {
    if (activeFolderMenu) {
        activeFolderMenu.remove();
        activeFolderMenu = null;
    }
    document.removeEventListener('click', closeFolderMenuOnClickOutside);
}

/**
 * 정렬 옵션 변경
 * @param {string} sortValue
 */
export function handleSortChange(sortValue) {
    storage.setSortOption(sortValue);
    
    // 분기 새로고침 버튼 visibility 토글
    const branchRefreshBtn = document.getElementById('chat-lobby-branch-refresh');
    if (branchRefreshBtn) {
        branchRefreshBtn.style.display = sortValue === 'branch' ? 'flex' : 'none';
    }
    
    refreshCurrentChatList();
}

/**
 * 현재 채팅 목록 새로고침 (정렬/필터 변경 시)
 * @param {boolean} forceReload - 강제로 API에서 다시 가져오기
 */
export async function refreshCurrentChatList(forceReload = false) {
    const character = store.currentCharacter;
    if (!character) return;
    
    const chatsList = document.getElementById('chat-lobby-chats-list');
    if (!chatsList) return;
    
    // 강제 새로고침이면 API에서 다시 가져오기
    if (forceReload) {
        chatsList.innerHTML = '<div class="lobby-loading">채팅 로딩 중...</div>';
        try {
            const chats = await api.fetchChatsForCharacter(character.avatar, true);
            if (chats && chats.length > 0) {
                renderChats(chatsList, chats, character.avatar);
            } else {
                chatsList.innerHTML = '<div class="lobby-empty-state"><i>💬</i><div>채팅 기록이 없습니다</div></div>';
            }
        } catch (error) {
            console.error('[ChatList] Failed to reload chats:', error);
        }
        return;
    }
    
    // 캐시된 데이터로 바로 다시 렌더링
    const cachedChats = cache.get('chats', character.avatar);
    if (cachedChats) {
        // 캐시가 있으면 즉시 렌더링 (빈 배열도 렌더링)
        renderChats(chatsList, cachedChats, character.avatar);
    } else {
        // 캐시가 없으면 전체 재렌더
        await renderChatList(character);
    }
}

// ============================================
// 배치 모드
// ============================================

/**
 * 배치 모드 토글
 */
export function toggleBatchMode() {
    const isActive = store.toggleBatchMode();
    
    const chatsList = document.getElementById('chat-lobby-chats-list');
    const toolbar = document.getElementById('chat-lobby-batch-toolbar');
    const batchBtn = document.getElementById('chat-lobby-batch-mode');
    
    
    if (isActive) {
        chatsList?.classList.add('batch-mode');
        toolbar?.classList.add('visible');
        batchBtn?.classList.add('active');
        chatsList?.querySelectorAll('.chat-checkbox').forEach(cb => cb.style.display = 'block');
    } else {
        chatsList?.classList.remove('batch-mode');
        toolbar?.classList.remove('visible');
        batchBtn?.classList.remove('active');
        chatsList?.querySelectorAll('.chat-checkbox').forEach(cb => {
            cb.style.display = 'none';
            cb.querySelector('input').checked = false;
        });
    }
    
    updateBatchCount();
}

/**
 * 배치 선택 수 업데이트
 */
export function updateBatchCount() {
    const count = document.querySelectorAll('.chat-select-cb:checked').length;
    const countSpan = document.getElementById('batch-selected-count');
    if (countSpan) countSpan.textContent = `${count}개 선택`;
}

/**
 * 배치 이동 실행
 * @param {string} targetFolder
 */
export async function executeBatchMove(targetFolder) {
    
    if (!targetFolder) {
        await showAlert('이동할 폴더를 선택하세요.');
        return;
    }
    
    const checked = document.querySelectorAll('.chat-select-cb:checked');
    
    const keys = [];
    
    checked.forEach((cb, idx) => {
        const item = cb.closest('.lobby-chat-item');
        if (item) {
            const key = storage.getChatKey(item.dataset.charAvatar, item.dataset.fileName);
            keys.push(key);
        }
    });
    
    
    if (keys.length === 0) {
        await showAlert('이동할 채팅을 선택하세요.');
        return;
    }
    
    storage.moveChatsBatch(keys, targetFolder);
    
    toggleBatchMode();
    showToast(`${keys.length}개 채팅이 이동되었습니다.`, 'success');
    
    // 폴더 필터 드롭다운 업데이트 (캐릭터 캐시는 유지)
    const filterSelect = document.getElementById('chat-lobby-folder-filter');
    if (filterSelect) {
        const currentValue = filterSelect.value;
        filterSelect.innerHTML = getFoldersOptionsHTML(currentValue);
    }
    
    // 채팅 목록만 재렌더 (캐시된 채팅 데이터로 필터/정렬만 다시 적용)
    await refreshCurrentChatList();
    
}

/**
 * 배치 모드 활성화 여부
 * @returns {boolean}
 */
export function isBatchMode() {
    return store.batchModeActive;
}

// ============================================
// 채팅 목록 관리
// ============================================

/**
 * 채팅 목록 새로고침
 * @returns {Promise<void>}
 */
export async function refreshChatList() {
    const character = store.currentCharacter;
    if (character) {
        cache.invalidate('chats', character.avatar);
        await renderChatList(character);
    }
}

/**
 * 채팅 패널 닫기
 */
export function closeChatPanel() {
    const chatsPanel = document.getElementById('chat-lobby-chats');
    if (chatsPanel) chatsPanel.classList.remove('visible');
    store.setCurrentCharacter(null);
    store.setCurrentGroup(null);
}

// ============================================
// 그룹 채팅 목록
// ============================================

/**
 * 그룹 채팅 목록 렌더링
 * @param {Object} group - 그룹 정보
 * @returns {Promise<void>}
 */
export async function renderGroupChatList(group) {
    console.debug('[ChatList] renderGroupChatList called:', { 
        groupId: group?.id, 
        groupName: group?.name,
        currentGroupId: store.currentGroup?.id,
        isPanelVisible: document.getElementById('chat-lobby-chats')?.classList.contains('visible')
    });
    
    if (!group || !group.id) {
        console.error('[ChatList] Invalid group data:', group);
        return;
    }
    
    const chatsPanel = document.getElementById('chat-lobby-chats');
    const chatsList = document.getElementById('chat-lobby-chats-list');
    
    // 이미 같은 그룹의 채팅 패널이 열려있으면 렌더 스킵 (토글 동작)
    if (store.currentGroup?.id === group.id && chatsPanel?.classList.contains('visible')) {
        console.debug('[ChatList] Same group already visible, toggling off');
        chatsPanel.classList.remove('visible');
        store.setCurrentGroup(null);
        return;
    }
    
    // 캐릭터 대신 그룹 설정
    store.setCurrentCharacter(null);
    store.setCurrentGroup(group);
    
    if (!chatsPanel || !chatsList) {
        console.error('[ChatList] Chat panel elements not found');
        return;
    }
    
    // UI 표시
    chatsPanel.classList.add('visible');
    updateGroupChatHeader(group);
    showFolderBar(true);  // 그룹도 폴더 기능 활성화
    
    // ★ 그룹 채팅에서는 페르소나 퀵버튼 숨기기
    hidePersonaQuickButton();
    
    // 로딩 표시
    chatsList.innerHTML = '<div class="lobby-loading">채팅 로딩 중...</div>';
    
    try {
        const chats = await api.getGroupChats(group.id);
        
        if (!chats || chats.length === 0) {
            updateChatCount(0);
            chatsList.innerHTML = `
                <div class="lobby-empty-state">
                    <i>💬</i>
                    <div>그룹 채팅 기록이 없습니다</div>
                    <div style="font-size: 0.9em; margin-top: 5px;">새 채팅을 시작해보세요!</div>
                </div>
            `;
            return;
        }
        
        renderGroupChats(chatsList, chats, group);
    } catch (error) {
        console.error('[ChatList] Failed to load group chats:', error);
        showToast('그룹 채팅 목록을 불러오지 못했습니다.', 'error');
        chatsList.innerHTML = `
            <div class="lobby-empty-state">
                <i>⚠️</i>
                <div>그룹 채팅 목록 로딩 실패</div>
            </div>
        `;
    }
}

/**
 * 그룹 채팅 헤더 업데이트
 * @param {Object} group
 */
function updateGroupChatHeader(group) {
    const headerTitle = document.getElementById('chat-panel-name');
    const headerAvatar = document.getElementById('chat-panel-avatar');
    const deleteBtn = document.getElementById('chat-lobby-delete-char');
    const newChatBtn = document.getElementById('chat-lobby-new-chat');
    
    if (headerTitle) {
        headerTitle.textContent = group.name || '그룹';
    }
    
    if (headerAvatar) {
        headerAvatar.src = api.getGroupAvatarUrl(group);
        headerAvatar.alt = group.name || '그룹';
        headerAvatar.style.display = 'block';
    }
    
    // 그룹에서는 캐릭터 삭제 버튼 숨기기
    if (deleteBtn) {
        deleteBtn.style.display = 'none';
    }
    
    // 새 채팅 버튼 활성화 (그룹용 데이터 저장)
    if (newChatBtn) {
        newChatBtn.style.display = 'block';
        newChatBtn.dataset.groupId = group.id;
        newChatBtn.dataset.groupName = group.name || '그룹';
        newChatBtn.dataset.isGroup = 'true';
        // 캐릭터 데이터 초기화 (그룹으로 인식하도록)
        delete newChatBtn.dataset.charIndex;
        delete newChatBtn.dataset.charAvatar;
    }
}

/**
 * 그룹 채팅 목록 내부 렌더링 - 일반 채팅과 동일한 로직 사용
 * @param {HTMLElement} container
 * @param {Array} chats
 * @param {Object} group
 */
function renderGroupChats(container, chats, group) {
    // 그룹용 가상 avatar (저장소 키로 사용)
    const groupAvatar = `group_${group.id}`;
    
    // 전체 채팅 수
    const totalChatCount = chats.length;
    updateHasChats(totalChatCount);
    
    if (chats.length === 0) {
        updateChatCount(0);
        container.innerHTML = `
            <div class="lobby-empty-state">
                <i>💬</i>
                <div>그룹 채팅이 없습니다</div>
            </div>
        `;
        return;
    }
    
    // 폴더 필터 적용
    const filterFolder = storage.getFilterFolder();
    let filteredChats = [...chats];
    if (filterFolder !== 'all') {
        filteredChats = filterByFolder(filteredChats, groupAvatar, filterFolder);
    }
    
    // 정렬 적용
    const sortOption = storage.getSortOption();
    filteredChats = sortChats(filteredChats, groupAvatar, sortOption);
    
    updateChatCount(filteredChats.length);
    
    // 필터 결과가 0이면 빈 상태 표시
    if (filteredChats.length === 0) {
        container.innerHTML = `
            <div class="lobby-empty-state">
                <i>📁</i>
                <div>이 폴더에는 채팅이 없습니다</div>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    for (const chat of filteredChats) {
        const fileName = chat.file_name || '';
        const displayName = formatGroupChatName(fileName);
        const lastMes = chat.last_mes ? formatDate(chat.last_mes) : '';
        const mesCount = chat.chat_items || 0;
        const preview = chat.mes || chat.preview || chat.last_message || '채팅 기록';
        const safePreview = preview ? btoa(unescape(encodeURIComponent(preview))) : '';  // Base64 인코딩
        
        // 즐겨찾기/폴더 상태 (일반 채팅과 동일하게)
        const isFav = storage.isFavorite(groupAvatar, fileName);
        const folderId = storage.getChatFolder(groupAvatar, fileName);
        const data = storage.load();
        const folder = data.folders.find(f => f.id === folderId);
        const folderName = folder?.name || '';
        
        html += `
        <div class="lobby-chat-item ${isFav ? 'is-favorite' : ''}" 
             data-group-id="${escapeHtml(group.id)}"
             data-chat-file="${escapeHtml(fileName)}"
             data-folder-id="${folderId}"
             data-full-preview-encoded="${safePreview}">
            <button class="chat-fav-btn" title="즐겨찾기">${isFav ? '★' : '☆'}</button>
            <div class="chat-content">
                <div class="chat-name">${escapeHtml(displayName)}</div>
                <div class="chat-preview">${escapeHtml(truncateText(preview, 80))}</div>
                <div class="chat-meta">
                    ${mesCount > 0 ? `<span>💬 ${mesCount}개</span>` : ''}
                    ${lastMes ? `<span>🕐 ${lastMes}</span>` : ''}
                    ${folderName && folderId !== 'uncategorized' ? `<span class="chat-folder-tag">${escapeHtml(folderName)}</span>` : ''}
                </div>
            </div>
            <button class="chat-delete-btn" title="채팅 삭제">🗑️</button>
        </div>
        `;
    }
    
    container.innerHTML = html || `
        <div class="lobby-empty-state">
            <i>💬</i>
            <div>그룹 채팅이 없습니다</div>
        </div>
    `;
    
    // 그룹 채팅 클릭 이벤트 바인딩
    bindGroupChatEvents(container, group);
}

/**
 * 그룹 채팅 파일명을 보기 좋게 포맷
 * @param {string} fileName - 예: "2026-01-07@16h48m17s"
 * @returns {string}
 */
function formatGroupChatName(fileName) {
    // .jsonl 제거
    let name = fileName.replace('.jsonl', '');
    
    // 날짜 패턴 매칭 (2026-01-07@16h48m17s)
    const dateMatch = name.match(/(\d{4}-\d{2}-\d{2})@(\d{2})h(\d{2})m(\d{2})s/);
    if (dateMatch) {
        const [, date, hour, min] = dateMatch;
        return `${date} ${hour}:${min}`;
    }
    
    return name;
}

/**
 * 그룹 채팅 이벤트 바인딩 - 캐릭터 채팅과 동일한 플로우!
 * 순서: 그룹 선택 → 대기 → 로비 닫기 → 채팅 열기
 * @param {HTMLElement} container
 * @param {Object} group
 */
function bindGroupChatEvents(container, group) {
    const groupAvatar = `group_${group.id}`;  // 저장소 키용
    
    container.querySelectorAll('.lobby-chat-item').forEach((item, index) => {
        const chatContent = item.querySelector('.chat-content');
        const favBtn = item.querySelector('.chat-fav-btn');
        const delBtn = item.querySelector('.chat-delete-btn');
        const chatFile = item.dataset.chatFile;
        
        if (!chatContent || !chatFile) return;
        
        // 즐겨찾기 토글 (일반 채팅과 동일)
        if (favBtn) {
            createTouchClickHandler(favBtn, () => {
                const isNowFav = storage.toggleFavorite(groupAvatar, chatFile);
                favBtn.textContent = isNowFav ? '★' : '☆';
                item.classList.toggle('is-favorite', isNowFav);
            }, { debugName: `group-fav-${index}` });
        }
        
        // 채팅 열기 - 그룹은 UI 클릭 시 최근 채팅이 자동으로 열리므로
        // 채팅 관리 패널을 통해 원하는 채팅을 선택하는 방식 사용
        createTouchClickHandler(chatContent, async () => {
            // 전역 OperationLock으로 Race Condition 방지
            if (!operationLock.acquire('openGroupChat')) return;
            
            try {
                console.debug('[ChatList] Opening group chat:', { groupId: group.id, chatFile });
                
                const context = api.getContext();
                const chatFileName = chatFile.replace('.jsonl', '');
                
                // 1. 로비 먼저 닫기
                console.debug('[ChatList] Closing lobby first...');
                const overlay = document.getElementById('chat-lobby-overlay');
                const lobbyContainer = document.getElementById('chat-lobby-container');
                const fab = document.getElementById('chat-lobby-fab');
                const chatsPanel = document.getElementById('chat-lobby-chats');
                
                if (overlay) overlay.style.display = 'none';
                if (lobbyContainer) lobbyContainer.style.display = 'none';
                if (fab) fab.style.display = 'flex';
                if (chatsPanel) chatsPanel.classList.remove('visible');
                
                store.setCurrentGroup(null);
                store.setCurrentCharacter(null);
                store.setLobbyOpen(false);
                
                // 2. 그룹 카드 클릭하여 그룹 선택 (이때 최근 채팅이 열림)
                console.debug('[ChatList] Selecting group via UI click...');
                const groupCard = document.querySelector(`.group_select[data-grid="${group.id}"]`);
                
                if (!groupCard) {
                    console.error('[ChatList] Group card not found:', `.group_select[data-grid="${group.id}"]`);
                    showToast('그룹을 찾을 수 없습니다.', 'error');
                    return;
                }
                
                // jQuery 클릭
                if (window.$) {
                    window.$(groupCard).trigger('click');
                } else {
                    groupCard.click();
                }
                
                // 그룹 선택 완료 대기
                await new Promise(resolve => setTimeout(resolve, 600));
                
                // 3. 현재 열린 채팅이 원하는 채팅인지 확인
                const currentContext = api.getContext();
                const currentChat = currentContext?.chatId || '';
                console.debug('[ChatList] Current chat after group select:', currentChat, 'Target:', chatFileName);
                
                if (currentChat === chatFileName || currentChat.includes(chatFileName)) {
                    console.debug('[ChatList] Target chat is already open');
                    return;
                }
                
                // 4. 원하는 채팅이 아니면 채팅 관리 패널을 통해 선택
                console.debug('[ChatList] Opening chat management panel...');
                const manageChatsBtn = document.getElementById('option_select_chat');
                if (!manageChatsBtn) {
                    console.error('[ChatList] Chat management button not found');
                    showToast('채팅 관리 버튼을 찾을 수 없습니다.', 'error');
                    return;
                }
                
                manageChatsBtn.click();
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // 5. 채팅 목록에서 원하는 채팅 찾아 클릭
                const chatItems = document.querySelectorAll('.select_chat_block');
                console.debug('[ChatList] Found', chatItems.length, 'chat items');
                
                for (const chatItem of chatItems) {
                    const itemFileName = chatItem.getAttribute('file_name') || '';
                    const cleanItemName = itemFileName.replace('.jsonl', '').trim();
                    const cleanTargetName = chatFileName.replace('.jsonl', '').trim();
                    
                    if (cleanItemName === cleanTargetName) {
                        console.debug('[ChatList] Found target chat, clicking...');
                        if (window.$) {
                            window.$(chatItem).trigger('click');
                        } else {
                            chatItem.click();
                        }
                        console.debug('[ChatList] Group chat opened successfully');
                        return;
                    }
                }
                
                console.warn('[ChatList] Target chat not found in list');
                showToast('채팅을 찾을 수 없습니다.', 'warning');
                
            } catch (error) {
                console.error('[ChatList] Failed to open group chat:', error);
                showToast('그룹 채팅을 열지 못했습니다.', 'error');
            } finally {
                operationLock.release();
            }
        }, { preventDefault: true, stopPropagation: true, debugName: `group-chat-${index}` });
        
        // 삭제 버튼 이벤트
        if (delBtn) {
            createTouchClickHandler(delBtn, async () => {
                const confirmed = await showConfirm(`"${formatGroupChatName(chatFile)}" 채팅을 삭제하시겠습니까?`);
                if (!confirmed) return;
                
                try {
                    // 그룹 채팅 삭제 API 호출
                    const success = await api.deleteGroupChat(group.id, chatFile);
                    if (success) {
                        item.remove();
                        showToast('채팅이 삭제되었습니다.', 'success');
                        // 채팅 수 업데이트
                        const remaining = container.querySelectorAll('.lobby-chat-item').length;
                        updateChatCount(remaining);
                        if (remaining === 0) {
                            container.innerHTML = `
                                <div class="lobby-empty-state">
                                    <i>💬</i>
                                    <div>그룹 채팅이 없습니다</div>
                                </div>
                            `;
                        }
                    } else {
                        showToast('채팅 삭제에 실패했습니다.', 'error');
                    }
                } catch (error) {
                    console.error('[ChatList] Failed to delete group chat:', error);
                    showToast('채팅 삭제 중 오류가 발생했습니다.', 'error');
                }
            }, { preventDefault: true, stopPropagation: true, debugName: `group-del-${index}` });
        }
    });
}

// ============================================
// 페르소나 퀵버튼
// ============================================

// ============================================
// 페르소나 퀵버튼
// ============================================

/**
 * 페르소나 퀵버튼 업데이트
 * @param {string} charAvatar - 캐릭터 아바타
 */
export function updatePersonaQuickButton(charAvatar) {
    console.debug('[ChatList] updatePersonaQuickButton called:', charAvatar);
    const btn = document.getElementById('chat-lobby-persona-quick');
    const img = btn ? btn.querySelector('.persona-quick-avatar') : null;
    console.debug('[ChatList] Button found:', !!btn, 'Image found:', !!img);
    if (!btn || !img) return;
    
    // lastChatCache에서 마지막 페르소나 가져오기 (동적 import 방지를 위해 전역에서 가져옴)
    const lastPersona = window._chatLobbyLastChatCache ? window._chatLobbyLastChatCache.getPersona(charAvatar) : null;
    
    if (lastPersona) {
        img.src = '/User Avatars/' + encodeURIComponent(lastPersona);
        img.alt = lastPersona.replace(/\.[^/.]+$/, '');
        btn.dataset.persona = lastPersona;
        btn.dataset.charAvatar = charAvatar;
        btn.title = '페르소나 전환: ' + img.alt;
        btn.style.display = 'flex';
    } else {
        btn.style.display = 'none';
    }
}

/**
 * 페르소나 퀵버튼 숨기기 (그룹 채팅 등에서 사용)
 */
export function hidePersonaQuickButton() {
    const btn = document.getElementById('chat-lobby-persona-quick');
    if (btn) btn.style.display = 'none';
}
