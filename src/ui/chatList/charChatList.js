// ============================================
// 채팅 목록 - 캐릭터 채팅 목록
// ============================================

import { api } from '../../api/sillyTavern.js';
import { cache } from '../../data/cache.js';
import { storage } from '../../data/storage.js';
import { store } from '../../data/store.js';
import { escapeHtml } from '../../utils/textUtils.js';
import { createTouchClickHandler } from '../../utils/eventHelpers.js';
import { showToast } from '../notifications.js';
import { operationLock } from '../../utils/operationLock.js';
import { 
    analyzeBranches, 
    needsBranchAnalysis 
} from '../../utils/branchAnalyzer.js';
import { getAllFingerprints } from '../../data/branchCache.js';
import { normalizeChats, filterValidChats, filterByFolder, sortChats } from './chatQuery.js';
import { renderChatItem } from './chatItem.js';
import { 
    updateChatHeader, updateChatCount, updateHasChats, showFolderBar, 
    syncDropdowns, updatePersonaQuickButton 
} from './panelHeader.js';
import { bindTooltipEvents } from './tooltip.js';
import { showChatFolderMenu } from './chatMenu.js';
import { updateBatchCount, deactivateBatchMode } from './batch.js';

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
    
    // API 호출 전 현재 캐릭터 아바타 저장 (stale guard용)
    const requestedAvatar = character.avatar;
    
    try {
        // 최신 데이터 가져오기
        const chats = await api.fetchChatsForCharacter(character.avatar);
        
        // API 응답 후 캐릭터가 변경됐으면 폐기 (stale data 방지)
        if (store.currentCharacter?.avatar !== requestedAvatar) {
            console.debug('[ChatList] Character changed during fetch, discarding result for:', requestedAvatar);
            return;
        }
        
        if (!chats || chats.length === 0) {
            updateChatCount(0);
            chatsList.innerHTML = `
                <div class="lobby-empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:var(--text-muted,#888);padding:40px;">
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
            <div class="lobby-empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:var(--text-muted,#888);padding:40px;">
                <i>⚠️</i>
                <div>채팅 목록 로딩 실패</div>
                <button onclick="window.chatLobbyRefresh()" style="margin-top:10px;padding:8px 16px;cursor:pointer;">다시 시도</button>
            </div>
        `;
    }
}

// autoAnalyzeBranches 타이머 ID (취소 가능)
let autoAnalyzeTimerId = null;

/**
 * 채팅 목록 내부 렌더링
 * @param {HTMLElement} container
 * @param {Array|Object} rawChats
 * @param {string} charAvatar
 * @param {boolean} [skipAutoAnalyze=false] - 재귀 방지용
 */
function renderChats(container, rawChats, charAvatar, skipAutoAnalyze = false) {
    // 이전 autoAnalyze 타이머 취소 (캐릭터 변경 시 stale 데이터 방지)
    if (autoAnalyzeTimerId) {
        clearTimeout(autoAnalyzeTimerId);
        autoAnalyzeTimerId = null;
    }
    
    // stale guard: 현재 캐릭터와 일치하지 않으면 렌더링 중단
    if (store.currentCharacter && store.currentCharacter.avatar !== charAvatar) {
        console.debug('[renderChats] Stale render blocked:', charAvatar, '(current:', store.currentCharacter.avatar, ')');
        return;
    }
    
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
            <div class="lobby-empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:var(--text-muted,#888);padding:40px;">
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
            <div class="lobby-empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:var(--text-muted,#888);padding:40px;">
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
                autoAnalyzeTimerId = setTimeout(() => {
                    autoAnalyzeTimerId = null;
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
    
    // 함수 진입 시 캐릭터 stale 검사
    if (store.currentCharacter?.avatar !== charAvatar) {
        console.debug('[AutoBranchAnalyze] Stale entry blocked:', charAvatar);
        return;
    }
    
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
            
            // operationLock 사전 체크 (다른 채팅이 이미 열리는 중이면 무시)
            if (operationLock.isLocked) {
                console.debug('[ChatList] Operation in progress, ignoring click:', operationLock.currentOp);
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
            showToast(isNowFav ? '⭐ 즐겨찾기 추가' : '⭐ 즐겨찾기 해제', 'success');
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
        const requestedAvatar = character.avatar;
        chatsList.innerHTML = '<div class="lobby-loading">채팅 로딩 중...</div>';
        try {
            const chats = await api.fetchChatsForCharacter(character.avatar, true);
            
            // API 응답 후 캐릭터가 변경됐으면 폐기
            if (store.currentCharacter?.avatar !== requestedAvatar) {
                console.debug('[ChatList] Character changed during force reload, discarding');
                return;
            }
            
            if (chats && chats.length > 0) {
                renderChats(chatsList, chats, character.avatar);
            } else {
                chatsList.innerHTML = '<div class="lobby-empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:var(--text-muted,#888);padding:40px;"><i>💬</i><div>채팅 기록이 없습니다</div></div>';
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
    // autoAnalyze 타이머 취소
    if (autoAnalyzeTimerId) {
        clearTimeout(autoAnalyzeTimerId);
        autoAnalyzeTimerId = null;
    }
    
    // 배치 모드 자동 해제
    deactivateBatchMode();
    
    const chatsPanel = document.getElementById('chat-lobby-chats');
    if (chatsPanel) chatsPanel.classList.remove('visible');
    store.setCurrentCharacter(null);
    store.setCurrentGroup(null);
}
