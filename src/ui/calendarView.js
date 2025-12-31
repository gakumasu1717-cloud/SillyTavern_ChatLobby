// ============================================
// 캘린더 뷰 - Wrapped 스타일 풀스크린
// ============================================

import { api } from '../api/sillyTavern.js';
import { cache } from '../data/cache.js';
import { loadSnapshots, getSnapshot, saveSnapshot, getIncrease, getLocalDateString } from '../data/calendarStorage.js';

let calendarOverlay = null;
const THIS_YEAR = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let selectedDateInfo = null;
let isCalculating = false;

/**
 * 캘린더 뷰 열기
 */
export async function openCalendarView() {
    // 레이스 컨디션 방지
    if (isCalculating) return;
    isCalculating = true;
    
    try {
        // 오버레이 생성
        if (!calendarOverlay) {
            calendarOverlay = document.createElement('div');
            calendarOverlay.id = 'calendar-overlay';
            calendarOverlay.innerHTML = `
                <div class="calendar-fullscreen">
                    <div class="calendar-header">
                        <button class="calendar-close-btn" id="calendar-close">←</button>
                        <h2>Chat Calendar</h2>
                        <button class="calendar-debug-btn" id="calendar-debug">Debug</button>
                    </div>
                    
                    <div class="calendar-main">
                        <div class="calendar-nav">
                            <button class="cal-nav-btn" id="calendar-prev">◀</button>
                            <span class="cal-month-title" id="calendar-title"></span>
                            <button class="cal-nav-btn" id="calendar-next">▶</button>
                        </div>
                        
                        <div class="calendar-weekdays">
                            <span class="sun">SUN</span>
                            <span>MON</span>
                            <span>TUE</span>
                            <span>WED</span>
                            <span>THU</span>
                            <span>FRI</span>
                            <span class="sat">SAT</span>
                        </div>
                        
                        <div class="calendar-grid" id="calendar-grid"></div>
                    </div>
                    
                    <!-- 선택된 날짜 봇카드 (PC용 크게) -->
                    <div class="calendar-detail-card" id="calendar-detail" style="display: none;">
                        <div class="detail-card-inner">
                            <img class="detail-card-avatar" id="detail-avatar" src="" alt="">
                            <div class="detail-card-overlay">
                                <div class="detail-card-name" id="detail-name"></div>
                                <div class="detail-card-stats" id="detail-stats"></div>
                                <div class="detail-card-date" id="detail-date"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="calendar-footer" id="calendar-footer"></div>
                </div>
                
                <!-- 디버그 모달 -->
                <div class="calendar-debug-modal" id="calendar-debug-modal" style="display: none;">
                    <div class="debug-modal-header">
                        <h3>Snapshot Data</h3>
                        <button class="debug-modal-close" id="debug-modal-close">×</button>
                    </div>
                    <pre class="debug-modal-content" id="debug-modal-content"></pre>
                </div>
            `;
            document.body.appendChild(calendarOverlay);
            
            // 이벤트 바인딩
            calendarOverlay.querySelector('#calendar-close').addEventListener('click', closeCalendarView);
            calendarOverlay.querySelector('#calendar-prev').addEventListener('click', () => navigateMonth(-1));
            calendarOverlay.querySelector('#calendar-next').addEventListener('click', () => navigateMonth(1));
            calendarOverlay.addEventListener('click', (e) => {
                if (e.target === calendarOverlay) closeCalendarView();
            });
            
            // 디버그 버튼 이벤트
            calendarOverlay.querySelector('#calendar-debug').addEventListener('click', showDebugModal);
            calendarOverlay.querySelector('#debug-modal-close').addEventListener('click', hideDebugModal);
            
            // 날짜 클릭/호버 이벤트 위임
            const grid = calendarOverlay.querySelector('#calendar-grid');
            grid.addEventListener('click', handleDateClick);
            bindHoverEvents(grid);
        }
        
        calendarOverlay.style.display = 'flex';
        selectedDateInfo = null;
        
        // 오늘 스냅샷 저장 (매번 연산)
        await saveTodaySnapshot();
        
        // 캘린더 렌더링
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
    }
}

