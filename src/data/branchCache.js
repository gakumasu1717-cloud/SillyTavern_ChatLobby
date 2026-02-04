// ============================================
// 브랜치 감지 및 캐싱 시스템
// Timelines 확장 방식 참고: fingerprint 기반 분기점 감지
// ============================================

const STORAGE_KEY = 'chatLobby_branchCache';
const FINGERPRINT_MESSAGE_COUNT = 10; // 앞 10개 메시지로 fingerprint (빠른 그룹핑용)

/**
 * 브랜치 캐시 데이터 구조
 * {
 *   version: 1,
 *   characters: {
 *     [charAvatar]: {
 *       fingerprints: {
 *         [chatFileName]: {
 *           hash: string,          // 앞 N개 메시지 해시
 *           length: number,        // 메시지 수
 *           lastUpdated: number    // 마지막 업데이트 시간
 *         }
 *       },
 *       branches: {
 *         [chatFileName]: {
 *           parentChat: string,    // 부모 채팅 파일명
 *           branchPoint: number,   // 분기 지점 인덱스
 *           depth: number          // 분기 깊이 (1 = 직접 분기, 2 = 손자...)
 *         }
 *       }
 *     }
 *   }
 * }
 */

let cacheData = null;

/**
 * 캐시 로드
 */
function loadCache() {
    if (cacheData) return cacheData;
    
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            cacheData = JSON.parse(stored);
        }
    } catch (e) {
        console.warn('[BranchCache] Failed to load cache:', e);
    }
    
    if (!cacheData || cacheData.version !== 1) {
        cacheData = { version: 1, characters: {} };
    }
    
    return cacheData;
}

/**
 * 캐시 저장
 */
function saveCache() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheData));
    } catch (e) {
        console.warn('[BranchCache] Failed to save cache:', e);
    }
}

/**
 * 문자열 해시 (djb2 알고리즘 - 빠르고 충돌 적음)
 * @param {string} str
 * @returns {string}
 */
function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
}

/**
 * 채팅 메시지들로 fingerprint 생성
 * 앞 N개 메시지로 해시 생성 → 빠른 그룹핑용
 * 일찍 분기한 채팅은 교차 비교에서 잡힘
 * @param {Array} messages - 채팅 메시지 배열
 * @returns {string}
 */
function createFingerprint(messages) {
    if (!messages || messages.length === 0) {
        return 'empty';
    }
    
    // 앞 N개 메시지로 해시 생성
    const targetCount = Math.min(FINGERPRINT_MESSAGE_COUNT, messages.length);
    let combined = '';
    
    for (let i = 0; i < targetCount; i++) {
        const msg = messages[i];
        if (msg && msg.mes) {
            combined += (msg.is_user ? 'U' : 'A') + ':' + msg.mes.substring(0, 100) + '|';
        }
    }
    
    const hash = hashString(combined);
    
    // 🔥 디버깅: 앞 3개 메시지 미리보기
    const preview = messages.slice(0, 3).map((m, i) => 
        `${i}:${m?.is_user ? 'U' : 'A'}:"${(m?.mes || '').substring(0, 30)}..."`
    ).join(' | ');
    console.log(`[Fingerprint] hash=${hash}, msgCount=${messages.length}, preview=[${preview}]`);
    
    return hash;
}

/**
 * 두 채팅의 공통 접두사 길이 계산 (분기점 찾기)
 * @param {Array} chat1 - 첫 번째 채팅 메시지 배열
 * @param {Array} chat2 - 두 번째 채팅 메시지 배열
 * @returns {number} - 공통 메시지 수
 */
