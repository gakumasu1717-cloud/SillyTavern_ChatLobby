// ============================================
// 캘린더 뷰 - Grid Style
// ============================================

import { api } from '../api/sillyTavern.js';
import { cache } from '../data/cache.js';
import { loadSnapshots, getSnapshot, saveSnapshot, getLocalDateString, clearAllSnapshots } from '../data/calendarStorage.js';
import { lastChatCache } from '../data/lastChatCache.js';
import { escapeHtml } from '../utils/textUtils.js';

let calendarOverlay = null;
const THIS_YEAR = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let isCalculating = false;

// 핀치줌 관련
let originalViewport = null;
let currentScale = 1;
let lastDistance = 0;

/**
 * 캐릭터가 실제로 존재하는지 확인
 * @param {string} avatar - 캐릭터 아바타 파일명
 * @returns {boolean}
 */
function isCharacterExists(avatar) {
    if (!avatar) return false;
    const characters = api.getCharacters();
    if (!characters || !Array.isArray(characters)) return false;
    return characters.some(c => c.avatar === avatar);
}

/**
 * 스냅샷에서 실제 존재하는 top 캐릭터 찾기
 * topChar가 삭제되었으면 byChar에서 다음 순위 찾기
 * @param {object} snapshot - 스냅샷 데이터
 * @returns {string|null} 존재하는 캐릭터 avatar 또는 null
 */
function findValidTopChar(snapshot) {
    if (!snapshot) return null;
    
    // 1순위: 기록된 topChar가 존재하면 그대로 사용
    if (snapshot.topChar && isCharacterExists(snapshot.topChar)) {
        return snapshot.topChar;
    }
    
    // 2순위: byChar에서 메시지 수 기준으로 존재하는 캐릭터 찾기
    if (snapshot.byChar && typeof snapshot.byChar === 'object') {
        const sortedChars = Object.entries(snapshot.byChar)
            .sort((a, b) => b[1] - a[1]); // 메시지 수 내림차순
        
        for (const [avatar, msgCount] of sortedChars) {
            if (isCharacterExists(avatar)) {
                return avatar;
            }
        }
    }
    
    // 존재하는 캐릭터 없음
    return null;
}

/**
 * 캘린더 뷰 열기
 */
