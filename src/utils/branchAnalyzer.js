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
    TIMEOUT_MS: 120000,   // 전체 분석 120초 제한 (채팅 많은 캐릭터 고려)
    MAX_API_CALLS: 200,   // API 호출 최대 200회
    MAX_ERRORS: 15,       // 누적 에러 15회시 중단
    REQUEST_TIMEOUT_MS: 15000,  // 개별 fetch 요청 15초 제한
    RETRY_DELAY_MS: 1000,       // 재시도 전 대기 시간
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
    
    const charDir = charAvatar.replace(/\.(png|jpg|webp)$/i, '');
    const chatName = fileName.replace('.jsonl', '');
    
    // 최대 2회 시도 (1회 실패 시 1회 재시도)
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
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
            
            if (!response.ok) {
                if (attempt === 0) {
                    console.warn(`[BranchAnalyzer] HTTP ${response.status} loading ${fileName}, retrying...`);
                    await new Promise(r => setTimeout(r, SAFETY.RETRY_DELAY_MS));
                    continue;
                }
                return null;
            }
            
            const data = await response.json();
            
            let content = null;
            if (Array.isArray(data) && data.length > 1) {
                content = data.slice(1);
            } else {
                content = data;
            }
            
            chatContentCache.set(cacheKey, content);
            return content;
        } catch (e) {
            const reason = e.name === 'AbortError' ? 'TIMEOUT' : e.message || e;
            if (attempt === 0) {
                console.warn(`[BranchAnalyzer] ${reason} loading ${fileName}, retrying...`);
                await new Promise(r => setTimeout(r, SAFETY.RETRY_DELAY_MS));
                continue;
            }
            console.error(`[BranchAnalyzer] Failed to load chat: ${fileName} (${reason}) after retry`);
            if (ctx) {
                ctx.errorCount++;
                console.warn(`[BranchAnalyzer] Error count: ${ctx.errorCount}/${SAFETY.MAX_ERRORS}`);
            }
            return null;
        }
    }
    return null;
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
    // ctx가 없으면 단독 호출 — 끝나면 캐시 정리 필요
    const isStandalone = !ctx;
    try {
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
    
    // 병렬로 처리 (최대 3개씩 - 서버 부하 방지)
    const BATCH_SIZE = 3;
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
        
        // UI 블로킹 방지 + 서버 부하 분산
        await new Promise(r => setTimeout(r, 200));
    }
    
    // 마지막에 한 번만 저장
    if (batchEntries.length > 0) {
        setFingerprintBatch(charAvatar, batchEntries);
    }
    
    return result;
    } finally {
        // 단독 호출이면 캐시 정리 (analyzeBranches 경유 시 그쪽 finally에서 정리)
        if (isStandalone) {
            clearContentCache();
        }
    }
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
            
            // 공통 메시지가 없으면 스킵
            if (common === 0) continue;
            
            // 가장 공통이 많은 후보가 부모
            if (common > bestCommon) {
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
 * 순환 감지 시 해당 관계를 제거하고 경고
 */
function calculateDepths(result) {
    const getDepth = (fileName, visited = new Set()) => {
        if (visited.has(fileName)) {
            // 순환 감지 — 이 노드의 parent 관계를 끊어 트리 무결성 유지
            console.warn('[BranchAnalyzer] Cycle detected at', fileName, '— removing parent link');
            if (result[fileName]) {
                result[fileName].parentChat = null;
                result[fileName].branchPoint = 0;
            }
            return 0;
        }
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
 * 특정 채팅이 속한 그룹의 루트(부모 없는) 채팅들 찾기
 * @param {string} fileName - 기준 채팅
 * @param {Object} branches - 현재 분석 결과
 * @returns {string[]} - 루트 채팅 파일명 배열
 */
function findGroupRoots(fileName, branches) {
    // fileName의 최상위 부모 찾기
    let root = fileName;
    const visited = new Set();
    while (branches[root]?.parentChat && !visited.has(root)) {
        visited.add(root);
        root = branches[root].parentChat;
    }
    // root가 부모 없는 채팅이면 그게 루트
    // 같은 루트를 공유하는 채팅 중 부모가 없는 것들 반환
    return [root];
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
    console.debug('[BranchAnalyzer] Starting analysis for', charAvatar, 'forceRefresh:', forceRefresh, 'chats:', chats.length);
    
    if (chats.length < 2) {
        console.debug('[BranchAnalyzer] Not enough chats to analyze');
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
        const singleGroups = Object.values(groups).filter(g => g.length === 1);
        console.debug(`[BranchAnalyzer] Found ${multiGroups.length} groups with 2+ chats (total ${Object.keys(groups).length} groups)`);
        
        const allBranches = {};
        const branchEntries = []; // 배치 저장용
        
        for (let i = 0; i < multiGroups.length; i++) {
            // 안전장치 체크
            if (!checkSafety(ctx)) break;
            
            const group = multiGroups[i];
            console.debug(`[BranchAnalyzer] Analyzing group ${i + 1}/${multiGroups.length} with ${group.length} chats`);
            
            const groupResult = await analyzeGroup(charAvatar, group, ctx);
            
            for (const [fileName, info] of Object.entries(groupResult)) {
                allBranches[fileName] = info;
                branchEntries.push({
                    fileName,
                    parentChat: info.parentChat,
                    branchPoint: info.branchPoint,
                    depth: info.depth
                });
                
                console.debug('[BranchAnalyzer] Branch found:', fileName, 
                    '→ parent:', info.parentChat, 
                    'branchPoint:', info.branchPoint);
            }
            
            if (onProgress) {
                onProgress(0.2 + (i + 1) / Math.max(1, multiGroups.length) * 0.75);
            }
        }
        
        // ============================================
        // 4. 고아 채팅 교차 비교 (fingerprint 불일치 → 내용 직접 비교)
        // 부모 채팅이 스와이프/리제너로 수정되어 fingerprint가 달라진 경우 대응
        // ============================================
        if (singleGroups.length > 0 && !ctx.aborted) {
            
            // 모든 채팅 목록 (고아 + 나머지)
            const allChats = Object.entries(fingerprints).map(([fn, fp]) => ({ fileName: fn, length: fp.length }));
            const orphanFiles = singleGroups.map(g => g[0].fileName);
            
            // 고아 채팅 내용 로드 + 해시 전처리
            const orphanContents = {};
            const orphanHashes = {};
            
            for (const orphanFn of orphanFiles) {
                if (!checkSafety(ctx)) break;
                const content = await loadChatContent(charAvatar, orphanFn, ctx);
                if (content && content.length >= 2) {
                    orphanContents[orphanFn] = content;
                    orphanHashes[orphanFn] = content.map(msg => hashMessageFast(msg));
                }
            }
            
            // 비고아 채팅 내용 로드 + 해시 전처리 (고아가 아닌 채팅들)
            const nonOrphanFiles = allChats.filter(c => !orphanFiles.includes(c.fileName));
            const nonOrphanContents = {};
            const nonOrphanHashes = {};
            
            for (const item of nonOrphanFiles) {
                if (!checkSafety(ctx)) break;
                const content = await loadChatContent(charAvatar, item.fileName, ctx);
                if (content && content.length >= 2) {
                    nonOrphanContents[item.fileName] = content;
                    nonOrphanHashes[item.fileName] = content.map(msg => hashMessageFast(msg));
                }
            }
            
            // 각 고아 채팅에 대해 교차 비교
            for (const orphanFn of orphanFiles) {
                if (!checkSafety(ctx)) break;
                if (!orphanHashes[orphanFn]) continue;
                // 이미 부모가 있으면 스킵
                if (allBranches[orphanFn]) continue;
                
                const orphanH = orphanHashes[orphanFn];
                const orphanC = orphanContents[orphanFn];
                const orphanLen = orphanC.length;
                let bestMatch = null;
                let bestCommon = 0;
                
                // 비고아 채팅과 비교
                for (const item of nonOrphanFiles) {
                    const h = nonOrphanHashes[item.fileName];
                    if (!h) continue;
                    
                    const common = findCommonPrefixLengthFast(orphanH, h);
                    if (common === 0) continue;
                    
                    if (common > bestCommon) {
                        bestCommon = common;
                        bestMatch = item.fileName;
                    }
                }
                
                if (bestMatch && bestCommon > 0) {
                    const matchLen = nonOrphanContents[bestMatch]?.length || 0;
                    
                    // 날짜 기반으로 부모 결정
                    const orphanDate = extractDateFromFileName(orphanFn);
                    const matchDate = extractDateFromFileName(bestMatch);
                    
                    if (orphanDate && matchDate) {
                        if (orphanDate < matchDate) {
                            // 고아가 더 오래됨 → 고아가 부모
                            orphanIsParent = true;
                        } else {
                            // 고아가 더 새로움 → 고아가 자식
                            orphanIsParent = false;
                        }
                    } else {
                        // 날짜 없으면 메시지 수 기반 (짧은 쪽이 부모)
                        orphanIsParent = orphanLen <= matchLen;
                    }
                    
                    if (orphanIsParent) {
                        // 고아가 부모 → bestMatch의 기존 부모보다 더 상위 부모인지 확인
                        // bestMatch가 이미 부모 없는 루트이면 고아를 부모로 설정
                        // bestMatch의 그룹에서 루트(부모 없는) 채팅을 찾아 고아를 부모로 연결
                        const rootChats = findGroupRoots(bestMatch, allBranches);
                        
                        for (const rootFn of rootChats) {
                            const rootH = nonOrphanHashes[rootFn];
                            if (!rootH) continue;
                            const rootCommon = findCommonPrefixLengthFast(orphanH, rootH);
                            
                            if (rootCommon > 0) {
                                allBranches[rootFn] = {
                                    parentChat: orphanFn,
                                    branchPoint: rootCommon,
                                    depth: 1
                                };
                                branchEntries.push({
                                    fileName: rootFn,
                                    parentChat: orphanFn,
                                    branchPoint: rootCommon,
                                    depth: 1
                                });
                            }
                        }
                    } else {
                        // 고아가 자식
                        allBranches[orphanFn] = {
                            parentChat: bestMatch,
                            branchPoint: bestCommon,
                            depth: 1
                        };
                        branchEntries.push({
                            fileName: orphanFn,
                            parentChat: bestMatch,
                            branchPoint: bestCommon,
                            depth: 1
                        });
                    }
                }
            }
            
            // depth 재계산
            calculateDepths(allBranches);
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
        console.debug(`[BranchAnalyzer] Safety report: apiCalls=${ctx.apiCalls}, errors=${ctx.errorCount}, elapsed=${Date.now() - ctx.startTime}ms, aborted=${ctx.aborted}`);
        console.debug('[BranchAnalyzer] Analysis complete:', Object.keys(allBranches).length, 'branches found');
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
