// ============================================
// 전역 상태 관리 Store
// ============================================

/**
 * @typedef {Object} Character
 * @property {string} index - 캐릭터 인덱스
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
 * @property {Function|null} onCharacterSelect - 캐릭터 선택 콜백
 * @property {ChatHandlers} chatHandlers - 채팅 핸들러
 */

class Store {
    constructor() {
        /** @type {StoreState} */
        this._state = {
            // 캐릭터 관련
            currentCharacter: null,
            
            // 배치 모드
            batchModeActive: false,
            
            // 페르소나 처리 중
            isProcessingPersona: false,
            
            // 로비 상태
            isLobbyOpen: false,
            
            // 검색어
            searchTerm: '',
            
            // 콜백 핸들러
            onCharacterSelect: null,
            chatHandlers: {
                onOpen: null,
                onDelete: null
            }
        };
        
        /** @type {Map<string, Set<Function>>} */
        this._listeners = new Map();
    }
    
    // ============================================
    // Getters
    // ============================================
    
    /**
     * 현재 선택된 캐릭터 반환
     * @returns {Character|null}
     */
    get currentCharacter() {
        return this._state.currentCharacter;
    }
    
    /**
     * 배치 모드 활성화 여부
     * @returns {boolean}
     */
    get batchModeActive() {
        return this._state.batchModeActive;
    }
    
    /**
     * 페르소나 처리 중 여부
     * @returns {boolean}
     */
    get isProcessingPersona() {
        return this._state.isProcessingPersona;
    }
    
    /**
     * 로비 열림 여부
     * @returns {boolean}
     */
    get isLobbyOpen() {
        return this._state.isLobbyOpen;
    }
    
    /**
     * 검색어
     * @returns {string}
     */
    get searchTerm() {
        return this._state.searchTerm;
    }
    
    /**
     * 캐릭터 선택 핸들러
     * @returns {Function|null}
     */
    get onCharacterSelect() {
        return this._state.onCharacterSelect;
    }
    
    /**
     * 채팅 핸들러
     * @returns {ChatHandlers}
     */
    get chatHandlers() {
        return this._state.chatHandlers;
    }
    
    // ============================================
    // Setters (상태 변경 + 리스너 알림)
    // ============================================
    
    /**
     * 현재 캐릭터 설정
     * @param {Character|null} character
     */
    setCurrentCharacter(character) {
        this._state.currentCharacter = character;
        this._notify('currentCharacter', character);
    }
    
    /**
     * 배치 모드 토글
     * @returns {boolean} 새 배치 모드 상태
     */
    toggleBatchMode() {
        this._state.batchModeActive = !this._state.batchModeActive;
        this._notify('batchModeActive', this._state.batchModeActive);
        return this._state.batchModeActive;
    }
    
    /**
     * 배치 모드 직접 설정
     * @param {boolean} active
     */
    setBatchMode(active) {
        this._state.batchModeActive = active;
        this._notify('batchModeActive', active);
    }
    
    /**
     * 페르소나 처리 중 상태 설정
     * @param {boolean} processing
     */
    setProcessingPersona(processing) {
        this._state.isProcessingPersona = processing;
    }
    
    /**
     * 로비 열림 상태 설정
     * @param {boolean} open
     */
    setLobbyOpen(open) {
        this._state.isLobbyOpen = open;
        this._notify('isLobbyOpen', open);
    }
    
    /**
     * 검색어 설정
     * @param {string} term
     */
    setSearchTerm(term) {
        this._state.searchTerm = term;
        this._notify('searchTerm', term);
    }
    
    /**
     * 캐릭터 선택 핸들러 설정
     * @param {Function} handler
     */
    setCharacterSelectHandler(handler) {
        this._state.onCharacterSelect = handler;
    }
    
    /**
     * 채팅 핸들러 설정
     * @param {ChatHandlers} handlers
     */
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
     * 주의: 핸들러는 초기화하지 않음 (init에서 한 번만 설정)
     */
    reset() {
        this._state.currentCharacter = null;
        this._state.batchModeActive = false;
        this._state.searchTerm = '';
        // 핸들러는 유지 (onCharacterSelect, chatHandlers)
        console.log('[Store] State reset, handlers preserved');
    }
    
    // ============================================
    // 리스너 (옵저버 패턴)
    // ============================================
    
    /**
     * 상태 변경 구독
     * @param {string} key - 상태 키
     * @param {Function} callback - 콜백 함수
     * @returns {Function} 구독 해제 함수
     */
    subscribe(key, callback) {
        if (!this._listeners.has(key)) {
            this._listeners.set(key, new Set());
        }
        this._listeners.get(key).add(callback);
        
        // 구독 해제 함수 반환
        return () => {
            this._listeners.get(key)?.delete(callback);
        };
    }
    
    /**
     * 리스너에게 상태 변경 알림
     * @param {string} key
     * @param {*} value
     * @private
     */
    _notify(key, value) {
        this._listeners.get(key)?.forEach(callback => {
            try {
                callback(value);
            } catch (e) {
                console.error('[Store] Listener error:', e);
            }
        });
    }
}

// 싱글톤 인스턴스
export const store = new Store();