export async function openCalendarView() {
    if (isCalculating) return;
    isCalculating = true;
    
    // 핀치줌 허용을 위해 viewport 수정
    const viewport = document.querySelector('meta[name="viewport"]');
    originalViewport = viewport?.content || null;
    if (viewport) {
        viewport.content = 'width=device-width, initial-scale=1, minimum-scale=0.3, maximum-scale=3, user-scalable=yes';
    }
    
    try {
        if (!calendarOverlay) {
            calendarOverlay = document.createElement('div');
            calendarOverlay.id = 'calendar-overlay';
            calendarOverlay.innerHTML = `
                <div class="calendar-fullscreen">
                    <div class="calendar-header">
                        <button class="calendar-close-btn" id="calendar-close">←</button>
                        <div class="calendar-title-area">
                            <button class="cal-nav-btn" id="calendar-prev">‹</button>
                            <div class="calendar-title-text">
                                <span class="calendar-year">${THIS_YEAR}.</span>
                                <span class="calendar-month" id="calendar-title"></span>
                            </div>
                            <button class="cal-nav-btn" id="calendar-next">›</button>
                        </div>
                        <button class="calendar-debug-btn" id="calendar-debug">DATA</button>
                    </div>
                    
                    <div class="calendar-main" id="calendar-main">
                        <div class="calendar-grid" id="calendar-grid"></div>
                    </div>
                </div>
                
                <!-- 디버그/삭제 모달 -->
                <div class="calendar-debug-modal" id="calendar-debug-modal" style="display: none;">
                    <div class="debug-modal-header">
                        <h3>Snapshot Data</h3>
                        <div class="debug-modal-actions">
                            <button class="debug-clear-btn" id="debug-clear-all">Clear All</button>
                            <button class="debug-modal-close" id="debug-modal-close">×</button>
                        </div>
                    </div>
                    <div class="debug-modal-body">
                        <pre class="debug-modal-content" id="debug-modal-content"></pre>
                    </div>
                </div>
            `;
            document.body.appendChild(calendarOverlay);
            
            // 이벤트 바인딩
            calendarOverlay.querySelector('#calendar-close').addEventListener('click', closeCalendarView);
            calendarOverlay.querySelector('#calendar-prev').addEventListener('click', () => navigateMonth(-1));
            calendarOverlay.querySelector('#calendar-next').addEventListener('click', () => navigateMonth(1));
            
            // 디버그 모달
            calendarOverlay.querySelector('#calendar-debug').addEventListener('click', showDebugModal);
            calendarOverlay.querySelector('#debug-modal-close').addEventListener('click', hideDebugModal);
            calendarOverlay.querySelector('#debug-clear-all').addEventListener('click', handleClearAll);
            
            // 핀치줌 이벤트
            const main = calendarOverlay.querySelector('#calendar-main');
            main.addEventListener('touchstart', handlePinchStart, { passive: true });
            main.addEventListener('touchmove', handlePinchMove, { passive: false });
            main.addEventListener('touchend', handleDoubleTap, { passive: true });
        }
        
        // 첫 접근 체크 (스냅샷 0개)
        const existingSnapshots = loadSnapshots();
        const isFirstAccess = Object.keys(existingSnapshots).length === 0;
        
        if (isFirstAccess) {
            // 첫 접근: 현재 데이터를 "어제"로 저장하고 초기화 메시지
            
            try {
                await saveBaselineSnapshot();
            } catch (e) {
                console.error('[Calendar] Failed to save baseline:', e);
            }
            
            // 초기화 완료 알림 (캘린더 안 열림)
            alert('Calendar initialized! Come back tomorrow to see your stats.');
            isCalculating = false;
            return;
        }
        
        // 이후 접근: 정상 동작
        // 로비 컨테이너 숨기기 (모바일에서 완전 풀스크린용)
        const lobbyContainer = document.getElementById('chat-lobby-container');
        if (lobbyContainer) lobbyContainer.style.display = 'none';
        
        // 🔥 로비 테마를 캘린더에 복사 (라이트모드 연동)
        if (lobbyContainer?.classList.contains('light-mode')) {
            calendarOverlay.classList.add('light-mode');
            calendarOverlay.classList.remove('dark-mode');
        } else {
            calendarOverlay.classList.add('dark-mode');
            calendarOverlay.classList.remove('light-mode');
        }
        
        calendarOverlay.style.display = 'flex';
        
        // 스냅샷은 로비에서 이미 저장됨 (characterGrid.js)
        // 캘린더는 읽기만 함
        
        renderCalendar();
    } finally {
        isCalculating = false;
    }
}

/**
 * 캘린더 뷰 닫기
 */
export function closeCalendarView() {
    // viewport 복원
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport && originalViewport) {
        viewport.content = originalViewport;
    }
    
    // 스케일 리셋
    currentScale = 1;
    if (calendarOverlay) {
        const fullscreen = calendarOverlay.querySelector('.calendar-fullscreen');
        if (fullscreen) fullscreen.style.transform = '';
        const grid = calendarOverlay.querySelector('.calendar-grid');
        if (grid) {
            grid.classList.remove('zoomed-in', 'zoomed-out');
        }
    }
    
    if (calendarOverlay) {
        calendarOverlay.style.display = 'none';
        
        // 로비 컨테이너 복원
        const lobbyContainer = document.getElementById('chat-lobby-container');
        if (lobbyContainer) lobbyContainer.style.display = '';
    }
}

/**
 * 월 이동
 */
function navigateMonth(delta) {
    const newMonth = currentMonth + delta;
    if (newMonth < 0 || newMonth > 11) return;
    
    currentMonth = newMonth;
    renderCalendar();
}

