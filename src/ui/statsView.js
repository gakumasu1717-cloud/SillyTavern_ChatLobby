// ============================================
// 통계 화면 UI
// ============================================

import { api } from '../api/sillyTavern.js';
import { cache } from '../data/cache.js';
import { escapeHtml } from '../utils/textUtils.js';
import { showToast } from './notifications.js';

/** 표시할 최대 랭킹 수 */
const MAX_RANKING = 20;

/** 통계 화면 열려있는지 */
let isStatsOpen = false;

/**
 * 통계 화면 열기
 */
export async function openStatsView() {
    if (isStatsOpen) return;
    isStatsOpen = true;
    
    const container = document.getElementById('chat-lobby-main');
    if (!container) return;
    
    // 기존 내용 숨기기
    const leftPanel = document.getElementById('chat-lobby-left');
    const chatsPanel = document.getElementById('chat-lobby-chats');
    if (leftPanel) leftPanel.style.display = 'none';
    if (chatsPanel) chatsPanel.style.display = 'none';
    
    // 통계 화면 생성
    const statsView = document.createElement('div');
    statsView.id = 'chat-lobby-stats-view';
    statsView.className = 'stats-view';
    statsView.innerHTML = `
        <div class="stats-header">
            <button class="stats-back" data-action="close-stats">←</button>
            <h3>📊 통계</h3>
        </div>
        <div class="stats-content">
            <div class="stats-loading">
                <div class="stats-spinner"></div>
                <div>통계 불러오는 중...</div>
            </div>
        </div>
    `;
    container.appendChild(statsView);
    
    // 뒤로가기 버튼
    statsView.querySelector('.stats-back').addEventListener('click', closeStatsView);
    
    // 통계 데이터 로드
    await loadStats(statsView.querySelector('.stats-content'));
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
    if (leftPanel) leftPanel.style.display = '';
    if (chatsPanel) chatsPanel.style.display = '';
}

/**
 * 통계 화면 열려있는지 확인
 */
export function isStatsViewOpen() {
    return isStatsOpen;
}

/**
 * 통계 데이터 로드 및 렌더링
 * @param {HTMLElement} contentEl - 콘텐츠 영역
 */
async function loadStats(contentEl) {
    try {
        const characters = api.getCharacters();
        
        if (!characters || characters.length === 0) {
            contentEl.innerHTML = `
                <div class="stats-empty">
                    <i>📊</i>
                    <div>캐릭터가 없습니다</div>
                </div>
            `;
            return;
        }
        
        // 상위 20개만 처리 (성능)
        const topCharacters = characters.slice(0, MAX_RANKING);
        
        // 채팅 수 가져오기 (병렬, 배치 처리)
        const rankings = await fetchRankings(topCharacters);
        
        // 전체 통계 계산
        const totalStats = calculateTotalStats(rankings, characters.length);
        
        // 렌더링
        contentEl.innerHTML = renderStatsHTML(rankings, totalStats);
        
        // 카드 애니메이션
        animateCards(contentEl);
        
    } catch (error) {
        console.error('[StatsView] Failed to load stats:', error);
        contentEl.innerHTML = `
            <div class="stats-empty">
                <i>⚠️</i>
                <div>통계 로딩 실패</div>
            </div>
        `;
    }
}

/**
 * 채팅 랭킹 데이터 가져오기
 * @param {Array} characters - 캐릭터 배열
 * @returns {Promise<Array>}
 */
