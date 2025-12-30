// ============================================
// 🎊 Chat Lobby Wrapped - Netflix Style 통계 화면
// ============================================

import { api } from '../api/sillyTavern.js';
import { cache } from '../data/cache.js';
import { escapeHtml } from '../utils/textUtils.js';

/** 표시할 최대 랭킹 수 */
const MAX_RANKING = 20;

/** 통계 화면 열려있는지 */
let isStatsOpen = false;

/** 현재 단계 */
let currentStep = 0;

/** 랭킹 데이터 */
let rankingsData = [];
let totalStatsData = {};

/** Fun Facts 데이터 */
let funFactsData = {};

/** 유저 선택/입력 */
let userGuessChar = null;
let userGuessMessages = 0;
let userGuessFirstDate = null;  // 전체 첫 대화일 예상
let userGuessCharDate = null;   // 1위 캐릭터 첫 대화일 예상

// ============================================
// 메인 함수
// ============================================

/**
 * 통계 화면 열기
 */
export async function openStatsView() {
    if (isStatsOpen) return;
    isStatsOpen = true;
    currentStep = 0;
    userGuessChar = null;
    userGuessMessages = 0;
    userGuessFirstDate = null;
    userGuessCharDate = null;
    
    const container = document.getElementById('chat-lobby-main');
    if (!container) return;
    
    // 기존 내용 숨기기
    const leftPanel = document.getElementById('chat-lobby-left');
    const chatsPanel = document.getElementById('chat-lobby-chats');
    const lobbyHeader = document.getElementById('chat-lobby-header');
    if (leftPanel) leftPanel.style.display = 'none';
    if (chatsPanel) chatsPanel.style.display = 'none';
    if (lobbyHeader) lobbyHeader.style.display = 'none';
    
    // 통계 화면 생성
    const statsView = document.createElement('div');
    statsView.id = 'chat-lobby-stats-view';
    statsView.className = 'stats-view wrapped-view';
    statsView.innerHTML = `
        <div class="wrapped-container">
            <div class="wrapped-loading">
                <div class="stats-spinner"></div>
                <div>데이터 불러오는 중...</div>
            </div>
        </div>
    `;
    container.appendChild(statsView);
    
    // 데이터 로드
    await loadWrappedData();
    
    // 인트로 시작
    showStep(1);
}

/**
 * 통계 화면 닫기
 */
export function closeStatsView() {
    if (!isStatsOpen) return;
    isStatsOpen = false;
    
    const statsView = document.getElementById('chat-lobby-stats-view');
    if (statsView) statsView.remove();
    
    // 기존 패널 복원
    const leftPanel = document.getElementById('chat-lobby-left');
    const chatsPanel = document.getElementById('chat-lobby-chats');
    const lobbyHeader = document.getElementById('chat-lobby-header');
    if (leftPanel) leftPanel.style.display = '';
    if (chatsPanel) chatsPanel.style.display = '';
    if (lobbyHeader) lobbyHeader.style.display = '';
}

/**
 * 통계 화면 열려있는지 확인
 */
export function isStatsViewOpen() {
    return isStatsOpen;
}

// ============================================
// 데이터 로딩
// ============================================

async function loadWrappedData() {
    try {
        const characters = api.getCharacters();
        
        if (!characters || characters.length === 0) {
            showError('캐릭터가 없습니다');
            return;
        }
        
        // 모든 캐릭터에서 랭킹 계산
        rankingsData = await fetchRankings(characters);
        totalStatsData = calculateTotalStats(rankingsData, characters.length);
        funFactsData = calculateFunFacts(rankingsData);
        
    } catch (error) {
        console.error('[Wrapped] Failed to load:', error);
        showError('데이터 로딩 실패');
    }
}

