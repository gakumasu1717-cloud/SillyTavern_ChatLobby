// ============================================
// 브랜치 분석기 - 날짜 기반 + 점수 폴백
// 채팅들의 분기 관계를 분석하고 트리 구조로 정렬
// ============================================

import { api } from '../api/sillyTavern.js';
import {
    createFingerprint,
    setFingerprintBatch,
    setBranchInfoBatch,
    getAllFingerprints
} from '../data/branchCache.js';

// 안전장치 상수
const SAFETY = {
    TIMEOUT_MS: 30000,    // 전체 분석 30초 제한
    MAX_API_CALLS: 200,   // API 호출 최대 200회
    MAX_ERRORS: 15,       // 누적 에러 15회시 중단 (batch 5개 동시 실패 고려)
    REQUEST_TIMEOUT_MS: 10000,  // 개별 fetch 요청 10초 제한
};

// 채팅 내용 캐시 (중복 로드 방지)
const chatContentCache = new Map();

/**
 * 캐시 클리어 (메모리 해제)
 */
function clearContentCache() {
    chatContentCache.clear();
}

/**
 * 분석 컨텍스트 생성 (안전장치 추적용)
 */
function createAnalysisContext() {
    return {
        startTime: Date.now(),
        apiCalls: 0,
        errorCount: 0,
        aborted: false,
        abortReason: '',
    };
}

/**
 * 안전장치 체크 - 타임아웃, API 한도, 에러 한도
 * @param {Object} ctx - 분석 컨텍스트
 * @returns {boolean} - 계속 진행 가능하면 true
 */
function checkSafety(ctx) {
    if (ctx.aborted) return false;

    if (Date.now() - ctx.startTime > SAFETY.TIMEOUT_MS) {
        ctx.aborted = true;
        ctx.abortReason = `Timeout: ${SAFETY.TIMEOUT_MS}ms exceeded`;
        console.warn('[BranchAnalyzer] SAFETY ABORT:', ctx.abortReason);
        return false;
    }
    if (ctx.apiCalls >= SAFETY.MAX_API_CALLS) {
        ctx.aborted = true;
        ctx.abortReason = `API call limit: ${ctx.apiCalls}/${SAFETY.MAX_API_CALLS}`;
        console.warn('[BranchAnalyzer] SAFETY ABORT:', ctx.abortReason);
        return false;
    }
    if (ctx.errorCount >= SAFETY.MAX_ERRORS) {
        ctx.aborted = true;
        ctx.abortReason = `Too many errors: ${ctx.errorCount}/${SAFETY.MAX_ERRORS}`;
        console.warn('[BranchAnalyzer] SAFETY ABORT:', ctx.abortReason);
        return false;
    }
    return true;
}

/**
 * 파일명에서 날짜 추출
 * 패턴1: "대화 - 2026-01-29@18h40m17s788ms.jsonl" (밀리초 포함)
 * 패턴2: "Branch #333 - 2026-01-26@01h29m56s.jsonl" (밀리초 없음)
 * 패턴3: "백도진 - 2026-1-23 @04h 07m 56s 422ms imported.jsonl" (공백 포함, imported)
 * @param {string} fileName
 * @returns {number|null} - timestamp 또는 null
 */
