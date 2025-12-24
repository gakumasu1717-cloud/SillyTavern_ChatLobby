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
        charSortOption: "recent",
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
            chatCounts: 0,
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
        get(type, key = null) {
          if (key !== null) {
            return this.stores[type].get(key);
          }
          return this.stores[type];
        }
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
        invalidate(type, key = null) {
          if (key !== null) {
            this.stores[type].delete(key);
            this.timestamps[type].delete(key);
          } else if (type) {
            if (this.stores[type] instanceof Map) {
              this.stores[type].clear();
              this.timestamps[type].clear();
            } else {
              this.stores[type] = null;
              this.timestamps[type] = 0;
            }
          }
        }
        invalidateAll() {
          Object.keys(this.stores).forEach((type) => {
            this.invalidate(type);
          });
        }
        // ============================================
        // 중복 요청 방지 (같은 요청이 진행 중이면 그 Promise 반환)
        // ============================================
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
        async preloadPersonas(api2) {
          if (this.isValid("personas")) return;
          try {
            const personas = await api2.fetchPersonas();
            this.set("personas", personas);
          } catch (e) {
            console.error("[Cache] Failed to preload personas:", e);
          }
        }
        async preloadCharacters(api2) {
          if (this.isValid("characters")) return;
          try {
            const characters = await api2.fetchCharacters();
            this.set("characters", characters);
          } catch (e) {
            console.error("[Cache] Failed to preload characters:", e);
          }
        }
        // 자주 사용하는 캐릭터의 채팅 목록도 프리로딩
        async preloadRecentChats(api2, recentCharacters) {
          const promises = recentCharacters.slice(0, 5).map(async (char) => {
            if (!this.isValid("chats", char.avatar)) {
              try {
                const chats = await api2.fetchChatsForCharacter(char.avatar);
                this.set("chats", chats, char.avatar);
              } catch (e) {
              }
            }
          });
          await Promise.all(promises);
        }
      };
      cache = new CacheManager();
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
        // 데이터 로드 (메모리 캐시 우선)
        load() {
          if (this._data) return this._data;
          try {
            const saved = localStorage.getItem(CONFIG.storageKey);
            if (saved) {
              const data = JSON.parse(saved);
              this._data = { ...DEFAULT_DATA, ...data };
              return this._data;
            }
          } catch (e) {
            console.error("[Storage] Failed to load:", e);
          }
          this._data = { ...DEFAULT_DATA };
          return this._data;
        }
        // 데이터 저장
        save(data) {
          try {
            this._data = data;
            localStorage.setItem(CONFIG.storageKey, JSON.stringify(data));
          } catch (e) {
            console.error("[Storage] Failed to save:", e);
          }
        }
        // 데이터 업데이트 (load → update → save 한번에)
        update(updater) {
          const data = this.load();
          const result = updater(data);
          this.save(data);
          return result;
        }
        // 캐시 초기화 (다시 localStorage에서 읽게)
        invalidate() {
          this._data = null;
        }
        // ============================================
        // 헬퍼 메서드
        // ============================================
        getChatKey(charAvatar, chatFileName) {
          return `${charAvatar}_${chatFileName}`;
        }
        // 폴더 관련
        getFolders() {
          return this.load().folders;
        }
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
        renameFolder(folderId, newName) {
          return this.update((data) => {
            const folder = data.folders.find((f) => f.id === folderId);
            if (!folder || folder.isSystem) return false;
            folder.name = newName;
            return true;
          });
        }
        // 채팅-폴더 할당
        assignChatToFolder(charAvatar, chatFileName, folderId) {
          this.update((data) => {
            const key = this.getChatKey(charAvatar, chatFileName);
            data.chatAssignments[key] = folderId;
          });
        }
        getChatFolder(charAvatar, chatFileName) {
          const data = this.load();
          const key = this.getChatKey(charAvatar, chatFileName);
          return data.chatAssignments[key] || "uncategorized";
        }
        // 즐겨찾기
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
        isFavorite(charAvatar, chatFileName) {
          const data = this.load();
          const key = this.getChatKey(charAvatar, chatFileName);
          return data.favorites.includes(key);
        }
        // 정렬/필터 옵션
        getSortOption() {
          return this.load().sortOption || "recent";
        }
        setSortOption(option) {
          this.update((data) => {
            data.sortOption = option;
          });
        }
        getCharSortOption() {
          return this.load().charSortOption || "recent";
        }
        setCharSortOption(option) {
          this.update((data) => {
            data.charSortOption = option;
          });
        }
        getFilterFolder() {
          return this.load().filterFolder || "all";
        }
        setFilterFolder(folderId) {
          this.update((data) => {
            data.filterFolder = folderId;
          });
        }
        // 다중 채팅 이동
        moveChatsBatch(chatKeys, targetFolderId) {
          this.update((data) => {
            chatKeys.forEach((key) => {
              data.chatAssignments[key] = targetFolderId;
            });
          });
        }
      };
      storage = new StorageManager();
    }
  });

  // src/api/sillyTavern.js
  var SillyTavernAPI, api;
  var init_sillyTavern = __esm({
    "src/api/sillyTavern.js"() {
      init_cache();
      SillyTavernAPI = class {
        constructor() {
          this._context = null;
        }
        // ============================================
        // 기본 유틸
        // ============================================
        getContext() {
          if (!this._context) {
            this._context = window.SillyTavern?.getContext?.() || null;
          }
          return this._context;
        }
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
        // 페르소나 API
        // ============================================
        async fetchPersonas() {
          if (cache.isValid("personas")) {
            return cache.get("personas");
          }
          return cache.getOrFetch("personas", async () => {
            try {
              const response = await fetch("/api/avatars/get", {
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
                console.log("[API] Could not import power_user");
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
        async getCurrentPersona() {
          try {
            const personasModule = await import("../../../../personas.js");
            return personasModule.user_avatar || "";
          } catch (e) {
            return "";
          }
        }
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
        async deletePersona(personaKey) {
          const response = await fetch("/api/avatars/delete", {
            method: "POST",
            headers: this.getRequestHeaders(),
            body: JSON.stringify({ avatar: personaKey })
          });
          if (response.ok) {
            cache.invalidate("personas");
          }
          return response.ok;
        }
        // ============================================
        // 캐릭터 API
        // ============================================
        async fetchCharacters() {
          if (cache.isValid("characters")) {
            return cache.get("characters");
          }
          const context = this.getContext();
          if (!context) {
            console.error("[API] Context not available");
            return [];
          }
          const characters = context.characters || [];
          cache.set("characters", characters);
          return characters;
        }
        async selectCharacterById(index) {
          const context = this.getContext();
          if (context?.selectCharacterById) {
            await context.selectCharacterById(String(index));
          }
        }
        async deleteCharacter(charAvatar) {
          const response = await fetch("/api/characters/delete", {
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
        }
        // ============================================
        // 채팅 API
        // ============================================
        async fetchChatsForCharacter(characterAvatar, forceRefresh = false) {
          if (!characterAvatar) return [];
          if (!forceRefresh && cache.isValid("chats", characterAvatar)) {
            console.log("[API] Using cached chats for:", characterAvatar);
            return cache.get("chats", characterAvatar);
          }
          return cache.getOrFetch(`chats_${characterAvatar}`, async () => {
            try {
              const response = await fetch("/api/characters/chats", {
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
              return result;
            } catch (error) {
              console.error("[API] Failed to load chats:", error);
              return [];
            }
          });
        }
        async deleteChat(fileName, charAvatar) {
          const response = await fetch("/api/chats/delete", {
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
        }
        // 채팅 수 가져오기 (캐시 활용)
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
            return 0;
          }
        }
      };
      api = new SillyTavernAPI();
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
    const { preventDefault = true, stopPropagation = true, scrollThreshold = 10 } = options;
    let touchStartY = 0;
    let isScrolling = false;
    let touchHandled = false;
    const wrappedHandler = (e) => {
      if (isScrolling) return;
      if (preventDefault) e.preventDefault();
      if (stopPropagation) e.stopPropagation();
      handler(e);
    };
    element.addEventListener("touchstart", (e) => {
      touchHandled = false;
      isScrolling = false;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    element.addEventListener("touchmove", (e) => {
      if (Math.abs(e.touches[0].clientY - touchStartY) > scrollThreshold) {
        isScrolling = true;
      }
    }, { passive: true });
    element.addEventListener("touchend", (e) => {
      if (!isScrolling) {
        touchHandled = true;
        wrappedHandler(e);
      }
      isScrolling = false;
    });
    element.addEventListener("click", (e) => {
      if (!touchHandled) {
        wrappedHandler(e);
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
    onCharacterSelect = handler;
  }
  async function renderCharacterGrid(searchTerm = "", sortOverride = null) {
    const container = document.getElementById("chat-lobby-characters");
    if (!container) return;
    const cachedCharacters = cache.get("characters");
    if (cachedCharacters && cachedCharacters.length > 0) {
      renderCharacterList(container, cachedCharacters, searchTerm, sortOverride);
    } else {
      container.innerHTML = '<div class="lobby-loading">\uCE90\uB9AD\uD130 \uB85C\uB529 \uC911...</div>';
    }
    const characters = await api.fetchCharacters();
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
    renderCharacterList(container, characters, searchTerm, sortOverride);
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
    const originalCharacters = cache.get("characters") || characters;
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
    const isFav = !!(char.fav === true || char.fav === "true" || char.data?.extensions?.fav);
    const favBadge = isFav ? '<span class="char-fav-badge">\u2B50</span>' : "";
    return `
    <div class="lobby-char-card ${isFav ? "is-char-fav" : ""}" 
         data-char-index="${index}" 
         data-char-avatar="${safeAvatar}" 
         data-is-fav="${isFav}">
        ${favBadge}
        <img class="lobby-char-avatar" src="${avatarUrl}" alt="${name}" onerror="this.src='/img/ai4.png'">
        <div class="lobby-char-name">${escapeHtml(name)}</div>
    </div>
    `;
  }
  async function sortCharacters(characters, sortOption) {
    const isFav = (char) => !!(char.fav === true || char.fav === "true" || char.data?.extensions?.fav);
    if (sortOption === "chats") {
      const chatCounts = await Promise.all(
        characters.map(async (char) => {
          const count = await api.getChatCount(char.avatar);
          return { char, count };
        })
      );
      chatCounts.sort((a, b) => {
        if (isFav(a.char) !== isFav(b.char)) return isFav(a.char) ? -1 : 1;
        return b.count - a.count;
      });
      return chatCounts.map((item) => item.char);
    }
    const sorted = [...characters];
    sorted.sort((a, b) => {
      if (isFav(a) !== isFav(b)) return isFav(a) ? -1 : 1;
      if (sortOption === "name") {
        return (a.name || "").localeCompare(b.name || "", "ko");
      }
      if (sortOption === "created") {
        const aDate2 = a.create_date || a.date_added || 0;
        const bDate2 = b.create_date || b.date_added || 0;
        return bDate2 - aDate2;
      }
      const aDate = a.date_last_chat || a.last_mes || 0;
      const bDate = b.date_last_chat || b.last_mes || 0;
      return bDate - aDate;
    });
    return sorted;
  }
  function bindCharacterEvents(container) {
    container.querySelectorAll(".lobby-char-card").forEach((card) => {
      createTouchClickHandler(card, () => {
        container.querySelectorAll(".lobby-char-card.selected").forEach((el) => {
          el.classList.remove("selected");
        });
        card.classList.add("selected");
        if (onCharacterSelect) {
          onCharacterSelect({
            index: card.dataset.charIndex,
            avatar: card.dataset.charAvatar,
            name: card.querySelector(".lobby-char-name").textContent,
            avatarSrc: card.querySelector(".lobby-char-avatar").src
          });
        }
      }, { preventDefault: false, stopPropagation: false });
    });
  }
  function handleSortChange(sortOption) {
    storage.setCharSortOption(sortOption);
    const searchInput = document.getElementById("chat-lobby-search-input");
    const searchTerm = searchInput?.value || "";
    renderCharacterGrid(searchTerm, sortOption);
  }
  var onCharacterSelect, handleSearch;
  var init_characterGrid = __esm({
    "src/ui/characterGrid.js"() {
      init_sillyTavern();
      init_cache();
      init_storage();
      init_textUtils();
      init_eventHelpers();
      init_config();
      onCharacterSelect = null;
      handleSearch = debounce((searchTerm) => {
        renderCharacterGrid(searchTerm);
      }, CONFIG.ui.debounceWait);
    }
  });

  // src/index.js
  init_config();
  init_cache();
  init_storage();
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
                            <option value="created">\u{1F4C5} \uC0DD\uC131\uC77C\uC21C</option>
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
                    <div id="chat-lobby-batch-toolbar" style="display:none;">
                        <span id="batch-selected-count">0\uAC1C \uC120\uD0DD</span>
                        <select id="batch-move-folder">
                            <option value="">\uD3F4\uB354 \uC120\uD0DD...</option>
                        </select>
                        <button id="batch-move-btn">\uC774\uB3D9</button>
                        <button id="batch-cancel-btn">\uCDE8\uC18C</button>
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
  init_textUtils();
  init_eventHelpers();
  var isProcessingPersona = false;
  async function renderPersonaBar() {
    const container = document.getElementById("chat-lobby-persona-list");
    if (!container) return;
    const cachedPersonas = cache.get("personas");
    if (cachedPersonas && cachedPersonas.length > 0) {
      await renderPersonaList(container, cachedPersonas);
    } else {
      container.innerHTML = '<div class="lobby-loading">\uB85C\uB529 \uC911...</div>';
    }
    const personas = await api.fetchPersonas();
    if (personas.length === 0) {
      container.innerHTML = '<div class="persona-empty">\uD398\uB974\uC18C\uB098 \uC5C6\uC74C</div>';
      return;
    }
    await renderPersonaList(container, personas);
  }
  async function renderPersonaList(container, personas) {
    const currentPersona = await api.getCurrentPersona();
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
    container.querySelectorAll(".persona-item").forEach((item) => {
      const avatarImg = item.querySelector(".persona-avatar");
      const nameSpan = item.querySelector(".persona-name");
      const deleteBtn = item.querySelector(".persona-delete-btn");
      if (avatarImg) {
        createTouchClickHandler(avatarImg, async () => {
          if (isProcessingPersona) return;
          if (item.classList.contains("selected")) {
            openPersonaManagement();
          } else {
            await selectPersona(container, item);
          }
        });
        avatarImg.style.cursor = "pointer";
      }
      if (nameSpan) {
        createTouchClickHandler(nameSpan, async () => {
          if (item.classList.contains("selected")) return;
          await selectPersona(container, item);
        });
        nameSpan.style.cursor = "pointer";
      }
      if (deleteBtn) {
        deleteBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          await deletePersona(deleteBtn.dataset.persona, item.title);
        });
      }
    });
  }
  async function selectPersona(container, item) {
    if (isProcessingPersona) return;
    isProcessingPersona = true;
    try {
      container.querySelectorAll(".persona-item").forEach((el) => el.classList.remove("selected"));
      item.classList.add("selected");
      await api.setPersona(item.dataset.persona);
    } finally {
      isProcessingPersona = false;
    }
  }
  async function deletePersona(personaKey, personaName) {
    if (!confirm(`"${personaName}" \uD398\uB974\uC18C\uB098\uB97C \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?

\uC774 \uC791\uC5C5\uC740 \uB418\uB3CC\uB9B4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.`)) {
      return;
    }
    const success = await api.deletePersona(personaKey);
    if (success) {
      await renderPersonaBar();
    } else {
      alert("\uD398\uB974\uC18C\uB098 \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
    }
  }
  function openPersonaManagement() {
    const container = document.getElementById("chat-lobby-container");
    const fab = document.getElementById("chat-lobby-fab");
    if (container) container.style.display = "none";
    if (fab) fab.style.display = "flex";
    setTimeout(() => {
      const personaDrawer = document.getElementById("persona-management-button");
      if (personaDrawer) {
        const drawerIcon = personaDrawer.querySelector(".drawer-icon");
        if (drawerIcon && !drawerIcon.classList.contains("openIcon")) {
          drawerIcon.click();
        }
      }
    }, 300);
  }

  // src/index.js
  init_characterGrid();

  // src/ui/chatList.js
  init_sillyTavern();
  init_cache();
  init_storage();
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
  var currentCharacter = null;
  var batchModeActive = false;
  var onChatOpen = null;
  var onChatDelete = null;
  function setChatHandlers(handlers) {
    onChatOpen = handlers.onOpen;
    onChatDelete = handlers.onDelete;
  }
  function getCurrentCharacter() {
    return currentCharacter;
  }
  async function renderChatList(character) {
    currentCharacter = character;
    const chatsPanel = document.getElementById("chat-lobby-chats");
    const chatsList = document.getElementById("chat-lobby-chats-list");
    if (!chatsPanel || !chatsList) return;
    chatsPanel.classList.add("visible");
    updateChatHeader(character);
    showFolderBar(true);
    const cachedChats = cache.get("chats", character.avatar);
    if (cachedChats && cachedChats.length > 0) {
      renderChats(chatsList, cachedChats, character.avatar);
    } else {
      chatsList.innerHTML = '<div class="lobby-loading">\uCC44\uD305 \uB85C\uB529 \uC911...</div>';
    }
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
    return chats.filter((chat) => {
      const fn = chat.file_name || chat.fileName || "";
      const key = storage.getChatKey(charAvatar, fn);
      if (filterFolder === "favorites") {
        return data.favorites.includes(key);
      }
      const assigned = data.chatAssignments[key] || "uncategorized";
      return assigned === filterFolder;
    });
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
    return `
    <div class="lobby-chat-item ${isFav ? "is-favorite" : ""}" 
         data-file-name="${escapeHtml(fileName)}" 
         data-char-avatar="${safeAvatar}" 
         data-chat-index="${index}" 
         data-folder-id="${folderId}">
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
    container.querySelectorAll(".lobby-chat-item").forEach((item) => {
      const chatContent = item.querySelector(".chat-content");
      const favBtn = item.querySelector(".chat-fav-btn");
      const delBtn = item.querySelector(".chat-delete-btn");
      createTouchClickHandler(chatContent, () => {
        if (batchModeActive) {
          const cb = item.querySelector(".chat-select-cb");
          if (cb) {
            cb.checked = !cb.checked;
            updateBatchCount();
          }
          return;
        }
        if (onChatOpen) {
          onChatOpen({
            fileName: item.dataset.fileName,
            charAvatar: item.dataset.charAvatar,
            charIndex: currentCharacter?.index
          });
        }
      }, { preventDefault: false });
      createTouchClickHandler(favBtn, () => {
        const fn = item.dataset.fileName;
        const isNowFav = storage.toggleFavorite(charAvatar, fn);
        favBtn.textContent = isNowFav ? "\u2B50" : "\u2606";
        item.classList.toggle("is-favorite", isNowFav);
      });
      createTouchClickHandler(delBtn, () => {
        if (onChatDelete) {
          onChatDelete({
            fileName: item.dataset.fileName,
            charAvatar: item.dataset.charAvatar,
            element: item
          });
        }
      });
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
    if (deleteBtn) deleteBtn.style.display = "block";
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
    if (currentCharacter) {
      renderChatList(currentCharacter);
    }
  }
  function handleSortChange2(sortValue) {
    storage.setSortOption(sortValue);
    if (currentCharacter) {
      renderChatList(currentCharacter);
    }
  }
  function toggleBatchMode() {
    batchModeActive = !batchModeActive;
    const chatsList = document.getElementById("chat-lobby-chats-list");
    const toolbar = document.getElementById("chat-lobby-batch-toolbar");
    const batchBtn = document.getElementById("chat-lobby-batch-mode");
    if (batchModeActive) {
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
  function executeBatchMove(targetFolder) {
    if (!targetFolder) {
      alert("\uC774\uB3D9\uD560 \uD3F4\uB354\uB97C \uC120\uD0DD\uD558\uC138\uC694.");
      return;
    }
    const checked = document.querySelectorAll(".chat-select-cb:checked");
    const keys = [];
    checked.forEach((cb) => {
      const item = cb.closest(".lobby-chat-item");
      if (item) {
        const key = storage.getChatKey(item.dataset.charAvatar, item.dataset.fileName);
        keys.push(key);
      }
    });
    if (keys.length === 0) {
      alert("\uC774\uB3D9\uD560 \uCC44\uD305\uC744 \uC120\uD0DD\uD558\uC138\uC694.");
      return;
    }
    storage.moveChatsBatch(keys, targetFolder);
    toggleBatchMode();
    if (currentCharacter) {
      renderChatList(currentCharacter);
    }
  }
  async function refreshChatList() {
    if (currentCharacter) {
      cache.invalidate("chats", currentCharacter.avatar);
      await renderChatList(currentCharacter);
    }
  }
  function closeChatPanel() {
    const chatsPanel = document.getElementById("chat-lobby-chats");
    if (chatsPanel) chatsPanel.classList.remove("visible");
    currentCharacter = null;
  }

  // src/handlers/chatHandlers.js
  init_sillyTavern();
  init_cache();
  init_storage();
  async function openChat(chatInfo) {
    const { fileName, charAvatar, charIndex } = chatInfo;
    if (!charAvatar || !fileName) {
      console.error("[ChatLobby] Missing chat data");
      return;
    }
    try {
      const context = api.getContext();
      const characters = context?.characters || [];
      const index = characters.findIndex((c) => c.avatar === charAvatar);
      if (index === -1) {
        console.error("[ChatLobby] Character not found");
        return;
      }
      closeLobby();
      await api.selectCharacterById(index);
      setTimeout(async () => {
        await openChatByFileName(fileName);
      }, 300);
    } catch (error) {
      console.error("[ChatLobby] Failed to open chat:", error);
    }
  }
  async function openChatByFileName(fileName) {
    const manageChatsBtn = document.getElementById("option_select_chat");
    if (manageChatsBtn) {
      manageChatsBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 500));
      const chatItems = document.querySelectorAll(".select_chat_block .ch_name, .past_chat_block, .select_chat_block");
      for (const item of chatItems) {
        const itemText = item.textContent || item.dataset?.fileName || "";
        if (itemText.includes(fileName.replace(".jsonl", "")) || itemText.includes(fileName)) {
          item.click();
          console.log("[ChatLobby] Chat selected:", fileName);
          return;
        }
      }
      console.log("[ChatLobby] Chat not found in list:", fileName);
    }
  }
  async function deleteChat(chatInfo) {
    const { fileName, charAvatar, element } = chatInfo;
    if (!fileName || !charAvatar) {
      console.error("[ChatLobby] Missing chat data for delete");
      return;
    }
    if (!confirm(`"${fileName.replace(".jsonl", "")}" \uCC44\uD305\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?

\uC774 \uC791\uC5C5\uC740 \uB418\uB3CC\uB9B4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.`)) {
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
        if (element) {
          element.style.transition = "opacity 0.3s, transform 0.3s";
          element.style.opacity = "0";
          element.style.transform = "translateX(20px)";
          setTimeout(() => {
            element.remove();
            updateChatCountAfterDelete();
          }, 300);
        } else {
          await refreshChatList();
        }
      } else {
        alert("\uCC44\uD305 \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
      }
    } catch (error) {
      console.error("[ChatLobby] Error deleting chat:", error);
      alert("\uCC44\uD305 \uC0AD\uC81C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
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
      console.error("[ChatLobby] No character selected");
      return;
    }
    cache.invalidate("chats", charAvatar);
    closeLobby();
    await api.selectCharacterById(parseInt(charIndex));
    if (hasChats) {
      setTimeout(() => {
        const newChatBtn = document.getElementById("option_start_new_chat");
        if (newChatBtn) newChatBtn.click();
      }, 300);
    }
  }
  async function deleteCharacter() {
    const char = getCurrentCharacter();
    if (!char) return;
    if (!confirm(`"${char.name}" \uCE90\uB9AD\uD130\uB97C \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?

\uBAA8\uB4E0 \uCC44\uD305 \uAE30\uB85D\uB3C4 \uD568\uAED8 \uC0AD\uC81C\uB429\uB2C8\uB2E4.
\uC774 \uC791\uC5C5\uC740 \uB418\uB3CC\uB9B4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.`)) {
      return;
    }
    const success = await api.deleteCharacter(char.avatar);
    if (success) {
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
      const { renderCharacterGrid: renderCharacterGrid2 } = await Promise.resolve().then(() => (init_characterGrid(), characterGrid_exports));
      await renderCharacterGrid2();
    } else {
      alert("\uCE90\uB9AD\uD130 \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
    }
  }
  function closeLobby() {
    const container = document.getElementById("chat-lobby-container");
    const fab = document.getElementById("chat-lobby-fab");
    if (container) container.style.display = "none";
    if (fab) fab.style.display = "flex";
    closeChatPanel();
  }

  // src/handlers/folderHandlers.js
  init_storage();
  init_textUtils();
  function openFolderModal() {
    const modal = document.getElementById("chat-lobby-folder-modal");
    if (!modal) return;
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
    if (!name) return;
    storage.addFolder(name);
    input.value = "";
    refreshFolderList();
    updateFolderDropdowns();
  }
  function refreshFolderList() {
    const container = document.getElementById("folder-list");
    if (!container) return;
    const data = storage.load();
    const sorted = [...data.folders].sort((a, b) => a.order - b.order);
    let html = "";
    sorted.forEach((f) => {
      const isSystem = f.isSystem ? "system" : "";
      const deleteBtn = f.isSystem ? "" : `<button class="folder-delete-btn" data-id="${f.id}">\u{1F5D1}\uFE0F</button>`;
      const editBtn = f.isSystem ? "" : `<button class="folder-edit-btn" data-id="${f.id}">\u270F\uFE0F</button>`;
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
  }
  function bindFolderEvents(container) {
    container.querySelectorAll(".folder-delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const folderId = btn.dataset.id;
        if (confirm("\uC774 \uD3F4\uB354\uB97C \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?\n\uD3F4\uB354 \uC548\uC758 \uCC44\uD305\uB4E4\uC740 \uBBF8\uBD84\uB958\uB85C \uC774\uB3D9\uB429\uB2C8\uB2E4.")) {
          storage.deleteFolder(folderId);
          refreshFolderList();
          updateFolderDropdowns();
          refreshChatList();
        }
      });
    });
    container.querySelectorAll(".folder-edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const folderId = btn.dataset.id;
        const folderItem = btn.closest(".folder-item");
        const nameSpan = folderItem.querySelector(".folder-name");
        const currentName = nameSpan.textContent;
        const newName = prompt("\uC0C8 \uD3F4\uB354 \uC774\uB984:", currentName);
        if (newName && newName.trim() && newName !== currentName) {
          storage.renameFolder(folderId, newName.trim());
          refreshFolderList();
          updateFolderDropdowns();
        }
      });
    });
  }
  function updateFolderDropdowns() {
    const data = storage.load();
    const sorted = [...data.folders].sort((a, b) => a.order - b.order);
    const filterSelect = document.getElementById("chat-lobby-folder-filter");
    if (filterSelect) {
      const currentValue = filterSelect.value;
      let html = '<option value="all">\u{1F4C1} \uC804\uCCB4</option>';
      html += '<option value="favorites">\u2B50 \uC990\uACA8\uCC3E\uAE30\uB9CC</option>';
      sorted.forEach((f) => {
        if (f.id !== "favorites") {
          html += `<option value="${f.id}">${f.name}</option>`;
        }
      });
      filterSelect.innerHTML = html;
      filterSelect.value = currentValue;
    }
    const batchSelect = document.getElementById("batch-move-folder");
    if (batchSelect) {
      batchSelect.innerHTML = getBatchFoldersHTML();
    }
  }

  // src/index.js
  init_eventHelpers();
  (function() {
    "use strict";
    console.log("[ChatLobby] Loading extension...");
    async function init() {
      console.log("[ChatLobby] Initializing...");
      removeExistingUI();
      document.body.insertAdjacentHTML("beforeend", createLobbyHTML());
      const fab = document.getElementById("chat-lobby-fab");
      if (fab) {
        fab.style.display = "flex";
      }
      setupHandlers();
      bindEvents();
      startBackgroundPreload();
      addLobbyToOptionsMenu();
      console.log("[ChatLobby] Extension initialized");
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
      }, 2e3);
    }
    function openLobby() {
      const overlay = document.getElementById("chat-lobby-overlay");
      const container = document.getElementById("chat-lobby-container");
      const fab = document.getElementById("chat-lobby-fab");
      if (overlay) {
        overlay.style.display = "flex";
        if (container) container.style.display = "flex";
        if (fab) fab.style.display = "none";
        const batchBtn = document.getElementById("chat-lobby-batch-mode");
        if (batchBtn?.classList.contains("active")) {
          toggleBatchMode();
        }
        renderPersonaBar();
        renderCharacterGrid();
        updateFolderDropdowns();
      }
    }
    function closeLobby2() {
      const container = document.getElementById("chat-lobby-container");
      const fab = document.getElementById("chat-lobby-fab");
      if (container) container.style.display = "none";
      if (fab) fab.style.display = "flex";
      closeChatPanel();
    }
    window.chatLobbyRefresh = async function() {
      cache.invalidateAll();
      await renderPersonaBar();
      await renderCharacterGrid();
    };
    function bindEvents() {
      document.getElementById("chat-lobby-fab")?.addEventListener("click", openLobby);
      document.getElementById("chat-lobby-close")?.addEventListener("click", closeLobby2);
      document.getElementById("chat-lobby-chats-back")?.addEventListener("click", () => {
        if (isMobile()) {
          closeChatPanel();
        }
      });
      document.getElementById("chat-lobby-refresh")?.addEventListener("click", async () => {
        cache.invalidateAll();
        await renderPersonaBar();
        await renderCharacterGrid();
      });
      document.getElementById("chat-lobby-new-chat")?.addEventListener("click", startNewChat);
      document.getElementById("chat-lobby-delete-char")?.addEventListener("click", deleteCharacter);
      document.getElementById("chat-lobby-import-char")?.addEventListener("click", () => {
        closeLobby2();
        setTimeout(() => {
          const importBtn = document.getElementById("character_import_button");
          if (importBtn) importBtn.click();
        }, 300);
      });
      document.getElementById("chat-lobby-add-persona")?.addEventListener("click", () => {
        closeLobby2();
        setTimeout(() => {
          const personaDrawer = document.getElementById("persona-management-button");
          const drawerIcon = personaDrawer?.querySelector(".drawer-icon");
          if (drawerIcon) drawerIcon.click();
          setTimeout(() => {
            const createBtn = document.getElementById("create_dummy_persona");
            if (createBtn) createBtn.click();
          }, 500);
        }, 300);
      });
      document.getElementById("chat-panel-avatar")?.addEventListener("click", () => {
        closeLobby2();
        setTimeout(() => {
          const charInfoBtn = document.getElementById("option_settings");
          if (charInfoBtn) charInfoBtn.click();
        }, 300);
      });
      const searchInput = document.getElementById("chat-lobby-search-input");
      searchInput?.addEventListener("input", (e) => {
        handleSearch(e.target.value);
      });
      document.getElementById("chat-lobby-char-sort")?.addEventListener("change", (e) => {
        handleSortChange(e.target.value);
      });
      document.getElementById("chat-lobby-folder-filter")?.addEventListener("change", (e) => {
        handleFilterChange(e.target.value);
      });
      document.getElementById("chat-lobby-chat-sort")?.addEventListener("change", (e) => {
        handleSortChange2(e.target.value);
      });
      document.getElementById("chat-lobby-batch-mode")?.addEventListener("click", toggleBatchMode);
      document.getElementById("batch-move-btn")?.addEventListener("click", () => {
        const folder = document.getElementById("batch-move-folder")?.value;
        executeBatchMove(folder);
      });
      document.getElementById("batch-cancel-btn")?.addEventListener("click", toggleBatchMode);
      document.getElementById("chat-lobby-chats-list")?.addEventListener("change", (e) => {
        if (e.target.classList.contains("chat-select-cb")) {
          updateBatchCount();
        }
      });
      document.getElementById("chat-lobby-folder-manage")?.addEventListener("click", openFolderModal);
      document.getElementById("folder-modal-close")?.addEventListener("click", closeFolderModal);
      document.getElementById("add-folder-btn")?.addEventListener("click", addFolder);
      document.getElementById("new-folder-name")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") addFolder();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          const folderModal = document.getElementById("chat-lobby-folder-modal");
          if (folderModal?.style.display === "flex") {
            closeFolderModal();
          } else {
            const overlay = document.getElementById("chat-lobby-overlay");
            if (overlay?.style.display !== "none") {
              closeLobby2();
            }
          }
        }
      });
    }
    function addLobbyToOptionsMenu() {
      const optionsMenu = document.getElementById("options");
      if (!optionsMenu) {
        setTimeout(addLobbyToOptionsMenu, 1e3);
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
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => setTimeout(init, 1e3));
    } else {
      setTimeout(init, 1e3);
    }
  })();
})();
