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

// 스와이프 관련
let touchStartX = 0;
let touchEndX = 0;

/**
 * 상세뷰 싱글톤 (fullscreen) - 모바일 생존 패턴
 */
function ensureDetailView() {
    let view = document.getElementById('calendar-detail-view');
    
    if (!view) {
        view = document.createElement('div');
        view.id = 'calendar-detail-view';
        view.className = 'calendar-detail-view';
        view.style.display = 'none';
        view.innerHTML = `
            <div class="detail-header">
                <button class="detail-back" id="detail-back">← Back</button>
                <span class="detail-date" id="detail-date"></span>
            </div>
            <div class="detail-content">
                <div class="detail-avatar-wrap">
                    <img class="detail-avatar" id="detail-avatar" src="" alt="">
                </div>
                <div class="detail-info">
                    <div class="detail-name" id="detail-name"></div>
                    <div class="detail-stats" id="detail-stats"></div>
                    <div class="detail-total" id="detail-total"></div>
                </div>
            </div>
        `;
        document.body.appendChild(view);
        
        // 뒤로가기 버튼
        view.querySelector('#detail-back').addEventListener('click', hideDetailView);
    }
    
    return view;
}

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
        
        selectedDateInfo = null;
        hideDetailView();
        
        // 첫 접근 체크 (스냅샷 0개)
        const existingSnapshots = loadSnapshots();
        const isFirstAccess = Object.keys(existingSnapshots).length === 0;
        
        if (isFirstAccess) {
            // 첫 접근: 현재 데이터를 "어제"로 저장하고 초기화 메시지
            console.log('[Calendar] First access - initializing baseline data');
            
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
        
        calendarOverlay.style.display = 'flex';
        
        try {
            await saveTodaySnapshot();
        } catch (e) {
            console.error('[Calendar] Failed to save today snapshot:', e);
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
        hideDetailView();
        
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
    selectedDateInfo = null;
    hideDetailView();
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
 * 첫 접근 시 베이스라인 스냅샷 저장 (어제 날짜로)
 * 이후 증감량 계산의 기준점이 됨
 */
async function saveBaselineSnapshot() {
    const yesterday = getLocalDateString(new Date(Date.now() - 86400000));
    
    console.log('[Calendar] Saving baseline as:', yesterday);
    
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
    }
    
    rankings.sort((a, b) => b.messageCount - a.messageCount);
    const totalMessages = rankings.reduce((sum, r) => sum + r.messageCount, 0);
    
    // 캐릭터별 메시지 수 객체 생성
    const byChar = {};
    rankings.forEach(r => {
        byChar[r.avatar] = r.messageCount;
    });
    
    // 메시지 1위 캐릭터
    const topChar = rankings[0]?.avatar || '';
    
    // 어제 날짜로 저장 (베이스라인 - 작년도 허용)
    saveSnapshot(yesterday, totalMessages, topChar, byChar, true);
    console.log('[Calendar] Baseline saved:', yesterday, '| total:', totalMessages, 'messages');
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
        if (!characters || characters.length === 0) {
            characters = api.getCharacters();
        }
        
        if (!characters || !Array.isArray(characters) || characters.length === 0) {
            console.warn('[Calendar] No characters found');
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
                        console.log('[Calendar] API fetch:', char.avatar, '| chats:', chats?.length, '| items:', chats?.reduce((s,c) => s + (c.chat_items||0), 0));
                    } catch (e) {
                        console.error('[Calendar] API error:', char.avatar, e);
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
        }
        
        rankings.sort((a, b) => b.messageCount - a.messageCount);
        const totalMessages = rankings.reduce((sum, r) => sum + r.messageCount, 0);
        
        // 캐릭터별 메시지 수 객체 생성
        const byChar = {};
        rankings.forEach(r => {
            byChar[r.avatar] = r.messageCount;
        });
        
        // 가장 증가한 캐릭터 찾기 (메시지 수 기준)
        let topChar = '';
        let maxIncrease = -Infinity;
        let maxMsgCountOnTie = -1;
        
        for (const r of rankings) {
            const prev = yesterdayByChar[r.avatar] || 0;
            const increase = r.messageCount - prev;
            
            // 증가량 더 크면 교체
            if (increase > maxIncrease) {
                maxIncrease = increase;
                maxMsgCountOnTie = r.messageCount;
                topChar = r.avatar;
            } 
            // 동률이면 메시지 수 많은 캐릭터
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
            console.log('[Calendar] Most increased char:', topChar, '| increase:', maxIncrease, 'messages');
        }
        
        saveSnapshot(today, totalMessages, topChar, byChar);
        
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
 * 호버 이벤트 - PC 전용 (모바일은 클릭만)
 */
function handleMouseOver(e) {
    // 모바일은 hover 무시
    if (window.innerWidth < 769) return;
    
    const dayEl = e.target.closest('.calendar-day');
    if (!dayEl || dayEl.classList.contains('empty')) return;
    
    // PC에서는 hover 시 하이라이트만
    dayEl.classList.add('hover');
}

function handleMouseOut(e) {
    const dayEl = e.target.closest('.calendar-day');
    if (!dayEl) return;
    
    dayEl.classList.remove('hover');
}

/**
 * 날짜 클릭 → 상세뷰 열기
 */
function handleDateClick(e) {
    const dayEl = e.target.closest('.calendar-day');
    if (!dayEl || dayEl.classList.contains('empty')) return;
    
    const date = dayEl.dataset.date;
    const snapshot = getSnapshot(date);
    
    if (!snapshot) return;
    
    showDetailView(date, snapshot);
}

/**
 * 상세뷰 표시 (fullscreen) - 모바일 생존 패턴
 */
function showDetailView(date, snapshot) {
    const view = ensureDetailView();
    const avatarEl = view.querySelector('#detail-avatar');
    const nameEl = view.querySelector('#detail-name');
    const statsEl = view.querySelector('#detail-stats');
    const totalEl = view.querySelector('#detail-total');
    const dateEl = view.querySelector('#detail-date');
    
    if (!snapshot.topChar) {
        return;
    }
    
    const avatarUrl = `/characters/${encodeURIComponent(snapshot.topChar)}`;
    avatarEl.src = avatarUrl;
    avatarEl.onerror = () => { avatarEl.src = '/img/ai4.png'; };
    
    const charName = snapshot.topChar.replace(/\.[^/.]+$/, '');
    nameEl.textContent = charName;
    
    // 전체 증감량
    const totalIncrease = getIncrease(date);
    
    // 해당 캐릭터 증감량 계산 (브라우저 호환 날짜 파싱)
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    dateObj.setDate(dateObj.getDate() - 1);
    const prevDateStr = getLocalDateString(dateObj);
    const prevSnapshot = getSnapshot(prevDateStr);
    
    const charToday = snapshot.byChar?.[snapshot.topChar] || 0;
    const charYesterday = prevSnapshot?.byChar?.[snapshot.topChar] || 0;
    const charIncrease = charToday - charYesterday;
    
    // 어제 데이터 있는지 확인
    const hasPrevData = !!prevSnapshot;
    
    if (hasPrevData) {
        // 어제 데이터 있음 → 증감량 표시
        let statsText = '';
        
        // 캐릭터 증감량 (변화 0일 때 No change)
        if (charIncrease === 0) {
            statsText = 'No change';
        } else if (charIncrease > 0) {
            statsText = `+${charIncrease} chats`;
        } else {
            statsText = `${charIncrease} chats`;
        }
        
        // 전체 증감량도 추가 (다르면)
        if (totalIncrease !== null && totalIncrease !== charIncrease) {
            if (totalIncrease === 0) {
                statsText += ' (Total: No change)';
            } else {
                const totalSign = totalIncrease > 0 ? '+' : '';
                statsText += ` (Total: ${totalSign}${totalIncrease})`;
            }
        }
        
        statsEl.textContent = statsText;
        statsEl.className = charIncrease >= 0 ? 'detail-stats positive' : 'detail-stats negative';
    } else {
        // 첫날 (어제 데이터 없음) → 총합만 표시
        statsEl.textContent = `Today's top character`;
        statsEl.className = 'detail-stats';
    }
    
    // 전체 메시지 수
    totalEl.textContent = `Total: ${snapshot.total} messages`;
    
    // 날짜 표시
    const displayDate = new Date(date);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    dateEl.textContent = `${monthNames[displayDate.getMonth()]} ${displayDate.getDate()}, ${displayDate.getFullYear()}`;
    
    // fullscreen 표시
    view.style.display = 'flex';
}

function hideDetailView() {
    const view = document.getElementById('calendar-detail-view');
    if (view) {
        view.style.display = 'none';
    }
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