async function fetchRankings(characters) {
    const BATCH_SIZE = 5;
    const results = [];
    
    for (let i = 0; i < characters.length; i += BATCH_SIZE) {
        const batch = characters.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
            batch.map(async (char) => {
                try {
                    let chats = cache.get('chats', char.avatar);
                    if (!chats || !Array.isArray(chats)) {
                        chats = await api.fetchChatsForCharacter(char.avatar);
                    }
                    
                    const chatCount = Array.isArray(chats) ? chats.length : 0;
                    let messageCount = 0;
                    let firstChatDate = null;
                    
                    if (Array.isArray(chats)) {
                        messageCount = chats.reduce((sum, chat) => sum + (chat.chat_items || 0), 0);
                        
                        // 첫 대화 날짜 파싱 (가장 오래된 채팅)
                        chats.forEach(chat => {
                            const fileName = chat.file_name || '';
                            const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})/);
                            if (dateMatch) {
                                const chatDate = new Date(dateMatch[1]);
                                if (!firstChatDate || chatDate < firstChatDate) {
                                    firstChatDate = chatDate;
                                }
                            }
                        });
                    }
                    
                    return { name: char.name, avatar: char.avatar, chatCount, messageCount, firstChatDate };
                } catch (e) {
                    return { name: char.name, avatar: char.avatar, chatCount: 0, messageCount: 0, firstChatDate: null };
                }
            })
        );
        results.push(...batchResults);
    }
    
    return results.sort((a, b) => {
        if (b.messageCount !== a.messageCount) return b.messageCount - a.messageCount;
        return b.chatCount - a.chatCount;
    });
}

function calculateTotalStats(rankings, totalCharacters) {
    const totalChats = rankings.reduce((sum, r) => sum + r.chatCount, 0);
    const totalMessages = rankings.reduce((sum, r) => sum + r.messageCount, 0);
    return { characters: totalCharacters, chats: totalChats, messages: totalMessages };
}

function calculateFunFacts(rankings) {
    const topChar = rankings[0];
    const avgMessagesPerChar = rankings.length > 0 
        ? Math.round(rankings.reduce((sum, r) => sum + r.messageCount, 0) / rankings.length)
        : 0;
    
    // 가장 많은 채팅을 가진 캐릭터
    const mostChats = [...rankings].sort((a, b) => b.chatCount - a.chatCount)[0];
    
    // 채팅당 평균 메시지
    const avgMessagesPerChat = totalStatsData.chats > 0 
        ? Math.round(totalStatsData.messages / totalStatsData.chats)
        : 0;
    
    // 가장 오래된 첫 대화 날짜 (전체)
    let oldestDate = null;
    rankings.forEach(r => {
        if (r.firstChatDate && (!oldestDate || r.firstChatDate < oldestDate)) {
            oldestDate = r.firstChatDate;
        }
    });
    
    // 하루 평균 채팅 수 계산
    let avgChatsPerDay = 0;
    if (oldestDate && totalStatsData.chats > 0) {
        const today = new Date();
        const daysDiff = Math.max(1, Math.ceil((today - oldestDate) / (1000 * 60 * 60 * 24)));
        avgChatsPerDay = (totalStatsData.chats / daysDiff).toFixed(1);
    }
    
    // 상위 3 캐릭터 첫 대화 날짜
    const top3WithDates = rankings.slice(0, 3).map(r => ({
        name: r.name,
        firstChatDate: r.firstChatDate
    }));
    
    return {
        avgMessagesPerChar,
        mostChatsChar: mostChats,
        avgMessagesPerChat,
        topCharPercentage: totalStatsData.messages > 0 
            ? Math.round((topChar?.messageCount || 0) / totalStatsData.messages * 100)
            : 0,
        oldestDate,
        avgChatsPerDay,
        top3WithDates
    };
}

// ============================================
// 단계별 화면
// ============================================

function showStep(step) {
    currentStep = step;
    const container = document.querySelector('.wrapped-container');
    if (!container) return;
    
    switch (step) {
        case 1: showIntro(container); break;
        case 2: showFirstDateQuiz(container); break;      // 전체 첫 대화일 퀴즈
        case 3: showFirstDateResult(container); break;    // 전체 첫 대화일 결과
        case 4: showQuiz(container); break;               // 캐릭터 퀴즈
        case 5: showQuizResult(container); break;         // 캐릭터 결과
        case 6: showMessageQuiz(container); break;        // 메시지 수 퀴즈
        case 7: showMessageResult(container); break;      // 메시지 수 결과
        case 8: showCharDateQuiz(container); break;       // 1위 캐릭터 첫 대화일 퀴즈
        case 9: showCharDateResult(container); break;     // 1위 캐릭터 첫 대화일 결과
        case 10: showFinalStats(container); break;        // 최종 결과
        default: closeStatsView();
    }
}

