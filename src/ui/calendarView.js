// ============================================
// 캘린더 뷰 - iOS/Modern Grid Style
// ============================================

import { api } from '../api/sillyTavern.js';
import { cache } from '../data/cache.js';
import { loadSnapshots, getSnapshot, saveSnapshot, getIncrease, getLocalDateString, deleteSnapshot, clearAllSnapshots } from '../data/calendarStorage.js';

let calendarOverlay = null;
const THIS_YEAR = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let selectedDateInfo = null;
let isCalculating = false;
let hoverTimeout = null;

// 스와이프 관련
let touchStartX = 0;
let touchEndX = 0;

/**
 * 캘린더 뷰 열기
 */
export async function openCalendarView() {
    if (isCalculating) return;
    isCalculating = true;
    
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
                    
                    <div class="calendar-main">
                        <div class="calendar-grid-wrapper">
                            <div class="calendar-weekdays">
                                <span class="sun">S</span>
                                <span>M</span>
                                <span>T</span>
                                <span>W</span>
                                <span>T</span>
                                <span>F</span>
                                <span class="sat">S</span>
                            </div>
                            
                            <div class="calendar-grid" id="calendar-grid"></div>
                        </div>
                    </div>
                    
                    <!-- 봇카드 (넷플릭스 스타일) -->
                    <div class="calendar-bot-card" id="calendar-bot-card" style="display: none;">
                        <img class="bot-card-avatar" id="bot-card-avatar" src="" alt="">
                        <div class="bot-card-gradient"></div>
                        <div class="bot-card-info">
                            <div class="bot-card-name" id="bot-card-name"></div>
                            <div class="bot-card-stats" id="bot-card-stats"></div>
                            <div class="bot-card-date" id="bot-card-date"></div>
                        </div>
                    </div>
                    
                    <div class="calendar-footer" id="calendar-footer"></div>
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
            
            // 그리드 이벤트 위임
            const grid = calendarOverlay.querySelector('#calendar-grid');
            grid.addEventListener('click', handleDateClick);
            
            // 호버 이벤트 (debounce 적용)
            grid.addEventListener('mouseover', handleMouseOver);
            grid.addEventListener('mouseout', handleMouseOut);
            
            // 모바일 스와이프
            const wrapper = calendarOverlay.querySelector('.calendar-grid-wrapper');
            wrapper.addEventListener('touchstart', handleTouchStart, { passive: true });
            wrapper.addEventListener('touchend', handleTouchEnd, { passive: true });
        }
        
        calendarOverlay.style.display = 'flex';
        selectedDateInfo = null;
        hideBotCard();
        
        // 스냅샷 저장 실패해도 UI는 열림
        try {
            await saveTodaySnapshot();
        } catch (e) {
            console.error('[Calendar] Failed to save today snapshot, but UI will open:', e);
        }
        
        renderCalendar();
    } finally {
        isCalculating = false;
    }
}

/**
 * 캘린더 뷰 닫기
 */
export function closeCalendarView() {
    if (calendarOverlay) {
        calendarOverlay.style.display = 'none';
        hideBotCard();
    }
}

/**
 * 월 이동
 */
function navigateMonth(delta) {
    const newMonth = currentMonth + delta;
    if (newMonth < 0 || newMonth > 11) return;
    
    currentMonth = newMonth;
    selectedDateInfo = null;
    hideBotCard();
    renderCalendar();
}

/**
 * 터치 스와이프 핸들러
 */
function handleTouchStart(e) {
    touchStartX = e.changedTouches[0].screenX;
}

function handleTouchEnd(e) {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
}

function handleSwipe() {
    const diff = touchStartX - touchEndX;
    const threshold = 50; // 최소 스와이프 거리
    
    if (Math.abs(diff) > threshold) {
        if (diff > 0) {
            // 왼쪽 스와이프 -> 다음 달
            navigateMonth(1);
        } else {
            // 오른쪽 스와이프 -> 이전 달
            navigateMonth(-1);
        }
    }
}

/**
 * 오늘 스냅샷 저장 - 가장 증가한 캐릭터 찾기
 */
