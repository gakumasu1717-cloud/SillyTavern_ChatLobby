// ============================================
// ChatLobby 메인 진입점
// ============================================

import { CONFIG } from './config.js';
import { cache } from './data/cache.js';
import { storage } from './data/storage.js';
import { store } from './data/store.js';
import { api } from './api/sillyTavern.js';
import { createLobbyHTML } from './ui/templates.js';
import { renderPersonaBar } from './ui/personaBar.js';
import { initPersonaRadialMenu, refreshPersonaRadialMenu, cleanupPersonaRadialMenu } from './ui/personaRadialMenu.js';
import { renderCharacterGrid, setCharacterSelectHandler, handleSearch, handleSortChange as handleCharSortChange, resetCharacterSelectLock, setGroupSelectHandler } from './ui/characterGrid.js';
import { renderChatList, renderGroupChatList, setChatHandlers, handleFilterChange, handleSortChange as handleChatSortChange, toggleBatchMode, updateBatchCount, executeBatchDelete, executeBatchSession, batchSelectAll, closeChatPanel, deactivateBatchMode, cleanupTooltip, refreshCurrentChatList } from './ui/chatList.js';
import { openChat, openGroupChat, deleteChat, startNewChat, deleteCharacter, switchCharacter, switchGroup } from './handlers/chatHandlers.js';
import { openFolderModal, closeFolderModal, addFolder, updateFolderDropdowns } from './handlers/folderHandlers.js';
import { showToast, showConfirm } from './ui/notifications.js';
import { openStatsView, closeStatsView, isStatsViewOpen } from './ui/statsView.js';
import { openCalendarView, closeCalendarView } from './ui/calendarView.js';
import { bindTabEvents, switchTab, injectContextMenuStyles, cacheRecentChatsBeforeOpen, loadRecentChats, startRecentDomObserver, stopRecentDomObserver } from './ui/tabView.js';
import { lastChatCache } from './data/lastChatCache.js';
import { loadSnapshots as loadCalendarSnapshots, getLocalDateString, initCalendarStorage, CALENDAR_STORAGE_KEY } from './data/calendarStorage.js';
import { initPersist } from './data/persist.js';
import { debounce } from './utils/eventHelpers.js';
import { waitForElement } from './utils/waitFor.js';
import { intervalManager } from './utils/intervalManager.js';
import { openDrawerSafely } from './utils/drawerHelper.js';
import { initCustomThemeIntegration, cleanupCustomThemeIntegration } from './integration/customTheme.js';
import { listeners } from './utils/listenerManager.js';
import { applyTheme, toggleThemeMenu, closeThemeMenu, isThemeMenuOpen, initThemeMenuEvents, cleanupThemeMenu, renderStDock } from './ui/themeMenu.js';
import { remindStore } from './data/remindStore.js';
import { highlightStore } from './data/highlightStore.js';
import { closeTopRemindLayer } from './ui/remindViewer.js';
import { escapeHtml } from './utils/textUtils.js';
import { analyzeBranches } from './utils/branchAnalyzer.js';
import { clearCharacterCache as clearBranchCache } from './data/branchCache.js';
import { operationLock } from './utils/operationLock.js';
import { installSaveGuard, uninstallSaveGuard, setSaveGuardEnabled } from './safety/saveGuard.js';
import { openCharInfo, closeCharInfo, isCharInfoOpen } from './ui/charInfoView.js';
import { isCharBatchMode, toggleCharBatchMode, charBatchSelectAll, charBatchClear, charBatchDelete } from './ui/charBatch.js';
import { charAvatarUrl, bumpAvatarVersion, forgetAvatarVersion } from './utils/avatarUrl.js';
import {
    SESSIONS_KEY, SESSION_IMAGES_KEY, migrateFoldersToSessions,
    removeCharacter as removeSessionCharacter, removeChat as removeSessionChat, renameChat as renameSessionChat
} from './data/sessionStore.js';
import { handleSessionAction, resetSessionView } from './ui/sessions/sessionView.js';
import { closeTopSessionLayer, closeAllSessionLayers } from './ui/sessions/sessionOverlay.js';
import { resolvePendingNewChat } from './ui/sessions/sessionState.js';

