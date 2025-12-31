// ============================================
// 캘린더 뷰 - Grid Style
// ============================================

import { api } from '../api/sillyTavern.js';
import { cache } from '../data/cache.js';
import { loadSnapshots, getSnapshot, saveSnapshot, getLocalDateString, clearAllSnapshots } from '../data/calendarStorage.js';

let calendarOverlay = null;
const THIS_YEAR = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let isCalculating = false;

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
            
            // 그리드 이벤트 위임
            const grid = calendarOverlay.querySelector('#calendar-grid');
            grid.addEventListener('click', handleDateClick);
            
            // 모바일 스와이프 (월 이동)
            const main = calendarOverlay.querySelector('#calendar-main');
            main.addEventListener('touchstart', handleTouchStart, { passive: true });
            main.addEventListener('touchend', handleTouchEnd, { passive: true });
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
}

/**
 * 오늘 스냅샷 저장 - 가장 증가한 캐릭터 찾기
 */
async function saveTodaySnapshot() {
    try {
        const today = getLocalDateString();
        const yesterday = getLocalDateString(new Date(Date.now() - 86400000));
        
        // 어제 스냅샷
        const yesterdaySnapshot = getSnapshot(yesterday);
        const yesterdayByChar = yesterdaySnapshot?.byChar || {};
        
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
        }
        
        saveSnapshot(today, totalMessages, topChar, byChar);
        
    } catch (e) {
        console.error('[Calendar] Failed to save snapshot:', e);
    }
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
        
        if (hasData && snapshot.topChar) {
            const avatarUrl = `/characters/${encodeURIComponent(snapshot.topChar)}`;
            const charName = snapshot.topChar.replace(/\.[^/.]+$/, '');
            
            // 어제 대비 메시지 증감량 계산 (캐릭터/전체)
            const prevDate = new Date(THIS_YEAR, currentMonth, day - 1);
            const prevDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;
            const prevSnapshot = snapshots[prevDateStr];
            
            // 캐릭터 증감량
            const prevCharMsgs = prevSnapshot?.byChar?.[snapshot.topChar] || 0;
            const todayCharMsgs = snapshot.byChar?.[snapshot.topChar] || 0;
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
                    <div class="cal-card-name">${charName}</div>
                    <div class="cal-card-count">${charText}/${totalText}</div>
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
