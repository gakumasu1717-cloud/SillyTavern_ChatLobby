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
  var CONFIG, DEFAULT_DATA;
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
      DEFAULT_DATA = {
        folders: [
          { id: "favorites", name: "\u2B50 \uC990\uACA8\uCC3E\uAE30", isSystem: true, order: 0 },
          { id: "uncategorized", name: "\u{1F4C1} \uBBF8\uBD84\uB958", isSystem: true, order: 999 }
        ],
        chatAssignments: {},
        favorites: [],
        sortOption: "recent",
        filterFolder: "all",
        collapsedFolders: [],
        charSortOption: "name",
        // 기본값: 이름순 (채팅수는 캐시 문제로 권장 안함)
        autoFavoriteRules: {
          recentDays: 0
        }
      };
    }
  });

  // src/data/cache.js
  var CacheManager, cache;
  var init_cache = __esm({
    "src/data/cache.js"() {
      init_config();
      CacheManager = class {
        constructor() {
          this.stores = {
            chats: /* @__PURE__ */ new Map(),
            // 캐릭터별 채팅 목록
            chatCounts: /* @__PURE__ */ new Map(),
            // 캐릭터별 채팅 수
            personas: null,
            // 페르소나 목록
            characters: null
            // 캐릭터 목록
          };
          this.timestamps = {
            chats: /* @__PURE__ */ new Map(),
            chatCounts: /* @__PURE__ */ new Map(),
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
         * 전체 캐시 무효화
         */
        invalidateAll() {
          Object.keys(this.stores).forEach((type) => {
            this.invalidate(type);
          });
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
          console.log("[Cache] Starting preload...");
          const promises = [];
          if (!this.preloadStatus.personas) {
            promises.push(
              this.preloadPersonas(api2).then(() => {
                this.preloadStatus.personas = true;
                console.log("[Cache] Personas preloaded");
              })
            );
          }
          if (!this.preloadStatus.characters) {
            promises.push(
              this.preloadCharacters(api2).then(() => {
                this.preloadStatus.characters = true;
                console.log("[Cache] Characters preloaded");
              })
            );
          }
          await Promise.all(promises);
          console.log("[Cache] Preload complete");
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
          console.log("[Cache] Preloading recent chats for", recentCharacters.length, "characters");
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
          console.log("[Cache] Recent chats preload complete");
        }
      };
      cache = new CacheManager();
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
  function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
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
      toastContainer = null;
    }
  });

  // src/data/storage.js
  var StorageManager, storage;
  var init_storage = __esm({
    "src/data/storage.js"() {
      init_config();
      StorageManager = class {
        constructor() {
          this._data = null;
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
                  console.log('[Storage] Resetting invalid filterFolder to "all"');
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
            if (typeof window !== "undefined") {
              Promise.resolve().then(() => (init_notifications(), notifications_exports)).then(({ showToast: showToast2 }) => {
                showToast2("\uB370\uC774\uD130 \uC800\uC7A5\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uC800\uC7A5 \uACF5\uAC04\uC744 \uD655\uC778\uD574\uC8FC\uC138\uC694.", "error");
              }).catch(() => {
                alert("\uB370\uC774\uD130 \uC800\uC7A5\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
              });
            }
          }
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
          console.log("[Storage] ========== MOVE BATCH START ==========");
          console.log("[Storage] chatKeys:", chatKeys);
          console.log("[Storage] targetFolderId:", targetFolderId);
          this.update((data) => {
            console.log("[Storage] Before update - chatAssignments:", JSON.stringify(data.chatAssignments));
            chatKeys.forEach((key) => {
              const oldFolder = data.chatAssignments[key] || "uncategorized";
              console.log(`[Storage] Moving "${key}": ${oldFolder} -> ${targetFolderId}`);
              data.chatAssignments[key] = targetFolderId;
            });
            console.log("[Storage] After update - chatAssignments:", JSON.stringify(data.chatAssignments));
          });
          console.log("[Storage] ========== MOVE BATCH END ==========");
        }
      };
      storage = new StorageManager();
    }
  });

  // src/data/store.js
  var Store, store;
  var init_store = __esm({
    "src/data/store.js"() {
      Store = class {
        constructor() {
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
            searchTerm: "",
            // 콜백 핸들러
            onCharacterSelect: null,
            chatHandlers: {
              onOpen: null,
              onDelete: null
            }
          };
          this._listeners = /* @__PURE__ */ new Map();
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
          this._notify("currentCharacter", character);
        }
        /**
         * 배치 모드 토글
         * @returns {boolean} 새 배치 모드 상태
         */
        toggleBatchMode() {
          this._state.batchModeActive = !this._state.batchModeActive;
          this._notify("batchModeActive", this._state.batchModeActive);
          return this._state.batchModeActive;
        }
        /**
         * 배치 모드 직접 설정
         * @param {boolean} active
         */
        setBatchMode(active) {
          this._state.batchModeActive = active;
          this._notify("batchModeActive", active);
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
          this._notify("isLobbyOpen", open);
        }
        /**
         * 검색어 설정
         * @param {string} term
         */
        setSearchTerm(term) {
          this._state.searchTerm = term;
          this._notify("searchTerm", term);
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
          this._state.searchTerm = "";
          console.log("[Store] State reset, handlers preserved");
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
            this._listeners.set(key, /* @__PURE__ */ new Set());
          }
          this._listeners.get(key).add(callback);
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
          this._listeners.get(key)?.forEach((callback) => {
            try {
              callback(value);
            } catch (e) {
              console.error("[Store] Listener error:", e);
            }
          });
        }
      };
      store = new Store();
    }
  });

  // src/api/sillyTavern.js
  var SillyTavernAPI, api;
  var init_sillyTavern = __esm({
    "src/api/sillyTavern.js"() {
      init_cache();
      init_config();
      SillyTavernAPI = class {
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
                const powerUserModule = await import("../../../../power-user.js");
                personaNames = powerUserModule.power_user?.personas || {};
              } catch (e) {
                console.warn("[API] Could not import power_user:", e.message);
              }
              const personas = avatars.map((avatarId) => ({
                key: avatarId,
                name: personaNames[avatarId] || avatarId.replace(/\.(png|jpg|webp)$/i, "")
              }));
              personas.sort((a, b) => {
                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();
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
              });
              cache.set("personas", personas);
              return personas;
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
            const personasModule = await import("../../../../personas.js");
            if (typeof personasModule.setUserAvatar === "function") {
              await personasModule.setUserAvatar(personaKey);
              return true;
            }
          } catch (e) {
            const context = this.getContext();
            if (typeof context?.setUserAvatar === "function") {
              await context.setUserAvatar(personaKey);
              return true;
            }
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
              console.log("[API] Persona deleted, cache invalidated");
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
         * 캐릭터 즐겨찾기 토글
         * SillyTavern의 favorite_button 클릭과 동일하게 동작
         * @param {string} charAvatar - 캐릭터 아바타
         * @param {boolean} newFavState - 새로운 즐겨찾기 상태
         * @returns {Promise<boolean>}
         */
        async toggleCharacterFavorite(charAvatar, newFavState) {
          try {
            console.log("[API] Toggling favorite for:", charAvatar, "to:", newFavState);
            const context = this.getContext();
            const char = context?.characters?.find((c) => c.avatar === charAvatar);
            if (!char) {
              console.error("[API] Character not found:", charAvatar);
              return false;
            }
            const editPayload = {
              avatar_url: charAvatar,
              ch_name: char.name,
              field: "fav",
              value: newFavState
            };
            console.log("[API] Edit payload:", editPayload);
            const response = await this.fetchWithRetry("/api/characters/edit-attribute", {
              method: "POST",
              headers: this.getRequestHeaders(),
              body: JSON.stringify(editPayload)
            });
            if (response.ok) {
              char.fav = newFavState;
              if (char.data) {
                char.data.fav = newFavState;
              }
              cache.invalidate("characters");
              console.log("[API] Favorite toggled successfully");
              return true;
            }
            console.error("[API] Response not ok:", response.status);
            return false;
          } catch (error) {
            console.error("[API] Failed to toggle favorite:", error);
            return false;
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
            console.log("[API] Using cached chats for:", characterAvatar);
            return cache.get("chats", characterAvatar);
          }
          return cache.getOrFetch(`chats_${characterAvatar}`, async () => {
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
              const result = data || [];
              cache.set("chats", result, characterAvatar);
              const count = Array.isArray(result) ? result.length : 0;
              cache.set("chatCounts", count, characterAvatar);
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
          console.log("[API] Opening character editor for index:", characterIndex);
          await this.selectCharacterById(characterIndex);
          await this.delay(300);
          const settingsBtn = document.getElementById("option_settings");
          if (settingsBtn) {
            console.log("[API] Clicking option_settings button");
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
          console.log("[API] Opening chat file:", fileName, "for character:", characterAvatar);
          const context = this.getContext();
          if (context?.openChat) {
            try {
              await context.openChat(fileName);
              console.log("[API] Chat opened via context.openChat");
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
                  console.log("[API] Chat loaded via /api/chats/get");
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
      api = new SillyTavernAPI();
    }
  });

  // src/utils/textUtils.js
  function escapeHtml2(text) {
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

  // src/utils/eventHelpers.js
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
      if (now - lastHandleTime < 100) {
        console.log(`[EventHelper] ${debugName}: Duplicate ${source} event ignored`);
        return;
      }
      if (isScrolling) {
        console.log(`[EventHelper] ${debugName}: ${source} ignored (scrolling)`);
        return;
      }
      lastHandleTime = now;
      console.log(`[EventHelper] ${debugName}: ${source} event fired`);
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
        console.log(`[EventHelper] ${debugName}: click ignored (touch already handled)`);
      }
      touchHandled = false;
    });
  }
  var isMobile;
  var init_eventHelpers = __esm({
    "src/utils/eventHelpers.js"() {
      init_config();
      isMobile = () => window.innerWidth <= CONFIG.ui.mobileBreakpoint || "ontouchstart" in window;
    }
  });

  // src/ui/characterGrid.js
  var characterGrid_exports = {};
  __export(characterGrid_exports, {
    handleSearch: () => handleSearch,
    handleSortChange: () => handleSortChange,
    renderCharacterGrid: () => renderCharacterGrid,
    setCharacterSelectHandler: () => setCharacterSelectHandler
  });
  function setCharacterSelectHandler(handler) {
    store.setCharacterSelectHandler(handler);
  }
  async function renderCharacterGrid(searchTerm = "", sortOverride = null) {
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
  }
  async function renderCharacterList(container, characters, searchTerm, sortOverride) {
    let filtered = [...characters];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (char) => (char.name || "").toLowerCase().includes(term)
      );
    }
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
    container.innerHTML = filtered.map((char) => {
      const originalIndex = originalCharacters.indexOf(char);
      return renderCharacterCard(char, originalIndex);
    }).join("");
    bindCharacterEvents(container);
  }
  function renderCharacterCard(char, index) {
    const avatarUrl = char.avatar ? `/characters/${encodeURIComponent(char.avatar)}` : "/img/ai4.png";
    const name = char.name || "Unknown";
    const safeAvatar = (char.avatar || "").replace(/"/g, "&quot;");
    const isFav = isFavoriteChar(char);
    const favBtn = `<button class="char-fav-btn" data-char-avatar="${safeAvatar}" title="\uC990\uACA8\uCC3E\uAE30 \uD1A0\uAE00">${isFav ? "\u2B50" : "\u2606"}</button>`;
    return `
    <div class="lobby-char-card ${isFav ? "is-char-fav" : ""}" 
         data-char-index="${index}" 
         data-char-avatar="${safeAvatar}" 
         data-is-fav="${isFav}">
        ${favBtn}
        <img class="lobby-char-avatar" src="${avatarUrl}" alt="${name}" onerror="this.src='/img/ai4.png'">
        <div class="lobby-char-name">${escapeHtml2(name)}</div>
    </div>
    `;
  }
  function isFavoriteChar(char) {
    return !!(char.fav === true || char.fav === "true" || char.data?.extensions?.fav);
  }
  async function sortCharacters(characters, sortOption) {
    console.log("[CharacterGrid] ========== SORT START ==========");
    console.log("[CharacterGrid] sortOption:", sortOption);
    console.log("[CharacterGrid] characters count:", characters.length);
    if (sortOption === "chats") {
      const results = await Promise.all(characters.map(async (char) => {
        let count = cache.get("chatCounts", char.avatar);
        if (typeof count !== "number") {
          try {
            count = await api.getChatCount(char.avatar);
          } catch (e) {
            console.error("[CharacterGrid] Failed to get chat count for:", char.name, e);
            count = 0;
          }
        }
        return { char, count };
      }));
      results.sort((a, b) => {
        if (isFavoriteChar(a.char) !== isFavoriteChar(b.char)) {
          return isFavoriteChar(a.char) ? -1 : 1;
        }
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return (a.char.name || "").localeCompare(b.char.name || "", "ko");
      });
      console.log("[CharacterGrid] Sorted by chats, first 5:", results.slice(0, 5).map((r) => ({ name: r.char.name, count: r.count, fav: isFavoriteChar(r.char) })));
      console.log("[CharacterGrid] ========== SORT END ==========");
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
      const aDate = a.date_last_chat || a.last_mes || 0;
      const bDate = b.date_last_chat || b.last_mes || 0;
      return bDate - aDate;
    });
    console.log("[CharacterGrid] Sorted by", sortOption, ", first 5:", sorted.slice(0, 5).map((c) => ({ name: c.name, fav: isFavoriteChar(c), date: c.date_last_chat })));
    console.log("[CharacterGrid] ========== SORT END ==========");
    return sorted;
  }
  function bindCharacterEvents(container) {
    container.querySelectorAll(".lobby-char-card").forEach((card, index) => {
      const charName = card.querySelector(".lobby-char-name")?.textContent || "Unknown";
      const charAvatar = card.dataset.charAvatar;
      const favBtn = card.querySelector(".char-fav-btn");
      if (favBtn) {
        createTouchClickHandler(favBtn, async (e) => {
          e.stopPropagation();
          console.log("[CharacterGrid] ========== FAVORITE TOGGLE START ==========");
          console.log("[CharacterGrid] Target:", charName, charAvatar);
          const context = api.getContext();
          const characters = context?.characters || [];
          const charIndex = characters.findIndex((c) => c.avatar === charAvatar);
          console.log("[CharacterGrid] Character index:", charIndex);
          if (charIndex === -1) {
            console.error("[CharacterGrid] Character not found:", charAvatar);
            showToast("\uCE90\uB9AD\uD130\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", "error");
            return;
          }
          const currentFav = card.dataset.isFav === "true";
          const newFavState = !currentFav;
          console.log("[CharacterGrid] Current fav:", currentFav, "-> New fav:", newFavState);
          try {
            const success = await api.toggleCharacterFavorite(charAvatar, newFavState);
            if (success) {
              console.log("[CharacterGrid] Updating UI only (no re-render)");
              favBtn.textContent = newFavState ? "\u2B50" : "\u2606";
              card.dataset.isFav = newFavState.toString();
              card.classList.toggle("is-char-fav", newFavState);
              showToast(newFavState ? "\uC990\uACA8\uCC3E\uAE30\uC5D0 \uCD94\uAC00\uB418\uC5C8\uC2B5\uB2C8\uB2E4." : "\uC990\uACA8\uCC3E\uAE30\uC5D0\uC11C \uC81C\uAC70\uB418\uC5C8\uC2B5\uB2C8\uB2E4.", "success");
              console.log("[CharacterGrid] ========== FAVORITE TOGGLE END ==========");
            } else {
              console.error("[CharacterGrid] API call failed");
              showToast("\uC990\uACA8\uCC3E\uAE30 \uBCC0\uACBD\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", "error");
            }
          } catch (error) {
            console.error("[CharacterGrid] Favorite toggle error:", error);
            showToast("\uC990\uACA8\uCC3E\uAE30 \uBCC0\uACBD\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", "error");
          }
        }, { preventDefault: true, stopPropagation: true, debugName: `char-fav-${index}` });
      }
      createTouchClickHandler(card, () => {
        console.log("[CharacterGrid] Card click handler fired for:", charName);
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
        console.log("[CharacterGrid] Character data:", characterData);
        const handler = store.onCharacterSelect;
        if (handler && typeof handler === "function") {
          console.log("[CharacterGrid] Calling onCharacterSelect handler");
          try {
            handler(characterData);
          } catch (error) {
            console.error("[CharacterGrid] Handler error:", error);
          }
        } else {
          console.error("[CharacterGrid] onCharacterSelect handler not available!", {
            handler,
            handlerType: typeof handler
          });
        }
      }, { preventDefault: true, stopPropagation: true, debugName: `char-${index}-${charName}` });
    });
  }
  function handleSortChange(sortOption) {
    storage.setCharSortOption(sortOption);
    const searchTerm = store.searchTerm;
    renderCharacterGrid(searchTerm, sortOption);
  }
  var handleSearch;
  var init_characterGrid = __esm({
    "src/ui/characterGrid.js"() {
      init_sillyTavern();
      init_cache();
      init_storage();
      init_store();
      init_textUtils();
      init_eventHelpers();
      init_notifications();
      init_config();
      handleSearch = debounce((searchTerm) => {
        renderCharacterGrid(searchTerm);
      }, CONFIG.ui.debounceWait);
    }
  });

  // src/index.js
  init_config();
  init_cache();
  init_storage();
  init_store();
  init_sillyTavern();

  // src/ui/templates.js
  init_storage();
  function createLobbyHTML() {
    return `
    <div id="chat-lobby-fab" title="Chat Lobby \uC5F4\uAE30">\u{1F4AC}</div>
    <div id="chat-lobby-overlay" style="display: none;">
        <div id="chat-lobby-container">
            <div id="chat-lobby-header">
                <h2>Chat Lobby</h2>
                <div class="header-actions">
                    <button id="chat-lobby-refresh" title="\uC0C8\uB85C\uACE0\uCE68">\u{1F504}</button>
                    <button id="chat-lobby-import-char" title="\uCE90\uB9AD\uD130 \uC784\uD3EC\uD2B8">\u{1F4E5}</button>
                    <button id="chat-lobby-add-persona" title="\uD398\uB974\uC18C\uB098 \uCD94\uAC00">\u{1F464}</button>
                    <button id="chat-lobby-close">\u2715</button>
                </div>
            </div>
            <div id="chat-lobby-main">
                <!-- \uC67C\uCABD \uD328\uB110: \uD398\uB974\uC18C\uB098 + \uCE90\uB9AD\uD130 -->
                <div id="chat-lobby-left">
                    <div id="chat-lobby-persona-bar">
                        <div id="chat-lobby-persona-list">
                            <div class="lobby-loading">\uB85C\uB529 \uC911...</div>
                        </div>
                    </div>
                    <div id="chat-lobby-search">
                        <input type="text" id="chat-lobby-search-input" placeholder="\uCE90\uB9AD\uD130 \uAC80\uC0C9...">
                        <select id="chat-lobby-char-sort" title="\uCE90\uB9AD\uD130 \uC815\uB82C">
                            <option value="recent">\u{1F552} \uCD5C\uADFC \uCC44\uD305\uC21C</option>
                            <option value="name">\u{1F524} \uC774\uB984\uC21C</option>
                            <option value="chats">\u{1F4AC} \uCC44\uD305 \uC218</option>
                        </select>
                    </div>
                    <div id="chat-lobby-characters">
                        <div class="lobby-loading">\uCE90\uB9AD\uD130 \uB85C\uB529 \uC911...</div>
                    </div>
                </div>
                <!-- \uC624\uB978\uCABD \uD328\uB110: \uCC44\uD305 \uBAA9\uB85D -->
                <div id="chat-lobby-chats">
                    <div id="chat-lobby-chats-header">
                        <button id="chat-lobby-chats-back" title="\uB4A4\uB85C">\u2190</button>
                        <img src="" alt="avatar" id="chat-panel-avatar" title="\uCE90\uB9AD\uD130 \uC124\uC815" style="display:none;">
                        <div class="char-info">
                            <div class="char-name" id="chat-panel-name">\uCE90\uB9AD\uD130\uB97C \uC120\uD0DD\uD558\uC138\uC694</div>
                            <div class="chat-count" id="chat-panel-count"></div>
                        </div>
                        <button id="chat-lobby-delete-char" title="\uCE90\uB9AD\uD130 \uC0AD\uC81C" style="display:none;">\u{1F5D1}\uFE0F</button>
                        <button id="chat-lobby-new-chat" style="display:none;">+ \uC0C8 \uCC44\uD305</button>
                    </div>
                    <div id="chat-lobby-folder-bar" style="display:none;">
                        <div class="folder-filter">
                            <select id="chat-lobby-folder-filter">
                                <option value="all">\u{1F4C1} \uC804\uCCB4</option>
                                <option value="favorites">\u2B50 \uC990\uACA8\uCC3E\uAE30</option>
                            </select>
                            <select id="chat-lobby-chat-sort">
                                <option value="recent">\u{1F550} \uCD5C\uC2E0\uC21C</option>
                                <option value="name">\u{1F524} \uC774\uB984\uC21C</option>
                                <option value="messages">\u{1F4AC} \uBA54\uC2DC\uC9C0\uC218</option>
                            </select>
                        </div>
                        <div class="folder-actions">
                            <button id="chat-lobby-batch-mode" title="\uB2E4\uC911 \uC120\uD0DD">\u2611\uFE0F</button>
                            <button id="chat-lobby-folder-manage" title="\uD3F4\uB354 \uAD00\uB9AC">\u{1F4C1}</button>
                        </div>
                    </div>
                    <!-- \uBC30\uCE58 \uBAA8\uB4DC \uD234\uBC14: \uC120\uD0DD \uC218 + \uCDE8\uC18C \uBC84\uD2BC\uB9CC (\uD3F4\uB354 \uC774\uB3D9\uC740 \u{1F4C1} \uBC84\uD2BC\uC73C\uB85C) -->
                    <div id="chat-lobby-batch-toolbar" style="display:none;">
                        <span id="batch-selected-count">0\uAC1C \uC120\uD0DD</span>
                        <span id="batch-help-text">\u{1F4C1} \uD074\uB9AD\uC73C\uB85C \uC774\uB3D9</span>
                        <button id="batch-cancel-btn" title="\uBC30\uCE58 \uBAA8\uB4DC \uC885\uB8CC">\u2715</button>
                    </div>
                    <div id="chat-lobby-chats-list">
                        <div class="lobby-empty-state">
                            <i>\u{1F4AC}</i>
                            <div>\uCE90\uB9AD\uD130\uB97C \uC120\uD0DD\uD558\uC138\uC694</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <!-- \uD3F4\uB354 \uAD00\uB9AC \uBAA8\uB2EC -->
    <div id="chat-lobby-folder-modal" style="display:none;">
        <div class="folder-modal-content">
            <div class="folder-modal-header">
                <h3>\u{1F4C1} \uD3F4\uB354 \uAD00\uB9AC</h3>
                <button id="folder-modal-close">\u2715</button>
            </div>
            <div class="folder-modal-body">
                <div class="folder-add-row">
                    <input type="text" id="new-folder-name" placeholder="\uC0C8 \uD3F4\uB354 \uC774\uB984...">
                    <button id="add-folder-btn">\uCD94\uAC00</button>
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
  init_sillyTavern();
  init_cache();
  init_store();
  init_textUtils();
  init_eventHelpers();
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
        <div class="persona-item ${isSelected}" data-persona="${escapeHtml2(persona.key)}" title="${escapeHtml2(persona.name)}">
            <img class="persona-avatar" src="${avatarUrl}" alt="" onerror="this.outerHTML='<div class=persona-avatar>\u{1F464}</div>'">
            <span class="persona-name">${escapeHtml2(persona.name)}</span>
            <button class="persona-delete-btn" data-persona="${escapeHtml2(persona.key)}" title="\uD398\uB974\uC18C\uB098 \uC0AD\uC81C">\xD7</button>
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
      const personaDrawer = document.getElementById("persona-management-button");
      if (!personaDrawer) {
        console.warn("[PersonaBar] Persona management button not found");
        showToast("\uD398\uB974\uC18C\uB098 \uAD00\uB9AC \uBC84\uD2BC\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", "warning");
        return;
      }
      const drawerIcon = personaDrawer.querySelector(".drawer-icon");
      if (drawerIcon) {
        if (!drawerIcon.classList.contains("openIcon")) {
          drawerIcon.click();
          console.log("[PersonaBar] Opening persona management drawer");
        } else {
          console.log("[PersonaBar] Drawer already open");
        }
      } else {
        personaDrawer.click();
      }
    }, CONFIG.timing.menuCloseDelay);
  }

  // src/index.js
  init_characterGrid();

  // src/ui/chatList.js
  init_sillyTavern();
  init_cache();
  init_storage();
  init_store();
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
    const fileName = chat.file_name || chat.fileName || "";
    let ts = parseDateFromFilename(fileName);
    if (!ts && chat.last_mes) {
      ts = typeof chat.last_mes === "number" ? chat.last_mes : new Date(chat.last_mes).getTime();
    }
    return ts || 0;
  }

  // src/ui/chatList.js
  init_eventHelpers();
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
      console.log("[ChatList] Tooltip disabled on mobile");
      return;
    }
    console.log("[ChatList] Binding tooltip events (PC mode)");
    container.querySelectorAll(".lobby-chat-item").forEach((item, idx) => {
      const fullPreview = item.dataset.fullPreview || "";
      if (!fullPreview) {
        console.log(`[ChatList] Item ${idx} has no fullPreview data`);
        return;
      }
      item.addEventListener("mouseenter", (e) => {
        if (currentTooltipTarget === item) return;
        console.log(`[ChatList] Mouse enter on item ${idx}`);
        hideTooltip();
        currentTooltipTarget = item;
        tooltipTimeout = setTimeout(() => {
          if (currentTooltipTarget === item && fullPreview) {
            console.log(`[ChatList] Showing tooltip for item ${idx}`);
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
          console.log(`[ChatList] Mouse leave on item ${idx}`);
          hideTooltip();
        }
      });
    });
  }
  function setChatHandlers(handlers) {
    store.setChatHandlers(handlers);
  }
  async function renderChatList(character) {
    console.log("[ChatList] renderChatList called with:", character);
    if (!character || !character.avatar) {
      console.error("[ChatList] Invalid character data:", character);
      return;
    }
    store.setCurrentCharacter(character);
    const chatsPanel = document.getElementById("chat-lobby-chats");
    const chatsList = document.getElementById("chat-lobby-chats-list");
    if (!chatsPanel || !chatsList) {
      console.error("[ChatList] Chat panel elements not found");
      return;
    }
    console.log("[ChatList] Showing chat panel for:", character.name);
    chatsPanel.classList.add("visible");
    updateChatHeader(character);
    showFolderBar(true);
    const cachedChats = cache.get("chats", character.avatar);
    if (cachedChats && cachedChats.length > 0) {
      renderChats(chatsList, cachedChats, character.avatar);
    } else {
      chatsList.innerHTML = '<div class="lobby-loading">\uCC44\uD305 \uB85C\uB529 \uC911...</div>';
    }
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
    console.log("[ChatList] ========== FILTER BY FOLDER ==========");
    console.log("[ChatList] filterFolder:", filterFolder);
    console.log("[ChatList] charAvatar:", charAvatar);
    console.log("[ChatList] chats count before filter:", chats.length);
    const data = storage.load();
    console.log("[ChatList] chatAssignments:", JSON.stringify(data.chatAssignments));
    console.log("[ChatList] favorites:", JSON.stringify(data.favorites));
    const result = chats.filter((chat) => {
      const fn = chat.file_name || chat.fileName || "";
      const key = storage.getChatKey(charAvatar, fn);
      if (filterFolder === "favorites") {
        const isFav = data.favorites.includes(key);
        console.log(`[ChatList] ${fn}: key=${key}, isFav=${isFav}`);
        return isFav;
      }
      const assigned = data.chatAssignments[key] || "uncategorized";
      const match = assigned === filterFolder;
      console.log(`[ChatList] ${fn}: key=${key}, assigned=${assigned}, match=${match}`);
      return match;
    });
    console.log("[ChatList] chats count after filter:", result.length);
    console.log("[ChatList] ========== FILTER END ==========");
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
    const safeAvatar = (charAvatar || "").replace(/"/g, "&quot;");
    const safeFileName = (fileName || "").replace(/"/g, "&quot;");
    const safeFullPreview = escapeHtml2(tooltipPreview).replace(/"/g, "&quot;");
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
            <div class="chat-name">${escapeHtml2(displayName)}</div>
            <div class="chat-preview">${escapeHtml2(truncateText(preview, 80))}</div>
            <div class="chat-meta">
                ${messageCount > 0 ? `<span>\u{1F4AC} ${messageCount}\uAC1C</span>` : ""}
                ${folderName && folderId !== "uncategorized" ? `<span class="chat-folder-tag">${escapeHtml2(folderName)}</span>` : ""}
            </div>
        </div>
        <button class="chat-delete-btn" title="\uCC44\uD305 \uC0AD\uC81C">\u{1F5D1}\uFE0F</button>
    </div>
    `;
  }
  function bindChatEvents(container, charAvatar) {
    console.log("[ChatList] bindChatEvents called for:", charAvatar);
    container.querySelectorAll(".lobby-chat-item").forEach((item, index) => {
      const chatContent = item.querySelector(".chat-content");
      const favBtn = item.querySelector(".chat-fav-btn");
      const delBtn = item.querySelector(".chat-delete-btn");
      const fileName = item.dataset.fileName;
      createTouchClickHandler(chatContent, () => {
        console.log("[ChatList] Chat item clicked:", fileName);
        if (store.batchModeActive) {
          console.log("[ChatList] Batch mode active, toggling checkbox");
          const cb = item.querySelector(".chat-select-cb");
          if (cb) {
            cb.checked = !cb.checked;
            updateBatchCount();
          }
          return;
        }
        const handlers = store.chatHandlers;
        console.log("[ChatList] Chat handlers:", {
          hasOnOpen: !!handlers.onOpen,
          hasOnDelete: !!handlers.onDelete
        });
        if (handlers.onOpen) {
          const charIndex = store.currentCharacter?.index || item.dataset.charIndex || null;
          const chatInfo = {
            fileName: item.dataset.fileName,
            charAvatar: item.dataset.charAvatar,
            charIndex
          };
          console.log("[ChatList] Calling onOpen with:", chatInfo);
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
        if (handlers.onDelete) {
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
  }
  function updateChatCount(count) {
    const el = document.getElementById("chat-panel-count");
    if (el) el.textContent = count > 0 ? `${count}\uAC1C \uCC44\uD305` : "\uCC44\uD305 \uC5C6\uC74C";
    const newChatBtn = document.getElementById("chat-lobby-new-chat");
    if (newChatBtn) newChatBtn.dataset.hasChats = count > 0 ? "true" : "false";
  }
  function showFolderBar(visible) {
    const bar = document.getElementById("chat-lobby-folder-bar");
    if (bar) bar.style.display = visible ? "flex" : "none";
  }
  function syncDropdowns(filterValue, sortValue) {
    const filterSelect = document.getElementById("chat-lobby-folder-filter");
    const sortSelect = document.getElementById("chat-lobby-chat-sort");
    if (filterSelect) filterSelect.value = filterValue;
    if (sortSelect) sortSelect.value = sortValue;
  }
  function handleFilterChange(filterValue) {
    storage.setFilterFolder(filterValue);
    const character = store.currentCharacter;
    if (character) {
      renderChatList(character);
    }
  }
  function handleSortChange2(sortValue) {
    storage.setSortOption(sortValue);
    const character = store.currentCharacter;
    if (character) {
      renderChatList(character);
    }
  }
  function toggleBatchMode() {
    const isActive = store.toggleBatchMode();
    console.log("[ChatList] toggleBatchMode called, isActive:", isActive);
    const chatsList = document.getElementById("chat-lobby-chats-list");
    const toolbar = document.getElementById("chat-lobby-batch-toolbar");
    const batchBtn = document.getElementById("chat-lobby-batch-mode");
    console.log("[ChatList] Batch elements:", {
      chatsList: !!chatsList,
      toolbar: !!toolbar,
      batchBtn: !!batchBtn
    });
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
    console.log("[ChatList] ========== BATCH MOVE START ==========");
    console.log("[ChatList] targetFolder:", targetFolder);
    if (!targetFolder) {
      console.log("[ChatList] No target folder selected");
      await showAlert("\uC774\uB3D9\uD560 \uD3F4\uB354\uB97C \uC120\uD0DD\uD558\uC138\uC694.");
      return;
    }
    const checked = document.querySelectorAll(".chat-select-cb:checked");
    console.log("[ChatList] Checked checkboxes:", checked.length);
    const keys = [];
    checked.forEach((cb, idx) => {
      const item = cb.closest(".lobby-chat-item");
      console.log(`[ChatList] Checkbox ${idx}:`, {
        hasItem: !!item,
        charAvatar: item?.dataset?.charAvatar,
        fileName: item?.dataset?.fileName
      });
      if (item) {
        const key = storage.getChatKey(item.dataset.charAvatar, item.dataset.fileName);
        console.log(`[ChatList] Generated key: ${key}`);
        keys.push(key);
      }
    });
    console.log("[ChatList] Total keys to move:", keys.length, keys);
    if (keys.length === 0) {
      console.log("[ChatList] No keys to move - aborting");
      await showAlert("\uC774\uB3D9\uD560 \uCC44\uD305\uC744 \uC120\uD0DD\uD558\uC138\uC694.");
      return;
    }
    console.log("[ChatList] Calling storage.moveChatsBatch...");
    storage.moveChatsBatch(keys, targetFolder);
    console.log("[ChatList] moveChatsBatch completed");
    toggleBatchMode();
    showToast(`${keys.length}\uAC1C \uCC44\uD305\uC774 \uC774\uB3D9\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, "success");
    const character = store.currentCharacter;
    console.log("[ChatList] Refreshing chat list for:", character?.name);
    if (character) {
      renderChatList(character);
    }
    console.log("[ChatList] ========== BATCH MOVE END ==========");
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

  // src/handlers/chatHandlers.js
  init_sillyTavern();
  init_cache();
  init_storage();
  init_store();
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
  init_eventHelpers();
  async function openChat(chatInfo) {
    const { fileName, charAvatar, charIndex } = chatInfo;
    console.log("[ChatHandlers] openChat called:", { fileName, charAvatar, charIndex });
    if (!charAvatar || !fileName) {
      console.error("[ChatHandlers] Missing chat data");
      showToast("\uCC44\uD305 \uC815\uBCF4\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.", "error");
      return;
    }
    try {
      const context = api.getContext();
      const characters = context?.characters || [];
      const index = characters.findIndex((c) => c.avatar === charAvatar);
      console.log("[ChatHandlers] Found character at index:", index);
      if (index === -1) {
        console.error("[ChatHandlers] Character not found");
        showToast("\uCE90\uB9AD\uD130\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", "error");
        return;
      }
      const chatFileName = fileName.replace(".jsonl", "");
      console.log("[ChatHandlers] Selecting character");
      await api.selectCharacterById(index);
      const charSelected = await waitForCharacterSelect(charAvatar, 2e3);
      if (!charSelected) {
        console.warn("[ChatHandlers] Character selection timeout, continuing anyway");
      }
      console.log("[ChatHandlers] Closing lobby (keeping state)");
      closeLobbyKeepState();
      if (typeof context?.openCharacterChat === "function") {
        console.log("[ChatHandlers] Using context.openCharacterChat:", chatFileName);
        try {
          await context.openCharacterChat(chatFileName);
          console.log("[ChatHandlers] \u2705 Chat opened via context.openCharacterChat");
          return;
        } catch (err) {
          console.warn("[ChatHandlers] context.openCharacterChat failed:", err);
        }
      }
      console.log("[ChatHandlers] Fallback: clicking chat item in UI");
      await openChatByFileName(fileName);
    } catch (error) {
      console.error("[ChatHandlers] Failed to open chat:", error);
      showToast("\uCC44\uD305\uC744 \uC5F4\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "error");
    }
  }
  async function openChatByFileName(fileName) {
    console.log("[ChatHandlers] openChatByFileName called with:", fileName);
    const manageChatsBtn = document.getElementById("option_select_chat");
    if (!manageChatsBtn) {
      console.error("[ChatHandlers] Chat select button not found");
      showToast("\uCC44\uD305 \uC120\uD0DD \uBC84\uD2BC\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", "error");
      return;
    }
    console.log("[ChatHandlers] Clicking option_select_chat button");
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
    console.log("[ChatHandlers] Searching for:", searchName);
    function isExactMatch(itemName, target) {
      const cleanItem = itemName.replace(".jsonl", "").trim();
      const cleanTarget = target.replace(".jsonl", "").trim();
      return cleanItem === cleanTarget;
    }
    const chatItems = document.querySelectorAll(".select_chat_block");
    console.log("[ChatHandlers] Found", chatItems.length, "chat items");
    for (const item of chatItems) {
      const itemFileName = item.getAttribute("file_name") || "";
      if (isExactMatch(itemFileName, searchName)) {
        console.log("[ChatHandlers] \u2705 MATCH FOUND:", itemFileName);
        if (window.$) {
          window.$(item).trigger("click");
        } else {
          item.click();
        }
        console.log("[ChatHandlers] Click executed");
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
    const cachedChats = cache.get("chats", charAvatar);
    const chatExists = cachedChats?.some(
      (c) => (c.file_name || c.fileName) === fileName
    );
    if (!chatExists) {
      showToast("\uC774\uBBF8 \uC0AD\uC81C\uB418\uC5C8\uAC70\uB098 \uCC3E\uC744 \uC218 \uC5C6\uB294 \uCC44\uD305\uC785\uB2C8\uB2E4.", "warning");
      if (element) element.remove();
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
        if (element) {
          element.style.transition = `opacity ${CONFIG.timing.animationDuration}ms, transform ${CONFIG.timing.animationDuration}ms`;
          element.style.opacity = "0";
          element.style.transform = "translateX(20px)";
          setTimeout(() => {
            element.remove();
            updateChatCountAfterDelete();
          }, CONFIG.timing.animationDuration);
        } else {
          await refreshChatList();
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
        console.log("[ChatLobby] Using SillyTavern deleteCharacter function");
        await context.deleteCharacter(char.avatar, { deleteChats: true });
      } else {
        console.log("[ChatLobby] Using direct API call");
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
          console.log("[ChatLobby] Refreshing characters via getCharacters()");
          await context.getCharacters();
        }
      }
      cache.invalidate("characters");
      cache.invalidate("chats", char.avatar);
      showToast(`"${char.name}" \uCE90\uB9AD\uD130\uAC00 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, "success");
      const overlay = document.getElementById("chat-lobby-overlay");
      if (overlay?.style.display === "flex") {
        const { renderCharacterGrid: renderCharacterGrid2 } = await Promise.resolve().then(() => (init_characterGrid(), characterGrid_exports));
        await renderCharacterGrid2();
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
    store.setLobbyOpen(false);
    closeChatPanel();
  }

  // src/handlers/folderHandlers.js
  init_storage();
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
        const deleteBtn = f.isSystem ? "" : `<button class="folder-delete-btn" data-id="${f.id}" data-name="${escapeHtml2(f.name)}">\u{1F5D1}\uFE0F</button>`;
        const editBtn = f.isSystem ? "" : `<button class="folder-edit-btn" data-id="${f.id}" data-name="${escapeHtml2(f.name)}">\u270F\uFE0F</button>`;
        let count = 0;
        if (f.id === "favorites") {
          count = data.favorites.length;
        } else {
          count = Object.values(data.chatAssignments).filter((v) => v === f.id).length;
        }
        html += `
            <div class="folder-item ${isSystem}" data-id="${f.id}">
                <span class="folder-name">${escapeHtml2(f.name)}</span>
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
        console.log("[FolderHandlers] Folder clicked:", folderId, "isBatchMode:", isBatchMode());
        if (isBatchMode() && folderId && folderId !== "favorites") {
          console.log("[FolderHandlers] Executing batch move to folder:", folderId);
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
            html += `<option value="${f.id}">${escapeHtml2(f.name)}</option>`;
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
  init_eventHelpers();

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
      console.log("[IntervalManager] Created interval:", id, "Total:", this.intervals.size);
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
        console.log("[IntervalManager] Cleared interval:", id, "Remaining:", this.intervals.size);
      }
    }
    /**
     * 모든 interval 정리 (로비 닫을 때 호출)
     */
    clearAll() {
      if (this.intervals.size > 0) {
        console.log("[IntervalManager] Clearing all intervals:", this.intervals.size);
        this.intervals.forEach((id) => clearInterval(id));
        this.intervals.clear();
        console.log("[IntervalManager] \u{1F9F9} All intervals cleared");
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
    console.log("[ChatLobby] Loading extension...");
    let eventHandlers = null;
    let eventsRegistered = false;
    async function init() {
      console.log("[ChatLobby] Initializing...");
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
      console.log("[ChatLobby] Extension initialized");
    }
    function setupSillyTavernEvents() {
      const context = window.SillyTavern?.getContext?.();
      if (!context?.eventSource) {
        console.warn("[ChatLobby] SillyTavern eventSource not found");
        return;
      }
      if (eventsRegistered) {
        console.log("[ChatLobby] Events already registered, skipping");
        return;
      }
      const { eventSource, eventTypes } = context;
      eventHandlers = {
        onCharacterDeleted: () => {
          console.log("[ChatLobby] Character deleted, invalidating cache");
          cache.invalidate("characters");
          if (isLobbyOpen()) {
            renderCharacterGrid(store.searchTerm);
          }
        },
        onCharacterEdited: () => {
          console.log("[ChatLobby] CHARACTER_EDITED - cache only (no re-render)");
          cache.invalidate("characters");
        },
        onCharacterAdded: () => {
          console.log("[ChatLobby] CHARACTER_ADDED");
          cache.invalidate("characters");
          if (isLobbyOpen()) {
            renderCharacterGrid(store.searchTerm);
          }
        },
        onChatChanged: () => {
          console.log("[ChatLobby] Chat changed, invalidating character cache");
          cache.invalidate("characters");
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
      eventsRegistered = true;
      console.log("[ChatLobby] SillyTavern events registered");
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
        eventsRegistered = false;
        eventHandlers = null;
        console.log("[ChatLobby] SillyTavern events cleaned up");
      } catch (e) {
        console.warn("[ChatLobby] Failed to cleanup events:", e);
      }
    }
    function isLobbyOpen() {
      return store.isLobbyOpen;
    }
    function removeExistingUI() {
      ["chat-lobby-overlay", "chat-lobby-fab", "chat-lobby-folder-modal", "chat-lobby-global-tooltip"].forEach((id) => {
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
    function openLobby() {
      console.log("[ChatLobby] Opening lobby...");
      const chatsPanel = document.getElementById("chat-lobby-chats");
      if (store.isLobbyOpen && chatsPanel?.classList.contains("visible")) {
        console.log("[ChatLobby] Lobby already open with chat panel, ignoring");
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
        const data = storage.load();
        if (data.filterFolder && data.filterFolder !== "all" && data.filterFolder !== "favorites" && data.filterFolder !== "uncategorized") {
          const folderExists = data.folders?.some((f) => f.id === data.filterFolder);
          if (!folderExists) {
            console.log('[ChatLobby] Resetting invalid filterFolder to "all"');
            storage.setFilterFolder("all");
          }
        }
        if (store.batchModeActive) {
          toggleBatchMode();
        }
        closeChatPanel();
        renderPersonaBar();
        renderCharacterGrid();
        updateFolderDropdowns();
        bindBatchModeButtons();
        const currentContext = api.getContext();
        if (currentContext?.characterId !== void 0 && currentContext.characterId >= 0) {
          const currentChar = currentContext.characters?.[currentContext.characterId];
          if (currentChar) {
            console.log("[ChatLobby] Auto-selecting current character:", currentChar.name);
            setTimeout(() => {
              const charCard = document.querySelector(
                `.lobby-char-card[data-char-avatar="${currentChar.avatar}"]`
              );
              if (charCard) {
                charCard.classList.add("selected");
                const characterData = {
                  index: currentContext.characterId,
                  avatar: currentChar.avatar,
                  name: currentChar.name,
                  avatarSrc: `/characters/${encodeURIComponent(currentChar.avatar)}`
                };
                renderChatList(characterData);
              }
            }, 200);
          }
        }
        console.log("[ChatLobby] Lobby opened, handler status:", !!store.onCharacterSelect);
      }
    }
    function closeLobby() {
      const container = document.getElementById("chat-lobby-container");
      const fab = document.getElementById("chat-lobby-fab");
      if (container) container.style.display = "none";
      if (fab) fab.style.display = "flex";
      intervalManager.clearAll();
      store.setLobbyOpen(false);
      store.reset();
      closeChatPanel();
    }
    window.chatLobbyRefresh = async function() {
      cache.invalidateAll();
      await renderPersonaBar();
      await renderCharacterGrid();
    };
    function setupEventDelegation() {
      document.body.addEventListener("click", handleBodyClick);
      document.addEventListener("keydown", handleKeydown);
      const searchInput = document.getElementById("chat-lobby-search-input");
      if (searchInput) {
        searchInput.addEventListener("input", (e) => handleSearch(e.target.value));
      }
      bindDropdownEvents();
      bindBatchModeButtons();
    }
    function bindBatchModeButtons() {
      const batchMoveBtn = document.getElementById("batch-move-btn");
      const batchCancelBtn = document.getElementById("batch-cancel-btn");
      const batchModeBtn = document.getElementById("chat-lobby-batch-mode");
      if (batchMoveBtn && !batchMoveBtn.dataset.bound) {
        batchMoveBtn.dataset.bound = "true";
        createTouchClickHandler(batchMoveBtn, () => {
          console.log("[EventDelegation] batch-move-btn touched/clicked");
          handleBatchMove();
        }, { debugName: "batch-move-btn" });
      }
      if (batchCancelBtn && !batchCancelBtn.dataset.bound) {
        batchCancelBtn.dataset.bound = "true";
        createTouchClickHandler(batchCancelBtn, () => {
          console.log("[EventDelegation] batch-cancel-btn touched/clicked");
          toggleBatchMode();
        }, { debugName: "batch-cancel-btn" });
      }
      if (batchModeBtn && !batchModeBtn.dataset.bound) {
        batchModeBtn.dataset.bound = "true";
        createTouchClickHandler(batchModeBtn, () => {
          console.log("[EventDelegation] batch-mode-btn touched/clicked");
          toggleBatchMode();
        }, { debugName: "batch-mode-btn" });
      }
    }
    function handleBodyClick(e) {
      const target = e.target;
      if (target.id === "chat-lobby-fab" || target.closest("#chat-lobby-fab")) {
        console.log("[EventDelegation] FAB clicked");
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
      const clickedEl = target.closest("button, [id]");
      const id = clickedEl?.id || target.id;
      if (!id) return;
      console.log("[EventDelegation] Lobby click - id:", id);
      switch (id) {
        case "chat-lobby-fab":
          openLobby();
          break;
        case "chat-lobby-close":
          closeLobby();
          break;
        case "chat-lobby-chats-back":
          if (isMobile()) closeChatPanel();
          break;
        case "chat-lobby-refresh":
          handleRefresh();
          break;
        case "chat-lobby-new-chat":
          startNewChat();
          break;
        case "chat-lobby-delete-char":
          deleteCharacter();
          break;
        case "chat-lobby-import-char":
          handleImportCharacter();
          break;
        case "chat-lobby-add-persona":
          handleAddPersona();
          break;
        case "chat-panel-avatar":
          handleGoToCharacter();
          break;
        case "chat-lobby-batch-mode":
          toggleBatchMode();
          break;
        case "batch-move-btn":
          handleBatchMove();
          break;
        case "batch-cancel-btn":
          toggleBatchMode();
          break;
        case "chat-lobby-folder-manage":
          openFolderModal();
          break;
        case "folder-modal-close":
          closeFolderModal();
          break;
        case "add-folder-btn":
          addFolder();
          break;
      }
    }
    function handleAction(action, el, e) {
      switch (action) {
        case "open-lobby":
          openLobby();
          break;
        case "close-lobby":
          closeLobby();
          break;
        case "refresh":
          handleRefresh();
          break;
        case "toggle-batch":
          toggleBatchMode();
          break;
      }
    }
    function handleKeydown(e) {
      if (e.key === "Escape") {
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
        handleSortChange(e.target.value);
      });
      document.getElementById("chat-lobby-folder-filter")?.addEventListener("change", (e) => {
        handleFilterChange(e.target.value);
      });
      document.getElementById("chat-lobby-chat-sort")?.addEventListener("change", (e) => {
        handleSortChange2(e.target.value);
      });
      document.getElementById("chat-lobby-chats-list")?.addEventListener("change", (e) => {
        if (e.target.classList.contains("chat-select-cb")) {
          updateBatchCount();
        }
      });
    }
    async function handleRefresh() {
      console.log("[ChatLobby] Force refresh - invalidating all cache");
      cache.invalidateAll();
      await api.fetchPersonas();
      await api.fetchCharacters(true);
      await renderPersonaBar();
      await renderCharacterGrid();
      showToast("\uC0C8\uB85C\uACE0\uCE68 \uC644\uB8CC", "success");
    }
    function handleImportCharacter() {
      const importBtn = document.getElementById("character_import_button");
      if (importBtn) {
        const currentCount = api.getCharacters().length;
        console.log("[ChatLobby] Import started, current count:", currentCount);
        importBtn.click();
        const checkInterval = intervalManager.set(async () => {
          const newCount = api.getCharacters().length;
          if (newCount > currentCount) {
            intervalManager.clear(checkInterval);
            console.log("[ChatLobby] Character imported! New count:", newCount);
            cache.invalidate("characters");
            if (isLobbyOpen()) {
              await renderCharacterGrid(store.searchTerm);
            }
          }
        }, 500);
        setTimeout(() => {
          intervalManager.clear(checkInterval);
          console.log("[ChatLobby] Import check timeout");
        }, 5e3);
      }
    }
    async function handleAddPersona() {
      const personaDrawer = document.getElementById("persona-management-button");
      const drawerIcon = personaDrawer?.querySelector(".drawer-icon");
      if (!drawerIcon) return;
      drawerIcon.click();
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
          console.log("[ChatLobby] Checking persona drawer...", { isOpen, checkCount });
          if (!isOpen || checkCount >= maxChecks) {
            intervalManager.clear(checkDrawerClosed);
            if (checkCount >= maxChecks) {
              console.log("[ChatLobby] Persona drawer check timeout");
            } else {
              console.log("[ChatLobby] Persona drawer closed, refreshing bar");
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
      console.log("[ChatLobby] Opening character editor for:", character.name);
      const context = api.getContext();
      const characters = context?.characters || [];
      const index = characters.findIndex((c) => c.avatar === character.avatar);
      if (index === -1) {
        console.error("[ChatLobby] Character not found:", character.avatar);
        return;
      }
      closeLobby();
      const isAlreadySelected = context.characterId === index;
      console.log("[ChatLobby] isAlreadySelected:", isAlreadySelected, "context.characterId:", context.characterId, "index:", index);
      if (!isAlreadySelected) {
        await api.selectCharacterById(index);
        const charSelected = await waitForCharacterSelect(character.avatar, 2e3);
        if (!charSelected) {
          console.warn("[ChatLobby] Character selection timeout");
        }
      }
      const rightNavIcon = document.getElementById("rightNavDrawerIcon");
      if (rightNavIcon) {
        console.log("[ChatLobby] Clicking rightNavDrawerIcon");
        rightNavIcon.click();
      } else {
        console.warn("[ChatLobby] rightNavDrawerIcon not found");
      }
    }
    function handleOpenCharSettings() {
      closeLobby();
      setTimeout(() => {
        const charInfoBtn = document.getElementById("option_settings");
        if (charInfoBtn) charInfoBtn.click();
      }, CONFIG.timing.menuCloseDelay);
    }
    function handleBatchMove() {
      console.log("[ChatLobby] ========== handleBatchMove CALLED ==========");
      const folderSelect = document.getElementById("batch-move-folder");
      const folder = folderSelect?.value;
      console.log("[ChatLobby] Selected folder:", folder);
      console.log("[ChatLobby] Folder select element:", folderSelect);
      console.log("[ChatLobby] Folder options:", folderSelect?.options?.length);
      executeBatchMove(folder);
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
      console.log("[ChatLobby] Added to options menu");
    }
    async function waitForSillyTavern(maxAttempts = 30, interval = 500) {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const context = window.SillyTavern?.getContext?.();
        if (context && context.characters) {
          console.log("[ChatLobby] SillyTavern context ready after", attempt * interval, "ms");
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
