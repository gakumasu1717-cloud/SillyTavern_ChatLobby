// ============================================
// 로비 안 캐릭터 정보 보기
//
// 예전엔 채팅 패널의 캐릭터 이미지를 누르면 로비를 닫고 캐릭터로 전환(채팅 로드)한 뒤
// 편집 드로어를 열었다. 내용을 보기만 하려 해도 채팅을 불러와야 해서 느렸다.
// 이제 로비 안에서 바로 보여주고, "편집"을 누를 때만 캐릭터로 전환한다.
// ============================================

import { api } from '../api/sillyTavern.js';
import { escapeHtml } from '../utils/textUtils.js';
import { charAvatarUrl } from '../utils/avatarUrl.js';

const PANEL_ID = 'chat-lobby-charinfo-panel';
let openToken = 0;

/**
 * 패널이 열려 있는지
 */
export function isCharInfoOpen() {
    return !!document.getElementById(PANEL_ID);
}

/**
 * 패널 닫기
 */
export function closeCharInfo() {
    openToken++;
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    panel.classList.remove('open');
    setTimeout(() => panel.remove(), 250);
}

/**
 * 캐릭터 객체에서 필드 읽기 (V2 카드는 data 안에, 구형은 최상위에)
 */
function field(char, key, legacyKey = key) {
    const value = char?.data?.[key] ?? char?.[legacyKey];
    return typeof value === 'string' ? value : '';
}

/**
 * {{char}}/{{user}}만 치환 (ST의 substituteParams는 "현재 선택된" 캐릭터 기준이라 쓰지 않음)
 */
function fillNames(text, charName, userName) {
    return text
        .replace(/\{\{char\}\}/gi, charName)
        .replace(/\{\{user\}\}/gi, userName || 'User');
}

function section(title, text, { open = false } = {}) {
    if (!text || !text.trim()) return '';
    return `
        <details class="charinfo-section" ${open ? 'open' : ''}>
            <summary>${escapeHtml(title)}</summary>
            <div class="charinfo-text">${escapeHtml(text)}</div>
        </details>`;
}

/**
 * 캐릭터 정보 패널 열기
 * @param {{ avatar: string, name?: string }} character - store.currentCharacter
 */
export async function openCharInfo(character) {
    if (!character?.avatar) return;
    const token = ++openToken;

    document.getElementById(PANEL_ID)?.remove();

    const context = api.getContext();
    const characters = context?.characters || [];
    const index = characters.findIndex(c => c.avatar === character.avatar);
    if (index === -1) return;

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'charinfo-panel';
    panel.innerHTML = `
        <div class="charinfo-header">
            <h3>${escapeHtml(characters[index].name || character.name || '')}</h3>
            <div class="charinfo-actions">
                <button class="charinfo-edit-btn" data-action="edit-character" title="캐릭터로 이동해서 편집">✏️ 편집</button>
                <button class="charinfo-close-btn" data-action="close-charinfo" title="닫기">✕</button>
            </div>
        </div>
        <div class="charinfo-body"><div class="lobby-loading">불러오는 중...</div></div>
    `;
    const container = document.getElementById('chat-lobby-container') || document.body;
    container.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add('open'));

    // ST의 지연 로딩(shallow) 캐릭터면 본문 필드를 받아옴 (채팅 전환 없음)
    try {
        if (characters[index].shallow && typeof context.unshallowCharacter === 'function') {
            await context.unshallowCharacter(index);
        }
    } catch (e) {
        console.warn('[CharInfo] unshallowCharacter failed:', e);
    }
    if (token !== openToken) return;

    const char = api.getContext()?.characters?.[index];
    if (!char || char.avatar !== character.avatar) {
        closeCharInfo();
        return;
    }

    const charName = char.name || '';
    const userName = context.name1 || '';
    const fill = (text) => fillNames(text, charName, userName);

    const creator = field(char, 'creator');
    const version = field(char, 'character_version');
    const tags = Array.isArray(char.tags) ? char.tags : (Array.isArray(char.data?.tags) ? char.data.tags : []);
    const greetings = Array.isArray(char.data?.alternate_greetings) ? char.data.alternate_greetings : [];

    const meta = [
        creator ? `만든 사람: ${escapeHtml(creator)}` : '',
        version ? `버전: ${escapeHtml(version)}` : '',
        greetings.length ? `추가 인사말 ${greetings.length}개` : '',
    ].filter(Boolean).join(' · ');

    const body = panel.querySelector('.charinfo-body');
    body.innerHTML = `
        <div class="charinfo-top">
            <img class="charinfo-avatar" src="${charAvatarUrl(char.avatar)}" alt="" onerror="this.src='/img/ai4.png'">
            <div class="charinfo-meta">
                ${meta ? `<div class="charinfo-meta-line">${meta}</div>` : ''}
                ${tags.length ? `<div class="charinfo-tags">${tags.map(t => `<span class="charinfo-tag">${escapeHtml(String(t))}</span>`).join('')}</div>` : ''}
            </div>
        </div>
        ${section('제작자 노트', fill(field(char, 'creator_notes', 'creatorcomment')), { open: true })}
        ${section('설명', fill(field(char, 'description')), { open: true })}
        ${section('성격', fill(field(char, 'personality')))}
        ${section('시나리오', fill(field(char, 'scenario')))}
        ${section('첫 메시지', fill(field(char, 'first_mes')))}
        ${greetings.map((g, i) => section(`추가 인사말 ${i + 1}`, fill(String(g || '')))).join('')}
        ${section('예시 대화', fill(field(char, 'mes_example')))}
    `;
}