function extractDateFromFileName(fileName) {
    // 패턴1: 밀리초 포함 (공백 없는 표준 형식)
    let match = fileName.match(/(\d{4})-(\d{1,2})-(\d{1,2})@(\d{2})h(\d{2})m(\d{2})s(\d+)ms/);
    if (match) {
        const timestamp = new Date(
            parseInt(match[1]),      // 년
            parseInt(match[2]) - 1,  // 월 (0부터 시작)
            parseInt(match[3]),      // 일
            parseInt(match[4]),      // 시
            parseInt(match[5]),      // 분
            parseInt(match[6]),      // 초
            parseInt(match[7])       // 밀리초
        ).getTime();
        return isNaN(timestamp) ? null : timestamp;
    }
    
    // 패턴2: 밀리초 없는 패턴 (Branch 파일 등)
    match = fileName.match(/(\d{4})-(\d{1,2})-(\d{1,2})@(\d{2})h(\d{2})m(\d{2})s/);
    if (match) {
        const timestamp = new Date(
            parseInt(match[1]),      // 년
            parseInt(match[2]) - 1,  // 월 (0부터 시작)
            parseInt(match[3]),      // 일
            parseInt(match[4]),      // 시
            parseInt(match[5]),      // 분
            parseInt(match[6]),      // 초
            0                        // 밀리초 (없으면 0)
        ).getTime();
        return isNaN(timestamp) ? null : timestamp;
    }
    
    // 패턴3: imported 파일 (공백 포함) - "2026-1-23 @04h 07m 56s 422ms"
    match = fileName.match(/(\d{4})-(\d{1,2})-(\d{1,2})\s*@(\d{2})h\s*(\d{2})m\s*(\d{2})s\s*(\d+)ms/);
    if (match) {
        const timestamp = new Date(
            parseInt(match[1]),      // 년
            parseInt(match[2]) - 1,  // 월 (0부터 시작)
            parseInt(match[3]),      // 일
            parseInt(match[4]),      // 시
            parseInt(match[5]),      // 분
            parseInt(match[6]),      // 초
            parseInt(match[7])       // 밀리초
        ).getTime();
        return isNaN(timestamp) ? null : timestamp;
    }
    
    return null;
}

/**
 * 채팅 내용 로드 (캐시 사용)
 * @param {string} charAvatar
 * @param {string} fileName
 * @returns {Promise<Array|null>}
 */
