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
 * 같은 fingerprint 그룹 내에서 부모-자식 관계 분석
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
    
    // 각 채팅에 대해 부모 찾기
    for (const current of group) {
        const currentContent = chatContents[current.fileName];
        if (!currentContent) continue;
        
        let bestParent = null;
        let bestCommonLen = 0;
        
        // 모든 다른 채팅과 비교
        for (const candidate of group) {
            if (candidate.fileName === current.fileName) continue;
            
            const candidateContent = chatContents[candidate.fileName];
            if (!candidateContent) continue;
            
            const commonLen = findCommonPrefixLength(candidateContent, currentContent);
            
            // 부모 조건:
            // 1. 후보가 현재보다 짧거나 같아야 함 (부모가 자식보다 길 수 없음)
            // 2. 공통 부분이 후보의 거의 전체여야 함 (후보가 현재의 prefix)
            // 3. 가장 긴 공통을 가진 것이 직접 부모
            const candidateLen = candidateContent.length;
            const currentLen = currentContent.length;
            
            if (candidateLen <= currentLen && commonLen > bestCommonLen) {
                bestCommonLen = commonLen;
                bestParent = candidate.fileName;
            }
        }
        
        // 최소 2개 이상 메시지가 같아야 진짜 분기 (그리팅만 같은 건 제외)
        const MIN_COMMON_FOR_BRANCH = 2;
        
        if (bestParent && bestCommonLen >= MIN_COMMON_FOR_BRANCH) {
            result[current.fileName] = {
                parentChat: bestParent,
                branchPoint: bestCommonLen,
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
 * 채팅 목록을 브랜치 트리 구조로 정렬
 * @param {Array} chats
 * @param {string} charAvatar
 * @returns {Promise<Array>} - 정렬된 채팅 배열 (with _branchInfo)
 */
export async function sortChatsByBranchTree(chats, charAvatar) {
    // 캐시된 브랜치 정보 가져오기
    const branches = getAllBranches(charAvatar);
    
    // 각 채팅에 브랜치 정보 추가
    const chatsWithBranch = chats.map(chat => {
        const fn = chat.file_name || '';
        const branchInfo = branches[fn];
        
        return {
            ...chat,
            _branchInfo: branchInfo ? {
                parentChat: branchInfo.parentChat,
                branchPoint: branchInfo.branchPoint,
                depth: branchInfo.depth,
                isOriginal: false
            } : {
                parentChat: null,
                branchPoint: 0,
                depth: 0,
                isOriginal: true
            }
        };
    });
    
    // 트리 구조로 정렬
    // 1. 원본 먼저 (depth 0)
    // 2. 같은 부모 아래 브랜치는 연속으로
    
    const originals = chatsWithBranch.filter(c => c._branchInfo.isOriginal);
    const branches_arr = chatsWithBranch.filter(c => !c._branchInfo.isOriginal);
    
    // 원본은 날짜순
    originals.sort((a, b) => {
        const timeA = a.last_mes || a.file_name || '';
        const timeB = b.last_mes || b.file_name || '';
        return timeB.localeCompare(timeA);
    });
    
    // 브랜치는 부모별로 그룹핑 후 depth순
    branches_arr.sort((a, b) => {
        // 같은 부모면 depth순, 다르면 부모 이름순
        if (a._branchInfo.parentChat === b._branchInfo.parentChat) {
            return a._branchInfo.depth - b._branchInfo.depth;
        }
        return (a._branchInfo.parentChat || '').localeCompare(b._branchInfo.parentChat || '');
    });
    
    // 원본 뒤에 해당 브랜치들 배치
    const result = [];
    const usedBranches = new Set();
    
    for (const original of originals) {
        result.push(original);
        
        // 이 원본에서 파생된 브랜치들 찾기
        const childBranches = branches_arr.filter(b => 
            b._branchInfo.parentChat === original.file_name && !usedBranches.has(b.file_name)
        );
        
        for (const branch of childBranches) {
            result.push(branch);
            usedBranches.add(branch.file_name);
        }
    }
    
    // 남은 브랜치 (부모를 못 찾은 경우)
    for (const branch of branches_arr) {
        if (!usedBranches.has(branch.file_name)) {
            result.push(branch);
        }
    }
    
    return result;
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
