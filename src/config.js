// ============================================
// ChatLobby 설정 및 상수
// ============================================

/**
 * @typedef {Object} CacheConfig
 * @property {number} chatsDuration - 채팅 목록 캐시 시간 (ms)
 * @property {number} chatCountDuration - 채팅 수 캐시 시간 (ms)
 * @property {number} personasDuration - 페르소나 캐시 시간 (ms)
 * @property {number} charactersDuration - 캐릭터 캐시 시간 (ms)
 */

/**
 * @typedef {Object} UIConfig
 * @property {number} mobileBreakpoint - 모바일 브레이크포인트 (px)
 * @property {number} debounceWait - 디바운스 대기 시간 (ms)
 * @property {number} retryCount - API 재시도 횟수
 * @property {number} retryDelay - API 재시도 지연 시간 (ms)
 */

/**
 * @typedef {Object} TimingConfig
 * @property {number} animationDuration - 애니메이션 지속 시간 (ms)
 * @property {number} menuCloseDelay - 메뉴 닫힌 후 대기 시간 (ms)
 * @property {number} drawerOpenDelay - 드로어 열기 대기 시간 (ms)
 * @property {number} initDelay - 초기화 지연 시간 (ms)
 * @property {number} preloadDelay - 프리로딩 시작 지연 시간 (ms)
 * @property {number} toastDuration - 토스트 표시 시간 (ms)
 */

/**
 * @type {{ extensionName: string, extensionFolderPath: string, storageKey: string, cache: CacheConfig, ui: UIConfig, timing: TimingConfig }}
 */
export const CONFIG = {
    extensionName: 'Chat Lobby',
    extensionFolderPath: 'third-party/SillyTavern-ChatLobby',
    storageKey: 'chatLobby_data',
    
    // 캐시 설정
    cache: {
        chatsDuration: 30000,      // 채팅 목록 캐시 30초
        chatCountDuration: 60000,  // 채팅 수 캐시 1분
        personasDuration: 60000,   // 페르소나 캐시 1분
        charactersDuration: 30000, // 캐릭터 캐시 30초
    },
    
    // UI 설정
    ui: {
        mobileBreakpoint: 768,
        debounceWait: 300,
        retryCount: 3,
        retryDelay: 500,
    },
    
    // 타이밍 상수 (하드코딩된 setTimeout 값 대체)
    timing: {
        animationDuration: 300,     // CSS 애니메이션 시간
        menuCloseDelay: 300,        // 메뉴 닫힌 후 다음 동작까지 대기
        drawerOpenDelay: 500,       // 드로어 열기 후 버튼 클릭까지 대기
        initDelay: 1000,            // 앱 초기화 지연
        preloadDelay: 2000,         // 백그라운드 프리로딩 시작 지연
        toastDuration: 3000,        // 토스트 알림 표시 시간
    }
};