async function loadChatContent(charAvatar, fileName, ctx = null) {
    const cacheKey = `${charAvatar}:${fileName}`;
    
    if (chatContentCache.has(cacheKey)) {
        return chatContentCache.get(cacheKey);
    }
    
    if (ctx) ctx.apiCalls++;
    
    try {
        const charDir = charAvatar.replace(/\.(png|jpg|webp)$/i, '');
        const chatName = fileName.replace('.jsonl', '');
        
        // 개별 요청 타임아웃 (AbortController)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), SAFETY.REQUEST_TIMEOUT_MS);
        
        let response;
        try {
            response = await fetch('/api/chats/get', {
                method: 'POST',
                headers: api.getRequestHeaders(),
                body: JSON.stringify({
                    ch_name: charDir,
                    file_name: chatName,
                    avatar_url: charAvatar
                }),
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timeoutId);
        }
        
        if (!response.ok) return null;
        
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
        const reason = e.name === 'AbortError' ? 'TIMEOUT' : e.message || e;
        console.error(`[BranchAnalyzer] Failed to load chat: ${fileName} (${reason})`);
        if (ctx) {
            ctx.errorCount++;
            console.warn(`[BranchAnalyzer] Error count: ${ctx.errorCount}/${SAFETY.MAX_ERRORS}`);
        }
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
export async function ensureFingerprints(charAvatar, chats, onProgress = null, forceRefresh = false, ctx = null) {
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
    
    // 병렬로 처리 (최대 5개씩)
    const BATCH_SIZE = 5;
    const batchEntries = []; // 배치 저장용
    
    for (let i = 0; i < needsUpdate.length; i += BATCH_SIZE) {
        // 안전장치 체크
        if (ctx && !checkSafety(ctx)) break;
        
        const batch = needsUpdate.slice(i, i + BATCH_SIZE);
        
        await Promise.all(batch.map(async (chat) => {
            const fn = chat.file_name || '';
            const content = await loadChatContent(charAvatar, fn, ctx);
            
            if (content && content.length > 0) {
                const hash = createFingerprint(content, fn);
                const length = content.length;
                
                batchEntries.push({ fileName: fn, hash, length });
                result[fn] = { hash, length };
            }
        }));
        
        if (onProgress) {
            onProgress(Math.min(1, (i + batch.length) / needsUpdate.length));
        }
        
        // UI 블로킹 방지
        await new Promise(r => setTimeout(r, 10));
    }
    
    // 마지막에 한 번만 저장
    if (batchEntries.length > 0) {
        setFingerprintBatch(charAvatar, batchEntries);
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
 * 메시지 해시 전처리 (빠른 비교용)
 * 전체 mes 비교 대신 길이 + 샘플 문자열로 비교
 * @param {Object} msg
 * @returns {string}
 */
function hashMessageFast(msg) {
    if (!msg?.mes) return msg?.is_user ? 'U:0:' : 'A:0:';
    
    const m = msg.mes;
    const len = m.length;
    const head = m.substring(0, 50);
    const tail = len > 100 ? m.substring(len - 50) : '';
    const mid = len > 150 ? m.substring((len >> 1), (len >> 1) + 50) : '';
    
    return `${msg.is_user ? 'U' : 'A'}:${len}:${head}${tail}${mid}`;
}

/**
 * 이진탐색으로 분기점 찾기 (순수 분기 구조 전용)
 * @param {Array<string>} chat1 - 해시 배열
 * @param {Array<string>} chat2 - 해시 배열
 * @returns {number} - 공통 메시지 수
 */
function findCommonPrefixLengthFast(chat1, chat2) {
    const minLen = Math.min(chat1.length, chat2.length);
    if (minLen === 0) return 0;
    
    // 끝까지 같으면 바로 리턴
    if (chat1[minLen - 1] === chat2[minLen - 1]) return minLen;
    
    // 이진탐색: 처음으로 달라지는 지점 찾기
    let lo = 0, hi = minLen - 1;
    while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (chat1[mid] === chat2[mid]) {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    
    return lo;
}

/**
 * 같은 fingerprint 그룹 내에서 부모-자식 관계 분석
 * 날짜가 있으면 날짜 기반, 없으면 점수 기반
 * 
 * @param {string} charAvatar
 * @param {Array} group - [{ fileName, length }]
 * @returns {Promise<Object>} - { [fileName]: { parentChat, branchPoint, depth } }
 */
async function analyzeGroup(charAvatar, group, ctx = null) {
    if (group.length < 2) return {};
    
    const chatContents = {};  // 원본 데이터
    const chatHashes = {};    // 해시 전처리된 데이터
    
    // 모든 채팅 내용 로드 + 해시 전처리
    await Promise.all(group.map(async (item) => {
        const content = await loadChatContent(charAvatar, item.fileName, ctx);
        if (content) {
            chatContents[item.fileName] = content;
            // 로드할 때 해시 미리 계산 (채팅당 1회)
            chatHashes[item.fileName] = content.map(msg => hashMessageFast(msg));
        }
    }));
    
    // 유효한 파일만 필터
    const validFiles = group.filter(g => chatContents[g.fileName]?.length >= 2);
    if (validFiles.length < 2) return {};
    
    // 날짜 파싱 시도
    const dates = {};
    let allHaveDates = true;
    const failedDates = [];
    
    for (const item of validFiles) {
        const date = extractDateFromFileName(item.fileName);
        if (date) {
            dates[item.fileName] = date;
        } else {
            allHaveDates = false;
            failedDates.push(item.fileName);
        }
    }
    
    // 부모 결정 방식 선택
    if (allHaveDates) {
        return analyzeByDate(validFiles, dates, chatContents, chatHashes);
    } else {
        return analyzeByScore(validFiles, chatContents, chatHashes);
    }
}

/**
 * 날짜 기반 분석 - 오래된 채팅이 부모
 */
function analyzeByDate(group, dates, chatContents, chatHashes) {
    const result = {};
    
    // 날짜순 정렬 (오래된 순)
    const sorted = [...group].sort((a, b) => dates[a.fileName] - dates[b.fileName]);
    
    // 각 채팅에 대해 나보다 오래된 채팅 중 가장 가까운 부모 찾기
    for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i];
        const currentContent = chatContents[current.fileName];
        const currentHashes = chatHashes[current.fileName];
        if (!currentContent || !currentHashes) continue;
        
        let bestParent = null;
        let bestCommon = 0;
        
        // 나보다 오래된 채팅들만 검사
        for (let j = 0; j < i; j++) {
            const candidate = sorted[j];
            const candidateContent = chatContents[candidate.fileName];
            const candidateHashes = chatHashes[candidate.fileName];
            if (!candidateContent || !candidateHashes) continue;
            
            // 이진탐색으로 분기점 찾기 (해시 비교)
            const common = findCommonPrefixLengthFast(currentHashes, candidateHashes);
            
            console.log(`[BranchAnalyzer][Date] Comparing: ${current.fileName}(${currentContent.length}msgs) vs ${candidate.fileName}(${candidateContent.length}msgs) → common=${common}`);
            
            // 공통 메시지가 없으면 스킵
            if (common === 0) continue;
            
            // 가장 공통이 많은 후보가 부모
            if (common > bestCommon) {
                bestCommon = common;
                bestParent = candidate.fileName;
            }
        }
        
        if (bestParent) {
            // 후보 전체 요약 테이블
            const debugLines = [];
            for (let k = 0; k < i; k++) {
                const cand = sorted[k];
                const h = chatHashes[cand.fileName];
                if (!h) continue;
                const c = findCommonPrefixLengthFast(currentHashes, h);
                const len = chatContents[cand.fileName]?.length || 0;
                const marker = cand.fileName === bestParent ? ' \u2190 선택됨' : '';
                debugLines.push(`  ${cand.fileName}: common=${c}, len=${len}${marker}`);
            }
            console.log(
                `[BranchDebug] ${current.fileName}\n` +
                `  \u2192 부모: ${bestParent} (common=${bestCommon})\n` +
                debugLines.join('\n')
            );
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
 * 점수 기반 분석 - 공통 많은 게 부모
 * 순환 방지: 후보가 현재보다 길면 부모 후보에서 제외
 * 같은 길이면 파일명 사전순으로 결정
 */
function analyzeByScore(group, chatContents, chatHashes) {
    const result = {};
    
    for (const current of group) {
        const currentContent = chatContents[current.fileName];
        const currentHashes = chatHashes[current.fileName];
        if (!currentContent || currentContent.length < 2 || !currentHashes) continue;
        
        let bestParent = null;
        let bestCommon = 0;
        
        for (const candidate of group) {
            if (candidate.fileName === current.fileName) continue;
            
            const candidateContent = chatContents[candidate.fileName];
            const candidateHashes = chatHashes[candidate.fileName];
            if (!candidateContent || !candidateHashes) continue;
            
            // 이진탐색으로 분기점 찾기 (해시 비교)
            const common = findCommonPrefixLengthFast(currentHashes, candidateHashes);
            
            console.log(`[BranchAnalyzer][Score] Comparing: ${current.fileName}(${currentContent.length}msgs) vs ${candidate.fileName}(${candidateContent.length}msgs) → common=${common}`);
            
            // 공통 메시지가 없으면 스킵
            if (common === 0) continue;
            // 현재가 분기점 이후 진행했어야 함
            if (currentContent.length <= common) continue;
            
            // 순환 방지: 후보가 현재보다 길면 부모 후보에서 제외
            // 같은 길이면 파일명 사전순으로 결정
            if (candidateContent.length > currentContent.length) continue;
            if (candidateContent.length === currentContent.length 
                && candidate.fileName > current.fileName) continue;
            
            // 가장 공통이 많은 후보가 부모
            if (common > bestCommon) {
                bestCommon = common;
                bestParent = candidate.fileName;
            }
        }
        
        if (bestParent) {
            // 후보 전체 요약 테이블
            const debugLines = [];
            for (const cand of group) {
                if (cand.fileName === current.fileName) continue;
                const h = chatHashes[cand.fileName];
                if (!h) continue;
                const c = findCommonPrefixLengthFast(currentHashes, h);
                const len = chatContents[cand.fileName]?.length || 0;
                const marker = cand.fileName === bestParent ? ' \u2190 선택됨' : '';
                debugLines.push(`  ${cand.fileName}: common=${c}, len=${len}${marker}`);
            }
            console.log(
                `[BranchDebug] ${current.fileName}\n` +
                `  \u2192 부모: ${bestParent} (common=${bestCommon})\n` +
                debugLines.join('\n')
            );
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
 * fingerprint 그룹핑으로 O(N²) 방지 + 그룹 내 엄격한 조건
 * @param {string} charAvatar
 * @param {Array} chats
 * @param {Function} onProgress
 * @param {boolean} forceRefresh - 강제 재분석 (캐시 무시)
 * @returns {Promise<Object>} - { [fileName]: { parentChat, branchPoint, depth } }
 */
export async function analyzeBranches(charAvatar, chats, onProgress = null, forceRefresh = false) {
    console.log('[BranchAnalyzer] Starting analysis for', charAvatar, 'forceRefresh:', forceRefresh, 'chats:', chats.length);
    
    if (chats.length < 2) {
        console.log('[BranchAnalyzer] Not enough chats to analyze');
        return {};
    }
    
    const ctx = createAnalysisContext();
    
    try {
        // 1. fingerprint 생성/업데이트 (0~20%)
        const fingerprints = await ensureFingerprints(charAvatar, chats, (p) => {
            if (onProgress) onProgress(p * 0.2);
        }, forceRefresh, ctx);
        
        if (ctx.aborted) {
            console.warn('[BranchAnalyzer] Aborted during fingerprint phase:', ctx.abortReason);
            return {};
        }
        
        // 2. fingerprint로 그룹핑 (O(N²) 방지)
        const groups = groupByFingerprint(fingerprints);
        
        // 3. 2개 이상인 그룹만 분석 (20~95%)
        const multiGroups = Object.values(groups).filter(g => g.length >= 2);
        console.log(`[BranchAnalyzer] Found ${multiGroups.length} groups with 2+ chats (total ${Object.keys(groups).length} groups)`);
        
        const allBranches = {};
        const branchEntries = []; // 배치 저장용
        
        for (let i = 0; i < multiGroups.length; i++) {
            // 안전장치 체크
            if (!checkSafety(ctx)) break;
            
            const group = multiGroups[i];
            console.log(`[BranchAnalyzer] Analyzing group ${i + 1}/${multiGroups.length} with ${group.length} chats`);
            
            const groupResult = await analyzeGroup(charAvatar, group, ctx);
            
            for (const [fileName, info] of Object.entries(groupResult)) {
                allBranches[fileName] = info;
                branchEntries.push({
                    fileName,
                    parentChat: info.parentChat,
                    branchPoint: info.branchPoint,
                    depth: info.depth
                });
                
                console.log('[BranchAnalyzer] Branch found:', fileName, 
                    '→ parent:', info.parentChat, 
                    'branchPoint:', info.branchPoint);
            }
            
            if (onProgress) {
                onProgress(0.2 + (i + 1) / Math.max(1, multiGroups.length) * 0.75);
            }
        }
        
        // branchPoint 유효성 검증 (Step 3)
        for (const [fileName, info] of Object.entries(allBranches)) {
            const parentFp = fingerprints[info.parentChat];
            if (parentFp && info.branchPoint > parentFp.length) {
                console.warn(`[BranchAnalyzer] Invalid branchPoint: ${fileName} branchPoint=${info.branchPoint} > parent(${info.parentChat}).length=${parentFp.length}. Removing.`);
                delete allBranches[fileName];
                const idx = branchEntries.findIndex(e => e.fileName === fileName);
                if (idx !== -1) branchEntries.splice(idx, 1);
            }
        }
        
        // 마지막에 한 번만 저장
        if (branchEntries.length > 0) {
            setBranchInfoBatch(charAvatar, branchEntries);
        }
        
        if (onProgress) onProgress(1);
        
        // Safety report
        if (ctx.aborted) {
            console.warn(`[BranchAnalyzer] Analysis aborted: ${ctx.abortReason}`);
        }
        console.log(`[BranchAnalyzer] Safety report: apiCalls=${ctx.apiCalls}, errors=${ctx.errorCount}, elapsed=${Date.now() - ctx.startTime}ms, aborted=${ctx.aborted}`);
        console.log('[BranchAnalyzer] Analysis complete:', Object.keys(allBranches).length, 'branches found');
        return allBranches;
        
    } finally {
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