async function saveTodaySnapshot() {
    try {
        const today = getLocalDateString();
        const yesterday = getLocalDateString(new Date(Date.now() - 86400000));
        
        console.log('[Calendar] saveTodaySnapshot | today:', today, '| yesterday:', yesterday);
        
        // 어제 스냅샷
        const yesterdaySnapshot = getSnapshot(yesterday);
        const yesterdayByChar = yesterdaySnapshot?.byChar || {};
        
        console.log('[Calendar] yesterdaySnapshot exists:', !!yesterdaySnapshot);
        
        let characters = cache.get('characters');
        if (!characters) {
            characters = await api.fetchCharacters();
        }
        
        if (!characters || !Array.isArray(characters)) {
            console.warn('[Calendar] No characters found');
            return;
        }
        
        const BATCH_SIZE = 5;
        const rankings = [];
        
        for (let i = 0; i < characters.length; i += BATCH_SIZE) {
            const batch = characters.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.all(
                batch.map(async (char) => {
                    let chats = cache.get('chats', char.avatar);
                    if (!chats || !Array.isArray(chats)) {
                        try {
                            chats = await api.fetchChatsForCharacter(char.avatar);
                        } catch {
                            chats = [];
                        }
                    }
                    const chatCount = Array.isArray(chats) ? chats.length : 0;
                    const messageCount = Array.isArray(chats) 
                        ? chats.reduce((sum, chat) => sum + (chat.chat_items || 0), 0) 
                        : 0;
                    return { avatar: char.avatar, chatCount, messageCount };
                })
            );
            rankings.push(...batchResults);
        }
        
        rankings.sort((a, b) => b.messageCount - a.messageCount);
        const totalChats = rankings.reduce((sum, r) => sum + r.chatCount, 0);
        
        // 캐릭터별 채팅수 객체 생성
        const byChar = {};
        rankings.forEach(r => {
            byChar[r.avatar] = r.chatCount;
        });
        
        // 가장 증가한 캐릭터 찾기 (동률 시 메시지 수 많은 캐릭터 우선)
        let topChar = '';
        let maxIncrease = -Infinity;
        let maxMsgCountOnTie = -1;
        
        for (const r of rankings) {
            const prev = yesterdayByChar[r.avatar] || 0;
            const increase = r.chatCount - prev;
            
            // 증가량 더 크면 교체
            if (increase > maxIncrease) {
                maxIncrease = increase;
                maxMsgCountOnTie = r.messageCount;
                topChar = r.avatar;
            } 
            // 동률이면 메시지 수 많은 캐릭터 (더 활발한 캐릭터)
            else if (increase === maxIncrease && r.messageCount > maxMsgCountOnTie) {
                maxMsgCountOnTie = r.messageCount;
                topChar = r.avatar;
            }
        }
        
        // 어제 데이터 없으면 (첫 접속) 메시지 1위로
        if (!yesterdaySnapshot) {
            topChar = rankings[0]?.avatar || '';
            console.log('[Calendar] First time - using message count leader:', topChar);
        } else {
            console.log('[Calendar] Most increased char:', topChar, '| increase:', maxIncrease);
        }
        
        saveSnapshot(today, totalChats, topChar, byChar);
        
    } catch (e) {
        console.error('[Calendar] Failed to save snapshot:', e);
    }
}

/**
 * 캘린더 렌더링
 */