/**
 * 월 이동 (올해만)
 */
function navigateMonth(delta) {
    const newMonth = currentMonth + delta;
    
    // 올해 1월~12월만 허용
    if (newMonth < 0 || newMonth > 11) {
        return;
    }
    
    currentMonth = newMonth;
    selectedDateInfo = null;
    renderCalendar();
}

/**
 * 오늘 스냅샷 저장 (매번 연산 실행) - 배치 처리
 */
async function saveTodaySnapshot() {
    try {
        const today = getLocalDateString();
        
        // 캐릭터 목록 가져오기 (캐시 키 수정)
        let characters = cache.get('characters');
        if (!characters) {
            characters = await api.fetchCharacters();
        }
        
        if (!characters || !Array.isArray(characters)) {
            console.warn('[Calendar] No characters found');
            return;
        }
        
        // 배치 처리로 API 호출 최적화
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
                    return { name: char.name, avatar: char.avatar, chatCount, messageCount };
                })
            );
            rankings.push(...batchResults);
        }
        
        // 메시지 수로 정렬해서 1위 찾기
        rankings.sort((a, b) => b.messageCount - a.messageCount);
        
        const totalChats = rankings.reduce((sum, r) => sum + r.chatCount, 0);
        const topChar = rankings[0]?.avatar || '';
        
        saveSnapshot(today, totalChats, topChar);
        
    } catch (e) {
        console.error('[Calendar] Failed to save today snapshot:', e);
    }
}

/**
 * 캘린더 렌더링
 */