/**
 * 핀치줌 핸들러
 */
function getDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function handlePinchStart(e) {
    if (e.touches.length === 2) {
        lastDistance = getDistance(e.touches[0], e.touches[1]);
    }
}

function handlePinchMove(e) {
    if (e.touches.length !== 2) return;
    
    e.preventDefault();
    
    const distance = getDistance(e.touches[0], e.touches[1]);
    const delta = distance / lastDistance;
    
    currentScale = Math.min(Math.max(currentScale * delta, 0.5), 2.5);
    lastDistance = distance;
    
    const fullscreen = calendarOverlay.querySelector('.calendar-fullscreen');
    fullscreen.style.transform = `scale(${currentScale})`;
    fullscreen.style.transformOrigin = 'top left';
    
    updateDetailVisibility();
}

function updateDetailVisibility() {
    const grid = calendarOverlay.querySelector('.calendar-grid');
    if (!grid) return;
    
    if (currentScale >= 1.3) {
        grid.classList.add('zoomed-in');
        grid.classList.remove('zoomed-out');
    } else if (currentScale <= 0.8) {
        grid.classList.add('zoomed-out');
        grid.classList.remove('zoomed-in');
    } else {
        grid.classList.remove('zoomed-in', 'zoomed-out');
    }
}

function handleDoubleTap(e) {
    // 더블탭 리셋 없음 - 오로지 핀치줌으로만 조절
    // 터치 종료 시 현재 스케일 유지
    const fullscreen = calendarOverlay.querySelector('.calendar-fullscreen');
    if (fullscreen && currentScale !== 1) {
        fullscreen.style.transform = `scale(${currentScale})`;
        fullscreen.style.transformOrigin = 'top left';
    }
}

/**
 * 첫 접근 시 베이스라인 스냅샷 저장 (어제 날짜로)
 * 이후 증감량 계산의 기준점이 됨
 * 배치 처리로 메모리 최적화
 */
async function saveBaselineSnapshot() {
    const yesterday = getLocalDateString(new Date(Date.now() - 86400000));
    
    let characters = cache.get('characters');
    if (!characters || characters.length === 0) {
        characters = api.getCharacters();
    }
    
    if (!characters || !Array.isArray(characters) || characters.length === 0) {
        console.warn('[Calendar] No characters found for baseline');
        return;
    }
    
    const BATCH_SIZE = 5;
    const rankings = [];
    
    for (let i = 0; i < characters.length; i += BATCH_SIZE) {
        const batch = characters.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
            batch.map(async (char) => {
                // 캐릭터 스냅샷은 항상 fresh data 필요 (forceRefresh=true)
                let chats;
                try {
                    chats = await api.fetchChatsForCharacter(char.avatar, true);
                } catch {
                    chats = [];
                }
                const chatCount = Array.isArray(chats) ? chats.length : 0;
                const messageCount = Array.isArray(chats) 
                    ? chats.reduce((sum, chat) => sum + (chat.chat_items || 0), 0) 
                    : 0;
                return { avatar: char.avatar, chatCount, messageCount };
            })
        );
        rankings.push(...batchResults);
        
        // 배치 간 약간의 딜레이로 메인 스레드 블로킹 방지
        if (i + BATCH_SIZE < characters.length) {
            await new Promise(r => setTimeout(r, 10));
        }
    }
    
    rankings.sort((a, b) => b.messageCount - a.messageCount);
    const totalMessages = rankings.reduce((sum, r) => sum + r.messageCount, 0);
    
    // 캐릭터별 메시지 수 객체 생성
    const byChar = {};
    rankings.forEach(r => {
        byChar[r.avatar] = r.messageCount;
    });
    
    // 🔥 캐릭터별 마지막 채팅 시간 복사 (어제 날짜에 채팅한 것만)
    const lastChatTimes = {};
    
    // 어제 0시 ~ 오늘 0시 범위 계산 (타임존 안전)
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    yesterdayDate.setHours(0, 0, 0, 0);
    const yesterdayStartMs = yesterdayDate.getTime();
    
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const todayStartMs = todayDate.getTime();
    
    rankings.forEach(r => {
        const lastTime = lastChatCache.get(r.avatar);
        // 어제 0시 ~ 오늘 0시 사이에 채팅한 경우만 저장
        if (lastTime >= yesterdayStartMs && lastTime < todayStartMs) {
            lastChatTimes[r.avatar] = lastTime;
        }
    });
    
    // 메시지 1위 캐릭터
    const topChar = rankings[0]?.avatar || '';
    
    // 어제 날짜로 저장 (베이스라인 - 작년도 허용)
    saveSnapshot(yesterday, totalMessages, topChar, byChar, lastChatTimes, true);
}