async function fetchRankings(characters) {
    const BATCH_SIZE = 5;
    const results = [];
    
    for (let i = 0; i < characters.length; i += BATCH_SIZE) {
        const batch = characters.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
            batch.map(async (char) => {
                try {
                    // 채팅 목록 가져오기 (캐시 또는 API)
                    let chats = cache.get('chats', char.avatar);
                    if (!chats || !Array.isArray(chats)) {
                        chats = await api.fetchChatsForCharacter(char.avatar);
                    }
                    
                    const chatCount = Array.isArray(chats) ? chats.length : 0;
                    
                    // 메시지 수 합산
                    // SillyTavern API 응답 필드: mes (배열길이), chat_metadata.mes_count 등
                    let messageCount = 0;
                    if (Array.isArray(chats)) {
                        messageCount = chats.reduce((sum, chat) => {
                            // 우선순위: mes 배열 길이 > chat_metadata 필드들 > 직접 필드들
                            if (Array.isArray(chat.mes)) {
                                return sum + chat.mes.length;
                            }
                            const count = chat.chat_metadata?.mes_count
                                ?? chat.chat_metadata?.message_count
                                ?? chat.mes_count
                                ?? chat.message_count
                                ?? 0;
                            return sum + count;
                        }, 0);
                    }
                    
                    return {
                        name: char.name,
                        avatar: char.avatar,
                        chatCount,
                        messageCount
                    };
                } catch (e) {
                    console.warn('[StatsView] Failed to get stats for:', char.name);
                    return {
                        name: char.name,
                        avatar: char.avatar,
                        chatCount: 0,
                        messageCount: 0
                    };
                }
            })
        );
        results.push(...batchResults);
    }
    
    // 메시지 수 기준 정렬 (같으면 채팅 파일 수로)
    return results.sort((a, b) => {
        if (b.messageCount !== a.messageCount) {
            return b.messageCount - a.messageCount;
        }
        return b.chatCount - a.chatCount;
    });
}

/**
 * 전체 통계 계산
 * @param {Array} rankings - 랭킹 배열
 * @param {number} totalCharacters - 전체 캐릭터 수
 */
function calculateTotalStats(rankings, totalCharacters) {
    const totalChats = rankings.reduce((sum, r) => sum + r.chatCount, 0);
    const totalMessages = rankings.reduce((sum, r) => sum + r.messageCount, 0);
    
    return {
        characters: totalCharacters,
        chats: totalChats,
        messages: totalMessages
    };
}

/**
 * 통계 HTML 렌더링
 * @param {Array} rankings - 랭킹 배열
 * @param {Object} totalStats - 전체 통계
 */
function renderStatsHTML(rankings, totalStats) {
    const medals = ['🥇', '🥈', '🥉'];
    
    const rankingHTML = rankings.map((r, i) => {
        const medal = i < 3 ? medals[i] : `${i + 1}위`;
        const isTop3 = i < 3;
        const avatarUrl = r.avatar ? `/characters/${encodeURIComponent(r.avatar)}` : '/img/ai4.png';
        
        return `
            <div class="stats-rank-item ${isTop3 ? 'top-3' : ''}" data-rank="${i + 1}">
                <span class="rank-medal">${medal}</span>
                <img class="rank-avatar" src="${avatarUrl}" alt="${escapeHtml(r.name)}" onerror="this.src='/img/ai4.png'">
                <div class="rank-info">
                    <div class="rank-name">${escapeHtml(r.name)}</div>
                    <div class="rank-stats">채팅 ${r.chatCount}개 | 메시지 ${r.messageCount.toLocaleString()}개</div>
                </div>
            </div>
        `;
    }).join('');
    
    return `
        <div class="stats-section">
            <h4>🏆 채팅 랭킹 (상위 ${MAX_RANKING}개)</h4>
            <div class="stats-ranking">
                ${rankingHTML}
            </div>
        </div>
        <div class="stats-section stats-total">
            <h4>📈 전체 통계</h4>
            <div class="stats-grid">
                <div class="stats-item">
                    <div class="stats-value">${totalStats.characters}</div>
                    <div class="stats-label">총 캐릭터</div>
                </div>
                <div class="stats-item">
                    <div class="stats-value">${totalStats.chats}</div>
                    <div class="stats-label">총 채팅</div>
                </div>
                <div class="stats-item">
                    <div class="stats-value">${totalStats.messages.toLocaleString()}</div>
                    <div class="stats-label">총 메시지</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * 카드 등장 애니메이션
 * @param {HTMLElement} container
 */
function animateCards(container) {
    const items = container.querySelectorAll('.stats-rank-item');
    items.forEach((item, i) => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            item.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            item.style.opacity = '1';
            item.style.transform = 'translateY(0)';
        }, i * 50); // 50ms 간격으로 순차 등장
    });
}
