// ============================================
// HTML 템플릿 - Netflix Style with Dark/Light Mode
// ============================================

import { storage } from '../data/storage.js';
import { createTabBarHTML } from './tabView.js';
import { escapeHtml } from '../utils/textUtils.js';

// 메인 로비 HTML - 넷플릭스 스타일
export function createLobbyHTML() {
    // 저장된 테마/접힘 상태 불러오기
    const savedTheme = localStorage.getItem('chatlobby-theme') || 'dark';
    const isCollapsed = localStorage.getItem('chatlobby-collapsed') === 'true';
    const themeClass = savedTheme === 'light' ? 'light-mode' : 'dark-mode';
    const collapsedClass = isCollapsed ? 'collapsed' : '';
    
    return `
    <div id="chat-lobby-fab" data-action="open-lobby" title="Chat Lobby 열기">
        <div class="fab-preview">
            <img class="fab-preview-avatar" src="" alt="" onerror="this.style.display='none'">
            <span class="fab-streak"></span>
        </div>
        <span class="fab-icon">💬</span>
    </div>
    <div id="chat-lobby-overlay" style="display: none;">
        <div id="chat-lobby-container" class="${themeClass}">
            <!-- 헤더 - 탭 통합 -->
            <header id="chat-lobby-header">
                <div class="header-left">
                    <button id="chat-lobby-menu-toggle" class="mobile-only" data-action="toggle-header-menu" title="메뉴">☰</button>
                    <h2 id="chat-lobby-title" data-action="go-to-characters" style="cursor: pointer;">Chat Lobby</h2>
                    ${createTabBarHTML()}
                </div>
                <div class="header-right">
                    <div class="header-actions">
                        <button id="chat-lobby-random-char" data-action="random-char" title="랜덤 캐릭터">🎲</button>
                        <button id="chat-lobby-calendar-btn" data-action="open-calendar" title="캘린더">📅</button>
                        <button id="chat-lobby-stats" data-action="open-stats" title="Wrapped 통계">📊</button>
                        <button id="chat-lobby-import-char" data-action="import-char" title="캐릭터 가져오기">📥</button>
                        <button id="chat-lobby-add-persona" data-action="add-persona" title="페르소나 추가">👤</button>
                        <button id="chat-lobby-refresh" data-action="refresh" title="새로고침">🔄</button>
                        <button id="chat-lobby-theme-toggle" data-action="toggle-theme" title="테마 전환">${savedTheme === 'light' ? '🌙' : '☀️'}</button>
                    </div>
                    <button id="chat-lobby-close" data-action="close-lobby" title="닫기">✕</button>
                </div>
            </header>
            
            <!-- 메인 콘텐츠 -->
            <main id="chat-lobby-main">
                <!-- 왼쪽 패널: 페르소나 + 캐릭터 -->
                <section id="chat-lobby-left" class="${collapsedClass}">
                    <!-- 페르소나 바 -->
                    <div id="chat-lobby-persona-bar">
                        <div id="chat-lobby-persona-list">
                            <div class="lobby-loading">로딩 중...</div>
                        </div>
                    </div>
                    
                    <!-- 검색 + 정렬 -->
                    <div id="chat-lobby-search">
                        <input type="text" id="chat-lobby-search-input" placeholder="🔍 캐릭터/그룹 검색...">
                        <select id="chat-lobby-char-sort" title="정렬">
                            <option value="recent">🕒 최근 채팅순</option>
                            <option value="name">🔤 이름순</option>
                            <option value="chats">💬 메시지 수</option>
                        </select>
                    </div>
                    
                    <!-- 태그 바 -->
                    <nav id="chat-lobby-tag-bar">
                        <div id="chat-lobby-tag-list"></div>
                    </nav>
                    
                    <!-- 접기/펼치기 버튼 -->
                    <button id="chat-lobby-collapse-btn" data-action="toggle-collapse" title="상단 영역 접기/펼치기">
                        ${isCollapsed ? '▼' : '▲'}
                    </button>
                    
                    <!-- 캐릭터 그리드 -->
                    <div id="chat-lobby-characters">
                        <div class="lobby-loading">캐릭터 로딩 중...</div>
                    </div>
                </section>
                
                <!-- 오른쪽 패널: 채팅 목록 (슬라이드 인) -->
                <aside id="chat-lobby-chats">
                    <header id="chat-lobby-chats-header">
                        <button id="chat-lobby-chats-back" data-action="close-chat-panel" title="뒤로">←</button>
                        <img src="" alt="avatar" id="chat-panel-avatar" data-action="go-to-character" title="캐릭터 설정" style="display:none;">
                        <div class="char-info">
                            <div class="char-name" id="chat-panel-name">캐릭터를 선택하세요</div>
                            <div class="chat-count" id="chat-panel-count"></div>
                        </div>
                        <button id="chat-lobby-delete-char" data-action="delete-char" title="캐릭터 삭제" style="display:none;">🗑️</button>
                        <button id="chat-lobby-new-chat" data-action="new-chat" data-has-chats="false" style="display:none;">+ 새 채팅</button>
                    </header>
                    
                    <!-- 필터 섹션 -->
                    <section id="chat-lobby-filters" style="display:none;">
                        <div id="chat-lobby-char-tags"></div>
                        <div class="filters-row">
                            <div class="filter-group">
                                <select id="chat-lobby-chat-sort">
                                    <option value="recent">🕐 최신순</option>
                                    <option value="name">🔤 이름순</option>
                                    <option value="messages">💬 메시지수</option>
                                    <option value="branch">🌳 분기</option>
                                </select>
                                <select id="chat-lobby-folder-filter">
                                    <option value="all">📁 전체</option>
                                    <option value="favorites">⭐ 즐겨찾기</option>
                                </select>
                            </div>
                            <div class="filter-group-buttons">
                                <button id="chat-lobby-persona-quick" class="icon-btn persona-quick-btn" data-action="switch-persona" title="퀸 페르소나" style="display:none;"><img class="persona-quick-avatar" src="" alt="persona" /></button>
                                <button id="chat-lobby-branch-refresh" class="icon-btn" data-action="refresh-branches" title="분기 분석 새로고침" style="display:none;"><span class="icon">🔍</span></button>
                                <button id="chat-lobby-batch-mode" class="icon-btn" data-action="toggle-batch" title="배치 선택 모드"><span class="icon">☑️</span></button>
                                <button id="chat-lobby-folder-manage" class="icon-btn" data-action="open-folder-modal" title="폴더 관리"><span class="icon">📁</span></button>
                            </div>
                        </div>
                    </section>
                    
                    <!-- 배치 모드 툴바 -->
                    <div id="chat-lobby-batch-toolbar">
                        <span id="batch-selected-count">0개 선택</span>
                        <button id="batch-select-all-btn" data-action="batch-select-all" title="전체 선택/해제">☑ 전체</button>
                        <button id="batch-delete-btn" data-action="batch-delete" title="선택한 채팅 삭제">🗑️ 삭제</button>
                        <button id="batch-move-btn" data-action="open-folder-modal" title="선택한 채팅 폴더 이동">📁 이동</button>
                        <button id="batch-cancel-btn" data-action="batch-cancel">취소</button>
                    </div>

                    <!-- 채팅 목록 -->
                    <div id="chat-lobby-chats-list">
                        <div class="lobby-empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:var(--text-muted,#888);padding:40px;">
                            <i>💬</i>
                            <div>캐릭터를 선택하세요</div>
                        </div>
                    </div>
                </aside>
            </main>
        </div>
    </div>
    
    <!-- 폴더 관리 모달 -->
    <div id="chat-lobby-folder-modal" style="display:none;">
        <div class="folder-modal-content">
            <div class="folder-modal-header">
                <h3>📁 폴더 관리</h3>
                <button id="folder-modal-close" data-action="close-folder-modal">✕</button>
            </div>
            <div class="folder-modal-body">
                <div class="folder-add-row">
                    <input type="text" id="new-folder-name" placeholder="새 폴더 이름...">
                    <button id="add-folder-btn" data-action="add-folder">추가</button>
                </div>
                <div id="folder-list"></div>
            </div>
        </div>
    </div>
    `;
}

// 폴더 드롭다운 옵션 HTML
export function getFoldersOptionsHTML(selectedValue = 'all') {
    const data = storage.load();
    const sorted = [...data.folders].sort((a, b) => a.order - b.order);
    
    let html = '<option value="all">📁 전체</option>';
    html += '<option value="favorites">⭐ 즐겨찾기만</option>';
    
    sorted.forEach(f => {
        if (f.id !== 'favorites') {
            const selected = f.id === selectedValue ? 'selected' : '';
            html += `<option value="${f.id}" ${selected}>${escapeHtml(f.name)}</option>`;
        }
    });
    
    return html;
}

// 배치 이동 폴더 드롭다운 HTML
export function getBatchFoldersHTML() {
    const data = storage.load();
    const sorted = [...data.folders].sort((a, b) => a.order - b.order);
    
    let html = '<option value="">이동할 폴더...</option>';
    sorted.forEach(f => {
        if (f.id !== 'favorites') {
            html += `<option value="${f.id}">${escapeHtml(f.name)}</option>`;
        }
    });
    
    return html;
}