/**
 * 가장 최근 스냅샷 찾기 (최대 7일 전까지)
 * @param {string|Date} beforeDate - 기준 날짜 (이 날짜 이전에서 찾음)
 */
function findRecentSnapshot(beforeDate, maxDays = 7) {
    const snapshots = loadSnapshots();
    
    // string이든 Date든 모두 처리
    let checkDate;
    if (typeof beforeDate === 'string') {
        checkDate = new Date(beforeDate + 'T00:00:00');
    } else {
        checkDate = new Date(beforeDate);
    }
    
    for (let i = 0; i < maxDays; i++) {
        checkDate.setDate(checkDate.getDate() - 1);
        const dateStr = getLocalDateString(checkDate);
        if (snapshots[dateStr]) {
            return { date: dateStr, snapshot: snapshots[dateStr] };
        }
    }
    return null;
}

/**
 * 캘린더 렌더링 - 그리드 스타일
 */
function renderCalendar() {
    const title = calendarOverlay.querySelector('#calendar-title');
    const grid = calendarOverlay.querySelector('#calendar-grid');
    const prevBtn = calendarOverlay.querySelector('#calendar-prev');
    const nextBtn = calendarOverlay.querySelector('#calendar-next');
    
    title.textContent = currentMonth + 1;
    
    prevBtn.disabled = (currentMonth === 0);
    nextBtn.disabled = (currentMonth === 11);
    
    const firstDay = new Date(THIS_YEAR, currentMonth, 1).getDay(); // 첫째날 요일 (0=일요일)
    const daysInMonth = new Date(THIS_YEAR, currentMonth + 1, 0).getDate();
    const snapshots = loadSnapshots();
    
    let html = '';
    const today = getLocalDateString();
    
    // 첫 주 앞 빈 셀 (요일 맞추기)
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="cal-card cal-card-blank"></div>';
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = `${THIS_YEAR}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const snapshot = snapshots[date];
        const isToday = date === today;
        const hasData = !!snapshot;
        
        let contentHtml = '';
        
        // 실제 존재하는 top 캐릭터 찾기 (삭제된 경우 fallback)
        const validTopChar = hasData ? findValidTopChar(snapshot) : null;
        
        if (hasData && validTopChar) {
            const avatarUrl = `/characters/${encodeURIComponent(validTopChar)}`;
            const charName = validTopChar.replace(/\.[^/.]+$/, '');
            
            // 가장 최근 스냅샷 찾기 (최대 7일 전까지)
            const currentDate = new Date(THIS_YEAR, currentMonth, day);
            const recentData = findRecentSnapshot(currentDate);
            const prevSnapshot = recentData?.snapshot;
            
            // 캐릭터 증감량 (validTopChar 기준)
            const prevCharMsgs = prevSnapshot?.byChar?.[validTopChar] || 0;
            const todayCharMsgs = snapshot.byChar?.[validTopChar] || 0;
            const charIncrease = todayCharMsgs - prevCharMsgs;
            
            // 전체 증감량
            const prevTotal = prevSnapshot?.total || 0;
            const todayTotal = snapshot.total || 0;
            const totalIncrease = todayTotal - prevTotal;
            
            const charText = charIncrease >= 0 ? `+${charIncrease}` : `${charIncrease}`;
            const totalText = totalIncrease >= 0 ? `+${totalIncrease}` : `${totalIncrease}`;
            
            contentHtml = `
                <img class="cal-card-avatar" src="${avatarUrl}" alt="" onerror="this.style.opacity='0'">
                <div class="cal-card-day">${day}</div>
                <div class="cal-card-gradient"></div>
                <div class="cal-card-info">
                    <div class="cal-card-name">${escapeHtml(charName)}</div>
                    <div class="cal-card-count">${charText}/${totalText}</div>
                </div>
            `;
        } else if (hasData && !validTopChar) {
            // 데이터는 있지만 해당 캐릭터가 모두 삭제됨 - 전체 증감량만 표시
            const currentDate = new Date(THIS_YEAR, currentMonth, day);
            const recentData = findRecentSnapshot(currentDate);
            const prevSnapshot = recentData?.snapshot;
            
            const prevTotal = prevSnapshot?.total || 0;
            const todayTotal = snapshot.total || 0;
            const totalIncrease = todayTotal - prevTotal;
            const totalText = totalIncrease >= 0 ? `+${totalIncrease}` : `${totalIncrease}`;
            
            contentHtml = `
                <div class="cal-card-day">${day}</div>
                <div class="cal-card-info cal-card-info-only">
                    <div class="cal-card-name" style="opacity: 0.5;">삭제됨</div>
                    <div class="cal-card-count">-/${totalText}</div>
                </div>
            `;
        } else {
            // 데이터 없으면 좌상단에 날짜만
            contentHtml = `<div class="cal-card-empty">${day}</div>`;
        }
        
        html += `
            <div class="cal-card ${isToday ? 'today' : ''} ${hasData ? 'has-data' : ''}" data-date="${date}">
                ${contentHtml}
            </div>
        `;
    }
    
    grid.innerHTML = html;
    
    // cal-card 클릭 이벤트 (데이터 있는 날짜만)
    grid.querySelectorAll('.cal-card.has-data').forEach(card => {
        card.addEventListener('click', () => {
            const date = card.dataset.date;
            showLastMessagePanel(date);
        });
    });
}

// Last Message 패널 열림 상태
let isLastMessagePanelOpen = false;

/**
 * Last Message 패널 열기 (디버그 패널과 같은 방식)
 * @param {string} date - YYYY-MM-DD 형식
 */
function showLastMessagePanel(date) {
    // 이미 열려있으면 닫기
    if (isLastMessagePanelOpen) {
        closeLastMessagePanel();
        return;
    }
    
    // 기존 패널 있으면 제거
    let panel = document.getElementById('calendar-lastmsg-panel');
    if (panel) {
        panel.remove();
    }
    
    const snapshot = getSnapshot(date);
    if (!snapshot) return;
    
    // 날짜 표시
    const [year, month, day] = date.split('-');
    const dateStr = `${parseInt(month)}/${parseInt(day)}`;
    
    // 🔥 lastChatTimes 기준으로 가장 최근 채팅한 캐릭터 정렬
    // 방어로직: 삭제된 캐릭터는 스킵하고 다음 캐릭터로 대체
    const snapshotLastChatTimes = snapshot.lastChatTimes || {};
    
    // 전체 시간순 정렬 후 존재하는 캐릭터만 필터링하여 상위 3명 추출
    const allSortedByTime = Object.entries(snapshotLastChatTimes)
        .sort((a, b) => b[1] - a[1]); // 시간 내림차순
    
    const topChars = [];
    for (const [avatar, time] of allSortedByTime) {
        // 🛡️ 방어로직: 캐릭터가 존재하는지 확인
        if (!isCharacterExists(avatar)) {
            console.debug('[LastMessage] Skipping deleted character:', avatar);
            continue; // 삭제된 캐릭터는 스킵, 다음 캐릭터로
        }
        
        topChars.push({ avatar, lastChatTime: time });
        
        // 3명 채우면 종료
        if (topChars.length >= 3) break;
    }
    
    // 카드 HTML 생성
    let cardsHtml = '';
    
    if (topChars.length === 0) {
        // 🛡️ 방어로직: 모든 캐릭터가 삭제됐거나 데이터 없음
        cardsHtml = '<div class="lastmsg-no-data">No character data</div>';
    } else {
        topChars.forEach((char) => {
            const avatarUrl = `/characters/${encodeURIComponent(char.avatar)}`;
            const charName = char.avatar.replace(/\.[^/.]+$/, '');
            const timeStr = char.lastChatTime > 0 
                ? formatLastChatTime(char.lastChatTime)
                : '-';
            
            cardsHtml += `
                <div class="lastmsg-card">
                    <img class="lastmsg-avatar" src="${avatarUrl}" alt="" onerror="this.style.opacity='0.3'">
                    <div class="lastmsg-name">${escapeHtml(charName)}</div>
                    <div class="lastmsg-stats">
                        <div class="lastmsg-label">Last Chat</div>
                        <div class="lastmsg-time">${timeStr}</div>
                    </div>
                </div>
            `;
        });
    }
    
    // 슬라이드 업 패널 생성 (디버그 패널 스타일)
    panel = document.createElement('div');
    panel.id = 'calendar-lastmsg-panel';
    panel.className = 'lastmsg-panel slide-up';
    panel.innerHTML = `
        <div class="lastmsg-panel-header">
            <h3>Last Message</h3>
            <span class="lastmsg-panel-date">${dateStr}</span>
            <button class="lastmsg-close-btn" id="lastmsg-close-btn">✕</button>
        </div>
        <div class="lastmsg-panel-body">
            ${cardsHtml}
        </div>
    `;
    
    // calendar-overlay 안에 추가
    if (calendarOverlay) {
        calendarOverlay.appendChild(panel);
    } else {
        document.body.appendChild(panel);
    }
    
    isLastMessagePanelOpen = true;
    
    // 애니메이션 트리거
    requestAnimationFrame(() => {
        panel.classList.add('open');
    });
    
    // 닫기 버튼 이벤트
    panel.querySelector('#lastmsg-close-btn')?.addEventListener('click', () => {
        closeLastMessagePanel();
    });
}

/**
 * Last Message 패널 닫기
 */
function closeLastMessagePanel() {
    const panel = document.getElementById('calendar-lastmsg-panel');
    if (panel) {
        panel.classList.remove('open');
        setTimeout(() => panel.remove(), 300);
    }
    isLastMessagePanelOpen = false;
}

/**
 * 마지막 채팅 시간 포맷
 * @param {number} timestamp - Unix timestamp
 * @returns {string} 포맷된 시간
 */
function formatLastChatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours < 12 ? 'AM' : 'PM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes} ${ampm}`;
}

/**
 * 디버그 모달 - 데이터 출처 표시
 */
function showDebugModal() {
    const modal = calendarOverlay.querySelector('#calendar-debug-modal');
    const content = calendarOverlay.querySelector('#debug-modal-content');
    
    const snapshots = loadSnapshots(true); // 강제 새로고침
    const today = getLocalDateString();
    const yesterday = getLocalDateString(new Date(Date.now() - 86400000));
    
    const debugInfo = {
        _meta: {
            source: 'localStorage',
            key: 'chatLobby_calendar',
            today,
            yesterday,
            totalSnapshots: Object.keys(snapshots).length,
            hasToday: !!snapshots[today],
            hasYesterday: !!snapshots[yesterday]
        },
        snapshots
    };
    
    content.textContent = JSON.stringify(debugInfo, null, 2);
    modal.style.display = 'flex';
}

function hideDebugModal() {
    calendarOverlay.querySelector('#calendar-debug-modal').style.display = 'none';
}

function handleClearAll() {
    if (confirm('Delete all snapshot data?')) {
        clearAllSnapshots();
        hideDebugModal();
        renderCalendar();
    }
}
