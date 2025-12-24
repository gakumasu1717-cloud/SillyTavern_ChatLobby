// ============================================
// ChatLobby 설정 및 상수
// ============================================

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
    }
};

// 기본 데이터 구조
export const DEFAULT_DATA = {
    folders: [
        { id: 'favorites', name: '⭐ 즐겨찾기', isSystem: true, order: 0 },
        { id: 'uncategorized', name: '📁 미분류', isSystem: true, order: 999 }
    ],
    chatAssignments: {},
    favorites: [],
    sortOption: 'recent',
    filterFolder: 'all',
    collapsedFolders: [],
    charSortOption: 'recent',
    autoFavoriteRules: {
        recentDays: 0,
    }
};