function findCommonPrefixLength(chat1, chat2) {
    const minLen = Math.min(chat1.length, chat2.length);
    let commonLen = 0;
    
    for (let i = 0; i < minLen; i++) {
        const msg1 = chat1[i];
        const msg2 = chat2[i];
        
        // 내용 + 발신자 둘 다 체크
        if (msg1?.mes === msg2?.mes && msg1?.is_user === msg2?.is_user) {
            commonLen++;
        } else {
            // 🔥 디버깅: 처음 다른 지점 출력
            console.log(`[CommonPrefix] Diff at ${i}: `, 
                `[1] ${msg1?.is_user ? 'U' : 'A'}:"${(msg1?.mes || '').substring(0, 50)}..."`,
                `[2] ${msg2?.is_user ? 'U' : 'A'}:"${(msg2?.mes || '').substring(0, 50)}..."`
            );
            break;
        }
    }
    
    console.log(`[CommonPrefix] Result: ${commonLen}/${minLen} (chat1=${chat1.length}, chat2=${chat2.length})`);
    return commonLen;
}

/**
 * 캐릭터의 브랜치 정보 가져오기 (캐시된)
 * @param {string} charAvatar
 * @param {string} chatFileName
 * @returns {{ parentChat: string|null, branchPoint: number, depth: number }|null}
 */
export function getBranchInfo(charAvatar, chatFileName) {
    const cache = loadCache();
    return cache.characters[charAvatar]?.branches?.[chatFileName] || null;
}

/**
 * fingerprint 캐시 가져오기
 * @param {string} charAvatar
 * @param {string} chatFileName
 * @returns {{ hash: string, length: number }|null}
 */
export function getFingerprint(charAvatar, chatFileName) {
    const cache = loadCache();
    return cache.characters[charAvatar]?.fingerprints?.[chatFileName] || null;
}

/**
 * fingerprint 저장
 * @param {string} charAvatar
 * @param {string} chatFileName
 * @param {string} hash
 * @param {number} length
 */
export function setFingerprint(charAvatar, chatFileName, hash, length) {
    const cache = loadCache();
    
    if (!cache.characters[charAvatar]) {
        cache.characters[charAvatar] = { fingerprints: {}, branches: {} };
    }
    
    cache.characters[charAvatar].fingerprints[chatFileName] = {
        hash,
        length,
        lastUpdated: Date.now()
    };
    
    saveCache();
}

/**
 * 브랜치 정보 저장
 * @param {string} charAvatar
 * @param {string} chatFileName
 * @param {string|null} parentChat
 * @param {number} branchPoint
 * @param {number} depth
 */
export function setBranchInfo(charAvatar, chatFileName, parentChat, branchPoint, depth) {
    const cache = loadCache();
    
    if (!cache.characters[charAvatar]) {
        cache.characters[charAvatar] = { fingerprints: {}, branches: {} };
    }
    
    cache.characters[charAvatar].branches[chatFileName] = {
        parentChat,
        branchPoint,
        depth
    };
    
    saveCache();
}

/**
 * 캐릭터의 모든 브랜치 정보 가져오기
 * @param {string} charAvatar
 * @returns {Object} - { [chatFileName]: { parentChat, branchPoint, depth } }
 */
export function getAllBranches(charAvatar) {
    const cache = loadCache();
    return cache.characters[charAvatar]?.branches || {};
}

/**
 * 캐릭터의 모든 fingerprint 가져오기
 * @param {string} charAvatar
 * @returns {Object}
 */
export function getAllFingerprints(charAvatar) {
    const cache = loadCache();
    return cache.characters[charAvatar]?.fingerprints || {};
}

/**
 * 캐시 무효화 (채팅 삭제 시 등)
 * @param {string} charAvatar
 * @param {string} chatFileName
 */
export function invalidateCache(charAvatar, chatFileName) {
    const cache = loadCache();
    
    if (cache.characters[charAvatar]) {
        delete cache.characters[charAvatar].fingerprints?.[chatFileName];
        delete cache.characters[charAvatar].branches?.[chatFileName];
        saveCache();
    }
}

/**
 * 캐릭터 전체 캐시 초기화
 * @param {string} charAvatar
 */
export function clearCharacterCache(charAvatar) {
    const cache = loadCache();
    delete cache.characters[charAvatar];
    saveCache();
}

// Export utilities
export { createFingerprint, findCommonPrefixLength, hashString };
