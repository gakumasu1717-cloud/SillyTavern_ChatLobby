// ============================================
// 브랜치 분석기 - Timelines 방식 참고
// 채팅들의 분기 관계를 분석하고 트리 구조로 정렬
// ============================================

import { api } from '../api/sillyTavern.js';
import {
    createFingerprint,
    findCommonPrefixLength,
    getBranchInfo,
    getFingerprint,
    setFingerprint,
    setBranchInfo,
    getAllBranches,
    getAllFingerprints
} from '../data/branchCache.js';

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
        
        return data;
    } catch (e) {
        console.error('[BranchAnalyzer] Failed to load chat:', fileName, e);
        return null;
    }
}

/**
 * 캐릭터의 모든 채팅에 대해 fingerprint 생성 (없는 것만)
 * @param {string} charAvatar
 * @param {Array} chats - 채팅 목록 [{file_name, chat_items, ...}]
 * @param {Function} onProgress - 진행률 콜백 (0~1)
 * @returns {Promise<Object>} - { [fileName]: { hash, length } }
 */
export async function ensureFingerprints(charAvatar, chats, onProgress = null) {
    const existing = getAllFingerprints(charAvatar);
    const result = { ...existing };
    
    // fingerprint가 없는 채팅만 필터
    const needsUpdate = chats.filter(chat => {
        const fn = chat.file_name || '';
        const cached = existing[fn];
        // 캐시가 없거나 메시지 수가 바뀌었으면 업데이트 필요
        const chatLength = chat.chat_items || chat.message_count || 0;
        return !cached || cached.length !== chatLength;
    });
    
    console.log(`[BranchAnalyzer] Need fingerprint for ${needsUpdate.length}/${chats.length} chats`);
    
    // 병렬로 처리 (최대 5개씩)
    const BATCH_SIZE = 5;
    for (let i = 0; i < needsUpdate.length; i += BATCH_SIZE) {
        const batch = needsUpdate.slice(i, i + BATCH_SIZE);
        
        await Promise.all(batch.map(async (chat) => {
            const fn = chat.file_name || '';
            const content = await loadChatContent(charAvatar, fn);
            
            if (content && content.length > 0) {
                const hash = createFingerprint(content);
                const length = content.length;
                
                setFingerprint(charAvatar, fn, hash, length);
                result[fn] = { hash, length };
            }
        }));
        
        if (onProgress) {
            onProgress(Math.min(1, (i + batch.length) / needsUpdate.length));
        }
        
        // UI 블로킹 방지
        await new Promise(r => setTimeout(r, 10));
    }
    
    return result;
}

/**
 * fingerprint가 같은 채팅들끼리 그룹핑
 * @param {Object} fingerprints - { [fileName]: { hash, length } }
 * @returns {Object} - { [hash]: [fileName1, fileName2, ...] }
 */
function groupByFingerprint(fingerprints) {
    const groups = {};
    
    for (const [fileName, data] of Object.entries(fingerprints)) {
        const hash = data.hash;
        if (!groups[hash]) {
            groups[hash] = [];
        }
        groups[hash].push({ fileName, length: data.length });
    }
    
    return groups;
}

/**
 * 같은 fingerprint 그룹 내에서 부모-자식 관계 분석 (Timelines 방식)
 * 메시지 index별로 순회하면서 previousNodes로 정확한 부모 추적
 * @param {string} charAvatar
 * @param {Array} group - [{ fileName, length }]
 * @returns {Promise<Object>} - { [fileName]: { parentChat, branchPoint, depth } }
 */
