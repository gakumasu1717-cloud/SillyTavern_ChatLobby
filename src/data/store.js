// ============================================
// 전역 상태 관리 Store
// ============================================

/**
 * @typedef {Object} Character
 * @property {string|number} index - 캐릭터 인덱스 (dataset에서는 string, API에서는 number)
 * @property {string} avatar - 아바타 파일명
 * @property {string} name - 캐릭터 이름
 * @property {string} avatarSrc - 아바타 이미지 URL
 */

/**
 * @typedef {Object} ChatHandlers
 * @property {Function} onOpen - 채팅 열기 핸들러
 * @property {Function} onDelete - 채팅 삭제 핸들러
 */

/**
 * @typedef {Object} StoreState
 * @property {Character|null} currentCharacter - 현재 선택된 캐릭터
 * @property {boolean} batchModeActive - 배치 모드 활성화 여부
 * @property {boolean} isProcessingPersona - 페르소나 처리 중 여부
 * @property {boolean} isLobbyOpen - 로비 열림 여부
 * @property {string} searchTerm - 캐릭터 검색어
 * @property {string|null} selectedTag - 선택된 태그 필터
 * @property {boolean} tagBarExpanded - 태그바 펼침 상태
 * @property {Function|null} onCharacterSelect - 캐릭터 선택 콜백
 * @property {ChatHandlers} chatHandlers - 채팅 핸들러
 */

class Store {
    constructor() {
        /** @type {StoreState} */
        this._state = {
            currentCharacter: null,
            currentGroup: null,  // 현재 선택된 그룹
            batchModeActive: false,
            isProcessingPersona: false,
            isLobbyOpen: false,
            isLobbyLocked: false,  // UI 잠금 (상호작용 차단)
            searchTerm: '',
            selectedTag: null,
            tagBarExpanded: false,
            onCharacterSelect: null,
            onGroupSelect: null,  // 그룹 선택 콜백
            chatHandlers: {
                onOpen: null,
                onDelete: null
            }
        };
    }
    
    // ============================================
    // Getters
    // ============================================
    
    get currentCharacter() {
        return this._state.currentCharacter;
    }
    
    get batchModeActive() {
        return this._state.batchModeActive;
    }
    
    get isProcessingPersona() {
        return this._state.isProcessingPersona;
    }
    
    get isLobbyOpen() {
        return this._state.isLobbyOpen;
    }
    
    get isLobbyLocked() {
        return this._state.isLobbyLocked;
    }
    
    get searchTerm() {
        return this._state.searchTerm;
    }
    
    get selectedTag() {
        return this._state.selectedTag;
    }
    
    get tagBarExpanded() {
        return this._state.tagBarExpanded;
    }
    
    get onCharacterSelect() {
        return this._state.onCharacterSelect;
    }
    
    get onGroupSelect() {
        return this._state.onGroupSelect;
    }
    
    get currentGroup() {
        return this._state.currentGroup;
    }
    
    get chatHandlers() {
        return this._state.chatHandlers;
    }
    
    // ============================================
    // Setters
    // ============================================
    
    setCurrentCharacter(character) {
        this._state.currentCharacter = character;
    }
    
    toggleBatchMode() {
        this._state.batchModeActive = !this._state.batchModeActive;
        return this._state.batchModeActive;
    }
    
    setBatchMode(active) {
        this._state.batchModeActive = active;
    }
    
    setProcessingPersona(processing) {
        this._state.isProcessingPersona = processing;
    }
    
    setLobbyOpen(open) {
        this._state.isLobbyOpen = open;
    }
    
    setLobbyLocked(locked) {
        this._state.isLobbyLocked = locked;
    }
    
    setSearchTerm(term) {
        this._state.searchTerm = term;
    }
    
    setSelectedTag(tag) {
        this._state.selectedTag = tag;
    }
    
    setTagBarExpanded(expanded) {
        this._state.tagBarExpanded = expanded;
    }
    
    setCharacterSelectHandler(handler) {
        this._state.onCharacterSelect = handler;
    }
    
    setGroupSelectHandler(handler) {
        this._state.onGroupSelect = handler;
    }
    
    setCurrentGroup(group) {
        this._state.currentGroup = group;
    }
    
    setChatHandlers(handlers) {
        this._state.chatHandlers = {
            onOpen: handlers.onOpen || null,
            onDelete: handlers.onDelete || null
        };
    }
    
    // ============================================
    // 상태 초기화
    // ============================================
    
    /**
     * 상태 초기화 (로비 닫을 때)
     * 주의: 핸들러는 초기화하지 않음
     */
    reset() {
        this._state.currentCharacter = null;
        this._state.currentGroup = null;
        this._state.batchModeActive = false;
        this._state.searchTerm = '';
        this._state.selectedTag = null;
        this._state.tagBarExpanded = false;
    }
}

export const store = new Store();