// Step 1: 인트로 - 넷플릭스 스타일
function showIntro(container) {
    container.innerHTML = `
        <div class="wrapped-step intro-step">
            <div class="wrapped-emoji">🎬</div>
            <h2>Your Chat Wrapped</h2>
            <p class="wrapped-subtitle">이때까지 당신은 누구와<br>가장 많이 대화했을까요?</p>
            <button class="wrapped-btn primary" data-action="next">시작하기</button>
            <button class="wrapped-btn secondary" data-action="skip">건너뛰기</button>
        </div>
    `;
    
    container.querySelector('[data-action="next"]').addEventListener('click', () => showStep(2));
    container.querySelector('[data-action="skip"]').addEventListener('click', () => showStep(10));
}

// Step 2: 전체 첫 대화 시작일 퀴즈 (실리태번 설치일)
function showFirstDateQuiz(container) {
    if (!funFactsData.oldestDate) {
        showStep(4);
        return;
    }
    
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= currentYear - 5; y--) {
        years.push(y);
    }
    
    container.innerHTML = `
        <div class="wrapped-step date-quiz-step">
            <div class="wrapped-emoji">📅</div>
            <h2>처음으로 SillyTavern을<br>사용한 날짜, 기억하시나요?</h2>
            <p class="wrapped-subtitle">가장 오래된 채팅의 시작일을 맞춰보세요!</p>
            <div class="date-select-wrap">
                <select id="first-year-guess" class="date-select">
                    <option value="">년도</option>
                    ${years.map(y => `<option value="${y}">${y}년</option>`).join('')}
                </select>
                <select id="first-month-guess" class="date-select">
                    <option value="">월</option>
                    ${Array.from({length: 12}, (_, i) => `<option value="${i + 1}">${i + 1}월</option>`).join('')}
                </select>
                <select id="first-day-guess" class="date-select">
                    <option value="">일</option>
                    ${Array.from({length: 31}, (_, i) => `<option value="${i + 1}">${i + 1}일</option>`).join('')}
                </select>
            </div>
            <button class="wrapped-btn primary" data-action="submit">확인하기</button>
        </div>
    `;
    
    const btn = container.querySelector('[data-action="submit"]');
    btn.addEventListener('click', () => {
        const y = parseInt(container.querySelector('#first-year-guess').value) || null;
        const m = parseInt(container.querySelector('#first-month-guess').value) || null;
        const d = parseInt(container.querySelector('#first-day-guess').value) || null;
        userGuessFirstDate = (y && m && d) ? new Date(y, m - 1, d) : null;
        showStep(3);
    });
}

// Step 3: 전체 첫 대화 시작일 결과
function showFirstDateResult(container) {
    const actualDate = funFactsData.oldestDate;
    const dateStr = actualDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    
    // 정답 판정
    let emoji, title;
    if (userGuessFirstDate) {
        const diffDays = Math.abs(Math.ceil((actualDate - userGuessFirstDate) / (1000 * 60 * 60 * 24)));
        if (diffDays <= 7) {
            emoji = '🎯';
            title = '대단해요! 거의 정확해요!';
        } else if (diffDays <= 30) {
            emoji = '👍';
            title = '꽤 가까워요!';
        } else {
            emoji = '😅';
            title = '아쉬워요!';
        }
    } else {
        emoji = '📅';
        title = '정답은...';
    }
    
    container.innerHTML = `
        <div class="wrapped-step date-result-step">
            <div class="wrapped-emoji">${emoji}</div>
            <h2>${title}</h2>
            <p class="wrapped-subtitle">당신의 SillyTavern 여정이 시작된 날</p>
            <div class="date-reveal">
                <span class="date-value">${dateStr}</span>
            </div>
            <button class="wrapped-btn primary" data-action="next">다음</button>
        </div>
    `;
    
    container.querySelector('[data-action="next"]').addEventListener('click', () => showStep(4));
}

