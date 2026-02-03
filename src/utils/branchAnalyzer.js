// ============================================
// 브랜치 분석기 - Timelines 방식 (심플 버전)
// previousNodes로 분기 추적, 길이 기반 판단 제거
// ============================================

import { api } from '../api/sillyTavern.js';
import { setBranchInfo } from '../data/branchCache.js';

/**
 * 채팅 내용 로드 (API 호출)
 * @param {string} charAvatar
 * @param {string} fileName
 * @returns {Promise<Array|null>}
 */
async function loadChatContent(charAvatar, fileName) {
    try {
        const charDir = charAvatar.replace(/\.(png|jpg|webp)$/i, '');
        const chatName = fileName.replace('.jsonl', '');
        
        const response = await fetch('/api/chats/get', {
            method: 'POST',
            headers: api.getRequestHeaders(),
            body: JSON.stringify({
                ch_name: charDir,
                file_name: chatName,
                avatar_url: charAvatar
            }),
        });
        
        if (!response.ok) return null;
        
        const data = await response.json();
        
        // 첫 번째는 메타데이터이므로 제외
        if (Array.isArray(data) && data.length > 1) {
            return data.slice(1);
        }
        
        return data || [];
    } catch (e) {
        console.error('[BranchAnalyzer] Failed to load chat:', fileName, e);
        return null;
    }
}

/**
 * 메시지 콘텐츠 해시 (Timelines 방식)
 * @param {Object} message
 * @returns {string}
 */
function getMessageHash(message) {
    if (!message) return '';
    const mes = (message.mes || '').replace(/\r\n/g, '\n').trim();
    
    // 짧으면 그대로 (정확도)
    if (mes.length < 100) return mes;
    
    // 길면 해시
    let hash = 5381;
    for (let i = 0; i < mes.length; i++) {
        hash = ((hash << 5) + hash) + mes.charCodeAt(i);
        hash = hash & hash;
    }
    return `#${hash.toString(36)}_${mes.length}`;
}

/**
 * Timelines 방식 분기 분석
 * - 모든 채팅을 메시지 인덱스별로 비교
 * - previousNodes로 각 채팅의 "현재 위치" 추적
 * - 분기 시 자연스럽게 부모-자식 관계 형성
 * 
 * @param {string} charAvatar
 * @param {Array} chats - [{file_name, ...}]
 * @param {Function} onProgress
 * @returns {Promise<Object>} - { [fileName]: { parentChat, branchPoint, depth } }
 */
export async function analyzeBranches(charAvatar, chats, onProgress = null) {
    console.log('[BranchAnalyzer] Starting Timelines-style analysis for', charAvatar);
    
    if (!chats || chats.length < 2) {
        console.log('[BranchAnalyzer] Not enough chats to analyze');
        return {};
    }
    
    // 1. 모든 채팅 내용 로드
    const chatContents = {};  // { fileName: [messages] }
    const fileNames = [];
    
    for (let i = 0; i < chats.length; i++) {
        const chat = chats[i];
        const fn = chat.file_name || '';
        if (!fn) continue;
        
        const content = await loadChatContent(charAvatar, fn);
        if (content && content.length > 0) {
            chatContents[fn] = content;
            fileNames.push(fn);
        }
        
        if (onProgress) onProgress((i + 1) / chats.length * 0.5);
    }
    
    if (fileNames.length < 2) {
        console.log('[BranchAnalyzer] Not enough valid chats');
        return {};
    }
    
    // 2. Timelines 핵심: previousNodes 추적
    // previousNodes[fileName] = 마지막으로 동일했던 다른 채팅 파일명
    const previousNodes = {};  // { fileName: lastMatchingFile }
    const branchInfo = {};     // { fileName: { parentChat, branchPoint } }
    
    // 초기화: 모두 첫 번째 채팅에서 시작 (root)
    const rootChat = fileNames[0];
    for (const fn of fileNames) {
        previousNodes[fn] = fn === rootChat ? null : rootChat;
    }
    
    // 3. 메시지 인덱스별로 순회 (Timelines transpose 방식)
    const maxLength = Math.max(...Object.values(chatContents).map(c => c.length));
    
    for (let msgIdx = 0; msgIdx < maxLength; msgIdx++) {
        // 이 인덱스에서 각 채팅의 메시지 내용 수집
        const contentGroups = {};  // { hash: [fileName, ...] }
        
        for (const fn of fileNames) {
            const content = chatContents[fn];
            if (msgIdx >= content.length) continue;  // 이 채팅은 여기서 끝
            
            const hash = getMessageHash(content[msgIdx]);
            if (!contentGroups[hash]) {
                contentGroups[hash] = [];
            }
            contentGroups[hash].push(fn);
        }
        
        const groups = Object.values(contentGroups);
        
        // 모든 채팅이 같은 내용 → 분기 없음
        if (groups.length <= 1) continue;
        
        // 🔥 분기 발생! Timelines 방식으로 처리
        // 각 그룹에서 "대표" 선정 (그룹 내 첫 번째 = 이전에 같이 있던 채팅)
        for (const group of groups) {
            // 그룹의 대표 = previousNodes가 같은 그룹에 있는 채팅
            let representative = group[0];
            
            for (const fn of group) {
                const prev = previousNodes[fn];
                if (prev && group.includes(prev)) {
                    representative = prev;
                    break;
                }
            }
            
            // 그룹 내 다른 채팅들의 previousNodes 업데이트
            for (const fn of group) {
                if (fn !== representative) {
                    // 아직 분기 기록이 없고, 이전 노드가 다른 그룹에 있었다면 분기!
                    if (!branchInfo[fn] && previousNodes[fn] && !group.includes(previousNodes[fn])) {
                        branchInfo[fn] = {
                            parentChat: previousNodes[fn],
                            branchPoint: msgIdx
                        };
                    }
                }
                previousNodes[fn] = representative;
            }
        }
        
        if (onProgress) onProgress(0.5 + (msgIdx + 1) / maxLength * 0.5);
    }
    
    // 4. 결과 정리 + depth 계산
    const result = {};
    
    // 분기점이 2 이상인 것만 (그리팅만 같은 건 제외)
    for (const [fileName, info] of Object.entries(branchInfo)) {
        if (info.branchPoint >= 2) {
            result[fileName] = {
                parentChat: info.parentChat,
                branchPoint: info.branchPoint,
                depth: 1
            };
        }
    }
    
    // depth 재계산 (부모의 depth + 1)
    const calculateDepth = (fn, visited = new Set()) => {
        if (visited.has(fn)) return 0;
        visited.add(fn);
        
        const info = result[fn];
        if (!info) return 0;
        
        const parentDepth = calculateDepth(info.parentChat, visited);
        info.depth = parentDepth + 1;
        return info.depth;
    };
    
    for (const fn of Object.keys(result)) {
        calculateDepth(fn);
        // 캐시에 저장
        const info = result[fn];
        setBranchInfo(charAvatar, fn, info.parentChat, info.branchPoint, info.depth);
    }
    
    console.log('[BranchAnalyzer] Found', Object.keys(result).length, 'branches');
    return result;
}

/**
 * 브랜치 분석이 필요한지 확인 (심플 버전)
 * @param {string} charAvatar
 * @param {Array} chats
 * @returns {boolean}
 */
export function needsBranchAnalysis(charAvatar, chats) {
    // 2개 이상의 채팅이 있으면 분석 가능
    return chats && chats.length >= 2;
}