function renderCalendar() {
    const title = calendarOverlay.querySelector('#calendar-title');
    const grid = calendarOverlay.querySelector('#calendar-grid');
    const footer = calendarOverlay.querySelector('#calendar-footer');
    const prevBtn = calendarOverlay.querySelector('#calendar-prev');
    const nextBtn = calendarOverlay.querySelector('#calendar-next');
    
    title.textContent = currentMonth + 1;
    
    prevBtn.disabled = (currentMonth === 0);
    nextBtn.disabled = (currentMonth === 11);
    
    const firstDay = new Date(THIS_YEAR, currentMonth, 1).getDay();
    const daysInMonth = new Date(THIS_YEAR, currentMonth + 1, 0).getDate();
    const snapshots = loadSnapshots();
    
    let html = '';
    
    // 빈 셀
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="calendar-day empty"></div>';
    }
    
    const today = getLocalDateString();
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = `${THIS_YEAR}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const snapshot = snapshots[date];
        const isToday = date === today;
        const hasData = !!snapshot;
        
        let avatarHtml = '';
        if (hasData && snapshot.topChar) {
            const avatarUrl = `/characters/${encodeURIComponent(snapshot.topChar)}`;
            avatarHtml = `<img class="day-avatar" src="${avatarUrl}" alt="" onerror="this.style.opacity='0'">`;
        }
        
        html += `
            <div class="calendar-day ${isToday ? 'today' : ''} ${hasData ? 'has-data' : ''}" data-date="${date}">
                <span class="day-number">${day}</span>
                ${avatarHtml}
            </div>
        `;
    }
    
    grid.innerHTML = html;
    
    const totalDays = Object.keys(snapshots).length;
    footer.textContent = `${totalDays} days recorded`;
}

/**
 * 호버 이벤트 (debounce)
 */
function handleMouseOver(e) {
    const dayEl = e.target.closest('.calendar-day');
    if (!dayEl || dayEl.classList.contains('empty')) return;
    
    if (hoverTimeout) clearTimeout(hoverTimeout);
    
    hoverTimeout = setTimeout(() => {
        const date = dayEl.dataset.date;
        const snapshot = getSnapshot(date);
        if (snapshot && snapshot.topChar) {
            showBotCard(date, snapshot);
        }
    }, 150);
}

function handleMouseOut(e) {
    const dayEl = e.target.closest('.calendar-day');
    if (!dayEl) return;
    
    if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
    }
    
    if (!selectedDateInfo) {
        hideBotCard();
    }
}

/**
 * 날짜 클릭
 */
function handleDateClick(e) {
    const dayEl = e.target.closest('.calendar-day');
    if (!dayEl || dayEl.classList.contains('empty')) return;
    
    const date = dayEl.dataset.date;
    const snapshot = getSnapshot(date);
    
    if (!snapshot) {
        selectedDateInfo = null;
        hideBotCard();
        return;
    }
    
    if (selectedDateInfo === date) {
        selectedDateInfo = null;
        hideBotCard();
        return;
    }
    
    selectedDateInfo = date;
    showBotCard(date, snapshot);
}

/**
 * 봇카드 표시 (넷플릭스 스타일)
 */
function showBotCard(date, snapshot) {
    const card = calendarOverlay.querySelector('#calendar-bot-card');
    const avatarEl = calendarOverlay.querySelector('#bot-card-avatar');
    const nameEl = calendarOverlay.querySelector('#bot-card-name');
    const statsEl = calendarOverlay.querySelector('#bot-card-stats');
    const dateEl = calendarOverlay.querySelector('#bot-card-date');
    
    if (!snapshot.topChar) {
        hideBotCard();
        return;
    }
    
    const avatarUrl = `/characters/${encodeURIComponent(snapshot.topChar)}`;
    avatarEl.src = avatarUrl;
    avatarEl.onerror = () => { avatarEl.src = '/img/ai4.png'; };
    
    const charName = snapshot.topChar.replace(/\.[^/.]+$/, '');
    nameEl.textContent = charName;
    
    const increase = getIncrease(date);
    if (increase !== null) {
        statsEl.textContent = increase >= 0 ? `+${increase} chats` : `${increase} chats`;
        statsEl.className = increase >= 0 ? 'bot-card-stats positive' : 'bot-card-stats negative';
    } else {
        statsEl.textContent = `${snapshot.total} chats`;
        statsEl.className = 'bot-card-stats';
    }
    
    const dateObj = new Date(date);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    dateEl.textContent = `${monthNames[dateObj.getMonth()]} ${dateObj.getDate()}`;
    
    card.style.display = 'flex';
}

function hideBotCard() {
    const card = calendarOverlay?.querySelector('#calendar-bot-card');
    if (card) card.style.display = 'none';
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
