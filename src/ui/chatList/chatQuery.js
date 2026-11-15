// ============================================
// 채팅 목록 - 데이터 정규화/필터/정렬 (DOM 접근 없음)
// ============================================

import { storage } from '../../data/storage.js';
import { getTimestamp } from '../../utils/dateUtils.js';
import { getAllBranches } from '../../data/branchCache.js';

/**
 * 채팅 데이터 정규화
 * @param {Array|Object} chats
 * @returns {Array}
 */
export function normalizeChats(chats) {
    if (Array.isArray(chats)) return [...chats];
    
    if (typeof chats === 'object') {
        return Object.entries(chats).map(([key, value]) => {
            if (typeof value === 'object') {
                return { ...value, file_name: value.file_name || key };
            }
            return { file_name: key, ...value };
        });
    }
    
    return [];
}

/**
 * 유효한 채팅만 필터링
 * @param {Array} chats
 * @returns {Array}
 */
export function filterValidChats(chats) {
    return chats.filter(chat => {
        const fileName = chat?.file_name || chat?.fileName || '';
        const hasJsonl = fileName.includes('.jsonl');
        // 날짜 패턴 체크 제거 - 사용자가 채팅 이름을 변경해도 정상 인식되도록
        return fileName && 
               hasJsonl &&
               !fileName.startsWith('chat_') &&
               fileName.toLowerCase() !== 'error';
    });
}

/**
 * 폴더별 필터링
 * @param {Array} chats
 * @param {string} charAvatar
 * @param {string} filterFolder
 * @returns {Array}
 */
export function filterByFolder(chats, charAvatar, filterFolder) {
    
    const data = storage.load();
    
    const result = chats.filter(chat => {
        const fn = chat.file_name || chat.fileName || '';
        const key = storage.getChatKey(charAvatar, fn);
        
        if (filterFolder === 'favorites') {
            return data.favorites.includes(key);
        }
        
        const assigned = data.chatAssignments[key] || 'uncategorized';
        return assigned === filterFolder;
    });
    
    return result;
}

/**
 * 채팅 정렬
 * @param {Array} chats
 * @param {string} charAvatar
 * @param {string} sortOption
 * @returns {Array}
 */
