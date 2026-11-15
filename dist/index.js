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
        // ⚠️ TTL을 짧게 잡으면 로비를 열 때마다 사실상 전체 재요청이 발생함 (렉의 주원인)
        // 변경 감지는 이벤트(CHAT_CHANGED, CHARACTER_EDITED 등)가 스코프 무효화로 처리하므로
        // TTL은 "이벤트를 놓쳤을 때의 안전망" 역할만 하면 됨 → 길게 설정
        cache: {
          chatsDuration: 3e5,
          // 채팅 목록 캐시 5분
          chatCountsDuration: 6e5,
          // 채팅 수 캐시 10분
          messageCountsDuration: 6e5,
          // 메시지 수 캐시 10분
          personasDuration: 6e5,
          // 페르소나 캐시 10분
          charactersDuration: 3e5
          // 캐릭터 캐시 5분
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
    return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
  }
  function truncateText(text, maxLength) {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  }
  var HTML_ESCAPE_MAP;
  var init_textUtils = __esm({
    "src/utils/textUtils.js"() {
      HTML_ESCAPE_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
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
                z-index: 60001;
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
                font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;
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
            
            /* \uBAA8\uBC14\uC77C\uC5D0\uC11C\uB3C4 \uD1A0\uC2A4\uD2B8 \uD45C\uC2DC\uB418\uB3C4\uB85D \uAC15\uD654 */
            @media (max-width: 768px) {
                #chat-lobby-toast-container {
                    left: 10px;
                    right: 10px;
                    bottom: 80px;
                }
                .chat-lobby-toast {
                    max-width: 100%;
                }
            }
        </style>
    `;
    document.body.appendChild(toastContainer);
  }
  function showDOMToast(message, type, duration) {
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
  function showToast(message, type = "info", duration = CONFIG.timing.toastDuration) {
    showDOMToast(message, type, duration);
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
  var CACHE_LIMITS = {
    chats: 40
  };
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
        const store2 = this.stores[type];
        store2.delete(key);
        store2.set(key, data);
        this.timestamps[type].set(key, now);
        const limit = CACHE_LIMITS[type];
        if (limit && store2.size > limit) {
          const oldestKey = store2.keys().next().value;
          store2.delete(oldestKey);
          this.timestamps[type].delete(oldestKey);
        }
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
    },
    personaRecentUsage: []
    // [personaKey, ...] - 최근 사용순 (앞=최근, LRU 큐)
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
          if (!this._data._keysMigrated) {
            let changed = false;
            if (this._data.favorites) {
              this._data.favorites = this._data.favorites.map((key) => {
                if (key.includes(".jsonl")) {
                  changed = true;
                  return key.replace(/\.jsonl/gi, "");
                }
                return key;
              });
              this._data.favorites = [...new Set(this._data.favorites)];
            }
            if (this._data.chatAssignments) {
              const newAssignments = {};
              for (const [key, value] of Object.entries(this._data.chatAssignments)) {
                const normalizedKey = key.replace(/\.jsonl/gi, "");
                if (normalizedKey !== key) changed = true;
                newAssignments[normalizedKey] = value;
              }
              this._data.chatAssignments = newAssignments;
            }
            this._data._keysMigrated = true;
            if (changed) {
              console.debug("[Storage] Migrated .jsonl keys");
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
            console.debug("[Storage] Saved after cleanup");
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
     * 장기 사용자를 고려해 제한 넉넉하게 설정
     * @param {LobbyData} data
     */
    cleanup(data) {
      const assignments = Object.entries(data.chatAssignments || {});
      if (assignments.length > 1e4) {
        const toKeep = assignments.slice(-1e4);
        data.chatAssignments = Object.fromEntries(toKeep);
        console.debug(`[Storage] Cleaned chatAssignments: ${assignments.length} \u2192 10000`);
      }
      if (data.favorites && data.favorites.length > 2e3) {
        data.favorites = data.favorites.slice(-2e3);
        console.debug(`[Storage] Cleaned favorites`);
      }
      if (data.characterFavorites && data.characterFavorites.length > 1e3) {
        data.characterFavorites = data.characterFavorites.slice(-1e3);
        console.debug(`[Storage] Cleaned characterFavorites`);
      }
      if (data.personaRecentUsage) {
        if (!Array.isArray(data.personaRecentUsage)) {
          const entries = Object.entries(data.personaRecentUsage);
          entries.sort((a, b) => b[1] - a[1]);
          data.personaRecentUsage = entries.map(([key]) => key);
        }
        if (data.personaRecentUsage.length > 200) {
          data.personaRecentUsage = data.personaRecentUsage.slice(0, 200);
          console.debug(`[Storage] Cleaned personaRecentUsage`);
        }
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
     * 채팅 키 생성 (.jsonl 확장자 정규화)
     * @param {string} charAvatar - 캐릭터 아바타
     * @param {string} chatFileName - 채팅 파일명
     * @returns {string}
     */
    getChatKey(charAvatar, chatFileName) {
      const normalizedFileName = (chatFileName || "").replace(/\.jsonl$/i, "");
      return `${charAvatar}::${normalizedFileName}`;
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
        if (folderId) {
          data.chatAssignments[key] = folderId;
        } else {
          delete data.chatAssignments[key];
        }
      });
    }
    /**
     * 채팅을 폴더에 할당 (alias)
     */
    setChatFolder(charAvatar, chatFileName, folderId) {
      this.assignChatToFolder(charAvatar, chatFileName, folderId);
    }
    /**
     * 채팅 이름 변경 시 로컬 데이터 키 마이그레이션
     * (폴더 배정 + 즐겨찾기가 채팅 키에 묶여 있으므로 함께 이동)
     * @param {string} charAvatar
     * @param {string} oldFileName
     * @param {string} newFileName
     */
    renameChatKey(charAvatar, oldFileName, newFileName) {
      this.update((data) => {
        const oldKey = this.getChatKey(charAvatar, oldFileName);
        const newKey = this.getChatKey(charAvatar, newFileName);
        if (oldKey === newKey) return;
        if (data.chatAssignments[oldKey] !== void 0) {
          data.chatAssignments[newKey] = data.chatAssignments[oldKey];
          delete data.chatAssignments[oldKey];
        }
        const favIndex = data.favorites.indexOf(oldKey);
        if (favIndex > -1) {
          data.favorites[favIndex] = newKey;
        }
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
    // ============================================
    // 그룹 즐겨찾기 (로컬 전용)
    // ============================================
    /**
     * 그룹이 즐겨찾기인지 확인
     * @param {string} groupId - 그룹 ID
     * @returns {boolean}
     */
    isGroupFavorite(groupId) {
      const data = this.load();
      return (data.groupFavorites || []).includes(groupId);
    }
    /**
     * 그룹 즐겨찾기 토글
     * @param {string} groupId - 그룹 ID
     * @returns {boolean} 새로운 즐겨찾기 상태
     */
    toggleGroupFavorite(groupId) {
      return this.update((data) => {
        if (!data.groupFavorites) data.groupFavorites = [];
        const index = data.groupFavorites.indexOf(groupId);
        if (index === -1) {
          data.groupFavorites.push(groupId);
          return true;
        } else {
          data.groupFavorites.splice(index, 1);
          return false;
        }
      });
    }
    // ============================================
    // 페르소나 즐겨찾기 (로컬 전용)
    // ============================================
    /**
     * 페르소나가 즐겨찾기인지 확인
     * @param {string} personaKey - 페르소나 키
     * @returns {boolean}
     */
    isPersonaFavorite(personaKey) {
      const data = this.load();
      return (data.personaFavorites || []).includes(personaKey);
    }
    /**
     * 페르소나 즐겨찾기 토글
     * @param {string} personaKey - 페르소나 키
     * @returns {boolean} 새로운 즐겨찾기 상태
     */
    togglePersonaFavorite(personaKey) {
      return this.update((data) => {
        if (!data.personaFavorites) data.personaFavorites = [];
        const index = data.personaFavorites.indexOf(personaKey);
        if (index === -1) {
          data.personaFavorites.push(personaKey);
          return true;
        } else {
          data.personaFavorites.splice(index, 1);
          return false;
        }
      });
    }
    /**
     * 모든 페르소나 즐겨찾기 목록
     * @returns {string[]}
     */
    getPersonaFavorites() {
      return this.load().personaFavorites || [];
    }
    // ============================================
    // 페르소나 최근 사용 기록
    // ============================================
    /**
     * 페르소나 사용 기록 저장 (LRU 큐)
     * 이미 있으면 제거 후 맨 앞에 추가, 최대 200개 유지
     * @param {string} personaKey - 페르소나 키
     */
    recordPersonaUsage(personaKey) {
      if (!personaKey) return;
      const current = this.load().personaRecentUsage;
      if (Array.isArray(current) && current[0] === personaKey) return;
      this.update((data) => {
        if (!Array.isArray(data.personaRecentUsage)) data.personaRecentUsage = [];
        const idx = data.personaRecentUsage.indexOf(personaKey);
        if (idx !== -1) data.personaRecentUsage.splice(idx, 1);
        data.personaRecentUsage.unshift(personaKey);
        if (data.personaRecentUsage.length > 200) {
          data.personaRecentUsage.splice(200);
        }
      });
    }
    /**
     * 최근 사용 순서 배열 반환 (앞=최근)
     * @returns {string[]}
     */
    getPersonaRecentUsage() {
      const queue = this.load().personaRecentUsage || [];
      return Array.isArray(queue) ? queue : [];
    }
  };
  var storage = new StorageManager();

  // src/data/store.js
  var Store = class {
    constructor() {
      this._state = {
        currentCharacter: null,
        currentGroup: null,
        // 현재 선택된 그룹
        batchModeActive: false,
        isProcessingPersona: false,
        isLobbyOpen: false,
        isLobbyLocked: false,
        // UI 잠금 (상호작용 차단)
        searchTerm: "",
        selectedTag: null,
        tagBarExpanded: false,
        onCharacterSelect: null,
        onGroupSelect: null,
        // 그룹 선택 콜백
        chatHandlers: {
          onOpen: null,
          onDelete: null,
          onOpenGroup: null
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
        onDelete: handlers.onDelete || null,
        onOpenGroup: handlers.onOpenGroup || null
      };
    }
    // ============================================
    // 상태 초기화
    // ============================================
    /**
     * 선택 상태만 초기화 (로비 열기/닫기 시)
     * ⚠️ isLobbyOpen, isLobbyLocked, 핸들러는 절대 건드리지 않음
     * 이 필드들은 반드시 전용 setter로만 변경할 것
     */
    resetSelection() {
      this._state.currentCharacter = null;
      this._state.currentGroup = null;
      this._state.batchModeActive = false;
      this._state.searchTerm = "";
      this._state.selectedTag = null;
      this._state.tagBarExpanded = false;
    }
    /** @deprecated resetSelection()을 사용할 것 */
    reset() {
      this.resetSelection();
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

  // src/utils/dateUtils.js
  function formatDate(timestamp) {
    if (!timestamp) return "";
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return "";
      return date.toLocaleDateString("ko-KR", {
        month: "short",
        day: "numeric"
      });
    } catch {
      return "";
    }
  }
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
      let ts2;
      if (typeof chat.last_mes === "number") {
        ts2 = chat.last_mes;
      } else {
        const fixedStr = String(chat.last_mes).replace(/(\d+)(am|pm)/i, "$1 $2");
        ts2 = new Date(fixedStr).getTime();
      }
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

  // src/utils/avatarUrl.js
  var STORAGE_KEY = "chatLobby_avatarVersions";
  var MAX_ENTRIES = 300;
  var versions = /* @__PURE__ */ new Map();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) versions = new Map(Object.entries(JSON.parse(raw)));
  } catch {
  }
  function persist() {
    try {
      while (versions.size > MAX_ENTRIES) {
        versions.delete(versions.keys().next().value);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(versions)));
    } catch {
    }
  }
  function charAvatarUrl(avatar) {
    const base = `/characters/${encodeURIComponent(avatar || "")}`;
    const v = versions.get(avatar);
    return v ? `${base}?v=${v}` : base;
  }
  function bumpAvatarVersion(avatar) {
    if (!avatar) return;
    versions.delete(avatar);
    versions.set(avatar, Date.now());
    persist();
  }
  function forgetAvatarVersion(avatar) {
    if (versions.delete(avatar)) persist();
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
            console.debug("[API] Could not get personas from context or import:", e.message);
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
        console.debug("[API] Failed to get current persona:", e.message);
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
        console.debug("[API] Failed to set persona:", e.message);
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
      if (forceRefresh) {
        cache.invalidate("chats", characterAvatar);
        return this._requestChats(characterAvatar);
      }
      return cache.getOrFetch(`chats:${characterAvatar}`, () => this._requestChats(characterAvatar));
    }
    /**
     * 채팅 목록 실제 요청 + 캐시 저장
     * @param {string} characterAvatar
     * @returns {Promise<Array>}
     */
    async _requestChats(characterAvatar) {
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
        const messageCount2 = result.reduce((sum, chat) => {
          return sum + (chat.chat_items || 0);
        }, 0);
        cache.set("messageCounts", messageCount2, characterAvatar);
        return result;
      } catch (error) {
        console.error("[API] Failed to load chats:", error);
        return [];
      }
    }
    /**
     * 채팅 생성일 가져오기 (첫 메시지의 send_date)
     * 파일명에 날짜가 없을 때 fallback으로 사용
     * @param {string} characterAvatar - 캐릭터 아바타
     * @param {string} fileName - 채팅 파일명
     * @returns {Promise<Date|null>}
     */
    async getChatCreatedDate(characterAvatar, fileName) {
      try {
        const chatName = fileName.replace(".jsonl", "");
        const charDir = characterAvatar.replace(/\.(png|jpg|webp)$/i, "");
        const response = await this.fetchWithRetry("/api/chats/get", {
          method: "POST",
          headers: this.getRequestHeaders(),
          body: JSON.stringify({
            ch_name: charDir,
            file_name: chatName,
            avatar_url: characterAvatar
          })
        });
        if (!response.ok) {
          return null;
        }
        const chatData = await response.json();
        if (Array.isArray(chatData) && chatData.length > 1) {
          const firstMessage = chatData[1];
          if (firstMessage?.send_date) {
            if (typeof firstMessage.send_date === "number") {
              return new Date(firstMessage.send_date);
            }
            const fixedStr = String(firstMessage.send_date).replace(/(\d+)(am|pm)/i, "$1 $2");
            const date = new Date(fixedStr);
            if (!isNaN(date.getTime())) {
              return date;
            }
          }
        }
        return null;
      } catch (error) {
        return null;
      }
    }
    /**
     * 채팅 메시지 전체 가져오기 (리마인드 뷰어용)
     * @param {string} characterAvatar - 캐릭터 아바타
     * @param {string} fileName - 채팅 파일명 (.jsonl 유무 무관)
     * @returns {Promise<Array|null>} - 메시지 배열 (메타데이터 라인 제외), 실패 시 null
     */
    async getChatMessages(characterAvatar, fileName) {
      try {
        const charDir = characterAvatar.replace(/\.(png|jpg|webp)$/i, "");
        const response = await this.fetchWithRetry("/api/chats/get", {
          method: "POST",
          headers: this.getRequestHeaders(),
          body: JSON.stringify({
            ch_name: charDir,
            file_name: fileName.replace(/\.jsonl$/i, ""),
            avatar_url: characterAvatar
          })
        });
        if (!response.ok) return null;
        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) return null;
        return data.slice(1);
      } catch (error) {
        console.error("[API] Failed to get chat messages:", error);
        return null;
      }
    }
    /**
     * 채팅 이름 변경
     * 서버는 파일명을 정리(sanitize)할 수 있으므로 실제로 적용된 새 이름을 돌려준다.
     * @param {string} charAvatar - 캐릭터 아바타
     * @param {string} oldFileName - 기존 파일명 (.jsonl 유무 무관)
     * @param {string} newFileName - 새 파일명 (.jsonl 유무 무관)
     * @returns {Promise<string|null>} 실제 새 파일명 (.jsonl 없음), 실패 시 null
     */
    async renameChat(charAvatar, oldFileName, newFileName) {
      try {
        const originalFile = oldFileName.replace(/\.jsonl$/i, "") + ".jsonl";
        const renamedFile = newFileName.replace(/\.jsonl$/i, "") + ".jsonl";
        const response = await this.fetchWithRetry("/api/chats/rename", {
          method: "POST",
          headers: this.getRequestHeaders(),
          body: JSON.stringify({
            avatar_url: charAvatar,
            original_file: originalFile,
            renamed_file: renamedFile
          })
        });
        if (!response.ok) {
          console.error("[API] Rename failed:", response.status);
          return null;
        }
        let data = null;
        try {
          data = await response.json();
        } catch {
        }
        if (data?.error) return null;
        cache.invalidate("chats", charAvatar);
        const applied = data?.sanitizedFileName || renamedFile;
        return String(applied).replace(/\.jsonl$/i, "");
      } catch (error) {
        console.error("[API] Failed to rename chat:", error);
        return null;
      }
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
     * 캐릭터의 "마지막 채팅" 기록만 갱신 (다음 실행 시 이 채팅이 열리도록)
     * ST의 openCharacterChat은 카드 전체를 다시 저장(createOrEditCharacter)하지만
     * 여기서는 chat 필드 하나만 바꾼다. 실패해도 채팅 동작에는 영향 없음.
     * @param {string} characterAvatar
     * @param {string} characterName
     * @param {string} chatFileName - .jsonl 없는 파일명
     * @returns {Promise<boolean>}
     */
    async saveLastChatPointer(characterAvatar, characterName, chatFileName) {
      if (!characterAvatar || !characterName || !chatFileName) return false;
      try {
        const response = await fetch("/api/characters/edit-attribute", {
          method: "POST",
          headers: this.getRequestHeaders(),
          body: JSON.stringify({
            avatar_url: characterAvatar,
            ch_name: characterName,
            field: "chat",
            value: chatFileName
          })
        });
        if (!response.ok) console.debug("[API] saveLastChatPointer failed:", response.status);
        return response.ok;
      } catch (e) {
        console.debug("[API] saveLastChatPointer error:", e);
        return false;
      }
    }
    /**
     * 삭제한 채팅이 캐릭터의 "마지막 채팅"이었으면 남은 채팅 중 가장 최근 것으로 포인터를 옮김
     * (안 하면 다음에 캐릭터로 들어갈 때 ST가 지워진 이름으로 빈 새 채팅을 만들어
     *  남은 채팅들이 사라진 것처럼 보임)
     * @param {string} charAvatar
     * @param {string[]} deletedNames - 삭제한 파일명들 (.jsonl 유무 무관)
     * @returns {Promise<void>}
     */
    async repointLastChatAfterDelete(charAvatar, deletedNames) {
      const char = this.getCharacters().find((c) => c.avatar === charAvatar);
      if (!char) return;
      const deleted = new Set(deletedNames.map((n) => String(n).replace(/\.jsonl$/i, "")));
      if (!deleted.has(char.chat)) return;
      try {
        const chats = await this.fetchChatsForCharacter(charAvatar, true);
        const remaining = (Array.isArray(chats) ? chats : []).filter((c) => !deleted.has(String(c.file_name || "").replace(/\.jsonl$/i, ""))).sort((a, b) => getTimestamp(b) - getTimestamp(a));
        if (remaining.length === 0) return;
        const latest = String(remaining[0].file_name).replace(/\.jsonl$/i, "");
        char.chat = latest;
        await this.saveLastChatPointer(char.avatar, char.name, latest);
      } catch (e) {
        console.debug("[API] repointLastChatAfterDelete failed:", e);
      }
    }
    // ============================================
    // 그룹 채팅 API
    // ============================================
    /**
     * 그룹 목록 가져오기
     * @returns {Promise<Array>}
     */
    async getGroups() {
      if (cache.isValid("groups")) {
        return cache.get("groups");
      }
      return cache.getOrFetch("groups", async () => {
        try {
          const context = this.getContext();
          if (context?.groups && Array.isArray(context.groups)) {
            cache.set("groups", context.groups);
            return context.groups;
          }
          const response = await this.fetchWithRetry("/api/groups/all", {
            method: "POST",
            headers: this.getRequestHeaders()
          });
          if (!response.ok) {
            console.error("[API] Failed to fetch groups:", response.status);
            return [];
          }
          const groups = await response.json();
          cache.set("groups", groups);
          return groups;
        } catch (error) {
          console.error("[API] Failed to load groups:", error);
          return [];
        }
      });
    }
    /**
     * 그룹 채팅 목록 가져오기 (과거 채팅들)
     * @param {string} groupId - 그룹 ID
     * @returns {Promise<Array>}
     */
    async getGroupChats(groupId) {
      try {
        const groups = await this.getGroups();
        const group = groups.find((g) => g.id === groupId);
        if (!group || !Array.isArray(group.chats)) {
          return [];
        }
        const BATCH_SIZE = 5;
        const allChats = [];
        for (let i = 0; i < group.chats.length; i += BATCH_SIZE) {
          const batch = group.chats.slice(i, i + BATCH_SIZE);
          const batchResults = await Promise.all(
            batch.map((chatId) => this._getGroupChatSummary(chatId))
          );
          allChats.push(...batchResults.filter(Boolean));
        }
        return allChats;
      } catch (error) {
        console.error("[API] Failed to load group chats:", error);
        return [];
      }
    }
    /**
     * 그룹 채팅 하나의 요약 (메시지 수, 마지막 메시지, 마지막 시간)
     * ★ /api/chats/group/info 사용: 서버가 파일을 한 줄씩 읽어 요약만 돌려줌
     *   (예전엔 /api/chats/group/get으로 채팅 파일 전체를 받아서 마지막 메시지만 썼음)
     * 구버전 ST에 info가 없으면 get으로 대체
     * @param {string} chatId
     * @returns {Promise<Object|null>}
     */
    async _getGroupChatSummary(chatId) {
      const body = JSON.stringify({ id: chatId });
      try {
        const infoRes = await fetch("/api/chats/group/info", {
          method: "POST",
          headers: this.getRequestHeaders(),
          body
        });
        if (infoRes.ok) {
          const info = await infoRes.json();
          if (!info || info.match === false && !info.file_name) return null;
          return {
            file_name: chatId,
            mes: info.mes || "[\uBE48 \uCC44\uD305]",
            last_mes: info.last_mes || Date.now(),
            chat_items: typeof info.chat_items === "number" ? info.chat_items : 0,
            isGroupChat: true
          };
        }
        if (infoRes.status !== 404) return null;
        const response = await this.fetchWithRetry("/api/chats/group/get", {
          method: "POST",
          headers: this.getRequestHeaders(),
          body
        });
        if (!response.ok) return null;
        const messages = await response.json();
        if (!Array.isArray(messages) || messages.length === 0) return null;
        const msgData = Object.hasOwn(messages[0] || {}, "chat_metadata") ? messages.slice(1) : messages;
        const lastMessage = msgData[msgData.length - 1] || null;
        return {
          file_name: chatId,
          mes: lastMessage?.mes || "[\uBE48 \uCC44\uD305]",
          last_mes: lastMessage?.send_date || Date.now(),
          chat_items: msgData.length,
          isGroupChat: true
        };
      } catch (e) {
        console.warn(`[API] Failed to load group chat ${chatId}:`, e);
        return null;
      }
    }
    /**
     * 그룹 정보 저장 (ST의 editGroup → /api/groups/edit와 동일한 요청)
     * 채팅 목록/현재 채팅(chat_id)을 바꾼 뒤 기록할 때 사용. 실패해도 채팅 동작에는 영향 없음.
     * @param {Object} group - context.groups의 그룹 객체
     * @returns {Promise<boolean>}
     */
    async saveGroup(group) {
      if (!group?.id) return false;
      try {
        const response = await fetch("/api/groups/edit", {
          method: "POST",
          headers: this.getRequestHeaders(),
          body: JSON.stringify(group)
        });
        if (response.ok) cache.invalidate("groups");
        return response.ok;
      } catch (e) {
        console.debug("[API] saveGroup error:", e);
        return false;
      }
    }
    /**
     * 그룹 아바타 URL 가져오기
     * @param {Object} group - 그룹 객체
     * @returns {string} 아바타 URL
     */
    getGroupAvatarUrl(group) {
      if (!group) return "/img/five.png";
      if (group.avatar_url && group.avatar_url !== "") {
        return group.avatar_url;
      }
      if (Array.isArray(group.members) && group.members.length > 0) {
        const firstMember = group.members[0];
        return charAvatarUrl(firstMember);
      }
      return "/img/five.png";
    }
    /**
     * 그룹 채팅 삭제
     * @param {string} groupId - 그룹 ID (캐시 무효화용)
     * @param {string} chatFileName - 채팅 파일명
     * @returns {Promise<boolean>}
     */
    async deleteGroupChat(groupId, chatFileName) {
      try {
        const fileName = chatFileName.replace(".jsonl", "");
        console.debug("[API] deleteGroupChat:", { groupId, fileName });
        const response = await this.fetchWithRetry("/api/chats/group/delete", {
          method: "POST",
          headers: this.getRequestHeaders(),
          body: JSON.stringify({
            id: fileName
            // 채팅 파일명 (그룹 ID 아님!)
          })
        });
        if (response.ok) {
          console.debug("[API] Group chat deleted successfully");
          cache.invalidate("groups");
          return true;
        }
        console.error("[API] Delete failed:", response.status);
        return false;
      } catch (error) {
        console.error("[API] deleteGroupChat error:", error);
        return false;
      }
    }
  };
  var api = new SillyTavernAPI();

  // src/data/lastChatCache.js
  var STORAGE_KEY2 = "chatLobby_lastChatTimes";
  var LastChatCache = class {
    constructor() {
      this.lastChatTimes = /* @__PURE__ */ new Map();
      this.initialized = false;
      this.initializing = false;
      this._dirty = false;
      this._loadFromStorage();
    }
    /**
     * localStorage에서 캐시 복원 (하위 호환성 지원)
     */
    _loadFromStorage() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY2);
        if (stored) {
          const data = JSON.parse(stored);
          if (data && typeof data === "object") {
            Object.entries(data).forEach(([avatar, value]) => {
              if (typeof value === "number") {
                this.lastChatTimes.set(avatar, { time: value, persona: null });
              } else if (value && typeof value === "object") {
                this.lastChatTimes.set(avatar, {
                  time: value.time || value.timestamp || 0,
                  // timestamp 하위 호환
                  persona: value.persona || null
                });
              }
            });
            console.debug("[LastChatCache] Restored", this.lastChatTimes.size, "entries from storage");
          }
        }
      } catch (e) {
        console.warn("[LastChatCache] Failed to load from storage:", e);
      }
    }
    /**
     * localStorage에 캐시 저장 (debounced)
     */
    _saveToStorage() {
      if (!this._dirty) return;
      try {
        const data = {};
        this.lastChatTimes.forEach((value, avatar) => {
          data[avatar] = value;
        });
        localStorage.setItem(STORAGE_KEY2, JSON.stringify(data));
        this._dirty = false;
      } catch (e) {
        console.warn("[LastChatCache] Failed to save to storage:", e);
      }
    }
    /**
     * 저장 예약 (debounce)
     */
    _scheduleSave() {
      this._dirty = true;
      if (this._saveTimer) clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => this._saveToStorage(), 1e3);
    }
    /**
     * 특정 캐릭터의 마지막 채팅 시간 가져오기
     */
    get(charAvatar) {
      const entry = this.lastChatTimes.get(charAvatar);
      if (!entry) return 0;
      if (typeof entry === "number") return entry;
      return entry.time || 0;
    }
    /**
     * 특정 캐릭터의 마지막 페르소나 가져오기
     */
    getPersona(charAvatar) {
      const entry = this.lastChatTimes.get(charAvatar);
      if (!entry || typeof entry === "number") return null;
      return entry.persona || null;
    }
    /**
     * 특정 캐릭터의 마지막 채팅 시간 설정 (기존 페르소나 유지)
     */
    set(charAvatar, timestamp) {
      if (timestamp <= 0) return;
      const existing = this.lastChatTimes.get(charAvatar);
      const currentTime = typeof existing === "number" ? existing : existing?.time || 0;
      const currentPersona = typeof existing === "object" ? existing.persona : null;
      if (timestamp > currentTime) {
        this.lastChatTimes.set(charAvatar, {
          time: timestamp,
          persona: currentPersona
        });
        this._scheduleSave();
      }
    }
    /**
     * 현재 시간 + 현재 페르소나로 업데이트 (메시지 송신 시)
     */
    async updateNow(charAvatar) {
      if (!charAvatar) return;
      let currentPersona = null;
      try {
        currentPersona = await api.getCurrentPersona();
      } catch (e) {
        console.warn("[LastChatCache] Could not get current persona:", e);
      }
      this.lastChatTimes.set(charAvatar, {
        time: Date.now(),
        persona: currentPersona || null
      });
      this._scheduleSave();
      console.debug("[LastChatCache] Updated to now:", charAvatar, "persona:", currentPersona);
    }
    /**
     * 채팅 목록에서 마지막 채팅 시간 추출
     */
    extractLastTime(chats) {
      if (!Array.isArray(chats) || chats.length === 0) return 0;
      let maxTime = 0;
      for (const chat of chats) {
        const chatTime = this.getChatTimestamp(chat);
        if (chatTime > maxTime) maxTime = chatTime;
      }
      return maxTime;
    }
    /**
     * 개별 채팅에서 타임스탬프 추출
     * ⚠️ dateUtils.getTimestamp 사용: ST의 last_mes는 "December 31, 2025 5:48pm"처럼
     * am/pm 앞에 공백이 없어서 new Date()로 바로 읽으면 NaN이 됨
     * (예전엔 NaN → "시간 모름" → 채팅 파일 3개를 통째로 내려받는 대체 경로를 탔음)
     */
    getChatTimestamp(chat) {
      return getTimestamp(chat);
    }
    /**
     * 캐릭터의 채팅 목록을 가져와서 마지막 시간 갱신
     */
    async refreshForCharacter(charAvatar, chats = null, forceRefresh = false) {
      try {
        if (!chats) {
          chats = cache.get("chats", charAvatar);
          if (!chats) {
            chats = await api.fetchChatsForCharacter(charAvatar);
          }
        }
        let lastTime = this.extractLastTime(chats);
        if (lastTime === 0 && !forceRefresh) {
          const cached = this.get(charAvatar);
          if (cached > 0) return cached;
        }
        if (lastTime > 0) this.set(charAvatar, lastTime);
        return lastTime;
      } catch (e) {
        console.error("[LastChatCache] Failed to refresh:", charAvatar, e);
        return 0;
      }
    }
    /**
     * 모든 캐릭터의 마지막 채팅 시간 초기화
     */
    async initializeAll(characters, batchSize = 5) {
      if (this._initPromise) {
        console.debug("[LastChatCache] Already initializing, waiting for existing...");
        return this._initPromise;
      }
      this._initPromise = this._doInitializeAll(characters, batchSize).finally(() => {
        this._initPromise = null;
      });
      return this._initPromise;
    }
    async _doInitializeAll(characters, batchSize) {
      console.debug("[LastChatCache] Initializing for", characters.length, "characters");
      try {
        for (let i = 0; i < characters.length; i += batchSize) {
          const batch = characters.slice(i, i + batchSize);
          await Promise.all(batch.map(async (char) => {
            const cached = this.get(char.avatar);
            if (cached > 0) return;
            if (char.date_last_chat) {
              this.set(char.avatar, char.date_last_chat);
              return;
            }
          }));
          if (i + batchSize < characters.length) {
            await new Promise((r) => setTimeout(r, 10));
          }
        }
        this.initialized = true;
        this._saveToStorage();
        console.debug("[LastChatCache] Initialized with", this.lastChatTimes.size, "entries");
      } catch (e) {
        console.error("[LastChatCache] Initialization failed:", e);
        this.initialized = true;
      }
    }
    /**
     * 캐릭터 정렬용 마지막 채팅 시간 가져오기
     */
    getForSort(char) {
      const cached = this.get(char.avatar);
      if (cached > 0) return cached;
      return char.date_last_chat || 0;
    }
    /**
     * 캐시 클리어
     */
    clear() {
      this.lastChatTimes.clear();
      this.initialized = false;
      this.initializing = false;
      this._dirty = false;
      if (this._saveTimer) clearTimeout(this._saveTimer);
      try {
        localStorage.removeItem(STORAGE_KEY2);
      } catch (e) {
        console.warn("[LastChatCache] Failed to clear storage:", e);
      }
    }
    /**
     * 특정 캐릭터 삭제
     */
    remove(charAvatar) {
      if (!charAvatar) return;
      if (this.lastChatTimes.has(charAvatar)) {
        this.lastChatTimes.delete(charAvatar);
        this._scheduleSave();
        console.debug("[LastChatCache] Removed:", charAvatar);
      }
    }
    /**
     * 삭제된 캐릭터들 정리
     */
    cleanupDeleted(existingCharacters) {
      if (!existingCharacters || !Array.isArray(existingCharacters)) return;
      const existingAvatars = new Set(existingCharacters.map((c) => c.avatar));
      let cleaned = 0;
      for (const avatar of this.lastChatTimes.keys()) {
        if (!existingAvatars.has(avatar)) {
          this.lastChatTimes.delete(avatar);
          cleaned++;
        }
      }
      if (cleaned > 0) {
        console.debug("[LastChatCache] Cleaned", cleaned, "deleted characters");
        this._scheduleSave();
      }
    }
  };
  var lastChatCache = new LastChatCache();

  // src/ui/tabView.js
  init_textUtils();
  init_notifications();

  // src/utils/operationLock.js
  var OperationLock = class {
    constructor() {
      this._seq = 0;
      this._token = null;
      this._currentOp = null;
      this._safetyTimer = null;
    }
    /** 현재 잠금 상태 */
    get isLocked() {
      return this._token !== null;
    }
    /** 현재 실행 중인 작업명 */
    get currentOp() {
      return this._currentOp;
    }
    /**
     * Lock 획득 시도
     * @param {string} opName - 작업 이름 (디버그용)
     * @param {number} timeout - 안전 해제 타임아웃 (ms)
     *   ⚠️ 작업의 "최악 소요 시간"보다 길게 잡을 것.
     *   (예: openChat은 waitForChatChanged 5초 × 2회 + 마진 → 15000)
     * @returns {number|null} - 성공 시 토큰, 실패 시 null
     */
    acquire(opName, timeout = 8e3) {
      if (this._token !== null) {
        console.warn(`[OperationLock] Blocked: "${opName}" (running: "${this._currentOp}")`);
        return null;
      }
      const token = ++this._seq;
      this._token = token;
      this._currentOp = opName;
      this._safetyTimer = setTimeout(() => {
        if (this._token === token) {
          console.warn(`[OperationLock] Safety release: "${opName}" timed out (${timeout}ms)`);
          this._clear();
        }
      }, timeout);
      return token;
    }
    /**
     * 해당 토큰이 아직 유효한(현재 활성) 작업인지 확인
     * 안전 타임아웃으로 해제됐거나 다른 작업이 시작됐으면 false
     * @param {number|null} token
     * @returns {boolean}
     */
    isCurrent(token) {
      return token !== null && token !== void 0 && token === this._token;
    }
    /**
     * Lock 해제 (토큰 일치 시에만)
     * @param {number|null} token - acquire()가 반환한 토큰
     * @returns {boolean} - 실제로 해제됐는지
     */
    release(token) {
      if (!this.isCurrent(token)) {
        return false;
      }
      this._clear();
      return true;
    }
    /** 내부 상태 초기화 */
    _clear() {
      this._token = null;
      this._currentOp = null;
      if (this._safetyTimer) {
        clearTimeout(this._safetyTimer);
        this._safetyTimer = null;
      }
    }
  };
  var operationLock = new OperationLock();

  // src/ui/chatList.js
  init_textUtils();

  // src/utils/eventHelpers.js
  init_config();

  // src/utils/listenerManager.js
  var ListenerManager = class {
    constructor() {
      this._groups = /* @__PURE__ */ new Map();
    }
    /**
     * 리스너 등록 (그룹 단위 추적)
     * @param {string} group - 그룹 이름 (모듈/기능 단위, 예: 'global', 'radialMenu', 'tooltip')
     * @param {EventTarget|null} target - 대상 (null이면 무시)
     * @param {string} type - 이벤트 타입
     * @param {Function} handler - 핸들러
     * @param {any} [options] - addEventListener 옵션
     * @returns {Function} handler (체이닝용)
     */
    add(group, target, type, handler, options) {
      if (!target || typeof handler !== "function") return handler;
      target.addEventListener(type, handler, options);
      if (!this._groups.has(group)) {
        this._groups.set(group, []);
      }
      this._groups.get(group).push({ target, type, handler, options });
      return handler;
    }
    /**
     * 그룹의 모든 리스너 해제
     * @param {string} group
     * @returns {number} 해제된 리스너 수
     */
    clear(group) {
      const list = this._groups.get(group);
      if (!list) return 0;
      for (const { target, type, handler, options } of list) {
        try {
          target.removeEventListener(type, handler, options);
        } catch (e) {
          console.warn(`[ListenerManager] Failed to remove ${group}/${type}:`, e);
        }
      }
      this._groups.delete(group);
      return list.length;
    }
    /**
     * 모든 그룹 해제 (확장 전체 cleanup용)
     */
    clearAll() {
      let total = 0;
      for (const group of [...this._groups.keys()]) {
        total += this.clear(group);
      }
      if (total > 0) {
        console.debug(`[ListenerManager] Cleared ${total} listeners`);
      }
    }
    /**
     * 그룹별 등록 현황 (디버그용)
     * @returns {Object<string, number>}
     */
    stats() {
      const result = {};
      this._groups.forEach((list, group) => {
        result[group] = list.length;
      });
      return result;
    }
  };
  var listeners = new ListenerManager();

  // src/utils/eventHelpers.js
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
  var globalLastClickTime = 0;
  var GLOBAL_CLICK_COOLDOWN = 500;
  function createTouchClickHandler(element, handler, options = {}) {
    const {
      preventDefault = true,
      stopPropagation = true,
      scrollThreshold = 10,
      debugName = "unknown"
    } = options;
    let touchStartX2 = 0;
    let touchStartY = 0;
    let isScrolling = false;
    let touchHandled = false;
    let lastHandleTime = 0;
    const wrappedHandler = (e, source) => {
      const now = Date.now();
      if (now - globalLastClickTime < GLOBAL_CLICK_COOLDOWN) {
        return;
      }
      globalLastClickTime = now;
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
      touchStartX2 = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    element.addEventListener("touchmove", (e) => {
      const deltaX = Math.abs(e.touches[0].clientX - touchStartX2);
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
  function bindDelegatedTouchClick(container, route, options = {}) {
    const {
      group = "delegated",
      scrollThreshold = 10,
      debugName = "delegated"
    } = options;
    if (!container) return;
    let touchStartX2 = 0;
    let touchStartY = 0;
    let isScrolling = false;
    let touchHandled = false;
    const wrappedRoute = (e) => {
      const now = Date.now();
      if (now - globalLastClickTime < GLOBAL_CLICK_COOLDOWN) return;
      if (isScrolling) return;
      let handled = false;
      try {
        handled = route(e) === true;
      } catch (error) {
        console.error(`[EventHelper] ${debugName}: Route error:`, error);
      }
      if (handled) {
        globalLastClickTime = now;
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
      }
      return handled;
    };
    listeners.add(group, container, "touchstart", (e) => {
      touchHandled = false;
      isScrolling = false;
      touchStartX2 = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    listeners.add(group, container, "touchmove", (e) => {
      const deltaX = Math.abs(e.touches[0].clientX - touchStartX2);
      const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
      if (deltaX > scrollThreshold || deltaY > scrollThreshold) {
        isScrolling = true;
      }
    }, { passive: true });
    listeners.add(group, container, "touchend", (e) => {
      if (!isScrolling) {
        touchHandled = wrappedRoute(e) === true;
      }
      isScrolling = false;
    });
    listeners.add(group, container, "click", (e) => {
      if (!touchHandled) {
        wrappedRoute(e);
      }
      touchHandled = false;
    });
  }

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
  function waitForChatChanged(timeout = 5e3) {
    return new Promise((resolve) => {
      const context = window.SillyTavern?.getContext?.();
      if (!context?.eventSource || !context?.eventTypes?.CHAT_CHANGED) {
        setTimeout(() => resolve(false), 1e3);
        return;
      }
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          context.eventSource.removeListener(context.eventTypes.CHAT_CHANGED, handler);
          console.warn("[waitForChatChanged] Timed out after", timeout, "ms");
          resolve(false);
        }
      }, timeout);
      const handler = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          context.eventSource.removeListener(context.eventTypes.CHAT_CHANGED, handler);
          resolve(true);
        }
      };
      context.eventSource.on(context.eventTypes.CHAT_CHANGED, handler);
    });
  }

  // src/ui/chatList.js
  init_notifications();

  // src/data/branchCache.js
  var STORAGE_KEY3 = "chatLobby_branchCache";
  var FINGERPRINT_MESSAGE_COUNT = 10;
  var cacheData = null;
  function loadCache() {
    if (cacheData) return cacheData;
    try {
      const stored = localStorage.getItem(STORAGE_KEY3);
      if (stored) {
        cacheData = JSON.parse(stored);
      }
    } catch (e) {
      console.warn("[BranchCache] Failed to load cache:", e);
    }
    if (!cacheData || cacheData.version !== 1) {
      cacheData = { version: 1, characters: {} };
    }
    return cacheData;
  }
  function saveCache() {
    try {
      localStorage.setItem(STORAGE_KEY3, JSON.stringify(cacheData));
    } catch (e) {
      console.warn("[BranchCache] Failed to save cache:", e);
    }
  }
  function hashString(str) {
    let h1 = 5381;
    let h2 = 52711;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = (h1 << 5) + h1 ^ ch;
      h2 = (h2 << 5) + h2 ^ ch;
      h1 = h1 | 0;
      h2 = h2 | 0;
    }
    const combined = (h1 >>> 0).toString(36) + "-" + (h2 >>> 0).toString(36);
    return combined;
  }
  function createFingerprint(messages, fileName = "unknown") {
    if (!messages || messages.length === 0) {
      return "empty";
    }
    const targetCount = Math.min(FINGERPRINT_MESSAGE_COUNT, messages.length);
    let combined = "";
    for (let i = 0; i < targetCount; i++) {
      const msg = messages[i];
      if (msg && msg.mes) {
        combined += (msg.is_user ? "U" : "A") + ":" + msg.mes.substring(0, 100) + "|";
      }
    }
    const hash = hashString(combined);
    return hash;
  }
  function setFingerprintBatch(charAvatar, entries) {
    if (!entries || entries.length === 0) return;
    const cache2 = loadCache();
    if (!cache2.characters[charAvatar]) {
      cache2.characters[charAvatar] = { fingerprints: {}, branches: {} };
    }
    const now = Date.now();
    for (const { fileName, hash, length } of entries) {
      cache2.characters[charAvatar].fingerprints[fileName] = {
        hash,
        length,
        lastUpdated: now
      };
    }
    saveCache();
  }
  function setBranchInfoBatch(charAvatar, entries) {
    if (!entries || entries.length === 0) return;
    const cache2 = loadCache();
    if (!cache2.characters[charAvatar]) {
      cache2.characters[charAvatar] = { fingerprints: {}, branches: {} };
    }
    for (const { fileName, parentChat, branchPoint, depth } of entries) {
      cache2.characters[charAvatar].branches[fileName] = {
        parentChat,
        branchPoint,
        depth
      };
    }
    saveCache();
  }
  function getAllBranches(charAvatar) {
    const cache2 = loadCache();
    return cache2.characters[charAvatar]?.branches || {};
  }
  function getAllFingerprints(charAvatar) {
    const cache2 = loadCache();
    return cache2.characters[charAvatar]?.fingerprints || {};
  }
  function clearCharacterCache(charAvatar) {
    const cache2 = loadCache();
    delete cache2.characters[charAvatar];
    saveCache();
    console.debug("[BranchCache] Cleared cache for:", charAvatar);
  }

  // src/utils/branchAnalyzer.js
  var SAFETY = {
    TIMEOUT_MS: 12e4,
    // 전체 분석 120초 제한 (채팅 많은 캐릭터 고려)
    MAX_API_CALLS: 200,
    // API 호출 최대 200회
    MAX_ERRORS: 15,
    // 누적 에러 15회시 중단
    REQUEST_TIMEOUT_MS: 15e3,
    // 개별 fetch 요청 15초 제한
    RETRY_DELAY_MS: 1e3
    // 재시도 전 대기 시간
  };
  var chatContentCache = /* @__PURE__ */ new Map();
  function clearContentCache() {
    chatContentCache.clear();
  }
  function createAnalysisContext() {
    return {
      startTime: Date.now(),
      apiCalls: 0,
      errorCount: 0,
      aborted: false,
      abortReason: ""
    };
  }
  function checkSafety(ctx) {
    if (ctx.aborted) return false;
    if (Date.now() - ctx.startTime > SAFETY.TIMEOUT_MS) {
      ctx.aborted = true;
      ctx.abortReason = `Timeout: ${SAFETY.TIMEOUT_MS}ms exceeded`;
      console.warn("[BranchAnalyzer] SAFETY ABORT:", ctx.abortReason);
      return false;
    }
    if (ctx.apiCalls >= SAFETY.MAX_API_CALLS) {
      ctx.aborted = true;
      ctx.abortReason = `API call limit: ${ctx.apiCalls}/${SAFETY.MAX_API_CALLS}`;
      console.warn("[BranchAnalyzer] SAFETY ABORT:", ctx.abortReason);
      return false;
    }
    if (ctx.errorCount >= SAFETY.MAX_ERRORS) {
      ctx.aborted = true;
      ctx.abortReason = `Too many errors: ${ctx.errorCount}/${SAFETY.MAX_ERRORS}`;
      console.warn("[BranchAnalyzer] SAFETY ABORT:", ctx.abortReason);
      return false;
    }
    return true;
  }
  function extractDateFromFileName(fileName) {
    const match = fileName.match(
      /(\d{4})-(\d{1,2})-(\d{1,2})\s*@(\d{2})h\s*(\d{2})m\s*(\d{2})s(?:\s*(\d+)ms)?/
    );
    if (!match) return null;
    const timestamp = new Date(
      parseInt(match[1]),
      parseInt(match[2]) - 1,
      parseInt(match[3]),
      parseInt(match[4]),
      parseInt(match[5]),
      parseInt(match[6]),
      match[7] ? parseInt(match[7]) : 0
    ).getTime();
    return isNaN(timestamp) ? null : timestamp;
  }
  async function loadChatContent(charAvatar, fileName, ctx = null) {
    const cacheKey = `${charAvatar}:${fileName}`;
    if (chatContentCache.has(cacheKey)) {
      return chatContentCache.get(cacheKey);
    }
    if (ctx) ctx.apiCalls++;
    const charDir = charAvatar.replace(/\.(png|jpg|webp)$/i, "");
    const chatName = fileName.replace(".jsonl", "");
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), SAFETY.REQUEST_TIMEOUT_MS);
        let response;
        try {
          response = await fetch("/api/chats/get", {
            method: "POST",
            headers: api.getRequestHeaders(),
            body: JSON.stringify({
              ch_name: charDir,
              file_name: chatName,
              avatar_url: charAvatar
            }),
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeoutId);
        }
        if (!response.ok) {
          if (attempt === 0) {
            console.warn(`[BranchAnalyzer] HTTP ${response.status} loading ${fileName}, retrying...`);
            await new Promise((r) => setTimeout(r, SAFETY.RETRY_DELAY_MS));
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
        const reason = e.name === "AbortError" ? "TIMEOUT" : e.message || e;
        if (attempt === 0) {
          console.warn(`[BranchAnalyzer] ${reason} loading ${fileName}, retrying...`);
          await new Promise((r) => setTimeout(r, SAFETY.RETRY_DELAY_MS));
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
  async function ensureFingerprints(charAvatar, chats, onProgress = null, forceRefresh = false, ctx = null) {
    const isStandalone = !ctx;
    try {
      const existing = forceRefresh ? {} : getAllFingerprints(charAvatar);
      const result = { ...existing };
      const needsUpdate = forceRefresh ? chats : chats.filter((chat) => {
        const fn = chat.file_name || "";
        const cached = existing[fn];
        const chatLength = chat.chat_items || chat.message_count || 0;
        return !cached || cached.length !== chatLength;
      });
      const BATCH_SIZE = 3;
      const batchEntries = [];
      for (let i = 0; i < needsUpdate.length; i += BATCH_SIZE) {
        if (ctx && !checkSafety(ctx)) break;
        const batch = needsUpdate.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (chat) => {
          const fn = chat.file_name || "";
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
        await new Promise((r) => setTimeout(r, 200));
      }
      if (batchEntries.length > 0) {
        setFingerprintBatch(charAvatar, batchEntries);
      }
      return result;
    } finally {
      if (isStandalone) {
        clearContentCache();
      }
    }
  }
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
  function hashMessageFast(msg) {
    if (!msg?.mes) return msg?.is_user ? "U:0:" : "A:0:";
    const m = msg.mes;
    const len = m.length;
    const head = m.substring(0, 50);
    const tail = len > 100 ? m.substring(len - 50) : "";
    const mid = len > 150 ? m.substring(len >> 1, (len >> 1) + 50) : "";
    return `${msg.is_user ? "U" : "A"}:${len}:${head}${tail}${mid}`;
  }
  function findCommonPrefixLengthFast(chat1, chat2) {
    const minLen = Math.min(chat1.length, chat2.length);
    if (minLen === 0) return 0;
    if (chat1[minLen - 1] === chat2[minLen - 1]) return minLen;
    let lo = 0, hi = minLen - 1;
    while (lo < hi) {
      const mid = lo + hi >>> 1;
      if (chat1[mid] === chat2[mid]) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  }
  async function analyzeGroup(charAvatar, group, ctx = null) {
    if (group.length < 2) return {};
    if (group.length > 30) {
      console.warn(`[BranchAnalyzer] Large group (${group.length}), truncating to 30`);
      group = group.slice(0, 30);
    }
    const chatContents = {};
    const chatHashes = {};
    await Promise.all(group.map(async (item) => {
      const content = await loadChatContent(charAvatar, item.fileName, ctx);
      if (content) {
        chatContents[item.fileName] = content;
        chatHashes[item.fileName] = content.map((msg) => hashMessageFast(msg));
      }
    }));
    const validFiles = group.filter((g) => chatContents[g.fileName]?.length >= 2);
    if (validFiles.length < 2) return {};
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
    if (allHaveDates) {
      return analyzeByDate(validFiles, dates, chatContents, chatHashes);
    } else {
      return analyzeByScore(validFiles, chatContents, chatHashes);
    }
  }
  function analyzeByDate(group, dates, chatContents, chatHashes) {
    const result = {};
    const sorted = [...group].sort((a, b) => dates[a.fileName] - dates[b.fileName]);
    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const currentContent = chatContents[current.fileName];
      const currentHashes = chatHashes[current.fileName];
      if (!currentContent || !currentHashes) continue;
      let bestParent = null;
      let bestCommon = 0;
      for (let j = 0; j < i; j++) {
        const candidate = sorted[j];
        const candidateContent = chatContents[candidate.fileName];
        const candidateHashes = chatHashes[candidate.fileName];
        if (!candidateContent || !candidateHashes) continue;
        const common = findCommonPrefixLengthFast(currentHashes, candidateHashes);
        if (common === 0) continue;
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
    calculateDepths(result);
    return result;
  }
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
        const common = findCommonPrefixLengthFast(currentHashes, candidateHashes);
        if (common === 0) continue;
        if (currentContent.length <= common) continue;
        if (candidateContent.length > currentContent.length) continue;
        if (candidateContent.length === currentContent.length && candidate.fileName > current.fileName) continue;
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
    calculateDepths(result);
    return result;
  }
  function calculateDepths(result) {
    const getDepth = (fileName, visited = /* @__PURE__ */ new Set()) => {
      if (visited.has(fileName)) {
        console.warn("[BranchAnalyzer] Cycle detected at", fileName, "\u2014 removing parent link");
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
  function findGroupRoots(fileName, branches) {
    let root = fileName;
    const visited = /* @__PURE__ */ new Set();
    while (branches[root]?.parentChat && !visited.has(root)) {
      visited.add(root);
      root = branches[root].parentChat;
    }
    return [root];
  }
  async function analyzeBranches(charAvatar, chats, onProgress = null, forceRefresh = false) {
    console.debug("[BranchAnalyzer] Starting analysis for", charAvatar, "forceRefresh:", forceRefresh, "chats:", chats.length);
    if (chats.length < 2) {
      console.debug("[BranchAnalyzer] Not enough chats to analyze");
      return {};
    }
    const ctx = createAnalysisContext();
    try {
      const fingerprints = await ensureFingerprints(charAvatar, chats, (p) => {
        if (onProgress) onProgress(p * 0.2);
      }, forceRefresh, ctx);
      if (ctx.aborted) {
        console.warn("[BranchAnalyzer] Aborted during fingerprint phase:", ctx.abortReason);
        return {};
      }
      const groups = groupByFingerprint(fingerprints);
      const multiGroups = Object.values(groups).filter((g) => g.length >= 2);
      const singleGroups = Object.values(groups).filter((g) => g.length === 1);
      console.debug(`[BranchAnalyzer] Found ${multiGroups.length} groups with 2+ chats (total ${Object.keys(groups).length} groups)`);
      const allBranches = {};
      const branchEntries = [];
      for (let i = 0; i < multiGroups.length; i++) {
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
          console.debug(
            "[BranchAnalyzer] Branch found:",
            fileName,
            "\u2192 parent:",
            info.parentChat,
            "branchPoint:",
            info.branchPoint
          );
        }
        if (onProgress) {
          onProgress(0.2 + (i + 1) / Math.max(1, multiGroups.length) * 0.75);
        }
      }
      if (singleGroups.length > 0 && !ctx.aborted) {
        const allChats = Object.entries(fingerprints).map(([fn, fp]) => ({ fileName: fn, length: fp.length }));
        const orphanFiles = singleGroups.map((g) => g[0].fileName);
        const orphanContents = {};
        const orphanHashes = {};
        for (const orphanFn of orphanFiles) {
          if (!checkSafety(ctx)) break;
          const content = await loadChatContent(charAvatar, orphanFn, ctx);
          if (content && content.length >= 2) {
            orphanContents[orphanFn] = content;
            orphanHashes[orphanFn] = content.map((msg) => hashMessageFast(msg));
          }
        }
        const nonOrphanFiles = allChats.filter((c) => !orphanFiles.includes(c.fileName));
        const nonOrphanContents = {};
        const nonOrphanHashes = {};
        for (const item of nonOrphanFiles) {
          if (!checkSafety(ctx)) break;
          const content = await loadChatContent(charAvatar, item.fileName, ctx);
          if (content && content.length >= 2) {
            nonOrphanContents[item.fileName] = content;
            nonOrphanHashes[item.fileName] = content.map((msg) => hashMessageFast(msg));
          }
        }
        for (const orphanFn of orphanFiles) {
          if (!checkSafety(ctx)) break;
          if (!orphanHashes[orphanFn]) continue;
          if (allBranches[orphanFn]) continue;
          const orphanH = orphanHashes[orphanFn];
          const orphanC = orphanContents[orphanFn];
          const orphanLen = orphanC.length;
          let bestMatch = null;
          let bestCommon = 0;
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
            const orphanDate = extractDateFromFileName(orphanFn);
            const matchDate = extractDateFromFileName(bestMatch);
            let orphanIsParent;
            if (orphanDate && matchDate) {
              orphanIsParent = orphanDate < matchDate;
            } else {
              orphanIsParent = orphanLen <= matchLen;
            }
            if (orphanIsParent) {
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
        calculateDepths(allBranches);
      }
      for (const [fileName, info] of Object.entries(allBranches)) {
        const parentFp = fingerprints[info.parentChat];
        if (parentFp && info.branchPoint > parentFp.length) {
          console.warn(`[BranchAnalyzer] Invalid branchPoint: ${fileName} branchPoint=${info.branchPoint} > parent(${info.parentChat}).length=${parentFp.length}. Removing.`);
          delete allBranches[fileName];
          const idx = branchEntries.findIndex((e) => e.fileName === fileName);
          if (idx !== -1) branchEntries.splice(idx, 1);
        }
      }
      if (branchEntries.length > 0) {
        setBranchInfoBatch(charAvatar, branchEntries);
      }
      if (onProgress) onProgress(1);
      if (ctx.aborted) {
        console.warn(`[BranchAnalyzer] Analysis aborted: ${ctx.abortReason}`);
      }
      console.debug(`[BranchAnalyzer] Safety report: apiCalls=${ctx.apiCalls}, errors=${ctx.errorCount}, elapsed=${Date.now() - ctx.startTime}ms, aborted=${ctx.aborted}`);
      console.debug("[BranchAnalyzer] Analysis complete:", Object.keys(allBranches).length, "branches found");
      return allBranches;
    } finally {
      clearContentCache();
    }
  }
  function needsBranchAnalysis(charAvatar, chats) {
    if (chats.length < 2) return false;
    const fingerprints = getAllFingerprints(charAvatar);
    for (const chat of chats) {
      const fn = chat.file_name || "";
      if (!fingerprints[fn]) {
        return true;
      }
    }
    return false;
  }

  // src/data/remindStore.js
  var STORAGE_KEY4 = "chatLobby_reminds";
  var PROGRESS_KEY = "chatLobby_remindProgress";
  var PROGRESS_MAX_ENTRIES = 150;
  var RemindStore = class {
    constructor() {
      this._data = null;
    }
    /** @returns {Remind[]} */
    _load() {
      if (this._data) return this._data;
      try {
        const raw = localStorage.getItem(STORAGE_KEY4);
        this._data = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(this._data)) this._data = [];
      } catch (e) {
        console.warn("[RemindStore] Failed to load:", e);
        this._data = [];
      }
      return this._data;
    }
    _save() {
      try {
        localStorage.setItem(STORAGE_KEY4, JSON.stringify(this._data));
      } catch (e) {
        console.warn("[RemindStore] Failed to save:", e);
      }
    }
    /**
     * 전체 목록 (최신순)
     * @returns {Remind[]}
     */
    getAll() {
      return [...this._load()].sort((a, b) => b.createdAt - a.createdAt);
    }
    /**
     * 리마인드 추가
     * @param {Omit<Remind, 'id'|'createdAt'>} remind
     * @returns {Remind}
     */
    add(remind) {
      const data = this._load();
      const entry = {
        ...remind,
        id: "rm_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
        createdAt: Date.now()
      };
      data.push(entry);
      this._save();
      return entry;
    }
    /**
     * 리마인드 삭제
     * @param {string} id
     * @returns {boolean}
     */
    remove(id) {
      const data = this._load();
      const idx = data.findIndex((r) => r.id === id);
      if (idx === -1) return false;
      data.splice(idx, 1);
      this._save();
      this.removeProgress(id);
      return true;
    }
    // ============================================
    // 읽기 진행 위치 (이어 읽기)
    // ============================================
    _loadProgress() {
      try {
        const raw = localStorage.getItem(PROGRESS_KEY);
        const data = raw ? JSON.parse(raw) : {};
        return data && typeof data === "object" ? data : {};
      } catch (e) {
        return {};
      }
    }
    _saveProgress(map) {
      try {
        const keys = Object.keys(map);
        if (keys.length > PROGRESS_MAX_ENTRIES) {
          keys.sort((a, b) => (map[a].ts || 0) - (map[b].ts || 0));
          for (const k of keys.slice(0, keys.length - PROGRESS_MAX_ENTRIES)) {
            delete map[k];
          }
        }
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
      } catch (e) {
        console.warn("[RemindStore] Failed to save progress:", e);
      }
    }
    /**
     * 읽기 진행 위치 조회
     * @param {string} id - 리마인드 ID
     * @returns {{viewStart:number, viewEnd:number, pageIndex:number, scrollTop:number}|null}
     */
    getProgress(id) {
      return this._loadProgress()[id] || null;
    }
    /**
     * 읽기 진행 위치 저장 (연장된 범위 포함)
     */
    setProgress(id, progress) {
      const map = this._loadProgress();
      map[id] = { ...progress, ts: Date.now() };
      this._saveProgress(map);
    }
    removeProgress(id) {
      const map = this._loadProgress();
      if (map[id]) {
        delete map[id];
        this._saveProgress(map);
      }
    }
    /**
     * ID로 조회
     * @param {string} id
     * @returns {Remind|null}
     */
    get(id) {
      return this._load().find((r) => r.id === id) || null;
    }
    /**
     * 채팅 이름 변경 시 동기화
     * @param {string} avatar
     * @param {string} oldFileName
     * @param {string} newFileName
     */
    renameChat(avatar, oldFileName, newFileName) {
      const oldName = (oldFileName || "").replace(/\.jsonl$/i, "");
      const newName = (newFileName || "").replace(/\.jsonl$/i, "");
      let changed = false;
      for (const r of this._load()) {
        if (r.avatar === avatar && r.fileName === oldName) {
          r.fileName = newName;
          changed = true;
        }
      }
      if (changed) this._save();
    }
    /**
     * 캐릭터 삭제 시 정리
     * @param {string} avatar
     */
    removeByAvatar(avatar) {
      const data = this._load();
      const before = data.length;
      this._data = data.filter((r) => r.avatar !== avatar);
      if (this._data.length !== before) this._save();
    }
  };
  var remindStore = new RemindStore();

  // src/data/highlightStore.js
  var STORAGE_KEY5 = "chatLobby_highlights";
  var HighlightStore = class {
    constructor() {
      this._data = null;
    }
    _load() {
      if (this._data) return this._data;
      try {
        const raw = localStorage.getItem(STORAGE_KEY5);
        this._data = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(this._data)) this._data = [];
      } catch (e) {
        console.warn("[HighlightStore] Failed to load:", e);
        this._data = [];
      }
      return this._data;
    }
    _save() {
      try {
        localStorage.setItem(STORAGE_KEY5, JSON.stringify(this._data));
      } catch (e) {
        console.warn("[HighlightStore] Failed to save:", e);
      }
    }
    /**
     * 특정 메시지의 하이라이트 목록
     */
    getForMessage(avatar, fileName, mesid) {
      const clean = (fileName || "").replace(/\.jsonl$/i, "");
      return this._load().filter((h) => h.avatar === avatar && h.fileName === clean && h.mesid === mesid);
    }
    /**
     * 하이라이트 추가
     * @returns {Highlight}
     */
    add({ avatar, fileName, mesid, text }) {
      const data = this._load();
      const entry = {
        id: "hl_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
        avatar,
        fileName: (fileName || "").replace(/\.jsonl$/i, ""),
        mesid,
        text: text.slice(0, 600),
        createdAt: Date.now()
      };
      data.push(entry);
      this._save();
      return entry;
    }
    /**
     * 하이라이트 삭제
     */
    remove(id) {
      const data = this._load();
      const idx = data.findIndex((h) => h.id === id);
      if (idx === -1) return false;
      data.splice(idx, 1);
      this._save();
      return true;
    }
    /**
     * 채팅 이름 변경 동기화
     */
    renameChat(avatar, oldFileName, newFileName) {
      const oldName = (oldFileName || "").replace(/\.jsonl$/i, "");
      const newName = (newFileName || "").replace(/\.jsonl$/i, "");
      let changed = false;
      for (const h of this._load()) {
        if (h.avatar === avatar && h.fileName === oldName) {
          h.fileName = newName;
          changed = true;
        }
      }
      if (changed) this._save();
    }
    /**
     * 캐릭터 삭제 시 정리
     */
    removeByAvatar(avatar) {
      const data = this._load();
      const before = data.length;
      this._data = data.filter((h) => h.avatar !== avatar);
      if (this._data.length !== before) this._save();
    }
  };
  var highlightStore = new HighlightStore();

  // src/utils/chatTextFormatter.js
  init_textUtils();
  function getScriptFlags(script) {
    switch (script?.substituteRegex) {
      case 1:
        return "g";
      case 2:
        return "i";
      case 3:
        return "";
      default:
        return "gi";
    }
  }
  function regexFromString(regexStr, script) {
    if (!regexStr) return null;
    const slashForm = regexStr.match(/^\/(.*?)\/([gimsuy]*)$/);
    try {
      if (slashForm) return new RegExp(slashForm[1], slashForm[2]);
      return new RegExp(regexStr, getScriptFlags(script));
    } catch (e) {
      console.warn("[ChatFormatter] Invalid regex:", regexStr, e.message);
      return null;
    }
  }
  function collectRegexScripts(context, charAvatar) {
    const scripts = [];
    const ext = context?.extensionSettings || {};
    if (Array.isArray(ext.regex)) scripts.push(...ext.regex);
    else if (Array.isArray(ext.regex?.scripts)) scripts.push(...ext.regex.scripts);
    if (Array.isArray(ext.regex_scripts)) scripts.push(...ext.regex_scripts);
    try {
      const char = (context?.characters || []).find((c) => c.avatar === charAvatar);
      const embedded = char?.data?.extensions?.regex_scripts;
      if (Array.isArray(embedded)) scripts.push(...embedded);
    } catch (e) {
    }
    return scripts;
  }
  function applyRegexScript(script, text, options) {
    if (!script?.findRegex || !text) return text;
    const findRegex = regexFromString(script.findRegex, script);
    if (!findRegex) return text;
    const replaceTemplate = (script.replaceString || "").replace(/\{\{match\}\}/gi, "$0");
    const trimStrings = Array.isArray(script.trimStrings) ? script.trimStrings.filter(Boolean) : [];
    try {
      return text.replace(findRegex, function() {
        const args = [...arguments];
        let output = replaceTemplate.replace(/\$(\d+)|\$<([^>]+)>/g, (_, num, groupName) => {
          let groupMatch;
          if (num !== void 0) {
            groupMatch = args[Number(num)];
          } else if (groupName) {
            const groups = args[args.length - 1];
            groupMatch = groups && typeof groups === "object" ? groups[groupName] : void 0;
          }
          if (!groupMatch) return "";
          for (const trimStr of trimStrings) {
            groupMatch = groupMatch.replaceAll(trimStr, "");
          }
          return groupMatch;
        });
        if (options.characterName) {
          output = output.replace(/\{\{charkey\}\}/gi, options.characterName);
          output = output.replace(/\{\{char\}\}/gi, options.characterName);
        }
        if (options.userName) {
          output = output.replace(/\{\{user\}\}/gi, options.userName);
        }
        return output;
      });
    } catch (e) {
      console.warn("[ChatFormatter] Regex script failed:", script.scriptName, e);
      return text;
    }
  }
  function applyStRegexScripts(text, options) {
    if (!text) return text;
    try {
      const context = window.SillyTavern?.getContext?.();
      if (!context) return text;
      const scripts = collectRegexScripts(context, options.charAvatar);
      let result = text;
      for (const script of scripts) {
        if (script.disabled) continue;
        if (script.promptOnly) continue;
        if (Array.isArray(script.placement) && script.placement.length > 0) {
          const forAi = script.placement.includes(2);
          const forUser = script.placement.includes(1);
          const forDisplay = script.placement.includes(0);
          if (options.isUser && !forUser && !forDisplay) continue;
          if (!options.isUser && !forAi && !forDisplay) continue;
        }
        result = applyRegexScript(script, result, options);
      }
      return result;
    } catch (e) {
      console.warn("[ChatFormatter] applyStRegexScripts error:", e);
      return text;
    }
  }
  function escapeAttr(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function resolveImagePath(filename, characterName) {
    if (!filename) return "";
    if (filename.startsWith("http://") || filename.startsWith("https://") || filename.startsWith("data:")) {
      return filename;
    }
    if (filename.startsWith("/")) return filename;
    return `/characters/${encodeURIComponent(characterName || "Unknown")}/${encodeURIComponent(filename)}`;
  }
  function createImageHtml(src, alt) {
    return `<div class="remind-image-container"><img class="remind-image" src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" title="${escapeAttr(alt)}" loading="lazy" decoding="async"></div>`;
  }
  function resolveAnyImageUrl(url, characterName) {
    if (!url) return "";
    if (/^(https?:|data:|\/)/i.test(url)) return url;
    if (url.includes("/")) return "/" + url.replace(/^\/+/, "");
    return resolveImagePath(url, characterName);
  }
  function processImages(text, characterName) {
    if (!text) return text;
    text = text.replace(/\{\{img::([^}]+)\}\}/gi, (match, filename) => {
      const trimmed = filename.trim();
      return createImageHtml(resolveImagePath(trimmed, characterName), trimmed);
    });
    text = text.replace(/!\[([^\]]*)\]\(\s*(<[^>]+>|[^)\s]+)(?:\s+"[^"]*")?\s*\)/g, (match, alt, url) => {
      const cleanUrl = url.replace(/^<|>$/g, "").trim();
      if (!cleanUrl) return match;
      return createImageHtml(resolveAnyImageUrl(cleanUrl, characterName), alt || "");
    });
    return text;
  }
  function stripToPlainText(mes) {
    if (!mes) return "";
    return mes.replace(/<img[^>]*>/gi, "").replace(/\{\{img::[^}]*\}\}/gi, "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").trim();
  }
  function renderExtraImagesHtml(message) {
    if (!message?.extra) return "";
    const images = [];
    const extra = Object.assign({}, message.extra);
    const fixUrl = (u) => {
      if (!u || typeof u !== "string") return "";
      if (/^(https?:|data:|\/)/i.test(u)) return u;
      return u.includes("/") ? "/" + u.replace(/^\/+/, "") : u;
    };
    if (Array.isArray(extra.media)) {
      for (const media of extra.media) {
        if (!media?.url) continue;
        const mType = String(media.type || "").toLowerCase();
        if (mType === "video" || mType === "audio") continue;
        images.push({ src: fixUrl(media.url), alt: media.title || "" });
      }
    }
    if (images.length === 0 && extra.image) {
      images.push({ src: fixUrl(extra.image), alt: extra.title || "" });
    }
    if (images.length === 0 && Array.isArray(extra.image_swipes)) {
      const idx = extra.media_index ?? extra.image_swipes.length - 1;
      const url = extra.image_swipes[idx] || extra.image_swipes[extra.image_swipes.length - 1];
      if (url) images.push({ src: fixUrl(url), alt: extra.title || "" });
    }
    if (images.length === 0) return "";
    return '<div class="remind-extra-images">' + images.map((img) => createImageHtml(img.src, img.alt)).join("") + "</div>";
  }
  function unwrapPreviousInfoBlocks(text) {
    if (!text) return text;
    text = text.replace(/<details[^>]*>\s*<summary[^>]*>[^<]*이전\s*정보[^<]*<\/summary>/gi, "");
    let openCount = (text.match(/<details\b/gi) || []).length;
    let closeCount = (text.match(/<\/details\s*>/gi) || []).length;
    while (closeCount > openCount) {
      text = text.replace(/<\/details\s*>/, "");
      closeCount--;
    }
    return text;
  }
  function removeCursorMarkers(text) {
    if (!text) return text;
    text = text.replace(/^\s*\|\s*$/gm, "");
    text = text.replace(/<cursor\s*\/?>/gi, "");
    text = text.replace(/\{\{cursor\}\}/gi, "");
    text = text.replace(/\n{3,}/g, "\n\n");
    return text;
  }
  var IFRAME_OVERRIDE_CSS = "<style>html,body{margin:0!important;padding:0!important;background:transparent;}html{scrollbar-width:none!important;}::-webkit-scrollbar{display:none!important;}img,video{max-width:100%!important;height:auto!important;}</style>";
  var IFRAME_RESIZE_SCRIPT = `<script>
(function(){
  document.addEventListener('DOMContentLoaded',function(){
    if(document.getElementById('rm-wrap'))return;
    var w=document.createElement('div');
    w.id='rm-wrap';
    while(document.body.firstChild)w.appendChild(document.body.firstChild);
    document.body.appendChild(w);
    init();
  });
  function init(){
    var w=document.getElementById('rm-wrap');
    if(!w)return;
    var timer=null;
    function sendH(){
      if(timer)return;
      timer=setTimeout(function(){
        timer=null;
        var orig=w.style.height;
        var origOv=w.style.overflow;
        w.style.overflow='auto';
        w.style.height='0';
        var h=w.scrollHeight;
        w.style.height=orig||'';
        w.style.overflow=origOv||'';
        if(h>0){
          window.parent.postMessage({type:'remind-iframe-resize',height:h},'*');
        }
      },0);
    }
    sendH();
    document.querySelectorAll('details').forEach(function(d){
      d.addEventListener('toggle',function(){
        sendH();
        setTimeout(sendH,100);
        setTimeout(sendH,300);
      });
    });
    new MutationObserver(function(){sendH();}).observe(w,{childList:true,subtree:true,attributes:true});
    [100,300,600,1500,3000].forEach(function(d){setTimeout(sendH,d);});
  }
})();
<\/script>`;
  function convertHtmlDocsToIframes(text) {
    const iframePlaceholders = [];
    if (!text) return { text, iframePlaceholders };
    const htmlDocPattern = /\[?\s*(?:<!DOCTYPE\s+html[^>]*>[\s\S]*?<\/html>|<html[^>]*>[\s\S]*?<\/html>)\s*\]?/gi;
    const processed = text.replace(htmlDocPattern, (match) => {
      let modified = match.replace(/^\s*\[/, "").replace(/\]\s*$/, "");
      if (modified.includes("</head>")) {
        modified = modified.replace("</head>", IFRAME_OVERRIDE_CSS + "</head>");
      } else if (modified.includes("<body")) {
        modified = modified.replace("<body", IFRAME_OVERRIDE_CSS + "<body");
      } else {
        modified = IFRAME_OVERRIDE_CSS + modified;
      }
      if (modified.includes("</body>")) {
        modified = modified.replace("</body>", IFRAME_RESIZE_SCRIPT + "</body>");
      } else {
        modified += IFRAME_RESIZE_SCRIPT;
      }
      const b64 = btoa(unescape(encodeURIComponent(modified)));
      const iframe = `<iframe class="remind-regex-iframe" data-remind-html="${b64}" sandbox="allow-scripts" frameborder="0" scrolling="no"></iframe>`;
      const index = iframePlaceholders.length;
      iframePlaceholders.push(iframe);
      return `
%%%RM_IFRAME_${index}%%%
`;
    });
    return { text: processed, iframePlaceholders };
  }
  function restoreIframePlaceholders(html, iframePlaceholders) {
    if (!iframePlaceholders || iframePlaceholders.length === 0) return html;
    return html.replace(
      /(?:<br\s*\/?>)?\s*(?:<pre[^>]*>)?\s*(?:<code[^>]*>)?\s*(?:<p[^>]*>)?\s*%%%RM_IFRAME_(\d+)%%%\s*(?:<\/p>)?\s*(?:<\/code>)?\s*(?:<\/pre>)?\s*(?:<br\s*\/?>)?/g,
      (match, index) => iframePlaceholders[parseInt(index, 10)] || match
    );
  }
  function processChoices(text) {
    if (!text) return text;
    return text.replace(/<choices>([\s\S]*?)<\/choices>/gi, (match, content) => {
      const lines = content.trim().split("\n").filter((l) => l.trim());
      if (lines.length === 0) return match;
      let html = '<div class="remind-choices"><div class="remind-choices-header">\uC120\uD0DD\uC9C0</div>';
      lines.forEach((line, i) => {
        const cleanLine = line.replace(/^\d+[.)\-]\s*/, "").trim();
        if (cleanLine) {
          html += `<div class="remind-choice-card"><span class="remind-choice-num">${i + 1}.</span><span>${escapeHtml(cleanLine)}</span></div>`;
        }
      });
      html += "</div>";
      return html;
    });
  }
  function processInlineMarkdown(text) {
    if (!text) return "";
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
    text = text.replace(/~~(.+?)~~/g, "<del>$1</del>");
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return text;
  }
  function renderMarkdown(text) {
    if (!text) return "";
    const protectedBlocks = [];
    function protectBlock(match) {
      const idx = protectedBlocks.length;
      protectedBlocks.push(match);
      return `\0HTMLBLOCK${idx}\0`;
    }
    const codeBlocks = [];
    text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push(`<pre class="remind-code"><code>${escapeHtml(code.trim())}</code></pre>`);
      return `\0CODEBLOCK${idx}\0`;
    });
    const inlineCodes = [];
    text = text.replace(/`([^`\n]+)`/g, (match, code) => {
      const idx = inlineCodes.length;
      inlineCodes.push(`<code class="remind-inline-code">${escapeHtml(code)}</code>`);
      return `\0INLINECODE${idx}\0`;
    });
    text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, protectBlock);
    text = text.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, protectBlock);
    text = text.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, protectBlock);
    const blockOpenRe = /<(div|details|section|article|aside|nav|header|footer|form|fieldset|figure|main|pre|dl)\b/gi;
    const blockCloseRe = /<\/(div|details|section|article|aside|nav|header|footer|form|fieldset|figure|main|pre|dl)\s*>/gi;
    const countOpens = (str) => (str.match(blockOpenRe) || []).length;
    const countCloses = (str) => (str.match(blockCloseRe) || []).length;
    const lines = text.split("\n");
    const result = [];
    let inList = false;
    let listType = "";
    let htmlBlockDepth = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (htmlBlockDepth > 0) {
        htmlBlockDepth += countOpens(trimmed) - countCloses(trimmed);
        if (htmlBlockDepth < 0) htmlBlockDepth = 0;
        result.push(line);
        continue;
      }
      if (/^<[a-zA-Z]/.test(trimmed)) {
        const opens = countOpens(trimmed);
        const closes = countCloses(trimmed);
        if (opens > closes) {
          htmlBlockDepth = opens - closes;
        }
        result.push(trimmed);
        continue;
      }
      if (/^<\/[a-zA-Z]/.test(trimmed)) {
        htmlBlockDepth -= countCloses(trimmed);
        if (htmlBlockDepth < 0) htmlBlockDepth = 0;
        result.push(trimmed);
        continue;
      }
      if (inList && !trimmed.match(/^[-*]\s/) && !trimmed.match(/^\d+\.\s/)) {
        result.push(listType === "ul" ? "</ul>" : "</ol>");
        inList = false;
      }
      if (!trimmed) {
        result.push("<br />");
        continue;
      }
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        result.push(`<h${level} class="remind-h">${processInlineMarkdown(headingMatch[2])}</h${level}>`);
        continue;
      }
      if (/^[-*_]{3,}\s*$/.test(trimmed)) {
        result.push('<hr class="remind-hr" />');
        continue;
      }
      if (trimmed.startsWith(">")) {
        result.push(`<blockquote class="remind-quote">${processInlineMarkdown(trimmed.replace(/^>\s?/, ""))}</blockquote>`);
        continue;
      }
      const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
      if (ulMatch) {
        if (!inList || listType !== "ul") {
          if (inList) result.push(listType === "ul" ? "</ul>" : "</ol>");
          result.push('<ul class="remind-list-md">');
          inList = true;
          listType = "ul";
        }
        result.push(`<li>${processInlineMarkdown(ulMatch[1])}</li>`);
        continue;
      }
      const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
      if (olMatch) {
        if (!inList || listType !== "ol") {
          if (inList) result.push(listType === "ul" ? "</ul>" : "</ol>");
          result.push('<ol class="remind-list-md">');
          inList = true;
          listType = "ol";
        }
        result.push(`<li>${processInlineMarkdown(olMatch[1])}</li>`);
        continue;
      }
      if (/^\x00(HTMLBLOCK|CODEBLOCK|INLINECODE)\d+\x00$/.test(trimmed)) {
        result.push(trimmed);
        continue;
      }
      result.push(`<p class="remind-p">${processInlineMarkdown(trimmed)}</p>`);
    }
    if (inList) {
      result.push(listType === "ul" ? "</ul>" : "</ol>");
    }
    text = result.join("\n");
    codeBlocks.forEach((block, i) => {
      text = text.replace(`\0CODEBLOCK${i}\0`, () => block);
    });
    inlineCodes.forEach((code, i) => {
      text = text.replace(`\0INLINECODE${i}\0`, () => code);
    });
    protectedBlocks.forEach((block, i) => {
      text = text.replace(`\0HTMLBLOCK${i}\0`, () => block);
    });
    return text;
  }
  function styleDialogue(html) {
    if (!html) return html;
    html = html.replace(/(^|>)([^<]*?"[^"]*?"[^<]*?)(?=<|$)/g, (match, pre, seg) => {
      return pre + seg.replace(/"([^"]+)"/g, '<span class="remind-dialogue">"$1"</span>');
    });
    html = html.replace(/(^|>)([^<]*?「[^」]*?」[^<]*?)(?=<|$)/g, (match, pre, seg) => {
      return pre + seg.replace(/「([^」]+)」/g, '<span class="remind-dialogue">\u300C$1\u300D</span>');
    });
    return html;
  }
  function sanitizeHtml(html) {
    const doc = document.implementation.createHTMLDocument("");
    const root = doc.createElement("div");
    root.innerHTML = html;
    root.querySelectorAll("script, object, embed, link, meta, base, form").forEach((el) => el.remove());
    root.querySelectorAll("iframe").forEach((el) => {
      if (!el.classList.contains("remind-regex-iframe")) {
        el.remove();
        return;
      }
      el.setAttribute("sandbox", "allow-scripts");
      el.removeAttribute("src");
      el.removeAttribute("srcdoc");
    });
    root.querySelectorAll("*").forEach((el) => {
      for (const attr of [...el.attributes]) {
        const name = attr.name.toLowerCase();
        if (name.startsWith("on")) {
          el.removeAttribute(attr.name);
        } else if ((name === "href" || name === "src" || name === "xlink:href") && /^\s*javascript:/i.test(attr.value)) {
          el.removeAttribute(attr.name);
        }
      }
    });
    return root.innerHTML;
  }
  function renderMessageHtml(message, options) {
    let text = message.mes || "";
    if (!text.trim() && Array.isArray(message.swipes) && typeof message.swipe_id === "number" && message.swipes[message.swipe_id] !== void 0) {
      text = message.swipes[message.swipe_id];
    }
    if (!text && !message.extra) return "";
    if (options.userName) text = text.replace(/\{\{user\}\}/gi, options.userName);
    if (options.characterName) text = text.replace(/\{\{char\}\}/gi, options.characterName);
    if (options.applyRegex !== false) {
      text = applyStRegexScripts(text, {
        isUser: !!message.is_user,
        characterName: options.characterName,
        userName: options.userName,
        charAvatar: options.charAvatar
      });
    }
    text = unwrapPreviousInfoBlocks(text);
    text = removeCursorMarkers(text);
    const { text: textWithPlaceholders, iframePlaceholders } = convertHtmlDocsToIframes(text);
    text = textWithPlaceholders;
    text = processImages(text, options.characterName);
    text = processChoices(text);
    text = renderMarkdown(text);
    text = restoreIframePlaceholders(text, iframePlaceholders);
    text = styleDialogue(text);
    const extraImgHtml = renderExtraImagesHtml(message);
    if (extraImgHtml) {
      const rawMes = message.mes || "";
      const mesHasText = stripToPlainText(rawMes).length > 0;
      const mesHasImg = /<img[\s/>]/i.test(rawMes);
      if (message.extra?.inline_image && !mesHasText) {
        text = extraImgHtml;
      } else if (!mesHasImg) {
        text += extraImgHtml;
      }
    }
    return sanitizeHtml(text);
  }

  // src/ui/remindViewer.js
  init_textUtils();
  init_notifications();

  // src/data/uiPrefs.js
  var STORAGE_KEY6 = "chatLobby_uiPrefs";
  var DEFAULTS = {
    theme: null,
    // null = 레거시 키에서 마이그레이션
    showHero: true,
    // 최애 코너 (히어로 배너)
    personaBadges: true,
    // 캐릭터 카드 페르소나 배지
    cardSize: 200,
    // 캐릭터 카드 폭 (px)
    badgeSize: 36,
    // 페르소나 배지 크기 (px)
    badgePosition: "top",
    // 페르소나 배지 위치 ('top' = 우측 상단, 'bottom' = 우측 하단)
    viewerFontSize: 15,
    // 리마인드 뷰어 글자 크기 (px)
    viewerPageSize: 10,
    // 리마인드 뷰어 페이지당 메시지 수 (0 = 모두)
    viewerTheme: "auto",
    // 읽기 모드 테마 ('auto'|'dark'|'sepia'|'paper')
    viewerFontFamily: "default"
    // 뷰어 폰트 ('default'|'serif'|'mono')
  };
  var UiPrefs = class {
    constructor() {
      this._data = null;
    }
    _load() {
      if (this._data) return this._data;
      let saved = {};
      try {
        const raw = localStorage.getItem(STORAGE_KEY6);
        if (raw) saved = JSON.parse(raw) || {};
      } catch (e) {
        console.warn("[UiPrefs] Failed to load:", e);
      }
      this._data = { ...DEFAULTS, ...saved };
      if (this._data.theme === null) {
        const legacy = localStorage.getItem("chatlobby-theme");
        this._data.theme = legacy === "light" ? "light" : "default";
        this._save();
      }
      return this._data;
    }
    _save() {
      try {
        localStorage.setItem(STORAGE_KEY6, JSON.stringify(this._data));
      } catch (e) {
        console.warn("[UiPrefs] Failed to save:", e);
      }
    }
    /**
     * @param {string} key
     * @returns {*}
     */
    get(key) {
      return this._load()[key];
    }
    /**
     * @param {string} key
     * @param {*} value
     */
    set(key, value) {
      this._load();
      this._data[key] = value;
      this._save();
    }
  };
  var uiPrefs = new UiPrefs();

  // src/ui/remindViewer.js
  var isViewerOpen = false;
  var currentRemind = null;
  var currentMessages = null;
  var regexEnabled = true;
  var pageIndex = 0;
  var viewStart = 0;
  var viewEnd = 0;
  var lastRenderedRange = { from: 0, to: 0 };
  var progressSaveTimer = null;
  var pendingHighlight = null;
  var hlPopupInteracting = false;
  var hlHideTimer = null;
  var selectionActiveSince = 0;
  var selChangeTimer = null;
  var iframeObserver = null;
  var warnedLargeAll = false;
  var MAX_ALL_RENDER = 150;
  var FORCED_PAGE_SIZE = 50;
  var FONT_MIN = 12;
  var FONT_MAX = 24;
  var PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 0];
  var READER_THEMES = [
    { id: "auto", name: "\u{1F3A8} \uB85C\uBE44 \uD14C\uB9C8" },
    { id: "dark", name: "\u{1F319} \uB2E4\uD06C" },
    { id: "sepia", name: "\u{1F4DC} \uC138\uD53C\uC544" },
    { id: "paper", name: "\u{1F90D} \uC21C\uBC31" }
  ];
  async function openRemindViewer(remindId) {
    const remind = remindStore.get(remindId);
    if (!remind) {
      showToast("\uB9AC\uB9C8\uC778\uB4DC\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", "error");
      return;
    }
    await openViewerWithData(remind);
  }
  async function openChatInViewer(avatar, charName, fileName) {
    const cleanName = (fileName || "").replace(/\.jsonl$/i, "");
    await openViewerWithData({
      id: `adhoc_${avatar}::${cleanName}`,
      // 진행 저장용 안정 키
      avatar,
      charName: charName || avatar.replace(/\.[^.]+$/, ""),
      fileName: cleanName,
      start: null,
      end: null,
      note: "",
      _adhoc: true
    });
  }
  async function openViewerWithData(remind) {
    closeRemindViewer();
    const overlay = document.getElementById("chat-lobby-remind-viewer");
    if (!overlay) {
      showToast("\uBDF0\uC5B4\uB97C \uC5F4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uB85C\uBE44\uB97C \uB2E4\uC2DC \uC5F4\uC5B4\uC8FC\uC138\uC694.", "error");
      return;
    }
    currentRemind = remind;
    currentMessages = null;
    regexEnabled = true;
    pageIndex = 0;
    pendingHighlight = null;
    warnedLargeAll = false;
    const rangeText = remind._adhoc ? "\uC804\uCCB4 \uAC10\uC0C1" : remind.start !== null || remind.end !== null ? `#${remind.start ?? 0} ~ ${remind.end !== null ? "#" + remind.end : "\uB05D"}` : "\uC804\uCCB4";
    const pageSize = getPageSize();
    const fontSize = getFontSize();
    const readerTheme = getReaderTheme();
    overlay.innerHTML = `
        <div class="remind-viewer-panel" data-reader-theme="${readerTheme}">
            <header class="remind-viewer-header" id="remind-viewer-header">
                <div class="remind-viewer-toprow">
                    <div class="remind-viewer-title">
                        <span class="remind-viewer-char">${escapeHtml(remind.charName || "")}</span>
                        <span class="remind-viewer-file">${escapeHtml(remind.fileName)} \xB7 ${escapeHtml(rangeText)}</span>
                        ${remind.note ? `<span class="remind-viewer-note">\u{1F516} ${escapeHtml(remind.note)}</span>` : ""}
                    </div>
                    <div class="remind-viewer-topbtns">
                        <button class="remind-viewer-btn" id="remind-continue-chat" title="\uC774 \uCC44\uD305 \uC774\uC5B4\uC11C \uD558\uAE30">\u25B6\uFE0F \uC774\uC5B4 \uCC44\uD305</button>
                        <button class="remind-viewer-btn" id="remind-add-here" title="\uD604\uC7AC \uBCF4\uB294 \uAD6C\uAC04\uC744 \uB9AC\uB9C8\uC778\uB4DC\uB85C \uC800\uC7A5">\u{1F516}</button>
                        <button class="remind-viewer-btn" id="remind-settings-toggle" title="\uBDF0\uC5B4 \uC124\uC815">\u2699\uFE0F</button>
                        <button class="remind-viewer-close" title="\uB2EB\uAE30">\u2715</button>
                    </div>
                </div>
                <div class="remind-viewer-pagrow">
                    <button class="remind-viewer-btn" id="remind-page-prev" title="\uC774\uC804 \uD398\uC774\uC9C0 (\uBC94\uC704 \uC55E\uB3C4 \uC774\uC5B4\uC11C \uBD88\uB7EC\uC634)">\u25C0</button>
                    <span class="remind-page-label" id="remind-page-label">-</span>
                    <button class="remind-viewer-btn" id="remind-page-next" title="\uB2E4\uC74C \uD398\uC774\uC9C0 (\uBC94\uC704 \uB05D\uB098\uBA74 \uC774\uC5B4\uC11C \uBD88\uB7EC\uC634)">\u25B6</button>
                </div>
                <div class="remind-settings-pop" id="remind-settings-pop" style="display:none;">
                    <div class="remind-set-row">
                        <span class="remind-set-label">\uD398\uC774\uC9C0\uB2F9</span>
                        <select class="remind-viewer-select" id="remind-page-size">
                            ${PAGE_SIZE_OPTIONS.map((n) => `
                                <option value="${n}" ${n === pageSize ? "selected" : ""}>${n === 0 ? "\uBAA8\uB450" : n + "\uAC1C\uC529"}</option>
                            `).join("")}
                        </select>
                    </div>
                    <div class="remind-set-row">
                        <span class="remind-set-label">\uAE00\uC790 \uD06C\uAE30</span>
                        <div class="remind-set-inline">
                            <button class="remind-viewer-btn" id="remind-font-minus">A\u2212</button>
                            <span class="remind-page-label" id="remind-font-label">${fontSize}px</span>
                            <button class="remind-viewer-btn" id="remind-font-plus">A\uFF0B</button>
                        </div>
                    </div>
                    <div class="remind-set-row">
                        <span class="remind-set-label">\uC77D\uAE30 \uD14C\uB9C8</span>
                        <select class="remind-viewer-select" id="remind-theme-select">
                            ${READER_THEMES.map((t) => `
                                <option value="${t.id}" ${t.id === readerTheme ? "selected" : ""}>${t.name}</option>
                            `).join("")}
                        </select>
                    </div>
                    <div class="remind-set-row remind-set-actions">
                        <button class="remind-viewer-btn" id="remind-viewer-regex" title="ST \uC815\uADDC\uC2DD \uC2A4\uD06C\uB9BD\uD2B8 \uC801\uC6A9 \uCF1C\uAE30/\uB044\uAE30">\u2728 \uC815\uADDC\uC2DD ON</button>
                        <button class="remind-viewer-btn" id="remind-viewer-export" title="\uC774 \uAD6C\uAC04 \uC804\uCCB4\uB97C \uD14D\uC2A4\uD2B8 \uD30C\uC77C\uB85C \uBC31\uC5C5">\u{1F4BE} \uBC31\uC5C5</button>
                    </div>
                </div>
            </header>
            <div class="remind-viewer-body">
                <div class="remind-viewer-loading">\u{1F4D6} \uCC44\uD305\uC744 \uBD88\uB7EC\uC624\uB294 \uC911...</div>
            </div>
            <div class="remind-scrollbar" id="remind-scrollbar">
                <div class="remind-scroll-thumb" id="remind-scroll-thumb"></div>
            </div>
            <div class="remind-hl-popup" id="remind-hl-popup" style="display:none;">
                <button id="remind-hl-save">\u{1F58D}\uFE0F \uD615\uAD11\uD39C</button>
                <button id="remind-hl-clear" title="\uC120\uD0DD \uD574\uC81C">\u2715</button>
            </div>
            <div class="remind-lightbox" id="remind-lightbox">
                <div class="remind-lightbox-backdrop"></div>
                <div class="remind-lightbox-content">
                    <img class="remind-lightbox-img" src="" alt="">
                    <div class="remind-lightbox-caption"></div>
                    <button class="remind-lightbox-close" title="\uB2EB\uAE30">\u2715</button>
                </div>
            </div>
        </div>
    `;
    overlay.classList.add("visible");
    isViewerOpen = true;
    applyFontSize(fontSize);
    listeners.add("remindViewer", overlay.querySelector(".remind-viewer-close"), "click", closeRemindViewer);
    listeners.add("remindViewer", overlay.querySelector("#remind-viewer-regex"), "click", toggleRegex);
    listeners.add("remindViewer", overlay.querySelector("#remind-viewer-export"), "click", exportCurrentRange);
    listeners.add("remindViewer", overlay.querySelector("#remind-continue-chat"), "click", continueChat);
    listeners.add("remindViewer", overlay.querySelector("#remind-add-here"), "click", addRemindFromViewer);
    listeners.add("remindViewer", overlay.querySelector("#remind-settings-toggle"), "click", (e) => {
      e.stopPropagation();
      toggleSettingsPop();
    });
    listeners.add("remindViewer", overlay.querySelector("#remind-page-prev"), "click", () => changePage(-1));
    listeners.add("remindViewer", overlay.querySelector("#remind-page-next"), "click", () => changePage(1));
    listeners.add("remindViewer", overlay.querySelector("#remind-page-size"), "change", (e) => {
      uiPrefs.set("viewerPageSize", parseInt(e.target.value, 10) || 0);
      pageIndex = 0;
      renderMessages();
    });
    listeners.add("remindViewer", overlay.querySelector("#remind-font-minus"), "click", () => changeFontSize(-1));
    listeners.add("remindViewer", overlay.querySelector("#remind-font-plus"), "click", () => changeFontSize(1));
    listeners.add("remindViewer", overlay.querySelector("#remind-theme-select"), "change", (e) => {
      uiPrefs.set("viewerTheme", e.target.value);
      const panel = overlay.querySelector(".remind-viewer-panel");
      if (panel) panel.dataset.readerTheme = e.target.value;
    });
    listeners.add("remindViewer", overlay, "click", (e) => {
      if (e.target === overlay) closeRemindViewer();
    });
    listeners.add("remindViewer", document, "keydown", handleViewerKeydown);
    const viewerBody = overlay.querySelector(".remind-viewer-body");
    let lastScrollTop = 0;
    listeners.add("remindViewer", viewerBody, "scroll", () => {
      const header = document.getElementById("remind-viewer-header");
      if (header) {
        const st = viewerBody.scrollTop;
        if (st < 40) {
          header.classList.remove("header-hidden");
        } else if (st > lastScrollTop + 6) {
          header.classList.add("header-hidden");
          hideSettingsPop();
        } else if (st < lastScrollTop - 6) {
          header.classList.remove("header-hidden");
        }
        lastScrollTop = st;
      }
      scheduleProgressSave();
      hideHighlightPopup();
      updateScrollThumb();
    }, { passive: true });
    bindScrollThumb(overlay, viewerBody);
    listeners.add("remindViewer", viewerBody, "click", async (e) => {
      hideSettingsPop();
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && selectionActiveSince && Date.now() - selectionActiveSince > 500) {
        clearTextSelection();
        return;
      }
      const mark = e.target.closest(".remind-highlight");
      if (mark) {
        e.preventDefault();
        e.stopPropagation();
        const hlId = mark.dataset.hlId;
        const confirmed = await showConfirm("\uC774 \uD615\uAD11\uD39C\uC744 \uC9C0\uC6B8\uAE4C\uC694?");
        if (confirmed && hlId) {
          highlightStore.remove(hlId);
          unwrapHighlight(hlId);
        }
        return;
      }
      const img = e.target.closest("img");
      if (img) {
        e.preventDefault();
        e.stopPropagation();
        openLightbox(img.src, img.alt || img.title || "");
      }
    });
    listeners.add("remindViewer", viewerBody, "mouseup", () => setTimeout(handleTextSelection, 10));
    listeners.add("remindViewer", document, "selectionchange", () => {
      if (!isViewerOpen) return;
      if (selChangeTimer) clearTimeout(selChangeTimer);
      selChangeTimer = setTimeout(handleTextSelection, 180);
    });
    const hlPopup = overlay.querySelector("#remind-hl-popup");
    listeners.add("remindViewer", hlPopup, "mousedown", (e) => {
      e.preventDefault();
      hlPopupInteracting = true;
    });
    listeners.add("remindViewer", hlPopup, "touchstart", () => {
      hlPopupInteracting = true;
    }, { passive: true });
    listeners.add("remindViewer", overlay.querySelector("#remind-hl-save"), "click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      saveHighlightFromSelection();
      hlPopupInteracting = false;
    });
    listeners.add("remindViewer", overlay.querySelector("#remind-hl-clear"), "click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearTextSelection();
      hlPopupInteracting = false;
    });
    listeners.add("remindViewer", overlay.querySelector(".remind-lightbox-backdrop"), "click", closeLightbox);
    listeners.add("remindViewer", overlay.querySelector(".remind-lightbox-close"), "click", closeLightbox);
    listeners.add("remindViewer", viewerBody, "error", (e) => {
      const img = e.target;
      if (img?.tagName === "IMG" && img.closest(".remind-image-container")) {
        img.closest(".remind-image-container").innerHTML = `<div class="remind-image-fallback">\u{1F5BC}\uFE0F ${escapeHtml(img.alt || "\uC774\uBBF8\uC9C0\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC74C")}</div>`;
      }
    }, true);
    listeners.add("remindViewer", window, "message", (e) => {
      if (e.data?.type !== "remind-iframe-resize" || typeof e.data.height !== "number") return;
      const iframes = document.querySelectorAll("#chat-lobby-remind-viewer iframe.remind-regex-iframe");
      for (const frame of iframes) {
        if (frame.contentWindow === e.source) {
          const h = Math.ceil(e.data.height);
          frame.style.height = (h > 20 ? h : 400) + "px";
          break;
        }
      }
    });
    const body = overlay.querySelector(".remind-viewer-body");
    try {
      const messages = await api.getChatMessages(remind.avatar, remind.fileName);
      if (!messages || messages.length === 0) {
        body.innerHTML = '<div class="remind-viewer-loading">\u26A0\uFE0F \uCC44\uD305\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. (\uD30C\uC77C\uC774 \uC0AD\uC81C\uB418\uC5C8\uAC70\uB098 \uC774\uB984\uC774 \uBC14\uB00C\uC5C8\uC744 \uC218 \uC788\uC5B4\uC694)</div>';
        return;
      }
      currentMessages = messages;
      const total = messages.length;
      viewStart = Math.max(0, remind.start ?? 0);
      viewEnd = Math.min(total - 1, remind.end ?? total - 1);
      const progress = remindStore.getProgress(remind.id);
      if (progress) {
        viewStart = Math.max(0, progress.viewStart ?? viewStart);
        viewEnd = Math.max(viewStart, progress.viewEnd ?? viewEnd);
        pageIndex = Math.max(0, progress.pageIndex ?? 0);
      }
      if (viewStart > total - 1) {
        viewStart = Math.max(0, total - (getPageSize() || 20));
        viewEnd = total - 1;
        pageIndex = 0;
        showToast(`\uBC94\uC704\uAC00 \uCC44\uD305 \uAE38\uC774(${total}\uAC1C)\uB97C \uBC97\uC5B4\uB098 \uB05D \uAD6C\uAC04\uC73C\uB85C \uC774\uB3D9\uD588\uC5B4\uC694.`, "warning");
      }
      viewEnd = Math.min(total - 1, viewEnd);
      renderMessages();
      if (progress?.scrollTop > 0) {
        body.scrollTop = progress.scrollTop;
      }
    } catch (e) {
      console.error("[RemindViewer] Load failed:", e);
      body.innerHTML = '<div class="remind-viewer-loading">\u26A0\uFE0F \uCC44\uD305 \uB85C\uB529 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.</div>';
    }
  }
  function closeRemindViewer() {
    if (isViewerOpen) saveProgressNow();
    const overlay = document.getElementById("chat-lobby-remind-viewer");
    if (overlay) {
      overlay.classList.remove("visible");
      overlay.innerHTML = "";
    }
    if (progressSaveTimer) {
      clearTimeout(progressSaveTimer);
      progressSaveTimer = null;
    }
    if (hlHideTimer) {
      clearTimeout(hlHideTimer);
      hlHideTimer = null;
    }
    if (selChangeTimer) {
      clearTimeout(selChangeTimer);
      selChangeTimer = null;
    }
    if (iframeObserver) {
      iframeObserver.disconnect();
      iframeObserver = null;
    }
    listeners.clear("remindViewer");
    isViewerOpen = false;
    currentRemind = null;
    currentMessages = null;
    pendingHighlight = null;
    hlPopupInteracting = false;
    selectionActiveSince = 0;
  }
  function closeTopRemindLayer() {
    if (!isViewerOpen) return false;
    const lb = document.getElementById("remind-lightbox");
    if (lb?.classList.contains("active")) {
      closeLightbox();
      return true;
    }
    const pop = document.getElementById("remind-settings-pop");
    if (pop && pop.style.display !== "none") {
      hideSettingsPop();
      return true;
    }
    closeRemindViewer();
    return true;
  }
  function handleViewerKeydown(e) {
    if (!isViewerOpen) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const tag = e.target?.tagName;
    if (tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA") return;
    const lb = document.getElementById("remind-lightbox");
    if (lb?.classList.contains("active")) return;
    changePage(e.key === "ArrowLeft" ? -1 : 1);
  }
  function toggleSettingsPop() {
    const pop = document.getElementById("remind-settings-pop");
    if (!pop) return;
    pop.style.display = pop.style.display === "none" ? "block" : "none";
  }
  function hideSettingsPop() {
    const pop = document.getElementById("remind-settings-pop");
    if (pop) pop.style.display = "none";
  }
  function getFontSize() {
    const v = parseInt(uiPrefs.get("viewerFontSize"), 10);
    return Math.min(FONT_MAX, Math.max(FONT_MIN, isNaN(v) ? 15 : v));
  }
  function getPageSize() {
    const v = parseInt(uiPrefs.get("viewerPageSize"), 10);
    return PAGE_SIZE_OPTIONS.includes(v) ? v : 10;
  }
  function getEffectivePageSize(rangeLength) {
    const ps = getPageSize();
    if (ps === 0 && rangeLength > MAX_ALL_RENDER) {
      if (!warnedLargeAll) {
        warnedLargeAll = true;
        showToast(`\uBA54\uC2DC\uC9C0\uAC00 ${rangeLength}\uAC1C\uB77C ${FORCED_PAGE_SIZE}\uAC1C\uC529 \uB098\uB220 \uD45C\uC2DC\uD569\uB2C8\uB2E4.`, "info");
      }
      return FORCED_PAGE_SIZE;
    }
    return ps;
  }
  function getReaderTheme() {
    const v = uiPrefs.get("viewerTheme");
    return READER_THEMES.some((t) => t.id === v) ? v : "auto";
  }
  function applyFontSize(px) {
    const panel = document.querySelector("#chat-lobby-remind-viewer .remind-viewer-panel");
    if (panel) panel.style.setProperty("--remind-font", `${px}px`);
    const label = document.getElementById("remind-font-label");
    if (label) label.textContent = `${px}px`;
  }
  function changeFontSize(delta) {
    const next = Math.min(FONT_MAX, Math.max(FONT_MIN, getFontSize() + delta));
    uiPrefs.set("viewerFontSize", next);
    applyFontSize(next);
  }
  function toggleRegex() {
    regexEnabled = !regexEnabled;
    const btn = document.getElementById("remind-viewer-regex");
    if (btn) {
      btn.textContent = regexEnabled ? "\u2728 \uC815\uADDC\uC2DD ON" : "\u2728 \uC815\uADDC\uC2DD OFF";
      btn.classList.toggle("off", !regexEnabled);
    }
    renderMessages(true);
  }
  function scheduleProgressSave() {
    if (progressSaveTimer) clearTimeout(progressSaveTimer);
    progressSaveTimer = setTimeout(saveProgressNow, 600);
  }
  function saveProgressNow() {
    if (!currentRemind) return;
    const body = document.querySelector("#chat-lobby-remind-viewer .remind-viewer-body");
    remindStore.setProgress(currentRemind.id, {
      viewStart,
      viewEnd,
      pageIndex,
      scrollTop: body ? Math.round(body.scrollTop) : 0
    });
  }
  function getCurrentSlice() {
    if (!currentRemind || !currentMessages) return null;
    return {
      slice: currentMessages.slice(viewStart, viewEnd + 1),
      start: viewStart
    };
  }
  function getTotalPages(rangeLength) {
    const pageSize = getEffectivePageSize(rangeLength);
    if (pageSize === 0) return 1;
    return Math.max(1, Math.ceil(rangeLength / pageSize));
  }
  function changePage(delta) {
    const data = getCurrentSlice();
    if (!data || !currentMessages) return;
    const total = currentMessages.length;
    const pageSize = getEffectivePageSize(data.slice.length);
    const extendChunk = pageSize || 20;
    const totalPages = getTotalPages(data.slice.length);
    if (delta > 0) {
      if (pageIndex < totalPages - 1) {
        pageIndex++;
      } else if (viewEnd < total - 1) {
        const newEnd = Math.min(total - 1, viewEnd + extendChunk);
        viewEnd = newEnd;
        pageIndex++;
        showToast(`\u{1F4D6} \uB2E4\uC74C \uAD6C\uAC04 \uC774\uC5B4 \uBCF4\uAE30 (~#${newEnd})`, "info", 1500);
      } else {
        return;
      }
    } else {
      if (pageIndex > 0) {
        pageIndex--;
      } else if (viewStart > 0) {
        const newStart = Math.max(0, viewStart - extendChunk);
        viewStart = newStart;
        pageIndex = 0;
        showToast(`\u{1F4D6} \uC774\uC804 \uAD6C\uAC04 \uC774\uC5B4 \uBCF4\uAE30 (#${newStart}~)`, "info", 1500);
      } else {
        return;
      }
    }
    renderMessages();
    scheduleProgressSave();
  }
  function resolveMes(msg) {
    const mes = msg.mes || "";
    if (mes.trim()) return mes;
    if (Array.isArray(msg.swipes) && typeof msg.swipe_id === "number" && msg.swipes[msg.swipe_id] !== void 0) {
      return msg.swipes[msg.swipe_id];
    }
    return mes;
  }
  async function continueChat() {
    const r = currentRemind;
    if (!r) return;
    const context = api.getContext();
    const charIndex = (context?.characters || []).findIndex((c) => c.avatar === r.avatar);
    if (charIndex === -1) {
      showToast("\uCE90\uB9AD\uD130\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", "error");
      return;
    }
    saveProgressNow();
    const info = { fileName: r.fileName, charAvatar: r.avatar, charIndex: String(charIndex) };
    closeRemindViewer();
    await openChat(info);
  }
  async function addRemindFromViewer() {
    const r = currentRemind;
    if (!r) return;
    const defaultRange = `${lastRenderedRange.from}-${lastRenderedRange.to}`;
    const rangeInput = await showPrompt(
      "\uC800\uC7A5\uD560 \uBA54\uC2DC\uC9C0 \uBC94\uC704 (\uD604\uC7AC \uBCF4\uB294 \uD398\uC774\uC9C0\uAC00 \uAE30\uBCF8\uAC12)\n\uC608: 120-130 / 120 / \uBE44\uC6B0\uBA74 \uC804\uCCB4",
      "\u{1F516} \uC774 \uAD6C\uAC04 \uB9AC\uB9C8\uC778\uB4DC\uB85C \uC800\uC7A5",
      defaultRange
    );
    if (rangeInput === null) return;
    let start = null;
    let end = null;
    const trimmed = rangeInput.trim();
    if (trimmed) {
      const match = trimmed.match(/^(\d+)\s*[-~]\s*(\d+)$/) || trimmed.match(/^(\d+)$/);
      if (!match) {
        showToast("\uBC94\uC704 \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC608: 120-130", "error");
        return;
      }
      start = parseInt(match[1], 10);
      end = match[2] !== void 0 ? parseInt(match[2], 10) : start;
      if (end < start) [start, end] = [end, start];
      if (currentMessages) {
        const total = currentMessages.length;
        if (start > total - 1) {
          showToast(`\uC774 \uCC44\uD305\uC740 #${total - 1}\uAE4C\uC9C0\uB9CC \uC788\uC5B4\uC694. \uBC94\uC704\uB97C \uD655\uC778\uD574\uC8FC\uC138\uC694.`, "error");
          return;
        }
        if (end > total - 1) end = total - 1;
      }
    }
    const note = await showPrompt("\uBA54\uBAA8\uB97C \uB0A8\uACA8\uC8FC\uC138\uC694.", "\u{1F516} \uB9AC\uB9C8\uC778\uB4DC \uBA54\uBAA8", "");
    if (note === null) return;
    remindStore.add({
      avatar: r.avatar,
      charName: r.charName,
      fileName: r.fileName,
      start,
      end,
      note: note.trim()
    });
    showToast(`\u{1F516} \uB9AC\uB9C8\uC778\uB4DC \uC800\uC7A5\uB428${start !== null ? ` (#${start}~#${end})` : ""}`, "success");
  }
  function hideHighlightPopup() {
    if (hlHideTimer) {
      clearTimeout(hlHideTimer);
      hlHideTimer = null;
    }
    const popup = document.getElementById("remind-hl-popup");
    if (popup) popup.style.display = "none";
  }
  function scheduleHideHighlightPopup() {
    if (hlHideTimer) clearTimeout(hlHideTimer);
    hlHideTimer = setTimeout(() => {
      hlHideTimer = null;
      if (!hlPopupInteracting) {
        hideHighlightPopup();
        pendingHighlight = null;
        selectionActiveSince = 0;
      }
    }, 280);
  }
  function clearTextSelection() {
    try {
      window.getSelection()?.removeAllRanges();
    } catch (e) {
    }
    pendingHighlight = null;
    selectionActiveSince = 0;
    hideHighlightPopup();
  }
  function handleTextSelection() {
    const popup = document.getElementById("remind-hl-popup");
    const panel = document.querySelector("#chat-lobby-remind-viewer .remind-viewer-panel");
    if (!popup || !panel) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      scheduleHideHighlightPopup();
      return;
    }
    const text = sel.toString().trim();
    if (!text || text.length < 2 || text.length > 600) {
      scheduleHideHighlightPopup();
      return;
    }
    const range = sel.getRangeAt(0);
    const anchor = range.commonAncestorContainer;
    const anchorEl = anchor.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor;
    const article = anchorEl?.closest?.(".remind-msg");
    if (!article || !article.dataset.mesid) {
      scheduleHideHighlightPopup();
      return;
    }
    if (hlHideTimer) {
      clearTimeout(hlHideTimer);
      hlHideTimer = null;
    }
    if (!selectionActiveSince) selectionActiveSince = Date.now();
    pendingHighlight = {
      mesid: parseInt(article.dataset.mesid, 10),
      text
    };
    const rect = range.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const left = Math.min(panelRect.width - 130, Math.max(8, rect.left - panelRect.left));
    const top = Math.min(panelRect.height - 50, rect.bottom - panelRect.top + 8);
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
    popup.style.display = "flex";
  }
  function saveHighlightFromSelection() {
    if (!pendingHighlight || !currentRemind) {
      hideHighlightPopup();
      return;
    }
    const { mesid, text } = pendingHighlight;
    const entry = highlightStore.add({
      avatar: currentRemind.avatar,
      fileName: currentRemind.fileName,
      mesid,
      text
    });
    const article = document.querySelector(`#chat-lobby-remind-viewer .remind-msg[data-mesid="${mesid}"] .remind-msg-body`);
    if (article) {
      wrapTextOccurrence(article, text, entry.id);
    }
    window.getSelection()?.removeAllRanges();
    pendingHighlight = null;
    selectionActiveSince = 0;
    hideHighlightPopup();
    showToast("\u{1F58D}\uFE0F \uD615\uAD11\uD39C \uC800\uC7A5\uB428 (\uD0ED\uD558\uBA74 \uC81C\uAC70)", "success", 1800);
  }
  function wrapTextOccurrence(rootEl, searchText, hlId) {
    if (!rootEl || !searchText) return false;
    const full = rootEl.textContent;
    const idx = full.indexOf(searchText);
    if (idx === -1) return false;
    const endIdx = idx + searchText.length;
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
    let pos = 0;
    const targets = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const len = node.nodeValue.length;
      const nodeStart = pos;
      const nodeEnd = pos + len;
      if (nodeEnd > idx && nodeStart < endIdx) {
        targets.push({
          node,
          from: Math.max(0, idx - nodeStart),
          to: Math.min(len, endIdx - nodeStart)
        });
      }
      pos = nodeEnd;
      if (pos >= endIdx) break;
    }
    for (const t of targets) {
      try {
        const range = document.createRange();
        range.setStart(t.node, t.from);
        range.setEnd(t.node, t.to);
        const mark = document.createElement("mark");
        mark.className = "remind-highlight";
        mark.dataset.hlId = hlId;
        range.surroundContents(mark);
      } catch (e) {
      }
    }
    return targets.length > 0;
  }
  function unwrapHighlight(hlId) {
    document.querySelectorAll(`#chat-lobby-remind-viewer mark[data-hl-id="${CSS.escape(hlId)}"]`).forEach((mark) => {
      while (mark.firstChild) {
        mark.parentNode.insertBefore(mark.firstChild, mark);
      }
      mark.remove();
    });
  }
  function applySavedHighlights(body) {
    if (!currentRemind) return;
    body.querySelectorAll(".remind-msg[data-mesid]").forEach((article) => {
      const mesid = parseInt(article.dataset.mesid, 10);
      const hls = highlightStore.getForMessage(currentRemind.avatar, currentRemind.fileName, mesid);
      if (hls.length === 0) return;
      const msgBody = article.querySelector(".remind-msg-body");
      if (!msgBody) return;
      for (const hl of hls) {
        wrapTextOccurrence(msgBody, hl.text, hl.id);
      }
    });
  }
  function openLightbox(src, alt) {
    const lb = document.getElementById("remind-lightbox");
    if (!lb) return;
    lb.querySelector(".remind-lightbox-img").src = src;
    lb.querySelector(".remind-lightbox-img").alt = alt;
    lb.querySelector(".remind-lightbox-caption").textContent = alt;
    lb.classList.add("active");
  }
  function closeLightbox() {
    const lb = document.getElementById("remind-lightbox");
    if (lb) lb.classList.remove("active");
  }
  function updateScrollThumb() {
    const body = document.querySelector("#chat-lobby-remind-viewer .remind-viewer-body");
    const bar = document.getElementById("remind-scrollbar");
    const thumb = document.getElementById("remind-scroll-thumb");
    if (!body || !bar || !thumb) return;
    const { scrollTop, scrollHeight, clientHeight } = body;
    if (scrollHeight <= clientHeight + 4) {
      bar.style.display = "none";
      return;
    }
    bar.style.display = "block";
    const track = bar.clientHeight;
    const thumbH = Math.max(44, Math.round(track * (clientHeight / scrollHeight)));
    const maxThumbTop = track - thumbH;
    const maxScroll = scrollHeight - clientHeight;
    const top = maxScroll > 0 ? Math.round(scrollTop / maxScroll * maxThumbTop) : 0;
    thumb.style.height = `${thumbH}px`;
    thumb.style.transform = `translateY(${top}px)`;
  }
  function bindScrollThumb(overlay, body) {
    const bar = overlay.querySelector("#remind-scrollbar");
    const thumb = overlay.querySelector("#remind-scroll-thumb");
    if (!bar || !thumb) return;
    let dragging = false;
    let startY = 0;
    let startScrollTop = 0;
    const onMove = (e) => {
      if (!dragging) return;
      e.preventDefault();
      const track = bar.clientHeight;
      const thumbH = thumb.offsetHeight;
      const maxThumbTop = track - thumbH;
      const maxScroll = body.scrollHeight - body.clientHeight;
      if (maxThumbTop <= 0 || maxScroll <= 0) return;
      const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0;
      const deltaY = clientY - startY;
      const ratio = maxScroll / maxThumbTop;
      body.scrollTop = startScrollTop + deltaY * ratio;
    };
    const onUp = (e) => {
      if (!dragging) return;
      dragging = false;
      thumb.classList.remove("dragging");
      try {
        thumb.releasePointerCapture?.(e.pointerId);
      } catch (err) {
      }
    };
    listeners.add("remindViewer", thumb, "pointerdown", (e) => {
      dragging = true;
      startY = e.clientY;
      startScrollTop = body.scrollTop;
      thumb.classList.add("dragging");
      try {
        thumb.setPointerCapture?.(e.pointerId);
      } catch (err) {
      }
      e.preventDefault();
      e.stopPropagation();
    });
    listeners.add("remindViewer", thumb, "pointermove", onMove);
    listeners.add("remindViewer", thumb, "pointerup", onUp);
    listeners.add("remindViewer", thumb, "pointercancel", onUp);
    listeners.add("remindViewer", bar, "pointerdown", (e) => {
      if (e.target !== bar) return;
      const rect = bar.getBoundingClientRect();
      const clickRatio = (e.clientY - rect.top) / rect.height;
      const maxScroll = body.scrollHeight - body.clientHeight;
      body.scrollTop = clickRatio * maxScroll;
    });
  }
  function renderMessages(keepScroll = false) {
    const body = document.querySelector("#chat-lobby-remind-viewer .remind-viewer-body");
    const data = getCurrentSlice();
    if (!body || !data) return;
    const { slice, start } = data;
    if (slice.length === 0) {
      body.innerHTML = `<div class="remind-viewer-loading">\u26A0\uFE0F \uD574\uB2F9 \uBC94\uC704\uC5D0 \uBA54\uC2DC\uC9C0\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. (\uCC44\uD305 \uAE38\uC774: ${currentMessages.length})<br><small>\u25C0 \uBC84\uD2BC\uC73C\uB85C \uC774\uC804 \uAD6C\uAC04\uC744 \uBD88\uB7EC\uC62C \uC218 \uC788\uC5B4\uC694.</small></div>`;
      updatePageControls(0, 0);
      return;
    }
    const pageSize = getEffectivePageSize(slice.length);
    const totalPages = getTotalPages(slice.length);
    pageIndex = Math.min(totalPages - 1, Math.max(0, pageIndex));
    const pageStart = pageSize === 0 ? 0 : pageIndex * pageSize;
    const pageSlice = pageSize === 0 ? slice : slice.slice(pageStart, pageStart + pageSize);
    const userName = currentMessages.find((m) => m.is_user)?.name || "User";
    const charName = currentRemind.charName || currentMessages.find((m) => !m.is_user && !m.is_system)?.name || "Character";
    const prevScroll = body.scrollTop;
    let html = "";
    pageSlice.forEach((msg, i) => {
      const mesid = start + pageStart + i;
      let formatted = renderMessageHtml(msg, {
        characterName: charName,
        userName,
        charAvatar: currentRemind.avatar,
        applyRegex: regexEnabled
      });
      if (!formatted || !formatted.trim()) {
        formatted = '<div class="remind-empty-msg">\u2014 \uBE48 \uC751\uB2F5 \u2014</div>';
      }
      const roleClass = msg.is_user ? "is-user" : msg.is_system ? "is-system" : "is-char";
      html += `
        <article class="remind-msg ${roleClass}" data-mesid="${mesid}">
            <div class="remind-msg-meta">
                <span class="remind-msg-name">${escapeHtml(msg.name || (msg.is_user ? userName : charName))}</span>
                <span class="remind-msg-id">#${mesid}</span>
            </div>
            <div class="remind-msg-body">${formatted}</div>
        </article>`;
    });
    body.innerHTML = html;
    body.scrollTop = keepScroll ? prevScroll : 0;
    const rangeFrom = start + pageStart;
    const rangeTo = start + pageStart + pageSlice.length - 1;
    lastRenderedRange = { from: rangeFrom, to: rangeTo };
    updatePageControls(totalPages, slice.length, rangeFrom, rangeTo);
    document.getElementById("remind-viewer-header")?.classList.remove("header-hidden");
    hideHighlightPopup();
    hideSettingsPop();
    hydrateRegexIframes(body);
    applySavedHighlights(body);
    updateScrollThumb();
    setTimeout(updateScrollThumb, 300);
  }
  function updatePageControls(totalPages, rangeLength, rangeFrom = 0, rangeTo = 0) {
    const label = document.getElementById("remind-page-label");
    const prevBtn = document.getElementById("remind-page-prev");
    const nextBtn = document.getElementById("remind-page-next");
    const total = currentMessages?.length || 0;
    if (label) {
      if (rangeLength === 0) {
        label.textContent = "-";
      } else if (totalPages <= 1) {
        label.textContent = `#${rangeFrom}~#${rangeTo}`;
      } else {
        label.textContent = `#${rangeFrom}~#${rangeTo} (${pageIndex + 1}/${totalPages})`;
      }
    }
    if (prevBtn) prevBtn.disabled = pageIndex <= 0 && viewStart <= 0;
    if (nextBtn) nextBtn.disabled = pageIndex >= totalPages - 1 && viewEnd >= total - 1;
  }
  function hydrateOneIframe(iframe) {
    const b64 = iframe.getAttribute("data-remind-html");
    iframe.removeAttribute("data-remind-html");
    if (!b64) return;
    try {
      iframe.srcdoc = decodeURIComponent(escape(atob(b64)));
    } catch (e) {
      console.warn("[RemindViewer] iframe srcdoc set failed:", e);
      iframe.replaceWith(Object.assign(document.createElement("div"), {
        className: "remind-html-notice",
        textContent: "\u{1F9E9} HTML \uBE14\uB85D\uC744 \uD45C\uC2DC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4."
      }));
      return;
    }
    iframe.addEventListener("load", () => {
      setTimeout(() => {
        if (!iframe.style.height || iframe.style.height === "0px") {
          iframe.style.height = "400px";
        }
      }, 800);
    });
  }
  function hydrateRegexIframes(scope) {
    if (iframeObserver) {
      iframeObserver.disconnect();
      iframeObserver = null;
    }
    const frames = scope.querySelectorAll("iframe.remind-regex-iframe[data-remind-html]");
    if (frames.length === 0) return;
    if (typeof IntersectionObserver === "undefined") {
      frames.forEach(hydrateOneIframe);
      return;
    }
    iframeObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          iframeObserver?.unobserve(entry.target);
          hydrateOneIframe(entry.target);
        }
      }
    }, { root: scope, rootMargin: "600px 0px" });
    frames.forEach((f) => iframeObserver.observe(f));
  }
  function exportCurrentRange() {
    const data = getCurrentSlice();
    if (!data || data.slice.length === 0) {
      showToast("\uB0B4\uBCF4\uB0BC \uBA54\uC2DC\uC9C0\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.", "warning");
      return;
    }
    const { slice, start } = data;
    const r = currentRemind;
    const rangeText = `#${viewStart}~#${viewEnd}`;
    let text = `\u{1F516} ${r.charName} - ${r.fileName} (${rangeText})
`;
    if (r.note) text += `\uBA54\uBAA8: ${r.note}
`;
    text += `\uBC31\uC5C5\uC77C: ${(/* @__PURE__ */ new Date()).toLocaleString("ko-KR")}
`;
    text += "=".repeat(40) + "\n\n";
    slice.forEach((msg, i) => {
      text += `[#${start + i}] ${msg.name || (msg.is_user ? "User" : r.charName)}
`;
      text += resolveMes(msg) + "\n\n";
      text += "-".repeat(40) + "\n\n";
    });
    const safeName = `${r.charName}_${r.fileName}_${rangeText}`.replace(/[\\/:*?"<>|#~\s]+/g, "_");
    const blob = new Blob(["\uFEFF" + text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `remind_${safeName}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
    showToast("\u{1F4BE} \uD14D\uC2A4\uD2B8 \uD30C\uC77C\uB85C \uBC31\uC5C5\uD588\uC2B5\uB2C8\uB2E4.", "success");
  }

  // src/ui/chatList.js
  var tooltipElement = null;
  var tooltipTimeout = null;
  var currentTooltipTarget = null;
  var tooltipEventsInitialized = false;
  var lastMouseX = 0;
  var lastMouseY = 0;
  function ensureTooltipElement() {
    if (tooltipElement) return tooltipElement;
    tooltipElement = document.createElement("div");
    tooltipElement.id = "chat-preview-tooltip";
    tooltipElement.className = "chat-preview-tooltip";
    tooltipElement.style.cssText = `
        position: fixed;
        display: none;
        max-width: 400px;
        max-height: 300px;
        padding: 12px 16px;
        background: rgba(20, 20, 30, 0.95);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 10px;
        color: #e0e0e0;
        font-size: 13px;
        line-height: 1.6;
        z-index: 100000;
        overflow-y: auto;
        overflow-x: hidden;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        pointer-events: none;
        white-space: pre-wrap;
        word-break: break-word;
        backdrop-filter: blur(10px);
    `;
    const style = document.createElement("style");
    style.textContent = `
        .chat-preview-tooltip::-webkit-scrollbar {
            width: 6px;
        }
        .chat-preview-tooltip::-webkit-scrollbar-track {
            background: rgba(255,255,255,0.05);
            border-radius: 3px;
        }
        .chat-preview-tooltip::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.2);
            border-radius: 3px;
        }
        .chat-preview-tooltip::-webkit-scrollbar-thumb:hover {
            background: rgba(255,255,255,0.3);
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(tooltipElement);
    return tooltipElement;
  }
  function showTooltip(content) {
    const tooltip = ensureTooltipElement();
    tooltip.textContent = content;
    tooltip.style.display = "block";
    tooltip.style.left = `${lastMouseX + 15}px`;
    tooltip.style.top = `${lastMouseY + 15}px`;
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
    if (tooltipEventsInitialized) {
      return;
    }
    const lobbyContainer = document.getElementById("chat-lobby-container");
    if (!lobbyContainer) return;
    listeners.add("tooltip", lobbyContainer, "mouseover", handleTooltipMouseOver);
    listeners.add("tooltip", lobbyContainer, "mouseout", handleTooltipMouseOut);
    listeners.add("tooltip", lobbyContainer, "mousemove", handleTooltipMouseMove);
    listeners.add("tooltip", lobbyContainer, "wheel", handleTooltipWheel, { passive: false });
    tooltipEventsInitialized = true;
  }
  function handleTooltipMouseOver(e) {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    const item = e.target.closest(".lobby-chat-item");
    if (!item) return;
    if (currentTooltipTarget === item) return;
    let fullPreview = "";
    if (item.dataset.fullPreviewEncoded) {
      try {
        fullPreview = decodeURIComponent(escape(atob(item.dataset.fullPreviewEncoded)));
      } catch (e2) {
        fullPreview = "";
      }
    } else if (item.dataset.fullPreview) {
      fullPreview = item.dataset.fullPreview;
    }
    if (!fullPreview) return;
    hideTooltip();
    currentTooltipTarget = item;
    tooltipTimeout = setTimeout(() => {
      if (currentTooltipTarget === item && fullPreview) {
        showTooltip(fullPreview);
      }
    }, 300);
  }
  function handleTooltipMouseOut(e) {
    const item = e.target.closest(".lobby-chat-item");
    if (!item) return;
    const relatedItem = e.relatedTarget?.closest(".lobby-chat-item");
    if (relatedItem === item) return;
    if (currentTooltipTarget === item) {
      hideTooltip();
    }
  }
  function handleTooltipWheel(e) {
    if (!tooltipElement || tooltipElement.style.display !== "block") return;
    const hasScroll = tooltipElement.scrollHeight > tooltipElement.clientHeight;
    if (!hasScroll) return;
    const item = e.target.closest(".lobby-chat-item");
    if (item && currentTooltipTarget === item) {
      e.preventDefault();
      e.stopPropagation();
      tooltipElement.scrollTop += e.deltaY;
    }
  }
  function handleTooltipMouseMove(e) {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    const item = e.target.closest(".lobby-chat-item");
    if (!item) return;
    if (tooltipElement && tooltipElement.style.display === "block" && currentTooltipTarget === item) {
      tooltipElement.style.left = `${e.clientX + 15}px`;
      tooltipElement.style.top = `${e.clientY + 15}px`;
    }
  }
  function cleanupTooltip() {
    hideTooltip();
    listeners.clear("tooltip");
    tooltipEventsInitialized = false;
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
    console.debug("[ChatList] renderChatList called:", character?.avatar);
    if (!character || !character.avatar) {
      console.error("[ChatList] Invalid character data:", character);
      return;
    }
    const chatsPanel = document.getElementById("chat-lobby-chats");
    const chatsList = document.getElementById("chat-lobby-chats-list");
    console.debug("[ChatList] chatsPanel:", !!chatsPanel, "chatsList:", !!chatsList);
    console.debug("[ChatList] currentCharacter:", store.currentCharacter?.avatar);
    console.debug("[ChatList] panelVisible:", chatsPanel?.classList.contains("visible"));
    if (store.currentCharacter?.avatar === character.avatar && chatsPanel?.classList.contains("visible") && cache.isValid("chats", character.avatar)) {
      console.debug("[ChatList] Skipping - same character already visible with valid cache");
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
    const savedSortOption = storage.getSortOption();
    const branchRefreshBtn = document.getElementById("chat-lobby-branch-refresh");
    if (branchRefreshBtn) {
      branchRefreshBtn.style.display = savedSortOption === "branch" ? "flex" : "none";
    }
    console.debug("[ChatList] Updating persona quick button for:", character.avatar);
    updatePersonaQuickButton(character.avatar);
    const cachedChats = cache.get("chats", character.avatar);
    if (cachedChats && cachedChats.length > 0 && cache.isValid("chats", character.avatar)) {
      renderChats(chatsList, cachedChats, character.avatar);
      return;
    }
    chatsList.innerHTML = '<div class="lobby-loading">\uCC44\uD305 \uB85C\uB529 \uC911...</div>';
    const requestedAvatar = character.avatar;
    try {
      const chats = await api.fetchChatsForCharacter(character.avatar);
      if (store.currentCharacter?.avatar !== requestedAvatar) {
        console.debug("[ChatList] Character changed during fetch, discarding result for:", requestedAvatar);
        return;
      }
      if (!chats || chats.length === 0) {
        updateChatCount(0);
        chatsList.innerHTML = `
                <div class="lobby-empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:var(--text-muted,#888);padding:40px;">
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
            <div class="lobby-empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:var(--text-muted,#888);padding:40px;">
                <i>\u26A0\uFE0F</i>
                <div>\uCC44\uD305 \uBAA9\uB85D \uB85C\uB529 \uC2E4\uD328</div>
                <button onclick="window.chatLobbyRefresh()" style="margin-top:10px;padding:8px 16px;cursor:pointer;">\uB2E4\uC2DC \uC2DC\uB3C4</button>
            </div>
        `;
    }
  }
  var autoAnalyzeTimerId = null;
  function renderChats(container, rawChats, charAvatar, skipAutoAnalyze = false) {
    if (autoAnalyzeTimerId) {
      clearTimeout(autoAnalyzeTimerId);
      autoAnalyzeTimerId = null;
    }
    if (store.currentCharacter && store.currentCharacter.avatar !== charAvatar) {
      console.debug("[renderChats] Stale render blocked:", charAvatar, "(current:", store.currentCharacter.avatar, ")");
      return;
    }
    let chatArray = normalizeChats(rawChats);
    chatArray = filterValidChats(chatArray);
    const totalChatCount = chatArray.length;
    updateHasChats(totalChatCount);
    if (chatArray.length === 0) {
      console.debug("[renderChats] No valid chats, showing empty state");
      updateChatCount(0);
      container.innerHTML = `
            <div class="lobby-empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:var(--text-muted,#888);padding:40px;">
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
            <div class="lobby-empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:var(--text-muted,#888);padding:40px;">
                <i>\u{1F4C1}</i>
                <div>\uC774 \uD3F4\uB354\uC5D0\uB294 \uCC44\uD305\uC774 \uC5C6\uC2B5\uB2C8\uB2E4</div>
            </div>
        `;
      return;
    }
    let branchAnalyzeBtn = "";
    if (sortOption === "branch" && chatArray.length >= 2) {
      const needsAnalysis = needsBranchAnalysis(charAvatar, chatArray);
      if (needsAnalysis && !skipAutoAnalyze) {
        const newCount = countNewChatsForAnalysis(charAvatar, chatArray);
        if (newCount > 0 && newCount <= 3) {
          autoAnalyzeTimerId = setTimeout(() => {
            autoAnalyzeTimerId = null;
            autoAnalyzeBranches(container, charAvatar, chatArray);
          }, 100);
          branchAnalyzeBtn = `
                    <div class="branch-analyze-bar" data-char-avatar="${escapeHtml(charAvatar)}">
                        <span class="branch-analyze-status">\u23F3 \uC0C8 \uCC44\uD305 ${newCount}\uAC1C \uC790\uB3D9 \uBD84\uC11D \uC911...</span>
                    </div>
                `;
        } else if (newCount > 3) {
          branchAnalyzeBtn = `
                    <div class="branch-analyze-bar" data-char-avatar="${escapeHtml(charAvatar)}">
                        <button class="branch-analyze-btn" title="\uCC44\uD305 \uB0B4\uC6A9\uC744 \uBD84\uC11D\uD558\uC5EC \uBD84\uAE30 \uAD00\uACC4\uB97C \uD30C\uC545\uD569\uB2C8\uB2E4">
                            \u{1F50D} \uBD84\uAE30 \uBD84\uC11D\uD558\uAE30 (${newCount}\uAC1C)
                        </button>
                        <span class="branch-analyze-status"></span>
                    </div>
                `;
        }
      }
    }
    container.innerHTML = branchAnalyzeBtn + chatArray.map(
      (chat, idx) => renderChatItem(chat, charAvatar, idx)
    ).join("");
    bindBranchAnalyzeEvents(container, charAvatar, chatArray);
    bindChatEvents(container, charAvatar);
    bindTooltipEvents(container);
    syncDropdowns(filterFolder, sortOption);
  }
  function bindBranchAnalyzeEvents(container, charAvatar, chats) {
    const btn = container.querySelector(".branch-analyze-btn");
    const statusEl = container.querySelector(".branch-analyze-status");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "\u23F3 \uBD84\uC11D \uC911...";
      try {
        await analyzeBranches(charAvatar, chats, (progress) => {
          const percent = Math.round(progress * 100);
          if (statusEl) {
            statusEl.textContent = `${percent}%`;
          }
        });
        showToast("\uBD84\uAE30 \uBD84\uC11D \uC644\uB8CC! \uBAA9\uB85D\uC744 \uC0C8\uB85C\uACE0\uCE68\uD569\uB2C8\uB2E4.", "success");
        const analyzeBar = container.querySelector(".branch-analyze-bar");
        if (analyzeBar) analyzeBar.remove();
        const cachedChats = cache.get("chats", charAvatar);
        if (cachedChats) {
          renderChats(container, cachedChats, charAvatar, true);
        }
      } catch (e) {
        console.error("[BranchAnalyze] Error:", e);
        showToast("\uBD84\uAE30 \uBD84\uC11D \uC2E4\uD328", "error");
        btn.disabled = false;
        btn.textContent = "\u{1F50D} \uBD84\uAE30 \uBD84\uC11D\uD558\uAE30";
      }
    });
  }
  function countNewChatsForAnalysis(charAvatar, chats) {
    const fingerprints = getAllFingerprints(charAvatar);
    let count = 0;
    for (const chat of chats) {
      const fn = chat.file_name || "";
      if (!fingerprints[fn]) {
        count++;
      }
    }
    return count;
  }
  async function autoAnalyzeBranches(container, charAvatar, chats) {
    if (chats.length < 2) return;
    if (store.currentCharacter?.avatar !== charAvatar) {
      console.debug("[AutoBranchAnalyze] Stale entry blocked:", charAvatar);
      return;
    }
    try {
      await analyzeBranches(charAvatar, chats);
      if (store.currentCharacter?.avatar !== charAvatar) {
        console.debug("[AutoBranchAnalyze] Character changed during analysis, skipping re-render");
        return;
      }
      const cachedChats = cache.get("chats", charAvatar);
      if (cachedChats) {
        renderChats(container, cachedChats, charAvatar, true);
      }
    } catch (e) {
      console.error("[AutoBranchAnalyze] Error:", e);
      const statusEl = container.querySelector(".branch-analyze-status");
      if (statusEl) {
        statusEl.innerHTML = `<button class="branch-analyze-btn">\u{1F50D} \uBD84\uAE30 \uBD84\uC11D\uD558\uAE30</button>`;
        bindBranchAnalyzeEvents(container, charAvatar, chats);
      }
    }
  }
  function normalizeChats(chats) {
    if (Array.isArray(chats)) return [...chats];
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
      return fileName && hasJsonl && !fileName.startsWith("chat_") && fileName.toLowerCase() !== "error";
    });
  }
  function filterByFolder(chats, charAvatar, filterFolder) {
    const data = storage.load();
    const result = chats.filter((chat) => {
      const fn = chat.file_name || chat.fileName || "";
      const key = storage.getChatKey(charAvatar, fn);
      if (filterFolder === "favorites") {
        return data.favorites.includes(key);
      }
      const assigned = data.chatAssignments[key] || "uncategorized";
      return assigned === filterFolder;
    });
    return result;
  }
  function sortChats(chats, charAvatar, sortOption) {
    const data = storage.load();
    if (sortOption === "branch") {
      return sortByBranchTreeCached(chats, charAvatar, data);
    }
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
  function sortByBranchTreeCached(chats, charAvatar, data) {
    const branches = getAllBranches(charAvatar);
    const chatsWithBranch = chats.map((chat) => {
      const fileName = chat.file_name || "";
      const branchInfo = branches[fileName];
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
    const originals = chatsWithBranch.filter((c) => c._branchInfo.isOriginal);
    const branchList = chatsWithBranch.filter((c) => !c._branchInfo.isOriginal);
    originals.sort((a, b) => {
      const fnA = a.file_name || "";
      const fnB = b.file_name || "";
      const keyA = storage.getChatKey(charAvatar, fnA);
      const keyB = storage.getChatKey(charAvatar, fnB);
      const favA = data.favorites.includes(keyA) ? 0 : 1;
      const favB = data.favorites.includes(keyB) ? 0 : 1;
      if (favA !== favB) return favA - favB;
      return getTimestamp(b) - getTimestamp(a);
    });
    branchList.sort((a, b) => {
      const depthDiff = a._branchInfo.depth - b._branchInfo.depth;
      if (depthDiff !== 0) return depthDiff;
      return getTimestamp(b) - getTimestamp(a);
    });
    const result = [];
    const usedBranches = /* @__PURE__ */ new Set();
    function addChildBranches(parentFileName) {
      const children = branchList.filter(
        (b) => b._branchInfo.parentChat === parentFileName && !usedBranches.has(b.file_name)
      );
      children.sort((a, b) => {
        const depthDiff = a._branchInfo.depth - b._branchInfo.depth;
        if (depthDiff !== 0) return depthDiff;
        return getTimestamp(b) - getTimestamp(a);
      });
      for (const child of children) {
        result.push(child);
        usedBranches.add(child.file_name);
        addChildBranches(child.file_name);
      }
    }
    for (const original of originals) {
      result.push(original);
      addChildBranches(original.file_name);
    }
    for (const branch of branchList) {
      if (!usedBranches.has(branch.file_name)) {
        result.push(branch);
        usedBranches.add(branch.file_name);
        addChildBranches(branch.file_name);
      }
    }
    return result;
  }
  function renderChatItem(chat, charAvatar, index) {
    const fileName = chat.file_name || chat.fileName || chat.name || `chat_${index}`;
    const displayName = fileName.replace(".jsonl", "");
    const preview = chat.preview || chat.mes || chat.last_message || "\uCC44\uD305 \uAE30\uB85D";
    const messageCount2 = chat.chat_items || chat.message_count || chat.mes_count || 0;
    const isFav = storage.isFavorite(charAvatar, fileName);
    const folderId = storage.getChatFolder(charAvatar, fileName);
    const data = storage.load();
    const folder = data.folders.find((f) => f.id === folderId);
    const folderName = folder?.name || "";
    const tooltipPreview = preview;
    const safeAvatar = escapeHtml(charAvatar || "");
    const safeFileName = escapeHtml(fileName || "");
    const safeFullPreview = tooltipPreview ? btoa(unescape(encodeURIComponent(tooltipPreview))) : "";
    const branchInfo = chat._branchInfo;
    const branchDepth = branchInfo?.depth || 0;
    const isBranch = branchInfo && !branchInfo.isOriginal;
    const branchPoint = branchInfo?.branchPoint || 0;
    const depthIndent = isBranch ? Math.min(branchDepth, 5) * 16 : 0;
    const indentStyle = isBranch ? `margin-left: ${depthIndent}px;` : "";
    const branchClass = branchInfo ? "branch-mode" : "";
    const branchBadge = isBranch ? `<span class="branch-badge" title="\uBD84\uAE30\uC810: ${branchPoint}\uBC88\uC9F8 \uBA54\uC2DC\uC9C0">\u21B3 \uBD84\uAE30${branchPoint > 0 ? ` @${branchPoint}` : ""}</span>` : "";
    return `
    <div class="lobby-chat-item ${isFav ? "is-favorite" : ""} ${branchClass} ${isBranch ? "is-branch" : ""}" 
         data-file-name="${safeFileName}" 
         data-char-avatar="${safeAvatar}" 
         data-chat-index="${index}" 
         data-folder-id="${folderId}"
         data-branch-depth="${branchDepth}"
         data-branch-point="${branchPoint}"
         data-full-preview-encoded="${safeFullPreview}"
         style="${indentStyle}">
        <label class="chat-checkbox" style="display:none;"><input type="checkbox" class="chat-select-cb"></label>
        <button class="chat-fav-btn" title="\uC990\uACA8\uCC3E\uAE30">${isFav ? "\u2605" : "\u2606"}</button>
        <div class="chat-content">
            <div class="chat-name">${branchBadge}${escapeHtml(displayName)}</div>
            <div class="chat-preview">${escapeHtml(truncateText(preview, 80))}</div>
            <div class="chat-meta">
                ${messageCount2 > 0 ? `<span>\u{1F4AC} ${messageCount2}\uAC1C</span>` : ""}
                ${folderName && folderId !== "uncategorized" ? `<span class="chat-folder-tag">${escapeHtml(folderName)}</span>` : ""}
            </div>
        </div>
        <div class="chat-actions">
            <button class="chat-folder-btn" title="\uD3F4\uB354 \uC774\uB3D9">\u22EE</button>
            <button class="chat-delete-btn" title="\uCC44\uD305 \uC0AD\uC81C">\u{1F5D1}\uFE0F</button>
        </div>
    </div>
    `;
  }
  function bindChatEvents(container, charAvatar) {
    const items = container.querySelectorAll(".lobby-chat-item");
    console.debug("[ChatList] bindChatEvents: items count =", items.length, "charAvatar =", charAvatar);
    items.forEach((item, index) => {
      const chatContent = item.querySelector(".chat-content");
      const favBtn = item.querySelector(".chat-fav-btn");
      const delBtn = item.querySelector(".chat-delete-btn");
      const fileName = item.dataset.fileName;
      console.debug("[ChatList] Binding item", index, ":", { fileName, hasChatContent: !!chatContent });
      if (!chatContent) {
        console.error("[ChatList] chatContent not found for item", index);
        return;
      }
      createTouchClickHandler(chatContent, () => {
        console.debug("[ChatList] Chat item clicked!", { fileName, charAvatar: item.dataset.charAvatar });
        if (store.batchModeActive) {
          const cb = item.querySelector(".chat-select-cb");
          if (cb) {
            cb.checked = !cb.checked;
            updateBatchCount();
          }
          return;
        }
        if (operationLock.isLocked) {
          console.debug("[ChatList] Operation in progress, ignoring click:", operationLock.currentOp);
          return;
        }
        const handlers = store.chatHandlers;
        console.debug("[ChatList] handlers =", handlers, "onOpen =", !!handlers?.onOpen);
        if (handlers?.onOpen) {
          const charIndex = store.currentCharacter?.index || item.dataset.charIndex || null;
          const chatInfo = {
            fileName: item.dataset.fileName,
            charAvatar: item.dataset.charAvatar,
            charIndex
          };
          console.debug("[ChatList] Calling onOpen:", chatInfo);
          handlers.onOpen(chatInfo);
        } else {
          console.error("[ChatList] onOpen handler not available!");
        }
      }, { preventDefault: true, stopPropagation: true, debugName: `chat-${index}` });
      createTouchClickHandler(favBtn, () => {
        const fn = item.dataset.fileName;
        const isNowFav = storage.toggleFavorite(charAvatar, fn);
        favBtn.textContent = isNowFav ? "\u2605" : "\u2606";
        item.classList.toggle("is-favorite", isNowFav);
        showToast(isNowFav ? "\u2B50 \uC990\uACA8\uCC3E\uAE30 \uCD94\uAC00" : "\u2B50 \uC990\uACA8\uCC3E\uAE30 \uD574\uC81C", "success");
      }, { debugName: `fav-${index}` });
      const folderBtn = item.querySelector(".chat-folder-btn");
      if (folderBtn) {
        createTouchClickHandler(folderBtn, (e) => {
          e.stopPropagation();
          showChatFolderMenu(folderBtn, charAvatar, fileName);
        }, { debugName: `folder-${index}` });
      }
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
      newChatBtn.dataset.isGroup = "false";
      delete newChatBtn.dataset.groupId;
      delete newChatBtn.dataset.groupName;
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
  var activeFolderMenu = null;
  function showChatFolderMenu(targetBtn, charAvatar, fileName) {
    if (activeFolderMenu) {
      const prevBtn = activeFolderMenu._targetBtn;
      closeChatFolderMenu();
      if (prevBtn === targetBtn) return;
    }
    const data = storage.load();
    const folders = (data.folders || []).filter((f) => f.id !== "favorites" && f.id !== "uncategorized");
    const currentFolderId = storage.getChatFolder(charAvatar, fileName);
    const menu = document.createElement("div");
    menu.className = "chat-folder-menu";
    menu.innerHTML = `
        <div class="folder-menu-item view-chat-item">
            \u{1F4D6} \uBDF0\uC5B4\uB85C \uAC10\uC0C1
        </div>
        <div class="folder-menu-item rename-chat-item">
            \u270F\uFE0F \uC774\uB984 \uBC14\uAFB8\uAE30
        </div>
        <div class="folder-menu-item remind-add-item">
            \u{1F516} \uB9AC\uB9C8\uC778\uB4DC \uCD94\uAC00
        </div>
        <div class="folder-menu-title">\uD3F4\uB354 \uC774\uB3D9</div>
        <div class="folder-menu-item ${!currentFolderId || currentFolderId === "uncategorized" ? "active" : ""}" data-folder-id="">
            \u{1F4E4} \uD3F4\uB354\uC5D0\uC11C \uC81C\uAC70
        </div>
        ${folders.map((f) => `
            <div class="folder-menu-item ${f.id === currentFolderId ? "active" : ""}" data-folder-id="${f.id}">
                \u{1F4C1} ${escapeHtml(f.name)}
            </div>
        `).join("")}
    `;
    const rect = targetBtn.getBoundingClientRect();
    menu.style.cssText = `
        position: fixed;
        top: ${rect.bottom + 4}px;
        right: ${window.innerWidth - rect.right}px;
        z-index: 60000;
        background: var(--lobby-bg-card, #1a1a2e);
        border: 1px solid var(--lobby-border, #333);
        border-radius: 10px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        min-width: 150px;
        overflow: hidden;
    `;
    const lobbyContainer = document.getElementById("chat-lobby-container") || document.body;
    lobbyContainer.appendChild(menu);
    activeFolderMenu = menu;
    activeFolderMenu._targetBtn = targetBtn;
    menu.querySelector(".view-chat-item")?.addEventListener("click", async () => {
      closeChatFolderMenu();
      const context = api.getContext();
      const char = (context?.characters || []).find((c) => c.avatar === charAvatar);
      await openChatInViewer(charAvatar, char?.name || "", fileName);
    });
    menu.querySelector(".rename-chat-item")?.addEventListener("click", async () => {
      closeChatFolderMenu();
      await renameChatPrompt(charAvatar, fileName);
    });
    menu.querySelector(".remind-add-item")?.addEventListener("click", async () => {
      closeChatFolderMenu();
      await addRemindPrompt(charAvatar, fileName);
    });
    menu.querySelectorAll(".folder-menu-item:not(.rename-chat-item):not(.remind-add-item):not(.view-chat-item)").forEach((item) => {
      item.addEventListener("click", async () => {
        const folderId = item.dataset.folderId;
        if (folderId) {
          storage.setChatFolder(charAvatar, fileName, folderId);
          const folder = folders.find((f) => f.id === folderId);
          showToast(`\u{1F4C1} ${folder?.name || "\uD3F4\uB354"}\uB85C \uC774\uB3D9`, "success");
        } else {
          storage.setChatFolder(charAvatar, fileName, null);
          showToast("\uD3F4\uB354\uC5D0\uC11C \uC81C\uAC70\uB428", "success");
        }
        closeChatFolderMenu();
        await refreshCurrentChatList();
      });
    });
    setTimeout(() => {
      listeners.add("chatFolderMenu", document, "click", closeFolderMenuOnClickOutside);
    }, 10);
  }
  function closeFolderMenuOnClickOutside(e) {
    if (activeFolderMenu && !activeFolderMenu.contains(e.target)) {
      closeChatFolderMenu();
    }
  }
  function closeChatFolderMenu() {
    if (activeFolderMenu) {
      activeFolderMenu.remove();
      activeFolderMenu = null;
    }
    listeners.clear("chatFolderMenu");
  }
  async function addRemindPrompt(charAvatar, fileName) {
    const cleanName = fileName.replace(/\.jsonl$/i, "");
    const rangeInput = await showPrompt(
      "\uC800\uC7A5\uD560 \uBA54\uC2DC\uC9C0 \uBC94\uC704\uB97C \uC785\uB825\uD558\uC138\uC694. (\uBA54\uC2DC\uC9C0 \uBC88\uD638 \uAE30\uC900)\n\uC608: 120-130 / 120 (\uD55C \uBA54\uC2DC\uC9C0) / \uBE44\uC6B0\uBA74 \uC804\uCCB4",
      "\u{1F516} \uB9AC\uB9C8\uC778\uB4DC \uCD94\uAC00",
      ""
    );
    if (rangeInput === null) return;
    let start = null;
    let end = null;
    const trimmed = rangeInput.trim();
    if (trimmed) {
      const match = trimmed.match(/^(\d+)\s*[-~]\s*(\d+)$/) || trimmed.match(/^(\d+)$/);
      if (!match) {
        showToast("\uBC94\uC704 \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC608: 120-130", "error");
        return;
      }
      start = parseInt(match[1], 10);
      end = match[2] !== void 0 ? parseInt(match[2], 10) : start;
      if (end < start) [start, end] = [end, start];
    }
    const note = await showPrompt(
      "\uBA54\uBAA8\uB97C \uB0A8\uACA8\uC8FC\uC138\uC694. (\uC65C \uC88B\uC558\uB294\uC9C0, \uC5B4\uB5A4 \uC7A5\uBA74\uC778\uC9C0)",
      "\u{1F516} \uB9AC\uB9C8\uC778\uB4DC \uBA54\uBAA8",
      ""
    );
    if (note === null) return;
    const context = api.getContext();
    const char = (context?.characters || []).find((c) => c.avatar === charAvatar);
    remindStore.add({
      avatar: charAvatar,
      charName: char?.name || charAvatar.replace(/\.[^.]+$/, ""),
      fileName: cleanName,
      start,
      end,
      note: note.trim()
    });
    const rangeText = start !== null ? ` (#${start}~#${end})` : "";
    showToast(`\u{1F516} \uB9AC\uB9C8\uC778\uB4DC \uC800\uC7A5\uB428${rangeText}
\uBCF4\uAD00\uD568 \uD0ED\uC5D0\uC11C \uB2E4\uC2DC \uBCFC \uC218 \uC788\uC5B4\uC694.`, "success");
  }
  async function renameChatPrompt(charAvatar, fileName) {
    const currentName = fileName.replace(/\.jsonl$/i, "");
    const context = api.getContext();
    const currentChatFile = context?.characters?.[context?.characterId]?.chat;
    if (currentChatFile === currentName) {
      showToast("\uD604\uC7AC \uC5F4\uB9B0 \uCC44\uD305\uC740 \uC774\uB984\uC744 \uBC14\uAFC0 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.\n\uB2E4\uB978 \uCC44\uD305\uC73C\uB85C \uC774\uB3D9 \uD6C4 \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", "warning");
      return;
    }
    const input = await showPrompt("\uC0C8 \uCC44\uD305 \uC774\uB984\uC744 \uC785\uB825\uD558\uC138\uC694.", "\u270F\uFE0F \uC774\uB984 \uBC14\uAFB8\uAE30", currentName);
    if (input === null) return;
    const newName = input.trim().replace(/\.jsonl$/i, "");
    if (!newName || newName === currentName) return;
    if (/[\\/:*?"<>|]/.test(newName)) {
      showToast('\uD30C\uC77C\uBA85\uC5D0 \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uB294 \uBB38\uC790\uAC00 \uC788\uC2B5\uB2C8\uB2E4: \\ / : * ? " < > |', "error");
      return;
    }
    const chats = cache.get("chats", charAvatar);
    if (Array.isArray(chats) && chats.some((c) => (c.file_name || "").replace(/\.jsonl$/i, "") === newName)) {
      showToast("\uAC19\uC740 \uC774\uB984\uC758 \uCC44\uD305\uC774 \uC774\uBBF8 \uC788\uC2B5\uB2C8\uB2E4.", "error");
      return;
    }
    const token = operationLock.acquire("renameChat", 1e4);
    if (!token) {
      showToast("\uB2E4\uB978 \uC791\uC5C5\uC774 \uC9C4\uD589 \uC911\uC785\uB2C8\uB2E4.", "warning");
      return;
    }
    try {
      const appliedName = await api.renameChat(charAvatar, currentName, newName);
      if (appliedName) {
        storage.renameChatKey(charAvatar, currentName, appliedName);
        remindStore.renameChat(charAvatar, currentName, appliedName);
        highlightStore.renameChat(charAvatar, currentName, appliedName);
        const char = api.getContext()?.characters?.find((c) => c.avatar === charAvatar);
        if (char && char.chat === currentName) {
          char.chat = appliedName;
          api.saveLastChatPointer(char.avatar, char.name, appliedName);
        }
        showToast(`\uC774\uB984 \uBCC0\uACBD: "${appliedName}"`, "success");
        await refreshCurrentChatList(true);
      } else {
        showToast("\uC774\uB984 \uBCC0\uACBD\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", "error");
      }
    } catch (e) {
      console.error("[ChatList] Rename failed:", e);
      showToast("\uC774\uB984 \uBCC0\uACBD \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.", "error");
    } finally {
      operationLock.release(token);
    }
  }
  function handleSortChange(sortValue) {
    storage.setSortOption(sortValue);
    const branchRefreshBtn = document.getElementById("chat-lobby-branch-refresh");
    if (branchRefreshBtn) {
      branchRefreshBtn.style.display = sortValue === "branch" ? "flex" : "none";
    }
    refreshCurrentChatList();
  }
  async function refreshCurrentChatList(forceReload = false) {
    const character = store.currentCharacter;
    if (!character) return;
    const chatsList = document.getElementById("chat-lobby-chats-list");
    if (!chatsList) return;
    if (forceReload) {
      const requestedAvatar = character.avatar;
      chatsList.innerHTML = '<div class="lobby-loading">\uCC44\uD305 \uB85C\uB529 \uC911...</div>';
      try {
        const chats = await api.fetchChatsForCharacter(character.avatar, true);
        if (store.currentCharacter?.avatar !== requestedAvatar) {
          console.debug("[ChatList] Character changed during force reload, discarding");
          return;
        }
        if (chats && chats.length > 0) {
          renderChats(chatsList, chats, character.avatar);
        } else {
          chatsList.innerHTML = '<div class="lobby-empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:var(--text-muted,#888);padding:40px;"><i>\u{1F4AC}</i><div>\uCC44\uD305 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4</div></div>';
        }
      } catch (error) {
        console.error("[ChatList] Failed to reload chats:", error);
      }
      return;
    }
    const cachedChats = cache.get("chats", character.avatar);
    if (cachedChats) {
      renderChats(chatsList, cachedChats, character.avatar);
    } else {
      await renderChatList(character);
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
  function batchSelectAll() {
    const checkboxes = document.querySelectorAll(".chat-select-cb");
    const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
    checkboxes.forEach((cb) => {
      cb.checked = !allChecked;
    });
    updateBatchCount();
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
    const filterSelect = document.getElementById("chat-lobby-folder-filter");
    if (filterSelect) {
      const currentValue = filterSelect.value;
      filterSelect.innerHTML = getFoldersOptionsHTML(currentValue);
    }
    await refreshCurrentChatList();
  }
  async function executeBatchDelete() {
    const checked = document.querySelectorAll(".chat-select-cb:checked");
    if (checked.length === 0) {
      await showAlert("\uC0AD\uC81C\uD560 \uCC44\uD305\uC744 \uC120\uD0DD\uD558\uC138\uC694.");
      return;
    }
    const context = api.getContext();
    const currentChatFile = context?.characters?.[context?.characterId]?.chat;
    const chatItems = [];
    checked.forEach((cb) => {
      const item = cb.closest(".lobby-chat-item");
      if (item) {
        chatItems.push({
          fileName: item.dataset.fileName,
          charAvatar: item.dataset.charAvatar,
          element: item
        });
      }
    });
    const hasCurrentChat = chatItems.some((c) => {
      const nameWithoutExt = c.fileName.replace(".jsonl", "");
      return currentChatFile === nameWithoutExt;
    });
    if (hasCurrentChat) {
      await showAlert("\uD604\uC7AC \uC5F4\uB9B0 \uCC44\uD305\uC774 \uC120\uD0DD\uC5D0 \uD3EC\uD568\uB418\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.\n\uD604\uC7AC \uCC44\uD305\uC740 \uC0AD\uC81C\uD560 \uC218 \uC5C6\uC73C\uB2C8 \uC120\uD0DD\uC744 \uD574\uC81C\uD558\uC138\uC694.");
      return;
    }
    const confirmed = await showConfirm(
      `\uC120\uD0DD\uD55C ${chatItems.length}\uAC1C \uCC44\uD305\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?

\uC774 \uC791\uC5C5\uC740 \uB418\uB3CC\uB9B4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.`,
      "\uBC30\uCE58 \uC0AD\uC81C",
      true
    );
    if (!confirmed) return;
    const token = operationLock.acquire("batchDelete", Math.min(12e4, 1e4 + chatItems.length * 1500));
    if (!token) {
      showToast("\uB2E4\uB978 \uC791\uC5C5\uC774 \uC9C4\uD589 \uC911\uC785\uB2C8\uB2E4.", "warning");
      return;
    }
    let successCount = 0;
    let failCount = 0;
    const deletedOk = [];
    try {
      for (const chat of chatItems) {
        try {
          const success = await api.deleteChat(chat.fileName, chat.charAvatar);
          if (success) {
            successCount++;
            deletedOk.push(chat);
            const data = storage.load();
            const key = storage.getChatKey(chat.charAvatar, chat.fileName);
            delete data.chatAssignments[key];
            const favIndex = data.favorites.indexOf(key);
            if (favIndex > -1) {
              data.favorites.splice(favIndex, 1);
            }
            storage.save(data);
          } else {
            failCount++;
          }
        } catch (e) {
          console.error("[BatchDelete] Failed to delete:", chat.fileName, e);
          failCount++;
        }
      }
      const avatarSet = new Set(chatItems.map((c) => c.charAvatar));
      avatarSet.forEach((avatar) => cache.invalidate("chats", avatar));
      for (const avatar of avatarSet) {
        const names = deletedOk.filter((c) => c.charAvatar === avatar).map((c) => c.fileName);
        if (names.length === 0) continue;
        await api.repointLastChatAfterDelete(avatar, names);
      }
      toggleBatchMode();
      if (failCount === 0) {
        showToast(`${successCount}\uAC1C \uCC44\uD305\uC774 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, "success");
      } else {
        showToast(`${successCount}\uAC1C \uC0AD\uC81C \uC644\uB8CC, ${failCount}\uAC1C \uC2E4\uD328`, "warning");
      }
      await refreshCurrentChatList(true);
    } catch (error) {
      console.error("[BatchDelete] Error:", error);
      showToast("\uBC30\uCE58 \uC0AD\uC81C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.", "error");
    } finally {
      operationLock.release(token);
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
    if (autoAnalyzeTimerId) {
      clearTimeout(autoAnalyzeTimerId);
      autoAnalyzeTimerId = null;
    }
    deactivateBatchMode();
    const chatsPanel = document.getElementById("chat-lobby-chats");
    if (chatsPanel) chatsPanel.classList.remove("visible");
    store.setCurrentCharacter(null);
    store.setCurrentGroup(null);
  }
  function deactivateBatchMode() {
    if (!store.batchModeActive) return;
    store.setBatchMode(false);
    const chatsList = document.getElementById("chat-lobby-chats-list");
    const toolbar = document.getElementById("chat-lobby-batch-toolbar");
    const batchBtn = document.getElementById("chat-lobby-batch-mode");
    chatsList?.classList.remove("batch-mode");
    toolbar?.classList.remove("visible");
    batchBtn?.classList.remove("active");
    chatsList?.querySelectorAll(".chat-checkbox").forEach((cb) => {
      cb.style.display = "none";
      const input = cb.querySelector("input");
      if (input) input.checked = false;
    });
    updateBatchCount();
  }
  async function renderGroupChatList(group) {
    console.debug("[ChatList] renderGroupChatList called:", {
      groupId: group?.id,
      groupName: group?.name,
      currentGroupId: store.currentGroup?.id,
      isPanelVisible: document.getElementById("chat-lobby-chats")?.classList.contains("visible")
    });
    if (!group || !group.id) {
      console.error("[ChatList] Invalid group data:", group);
      return;
    }
    const chatsPanel = document.getElementById("chat-lobby-chats");
    const chatsList = document.getElementById("chat-lobby-chats-list");
    if (store.currentGroup?.id === group.id && chatsPanel?.classList.contains("visible")) {
      console.debug("[ChatList] Same group already visible, toggling off");
      chatsPanel.classList.remove("visible");
      store.setCurrentGroup(null);
      return;
    }
    store.setCurrentCharacter(null);
    store.setCurrentGroup(group);
    if (!chatsPanel || !chatsList) {
      console.error("[ChatList] Chat panel elements not found");
      return;
    }
    chatsPanel.classList.add("visible");
    updateGroupChatHeader(group);
    showFolderBar(true);
    hidePersonaQuickButton();
    chatsList.innerHTML = '<div class="lobby-loading">\uCC44\uD305 \uB85C\uB529 \uC911...</div>';
    try {
      const chats = await api.getGroupChats(group.id);
      if (!chats || chats.length === 0) {
        updateChatCount(0);
        chatsList.innerHTML = `
                <div class="lobby-empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:var(--text-muted,#888);padding:40px;">
                    <i>\u{1F4AC}</i>
                    <div>\uADF8\uB8F9 \uCC44\uD305 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4</div>
                    <div style="font-size: 0.9em; margin-top: 5px;">\uC0C8 \uCC44\uD305\uC744 \uC2DC\uC791\uD574\uBCF4\uC138\uC694!</div>
                </div>
            `;
        return;
      }
      renderGroupChats(chatsList, chats, group);
    } catch (error) {
      console.error("[ChatList] Failed to load group chats:", error);
      showToast("\uADF8\uB8F9 \uCC44\uD305 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "error");
      chatsList.innerHTML = `
            <div class="lobby-empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:var(--text-muted,#888);padding:40px;">
                <i>\u26A0\uFE0F</i>
                <div>\uADF8\uB8F9 \uCC44\uD305 \uBAA9\uB85D \uB85C\uB529 \uC2E4\uD328</div>
            </div>
        `;
    }
  }
  function updateGroupChatHeader(group) {
    const headerTitle = document.getElementById("chat-panel-name");
    const headerAvatar = document.getElementById("chat-panel-avatar");
    const deleteBtn = document.getElementById("chat-lobby-delete-char");
    const newChatBtn = document.getElementById("chat-lobby-new-chat");
    if (headerTitle) {
      headerTitle.textContent = group.name || "\uADF8\uB8F9";
    }
    if (headerAvatar) {
      headerAvatar.src = api.getGroupAvatarUrl(group);
      headerAvatar.alt = group.name || "\uADF8\uB8F9";
      headerAvatar.style.display = "block";
    }
    if (deleteBtn) {
      deleteBtn.style.display = "none";
    }
    if (newChatBtn) {
      newChatBtn.style.display = "block";
      newChatBtn.dataset.groupId = group.id;
      newChatBtn.dataset.groupName = group.name || "\uADF8\uB8F9";
      newChatBtn.dataset.isGroup = "true";
      delete newChatBtn.dataset.charIndex;
      delete newChatBtn.dataset.charAvatar;
    }
  }
  function renderGroupChats(container, chats, group) {
    const groupAvatar = `group_${group.id}`;
    const totalChatCount = chats.length;
    updateHasChats(totalChatCount);
    if (chats.length === 0) {
      updateChatCount(0);
      container.innerHTML = `
            <div class="lobby-empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:var(--text-muted,#888);padding:40px;">
                <i>\u{1F4AC}</i>
                <div>\uADF8\uB8F9 \uCC44\uD305\uC774 \uC5C6\uC2B5\uB2C8\uB2E4</div>
            </div>
        `;
      return;
    }
    const filterFolder = storage.getFilterFolder();
    let filteredChats = [...chats];
    if (filterFolder !== "all") {
      filteredChats = filterByFolder(filteredChats, groupAvatar, filterFolder);
    }
    const sortOption = storage.getSortOption();
    filteredChats = sortChats(filteredChats, groupAvatar, sortOption);
    updateChatCount(filteredChats.length);
    if (filteredChats.length === 0) {
      container.innerHTML = `
            <div class="lobby-empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:var(--text-muted,#888);padding:40px;">
                <i>\u{1F4C1}</i>
                <div>\uC774 \uD3F4\uB354\uC5D0\uB294 \uCC44\uD305\uC774 \uC5C6\uC2B5\uB2C8\uB2E4</div>
            </div>
        `;
      return;
    }
    let html = "";
    for (const chat of filteredChats) {
      const fileName = chat.file_name || "";
      const displayName = formatGroupChatName(fileName);
      const lastMes = chat.last_mes ? formatDate(chat.last_mes) : "";
      const mesCount = chat.chat_items || 0;
      const preview = chat.mes || chat.preview || chat.last_message || "\uCC44\uD305 \uAE30\uB85D";
      const safePreview = preview ? btoa(unescape(encodeURIComponent(preview))) : "";
      const isFav = storage.isFavorite(groupAvatar, fileName);
      const folderId = storage.getChatFolder(groupAvatar, fileName);
      const data = storage.load();
      const folder = data.folders.find((f) => f.id === folderId);
      const folderName = folder?.name || "";
      html += `
        <div class="lobby-chat-item ${isFav ? "is-favorite" : ""}" 
             data-group-id="${escapeHtml(group.id)}"
             data-chat-file="${escapeHtml(fileName)}"
             data-folder-id="${folderId}"
             data-full-preview-encoded="${safePreview}">
            <button class="chat-fav-btn" title="\uC990\uACA8\uCC3E\uAE30">${isFav ? "\u2605" : "\u2606"}</button>
            <div class="chat-content">
                <div class="chat-name">${escapeHtml(displayName)}</div>
                <div class="chat-preview">${escapeHtml(truncateText(preview, 80))}</div>
                <div class="chat-meta">
                    ${mesCount > 0 ? `<span>\u{1F4AC} ${mesCount}\uAC1C</span>` : ""}
                    ${lastMes ? `<span>\u{1F550} ${lastMes}</span>` : ""}
                    ${folderName && folderId !== "uncategorized" ? `<span class="chat-folder-tag">${escapeHtml(folderName)}</span>` : ""}
                </div>
            </div>
            <button class="chat-delete-btn" title="\uCC44\uD305 \uC0AD\uC81C">\u{1F5D1}\uFE0F</button>
        </div>
        `;
    }
    container.innerHTML = html || `
        <div class="lobby-empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:var(--text-muted,#888);padding:40px;">
            <i>\u{1F4AC}</i>
            <div>\uADF8\uB8F9 \uCC44\uD305\uC774 \uC5C6\uC2B5\uB2C8\uB2E4</div>
        </div>
    `;
    bindGroupChatEvents(container, group);
  }
  function formatGroupChatName(fileName) {
    let name = fileName.replace(".jsonl", "");
    const dateMatch = name.match(/(\d{4}-\d{2}-\d{2})@(\d{2})h(\d{2})m(\d{2})s/);
    if (dateMatch) {
      const [, date, hour, min] = dateMatch;
      return `${date} ${hour}:${min}`;
    }
    return name;
  }
  function bindGroupChatEvents(container, group) {
    const groupAvatar = `group_${group.id}`;
    container.querySelectorAll(".lobby-chat-item").forEach((item, index) => {
      const chatContent = item.querySelector(".chat-content");
      const favBtn = item.querySelector(".chat-fav-btn");
      const delBtn = item.querySelector(".chat-delete-btn");
      const chatFile = item.dataset.chatFile;
      if (!chatContent || !chatFile) return;
      if (favBtn) {
        createTouchClickHandler(favBtn, () => {
          const isNowFav = storage.toggleFavorite(groupAvatar, chatFile);
          favBtn.textContent = isNowFav ? "\u2605" : "\u2606";
          item.classList.toggle("is-favorite", isNowFav);
        }, { debugName: `group-fav-${index}` });
      }
      createTouchClickHandler(chatContent, async () => {
        const onOpenGroup = store.chatHandlers?.onOpenGroup;
        if (typeof onOpenGroup !== "function") {
          console.error("[ChatList] onOpenGroup handler not set");
          return;
        }
        store.setCurrentGroup(null);
        store.setCurrentCharacter(null);
        await onOpenGroup(group.id, chatFile);
      }, { preventDefault: true, stopPropagation: true, debugName: `group-chat-${index}` });
      if (delBtn) {
        createTouchClickHandler(delBtn, async () => {
          const confirmed = await showConfirm(`"${formatGroupChatName(chatFile)}" \uCC44\uD305\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?`);
          if (!confirmed) return;
          try {
            const success = await api.deleteGroupChat(group.id, chatFile);
            if (success) {
              item.remove();
              showToast("\uCC44\uD305\uC774 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.", "success");
              const remaining = container.querySelectorAll(".lobby-chat-item").length;
              updateChatCount(remaining);
              if (remaining === 0) {
                container.innerHTML = `
                                <div class="lobby-empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:var(--text-muted,#888);padding:40px;">
                                    <i>\u{1F4AC}</i>
                                    <div>\uADF8\uB8F9 \uCC44\uD305\uC774 \uC5C6\uC2B5\uB2C8\uB2E4</div>
                                </div>
                            `;
              }
            } else {
              showToast("\uCC44\uD305 \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", "error");
            }
          } catch (error) {
            console.error("[ChatList] Failed to delete group chat:", error);
            showToast("\uCC44\uD305 \uC0AD\uC81C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.", "error");
          }
        }, { preventDefault: true, stopPropagation: true, debugName: `group-del-${index}` });
      }
    });
  }
  function updatePersonaQuickButton(charAvatar) {
    console.debug("[ChatList] updatePersonaQuickButton called:", charAvatar);
    const btn = document.getElementById("chat-lobby-persona-quick");
    const img = btn ? btn.querySelector(".persona-quick-avatar") : null;
    console.debug("[ChatList] Button found:", !!btn, "Image found:", !!img);
    if (!btn || !img) return;
    const lastPersona = window._chatLobbyLastChatCache ? window._chatLobbyLastChatCache.getPersona(charAvatar) : null;
    if (lastPersona) {
      img.src = "/User Avatars/" + encodeURIComponent(lastPersona);
      img.alt = lastPersona.replace(/\.[^/.]+$/, "");
      btn.dataset.persona = lastPersona;
      btn.dataset.charAvatar = charAvatar;
      btn.title = "\uD398\uB974\uC18C\uB098 \uC804\uD658: " + img.alt;
      btn.style.display = "flex";
    } else {
      btn.style.display = "none";
    }
  }
  function hidePersonaQuickButton() {
    const btn = document.getElementById("chat-lobby-persona-quick");
    if (btn) btn.style.display = "none";
  }

  // src/handlers/chatHandlers.js
  init_notifications();
  async function openChat(chatInfo) {
    const token = operationLock.acquire("openChat", 15e3);
    if (!token) return;
    const { fileName, charAvatar, charIndex } = chatInfo;
    console.debug("[ChatHandlers] openChat called:", { fileName, charAvatar, charIndex });
    try {
      if (!charAvatar || !fileName) {
        console.error("[ChatHandlers] Missing chat data");
        showToast("\uCC44\uD305 \uC815\uBCF4\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.", "error");
        return;
      }
      const context = api.getContext();
      const characters = context?.characters || [];
      const index = characters.findIndex((c) => c.avatar === charAvatar);
      console.debug("[ChatHandlers] Character index:", index);
      if (index === -1) {
        console.error("[ChatHandlers] Character not found");
        showToast("\uCE90\uB9AD\uD130\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", "error");
        return;
      }
      const chatFileName = fileName.replace(".jsonl", "");
      const currentChar = context.characters?.[context.characterId];
      const isSameCharacter = currentChar?.avatar === charAvatar;
      if (!isSameCharacter) {
        console.debug("[ChatHandlers] Different character, selecting...");
        const result = await switchCharacter(index, charAvatar, { chatPointer: chatFileName, token });
        if (result === "stale") {
          console.warn("[ChatHandlers] openChat became stale, aborting");
          return;
        }
        if (result === "failed") {
          showToast("\uCE90\uB9AD\uD130 \uC120\uD0DD\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", "error");
          return;
        }
      } else {
        console.debug("[ChatHandlers] Same character already selected, skipping selectCharacterById");
      }
      closeLobbyKeepState();
      const ctxAfter = api.getContext();
      const loadedChat = ctxAfter?.characters?.[ctxAfter.characterId]?.chat;
      if (!isSameCharacter && loadedChat === chatFileName) {
        console.debug("[ChatHandlers] Target chat loaded directly (single load)");
        const loadedChar = ctxAfter.characters[ctxAfter.characterId];
        api.saveLastChatPointer(loadedChar.avatar, loadedChar.name, chatFileName);
        return;
      }
      if (!isSameCharacter) {
        console.warn("[ChatHandlers] Direct load missed (loaded:", loadedChat, "), opening target chat again");
      }
      console.debug("[ChatHandlers] Opening chat:", chatFileName);
      if (typeof context?.openCharacterChat === "function") {
        try {
          const openChatChangedPromise = waitForChatChanged(5e3);
          await context.openCharacterChat(chatFileName);
          await openChatChangedPromise;
          console.debug("[ChatHandlers] Chat opened and CHAT_CHANGED confirmed");
          return;
        } catch (err) {
          console.warn("[ChatHandlers] context.openCharacterChat failed:", err);
        }
      }
      console.debug("[ChatHandlers] Using fallback method...");
      await openChatByFileName(fileName);
    } catch (error) {
      console.error("[ChatHandlers] Failed to open chat:", error);
      showToast("\uCC44\uD305\uC744 \uC5F4\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "error");
    } finally {
      operationLock.release(token);
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
    let token = null;
    if (!fileName || !charAvatar) {
      console.error("[ChatHandlers] Missing chat data for delete");
      showToast("\uC0AD\uC81C\uD560 \uCC44\uD305 \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.", "error");
      return;
    }
    const context = api.getContext();
    const currentChatFile = context?.characters?.[context?.characterId]?.chat;
    const fileNameWithoutExt = fileName.replace(".jsonl", "");
    if (currentChatFile === fileNameWithoutExt) {
      showToast("\uD604\uC7AC \uC5F4\uB9B0 \uCC44\uD305\uC740 \uC0AD\uC81C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.\n\uB2E4\uB978 \uCC44\uD305\uC73C\uB85C \uC774\uB3D9 \uD6C4 \uC0AD\uC81C\uD574\uC8FC\uC138\uC694.", "warning");
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
    token = operationLock.acquire("deleteChat", 1e4);
    if (!token) {
      showToast("\uB2E4\uB978 \uC791\uC5C5\uC774 \uC9C4\uD589 \uC911\uC785\uB2C8\uB2E4.", "warning");
      return;
    }
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
        api.repointLastChatAfterDelete(charAvatar, [fileName]);
        if (element) {
          element.style.transition = "opacity 0.2s, transform 0.2s";
          element.style.opacity = "0";
          element.style.transform = "translateX(20px)";
          setTimeout(() => {
            if (element?.parentNode) {
              element.remove();
            }
            updateChatCountAfterDelete();
          }, 200);
        }
        showToast("\uCC44\uD305\uC774 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.", "success");
      } else {
        showToast("\uCC44\uD305 \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", "error");
      }
    } catch (error) {
      console.error("[ChatHandlers] Error deleting chat:", error);
      showToast("\uCC44\uD305 \uC0AD\uC81C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.", "error");
    } finally {
      operationLock.release(token);
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
                <div class="lobby-empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:var(--text-muted,#888);padding:40px;">
                    <i>\u{1F4AC}</i>
                    <div>\uCC44\uD305 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4</div>
                </div>
            `;
      }
    }
  }
  function isCharacterSelected(charIndexNum, charAvatar) {
    const ctx = api.getContext();
    return String(ctx?.characterId) === String(charIndexNum) && ctx?.characters?.[ctx.characterId]?.avatar === charAvatar;
  }
  async function switchCharacter(charIndexNum, charAvatar, { chatPointer = null, token = null } = {}) {
    const context = api.getContext();
    if (context?.characters?.[charIndexNum]?.avatar !== charAvatar) return "failed";
    if (typeof chatPointer === "string" && context.characters[charIndexNum].shallow && typeof context.unshallowCharacter === "function") {
      try {
        await context.unshallowCharacter(charIndexNum);
      } catch (e) {
        console.warn("[ChatHandlers] unshallowCharacter failed:", e);
      }
      if (token !== null && !operationLock.isCurrent(token)) return "stale";
    }
    const targetChar = api.getContext()?.characters?.[charIndexNum];
    if (!targetChar || targetChar.avatar !== charAvatar) return "failed";
    const originalPointer = targetChar.chat;
    const pointerChanged = typeof chatPointer === "string" && typeof originalPointer === "string" && chatPointer !== originalPointer;
    if (pointerChanged) {
      targetChar.chat = chatPointer;
    }
    const restoreIfNotSwitched = () => {
      if (pointerChanged && !isCharacterSelected(charIndexNum, charAvatar) && targetChar.chat === chatPointer) {
        targetChar.chat = originalPointer;
        console.warn("[ChatHandlers] Switch did not happen, restored chat pointer:", originalPointer);
      }
    };
    try {
      const chatChangedPromise = waitForChatChanged(5e3);
      await api.selectCharacterById(charIndexNum);
      const chatChanged = await chatChangedPromise;
      if (!chatChanged) {
        const selected = await waitForCharacterSelect(charAvatar, 2e3);
        if (!selected) {
          restoreIfNotSwitched();
          return "failed";
        }
      }
    } catch (error) {
      console.error("[ChatHandlers] selectCharacterById failed:", error);
      restoreIfNotSwitched();
      return "failed";
    }
    if (token !== null && !operationLock.isCurrent(token)) return "stale";
    await new Promise((r) => setTimeout(r, 300));
    return token === null || operationLock.isCurrent(token) ? "ok" : "stale";
  }
  async function startNewChat() {
    const token = operationLock.acquire("startNewChat", 15e3);
    if (!token) return;
    try {
      const btn = document.getElementById("chat-lobby-new-chat");
      const isGroup = btn?.dataset.isGroup === "true";
      if (isGroup) {
        await startNewGroupChat(btn, token);
      } else {
        await startNewCharacterChat(btn, token);
      }
    } finally {
      operationLock.release(token);
    }
  }
  function humanizedDateTime(timestamp = Date.now()) {
    const d = new Date(timestamp);
    const p = (n, len = 2) => String(n).padStart(len, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}@${p(d.getHours())}h${p(d.getMinutes())}m${p(d.getSeconds())}s${p(d.getMilliseconds(), 3)}ms`;
  }
  async function startNewCharacterChat(btn, token = null) {
    const charIndex = btn?.dataset.charIndex;
    const charAvatar = btn?.dataset.charAvatar;
    const charIndexNum = parseInt(charIndex, 10);
    if (!charAvatar || isNaN(charIndexNum) || charIndexNum < 0) {
      console.error("[ChatHandlers] No character selected or invalid index");
      showToast("\uCE90\uB9AD\uD130\uAC00 \uC120\uD0DD\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.", "error");
      return;
    }
    try {
      closeLobbyKeepState();
      const context = api.getContext();
      const currentChar = context?.characters?.[context.characterId];
      const isSameCharacter = currentChar?.avatar === charAvatar;
      cache.invalidate("chats", charAvatar);
      cache.invalidate("chatCounts", charAvatar);
      if (isSameCharacter) {
        const newChatBtn = await waitForElement("#option_start_new_chat", 1e3);
        if (newChatBtn) newChatBtn.click();
        return;
      }
      const charName = context?.characters?.[charIndexNum]?.name || "";
      if (!charName) {
        showToast("\uCE90\uB9AD\uD130\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", "error");
        return;
      }
      const newChatName = `${charName} - ${humanizedDateTime()}`;
      const result = await switchCharacter(charIndexNum, charAvatar, { chatPointer: newChatName, token });
      if (result === "stale") {
        console.warn("[ChatHandlers] startNewCharacterChat became stale, aborting");
        return;
      }
      if (result === "failed") {
        showToast("\uC0C8 \uCC44\uD305\uC744 \uC2DC\uC791\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.", "error");
        return;
      }
      const ctxAfter = api.getContext();
      const loadedChar = ctxAfter?.characters?.[ctxAfter.characterId];
      if (loadedChar?.avatar === charAvatar && loadedChar.chat === newChatName) {
        console.debug("[ChatHandlers] New chat created directly (single load):", newChatName);
        api.saveLastChatPointer(loadedChar.avatar, loadedChar.name, newChatName);
      } else {
        console.warn("[ChatHandlers] New chat pointer was not kept (loaded:", loadedChar?.chat, ")");
      }
    } catch (error) {
      console.error("[ChatHandlers] Failed to start new chat:", error);
      showToast("\uC0C8 \uCC44\uD305\uC744 \uC2DC\uC791\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "error");
    }
  }
  async function startNewGroupChat(btn, token = null) {
    const groupId = btn?.dataset.groupId;
    if (!groupId) {
      console.error("[ChatHandlers] No group selected");
      showToast("\uADF8\uB8F9\uC774 \uC120\uD0DD\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.", "error");
      return;
    }
    try {
      closeLobbyKeepState();
      cache.invalidate("groups");
      if (api.getContext()?.groupId === groupId) {
        const newChatBtn = await waitForElement("#option_start_new_chat", 1e3);
        if (newChatBtn) newChatBtn.click();
        return;
      }
      const newChatId = humanizedDateTime();
      const result = await switchGroup(groupId, newChatId, { token, isNew: true });
      if (result === "failed") {
        showToast("\uADF8\uB8F9 \uC0C8 \uCC44\uD305\uC744 \uC2DC\uC791\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "error");
        return;
      }
      if (result === "ok") {
        const group = api.getContext()?.groups?.find((g) => g.id === groupId);
        if (group) api.saveGroup(group);
      }
    } catch (error) {
      console.error("[ChatHandlers] Failed to start new group chat:", error);
      showToast("\uADF8\uB8F9 \uC0C8 \uCC44\uD305\uC744 \uC2DC\uC791\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "error");
    }
  }
  async function selectGroupNative(groupId) {
    try {
      const groupChats = await import("../../../../group-chats.js");
      if (typeof groupChats.openGroupById === "function") {
        const opened = await groupChats.openGroupById(groupId);
        return opened === false ? "refused" : "started";
      }
    } catch (e) {
      console.debug("[ChatHandlers] group-chats module not available, using UI click:", e);
    }
    const card = document.querySelector(`.group_select[data-grid="${CSS.escape(groupId)}"]`);
    if (!card) return "unavailable";
    if (window.$) {
      window.$(card).trigger("click");
    } else {
      card.click();
    }
    return "started";
  }
  async function switchGroup(groupId, chatId = null, { token = null, isNew = false } = {}) {
    const group = api.getContext()?.groups?.find((g) => g.id === groupId);
    if (!group || !Array.isArray(group.chats)) return "failed";
    const originalChatId = group.chat_id;
    const originalChats = [...group.chats];
    if (chatId) {
      if (isNew && !group.chats.includes(chatId)) group.chats.push(chatId);
      if (!group.chats.includes(chatId)) return "failed";
      group.chat_id = chatId;
    }
    const restoreIfNotSwitched = () => {
      if (!chatId || api.getContext()?.groupId === groupId) return;
      if (group.chat_id === chatId) group.chat_id = originalChatId;
      group.chats.splice(0, group.chats.length, ...originalChats);
      console.warn("[ChatHandlers] Group switch did not happen, restored chat pointer:", originalChatId);
    };
    try {
      const chatChangedPromise = waitForChatChanged(8e3);
      const started = await selectGroupNative(groupId);
      if (started !== "started") {
        restoreIfNotSwitched();
        return "failed";
      }
      await chatChangedPromise;
      if (api.getContext()?.groupId !== groupId) {
        restoreIfNotSwitched();
        return "failed";
      }
    } catch (error) {
      console.error("[ChatHandlers] Group switch failed:", error);
      restoreIfNotSwitched();
      return "failed";
    }
    if (token !== null && !operationLock.isCurrent(token)) return "stale";
    return "ok";
  }
  async function openGroupChat(groupId, chatFile) {
    const token = operationLock.acquire("openGroupChat", 2e4);
    if (!token) return;
    try {
      const chatId = String(chatFile || "").replace(/\.jsonl$/i, "");
      if (!groupId || !chatId) {
        showToast("\uCC44\uD305 \uC815\uBCF4\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.", "error");
        return;
      }
      closeLobbyKeepState();
      const context = api.getContext();
      if (context?.groupId === groupId) {
        if (context.chatId !== chatId && typeof context.openGroupChat === "function") {
          const chatChangedPromise = waitForChatChanged(8e3);
          await context.openGroupChat(groupId, chatId);
          await chatChangedPromise;
        }
        return;
      }
      const result = await switchGroup(groupId, chatId, { token });
      if (result === "failed") {
        showToast("\uADF8\uB8F9 \uCC44\uD305\uC744 \uC5F4\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "error");
        return;
      }
      if (result === "ok") {
        const group = api.getContext()?.groups?.find((g) => g.id === groupId);
        if (group) {
          group.date_last_chat = Date.now();
          api.saveGroup(group);
        }
      }
    } catch (error) {
      console.error("[ChatHandlers] Failed to open group chat:", error);
      showToast("\uADF8\uB8F9 \uCC44\uD305\uC744 \uC5F4\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "error");
    } finally {
      operationLock.release(token);
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
    const token = operationLock.acquire("deleteCharacter", 2e4);
    if (!token) {
      showToast("\uB2E4\uB978 \uC791\uC5C5\uC774 \uC9C4\uD589 \uC911\uC785\uB2C8\uB2E4.", "warning");
      return;
    }
    try {
      const data = storage.load();
      const prefix = char.avatar + "::";
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
    } finally {
      operationLock.release(token);
    }
  }
  function closeLobbyKeepState() {
    const overlay = document.getElementById("chat-lobby-overlay");
    const container = document.getElementById("chat-lobby-container");
    const fab = document.getElementById("chat-lobby-fab");
    if (overlay) overlay.style.display = "none";
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
    startRecentDomObserver();
  }

  // src/ui/tabView.js
  var DEBUG = false;
  function log(...args) {
    if (DEBUG) console.debug("[TabView]", ...args);
  }
  function logError(...args) {
    console.error("[TabView]", ...args);
  }
  var state = {
    currentTab: "characters",
    recentChats: [],
    cachedRecentChats: [],
    // 로비 열기 전 캐싱된 최근 채팅
    libraryMode: "favorites",
    currentFolderId: null,
    libraryChats: [],
    folders: [],
    activeContextMenu: null,
    libraryBatchMode: false
    // 보관함 배치 모드
  };
  var loading = {
    characters: false,
    recent: false,
    library: false
  };
  var contextMenuCloseHandler = null;
  var recentDomObserver = null;
  var TABS = [
    { id: "characters", icon: "\u{1F465}", name: "\uCE90\uB9AD\uD130" },
    { id: "recent", icon: "\u{1F550}", name: "\uCD5C\uADFC" },
    { id: "library", icon: "\u{1F4DA}", name: "\uBCF4\uAD00\uD568" }
  ];
  var MAX_CACHE_RETRIES = 5;
  var CACHE_RETRY_DELAY = 100;
  async function cacheRecentChatsBeforeOpen() {
    const previousCache = [...state.cachedRecentChats];
    state.cachedRecentChats = [];
    const context = api.getContext();
    if (context?.characterId !== void 0 && context.characterId >= 0) {
      const char = context.characters?.[context.characterId];
      if (char?.avatar) {
        state.cachedRecentChats.push({
          file: char.chat || "",
          avatar: char.avatar,
          isGroup: false,
          characterName: char.name || char.avatar.replace(/\.[^.]+$/, ""),
          chatName: char.chat || "",
          date: "\uBC29\uAE08",
          preview: "",
          messageCount: char.chat_size || 0,
          thumbnailSrc: charAvatarUrl(char.avatar),
          type: "char",
          lastChatTime: Date.now()
        });
        log("Added current character to cache:", char.avatar);
      }
    }
    const chatOpen = context?.characterId !== void 0 && context.characterId !== null && Number(context.characterId) >= 0 || !!context?.groupId;
    const maxRetries = chatOpen ? 1 : MAX_CACHE_RETRIES;
    for (let retry = 0; retry < maxRetries; retry++) {
      const recentChatElements = document.querySelectorAll(".recentChat");
      if (recentChatElements.length > 0) {
        log(`Found ${recentChatElements.length} .recentChat elements (retry ${retry})`);
        cacheElements(recentChatElements);
        return;
      }
      if (retry + 1 < maxRetries) {
        log(`No .recentChat found, retry ${retry + 1}/${maxRetries} in ${CACHE_RETRY_DELAY}ms`);
        await new Promise((r) => setTimeout(r, CACHE_RETRY_DELAY));
      }
    }
    if (previousCache.length > 0) {
      log("Restoring previous cache:", previousCache.length);
      state.cachedRecentChats = previousCache;
    } else {
      log("No previous cache, will use lastChatCache fallback");
    }
  }
  function cacheElements(recentChatElements) {
    const existingKeys = new Set(
      state.cachedRecentChats.map((c) => `${c.avatar}_${c.file}`)
    );
    recentChatElements.forEach((el, idx) => {
      try {
        const file = el.getAttribute("data-file") || "";
        const avatar = el.getAttribute("data-avatar") || "";
        if (existingKeys.has(`${avatar}_${file}`)) return;
        const groupAttr = el.getAttribute("data-group");
        const isGroup = groupAttr !== null && groupAttr !== "";
        const characterName = el.querySelector(".characterName")?.textContent?.trim() || "";
        const chatDate = el.querySelector(".chatDate")?.textContent?.trim() || "";
        const chatMessage = el.querySelector(".chatMessage")?.textContent?.trim() || "";
        const counterSmall = el.querySelector(".counterBlock small");
        const messageCount2 = counterSmall?.textContent?.trim() || "0";
        const chatNameSpans = el.querySelectorAll(".chatName span");
        let chatName = file;
        if (chatNameSpans.length >= 2) {
          chatName = chatNameSpans[chatNameSpans.length - 1]?.textContent?.trim() || file;
        }
        const thumbnailImg = el.querySelector(".avatar img");
        const thumbnailSrc = thumbnailImg?.getAttribute("src") || "";
        if (avatar || file) {
          state.cachedRecentChats.push({
            file,
            avatar,
            isGroup,
            // ST의 recentChat은 data-avatar에 그룹 이미지, data-group에 그룹 ID를 넣음
            groupId: isGroup ? groupAttr : null,
            characterName: characterName || avatar.replace(/\.[^.]+$/, ""),
            chatName,
            date: chatDate,
            preview: chatMessage,
            messageCount: parseInt(messageCount2) || 0,
            thumbnailSrc,
            type: isGroup ? "group" : "char"
          });
        }
      } catch (e) {
        logError(`Error caching recentChat #${idx}:`, e);
      }
    });
    log(`Cached ${state.cachedRecentChats.length} recent chats`);
  }
  function createTabBarHTML() {
    return `
        <nav id="chat-lobby-tabs" class="lobby-tabs header-tabs">
            ${TABS.map((tab) => `
                <button class="lobby-tab ${tab.id === "characters" ? "active" : ""}" 
                        data-tab="${tab.id}" 
                        title="${tab.name}">
                    <span class="tab-icon">${tab.icon}</span>
                    <span class="tab-name">${tab.name}</span>
                </button>
            `).join("")}
        </nav>
    `;
  }
  function switchTab(tabId) {
    if (state.currentTab === tabId) return;
    log("Switching tab:", state.currentTab, "->", tabId);
    state.currentTab = tabId;
    deactivateBatchMode();
    state.libraryBatchMode = false;
    document.querySelectorAll(".lobby-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabId);
    });
    const characterSection = document.getElementById("chat-lobby-characters");
    const personaBar = document.getElementById("chat-lobby-persona-bar");
    const searchSection = document.getElementById("chat-lobby-search");
    const tagBar = document.getElementById("chat-lobby-tag-bar");
    const collapseBtn = document.getElementById("chat-lobby-collapse-btn");
    const heroCorner = document.getElementById("chat-lobby-hero");
    if (tabId === "characters") {
      [characterSection, personaBar, searchSection, tagBar, collapseBtn].forEach((el) => {
        if (el) el.style.display = "";
      });
      hideAllTabContents();
      if (heroCorner) {
        heroCorner.style.display = heroCorner.dataset.hasContent === "true" ? "" : "none";
      }
    } else {
      [characterSection, personaBar, searchSection, tagBar, collapseBtn].forEach((el) => {
        if (el) el.style.display = "none";
      });
      if (heroCorner) heroCorner.style.display = "none";
      showTabContent(tabId);
    }
    closeContextMenu();
  }
  function hideAllTabContents() {
    document.querySelectorAll(".tab-content").forEach((el) => {
      el.style.display = "none";
    });
  }
  function showTabContent(tabId) {
    hideAllTabContents();
    let container = document.querySelector(`.tab-content[data-tab="${tabId}"]`);
    if (!container) {
      container = createTabContentContainer(tabId);
    }
    if (container) {
      container.style.display = "flex";
      loadTabData(tabId);
    }
  }
  function createTabContentContainer(tabId) {
    const leftPanel = document.getElementById("chat-lobby-left");
    if (!leftPanel) return null;
    const container = document.createElement("div");
    container.className = "tab-content";
    container.dataset.tab = tabId;
    container.innerHTML = `<div class="tab-loading">\u23F3 \uB85C\uB529 \uC911...</div>`;
    leftPanel.appendChild(container);
    return container;
  }
  async function loadTabData(tabId) {
    if (tabId === "characters") return;
    if (loading[tabId]) return;
    loading[tabId] = true;
    try {
      switch (tabId) {
        case "recent":
          loadRecentChats();
          renderRecentView();
          break;
        case "library":
          await loadLibrary();
          renderLibraryView();
          break;
      }
    } catch (e) {
      logError(`Failed to load ${tabId}:`, e);
      showToast("\uB370\uC774\uD130 \uB85C\uB4DC \uC2E4\uD328", "error");
    } finally {
      loading[tabId] = false;
    }
  }
  function loadRecentChats() {
    if (state.cachedRecentChats.length > 0) {
      state.recentChats = state.cachedRecentChats;
      log(`Using ${state.recentChats.length} cached recent chats`);
    } else {
      log("No cached chats, trying to re-cache from DOM");
      const recentChatElements = document.querySelectorAll(".recentChat");
      if (recentChatElements.length > 0) {
        cacheElements(recentChatElements);
        state.recentChats = state.cachedRecentChats;
        log(`Re-cached ${state.recentChats.length} recent chats from DOM`);
      } else {
        log("No .recentChat elements, using lastChatCache fallback");
        state.recentChats = getRecentFromCache();
      }
    }
  }
  function getRecentFromCache() {
    const recentFromCache = [];
    const context = api.getContext();
    const characters = context?.characters || [];
    const groups = context?.groups || [];
    lastChatCache.lastChatTimes.forEach((entry, avatar) => {
      const time = typeof entry === "number" ? entry : entry?.time || 0;
      const char = characters.find((c) => c.avatar === avatar);
      if (char) {
        let dateStr = "";
        if (time > 0) {
          const date = new Date(time);
          const now = /* @__PURE__ */ new Date();
          const diffMs = now - date;
          const diffDays = Math.floor(diffMs / (1e3 * 60 * 60 * 24));
          if (diffDays === 0) {
            dateStr = date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
          } else if (diffDays === 1) {
            dateStr = "\uC5B4\uC81C";
          } else if (diffDays < 7) {
            dateStr = `${diffDays}\uC77C \uC804`;
          } else {
            dateStr = date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
          }
        }
        recentFromCache.push({
          avatar,
          characterName: char.name || avatar.replace(/\.[^.]+$/, ""),
          chatName: char.chat || "",
          date: dateStr,
          preview: "",
          messageCount: char.chat_size || 0,
          lastChatTime: time,
          type: "char",
          isGroup: false,
          file: char.chat || "",
          thumbnailSrc: charAvatarUrl(avatar)
        });
      }
    });
    groups.forEach((group) => {
      if (group.date_last_chat) {
        const time = new Date(group.date_last_chat).getTime();
        if (time > 0) {
          recentFromCache.push({
            avatar: group.id,
            characterName: group.name || group.id,
            chatName: group.chat_id || "",
            date: "",
            preview: "",
            messageCount: 0,
            lastChatTime: time,
            type: "group",
            isGroup: true,
            file: group.chat_id || "",
            thumbnailSrc: ""
          });
        }
      }
    });
    recentFromCache.sort((a, b) => b.lastChatTime - a.lastChatTime);
    return recentFromCache.slice(0, 30);
  }
  function renderRecentView() {
    const container = document.querySelector('.tab-content[data-tab="recent"]');
    if (!container) return;
    if (state.recentChats.length === 0) {
      container.innerHTML = `
            <div class="tab-empty">
                <span class="empty-icon">\u{1F550}</span>
                <p>\uCD5C\uADFC \uCC44\uD305 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4</p>
                <small>\uCE90\uB9AD\uD130\uC640 \uB300\uD654\uB97C \uC2DC\uC791\uD574\uBCF4\uC138\uC694</small>
            </div>
        `;
      return;
    }
    container.innerHTML = `
        <div class="tab-header">
            <h3>\u{1F550} \uCD5C\uADFC \uCC44\uD305 (${state.recentChats.length})</h3>
        </div>
        <div class="tab-chat-list" id="tab-recent-list"></div>
    `;
    const listEl = container.querySelector("#tab-recent-list");
    state.recentChats.forEach((chat, idx) => {
      const item = createChatItem(chat, idx, "recent");
      listEl.appendChild(item);
    });
  }
  async function loadLibrary() {
    log("Loading library...");
    const data = storage.load();
    const context = api.getContext();
    const characters = context?.characters || [];
    const groups = context?.groups || [];
    state.folders = [...data.folders || []].filter((f) => f.id !== "favorites" && f.id !== "uncategorized").sort((a, b) => (a.order || 0) - (b.order || 0));
    const assignments = data.chatAssignments || {};
    state.folders = state.folders.map((folder) => {
      let count = 0;
      for (const folderId of Object.values(assignments)) {
        if (folderId === folder.id) count++;
      }
      return { ...folder, chatCount: count };
    });
    log(`Loaded ${state.folders.length} folders (excluding favorites)`);
    state.libraryChats = [];
    let keysToLoad = [];
    if (state.libraryMode === "reminds") {
      return;
    }
    if (state.libraryMode === "favorites") {
      keysToLoad = data.favorites || [];
      log(`Loading ${keysToLoad.length} favorites`);
    } else if (state.currentFolderId) {
      log(`Loading chats for folder: ${state.currentFolderId}`);
      for (const [key, folderId] of Object.entries(assignments)) {
        if (folderId === state.currentFolderId) {
          keysToLoad.push(key);
        }
      }
    }
    const chatsByAvatar = /* @__PURE__ */ new Map();
    for (const key of keysToLoad) {
      const parsed = parseKeyBasic(key);
      log(`parseKeyBasic("${key}") =>`, parsed);
      if (parsed) {
        if (!chatsByAvatar.has(parsed.avatar)) {
          chatsByAvatar.set(parsed.avatar, []);
        }
        chatsByAvatar.get(parsed.avatar).push({ key, fileName: parsed.fileName });
      }
    }
    log(`chatsByAvatar: ${chatsByAvatar.size} avatars`);
    await Promise.allSettled(
      [...chatsByAvatar.entries()].map(async ([avatar, chats]) => {
        try {
          const apiChats = await api.fetchChatsForCharacter(avatar);
          const entityInfo = characters.find((c) => c.avatar === avatar);
          const name = entityInfo?.name || avatar.replace(/\.[^.]+$/, "");
          for (const { key, fileName } of chats) {
            const apiChat = apiChats.find((c) => {
              const apiName = c.file_name || "";
              return apiName === fileName || apiName === `${fileName}.jsonl` || apiName.replace(/\.jsonl$/i, "") === fileName;
            });
            const cachedTime = lastChatCache.lastChatTimes.get(avatar);
            const lastChatTime = typeof cachedTime === "number" ? cachedTime : cachedTime?.time || 0;
            state.libraryChats.push({
              key,
              avatar,
              fileName,
              file: fileName,
              characterName: name,
              name,
              type: "char",
              isGroup: false,
              lastChatTime,
              preview: apiChat?.mes || apiChat?.preview || "",
              messageCount: apiChat?.chat_items || 0,
              isFavorite: storage.isFavorite(avatar, fileName),
              folderId: storage.getChatFolder(avatar, fileName)
            });
          }
        } catch (e) {
          logError(`Failed to fetch chats for ${avatar}:`, e);
        }
      })
    );
    state.libraryChats.sort((a, b) => b.lastChatTime - a.lastChatTime);
    log(`Loaded ${state.libraryChats.length} library chats`);
  }
  function parseKeyBasic(key) {
    const sepIdx = key.indexOf("::");
    if (sepIdx === -1) return null;
    const avatar = key.substring(0, sepIdx);
    const fileName = key.substring(sepIdx + 2);
    if (!avatar || !fileName) return null;
    if (avatar.startsWith("group:")) return null;
    return { avatar, fileName };
  }
  function renderLibraryView() {
    const container = document.querySelector('.tab-content[data-tab="library"]');
    if (!container) return;
    if (state.currentFolderId) {
      renderFolderDetail(container);
      return;
    }
    container.innerHTML = `
        <div class="library-filter-bar">
            <button class="library-filter-btn ${state.libraryMode === "favorites" ? "active" : ""}"
                    data-mode="favorites">
                \u2B50 \uC990\uACA8\uCC3E\uAE30
            </button>
            <button class="library-filter-btn ${state.libraryMode === "folders" ? "active" : ""}"
                    data-mode="folders">
                \u{1F4C1} \uD3F4\uB354
            </button>
            <button class="library-filter-btn ${state.libraryMode === "reminds" ? "active" : ""}"
                    data-mode="reminds">
                \u{1F516} \uB9AC\uB9C8\uC778\uB4DC
            </button>
            <button class="library-filter-btn folder-manage-btn" id="tab-folder-manage-btn" data-action="open-folder-modal" title="\uD3F4\uB354 \uAD00\uB9AC">
                \u{1F4C1}
            </button>
            ${state.libraryMode === "favorites" && state.libraryChats.length > 0 ? `
                <button class="library-filter-btn library-batch-btn ${state.libraryBatchMode ? "active" : ""}" id="library-batch-toggle" title="\uBC30\uCE58 \uBAA8\uB4DC">\u2611\uFE0F</button>
            ` : ""}
        </div>
        ${state.libraryBatchMode ? `
            <div class="library-batch-toolbar">
                <span class="library-batch-count">0\uAC1C \uC120\uD0DD</span>
                <button class="library-batch-btn-action" id="library-batch-select-all">\u2611 \uC804\uCCB4</button>
                <button class="library-batch-btn-action library-batch-delete" id="library-batch-delete">\u{1F5D1}\uFE0F \uC0AD\uC81C</button>
                <button class="library-batch-btn-action library-batch-move" id="library-batch-move">\u{1F4C1} \uC774\uB3D9</button>
                <button class="library-batch-btn-action library-batch-cancel" id="library-batch-cancel">\uCDE8\uC18C</button>
            </div>
        ` : ""}
        <div class="library-content" id="library-content">
            ${state.libraryMode === "reminds" ? renderRemindsContent() : state.libraryMode === "favorites" ? renderFavoritesContent() : renderFoldersContent()}
        </div>
    `;
    container.querySelectorAll(".library-filter-btn[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode;
        if (mode && state.libraryMode !== mode) {
          state.libraryMode = mode;
          state.currentFolderId = null;
          state.libraryBatchMode = false;
          loadLibrary().then(() => renderLibraryView());
        }
      });
    });
    container.querySelectorAll(".folder-card").forEach((card) => {
      card.addEventListener("click", () => {
        state.currentFolderId = card.dataset.folderId;
        loadLibrary().then(() => renderLibraryView());
      });
    });
    container.querySelector("#tab-folder-manage-btn")?.addEventListener("click", () => {
      const event = new CustomEvent("lobby:open-folder-modal");
      document.dispatchEvent(event);
    });
    container.querySelector("#library-batch-toggle")?.addEventListener("click", () => {
      state.libraryBatchMode = !state.libraryBatchMode;
      renderLibraryView();
    });
    container.querySelector("#library-batch-select-all")?.addEventListener("click", libraryBatchSelectAll);
    container.querySelector("#library-batch-delete")?.addEventListener("click", libraryBatchDelete);
    container.querySelector("#library-batch-move")?.addEventListener("click", () => libraryBatchShowMoveMenu(container.querySelector("#library-batch-move")));
    container.querySelector("#library-batch-cancel")?.addEventListener("click", () => {
      state.libraryBatchMode = false;
      renderLibraryView();
    });
    if (state.libraryMode === "reminds") {
      bindRemindEvents(container);
    } else {
      bindLibraryChatEvents(container);
    }
  }
  function renderRemindsContent() {
    const reminds = remindStore.getAll();
    if (reminds.length === 0) {
      return `
            <div class="tab-empty">
                <span class="empty-icon">\u{1F516}</span>
                <p>\uC800\uC7A5\uB41C \uB9AC\uB9C8\uC778\uB4DC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4</p>
                <small>\uCC44\uD305 \uBAA9\uB85D\uC758 \u22EE \uBA54\uB274\uC5D0\uC11C "\uB9AC\uB9C8\uC778\uB4DC \uCD94\uAC00"\uB85C<br>\uC88B\uC558\uB358 \uAD6C\uAC04\uC744 \uC800\uC7A5\uD574\uBCF4\uC138\uC694</small>
            </div>
        `;
    }
    return `
        <div class="remind-list">
            ${reminds.map((r) => {
      const rangeText = r.start !== null ? `#${r.start}~#${r.end}` : "\uC804\uCCB4";
      const date = new Date(r.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
      return `
                <div class="remind-item" data-remind-id="${escapeHtml(r.id)}">
                    <div class="remind-item-avatar">
                        <img src="${charAvatarUrl(r.avatar)}" alt="" loading="lazy"
                             onerror="this.parentElement.innerHTML='\u{1F516}'">
                    </div>
                    <div class="remind-item-info">
                        <div class="remind-item-title">
                            ${escapeHtml(r.charName)}
                            <span class="remind-item-range">${escapeHtml(rangeText)}</span>
                        </div>
                        <div class="remind-item-file">${escapeHtml(r.fileName)}</div>
                        ${r.note ? `<div class="remind-item-note">${escapeHtml(r.note)}</div>` : ""}
                    </div>
                    <div class="remind-item-side">
                        <span class="remind-item-date">${date}</span>
                        <button class="remind-item-delete" title="\uC0AD\uC81C">\u{1F5D1}\uFE0F</button>
                    </div>
                </div>`;
    }).join("")}
        </div>
    `;
  }
  function bindRemindEvents(container) {
    container.querySelectorAll(".remind-item").forEach((item) => {
      const id = item.dataset.remindId;
      item.querySelector(".remind-item-delete")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        const confirmed = await showConfirm("\uC774 \uB9AC\uB9C8\uC778\uB4DC\uB97C \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?\n(\uCC44\uD305 \uC790\uCCB4\uB294 \uC0AD\uC81C\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4)");
        if (confirmed) {
          remindStore.remove(id);
          showToast("\uB9AC\uB9C8\uC778\uB4DC \uC0AD\uC81C\uB428", "success");
          renderLibraryView();
        }
      });
      item.addEventListener("click", () => {
        openRemindViewer(id);
      });
    });
  }
  function renderFavoritesContent() {
    if (state.libraryChats.length === 0) {
      return `
            <div class="tab-empty">
                <span class="empty-icon">\u2B50</span>
                <p>\uC990\uACA8\uCC3E\uAE30\uD55C \uCC44\uD305\uC774 \uC5C6\uC2B5\uB2C8\uB2E4</p>
                <small>\uCC44\uD305 \uBAA9\uB85D\uC5D0\uC11C \u2606\uB97C \uB20C\uB7EC \uCD94\uAC00\uD558\uC138\uC694</small>
            </div>
        `;
    }
    return `
        <div class="tab-chat-list">
            ${state.libraryChats.map((chat, idx) => createChatItemHTML(chat, idx, "library")).join("")}
        </div>
    `;
  }
  function renderFoldersContent() {
    return `
        ${state.folders.length === 0 ? `
            <div class="tab-empty">
                <span class="empty-icon">\u{1F4C1}</span>
                <p>\uD3F4\uB354\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4</p>
                <small>\uFFFD \uBC84\uD2BC\uC744 \uB20C\uB7EC \uD3F4\uB354\uB97C \uCD94\uAC00\uD558\uC138\uC694</small>
            </div>
        ` : `
            <div class="folder-list">
                ${state.folders.map((folder) => `
                    <div class="folder-card" data-folder-id="${folder.id}">
                        <span class="folder-icon">\u{1F4C1}</span>
                        <div class="folder-info">
                            <span class="folder-name">${escapeHtml(folder.name)}</span>
                            <span class="folder-count">${folder.chatCount}\uAC1C \uCC44\uD305</span>
                        </div>
                        <span class="folder-arrow">\u203A</span>
                    </div>
                `).join("")}
            </div>
        `}
    `;
  }
  function renderFolderDetail(container) {
    const folder = state.folders.find((f) => f.id === state.currentFolderId);
    const folderName = folder?.name || "\uD3F4\uB354";
    container.innerHTML = `
        <div class="tab-header">
            <button class="tab-back-btn">\u2190 \uB4A4\uB85C</button>
            <h3>\u{1F4C1} ${escapeHtml(folderName)} (${state.libraryChats.length})</h3>
            <button class="library-filter-btn folder-manage-btn" id="tab-folder-manage-btn-detail" title="\uD3F4\uB354 \uAD00\uB9AC">\u{1F4C1}</button>
            ${state.libraryChats.length > 0 ? `
                <button class="library-filter-btn library-batch-btn ${state.libraryBatchMode ? "active" : ""}" id="library-batch-toggle-detail" title="\uBC30\uCE58 \uBAA8\uB4DC">\u2611\uFE0F</button>
            ` : ""}
        </div>
        ${state.libraryBatchMode ? `
            <div class="library-batch-toolbar">
                <span class="library-batch-count">0\uAC1C \uC120\uD0DD</span>
                <button class="library-batch-btn-action" id="library-batch-select-all">\u2611 \uC804\uCCB4</button>
                <button class="library-batch-btn-action library-batch-delete" id="library-batch-delete">\u{1F5D1}\uFE0F \uC0AD\uC81C</button>
                <button class="library-batch-btn-action library-batch-move" id="library-batch-move">\u{1F4C1} \uC774\uB3D9</button>
                <button class="library-batch-btn-action library-batch-cancel" id="library-batch-cancel">\uCDE8\uC18C</button>
            </div>
        ` : ""}
        <div class="tab-chat-list">
            ${state.libraryChats.length > 0 ? state.libraryChats.map((chat, idx) => createChatItemHTML(chat, idx, "library")).join("") : '<div class="tab-empty-small">\uC774 \uD3F4\uB354\uC5D0 \uCC44\uD305\uC774 \uC5C6\uC2B5\uB2C8\uB2E4</div>'}
        </div>
    `;
    container.querySelector(".tab-back-btn")?.addEventListener("click", () => {
      state.currentFolderId = null;
      state.libraryMode = "folders";
      loadLibrary().then(() => renderLibraryView());
    });
    container.querySelector("#tab-folder-manage-btn-detail")?.addEventListener("click", () => {
      const event = new CustomEvent("lobby:open-folder-modal");
      document.dispatchEvent(event);
    });
    container.querySelector("#library-batch-toggle-detail")?.addEventListener("click", () => {
      state.libraryBatchMode = !state.libraryBatchMode;
      renderLibraryView();
    });
    container.querySelector("#library-batch-select-all")?.addEventListener("click", libraryBatchSelectAll);
    container.querySelector("#library-batch-delete")?.addEventListener("click", libraryBatchDelete);
    container.querySelector("#library-batch-move")?.addEventListener("click", () => libraryBatchShowMoveMenu(container.querySelector("#library-batch-move")));
    container.querySelector("#library-batch-cancel")?.addEventListener("click", () => {
      state.libraryBatchMode = false;
      renderLibraryView();
    });
    bindLibraryChatEvents(container);
  }
  function createChatItem(chat, idx, source) {
    const isFav = storage.isFavorite(chat.avatar, chat.file);
    const folderId = storage.getChatFolder(chat.avatar, chat.file);
    const data = storage.load();
    const folder = data.folders?.find((f) => f.id === folderId);
    const folderName = folder && folderId !== "uncategorized" ? folder.name : "";
    const item = document.createElement("div");
    item.className = `lobby-chat-item ${isFav ? "is-favorite" : ""}`;
    item.dataset.avatar = chat.avatar;
    item.dataset.file = chat.file || "";
    item.dataset.idx = idx;
    item.dataset.source = source;
    const displayName = chat.chatName || chat.file?.replace(".jsonl", "") || "";
    const charName = chat.characterName || chat.avatar?.replace(/\.[^.]+$/, "") || "";
    const avatarSrc = chat.thumbnailSrc || (chat.avatar ? `/characters/${chat.avatar}` : "");
    const avatarHTML = avatarSrc ? `<div class="chat-avatar-lg"><img src="${escapeHtml(avatarSrc)}" alt="" onerror="this.parentElement.innerHTML='\u{1F464}'"></div>` : `<div class="chat-avatar-lg">\u{1F464}</div>`;
    const titleLine = displayName ? `${escapeHtml(charName)} - ${escapeHtml(displayName)}` : escapeHtml(charName);
    item.innerHTML = `
        <button class="chat-fav-btn" title="\uC990\uACA8\uCC3E\uAE30">${isFav ? "\u2605" : "\u2606"}</button>
        ${avatarHTML}
        <div class="chat-content">
            <div class="chat-title-line">${titleLine}</div>
            ${chat.preview ? `<div class="chat-preview">${escapeHtml(truncateText(chat.preview, 60))}</div>` : ""}
            <div class="chat-meta">
                ${chat.messageCount > 0 ? `<span>\u{1F4AC} ${chat.messageCount}</span>` : ""}
                ${chat.date ? `<span>${escapeHtml(chat.date)}</span>` : ""}
                ${folderName ? `<span class="chat-folder-tag">${escapeHtml(folderName)}</span>` : ""}
            </div>
        </div>
        <div class="chat-actions">
            <button class="chat-folder-btn" title="\uD3F4\uB354 \uC774\uB3D9">\u22EE</button>
            <button class="chat-delete-btn" title="\uC0AD\uC81C">\u{1F5D1}\uFE0F</button>
        </div>
    `;
    item.querySelector(".chat-content").addEventListener("click", () => {
      openRecentChat(chat, idx);
    });
    item.querySelector(".chat-fav-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      const newState = storage.toggleFavorite(chat.avatar, chat.file);
      item.classList.toggle("is-favorite", newState);
      item.querySelector(".chat-fav-btn").textContent = newState ? "\u2605" : "\u2606";
      showToast(newState ? "\u2B50 \uC990\uACA8\uCC3E\uAE30 \uCD94\uAC00" : "\uC990\uACA8\uCC3E\uAE30 \uD574\uC81C", "success");
    });
    item.querySelector(".chat-delete-btn").addEventListener("click", async (e) => {
      e.stopPropagation();
      await handleDeleteChat(chat.avatar, chat.file, item);
    });
    item.querySelector(".chat-folder-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      showFolderMenu(e.target, chat.avatar, chat.file);
    });
    return item;
  }
  function createChatItemHTML(chat, idx, source) {
    const fileKey = chat.fileName || chat.file;
    const isFav = chat.isFavorite ?? storage.isFavorite(chat.avatar, fileKey);
    const folderId = chat.folderId ?? storage.getChatFolder(chat.avatar, fileKey);
    const data = storage.load();
    const folder = data.folders?.find((f) => f.id === folderId);
    const folderName = folder && folderId !== "uncategorized" ? folder.name : "";
    const displayName = fileKey?.replace(".jsonl", "") || chat.chatName || "";
    const charName = chat.characterName || chat.name || chat.avatar?.replace(/\.[^.]+$/, "") || "";
    const timeAgo = chat.lastChatTime ? getTimeAgo(chat.lastChatTime) : "";
    const preview = chat.preview || chat.lastMessage || "";
    const avatarSrc = chat.thumbnailSrc || (chat.avatar ? `/characters/${chat.avatar}` : "");
    const avatarHTML = avatarSrc ? `<div class="chat-avatar-lg"><img src="${escapeHtml(avatarSrc)}" alt="" onerror="this.parentElement.innerHTML='\u{1F464}'"></div>` : `<div class="chat-avatar-lg">\u{1F464}</div>`;
    const titleLine = displayName ? `${escapeHtml(charName)} - ${escapeHtml(displayName)}` : escapeHtml(charName);
    const encodedPreview = preview ? safeBase64Encode(preview) : "";
    return `
        <div class="lobby-chat-item ${isFav ? "is-favorite" : ""}" 
             data-avatar="${escapeHtml(chat.avatar)}"
             data-file="${escapeHtml(fileKey || "")}"
             data-key="${escapeHtml(chat.key || "")}"
             data-idx="${idx}"
             data-source="${source}"
             data-full-preview-encoded="${encodedPreview}">
            ${state.libraryBatchMode ? `<label class="chat-checkbox" style="display:flex;"><input type="checkbox" class="library-select-cb"></label>` : ""}
            <button class="chat-fav-btn" title="\uC990\uACA8\uCC3E\uAE30">${isFav ? "\u2605" : "\u2606"}</button>
            ${avatarHTML}
            <div class="chat-content">
                <div class="chat-title-line">${titleLine}</div>
                ${preview ? `<div class="chat-preview">${escapeHtml(truncateText(preview, 60))}</div>` : ""}
                <div class="chat-meta">
                    ${timeAgo ? `<span>${timeAgo}</span>` : ""}
                    ${folderName ? `<span class="chat-folder-tag">${escapeHtml(folderName)}</span>` : ""}
                </div>
            </div>
            <div class="chat-actions">
                <button class="chat-folder-btn" title="\uD3F4\uB354 \uC774\uB3D9">\u22EE</button>
                <button class="chat-delete-btn" title="\uC0AD\uC81C">\u{1F5D1}\uFE0F</button>
            </div>
        </div>
    `;
  }
  function bindLibraryChatEvents(container) {
    container.querySelectorAll(".lobby-chat-item").forEach((item) => {
      const avatar = item.dataset.avatar;
      const fileName = item.dataset.file;
      const idx = parseInt(item.dataset.idx) || 0;
      item.querySelector(".library-select-cb")?.addEventListener("change", () => {
        updateLibraryBatchCount();
      });
      item.querySelector(".chat-content")?.addEventListener("click", () => {
        if (state.libraryBatchMode) {
          const cb = item.querySelector(".library-select-cb");
          if (cb) {
            cb.checked = !cb.checked;
            updateLibraryBatchCount();
          }
          return;
        }
        log("Opening library chat:", avatar, fileName);
        openLibraryChat(avatar, fileName);
      });
      item.querySelector(".chat-fav-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        const newState = storage.toggleFavorite(avatar, fileName);
        item.classList.toggle("is-favorite", newState);
        item.querySelector(".chat-fav-btn").textContent = newState ? "\u2605" : "\u2606";
        showToast(newState ? "\u2B50 \uC990\uACA8\uCC3E\uAE30 \uCD94\uAC00" : "\uC990\uACA8\uCC3E\uAE30 \uD574\uC81C", "success");
        if (state.libraryMode === "favorites" && !newState) {
          item.remove();
        }
      });
      item.querySelector(".chat-delete-btn")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        await handleDeleteChat(avatar, fileName, item);
      });
      item.querySelector(".chat-folder-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        showFolderMenu(e.target, avatar, fileName);
      });
    });
  }
  function updateLibraryBatchCount() {
    const count = document.querySelectorAll(".library-select-cb:checked").length;
    const countEl = document.querySelector(".library-batch-count");
    if (countEl) countEl.textContent = `${count}\uAC1C \uC120\uD0DD`;
  }
  function libraryBatchSelectAll() {
    const checkboxes = document.querySelectorAll(".library-select-cb");
    const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
    checkboxes.forEach((cb) => {
      cb.checked = !allChecked;
    });
    updateLibraryBatchCount();
  }
  async function libraryBatchDelete() {
    const checked = document.querySelectorAll(".library-select-cb:checked");
    if (checked.length === 0) {
      showToast("\uC0AD\uC81C\uD560 \uCC44\uD305\uC744 \uC120\uD0DD\uD558\uC138\uC694.", "warning");
      return;
    }
    const confirmed = await showConfirm(
      `\uC120\uD0DD\uD55C ${checked.length}\uAC1C \uCC44\uD305\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?

\uC774 \uC791\uC5C5\uC740 \uB418\uB3CC\uB9B4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.`,
      "\uBC30\uCE58 \uC0AD\uC81C",
      true
    );
    if (!confirmed) return;
    const token = operationLock.acquire("libraryBatchDelete", Math.min(12e4, 1e4 + checked.length * 1500));
    if (!token) {
      showToast("\uB2E4\uB978 \uC791\uC5C5\uC774 \uC9C4\uD589 \uC911\uC785\uB2C8\uB2E4.", "warning");
      return;
    }
    try {
      const context = api.getContext();
      const currentChatFile = context?.characters?.[context?.characterId]?.chat;
      const items = [];
      checked.forEach((cb) => {
        const item = cb.closest(".lobby-chat-item");
        if (item) {
          items.push({
            avatar: item.dataset.avatar,
            fileName: item.dataset.file,
            element: item
          });
        }
      });
      let successCount = 0;
      let skipCount = 0;
      for (const { avatar, fileName, element } of items) {
        const fileNameWithoutExt = fileName.replace(".jsonl", "");
        if (currentChatFile === fileNameWithoutExt) {
          skipCount++;
          continue;
        }
        try {
          const success = await api.deleteChat(fileName, avatar);
          if (success) {
            const data = storage.load();
            const key = storage.getChatKey(avatar, fileName);
            delete data.chatAssignments[key];
            const favIndex = data.favorites.indexOf(key);
            if (favIndex > -1) data.favorites.splice(favIndex, 1);
            storage.save(data);
            cache.invalidate("chats", avatar);
            successCount++;
          }
        } catch (e) {
          logError("Batch delete failed for:", fileName, e);
        }
      }
      let msg = `${successCount}\uAC1C \uCC44\uD305 \uC0AD\uC81C \uC644\uB8CC`;
      if (skipCount > 0) msg += ` (${skipCount}\uAC1C \uC2A4\uD0B5: \uD604\uC7AC \uC5F4\uB9B0 \uCC44\uD305)`;
      showToast(msg, successCount > 0 ? "success" : "warning");
      state.libraryBatchMode = false;
      await loadLibrary();
      renderLibraryView();
    } finally {
      operationLock.release(token);
    }
  }
  function libraryBatchShowMoveMenu(targetBtn) {
    if (!targetBtn) return;
    closeContextMenu();
    const checked = document.querySelectorAll(".library-select-cb:checked");
    if (checked.length === 0) {
      showToast("\uC774\uB3D9\uD560 \uCC44\uD305\uC744 \uC120\uD0DD\uD558\uC138\uC694.", "warning");
      return;
    }
    const data = storage.load();
    const folders = (data.folders || []).filter((f) => f.id !== "favorites" && f.id !== "uncategorized");
    if (folders.length === 0) {
      showToast("\uC774\uB3D9\uD560 \uD3F4\uB354\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uD3F4\uB354\uB97C \uBA3C\uC800 \uB9CC\uB4E4\uC5B4\uC8FC\uC138\uC694.", "warning");
      return;
    }
    const menu = document.createElement("div");
    menu.className = "folder-context-menu";
    menu.innerHTML = `
        <div class="folder-menu-title">${checked.length}\uAC1C \uCC44\uD305 \uC774\uB3D9</div>
        <div class="folder-menu-item" data-folder-id="">
            \u{1F4E4} \uD3F4\uB354\uC5D0\uC11C \uC81C\uAC70
        </div>
        ${folders.map((f) => `
            <div class="folder-menu-item" data-folder-id="${f.id}">
                \u{1F4C1} ${escapeHtml(f.name)}
            </div>
        `).join("")}
    `;
    const rect = targetBtn.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.zIndex = "var(--z-modal, 60000)";
    document.body.appendChild(menu);
    const menuRect = menu.getBoundingClientRect();
    if (rect.bottom + menuRect.height > window.innerHeight - 10) {
      menu.style.top = `${Math.max(10, rect.top - menuRect.height - 4)}px`;
    } else {
      menu.style.top = `${rect.bottom + 4}px`;
    }
    if (rect.right > window.innerWidth - menuRect.width - 10) {
      menu.style.left = `${Math.max(10, rect.left - menuRect.width + rect.width)}px`;
    } else {
      menu.style.left = `${rect.left}px`;
    }
    state.activeContextMenu = menu;
    menu.querySelectorAll(".folder-menu-item").forEach((item) => {
      item.addEventListener("click", async () => {
        const folderId = item.dataset.folderId;
        const checkedNow = document.querySelectorAll(".library-select-cb:checked");
        checkedNow.forEach((cb) => {
          const chatItem = cb.closest(".lobby-chat-item");
          if (chatItem) {
            const avatar = chatItem.dataset.avatar;
            const fileName = chatItem.dataset.file;
            if (folderId) {
              storage.setChatFolder(avatar, fileName, folderId);
            } else {
              storage.setChatFolder(avatar, fileName, null);
            }
          }
        });
        const folder = folders.find((f) => f.id === folderId);
        const msg = folderId ? `${checkedNow.length}\uAC1C \uCC44\uD305\uC774 \u{1F4C1} ${folder?.name || "\uD3F4\uB354"}\uB85C \uC774\uB3D9` : `${checkedNow.length}\uAC1C \uCC44\uD305\uC774 \uD3F4\uB354\uC5D0\uC11C \uC81C\uAC70\uB428`;
        showToast(msg, "success");
        closeContextMenu();
        state.libraryBatchMode = false;
        await loadLibrary();
        renderLibraryView();
      });
    });
    setTimeout(() => {
      contextMenuCloseHandler = function(e) {
        if (!menu.contains(e.target)) closeContextMenu();
      };
      listeners.add("tabContextMenu", document, "click", contextMenuCloseHandler);
    }, 10);
  }
  async function handleDeleteChat(avatar, fileName, itemElement) {
    const context = api.getContext();
    const currentChatFile = context?.characters?.[context?.characterId]?.chat;
    const fileNameWithoutExt = fileName.replace(".jsonl", "");
    if (currentChatFile === fileNameWithoutExt) {
      showToast("\uD604\uC7AC \uC5F4\uB9B0 \uCC44\uD305\uC740 \uC0AD\uC81C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", "warning");
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
    const token = operationLock.acquire("handleDeleteChat", 1e4);
    if (!token) {
      showToast("\uB2E4\uB978 \uC791\uC5C5\uC774 \uC9C4\uD589 \uC911\uC785\uB2C8\uB2E4.", "warning");
      return;
    }
    try {
      const success = await api.deleteChat(fileName, avatar);
      if (success) {
        const data = storage.load();
        const key = storage.getChatKey(avatar, fileName);
        delete data.chatAssignments[key];
        const favIndex = data.favorites.indexOf(key);
        if (favIndex > -1) {
          data.favorites.splice(favIndex, 1);
        }
        storage.save(data);
        cache.invalidate("chats", avatar);
        if (itemElement) {
          itemElement.style.transition = "opacity 0.2s, transform 0.2s";
          itemElement.style.opacity = "0";
          itemElement.style.transform = "translateX(20px)";
          setTimeout(() => {
            itemElement.remove();
          }, 200);
        }
        showToast("\uCC44\uD305\uC774 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.", "success");
      } else {
        showToast("\uCC44\uD305 \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", "error");
      }
    } catch (e) {
      logError("Delete chat failed:", e);
      showToast("\uCC44\uD305 \uC0AD\uC81C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.", "error");
    } finally {
      operationLock.release(token);
    }
  }
  async function openRecentChat(chat, idx) {
    const token = operationLock.acquire("openRecentChat", 12e3);
    if (!token) return;
    try {
      log("Opening recent chat:", chat.file, chat.avatar);
      window.dispatchEvent(new CustomEvent("chatlobby:close"));
      if (chat.isGroup && chat.groupId && chat.file) {
        operationLock.release(token);
        await openGroupChat(chat.groupId, chat.file);
        return;
      }
      if (!chat.isGroup && chat.avatar && chat.file) {
        const charIndex = (api.getContext()?.characters || []).findIndex((c) => c.avatar === chat.avatar);
        if (charIndex !== -1) {
          operationLock.release(token);
          await openChat({
            fileName: chat.file,
            charAvatar: chat.avatar,
            charIndex: String(charIndex)
          });
          return;
        }
      }
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const selector = chat.isGroup ? `.recentChat[data-group="${chat.groupId || chat.avatar}"]` : `.recentChat[data-file="${chat.file}"][data-avatar="${chat.avatar}"]`;
      const recentEl = document.querySelector(selector);
      if (recentEl) {
        log("Found element via selector, clicking");
        const chatChangedPromise = waitForChatChanged(8e3);
        recentEl.click();
        await chatChangedPromise;
      } else {
        if (!chat.isGroup && chat.avatar && chat.file) {
          log("Element not found, opening via openChat handler");
          const context = api.getContext();
          const charIndex = (context?.characters || []).findIndex((c) => c.avatar === chat.avatar);
          if (charIndex !== -1) {
            operationLock.release(token);
            await openChat({
              fileName: chat.file,
              charAvatar: chat.avatar,
              charIndex: String(charIndex)
            });
            return;
          }
        }
        log("Falling back to character select event");
        const event = new CustomEvent("lobby:select-character", {
          detail: { avatar: chat.avatar }
        });
        document.dispatchEvent(event);
        await new Promise((r) => setTimeout(r, 800));
      }
    } catch (e) {
      logError("openRecentChat failed:", e);
      showToast("\uCC44\uD305\uC744 \uC5F4\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "error");
    } finally {
      operationLock.release(token);
    }
  }
  async function openLibraryChat(avatar, fileName) {
    log("Opening library chat:", avatar, fileName);
    if (!avatar || !fileName) {
      showToast("\uCC44\uD305 \uC815\uBCF4\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.", "error");
      return;
    }
    const context = api.getContext();
    const characters = context?.characters || [];
    const charIndex = characters.findIndex((c) => c.avatar === avatar);
    if (charIndex === -1) {
      showToast("\uCE90\uB9AD\uD130\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.", "error");
      return;
    }
    await openChat({
      fileName,
      charAvatar: avatar,
      charIndex: String(charIndex)
    });
  }
  function closeContextMenu() {
    if (state.activeContextMenu) {
      state.activeContextMenu.remove();
      state.activeContextMenu = null;
    }
    listeners.clear("tabContextMenu");
    contextMenuCloseHandler = null;
  }
  function showFolderMenu(targetBtn, avatar, fileName) {
    closeContextMenu();
    const data = storage.load();
    const folders = (data.folders || []).filter((f) => f.id !== "favorites" && f.id !== "uncategorized");
    const currentFolderId = storage.getChatFolder(avatar, fileName);
    const menu = document.createElement("div");
    menu.className = "folder-context-menu";
    menu.innerHTML = `
        <div class="folder-menu-title">\uD3F4\uB354 \uC774\uB3D9</div>
        <div class="folder-menu-item ${!currentFolderId ? "active" : ""}" data-folder-id="">
            \u{1F4E4} \uD3F4\uB354\uC5D0\uC11C \uC81C\uAC70
        </div>
        ${folders.map((f) => `
            <div class="folder-menu-item ${f.id === currentFolderId ? "active" : ""}" data-folder-id="${f.id}">
                \u{1F4C1} ${escapeHtml(f.name)}
            </div>
        `).join("")}
        <div class="folder-menu-item new-folder">
            \u2795 \uC0C8 \uD3F4\uB354 \uB9CC\uB4E4\uAE30
        </div>
    `;
    const rect = targetBtn.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.zIndex = "var(--z-modal, 60000)";
    document.body.appendChild(menu);
    const menuRect = menu.getBoundingClientRect();
    if (rect.bottom + menuRect.height > window.innerHeight - 10) {
      menu.style.top = `${Math.max(10, rect.top - menuRect.height - 4)}px`;
    } else {
      menu.style.top = `${rect.bottom + 4}px`;
    }
    if (rect.right > window.innerWidth - menuRect.width - 10) {
      menu.style.left = `${Math.max(10, rect.left - menuRect.width + rect.width)}px`;
    } else {
      menu.style.left = `${rect.left}px`;
    }
    state.activeContextMenu = menu;
    menu.querySelectorAll(".folder-menu-item:not(.new-folder)").forEach((item) => {
      item.addEventListener("click", () => {
        const folderId = item.dataset.folderId;
        if (folderId) {
          storage.setChatFolder(avatar, fileName, folderId);
          const folder = folders.find((f) => f.id === folderId);
          showToast(`\u{1F4C1} ${folder?.name || "\uD3F4\uB354"}\uB85C \uC774\uB3D9`, "success");
        } else {
          storage.setChatFolder(avatar, fileName, null);
          showToast("\uD3F4\uB354\uC5D0\uC11C \uC81C\uAC70\uB428", "success");
        }
        closeContextMenu();
        refreshCurrentTab();
      });
    });
    menu.querySelector(".new-folder")?.addEventListener("click", () => {
      closeContextMenu();
      const event = new CustomEvent("lobby:open-folder-modal", {
        detail: { avatar, fileName }
      });
      document.dispatchEvent(event);
    });
    setTimeout(() => {
      contextMenuCloseHandler = function(e) {
        if (!menu.contains(e.target)) {
          closeContextMenu();
        }
      };
      listeners.add("tabContextMenu", document, "click", contextMenuCloseHandler);
    }, 10);
  }
  function safeBase64Encode(str) {
    try {
      const bytes = new TextEncoder().encode(str);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    } catch (e) {
      return "";
    }
  }
  function getTimeAgo(timestamp) {
    if (!timestamp) return "";
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 6e4);
    const hours = Math.floor(diff / 36e5);
    const days = Math.floor(diff / 864e5);
    if (minutes < 1) return "\uBC29\uAE08";
    if (minutes < 60) return `${minutes}\uBD84 \uC804`;
    if (hours < 24) return `${hours}\uC2DC\uAC04 \uC804`;
    if (days < 7) return `${days}\uC77C \uC804`;
    return new Date(timestamp).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  }
  function bindTabEvents() {
    const tabBar = document.getElementById("chat-lobby-tabs");
    if (!tabBar || tabBar.dataset.bound === "true") return;
    tabBar.dataset.bound = "true";
    log("Binding tab events (delegated)");
    listeners.add("tabBar", tabBar, "click", (e) => {
      const tab = e.target.closest(".lobby-tab");
      if (tab?.dataset.tab) switchTab(tab.dataset.tab);
    });
  }
  function refreshCurrentTab() {
    log("Refreshing current tab:", state.currentTab);
    if (state.currentTab !== "characters") {
      loadTabData(state.currentTab);
    }
  }
  function injectContextMenuStyles() {
    if (document.getElementById("tab-context-menu-styles")) return;
    const style = document.createElement("style");
    style.id = "tab-context-menu-styles";
    style.textContent = `
        /* \uD0ED \uCC44\uD305 \uBAA9\uB85D - \uAE30\uC874 \uCC44\uD305 \uBAA9\uB85D UI\uC640 \uC720\uC0AC */
        .tab-chat-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding: 8px;
        }
        
        .tab-chat-list .lobby-chat-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 12px;
            background: var(--lobby-bg-card);
            border: 1px solid var(--lobby-border);
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.15s ease;
        }
        
        .tab-chat-list .lobby-chat-item:hover {
            background: var(--lobby-bg-hover);
            border-color: var(--lobby-accent);
        }
        
        .tab-chat-list .lobby-chat-item.is-favorite {
            border-left: 4px solid var(--lobby-accent);
        }
        
        /* \uD070 \uB77C\uC6B4\uB4DC \uB124\uBAA8 \uC544\uBC14\uD0C0 */
        .tab-chat-list .chat-avatar-lg {
            width: 52px;
            height: 52px;
            border-radius: 10px;
            overflow: hidden;
            flex-shrink: 0;
            background: var(--lobby-bg-hover);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
        }
        
        .tab-chat-list .chat-avatar-lg img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .tab-chat-list .chat-content {
            flex: 1;
            min-width: 0;
            cursor: pointer;
        }
        
        .tab-chat-list .chat-title-line {
            font-size: 13px;
            font-weight: 500;
            color: var(--lobby-text);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .tab-chat-list .chat-preview {
            font-size: 12px;
            color: var(--lobby-text-secondary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-top: 3px;
        }
        
        .tab-chat-list .chat-meta {
            display: flex;
            gap: 8px;
            font-size: 11px;
            color: var(--lobby-text-secondary);
            margin-top: 4px;
        }
        
        .tab-chat-list .chat-folder-tag {
            background: var(--lobby-accent);
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
        }
        
        /* \uC561\uC158 \uBC84\uD2BC\uB4E4 - \uD56D\uC0C1 \uD45C\uC2DC */
        .tab-chat-list .chat-actions {
            display: flex;
            flex-direction: column;
            gap: 4px;
            flex-shrink: 0;
        }
        
        .tab-chat-list .chat-actions button {
            background: var(--lobby-bg-hover);
            border: 1px solid var(--lobby-border);
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            padding: 6px 8px;
            color: var(--lobby-text-secondary);
            transition: all 0.15s;
        }
        
        .tab-chat-list .chat-actions button:hover {
            background: var(--lobby-bg-card);
            color: var(--lobby-text);
        }
        
        .tab-chat-list .lobby-chat-item.is-favorite .chat-fav-btn {
            color: var(--star-color, #ffd700);
            text-shadow: 0 0 8px var(--star-glow, rgba(255, 215, 0, 0.6));
        }
        
        .tab-chat-list .chat-delete-btn:hover {
            color: #ff6b6b !important;
            border-color: #ff6b6b;
        }
        
        .tab-chat-list .chat-folder-btn:hover {
            color: var(--lobby-accent) !important;
        }
        
        /* \uD3F4\uB354 \uCEE8\uD14D\uC2A4\uD2B8 \uBA54\uB274 - \uD56D\uC0C1 \uB2E4\uD06C \uD14C\uB9C8 */
        .folder-context-menu {
            background: #2f2f2f !important;
            border: 1px solid #404040 !important;
            border-radius: 10px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
            min-width: 160px;
            overflow: hidden;
        }
        
        .folder-menu-title {
            padding: 10px 14px;
            font-size: 12px;
            font-weight: 600;
            color: #A3A3A3 !important;
            border-bottom: 1px solid #404040 !important;
        }
        
        .folder-menu-item {
            padding: 10px 14px;
            font-size: 13px;
            color: #FFFFFF !important;
            cursor: pointer;
            transition: background 0.15s;
        }
        
        .folder-menu-item:hover {
            background: #404040 !important;
        }
        
        .folder-menu-item.active {
            background: #E50914 !important;
            color: white !important;
        }
        
        .folder-menu-item.new-folder {
            border-top: 1px solid #404040 !important;
            color: #E50914 !important;
        }
    `;
    document.head.appendChild(style);
  }
  function debounce2(fn, delay) {
    let timer = null;
    return function(...args) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }
  function startRecentDomObserver() {
    if (recentDomObserver) return;
    const container = document.querySelector("#rm_print_characters_block");
    if (!container) {
      log("[Observer] Target container #rm_print_characters_block not found, skipping");
      return;
    }
    const debouncedUpdate = debounce2(() => {
      const els = document.querySelectorAll(".recentChat");
      if (els.length > 0) {
        log("[Observer] .recentChat changed, updating cache");
        state.cachedRecentChats = [];
        cacheElements(els);
      }
    }, 300);
    recentDomObserver = new MutationObserver(debouncedUpdate);
    recentDomObserver.observe(container, {
      childList: true,
      subtree: true
    });
    log("[Observer] Started watching .recentChat DOM changes");
  }
  function stopRecentDomObserver() {
    if (recentDomObserver) {
      recentDomObserver.disconnect();
      recentDomObserver = null;
      log("[Observer] Stopped watching .recentChat DOM changes");
    }
  }

  // src/ui/templates.js
  init_textUtils();

  // src/ui/themeMenu.js
  init_textUtils();

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

  // src/ui/themeMenu.js
  var THEMES = [
    { id: "default", name: "\uC2DC\uB124\uB9C8 \uB2E4\uD06C", icon: "\u{1F3AC}", base: "dark", desc: "\uB137\uD50C\uB9AD\uC2A4 \uC2A4\uD0C0\uC77C" },
    { id: "light", name: "\uBAA8\uB178 \uB77C\uC774\uD2B8", icon: "\u{1F90D}", base: "light", desc: "\uAE54\uB054\uD55C \uBB34\uCC44\uC0C9" },
    { id: "glass", name: "\uAE00\uB798\uC2A4", icon: "\u{1FAE7}", base: "dark", desc: "\uBC18\uD22C\uBA85 \uBE14\uB7EC + \uAE00\uB85C\uC6B0" },
    { id: "polaroid", name: "\uD3F4\uB77C\uB85C\uC774\uB4DC", icon: "\u{1F4F8}", base: "light", desc: "\uC0AC\uC9C4 \uC561\uC790 \uCEEC\uB809\uC158" },
    { id: "messenger", name: "\uBC30\uB108 \uB9AC\uC2A4\uD2B8", icon: "\u{1F4AC}", base: "dark", desc: "\uC640\uC774\uB4DC \uBC30\uB108 \xB7 \uBAA8\uBC14\uC77C \uCD94\uCC9C" },
    { id: "magazine", name: "\uB9E4\uAC70\uC9C4", icon: "\u{1F5DE}\uFE0F", base: "dark", desc: "\uC5D0\uB514\uD1A0\uB9AC\uC5BC \uD654\uBCF4 \uD0C0\uC774\uD3EC" },
    { id: "console", name: "\uCF58\uC194", icon: "\u{1F6F0}\uFE0F", base: "dark", desc: "\uC2E4\uB9AC \uBA54\uB274 \uB3C4\uD06C \uB0B4\uC7A5 \xB7 \uC2E4\uD5D8\uC801" }
  ];
  function getThemeById(id) {
    return THEMES.find((t) => t.id === id) || THEMES[0];
  }
  function applyTheme(themeId) {
    const container = document.getElementById("chat-lobby-container");
    if (!container) return;
    const theme = getThemeById(themeId);
    container.classList.toggle("dark-mode", theme.base === "dark");
    container.classList.toggle("light-mode", theme.base === "light");
    container.dataset.lobbyTheme = theme.id;
    uiPrefs.set("theme", theme.id);
    const menu = document.getElementById("chat-lobby-theme-menu");
    if (menu) {
      menu.querySelectorAll(".theme-option").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.theme === theme.id);
      });
    }
  }
  function createThemeMenuHTML() {
    const currentTheme = getThemeById(uiPrefs.get("theme"));
    const showHero = uiPrefs.get("showHero");
    const personaBadges = uiPrefs.get("personaBadges");
    const cardSize = uiPrefs.get("cardSize");
    const badgeSize = uiPrefs.get("badgeSize");
    return `
    <div id="chat-lobby-theme-menu" style="display:none;">
        <div class="theme-menu-section-title">\u{1F3A8} \uD14C\uB9C8</div>
        <div class="theme-menu-grid">
            ${THEMES.map((t) => `
                <button class="theme-option ${t.id === currentTheme.id ? "active" : ""}"
                        data-action="set-theme" data-theme="${t.id}" title="${escapeHtml(t.desc)}">
                    <span class="theme-option-icon">${t.icon}</span>
                    <span class="theme-option-name">${escapeHtml(t.name)}</span>
                    <span class="theme-option-desc">${escapeHtml(t.desc)}</span>
                </button>
            `).join("")}
        </div>
        <div class="theme-menu-section-title">\u{1F4D0} \uD06C\uAE30</div>
        <div class="theme-menu-slider">
            <span class="slider-label">\uCE74\uB4DC \uD06C\uAE30</span>
            <input type="range" id="pref-card-size" min="140" max="280" step="10" value="${cardSize}">
            <span class="slider-value" id="pref-card-size-value">${cardSize}px</span>
        </div>
        <div class="theme-menu-slider">
            <span class="slider-label">\uD398\uB974\uC18C\uB098 \uBC30\uC9C0</span>
            <input type="range" id="pref-badge-size" min="24" max="64" step="2" value="${badgeSize}">
            <span class="slider-value" id="pref-badge-size-value">${badgeSize}px</span>
        </div>
        <div class="theme-menu-slider">
            <span class="slider-label">\uBC30\uC9C0 \uC704\uCE58</span>
            <select id="pref-badge-pos" class="theme-menu-select">
                <option value="top" ${uiPrefs.get("badgePosition") !== "bottom" ? "selected" : ""}>\uC6B0\uCE21 \uC0C1\uB2E8</option>
                <option value="bottom" ${uiPrefs.get("badgePosition") === "bottom" ? "selected" : ""}>\uC6B0\uCE21 \uD558\uB2E8</option>
            </select>
        </div>
        <div class="theme-menu-section-title">\u{1F441}\uFE0F \uD45C\uC2DC</div>
        <label class="theme-menu-check">
            <input type="checkbox" id="pref-show-hero" ${showHero ? "checked" : ""}>
            <span>\u2B50 \uCD5C\uC560 \uCF54\uB108 (\uC990\uACA8\uCC3E\uAE30 \uBC30\uB108)</span>
        </label>
        <label class="theme-menu-check">
            <input type="checkbox" id="pref-persona-badges" ${personaBadges ? "checked" : ""}>
            <span>\u{1F464} \uCE74\uB4DC\uC5D0 \uB9C8\uC9C0\uB9C9 \uD398\uB974\uC18C\uB098 \uBC30\uC9C0</span>
        </label>
    </div>
    `;
  }
  function applySizePrefs() {
    const container = document.getElementById("chat-lobby-container");
    if (!container) return;
    container.style.setProperty("--card-width", `${uiPrefs.get("cardSize")}px`);
    container.style.setProperty("--persona-badge-size", `${uiPrefs.get("badgeSize")}px`);
    container.dataset.badgePos = uiPrefs.get("badgePosition") === "bottom" ? "bottom" : "top";
  }
  function toggleThemeMenu() {
    const menu = document.getElementById("chat-lobby-theme-menu");
    if (!menu) return;
    const isOpen = menu.style.display !== "none";
    menu.style.display = isOpen ? "none" : "block";
  }
  function closeThemeMenu() {
    const menu = document.getElementById("chat-lobby-theme-menu");
    if (menu) menu.style.display = "none";
  }
  function isThemeMenuOpen() {
    const menu = document.getElementById("chat-lobby-theme-menu");
    return !!menu && menu.style.display !== "none";
  }
  function initThemeMenuEvents(onDisplayPrefChange) {
    const heroCb = document.getElementById("pref-show-hero");
    const badgeCb = document.getElementById("pref-persona-badges");
    const cardSlider = document.getElementById("pref-card-size");
    const badgeSlider = document.getElementById("pref-badge-size");
    listeners.add("themeMenu", heroCb, "change", (e) => {
      uiPrefs.set("showHero", e.target.checked);
      onDisplayPrefChange?.();
    });
    listeners.add("themeMenu", badgeCb, "change", (e) => {
      uiPrefs.set("personaBadges", e.target.checked);
      onDisplayPrefChange?.();
    });
    listeners.add("themeMenu", cardSlider, "input", (e) => {
      const v = parseInt(e.target.value, 10);
      uiPrefs.set("cardSize", v);
      applySizePrefs();
      const label = document.getElementById("pref-card-size-value");
      if (label) label.textContent = `${v}px`;
    });
    listeners.add("themeMenu", badgeSlider, "input", (e) => {
      const v = parseInt(e.target.value, 10);
      uiPrefs.set("badgeSize", v);
      applySizePrefs();
      const label = document.getElementById("pref-badge-size-value");
      if (label) label.textContent = `${v}px`;
    });
    const badgePosSelect = document.getElementById("pref-badge-pos");
    listeners.add("themeMenu", badgePosSelect, "change", (e) => {
      uiPrefs.set("badgePosition", e.target.value === "bottom" ? "bottom" : "top");
      applySizePrefs();
    });
    applySizePrefs();
  }
  var ST_DOCK_ITEMS = [
    { icon: "\u{1F9E0}", label: "\uD504\uB9AC\uC14B", ids: ["leftNavHolder", "ai-response-configuration", "respective-presets-button"] },
    { icon: "\u{1F50C}", label: "\uC5F0\uACB0", ids: ["sys-settings-button", "API-status-top", "api-connections-button"] },
    { icon: "\u{1F170}\uFE0F", label: "\uD3EC\uB9E4\uD305", ids: ["advanced-formatting-button", "AdvancedFormatting"] },
    { icon: "\u{1F4DA}", label: "\uC6D4\uB4DC\uC778\uD3EC", ids: ["WI-SP-button", "WIDrawerIcon", "WorldInfo", "world_info"] },
    { icon: "\u2699\uFE0F", label: "\uC124\uC815", ids: ["user-settings-button"] },
    { icon: "\u{1F5BC}\uFE0F", label: "\uBC30\uACBD", ids: ["logo_block", "backgrounds-button"] },
    { icon: "\u{1F9E9}", label: "\uD655\uC7A5", ids: ["extensions-settings-button", "rm_extensions_block"] },
    { icon: "\u{1F464}", label: "\uD398\uB974\uC18C\uB098", ids: ["persona-management-button"] },
    { icon: "\u{1FAAA}", label: "\uCE90\uB9AD\uD130", ids: ["rightNavHolder"] }
  ];
  function resolveDrawerId(ids) {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el && el.querySelector(".drawer-content")) return id;
    }
    return null;
  }
  function renderStDock() {
    const dock = document.getElementById("chat-lobby-st-dock");
    if (!dock) return;
    const items = ST_DOCK_ITEMS.map((item) => ({ ...item, resolvedId: resolveDrawerId(item.ids) })).filter((item) => item.resolvedId);
    dock.innerHTML = `
        <div class="st-dock-title">ST</div>
        ${items.map((item) => `
            <button class="st-dock-btn" data-drawer-id="${escapeHtml(item.resolvedId)}" title="${escapeHtml(item.label)}">
                <span class="st-dock-icon">${item.icon}</span>
                <span class="st-dock-label">${escapeHtml(item.label)}</span>
            </button>
        `).join("")}
    `;
    if (dock.dataset.bound !== "true") {
      dock.dataset.bound = "true";
      listeners.add("stDock", dock, "click", async (e) => {
        const btn = e.target.closest(".st-dock-btn");
        if (!btn) return;
        const drawerId = btn.dataset.drawerId;
        if (!drawerId) return;
        window.dispatchEvent(new CustomEvent("chatlobby:close"));
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        openDrawerSafely(drawerId);
      });
    }
  }
  function cleanupThemeMenu() {
    listeners.clear("themeMenu");
    listeners.clear("stDock");
  }

  // src/ui/templates.js
  function createLobbyHTML() {
    const theme = getThemeById(uiPrefs.get("theme"));
    const isCollapsed = localStorage.getItem("chatlobby-collapsed") === "true";
    const themeClass = theme.base === "light" ? "light-mode" : "dark-mode";
    const collapsedClass = isCollapsed ? "collapsed" : "";
    return `
    <div id="chat-lobby-fab" data-action="open-lobby" title="Chat Lobby \uC5F4\uAE30">
        <div class="fab-preview">
            <img class="fab-preview-avatar" src="" alt="" onerror="this.style.display='none'">
            <span class="fab-streak"></span>
        </div>
        <span class="fab-icon">\u{1F4AC}</span>
    </div>
    <div id="chat-lobby-overlay" style="display: none;">
        <div id="chat-lobby-container" class="${themeClass}" data-lobby-theme="${theme.id}">
            <!-- \uD5E4\uB354 - \uD0ED \uD1B5\uD569 -->
            <header id="chat-lobby-header">
                <div class="header-left">
                    <button id="chat-lobby-menu-toggle" class="mobile-only" data-action="toggle-header-menu" title="\uBA54\uB274">\u2630</button>
                    <h2 id="chat-lobby-title" data-action="go-to-characters" style="cursor: pointer;">Chat Lobby</h2>
                    ${createTabBarHTML()}
                </div>
                <div class="header-right">
                    <div class="header-actions">
                        <button id="chat-lobby-random-char" data-action="random-char" title="\uB79C\uB364 \uCE90\uB9AD\uD130">\u{1F3B2}</button>
                        <button id="chat-lobby-calendar-btn" data-action="open-calendar" title="\uCE98\uB9B0\uB354">\u{1F4C5}</button>
                        <button id="chat-lobby-stats" data-action="open-stats" title="Wrapped \uD1B5\uACC4">\u{1F4CA}</button>
                        <button id="chat-lobby-import-char" data-action="import-char" title="\uCE90\uB9AD\uD130 \uAC00\uC838\uC624\uAE30">\u{1F4E5}</button>
                        <button id="chat-lobby-add-persona" data-action="add-persona" title="\uD398\uB974\uC18C\uB098 \uCD94\uAC00">\u{1F464}</button>
                        <button id="chat-lobby-refresh" data-action="refresh" title="\uC0C8\uB85C\uACE0\uCE68">\u{1F504}</button>
                        <button id="chat-lobby-theme-toggle" data-action="open-theme-menu" title="\uD14C\uB9C8 / \uD45C\uC2DC \uC124\uC815">\u{1F3A8}</button>
                    </div>
                    <button id="chat-lobby-close" data-action="close-lobby" title="\uB2EB\uAE30">\u2715</button>
                </div>
            </header>

            <!-- \uD14C\uB9C8/\uD45C\uC2DC \uC124\uC815 \uD31D\uC624\uBC84 -->
            ${createThemeMenuHTML()}
            
            <!-- \uBA54\uC778 \uCF58\uD150\uCE20 -->
            <main id="chat-lobby-main">
                <!-- ST \uBA54\uB274 \uB3C4\uD06C (\uCF58\uC194 \uD14C\uB9C8 \uC804\uC6A9, JS\uC5D0\uC11C \uB80C\uB354\uB9C1) -->
                <aside id="chat-lobby-st-dock"></aside>
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
                        <input type="text" id="chat-lobby-search-input" placeholder="\u{1F50D} \uCE90\uB9AD\uD130/\uADF8\uB8F9 \uAC80\uC0C9...">
                        <select id="chat-lobby-char-sort" title="\uC815\uB82C">
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

                    <!-- \uCD5C\uC560 \uCF54\uB108 (\uC990\uACA8\uCC3E\uAE30 \uD788\uC5B4\uB85C \uBC30\uB108) -->
                    <div id="chat-lobby-hero" style="display:none;" data-has-content="false"></div>

                    <!-- \uCE90\uB9AD\uD130 \uADF8\uB9AC\uB4DC -->
                    <div id="chat-lobby-characters">
                        <div class="lobby-loading">\uCE90\uB9AD\uD130 \uB85C\uB529 \uC911...</div>
                    </div>
                </section>
                
                <!-- \uC624\uB978\uCABD \uD328\uB110: \uCC44\uD305 \uBAA9\uB85D (\uC2AC\uB77C\uC774\uB4DC \uC778) -->
                <aside id="chat-lobby-chats">
                    <header id="chat-lobby-chats-header">
                        <button id="chat-lobby-chats-back" data-action="close-chat-panel" title="\uB4A4\uB85C">\u2190</button>
                        <img src="" alt="avatar" id="chat-panel-avatar" data-action="go-to-character" title="\uCE90\uB9AD\uD130 \uC815\uBCF4" style="display:none;">
                        <div class="char-info">
                            <div class="char-name" id="chat-panel-name">\uCE90\uB9AD\uD130\uB97C \uC120\uD0DD\uD558\uC138\uC694</div>
                            <div class="chat-count" id="chat-panel-count"></div>
                        </div>
                        <button id="chat-lobby-delete-char" data-action="delete-char" title="\uCE90\uB9AD\uD130 \uC0AD\uC81C" style="display:none;">\u{1F5D1}\uFE0F</button>
                        <button id="chat-lobby-new-chat" data-action="new-chat" data-has-chats="false" style="display:none;">+ \uC0C8 \uCC44\uD305</button>
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
                                    <option value="branch">\u{1F333} \uBD84\uAE30</option>
                                </select>
                                <select id="chat-lobby-folder-filter">
                                    <option value="all">\u{1F4C1} \uC804\uCCB4</option>
                                    <option value="favorites">\u2B50 \uC990\uACA8\uCC3E\uAE30</option>
                                </select>
                            </div>
                            <div class="filter-group-buttons">
                                <button id="chat-lobby-persona-quick" class="icon-btn persona-quick-btn" data-action="switch-persona" title="\uD038 \uD398\uB974\uC18C\uB098" style="display:none;"><img class="persona-quick-avatar" src="" alt="persona" /></button>
                                <button id="chat-lobby-branch-refresh" class="icon-btn" data-action="refresh-branches" title="\uBD84\uAE30 \uBD84\uC11D \uC0C8\uB85C\uACE0\uCE68" style="display:none;"><span class="icon">\u{1F50D}</span></button>
                                <button id="chat-lobby-batch-mode" class="icon-btn" data-action="toggle-batch" title="\uBC30\uCE58 \uC120\uD0DD \uBAA8\uB4DC"><span class="icon">\u2611\uFE0F</span></button>
                                <button id="chat-lobby-folder-manage" class="icon-btn" data-action="open-folder-modal" title="\uD3F4\uB354 \uAD00\uB9AC"><span class="icon">\u{1F4C1}</span></button>
                            </div>
                        </div>
                    </section>
                    
                    <!-- \uBC30\uCE58 \uBAA8\uB4DC \uD234\uBC14 -->
                    <div id="chat-lobby-batch-toolbar">
                        <span id="batch-selected-count">0\uAC1C \uC120\uD0DD</span>
                        <button id="batch-select-all-btn" data-action="batch-select-all" title="\uC804\uCCB4 \uC120\uD0DD/\uD574\uC81C">\u2611 \uC804\uCCB4</button>
                        <button id="batch-delete-btn" data-action="batch-delete" title="\uC120\uD0DD\uD55C \uCC44\uD305 \uC0AD\uC81C">\u{1F5D1}\uFE0F \uC0AD\uC81C</button>
                        <button id="batch-move-btn" data-action="open-folder-modal" title="\uC120\uD0DD\uD55C \uCC44\uD305 \uD3F4\uB354 \uC774\uB3D9">\u{1F4C1} \uC774\uB3D9</button>
                        <button id="batch-cancel-btn" data-action="batch-cancel">\uCDE8\uC18C</button>
                    </div>

                    <!-- \uCC44\uD305 \uBAA9\uB85D -->
                    <div id="chat-lobby-chats-list">
                        <div class="lobby-empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:var(--text-muted,#888);padding:40px;">
                            <i>\u{1F4AC}</i>
                            <div>\uCE90\uB9AD\uD130\uB97C \uC120\uD0DD\uD558\uC138\uC694</div>
                        </div>
                    </div>
                </aside>
            </main>

            <!-- \uB9AC\uB9C8\uC778\uB4DC \uBDF0\uC5B4 (\uCC44\uD305 \uD328\uB110\uACFC \uB3D9\uC77C: \uACE0\uC815 \uC694\uC18C + .visible \uD074\uB798\uC2A4 \uD1A0\uAE00) -->
            <div id="chat-lobby-remind-viewer"></div>
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
  function getFoldersOptionsHTML(selectedValue = "all") {
    const data = storage.load();
    const sorted = [...data.folders].sort((a, b) => a.order - b.order);
    let html = '<option value="all">\u{1F4C1} \uC804\uCCB4</option>';
    html += '<option value="favorites">\u2B50 \uC990\uACA8\uCC3E\uAE30\uB9CC</option>';
    sorted.forEach((f) => {
      if (f.id !== "favorites") {
        const selected = f.id === selectedValue ? "selected" : "";
        html += `<option value="${f.id}" ${selected}>${escapeHtml(f.name)}</option>`;
      }
    });
    return html;
  }
  function getBatchFoldersHTML() {
    const data = storage.load();
    const sorted = [...data.folders].sort((a, b) => a.order - b.order);
    let html = '<option value="">\uC774\uB3D9\uD560 \uD3F4\uB354...</option>';
    sorted.forEach((f) => {
      if (f.id !== "favorites") {
        html += `<option value="${f.id}">${escapeHtml(f.name)}</option>`;
      }
    });
    return html;
  }

  // src/ui/personaBar.js
  init_textUtils();
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
    const sortedPersonas = [...personas].sort((a, b) => {
      const aFav = storage.isPersonaFavorite(a.key);
      const bFav = storage.isPersonaFavorite(b.key);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });
    let html = "";
    sortedPersonas.forEach((persona) => {
      const isSelected = persona.key === currentPersona ? "selected" : "";
      const isFav = storage.isPersonaFavorite(persona.key);
      const favClass = isFav ? "is-persona-fav" : "";
      const avatarUrl = `/User Avatars/${encodeURIComponent(persona.key)}`;
      html += `
        <div class="persona-item ${isSelected} ${favClass}" data-persona="${escapeHtml(persona.key)}" title="${escapeHtml(persona.name)}">
            <button class="persona-fav-btn" data-persona="${escapeHtml(persona.key)}" title="\uC990\uACA8\uCC3E\uAE30">${isFav ? "\u2605" : "\u2606"}</button>
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
      const favBtn = item.querySelector(".persona-fav-btn");
      const personaKey = item.dataset.persona;
      if (favBtn) {
        createTouchClickHandler(favBtn, (e) => {
          e.stopPropagation();
          const newFavState = storage.togglePersonaFavorite(personaKey);
          favBtn.textContent = newFavState ? "\u2605" : "\u2606";
          item.classList.toggle("is-persona-fav", newFavState);
          showToast(newFavState ? "\uC990\uACA8\uCC3E\uAE30\uC5D0 \uCD94\uAC00\uB428" : "\uC990\uACA8\uCC3E\uAE30\uC5D0\uC11C \uC81C\uAC70\uB428", "success");
          setTimeout(() => renderPersonaBar(), 300);
        }, { preventDefault: true, stopPropagation: true, debugName: `persona-fav-${index}` });
      }
      const handleItemClick = async (e) => {
        if (e.target.closest(".persona-delete-btn")) return;
        if (e.target.closest(".persona-fav-btn")) return;
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
      const personaKey = item.dataset.persona;
      const success = await api.setPersona(personaKey);
      if (success) {
        storage.recordPersonaUsage(personaKey);
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

  // src/ui/personaRadialMenu.js
  init_notifications();
  var state2 = {
    isOpen: false,
    mode: "favorites",
    // 'favorites' | 'recent' | 'all'
    scrollIndex: 0,
    // 현재 선택된 인덱스
    favorites: [],
    allPersonas: [],
    currentPersona: null,
    isInitialized: false
  };
  var CONFIG2 = {
    RADIUS: 200,
    // 원 반지름 (PC) - 카드와 간격 확보
    RADIUS_MOBILE: 150,
    // 원 반지름 (모바일) - 최소 가시성 확보
    RADIUS_Y_RATIO: 0.32,
    // Y축 비율 (위가 직선에 가까운 타원)
    ITEM_SIZE: 64,
    // 아바타 크기 (PC) - 증가
    ITEM_SIZE_MOBILE: 52,
    // 모바일 아바타 크기 - 증가
    ITEM_GAP: 16,
    // 아이템 간 최소 갭
    FAB_SIZE: 56,
    // FAB 크기
    SCROLL_STEP: 1,
    // 한 번에 스크롤하는 개수
    SCROLL_COOLDOWN: 60,
    // 스크롤 쿨다운
    ITEM_WIDTH: 50,
    // 아이템 간격 (드래그 계산용) - 감도 높임
    MOMENTUM_FRICTION: 0.88,
    // 관성 감속 (0.85~0.88이 자연스러움)
    MOMENTUM_MULTIPLIER: 8
    // 속도-거리 변환 배수
  };
  var preloadedUrls = /* @__PURE__ */ new Set();
  function getCurrentItems() {
    if (state2.mode === "favorites") return state2.favorites;
    if (state2.mode === "recent") {
      const queue = storage.getPersonaRecentUsage();
      const orderMap = new Map(queue.map((k, i) => [k, i]));
      return [...state2.allPersonas].sort((a, b) => {
        const ai = orderMap.get(a.key) ?? Infinity;
        const bi = orderMap.get(b.key) ?? Infinity;
        return ai - bi;
      });
    }
    return state2.allPersonas;
  }
  function getMaxScroll() {
    const items = getCurrentItems();
    return Math.max(0, items.length - getVisibleCount());
  }
  function getVisibleCount() {
    return 7;
  }
  function getRadius() {
    return window.innerWidth <= 768 ? CONFIG2.RADIUS_MOBILE : CONFIG2.RADIUS;
  }
  function getItemSize() {
    return window.innerWidth <= 768 ? CONFIG2.ITEM_SIZE_MOBILE : CONFIG2.ITEM_SIZE;
  }
  function getYRatio() {
    const width = window.innerWidth;
    if (width <= 320) return 0.8;
    if (width <= 480) return 0.7;
    if (width <= 768) return 0.6;
    return 0.5;
  }
  var isDragging = false;
  var dragStartX = 0;
  var renderPending = false;
  function scheduleRender() {
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(() => {
      renderItems();
      renderPending = false;
    });
  }
  function createMenuHTML() {
    return `
        <div class="persona-menu-overlay" id="persona-menu-overlay"></div>
        <div class="persona-menu-arc" id="persona-menu-arc">
            <div class="persona-arc-items" id="persona-arc-items"></div>
            <div class="persona-arc-center" id="persona-arc-center">
                <button class="persona-scroll-to-current" id="persona-scroll-to-current" title="\uD604\uC7AC \uD398\uB974\uC18C\uB098\uB85C \uC774\uB3D9">\u{1F3AF}</button>
                <img src="" alt="" class="persona-center-avatar" id="persona-center-avatar">
                <span class="persona-center-name" id="persona-center-name">\uD398\uB974\uC18C\uB098</span>
                <span class="persona-center-mode" id="persona-center-mode">\u2B50 \uC990\uACA8\uCC3E\uAE30</span>
            </div>
        </div>
        <button class="persona-fab" id="persona-fab" title="\uD398\uB974\uC18C\uB098 \uC804\uD658">
            <img src="" alt="" id="persona-fab-avatar">
            <span class="persona-fab-icon" id="persona-fab-icon">\u{1F464}</span>
        </button>
    `;
  }
  async function initPersonaRadialMenu() {
    if (state2.isInitialized) {
      cleanupPersonaRadialMenu();
    }
    const existing = document.getElementById("persona-radial-container");
    if (existing) existing.remove();
    const lobbyContainer = document.getElementById("chat-lobby-container");
    if (!lobbyContainer) {
      console.warn("[PersonaMenu] Lobby container not found");
      return;
    }
    const container = document.createElement("div");
    container.id = "persona-radial-container";
    container.innerHTML = createMenuHTML();
    lobbyContainer.appendChild(container);
    bindEvents();
    await loadPersonas();
    await updateFabAvatar();
    state2.isInitialized = true;
    console.debug("[PersonaMenu] Initialized");
  }
  async function loadPersonas() {
    try {
      const personas = await api.fetchPersonas();
      state2.allPersonas = personas || [];
      state2.favorites = state2.allPersonas.filter((p) => storage.isPersonaFavorite(p.key));
    } catch (e) {
      state2.allPersonas = [];
      state2.favorites = [];
    }
  }
  async function updateFabAvatar() {
    const fabAvatar = document.getElementById("persona-fab-avatar");
    const fabIcon = document.getElementById("persona-fab-icon");
    if (!fabAvatar || !fabIcon) return;
    try {
      state2.currentPersona = await api.getCurrentPersona();
      if (state2.currentPersona) {
        fabAvatar.src = `/User Avatars/${encodeURIComponent(state2.currentPersona)}`;
        fabAvatar.style.display = "block";
        fabIcon.style.display = "none";
        fabAvatar.onerror = () => {
          fabAvatar.style.display = "none";
          fabIcon.style.display = "flex";
        };
      } else {
        fabAvatar.style.display = "none";
        fabIcon.style.display = "flex";
      }
    } catch (e) {
      fabAvatar.style.display = "none";
      fabIcon.style.display = "flex";
    }
  }
  function renderItems() {
    const container = document.getElementById("persona-arc-items");
    if (!container) return;
    let items = getCurrentItems();
    if (items.length === 0 && state2.mode === "favorites") {
      state2.mode = "recent";
      items = getCurrentItems();
      updateMode();
    }
    if (items.length === 0) {
      container.innerHTML = `<div class="persona-arc-empty">\uD398\uB974\uC18C\uB098 \uC5C6\uC74C</div>`;
      updateCenterDisplay();
      updateIndicator(0, 0);
      return;
    }
    if (container.querySelector(".persona-arc-empty")) {
      container.innerHTML = "";
    }
    const maxScroll = getMaxScroll();
    state2.scrollIndex = Math.min(Math.max(0, state2.scrollIndex), maxScroll);
    const visibleCount_ = getVisibleCount();
    const visibleItems = items.slice(state2.scrollIndex, state2.scrollIndex + visibleCount_);
    updateCenterDisplay();
    const radius = getRadius();
    const itemSize = getItemSize();
    const yRatio = getYRatio();
    const itemCount = visibleItems.length;
    const paddingAngle = 0.15;
    const usableAngle = Math.PI - paddingAngle * 2;
    while (container.children.length > itemCount) {
      container.lastElementChild.remove();
    }
    while (container.children.length < itemCount) {
      const btn = document.createElement("button");
      btn.className = "persona-arc-item";
      btn.innerHTML = `<img src="" alt="" draggable="false"><span class="persona-arc-fallback">\u{1F464}</span><span class="persona-arc-label"></span>`;
      container.appendChild(btn);
    }
    visibleItems.forEach((persona, i) => {
      const btn = container.children[i];
      const progress = itemCount > 1 ? i / (itemCount - 1) : 0.5;
      const angle = Math.PI - paddingAngle - progress * usableAngle;
      const x = Math.cos(angle) * radius;
      const y = -Math.sin(angle) * radius * yRatio;
      const displayName = persona.name || persona.key.replace(/\.[^.]+$/, "");
      const distFromCenter = Math.abs(i - Math.floor(itemCount / 2));
      const maxDist = Math.floor(itemCount / 2);
      const normalizedDist = maxDist > 0 ? distFromCenter / maxDist : 0;
      const scale = Math.max(0.8, 1 - normalizedDist * 0.15);
      const opacity = Math.max(0.6, 1 - normalizedDist * 0.25);
      const zIndex = itemCount - distFromCenter;
      btn.dataset.key = persona.key;
      btn.dataset.name = displayName;
      btn.classList.toggle("is-fav", storage.isPersonaFavorite(persona.key));
      btn.classList.toggle("is-current", persona.key === state2.currentPersona);
      btn.style.setProperty("--x", `${x}px`);
      btn.style.setProperty("--y", `${y}px`);
      btn.style.setProperty("--scale", String(scale));
      btn.style.setProperty("--opacity", String(opacity));
      btn.style.setProperty("--z", String(zIndex));
      btn.style.setProperty("--size", `${itemSize}px`);
      const img = btn.querySelector("img");
      const fallback = btn.querySelector(".persona-arc-fallback");
      const newSrc = `/User Avatars/${encodeURIComponent(persona.key)}`;
      if (img.dataset.src !== newSrc) {
        img.dataset.src = newSrc;
        img.style.display = "";
        if (fallback) fallback.style.display = "";
        img.src = newSrc;
      }
      const label = btn.querySelector(".persona-arc-label");
      if (label.textContent !== displayName) label.textContent = displayName;
    });
    updateIndicator(items.length, maxScroll);
    preloadNearbyImages();
  }
  function updateIndicator(totalItems, maxScroll) {
    const centerMode = document.getElementById("persona-center-mode");
    if (!centerMode) return;
    const visibleCount = getVisibleCount();
    const modeText = state2.mode === "favorites" ? "\u2B50" : state2.mode === "recent" ? "\u{1F550}" : "\u{1F465}";
    const modeLabel = state2.mode === "favorites" ? "\uC990\uACA8\uCC3E\uAE30" : state2.mode === "recent" ? "\uCD5C\uADFC \uC0AC\uC6A9" : "\uC804\uCCB4";
    if (totalItems > visibleCount) {
      centerMode.textContent = `${modeText} ${state2.scrollIndex + 1}/${totalItems}`;
    } else {
      centerMode.textContent = `${modeText} ${modeLabel}`;
    }
  }
  function scrollToCurrentPersona() {
    const items = getCurrentItems();
    const idx = items.findIndex((p) => p.key === state2.currentPersona);
    if (idx >= 0) {
      state2.scrollIndex = Math.max(0, idx - Math.floor(getVisibleCount() / 2));
      renderItems();
    }
  }
  function preloadNearbyImages() {
    const items = getCurrentItems();
    const start = Math.max(0, state2.scrollIndex - 3);
    const end = Math.min(items.length, state2.scrollIndex + getVisibleCount() + 3);
    for (let i = start; i < end; i++) {
      const url = `/User Avatars/${encodeURIComponent(items[i].key)}`;
      if (!preloadedUrls.has(url)) {
        preloadedUrls.add(url);
        new Image().src = url;
      }
    }
  }
  function updateMode() {
    const centerMode = document.getElementById("persona-center-mode");
    if (centerMode) {
      if (state2.mode === "favorites") {
        centerMode.textContent = "\u2B50 \uC990\uACA8\uCC3E\uAE30";
      } else if (state2.mode === "recent") {
        centerMode.textContent = "\u{1F550} \uCD5C\uADFC \uC0AC\uC6A9";
      } else {
        centerMode.textContent = "\u{1F465} \uC804\uCCB4";
      }
    }
  }
  function setMode(nextMode) {
    state2.mode = nextMode;
    state2.scrollIndex = 0;
    renderItems();
    updateMode();
  }
  function openMenu() {
    const arc = document.getElementById("persona-menu-arc");
    const overlay = document.getElementById("persona-menu-overlay");
    const fab = document.getElementById("persona-fab");
    if (!arc || !fab) return;
    state2.isOpen = true;
    state2.scrollIndex = 0;
    const items = getCurrentItems();
    const idx = items.findIndex((p) => p.key === state2.currentPersona);
    if (idx >= 0) {
      state2.scrollIndex = Math.max(0, idx - Math.floor(getVisibleCount() / 2));
    }
    arc.classList.add("open");
    if (overlay) overlay.classList.add("open");
    fab.classList.add("open");
    renderItems();
    updateMode();
  }
  function closeMenu() {
    const arc = document.getElementById("persona-menu-arc");
    const overlay = document.getElementById("persona-menu-overlay");
    const fab = document.getElementById("persona-fab");
    if (!arc || !fab) return;
    state2.isOpen = false;
    state2.mode = "favorites";
    state2.scrollIndex = 0;
    arc.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
    fab.classList.remove("open");
  }
  function toggleMode() {
    const next = state2.mode === "favorites" ? "recent" : state2.mode === "recent" ? "all" : "favorites";
    setMode(next);
  }
  function hapticTick() {
    try {
      if (navigator.vibrate) navigator.vibrate(5);
    } catch (e) {
    }
  }
  function setScrollIndex(newIndex) {
    const maxScroll = getMaxScroll();
    const clamped = Math.max(0, Math.min(maxScroll, newIndex));
    if (clamped === state2.scrollIndex) return false;
    state2.scrollIndex = clamped;
    scheduleRender();
    hapticTick();
    return true;
  }
  function scrollPrev() {
    setScrollIndex(state2.scrollIndex - CONFIG2.SCROLL_STEP);
  }
  function scrollNext() {
    setScrollIndex(state2.scrollIndex + CONFIG2.SCROLL_STEP);
  }
  function handleFabClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (state2.isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }
  async function handleItemsContainerClick(e) {
    const item = e.target.closest(".persona-arc-item");
    if (!item) return;
    e.preventDefault();
    e.stopPropagation();
    if (isDragging) return;
    const key = item.dataset.key;
    if (!key) return;
    await applyPersona(key);
  }
  function handleItemsContainerError(e) {
    const img = e.target;
    if (img?.tagName !== "IMG") return;
    img.style.display = "none";
    const fallback = img.nextElementSibling;
    if (fallback) fallback.style.display = "flex";
  }
  function updateCenterDisplay() {
    const centerName = document.getElementById("persona-center-name");
    const centerAvatar = document.getElementById("persona-center-avatar");
    const centerMode = document.getElementById("persona-center-mode");
    const currentKey = state2.currentPersona;
    const persona = state2.allPersonas.find((p) => p.key === currentKey);
    if (centerName) {
      if (persona) {
        const name = persona.name || persona.key.replace(/\.[^.]+$/, "");
        centerName.textContent = name;
      } else if (currentKey) {
        centerName.textContent = currentKey.replace(/\.[^.]+$/, "");
      } else {
        centerName.textContent = "\uD398\uB974\uC18C\uB098 \uC5C6\uC74C";
      }
    }
    if (centerAvatar) {
      if (currentKey) {
        centerAvatar.src = `/User Avatars/${encodeURIComponent(currentKey)}`;
        centerAvatar.style.display = "block";
        centerAvatar.onerror = () => {
          centerAvatar.style.display = "none";
        };
      } else {
        centerAvatar.style.display = "none";
      }
    }
    if (centerMode) {
      if (state2.mode === "favorites") {
        centerMode.textContent = "\u2B50 \uC990\uACA8\uCC3E\uAE30";
      } else if (state2.mode === "recent") {
        centerMode.textContent = "\u{1F550} \uCD5C\uADFC \uC0AC\uC6A9";
      } else {
        centerMode.textContent = "\u{1F465} \uC804\uCCB4";
      }
    }
  }
  async function applyPersona(key) {
    try {
      await api.setPersona(key);
      storage.recordPersonaUsage(key);
      showToast(`\uD398\uB974\uC18C\uB098: ${key.replace(/\.[^.]+$/, "")}`, "success");
      state2.currentPersona = key;
      await updateFabAvatar();
      updateCenterDisplay();
      renderItems();
    } catch (e) {
      showToast("\uD398\uB974\uC18C\uB098 \uC804\uD658 \uC2E4\uD328", "error");
    }
  }
  function handleOverlayClick(e) {
    if (!touchMoved && !isDragging) {
      e.preventDefault();
      closeMenu();
    }
    touchMoved = false;
  }
  function handleKeydown(e) {
    if (!state2.isOpen) return;
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        closeMenu();
        break;
      case "ArrowUp":
      case "ArrowLeft":
        e.preventDefault();
        scrollPrev();
        break;
      case "ArrowDown":
      case "ArrowRight":
        e.preventDefault();
        scrollNext();
        break;
    }
  }
  function handleWheel(e) {
    if (!state2.isOpen) return;
    e.preventDefault();
    const direction = e.deltaY > 0 ? 1 : -1;
    setScrollIndex(state2.scrollIndex + direction);
  }
  var touchStartX = 0;
  var touchMoved = false;
  var lastTouchX = 0;
  var lastTouchTime = 0;
  var touchVelocity = 0;
  var momentumTimer = null;
  function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX;
    lastTouchX = touchStartX;
    lastTouchTime = Date.now();
    touchMoved = false;
    touchVelocity = 0;
    if (momentumTimer) {
      cancelAnimationFrame(momentumTimer);
      momentumTimer = null;
    }
  }
  function handleTouchMove(e) {
    if (!state2.isOpen) return;
    e.preventDefault();
    touchMoved = true;
    const currentX = e.touches[0].clientX;
    const currentTime = Date.now();
    const deltaX = lastTouchX - currentX;
    const deltaTime = currentTime - lastTouchTime;
    if (deltaTime > 0) {
      const instantVelocity = deltaX / deltaTime;
      touchVelocity = touchVelocity * 0.6 + instantVelocity * 0.4;
    }
    lastTouchX = currentX;
    lastTouchTime = currentTime;
    const threshold = 30;
    const accumulatedDelta = touchStartX - currentX;
    const steps = Math.floor(Math.abs(accumulatedDelta) / threshold);
    if (steps > 0) {
      const direction = accumulatedDelta > 0 ? 1 : -1;
      setScrollIndex(state2.scrollIndex + direction * steps);
      touchStartX = currentX;
    }
  }
  function handleTouchEnd(e) {
    if (!touchMoved) return;
    if (Math.abs(touchVelocity) > 0.3) {
      startMomentumScroll();
    }
    setTimeout(() => {
      touchMoved = false;
    }, 50);
    touchVelocity = 0;
  }
  function startMomentumScroll() {
    const friction = CONFIG2.MOMENTUM_FRICTION;
    const minVelocity = 0.05;
    let velocity = touchVelocity;
    let accumulated = 0;
    function tick() {
      velocity *= friction;
      if (Math.abs(velocity) < minVelocity) {
        momentumTimer = null;
        return;
      }
      accumulated += velocity * CONFIG2.MOMENTUM_MULTIPLIER;
      const maxScroll = getMaxScroll();
      const threshold = 30;
      if (Math.abs(accumulated) >= threshold) {
        const direction = accumulated > 0 ? 1 : -1;
        const moved = setScrollIndex(state2.scrollIndex + direction);
        if (!moved) {
          momentumTimer = null;
          return;
        }
        accumulated = 0;
      }
      momentumTimer = requestAnimationFrame(tick);
    }
    momentumTimer = requestAnimationFrame(tick);
  }
  var pcAccumulatedDrag = 0;
  function handleMouseDown(e) {
    if (!state2.isOpen) return;
    if (e.target.closest(".persona-arc-item")) return;
    isDragging = true;
    pcAccumulatedDrag = 0;
    dragStartX = e.clientX;
    e.preventDefault();
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }
  function handleMouseMove(e) {
    if (!isDragging) return;
    const deltaX = dragStartX - e.clientX;
    dragStartX = e.clientX;
    pcAccumulatedDrag += deltaX;
    const threshold = CONFIG2.ITEM_WIDTH;
    if (Math.abs(pcAccumulatedDrag) >= threshold) {
      const direction = pcAccumulatedDrag > 0 ? 1 : -1;
      setScrollIndex(state2.scrollIndex + direction);
      pcAccumulatedDrag = 0;
    }
  }
  function handleMouseUp() {
    if (isDragging) {
      isDragging = false;
      pcAccumulatedDrag = 0;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    }
  }
  function bindEvents() {
    const fab = document.getElementById("persona-fab");
    const overlay = document.getElementById("persona-menu-overlay");
    const arc = document.getElementById("persona-menu-arc");
    const center = document.getElementById("persona-arc-center");
    const scrollBtn = document.getElementById("persona-scroll-to-current");
    const itemsContainer = document.getElementById("persona-arc-items");
    const G = "radialMenu";
    listeners.add(G, fab, "click", handleFabClick);
    listeners.add(G, itemsContainer, "click", handleItemsContainerClick);
    listeners.add(G, itemsContainer, "error", handleItemsContainerError, true);
    listeners.add(G, scrollBtn, "click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      scrollToCurrentPersona();
    });
    if (overlay) {
      listeners.add(G, overlay, "click", handleOverlayClick);
      listeners.add(G, overlay, "wheel", handleWheel, { passive: false });
      listeners.add(G, overlay, "touchstart", handleTouchStart, { passive: true });
      listeners.add(G, overlay, "touchmove", handleTouchMove, { passive: false });
      listeners.add(G, overlay, "touchend", handleTouchEnd, { passive: true });
      listeners.add(G, overlay, "mousedown", handleMouseDown);
    }
    listeners.add(G, center, "click", handleCenterClick);
    if (arc) {
      listeners.add(G, arc, "wheel", handleWheel, { passive: false });
      listeners.add(G, arc, "touchstart", handleTouchStart, { passive: true });
      listeners.add(G, arc, "touchmove", handleTouchMove, { passive: false });
      listeners.add(G, arc, "touchend", handleTouchEnd, { passive: true });
      listeners.add(G, arc, "mousedown", handleMouseDown);
    }
    listeners.add(G, document, "keydown", handleKeydown);
    listeners.add(G, window, "blur", handleWindowBlur);
  }
  function handleWindowBlur() {
    if (isDragging) {
      isDragging = false;
      pcAccumulatedDrag = 0;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    }
    if (momentumTimer) {
      cancelAnimationFrame(momentumTimer);
      momentumTimer = null;
    }
  }
  function handleCenterClick(e) {
    e.preventDefault();
    e.stopPropagation();
    toggleMode();
  }
  async function refreshPersonaRadialMenu() {
    await loadPersonas();
    await updateFabAvatar();
    if (state2.isOpen) renderItems();
  }
  function cleanupPersonaRadialMenu() {
    listeners.clear("radialMenu");
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    isDragging = false;
    if (momentumTimer) {
      cancelAnimationFrame(momentumTimer);
      momentumTimer = null;
    }
    preloadedUrls.clear();
    const container = document.getElementById("persona-radial-container");
    if (container) container.remove();
    state2.isInitialized = false;
  }

  // src/data/calendarStorage.js
  var STORAGE_KEY7 = "chatLobby_calendar";
  var CURRENT_VERSION = 1;
  var _snapshotsCache = null;
  var _initialized = false;
  var _saveTimer = null;
  function lf() {
    return typeof window !== "undefined" && window.localforage || null;
  }
  function _safeRemoveLegacy() {
    try {
      localStorage.removeItem(STORAGE_KEY7);
    } catch (e) {
    }
  }
  function _loadFromLocalStorageSync() {
    try {
      const data = localStorage.getItem(STORAGE_KEY7);
      if (data) {
        const parsed = JSON.parse(data);
        return parsed.snapshots || {};
      }
    } catch (e) {
      console.error("[Calendar] localStorage load failed:", e);
    }
    return {};
  }
  function getLocalDateString(date = /* @__PURE__ */ new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  async function initCalendarStorage() {
    if (_initialized) return;
    const store2 = lf();
    try {
      if (store2) {
        const lfData = await store2.getItem(STORAGE_KEY7);
        const lfSnaps = lfData && lfData.snapshots ? lfData.snapshots : null;
        let lsSnaps = null;
        try {
          const legacy = localStorage.getItem(STORAGE_KEY7);
          if (legacy) lsSnaps = JSON.parse(legacy).snapshots || null;
        } catch (e) {
          console.warn("[Calendar] Corrupt localStorage residue ignored");
        }
        if (lfSnaps && lsSnaps) {
          _snapshotsCache = { ...lsSnaps, ...lfSnaps };
          await store2.setItem(STORAGE_KEY7, { version: CURRENT_VERSION, snapshots: _snapshotsCache });
          _safeRemoveLegacy();
          console.info("[Calendar] Merged residual localStorage into localforage (lf priority)");
        } else if (!lfSnaps && lsSnaps) {
          _snapshotsCache = lsSnaps;
          await store2.setItem(STORAGE_KEY7, { version: CURRENT_VERSION, snapshots: lsSnaps });
          _safeRemoveLegacy();
          console.info("[Calendar] Migrated localStorage \u2192 localforage(IndexedDB)");
        } else {
          _snapshotsCache = lfSnaps || {};
          if (!lsSnaps && localStorage.getItem(STORAGE_KEY7)) _safeRemoveLegacy();
        }
      } else {
        console.warn("[Calendar] window.localforage not found, using localStorage");
        _snapshotsCache = _loadFromLocalStorageSync();
      }
    } catch (e) {
      console.warn("[Calendar] init failed, fallback to localStorage:", e);
      _snapshotsCache = _loadFromLocalStorageSync();
    }
    _initialized = true;
    try {
      cleanOldSnapshots();
    } catch (e) {
    }
  }
  function _persist() {
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      _saveTimer = null;
      const payload = { version: CURRENT_VERSION, snapshots: _snapshotsCache || {} };
      const store2 = lf();
      try {
        if (store2) {
          store2.setItem(STORAGE_KEY7, payload).catch((e) => {
            console.error("[Calendar] localforage persist failed:", e);
          });
        } else {
          localStorage.setItem(STORAGE_KEY7, JSON.stringify(payload));
        }
      } catch (e) {
        console.error("[Calendar] persist failed:", e);
      }
    }, 500);
  }
  function loadSnapshots(_forceRefresh = false) {
    if (_snapshotsCache !== null) return _snapshotsCache;
    _snapshotsCache = _loadFromLocalStorageSync();
    return _snapshotsCache;
  }
  function getSnapshot(date) {
    const snapshots = loadSnapshots();
    return snapshots[date] || null;
  }
  function cleanOldSnapshots() {
    const snapshots = loadSnapshots();
    const twoYearsAgo = /* @__PURE__ */ new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const cutoff = getLocalDateString(twoYearsAgo);
    let deleted = 0;
    for (const date of Object.keys(snapshots)) {
      if (date < cutoff) {
        delete snapshots[date];
        deleted++;
      }
    }
    if (deleted > 0) {
      console.debug("[Calendar] Deleted", deleted, "old snapshots (2+ years)");
      _persist();
    }
  }
  function saveSnapshot(date, total, topChar, byChar = {}, lastChatTimes = {}, isBaseline = false) {
    const thisYear = (/* @__PURE__ */ new Date()).getFullYear();
    const jan1 = `${thisYear}-01-01`;
    if (!isBaseline && date < jan1) return;
    const snapshots = loadSnapshots();
    const existingTimes = snapshots[date]?.lastChatTimes || {};
    const mergedLastChatTimes = { ...existingTimes, ...lastChatTimes };
    snapshots[date] = { total, topChar, byChar, lastChatTimes: mergedLastChatTimes };
    _persist();
  }
  function clearAllSnapshots() {
    _snapshotsCache = {};
    if (_saveTimer) {
      clearTimeout(_saveTimer);
      _saveTimer = null;
    }
    const store2 = lf();
    try {
      if (store2) store2.removeItem(STORAGE_KEY7).catch(() => {
      });
    } catch (e) {
    }
    try {
      localStorage.removeItem(STORAGE_KEY7);
    } catch (e) {
    }
  }

  // src/ui/characterGrid.js
  init_textUtils();
  init_notifications();
  init_config();
  var isRendering = false;
  var pendingRender = null;
  var renderDebounceTimer = null;
  var pendingRenderResolvers = [];
  var isSelectingCharacter = false;
  var renderGeneration = 0;
  var INITIAL_RENDER_COUNT = 40;
  var RENDER_CHUNK_SIZE = 60;
  function resetCharacterSelectLock() {
    isSelectingCharacter = false;
  }
  function setCharacterSelectHandler(handler) {
    store.setCharacterSelectHandler(handler);
  }
  function setGroupSelectHandler(handler) {
    store.setGroupSelectHandler(handler);
  }
  function renderCharacterGrid(searchTerm = "", sortOverride = null) {
    if (renderDebounceTimer) {
      clearTimeout(renderDebounceTimer);
    }
    return new Promise((resolve) => {
      pendingRenderResolvers.push(resolve);
      renderDebounceTimer = setTimeout(async () => {
        renderDebounceTimer = null;
        const resolvers = pendingRenderResolvers;
        pendingRenderResolvers = [];
        try {
          await _doRenderCharacterGrid(searchTerm, sortOverride);
        } finally {
          resolvers.forEach((r) => r());
        }
      }, 100);
    });
  }
  async function _doRenderCharacterGrid(searchTerm = "", sortOverride = null) {
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
    renderHeroCorner(characters);
    const sortOption = sortOverride || storage.getCharSortOption();
    const sortSelect = document.getElementById("chat-lobby-char-sort");
    if (sortSelect && sortSelect.value !== sortOption) {
      sortSelect.value = sortOption;
    }
    let groups = [];
    try {
      groups = await api.getGroups();
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        groups = groups.filter((g) => (g.name || "").toLowerCase().includes(term));
      }
      if (selectedTag) {
        groups = [];
      }
    } catch (e) {
      console.warn("[CharacterGrid] Failed to load groups:", e);
    }
    if (filtered.length === 0 && groups.length === 0) {
      renderGeneration++;
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
    const allItems = [
      ...filtered.map((char) => ({ type: "character", data: char })),
      ...groups.map((group) => ({ type: "group", data: group }))
    ];
    const sortedItems = await sortCharactersAndGroups(allItems, sortOption);
    const showBadges = uiPrefs.get("personaBadges");
    const renderItem = (item) => item.type === "character" ? renderCharacterCard(item.data, indexMap.get(item.data.avatar), sortOption, showBadges) : renderGroupCard(item.data, sortOption);
    const gen = ++renderGeneration;
    if (sortedItems.length <= INITIAL_RENDER_COUNT + 20) {
      container.innerHTML = sortedItems.map(renderItem).join("");
      loadChatCountsAsync(filtered, sortOption);
    } else {
      container.innerHTML = sortedItems.slice(0, INITIAL_RENDER_COUNT).map(renderItem).join("");
      loadChatCountsAsync(filtered, sortOption);
      let offset = INITIAL_RENDER_COUNT;
      const appendChunk = () => {
        if (gen !== renderGeneration) return;
        const chunk = sortedItems.slice(offset, offset + RENDER_CHUNK_SIZE);
        container.insertAdjacentHTML("beforeend", chunk.map(renderItem).join(""));
        offset += RENDER_CHUNK_SIZE;
        observeNewCards(container);
        if (offset < sortedItems.length) {
          requestAnimationFrame(appendChunk);
        }
      };
      requestAnimationFrame(appendChunk);
    }
    ensureGridDelegation();
  }
  function renderHeroCorner(characters) {
    const hero = document.getElementById("chat-lobby-hero");
    if (!hero) return;
    const enabled2 = uiPrefs.get("showHero");
    const filterActive = !!store.searchTerm || !!store.selectedTag;
    if (!enabled2 || filterActive) {
      hero.style.display = "none";
      hero.dataset.hasContent = "false";
      return;
    }
    const favAvatars = storage.getCharacterFavorites();
    const favChars = favAvatars.map((avatar) => characters.find((c) => c.avatar === avatar)).filter(Boolean).slice(0, 10);
    if (favChars.length === 0) {
      hero.style.display = "none";
      hero.dataset.hasContent = "false";
      return;
    }
    const indexMap = new Map(characters.map((c, i) => [c.avatar, i]));
    hero.innerHTML = `
        <div class="hero-title">\u2B50 \uCD5C\uC560 \uCF54\uB108</div>
        <div class="hero-list">
            ${favChars.map((char) => {
      const avatarUrl = charAvatarUrl(char.avatar);
      const chatCount = cache.get("chatCounts", char.avatar);
      const metaText = typeof chatCount === "number" && chatCount > 0 ? `\u{1F4AC} ${chatCount}\uAC1C \uCC44\uD305` : "";
      return `
                <div class="lobby-hero-card"
                     data-char-index="${indexMap.get(char.avatar)}"
                     data-char-avatar="${escapeHtml(char.avatar)}"
                     data-char-name="${escapeHtml(char.name || "")}">
                    <img src="${avatarUrl}" alt="" loading="lazy" decoding="async" draggable="false"
                         onerror="this.src='/img/ai4.png'">
                    <div class="hero-overlay">
                        <span class="hero-name">${escapeHtml(char.name || "")}</span>
                        ${metaText ? `<span class="hero-meta">${metaText}</span>` : ""}
                    </div>
                </div>`;
    }).join("")}
        </div>
    `;
    hero.style.display = "";
    hero.dataset.hasContent = "true";
    ensureHeroDelegation();
  }
  function renderCharacterCard(char, index, sortOption = "recent", showBadges = true) {
    const avatarUrl = char.avatar ? charAvatarUrl(char.avatar) : "/img/ai4.png";
    const name = char.name || "Unknown";
    const safeAvatar = escapeHtml(char.avatar || "");
    const isFav = isFavoriteChar(char);
    let personaBadge = "";
    if (showBadges) {
      const lastPersona = lastChatCache.getPersona(char.avatar);
      if (lastPersona) {
        const personaName = lastPersona.replace(/\.[^.]+$/, "");
        personaBadge = `<img class="char-persona-badge"
                src="/User Avatars/${encodeURIComponent(lastPersona)}"
                alt="" loading="lazy" decoding="async" draggable="false"
                title="\uB9C8\uC9C0\uB9C9 \uD398\uB974\uC18C\uB098: ${escapeHtml(personaName)}"
                onerror="this.remove()">`;
      }
    }
    let lastChatTimeStr = "";
    if (sortOption === "recent") {
      const lastChatTime = lastChatCache.getForSort(char);
      if (lastChatTime > 0) {
        const now = /* @__PURE__ */ new Date();
        const lastDate = new Date(lastChatTime);
        const isToday = now.toDateString() === lastDate.toDateString();
        if (isToday) {
          const hours = lastDate.getHours();
          const minutes = String(lastDate.getMinutes()).padStart(2, "0");
          lastChatTimeStr = `${hours}:${minutes}`;
        }
      }
    }
    const cachedChatCount = cache.get("chatCounts", char.avatar);
    const cachedMessageCount = cache.get("messageCounts", char.avatar);
    const hasCount = typeof cachedChatCount === "number";
    const hasMessageCount = typeof cachedMessageCount === "number";
    const chatCountText = hasCount ? cachedChatCount > 0 ? `${cachedChatCount}\uAC1C \uCC44\uD305` : "\uCC44\uD305 \uC5C6\uC74C" : "\uB85C\uB529 \uC911...";
    const messageCountText = hasMessageCount ? cachedMessageCount > 0 ? `${cachedMessageCount}\uAC1C \uBA54\uC2DC\uC9C0` : "" : "";
    const favBtn = `<button class="char-fav-btn" data-char-avatar="${safeAvatar}" title="\uC990\uACA8\uCC3E\uAE30 \uD1A0\uAE00">${isFav ? "\u2605" : "\u2606"}</button>`;
    return `
    <div class="lobby-char-card ${isFav ? "is-char-fav" : ""}" 
         data-char-index="${index}" 
         data-char-avatar="${safeAvatar}" 
         data-char-name="${escapeHtml(name)}"
         data-is-fav="${isFav}"
         draggable="false">
        ${favBtn}
        ${personaBadge}
        <img class="lobby-char-avatar"
             src="${avatarUrl}"
             alt="${escapeHtml(name)}"
             loading="lazy"
             decoding="async"
             draggable="false"
             onerror="this.src='/img/ai4.png'">
        <div class="lobby-char-name">
            <span class="char-name-text">${escapeHtml(name)}${lastChatTimeStr ? ` <span class="char-last-time">${lastChatTimeStr}</span>` : ""}</span>
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
  var COUNT_CONCURRENCY = 3;
  var countObserver = null;
  var countQueue = [];
  var countQueued = /* @__PURE__ */ new Set();
  var countActive = 0;
  var countSortOption = "recent";
  var snapshotTimer = null;
  function loadChatCountsAsync(characters, sortOption = "recent") {
    countSortOption = sortOption;
    const container = document.getElementById("chat-lobby-characters");
    if (!container) return;
    if (typeof IntersectionObserver === "undefined") {
      characters.forEach((char) => enqueueChatCount(char.avatar));
      return;
    }
    if (countObserver) countObserver.disconnect();
    countQueue = [];
    countQueued.clear();
    countObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        countObserver?.unobserve(entry.target);
        enqueueChatCount(entry.target.dataset.charAvatar);
      }
    }, { root: null, rootMargin: "400px 0px" });
    container.querySelectorAll(".lobby-char-card[data-char-avatar]").forEach((card) => {
      card.dataset.countObserved = "1";
      if (typeof cache.get("chatCounts", card.dataset.charAvatar) === "number") return;
      countObserver.observe(card);
    });
  }
  function observeNewCards(container) {
    if (!countObserver) return;
    container.querySelectorAll(".lobby-char-card[data-char-avatar]:not([data-count-observed])").forEach((card) => {
      card.dataset.countObserved = "1";
      if (typeof cache.get("chatCounts", card.dataset.charAvatar) === "number") return;
      countObserver.observe(card);
    });
  }
  function enqueueChatCount(avatar) {
    if (!avatar || countQueued.has(avatar)) return;
    if (typeof cache.get("chatCounts", avatar) === "number") return;
    countQueued.add(avatar);
    countQueue.push(avatar);
    pumpChatCounts();
  }
  function pumpChatCounts() {
    while (countActive < COUNT_CONCURRENCY && countQueue.length > 0) {
      const avatar = countQueue.shift();
      countActive++;
      loadOneChatCount(avatar).catch((e) => console.error("[CharacterGrid] Failed to load chat count:", avatar, e)).finally(() => {
        countActive--;
        countQueued.delete(avatar);
        if (countQueue.length > 0) {
          pumpChatCounts();
        } else if (countActive === 0) {
          scheduleSnapshot();
        }
      });
    }
  }
  function scheduleSnapshot() {
    if (snapshotTimer) clearTimeout(snapshotTimer);
    snapshotTimer = setTimeout(() => {
      snapshotTimer = null;
      saveTodaySnapshotFromCache();
    }, 1500);
  }
  async function loadOneChatCount(avatar) {
    const chats = await api.fetchChatsForCharacter(avatar);
    const chatArray = Array.isArray(chats) ? chats : typeof chats === "object" && chats ? Object.values(chats) : [];
    const count = chatArray.length;
    const messageCount2 = chatArray.reduce((sum, chat) => sum + (chat.chat_items || 0), 0);
    cache.set("chatCounts", count, avatar);
    cache.set("messageCounts", messageCount2, avatar);
    if (chatArray.length > 0) {
      await lastChatCache.refreshForCharacter(avatar, chatArray);
    }
    const card = document.querySelector(`.lobby-char-card[data-char-avatar="${CSS.escape(avatar)}"]`);
    if (!card) return;
    if (countSortOption === "recent" && chatArray.length > 0) {
      const lastTime = lastChatCache.get(avatar);
      if (lastTime > 0) {
        const lastDate = new Date(lastTime);
        if ((/* @__PURE__ */ new Date()).toDateString() === lastDate.toDateString()) {
          const nameTextEl = card.querySelector(".char-name-text");
          if (nameTextEl && !nameTextEl.querySelector(".char-last-time")) {
            const timeSpan = document.createElement("span");
            timeSpan.className = "char-last-time";
            timeSpan.textContent = ` ${lastDate.getHours()}:${String(lastDate.getMinutes()).padStart(2, "0")}`;
            nameTextEl.appendChild(timeSpan);
          }
        }
      }
    }
    const chatValueEl = card.querySelector(".chat-count-value");
    if (chatValueEl) {
      chatValueEl.textContent = count > 0 ? `${count}\uAC1C \uCC44\uD305` : "\uCC44\uD305 \uC5C6\uC74C";
    }
    const hoverInfo = card.querySelector(".char-hover-info");
    if (hoverInfo && messageCount2 > 0) {
      const messageRow = hoverInfo.querySelector(".message-count-value");
      if (!messageRow) {
        const newRow = document.createElement("div");
        newRow.className = "info-row";
        newRow.innerHTML = `
                <span class="info-icon">\u{1F4DD}</span>
                <span class="info-value message-count-value">${messageCount2}\uAC1C \uBA54\uC2DC\uC9C0</span>
            `;
        hoverInfo.appendChild(newRow);
      } else {
        messageRow.textContent = `${messageCount2}\uAC1C \uBA54\uC2DC\uC9C0`;
      }
    }
  }
  async function saveTodaySnapshotFromCache() {
    try {
      const today = getLocalDateString();
      const characters = api.getCharacters();
      if (!characters || characters.length === 0) return;
      const snapshots = loadSnapshots();
      const todaySnapshot = snapshots[today] || null;
      let recentSnapshot = null;
      const checkDate = /* @__PURE__ */ new Date();
      for (let i = 0; i < 7; i++) {
        checkDate.setDate(checkDate.getDate() - 1);
        const dateStr = getLocalDateString(checkDate);
        if (snapshots[dateStr]) {
          recentSnapshot = snapshots[dateStr];
          break;
        }
      }
      const byChar = {};
      let totalMessages = 0;
      characters.forEach((char) => {
        let msgCount = cache.get("messageCounts", char.avatar);
        if (typeof msgCount !== "number") {
          msgCount = todaySnapshot?.byChar?.[char.avatar] ?? recentSnapshot?.byChar?.[char.avatar] ?? 0;
        }
        if (msgCount > 0) {
          byChar[char.avatar] = msgCount;
          totalMessages += msgCount;
        }
      });
      const lastChatTimes = {};
      const todayStart = /* @__PURE__ */ new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayStartMs = todayStart.getTime();
      for (const char of characters) {
        let lastTime = lastChatCache.get(char.avatar);
        if (lastTime === 0) {
          const cachedChats = cache.get("chats", char.avatar);
          if (Array.isArray(cachedChats) && cachedChats.length > 0) {
            lastTime = lastChatCache.extractLastTime(cachedChats);
            if (lastTime > 0) lastChatCache.set(char.avatar, lastTime);
          }
        }
        if (lastTime >= todayStartMs) {
          lastChatTimes[char.avatar] = lastTime;
        }
      }
      let topChar = "";
      let maxIncrease = -Infinity;
      const baseByChar = recentSnapshot?.byChar || {};
      for (const [avatar, msgCount] of Object.entries(byChar)) {
        const prev = baseByChar[avatar] || 0;
        const increase = msgCount - prev;
        if (increase > maxIncrease) {
          maxIncrease = increase;
          topChar = avatar;
        }
      }
      if (!topChar) {
        const sorted = Object.entries(byChar).sort((a, b) => b[1] - a[1]);
        topChar = sorted[0]?.[0] || "";
      }
      saveSnapshot(today, totalMessages, topChar, byChar, lastChatTimes);
      console.debug("[CharacterGrid] Snapshot saved from cache");
    } catch (e) {
      console.error("[CharacterGrid] Failed to save snapshot:", e);
    }
  }
  function isFavoriteChar(char) {
    return storage.isCharacterFavorite(char.avatar);
  }
  async function sortCharactersAndGroups(items, sortOption) {
    if (sortOption === "chats") {
      const BATCH_SIZE = 5;
      const results = [];
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (item) => {
            if (item.type === "group") {
              const chatCount = Array.isArray(item.data.chats) ? item.data.chats.length : 0;
              const isFav = storage.isGroupFavorite(item.data.id);
              return { item, count: chatCount, isFav };
            }
            const char = item.data;
            let count = cache.get("messageCounts", char.avatar);
            if (typeof count !== "number") {
              try {
                await api.fetchChatsForCharacter(char.avatar);
                count = cache.get("messageCounts", char.avatar) || 0;
              } catch (e) {
                count = 0;
              }
            }
            return { item, count, isFav: isFavoriteChar(char) };
          })
        );
        results.push(...batchResults);
      }
      results.sort((a, b) => {
        if (a.isFav !== b.isFav) {
          return a.isFav ? -1 : 1;
        }
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        const nameA = a.item.data.name || "";
        const nameB = b.item.data.name || "";
        return nameA.localeCompare(nameB, "ko");
      });
      return results.map((r) => r.item);
    }
    const sorted = [...items];
    sorted.sort((a, b) => {
      const aFav = a.type === "character" ? isFavoriteChar(a.data) : storage.isGroupFavorite(a.data.id);
      const bFav = b.type === "character" ? isFavoriteChar(b.data) : storage.isGroupFavorite(b.data.id);
      if (aFav !== bFav) {
        return aFav ? -1 : 1;
      }
      if (sortOption === "name") {
        const nameA = a.data.name || "";
        const nameB = b.data.name || "";
        return nameA.localeCompare(nameB, "ko");
      }
      let aDate = 0;
      let bDate = 0;
      if (a.type === "character") {
        aDate = lastChatCache.getForSort(a.data);
      } else {
        aDate = a.data.date_last_chat || 0;
      }
      if (b.type === "character") {
        bDate = lastChatCache.getForSort(b.data);
      } else {
        bDate = b.data.date_last_chat || 0;
      }
      return bDate - aDate;
    });
    return sorted;
  }
  function ensureGridDelegation() {
    const grid = document.getElementById("chat-lobby-characters");
    if (!grid || grid.dataset.delegated === "true") return;
    grid.dataset.delegated = "true";
    bindDelegatedTouchClick(grid, routeGridEvent, {
      group: "characterGrid",
      debugName: "character-grid"
    });
  }
  function ensureHeroDelegation() {
    const hero = document.getElementById("chat-lobby-hero");
    if (!hero || hero.dataset.delegated === "true") return;
    hero.dataset.delegated = "true";
    bindDelegatedTouchClick(hero, routeGridEvent, {
      group: "characterGrid",
      debugName: "hero-corner"
    });
  }
  function routeGridEvent(e) {
    const favBtn = e.target.closest(".char-fav-btn");
    if (favBtn) {
      if (favBtn.classList.contains("group-fav-btn")) {
        handleGroupFavClick(favBtn);
      } else {
        handleCharFavClick(favBtn);
      }
      return true;
    }
    const groupCard = e.target.closest(".lobby-group-card");
    if (groupCard) {
      handleGroupCardClick(groupCard);
      return true;
    }
    const charCard = e.target.closest(".lobby-char-card, .lobby-hero-card");
    if (charCard) {
      handleCharCardClick(charCard);
      return true;
    }
    return false;
  }
  function handleCharFavClick(favBtn) {
    const card = favBtn.closest(".lobby-char-card");
    const charAvatar = favBtn.dataset.charAvatar || card?.dataset.charAvatar;
    if (!charAvatar) return;
    const newFavState = storage.toggleCharacterFavorite(charAvatar);
    if (card) {
      favBtn.textContent = newFavState ? "\u2605" : "\u2606";
      card.dataset.isFav = newFavState.toString();
      card.classList.toggle("is-char-fav", newFavState);
    }
    showToast(newFavState ? "\uC990\uACA8\uCC3E\uAE30\uC5D0 \uCD94\uAC00\uB428" : "\uC990\uACA8\uCC3E\uAE30\uC5D0\uC11C \uC81C\uAC70\uB428", "success");
    renderHeroCorner(api.getCharacters());
  }
  function handleGroupFavClick(favBtn) {
    const card = favBtn.closest(".lobby-group-card");
    const groupId = favBtn.dataset.groupId || card?.dataset.groupId;
    if (!groupId) return;
    const newFavState = storage.toggleGroupFavorite(groupId);
    if (card) {
      favBtn.textContent = newFavState ? "\u2605" : "\u2606";
      card.dataset.isFav = newFavState.toString();
      card.classList.toggle("is-char-fav", newFavState);
    }
    showToast(newFavState ? "\uC990\uACA8\uCC3E\uAE30\uC5D0 \uCD94\uAC00\uB428" : "\uC990\uACA8\uCC3E\uAE30\uC5D0\uC11C \uC81C\uAC70\uB428", "success");
  }
  async function handleCharCardClick(card) {
    if (store.isLobbyLocked) return;
    if (isSelectingCharacter || isRendering) return;
    const charAvatar = card.dataset.charAvatar;
    const charName = card.dataset.charName || "Unknown";
    if (!charAvatar) return;
    isSelectingCharacter = true;
    store.setLobbyLocked(true);
    try {
      const gridContainer = document.getElementById("chat-lobby-characters");
      const chatsPanel = document.getElementById("chat-lobby-chats");
      const isPanelVisible = chatsPanel?.classList.contains("visible");
      const isSameCharacter = store.currentCharacter?.avatar === charAvatar;
      if (isPanelVisible && isSameCharacter) {
        gridContainer?.querySelectorAll(".lobby-char-card.selected").forEach((el) => {
          el.classList.remove("selected");
        });
        closeChatPanel();
        return;
      }
      gridContainer?.querySelectorAll(".lobby-char-card.selected").forEach((el) => {
        el.classList.remove("selected");
      });
      const gridCard = card.classList.contains("lobby-hero-card") ? gridContainer?.querySelector(`.lobby-char-card[data-char-avatar="${CSS.escape(charAvatar)}"]`) : card;
      gridCard?.classList.add("selected");
      const characterData = {
        index: card.dataset.charIndex,
        avatar: charAvatar,
        name: charName,
        avatarSrc: card.querySelector(".lobby-char-avatar")?.src || charAvatarUrl(charAvatar)
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
      store.setLobbyLocked(false);
      setTimeout(() => {
        isSelectingCharacter = false;
      }, 300);
    }
  }
  async function handleGroupCardClick(card) {
    const groupId = card.dataset.groupId;
    if (!groupId) return;
    store.setLobbyLocked(true);
    try {
      const gridContainer = document.getElementById("chat-lobby-characters");
      const chatsPanel = document.getElementById("chat-lobby-chats");
      const isPanelVisible = chatsPanel?.classList.contains("visible");
      const isSameGroup = store.currentGroup?.id === groupId;
      if (isPanelVisible && isSameGroup) {
        card.classList.remove("selected");
        closeChatPanel();
        return;
      }
      if (!isSameGroup) {
        store.setCurrentGroup(null);
        store.setCurrentCharacter(null);
      }
      gridContainer?.querySelectorAll(".lobby-char-card.selected, .lobby-group-card.selected").forEach((el) => {
        el.classList.remove("selected");
      });
      card.classList.add("selected");
      const groups = await api.getGroups();
      const group = groups.find((g) => g.id === groupId);
      if (group) {
        const handler = store.onGroupSelect;
        if (handler && typeof handler === "function") {
          await handler(group);
        }
      }
    } catch (error) {
      console.error("[CharacterGrid] Group handler error:", error);
    } finally {
      store.setLobbyLocked(false);
    }
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
    ensureTagDelegation(container);
  }
  function ensureTagDelegation(container) {
    if (container.dataset.delegated === "true") return;
    container.dataset.delegated = "true";
    bindDelegatedTouchClick(container, (e) => {
      const item = e.target.closest(".lobby-tag-item");
      if (!item) return false;
      const tag = item.dataset.tag;
      if (store.selectedTag === tag) {
        store.setSelectedTag(null);
      } else {
        store.setSelectedTag(tag);
      }
      renderCharacterGrid(store.searchTerm);
      return true;
    }, { group: "characterGrid", debugName: "tag-bar" });
  }
  function renderGroupCard(group, sortOption = "recent") {
    const name = group.name || "Unknown Group";
    const memberCount = Array.isArray(group.members) ? group.members.length : 0;
    const chatCount = Array.isArray(group.chats) ? group.chats.length : 0;
    const isFav = storage.isGroupFavorite(group.id);
    let lastChatTimeStr = "";
    if (sortOption === "recent" && group.date_last_chat) {
      const lastTime = new Date(group.date_last_chat);
      const now = /* @__PURE__ */ new Date();
      const isToday = now.toDateString() === lastTime.toDateString();
      if (isToday) {
        const hours = lastTime.getHours();
        const minutes = String(lastTime.getMinutes()).padStart(2, "0");
        lastChatTimeStr = `${hours}:${minutes}`;
      }
    }
    const members = group.members || [];
    const avatarGridHtml = renderMemberAvatarGrid(members.slice(0, 4), memberCount);
    const favBtn = `<button class="char-fav-btn group-fav-btn" data-group-id="${escapeHtml(group.id)}" title="\uC990\uACA8\uCC3E\uAE30 \uD1A0\uAE00">${isFav ? "\u2605" : "\u2606"}</button>`;
    return `
    <div class="lobby-char-card lobby-group-card ${isFav ? "is-char-fav" : ""}" data-group-id="${escapeHtml(group.id)}" data-is-fav="${isFav}">
        ${favBtn}
        <div class="group-avatar-grid">
            ${avatarGridHtml}
        </div>
        <div class="lobby-char-name">
            <span class="char-name-text">${escapeHtml(name)}${lastChatTimeStr ? ` <span class="char-last-time">${lastChatTimeStr}</span>` : ""}</span>
            <div class="char-hover-info">
                <div class="info-row">
                    <span class="info-icon">\u{1F465}</span>
                    <span class="info-value">${memberCount}\uBA85</span>
                </div>
                <div class="info-row">
                    <span class="info-icon">\u{1F4AC}</span>
                    <span class="info-value">${chatCount}\uAC1C \uCC44\uD305</span>
                </div>
            </div>
        </div>
        <div class="group-member-badge">\u{1F465} ${memberCount}</div>
    </div>
    `;
  }
  function renderMemberAvatarGrid(members, totalCount) {
    const count = members.length;
    if (count === 0) {
      return `<div class="grid-single"><img src="/img/ai4.png" alt="\uADF8\uB8F9" draggable="false"></div>`;
    }
    if (count === 1) {
      const avatar = members[0];
      const avatarUrl = charAvatarUrl(avatar);
      return `<div class="grid-single"><img src="${avatarUrl}" alt="member" draggable="false" onerror="this.src='/img/ai4.png'"></div>`;
    }
    if (count === 2) {
      return `<div class="grid-two">${members.map((avatar) => {
        const avatarUrl = charAvatarUrl(avatar);
        return `<img src="${avatarUrl}" alt="member" draggable="false" onerror="this.src='/img/ai4.png'">`;
      }).join("")}</div>`;
    }
    if (count === 3) {
      const avatarUrl0 = charAvatarUrl(members[0]);
      const avatarUrl1 = charAvatarUrl(members[1]);
      const avatarUrl2 = charAvatarUrl(members[2]);
      return `
            <div class="grid-three">
                <div class="grid-top"><img src="${avatarUrl0}" alt="member" draggable="false" onerror="this.src='/img/ai4.png'"></div>
                <div class="grid-bottom">
                    <img src="${avatarUrl1}" alt="member" draggable="false" onerror="this.src='/img/ai4.png'">
                    <img src="${avatarUrl2}" alt="member" draggable="false" onerror="this.src='/img/ai4.png'">
                </div>
            </div>
        `;
    }
    return `<div class="grid-four">${members.slice(0, 4).map((avatar) => {
      const avatarUrl = charAvatarUrl(avatar);
      return `<img src="${avatarUrl}" alt="member" draggable="false" onerror="this.src='/img/ai4.png'">`;
    }).join("")}</div>`;
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
      item.addEventListener("click", async () => {
        const folderId = item.dataset.id;
        if (isBatchMode() && folderId && folderId !== "favorites") {
          closeFolderModal();
          await executeBatchMove(folderId);
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
            let messageCount2 = 0;
            let firstChatDate = null;
            if (Array.isArray(chats)) {
              messageCount2 = chats.reduce((sum, chat) => sum + (chat.chat_items || 0), 0);
              for (const chat of chats) {
                let chatDate = null;
                const fileName = chat.file_name || "";
                const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})/);
                if (dateMatch) {
                  chatDate = new Date(dateMatch[1]);
                }
                if (!chatDate) {
                  try {
                    const createdDate = await api.getChatCreatedDate(char.avatar, chat.file_name);
                    if (createdDate) {
                      chatDate = createdDate;
                    }
                  } catch (e) {
                  }
                }
                if (chatDate && !isNaN(chatDate.getTime())) {
                  if (!firstChatDate || chatDate < firstChatDate) {
                    firstChatDate = chatDate;
                  }
                }
              }
            }
            return { name: char.name, avatar: char.avatar, chatCount, messageCount: messageCount2, firstChatDate };
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
      const avatarUrl = char.avatar ? charAvatarUrl(char.avatar) : "/img/ai4.png";
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
    const avatarUrl = correct.avatar ? charAvatarUrl(correct.avatar) : "/img/ai4.png";
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
      const avatarUrl = r.avatar ? charAvatarUrl(r.avatar) : "/img/ai4.png";
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
    const encouragement = getEncouragement(escapeHtml(top?.name || ""));
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
    const topCharAvatarUrl = top?.avatar ? charAvatarUrl(top.avatar) : "/img/ai4.png";
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

  // src/ui/calendarView.js
  init_textUtils();
  var calendarOverlay = null;
  var THIS_YEAR = (/* @__PURE__ */ new Date()).getFullYear();
  var currentMonth = (/* @__PURE__ */ new Date()).getMonth();
  var isCalculating = false;
  var originalViewport = null;
  var currentScale = 1;
  var lastDistance = 0;
  function isCharacterExists(avatar) {
    if (!avatar) return false;
    const characters = api.getCharacters();
    if (!characters || !Array.isArray(characters)) return false;
    return characters.some((c) => c.avatar === avatar);
  }
  function findValidTopChar(snapshot) {
    if (!snapshot) return null;
    if (snapshot.topChar && isCharacterExists(snapshot.topChar)) {
      return snapshot.topChar;
    }
    if (snapshot.byChar && typeof snapshot.byChar === "object") {
      const sortedChars = Object.entries(snapshot.byChar).sort((a, b) => b[1] - a[1]);
      for (const [avatar, msgCount] of sortedChars) {
        if (isCharacterExists(avatar)) {
          return avatar;
        }
      }
    }
    return null;
  }
  async function openCalendarView() {
    if (isCalculating) return;
    isCalculating = true;
    const viewport = document.querySelector('meta[name="viewport"]');
    originalViewport = viewport?.content || null;
    if (viewport) {
      viewport.content = "width=device-width, initial-scale=1, minimum-scale=0.3, maximum-scale=3, user-scalable=yes";
    }
    try {
      if (!calendarOverlay) {
        calendarOverlay = document.createElement("div");
        calendarOverlay.id = "calendar-overlay";
        calendarOverlay.innerHTML = `
                <div class="calendar-fullscreen">
                    <div class="calendar-header">
                        <button class="calendar-close-btn" id="calendar-close">\u2190</button>
                        <div class="calendar-title-area">
                            <button class="cal-nav-btn" id="calendar-prev">\u2039</button>
                            <div class="calendar-title-text">
                                <span class="calendar-year">${THIS_YEAR}.</span>
                                <span class="calendar-month" id="calendar-title"></span>
                            </div>
                            <button class="cal-nav-btn" id="calendar-next">\u203A</button>
                        </div>
                        <button class="calendar-debug-btn" id="calendar-debug">DATA</button>
                    </div>
                    
                    <div class="calendar-main" id="calendar-main">
                        <div class="calendar-grid" id="calendar-grid"></div>
                    </div>
                </div>
                
                <!-- \uB514\uBC84\uADF8/\uC0AD\uC81C \uBAA8\uB2EC -->
                <div class="calendar-debug-modal" id="calendar-debug-modal" style="display: none;">
                    <div class="debug-modal-header">
                        <h3>Snapshot Data</h3>
                        <div class="debug-modal-actions">
                            <button class="debug-clear-btn" id="debug-clear-all">Clear All</button>
                            <button class="debug-modal-close" id="debug-modal-close">\xD7</button>
                        </div>
                    </div>
                    <div class="debug-modal-body">
                        <pre class="debug-modal-content" id="debug-modal-content"></pre>
                    </div>
                </div>
            `;
        document.body.appendChild(calendarOverlay);
        calendarOverlay.querySelector("#calendar-close").addEventListener("click", closeCalendarView);
        calendarOverlay.querySelector("#calendar-prev").addEventListener("click", () => navigateMonth(-1));
        calendarOverlay.querySelector("#calendar-next").addEventListener("click", () => navigateMonth(1));
        calendarOverlay.querySelector("#calendar-debug").addEventListener("click", showDebugModal);
        calendarOverlay.querySelector("#debug-modal-close").addEventListener("click", hideDebugModal);
        calendarOverlay.querySelector("#debug-clear-all").addEventListener("click", handleClearAll);
        const main = calendarOverlay.querySelector("#calendar-main");
        main.addEventListener("touchstart", handlePinchStart, { passive: true });
        main.addEventListener("touchmove", handlePinchMove, { passive: false });
        main.addEventListener("touchend", handleDoubleTap, { passive: true });
      }
      const existingSnapshots = loadSnapshots();
      const isFirstAccess = Object.keys(existingSnapshots).length === 0;
      if (isFirstAccess) {
        try {
          await saveBaselineSnapshot();
        } catch (e) {
          console.error("[Calendar] Failed to save baseline:", e);
        }
        alert("Calendar initialized! Come back tomorrow to see your stats.");
        isCalculating = false;
        return;
      }
      const lobbyContainer = document.getElementById("chat-lobby-container");
      if (lobbyContainer) lobbyContainer.style.display = "none";
      if (lobbyContainer?.classList.contains("light-mode")) {
        calendarOverlay.classList.add("light-mode");
        calendarOverlay.classList.remove("dark-mode");
      } else {
        calendarOverlay.classList.add("dark-mode");
        calendarOverlay.classList.remove("light-mode");
      }
      calendarOverlay.style.display = "flex";
      renderCalendar();
    } finally {
      isCalculating = false;
    }
  }
  function closeCalendarView() {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport && originalViewport) {
      viewport.content = originalViewport;
    }
    currentScale = 1;
    if (calendarOverlay) {
      const fullscreen = calendarOverlay.querySelector(".calendar-fullscreen");
      if (fullscreen) fullscreen.style.transform = "";
      const grid = calendarOverlay.querySelector(".calendar-grid");
      if (grid) {
        grid.classList.remove("zoomed-in", "zoomed-out");
      }
    }
    if (calendarOverlay) {
      calendarOverlay.style.display = "none";
      const lobbyContainer = document.getElementById("chat-lobby-container");
      if (lobbyContainer) lobbyContainer.style.display = "";
    }
  }
  function navigateMonth(delta) {
    const newMonth = currentMonth + delta;
    if (newMonth < 0 || newMonth > 11) return;
    currentMonth = newMonth;
    renderCalendar();
  }
  function getDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function handlePinchStart(e) {
    if (e.touches.length === 2) {
      lastDistance = getDistance(e.touches[0], e.touches[1]);
    }
  }
  function handlePinchMove(e) {
    if (e.touches.length !== 2) return;
    e.preventDefault();
    const distance = getDistance(e.touches[0], e.touches[1]);
    const delta = distance / lastDistance;
    currentScale = Math.min(Math.max(currentScale * delta, 0.5), 2.5);
    lastDistance = distance;
    const fullscreen = calendarOverlay.querySelector(".calendar-fullscreen");
    fullscreen.style.transform = `scale(${currentScale})`;
    fullscreen.style.transformOrigin = "top left";
    updateDetailVisibility();
  }
  function updateDetailVisibility() {
    const grid = calendarOverlay.querySelector(".calendar-grid");
    if (!grid) return;
    if (currentScale >= 1.3) {
      grid.classList.add("zoomed-in");
      grid.classList.remove("zoomed-out");
    } else if (currentScale <= 0.8) {
      grid.classList.add("zoomed-out");
      grid.classList.remove("zoomed-in");
    } else {
      grid.classList.remove("zoomed-in", "zoomed-out");
    }
  }
  function handleDoubleTap(e) {
    const fullscreen = calendarOverlay.querySelector(".calendar-fullscreen");
    if (fullscreen && currentScale !== 1) {
      fullscreen.style.transform = `scale(${currentScale})`;
      fullscreen.style.transformOrigin = "top left";
    }
  }
  async function saveBaselineSnapshot() {
    const yesterday = getLocalDateString(new Date(Date.now() - 864e5));
    let characters = cache.get("characters");
    if (!characters || characters.length === 0) {
      characters = api.getCharacters();
    }
    if (!characters || !Array.isArray(characters) || characters.length === 0) {
      console.warn("[Calendar] No characters found for baseline");
      return;
    }
    const BATCH_SIZE = 5;
    const rankings = [];
    for (let i = 0; i < characters.length; i += BATCH_SIZE) {
      const batch = characters.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (char) => {
          let chats;
          try {
            chats = await api.fetchChatsForCharacter(char.avatar, true);
          } catch {
            chats = [];
          }
          const chatCount = Array.isArray(chats) ? chats.length : 0;
          const messageCount2 = Array.isArray(chats) ? chats.reduce((sum, chat) => sum + (chat.chat_items || 0), 0) : 0;
          return { avatar: char.avatar, chatCount, messageCount: messageCount2 };
        })
      );
      rankings.push(...batchResults);
      if (i + BATCH_SIZE < characters.length) {
        await new Promise((r) => setTimeout(r, 10));
      }
    }
    rankings.sort((a, b) => b.messageCount - a.messageCount);
    const totalMessages = rankings.reduce((sum, r) => sum + r.messageCount, 0);
    const byChar = {};
    rankings.forEach((r) => {
      byChar[r.avatar] = r.messageCount;
    });
    const lastChatTimes = {};
    const yesterdayDate = /* @__PURE__ */ new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    yesterdayDate.setHours(0, 0, 0, 0);
    const yesterdayStartMs = yesterdayDate.getTime();
    const todayDate = /* @__PURE__ */ new Date();
    todayDate.setHours(0, 0, 0, 0);
    const todayStartMs = todayDate.getTime();
    rankings.forEach((r) => {
      const lastTime = lastChatCache.get(r.avatar);
      if (lastTime >= yesterdayStartMs && lastTime < todayStartMs) {
        lastChatTimes[r.avatar] = lastTime;
      }
    });
    const topChar = rankings[0]?.avatar || "";
    saveSnapshot(yesterday, totalMessages, topChar, byChar, lastChatTimes, true);
  }
  function findRecentSnapshot(beforeDate, maxDays = 7) {
    const snapshots = loadSnapshots();
    let checkDate;
    if (typeof beforeDate === "string") {
      checkDate = /* @__PURE__ */ new Date(beforeDate + "T00:00:00");
    } else {
      checkDate = new Date(beforeDate);
    }
    for (let i = 0; i < maxDays; i++) {
      checkDate.setDate(checkDate.getDate() - 1);
      const dateStr = getLocalDateString(checkDate);
      if (snapshots[dateStr]) {
        return { date: dateStr, snapshot: snapshots[dateStr] };
      }
    }
    return null;
  }
  function renderCalendar() {
    const title = calendarOverlay.querySelector("#calendar-title");
    const grid = calendarOverlay.querySelector("#calendar-grid");
    const prevBtn = calendarOverlay.querySelector("#calendar-prev");
    const nextBtn = calendarOverlay.querySelector("#calendar-next");
    title.textContent = currentMonth + 1;
    prevBtn.disabled = currentMonth === 0;
    nextBtn.disabled = currentMonth === 11;
    const firstDay = new Date(THIS_YEAR, currentMonth, 1).getDay();
    const daysInMonth = new Date(THIS_YEAR, currentMonth + 1, 0).getDate();
    const snapshots = loadSnapshots();
    let html = "";
    const today = getLocalDateString();
    for (let i = 0; i < firstDay; i++) {
      html += '<div class="cal-card cal-card-blank"></div>';
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${THIS_YEAR}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const snapshot = snapshots[date];
      const isToday = date === today;
      const hasData = !!snapshot;
      let contentHtml = "";
      const validTopChar = hasData ? findValidTopChar(snapshot) : null;
      if (hasData && validTopChar) {
        const avatarUrl = charAvatarUrl(validTopChar);
        const charName = validTopChar.replace(/\.[^/.]+$/, "");
        const currentDate = new Date(THIS_YEAR, currentMonth, day);
        const recentData = findRecentSnapshot(currentDate);
        const prevSnapshot = recentData?.snapshot;
        const prevCharMsgs = prevSnapshot?.byChar?.[validTopChar] || 0;
        const todayCharMsgs = snapshot.byChar?.[validTopChar] || 0;
        const charIncrease = todayCharMsgs - prevCharMsgs;
        const prevTotal = prevSnapshot?.total || 0;
        const todayTotal = snapshot.total || 0;
        const totalIncrease = todayTotal - prevTotal;
        const charText = charIncrease >= 0 ? `+${charIncrease}` : `${charIncrease}`;
        const totalText = totalIncrease >= 0 ? `+${totalIncrease}` : `${totalIncrease}`;
        contentHtml = `
                <img class="cal-card-avatar" src="${avatarUrl}" alt="" onerror="this.style.opacity='0'">
                <div class="cal-card-day">${day}</div>
                <div class="cal-card-gradient"></div>
                <div class="cal-card-info">
                    <div class="cal-card-name">${escapeHtml(charName)}</div>
                    <div class="cal-card-count">${charText}/${totalText}</div>
                </div>
            `;
      } else if (hasData && !validTopChar) {
        const currentDate = new Date(THIS_YEAR, currentMonth, day);
        const recentData = findRecentSnapshot(currentDate);
        const prevSnapshot = recentData?.snapshot;
        const prevTotal = prevSnapshot?.total || 0;
        const todayTotal = snapshot.total || 0;
        const totalIncrease = todayTotal - prevTotal;
        const totalText = totalIncrease >= 0 ? `+${totalIncrease}` : `${totalIncrease}`;
        contentHtml = `
                <div class="cal-card-day">${day}</div>
                <div class="cal-card-info cal-card-info-only">
                    <div class="cal-card-name" style="opacity: 0.5;">\uC0AD\uC81C\uB428</div>
                    <div class="cal-card-count">-/${totalText}</div>
                </div>
            `;
      } else {
        contentHtml = `<div class="cal-card-empty">${day}</div>`;
      }
      html += `
            <div class="cal-card ${isToday ? "today" : ""} ${hasData ? "has-data" : ""}" data-date="${date}">
                ${contentHtml}
            </div>
        `;
    }
    grid.innerHTML = html;
    grid.querySelectorAll(".cal-card.has-data").forEach((card) => {
      card.addEventListener("click", () => {
        const date = card.dataset.date;
        showLastMessagePanel(date);
      });
    });
  }
  var isLastMessagePanelOpen = false;
  function showLastMessagePanel(date) {
    if (isLastMessagePanelOpen) {
      closeLastMessagePanel();
      return;
    }
    let panel = document.getElementById("calendar-lastmsg-panel");
    if (panel) {
      panel.remove();
    }
    const snapshot = getSnapshot(date);
    if (!snapshot) return;
    const [year, month, day] = date.split("-");
    const dateStr = `${parseInt(month)}/${parseInt(day)}`;
    const snapshotLastChatTimes = snapshot.lastChatTimes || {};
    const allSortedByTime = Object.entries(snapshotLastChatTimes).sort((a, b) => b[1] - a[1]);
    const topChars = [];
    for (const [avatar, time] of allSortedByTime) {
      if (!isCharacterExists(avatar)) {
        console.debug("[LastMessage] Skipping deleted character:", avatar);
        continue;
      }
      topChars.push({ avatar, lastChatTime: time });
      if (topChars.length >= 3) break;
    }
    let cardsHtml = "";
    if (topChars.length === 0) {
      cardsHtml = '<div class="lastmsg-no-data">No character data</div>';
    } else {
      topChars.forEach((char) => {
        const avatarUrl = charAvatarUrl(char.avatar);
        const charName = char.avatar.replace(/\.[^/.]+$/, "");
        const timeStr = char.lastChatTime > 0 ? formatLastChatTime(char.lastChatTime) : "-";
        cardsHtml += `
                <div class="lastmsg-card">
                    <img class="lastmsg-avatar" src="${avatarUrl}" alt="" onerror="this.style.opacity='0.3'">
                    <div class="lastmsg-name">${escapeHtml(charName)}</div>
                    <div class="lastmsg-stats">
                        <div class="lastmsg-label">Last Chat</div>
                        <div class="lastmsg-time">${timeStr}</div>
                    </div>
                </div>
            `;
      });
    }
    panel = document.createElement("div");
    panel.id = "calendar-lastmsg-panel";
    panel.className = "lastmsg-panel slide-up";
    panel.innerHTML = `
        <div class="lastmsg-panel-header">
            <h3>Last Message</h3>
            <span class="lastmsg-panel-date">${dateStr}</span>
            <button class="lastmsg-close-btn" id="lastmsg-close-btn">\u2715</button>
        </div>
        <div class="lastmsg-panel-body">
            ${cardsHtml}
        </div>
    `;
    if (calendarOverlay) {
      calendarOverlay.appendChild(panel);
    } else {
      document.body.appendChild(panel);
    }
    isLastMessagePanelOpen = true;
    requestAnimationFrame(() => {
      panel.classList.add("open");
    });
    panel.querySelector("#lastmsg-close-btn")?.addEventListener("click", () => {
      closeLastMessagePanel();
    });
  }
  function closeLastMessagePanel() {
    const panel = document.getElementById("calendar-lastmsg-panel");
    if (panel) {
      panel.classList.remove("open");
      setTimeout(() => panel.remove(), 300);
    }
    isLastMessagePanelOpen = false;
  }
  function formatLastChatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const ampm = hours < 12 ? "AM" : "PM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes} ${ampm}`;
  }
  function showDebugModal() {
    const modal = calendarOverlay.querySelector("#calendar-debug-modal");
    const content = calendarOverlay.querySelector("#debug-modal-content");
    const snapshots = loadSnapshots(true);
    const today = getLocalDateString();
    const yesterday = getLocalDateString(new Date(Date.now() - 864e5));
    const debugInfo = {
      _meta: {
        source: "localStorage",
        key: "chatLobby_calendar",
        today,
        yesterday,
        totalSnapshots: Object.keys(snapshots).length,
        hasToday: !!snapshots[today],
        hasYesterday: !!snapshots[yesterday]
      },
      snapshots
    };
    content.textContent = JSON.stringify(debugInfo, null, 2);
    modal.style.display = "flex";
  }
  function hideDebugModal() {
    calendarOverlay.querySelector("#calendar-debug-modal").style.display = "none";
  }
  function handleClearAll() {
    if (confirm("Delete all snapshot data?")) {
      clearAllSnapshots();
      hideDebugModal();
      renderCalendar();
    }
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

  // src/integration/customTheme.js
  var hamburgerObserver = null;
  var captureClickHandler = null;
  function initCustomThemeIntegration(openLobbyFn) {
    if (window._chatLobbyCustomThemeInit) return true;
    window._chatLobbyCustomThemeInit = true;
    captureClickHandler = (e) => {
      const customTavernBtn = e.target.closest('[data-drawer-id="st-chatlobby-sidebar-btn"]');
      if (customTavernBtn) {
        e.preventDefault();
        e.stopPropagation();
        openLobbyFn();
        return;
      }
    };
    document.addEventListener("click", captureClickHandler, true);
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
      btn.querySelector(".drawer-toggle").addEventListener("click", () => openLobbyFn());
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
        openLobbyFn();
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
  function cleanupCustomThemeIntegration() {
    if (captureClickHandler) {
      document.removeEventListener("click", captureClickHandler, true);
      captureClickHandler = null;
    }
    if (hamburgerObserver) {
      hamburgerObserver.disconnect();
      hamburgerObserver = null;
    }
    window._chatLobbyCustomThemeInit = false;
  }

  // src/index.js
  init_textUtils();

  // src/safety/saveGuard.js
  var TARGETS = {
    char: {
      savePath: "/api/chats/save",
      getPath: "/api/chats/get",
      label: (p) => p.file_name,
      key: (p) => `${p.avatar_url}::${p.file_name}`,
      getBody: (p) => ({ ch_name: p.ch_name, file_name: p.file_name, avatar_url: p.avatar_url }),
      rename: (p, name) => ({ ...p, file_name: name, force: false }),
      currentName: (p) => p.file_name
    },
    group: {
      savePath: "/api/chats/group/save",
      getPath: "/api/chats/group/get",
      label: (p) => p.id,
      key: (p) => `group::${p.id}`,
      getBody: (p) => ({ id: p.id }),
      rename: (p, name) => ({ ...p, id: name, force: false }),
      currentName: (p) => p.id
    }
  };
  var MAX_RECOVERIES = 2;
  var RECOVERY_WINDOW_MS = 6e4;
  var rawFetch = null;
  var originalFetch = null;
  var guardedFetch = null;
  var enabled = true;
  var recoveryLog = /* @__PURE__ */ new Map();
  var recoveryTimer = null;
  function messageCount(chat) {
    return Array.isArray(chat) && chat.length > 0 ? chat.length - 1 : 0;
  }
  function isSameMessage(a, b) {
    if (!a || !b) return false;
    return String(a.send_date ?? "") === String(b.send_date ?? "") && String(a.mes ?? "") === String(b.mes ?? "");
  }
  function needsServerCheck(payload) {
    const chat = payload?.chat;
    if (!Array.isArray(chat) || payload.force === true) return false;
    const slug = chat[0]?.chat_metadata?.integrity;
    return !slug || messageCount(chat) <= 1;
  }
  function decideSave(payload, serverChat) {
    if (!needsServerCheck(payload)) return { allow: true, reason: "normal" };
    if (!Array.isArray(serverChat)) return { allow: true, reason: "server-unknown" };
    const outgoing = payload.chat;
    const outCount = messageCount(outgoing);
    const serverCount = messageCount(serverChat);
    if (serverCount <= 1) return { allow: true, reason: "nothing-to-lose" };
    const slug = outgoing[0]?.chat_metadata?.integrity;
    const serverSlug = serverChat[0]?.chat_metadata?.integrity;
    if (!slug) return { allow: false, reason: "no-integrity" };
    if (serverSlug) {
      if (slug === serverSlug) return { allow: true, reason: "same-chat" };
      return { allow: false, reason: "integrity-mismatch" };
    }
    if (outCount === 1 && isSameMessage(outgoing[1], serverChat[1])) {
      return { allow: true, reason: "legacy-trimmed" };
    }
    return { allow: false, reason: "legacy-replaced" };
  }
  function getSaveKind(input, init) {
    if (typeof input !== "string") return null;
    if (String(init?.method || "GET").toUpperCase() !== "POST") return null;
    const path = input.split("?")[0];
    for (const [kind, target] of Object.entries(TARGETS)) {
      if (path === target.savePath || path.endsWith(target.savePath)) return kind;
    }
    return null;
  }
  async function readPayload(init) {
    const body = init?.body;
    if (typeof body === "string") return JSON.parse(body);
    if (!body) return null;
    const headers = new Headers(init.headers || {});
    if (headers.get("Content-Encoding") !== "gzip") return null;
    if (typeof DecompressionStream === "undefined") return null;
    const stream = new Blob([body]).stream().pipeThrough(new DecompressionStream("gzip"));
    return JSON.parse(await new Response(stream).text());
  }
  function getRequestHeaders() {
    const context = window.SillyTavern?.getContext?.();
    return context?.getRequestHeaders?.() || { "Content-Type": "application/json" };
  }
  async function fetchServerChat(target, payload) {
    const response = await originalFetch(target.getPath, {
      method: "POST",
      headers: getRequestHeaders(),
      cache: "no-cache",
      body: JSON.stringify(target.getBody(payload))
    });
    if (!response.ok) return null;
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }
  function notify(message, type = "warning", sticky = false) {
    const toastr = window.toastr;
    if (toastr?.[type]) {
      toastr[type](message, "Chat Lobby \uC800\uC7A5 \uAC00\uB4DC", sticky ? { timeOut: 0, extendedTimeOut: 0 } : { timeOut: 8e3 });
    } else {
      console.warn("[SaveGuard]", message);
    }
  }
  function stamp() {
    const d = /* @__PURE__ */ new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }
  async function saveRescueCopy(target, payload) {
    const rescueName = `${target.currentName(payload)} [\uBCF5\uAD6C ${stamp()}]`;
    try {
      const response = await originalFetch(target.savePath, {
        method: "POST",
        headers: getRequestHeaders(),
        cache: "no-cache",
        body: JSON.stringify(target.rename(payload, rescueName))
      });
      return response.ok ? rescueName : null;
    } catch (e) {
      console.error("[SaveGuard] Rescue copy failed:", e);
      return null;
    }
  }
  function isGenerating() {
    const stopBtn = document.getElementById("mes_stop");
    return !!stopBtn && stopBtn.offsetParent !== null;
  }
  function scheduleChatReload(fileKey) {
    const now = Date.now();
    const recent = (recoveryLog.get(fileKey) || []).filter((t) => now - t < RECOVERY_WINDOW_MS);
    if (recent.length >= MAX_RECOVERIES) {
      notify("\uCC44\uD305\uC744 \uACC4\uC18D \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4. \uC6D0\uBCF8 \uD30C\uC77C\uC740 \uBCF4\uD638 \uC911\uC774\uB2C8, \uC11C\uBC84 \uC5F0\uACB0\uC744 \uD655\uC778\uD55C \uB4A4 \uCC44\uD305\uC744 \uB2E4\uC2DC \uC5F4\uC5B4\uC8FC\uC138\uC694.", "error", true);
      return false;
    }
    recent.push(now);
    recoveryLog.set(fileKey, recent);
    if (recoveryTimer) clearTimeout(recoveryTimer);
    let waited = 0;
    const tryReload = () => {
      if (isGenerating() && waited < 6e4) {
        waited += 500;
        recoveryTimer = setTimeout(tryReload, 500);
        return;
      }
      recoveryTimer = null;
      const context = window.SillyTavern?.getContext?.();
      context?.reloadCurrentChat?.().catch?.((e) => console.error("[SaveGuard] Chat reload failed:", e));
    };
    recoveryTimer = setTimeout(tryReload, 300);
    return true;
  }
  async function handleBlocked(target, payload, reason) {
    const outCount = messageCount(payload.chat);
    const label = target.label(payload);
    console.warn("[SaveGuard] Blocked chat save:", { file: label, reason, outgoingMessages: outCount });
    let rescueName = null;
    if (outCount > 1) {
      rescueName = await saveRescueCopy(target, payload);
    }
    const willReload = scheduleChatReload(target.key(payload));
    const rescueText = rescueName ? `
\uC800\uC7A5\uD558\uB824\uB358 \uB0B4\uC6A9\uC740 "${rescueName}"\uC5D0 \uB530\uB85C \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4.` : "";
    const reloadText = willReload ? "\n\uCC44\uD305\uC744 \uB2E4\uC2DC \uBD88\uB7EC\uC635\uB2C8\uB2E4." : "";
    notify(`"${label}" \uCC44\uD305\uC774 \uB36E\uC5B4\uC368\uC9C0\uB294 \uAC83\uC744 \uB9C9\uC558\uC2B5\uB2C8\uB2E4. \uC6D0\uBCF8\uC740 \uADF8\uB300\uB85C\uC785\uB2C8\uB2E4.${rescueText}${reloadText}`);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
  async function guardedFetchImpl(input, init) {
    const kind = enabled ? getSaveKind(input, init) : null;
    if (!kind) {
      return originalFetch(input, init);
    }
    let payload = null;
    try {
      payload = await readPayload(init);
    } catch (e) {
      console.debug("[SaveGuard] Could not read save payload, passing through:", e);
    }
    if (!payload) return originalFetch(input, init);
    const target = TARGETS[kind];
    if (needsServerCheck(payload)) {
      let decision = { allow: true, reason: "check-failed" };
      try {
        const serverChat = await fetchServerChat(target, payload);
        decision = decideSave(payload, serverChat);
      } catch (e) {
        console.debug("[SaveGuard] Server check failed, passing through:", e);
      }
      if (!decision.allow) return handleBlocked(target, payload, decision.reason);
    }
    const response = await originalFetch(input, init);
    if (response.status === 400) {
      try {
        const data = await response.clone().json();
        if (data?.error === "integrity") {
          return handleBlocked(target, payload, "server-integrity");
        }
      } catch {
      }
    }
    return response;
  }
  function installSaveGuard() {
    if (guardedFetch && window.fetch === guardedFetch) return;
    rawFetch = window.fetch;
    originalFetch = (input, init) => rawFetch.call(window, input, init);
    guardedFetch = function chatLobbyGuardedFetch(input, init) {
      return guardedFetchImpl(input, init);
    };
    window.fetch = guardedFetch;
    enabled = true;
    console.info("[SaveGuard] Installed");
  }
  function uninstallSaveGuard() {
    if (!guardedFetch) return;
    if (window.fetch === guardedFetch) {
      window.fetch = rawFetch;
      guardedFetch = null;
    } else {
      enabled = false;
    }
    if (recoveryTimer) {
      clearTimeout(recoveryTimer);
      recoveryTimer = null;
    }
  }
  function setSaveGuardEnabled(value) {
    enabled = !!value;
    console.info("[SaveGuard]", enabled ? "enabled" : "disabled");
  }

  // src/ui/charInfoView.js
  init_textUtils();
  var PANEL_ID = "chat-lobby-charinfo-panel";
  var openToken = 0;
  function isCharInfoOpen() {
    return !!document.getElementById(PANEL_ID);
  }
  function closeCharInfo() {
    openToken++;
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    panel.classList.remove("open");
    setTimeout(() => panel.remove(), 250);
  }
  function field(char, key, legacyKey = key) {
    const value = char?.data?.[key] ?? char?.[legacyKey];
    return typeof value === "string" ? value : "";
  }
  function fillNames(text, charName, userName) {
    return text.replace(/\{\{char\}\}/gi, charName).replace(/\{\{user\}\}/gi, userName || "User");
  }
  function section(title, text, { open = false } = {}) {
    if (!text || !text.trim()) return "";
    return `
        <details class="charinfo-section" ${open ? "open" : ""}>
            <summary>${escapeHtml(title)}</summary>
            <div class="charinfo-text">${escapeHtml(text)}</div>
        </details>`;
  }
  async function openCharInfo(character) {
    if (!character?.avatar) return;
    const token = ++openToken;
    document.getElementById(PANEL_ID)?.remove();
    const context = api.getContext();
    const characters = context?.characters || [];
    const index = characters.findIndex((c) => c.avatar === character.avatar);
    if (index === -1) return;
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "charinfo-panel";
    panel.innerHTML = `
        <div class="charinfo-header">
            <h3>${escapeHtml(characters[index].name || character.name || "")}</h3>
            <div class="charinfo-actions">
                <button class="charinfo-edit-btn" data-action="edit-character" title="\uCE90\uB9AD\uD130\uB85C \uC774\uB3D9\uD574\uC11C \uD3B8\uC9D1">\u270F\uFE0F \uD3B8\uC9D1</button>
                <button class="charinfo-close-btn" data-action="close-charinfo" title="\uB2EB\uAE30">\u2715</button>
            </div>
        </div>
        <div class="charinfo-body"><div class="lobby-loading">\uBD88\uB7EC\uC624\uB294 \uC911...</div></div>
    `;
    const container = document.getElementById("chat-lobby-container") || document.body;
    container.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add("open"));
    try {
      if (characters[index].shallow && typeof context.unshallowCharacter === "function") {
        await context.unshallowCharacter(index);
      }
    } catch (e) {
      console.warn("[CharInfo] unshallowCharacter failed:", e);
    }
    if (token !== openToken) return;
    const char = api.getContext()?.characters?.[index];
    if (!char || char.avatar !== character.avatar) {
      closeCharInfo();
      return;
    }
    const charName = char.name || "";
    const userName = context.name1 || "";
    const fill = (text) => fillNames(text, charName, userName);
    const creator = field(char, "creator");
    const version = field(char, "character_version");
    const tags = Array.isArray(char.tags) ? char.tags : Array.isArray(char.data?.tags) ? char.data.tags : [];
    const greetings = Array.isArray(char.data?.alternate_greetings) ? char.data.alternate_greetings : [];
    const meta = [
      creator ? `\uB9CC\uB4E0 \uC0AC\uB78C: ${escapeHtml(creator)}` : "",
      version ? `\uBC84\uC804: ${escapeHtml(version)}` : "",
      greetings.length ? `\uCD94\uAC00 \uC778\uC0AC\uB9D0 ${greetings.length}\uAC1C` : ""
    ].filter(Boolean).join(" \xB7 ");
    const body = panel.querySelector(".charinfo-body");
    body.innerHTML = `
        <div class="charinfo-top">
            <img class="charinfo-avatar" src="${charAvatarUrl(char.avatar)}" alt="" onerror="this.src='/img/ai4.png'">
            <div class="charinfo-meta">
                ${meta ? `<div class="charinfo-meta-line">${meta}</div>` : ""}
                ${tags.length ? `<div class="charinfo-tags">${tags.map((t) => `<span class="charinfo-tag">${escapeHtml(String(t))}</span>`).join("")}</div>` : ""}
            </div>
        </div>
        ${section("\uC81C\uC791\uC790 \uB178\uD2B8", fill(field(char, "creator_notes", "creatorcomment")), { open: true })}
        ${section("\uC124\uBA85", fill(field(char, "description")), { open: true })}
        ${section("\uC131\uACA9", fill(field(char, "personality")))}
        ${section("\uC2DC\uB098\uB9AC\uC624", fill(field(char, "scenario")))}
        ${section("\uCCAB \uBA54\uC2DC\uC9C0", fill(field(char, "first_mes")))}
        ${greetings.map((g, i) => section(`\uCD94\uAC00 \uC778\uC0AC\uB9D0 ${i + 1}`, fill(String(g || "")))).join("")}
        ${section("\uC608\uC2DC \uB300\uD654", fill(field(char, "mes_example")))}
    `;
  }

  // src/index.js
  (function() {
    "use strict";
    installSaveGuard();
    let chatChangedCooldownTimer = null;
    let closeLobbyHandler = null;
    let lastKnownPersona = null;
    let eventHandlers = null;
    let eventsRegistered = false;
    function getCurrentCharacterAvatar() {
      const context = api.getContext();
      if (context?.characterId === void 0 || context?.characterId === null || context.characterId < 0) return null;
      const char = context.characters?.[context.characterId];
      return char?.avatar || null;
    }
    function getTodayChats() {
      const today = /* @__PURE__ */ new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.getTime();
      const result = [];
      lastChatCache.lastChatTimes.forEach((entry, avatar) => {
        const time = typeof entry === "number" ? entry : entry?.time || 0;
        if (time >= todayStart) {
          result.push({ avatar, time });
        }
      });
      return result.sort((a, b) => b.time - a.time);
    }
    function getStreak() {
      const snapshots = loadSnapshots();
      let streak = 0;
      const checkDate = /* @__PURE__ */ new Date();
      for (let i = 0; i < 365; i++) {
        const dateStr = getLocalDateString(checkDate);
        if (snapshots[dateStr] && snapshots[dateStr].total > 0) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
      return streak;
    }
    function updateFabPreview() {
      const preview = document.querySelector(".fab-preview");
      const avatar = document.querySelector(".fab-preview-avatar");
      const streakEl = document.querySelector(".fab-streak");
      if (!preview || !avatar || !streakEl) return;
      const todayChats = getTodayChats();
      const hasAvatar = todayChats.length > 0;
      if (hasAvatar) {
        const lastChar = todayChats[0];
        avatar.src = charAvatarUrl(lastChar.avatar);
        avatar.style.display = "block";
      } else {
        avatar.style.display = "none";
      }
      const streak = getStreak();
      const hasStreak = streak > 0;
      if (hasStreak) {
        streakEl.textContent = `\u{1F525} ${streak}`;
        streakEl.style.display = "block";
      } else {
        streakEl.style.display = "none";
      }
      preview.dataset.empty = !hasAvatar && !hasStreak ? "true" : "false";
    }
    let appReadyHandled = false;
    let appReadyListener = null;
    function mountShell() {
      if (window._chatLobbyInitialized) {
        console.warn("[ChatLobby] Already initialized, skipping duplicate init");
        return false;
      }
      window._chatLobbyInitialized = true;
      console.info("[ChatLobby] \u{1F680} Mounting shell...");
      removeExistingUI();
      document.body.insertAdjacentHTML("beforeend", createLobbyHTML());
      setupHandlers();
      setupEventDelegation();
      initThemeMenuEvents(() => renderCharacterGrid(store.searchTerm));
      showBootSkeleton();
      return true;
    }
    function showBootSkeleton() {
      const overlay = document.getElementById("chat-lobby-overlay");
      const container = document.getElementById("chat-lobby-container");
      const fab = document.getElementById("chat-lobby-fab");
      const grid = document.getElementById("chat-lobby-characters");
      if (overlay) overlay.style.display = "flex";
      if (container) {
        container.style.display = "flex";
        container.classList.add("is-booting");
      }
      if (fab) fab.style.display = "none";
      if (grid) {
        grid.innerHTML = Array.from(
          { length: 12 },
          () => '<div class="lobby-char-card lobby-skeleton-card" aria-hidden="true"></div>'
        ).join("");
      }
    }
    async function onAppReady() {
      if (appReadyHandled) return;
      appReadyHandled = true;
      clearBootWatchdog();
      console.info("[ChatLobby] SillyTavern ready, loading data");
      const overlay = document.getElementById("chat-lobby-overlay");
      const shouldOpen = overlay?.style.display === "flex";
      await runStep("renderStDock", renderStDock);
      await runStep("setupSillyTavernEvents", setupSillyTavernEvents);
      await runStep("addLobbyToOptionsMenu", () => addLobbyToOptionsMenu());
      await runStep("customThemeIntegration", () => initCustomThemeIntegration(openLobby));
      api.getCurrentPersona().then((p) => {
        if (p) lastKnownPersona = p;
      }).catch(() => {
      });
      await runStep("initCalendarStorage", initCalendarStorage);
      await runStep("updateFabPreview", updateFabPreview);
      document.getElementById("chat-lobby-container")?.classList.remove("is-booting");
      if (shouldOpen) {
        await runStep("openLobby", openLobby);
      } else {
        showFabOnly();
      }
      runStep("startBackgroundPreload", startBackgroundPreload);
    }
    async function runStep(name, fn) {
      try {
        await fn();
        return true;
      } catch (e) {
        console.error(`[ChatLobby] Init step "${name}" failed:`, e);
        return false;
      }
    }
    function showFabOnly() {
      const overlay = document.getElementById("chat-lobby-overlay");
      const container = document.getElementById("chat-lobby-container");
      const fab = document.getElementById("chat-lobby-fab");
      container?.classList.remove("is-booting");
      if (overlay) overlay.style.display = "none";
      if (container) container.style.display = "none";
      if (fab) fab.style.display = "flex";
    }
    const BOOT_WATCHDOG_MS = 3e4;
    let bootWatchdogTimer = null;
    function startBootWatchdog() {
      clearBootWatchdog();
      bootWatchdogTimer = setTimeout(() => {
        bootWatchdogTimer = null;
        if (appReadyHandled) return;
        console.warn("[ChatLobby] SillyTavern did not become ready in time, showing FAB only");
        showFabOnly();
      }, BOOT_WATCHDOG_MS);
    }
    function clearBootWatchdog() {
      if (bootWatchdogTimer) {
        clearTimeout(bootWatchdogTimer);
        bootWatchdogTimer = null;
      }
    }
    function whenAppReady(callback) {
      const context = window.SillyTavern?.getContext?.();
      const eventSource = context?.eventSource;
      const eventName = context?.eventTypes?.APP_INITIALIZED || context?.eventTypes?.APP_READY;
      if (eventSource && eventName) {
        appReadyListener = () => {
          callback().catch((e) => console.error("[ChatLobby] App ready handler failed:", e));
        };
        eventSource.on(eventName, appReadyListener);
        return;
      }
      waitForSillyTavern().then((ready) => {
        if (ready) callback().catch((e) => console.error("[ChatLobby] App ready handler failed:", e));
      });
    }
    function setupSillyTavernEvents() {
      const context = window.SillyTavern?.getContext?.();
      if (!context?.eventSource) {
        console.warn("[ChatLobby] SillyTavern eventSource not found");
        return;
      }
      if (eventsRegistered) {
        console.warn("[ChatLobby] Events already registered, cleaning up first");
        cleanupSillyTavernEvents();
      }
      const { eventSource, eventTypes } = context;
      const onChatChanged = () => {
        if (operationLock.isLocked) {
          console.debug("[ChatLobby] CHAT_CHANGED ignored (operation in progress:", operationLock.currentOp, ")");
          return;
        }
        if (!isLobbyOpen()) {
          cache.invalidate("characters");
          const changedAvatar = getCurrentCharacterAvatar();
          if (changedAvatar) {
            cache.invalidate("chats", changedAvatar);
            cache.invalidate("chatCounts", changedAvatar);
            cache.invalidate("messageCounts", changedAvatar);
          }
          return;
        }
        if (!store.isLobbyLocked) {
          store.setLobbyLocked(true);
        }
        if (chatChangedCooldownTimer) {
          clearTimeout(chatChangedCooldownTimer);
        }
        chatChangedCooldownTimer = setTimeout(async () => {
          cache.invalidate("characters");
          const changedAvatar = getCurrentCharacterAvatar();
          if (changedAvatar) {
            cache.invalidate("chats", changedAvatar);
            cache.invalidate("chatCounts", changedAvatar);
            cache.invalidate("messageCounts", changedAvatar);
          }
          await renderCharacterGrid(store.searchTerm);
          store.setLobbyLocked(false);
          chatChangedCooldownTimer = null;
        }, 500);
      };
      eventHandlers = {
        onCharacterDeleted: (eventData) => {
          cache.invalidate("characters");
          if (eventData?.character?.avatar) {
            lastChatCache.remove(eventData.character.avatar);
            clearCharacterCache(eventData.character.avatar);
            remindStore.removeByAvatar(eventData.character.avatar);
            highlightStore.removeByAvatar(eventData.character.avatar);
            forgetAvatarVersion(eventData.character.avatar);
            console.debug("[ChatLobby] Removed deleted character from caches:", eventData.character.avatar);
          }
          if (isLobbyOpen()) {
            renderCharacterGrid(store.searchTerm);
          }
        },
        onCharacterEdited: (eventData) => {
          cache.invalidate("characters");
          bumpAvatarVersion(eventData?.detail?.character?.avatar);
        },
        onCharacterAdded: () => {
          cache.invalidate("characters");
          if (isLobbyOpen()) {
            renderCharacterGrid(store.searchTerm);
          }
        },
        onChatChanged,
        // 🔥 메시지 전송/수신 이벤트 - 로비 밖에서 채팅해도 lastChatCache 갱신
        onMessageSent: () => {
          const context2 = api.getContext();
          if (context2?.groupId) {
            console.debug("[ChatLobby] Skipping group chat for lastChatCache");
            return;
          }
          const charAvatar = getCurrentCharacterAvatar();
          if (charAvatar) {
            lastChatCache.updateNow(charAvatar);
            console.debug("[ChatLobby] Message sent, updated lastChatCache:", charAvatar);
            updateFabPreview();
          }
        },
        onMessageReceived: (chatId, type) => {
          if (type === "first_message") {
            console.debug("[ChatLobby] Skipping first_message for lastChatCache");
            return;
          }
          const context2 = api.getContext();
          if (context2?.groupId) {
            console.debug("[ChatLobby] Skipping group chat for lastChatCache");
            return;
          }
          const charAvatar = getCurrentCharacterAvatar();
          if (charAvatar) {
            lastChatCache.updateNow(charAvatar);
            console.debug("[ChatLobby] Message received, updated lastChatCache:", charAvatar);
            updateFabPreview();
          }
        },
        // 🔥 페르소나 변경 감지 (세팅 업데이트 시)
        onSettingsUpdated: async () => {
          try {
            const currentPersona = await api.getCurrentPersona();
            if (!currentPersona || currentPersona === lastKnownPersona) return;
            console.debug("[ChatLobby] Persona changed externally:", lastKnownPersona, "\u2192", currentPersona);
            lastKnownPersona = currentPersona;
            storage.recordPersonaUsage(currentPersona);
            await refreshPersonaRadialMenu();
            await renderPersonaBar();
          } catch (e) {
          }
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
      if (eventTypes.SETTINGS_UPDATED) {
        eventSource.on(eventTypes.SETTINGS_UPDATED, eventHandlers.onSettingsUpdated);
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
        eventSource.off?.(eventTypes.SETTINGS_UPDATED, eventHandlers.onSettingsUpdated);
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
      setGroupSelectHandler((group) => {
        renderGroupChatList(group);
      });
      setChatHandlers({
        onOpen: openChat,
        onDelete: deleteChat,
        onOpenGroup: openGroupChat
      });
    }
    async function startBackgroundPreload() {
      setTimeout(async () => {
        console.debug("[ChatLobby] Starting background preload...");
        try {
          await cache.preloadPersonas(api);
          await new Promise((r) => setTimeout(r, 100));
          await cache.preloadCharacters(api);
          console.debug("[ChatLobby] Basic preload completed");
        } catch (e) {
          console.error("[ChatLobby] Preload failed:", e);
          return;
        }
        setTimeout(async () => {
          const characters = cache.get("characters");
          if (!characters || characters.length === 0) return;
          const recent = [...characters].sort((a, b) => (b.date_last_chat || 0) - (a.date_last_chat || 0)).slice(0, 3);
          console.debug("[ChatLobby] Preloading chats for", recent.length, "characters");
          for (const char of recent) {
            if (cache.isValid("chats", char.avatar)) continue;
            try {
              const chats = await api.fetchChatsForCharacter(char.avatar);
              cache.set("chats", chats, char.avatar);
              await new Promise((r) => setTimeout(r, 200));
            } catch (e) {
              console.error("[ChatLobby] Chat preload failed:", char.name, e);
            }
          }
          console.debug("[ChatLobby] Chat preload completed");
        }, 3e3);
      }, CONFIG.timing.preloadDelay);
    }
    let isOpeningLobby = false;
    async function openLobby() {
      if (isOpeningLobby) {
        return;
      }
      if (store.isLobbyOpen) {
        return;
      }
      isOpeningLobby = true;
      store.setLobbyOpen(true);
      stopRecentDomObserver();
      await cacheRecentChatsBeforeOpen();
      loadRecentChats();
      store.setLobbyLocked(true);
      const overlay = document.getElementById("chat-lobby-overlay");
      const container = document.getElementById("chat-lobby-container");
      const fab = document.getElementById("chat-lobby-fab");
      const chatsPanel = document.getElementById("chat-lobby-chats");
      try {
        if (overlay) {
          overlay.style.display = "flex";
          if (container) container.style.display = "flex";
          if (fab) fab.style.display = "none";
        }
        if (!store.onCharacterSelect) {
          console.warn("[ChatLobby] Handler not set, re-running setupHandlers");
          setupHandlers();
        }
        const currentChar = getCurrentCharacterAvatar();
        if (currentChar) {
          cache.invalidate("chats", currentChar);
          cache.invalidate("chatCounts", currentChar);
          cache.invalidate("messageCounts", currentChar);
          console.debug("[ChatLobby] Invalidated cache for current character:", currentChar);
        }
        store.resetSelection();
        resetCharacterSelectLock();
        storage.setFilterFolder("all");
        deactivateBatchMode();
        closeChatPanel();
        await Promise.all([
          renderPersonaBar(),
          renderCharacterGrid(),
          initPersonaRadialMenu()
        ]);
        bindTabEvents();
        injectContextMenuStyles();
        setupPersonaWheelScroll();
        updateFolderDropdowns();
        const currentContext = api.getContext();
        if (currentContext?.characterId !== void 0 && currentContext.characterId >= 0) {
          const currentChar2 = currentContext.characters?.[currentContext.characterId];
          if (currentChar2) {
            setTimeout(() => {
              const charCard = document.querySelector(
                `.lobby-char-card[data-char-avatar="${currentChar2.avatar}"]`
              );
              if (charCard) {
                charCard.classList.add("selected");
              }
            }, 200);
          }
        }
      } catch (e) {
        console.error("[ChatLobby] openLobby failed:", e);
        if (container) container.style.display = "none";
        if (fab) fab.style.display = "flex";
        store.setLobbyOpen(false);
        store.setLobbyLocked(false);
        showToast("\uB85C\uBE44\uB97C \uC5EC\uB294 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.", "error");
      } finally {
        isOpeningLobby = false;
        if (store.isLobbyOpen && !chatChangedCooldownTimer) {
          store.setLobbyLocked(false);
        }
      }
    }
    async function closeLobby() {
      const overlay = document.getElementById("chat-lobby-overlay");
      const container = document.getElementById("chat-lobby-container");
      const fab = document.getElementById("chat-lobby-fab");
      if (overlay) overlay.style.display = "none";
      if (container) container.style.display = "none";
      if (fab) fab.style.display = "flex";
      if (chatChangedCooldownTimer) {
        clearTimeout(chatChangedCooldownTimer);
        chatChangedCooldownTimer = null;
      }
      store.setLobbyLocked(false);
      intervalManager.clearAll();
      const sidebarBtn = document.getElementById("st-chatlobby-sidebar-btn");
      if (sidebarBtn) {
        const icon = sidebarBtn.querySelector(".drawer-icon");
        icon?.classList.remove("openIcon");
        icon?.classList.add("closedIcon");
      }
      store.setLobbyOpen(false);
      store.resetSelection();
      closeChatPanel();
      closeCharInfo();
      startRecentDomObserver();
      updateFabPreview();
    }
    let isDebugPanelOpen = false;
    function openDebugModal() {
      if (isDebugPanelOpen) {
        closeDebugModal();
        return;
      }
      let panel = document.getElementById("chat-lobby-debug-panel");
      if (panel) {
        panel.remove();
      }
      const lastChatData = {};
      if (lastChatCache.lastChatTimes) {
        lastChatCache.lastChatTimes.forEach((entry, avatar) => {
          const time = typeof entry === "number" ? entry : entry?.time || 0;
          const persona = typeof entry === "object" ? entry?.persona || null : null;
          lastChatData[avatar] = {
            time,
            persona,
            date: time > 0 ? new Date(time).toLocaleString("ko-KR") : "N/A"
          };
        });
      }
      const calendarSnapshots = loadSnapshots(true);
      const storageKeys = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("chatLobby")) {
          try {
            const value = localStorage.getItem(key);
            const parsed = JSON.parse(value);
            storageKeys[key] = {
              size: value.length,
              itemCount: typeof parsed === "object" ? Object.keys(parsed).length : 1
            };
          } catch {
            storageKeys[key] = { size: localStorage.getItem(key)?.length || 0 };
          }
        }
      }
      const debugData = {
        _\uC124\uBA85: {
          chatLobby_data: "\uD3F4\uB354 \uAD6C\uC870, \uCC44\uD305 \uBC30\uC815, \uC990\uACA8\uCC3E\uAE30, \uC815\uB82C \uC635\uC158",
          chatLobby_lastChatTimes: "\uCE90\uB9AD\uD130\uBCC4 \uB9C8\uC9C0\uB9C9 \uCC44\uD305 \uC2DC\uAC04 (\uC815\uB82C\uC6A9)",
          chatLobby_calendar: "\uB0A0\uC9DC\uBCC4 \uC2A4\uB0C5\uC0F7 (\uCE98\uB9B0\uB354 \uD788\uD2B8\uB9F5\uC6A9)"
        },
        _meta: {
          timestamp: (/* @__PURE__ */ new Date()).toLocaleString("ko-KR"),
          cacheInitialized: lastChatCache.initialized,
          totalLastChatEntries: lastChatCache.lastChatTimes?.size || 0,
          totalCalendarSnapshots: Object.keys(calendarSnapshots).length
        },
        storageKeys,
        lastChatCache: lastChatData,
        calendarSnapshots
      };
      panel = document.createElement("div");
      panel.id = "chat-lobby-debug-panel";
      panel.className = "debug-panel slide-up";
      panel.innerHTML = `
            <div class="debug-panel-header">
                <h3>\u{1F527} Debug Data</h3>
                <div class="debug-panel-actions">
                    <button class="debug-copy-btn" id="debug-copy-btn">\u{1F4CB}</button>
                    <button class="debug-clear-btn" id="debug-clear-lastchat">\u{1F5D1}\uFE0F</button>
                    <button class="debug-close-btn" id="debug-close-btn">\u2715</button>
                </div>
            </div>
            <div class="debug-panel-body">
                <pre class="debug-panel-pre">${escapeHtml(JSON.stringify(debugData, null, 2))}</pre>
            </div>
        `;
      const container = document.getElementById("chat-lobby-container");
      if (container) {
        container.appendChild(panel);
      } else {
        document.body.appendChild(panel);
      }
      isDebugPanelOpen = true;
      requestAnimationFrame(() => {
        panel.classList.add("open");
      });
      panel.querySelector("#debug-copy-btn")?.addEventListener("click", () => {
        navigator.clipboard.writeText(JSON.stringify(debugData, null, 2)).then(() => showToast("\uD074\uB9BD\uBCF4\uB4DC\uC5D0 \uBCF5\uC0AC\uB428", "success")).catch(() => showToast("\uBCF5\uC0AC \uC2E4\uD328", "error"));
      });
      panel.querySelector("#debug-clear-lastchat")?.addEventListener("click", async () => {
        const confirmed = await showConfirm("LastChatCache \uB370\uC774\uD130\uB97C \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?");
        if (confirmed) {
          lastChatCache.clear();
          showToast("LastChatCache \uC0AD\uC81C\uB428", "success");
          closeDebugModal();
        }
      });
      panel.querySelector("#debug-close-btn")?.addEventListener("click", () => {
        closeDebugModal();
      });
    }
    function closeDebugModal() {
      const panel = document.getElementById("chat-lobby-debug-panel");
      if (panel) {
        panel.classList.remove("open");
        setTimeout(() => panel.remove(), 300);
      }
      isDebugPanelOpen = false;
    }
    window.ChatLobby = window.ChatLobby || {};
    window._chatLobbyLastChatCache = lastChatCache;
    window.ChatLobby.listenerStats = () => listeners.stats();
    window.ChatLobby.saveGuard = (value = true) => setSaveGuardEnabled(value);
    function cleanup() {
      console.info("[ChatLobby] \u{1F9F9} Cleanup started");
      cleanupSillyTavernEvents();
      uninstallSaveGuard();
      clearBootWatchdog();
      if (appReadyListener) {
        const ctx = window.SillyTavern?.getContext?.();
        const eventName = ctx?.eventTypes?.APP_INITIALIZED || ctx?.eventTypes?.APP_READY;
        try {
          ctx?.eventSource?.removeListener?.(eventName, appReadyListener);
        } catch {
        }
        appReadyListener = null;
      }
      cleanupEventDelegation();
      cleanupCustomThemeIntegration();
      cleanupTooltip();
      cleanupPersonaRadialMenu();
      cleanupThemeMenu();
      intervalManager.clearAll();
      listeners.clearAll();
      if (chatChangedCooldownTimer) {
        clearTimeout(chatChangedCooldownTimer);
        chatChangedCooldownTimer = null;
      }
      eventsRegistered = false;
      window._chatLobbyInitialized = false;
      removeExistingUI();
      console.info("[ChatLobby] \u2705 Cleanup completed");
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
      await Promise.all([
        renderPersonaBar(),
        renderCharacterGrid(),
        refreshPersonaRadialMenu()
      ]);
    };
    window.chatLobbyRefresh = window.ChatLobby.refresh;
    let eventsInitialized = false;
    let refreshGridHandler = null;
    function setupEventDelegation() {
      if (eventsInitialized) return;
      eventsInitialized = true;
      listeners.add("global", document.body, "click", handleBodyClick);
      listeners.add("global", document, "keydown", handleKeydown2);
      const searchInput = document.getElementById("chat-lobby-search-input");
      listeners.add("global", searchInput, "input", (e) => handleSearch(e.target.value));
      bindDropdownEvents();
      refreshGridHandler = () => {
        renderCharacterGrid(store.searchTerm);
      };
      listeners.add("global", window, "chatlobby:refresh-grid", refreshGridHandler);
      closeLobbyHandler = () => closeLobby();
      listeners.add("global", window, "chatlobby:close", closeLobbyHandler);
      listeners.add("global", document, "lobby:select-character", async (e) => {
        const { avatar } = e.detail;
        if (!avatar) return;
        switchTab("characters");
        const charCard = document.querySelector(`.lobby-char-card[data-char-avatar="${avatar}"]`);
        if (charCard) {
          charCard.click();
        }
      });
      listeners.add("global", document, "lobby:open-folder-modal", () => {
        openFolderModal();
      });
    }
    function cleanupEventDelegation() {
      if (!eventsInitialized) return;
      listeners.clear("global");
      refreshGridHandler = null;
      closeLobbyHandler = null;
      eventsInitialized = false;
    }
    function setupPersonaWheelScroll() {
      const personaList = document.getElementById("chat-lobby-persona-list");
      if (!personaList) return;
      if (personaList.dataset.wheelBound) return;
      personaList.dataset.wheelBound = "true";
      listeners.add("global", personaList, "wheel", (e) => {
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
    function handleBodyClick(e) {
      const target = e.target;
      if (target.id === "chat-lobby-fab" || target.closest("#chat-lobby-fab")) {
        openLobby();
        return;
      }
      if (isThemeMenuOpen() && !target.closest("#chat-lobby-theme-menu") && !target.closest("#chat-lobby-theme-toggle")) {
        closeThemeMenu();
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
        handleAction(actionEl.dataset.action, actionEl, e).catch((err) => console.error("[ChatLobby] Action error:", err));
        return;
      }
    }
    async function handleAction(action, el, e) {
      switch (action) {
        case "open-lobby":
          await openLobby();
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
          await handleRefresh();
          break;
        case "new-chat":
          await startNewChat();
          break;
        case "delete-char":
          await deleteCharacter();
          break;
        case "add-persona":
          await handleAddPersona();
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
        case "batch-delete":
          await executeBatchDelete();
          break;
        case "batch-select-all":
          batchSelectAll();
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
          if (store.currentGroup) {
            await handleGoToGroup();
          } else if (store.currentCharacter) {
            await openCharInfo(store.currentCharacter);
          }
          break;
        case "edit-character":
          closeCharInfo();
          await handleGoToCharacter();
          break;
        case "close-charinfo":
          closeCharInfo();
          break;
        case "toggle-collapse":
          toggleCollapse();
          break;
        case "open-theme-menu":
        case "toggle-theme":
          toggleThemeMenu();
          break;
        case "set-theme":
          applyTheme(el.dataset.theme);
          break;
        case "random-char":
          await handleRandomCharacter();
          break;
        case "toggle-header-menu":
          toggleHeaderMenu();
          break;
        case "open-calendar":
          openCalendarView();
          break;
        case "close-calendar":
          closeCalendarView();
          break;
        case "go-to-characters":
          switchTab("characters");
          break;
        case "open-debug":
          openDebugModal();
          break;
        case "close-debug":
          closeDebugModal();
          break;
        case "switch-persona":
          await handleSwitchPersona(el);
          break;
        case "refresh-branches":
          await handleRefreshBranches();
          break;
      }
    }
    function toggleHeaderMenu() {
      const header = document.getElementById("chat-lobby-header");
      if (header) {
        header.classList.toggle("menu-open");
      }
    }
    function handleKeydown2(e) {
      if (e.key === "Escape") {
        if (closeTopRemindLayer()) {
          return;
        }
        if (isCharInfoOpen()) {
          closeCharInfo();
          return;
        }
        if (isDebugPanelOpen) {
          closeDebugModal();
          return;
        }
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
      listeners.add("global", document.getElementById("chat-lobby-char-sort"), "change", (e) => {
        handleSortChange2(e.target.value);
      });
      listeners.add("global", document.getElementById("chat-lobby-folder-filter"), "change", (e) => {
        handleFilterChange(e.target.value);
      });
      listeners.add("global", document.getElementById("chat-lobby-chat-sort"), "change", (e) => {
        handleSortChange(e.target.value);
      });
      listeners.add("global", document.getElementById("chat-lobby-chats-list"), "change", (e) => {
        if (e.target.classList.contains("chat-select-cb")) {
          updateBatchCount();
        }
      });
    }
    async function handleRefresh() {
      cache.invalidateAll();
      await api.fetchPersonas();
      try {
        const context = api.getContext();
        if (typeof context?.getCharacters === "function") {
          await context.getCharacters();
        }
      } catch (e) {
        console.warn("[ChatLobby] Failed to refresh characters:", e);
      }
      await Promise.all([
        renderPersonaBar(),
        renderCharacterGrid(),
        refreshPersonaRadialMenu()
      ]);
      showToast("\uC0C8\uB85C\uACE0\uCE68 \uC644\uB8CC", "success");
    }
    async function handleSwitchPersona(el) {
      console.debug("[ChatLobby] handleSwitchPersona called:", el);
      const personaKey = el?.dataset?.persona;
      console.debug("[ChatLobby] Persona key:", personaKey);
      if (!personaKey) {
        console.warn("[ChatLobby] No persona key found");
        return;
      }
      const success = await api.setPersona(personaKey);
      if (success) {
        storage.recordPersonaUsage(personaKey);
        lastKnownPersona = personaKey;
        const fabAvatar = document.getElementById("persona-fab-avatar");
        const fabIcon = document.getElementById("persona-fab-icon");
        if (fabAvatar && fabIcon) {
          fabAvatar.src = `/User Avatars/${encodeURIComponent(personaKey)}`;
          fabAvatar.style.display = "block";
          fabIcon.style.display = "none";
          fabAvatar.onerror = () => {
            fabAvatar.style.display = "none";
            fabIcon.style.display = "flex";
          };
        }
        await renderPersonaBar();
        await refreshPersonaRadialMenu();
        showToast("\uD398\uB974\uC18C\uB098 \uBCC0\uACBD\uB428", "success");
      } else {
        showToast("\uD398\uB974\uC18C\uB098 \uBCC0\uACBD \uC2E4\uD328", "error");
      }
    }
    async function handleRefreshBranches() {
      const currentChar = store.currentCharacter;
      if (!currentChar) {
        showToast("\uCE90\uB9AD\uD130\uB97C \uBA3C\uC800 \uC120\uD0DD\uD558\uC138\uC694", "warning");
        return;
      }
      const charAvatar = currentChar.avatar;
      const btn = document.getElementById("chat-lobby-branch-refresh");
      try {
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = '<span class="icon">\u23F3</span>';
        }
        showToast("\uBD84\uAE30 \uBD84\uC11D \uC911...", "info");
        clearCharacterCache(charAvatar);
        const chats = await api.fetchChatsForCharacter(charAvatar, true);
        if (!chats || chats.length < 2) {
          showToast("\uBD84\uAE30 \uBD84\uC11D\uC5D0\uB294 2\uAC1C \uC774\uC0C1\uC758 \uCC44\uD305\uC774 \uD544\uC694\uD569\uB2C8\uB2E4", "warning");
          return;
        }
        const branches = await analyzeBranches(charAvatar, chats, null, true);
        showToast(`\uBD84\uAE30 \uBD84\uC11D \uC644\uB8CC: ${Object.keys(branches).length}\uAC1C \uBD84\uAE30 \uBC1C\uACAC`, "success");
        if (store.currentCharacter?.avatar !== charAvatar) {
          console.debug("[ChatLobby] Character changed during branch analysis, skipping refresh");
          return;
        }
        await refreshCurrentChatList(true);
      } catch (error) {
        console.error("[ChatLobby] Failed to refresh branches:", error);
        showToast("\uBD84\uAE30 \uBD84\uC11D \uC2E4\uD328", "error");
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<span class="icon">\u{1F50D}</span>';
        }
      }
    }
    async function handleRandomCharacter() {
      const characters = api.getCharacters();
      if (!characters || characters.length === 0) {
        showToast("\uCE90\uB9AD\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4", "warning");
        return;
      }
      const randomIndex = Math.floor(Math.random() * characters.length);
      const randomChar = characters[randomIndex];
      const cards = document.querySelectorAll(".lobby-char-card");
      let targetCard = null;
      for (const card of cards) {
        if (card.dataset.charAvatar === randomChar.avatar) {
          targetCard = card;
          break;
        }
      }
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          targetCard.click();
        }, 300);
      } else {
        const onSelect = store.onCharacterSelect;
        if (onSelect) {
          onSelect({
            index: randomIndex,
            avatar: randomChar.avatar,
            name: randomChar.name,
            avatarSrc: charAvatarUrl(randomChar.avatar)
          });
        }
      }
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
        } catch (e) {
          console.error("[ChatLobby] Import check error:", e);
          isCleared = true;
          intervalManager.clear(checkInterval);
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
      const group = store.currentGroup;
      if (group) {
        await handleGoToGroup();
        return;
      }
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
      const isAlreadySelected = String(context.characterId) === String(index);
      if (!isAlreadySelected) {
        const result = await switchCharacter(index, character.avatar);
        if (result !== "ok") {
          console.warn("[ChatLobby] Character selection failed:", result);
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
    async function handleGoToGroup() {
      const group = store.currentGroup;
      if (!group) {
        console.warn("[ChatLobby] No group selected");
        return;
      }
      closeLobby();
      if (api.getContext()?.groupId !== group.id) {
        const result = await switchGroup(group.id);
        if (result !== "ok") {
          console.warn("[ChatLobby] Group selection failed:", result);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (!openDrawerSafely("rightNavHolder")) {
        const rightNavIcon = document.getElementById("rightNavDrawerIcon");
        if (rightNavIcon) rightNavIcon.click();
      }
    }
    function addLobbyToOptionsMenu(retries = 0) {
      const optionsMenu = document.getElementById("options");
      if (!optionsMenu) {
        if (retries < 50) {
          setTimeout(() => addLobbyToOptionsMenu(retries + 1), CONFIG.timing.initDelay);
        }
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
    function bootstrap() {
      let mounted = false;
      try {
        mounted = mountShell();
      } catch (e) {
        console.error("[ChatLobby] Shell mount failed:", e);
        try {
          removeExistingUI();
        } catch {
        }
        window._chatLobbyInitialized = false;
        return;
      }
      if (!mounted) return;
      startBootWatchdog();
      whenAppReady(onAppReady);
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
    } else {
      bootstrap();
    }
  })();
})();