async function analyzeGroup(charAvatar, group) {
    if (group.length < 2) return {};
    
    const result = {};
    const chatContents = {};
    
    // 모든 채팅 내용 로드
    await Promise.all(group.map(async (item) => {
        const content = await loadChatContent(charAvatar, item.fileName);
        if (content) {
            chatContents[item.fileName] = content;
        }
    }));
    
    const fileNames = Object.keys(chatContents);
    if (fileNames.length < 2) return {};
    
    // Timelines 방식: 메시지 index별로 transpose
    const maxLength = Math.max(...Object.values(chatContents).map(c => c.length));
    
    // previousNodes: 각 채팅의 "이전 노드" 추적 (Timelines 핵심)
    // 부모 채팅과 분기점을 추적
    const branchPoints = {};  // { fileName: { parentChat, branchPoint } }
    const lastMatchingIndex = {};  // { fileName: 마지막으로 다른 채팅과 일치한 index }
    
    // 초기화: 모든 채팅은 root에서 시작
    for (const fn of fileNames) {
        lastMatchingIndex[fn] = -1;
    }
    
    // 메시지 index 0부터 순회
    for (let msgIdx = 0; msgIdx < maxLength; msgIdx++) {
        // 이 index에서 각 채팅의 메시지 content 수집
        const msgByContent = {};  // { contentHash: [fileName1, fileName2, ...] }
        
        for (const fn of fileNames) {
            const content = chatContents[fn];
            if (msgIdx >= content.length) continue;  // 이 채팅은 여기서 끝
            
            const msg = content[msgIdx];
            const hash = getMessageHash(msg);
            
            if (!msgByContent[hash]) {
                msgByContent[hash] = [];
            }
            msgByContent[hash].push(fn);
        }
        
        // 같은 content를 가진 채팅들끼리 그룹화
        const contentGroups = Object.values(msgByContent);
        
        // 단일 그룹이면 아직 분기 안 됨
        if (contentGroups.length === 1) {
            // 모든 채팅이 동일한 content를 가짐
            for (const fn of contentGroups[0]) {
                lastMatchingIndex[fn] = msgIdx;
            }
        } else {
            // 여러 그룹으로 분리됨 = 분기 발생!
            // 가장 긴 채팅을 가진 그룹을 "원본"으로 간주
            let mainGroup = contentGroups[0];
            let mainMaxLen = Math.max(...mainGroup.map(fn => chatContents[fn].length));
            
            for (const grp of contentGroups) {
                const grpMaxLen = Math.max(...grp.map(fn => chatContents[fn].length));
                if (grpMaxLen > mainMaxLen) {
                    mainGroup = grp;
                    mainMaxLen = grpMaxLen;
                }
            }
            
            // 원본 그룹 중 가장 긴 채팅을 부모로 지정
            const parentChat = mainGroup.reduce((a, b) => 
                chatContents[a].length >= chatContents[b].length ? a : b
            );
            
            // 다른 그룹들은 분기
            for (const grp of contentGroups) {
                if (grp === mainGroup) {
                    // 원본 그룹도 업데이트
                    for (const fn of grp) {
                        lastMatchingIndex[fn] = msgIdx;
                    }
                    continue;
                }
                
                // 분기된 채팅들
                for (const fn of grp) {
                    // 아직 분기점이 기록되지 않았으면 기록
                    if (!branchPoints[fn]) {
                        branchPoints[fn] = {
                            parentChat: parentChat,
                            branchPoint: msgIdx  // 이 index에서 분기됨
                        };
                    }
                }
            }
        }
    }
    
    // 결과 정리
    for (const [fileName, info] of Object.entries(branchPoints)) {
        // 분기점이 2 미만이면 (그리팅만 같음) 제외
        if (info.branchPoint >= 2) {
            result[fileName] = {
                parentChat: info.parentChat,
                branchPoint: info.branchPoint,
                depth: 1
            };
        }
    }
    
    // depth 계산 (부모의 depth + 1)
    const calculateDepth = (fileName, visited = new Set()) => {
        if (visited.has(fileName)) return 0;
        visited.add(fileName);
        
        const info = result[fileName];
        if (!info || !info.parentChat) return 0;
        
        const parentDepth = calculateDepth(info.parentChat, visited);
        info.depth = parentDepth + 1;
        return info.depth;
    };
    
    for (const fileName of Object.keys(result)) {
        calculateDepth(fileName);
    }
    
    return result;
}

/**
 * 메시지 해시 생성 (Timelines 방식 비교용)
 * @param {Object} message
 * @returns {string}
 */
function getMessageHash(message) {
    if (!message) return '';
    // mes 필드의 개행 정규화 후 비교
    const mes = (message.mes || '').replace(/\r\n/g, '\n');
    return mes;
}

/**
 * 캐릭터의 전체 브랜치 구조 분석
 * @param {string} charAvatar
 * @param {Array} chats
 * @param {Function} onProgress
 * @returns {Promise<Object>} - { [fileName]: { parentChat, branchPoint, depth } }
 */
export async function analyzeBranches(charAvatar, chats, onProgress = null) {
    console.log('[BranchAnalyzer] Starting analysis for', charAvatar);
    
    // 1. fingerprint 생성/업데이트
    const fingerprints = await ensureFingerprints(charAvatar, chats, (p) => {
        if (onProgress) onProgress(p * 0.5); // 50%까지
    });
    
    // 2. fingerprint로 그룹핑
    const groups = groupByFingerprint(fingerprints);
    
    // 3. 2개 이상인 그룹만 분석 (분기 가능성 있음)
    const multiGroups = Object.values(groups).filter(g => g.length >= 2);
    console.log(`[BranchAnalyzer] Found ${multiGroups.length} groups with potential branches`);
    
    // 4. 각 그룹 분석
    const allBranches = {};
    for (let i = 0; i < multiGroups.length; i++) {
        const group = multiGroups[i];
        const groupResult = await analyzeGroup(charAvatar, group);
        
        // 결과 병합 및 캐시 저장
        for (const [fileName, info] of Object.entries(groupResult)) {
            allBranches[fileName] = info;
            setBranchInfo(charAvatar, fileName, info.parentChat, info.branchPoint, info.depth);
        }
        
        if (onProgress) {
            onProgress(0.5 + (i + 1) / multiGroups.length * 0.5);
        }
    }
    
    console.log('[BranchAnalyzer] Analysis complete:', Object.keys(allBranches).length, 'branches found');
    return allBranches;
}

/**
 * 브랜치 분석이 필요한지 확인
 * @param {string} charAvatar
 * @param {Array} chats
 * @returns {boolean}
 */
export function needsBranchAnalysis(charAvatar, chats) {
    const fingerprints = getAllFingerprints(charAvatar);
    
    // fingerprint가 없는 채팅이 있으면 분석 필요
    for (const chat of chats) {
        const fn = chat.file_name || '';
        if (!fingerprints[fn]) {
            return true;
        }
    }
    
    return false;
}