// Step 4: 캐릭터 맞추기 퀴즈
function showQuiz(container) {
    if (rankingsData.length < 3) {
        showStep(10); // 캐릭터 부족하면 바로 결과
        return;
    }
    
    // 상위 3개 + 셔플
    const top3 = rankingsData.slice(0, 3);
    const shuffled = [...top3].sort(() => Math.random() - 0.5);
    
    container.innerHTML = `
        <div class="wrapped-step quiz-step">
            <div class="wrapped-emoji">🤔</div>
            <h2>가장 많이 대화한 캐릭터는?</h2>
            <div class="quiz-options">
                ${shuffled.map((char, i) => {
                    const avatarUrl = char.avatar ? `/characters/${encodeURIComponent(char.avatar)}` : '/img/ai4.png';
                    return `
                        <div class="quiz-option spin-animation" data-name="${escapeHtml(char.name)}" style="animation-delay: ${i * 0.2}s">
                            <img src="${avatarUrl}" alt="${escapeHtml(char.name)}" onerror="this.src='/img/ai4.png'">
                            <span>${escapeHtml(char.name)}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    container.querySelectorAll('.quiz-option').forEach(opt => {
        opt.addEventListener('click', () => {
            userGuessChar = opt.dataset.name;
            showStep(5);
        });
    });
}

// Step 5: 퀴즈 결과
function showQuizResult(container) {
    const correct = rankingsData[0];
    const isCorrect = userGuessChar === correct.name;
    const avatarUrl = correct.avatar ? `/characters/${encodeURIComponent(correct.avatar)}` : '/img/ai4.png';
    
    // 정답이면 confetti!
    if (isCorrect) {
        showConfetti();
    }
    
    container.innerHTML = `
        <div class="wrapped-step result-step ${isCorrect ? 'result-correct' : 'result-wrong'}">
            <div class="wrapped-emoji">${isCorrect ? '🎉' : '😅'}</div>
            <h2>${isCorrect ? '정답이에요!' : '아쉬워요!'}</h2>
            ${!isCorrect ? `<p class="wrapped-subtitle">정답은 <strong>${escapeHtml(correct.name)}</strong> 이었어요!</p>` : ''}
            <div class="result-avatar ${isCorrect ? 'sparkle-animation' : ''}">
                <img src="${avatarUrl}" alt="${escapeHtml(correct.name)}" onerror="this.src='/img/ai4.png'">
                <span>${escapeHtml(correct.name)}</span>
            </div>
            <button class="wrapped-btn primary" data-action="next">다음</button>
        </div>
    `;
    
    container.querySelector('[data-action="next"]').addEventListener('click', () => showStep(6));
}

// Step 6: 메시지 개수 맞추기
function showMessageQuiz(container) {
    const top = rankingsData[0];
    
    container.innerHTML = `
        <div class="wrapped-step message-quiz-step">
            <div class="wrapped-emoji">💬</div>
            <h2>그럼, ${escapeHtml(top.name)}과<br>몇 개의 메시지를 나눴을까요?</h2>
            <div class="message-input-wrap">
                <input type="number" id="message-guess" placeholder="예상 메시지 수" min="0">
            </div>
            <button class="wrapped-btn primary" data-action="submit">확인하기</button>
        </div>
    `;
    
    const input = container.querySelector('#message-guess');
    const btn = container.querySelector('[data-action="submit"]');
    
    btn.addEventListener('click', () => {
        userGuessMessages = parseInt(input.value) || 0;
        showStep(7);
    });
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            userGuessMessages = parseInt(input.value) || 0;
            showStep(7);
        }
    });
}

// Step 7: 메시지 결과
function showMessageResult(container) {
    const top = rankingsData[0];
    const actual = top.messageCount;
    const guess = userGuessMessages;
    const result = judgeMessageGuess(actual, guess);
    
    let emoji, title, subtitle;
    
    if (result === 'accurate') {
        emoji = '🎯';
        title = '대단해요!';
        subtitle = '거의 정확해요!';
    } else if (result === 'too_high') {
        emoji = '📉';
        title = '앗!';
        subtitle = '실제로는 훨씬 적게 메시지를 보내셨어요!';
    } else {
        emoji = '📈';
        title = '와!';
        subtitle = '실제로는 훨씬 많은 메시지를 보내셨어요!';
    }
    
    container.innerHTML = `
        <div class="wrapped-step message-result-step">
            <div class="wrapped-emoji">${emoji}</div>
            <h2>${title}</h2>
            <p class="wrapped-subtitle">${subtitle}</p>
            <div class="message-compare">
                <div class="compare-item">
                    <span class="compare-label">실제 메시지</span>
                    <span class="compare-value ${result} count-up">${actual.toLocaleString()}개</span>
                </div>
                <div class="compare-item">
                    <span class="compare-label">당신의 예상</span>
                    <span class="compare-value">${guess.toLocaleString()}개</span>
                </div>
            </div>
            <button class="wrapped-btn primary" data-action="next">다음</button>
        </div>
    `;
    
    container.querySelector('[data-action="next"]').addEventListener('click', () => showStep(8));
}

