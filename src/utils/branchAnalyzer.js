// ============================================
// 브랜치 분석기 - 날짜 기반 + 점수 폴백
// 채팅들의 분기 관계를 분석하고 트리 구조로 정렬
// ============================================

import { api } from '../api/sillyTavern.js';
import {
    createFingerprint,
    findCommonPrefixLength,
    setFingerprint,
    setBranchInfo,
    getAllFingerprints
} from '../data/branchCache.js';

// 분기 판정 상수
const MIN_COMMON_FOR_BRANCH = 3;  // 최소 3개 메시지 (그리팅 + 1번 왕복)

// 채팅 내용 캐시 (중복 로드 방지)
const chatContentCache = new Map();

/**
 * 캐시 클리어 (메모리 해제)
 */
function clearContentCache() {
    chatContentCache.clear();
}

/**
 * 파일명에서 날짜 추출
 * 패턴: "대화 - 2026-01-29@18h40m17s788ms.jsonl"
 * @param {string} fileName
 * @returns {number|null} - timestamp 또는 null
 */
function extractDateFromFileName(fileName) {
    const match = fileName.match(/(\d{4})-(\d{2})-(\d{2})@(\d{2})h(\d{2})m(\d{2})s(\d+)ms/);
    if (match) {
        return new Date(
            parseInt(match[1]),      // 년
            parseInt(match[2]) - 1,  // 월 (0부터 시작)
            parseInt(match[3]),      // 일
            parseInt(match[4]),      // 시
            parseInt(match[5]),      // 분
            parseInt(match[6]),      // 초
            parseInt(match[7])       // 밀리초
        ).getTime();
    }
    return null;
}

/**
 * 채팅 내용 로드 (캐시 사용)
 * @param {string} charAvatar
 * @param {string} fileName
 * @returns {Promise<Array|null>}
 */
async function loadChatContent(charAvatar, fileName) {
    const cacheKey = `${charAvatar}:${fileName}`;
    
    // 캐시에 있으면 반환
    if (chatContentCache.has(cacheKey)) {
        return chatContentCache.get(cacheKey);
    }
    
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
        
        if (!response.ok) {
            chatContentCache.set(cacheKey, null);
            return null;
        }
        
        const data = await response.json();
        
        let content = null;
        // 첫 번째는 메타데이터이므로 제외
        if (Array.isArray(data) && data.length > 1) {
            content = data.slice(1);
        } else {
            content = data;
        }
        
        // 캐시에 저장
        chatContentCache.set(cacheKey, content);
        return content;
    } catch (e) {
        console.error('[BranchAnalyzer] Failed to load chat:', fileName, e);
        chatContentCache.set(cacheKey, null);
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
 * 날짜가 있으면 날짜 기반, 없으면 점수 기반
 * 
 * @param {string} charAvatar
 * @param {Array} group - [{ fileName, length }]
 * @returns {Promise<Object>} - { [fileName]: { parentChat, branchPoint, depth } }
 */
async function analyzeGroup(charAvatar, group) {
    if (group.length < 2) return {};
    
    const chatContents = {};
    
    // 모든 채팅 내용 로드
    await Promise.all(group.map(async (item) => {
        const content = await loadChatContent(charAvatar, item.fileName);
        if (content) {
            chatContents[item.fileName] = content;
        }
    }));
    
    // 유효한 파일만 필터
    const validFiles = group.filter(g => chatContents[g.fileName]?.length >= 2);
    if (validFiles.length < 2) return {};
    
    // 날짜 파싱 시도
    const dates = {};
    let allHaveDates = true;
    
    for (const item of validFiles) {
        const date = extractDateFromFileName(item.fileName);
        if (date) {
            dates[item.fileName] = date;
        } else {
            allHaveDates = false;
        }
    }
    
    // 부모 결정 방식 선택
    if (allHaveDates) {
        return analyzeByDate(validFiles, dates, chatContents);
    } else {
        return analyzeByScore(validFiles, chatContents);
    }
}

/**
 * 날짜 기반 분석 - 오래된 채팅이 부모
 */
function analyzeByDate(group, dates, chatContents) {
    const result = {};
    
    // 날짜순 정렬 (오래된 순)
    const sorted = [...group].sort((a, b) => dates[a.fileName] - dates[b.fileName]);
    
    // 각 채팅에 대해 나보다 오래된 채팅 중 가장 가까운 부모 찾기
    for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i];
        const currentContent = chatContents[current.fileName];
        if (!currentContent) continue;
        
        let bestParent = null;
        let bestCommon = 0;
        
        // 나보다 오래된 채팅들만 검사
        for (let j = 0; j < i; j++) {
            const candidate = sorted[j];
            const candidateContent = chatContents[candidate.fileName];
            if (!candidateContent) continue;
            
            const common = findCommonPrefixLength(currentContent, candidateContent);
            
            // 최소 공통 메시지 확인
            // 현재 또는 후보 중 하나라도 분기점 이후 진행했으면 OK
            if (common >= MIN_COMMON_FOR_BRANCH && 
                (currentContent.length > common || candidateContent.length > common) &&
                common > bestCommon) {
                bestCommon = common;
                bestParent = candidate.fileName;
            }
        }
        
        if (bestParent) {
            result[current.fileName] = {
                parentChat: bestParent,
                branchPoint: bestCommon,
                depth: 1
            };
        }
    }
    
    // depth 계산
    calculateDepths(result);
    return result;
}