export function sortChats(chats, charAvatar, sortOption) {
    const data = storage.load();
    
        // 분기로 보기 모드 - 캐시된 브랜치 정보 사용
        if (sortOption === 'branch') {
            return sortByBranchTreeCached(chats, charAvatar, data);
        }
        
        return [...chats].sort((a, b) => {
            const fnA = a.file_name || '';
            const fnB = b.file_name || '';
            
            // 즐겨찾기 우선
            const keyA = storage.getChatKey(charAvatar, fnA);
            const keyB = storage.getChatKey(charAvatar, fnB);
            const favA = data.favorites.includes(keyA) ? 0 : 1;
            const favB = data.favorites.includes(keyB) ? 0 : 1;
            if (favA !== favB) return favA - favB;
            
            if (sortOption === 'name') {
                return fnA.localeCompare(fnB, 'ko');
            }
            
            if (sortOption === 'messages') {
                const msgA = a.message_count || a.mes_count || a.chat_items || 0;
                const msgB = b.message_count || b.mes_count || b.chat_items || 0;
                return msgB - msgA;
            }
            
            // 기본: 날짜순
            return getTimestamp(b) - getTimestamp(a);
        });
    }

    /**
     * 채팅 파일명에서 브랜치 정보 파싱 (파일명 기반 - 백업용)
     * 패턴:
     * - 원본: "해루 - 2026-01-07@23h38m10s.jsonl"
     * - 브랜치: "Branch #5 - 2026-01-20@01h10m03s.jsonl"
     * 
     * @param {string} fileName
     * @returns {{ branch: string|null, depth: number, isOriginal: boolean }}
     */
    function parseBranchInfoFromName(fileName) {
        const cleanName = fileName.replace('.jsonl', '');
        
        // Branch #숫자 또는 Branch #숫자-숫자 패턴 찾기
        const branchMatch = cleanName.match(/^Branch\s*#(\d+(?:-\d+)*)\s*-/i);
        
        if (!branchMatch) {
            return { branch: null, depth: 0, isOriginal: true };
        }
        
        const branchPart = branchMatch[1];
        const branchSegments = branchPart.split('-');
        
        return {
            branch: branchPart,
            depth: branchSegments.length,
            isOriginal: false
        };
    }

    /**
     * 캐시된 브랜치 정보 사용하여 트리 구조로 정렬
     * @param {Array} chats
     * @param {string} charAvatar
     * @param {Object} data - storage 데이터
     * @returns {Array}
     */
    function sortByBranchTreeCached(chats, charAvatar, data) {
        const branches = getAllBranches(charAvatar);
        
        // 각 채팅에 브랜치 정보 추가
        const chatsWithBranch = chats.map(chat => {
            const fileName = chat.file_name || '';
            const branchInfo = branches[fileName];
            
            // 캐시에 있으면 사용, 없으면 파일명으로 판단
            if (branchInfo) {
                return {
                    ...chat,
                    _branchInfo: {
                        parentChat: branchInfo.parentChat,
                        branchPoint: branchInfo.branchPoint,
                        depth: branchInfo.depth || 1,
                        isOriginal: false
                    }
                };
            } else {
                // 캐시 없음 → 그룹 루트이거나 미분석 채팅 → 항상 original 취급
                // (분석된 브랜치는 반드시 캐시에 존재하므로, 캐시 미스 = 루트)
                return {
                    ...chat,
                    _branchInfo: {
                        parentChat: null,
                        branchPoint: 0,
                        depth: 0,
                        isOriginal: true
                    }
                };
            }
        });
        
        // 원본과 브랜치 분리
        const originals = chatsWithBranch.filter(c => c._branchInfo.isOriginal);
        const branchList = chatsWithBranch.filter(c => !c._branchInfo.isOriginal);
        
        // 원본: 즐겨찾기 우선, 날짜순
        originals.sort((a, b) => {
            const fnA = a.file_name || '';
            const fnB = b.file_name || '';
            const keyA = storage.getChatKey(charAvatar, fnA);
            const keyB = storage.getChatKey(charAvatar, fnB);
            const favA = data.favorites.includes(keyA) ? 0 : 1;
            const favB = data.favorites.includes(keyB) ? 0 : 1;
            if (favA !== favB) return favA - favB;
            return getTimestamp(b) - getTimestamp(a);
        });
        
        // 브랜치: depth 순 → 날짜순
        branchList.sort((a, b) => {
            const depthDiff = a._branchInfo.depth - b._branchInfo.depth;
            if (depthDiff !== 0) return depthDiff;
            return getTimestamp(b) - getTimestamp(a);
        });
        
        // 트리 구조로 재배치: 재귀적으로 부모-자식 체인 따라가기
        const result = [];
        const usedBranches = new Set();
        
        /**
         * 재귀적으로 자식 브랜치 추가
         * @param {string} parentFileName
         */
        function addChildBranches(parentFileName) {
            // 이 부모의 직접 자식들 찾기
            const children = branchList.filter(b => 
                b._branchInfo.parentChat === parentFileName && !usedBranches.has(b.file_name)
            );
            
            // depth 순, 날짜순 정렬
            children.sort((a, b) => {
                const depthDiff = a._branchInfo.depth - b._branchInfo.depth;
                if (depthDiff !== 0) return depthDiff;
                return getTimestamp(b) - getTimestamp(a);
            });
            
            for (const child of children) {
                result.push(child);
                usedBranches.add(child.file_name);
                
                // 이 자식의 자식도 재귀적으로 추가
                addChildBranches(child.file_name);
            }
        }
        
        // 각 원본에 대해 트리 구성
        for (const original of originals) {
            result.push(original);
            addChildBranches(original.file_name);
        }
        
        // 남은 브랜치 (부모를 못 찾은 경우 - 원본이 삭제됐거나)
        for (const branch of branchList) {
            if (!usedBranches.has(branch.file_name)) {
                result.push(branch);
                usedBranches.add(branch.file_name);
                // 이 고아 브랜치의 자식들도 추가
                addChildBranches(branch.file_name);
            }
        }
        
        return result;
    }