// Step 8: 1위 캐릭터와의 첫 대화 날짜 퀴즈
function showCharDateQuiz(container) {
    const top = rankingsData[0];
    
    // 1위 캐릭터 첫 대화 날짜 찾기
    const topCharDate = funFactsData.top3WithDates?.find(c => c.name === top?.name)?.firstChatDate;
    if (!topCharDate) {
        showStep(10);
        return;
    }
    
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= currentYear - 5; y--) {
        years.push(y);
    }
    
    container.innerHTML = `
        <div class="wrapped-step date-quiz-step">
            <div class="wrapped-emoji">💕</div>
            <h2>${escapeHtml(top.name)}와의 첫 대화,<br>언제 시작했는지 기억하세요?</h2>
            <p class="wrapped-subtitle">첫 채팅 시작일을 맞춰보세요!</p>
            <div class="date-select-wrap">
                <select id="char-year-guess" class="date-select">
                    <option value="">년도</option>
                    ${years.map(y => `<option value="${y}">${y}년</option>`).join('')}
                </select>
                <select id="char-month-guess" class="date-select">
                    <option value="">월</option>
                    ${Array.from({length: 12}, (_, i) => `<option value="${i + 1}">${i + 1}월</option>`).join('')}
                </select>
                <select id="char-day-guess" class="date-select">
                    <option value="">일</option>
                    ${Array.from({length: 31}, (_, i) => `<option value="${i + 1}">${i + 1}일</option>`).join('')}
                </select>
            </div>
            <button class="wrapped-btn primary" data-action="submit">확인하기</button>
        </div>
    `;
    
    const btn = container.querySelector('[data-action="submit"]');
    btn.addEventListener('click', () => {
        const y = parseInt(container.querySelector('#char-year-guess').value) || null;
        const m = parseInt(container.querySelector('#char-month-guess').value) || null;
        const d = parseInt(container.querySelector('#char-day-guess').value) || null;
        userGuessCharDate = (y && m && d) ? new Date(y, m - 1, d) : null;
        showStep(9);
    });
}

// Step 9: 1위 캐릭터 첫 대화 날짜 결과 + 일일 평균
function showCharDateResult(container) {
    const top = rankingsData[0];
    const topCharDate = funFactsData.top3WithDates?.find(c => c.name === top?.name)?.firstChatDate;
    
    if (!topCharDate) {
        showStep(10);
        return;
    }
    
    // 정답 판정
    let emoji, title;
    if (userGuessCharDate) {
        const diffDays = Math.abs(Math.ceil((topCharDate - userGuessCharDate) / (1000 * 60 * 60 * 24)));
        if (diffDays <= 7) {
            emoji = '🎯';
            title = '대단해요! 거의 정확해요!';
        } else if (diffDays <= 30) {
            emoji = '👍';
            title = '꽤 가까워요!';
        } else {
            emoji = '😅';
            title = '아쉬워요!';
        }
    } else {
        emoji = '💕';
        title = '정답은...';
    }
    
    const dateStr = topCharDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    
    // 기간 계산
    const today = new Date();
    const daysDiff = Math.ceil((today - topCharDate) / (1000 * 60 * 60 * 24));
    const monthsDiff = Math.floor(daysDiff / 30);
    
    // 기간에 따른 멘트
    let periodComment = '';
    if (monthsDiff >= 12) {
        periodComment = `벌써 ${Math.floor(monthsDiff / 12)}년이 넘었네요! 오래된 인연이에요 ✨`;
    } else if (monthsDiff >= 6) {
        periodComment = '반년 넘게 함께했네요! 꽤 친해졌겠어요 💜';
    } else if (monthsDiff >= 2) {
        periodComment = '만난 지 꽤 지났네요! 아직 새로운 이야기가 많겠어요 💗';
    } else {
        periodComment = '아직 새로운 인연이네요! 앞으로가 기대돼요 🌟';
    }
    
    // 1위 캐릭터 일일 평균 메시지
    const charDailyAvg = daysDiff > 0 ? (top.messageCount / daysDiff).toFixed(1) : top.messageCount;
    
    container.innerHTML = `
        <div class="wrapped-step date-result-step">
            <div class="wrapped-emoji">${emoji}</div>
            <h2>${title}</h2>
            <p class="wrapped-subtitle">${escapeHtml(top.name)}와의 시작은</p>
            <div class="date-reveal">
                <span class="date-value">${dateStr}</span>
            </div>
            <p class="period-comment">${periodComment}</p>
            <div class="daily-stats">
                <p>${escapeHtml(top.name)}와는 하루 평균</p>
                <span class="daily-value">${charDailyAvg}개</span>
                <p>의 메시지를 나눴어요!</p>
            </div>
            <button class="wrapped-btn primary" data-action="next">결과 보기</button>
        </div>
    `;
    
    container.querySelector('[data-action="next"]').addEventListener('click', () => showStep(10));
}