/**
 * 점수 기반 분석 - 공통 많고 짧은 게 부모
 * 순환 방지: 후보가 현재보다 길면 부모 후보에서 제외
 */
function analyzeByScore(group, chatContents) {
    const result = {};
    
    for (const current of group) {
        const currentContent = chatContents[current.fileName];
        if (!currentContent || currentContent.length < 2) continue;
        
        let bestParent = null;
        let bestScore = -1;
        let bestCommon = 0;
        
        for (const candidate of group) {
            if (candidate.fileName === current.fileName) continue;
            
            const candidateContent = chatContents[candidate.fileName];
            if (!candidateContent) continue;
            
            const common = findCommonPrefixLength(currentContent, candidateContent);
            
            // 최소 공통 & 현재가 분기점 이후 진행
            if (common < MIN_COMMON_FOR_BRANCH) continue;
            if (currentContent.length <= common) continue;
            
            // 순환 방지: 후보가 현재보다 길면 부모 후보에서 제외
            // (짧거나 같은 채팅만 부모가 될 수 있음)
            if (candidateContent.length > currentContent.length) continue;
            
            // 점수: 공통 많을수록 + 짧을수록 (직접 부모 우선)
            const score = common * 1000 - candidateContent.length;
            
            if (score > bestScore) {
                bestScore = score;
                bestCommon = common;
                bestParent = candidate.fileName;
            }
        }
        
        if (bestParent) {
            result[current.fileName] = {
                parentChat: bestParent,
                branchPoint: bestCommon,
                depth: 1
            };
        }
    }
    
    // depth 계산
    calculateDepths(result);
    return result;
}

/**
 * depth 계산 (부모의 depth + 1)
 */
function calculateDepths(result) {
    const getDepth = (fileName, visited = new Set()) => {
        if (visited.has(fileName)) return 0;
        visited.add(fileName);
        
        const info = result[fileName];
        if (!info || !info.parentChat) return 0;
        
        const parentDepth = getDepth(info.parentChat, visited);
        info.depth = parentDepth + 1;
        return info.depth;
    };
    
    for (const fileName of Object.keys(result)) {
        getDepth(fileName);
    }
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
    
    try {
        // 1. fingerprint 생성/업데이트 (0~20%)
        const fingerprints = await ensureFingerprints(charAvatar, chats, (p) => {
            if (onProgress) onProgress(p * 0.2);
        }, forceRefresh);
        
        // 2. fingerprint로 그룹핑
        const groups = groupByFingerprint(fingerprints);
        
        // 3. 2개 이상인 그룹 분석 (20~80%)
        const multiGroups = Object.values(groups).filter(g => g.length >= 2);
        console.log(`[BranchAnalyzer] Found ${multiGroups.length} groups with potential branches`);
        
        const allBranches = {};
        for (let i = 0; i < multiGroups.length; i++) {
            const group = multiGroups[i];
            const groupResult = await analyzeGroup(charAvatar, group);
            
            for (const [fileName, info] of Object.entries(groupResult)) {
                allBranches[fileName] = info;
                setBranchInfo(charAvatar, fileName, info.parentChat, info.branchPoint, info.depth);
            }
            
            if (onProgress) {
                onProgress(0.2 + (i + 1) / Math.max(1, multiGroups.length) * 0.6); // 20~80%
            }
        }
        
        // 4. 교차 비교 (80~95%) - 다른 그룹 간에도 비교
        const allChatsFlat = Object.values(groups).flat();
        if (allChatsFlat.length >= 2) {
            console.log('[BranchAnalyzer] Cross-group analysis for', allChatsFlat.length, 'chats');
            
            const crossResult = await analyzeGroup(charAvatar, allChatsFlat);
            
            for (const [fileName, info] of Object.entries(crossResult)) {
                // 기존 결과가 없거나, 새 결과가 더 긴 공통 prefix를 가지면 업데이트
                if (!allBranches[fileName] || info.branchPoint > allBranches[fileName].branchPoint) {
                    allBranches[fileName] = info;
                    setBranchInfo(charAvatar, fileName, info.parentChat, info.branchPoint, info.depth);
                }
            }
            
            if (onProgress) onProgress(0.95);
        }
        
        if (onProgress) onProgress(1);
        console.log('[BranchAnalyzer] Analysis complete:', Object.keys(allBranches).length, 'branches found');
        return allBranches;
        
    } finally {
        // 분석 끝나면 메모리 해제
        clearContentCache();
    }
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
