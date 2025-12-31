(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // src/config.js
  var CONFIG;
  var init_config = __esm({
    "src/config.js"() {
      CONFIG = {
        extensionName: "Chat Lobby",
        extensionFolderPath: "third-party/SillyTavern-ChatLobby",
        storageKey: "chatLobby_data",
        // 캐시 설정
        cache: {
          chatsDuration: 3e4,
          // 채팅 목록 캐시 30초
          chatCountDuration: 6e4,
          // 채팅 수 캐시 1분
          messageCountsDuration: 6e4,
          // 메시지 수 캐시 1분
          personasDuration: 6e4,
          // 페르소나 캐시 1분
          charactersDuration: 3e4
          // 캐릭터 캐시 30초
        },
        // UI 설정
        ui: {
          mobileBreakpoint: 768,
          debounceWait: 300,
          retryCount: 3,
          retryDelay: 500
        },
        // 타이밍 상수 (하드코딩된 setTimeout 값 대체)
        timing: {
          animationDuration: 300,
          // CSS 애니메이션 시간
          menuCloseDelay: 300,
          // 메뉴 닫힌 후 다음 동작까지 대기
          drawerOpenDelay: 500,
          // 드로어 열기 후 버튼 클릭까지 대기
          initDelay: 1e3,
          // 앱 초기화 지연
          preloadDelay: 2e3,
          // 백그라운드 프리로딩 시작 지연
          toastDuration: 3e3
          // 토스트 알림 표시 시간
        }
      };
    }
  });

  // src/utils/textUtils.js
  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
  function truncateText(text, maxLength) {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  }
  var init_textUtils = __esm({
    "src/utils/textUtils.js"() {
    }
  });

  // src/ui/notifications.js
  var notifications_exports = {};
  __export(notifications_exports, {
    showAlert: () => showAlert,
    showConfirm: () => showConfirm,
    showPrompt: () => showPrompt,
    showToast: () => showToast
  });
  function initToastContainer() {
    if (toastContainer) return;
    toastContainer = document.createElement("div");
    toastContainer.id = "chat-lobby-toast-container";
    toastContainer.innerHTML = `
        <style>
            #chat-lobby-toast-container {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 10002;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            }
            .chat-lobby-toast {
                background: var(--SmartThemeBlurTintColor, #2a2a2a);
                color: var(--SmartThemeBodyColor, #fff);
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                gap: 10px;
                pointer-events: auto;
                animation: toastSlideIn 0.3s ease;
                max-width: 350px;
            }
            .chat-lobby-toast.success { border-left: 4px solid #4caf50; }
            .chat-lobby-toast.error { border-left: 4px solid #f44336; }
            .chat-lobby-toast.warning { border-left: 4px solid #ff9800; }
            .chat-lobby-toast.info { border-left: 4px solid #2196f3; }
            .chat-lobby-toast.fade-out {
                animation: toastSlideOut 0.3s ease forwards;
            }
            .chat-lobby-toast-icon {
                font-size: 18px;
            }
            .chat-lobby-toast-message {
                flex: 1;
                font-size: 14px;
            }
            .chat-lobby-toast-close {
                background: none;
                border: none;
                color: inherit;
                cursor: pointer;
                opacity: 0.6;
                font-size: 16px;
            }
            .chat-lobby-toast-close:hover { opacity: 1; }
            @keyframes toastSlideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes toastSlideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        </style>
    `;
    document.body.appendChild(toastContainer);
  }
  function showToast(message, type = "info", duration = CONFIG.timing.toastDuration) {
    initToastContainer();
    const icons = {
      success: "\u2713",
      error: "\u2715",
      warning: "\u26A0",
      info: "\u2139"
    };
    const toast = document.createElement("div");
    toast.className = `chat-lobby-toast ${type}`;
    toast.innerHTML = `
        <span class="chat-lobby-toast-icon">${icons[type]}</span>
        <span class="chat-lobby-toast-message">${escapeHtml(message)}</span>
        <button class="chat-lobby-toast-close">\xD7</button>
    `;
    const closeBtn = toast.querySelector(".chat-lobby-toast-close");
    closeBtn.addEventListener("click", () => removeToast(toast));
    toastContainer.appendChild(toast);
    setTimeout(() => removeToast(toast), duration);
  }
  function removeToast(toast) {
    if (!toast.parentNode) return;
    toast.classList.add("fade-out");
    setTimeout(() => toast.remove(), CONFIG.timing.animationDuration);
  }
  function showAlert(message, title = "\uC54C\uB9BC") {
    const fullMessage = title ? `[${title}]

${message}` : message;
    alert(fullMessage);
    return Promise.resolve();
  }
  function showConfirm(message, title = "\uD655\uC778", _dangerous = false) {
    const fullMessage = title ? `[${title}]

${message}` : message;
    return Promise.resolve(confirm(fullMessage));
  }
  function showPrompt(message, title = "\uC785\uB825", defaultValue = "") {
    const fullMessage = title ? `[${title}]

${message}` : message;
    return Promise.resolve(prompt(fullMessage, defaultValue));
  }
  var toastContainer;
  var init_notifications = __esm({
    "src/ui/notifications.js"() {
      init_config();
      init_textUtils();
      toastContainer = null;
    }
  });

  // src/index.js
  init_config();

  // src/data/cache.js
  init_config();
  var CacheManager = class {
    constructor() {
      this.stores = {
        chats: /* @__PURE__ */ new Map(),
        // 캐릭터별 채팅 목록
        chatCounts: /* @__PURE__ */ new Map(),
        // 캐릭터별 채팅 수
        messageCounts: /* @__PURE__ */ new Map(),
        // 캐릭터별 메시지 수
        personas: null,
        // 페르소나 목록
        characters: null
        // 캐릭터 목록
      };
      this.timestamps = {
        chats: /* @__PURE__ */ new Map(),
        chatCounts: /* @__PURE__ */ new Map(),
        messageCounts: /* @__PURE__ */ new Map(),
        personas: 0,
        characters: 0
      };
      this.preloadStatus = {
        personas: false,
        characters: false
      };
      this.pendingRequests = /* @__PURE__ */ new Map();
    }
    // ============================================
    // 범용 캐시 메서드
    // ============================================
    /**
     * 캐시 유효성 확인
     * @param {CacheType} type - 캐시 타입
     * @param {string|null} [key=null] - 서브 키 (chats, chatCounts용)
     * @returns {boolean}
     */
    isValid(type, key = null) {
      const duration = CONFIG.cache[`${type}Duration`];
      const now = Date.now();
      if (key !== null) {
        const timestamp = this.timestamps[type].get(key);
        return timestamp && now - timestamp < duration;
      } else {
        return this.timestamps[type] && now - this.timestamps[type] < duration;
      }
    }
    /**
     * 캐시 데이터 가져오기
     * @param {CacheType} type - 캐시 타입
     * @param {string|null} [key=null] - 서브 키
     * @returns {*}
     */
    get(type, key = null) {
      if (key !== null) {
        return this.stores[type].get(key);
      }
      return this.stores[type];
    }
    /**
     * 캐시 데이터 저장
     * @param {CacheType} type - 캐시 타입
     * @param {*} data - 저장할 데이터
     * @param {string|null} [key=null] - 서브 키
     */
    set(type, data, key = null) {
      const now = Date.now();
      if (key !== null) {
        this.stores[type].set(key, data);
        this.timestamps[type].set(key, now);
      } else {
        this.stores[type] = data;
        this.timestamps[type] = now;
      }
    }
    /**
     * 캐시 무효화
     * @param {CacheType} [type] - 캐시 타입 (없으면 전체)
     * @param {string|null} [key=null] - 서브 키
     * @param {boolean} [clearPending=false] - pending request도 제거할지
     */
    invalidate(type, key = null, clearPending = false) {
      if (key !== null) {
        this.stores[type].delete(key);
        this.timestamps[type].delete(key);
        if (clearPending) {
          this.pendingRequests.delete(`${type}:${key}`);
        }
      } else if (type) {
        if (this.stores[type] instanceof Map) {
          this.stores[type].clear();
          this.timestamps[type].clear();
        } else {
          this.stores[type] = null;
          this.timestamps[type] = 0;
        }
        if (clearPending) {
          this.pendingRequests.delete(type);
        }
      }
    }
    /**
     * 캐시 무효화
     * @param {string} [type] - 특정 타입만 무효화, 없으면 전체
     */
    invalidateAll(type = null) {
      if (type) {
        this.invalidate(type);
      } else {
        Object.keys(this.stores).forEach((t) => this.invalidate(t));
      }
    }
    // ============================================
    // 중복 요청 방지
    // ============================================
    /**
     * 중복 요청 방지 fetch
     * 같은 키로 진행 중인 요청이 있으면 그 Promise 반환
     * @param {string} key - 요청 식별 키
     * @param {() => Promise<*>} fetchFn - fetch 함수
     * @returns {Promise<*>}
     */
    async getOrFetch(key, fetchFn) {
      if (this.pendingRequests.has(key)) {
        return this.pendingRequests.get(key);
      }
      const promise = fetchFn().finally(() => {
        this.pendingRequests.delete(key);
      });
      this.pendingRequests.set(key, promise);
      return promise;
    }
    // ============================================
    // 프리로딩 (백그라운드에서 미리 로딩)
    // ============================================
    /**
     * 모든 데이터 프리로딩
     * @param {Object} api - API 인스턴스
     * @returns {Promise<void>}
     */
    async preloadAll(api2) {
      const promises = [];
      if (!this.preloadStatus.personas) {
        promises.push(
          this.preloadPersonas(api2).then(() => {
            this.preloadStatus.personas = true;
          })
        );
      }
      if (!this.preloadStatus.characters) {
        promises.push(
          this.preloadCharacters(api2).then(() => {
            this.preloadStatus.characters = true;
          })
        );
      }
      await Promise.all(promises);
    }
    /**
     * 페르소나 프리로딩
     * @param {Object} api
     * @returns {Promise<void>}
     */
    async preloadPersonas(api2) {
      if (this.isValid("personas")) return;
      try {
        const personas = await api2.fetchPersonas();
        this.set("personas", personas);
      } catch (e) {
        console.error("[Cache] Failed to preload personas:", e);
      }
    }
    /**
     * 캐릭터 프리로딩
     * @param {Object} api
     * @returns {Promise<void>}
     */
    async preloadCharacters(api2) {
      if (this.isValid("characters")) return;
      try {
        const characters = await api2.fetchCharacters();
        this.set("characters", characters);
      } catch (e) {
        console.error("[Cache] Failed to preload characters:", e);
      }
    }
    /**
     * 최근 캐릭터들의 채팅 프리로딩
     * @param {Object} api
     * @param {Array} recentCharacters - 최근 캐릭터 배열
     * @returns {Promise<void>}
     */
    async preloadRecentChats(api2, recentCharacters) {
      const promises = recentCharacters.map(async (char) => {
        if (this.isValid("chats", char.avatar)) return;
        try {
          const chats = await api2.fetchChatsForCharacter(char.avatar);
          this.set("chats", chats, char.avatar);
        } catch (e) {
          console.error("[Cache] Failed to preload chats for", char.name, e);
        }
      });
      await Promise.all(promises);
    }
  };
  var cache = new CacheManager();

  // src/data/storage.js
  init_config();
  var DEFAULT_DATA = {
    folders: [
      { id: "favorites", name: "\u2B50 \uC990\uACA8\uCC3E\uAE30", isSystem: true, order: 0 },
      { id: "uncategorized", name: "\u{1F4C1} \uBBF8\uBD84\uB958", isSystem: true, order: 999 }
    ],
    chatAssignments: {},
    favorites: [],
    characterFavorites: [],
    // 캐릭터 즐겨찾기 (avatar 목록)
    sortOption: "recent",
    filterFolder: "all",
    collapsedFolders: [],
    charSortOption: "recent",
    // 기본값: 최근 채팅순
    autoFavoriteRules: {
      recentDays: 0
    }
  };
  var StorageManager = class {
    constructor() {
      this._data = null;
      window.addEventListener("storage", (e) => {
        if (e.key === CONFIG.storageKey) {
          this._data = null;
        }
      });
    }
    /**
     * 데이터 로드 (메모리 캐시 우선)
     * @returns {LobbyData}
     */
    load() {
      if (this._data) return this._data;
      try {
        const saved = localStorage.getItem(CONFIG.storageKey);
        if (saved) {
          const data = JSON.parse(saved);
          this._data = { ...DEFAULT_DATA, ...data };
          if (this._data.filterFolder && this._data.filterFolder !== "all") {
            const folderExists = this._data.folders?.some((f) => f.id === this._data.filterFolder);
            if (!folderExists) {
              this._data.filterFolder = "all";
              this.save(this._data);
            }
          }
          return this._data;
        }
      } catch (e) {
        console.error("[Storage] Failed to load:", e);
      }
      this._data = { ...DEFAULT_DATA };
      return this._data;
    }
    /**
     * 데이터 저장
     * @param {LobbyData} data
     */
    save(data) {
      try {
        this._data = data;
        localStorage.setItem(CONFIG.storageKey, JSON.stringify(data));
      } catch (e) {
        console.error("[Storage] Failed to save:", e);
        if (e.name === "QuotaExceededError") {
          console.warn("[Storage] Quota exceeded, cleaning up old data...");
          this.cleanup(data);
          try {
            localStorage.setItem(CONFIG.storageKey, JSON.stringify(data));
            console.log("[Storage] Saved after cleanup");
            return;
          } catch (e2) {
            console.error("[Storage] Still failed after cleanup:", e2);
          }
        }
        if (typeof window !== "undefined") {
          Promise.resolve().then(() => (init_notifications(), notifications_exports)).then(({ showToast: showToast2 }) => {
            showToast2("\uC800\uC7A5 \uACF5\uAC04\uC774 \uBD80\uC871\uD569\uB2C8\uB2E4. \uC624\uB798\uB41C \uB370\uC774\uD130\uB97C \uC815\uB9AC\uD574\uC8FC\uC138\uC694.", "error");
          }).catch(() => {
          });
        }
      }
    }
    /**
     * 오래된/불필요한 데이터 정리
     * @param {LobbyData} data
     */
    cleanup(data) {
      const assignments = Object.entries(data.chatAssignments || {});
      if (assignments.length > 2e3) {
        const toKeep = assignments.slice(-2e3);
        data.chatAssignments = Object.fromEntries(toKeep);
        console.log(`[Storage] Cleaned chatAssignments: ${assignments.length} \u2192 2000`);
      }
      if (data.favorites && data.favorites.length > 500) {
        data.favorites = data.favorites.slice(-500);
        console.log(`[Storage] Cleaned favorites`);
      }
      if (data.characterFavorites && data.characterFavorites.length > 300) {
        data.characterFavorites = data.characterFavorites.slice(-300);
        console.log(`[Storage] Cleaned characterFavorites`);
      }
      this._data = data;
    }
    /**
     * 데이터 업데이트 (load → update → save 한번에)
     * @param {(data: LobbyData) => *} updater - 업데이트 함수
     * @returns {*} updater의 반환값
     */
    update(updater) {
      const data = this.load();
      const result = updater(data);
      this.save(data);
      return result;
    }
    /**
     * 캐시 초기화 (다시 localStorage에서 읽게)
     */
    invalidate() {
      this._data = null;
    }
    // ============================================
    // 헬퍼 메서드
    // ============================================
    /**
     * 채팅 키 생성
     * @param {string} charAvatar - 캐릭터 아바타
     * @param {string} chatFileName - 채팅 파일명
     * @returns {string}
     */
    getChatKey(charAvatar, chatFileName) {
      return `${charAvatar}_${chatFileName}`;
    }
    // ============================================
    // 폴더 관련
    // ============================================
    /**
     * 폴더 목록 가져오기
     * @returns {Array}
     */
    getFolders() {
      return this.load().folders;
    }
    /**
     * 폴더 추가
     * @param {string} name - 폴더 이름
     * @returns {string} 생성된 폴더 ID
     */
    addFolder(name) {
      return this.update((data) => {
        const id = "folder_" + Date.now();
        const maxOrder = Math.max(
          ...data.folders.filter((f) => !f.isSystem || f.id !== "uncategorized").map((f) => f.order),
          0
        );
        data.folders.push({ id, name, isSystem: false, order: maxOrder + 1 });
        return id;
      });
    }
    /**
     * 폴더 삭제
     * @param {string} folderId - 폴더 ID
     * @returns {boolean} 성공 여부
     */
    deleteFolder(folderId) {
      return this.update((data) => {
        const folder = data.folders.find((f) => f.id === folderId);
        if (!folder || folder.isSystem) return false;
        Object.keys(data.chatAssignments).forEach((key) => {
          if (data.chatAssignments[key] === folderId) {
            data.chatAssignments[key] = "uncategorized";
          }
        });
        data.folders = data.folders.filter((f) => f.id !== folderId);
        return true;
      });
    }
    /**
     * 폴더 이름 변경
     * @param {string} folderId - 폴더 ID
     * @param {string} newName - 새 이름
     * @returns {boolean} 성공 여부
     */
    renameFolder(folderId, newName) {
      return this.update((data) => {
        const folder = data.folders.find((f) => f.id === folderId);
        if (!folder || folder.isSystem) return false;
        folder.name = newName;
        return true;
      });
    }
    // ============================================
    // 채팅-폴더 할당
    // ============================================
    /**
     * 채팅을 폴더에 할당
     * @param {string} charAvatar
     * @param {string} chatFileName
     * @param {string} folderId
     */
    assignChatToFolder(charAvatar, chatFileName, folderId) {
      this.update((data) => {
        const key = this.getChatKey(charAvatar, chatFileName);
        data.chatAssignments[key] = folderId;
      });
    }
    /**
     * 채팅이 속한 폴더 가져오기
     * @param {string} charAvatar
     * @param {string} chatFileName
     * @returns {string} 폴더 ID
     */
    getChatFolder(charAvatar, chatFileName) {
      const data = this.load();
      const key = this.getChatKey(charAvatar, chatFileName);
      return data.chatAssignments[key] || "uncategorized";
    }
    // ============================================
    // 즐겨찾기
    // ============================================
    /**
     * 즐겨찾기 토글
     * @param {string} charAvatar
     * @param {string} chatFileName
     * @returns {boolean} 새 즐겨찾기 상태
     */
    toggleFavorite(charAvatar, chatFileName) {
      return this.update((data) => {
        const key = this.getChatKey(charAvatar, chatFileName);
        const index = data.favorites.indexOf(key);
        if (index > -1) {
          data.favorites.splice(index, 1);
          return false;
        }
        data.favorites.push(key);
        return true;
      });
    }
    /**
     * 즐겨찾기 여부 확인
     * @param {string} charAvatar
     * @param {string} chatFileName
     * @returns {boolean}
     */
    isFavorite(charAvatar, chatFileName) {
      const data = this.load();
      const key = this.getChatKey(charAvatar, chatFileName);
      return data.favorites.includes(key);
    }
    // ============================================
    // 정렬/필터 옵션
    // ============================================
    /**
     * 채팅 정렬 옵션 가져오기
     * @returns {string}
     */
    getSortOption() {
      return this.load().sortOption || "recent";
    }
    /**
     * 채팅 정렬 옵션 설정
     * @param {string} option
     */
    setSortOption(option) {
      this.update((data) => {
        data.sortOption = option;
      });
    }
    /**
     * 캐릭터 정렬 옵션 가져오기
     * @returns {string}
     */
    getCharSortOption() {
      return this.load().charSortOption || "recent";
    }
    /**
     * 캐릭터 정렬 옵션 설정
     * @param {string} option
     */
    setCharSortOption(option) {
      this.update((data) => {
        data.charSortOption = option;
      });
    }
    /**
     * 폴더 필터 가져오기
     * @returns {string}
     */
    getFilterFolder() {
      return this.load().filterFolder || "all";
    }
    /**
     * 폴더 필터 설정
     * @param {string} folderId
     */
    setFilterFolder(folderId) {
      this.update((data) => {
        data.filterFolder = folderId;
      });
    }
    /**
     * 다중 채팅 폴더 이동
     * @param {string[]} chatKeys - 채팅 키 배열
     * @param {string} targetFolderId - 대상 폴더 ID
     */
    moveChatsBatch(chatKeys, targetFolderId) {
      this.update((data) => {
        chatKeys.forEach((key) => {
          data.chatAssignments[key] = targetFolderId;
        });
      });
    }
    // ============================================
    // 캐릭터 즐겨찾기 (로컬 전용)
    // ============================================
    /**
     * 캐릭터가 즐겨찾기인지 확인
     * @param {string} avatar - 캐릭터 아바타
     * @returns {boolean}
     */
    isCharacterFavorite(avatar) {
      const data = this.load();
      return (data.characterFavorites || []).includes(avatar);
    }
    /**
     * 캐릭터 즐겨찾기 토글
     * @param {string} avatar - 캐릭터 아바타
     * @returns {boolean} 새로운 즐겨찾기 상태
     */
    toggleCharacterFavorite(avatar) {
      return this.update((data) => {
        if (!data.characterFavorites) data.characterFavorites = [];
        const index = data.characterFavorites.indexOf(avatar);
        if (index === -1) {
          data.characterFavorites.push(avatar);
          return true;
        } else {
          data.characterFavorites.splice(index, 1);
          return false;
        }
      });
    }
    /**
     * 캐릭터 즐겨찾기 설정
     * @param {string} avatar - 캐릭터 아바타
     * @param {boolean} isFav - 즐겨찾기 여부
     */
    setCharacterFavorite(avatar, isFav) {
      this.update((data) => {
        if (!data.characterFavorites) data.characterFavorites = [];
        const index = data.characterFavorites.indexOf(avatar);
        if (isFav && index === -1) {
          data.characterFavorites.push(avatar);
        } else if (!isFav && index !== -1) {
          data.characterFavorites.splice(index, 1);
        }
      });
    }
    /**
     * 모든 캐릭터 즐겨찾기 목록
     * @returns {string[]}
     */
    getCharacterFavorites() {
      return this.load().characterFavorites || [];
    }
  };
  var storage = new StorageManager();

  // src/data/store.js
  var Store = class {
    constructor() {
      this._state = {
        currentCharacter: null,
        batchModeActive: false,
        isProcessingPersona: false,
        isLobbyOpen: false,
        searchTerm: "",
        selectedTag: null,
        tagBarExpanded: false,
        onCharacterSelect: null,
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
      this._state.batchModeActive = false;
      this._state.searchTerm = "";
      this._state.selectedTag = null;
      this._state.tagBarExpanded = false;
    }
  };
  var store = new Store();

  // src/api/sillyTavern.js
  init_config();

  // src/utils/sortUtils.js
  function koreanSort(a, b) {
    const aName = (a || "").toLowerCase();
    const bName = (b || "").toLowerCase();
    const getType = (str) => {
      const c = str.charAt(0);
      if (/[0-9]/.test(c)) return 0;
      if (/[a-z]/.test(c)) return 1;
      if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(c)) return 2;
      return 3;
    };
    const typeA = getType(aName);
    const typeB = getType(bName);
    if (typeA !== typeB) return typeA - typeB;
    return aName.localeCompare(bName, "ko");
  }
  function sortPersonas(personas) {
    return [...personas].sort((a, b) => koreanSort(a.name, b.name));
  }

  // src/api/sillyTavern.js
  var SillyTavernAPI = class {
    constructor() {
    }
    // ============================================
    // 기본 유틸
    // ============================================
    /**
     * SillyTavern 컨텍스트 가져오기 (캐싱 없음 - 항상 최신)
     * @returns {Object|null}
     */
    getContext() {
      return window.SillyTavern?.getContext?.() || null;
    }
    /**
     * 요청 헤더 가져오기
     * @returns {Object}
     */
    getRequestHeaders() {
      const context = this.getContext();
      if (context?.getRequestHeaders) {
        return context.getRequestHeaders();
      }
      return {
        "Content-Type": "application/json",
        "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || ""
      };
    }
    // ============================================
    // 재시도 로직이 적용된 fetch
    // ============================================
    /**
     * 재시도 로직이 적용된 fetch 요청
     * @param {string} url - 요청 URL
     * @param {RequestInit} options - fetch 옵션
     * @param {number} [retries=CONFIG.ui.retryCount] - 재시도 횟수
     * @returns {Promise<Response>}
     * @throws {Error} 모든 재시도 실패 시
     */
    async fetchWithRetry(url, options, retries = CONFIG.ui.retryCount) {
      let lastError;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const response = await fetch(url, options);
          if (response.status >= 500 && attempt < retries) {
            console.warn(`[API] Server error ${response.status}, retrying... (${attempt + 1}/${retries})`);
            await this.delay(CONFIG.ui.retryDelay * (attempt + 1));
            continue;
          }
          return response;
        } catch (error) {
          lastError = error;
          if (attempt < retries) {
            console.warn(`[API] Request failed, retrying... (${attempt + 1}/${retries})`, error.message);
            await this.delay(CONFIG.ui.retryDelay * (attempt + 1));
            continue;
          }
        }
      }
      throw lastError || new Error("Request failed after retries");
    }
    /**
     * 지연 함수
     * @param {number} ms - 지연 시간 (밀리초)
     * @returns {Promise<void>}
     */
    delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    // ============================================
    // 페르소나 API
    // ============================================
    /**
     * 페르소나 목록 가져오기
     * @returns {Promise<Array>}
     */
    async fetchPersonas() {
      if (cache.isValid("personas")) {
        return cache.get("personas");
      }
      return cache.getOrFetch("personas", async () => {
        try {
          const response = await this.fetchWithRetry("/api/avatars/get", {
            method: "POST",
            headers: this.getRequestHeaders()
          });
          if (!response.ok) {
            console.error("[API] Failed to fetch personas:", response.status);
            return [];
          }
          const avatars = await response.json();
          if (!Array.isArray(avatars)) return [];
          let personaNames = {};
          try {
            const context = this.getContext();
            if (context?.power_user?.personas) {
              personaNames = context.power_user.personas;
            } else {
              const powerUserModule = await import("../../../../power-user.js");
              personaNames = powerUserModule.power_user?.personas || {};
            }
          } catch (e) {
            console.warn("[API] Could not get personas from context or import:", e.message);
          }
          const personas = avatars.map((avatarId) => ({
            key: avatarId,
            name: personaNames[avatarId] || avatarId.replace(/\.(png|jpg|webp)$/i, "")
          }));
          const sortedPersonas = sortPersonas(personas);
          cache.set("personas", sortedPersonas);
          return sortedPersonas;
        } catch (error) {
          console.error("[API] Failed to load personas:", error);
          return [];
        }
      });
    }
    /**
     * 현재 페르소나 가져오기
     * @returns {Promise<string>}
     */
    async getCurrentPersona() {
      try {
        const context = this.getContext();
        if (context?.user_avatar) {
          return context.user_avatar;
        }
        const personasModule = await import("../../../../personas.js");
        return personasModule.user_avatar || "";
      } catch (e) {
        console.warn("[API] Failed to get current persona:", e.message);
        return "";
      }
    }
    /**
     * 페르소나 설정
     * @param {string} personaKey - 페르소나 키
     * @returns {Promise<boolean>}
     */
    async setPersona(personaKey) {
      try {
        const context = this.getContext();
        if (typeof context?.setUserAvatar === "function") {
          await context.setUserAvatar(personaKey);
          return true;
        }
        const personasModule = await import("../../../../personas.js");
        if (typeof personasModule.setUserAvatar === "function") {
          await personasModule.setUserAvatar(personaKey);
          return true;
        }
      } catch (e) {
        console.warn("[API] Failed to set persona:", e.message);
      }
      return false;
    }
    /**
     * 페르소나 삭제
     * @param {string} personaKey - 페르소나 키
     * @returns {Promise<boolean>}
     */
    async deletePersona(personaKey) {
      try {
        const response = await this.fetchWithRetry("/api/avatars/delete", {
          method: "POST",
          headers: this.getRequestHeaders(),
          body: JSON.stringify({ avatar: personaKey })
        });
        if (response.ok) {
          cache.invalidate("personas", null, true);
        }
        return response.ok;
      } catch (error) {
        console.error("[API] Failed to delete persona:", error);
        return false;
      }
    }
    // ============================================
    // 캐릭터 API
    // ============================================
    /**
     * 캐릭터 목록 가져오기
     * context.characters를 직접 사용 (이미 메모리에 있음, 캐싱 불필요)
     * @returns {Array}
     */
    getCharacters() {
      const context = this.getContext();
      return context?.characters || [];
    }
    /**
     * 캐릭터 목록 가져오기 (비동기 호환용 - 기존 코드 호환)
     * @returns {Promise<Array>}
     */
    async fetchCharacters() {
      return this.getCharacters();
    }
    /**
     * 캐릭터 ID로 선택
     * @param {number|string} index - 캐릭터 인덱스
     * @returns {Promise<void>}
     */
    async selectCharacterById(index) {
      const context = this.getContext();
      if (context?.selectCharacterById) {
        await context.selectCharacterById(String(index));
      }
    }
    /**
     * 캐릭터 삭제
     * @param {string} charAvatar - 캐릭터 아바타
     * @returns {Promise<boolean>}
     */
    async deleteCharacter(charAvatar) {
      try {
        const response = await this.fetchWithRetry("/api/characters/delete", {
          method: "POST",
          headers: this.getRequestHeaders(),
          body: JSON.stringify({
            avatar_url: charAvatar,
            delete_chats: true
          })
        });
        if (response.ok) {
          cache.invalidate("characters");
          cache.invalidate("chats", charAvatar);
        }
        return response.ok;
      } catch (error) {
        console.error("[API] Failed to delete character:", error);
        return false;
      }
    }
    // ============================================
    // 채팅 API
    // ============================================
    /**
     * 캐릭터의 채팅 목록 가져오기
     * @param {string} characterAvatar - 캐릭터 아바타
     * @param {boolean} [forceRefresh=false] - 강제 새로고침
     * @returns {Promise<Array>}
     */
    async fetchChatsForCharacter(characterAvatar, forceRefresh = false) {
      if (!characterAvatar) return [];
      if (!forceRefresh && cache.isValid("chats", characterAvatar)) {
        return cache.get("chats", characterAvatar);
      }
      const cacheKey = `chats_${characterAvatar}`;
      return cache.getOrFetch(cacheKey, async () => {
        try {
          const response = await this.fetchWithRetry("/api/characters/chats", {
            method: "POST",
            headers: this.getRequestHeaders(),
            body: JSON.stringify({
              avatar_url: characterAvatar,
              simple: false
            })
          });
          if (!response.ok) {
            console.error("[API] HTTP error:", response.status);
            return [];
          }
          const data = await response.json();
          if (data?.error === true) return [];
          let result;
          if (Array.isArray(data)) {
            result = data;
          } else if (data && typeof data === "object") {
            result = Object.values(data);
          } else {
            result = [];
          }
          cache.set("chats", result, characterAvatar);
          const count = result.length;
          cache.set("chatCounts", count, characterAvatar);
          const messageCount = result.reduce((sum, chat) => {
            return sum + (chat.chat_items || 0);
          }, 0);
          cache.set("messageCounts", messageCount, characterAvatar);
          console.log(`[API] Fetched ${count} chats, ${messageCount} messages for ${characterAvatar}`);
          return result;
        } catch (error) {
          console.error("[API] Failed to load chats:", error);
          return [];
        }
      });
    }
    /**
     * 채팅 삭제
     * @param {string} fileName - 파일명
     * @param {string} charAvatar - 캐릭터 아바타
     * @returns {Promise<boolean>}
     */
    async deleteChat(fileName, charAvatar) {
      try {
        const response = await this.fetchWithRetry("/api/chats/delete", {
          method: "POST",
          headers: this.getRequestHeaders(),
          body: JSON.stringify({
            chatfile: fileName,
            avatar_url: charAvatar
          })
        });
        if (response.ok) {
          cache.invalidate("chats", charAvatar);
        }
        return response.ok;
      } catch (error) {
        console.error("[API] Failed to delete chat:", error);
        return false;
      }
    }
    /**
     * 캐릭터의 채팅 수 가져오기
     * @param {string} characterAvatar - 캐릭터 아바타
     * @returns {Promise<number>}
     */
    async getChatCount(characterAvatar) {
      if (cache.isValid("chatCounts", characterAvatar)) {
        return cache.get("chatCounts", characterAvatar);
      }
      try {
        const chats = await this.fetchChatsForCharacter(characterAvatar);
        const count = Array.isArray(chats) ? chats.length : Object.keys(chats || {}).length;
        cache.set("chatCounts", count, characterAvatar);
        return count;
      } catch (e) {
        console.error("[API] Failed to get chat count:", e);
        return 0;
      }
    }
    /**
     * 캐릭터 편집 화면 열기
     * @param {number|string} characterIndex - 캐릭터 인덱스
     * @returns {Promise<void>}
     */
    async openCharacterEditor(characterIndex) {
      await this.selectCharacterById(characterIndex);
      await this.delay(300);
      const settingsBtn = document.getElementById("option_settings");
      if (settingsBtn) {
        settingsBtn.click();
      } else {
        console.warn("[API] option_settings button not found");
      }
    }
    /**
     * 특정 채팅 파일 열기 (SillyTavern API 사용)
     * @param {string} fileName - 채팅 파일명
     * @param {string} characterAvatar - 캐릭터 아바타
     * @returns {Promise<boolean>}
     */
    async openChatFile(fileName, characterAvatar) {
      const context = this.getContext();
      if (context?.openChat) {
        try {
          await context.openChat(fileName);
          return true;
        } catch (e) {
          console.warn("[API] context.openChat failed:", e);
        }
      }
      try {
        const chatName = fileName.replace(".jsonl", "");
        if (window.SillyTavern?.getContext) {
          const ctx = window.SillyTavern.getContext();
          if (typeof window.characters_api_format !== "undefined") {
            const response = await fetch("/api/chats/get", {
              method: "POST",
              headers: this.getRequestHeaders(),
              body: JSON.stringify({
                ch_name: characterAvatar.replace(/\.(png|jpg|webp)$/i, ""),
                file_name: fileName,
                avatar_url: characterAvatar
              })
            });
            if (response.ok) {
              location.reload();
              return true;
            }
          }
        }
      } catch (e) {
        console.warn("[API] Direct chat load failed:", e);
      }
      return false;
    }
  };
  var api = new SillyTavernAPI();

  // src/ui/templates.js
  function createLobbyHTML() {
    const savedTheme = localStorage.getItem("chatlobby-theme") || "dark";
    const isCollapsed = localStorage.getItem("chatlobby-collapsed") === "true";
    const themeClass = savedTheme === "light" ? "light-mode" : "dark-mode";
    const collapsedClass = isCollapsed ? "collapsed" : "";
    return `
    <div id="chat-lobby-fab" data-action="open-lobby" title="Chat Lobby \uC5F4\uAE30">\u{1F4AC}</div>
    <div id="chat-lobby-overlay" style="display: none;">
        <div id="chat-lobby-container" class="${themeClass}">
            <!-- \uD5E4\uB354 - \uB137\uD50C\uB9AD\uC2A4 \uC2A4\uD0C0\uC77C -->
            <header id="chat-lobby-header">
                <h2>Chat Lobby</h2>
                <div class="header-actions">
                    <button id="chat-lobby-theme-toggle" data-action="toggle-theme" title="\uD14C\uB9C8 \uC804\uD658">${savedTheme === "light" ? "\u{1F319}" : "\u2600\uFE0F"}</button>
                    <button id="chat-lobby-stats" data-action="open-stats" title="Wrapped \uD1B5\uACC4">\u{1F4CA}</button>
                    <button id="chat-lobby-import-char" data-action="import-char" title="\uCE90\uB9AD\uD130 \uAC00\uC838\uC624\uAE30">\u{1F4E5}</button>
                    <button id="chat-lobby-refresh" data-action="refresh" title="\uC0C8\uB85C\uACE0\uCE68">\u{1F504}</button>
                    <button id="chat-lobby-add-persona" data-action="add-persona" title="\uD398\uB974\uC18C\uB098 \uCD94\uAC00">\u{1F464}</button>
                    <button id="chat-lobby-close" data-action="close-lobby">\u2715</button>
                </div>
            </header>
            
            <!-- \uBA54\uC778 \uCF58\uD150\uCE20 -->
            <main id="chat-lobby-main">
                <!-- \uC67C\uCABD \uD328\uB110: \uD398\uB974\uC18C\uB098 + \uCE90\uB9AD\uD130 -->
                <section id="chat-lobby-left" class="${collapsedClass}">
                    <!-- \uD398\uB974\uC18C\uB098 \uBC14 -->
                    <div id="chat-lobby-persona-bar">
                        <div id="chat-lobby-persona-list">
                            <div class="lobby-loading">\uB85C\uB529 \uC911...</div>
                        </div>
                    </div>
                    
                    <!-- \uAC80\uC0C9 + \uC815\uB82C -->
                    <div id="chat-lobby-search">
                        <input type="text" id="chat-lobby-search-input" placeholder="\u{1F50D} \uCE90\uB9AD\uD130 \uAC80\uC0C9...">
                        <select id="chat-lobby-char-sort" title="\uCE90\uB9AD\uD130 \uC815\uB82C">
                            <option value="recent">\u{1F552} \uCD5C\uADFC \uCC44\uD305\uC21C</option>
                            <option value="name">\u{1F524} \uC774\uB984\uC21C</option>
                            <option value="chats">\u{1F4AC} \uBA54\uC2DC\uC9C0 \uC218</option>
                        </select>
                    </div>
                    
                    <!-- \uD0DC\uADF8 \uBC14 -->
                    <nav id="chat-lobby-tag-bar">
                        <div id="chat-lobby-tag-list"></div>
                    </nav>
                    
                    <!-- \uC811\uAE30/\uD3BC\uCE58\uAE30 \uBC84\uD2BC -->
                    <button id="chat-lobby-collapse-btn" data-action="toggle-collapse" title="\uC0C1\uB2E8 \uC601\uC5ED \uC811\uAE30/\uD3BC\uCE58\uAE30">
                        ${isCollapsed ? "\u25BC" : "\u25B2"}
                    </button>
                    
                    <!-- \uCE90\uB9AD\uD130 \uADF8\uB9AC\uB4DC -->
                    <div id="chat-lobby-characters">
                        <div class="lobby-loading">\uCE90\uB9AD\uD130 \uB85C\uB529 \uC911...</div>
                    </div>
                </section>
                
                <!-- \uC624\uB978\uCABD \uD328\uB110: \uCC44\uD305 \uBAA9\uB85D (\uC2AC\uB77C\uC774\uB4DC \uC778) -->
                <aside id="chat-lobby-chats">
                    <header id="chat-lobby-chats-header">
                        <button id="chat-lobby-chats-back" data-action="close-chat-panel" title="\uB4A4\uB85C">\u2190</button>
                        <img src="" alt="avatar" id="chat-panel-avatar" data-action="go-to-character" title="\uCE90\uB9AD\uD130 \uC124\uC815" style="display:none;">
                        <div class="char-info">
                            <div class="char-name" id="chat-panel-name">\uCE90\uB9AD\uD130\uB97C \uC120\uD0DD\uD558\uC138\uC694</div>
                            <div class="chat-count" id="chat-panel-count"></div>
                        </div>
                        <button id="chat-lobby-delete-char" data-action="delete-char" title="\uCE90\uB9AD\uD130 \uC0AD\uC81C" style="display:none;">\u{1F5D1}\uFE0F</button>
                        <button id="chat-lobby-new-chat" data-action="new-chat" style="display:none;">+ \uC0C8 \uCC44\uD305</button>
                    </header>
                    
                    <!-- \uD544\uD130 \uC139\uC158 -->
                    <section id="chat-lobby-filters" style="display:none;">
                        <div id="chat-lobby-char-tags"></div>
                        <div class="filters-row">
                            <div class="filter-group">
                                <select id="chat-lobby-chat-sort">
                                    <option value="recent">\u{1F550} \uCD5C\uC2E0\uC21C</option>
                                    <option value="name">\u{1F524} \uC774\uB984\uC21C</option>
                                    <option value="messages">\u{1F4AC} \uBA54\uC2DC\uC9C0\uC218</option>
                                </select>
                                <select id="chat-lobby-folder-filter">
                                    <option value="all">\u{1F4C1} \uC804\uCCB4</option>
                                    <option value="favorites">\u2B50 \uC990\uACA8\uCC3E\uAE30</option>
                                </select>
                                <button id="chat-lobby-batch-mode" data-action="toggle-batch" title="\uB2E4\uC911 \uC120\uD0DD">\u2611\uFE0F</button>
                                <button id="chat-lobby-folder-manage" data-action="open-folder-modal" title="\uD3F4\uB354 \uAD00\uB9AC">\u{1F4C1}</button>
                            </div>
                        </div>
                    </section>
                    
                    <!-- \uBC30\uCE58 \uBAA8\uB4DC \uD234\uBC14 -->
                    <div id="chat-lobby-batch-toolbar" style="display:none;">
                        <span id="batch-selected-count">0\uAC1C \uC120\uD0DD</span>
                        <span id="batch-help-text">\u{1F4C1} \uD074\uB9AD\uC73C\uB85C \uC774\uB3D9</span>
                        <button id="batch-cancel-btn" data-action="batch-cancel" title="\uBC30\uCE58 \uBAA8\uB4DC \uC885\uB8CC">\u2715</button>
                    </div>
                    
                    <!-- \uCC44\uD305 \uBAA9\uB85D -->
                    <div id="chat-lobby-chats-list">
                        <div class="lobby-empty-state">
                            <i>\u{1F4AC}</i>
                            <div>\uCE90\uB9AD\uD130\uB97C \uC120\uD0DD\uD558\uC138\uC694</div>
                        </div>
                    </div>
                </aside>
            </main>
        </div>
    </div>
    
    <!-- \uD3F4\uB354 \uAD00\uB9AC \uBAA8\uB2EC -->
    <div id="chat-lobby-folder-modal" style="display:none;">
        <div class="folder-modal-content">
            <div class="folder-modal-header">
                <h3>\u{1F4C1} \uD3F4\uB354 \uAD00\uB9AC</h3>
                <button id="folder-modal-close" data-action="close-folder-modal">\u2715</button>
            </div>
            <div class="folder-modal-body">
                <div class="folder-add-row">
                    <input type="text" id="new-folder-name" placeholder="\uC0C8 \uD3F4\uB354 \uC774\uB984...">
                    <button id="add-folder-btn" data-action="add-folder">\uCD94\uAC00</button>
                </div>
                <div id="folder-list"></div>
            </div>
        </div>
    </div>
    `;
  }
  function getBatchFoldersHTML() {
    const data = storage.load();
    const sorted = [...data.folders].sort((a, b) => a.order - b.order);
    let html = '<option value="">\uC774\uB3D9\uD560 \uD3F4\uB354...</option>';
    sorted.forEach((f) => {
      if (f.id !== "favorites") {
        html += `<option value="${f.id}">${f.name}</option>`;
      }
    });
    return html;
  }

  // src/ui/personaBar.js
  init_textUtils();

  // src/utils/eventHelpers.js
  init_config();
  var isMobile = () => window.innerWidth <= CONFIG.ui.mobileBreakpoint || "ontouchstart" in window;
  function debounce(func, wait = CONFIG.ui.debounceWait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  function createTouchClickHandler(element, handler, options = {}) {
    const {
      preventDefault = true,
      stopPropagation = true,
      scrollThreshold = 10,
      debugName = "unknown"
    } = options;
    let touchStartX = 0;
    let touchStartY = 0;
    let isScrolling = false;
    let touchHandled = false;
    let lastHandleTime = 0;
    const wrappedHandler = (e, source) => {
      const now = Date.now();
      if (now - lastHandleTime < 300) {
        return;
      }
      if (isScrolling) {
        return;
      }
      lastHandleTime = now;
      if (preventDefault) e.preventDefault();
      if (stopPropagation) e.stopPropagation();
      try {
        handler(e);
      } catch (error) {
        console.error(`[EventHelper] ${debugName}: Handler error:`, error);
      }
    };
    element.addEventListener("touchstart", (e) => {
      touchHandled = false;
      isScrolling = false;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    element.addEventListener("touchmove", (e) => {
      const deltaX = Math.abs(e.touches[0].clientX - touchStartX);
      const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
      if (deltaX > scrollThreshold || deltaY > scrollThreshold) {
        isScrolling = true;
      }
    }, { passive: true });
    element.addEventListener("touchend", (e) => {
      if (!isScrolling) {
        touchHandled = true;
        wrappedHandler(e, "touchend");
      }
      isScrolling = false;
    });
    element.addEventListener("click", (e) => {
      if (!touchHandled) {
        wrappedHandler(e, "click");
      } else {
      }
      touchHandled = false;
    });
  }

  // src/utils/drawerHelper.js
  function openDrawerSafely(drawerId) {
    const drawer = document.getElementById(drawerId);
    if (!drawer) {
      console.warn(`[ChatLobby] Drawer not found: ${drawerId}`);
      return false;
    }
    const drawerContent = drawer.querySelector(".drawer-content");
    const drawerIcon = drawer.querySelector(".drawer-icon");
    if (!drawerContent) {
      console.warn(`[ChatLobby] Drawer content not found in: ${drawerId}`);
      return false;
    }
    if (drawerContent.classList.contains("openDrawer")) {
      return true;
    }
    document.querySelectorAll(".drawer-content.openDrawer").forEach((el) => {
      if (el !== drawerContent) {
        el.classList.remove("openDrawer");
        el.classList.add("closedDrawer");
      }
    });
    document.querySelectorAll(".drawer-icon.openIcon").forEach((el) => {
      if (el !== drawerIcon) {
        el.classList.remove("openIcon");
        el.classList.add("closedIcon");
      }
    });
    drawerContent.classList.remove("closedDrawer");
    drawerContent.classList.add("openDrawer");
    if (drawerIcon) {
      drawerIcon.classList.remove("closedIcon");
      drawerIcon.classList.add("openIcon");
    }
    drawer.setAttribute("data-st-open", "true");
    return true;
  }

  // src/ui/personaBar.js
  init_notifications();
  init_config();
  async function renderPersonaBar() {
    const container = document.getElementById("chat-lobby-persona-list");
    if (!container) return;
    const cachedPersonas = cache.get("personas");
    if (cachedPersonas && cachedPersonas.length > 0) {
      await renderPersonaList(container, cachedPersonas);
    } else {
      container.innerHTML = '<div class="lobby-loading">\uB85C\uB529 \uC911...</div>';
    }
    try {
      const personas = await api.fetchPersonas();
      if (personas.length === 0) {
        container.innerHTML = '<div class="persona-empty">\uD398\uB974\uC18C\uB098 \uC5C6\uC74C</div>';
        return;
      }
      await renderPersonaList(container, personas);
    } catch (error) {
      console.error("[PersonaBar] Failed to load personas:", error);
      showToast("\uD398\uB974\uC18C\uB098 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "error");
      container.innerHTML = '<div class="persona-empty">\uB85C\uB529 \uC2E4\uD328</div>';
    }
  }
  async function renderPersonaList(container, personas) {
    let currentPersona = "";
    try {
      currentPersona = await api.getCurrentPersona();
    } catch (e) {
      console.warn("[PersonaBar] Could not get current persona");
    }
    let html = "";
    personas.forEach((persona) => {
      const isSelected = persona.key === currentPersona ? "selected" : "";
      const avatarUrl = `/User Avatars/${encodeURIComponent(persona.key)}`;
      html += `
        <div class="persona-item ${isSelected}" data-persona="${escapeHtml(persona.key)}" title="${escapeHtml(persona.name)}">
            <img class="persona-avatar" src="${avatarUrl}" alt="" onerror="this.outerHTML='<div class=persona-avatar>\u{1F464}</div>'">
            <span class="persona-name">${escapeHtml(persona.name)}</span>
            <button class="persona-delete-btn" data-persona="${escapeHtml(persona.key)}" title="\uD398\uB974\uC18C\uB098 \uC0AD\uC81C">\xD7</button>
        </div>`;
    });
    container.innerHTML = html;
    bindPersonaEvents(container);
  }
  function bindPersonaEvents(container) {
    container.querySelectorAll(".persona-item").forEach((item, index) => {
      const deleteBtn = item.querySelector(".persona-delete-btn");
      const personaKey = item.dataset.persona;
      const handleItemClick = async (e) => {
        if (e.target.closest(".persona-delete-btn")) return;
        if (store.isProcessingPersona) return;
        if (item.classList.contains("selected")) {
          openPersonaManagement();
        } else {
          await selectPersona(container, item);
        }
      };
      createTouchClickHandler(item, handleItemClick, {
        preventDefault: true,
        stopPropagation: false,
        scrollThreshold: 10,
        debugName: `persona-${index}-${personaKey}`
      });
      if (deleteBtn) {
        createTouchClickHandler(deleteBtn, async (e) => {
          const personaName = item.title || personaKey;
          await deletePersona(personaKey, personaName);
        }, {
          preventDefault: true,
          stopPropagation: true,
          debugName: `persona-del-${index}`
        });
      }
    });
  }
  async function selectPersona(container, item) {
    if (store.isProcessingPersona) return;
    store.setProcessingPersona(true);
    try {
      container.querySelectorAll(".persona-item").forEach((el) => el.classList.remove("selected"));
      item.classList.add("selected");
      const success = await api.setPersona(item.dataset.persona);
      if (success) {
        showToast(`\uD398\uB974\uC18C\uB098\uAC00 \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, "success");
      }
    } catch (error) {
      console.error("[PersonaBar] Failed to select persona:", error);
      showToast("\uD398\uB974\uC18C\uB098 \uBCC0\uACBD\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", "error");
      item.classList.remove("selected");
    } finally {
      store.setProcessingPersona(false);
    }
  }
  async function deletePersona(personaKey, personaName) {
    const confirmed = await showConfirm(
      `"${personaName}" \uD398\uB974\uC18C\uB098\uB97C \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?`,
      "\uD398\uB974\uC18C\uB098 \uC0AD\uC81C",
      true
    );
    if (!confirmed) return;
    try {
      const success = await api.deletePersona(personaKey);
      if (success) {
        showToast(`"${personaName}" \uD398\uB974\uC18C\uB098\uAC00 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, "success");
        cache.invalidate("personas", null, true);
        await renderPersonaBar();
      } else {
        showToast("\uD398\uB974\uC18C\uB098 \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", "error");
      }
    } catch (error) {
      console.error("[PersonaBar] Failed to delete persona:", error);
      showToast("\uD398\uB974\uC18C\uB098 \uC0AD\uC81C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.", "error");
    }
  }
  function openPersonaManagement() {
    const container = document.getElementById("chat-lobby-container");
    const fab = document.getElementById("chat-lobby-fab");
    const overlay = document.getElementById("chat-lobby-overlay");
    if (container) container.style.display = "none";
    if (overlay) overlay.style.display = "none";
    if (fab) fab.style.display = "flex";
    store.setLobbyOpen(false);
    setTimeout(() => {
      if (!openDrawerSafely("persona-management-button")) {
        showToast("\uD398\uB974\uC18C\uB098 \uAD00\uB9AC\uB97C \uC5F4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", "warning");
      }
    }, CONFIG.timing.menuCloseDelay);
  }

  // src/ui/characterGrid.js
  init_textUtils();
  init_notifications();

  // src/ui/chatList.js
  init_textUtils();

  // src/utils/dateUtils.js
  function parseDateFromFilename(filename) {
    const m = filename.match(/(\d{4})-(\d{2})-(\d{2})@(\d{2})h(\d{2})m(\d{2})s/);
    if (m) {
      return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
    }
    const m2 = filename.match(/(\d{4})-(\d{2})-(\d{2})\s*@\s*(\d{2})h\s*(\d{2})m\s*(\d{2})s/);
    if (m2) {
      return new Date(+m2[1], +m2[2] - 1, +m2[3], +m2[4], +m2[5], +m2[6]).getTime();
    }
    const m3 = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m3) {
      return new Date(+m3[1], +m3[2] - 1, +m3[3]).getTime();
    }
    return 0;
  }
  function getTimestamp(chat) {
    if (chat.last_mes) {
      const ts2 = typeof chat.last_mes === "number" ? chat.last_mes : new Date(chat.last_mes).getTime();
      if (ts2 > 0 && !isNaN(ts2)) return ts2;
    }
    if (chat.file_date || chat.date) {
      const dateVal = chat.file_date || chat.date;
      const ts2 = typeof dateVal === "number" ? dateVal : new Date(dateVal).getTime();
      if (ts2 > 0 && !isNaN(ts2)) return ts2;
    }
    const fileName = chat.file_name || chat.fileName || "";
    const ts = parseDateFromFilename(fileName);
    if (ts > 0) return ts;
    return 0;
  }

  // src/ui/chatList.js
  init_notifications();
  init_config();
  var tooltipElement = null;
  var tooltipTimeout = null;
  var currentTooltipTarget = null;
  function ensureTooltipElement() {
    if (tooltipElement) return tooltipElement;
    tooltipElement = document.createElement("div");
    tooltipElement.id = "chat-preview-tooltip";
    tooltipElement.className = "chat-preview-tooltip";
    tooltipElement.style.cssText = `
        position: fixed;
        display: none;
        max-width: 400px;
        max-height: 250px;
        padding: 12px 16px;
        background: rgba(20, 20, 30, 0.95);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 10px;
        color: #e0e0e0;
        font-size: 13px;
        line-height: 1.6;
        z-index: 100000;
        overflow: hidden;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        pointer-events: none;
        white-space: pre-wrap;
        word-break: break-word;
        backdrop-filter: blur(10px);
    `;
    document.body.appendChild(tooltipElement);
    return tooltipElement;
  }
  function showTooltip(content, e) {
    const tooltip = ensureTooltipElement();
    tooltip.textContent = content;
    tooltip.style.display = "block";
    tooltip.style.left = `${e.clientX + 15}px`;
    tooltip.style.top = `${e.clientY + 15}px`;
  }
  function hideTooltip() {
    if (tooltipTimeout) {
      clearTimeout(tooltipTimeout);
      tooltipTimeout = null;
    }
    if (tooltipElement) {
      tooltipElement.style.display = "none";
    }
    currentTooltipTarget = null;
  }
  function bindTooltipEvents(container) {
    if (isMobile()) {
      return;
    }
    container.querySelectorAll(".lobby-chat-item").forEach((item, idx) => {
      const fullPreview = item.dataset.fullPreview || "";
      if (!fullPreview) {
        return;
      }
      item.addEventListener("mouseenter", (e) => {
        if (currentTooltipTarget === item) return;
        hideTooltip();
        currentTooltipTarget = item;
        tooltipTimeout = setTimeout(() => {
          if (currentTooltipTarget === item && fullPreview) {
            showTooltip(fullPreview, e);
          }
        }, 300);
      });
      item.addEventListener("mousemove", (e) => {
        if (tooltipElement && tooltipElement.style.display === "block" && currentTooltipTarget === item) {
          tooltipElement.style.left = `${e.clientX + 15}px`;
          tooltipElement.style.top = `${e.clientY + 15}px`;
        }
      });
      item.addEventListener("mouseleave", () => {
        if (currentTooltipTarget === item) {
          hideTooltip();
        }
      });
    });
  }
  function cleanupTooltip() {
    hideTooltip();
    if (tooltipElement && tooltipElement.parentNode) {
      tooltipElement.parentNode.removeChild(tooltipElement);
    }
    tooltipElement = null;
    currentTooltipTarget = null;
  }
  function setChatHandlers(handlers) {
    store.setChatHandlers(handlers);
  }
  async function renderChatList(character) {
    console.log("[RENDER] renderChatList called", { character: character?.name, stack: new Error().stack?.split("\n").slice(1, 4).join(" <- ") });
    if (!character || !character.avatar) {
      console.error("[ChatList] Invalid character data:", character);
      return;
    }
    const chatsPanel = document.getElementById("chat-lobby-chats");
    const chatsList = document.getElementById("chat-lobby-chats-list");
    if (store.currentCharacter?.avatar === character.avatar && chatsPanel?.classList.contains("visible")) {
      console.log("[ChatList] Same character panel already open, skipping render");
      return;
    }
    store.setCurrentCharacter(character);
    if (!chatsPanel || !chatsList) {
      console.error("[ChatList] Chat panel elements not found");
      return;
    }
    chatsPanel.classList.add("visible");
    updateChatHeader(character);
    showFolderBar(true);
    const cachedChats = cache.get("chats", character.avatar);
    if (cachedChats && cachedChats.length > 0 && cache.isValid("chats", character.avatar)) {
      renderChats(chatsList, cachedChats, character.avatar);
      return;
    }
    chatsList.innerHTML = '<div class="lobby-loading">\uCC44\uD305 \uB85C\uB529 \uC911...</div>';
    try {
      const chats = await api.fetchChatsForCharacter(character.avatar);
      if (!chats || chats.length === 0) {
        updateChatCount(0);
        chatsList.innerHTML = `
                <div class="lobby-empty-state">
                    <i>\u{1F4AC}</i>
                    <div>\uCC44\uD305 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4</div>
                    <div style="font-size: 0.9em; margin-top: 5px;">\uC0C8 \uCC44\uD305\uC744 \uC2DC\uC791\uD574\uBCF4\uC138\uC694!</div>
                </div>
            `;
        return;
      }
      renderChats(chatsList, chats, character.avatar);
    } catch (error) {
      console.error("[ChatList] Failed to load chats:", error);
      showToast("\uCC44\uD305 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "error");
      chatsList.innerHTML = `
            <div class="lobby-empty-state">
                <i>\u26A0\uFE0F</i>
                <div>\uCC44\uD305 \uBAA9\uB85D \uB85C\uB529 \uC2E4\uD328</div>
                <button onclick="window.chatLobbyRefresh()" style="margin-top:10px;padding:8px 16px;cursor:pointer;">\uB2E4\uC2DC \uC2DC\uB3C4</button>
            </div>
        `;
    }
  }
  function renderChats(container, rawChats, charAvatar) {
    let chatArray = normalizeChats(rawChats);
    chatArray = filterValidChats(chatArray);
    const totalChatCount = chatArray.length;
    updateHasChats(totalChatCount);
    if (chatArray.length === 0) {
      updateChatCount(0);
      container.innerHTML = `
            <div class="lobby-empty-state">
                <i>\u{1F4AC}</i>
                <div>\uCC44\uD305 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4</div>
            </div>
        `;
      return;
    }
    const filterFolder = storage.getFilterFolder();
    if (filterFolder !== "all") {
      chatArray = filterByFolder(chatArray, charAvatar, filterFolder);
    }
    const sortOption = storage.getSortOption();
    chatArray = sortChats(chatArray, charAvatar, sortOption);
    updateChatCount(chatArray.length);
    if (chatArray.length === 0) {
      container.innerHTML = `
            <div class="lobby-empty-state">
                <i>\u{1F4C1}</i>
                <div>\uC774 \uD3F4\uB354\uC5D0\uB294 \uCC44\uD305\uC774 \uC5C6\uC2B5\uB2C8\uB2E4</div>
            </div>
        `;
      return;
    }
    container.innerHTML = chatArray.map(
      (chat, idx) => renderChatItem(chat, charAvatar, idx)
    ).join("");
    bindChatEvents(container, charAvatar);
    bindTooltipEvents(container);
    syncDropdowns(filterFolder, sortOption);
  }
  function normalizeChats(chats) {
    if (Array.isArray(chats)) return chats;
    if (typeof chats === "object") {
      return Object.entries(chats).map(([key, value]) => {
        if (typeof value === "object") {
          return { ...value, file_name: value.file_name || key };
        }
        return { file_name: key, ...value };
      });
    }
    return [];
  }
  function filterValidChats(chats) {
    return chats.filter((chat) => {
      const fileName = chat?.file_name || chat?.fileName || "";
      const hasJsonl = fileName.includes(".jsonl");
      const hasDatePattern = /\d{4}-\d{2}-\d{2}/.test(fileName);
      return fileName && (hasJsonl || hasDatePattern) && !fileName.startsWith("chat_") && fileName.toLowerCase() !== "error";
    });
  }
  function filterByFolder(chats, charAvatar, filterFolder) {
    const data = storage.load();
    const result = chats.filter((chat) => {
      const fn = chat.file_name || chat.fileName || "";
      const key = storage.getChatKey(charAvatar, fn);
      if (filterFolder === "favorites") {
        const isFav = data.favorites.includes(key);
        return isFav;
      }
      const assigned = data.chatAssignments[key] || "uncategorized";
      const match = assigned === filterFolder;
      return match;
    });
    return result;
  }
  function sortChats(chats, charAvatar, sortOption) {
    const data = storage.load();
    return [...chats].sort((a, b) => {
      const fnA = a.file_name || "";
      const fnB = b.file_name || "";
      const keyA = storage.getChatKey(charAvatar, fnA);
      const keyB = storage.getChatKey(charAvatar, fnB);
      const favA = data.favorites.includes(keyA) ? 0 : 1;
      const favB = data.favorites.includes(keyB) ? 0 : 1;
      if (favA !== favB) return favA - favB;
      if (sortOption === "name") {
        return fnA.localeCompare(fnB, "ko");
      }
      if (sortOption === "messages") {
        const msgA = a.message_count || a.mes_count || a.chat_items || 0;
        const msgB = b.message_count || b.mes_count || b.chat_items || 0;
        return msgB - msgA;
      }
      return getTimestamp(b) - getTimestamp(a);
    });
  }
  function renderChatItem(chat, charAvatar, index) {
    const fileName = chat.file_name || chat.fileName || chat.name || `chat_${index}`;
    const displayName = fileName.replace(".jsonl", "");
    const preview = chat.preview || chat.mes || chat.last_message || "\uCC44\uD305 \uAE30\uB85D";
    const messageCount = chat.chat_items || chat.message_count || chat.mes_count || 0;
    const isFav = storage.isFavorite(charAvatar, fileName);
    const folderId = storage.getChatFolder(charAvatar, fileName);
    const data = storage.load();
    const folder = data.folders.find((f) => f.id === folderId);
    const folderName = folder?.name || "";
    const tooltipPreview = truncateText(preview, 500);
    const safeAvatar = escapeHtml(charAvatar || "");
    const safeFileName = escapeHtml(fileName || "");
    const safeFullPreview = escapeHtml(tooltipPreview);
    return `
    <div class="lobby-chat-item ${isFav ? "is-favorite" : ""}" 
         data-file-name="${safeFileName}" 
         data-char-avatar="${safeAvatar}" 
         data-chat-index="${index}" 
         data-folder-id="${folderId}"
         data-full-preview="${safeFullPreview}">
        <div class="chat-checkbox" style="display:none;">
            <input type="checkbox" class="chat-select-cb">
        </div>
        <button class="chat-fav-btn" title="\uC990\uACA8\uCC3E\uAE30">${isFav ? "\u2B50" : "\u2606"}</button>
        <div class="chat-content">
            <div class="chat-name">${escapeHtml(displayName)}</div>
            <div class="chat-preview">${escapeHtml(truncateText(preview, 80))}</div>
            <div class="chat-meta">
                ${messageCount > 0 ? `<span>\u{1F4AC} ${messageCount}\uAC1C</span>` : ""}
                ${folderName && folderId !== "uncategorized" ? `<span class="chat-folder-tag">${escapeHtml(folderName)}</span>` : ""}
            </div>
        </div>
        <button class="chat-delete-btn" title="\uCC44\uD305 \uC0AD\uC81C">\u{1F5D1}\uFE0F</button>
    </div>
    `;
  }
  function bindChatEvents(container, charAvatar) {
    container.querySelectorAll(".lobby-chat-item").forEach((item, index) => {
      const chatContent = item.querySelector(".chat-content");
      const favBtn = item.querySelector(".chat-fav-btn");
      const delBtn = item.querySelector(".chat-delete-btn");
      const fileName = item.dataset.fileName;
      createTouchClickHandler(chatContent, () => {
        if (store.batchModeActive) {
          const cb = item.querySelector(".chat-select-cb");
          if (cb) {
            cb.checked = !cb.checked;
            updateBatchCount();
          }
          return;
        }
        const handlers = store.chatHandlers;
        if (handlers.onOpen) {
          const charIndex = store.currentCharacter?.index || item.dataset.charIndex || null;
          const chatInfo = {
            fileName: item.dataset.fileName,
            charAvatar: item.dataset.charAvatar,
            charIndex
          };
          handlers.onOpen(chatInfo);
        } else {
          console.error("[ChatList] onOpen handler not available!");
        }
      }, { preventDefault: true, stopPropagation: true, debugName: `chat-${index}` });
      createTouchClickHandler(favBtn, () => {
        const fn = item.dataset.fileName;
        const isNowFav = storage.toggleFavorite(charAvatar, fn);
        favBtn.textContent = isNowFav ? "\u2B50" : "\u2606";
        item.classList.toggle("is-favorite", isNowFav);
      }, { debugName: `fav-${index}` });
      createTouchClickHandler(delBtn, () => {
        const handlers = store.chatHandlers;
        if (handlers?.onDelete) {
          handlers.onDelete({
            fileName: item.dataset.fileName,
            charAvatar: item.dataset.charAvatar,
            element: item
          });
        }
      }, { debugName: `del-${index}` });
    });
  }
  function updateChatHeader(character) {
    const avatarImg = document.getElementById("chat-panel-avatar");
    const nameEl = document.getElementById("chat-panel-name");
    const deleteBtn = document.getElementById("chat-lobby-delete-char");
    const newChatBtn = document.getElementById("chat-lobby-new-chat");
    if (avatarImg) {
      avatarImg.style.display = "block";
      avatarImg.src = character.avatarSrc;
    }
    if (nameEl) nameEl.textContent = character.name;
    if (deleteBtn) {
      deleteBtn.style.display = "block";
      deleteBtn.dataset.charAvatar = character.avatar;
      deleteBtn.dataset.charName = character.name;
    }
    if (newChatBtn) {
      newChatBtn.style.display = "block";
      newChatBtn.dataset.charIndex = character.index;
      newChatBtn.dataset.charAvatar = character.avatar;
    }
    document.getElementById("chat-panel-count").textContent = "\uCC44\uD305 \uB85C\uB529 \uC911...";
    renderCharacterTags(character.avatar);
  }
  function getCharacterTags(charAvatar) {
    const context = api.getContext();
    if (!context?.tagMap || !context?.tags || !charAvatar) {
      return [];
    }
    const tagIds = context.tagMap[charAvatar] || [];
    return tagIds.map((tagId) => {
      const tag = context.tags.find((t) => t.id === tagId);
      return tag?.name || null;
    }).filter(Boolean);
  }
  function renderCharacterTags(charAvatar) {
    const filtersSection = document.getElementById("chat-lobby-filters");
    const container = document.getElementById("chat-lobby-char-tags");
    if (!container || !filtersSection) return;
    const tags = getCharacterTags(charAvatar);
    filtersSection.style.display = "block";
    if (tags.length === 0) {
      container.style.display = "none";
      container.innerHTML = "";
    } else {
      container.style.display = "flex";
      container.innerHTML = tags.map(
        (tag) => `<span class="lobby-char-tag">#${escapeHtml(tag)}</span>`
      ).join("");
    }
  }
  function updateChatCount(count) {
    const el = document.getElementById("chat-panel-count");
    if (el) el.textContent = count > 0 ? `${count}\uAC1C \uCC44\uD305` : "\uCC44\uD305 \uC5C6\uC74C";
  }
  function updateHasChats(totalCount) {
    const newChatBtn = document.getElementById("chat-lobby-new-chat");
    if (newChatBtn) newChatBtn.dataset.hasChats = totalCount > 0 ? "true" : "false";
  }
  function showFolderBar(visible) {
    const filtersSection = document.getElementById("chat-lobby-filters");
    if (filtersSection) filtersSection.style.display = visible ? "block" : "none";
  }
  function syncDropdowns(filterValue, sortValue) {
    const filterSelect = document.getElementById("chat-lobby-folder-filter");
    const sortSelect = document.getElementById("chat-lobby-chat-sort");
    if (filterSelect) filterSelect.value = filterValue;
    if (sortSelect) sortSelect.value = sortValue;
  }
  function handleFilterChange(filterValue) {
    storage.setFilterFolder(filterValue);
    refreshCurrentChatList();
  }
  function handleSortChange(sortValue) {
    storage.setSortOption(sortValue);
    refreshCurrentChatList();
  }
  function refreshCurrentChatList() {
    const character = store.currentCharacter;
    if (!character) return;
    const chatsList = document.getElementById("chat-lobby-chats-list");
    if (!chatsList) return;
    const cachedChats = cache.get("chats", character.avatar);
    if (cachedChats && cachedChats.length > 0) {
      renderChats(chatsList, cachedChats, character.avatar);
    }
  }
  function toggleBatchMode() {
    const isActive = store.toggleBatchMode();
    const chatsList = document.getElementById("chat-lobby-chats-list");
    const toolbar = document.getElementById("chat-lobby-batch-toolbar");
    const batchBtn = document.getElementById("chat-lobby-batch-mode");
    if (isActive) {
      chatsList?.classList.add("batch-mode");
      toolbar?.classList.add("visible");
      batchBtn?.classList.add("active");
      chatsList?.querySelectorAll(".chat-checkbox").forEach((cb) => cb.style.display = "block");
    } else {
      chatsList?.classList.remove("batch-mode");
      toolbar?.classList.remove("visible");
      batchBtn?.classList.remove("active");
      chatsList?.querySelectorAll(".chat-checkbox").forEach((cb) => {
        cb.style.display = "none";
        cb.querySelector("input").checked = false;
      });
    }
    updateBatchCount();
  }
  function updateBatchCount() {
    const count = document.querySelectorAll(".chat-select-cb:checked").length;
    const countSpan = document.getElementById("batch-selected-count");
    if (countSpan) countSpan.textContent = `${count}\uAC1C \uC120\uD0DD`;
  }
  async function executeBatchMove(targetFolder) {
    if (!targetFolder) {
      await showAlert("\uC774\uB3D9\uD560 \uD3F4\uB354\uB97C \uC120\uD0DD\uD558\uC138\uC694.");
      return;
    }
    const checked = document.querySelectorAll(".chat-select-cb:checked");
    const keys = [];
    checked.forEach((cb, idx) => {
      const item = cb.closest(".lobby-chat-item");
      if (item) {
        const key = storage.getChatKey(item.dataset.charAvatar, item.dataset.fileName);
        keys.push(key);
      }
    });
    if (keys.length === 0) {
      await showAlert("\uC774\uB3D9\uD560 \uCC44\uD305\uC744 \uC120\uD0DD\uD558\uC138\uC694.");
      return;
    }
    storage.moveChatsBatch(keys, targetFolder);
    toggleBatchMode();
    showToast(`${keys.length}\uAC1C \uCC44\uD305\uC774 \uC774\uB3D9\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, "success");
    const character = store.currentCharacter;
    if (character) {
      renderChatList(character);
    }
  }
  function isBatchMode() {
    return store.batchModeActive;
  }
  async function refreshChatList() {
    const character = store.currentCharacter;
    if (character) {
      cache.invalidate("chats", character.avatar);
      await renderChatList(character);
    }
  }
  function closeChatPanel() {
    const chatsPanel = document.getElementById("chat-lobby-chats");
    if (chatsPanel) chatsPanel.classList.remove("visible");
    store.setCurrentCharacter(null);
  }

  // src/ui/characterGrid.js
  init_config();
  var isRendering = false;
  var pendingRender = null;
  function setCharacterSelectHandler(handler) {
    store.setCharacterSelectHandler(handler);
  }
  async function renderCharacterGrid(searchTerm = "", sortOverride = null) {
    if (isRendering) {
      pendingRender = { searchTerm, sortOverride };
      return;
    }
    isRendering = true;
    try {
      const container = document.getElementById("chat-lobby-characters");
      if (!container) return;
      store.setSearchTerm(searchTerm);
      const characters = api.getCharacters();
      if (characters.length === 0) {
        container.innerHTML = `
                <div class="lobby-empty-state">
                    <i>\u{1F465}</i>
                    <div>\uCE90\uB9AD\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4</div>
                    <button onclick="window.chatLobbyRefresh()" style="margin-top:10px;padding:8px 16px;cursor:pointer;">\uC0C8\uB85C\uACE0\uCE68</button>
                </div>
            `;
        return;
      }
      await renderCharacterList(container, characters, searchTerm, sortOverride);
    } finally {
      isRendering = false;
      if (pendingRender) {
        const { searchTerm: s, sortOverride: o } = pendingRender;
        pendingRender = null;
        renderCharacterGrid(s, o);
      }
    }
  }
  async function renderCharacterList(container, characters, searchTerm, sortOverride) {
    let filtered = [...characters];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (char) => (char.name || "").toLowerCase().includes(term)
      );
    }
    const selectedTag = store.selectedTag;
    if (selectedTag) {
      filtered = filtered.filter((char) => {
        const charTags = getCharacterTags2(char);
        return charTags.includes(selectedTag);
      });
    }
    renderTagBar(characters);
    const sortOption = sortOverride || storage.getCharSortOption();
    filtered = await sortCharacters(filtered, sortOption);
    const sortSelect = document.getElementById("chat-lobby-char-sort");
    if (sortSelect && sortSelect.value !== sortOption) {
      sortSelect.value = sortOption;
    }
    if (filtered.length === 0) {
      container.innerHTML = `
            <div class="lobby-empty-state">
                <i>\u{1F50D}</i>
                <div>\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4</div>
            </div>
        `;
      return;
    }
    const originalCharacters = api.getCharacters();
    const indexMap = new Map(originalCharacters.map((c, i) => [c.avatar, i]));
    container.innerHTML = filtered.map((char) => {
      return renderCharacterCard(char, indexMap.get(char.avatar));
    }).join("");
    bindCharacterEvents(container);
    loadChatCountsAsync(filtered);
  }
  function renderCharacterCard(char, index) {
    const avatarUrl = char.avatar ? `/characters/${encodeURIComponent(char.avatar)}` : "/img/ai4.png";
    const name = char.name || "Unknown";
    const safeAvatar = escapeHtml(char.avatar || "");
    const isFav = isFavoriteChar(char);
    const cachedChatCount = cache.get("chatCounts", char.avatar);
    const cachedMessageCount = cache.get("messageCounts", char.avatar);
    const hasCount = typeof cachedChatCount === "number";
    const hasMessageCount = typeof cachedMessageCount === "number";
    const chatCountText = hasCount ? cachedChatCount > 0 ? `${cachedChatCount}\uAC1C \uCC44\uD305` : "\uCC44\uD305 \uC5C6\uC74C" : "\uB85C\uB529 \uC911...";
    const messageCountText = hasMessageCount ? cachedMessageCount > 0 ? `${cachedMessageCount}\uAC1C \uBA54\uC2DC\uC9C0` : "" : "";
    const favBtn = `<button class="char-fav-btn" data-char-avatar="${safeAvatar}" title="\uC990\uACA8\uCC3E\uAE30 \uD1A0\uAE00">${isFav ? "\u2B50" : "\u2606"}</button>`;
    return `
    <div class="lobby-char-card ${isFav ? "is-char-fav" : ""}" 
         data-char-index="${index}" 
         data-char-avatar="${safeAvatar}" 
         data-is-fav="${isFav}">
        ${favBtn}
        <img class="lobby-char-avatar" 
             src="${avatarUrl}" 
             alt="${escapeHtml(name)}" 
             loading="lazy"
             onerror="this.src='/img/ai4.png'">
        <div class="lobby-char-name">
            <span class="char-name-text">${escapeHtml(name)}</span>
            <div class="char-hover-info">
                <div class="info-row">
                    <span class="info-icon">\u{1F4AC}</span>
                    <span class="info-value chat-count-value">${chatCountText}</span>
                </div>
                ${messageCountText ? `
                <div class="info-row">
                    <span class="info-icon">\u{1F4DD}</span>
                    <span class="info-value message-count-value">${messageCountText}</span>
                </div>
                ` : ""}
            </div>
        </div>
    </div>
    `;
  }
  async function loadChatCountsAsync(characters) {
    const BATCH_SIZE = 5;
    for (let i = 0; i < characters.length; i += BATCH_SIZE) {
      const batch = characters.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (char) => {
        const existingCount = cache.get("chatCounts", char.avatar);
        if (typeof existingCount === "number") return;
        try {
          const chats = await api.fetchChatsForCharacter(char.avatar);
          const chatArray = Array.isArray(chats) ? chats : typeof chats === "object" && chats ? Object.values(chats) : [];
          const count = chatArray.length;
          const messageCount = chatArray.reduce((sum, chat) => {
            return sum + (chat.chat_items || 0);
          }, 0);
          cache.set("chatCounts", count, char.avatar);
          cache.set("messageCounts", messageCount, char.avatar);
          console.log(`[CharacterGrid] Chat count for ${char.name}: ${count}, Messages: ${messageCount}`);
          const card = document.querySelector(`.lobby-char-card[data-char-avatar="${char.avatar}"]`);
          if (card) {
            const chatValueEl = card.querySelector(".chat-count-value");
            if (chatValueEl) {
              chatValueEl.textContent = count > 0 ? `${count}\uAC1C \uCC44\uD305` : "\uCC44\uD305 \uC5C6\uC74C";
            }
            const hoverInfo = card.querySelector(".char-hover-info");
            if (hoverInfo && messageCount > 0) {
              let messageRow = hoverInfo.querySelector(".message-count-value");
              if (!messageRow) {
                const newRow = document.createElement("div");
                newRow.className = "info-row";
                newRow.innerHTML = `
                                <span class="info-icon">\u{1F4DD}</span>
                                <span class="info-value message-count-value">${messageCount}\uAC1C \uBA54\uC2DC\uC9C0</span>
                            `;
                hoverInfo.appendChild(newRow);
              } else {
                messageRow.textContent = `${messageCount}\uAC1C \uBA54\uC2DC\uC9C0`;
              }
            }
          }
        } catch (e) {
          console.error("[CharacterGrid] Failed to load chat count:", char.name, e);
        }
      }));
    }
  }
  function isFavoriteChar(char) {
    return storage.isCharacterFavorite(char.avatar);
  }
  async function sortCharacters(characters, sortOption) {
    if (sortOption === "chats") {
      const BATCH_SIZE = 5;
      const results = [];
      for (let i = 0; i < characters.length; i += BATCH_SIZE) {
        const batch = characters.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (char) => {
            let count = cache.get("messageCounts", char.avatar);
            if (typeof count !== "number") {
              try {
                const chats = await api.fetchChatsForCharacter(char.avatar);
                count = cache.get("messageCounts", char.avatar) || 0;
              } catch (e) {
                console.error("[CharacterGrid] Failed to get message count for:", char.name, e);
                count = 0;
              }
            }
            return { char, count };
          })
        );
        results.push(...batchResults);
      }
      results.sort((a, b) => {
        if (isFavoriteChar(a.char) !== isFavoriteChar(b.char)) {
          return isFavoriteChar(a.char) ? -1 : 1;
        }
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return (a.char.name || "").localeCompare(b.char.name || "", "ko");
      });
      return results.map((item) => item.char);
    }
    const sorted = [...characters];
    sorted.sort((a, b) => {
      if (isFavoriteChar(a) !== isFavoriteChar(b)) {
        return isFavoriteChar(a) ? -1 : 1;
      }
      if (sortOption === "name") {
        return (a.name || "").localeCompare(b.name || "", "ko");
      }
      const aDate = a.date_last_chat || 0;
      const bDate = b.date_last_chat || 0;
      return bDate - aDate;
    });
    return sorted;
  }
  function bindCharacterEvents(container) {
    container.querySelectorAll(".lobby-char-card").forEach((card, index) => {
      const charNameEl = card.querySelector(".char-name-text");
      const charName = charNameEl?.textContent || card.querySelector(".lobby-char-name")?.textContent || "Unknown";
      const charAvatar = card.dataset.charAvatar;
      const favBtn = card.querySelector(".char-fav-btn");
      if (favBtn) {
        createTouchClickHandler(favBtn, (e) => {
          e.stopPropagation();
          const newFavState = storage.toggleCharacterFavorite(charAvatar);
          favBtn.textContent = newFavState ? "\u2B50" : "\u2606";
          card.dataset.isFav = newFavState.toString();
          card.classList.toggle("is-char-fav", newFavState);
          console.log(`[CharacterGrid] Favorite toggled: ${charAvatar} = ${newFavState}`);
          showToast(newFavState ? "\uC990\uACA8\uCC3E\uAE30\uC5D0 \uCD94\uAC00\uB428" : "\uC990\uACA8\uCC3E\uAE30\uC5D0\uC11C \uC81C\uAC70\uB428", "success");
        }, { preventDefault: true, stopPropagation: true, debugName: `char-fav-${index}` });
      }
      let isProcessing = false;
      createTouchClickHandler(card, async () => {
        if (isProcessing) {
          console.log("[CharacterGrid] Card click ignored - already processing");
          return;
        }
        isProcessing = true;
        try {
          const chatsPanel = document.getElementById("chat-lobby-chats");
          const isPanelVisible = chatsPanel?.classList.contains("visible");
          const isSameCharacter = store.currentCharacter?.avatar === charAvatar;
          console.log("[CharacterGrid] Card clicked:", {
            charAvatar,
            currentAvatar: store.currentCharacter?.avatar,
            isPanelVisible,
            isSameCharacter
          });
          if (isPanelVisible && isSameCharacter) {
            console.log("[CharacterGrid] Closing panel - same character re-clicked");
            card.classList.remove("selected");
            closeChatPanel();
            return;
          }
          container.querySelectorAll(".lobby-char-card.selected").forEach((el) => {
            el.classList.remove("selected");
          });
          card.classList.add("selected");
          const characterData = {
            index: card.dataset.charIndex,
            avatar: card.dataset.charAvatar,
            name: charName,
            avatarSrc: card.querySelector(".lobby-char-avatar")?.src || ""
          };
          const handler = store.onCharacterSelect;
          if (handler && typeof handler === "function") {
            await handler(characterData);
          } else {
            console.error("[CharacterGrid] onCharacterSelect handler not available!");
          }
        } catch (error) {
          console.error("[CharacterGrid] Handler error:", error);
        } finally {
          setTimeout(() => {
            isProcessing = false;
          }, 300);
        }
      }, { preventDefault: true, stopPropagation: true, debugName: `char-${index}-${charName}` });
    });
  }
  var handleSearch = debounce((searchTerm) => {
    renderCharacterGrid(searchTerm);
  }, CONFIG.ui.debounceWait);
  function handleSortChange2(sortOption) {
    storage.setCharSortOption(sortOption);
    const searchTerm = store.searchTerm;
    renderCharacterGrid(searchTerm, sortOption);
  }
  function getCharacterTags2(char) {
    const context = api.getContext();
    if (context?.tagMap && context?.tags && char.avatar) {
      const charTags = context.tagMap[char.avatar] || [];
      return charTags.map((tagId) => {
        const tag = context.tags.find((t) => t.id === tagId);
        return tag?.name || "";
      }).filter(Boolean);
    }
    if (Array.isArray(char.tags)) {
      return char.tags;
    }
    return [];
  }
  function aggregateTags(characters) {
    const tagCounts = {};
    characters.forEach((char) => {
      const tags = getCharacterTags2(char);
      tags.forEach((tag) => {
        if (tag) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      });
    });
    return Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }));
  }
  function renderTagBar(characters) {
    const container = document.getElementById("chat-lobby-tag-list");
    if (!container) return;
    const tags = aggregateTags(characters);
    if (tags.length === 0) {
      container.innerHTML = "";
      return;
    }
    const selectedTag = store.selectedTag;
    container.innerHTML = tags.map(({ tag, count }) => {
      const isActive = selectedTag === tag;
      return `<span class="lobby-tag-item ${isActive ? "active" : ""}" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}<span class="lobby-tag-count">(${count})</span></span>`;
    }).join("");
    bindTagEvents(container);
  }
  function bindTagEvents(container) {
    container.querySelectorAll(".lobby-tag-item").forEach((item) => {
      createTouchClickHandler(item, () => {
        const tag = item.dataset.tag;
        if (store.selectedTag === tag) {
          store.setSelectedTag(null);
        } else {
          store.setSelectedTag(tag);
        }
        renderCharacterGrid(store.searchTerm);
      }, { debugName: `tag-${item.dataset.tag}` });
    });
  }

  // src/handlers/chatHandlers.js
  init_notifications();
  init_config();

  // src/utils/waitFor.js
  async function waitFor(conditionFn, timeout = 3e3, interval = 50) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        if (conditionFn()) return true;
      } catch (e) {
      }
      await new Promise((r) => setTimeout(r, interval));
    }
    return false;
  }
  async function waitForElement(selector, timeout = 3e3) {
    const found = await waitFor(() => document.querySelector(selector) !== null, timeout);
    return found ? document.querySelector(selector) : null;
  }
  async function waitForCharacterSelect(expectedAvatar, timeout = 3e3) {
    return waitFor(() => {
      const context = window.SillyTavern?.getContext?.();
      if (!context) return false;
      const currentChar = context.characters?.[context.characterId];
      return currentChar?.avatar === expectedAvatar;
    }, timeout);
  }

  // src/handlers/chatHandlers.js
  async function openChat(chatInfo) {
    const { fileName, charAvatar, charIndex } = chatInfo;
    if (!charAvatar || !fileName) {
      console.error("[ChatHandlers] Missing chat data");
      showToast("\uCC44\uD305 \uC815\uBCF4\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.", "error");
      return;
    }
    try {
      const context = api.getContext();
      const characters = context?.characters || [];
      const index = characters.findIndex((c) => c.avatar === charAvatar);
      if (index === -1) {
        console.error("[ChatHandlers] Character not found");
        showToast("\uCE90\uB9AD\uD130\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", "error");
        return;
      }
      const chatFileName = fileName.replace(".jsonl", "");
      await api.selectCharacterById(index);
      const charSelected = await waitForCharacterSelect(charAvatar, 2e3);
      if (!charSelected) {
        console.warn("[ChatHandlers] Character selection timeout, continuing anyway");
      }
      closeLobbyKeepState();
      if (typeof context?.openCharacterChat === "function") {
        try {
          await context.openCharacterChat(chatFileName);
          return;
        } catch (err) {
          console.warn("[ChatHandlers] context.openCharacterChat failed:", err);
        }
      }
      await openChatByFileName(fileName);
    } catch (error) {
      console.error("[ChatHandlers] Failed to open chat:", error);
      showToast("\uCC44\uD305\uC744 \uC5F4\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "error");
    }
  }
  async function openChatByFileName(fileName) {
    const manageChatsBtn = document.getElementById("option_select_chat");
    if (!manageChatsBtn) {
      console.error("[ChatHandlers] Chat select button not found");
      showToast("\uCC44\uD305 \uC120\uD0DD \uBC84\uD2BC\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", "error");
      return;
    }
    manageChatsBtn.click();
    const listLoaded = await waitFor(() => {
      return document.querySelectorAll(".select_chat_block").length > 0;
    }, 3e3);
    if (!listLoaded) {
      console.error("[ChatHandlers] Chat list did not load");
      showToast("\uCC44\uD305 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "error");
      return;
    }
    const searchName = fileName.replace(".jsonl", "").trim();
    function isExactMatch(itemName, target) {
      const cleanItem = itemName.replace(".jsonl", "").trim();
      const cleanTarget = target.replace(".jsonl", "").trim();
      return cleanItem === cleanTarget;
    }
    const chatItems = document.querySelectorAll(".select_chat_block");
    for (const item of chatItems) {
      const itemFileName = item.getAttribute("file_name") || "";
      if (isExactMatch(itemFileName, searchName)) {
        if (window.$) {
          window.$(item).trigger("click");
        } else {
          item.click();
        }
        return;
      }
    }
    console.warn("[ChatHandlers] \u274C Chat not found in list:", fileName);
    showToast("\uCC44\uD305 \uD30C\uC77C\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "warning");
  }
  async function deleteChat(chatInfo) {
    const { fileName, charAvatar, element } = chatInfo;
    if (!fileName || !charAvatar) {
      console.error("[ChatHandlers] Missing chat data for delete");
      showToast("\uC0AD\uC81C\uD560 \uCC44\uD305 \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.", "error");
      return;
    }
    const displayName = fileName.replace(".jsonl", "");
    const confirmed = await showConfirm(
      `"${displayName}" \uCC44\uD305\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?

\uC774 \uC791\uC5C5\uC740 \uB418\uB3CC\uB9B4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.`,
      "\uCC44\uD305 \uC0AD\uC81C",
      true
    );
    if (!confirmed) return;
    try {
      const success = await api.deleteChat(fileName, charAvatar);
      if (success) {
        const data = storage.load();
        const key = storage.getChatKey(charAvatar, fileName);
        delete data.chatAssignments[key];
        const favIndex = data.favorites.indexOf(key);
        if (favIndex > -1) {
          data.favorites.splice(favIndex, 1);
        }
        storage.save(data);
        cache.invalidate("chats", charAvatar);
        if (element) {
          element.style.transition = "opacity 0.2s, transform 0.2s";
          element.style.opacity = "0";
          element.style.transform = "translateX(20px)";
          setTimeout(() => {
            element.remove();
            updateChatCountAfterDelete();
          }, 200);
        }
        const context = api.getContext();
        if (context?.reloadCurrentChat) {
          try {
            await context.reloadCurrentChat();
          } catch (e) {
            console.warn("[ChatLobby] reloadCurrentChat failed:", e);
          }
        }
        showToast("\uCC44\uD305\uC774 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.", "success");
      } else {
        showToast("\uCC44\uD305 \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", "error");
      }
    } catch (error) {
      console.error("[ChatHandlers] Error deleting chat:", error);
      showToast("\uCC44\uD305 \uC0AD\uC81C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.", "error");
    }
  }
  function updateChatCountAfterDelete() {
    const remaining = document.querySelectorAll(".lobby-chat-item").length;
    const countEl = document.getElementById("chat-panel-count");
    if (countEl) {
      countEl.textContent = remaining > 0 ? `${remaining}\uAC1C \uCC44\uD305` : "\uCC44\uD305 \uC5C6\uC74C";
    }
    if (remaining === 0) {
      const chatsList = document.getElementById("chat-lobby-chats-list");
      if (chatsList) {
        chatsList.innerHTML = `
                <div class="lobby-empty-state">
                    <i>\u{1F4AC}</i>
                    <div>\uCC44\uD305 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4</div>
                </div>
            `;
      }
    }
  }
  async function startNewChat() {
    const btn = document.getElementById("chat-lobby-new-chat");
    const charIndex = btn?.dataset.charIndex;
    const charAvatar = btn?.dataset.charAvatar;
    const hasChats = btn?.dataset.hasChats === "true";
    if (!charIndex || !charAvatar) {
      console.error("[ChatHandlers] No character selected");
      showToast("\uCE90\uB9AD\uD130\uAC00 \uC120\uD0DD\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.", "error");
      return;
    }
    try {
      cache.invalidate("chats", charAvatar);
      closeLobbyKeepState();
      await api.selectCharacterById(parseInt(charIndex, 10));
      await waitForCharacterSelect(charAvatar, 2e3);
      if (hasChats) {
        const newChatBtn = await waitForElement("#option_start_new_chat", 1e3);
        if (newChatBtn) newChatBtn.click();
      }
    } catch (error) {
      console.error("[ChatHandlers] Failed to start new chat:", error);
      showToast("\uC0C8 \uCC44\uD305\uC744 \uC2DC\uC791\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "error");
    }
  }
  async function deleteCharacter() {
    const deleteBtn = document.getElementById("chat-lobby-delete-char");
    const charAvatar = deleteBtn?.dataset.charAvatar;
    const charName = deleteBtn?.dataset.charName;
    if (!charAvatar) {
      showToast("\uC0AD\uC81C\uD560 \uCE90\uB9AD\uD130\uAC00 \uC120\uD0DD\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.", "error");
      return;
    }
    const context = api.getContext();
    const char = context?.characters?.find((c) => c.avatar === charAvatar);
    if (!char) {
      showToast("\uCE90\uB9AD\uD130\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC774\uBBF8 \uC0AD\uC81C\uB418\uC5C8\uC744 \uC218 \uC788\uC5B4\uC694.", "error");
      closeChatPanel();
      return;
    }
    const confirmed = await showConfirm(
      `"${char.name}" \uCE90\uB9AD\uD130\uC640 \uBAA8\uB4E0 \uCC44\uD305\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?

\uC774 \uC791\uC5C5\uC740 \uB418\uB3CC\uB9B4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.`
    );
    if (!confirmed) {
      return;
    }
    try {
      const data = storage.load();
      const prefix = char.avatar + "_";
      Object.keys(data.chatAssignments).forEach((key) => {
        if (key.startsWith(prefix)) {
          delete data.chatAssignments[key];
        }
      });
      data.favorites = data.favorites.filter((key) => !key.startsWith(prefix));
      storage.save(data);
      closeChatPanel();
      if (typeof context?.deleteCharacter === "function") {
        await context.deleteCharacter(char.avatar, { deleteChats: true });
      } else {
        const headers = api.getRequestHeaders();
        const avatarUrl = char.avatar.endsWith(".png") ? char.avatar : `${char.avatar}.png`;
        const response = await fetch("/api/characters/delete", {
          method: "POST",
          headers,
          body: JSON.stringify({
            avatar_url: avatarUrl,
            delete_chats: true
          })
        });
        if (!response.ok) {
          const errorText = await response.text();
          console.error("[ChatLobby] Delete response:", response.status, errorText);
          throw new Error(`Delete failed: ${response.status} - ${errorText}`);
        }
        if (typeof context?.getCharacters === "function") {
          await context.getCharacters();
        }
      }
      cache.invalidate("characters");
      cache.invalidate("chats", char.avatar);
      showToast(`"${char.name}" \uCE90\uB9AD\uD130\uAC00 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, "success");
      const overlay = document.getElementById("chat-lobby-overlay");
      if (overlay?.style.display === "flex") {
        window.dispatchEvent(new CustomEvent("chatlobby:refresh-grid"));
      }
    } catch (error) {
      console.error("[ChatHandlers] Failed to delete character:", error);
      showToast("\uCE90\uB9AD\uD130 \uC0AD\uC81C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.", "error");
    }
  }
  function closeLobbyKeepState() {
    const container = document.getElementById("chat-lobby-container");
    const fab = document.getElementById("chat-lobby-fab");
    if (container) container.style.display = "none";
    if (fab) fab.style.display = "flex";
    const sidebarBtn = document.getElementById("st-chatlobby-sidebar-btn");
    if (sidebarBtn) {
      const icon = sidebarBtn.querySelector(".drawer-icon");
      icon?.classList.remove("openIcon");
      icon?.classList.add("closedIcon");
    }
    store.setLobbyOpen(false);
    closeChatPanel();
  }

  // src/handlers/folderHandlers.js
  init_textUtils();
  init_notifications();
  function openFolderModal() {
    const modal = document.getElementById("chat-lobby-folder-modal");
    if (!modal) return;
    const header = modal.querySelector(".folder-modal-header h3");
    const addRow = modal.querySelector(".folder-add-row");
    if (isBatchMode()) {
      if (header) header.textContent = "\u{1F4C1} \uC774\uB3D9\uD560 \uD3F4\uB354 \uC120\uD0DD";
      if (addRow) addRow.style.display = "none";
    } else {
      if (header) header.textContent = "\u{1F4C1} \uD3F4\uB354 \uAD00\uB9AC";
      if (addRow) addRow.style.display = "flex";
    }
    modal.style.display = "flex";
    refreshFolderList();
  }
  function closeFolderModal() {
    const modal = document.getElementById("chat-lobby-folder-modal");
    if (modal) modal.style.display = "none";
  }
  function addFolder() {
    const input = document.getElementById("new-folder-name");
    const name = input?.value.trim();
    if (!name) {
      showToast("\uD3F4\uB354 \uC774\uB984\uC744 \uC785\uB825\uD558\uC138\uC694.", "warning");
      return;
    }
    try {
      storage.addFolder(name);
      input.value = "";
      refreshFolderList();
      updateFolderDropdowns();
      showToast(`"${name}" \uD3F4\uB354\uAC00 \uC0DD\uC131\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, "success");
    } catch (error) {
      console.error("[FolderHandlers] Failed to add folder:", error);
      showToast("\uD3F4\uB354 \uCD94\uAC00\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", "error");
    }
  }
  async function deleteFolder(folderId, folderName) {
    const confirmed = await showConfirm(
      `"${folderName}" \uD3F4\uB354\uB97C \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?

\uD3F4\uB354 \uC548\uC758 \uCC44\uD305\uB4E4\uC740 \uBBF8\uBD84\uB958\uB85C \uC774\uB3D9\uB429\uB2C8\uB2E4.`,
      "\uD3F4\uB354 \uC0AD\uC81C",
      true
    );
    if (!confirmed) return;
    try {
      storage.deleteFolder(folderId);
      refreshFolderList();
      updateFolderDropdowns();
      refreshChatList();
      showToast(`"${folderName}" \uD3F4\uB354\uAC00 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, "success");
    } catch (error) {
      console.error("[FolderHandlers] Failed to delete folder:", error);
      showToast("\uD3F4\uB354 \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", "error");
    }
  }
  async function renameFolder(folderId, currentName) {
    const newName = await showPrompt("\uC0C8 \uD3F4\uB354 \uC774\uB984\uC744 \uC785\uB825\uD558\uC138\uC694:", "\uD3F4\uB354 \uC774\uB984 \uBCC0\uACBD", currentName);
    if (!newName || newName === currentName) return;
    try {
      storage.renameFolder(folderId, newName);
      refreshFolderList();
      updateFolderDropdowns();
      showToast(`\uD3F4\uB354 \uC774\uB984\uC774 "${newName}"\uC73C\uB85C \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, "success");
    } catch (error) {
      console.error("[FolderHandlers] Failed to rename folder:", error);
      showToast("\uD3F4\uB354 \uC774\uB984 \uBCC0\uACBD\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", "error");
    }
  }
  function refreshFolderList() {
    const container = document.getElementById("folder-list");
    if (!container) return;
    try {
      const data = storage.load();
      const sorted = [...data.folders].sort((a, b) => a.order - b.order);
      let html = "";
      sorted.forEach((f) => {
        const isSystem = f.isSystem ? "system" : "";
        const deleteBtn = f.isSystem ? "" : `<button class="folder-delete-btn" data-id="${f.id}" data-name="${escapeHtml(f.name)}">\u{1F5D1}\uFE0F</button>`;
        const editBtn = f.isSystem ? "" : `<button class="folder-edit-btn" data-id="${f.id}" data-name="${escapeHtml(f.name)}">\u270F\uFE0F</button>`;
        let count = 0;
        if (f.id === "favorites") {
          count = data.favorites.length;
        } else {
          count = Object.values(data.chatAssignments).filter((v) => v === f.id).length;
        }
        html += `
            <div class="folder-item ${isSystem}" data-id="${f.id}">
                <span class="folder-name">${escapeHtml(f.name)}</span>
                <span class="folder-count">${count}\uAC1C</span>
                ${editBtn}
                ${deleteBtn}
            </div>`;
      });
      container.innerHTML = html;
      bindFolderEvents(container);
    } catch (error) {
      console.error("[FolderHandlers] Failed to refresh folder list:", error);
      showToast("\uD3F4\uB354 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "error");
    }
  }
  function bindFolderEvents(container) {
    container.querySelectorAll(".folder-delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const folderId = btn.dataset.id;
        const folderName = btn.dataset.name;
        deleteFolder(folderId, folderName);
      });
    });
    container.querySelectorAll(".folder-edit-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const folderId = btn.dataset.id;
        const currentName = btn.dataset.name;
        renameFolder(folderId, currentName);
      });
    });
    container.querySelectorAll(".folder-item").forEach((item) => {
      item.addEventListener("click", () => {
        const folderId = item.dataset.id;
        if (isBatchMode() && folderId && folderId !== "favorites") {
          closeFolderModal();
          executeBatchMove(folderId);
        }
      });
    });
  }
  function updateFolderDropdowns() {
    try {
      const data = storage.load();
      const sorted = [...data.folders].sort((a, b) => a.order - b.order);
      const filterSelect = document.getElementById("chat-lobby-folder-filter");
      if (filterSelect) {
        const currentValue = filterSelect.value;
        let html = '<option value="all">\u{1F4C1} \uC804\uCCB4</option>';
        html += '<option value="favorites">\u2B50 \uC990\uACA8\uCC3E\uAE30\uB9CC</option>';
        sorted.forEach((f) => {
          if (f.id !== "favorites") {
            html += `<option value="${f.id}">${escapeHtml(f.name)}</option>`;
          }
        });
        filterSelect.innerHTML = html;
        filterSelect.value = currentValue;
      }
      const batchSelect = document.getElementById("batch-move-folder");
      if (batchSelect) {
        batchSelect.innerHTML = getBatchFoldersHTML();
      }
    } catch (error) {
      console.error("[FolderHandlers] Failed to update dropdowns:", error);
    }
  }

  // src/index.js
  init_notifications();

  // src/ui/statsView.js
  init_textUtils();
  var isStatsOpen = false;
  var currentStep = 0;
  var rankingsData = [];
  var totalStatsData = {};
  var funFactsData = {};
  var userGuessChar = null;
  var userGuessMessages = 0;
  var userGuessFirstDate = null;
  var userGuessCharDate = null;
  async function openStatsView() {
    if (isStatsOpen) return;
    isStatsOpen = true;
    currentStep = 0;
    userGuessChar = null;
    userGuessMessages = 0;
    userGuessFirstDate = null;
    userGuessCharDate = null;
    const container = document.getElementById("chat-lobby-main");
    if (!container) return;
    const leftPanel = document.getElementById("chat-lobby-left");
    const chatsPanel = document.getElementById("chat-lobby-chats");
    const lobbyHeader = document.getElementById("chat-lobby-header");
    if (leftPanel) leftPanel.style.display = "none";
    if (chatsPanel) chatsPanel.style.display = "none";
    if (lobbyHeader) lobbyHeader.style.display = "none";
    const statsView = document.createElement("div");
    statsView.id = "chat-lobby-stats-view";
    statsView.className = "stats-view wrapped-view";
    statsView.innerHTML = `
        <div class="wrapped-container">
            <div class="wrapped-loading">
                <div class="stats-spinner"></div>
                <div>\uB370\uC774\uD130 \uBD88\uB7EC\uC624\uB294 \uC911...</div>
            </div>
        </div>
    `;
    container.appendChild(statsView);
    await loadWrappedData();
    showStep(1);
  }
  function closeStatsView() {
    if (!isStatsOpen) return;
    isStatsOpen = false;
    const statsView = document.getElementById("chat-lobby-stats-view");
    if (statsView) statsView.remove();
    const leftPanel = document.getElementById("chat-lobby-left");
    const chatsPanel = document.getElementById("chat-lobby-chats");
    const lobbyHeader = document.getElementById("chat-lobby-header");
    if (leftPanel) leftPanel.style.display = "";
    if (chatsPanel) chatsPanel.style.display = "";
    if (lobbyHeader) lobbyHeader.style.display = "";
  }
  function isStatsViewOpen() {
    return isStatsOpen;
  }
  async function loadWrappedData() {
    try {
      const characters = api.getCharacters();
      if (!characters || characters.length === 0) {
        showError("\uCE90\uB9AD\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4");
        return;
      }
      rankingsData = await fetchRankings(characters);
      totalStatsData = calculateTotalStats(rankingsData, characters.length);
      funFactsData = calculateFunFacts(rankingsData);
    } catch (error) {
      console.error("[Wrapped] Failed to load:", error);
      showError("\uB370\uC774\uD130 \uB85C\uB529 \uC2E4\uD328");
    }
  }
  async function fetchRankings(characters) {
    const BATCH_SIZE = 5;
    const results = [];
    for (let i = 0; i < characters.length; i += BATCH_SIZE) {
      const batch = characters.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (char) => {
          try {
            let chats = cache.get("chats", char.avatar);
            if (!chats || !Array.isArray(chats)) {
              chats = await api.fetchChatsForCharacter(char.avatar);
            }
            const chatCount = Array.isArray(chats) ? chats.length : 0;
            let messageCount = 0;
            let firstChatDate = null;
            if (Array.isArray(chats)) {
              messageCount = chats.reduce((sum, chat) => sum + (chat.chat_items || 0), 0);
              chats.forEach((chat) => {
                const fileName = chat.file_name || "";
                const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})/);
                if (dateMatch) {
                  const chatDate = new Date(dateMatch[1]);
                  if (!firstChatDate || chatDate < firstChatDate) {
                    firstChatDate = chatDate;
                  }
                }
              });
            }
            return { name: char.name, avatar: char.avatar, chatCount, messageCount, firstChatDate };
          } catch (e) {
            return { name: char.name, avatar: char.avatar, chatCount: 0, messageCount: 0, firstChatDate: null };
          }
        })
      );
      results.push(...batchResults);
    }
    return results.sort((a, b) => {
      if (b.messageCount !== a.messageCount) return b.messageCount - a.messageCount;
      return b.chatCount - a.chatCount;
    });
  }
  function calculateTotalStats(rankings, totalCharacters) {
    const totalChats = rankings.reduce((sum, r) => sum + r.chatCount, 0);
    const totalMessages = rankings.reduce((sum, r) => sum + r.messageCount, 0);
    return { characters: totalCharacters, chats: totalChats, messages: totalMessages };
  }
  function calculateFunFacts(rankings) {
    const topChar = rankings[0];
    const avgMessagesPerChar = rankings.length > 0 ? Math.round(rankings.reduce((sum, r) => sum + r.messageCount, 0) / rankings.length) : 0;
    const mostChats = [...rankings].sort((a, b) => b.chatCount - a.chatCount)[0];
    const avgMessagesPerChat = totalStatsData.chats > 0 ? Math.round(totalStatsData.messages / totalStatsData.chats) : 0;
    let oldestDate = null;
    rankings.forEach((r) => {
      if (r.firstChatDate && (!oldestDate || r.firstChatDate < oldestDate)) {
        oldestDate = r.firstChatDate;
      }
    });
    let avgChatsPerDay = 0;
    if (oldestDate && totalStatsData.chats > 0) {
      const today = /* @__PURE__ */ new Date();
      const daysDiff = Math.max(1, Math.ceil((today - oldestDate) / (1e3 * 60 * 60 * 24)));
      avgChatsPerDay = (totalStatsData.chats / daysDiff).toFixed(1);
    }
    const top3WithDates = rankings.slice(0, 3).map((r) => ({
      name: r.name,
      firstChatDate: r.firstChatDate
    }));
    return {
      avgMessagesPerChar,
      mostChatsChar: mostChats,
      avgMessagesPerChat,
      topCharPercentage: totalStatsData.messages > 0 ? Math.round((topChar?.messageCount || 0) / totalStatsData.messages * 100) : 0,
      oldestDate,
      avgChatsPerDay,
      top3WithDates
    };
  }
  function showStep(step) {
    currentStep = step;
    const container = document.querySelector(".wrapped-container");
    if (!container) return;
    switch (step) {
      case 1:
        showIntro(container);
        break;
      case 2:
        showFirstDateQuiz(container);
        break;
      // 전체 첫 대화일 퀴즈
      case 3:
        showFirstDateResult(container);
        break;
      // 전체 첫 대화일 결과
      case 4:
        showQuiz(container);
        break;
      // 캐릭터 퀴즈
      case 5:
        showQuizResult(container);
        break;
      // 캐릭터 결과
      case 6:
        showMessageQuiz(container);
        break;
      // 메시지 수 퀴즈
      case 7:
        showMessageResult(container);
        break;
      // 메시지 수 결과
      case 8:
        showCharDateQuiz(container);
        break;
      // 1위 캐릭터 첫 대화일 퀴즈
      case 9:
        showCharDateResult(container);
        break;
      // 1위 캐릭터 첫 대화일 결과
      case 10:
        showFinalStats(container);
        break;
      // 최종 결과
      default:
        closeStatsView();
    }
  }
  function showIntro(container) {
    container.innerHTML = `
        <div class="wrapped-step intro-step">
            <div class="wrapped-emoji">\u{1F3AC}</div>
            <h2>Your Chat Wrapped</h2>
            <p class="wrapped-subtitle">\uC774\uB54C\uAE4C\uC9C0 \uB2F9\uC2E0\uC740 \uB204\uAD6C\uC640<br>\uAC00\uC7A5 \uB9CE\uC774 \uB300\uD654\uD588\uC744\uAE4C\uC694?</p>
            <button class="wrapped-btn primary" data-action="next">\uC2DC\uC791\uD558\uAE30</button>
            <button class="wrapped-btn secondary" data-action="skip">\uAC74\uB108\uB6F0\uAE30</button>
        </div>
    `;
    container.querySelector('[data-action="next"]').addEventListener("click", () => showStep(2));
    container.querySelector('[data-action="skip"]').addEventListener("click", () => showStep(10));
  }
  function showFirstDateQuiz(container) {
    if (!funFactsData.oldestDate) {
      showStep(4);
      return;
    }
    const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
    const years = [];
    for (let y = currentYear; y >= currentYear - 5; y--) {
      years.push(y);
    }
    container.innerHTML = `
        <div class="wrapped-step date-quiz-step">
            <div class="wrapped-emoji">\u{1F4C5}</div>
            <h2>\uCC98\uC74C\uC73C\uB85C SillyTavern\uC744<br>\uC0AC\uC6A9\uD55C \uB0A0\uC9DC, \uAE30\uC5B5\uD558\uC2DC\uB098\uC694?</h2>
            <p class="wrapped-subtitle">\uAC00\uC7A5 \uC624\uB798\uB41C \uCC44\uD305\uC758 \uC2DC\uC791\uC77C\uC744 \uB9DE\uCDB0\uBCF4\uC138\uC694!</p>
            <div class="date-select-wrap">
                <select id="first-year-guess" class="date-select">
                    <option value="">\uB144\uB3C4</option>
                    ${years.map((y) => `<option value="${y}">${y}\uB144</option>`).join("")}
                </select>
                <select id="first-month-guess" class="date-select">
                    <option value="">\uC6D4</option>
                    ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}\uC6D4</option>`).join("")}
                </select>
                <select id="first-day-guess" class="date-select">
                    <option value="">\uC77C</option>
                    ${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${i + 1}\uC77C</option>`).join("")}
                </select>
            </div>
            <button class="wrapped-btn primary" data-action="submit">\uD655\uC778\uD558\uAE30</button>
        </div>
    `;
    const btn = container.querySelector('[data-action="submit"]');
    btn.addEventListener("click", () => {
      const y = parseInt(container.querySelector("#first-year-guess").value) || null;
      const m = parseInt(container.querySelector("#first-month-guess").value) || null;
      const d = parseInt(container.querySelector("#first-day-guess").value) || null;
      userGuessFirstDate = y && m && d ? new Date(y, m - 1, d) : null;
      showStep(3);
    });
  }
  function showFirstDateResult(container) {
    const actualDate = funFactsData.oldestDate;
    const dateStr = actualDate.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
    let emoji, title;
    if (userGuessFirstDate) {
      const diffDays = Math.abs(Math.ceil((actualDate - userGuessFirstDate) / (1e3 * 60 * 60 * 24)));
      if (diffDays <= 7) {
        emoji = "\u{1F3AF}";
        title = "\uB300\uB2E8\uD574\uC694! \uAC70\uC758 \uC815\uD655\uD574\uC694!";
      } else if (diffDays <= 30) {
        emoji = "\u{1F44D}";
        title = "\uAF64 \uAC00\uAE4C\uC6CC\uC694!";
      } else {
        emoji = "\u{1F605}";
        title = "\uC544\uC26C\uC6CC\uC694!";
      }
    } else {
      emoji = "\u{1F4C5}";
      title = "\uC815\uB2F5\uC740...";
    }
    container.innerHTML = `
        <div class="wrapped-step date-result-step">
            <div class="wrapped-emoji">${emoji}</div>
            <h2>${title}</h2>
            <p class="wrapped-subtitle">\uB2F9\uC2E0\uC758 SillyTavern \uC5EC\uC815\uC774 \uC2DC\uC791\uB41C \uB0A0</p>
            <div class="date-reveal">
                <span class="date-value">${dateStr}</span>
            </div>
            <button class="wrapped-btn primary" data-action="next">\uB2E4\uC74C</button>
        </div>
    `;
    container.querySelector('[data-action="next"]').addEventListener("click", () => showStep(4));
  }
  function showQuiz(container) {
    if (rankingsData.length < 3) {
      showStep(10);
      return;
    }
    const top3 = rankingsData.slice(0, 3);
    const shuffled = [...top3].sort(() => Math.random() - 0.5);
    container.innerHTML = `
        <div class="wrapped-step quiz-step">
            <div class="wrapped-emoji">\u{1F914}</div>
            <h2>\uAC00\uC7A5 \uB9CE\uC774 \uB300\uD654\uD55C \uCE90\uB9AD\uD130\uB294?</h2>
            <div class="quiz-options">
                ${shuffled.map((char, i) => {
      const avatarUrl = char.avatar ? `/characters/${encodeURIComponent(char.avatar)}` : "/img/ai4.png";
      return `
                        <div class="quiz-option spin-animation" data-name="${escapeHtml(char.name)}" style="animation-delay: ${i * 0.2}s">
                            <img src="${avatarUrl}" alt="${escapeHtml(char.name)}" onerror="this.src='/img/ai4.png'">
                            <span>${escapeHtml(char.name)}</span>
                        </div>
                    `;
    }).join("")}
            </div>
        </div>
    `;
    container.querySelectorAll(".quiz-option").forEach((opt) => {
      opt.addEventListener("click", () => {
        userGuessChar = opt.dataset.name;
        showStep(5);
      });
    });
  }
  function showQuizResult(container) {
    const correct = rankingsData[0];
    const isCorrect = userGuessChar === correct.name;
    const avatarUrl = correct.avatar ? `/characters/${encodeURIComponent(correct.avatar)}` : "/img/ai4.png";
    if (isCorrect) {
      showConfetti();
    }
    container.innerHTML = `
        <div class="wrapped-step result-step ${isCorrect ? "result-correct" : "result-wrong"}">
            <div class="wrapped-emoji">${isCorrect ? "\u{1F389}" : "\u{1F605}"}</div>
            <h2>${isCorrect ? "\uC815\uB2F5\uC774\uC5D0\uC694!" : "\uC544\uC26C\uC6CC\uC694!"}</h2>
            ${!isCorrect ? `<p class="wrapped-subtitle">\uC815\uB2F5\uC740 <strong>${escapeHtml(correct.name)}</strong> \uC774\uC5C8\uC5B4\uC694!</p>` : ""}
            <div class="result-avatar ${isCorrect ? "sparkle-animation" : ""}">
                <img src="${avatarUrl}" alt="${escapeHtml(correct.name)}" onerror="this.src='/img/ai4.png'">
                <span>${escapeHtml(correct.name)}</span>
            </div>
            <button class="wrapped-btn primary" data-action="next">\uB2E4\uC74C</button>
        </div>
    `;
    container.querySelector('[data-action="next"]').addEventListener("click", () => showStep(6));
  }
  function showMessageQuiz(container) {
    const top = rankingsData[0];
    container.innerHTML = `
        <div class="wrapped-step message-quiz-step">
            <div class="wrapped-emoji">\u{1F4AC}</div>
            <h2>\uADF8\uB7FC, ${escapeHtml(top.name)}\uACFC<br>\uBA87 \uAC1C\uC758 \uBA54\uC2DC\uC9C0\uB97C \uB098\uB234\uC744\uAE4C\uC694?</h2>
            <div class="message-input-wrap">
                <input type="number" id="message-guess" placeholder="\uC608\uC0C1 \uBA54\uC2DC\uC9C0 \uC218" min="0">
            </div>
            <button class="wrapped-btn primary" data-action="submit">\uD655\uC778\uD558\uAE30</button>
        </div>
    `;
    const input = container.querySelector("#message-guess");
    const btn = container.querySelector('[data-action="submit"]');
    btn.addEventListener("click", () => {
      userGuessMessages = parseInt(input.value) || 0;
      showStep(7);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        userGuessMessages = parseInt(input.value) || 0;
        showStep(7);
      }
    });
  }
  function showMessageResult(container) {
    const top = rankingsData[0];
    const actual = top.messageCount;
    const guess = userGuessMessages;
    const result = judgeMessageGuess(actual, guess);
    let emoji, title, subtitle;
    if (result === "accurate") {
      emoji = "\u{1F3AF}";
      title = "\uB300\uB2E8\uD574\uC694!";
      subtitle = "\uAC70\uC758 \uC815\uD655\uD574\uC694!";
    } else if (result === "too_high") {
      emoji = "\u{1F4C9}";
      title = "\uC557!";
      subtitle = "\uC2E4\uC81C\uB85C\uB294 \uD6E8\uC52C \uC801\uAC8C \uBA54\uC2DC\uC9C0\uB97C \uBCF4\uB0B4\uC168\uC5B4\uC694!";
    } else {
      emoji = "\u{1F4C8}";
      title = "\uC640!";
      subtitle = "\uC2E4\uC81C\uB85C\uB294 \uD6E8\uC52C \uB9CE\uC740 \uBA54\uC2DC\uC9C0\uB97C \uBCF4\uB0B4\uC168\uC5B4\uC694!";
    }
    container.innerHTML = `
        <div class="wrapped-step message-result-step">
            <div class="wrapped-emoji">${emoji}</div>
            <h2>${title}</h2>
            <p class="wrapped-subtitle">${subtitle}</p>
            <div class="message-compare">
                <div class="compare-item">
                    <span class="compare-label">\uC2E4\uC81C \uBA54\uC2DC\uC9C0</span>
                    <span class="compare-value ${result} count-up">${actual.toLocaleString()}\uAC1C</span>
                </div>
                <div class="compare-item">
                    <span class="compare-label">\uB2F9\uC2E0\uC758 \uC608\uC0C1</span>
                    <span class="compare-value">${guess.toLocaleString()}\uAC1C</span>
                </div>
            </div>
            <button class="wrapped-btn primary" data-action="next">\uB2E4\uC74C</button>
        </div>
    `;
    container.querySelector('[data-action="next"]').addEventListener("click", () => showStep(8));
  }
  function showCharDateQuiz(container) {
    const top = rankingsData[0];
    const topCharDate = funFactsData.top3WithDates?.find((c) => c.name === top?.name)?.firstChatDate;
    if (!topCharDate) {
      showStep(10);
      return;
    }
    const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
    const years = [];
    for (let y = currentYear; y >= currentYear - 5; y--) {
      years.push(y);
    }
    container.innerHTML = `
        <div class="wrapped-step date-quiz-step">
            <div class="wrapped-emoji">\u{1F495}</div>
            <h2>${escapeHtml(top.name)}\uC640\uC758 \uCCAB \uB300\uD654,<br>\uC5B8\uC81C \uC2DC\uC791\uD588\uB294\uC9C0 \uAE30\uC5B5\uD558\uC138\uC694?</h2>
            <p class="wrapped-subtitle">\uCCAB \uCC44\uD305 \uC2DC\uC791\uC77C\uC744 \uB9DE\uCDB0\uBCF4\uC138\uC694!</p>
            <div class="date-select-wrap">
                <select id="char-year-guess" class="date-select">
                    <option value="">\uB144\uB3C4</option>
                    ${years.map((y) => `<option value="${y}">${y}\uB144</option>`).join("")}
                </select>
                <select id="char-month-guess" class="date-select">
                    <option value="">\uC6D4</option>
                    ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}\uC6D4</option>`).join("")}
                </select>
                <select id="char-day-guess" class="date-select">
                    <option value="">\uC77C</option>
                    ${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${i + 1}\uC77C</option>`).join("")}
                </select>
            </div>
            <button class="wrapped-btn primary" data-action="submit">\uD655\uC778\uD558\uAE30</button>
        </div>
    `;
    const btn = container.querySelector('[data-action="submit"]');
    btn.addEventListener("click", () => {
      const y = parseInt(container.querySelector("#char-year-guess").value) || null;
      const m = parseInt(container.querySelector("#char-month-guess").value) || null;
      const d = parseInt(container.querySelector("#char-day-guess").value) || null;
      userGuessCharDate = y && m && d ? new Date(y, m - 1, d) : null;
      showStep(9);
    });
  }
  function showCharDateResult(container) {
    const top = rankingsData[0];
    const topCharDate = funFactsData.top3WithDates?.find((c) => c.name === top?.name)?.firstChatDate;
    if (!topCharDate) {
      showStep(10);
      return;
    }
    let emoji, title;
    if (userGuessCharDate) {
      const diffDays = Math.abs(Math.ceil((topCharDate - userGuessCharDate) / (1e3 * 60 * 60 * 24)));
      if (diffDays <= 7) {
        emoji = "\u{1F3AF}";
        title = "\uB300\uB2E8\uD574\uC694! \uAC70\uC758 \uC815\uD655\uD574\uC694!";
      } else if (diffDays <= 30) {
        emoji = "\u{1F44D}";
        title = "\uAF64 \uAC00\uAE4C\uC6CC\uC694!";
      } else {
        emoji = "\u{1F605}";
        title = "\uC544\uC26C\uC6CC\uC694!";
      }
    } else {
      emoji = "\u{1F495}";
      title = "\uC815\uB2F5\uC740...";
    }
    const dateStr = topCharDate.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
    const today = /* @__PURE__ */ new Date();
    const daysDiff = Math.ceil((today - topCharDate) / (1e3 * 60 * 60 * 24));
    const monthsDiff = Math.floor(daysDiff / 30);
    let periodComment = "";
    if (monthsDiff >= 12) {
      periodComment = `\uBC8C\uC368 ${Math.floor(monthsDiff / 12)}\uB144\uC774 \uB118\uC5C8\uB124\uC694! \uC624\uB798\uB41C \uC778\uC5F0\uC774\uC5D0\uC694 \u2728`;
    } else if (monthsDiff >= 6) {
      periodComment = "\uBC18\uB144 \uB118\uAC8C \uD568\uAED8\uD588\uB124\uC694! \uAF64 \uCE5C\uD574\uC84C\uACA0\uC5B4\uC694 \u{1F49C}";
    } else if (monthsDiff >= 2) {
      periodComment = "\uB9CC\uB09C \uC9C0 \uAF64 \uC9C0\uB0AC\uB124\uC694! \uC544\uC9C1 \uC0C8\uB85C\uC6B4 \uC774\uC57C\uAE30\uAC00 \uB9CE\uACA0\uC5B4\uC694 \u{1F497}";
    } else {
      periodComment = "\uC544\uC9C1 \uC0C8\uB85C\uC6B4 \uC778\uC5F0\uC774\uB124\uC694! \uC55E\uC73C\uB85C\uAC00 \uAE30\uB300\uB3FC\uC694 \u{1F31F}";
    }
    const charDailyAvg = daysDiff > 0 ? (top.messageCount / daysDiff).toFixed(1) : top.messageCount;
    container.innerHTML = `
        <div class="wrapped-step date-result-step">
            <div class="wrapped-emoji">${emoji}</div>
            <h2>${title}</h2>
            <p class="wrapped-subtitle">${escapeHtml(top.name)}\uC640\uC758 \uC2DC\uC791\uC740</p>
            <div class="date-reveal">
                <span class="date-value">${dateStr}</span>
            </div>
            <p class="period-comment">${periodComment}</p>
            <div class="daily-stats">
                <p>${escapeHtml(top.name)}\uC640\uB294 \uD558\uB8E8 \uD3C9\uADE0</p>
                <span class="daily-value">${charDailyAvg}\uAC1C</span>
                <p>\uC758 \uBA54\uC2DC\uC9C0\uB97C \uB098\uB234\uC5B4\uC694!</p>
            </div>
            <button class="wrapped-btn primary" data-action="next">\uACB0\uACFC \uBCF4\uAE30</button>
        </div>
    `;
    container.querySelector('[data-action="next"]').addEventListener("click", () => showStep(10));
  }
  function showFinalStats(container) {
    const medals = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];
    const top = rankingsData[0];
    const rankingHTML = rankingsData.slice(0, 10).map((r, i) => {
      const medal = i < 3 ? medals[i] : `${i + 1}\uC704`;
      const avatarUrl = r.avatar ? `/characters/${encodeURIComponent(r.avatar)}` : "/img/ai4.png";
      return `
            <div class="stats-rank-item ${i < 3 ? "top-3" : ""}" style="animation-delay: ${i * 0.05}s">
                <span class="rank-medal">${medal}</span>
                <img class="rank-avatar" src="${avatarUrl}" alt="${escapeHtml(r.name)}" onerror="this.src='/img/ai4.png'">
                <div class="rank-info">
                    <div class="rank-name">${escapeHtml(r.name)}</div>
                    <div class="rank-stats">\uCC44\uD305 ${r.chatCount}\uAC1C | \uBA54\uC2DC\uC9C0 ${r.messageCount.toLocaleString()}\uAC1C</div>
                </div>
            </div>
        `;
    }).join("");
    const encouragement = getEncouragement(top?.name);
    const oldestDateStr = funFactsData.oldestDate ? funFactsData.oldestDate.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }) : "\uC54C \uC218 \uC5C6\uC74C";
    const topCharData = funFactsData.top3WithDates?.find((c) => c.name === top?.name);
    const topCharDateStr = topCharData?.firstChatDate ? topCharData.firstChatDate.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }) : "\uC54C \uC218 \uC5C6\uC74C";
    let topCharDailyAvg = 0;
    if (topCharData?.firstChatDate) {
      const daysDiff = Math.ceil((/* @__PURE__ */ new Date() - topCharData.firstChatDate) / (1e3 * 60 * 60 * 24));
      topCharDailyAvg = daysDiff > 0 ? (top.messageCount / daysDiff).toFixed(1) : top.messageCount;
    }
    const totalChars = rankingsData.length;
    const totalMessages = rankingsData.reduce((sum, r) => sum + r.messageCount, 0);
    const avgMessagesPerChar = totalChars > 0 ? Math.round(totalMessages / totalChars) : 0;
    const funFactsHTML = `
        <div class="stats-section stats-fun-facts">
            <h4>\u2728 Fun Facts</h4>
            <div class="fun-facts-grid">
                <div class="fun-fact-item">
                    <span class="fun-fact-value">${oldestDateStr}</span>
                    <span class="fun-fact-label">\u{1F4C5} \uCCAB \uB300\uD654 \uC2DC\uC791\uC77C</span>
                </div>
                <div class="fun-fact-item">
                    <span class="fun-fact-value">${funFactsData.avgMessagesPerChat}</span>
                    <span class="fun-fact-label">\u{1F4AC} \uCC44\uD305\uB2F9 \uD3C9\uADE0 \uBA54\uC2DC\uC9C0</span>
                </div>
                <div class="fun-fact-item">
                    <span class="fun-fact-value">${avgMessagesPerChar.toLocaleString()}\uAC1C</span>
                    <span class="fun-fact-label">\u{1F464} \uCE90\uB9AD\uD130\uB2F9 \uD3C9\uADE0 \uBA54\uC2DC\uC9C0</span>
                </div>
            </div>
        </div>
    `;
    const topCharAvatarUrl = top?.avatar ? `/characters/${encodeURIComponent(top.avatar)}` : "/img/ai4.png";
    const topCharHTML = top ? `
        <div class="stats-section stats-top-char">
            <h4>\u{1F3C6} ${escapeHtml(top.name)}\uC640\uC758 \uD1B5\uACC4</h4>
            <div class="top-char-card">
                <img class="top-char-avatar" src="${topCharAvatarUrl}" alt="${escapeHtml(top.name)}" onerror="this.src='/img/ai4.png'">
                <div class="top-char-stats">
                    <div class="top-char-stat-item">
                        <span class="stat-label">\uCCAB \uB300\uD654\uC77C</span>
                        <span class="stat-value">${topCharDateStr}</span>
                    </div>
                    <div class="top-char-stat-item">
                        <span class="stat-label">\uC804\uCCB4 \uB300\uD654 \uBE44\uC728</span>
                        <span class="stat-value">${funFactsData.topCharPercentage}%</span>
                    </div>
                    <div class="top-char-stat-item">
                        <span class="stat-label">\uD558\uB8E8 \uD3C9\uADE0 \uBA54\uC2DC\uC9C0</span>
                        <span class="stat-value">${topCharDailyAvg}\uAC1C</span>
                    </div>
                </div>
            </div>
        </div>
    ` : "";
    container.innerHTML = `
        <div class="wrapped-step final-step">
            <div class="final-header">
                <button class="wrapped-back" data-action="close">\u2190</button>
                <h2>\u{1F4CA} Your Chat Wrapped</h2>
            </div>
            <div class="final-content">
                <div class="stats-section">
                    <h4>\u{1F3C6} Top 10 \uCE90\uB9AD\uD130</h4>
                    <div class="stats-ranking slide-in">
                        ${rankingHTML}
                    </div>
                </div>
                ${funFactsHTML}
                ${topCharHTML}
                <div class="stats-section stats-total">
                    <div class="stats-grid">
                        <div class="stats-item">
                            <div class="stats-value">${totalStatsData.characters}</div>
                            <div class="stats-label">\uCD1D \uCE90\uB9AD\uD130</div>
                        </div>
                        <div class="stats-item">
                            <div class="stats-value">${totalStatsData.chats}</div>
                            <div class="stats-label">\uCD1D \uCC44\uD305</div>
                        </div>
                        <div class="stats-item">
                            <div class="stats-value">${totalStatsData.messages.toLocaleString()}</div>
                            <div class="stats-label">\uCD1D \uBA54\uC2DC\uC9C0</div>
                        </div>
                    </div>
                </div>
                <div class="encouragement">
                    "${encouragement}"
                </div>
            </div>
            <button class="wrapped-btn primary" data-action="close">\uB2EB\uAE30</button>
        </div>
    `;
    container.querySelectorAll('[data-action="close"]').forEach((btn) => {
      btn.addEventListener("click", closeStatsView);
    });
    animateCards(container);
  }
  function judgeMessageGuess(actual, guess) {
    if (actual === 0) return "accurate";
    const diff = Math.abs(actual - guess);
    const threshold = actual * 0.15;
    if (diff <= threshold) return "accurate";
    if (guess > actual) return "too_high";
    return "too_low";
  }
  function getEncouragement(topCharName) {
    const messages = [
      `\uB2E4\uC74C\uC5D0\uB3C4 ${topCharName}\uACFC \uD568\uAED8\uD574\uC694! \u{1F495}`,
      `${topCharName}\uC774(\uAC00) \uB2F9\uC2E0\uC744 \uAE30\uB2E4\uB9AC\uACE0 \uC788\uC5B4\uC694! \u2728`,
      `\uC55E\uC73C\uB85C\uB3C4 \uC990\uAC70\uC6B4 \uB300\uD654 \uB098\uB220\uC694! \u{1F38A}`,
      `${topCharName}\uACFC\uC758 \uCD94\uC5B5\uC774 \uC313\uC774\uACE0 \uC788\uC5B4\uC694! \u{1F4DA}`
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }
  function showError(message) {
    const container = document.querySelector(".wrapped-container");
    if (!container) return;
    container.innerHTML = `
        <div class="wrapped-step error-step">
            <div class="wrapped-emoji">\u{1F622}</div>
            <h2>${message}</h2>
            <button class="wrapped-btn primary" data-action="close">\uB2EB\uAE30</button>
        </div>
    `;
    container.querySelector('[data-action="close"]').addEventListener("click", closeStatsView);
  }
  function animateCards(container) {
    const items = container.querySelectorAll(".stats-rank-item");
    items.forEach((item, i) => {
      item.style.opacity = "0";
      item.style.transform = "translateX(20px)";
      setTimeout(() => {
        item.style.transition = "opacity 0.3s ease, transform 0.3s ease";
        item.style.opacity = "1";
        item.style.transform = "translateX(0)";
      }, i * 50);
    });
  }
  function showConfetti() {
    const container = document.createElement("div");
    container.className = "confetti-container";
    document.body.appendChild(container);
    for (let i = 0; i < 30; i++) {
      const confetti = document.createElement("div");
      confetti.className = "confetti";
      confetti.style.left = Math.random() * 100 + "%";
      confetti.style.animationDelay = Math.random() * 2 + "s";
      confetti.style.animationDuration = 2 + Math.random() * 2 + "s";
      container.appendChild(confetti);
    }
    setTimeout(() => container.remove(), 5e3);
  }

  // src/utils/intervalManager.js
  var IntervalManager = class {
    constructor() {
      this.intervals = /* @__PURE__ */ new Set();
    }
    /**
     * setInterval 대신 사용
     * @param {Function} callback
     * @param {number} delay
     * @returns {number} interval ID
     */
    set(callback, delay) {
      const id = setInterval(callback, delay);
      this.intervals.add(id);
      return id;
    }
    /**
     * 개별 interval 정리
     * @param {number} id
     */
    clear(id) {
      if (this.intervals.has(id)) {
        clearInterval(id);
        this.intervals.delete(id);
      }
    }
    /**
     * 모든 interval 정리 (로비 닫을 때 호출)
     */
    clearAll() {
      if (this.intervals.size > 0) {
        this.intervals.forEach((id) => clearInterval(id));
        this.intervals.clear();
      }
    }
    /**
     * 활성 interval 수
     * @returns {number}
     */
    get count() {
      return this.intervals.size;
    }
  };
  var intervalManager = new IntervalManager();

  // src/index.js
  (function() {
    "use strict";
    let hamburgerObserver = null;
    let eventHandlers = null;
    let eventsRegistered = false;
    async function init() {
      removeExistingUI();
      document.body.insertAdjacentHTML("beforeend", createLobbyHTML());
      const fab = document.getElementById("chat-lobby-fab");
      if (fab) {
        fab.style.display = "flex";
      }
      setupHandlers();
      setupEventDelegation();
      setupSillyTavernEvents();
      startBackgroundPreload();
      addLobbyToOptionsMenu();
      setTimeout(() => addToCustomThemeSidebar(), CONFIG.timing.initDelay);
    }
    function setupSillyTavernEvents() {
      const context = window.SillyTavern?.getContext?.();
      if (!context?.eventSource) {
        console.warn("[ChatLobby] SillyTavern eventSource not found");
        return;
      }
      if (eventsRegistered) {
        return;
      }
      const { eventSource, eventTypes } = context;
      eventHandlers = {
        onCharacterDeleted: () => {
          cache.invalidate("characters");
          if (isLobbyOpen()) {
            renderCharacterGrid(store.searchTerm);
          }
        },
        onCharacterEdited: () => {
          cache.invalidate("characters");
        },
        onCharacterAdded: () => {
          cache.invalidate("characters");
          if (isLobbyOpen()) {
            renderCharacterGrid(store.searchTerm);
          }
        },
        onChatChanged: () => {
          cache.invalidate("characters");
          cache.invalidate("chats");
        },
        // 메시지 전송/수신 이벤트 (현재 미사용)
        onMessageSent: () => {
        },
        onMessageReceived: () => {
        }
      };
      eventSource.on(eventTypes.CHARACTER_DELETED, eventHandlers.onCharacterDeleted);
      if (eventTypes.CHARACTER_EDITED) {
        eventSource.on(eventTypes.CHARACTER_EDITED, eventHandlers.onCharacterEdited);
      }
      if (eventTypes.CHARACTER_ADDED) {
        eventSource.on(eventTypes.CHARACTER_ADDED, eventHandlers.onCharacterAdded);
      }
      eventSource.on(eventTypes.CHAT_CHANGED, eventHandlers.onChatChanged);
      if (eventTypes.MESSAGE_SENT) {
        eventSource.on(eventTypes.MESSAGE_SENT, eventHandlers.onMessageSent);
      }
      if (eventTypes.MESSAGE_RECEIVED) {
        eventSource.on(eventTypes.MESSAGE_RECEIVED, eventHandlers.onMessageReceived);
      }
      if (eventTypes.USER_MESSAGE_RENDERED) {
        eventSource.on(eventTypes.USER_MESSAGE_RENDERED, eventHandlers.onMessageSent);
      }
      if (eventTypes.CHARACTER_MESSAGE_RENDERED) {
        eventSource.on(eventTypes.CHARACTER_MESSAGE_RENDERED, eventHandlers.onMessageReceived);
      }
      eventsRegistered = true;
    }
    function cleanupSillyTavernEvents() {
      if (!eventHandlers || !eventsRegistered) return;
      const context = window.SillyTavern?.getContext?.();
      if (!context?.eventSource) return;
      const { eventSource, eventTypes } = context;
      try {
        eventSource.off?.(eventTypes.CHARACTER_DELETED, eventHandlers.onCharacterDeleted);
        eventSource.off?.(eventTypes.CHARACTER_EDITED, eventHandlers.onCharacterEdited);
        eventSource.off?.(eventTypes.CHARACTER_ADDED, eventHandlers.onCharacterAdded);
        eventSource.off?.(eventTypes.CHAT_CHANGED, eventHandlers.onChatChanged);
        eventSource.off?.(eventTypes.MESSAGE_SENT, eventHandlers.onMessageSent);
        eventSource.off?.(eventTypes.MESSAGE_RECEIVED, eventHandlers.onMessageReceived);
        eventSource.off?.(eventTypes.USER_MESSAGE_RENDERED, eventHandlers.onMessageSent);
        eventSource.off?.(eventTypes.CHARACTER_MESSAGE_RENDERED, eventHandlers.onMessageReceived);
        eventsRegistered = false;
        eventHandlers = null;
      } catch (e) {
        console.warn("[ChatLobby] Failed to cleanup events:", e);
      }
    }
    function isLobbyOpen() {
      return store.isLobbyOpen;
    }
    function removeExistingUI() {
      ["chat-lobby-overlay", "chat-lobby-fab", "chat-lobby-folder-modal", "chat-lobby-global-tooltip", "chat-preview-tooltip"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });
    }
    function setupHandlers() {
      setCharacterSelectHandler((character) => {
        renderChatList(character);
      });
      setChatHandlers({
        onOpen: openChat,
        onDelete: deleteChat
      });
    }
    async function startBackgroundPreload() {
      setTimeout(async () => {
        await cache.preloadAll(api);
        const characters = cache.get("characters");
        if (characters && characters.length > 0) {
          const recent = [...characters].sort((a, b) => (b.date_last_chat || 0) - (a.date_last_chat || 0)).slice(0, 5);
          await cache.preloadRecentChats(api, recent);
        }
      }, CONFIG.timing.preloadDelay);
    }
    async function openLobby() {
      const chatsPanel = document.getElementById("chat-lobby-chats");
      if (store.isLobbyOpen && chatsPanel?.classList.contains("visible")) {
        return;
      }
      const overlay = document.getElementById("chat-lobby-overlay");
      const container = document.getElementById("chat-lobby-container");
      const fab = document.getElementById("chat-lobby-fab");
      if (overlay) {
        overlay.style.display = "flex";
        if (container) container.style.display = "flex";
        if (fab) fab.style.display = "none";
        if (!store.onCharacterSelect) {
          console.warn("[ChatLobby] Handler not set, re-running setupHandlers");
          setupHandlers();
        }
        store.reset();
        store.setLobbyOpen(true);
        try {
          const context = api.getContext();
          if (typeof context?.getCharacters === "function") {
            await context.getCharacters();
          }
        } catch (error) {
          console.warn("[ChatLobby] Failed to refresh characters:", error);
        }
        const data = storage.load();
        if (data.filterFolder && data.filterFolder !== "all" && data.filterFolder !== "favorites" && data.filterFolder !== "uncategorized") {
          const folderExists = data.folders?.some((f) => f.id === data.filterFolder);
          if (!folderExists) {
            storage.setFilterFolder("all");
          }
        }
        if (store.batchModeActive) {
          toggleBatchMode();
        }
        closeChatPanel();
        const characters = api.getCharacters();
        await Promise.all([
          renderPersonaBar(),
          renderCharacterGrid()
        ]);
        setupPersonaWheelScroll();
        updateFolderDropdowns();
        const currentContext = api.getContext();
        if (currentContext?.characterId !== void 0 && currentContext.characterId >= 0) {
          const currentChar = currentContext.characters?.[currentContext.characterId];
          if (currentChar) {
            setTimeout(() => {
              const charCard = document.querySelector(
                `.lobby-char-card[data-char-avatar="${currentChar.avatar}"]`
              );
              if (charCard) {
                charCard.classList.add("selected");
              }
            }, 200);
          }
        }
      }
    }
    async function closeLobby() {
      const container = document.getElementById("chat-lobby-container");
      const fab = document.getElementById("chat-lobby-fab");
      if (container) container.style.display = "none";
      if (fab) fab.style.display = "flex";
      intervalManager.clearAll();
      const sidebarBtn = document.getElementById("st-chatlobby-sidebar-btn");
      if (sidebarBtn) {
        const icon = sidebarBtn.querySelector(".drawer-icon");
        icon?.classList.remove("openIcon");
        icon?.classList.add("closedIcon");
      }
      store.setLobbyOpen(false);
      store.reset();
      closeChatPanel();
    }
    window.ChatLobby = window.ChatLobby || {};
    function cleanup() {
      cleanupSillyTavernEvents();
      cleanupEventDelegation();
      cleanupIntegration();
      cleanupTooltip();
      intervalManager.clearAll();
      removeExistingUI();
    }
    if (window.ChatLobby._cleanup) {
      window.ChatLobby._cleanup();
    }
    window.ChatLobby._cleanup = cleanup;
    window.ChatLobby.refresh = async function() {
      cache.invalidateAll();
      const context = api.getContext();
      if (typeof context?.getCharacters === "function") {
        await context.getCharacters();
      }
      await renderPersonaBar();
      await renderCharacterGrid();
    };
    window.chatLobbyRefresh = window.ChatLobby.refresh;
    let eventsInitialized = false;
    let refreshGridHandler = null;
    function setupEventDelegation() {
      if (eventsInitialized) return;
      eventsInitialized = true;
      document.body.addEventListener("click", handleBodyClick);
      document.addEventListener("keydown", handleKeydown);
      const searchInput = document.getElementById("chat-lobby-search-input");
      if (searchInput) {
        searchInput.addEventListener("input", (e) => handleSearch(e.target.value));
      }
      bindDropdownEvents();
      refreshGridHandler = () => {
        renderCharacterGrid(store.searchTerm);
      };
      window.addEventListener("chatlobby:refresh-grid", refreshGridHandler);
    }
    function cleanupEventDelegation() {
      if (!eventsInitialized) return;
      document.body.removeEventListener("click", handleBodyClick);
      document.removeEventListener("keydown", handleKeydown);
      if (refreshGridHandler) {
        window.removeEventListener("chatlobby:refresh-grid", refreshGridHandler);
        refreshGridHandler = null;
      }
      eventsInitialized = false;
    }
    function setupPersonaWheelScroll() {
      const personaList = document.getElementById("chat-lobby-persona-list");
      if (!personaList) return;
      if (personaList.dataset.wheelBound) return;
      personaList.dataset.wheelBound = "true";
      personaList.addEventListener("wheel", (e) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          personaList.scrollLeft += e.deltaY;
        }
      }, { passive: false });
    }
    function toggleCollapse() {
      const leftPanel = document.getElementById("chat-lobby-left");
      const collapseBtn = document.getElementById("chat-lobby-collapse-btn");
      if (!leftPanel || !collapseBtn) return;
      const isCollapsed = leftPanel.classList.toggle("collapsed");
      collapseBtn.textContent = isCollapsed ? "\u25BC" : "\u25B2";
      localStorage.setItem("chatlobby-collapsed", isCollapsed.toString());
    }
    function toggleTheme() {
      const container = document.getElementById("chat-lobby-container");
      const themeBtn = document.getElementById("chat-lobby-theme-toggle");
      if (!container || !themeBtn) return;
      const isCurrentlyDark = container.classList.contains("dark-mode");
      if (isCurrentlyDark) {
        container.classList.remove("dark-mode");
        container.classList.add("light-mode");
        themeBtn.textContent = "\u{1F319}";
        localStorage.setItem("chatlobby-theme", "light");
      } else {
        container.classList.remove("light-mode");
        container.classList.add("dark-mode");
        themeBtn.textContent = "\u2600\uFE0F";
        localStorage.setItem("chatlobby-theme", "dark");
      }
    }
    function handleBodyClick(e) {
      const target = e.target;
      if (target.id === "chat-lobby-fab" || target.closest("#chat-lobby-fab")) {
        openLobby();
        return;
      }
      const lobbyContainer = target.closest("#chat-lobby-container");
      const folderModal = target.closest("#chat-lobby-folder-modal");
      if (!lobbyContainer && !folderModal) {
        return;
      }
      if (target.closest(".lobby-char-card") || target.closest(".lobby-chat-item")) {
        return;
      }
      const actionEl = target.closest("[data-action]");
      if (actionEl) {
        handleAction(actionEl.dataset.action, actionEl, e);
        return;
      }
    }
    async function handleAction(action, el, e) {
      switch (action) {
        case "open-lobby":
          openLobby();
          break;
        case "close-lobby":
          await closeLobby();
          break;
        case "open-stats":
          openStatsView();
          break;
        case "close-stats":
          closeStatsView();
          break;
        case "refresh":
          handleRefresh();
          break;
        case "new-chat":
          startNewChat();
          break;
        case "delete-char":
          deleteCharacter();
          break;
        case "add-persona":
          handleAddPersona();
          break;
        case "import-char":
          handleImportCharacter();
          break;
        case "toggle-batch":
          toggleBatchMode();
          break;
        case "batch-cancel":
          toggleBatchMode();
          break;
        case "open-folder-modal":
          openFolderModal();
          break;
        case "close-folder-modal":
          closeFolderModal();
          break;
        case "add-folder":
          addFolder();
          break;
        case "close-chat-panel":
          closeChatPanel();
          break;
        case "go-to-character":
          handleGoToCharacter();
          break;
        case "toggle-collapse":
          toggleCollapse();
          break;
        case "toggle-theme":
          toggleTheme();
          break;
      }
    }
    function handleKeydown(e) {
      if (e.key === "Escape") {
        if (isStatsViewOpen()) {
          closeStatsView();
          return;
        }
        const folderModal = document.getElementById("chat-lobby-folder-modal");
        if (folderModal?.style.display === "flex") {
          closeFolderModal();
        } else if (store.isLobbyOpen) {
          closeLobby();
        }
      }
      if (e.key === "Enter" && e.target.id === "new-folder-name") {
        addFolder();
      }
    }
    function bindDropdownEvents() {
      document.getElementById("chat-lobby-char-sort")?.addEventListener("change", (e) => {
        handleSortChange2(e.target.value);
      });
      document.getElementById("chat-lobby-folder-filter")?.addEventListener("change", (e) => {
        handleFilterChange(e.target.value);
      });
      document.getElementById("chat-lobby-chat-sort")?.addEventListener("change", (e) => {
        handleSortChange(e.target.value);
      });
      document.getElementById("chat-lobby-chats-list")?.addEventListener("change", (e) => {
        if (e.target.classList.contains("chat-select-cb")) {
          updateBatchCount();
        }
      });
    }
    async function handleRefresh() {
      cache.invalidateAll();
      await api.fetchPersonas();
      await api.fetchCharacters(true);
      await renderPersonaBar();
      await renderCharacterGrid();
      showToast("\uC0C8\uB85C\uACE0\uCE68 \uC644\uB8CC", "success");
    }
    function handleImportCharacter() {
      const importBtn = document.getElementById("character_import_button");
      if (!importBtn) return;
      const beforeAvatars = new Set(
        api.getCharacters().map((c) => c.avatar)
      );
      importBtn.click();
      let attempts = 0;
      let isChecking = false;
      let isCleared = false;
      const maxAttempts = 10;
      const checkInterval = intervalManager.set(async () => {
        if (isCleared || isChecking) return;
        isChecking = true;
        try {
          attempts++;
          const currentChars = api.getCharacters();
          const newChar = currentChars.find((c) => !beforeAvatars.has(c.avatar));
          if (newChar) {
            isCleared = true;
            intervalManager.clear(checkInterval);
            cache.invalidate("characters");
            if (isLobbyOpen()) {
              await renderCharacterGrid(store.searchTerm);
            }
            showToast(`"${newChar.name}" \uCE90\uB9AD\uD130\uAC00 \uCD94\uAC00\uB418\uC5C8\uC2B5\uB2C8\uB2E4!`, "success");
            return;
          }
          if (attempts >= maxAttempts) {
            isCleared = true;
            intervalManager.clear(checkInterval);
          }
        } finally {
          isChecking = false;
        }
      }, 500);
    }
    async function handleAddPersona() {
      if (!openDrawerSafely("persona-management-button")) {
        showToast("\uD398\uB974\uC18C\uB098 \uAD00\uB9AC\uB97C \uC5F4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", "error");
        return;
      }
      const createBtn = await waitForElement("#create_dummy_persona", 2e3);
      if (createBtn) {
        createBtn.click();
        cache.invalidate("personas");
        let checkCount = 0;
        const maxChecks = 60;
        const checkDrawerClosed = intervalManager.set(() => {
          checkCount++;
          const drawer = document.getElementById("persona-management-button");
          const isOpen = drawer?.classList.contains("openDrawer") || drawer?.querySelector(".drawer-icon.openIcon");
          if (!isOpen || checkCount >= maxChecks) {
            intervalManager.clear(checkDrawerClosed);
            if (checkCount >= maxChecks) {
            } else {
            }
            cache.invalidate("personas");
            if (isLobbyOpen()) {
              renderPersonaBar();
            }
          }
        }, 500);
      } else {
        showToast("\uD398\uB974\uC18C\uB098 \uC0DD\uC131 \uBC84\uD2BC\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4", "error");
      }
    }
    async function handleGoToCharacter() {
      const character = store.currentCharacter;
      if (!character) {
        console.warn("[ChatLobby] No character selected");
        return;
      }
      const context = api.getContext();
      const characters = context?.characters || [];
      const index = characters.findIndex((c) => c.avatar === character.avatar);
      if (index === -1) {
        console.error("[ChatLobby] Character not found:", character.avatar);
        return;
      }
      closeLobby();
      const isAlreadySelected = context.characterId === index;
      if (!isAlreadySelected) {
        await api.selectCharacterById(index);
        const charSelected = await waitForCharacterSelect(character.avatar, 2e3);
        if (!charSelected) {
          console.warn("[ChatLobby] Character selection timeout");
        }
      }
      if (!openDrawerSafely("rightNavHolder")) {
        const rightNavIcon = document.getElementById("rightNavDrawerIcon");
        if (rightNavIcon) {
          rightNavIcon.click();
        } else {
          console.warn("[ChatLobby] Could not open character drawer");
        }
      }
    }
    function handleOpenCharSettings() {
      closeLobby();
      setTimeout(() => {
        const charInfoBtn = document.getElementById("option_settings");
        if (charInfoBtn) charInfoBtn.click();
      }, CONFIG.timing.menuCloseDelay);
    }
    function addLobbyToOptionsMenu() {
      const optionsMenu = document.getElementById("options");
      if (!optionsMenu) {
        setTimeout(addLobbyToOptionsMenu, CONFIG.timing.initDelay);
        return;
      }
      if (document.getElementById("option_chat_lobby")) return;
      const lobbyOption = document.createElement("a");
      lobbyOption.id = "option_chat_lobby";
      lobbyOption.innerHTML = '<i class="fa-solid fa-comments"></i> Chat Lobby';
      lobbyOption.style.cssText = "cursor: pointer;";
      lobbyOption.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const optionsContainer = document.getElementById("options");
        if (optionsContainer) optionsContainer.style.display = "none";
        openLobby();
      });
      optionsMenu.insertBefore(lobbyOption, optionsMenu.firstChild);
    }
    function addToCustomThemeSidebar() {
      if (window._chatLobbyCustomThemeInit) return true;
      window._chatLobbyCustomThemeInit = true;
      const addSidebarButton = () => {
        const container = document.getElementById("st-sidebar-top-container");
        if (!container) return false;
        if (document.getElementById("st-chatlobby-sidebar-btn")) return true;
        const btn = document.createElement("div");
        btn.id = "st-chatlobby-sidebar-btn";
        btn.className = "drawer st-moved-drawer";
        btn.innerHTML = `
                <div class="drawer-toggle">
                    <div class="drawer-icon fa-solid fa-comments closedIcon" title="Chat Lobby"></div>
                    <span class="st-sidebar-label">Chat Lobby</span>
                </div>
            `;
        btn.querySelector(".drawer-toggle").addEventListener("click", () => openLobby());
        container.appendChild(btn);
        return true;
      };
      const addHamburgerButton = () => {
        const dropdown = document.getElementById("st-hamburger-dropdown-content");
        if (!dropdown) return false;
        if (document.getElementById("st-chatlobby-hamburger-btn")) return true;
        const btn = document.createElement("div");
        btn.id = "st-chatlobby-hamburger-btn";
        btn.className = "st-dropdown-item";
        btn.innerHTML = `
                <i class="fa-solid fa-comments"></i>
                <span>Chat Lobby</span>
            `;
        btn.addEventListener("click", () => {
          openLobby();
          document.getElementById("st-hamburger-dropdown")?.classList.remove("st-dropdown-open");
        });
        dropdown.appendChild(btn);
        return true;
      };
      const setupHamburgerObserver = () => {
        const dropdown = document.getElementById("st-hamburger-dropdown-content");
        if (!dropdown) {
          if (!setupHamburgerObserver._attempts) setupHamburgerObserver._attempts = 0;
          if (++setupHamburgerObserver._attempts < 20) {
            setTimeout(setupHamburgerObserver, 500);
          }
          return;
        }
        addHamburgerButton();
        if (hamburgerObserver) {
          hamburgerObserver.disconnect();
          hamburgerObserver = null;
        }
        hamburgerObserver = new MutationObserver(() => {
          if (!document.getElementById("st-chatlobby-hamburger-btn")) {
            addHamburgerButton();
          }
        });
        hamburgerObserver.observe(dropdown, { childList: true });
      };
      if (!addSidebarButton()) {
        let attempts = 0;
        const interval = intervalManager.set(() => {
          attempts++;
          if (addSidebarButton() || attempts >= 20) {
            intervalManager.clear(interval);
          }
        }, 500);
      }
      setupHamburgerObserver();
      return true;
    }
    function cleanupIntegration() {
      if (hamburgerObserver) {
        hamburgerObserver.disconnect();
        hamburgerObserver = null;
      }
      window._chatLobbyCustomThemeInit = false;
    }
    async function waitForSillyTavern(maxAttempts = 30, interval = 500) {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const context = window.SillyTavern?.getContext?.();
        if (context && context.characters) {
          return true;
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
      console.error("[ChatLobby] SillyTavern context not available after", maxAttempts * interval, "ms");
      return false;
    }
    async function initAndOpen() {
      const isReady = await waitForSillyTavern();
      if (!isReady) {
        console.error("[ChatLobby] Cannot initialize - SillyTavern not ready");
        return;
      }
      await init();
      setTimeout(() => {
        openLobby();
      }, 100);
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => setTimeout(initAndOpen, CONFIG.timing.initDelay));
    } else {
      setTimeout(initAndOpen, CONFIG.timing.initDelay);
    }
  })();
})();