function renderCalendar() {
    const title = calendarOverlay.querySelector('#calendar-title');
    const grid = calendarOverlay.querySelector('#calendar-grid');
    const footer = calendarOverlay.querySelector('#calendar-footer');
    const detail = calendarOverlay.querySelector('#calendar-detail');
    const prevBtn = calendarOverlay.querySelector('#calendar-prev');
    const nextBtn = calendarOverlay.querySelector('#calendar-next');
    
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    title.textContent = monthNames[currentMonth];
    
    // 이전/다음 버튼 비활성화
    prevBtn.disabled = (currentMonth === 0);
    nextBtn.disabled = (currentMonth === 11);
    
    // 해당 월 첫째 날 요일과 마지막 날짜
    const firstDay = new Date(THIS_YEAR, currentMonth, 1).getDay();
    const daysInMonth = new Date(THIS_YEAR, currentMonth + 1, 0).getDate();
    
    // 스냅샷 데이터 가져오기
    const snapshots = loadSnapshots();
    
    // 그리드 생성
    let html = '';
    
    // 빈 셀 (첫째 주 시작 전)
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="calendar-day empty"></div>';
    }
    
    // 날짜 셀
    const today = getLocalDateString();
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = `${THIS_YEAR}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const snapshot = snapshots[date];
        const isToday = date === today;
        const hasData = !!snapshot;
        
        let content = '';
        if (hasData && snapshot.topChar) {
            // topChar 아바타 썸네일 표시
            const avatarUrl = `/characters/${encodeURIComponent(snapshot.topChar)}`;
            content = `<img class="day-avatar" src="${avatarUrl}" alt="" onerror="this.style.display='none'; this.parentElement.querySelector('.day-no-data')?.style.display='block';">`;
        }
        if (!hasData) {
            content = '<span class="day-no-data">-</span>';
        }
        
        html += `
            <div class="calendar-day ${isToday ? 'today' : ''} ${hasData ? 'has-data' : ''}" data-date="${date}">
                <span class="day-number">${day}</span>
                ${content}
            </div>
        `;
    }
    
    grid.innerHTML = html;
    
    // 상세 정보 숨김
    detail.style.display = selectedDateInfo ? 'flex' : 'none';
    if (selectedDateInfo) {
        showDateDetail(selectedDateInfo);
    }
    
    // 푸터에 연도 표시
    const totalDays = Object.keys(snapshots).length;
    footer.textContent = `${THIS_YEAR} • ${totalDays} days recorded`;
}

/**
 * hover 이벤트 바인딩 (PC)
 */
function bindHoverEvents(grid) {
    grid.addEventListener('mouseenter', (e) => {
        const dayEl = e.target.closest('.calendar-day');
        if (dayEl && !dayEl.classList.contains('empty') && dayEl.dataset.date) {
            const snapshot = getSnapshot(dayEl.dataset.date);
            if (snapshot) {
                showDateDetail(dayEl.dataset.date);
            }
        }
    }, true);
    
    grid.addEventListener('mouseleave', (e) => {
        const dayEl = e.target.closest('.calendar-day');
        if (dayEl && !selectedDateInfo) {
            calendarOverlay.querySelector('#calendar-detail').style.display = 'none';
        }
    }, true);
}

/**
 * 날짜 클릭 핸들러
 */
function handleDateClick(e) {
    const dayEl = e.target.closest('.calendar-day');
    if (!dayEl || dayEl.classList.contains('empty')) return;
    
    const date = dayEl.dataset.date;
    const snapshot = getSnapshot(date);
    
    if (!snapshot) {
        selectedDateInfo = null;
        calendarOverlay.querySelector('#calendar-detail').style.display = 'none';
        return;
    }
    
    // 같은 날짜 클릭 시 토글
    if (selectedDateInfo === date) {
        selectedDateInfo = null;
        calendarOverlay.querySelector('#calendar-detail').style.display = 'none';
        return;
    }
    
    selectedDateInfo = date;
    showDateDetail(date);
}

/**
 * 날짜 상세 정보 표시 (봇카드 스타일)
 */
function showDateDetail(date) {
    const detail = calendarOverlay.querySelector('#calendar-detail');
    const avatarEl = calendarOverlay.querySelector('#detail-avatar');
    const nameEl = calendarOverlay.querySelector('#detail-name');
    const statsEl = calendarOverlay.querySelector('#detail-stats');
    
    const snapshot = getSnapshot(date);
    if (!snapshot || !snapshot.topChar) {
        detail.style.display = 'none';
        return;
    }
    
    // 아바타
    const avatarUrl = `/characters/${encodeURIComponent(snapshot.topChar)}`;
    avatarEl.src = avatarUrl;
    avatarEl.onerror = () => { avatarEl.src = '/img/ai4.png'; };
    
    // 이름 (확장자 제거)
    const charName = snapshot.topChar.replace(/\.[^/.]+$/, '');
    nameEl.textContent = charName;
    
    // 증감량
    const increase = getIncrease(date);
    if (increase !== null) {
        if (increase >= 0) {
            statsEl.textContent = `+${increase} chats`;
            statsEl.className = 'detail-card-stats';
        } else {
            statsEl.textContent = `${increase} chats`;
            statsEl.className = 'detail-card-stats negative';
        }
    } else {
        statsEl.textContent = `${snapshot.total} chats`;
        statsEl.className = 'detail-card-stats';
    }
    
    // 날짜 표시
    const dateEl = calendarOverlay.querySelector('#detail-date');
    const dateObj = new Date(date);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    dateEl.textContent = `${monthNames[dateObj.getMonth()]} ${dateObj.getDate()}`;
    
    detail.style.display = 'flex';
}

/**
 * 디버그 모달 표시
 */
function showDebugModal() {
    const modal = calendarOverlay.querySelector('#calendar-debug-modal');
    const content = calendarOverlay.querySelector('#debug-modal-content');
    
    const snapshots = loadSnapshots();
    content.textContent = JSON.stringify(snapshots, null, 2);
    
    modal.style.display = 'flex';
}

/**
 * 디버그 모달 숨김
 */
function hideDebugModal() {
    calendarOverlay.querySelector('#calendar-debug-modal').style.display = 'none';
}