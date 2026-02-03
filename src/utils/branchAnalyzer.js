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
 * @param {boolean} forceRefresh - 강제 재분석 (모든 채팅 재처리)
 * @returns {Promise<Object>} - { [fileName]: { hash, length } }
 */
export async function ensureFingerprints(charAvatar, chats, onProgress = null, forceRefresh = false) {
    const existing = forceRefresh ? {} : getAllFingerprints(charAvatar);
    const result = { ...existing };
    
    // fingerprint가 없는 채팅만 필터 (forceRefresh면 전부)
    const needsUpdate = forceRefresh ? chats : chats.filter(chat => {
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
 * 
 * 분기 판정 기준:
 * 1. 공통 prefix가 최소 3개 이상 (그리팅 + 유저 + AI 응답)
 * 2. 후보가 "원본"이 되려면: 공통 부분이 후보 길이의 90% 이상이거나, 후보가 공통 부분에서 끝남
 * 3. 현재 채팅이 분기점 이후 추가 메시지가 있어야 함
 * 
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
    
    // 공통 prefix 길이 매트릭스 계산 (O(n²) 비교)
    const commonLengths = {};  // { fileName: { otherFileName: commonLen } }
    const validFiles = group.filter(g => chatContents[g.fileName]?.length >= 2);
    
    for (const current of validFiles) {
        commonLengths[current.fileName] = {};
        for (const other of validFiles) {
            if (current.fileName === other.fileName) continue;
            commonLengths[current.fileName][other.fileName] = 
                findCommonPrefixLength(chatContents[current.fileName], chatContents[other.fileName]);
        }
    }
    
    // 분기 판정 상수
    const MIN_COMMON_FOR_BRANCH = 5;  // 최소 5개 메시지 (그리팅 + 2번 왕복 대화)
    const PARENT_COVERAGE_THRESHOLD = 0.7;  // 후보의 70% 이상이 공통이어야 원본으로 인정
    const MIN_CURRENT_COVERAGE = 0.1;  // 현재 채팅의 최소 10% 이상이 공통이어야 분기로 인정
    
    // 각 채팅에 대해 가장 가까운 부모 찾기
    for (const current of validFiles) {
        const currentContent = chatContents[current.fileName];
        const currentLen = currentContent.length;
        
        let bestParent = null;
        let bestCommonLen = 0;
        let bestScore = -1;  // 점수 기반 선택
        
        for (const candidate of validFiles) {
            if (candidate.fileName === current.fileName) continue;
            
            const candidateContent = chatContents[candidate.fileName];
            const candidateLen = candidateContent.length;
            const commonLen = commonLengths[current.fileName][candidate.fileName];
            
            // 최소 공통 메시지 수 확인
            if (commonLen < MIN_COMMON_FOR_BRANCH) continue;
            
            // 현재 채팅이 분기점 이후 추가 메시지가 있어야 함
            if (currentLen <= commonLen) continue;
            
            // 🔥 현재 채팅 기준 공통 비율도 확인
            // 199개 채팅과 10개 채팅이 공통 5개면 → 10개 채팅은 50% 공통 (분기 가능성)
            // 199개 채팅과 200개 채팅이 공통 5개면 → 200개 채팅은 2.5% 공통 (별개 채팅)
            const currentCoverage = commonLen / currentLen;
            if (currentCoverage < MIN_CURRENT_COVERAGE) {
                // 현재 채팅의 아주 일부만 공통 → 완전히 별개 채팅
                continue;
            }
            
            // 후보가 "원본/부모"가 되려면:
            // - 후보 길이가 공통 부분과 거의 같거나 (후보가 분기점에서 끝남)
            // - 공통 부분이 후보의 상당 부분을 차지해야 함
            const candidateCoverage = commonLen / candidateLen;
            
            // 후보가 공통 부분 이후로도 많이 진행했다면 → 형제 관계일 가능성 높음, 부모 아님
            // 후보가 공통 부분에서 끝나거나 조금만 더 갔다면 → 원본/부모일 가능성 높음
            if (candidateCoverage < PARENT_COVERAGE_THRESHOLD) {
                // 후보도 분기점 이후로 많이 진행함 → 형제 관계, 부모 아님
                continue;
            }
            
            // 점수 계산: 공통 길이가 길수록 + 후보가 짧을수록 좋음
            const score = commonLen * 1000 - candidateLen;
            
            if (score > bestScore) {
                bestScore = score;
                bestCommonLen = commonLen;
                bestParent = candidate.fileName;
            }
        }
        
        if (bestParent) {
            result[current.fileName] = {
                parentChat: bestParent,
                branchPoint: bestCommonLen,
                depth: 1
            };
            console.log(`[BranchAnalyzer] ${current.fileName} branches from ${bestParent} at message ${bestCommonLen}`);
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
 * @param {boolean} forceRefresh - 강제 재분석 (캐시 무시)
 * @returns {Promise<Object>} - { [fileName]: { parentChat, branchPoint, depth } }
 */
export async function analyzeBranches(charAvatar, chats, onProgress = null, forceRefresh = false) {
    console.log('[BranchAnalyzer] Starting analysis for', charAvatar, 'forceRefresh:', forceRefresh);
    
    // 1. fingerprint 생성/업데이트 (강제 재분석 시 모든 채팅 재처리)
    const fingerprints = await ensureFingerprints(charAvatar, chats, (p) => {
        if (onProgress) onProgress(p * 0.5); // 50%까지
    }, forceRefresh);
    
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