(function() {
    'use strict';

    // ★ 채팅 덮어쓰기 가드는 UI 초기화를 기다리지 않고 가장 먼저 설치
    // (ST가 첫 채팅을 불러오는 순간부터 보호해야 함)
    installSaveGuard();

    // CHAT_CHANGED cooldown 타이머 (모듈 스코프)
    let chatChangedCooldownTimer = null;
    let closeLobbyHandler = null;

    // ★ 마지막으로 확인된 페르소나 (SETTINGS_UPDATED 오염 방지용)
    // SETTINGS_UPDATED는 페르소나와 무관한 설정 변경에서도 발생하므로,
    // 실제로 페르소나가 바뀌었을 때만 사용 기록을 남기기 위해 이전 값을 추적
    let lastKnownPersona = null;
    
    // ============================================
    // 이벤트 핸들러 참조 저장 (cleanup용)
    // ============================================
    let eventHandlers = null;
    let eventsRegistered = false;
    
    // ============================================
    // 현재 채팅 중인 캐릭터 추적 (로비 밖 채팅 감지용)
    // ============================================
    
    /**
     * 현재 채팅 중인 캐릭터 아바타 가져오기
     * @returns {string|null}
     */
    function getCurrentCharacterAvatar() {
        const context = api.getContext();
        if (context?.characterId === undefined || context?.characterId === null || context.characterId < 0) return null;
        const char = context.characters?.[context.characterId];
        return char?.avatar || null;
    }
    
    // ============================================
    // FAB 프리뷰 (호버 시 오늘 마지막 캐릭터 + 스트릭 표시)
    // ============================================
    
    /**
     * 오늘 채팅한 캐릭터 목록 (최신순)
     * @returns {Array<{avatar: string, time: number}>}
     */
    function getTodayChats() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStart = today.getTime();
        
        const result = [];
        lastChatCache.lastChatTimes.forEach((entry, avatar) => {
            // entry는 { time, persona } 객체 또는 숫자(하위 호환)
            const time = (typeof entry === 'number') ? entry : (entry?.time || 0);
            if (time >= todayStart) {
                result.push({ avatar, time });
            }
        });
        
        return result.sort((a, b) => b.time - a.time);
    }
    
    /**
     * 연속 출석일 계산 (스트릭)
     * @returns {number}
     */
    function getStreak() {
        const snapshots = loadCalendarSnapshots();
        let streak = 0;
        const checkDate = new Date();
        
        // 오늘부터 거슬러 올라가며 체크
        for (let i = 0; i < 365; i++) {
            const dateStr = getLocalDateString(checkDate);
            if (snapshots[dateStr] && snapshots[dateStr].total > 0) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }
        return streak;
    }
    
    /**
     * FAB 프리뷰 업데이트
     */
    function updateFabPreview() {
        const preview = document.querySelector('.fab-preview');
        const avatar = document.querySelector('.fab-preview-avatar');
        const streakEl = document.querySelector('.fab-streak');
        
        if (!preview || !avatar || !streakEl) return;
        
        // 오늘 마지막 캐릭터
        const todayChats = getTodayChats();
        const hasAvatar = todayChats.length > 0;
        if (hasAvatar) {
            const lastChar = todayChats[0];
            avatar.src = charAvatarUrl(lastChar.avatar);
            avatar.style.display = 'block';
        } else {
            avatar.style.display = 'none';
        }
        
        // 스트릭
        const streak = getStreak();
        const hasStreak = streak > 0;
        if (hasStreak) {
            streakEl.textContent = `🔥 ${streak}`;
            streakEl.style.display = 'block';
        } else {
            streakEl.style.display = 'none';
        }
        
        // 둘 다 없으면 프리뷰 자체 숨김
        preview.dataset.empty = (!hasAvatar && !hasStreak) ? 'true' : 'false';
    }
    
    // ============================================
    // 초기화
    // ============================================
    
    // ★ 초기화는 2단계로 나뉜다
    // 1) mountShell  : 확장이 로드되는 즉시 (ST 스플래시 중). 데이터 없이 로비 틀 + 스켈레톤을 띄운다.
    // 2) onAppReady : ST가 캐릭터/설정 로드를 끝낸 시점(APP_INITIALIZED). 데이터를 채운다.
    // 예전에는 initDelay(1초) + 여러 setTimeout 뒤에 로비를 만들어서 ST 화면이 먼저 보이고
    // 로비가 맨 마지막에 떴다.

    let appReadyHandled = false;
    let appReadyListener = null;

    // IndexedDB(persist.js)에 두는 큰 데이터 키
    const PERSIST_KEYS = [
        'chatLobby_reminds',
        'chatLobby_highlights',
        'chatLobby_branchCache',
        SESSIONS_KEY,
        SESSION_IMAGES_KEY,
        CALENDAR_STORAGE_KEY,
        'chatLobby_calendar_v1_backup',
    ];

    /**
     * 1단계: 로비 셸 마운트 (ST 데이터 불필요)
     * @returns {boolean} 마운트했는지 (이미 초기화됐으면 false)
     */
    function mountShell() {
        // 🔥 중복 초기화 방지
        if (window._chatLobbyInitialized) {
            console.warn('[ChatLobby] Already initialized, skipping duplicate init');
            return false;
        }
        window._chatLobbyInitialized = true;
        console.info('[ChatLobby] 🚀 Mounting shell...');

        removeExistingUI();
        document.body.insertAdjacentHTML('beforeend', createLobbyHTML());

        // 핸들러/이벤트 위임은 DOM만 있으면 됨
        setupHandlers();
        setupEventDelegation();

        // 테마/표시 설정 메뉴 이벤트 (옵션 변경 시 그리드 리렌더)
        initThemeMenuEvents(() => renderCharacterGrid(store.searchTerm));

        showBootSkeleton();
        return true;
    }

    /**
     * 데이터가 오기 전 로비를 스켈레톤 상태로 표시
     */
    function showBootSkeleton() {
        const overlay = document.getElementById('chat-lobby-overlay');
        const container = document.getElementById('chat-lobby-container');
        const fab = document.getElementById('chat-lobby-fab');
        const grid = document.getElementById('chat-lobby-characters');

        if (overlay) overlay.style.display = 'flex';
        if (container) {
            container.style.display = 'flex';
            container.classList.add('is-booting');
        }
        if (fab) fab.style.display = 'none';
        if (grid) {
            grid.innerHTML = Array.from({ length: 12 },
                () => '<div class="lobby-char-card lobby-skeleton-card" aria-hidden="true"></div>'
            ).join('');
        }
    }

    /**
     * 2단계: ST 준비 완료 후 데이터 연결 + 로비 채우기
     */
    async function onAppReady() {
        if (appReadyHandled) return;
        appReadyHandled = true;
        clearBootWatchdog();
        console.info('[ChatLobby] SillyTavern ready, loading data');

        const overlay = document.getElementById('chat-lobby-overlay');
        // 스켈레톤 동안 사용자가 로비를 닫았으면 다시 열지 않음
        const shouldOpen = overlay?.style.display === 'flex';

        // ★ 각 단계는 서로 독립: 하나가 실패해도 로그만 남기고 다음 단계 진행
        // (순차 체인에서 하나가 터지면 로비가 스켈레톤에 갇히는 것 방지)

        // 큰 데이터(IndexedDB) 먼저 불러오기 - 다른 단계가 저장소를 쓰기 전에
        await runStep('initPersist', () => initPersist(PERSIST_KEYS));
        // 폴더 → 세션 변환 (1회, 폴더 데이터는 읽기만 함). initPersist 직후, 로비를 열기 전에
        await runStep('migrateFoldersToSessions', () => migrateFoldersToSessions(storage.load()));
        await runStep('renderStDock', renderStDock);
        await runStep('setupSillyTavernEvents', setupSillyTavernEvents);
        await runStep('addLobbyToOptionsMenu', () => addLobbyToOptionsMenu());
        await runStep('customThemeIntegration', () => initCustomThemeIntegration(openLobby));
        api.getCurrentPersona().then(p => { if (p) lastKnownPersona = p; }).catch(() => {});

        // ⚠️ updateFabPreview()가 getStreak()→loadSnapshots()를 호출하므로 캘린더 저장소 먼저
        await runStep('initCalendarStorage', initCalendarStorage);
        await runStep('updateFabPreview', updateFabPreview);

        document.getElementById('chat-lobby-container')?.classList.remove('is-booting');

        if (shouldOpen) {
            // openLobby는 자체적으로 실패 시 FAB로 복구함
            await runStep('openLobby', openLobby);
        } else {
            showFabOnly();
        }

        // 프리로딩은 로비가 뜬 뒤에 (첫 렌더와 경쟁하지 않도록)
        runStep('startBackgroundPreload', startBackgroundPreload);
    }

    /**
     * 초기화 단계 하나를 격리 실행 (예외를 삼키고 로그만 남김)
     * @param {string} name
     * @param {Function} fn
     */
    async function runStep(name, fn) {
        try {
            await fn();
            return true;
        } catch (e) {
            console.error(`[ChatLobby] Init step "${name}" failed:`, e);
            return false;
        }
    }

    /**
     * 스켈레톤을 걷고 FAB만 표시 (부팅 실패/취소 시 복구 상태)
     */
    function showFabOnly() {
        const overlay = document.getElementById('chat-lobby-overlay');
        const container = document.getElementById('chat-lobby-container');
        const fab = document.getElementById('chat-lobby-fab');
        container?.classList.remove('is-booting');
        if (overlay) overlay.style.display = 'none';
        if (container) container.style.display = 'none';
        if (fab) fab.style.display = 'flex';
    }

    // 부팅 워치독: ST 준비 신호가 끝내 안 오면 스켈레톤에 갇히지 않도록 FAB로 복구
    const BOOT_WATCHDOG_MS = 30000;
    let bootWatchdogTimer = null;

    function startBootWatchdog() {
        clearBootWatchdog();
        bootWatchdogTimer = setTimeout(() => {
            bootWatchdogTimer = null;
            if (appReadyHandled) return;
            console.warn('[ChatLobby] SillyTavern did not become ready in time, showing FAB only');
            showFabOnly();
        }, BOOT_WATCHDOG_MS);
    }

    function clearBootWatchdog() {
        if (bootWatchdogTimer) {
            clearTimeout(bootWatchdogTimer);
            bootWatchdogTimer = null;
        }
    }

    /**
     * ST가 준비되면 콜백 실행
     * APP_INITIALIZED/APP_READY는 늦게 등록한 리스너에게도 즉시 전달됨 (ST eventemitter의 autoFire)
     * → 확장이 런타임에 설치/재로드돼도 동작
     * ⚠️ 리스너는 Promise를 반환하지 않음: ST는 emit 시 리스너를 await하므로 스플래시가 늦어짐
     */
    function whenAppReady(callback) {
        const context = window.SillyTavern?.getContext?.();
        const eventSource = context?.eventSource;
        const eventName = context?.eventTypes?.APP_INITIALIZED || context?.eventTypes?.APP_READY;

        if (eventSource && eventName) {
            appReadyListener = () => {
                callback().catch(e => console.error('[ChatLobby] App ready handler failed:', e));
            };
            eventSource.on(eventName, appReadyListener);
            return;
        }

        // 구버전 ST: 캐릭터 목록이 채워질 때까지 대기
        waitForSillyTavern().then(ready => {
            if (ready) callback().catch(e => console.error('[ChatLobby] App ready handler failed:', e));
        });
    }
    
    /**
     * SillyTavern 이벤트 리스닝 설정
     * 캐릭터 삭제/추가/수정 등의 이벤트를 감지하여 캐시 무효화
     * 중복 등록 방지 + cleanup 지원
     */
    function setupSillyTavernEvents() {
        const context = window.SillyTavern?.getContext?.();
        if (!context?.eventSource) {
            console.warn('[ChatLobby] SillyTavern eventSource not found');
            return;
        }
        
        // 🔥 이미 등록되어 있으면 먼저 정리 후 재등록
        if (eventsRegistered) {
            console.warn('[ChatLobby] Events already registered, cleaning up first');
            cleanupSillyTavernEvents();
        }
        
        const { eventSource, eventTypes } = context;
        
        // CHAT_CHANGED cooldown 패턴 (마지막 이벤트 후 500ms 대기)
        const onChatChanged = () => {
            // "세션 안에서 시작한 새 채팅"을 세션에 넣기 (명세 6절)
            // ⚠️ 새 채팅 시작 자체가 operationLock 안에서 일어나므로 락 검사보다 먼저 처리해야 한다
            resolvePendingNewChat();
            
            // 채팅 열기 작업 중이면 무시 (우리가 트리거한 CHAT_CHANGED)
            if (operationLock.isLocked) {
                console.debug('[ChatLobby] CHAT_CHANGED ignored (operation in progress:', operationLock.currentOp, ')');
                return;
            }
            
            // 로비 안 열려있으면 캐시만 무효화
            // ⚠️ 전체 chats 캐시를 비우면 다음 로비 열기 때 모든 캐릭터를 재요청하게 됨
            // → 채팅 변경은 현재 캐릭터에만 영향을 주므로 해당 캐릭터만 스코프 무효화
            if (!isLobbyOpen()) {
                cache.invalidate('characters');
                const changedAvatar = getCurrentCharacterAvatar();
                if (changedAvatar) {
                    cache.invalidate('chats', changedAvatar);
                    cache.invalidate('chatCounts', changedAvatar);
                    cache.invalidate('messageCounts', changedAvatar);
                }
                return;
            }
            
            // 락 시작 (아직 안 걸려있으면)
            if (!store.isLobbyLocked) {
                store.setLobbyLocked(true);
            }
            
            // 이전 타이머 취소
            if (chatChangedCooldownTimer) {
                clearTimeout(chatChangedCooldownTimer);
            }
            
            // 마지막 CHAT_CHANGED 후 500ms 대기 → 렌더 + 락 해제
            chatChangedCooldownTimer = setTimeout(async () => {
                cache.invalidate('characters');
                // 변경된 캐릭터만 스코프 무효화 (전체 재요청 방지)
                const changedAvatar = getCurrentCharacterAvatar();
                if (changedAvatar) {
                    cache.invalidate('chats', changedAvatar);
                    cache.invalidate('chatCounts', changedAvatar);
                    cache.invalidate('messageCounts', changedAvatar);
                }
                await renderCharacterGrid(store.searchTerm);
                store.setLobbyLocked(false);
                chatChangedCooldownTimer = null;
            }, 500);
        };
        
        // 핸들러 함수들을 별도로 정의 (off 호출 가능하도록)
        eventHandlers = {
            onCharacterDeleted: (eventData) => {
                cache.invalidate('characters');
                
                // 🔥 삭제된 캐릭터를 lastChatCache에서 즉시 제거
                // eventData: { id: chid, character: characterObject }
                if (eventData?.character?.avatar) {
                    lastChatCache.remove(eventData.character.avatar);
                    clearBranchCache(eventData.character.avatar);
                    remindStore.removeByAvatar(eventData.character.avatar);
                    highlightStore.removeByAvatar(eventData.character.avatar);
                    forgetAvatarVersion(eventData.character.avatar);
                    // 폴더 배정/즐겨찾기도 정리 (ST 화면에서 직접 지운 경우 포함)
                    storage.removeCharacterData(eventData.character.avatar);
                    removeSessionCharacter(eventData.character.avatar);
                    console.debug('[ChatLobby] Removed deleted character from caches:', eventData.character.avatar);
                }
                
                if (isLobbyOpen()) {
                    renderCharacterGrid(store.searchTerm);
                }
            },
            onCharacterEdited: (eventData) => {
                cache.invalidate('characters');
                // 이미지가 바뀌었을 수 있으므로 다음 렌더부터 새로 받게 함 (파일명은 그대로라 캐시됨)
                bumpAvatarVersion(eventData?.detail?.character?.avatar);
            },
            onCharacterAdded: () => {
                cache.invalidate('characters');
                if (isLobbyOpen()) {
                    renderCharacterGrid(store.searchTerm);
                }
            },
            onChatChanged: onChatChanged,
            // 채팅 이름 변경/삭제를 세션에 반영 (ST 화면에서 직접 한 경우 포함)
            onChatRenamed: (data) => {
                if (data?.avatarId && data.oldFileName && data.newFileName) {
                    renameSessionChat(data.avatarId, data.oldFileName, data.newFileName);
                }
            },
            onChatDeleted: (fileName) => {
                // 파일명만 오므로 "지금 열린 캐릭터" 기준으로 처리 (그룹 채팅은 세션 대상 아님)
                if (typeof fileName !== 'string' || !fileName || api.getContext()?.groupId) return;
                const avatar = getCurrentCharacterAvatar();
                if (avatar) removeSessionChat(avatar, fileName);
            },
            // 🔥 메시지 전송/수신 이벤트 - 로비 밖에서 채팅해도 lastChatCache 갱신
            onMessageSent: () => {
                // 🔥 그룹 채팅은 통계에서 제외
                const context = api.getContext();
                if (context?.groupId) {
                    console.debug('[ChatLobby] Skipping group chat for lastChatCache');
                    return;
                }
                
                const charAvatar = getCurrentCharacterAvatar();
                if (charAvatar) {
                    lastChatCache.updateNow(charAvatar);
                    console.debug('[ChatLobby] Message sent, updated lastChatCache:', charAvatar);
                    // FAB 프리뷰 갱신
                    updateFabPreview();
                }
            },
            onMessageReceived: (chatId, type) => {
                // 🔥 first_message는 캐릭터 첫 진입 시 자동 생성되는 인사말
                // 실제 대화가 아니므로 lastChatCache를 갱신하지 않음
                // CHARACTER_MESSAGE_RENDERED에서는 type이 전달되지 않을 수 있으므로
                // type이 정확히 'first_message'인 경우에만 스킵
                if (type === 'first_message') {
                    console.debug('[ChatLobby] Skipping first_message for lastChatCache');
                    return;
                }
                
                // 🔥 그룹 채팅은 통계에서 제외
                const context = api.getContext();
                if (context?.groupId) {
                    console.debug('[ChatLobby] Skipping group chat for lastChatCache');
                    return;
                }
                
                const charAvatar = getCurrentCharacterAvatar();
                if (charAvatar) {
                    lastChatCache.updateNow(charAvatar);
                    console.debug('[ChatLobby] Message received, updated lastChatCache:', charAvatar);
                    // FAB 프리뷰 갱신
                    updateFabPreview();
                }
            },
            // 🔥 페르소나 변경 감지 (세팅 업데이트 시)
            onSettingsUpdated: async () => {
                // ⚠️ SETTINGS_UPDATED는 모든 설정 저장에서 발생함
                // 실제로 페르소나가 바뀐 경우에만 기록/리렌더 (큐 오염 + 불필요한 렌더 방지)
                try {
                    const currentPersona = await api.getCurrentPersona();
                    if (!currentPersona || currentPersona === lastKnownPersona) return;

                    console.debug('[ChatLobby] Persona changed externally:', lastKnownPersona, '→', currentPersona);
                    lastKnownPersona = currentPersona;
                    storage.recordPersonaUsage(currentPersona);
                    await refreshPersonaRadialMenu();
                    await renderPersonaBar();
                } catch (e) { /* ignore */ }
            }
        };
        
        // 이벤트 등록
        eventSource.on(eventTypes.CHARACTER_DELETED, eventHandlers.onCharacterDeleted);
        
        if (eventTypes.CHARACTER_EDITED) {
            eventSource.on(eventTypes.CHARACTER_EDITED, eventHandlers.onCharacterEdited);
        }
        
        if (eventTypes.CHARACTER_ADDED) {
            eventSource.on(eventTypes.CHARACTER_ADDED, eventHandlers.onCharacterAdded);
        }
        
        eventSource.on(eventTypes.CHAT_CHANGED, eventHandlers.onChatChanged);
        if (eventTypes.CHAT_RENAMED) {
            eventSource.on(eventTypes.CHAT_RENAMED, eventHandlers.onChatRenamed);
        }
        if (eventTypes.CHAT_DELETED) {
            eventSource.on(eventTypes.CHAT_DELETED, eventHandlers.onChatDeleted);
        }
        
        // 메시지 이벤트 등록 (마지막 채팅 시간 실시간 갱신)
        if (eventTypes.MESSAGE_SENT) {
            eventSource.on(eventTypes.MESSAGE_SENT, eventHandlers.onMessageSent);
        }
        if (eventTypes.MESSAGE_RECEIVED) {
            eventSource.on(eventTypes.MESSAGE_RECEIVED, eventHandlers.onMessageReceived);
        }
        if (eventTypes.USER_MESSAGE_RENDERED) {
            eventSource.on(eventTypes.USER_MESSAGE_RENDERED, eventHandlers.onMessageSent);
        }
        if (eventTypes.CHARACTER_MESSAGE_RENDERED) {
            eventSource.on(eventTypes.CHARACTER_MESSAGE_RENDERED, eventHandlers.onMessageReceived);
        }
        
        // 페르소나 변경 감지 (SETTINGS_UPDATED)
        if (eventTypes.SETTINGS_UPDATED) {
            eventSource.on(eventTypes.SETTINGS_UPDATED, eventHandlers.onSettingsUpdated);
        }
        
        eventsRegistered = true;
    }
    
    /**
     * SillyTavern 이벤트 리스너 정리
     * 확장 재로드 시 호출
     */
    function cleanupSillyTavernEvents() {
        if (!eventHandlers || !eventsRegistered) return;
        
        const context = window.SillyTavern?.getContext?.();
        if (!context?.eventSource) return;
        
        const { eventSource, eventTypes } = context;
        
        try {
            eventSource.off?.(eventTypes.CHARACTER_DELETED, eventHandlers.onCharacterDeleted);
            eventSource.off?.(eventTypes.CHARACTER_EDITED, eventHandlers.onCharacterEdited);
            eventSource.off?.(eventTypes.CHARACTER_ADDED, eventHandlers.onCharacterAdded);
            eventSource.off?.(eventTypes.CHAT_CHANGED, eventHandlers.onChatChanged);
            eventSource.off?.(eventTypes.CHAT_RENAMED, eventHandlers.onChatRenamed);
            eventSource.off?.(eventTypes.CHAT_DELETED, eventHandlers.onChatDeleted);
            
            // 메시지 이벤트 정리
            eventSource.off?.(eventTypes.MESSAGE_SENT, eventHandlers.onMessageSent);
            eventSource.off?.(eventTypes.MESSAGE_RECEIVED, eventHandlers.onMessageReceived);
            eventSource.off?.(eventTypes.USER_MESSAGE_RENDERED, eventHandlers.onMessageSent);
            eventSource.off?.(eventTypes.CHARACTER_MESSAGE_RENDERED, eventHandlers.onMessageReceived);
            eventSource.off?.(eventTypes.SETTINGS_UPDATED, eventHandlers.onSettingsUpdated);
            
            eventsRegistered = false;
            eventHandlers = null;
        } catch (e) {
            console.warn('[ChatLobby] Failed to cleanup events:', e);
        }
    }
    
    /**
     * 로비가 열려있는지 확인
     */
    function isLobbyOpen() {
        return store.isLobbyOpen;
    }
    
    /**
     * 기존 UI 요소 제거
     */
    function removeExistingUI() {
        ['chat-lobby-overlay', 'chat-lobby-fab', 'chat-lobby-folder-modal', 'chat-lobby-global-tooltip', 'chat-preview-tooltip'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
    }
    
    /**
     * 핸들러 설정
     */
    function setupHandlers() {
        // 캐릭터 선택 시 채팅 목록 렌더링
        setCharacterSelectHandler((character) => {
            renderChatList(character);
        });
        
        // 그룹 선택 시 채팅 목록 렌더링
        setGroupSelectHandler((group) => {
            // 캐릭터용 세션 화면(카드/세션 줄)이 그룹 목록에 남지 않도록
            resetSessionView();
            renderGroupChatList(group);
        });
        
        // 채팅 열기/삭제 핸들러
        setChatHandlers({
            onOpen: openChat,
            onDelete: deleteChat,
            onOpenGroup: openGroupChat
        });
    }
    
    // ============================================
    // 백그라운드 프리로딩
    // ============================================
    
    /**
     * 백그라운드 프리로딩 시작
     * 🔥 순차 실행으로 메모리 부하 감소
     */
    async function startBackgroundPreload() {
        // 약간의 딜레이 후 프리로딩 (메인 스레드 블로킹 방지)
        setTimeout(async () => {
            console.debug('[ChatLobby] Starting background preload...');
            
            try {
                // 1단계: 기본 데이터만 순차 로드
                await cache.preloadPersonas(api);
                await new Promise(r => setTimeout(r, 100)); // 100ms 간격
                await cache.preloadCharacters(api);
                
                console.debug('[ChatLobby] Basic preload completed');
            } catch (e) {
                console.error('[ChatLobby] Preload failed:', e);
                return;
            }
            
            // 2단계: 채팅은 더 나중에 (3초 후) + 순차 로드
            setTimeout(async () => {
                const characters = cache.get('characters');
                if (!characters || characters.length === 0) return;
                
                // 최근 채팅순으로 정렬된 상위 3개만 (5개 → 3개로 축소)
                const recent = [...characters]
                    .sort((a, b) => (b.date_last_chat || 0) - (a.date_last_chat || 0))
                    .slice(0, 3);
                
                console.debug('[ChatLobby] Preloading chats for', recent.length, 'characters');
                
                // 순차 로딩 (동시 부하 방지)
                for (const char of recent) {
                    if (cache.isValid('chats', char.avatar)) continue;
                    try {
                        const chats = await api.fetchChatsForCharacter(char.avatar);
                        cache.set('chats', chats, char.avatar);
                        await new Promise(r => setTimeout(r, 200)); // 200ms 간격
                    } catch (e) {
                        console.error('[ChatLobby] Chat preload failed:', char.name, e);
                    }
                }
                
                console.debug('[ChatLobby] Chat preload completed');
            }, 3000);
        }, CONFIG.timing.preloadDelay);
    }
    
    // ============================================
    // 로비 열기/닫기
    // ============================================
    
    // 로비 열기 중복 실행 방지
    let isOpeningLobby = false;
    
    /**
     * 로비 열기
     * 캐시는 이벤트로 동기화함 (onChatChanged)
     */
    async function openLobby() {
        // 이미 열기 진행 중이면 무시
        if (isOpeningLobby) {
            return;
        }
        
        // 이미 열려있으면 무시 (상태만 확인)
        if (store.isLobbyOpen) {
            return;
        }
        
        // 열기 시작 - 즉시 락 (첫 await 전에 설정하여 이중 실행 방지)
        isOpeningLobby = true;
        store.setLobbyOpen(true);  // 다른 호출 차단을 위해 즉시 설정
        
        // 🔥 DOM 감시 중지 (로비 열림) - 캐싱 전에 먼저!
        stopRecentDomObserver();
        
        // 🔥 최근 채팅 DOM 캐싱 (로비가 열리기 전에!)
        await cacheRecentChatsBeforeOpen();
        
        // 🔥 캐싱 완료 후 바로 state.recentChats에 반영
        loadRecentChats();

        // ★ 여기서 lastChatCache.updateNow()를 호출하지 않음!
        // updateNow는 시간 + 현재 페르소나를 통째로 덮어쓰므로,
        // "로비를 열기만 해도 기록되고 페르소나가 엉뚱하게 덮어씌워지는" 원인이었음.
        // 갱신은 실제 메시지 송수신 시에만 (MESSAGE_SENT/RECEIVED 이벤트 핸들러에서 처리)
        store.setLobbyLocked(true);  // CHAT_CHANGED settle까지 유지
        
        const overlay = document.getElementById('chat-lobby-overlay');
        const container = document.getElementById('chat-lobby-container');
        const fab = document.getElementById('chat-lobby-fab');
        const chatsPanel = document.getElementById('chat-lobby-chats');
        
        try {
            if (overlay) {
                overlay.style.display = 'flex';
                if (container) container.style.display = 'flex';
                if (fab) fab.style.display = 'none';
            }
            
            // 핸들러가 설정되어 있는지 확인
            if (!store.onCharacterSelect) {
                console.warn('[ChatLobby] Handler not set, re-running setupHandlers');
                setupHandlers();
            }
            
            // 🔥 현재 채팅 중이던 캐릭터 캐시 무효화 (최신 채팅목록 표시)
            const currentChar = getCurrentCharacterAvatar();
            if (currentChar) {
                cache.invalidate('chats', currentChar);
                cache.invalidate('chatCounts', currentChar);
                cache.invalidate('messageCounts', currentChar);
                console.debug('[ChatLobby] Invalidated cache for current character:', currentChar);
            }
            
            // 상태 초기화 (이전 선택 정보 클리어, 핸들러/isLobbyOpen 절대 불변)
            store.resetSelection();
            
            // 캐릭터 선택 락 리셋
            resetCharacterSelectLock();
            
            // ⚠️ 여기서 context.getCharacters()를 부르지 않음
            // 예전엔 로비를 열 때마다 캐릭터 목록 전체를 서버에서 다시 받고 ST 캐릭터 목록 화면까지
            // 다시 그려서 들낙이 느렸음. ST의 context.characters는 항상 최신이고
            // (추가/수정/삭제는 ST가 직접 반영 + CHARACTER_* 이벤트로 캐시 무효화)
            // 수동 새로고침 버튼에서만 강제 재요청함

            // 폴더 필터 항상 리셋 (캐릭터별로 폴더가 다르므로)
            storage.setFilterFolder('all');
            
            // 배치 모드 리셋
            deactivateBatchMode();
            
            // 채팅 패널 닫기 (이전 캐릭터 선택 상태 클리어)
            closeChatPanel();
            
            // 페르소나 바와 캐릭터 그리드를 동시에 렌더링 (한 번에 같이)
            await Promise.all([
                renderPersonaBar(),
                renderCharacterGrid(),
                initPersonaRadialMenu()
            ]);
            
            // 탭 이벤트 바인딩 및 컨텍스트 메뉴 스타일 주입
            bindTabEvents();
            injectContextMenuStyles();
            
            // 페르소나 바 휠 스크롤 설정
            setupPersonaWheelScroll();
            
            // 폴더 드롭다운 업데이트
            updateFolderDropdowns();
            
            // 현재 채팅 중인 캐릭터 자동 선택 (UI만 표시, 채팅목록은 렌더X)
            const currentContext = api.getContext();
            if (currentContext?.characterId !== undefined && currentContext.characterId >= 0) {
                const currentChar = currentContext.characters?.[currentContext.characterId];
                if (currentChar) {
                    // 렌더링 완료 후 선택 표시만
                    setTimeout(() => {
                        const charCard = document.querySelector(
                            `.lobby-char-card[data-char-avatar="${currentChar.avatar}"]`
                        );
                        if (charCard) {
                            charCard.classList.add('selected');
                            // 채팅 목록 렌더 제거 - 사용자가 직접 클릭할 때만 표시
                        }
                    }, 200);
                }
            }
        } catch (e) {
            // 🔥 에러 발생 시 UI 복구 (stuck 방지)
            console.error('[ChatLobby] openLobby failed:', e);
            if (container) container.style.display = 'none';
            if (fab) fab.style.display = 'flex';
            store.setLobbyOpen(false);
            store.setLobbyLocked(false);
            showToast('로비를 여는 중 오류가 발생했습니다.', 'error');
        } finally {
            // 열기 완료 후 플래그 해제
            isOpeningLobby = false;
            
            // 렌더가 끝났으면 바로 잠금 해제
            // (예전엔 0.5초 더 잠가서 로비를 연 직후 카드 클릭이 무시됐음 - 이중 로딩 시절
            //  CHAT_CHANGED가 늦게 들어오던 것 대비. 지금은 로비 열기가 채팅을 바꾸지 않음)
            // 진행 중인 CHAT_CHANGED 쿨다운 렌더가 있으면 그쪽이 끝날 때 해제함
            if (store.isLobbyOpen && !chatChangedCooldownTimer) {
                store.setLobbyLocked(false);
            }
        }
    }
    
    /**
     * 로비 닫기 (상태 초기화)
     * - 로비를 완전히 닫을 때 사용
     * - 캐릭터/채팅 선택 상태를 초기화함
     * - ESC 키, 닫기 버튼, 오버레이 클릭 시 사용
     */
    async function closeLobby() {
        const overlay = document.getElementById('chat-lobby-overlay');
        const container = document.getElementById('chat-lobby-container');
        const fab = document.getElementById('chat-lobby-fab');
        
        if (overlay) overlay.style.display = 'none';
        if (container) container.style.display = 'none';
        if (fab) fab.style.display = 'flex';
        
        // 타이머 정리 (메모리 누수 방지)
        if (chatChangedCooldownTimer) {
            clearTimeout(chatChangedCooldownTimer);
            chatChangedCooldownTimer = null;
        }
        
        // 락 해제
        store.setLobbyLocked(false);
        
        // 🧹 모든 interval 정리 (메모리 누수 방지)
        intervalManager.clearAll();
        
        // CustomTheme 사이드바 버튼 상태 초기화
        const sidebarBtn = document.getElementById('st-chatlobby-sidebar-btn');
        if (sidebarBtn) {
            const icon = sidebarBtn.querySelector('.drawer-icon');
            icon?.classList.remove('openIcon');
            icon?.classList.add('closedIcon');
        }
        
        store.setLobbyOpen(false);
        store.resetSelection(); // 선택 상태 초기화
        closeAllSessionLayers(); // 세션 대화상자/메뉴 (패널을 닫으면 세션 화면 상태도 함께 초기화됨)
        closeChatPanel();
        closeCharInfo();
        toggleCharBatchMode(false);
        
        // 🔥 로비 닫힐 때 DOM 감시 시작 (채팅 변경 감지)
        startRecentDomObserver();
        
        // FAB 프리뷰 갱신 (로비 닫을 때)
        updateFabPreview();
    }
    
    // ============================================
    // 디버그 모달
    // ============================================
    
    /**
     * 디버그 패널 열림 상태
     */
    let isDebugPanelOpen = false;
    
    /**
     * 디버그 패널 열기 - 채팅목록처럼 슬라이드 업 형태
     */
    function openDebugModal() {
        // 이미 열려있으면 닫기
        if (isDebugPanelOpen) {
            closeDebugModal();
            return;
        }
        
        // 기존 패널 있으면 제거
        let panel = document.getElementById('chat-lobby-debug-panel');
        if (panel) {
            panel.remove();
        }
        
        // lastChatCache 데이터
        const lastChatData = {};
        if (lastChatCache.lastChatTimes) {
            lastChatCache.lastChatTimes.forEach((entry, avatar) => {
                // entry는 { time, persona } 객체 또는 숫자(하위 호환)
                const time = (typeof entry === 'number') ? entry : (entry?.time || 0);
                const persona = (typeof entry === 'object') ? (entry?.persona || null) : null;
                lastChatData[avatar] = {
                    time,
                    persona,
                    date: time > 0 ? new Date(time).toLocaleString('ko-KR') : 'N/A'
                };
            });
        }
        
        // 캘린더 스냅샷 데이터
        const calendarSnapshots = loadCalendarSnapshots(true);
        
        // localStorage 키 목록
        const storageKeys = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('chatLobby')) {
                try {
                    const value = localStorage.getItem(key);
                    const parsed = JSON.parse(value);
                    storageKeys[key] = {
                        size: value.length,
                        itemCount: typeof parsed === 'object' ? Object.keys(parsed).length : 1
                    };
                } catch {
                    storageKeys[key] = { size: localStorage.getItem(key)?.length || 0 };
                }
            }
        }
        
        const debugData = {
            _설명: {
                chatLobby_data: '폴더 구조, 채팅 배정, 즐겨찾기, 정렬 옵션',
                chatLobby_lastChatTimes: '캐릭터별 마지막 채팅 시간 (정렬용)',
                chatLobby_calendar: '날짜별 스냅샷 (캘린더 히트맵용)'
            },
            _meta: {
                timestamp: new Date().toLocaleString('ko-KR'),
                cacheInitialized: lastChatCache.initialized,
                totalLastChatEntries: lastChatCache.lastChatTimes?.size || 0,
                totalCalendarSnapshots: Object.keys(calendarSnapshots).length
            },
            storageKeys,
            lastChatCache: lastChatData,
            calendarSnapshots: calendarSnapshots
        };
        
        // 슬라이드 업 패널 생성 (채팅목록 스타일)
        panel = document.createElement('div');
        panel.id = 'chat-lobby-debug-panel';
        panel.className = 'debug-panel slide-up';
        panel.innerHTML = `
            <div class="debug-panel-header">
                <h3>🔧 Debug Data</h3>
                <div class="debug-panel-actions">
                    <button class="debug-copy-btn" id="debug-copy-btn">📋</button>
                    <button class="debug-clear-btn" id="debug-clear-lastchat">🗑️</button>
                    <button class="debug-close-btn" id="debug-close-btn">✕</button>
                </div>
            </div>
            <div class="debug-panel-body">
                <pre class="debug-panel-pre">${escapeHtml(JSON.stringify(debugData, null, 2))}</pre>
            </div>
        `;
        
        // 로비 컨테이너 안에 추가 (오버레이 아님)
        const container = document.getElementById('chat-lobby-container');
        if (container) {
            container.appendChild(panel);
        } else {
            document.body.appendChild(panel);
        }
        
        isDebugPanelOpen = true;
        
        // 애니메이션 트리거
        requestAnimationFrame(() => {
            panel.classList.add('open');
        });
        
        // 이벤트 바인딩 (직접 연결)
        panel.querySelector('#debug-copy-btn')?.addEventListener('click', () => {
            navigator.clipboard.writeText(JSON.stringify(debugData, null, 2))
                .then(() => showToast('클립보드에 복사됨', 'success'))
                .catch(() => showToast('복사 실패', 'error'));
        });
        
        panel.querySelector('#debug-clear-lastchat')?.addEventListener('click', async () => {
            const confirmed = await showConfirm('LastChatCache 데이터를 삭제하시겠습니까?');
            if (confirmed) {
                lastChatCache.clear();
                showToast('LastChatCache 삭제됨', 'success');
                closeDebugModal();
            }
        });
        
        panel.querySelector('#debug-close-btn')?.addEventListener('click', () => {
            closeDebugModal();
        });
    }
    
    /**
     * 디버그 패널 닫기
     */
    function closeDebugModal() {
        const panel = document.getElementById('chat-lobby-debug-panel');
        if (panel) {
            panel.classList.remove('open');
            setTimeout(() => panel.remove(), 300);
        }
        isDebugPanelOpen = false;
    }
    
    // 전역 API (네임스페이스 정리)
    window.ChatLobby = window.ChatLobby || {};
    window._chatLobbyLastChatCache = lastChatCache;
    // 디버그: 그룹별 리스너 등록 현황 (콘솔에서 ChatLobby.listenerStats() 호출)
    window.ChatLobby.listenerStats = () => listeners.stats();
    // 저장 가드 켜기/끄기 (콘솔에서 ChatLobby.saveGuard(false))
    window.ChatLobby.saveGuard = (value = true) => setSaveGuardEnabled(value);

    /**
     * 전역 정리 함수 (확장 재로드 시 호출)
     * 모든 이벤트 리스너, observer, 메모리 정리
     * ⚠️ idempotent: 여러 번 호출해도 안전해야 함
     */
    function cleanup() {
        console.info('[ChatLobby] 🧹 Cleanup started');
        
        cleanupSillyTavernEvents();
        uninstallSaveGuard();
        clearBootWatchdog();
        if (appReadyListener) {
            const ctx = window.SillyTavern?.getContext?.();
            const eventName = ctx?.eventTypes?.APP_INITIALIZED || ctx?.eventTypes?.APP_READY;
            try { ctx?.eventSource?.removeListener?.(eventName, appReadyListener); } catch { /* ignore */ }
            appReadyListener = null;
        }
        cleanupEventDelegation();
        cleanupCustomThemeIntegration();
        cleanupTooltip();
        cleanupPersonaRadialMenu();
        cleanupThemeMenu();
        intervalManager.clearAll();

        // 🧹 남아있는 모든 그룹 리스너 일괄 해제 (안전망)
        listeners.clearAll();
        
        // 타이머 정리
        if (chatChangedCooldownTimer) {
            clearTimeout(chatChangedCooldownTimer);
            chatChangedCooldownTimer = null;
        }
        
        // 플래그 초기화 (재초기화 허용)
        eventsRegistered = false;
        window._chatLobbyInitialized = false;
        
        removeExistingUI();
        
        console.info('[ChatLobby] ✅ Cleanup completed');
    }
    
    // 기존 인스턴스 정리 (확장 재로드 대비)
    if (window.ChatLobby._cleanup) {
        window.ChatLobby._cleanup();
    }
    window.ChatLobby._cleanup = cleanup;
    
    window.ChatLobby.refresh = async function() {
        cache.invalidateAll();
        
        // SillyTavern의 캐릭터 목록 강제 갱신
        const context = api.getContext();
        if (typeof context?.getCharacters === 'function') {
            await context.getCharacters();
        }
        
        await Promise.all([
            renderPersonaBar(),
            renderCharacterGrid(),
            refreshPersonaRadialMenu()
        ]);
    };
    // 하위 호환성 유지
    window.chatLobbyRefresh = window.ChatLobby.refresh;
    
    // ============================================
    // 이벤트 위임 (Event Delegation)
    // ============================================
    
    // 이벤트 리스너 중복 등록 방지 플래그
    let eventsInitialized = false;
    // 이벤트 핸들러 참조 저장 (cleanup용)
    let refreshGridHandler = null;
    
    /**
     * 이벤트 위임 설정
     * getElementById 대신 상위 컨테이너에서 이벤트를 위임 처리
     */
    function setupEventDelegation() {
        if (eventsInitialized) return;
        eventsInitialized = true;

        // ★ 모든 전역(document/window/영속 요소) 리스너는 listenerManager의
        // 'global' 그룹으로 등록 → cleanupEventDelegation에서 한 번에 해제

        // FAB 버튼 (document.body에 위임)
        listeners.add('global', document.body, 'click', handleBodyClick);

        // 키보드 이벤트
        listeners.add('global', document, 'keydown', handleKeydown);

        // 검색 입력 (input 이벤트는 위임이 잘 안되므로 직접 바인딩)
        const searchInput = document.getElementById('chat-lobby-search-input');
        listeners.add('global', searchInput, 'input', (e) => handleSearch(e.target.value));

        // 드롭다운 change 이벤트도 직접 바인딩
        bindDropdownEvents();

        // 순환참조 방지용 이벤트 리스너
        refreshGridHandler = () => {
            renderCharacterGrid(store.searchTerm);
        };
        listeners.add('global', window, 'chatlobby:refresh-grid', refreshGridHandler);

        // tabView 등 외부에서 closeLobby 호출용 이벤트
        closeLobbyHandler = () => closeLobby();
        listeners.add('global', window, 'chatlobby:close', closeLobbyHandler);

        // 탭 뷰에서 캐릭터 선택 이벤트
        listeners.add('global', document, 'lobby:select-character', async (e) => {
            const { avatar } = e.detail;
            if (!avatar) return;

            // 캐릭터 탭으로 전환
            switchTab('characters');

            // 캐릭터 선택 시뮬레이션
            const charCard = document.querySelector(`.lobby-char-card[data-char-avatar="${avatar}"]`);
            if (charCard) {
                charCard.click();
            }
        });

        // 탭 뷰에서 폴더 관리 모달 열기 이벤트
        listeners.add('global', document, 'lobby:open-folder-modal', () => {
            openFolderModal();
        });
    }

    /**
     * 이벤트 위임 정리 (확장 재로드 대비)
     */
    function cleanupEventDelegation() {
        if (!eventsInitialized) return;

        listeners.clear('global');
        refreshGridHandler = null;
        closeLobbyHandler = null;

        eventsInitialized = false;
    }
    
    /**
     * 페르소나 바 마우스 휠 가로 스크롤 설정
     */
    function setupPersonaWheelScroll() {
        const personaList = document.getElementById('chat-lobby-persona-list');
        if (!personaList) return;

        // 이미 바인딩되어 있으면 스킵
        if (personaList.dataset.wheelBound) return;
        personaList.dataset.wheelBound = 'true';

        listeners.add('global', personaList, 'wheel', (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                personaList.scrollLeft += e.deltaY;
            }
        }, { passive: false });
    }
    
    /**
     * 상단 영역 접기/펼치기 토글
     */
    function toggleCollapse() {
        const leftPanel = document.getElementById('chat-lobby-left');
        const collapseBtn = document.getElementById('chat-lobby-collapse-btn');
        if (!leftPanel || !collapseBtn) return;
        
        const isCollapsed = leftPanel.classList.toggle('collapsed');
        collapseBtn.textContent = isCollapsed ? '▼' : '▲';
        
        // localStorage에 저장
        localStorage.setItem('chatlobby-collapsed', isCollapsed.toString());
    }
    
    /**
     * body 클릭 이벤트 핸들러 (이벤트 위임)
     * @param {MouseEvent} e
     */
    function handleBodyClick(e) {
        const target = e.target;

        // FAB 버튼은 로비 외부에 있으므로 별도 처리
        if (target.id === 'chat-lobby-fab' || target.closest('#chat-lobby-fab')) {
            openLobby();
            return;
        }

        // 테마 메뉴 외부 클릭 시 닫기 (토글 버튼 제외)
        if (isThemeMenuOpen()
            && !target.closest('#chat-lobby-theme-menu')
            && !target.closest('#chat-lobby-theme-toggle')) {
            closeThemeMenu();
        }

        // 로비 컨테이너 내부 클릭만 처리
        const lobbyContainer = target.closest('#chat-lobby-container');
        const folderModal = target.closest('#chat-lobby-folder-modal');

        if (!lobbyContainer && !folderModal) {
            // 로비 외부 클릭은 무시
            return;
        }
        
        // 캐릭터 카드나 채팅 아이템 클릭은 무시 (각자 핸들러가 있음)
        if (target.closest('.lobby-char-card') || target.closest('.lobby-chat-item')) {
            return;
        }
        
        // data-action 속성으로 액션 분기
        const actionEl = target.closest('[data-action]');
        if (actionEl) {
            handleAction(actionEl.dataset.action, actionEl, e).catch(err => console.error('[ChatLobby] Action error:', err));
            return;
        }
    }
    
    /**
     * data-action 기반 액션 처리
     * @param {string} action - 액션 이름
     * @param {HTMLElement} el - 트리거 요소
     * @param {Event} e - 이벤트 객체
     */
    async function handleAction(action, el, e) {
        switch (action) {
            case 'open-lobby':
                await openLobby();
                break;
            case 'close-lobby':
                await closeLobby();
                break;
            case 'open-stats':
                openStatsView();
                break;
            case 'close-stats':
                closeStatsView();
                break;
            case 'refresh':
                await handleRefresh();
                break;
            case 'new-chat':
                await startNewChat();
                break;
            case 'delete-char':
                await deleteCharacter();
                break;
            case 'add-persona':
                await handleAddPersona();
                break;
            case 'import-char':
                handleImportCharacter();
                break;
            case 'toggle-batch':
                toggleBatchMode();
                break;
            case 'batch-cancel':
                toggleBatchMode();
                break;
            case 'batch-delete':
                await executeBatchDelete();
                break;
            case 'batch-select-all':
                batchSelectAll();
                break;
            case 'batch-session':
                await executeBatchSession();
                break;
            case 'open-folder-modal':
                openFolderModal();
                break;
            case 'close-folder-modal':
                closeFolderModal();
                break;
            case 'add-folder':
                addFolder();
                break;
            case 'close-chat-panel':
                // CSS에서 850px 이하일 때만 버튼이 보이므로, 조건 체크 불필요
                closeChatPanel();
                break;
            case 'go-to-character':
                // 캐릭터는 로비 안에서 정보만 표시 (채팅 전환 없음), 그룹은 기존대로 이동
                if (store.currentGroup) {
                    await handleGoToGroup();
                } else if (store.currentCharacter) {
                    await openCharInfo(store.currentCharacter);
                }
                break;
            case 'edit-character':
                closeCharInfo();
                await handleGoToCharacter();
                break;
            case 'close-charinfo':
                closeCharInfo();
                break;
            case 'toggle-char-batch':
                closeChatPanel();
                toggleCharBatchMode();
                break;
            case 'char-batch-select-all':
                charBatchSelectAll();
                break;
            case 'char-batch-clear':
                charBatchClear();
                break;
            case 'char-batch-delete':
                await charBatchDelete();
                break;
            case 'toggle-collapse':
                toggleCollapse();
                break;
            case 'open-theme-menu':
            case 'toggle-theme': // 하위 호환
                toggleThemeMenu();
                break;
            case 'set-theme':
                applyTheme(el.dataset.theme);
                break;
            case 'random-char':
                await handleRandomCharacter();
                break;
            case 'toggle-header-menu':
                toggleHeaderMenu();
                break;
            case 'open-calendar':
                openCalendarView();
                break;
            case 'close-calendar':
                closeCalendarView();
                break;
            case 'go-to-characters':
                switchTab('characters');
                break;
            case 'open-debug':
                openDebugModal();
                break;
            case 'close-debug':
                closeDebugModal();
                break;
            case 'switch-persona':
                await handleSwitchPersona(el);
                break;
            case 'refresh-branches':
                await handleRefreshBranches();
                break;
            default:
                // session-* 액션 (세션 카드/세션 줄/시작 버튼)
                await handleSessionAction(action, el);
                break;
        }
    }
    
    /**
     * 모바일 헤더 메뉴 토글
     */
    function toggleHeaderMenu() {
        const header = document.getElementById('chat-lobby-header');
        if (header) {
            header.classList.toggle('menu-open');
        }
    }
    
    /**
     * 키보드 이벤트 핸들러
     * @param {KeyboardEvent} e
     */
    function handleKeydown(e) {
        if (e.key === 'Escape') {
            // 세션 대화상자/팝업이 열려 있으면 가장 위의 것 하나만 닫기 (채팅 패널 위에 떠 있으므로 맨 먼저)
            if (closeTopSessionLayer()) {
                return;
            }

            // 리마인드 뷰어(라이트박스 포함)가 열려있으면 그것부터 닫기
            // (이 핸들러가 뷰어 자체 핸들러보다 먼저 실행되므로 여기서 분기해야
            //  ESC가 로비를 통째로 닫아버리는 사고를 막을 수 있음)
            if (closeTopRemindLayer()) {
                return;
            }

            // 캐릭터 정보 패널 열려있으면 먼저 닫기
            if (isCharInfoOpen()) {
                closeCharInfo();
                return;
            }

            // 봇 선택 모드면 그것부터 끝내기
            if (isCharBatchMode()) {
                toggleCharBatchMode(false);
                return;
            }

            // 디버그 패널 열려있으면 먼저 닫기
            if (isDebugPanelOpen) {
                closeDebugModal();
                return;
            }
            
            // 통계 화면 열려있으면 먼저 닫기
            if (isStatsViewOpen()) {
                closeStatsView();
                return;
            }
            
            const folderModal = document.getElementById('chat-lobby-folder-modal');
            if (folderModal?.style.display === 'flex') {
                closeFolderModal();
            } else if (store.isLobbyOpen) {
                closeLobby();
            }
        }
        
        // 폴더 추가 Enter 키
        if (e.key === 'Enter' && e.target.id === 'new-folder-name') {
            addFolder();
        }
    }
    
    /**
     * 드롭다운 이벤트 바인딩
     */
    function bindDropdownEvents() {
        // 캐릭터 정렬
        listeners.add('global', document.getElementById('chat-lobby-char-sort'), 'change', (e) => {
            handleCharSortChange(e.target.value);
        });

        // 채팅 필터
        listeners.add('global', document.getElementById('chat-lobby-folder-filter'), 'change', (e) => {
            handleFilterChange(e.target.value);
        });

        // 채팅 정렬
        listeners.add('global', document.getElementById('chat-lobby-chat-sort'), 'change', (e) => {
            handleChatSortChange(e.target.value);
        });

        // 배치 체크박스 변경 (위임)
        listeners.add('global', document.getElementById('chat-lobby-chats-list'), 'change', (e) => {
            if (e.target.classList.contains('chat-select-cb')) {
                updateBatchCount();
            }
        });
    }
    
    // ============================================
    // 액션 핸들러
    // ============================================
    
    /**
     * 새로고침 처리 - 캐시 완전 무효화 후 강제 리로드
     */
    async function handleRefresh() {
        cache.invalidateAll();

        // 강제로 API 재호출 (사용자가 직접 누른 새로고침에서만 캐릭터 목록 재요청)
        await api.fetchPersonas();
        try {
            const context = api.getContext();
            if (typeof context?.getCharacters === 'function') {
                await context.getCharacters();
            }
        } catch (e) {
            console.warn('[ChatLobby] Failed to refresh characters:', e);
        }
        
        await Promise.all([
            renderPersonaBar(),
            renderCharacterGrid(),
            refreshPersonaRadialMenu()
        ]);
        
        showToast('새로고침 완료', 'success');
    }
    
    /**
     * 랜덤 캐릭터 선택 - 오늘은 누구랑 할까?
     */
    /**
     * 페르소나 퀵 스위치 처리
     * @param {HTMLElement} el - 클릭된 버튼 요소
     */
    async function handleSwitchPersona(el) {
        console.debug('[ChatLobby] handleSwitchPersona called:', el);
        const personaKey = el?.dataset?.persona;
        console.debug('[ChatLobby] Persona key:', personaKey);
        if (!personaKey) {
            console.warn('[ChatLobby] No persona key found');
            return;
        }

        const success = await api.setPersona(personaKey);
        if (success) {
            // 사용 기록 저장 (최근 사용순 정렬용)
            storage.recordPersonaUsage(personaKey);
            // SETTINGS_UPDATED 핸들러의 이중 기록/리렌더 방지
            lastKnownPersona = personaKey;
            // 🔥 FAB 아바타 직접 업데이트 (타이밍 문제 해결)
            const fabAvatar = document.getElementById('persona-fab-avatar');
            const fabIcon = document.getElementById('persona-fab-icon');
            if (fabAvatar && fabIcon) {
                fabAvatar.src = `/User Avatars/${encodeURIComponent(personaKey)}`;
                fabAvatar.style.display = 'block';
                fabIcon.style.display = 'none';
                fabAvatar.onerror = () => {
                    fabAvatar.style.display = 'none';
                    fabIcon.style.display = 'flex';
                };
            }
            
            // 페르소나 바 UI 업데이트
            await renderPersonaBar();
            // 레이디얼 메뉴도 새로고침
            await refreshPersonaRadialMenu();
            showToast('페르소나 변경됨', 'success');
        } else {
            showToast('페르소나 변경 실패', 'error');
        }
    }

    /**
     * 분기 분석 새로고침 처리
     */
    async function handleRefreshBranches() {
        const currentChar = store.currentCharacter;
        if (!currentChar) {
            showToast('캐릭터를 먼저 선택하세요', 'warning');
            return;
        }
        
        const charAvatar = currentChar.avatar;
        const btn = document.getElementById('chat-lobby-branch-refresh');
        
        try {
            // 버튼 비활성화 및 로딩 표시
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<span class="icon">⏳</span>';
            }
            
            showToast('분기 분석 중...', 'info');
            
            // 캐시 클리어
            clearBranchCache(charAvatar);
            
            // 채팅 목록 가져오기
            const chats = await api.fetchChatsForCharacter(charAvatar, true);  // 🔥 강제 새로고침
            if (!chats || chats.length < 2) {
                showToast('분기 분석에는 2개 이상의 채팅이 필요합니다', 'warning');
                return;
            }
            
            // 분기 분석 실행 (forceRefresh = true)
            const branches = await analyzeBranches(charAvatar, chats, null, true);
            
            showToast(`분기 분석 완료: ${Object.keys(branches).length}개 분기 발견`, 'success');
            
            // 분석 중 캐릭터가 변경됐으면 새로고침 생략
            if (store.currentCharacter?.avatar !== charAvatar) {
                console.debug('[ChatLobby] Character changed during branch analysis, skipping refresh');
                return;
            }
            
            // 채팅 목록 강제 새로고침 (분기 정렬 적용)
            await refreshCurrentChatList(true);
            
        } catch (error) {
            console.error('[ChatLobby] Failed to refresh branches:', error);
            showToast('분기 분석 실패', 'error');
        } finally {
            // 버튼 복원
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span class="icon">🔍</span>';
            }
        }
    }

    async function handleRandomCharacter() {
        const characters = api.getCharacters();
        
        if (!characters || characters.length === 0) {
            showToast('캐릭터가 없습니다', 'warning');
            return;
        }
        
        // 랜덤 인덱스 선택
        const randomIndex = Math.floor(Math.random() * characters.length);
        const randomChar = characters[randomIndex];
        
        // 캐릭터 카드 찾아서 클릭 효과
        const cards = document.querySelectorAll('.lobby-char-card');
        let targetCard = null;
        
        for (const card of cards) {
            if (card.dataset.charAvatar === randomChar.avatar) {
                targetCard = card;
                break;
            }
        }
        
        // 스크롤 & 클릭
        if (targetCard) {
            // 스크롤
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // 잠시 후 클릭 시뮬레이션
            setTimeout(() => {
                targetCard.click();
            }, 300);
        } else {
            // 카드가 보이지 않으면 직접 선택
            const onSelect = store.onCharacterSelect;
            if (onSelect) {
                onSelect({
                    index: randomIndex,
                    avatar: randomChar.avatar,
                    name: randomChar.name,
                    avatarSrc: charAvatarUrl(randomChar.avatar)
                });
            }
        }
    }
    
    // ============================================
    // 임포트/페르소나 - 로비 상시 실행 방식
    // ============================================
    
    /**
     * 캐릭터 임포트 처리
     * 로비를 닫지 않고 임포트 버튼만 클릭
     * 캐릭터 수 변화 감지하여 직접 리렌더
     */
    function handleImportCharacter() {
        const importBtn = document.getElementById('character_import_button');
        if (!importBtn) return;
        
        // 현재 캐릭터 아바타 목록 저장 (숫자만 비교 X)
        const beforeAvatars = new Set(
            api.getCharacters().map(c => c.avatar)
        );
        
        importBtn.click();
        
        let attempts = 0;
        let isChecking = false; // race condition 방지 플래그
        let isCleared = false;  // interval 종료 상태
        const maxAttempts = 10; // 5초 (500ms * 10)
        
        const checkInterval = intervalManager.set(async () => {
            // 이미 종료되었거나 이전 콜백이 실행 중이면 스킵
            if (isCleared || isChecking) return;
            isChecking = true;
            
            try {
                attempts++;
                
                const currentChars = api.getCharacters();
                // 새로운 아바타가 있는지 확인 (더 정확함)
                const newChar = currentChars.find(c => !beforeAvatars.has(c.avatar));
                
                if (newChar) {
                    isCleared = true;
                    intervalManager.clear(checkInterval);
                    cache.invalidate('characters');
                    if (isLobbyOpen()) {
                        // 로비가 아직 열려있는지 재확인 (async 작업 전)
                        await renderCharacterGrid(store.searchTerm);
                    }
                    showToast(`"${newChar.name}" 캐릭터가 추가되었습니다!`, 'success');
                    return;
                }
                
                // 타임아웃
                if (attempts >= maxAttempts) {
                    isCleared = true;
                    intervalManager.clear(checkInterval);
                    // 사용자에게 알리지 않음 (취소했을 수도 있으니까)
                }
            } catch (e) {
                // 🔥 예외 발생 시 interval 정리 (메모리 누수 방지)
                console.error('[ChatLobby] Import check error:', e);
                isCleared = true;
                intervalManager.clear(checkInterval);
            } finally {
                isChecking = false;
            }
        }, 500);
    }
    
    /**
     * 페르소나 추가 처리
     * 드로어 열어서 더미 페르소나 만들기
     * 사용자가 이름 입력 후 확인하면 드로어가 닫히므로 그때 리렌더
     */
    async function handleAddPersona() {
        // 드로어 열기 (CustomTheme 호환 - 클릭 대신 클래스 조작)
        if (!openDrawerSafely('persona-management-button')) {
            showToast('페르소나 관리를 열 수 없습니다.', 'error');
            return;
        }
        
        // 버튼이 나타날 때까지 대기
        const createBtn = await waitForElement('#create_dummy_persona', 2000);
        if (createBtn) {
            createBtn.click();
            cache.invalidate('personas');
            
            // 페르소나 드로어가 닫힐 때까지 감시 (최대 30초)
            // intervalManager 사용
            let checkCount = 0;
            const maxChecks = 60; // 500ms * 60 = 30초
            
            const checkDrawerClosed = intervalManager.set(() => {
                checkCount++;
                const drawer = document.getElementById('persona-management-button');
                const isOpen = drawer?.classList.contains('openDrawer') || 
                               drawer?.querySelector('.drawer-icon.openIcon');
                
                
                if (!isOpen || checkCount >= maxChecks) {
                    intervalManager.clear(checkDrawerClosed);
                    cache.invalidate('personas');
                    if (isLobbyOpen()) {
                        renderPersonaBar();
                    }
                }
            }, 500);
        } else {
            showToast('페르소나 생성 버튼을 찾을 수 없습니다', 'error');
        }
    }
    
    /**
     * 선택된 캐릭터/그룹 편집 화면으로 이동 (봇카드 관리 화면)
     */
    async function handleGoToCharacter() {
        const character = store.currentCharacter;
        const group = store.currentGroup;
        
        // 그룹인 경우
        if (group) {
            await handleGoToGroup();
            return;
        }
        
        if (!character) {
            console.warn('[ChatLobby] No character selected');
            return;
        }
        
        // 캐릭터 선택
        const context = api.getContext();
        const characters = context?.characters || [];
        const index = characters.findIndex(c => c.avatar === character.avatar);
        
        if (index === -1) {
            console.error('[ChatLobby] Character not found:', character.avatar);
            return;
        }
        
        // 로비 닫기 (상태 초기화)
        closeLobby();

        // 이미 선택된 캐릭터인지 확인
        const isAlreadySelected = (String(context.characterId) === String(index));

        if (!isAlreadySelected) {
            // ⚠️ 가벼운 채팅 경유 선택을 쓰지 않음: 드로어를 닫으면 사용자가
            // 최근 채팅이 아닌 "가장 짧은 채팅"에 남아 엉뚱한 채팅에 이어 쓰게 됨
            const result = await switchCharacter(index, character.avatar);
            if (result !== 'ok') {
                console.warn('[ChatLobby] Character selection failed:', result);
            }
        }

        // 바로 드로어 열기 (CustomTheme 호환 - 클릭 대신 클래스 조작)
        if (!openDrawerSafely('rightNavHolder')) {
            // fallback: rightNavDrawerIcon 클릭 시도
            const rightNavIcon = document.getElementById('rightNavDrawerIcon');
            if (rightNavIcon) {
                rightNavIcon.click();
            } else {
                console.warn('[ChatLobby] Could not open character drawer');
            }
        }
    }
    
    /**
     * 선택된 그룹 편집 화면으로 이동
     */
    async function handleGoToGroup() {
        const group = store.currentGroup;
        if (!group) {
            console.warn('[ChatLobby] No group selected');
            return;
        }
        
        // 로비 닫기
        closeLobby();
        
        // 그룹 선택 (이미 선택돼 있으면 생략) - 마지막 채팅 한 번만 로드
        if (api.getContext()?.groupId !== group.id) {
            const result = await switchGroup(group.id);
            if (result !== 'ok') {
                console.warn('[ChatLobby] Group selection failed:', result);
            }
        }

        // 우측 드로어 열기
        await new Promise(resolve => setTimeout(resolve, 200));
        if (!openDrawerSafely('rightNavHolder')) {
            const rightNavIcon = document.getElementById('rightNavDrawerIcon');
            if (rightNavIcon) rightNavIcon.click();
        }
    }
    
    /**
     * 캐릭터 설정 열기 (미사용 - 향후 확장용 예비)
     * @deprecated
     */
    // function handleOpenCharSettings() { ... } // 제거됨
    
    // ============================================
    // 옵션 메뉴에 버튼 추가
    // ============================================
    
    /**
     * 옵션 메뉴에 Chat Lobby 버튼 추가
     */
    function addLobbyToOptionsMenu(retries = 0) {
        const optionsMenu = document.getElementById('options');
        if (!optionsMenu) {
            if (retries < 50) {
                setTimeout(() => addLobbyToOptionsMenu(retries + 1), CONFIG.timing.initDelay);
            }
            return;
        }
        
        if (document.getElementById('option_chat_lobby')) return;
        
        const lobbyOption = document.createElement('a');
        lobbyOption.id = 'option_chat_lobby';
        lobbyOption.innerHTML = '<i class="fa-solid fa-comments"></i> Chat Lobby';
        lobbyOption.style.cssText = 'cursor: pointer;';
        lobbyOption.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // 옵션 메뉴 닫기
            const optionsContainer = document.getElementById('options');
            if (optionsContainer) optionsContainer.style.display = 'none';
            
            openLobby();
        });
        
        optionsMenu.insertBefore(lobbyOption, optionsMenu.firstChild);
    }

    // ============================================
    // DOM 로드 후 초기화
    // ============================================
    
    /**
     * SillyTavern 컨텍스트가 준비될 때까지 대기
     * @param {number} maxAttempts - 최대 시도 횟수
     * @param {number} interval - 시도 간격 (ms)
     * @returns {Promise<boolean>} 성공 여부
     */
    async function waitForSillyTavern(maxAttempts = 30, interval = 500) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const context = window.SillyTavern?.getContext?.();
            if (context && context.characters) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        console.error('[ChatLobby] SillyTavern context not available after', maxAttempts * interval, 'ms');
        return false;
    }
    
    /**
     * 부트스트랩: 셸 즉시 마운트 → ST 준비되면 데이터 채우기
     */
    function bootstrap() {
        let mounted = false;
        try {
            mounted = mountShell();
        } catch (e) {
            // 셸 마운트 실패 시 넣던 UI를 걷어내서 ST 화면을 가리지 않게 함
            console.error('[ChatLobby] Shell mount failed:', e);
            try { removeExistingUI(); } catch { /* ignore */ }
            window._chatLobbyInitialized = false;
            return;
        }
        if (!mounted) return;

        startBootWatchdog();
        whenAppReady(onAppReady);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
    } else {
        bootstrap();
    }

})();