// Step 10: 최종 통계 - 넷플릭스 스타일 강화
function showFinalStats(container) {
    const medals = ['🥇', '🥈', '🥉'];
    const top = rankingsData[0];
    
    const rankingHTML = rankingsData.slice(0, 10).map((r, i) => {
        const medal = i < 3 ? medals[i] : `${i + 1}위`;
        const avatarUrl = r.avatar ? `/characters/${encodeURIComponent(r.avatar)}` : '/img/ai4.png';
        return `
            <div class="stats-rank-item ${i < 3 ? 'top-3' : ''}" style="animation-delay: ${i * 0.05}s">
                <span class="rank-medal">${medal}</span>
                <img class="rank-avatar" src="${avatarUrl}" alt="${escapeHtml(r.name)}" onerror="this.src='/img/ai4.png'">
                <div class="rank-info">
                    <div class="rank-name">${escapeHtml(r.name)}</div>
                    <div class="rank-stats">채팅 ${r.chatCount}개 | 메시지 ${r.messageCount.toLocaleString()}개</div>
                </div>
            </div>
        `;
    }).join('');
    
    const encouragement = getEncouragement(top?.name);
    
    // Fun Facts 섹션 - 전체 통계
    const oldestDateStr = funFactsData.oldestDate 
        ? funFactsData.oldestDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
        : '알 수 없음';
    
    // 1위 캐릭터 첫 대화 날짜
    const topCharData = funFactsData.top3WithDates?.find(c => c.name === top?.name);
    const topCharDateStr = topCharData?.firstChatDate 
        ? topCharData.firstChatDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
        : '알 수 없음';
    
    // 1위 캐릭터 일일 평균 메시지
    let topCharDailyAvg = 0;
    if (topCharData?.firstChatDate) {
        const daysDiff = Math.ceil((new Date() - topCharData.firstChatDate) / (1000 * 60 * 60 * 24));
        topCharDailyAvg = daysDiff > 0 ? (top.messageCount / daysDiff).toFixed(1) : top.messageCount;
    }
    
    // 캐릭터당 평균 메시지 계산
    const totalChars = rankingsData.length;
    const totalMessages = rankingsData.reduce((sum, r) => sum + r.messageCount, 0);
    const avgMessagesPerChar = totalChars > 0 ? Math.round(totalMessages / totalChars) : 0;
    
    const funFactsHTML = `
        <div class="stats-section stats-fun-facts">
            <h4>✨ Fun Facts</h4>
            <div class="fun-facts-grid">
                <div class="fun-fact-item">
                    <span class="fun-fact-value">${oldestDateStr}</span>
                    <span class="fun-fact-label">📅 첫 대화 시작일</span>
                </div>
                <div class="fun-fact-item">
                    <span class="fun-fact-value">${funFactsData.avgMessagesPerChat}</span>
                    <span class="fun-fact-label">💬 채팅당 평균 메시지</span>
                </div>
                <div class="fun-fact-item">
                    <span class="fun-fact-value">${avgMessagesPerChar.toLocaleString()}개</span>
                    <span class="fun-fact-label">👤 캐릭터당 평균 메시지</span>
                </div>
            </div>
        </div>
    `;
    
    // 1위 캐릭터 섹션
    const topCharAvatarUrl = top?.avatar ? `/characters/${encodeURIComponent(top.avatar)}` : '/img/ai4.png';
    const topCharHTML = top ? `
        <div class="stats-section stats-top-char">
            <h4>🏆 ${escapeHtml(top.name)}와의 통계</h4>
            <div class="top-char-card">
                <img class="top-char-avatar" src="${topCharAvatarUrl}" alt="${escapeHtml(top.name)}" onerror="this.src='/img/ai4.png'">
                <div class="top-char-stats">
                    <div class="top-char-stat-item">
                        <span class="stat-label">첫 대화일</span>
                        <span class="stat-value">${topCharDateStr}</span>
                    </div>
                    <div class="top-char-stat-item">
                        <span class="stat-label">전체 대화 비율</span>
                        <span class="stat-value">${funFactsData.topCharPercentage}%</span>
                    </div>
                    <div class="top-char-stat-item">
                        <span class="stat-label">하루 평균 메시지</span>
                        <span class="stat-value">${topCharDailyAvg}개</span>
                    </div>
                </div>
            </div>
        </div>
    ` : '';
    
    container.innerHTML = `
        <div class="wrapped-step final-step">
            <div class="final-header">
                <button class="wrapped-back" data-action="close">←</button>
                <h2>📊 Your Chat Wrapped</h2>
            </div>
            <div class="final-content">
                <div class="stats-section">
                    <h4>🏆 Top 10 캐릭터</h4>
                    <div class="stats-ranking slide-in">
                        ${rankingHTML}
                    </div>
                </div>
                ${funFactsHTML}
                ${topCharHTML}
                <div class="stats-section stats-total">
                    <div class="stats-grid">
                        <div class="stats-item">
                            <div class="stats-value">${totalStatsData.characters}</div>
                            <div class="stats-label">총 캐릭터</div>
                        </div>
                        <div class="stats-item">
                            <div class="stats-value">${totalStatsData.chats}</div>
                            <div class="stats-label">총 채팅</div>
                        </div>
                        <div class="stats-item">
                            <div class="stats-value">${totalStatsData.messages.toLocaleString()}</div>
                            <div class="stats-label">총 메시지</div>
                        </div>
                    </div>
                </div>
                <div class="encouragement">
                    "${encouragement}"
                </div>
            </div>
            <button class="wrapped-btn primary" data-action="close">닫기</button>
        </div>
    `;
    
    container.querySelectorAll('[data-action="close"]').forEach(btn => {
        btn.addEventListener('click', closeStatsView);
    });
    
    // 애니메이션
    animateCards(container);
}

