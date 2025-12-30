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
                    if (Array.isArray(chats)) {
                        messageCount = chats.reduce((sum, chat) => sum + (chat.chat_items || 0), 0);
                    }
                    
                    return { name: char.name, avatar: char.avatar, chatCount, messageCount };
                } catch (e) {
                    return { name: char.name, avatar: char.avatar, chatCount: 0, messageCount: 0 };
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
    
    return {
        avgMessagesPerChar,
        mostChatsChar: mostChats,
        avgMessagesPerChat,
        topCharPercentage: totalStatsData.messages > 0 
            ? Math.round((topChar?.messageCount || 0) / totalStatsData.messages * 100)
            : 0
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
        case 2: showQuiz(container); break;
        case 3: showQuizResult(container); break;
        case 4: showMessageQuiz(container); break;
        case 5: showMessageResult(container); break;
        case 6: showFinalStats(container); break;
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
    container.querySelector('[data-action="skip"]').addEventListener('click', () => showStep(6));
}

// Step 2: 캐릭터 맞추기 퀴즈
function showQuiz(container) {
    if (rankingsData.length < 3) {
        showStep(6); // 캐릭터 부족하면 바로 결과
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
            showStep(3);
        });
    });
}

// Step 3: 퀴즈 결과
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
    
    container.querySelector('[data-action="next"]').addEventListener('click', () => showStep(4));
}

// Step 4: 메시지 개수 맞추기
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
        showStep(5);
    });
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            userGuessMessages = parseInt(input.value) || 0;
            showStep(5);
        }
    });
}

// Step 5: 메시지 결과
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
            <button class="wrapped-btn primary" data-action="next">결과 보기</button>
        </div>
    `;
    
    container.querySelector('[data-action="next"]').addEventListener('click', () => showStep(6));
}

// Step 6: 최종 통계 - 넷플릭스 스타일 강화
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
    
    // Fun Facts 섹션 추가
    const funFactsHTML = funFactsData.topCharPercentage > 0 ? `
        <div class="stats-section stats-fun-facts">
            <h4>✨ Fun Facts</h4>
            <div class="fun-facts-grid">
                <div class="fun-fact-item">
                    <span class="fun-fact-value">${funFactsData.topCharPercentage}%</span>
                    <span class="fun-fact-label">전체 대화 중 ${escapeHtml(top?.name || '')} 비율</span>
                </div>
                <div class="fun-fact-item">
                    <span class="fun-fact-value">${funFactsData.avgMessagesPerChat}</span>
                    <span class="fun-fact-label">채팅당 평균 메시지</span>
                </div>
                <div class="fun-fact-item">
                    <span class="fun-fact-value">${funFactsData.avgMessagesPerChar}</span>
                    <span class="fun-fact-label">캐릭터당 평균 메시지</span>
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
