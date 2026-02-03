// ============================================
// 브랜치 분석기 - Timelines tl_node_data.js 원본 기반
// buildGraph()의 previousNodes 로직을 정확히 따름
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
 * Timelines 원본: preprocessChatSessions()
 * 채팅들을 메시지 인덱스별로 전치(transpose)
 * 
 * @param {Object} chatHistory - { fileName: [messages] }
 * @returns {Array} allChats - 2D 배열, allChats[messageId] = [{file_name, index, message}, ...]
 */
function preprocessChatSessions(chatHistory) {
    const allChats = [];
    
    for (const [file_name, messages] of Object.entries(chatHistory)) {
        messages.forEach((message, index) => {
            if (!allChats[index]) {
                allChats[index] = [];
            }
            allChats[index].push({
                file_name,
                index,
                message
            });
        });
    }
    
    return allChats;
}

/**
 * Timelines 원본: groupMessagesByContent()
 * 같은 내용의 메시지끼리 그룹화
 * 
 * @param {Array} messages - [{file_name, index, message}, ...]
 * @returns {Object} groups - { messageContent: [{file_name, index, message}, ...] }
 */
function groupMessagesByContent(messages) {
    const groups = {};
    
    messages.forEach((messageObj) => {
        const { file_name, message } = messageObj;
        try {
            // 개행 정규화 (Timelines 원본 그대로)
            const mes = (message.mes || '').replace(/\r\n/g, '\n');
            
            if (!groups[mes]) {
                groups[mes] = [];
            }
            groups[mes].push({ file_name, message });
        } catch (e) {
            console.error('[BranchAnalyzer] Message grouping error:', e);
        }
    });
    
    return groups;
}

/**
 * Timelines 원본 buildGraph() 핵심 로직 기반 분기 분석
 * 
 * 핵심 원리:
 * - previousNodes[file_name] = 해당 채팅이 현재 연결된 노드 ID
 * - 같은 내용의 메시지들은 같은 노드로 연결됨
 * - 분기 = "이전까지 같은 노드에 있던 채팅들이 다른 그룹으로 갈라질 때"
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
    const chatHistory = {};  // { fileName: [messages] }
    
    for (let i = 0; i < chats.length; i++) {
        const chat = chats[i];
        const fn = chat.file_name || '';
        if (!fn) continue;
        
        const content = await loadChatContent(charAvatar, fn);
        if (content && content.length > 0) {
            chatHistory[fn] = content;
        }
        
        if (onProgress) onProgress((i + 1) / chats.length * 0.3);
    }
    
    const fileNames = Object.keys(chatHistory);
    console.log('[BranchAnalyzer] Loaded', fileNames.length, 'chats');
    
    if (fileNames.length < 2) {
        console.log('[BranchAnalyzer] Not enough valid chats');
        return {};
    }
    
    // 2. Timelines 방식: 메시지 인덱스별로 전치
    const allChats = preprocessChatSessions(chatHistory);
    console.log('[BranchAnalyzer] Max message depth:', allChats.length);
    
    // 3. 분기 분석 핵심 로직
    // previousNodes[file_name] = 이전 메시지에서 해당 채팅이 속한 노드 ID
    const previousNodes = {};   // { file_name: nodeId }
    const branchInfo = {};      // { file_name: { parentChat, branchPoint } }
    let keyCounter = 1;
    
    // 초기화: 모든 채팅은 root에서 시작
    fileNames.forEach(fn => {
        previousNodes[fn] = 'root';
    });
    
    // 4. 메시지 인덱스별로 순회
    for (let messageId = 0; messageId < allChats.length; messageId++) {
        const messagesAtThisLevel = allChats[messageId];
        if (!messagesAtThisLevel || messagesAtThisLevel.length === 0) continue;
        
        // 이 messageId에서 같은 내용끼리 그룹화
        const groups = groupMessagesByContent(messagesAtThisLevel);
        
        // 🔥 핵심: 이전까지 같은 노드에 있던 채팅들이 이제 다른 그룹으로 갈라지는지 체크
        // prevNode별로 어떤 그룹들로 분산되는지 확인
        const prevNodeToGroups = new Map();  // { prevNode: Map<groupKey, [file_names]> }
        
        for (const [groupKey, group] of Object.entries(groups)) {
            for (const messageObj of group) {
                const fn = messageObj.file_name;
                const prevNode = previousNodes[fn];
                
                if (!prevNodeToGroups.has(prevNode)) {
                    prevNodeToGroups.set(prevNode, new Map());
                }
                const groupsFromPrevNode = prevNodeToGroups.get(prevNode);
                if (!groupsFromPrevNode.has(groupKey)) {
                    groupsFromPrevNode.set(groupKey, []);
                }
                groupsFromPrevNode.get(groupKey).push(fn);
            }
        }
        
        // 분기 감지: 같은 prevNode에서 여러 그룹으로 갈라지면 분기!
        for (const [prevNode, groupsFromPrevNode] of prevNodeToGroups) {
            if (groupsFromPrevNode.size > 1) {
                // 여러 그룹으로 갈라짐 = 분기 발생!
                console.log(`[BranchAnalyzer] Branch detected at messageId ${messageId} from prevNode ${prevNode}`);
                
                // 가장 많은 채팅이 있는 그룹을 "메인"으로
                let mainGroupKey = null;
                let maxCount = 0;
                for (const [gk, fns] of groupsFromPrevNode) {
                    if (fns.length > maxCount) {
                        maxCount = fns.length;
                        mainGroupKey = gk;
                    }
                }
                
                // 메인 그룹의 첫 번째 채팅을 부모로
                const mainFiles = groupsFromPrevNode.get(mainGroupKey);
                const parentChat = mainFiles[0];
                
                // 나머지 그룹의 채팅들은 분기로 기록
                for (const [gk, fns] of groupsFromPrevNode) {
                    if (gk !== mainGroupKey) {
                        for (const fn of fns) {
                            if (!branchInfo[fn]) {
                                branchInfo[fn] = {
                                    parentChat: parentChat,
                                    branchPoint: messageId
                                };
                                console.log(`[BranchAnalyzer] ${fn} branches from ${parentChat} at message ${messageId}`);
                            }
                        }
                    }
                }
            }
        }
        
        // 각 그룹에 새로운 nodeId 할당하고 previousNodes 업데이트
        for (const [groupKey, group] of Object.entries(groups)) {
            const nodeId = `message${keyCounter}`;
            keyCounter++;
            
            for (const messageObj of group) {
                previousNodes[messageObj.file_name] = nodeId;
            }
        }
        
        if (onProgress) onProgress(0.3 + (messageId + 1) / allChats.length * 0.7);
    }
    
    // 5. 결과 정리 + depth 계산
    const result = {};
    
    // 분기점이 1 이상인 것만 (첫 메시지부터 다르면 별개 채팅)
    for (const [fileName, info] of Object.entries(branchInfo)) {
        if (info.branchPoint >= 1) {
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
 * 브랜치 분석이 필요한지 확인
 * @param {string} charAvatar
 * @param {Array} chats
 * @returns {boolean}
 */
export function needsBranchAnalysis(charAvatar, chats) {
    // 2개 이상의 채팅이 있으면 분석 가능
    return chats && chats.length >= 2;
}