// ============================================
// 유틸 함수
// ============================================

function judgeMessageGuess(actual, guess) {
    if (actual === 0) return 'accurate';
    const diff = Math.abs(actual - guess);
    const threshold = actual * 0.15; // 15% 오차 허용
    
    if (diff <= threshold) return 'accurate';
    if (guess > actual) return 'too_high';
    return 'too_low';
}

function getEncouragement(topCharName) {
    const messages = [
        `다음에도 ${topCharName}과 함께해요! 💕`,
        `${topCharName}이(가) 당신을 기다리고 있어요! ✨`,
        `앞으로도 즐거운 대화 나눠요! 🎊`,
        `${topCharName}과의 추억이 쌓이고 있어요! 📚`,
    ];
    return messages[Math.floor(Math.random() * messages.length)];
}

function showError(message) {
    const container = document.querySelector('.wrapped-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="wrapped-step error-step">
            <div class="wrapped-emoji">😢</div>
            <h2>${message}</h2>
            <button class="wrapped-btn primary" data-action="close">닫기</button>
        </div>
    `;
    
    container.querySelector('[data-action="close"]').addEventListener('click', closeStatsView);
}

function animateCards(container) {
    const items = container.querySelectorAll('.stats-rank-item');
    items.forEach((item, i) => {
        item.style.opacity = '0';
        item.style.transform = 'translateX(20px)';
        
        setTimeout(() => {
            item.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            item.style.opacity = '1';
            item.style.transform = 'translateX(0)';
        }, i * 50);
    });
}

/**
 * Confetti 효과 생성
 */
function showConfetti() {
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);
    
    // 30개의 confetti 생성
    for (let i = 0; i < 30; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.animationDelay = Math.random() * 2 + 's';
        confetti.style.animationDuration = (2 + Math.random() * 2) + 's';
        container.appendChild(confetti);
    }
    
    // 3초 후 제거
    setTimeout(() => container.remove(), 5000);
}
