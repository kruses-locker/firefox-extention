/**
 * Velvet & Rose New Tab - Minimalist Extension Script
 * ----------------------------------------------------
 * Strictly compliant with Manifest V3 and Firefox CSP:
 * - No inline scripts or eval
 * - Clean event delegation & modular architecture
 * - Seamless fallback for Live Server (127.0.0.1:5500) and standalone preview
 */

(function () {
  'use strict';

  /* ==========================================================================
     YouTube Music Playlists Configuration
     Customize your playlists, local cover paths, and URLs below:
     ========================================================================== */

  /**
   * Whether clicking a playlist opens in a new browser tab or navigates current tab
   * @type {boolean}
   */
  const OPEN_PLAYLIST_IN_NEW_TAB = false;

  /**
   * Your YouTube Music Playlists
   */
  const DEFAULT_YTM_PLAYLISTS = [
    {
      id: 'ytm-seed-1',
      title: "ANYTHING ELSE",
      cover: "assets/studio_square_thumbnail.jpg",
      url: "https://music.youtube.com/playlist?list=PLctoddGQzhMw&si=AHwkbZC4nvFJ8Az8"
    },
    {
      id: 'ytm-seed-2',
      title: "VELVET & SYNTH",
      cover: "assets/2.jpg",
      url: "https://music.youtube.com/playlist?list=PLLWOVSjw6agI&si=f-v2hDukdiiyhmUw"
    },
    {
      id: 'ytm-seed-3',
      title: "COUNTRY MUSIC",
      cover: "assets/3.jpg",
      url: "https://music.youtube.com/playlist?list=PLRXZN7fxv1BCZ4ojEjsU84lm-J40jHFFC&si=RlI9RX5zyLeI9HgZ"
    },
    {
      id: 'ytm-seed-4',
      title: "SOFT SUNLIGHT",
      cover: "assets/4.jpg",
      url: "https://music.youtube.com/playlist?list=PLRXZN7fxv1BDzwAdCkJgx-BXxNc2oufjY&si=0bYBxXrM86cQfV0i"
    }
  ];

  /* ==========================================================================
     1. Storage & WebExtension API Abstraction Layer
     ========================================================================== */

  const extensionApi = (function () {
    // Firefox WebExtension standard
    if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
      return browser;
    }

    // Chromium fallback
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return {
        storage: {
          local: {
            get: (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve)),
            set: (items) => new Promise((resolve) => chrome.storage.local.set(items, resolve)),
            remove: (keys) => new Promise((resolve) => chrome.storage.local.remove(keys, resolve))
          }
        },
        topSites: chrome.topSites ? {
          get: () => new Promise((resolve) => chrome.topSites.get(resolve))
        } : null,
        history: chrome.history ? {
          search: (query) => new Promise((resolve) => chrome.history.search(query, resolve))
        } : null
      };
    }

    // Standalone / Live Server Preview Fallback (using localStorage & mock data)
    return {
      storage: {
        local: {
          get: async (keys) => {
            const result = {};
            const keyList = Array.isArray(keys) ? keys : (typeof keys === 'string' ? [keys] : Object.keys(keys || {}));
            for (const key of keyList) {
              const val = localStorage.getItem(`velvet_${key}`);
              if (val !== null) {
                try {
                  result[key] = JSON.parse(val);
                } catch {
                  result[key] = val;
                }
              } else if (keys && typeof keys === 'object' && !Array.isArray(keys) && key in keys) {
                result[key] = keys[key];
              }
            }
            return result;
          },
          set: async (items) => {
            for (const [k, v] of Object.entries(items)) {
              localStorage.setItem(`velvet_${k}`, JSON.stringify(v));
            }
          },
          remove: async (keys) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            keyList.forEach((k) => localStorage.removeItem(`velvet_${k}`));
          }
        }
      },
      topSites: {
        get: async () => [
          { title: 'MDN Web Docs', url: 'https://developer.mozilla.org' },
          { title: 'GitHub', url: 'https://github.com' },
          { title: 'Wikipedia', url: 'https://wikipedia.org' },
          { title: 'DuckDuckGo', url: 'https://duckduckgo.com' },
          { title: 'Figma', url: 'https://figma.com' },
          { title: 'Hacker News', url: 'https://news.ycombinator.com' }
        ]
      },
      history: null
    };
  })();

  /* ==========================================================================
     2. Constants & Default State
     ========================================================================== */

  const STORAGE_KEYS = {
    PINNED_SHORTCUTS: 'pinned_shortcuts',
    HIDDEN_URLS: 'hidden_urls',
    THEME_CONFIG: 'theme_config',
    WALLPAPER_CONFIG: 'wallpaper_config',
    MOVIE_WATCHLIST: 'movie_watchlist',
    CUSTOM_YTM_PLAYLISTS: 'custom_ytm_playlists'
  };

  const THEME_PRESETS = [
    {
      id: 'velvet-rose',
      name: 'Velvet & Rose',
      bgBase: '#12090c',
      bgGlow: '#241117',
      bgElevated: '#1a0d12',
      textPrimary: '#faf3f3',
      accent: '#e11d48',
      accentSoft: '#fb7185'
    },
    {
      id: 'midnight-cyan',
      name: 'Midnight & Cyan',
      bgBase: '#090d16',
      bgGlow: '#111c30',
      bgElevated: '#0e1524',
      textPrimary: '#f1f5f9',
      accent: '#06b6d4',
      accentSoft: '#22d3ee'
    },
    {
      id: 'emerald-obsidian',
      name: 'Emerald & Obsidian',
      bgBase: '#08100d',
      bgGlow: '#0e2019',
      bgElevated: '#0c1813',
      textPrimary: '#f0fdf4',
      accent: '#10b981',
      accentSoft: '#34d399'
    },
    {
      id: 'amber-espresso',
      name: 'Amber & Espresso',
      bgBase: '#120e0a',
      bgGlow: '#241b12',
      bgElevated: '#1a140e',
      textPrimary: '#fefce8',
      accent: '#d97706',
      accentSoft: '#fbbf24'
    }
  ];

  const DEFAULT_WATCHLIST_MOVIES = [
    {
      id: 'movie-seed-1',
      title: 'Dune: Part Two',
      actor: 'Timothée Chalamet, Zendaya',
      posterUrl: '',
      watched: false
    },
    {
      id: 'movie-seed-2',
      title: 'Blade Runner 2049',
      actor: 'Ryan Gosling, Ana de Armas',
      posterUrl: '',
      watched: false
    },
    {
      id: 'movie-seed-3',
      title: 'Past Lives',
      actor: 'Greta Lee, Teo Yoo',
      posterUrl: '',
      watched: true
    }
  ];

  const DEFAULT_PINNED_SHORTCUTS = [
    { id: 'pin-github', title: 'GitHub', url: 'https://github.com', isPinned: true },
    { id: 'pin-youtube', title: 'YouTube', url: 'https://youtube.com', isPinned: true },
    { id: 'pin-reddit', title: 'Reddit', url: 'https://reddit.com', isPinned: true },
    { id: 'pin-mdn', title: 'MDN', url: 'https://developer.mozilla.org', isPinned: true },
    { id: 'pin-duckduckgo', title: 'DuckDuckGo', url: 'https://duckduckgo.com', isPinned: true },
    { id: 'pin-wikipedia', title: 'Wikipedia', url: 'https://wikipedia.org', isPinned: true }
  ];

  const MAX_TOTAL_SHORTCUTS = 15; // Clean grid limit leaving 1 slot for "+ Add" tile
  const SAFE_IMAGE_DATA_URL_RE = /^data:image\/[a-zA-Z0-9+.-]+;base64,[a-zA-Z0-9+/=]+$/;

  /* ==========================================================================
     3. Helper Utilities & URL Sanitization
     ========================================================================== */

  function isValidHttpUrl(rawUrl, allowImplicitHttps = false) {
    if (!rawUrl || typeof rawUrl !== 'string') return false;
    const trimmed = rawUrl.trim();
    if (!trimmed) return false;
    try {
      const candidate = allowImplicitHttps && !/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
        ? `https://${trimmed}`
        : trimmed;
      const parsed = new URL(candidate);
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname.length > 0;
    } catch {
      return false;
    }
  }

  function toSafeHttpUrl(rawUrl, fallback = '#') {
    if (!rawUrl || typeof rawUrl !== 'string') return fallback;
    const trimmed = rawUrl.trim();
    if (!trimmed) return fallback;
    const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const parsed = new URL(candidate);
      if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname.length > 0) {
        return parsed.href;
      }
    } catch {}
    return fallback;
  }

  function isSafeDataImageUrl(value) {
    return typeof value === 'string' && SAFE_IMAGE_DATA_URL_RE.test(value);
  }

  function normalizeUrl(rawUrl) {
    if (!rawUrl) return '';
    try {
      const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
      const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
      const path = parsed.pathname.replace(/\/+$/, '');
      return `${host}${path}`;
    } catch {
      return rawUrl.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
    }
  }

  function getMonogram(title, url) {
    const cleanTitle = (title || '').trim();
    if (cleanTitle) {
      const parts = cleanTitle.split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return cleanTitle.slice(0, 2).toUpperCase();
    }
    const cleanUrl = normalizeUrl(url);
    return cleanUrl.slice(0, 2).toUpperCase() || 'W';
  }

  function getDisplayDomain(rawUrl) {
    try {
      const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return rawUrl;
    }
  }

  function getFaviconUrl(rawUrl) {
    try {
      const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
      return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(parsed.origin)}`;
    } catch {
      return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(rawUrl)}`;
    }
  }

  function showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 2400);
  }

  /* ==========================================================================
     4. Signature Overlapping Rainmeter-Style Clock
     ========================================================================== */

  class ClockController {
    constructor() {
      this.timeEl = document.getElementById('clockTime');
      this.dayEl = document.getElementById('clockDay');
      this.dateEl = document.getElementById('clockDate');

      this.dayNames = [
        'Sunday', 'Monday', 'Tuesday', 'Wednesday',
        'Thursday', 'Friday', 'Saturday'
      ];

      this.monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      this.init();
    }

    init() {
      this.update();
      setInterval(() => this.update(), 1000);
    }

    update() {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const dayName = this.dayNames[now.getDay()];
      const dayOfMonth = now.getDate();
      const monthName = this.monthNames[now.getMonth()];
      const year = now.getFullYear();

      if (this.timeEl) {
        this.timeEl.textContent = `${hours}:${minutes}`;
      }

      if (this.dayEl) {
        this.dayEl.textContent = dayName;
      }

      if (this.dateEl) {
        this.dateEl.textContent = `${dayOfMonth} ${monthName} ${year}`;
      }
    }
  }

  /* ==========================================================================
     5. Minimalist DuckDuckGo Search Bar
     ========================================================================== */

  const SEARCH_BANGS = {
    ytm: {
      label: 'YTM',
      buildUrl: (q) => `https://music.youtube.com/search?q=${encodeURIComponent(q)}`
    },
    gh: {
      label: 'GitHub',
      buildUrl: (q) => `https://github.com/search?q=${encodeURIComponent(q)}`
    },
    mdn: {
      label: 'MDN',
      buildUrl: (q) => `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(q)}`
    },
    g: {
      label: 'Google',
      buildUrl: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`
    }
  };

  class SearchController {
    constructor() {
      this.form = document.getElementById('searchForm');
      this.input = document.getElementById('searchInput');
      this.submitBtn = document.getElementById('searchSubmitBtn');
      this.engineBadge = document.getElementById('searchEngineBadge');

      this.init();
    }

    init() {
      if (!this.form || !this.input) return;

      this.bindEvents();

      requestAnimationFrame(() => {
        this.input.focus();
      });
    }

    parseBang(rawValue) {
      const match = String(rawValue || '').match(/^!(ytm|gh|mdn|g)\s+(.*)$/i);
      if (!match) return null;
      const key = match[1].toLowerCase();
      const engine = SEARCH_BANGS[key];
      if (!engine) return null;
      return {
        key,
        label: engine.label,
        buildUrl: engine.buildUrl,
        cleanQuery: match[2].trim()
      };
    }

    updateEngineBadge() {
      if (!this.engineBadge || !this.input) return;
      const bang = this.parseBang(this.input.value);
      if (bang) {
        this.engineBadge.textContent = bang.label;
        this.engineBadge.classList.add('visible');
      } else {
        this.engineBadge.textContent = '';
        this.engineBadge.classList.remove('visible');
      }
    }

    bindEvents() {
      this.input.addEventListener('input', () => {
        const hasText = this.input.value.trim().length > 0;
        if (hasText) {
          this.submitBtn.classList.add('active');
        } else {
          this.submitBtn.classList.remove('active');
        }
        this.updateEngineBadge();
      });

      this.form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSearchOrNavigate();
      });

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.activeElement === this.input) {
          this.input.value = '';
          this.submitBtn.classList.remove('active');
          this.updateEngineBadge();
        }
      });
    }

    isDirectUrl(rawQuery) {
      const query = rawQuery.trim();
      if (!query || query.includes(' ')) return false;

      if (/^https?:\/\//i.test(query)) {
        return true;
      }

      if (/^localhost(:\d+)?(\/.*)?$/i.test(query)) return true;
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?(\/.*)?$/.test(query)) return true;

      const domainPattern = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(:[0-9]+)?(\/.*)?$/;
      return domainPattern.test(query);
    }

    resolveDestinationUrl(rawQuery) {
      const query = rawQuery.trim();
      if (/^https?:\/\//i.test(query)) {
        return query;
      }
      if (/^localhost(:\d+)?(\/.*)?$/i.test(query)) {
        return `http://${query}`;
      }
      return `https://${query}`;
    }

    handleSearchOrNavigate() {
      const rawValue = this.input.value;
      const bang = this.parseBang(rawValue);
      if (bang) {
        window.location.href = bang.buildUrl(bang.cleanQuery);
        return;
      }

      const query = rawValue.trim();
      if (!query) return;

      if (this.isDirectUrl(query)) {
        window.location.href = this.resolveDestinationUrl(query);
      } else {
        const ddgUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
        window.location.href = ddgUrl;
      }
    }
  }

  /* ==========================================================================
     6. Clean Borderless Shortcut Grid Controller
     ========================================================================== */

  class ShortcutsController {
    constructor() {
      this.gridEl = document.getElementById('shortcutsGrid');
      this.pinnedShortcuts = [];
      this.hiddenUrls = new Set();

      this.init();
    }

    async init() {
      await this.loadStoredData();
      await this.renderGrid();
    }

    async loadStoredData() {
      try {
        const stored = await extensionApi.storage.local.get([
          STORAGE_KEYS.PINNED_SHORTCUTS,
          STORAGE_KEYS.HIDDEN_URLS
        ]);

        if (stored && Array.isArray(stored[STORAGE_KEYS.PINNED_SHORTCUTS])) {
          this.pinnedShortcuts = stored[STORAGE_KEYS.PINNED_SHORTCUTS].filter(
            (item) => item && typeof item === 'object' && isValidHttpUrl(item.url, true)
          );
        } else {
          this.pinnedShortcuts = [...DEFAULT_PINNED_SHORTCUTS];
          await this.savePinnedShortcuts();
        }

        if (stored && Array.isArray(stored[STORAGE_KEYS.HIDDEN_URLS])) {
          this.hiddenUrls = new Set(stored[STORAGE_KEYS.HIDDEN_URLS]);
        }
      } catch (err) {
        console.warn('Error loading shortcuts:', err);
        this.pinnedShortcuts = [...DEFAULT_PINNED_SHORTCUTS];
      }
    }

    async savePinnedShortcuts() {
      try {
        await extensionApi.storage.local.set({
          [STORAGE_KEYS.PINNED_SHORTCUTS]: this.pinnedShortcuts
        });
      } catch (err) {
        console.error('Error saving pinned shortcuts:', err);
      }
    }

    async saveHiddenUrls() {
      try {
        await extensionApi.storage.local.set({
          [STORAGE_KEYS.HIDDEN_URLS]: Array.from(this.hiddenUrls)
        });
      } catch (err) {
        console.error('Error saving hidden URLs:', err);
      }
    }

    async fetchRecentVisits() {
      const candidates = [];

      if (extensionApi.topSites && typeof extensionApi.topSites.get === 'function') {
        try {
          const topSites = await extensionApi.topSites.get();
          if (Array.isArray(topSites)) {
            candidates.push(...topSites);
          }
        } catch (err) {
          console.warn('topSites error:', err);
        }
      }

      if (candidates.length < 8 && extensionApi.history && typeof extensionApi.history.search === 'function') {
        try {
          const historyItems = await extensionApi.history.search({
            text: '',
            maxResults: 24,
            startTime: 0
          });
          if (Array.isArray(historyItems)) {
            for (const item of historyItems) {
              if (item.url && isValidHttpUrl(item.url, false)) {
                candidates.push({
                  title: item.title || getDisplayDomain(item.url),
                  url: item.url
                });
              }
            }
          }
        } catch (err) {
          console.warn('History error:', err);
        }
      }

      return candidates;
    }

    async getCombinedShortcuts() {
      const combined = [];
      const seenUrls = new Set();

      for (const item of this.pinnedShortcuts) {
        if (!isValidHttpUrl(item.url, true)) continue;
        const norm = normalizeUrl(item.url);
        if (!seenUrls.has(norm)) {
          seenUrls.add(norm);
          combined.push({
            ...item,
            url: toSafeHttpUrl(item.url),
            isPinned: true
          });
        }
      }

      const remainingSlots = Math.max(0, MAX_TOTAL_SHORTCUTS - combined.length);
      if (remainingSlots > 0) {
        const recentCandidates = await this.fetchRecentVisits();

        for (const item of recentCandidates) {
          if (combined.length >= MAX_TOTAL_SHORTCUTS) break;
          if (!item.url || !isValidHttpUrl(item.url, false)) continue;

          const norm = normalizeUrl(item.url);
          if (!seenUrls.has(norm) && !this.hiddenUrls.has(norm)) {
            seenUrls.add(norm);
            combined.push({
              id: `recent-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
              title: (item.title || getDisplayDomain(item.url)).trim(),
              url: toSafeHttpUrl(item.url),
              isPinned: false
            });
          }
        }
      }

      return combined;
    }

    async renderGrid() {
      if (!this.gridEl) return;

      const shortcuts = await this.getCombinedShortcuts();
      this.gridEl.textContent = '';

      shortcuts.forEach((item) => {
        const tile = this.createShortcutTile(item);
        this.gridEl.appendChild(tile);
      });

      const addTile = this.createAddTile();
      this.gridEl.appendChild(addTile);
    }

    createShortcutTile(item) {
      const safeUrl = toSafeHttpUrl(item.url);
      const tile = document.createElement('a');
      tile.className = 'shortcut-tile';
      tile.href = safeUrl;
      tile.setAttribute('role', 'listitem');
      tile.setAttribute('title', `${item.title} (${safeUrl})`);

      const iconBox = document.createElement('div');
      iconBox.className = 'tile-icon-box';

      if (item.isPinned) {
        const dot = document.createElement('div');
        dot.className = 'tile-pin-dot';
        dot.title = 'Pinned';
        iconBox.appendChild(dot);
      }

      const microActions = document.createElement('div');
      microActions.className = 'tile-micro-actions';

      const pinBtn = document.createElement('button');
      pinBtn.type = 'button';
      pinBtn.className = `micro-btn ${item.isPinned ? 'pinned' : ''}`;
      pinBtn.title = item.isPinned ? 'Unpin' : 'Pin to top';
      pinBtn.setAttribute('aria-label', pinBtn.title);

      pinBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="9" height="9" fill="${item.isPinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.2">
          <path d="M16 4l4 4-2.5 2.5 1.5 6-4-4L9 14.5l-4.5 4.5L3 17.5 7.5 13 6 7l6-4 2 2z"/>
        </svg>
      `;

      pinBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.togglePin(item);
      });

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'micro-btn';
      removeBtn.title = item.isPinned ? 'Delete' : 'Hide';
      removeBtn.setAttribute('aria-label', removeBtn.title);

      removeBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;

      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.removeShortcut(item);
      });

      microActions.appendChild(pinBtn);
      microActions.appendChild(removeBtn);
      iconBox.appendChild(microActions);

      const faviconImg = document.createElement('img');
      faviconImg.className = 'tile-favicon';
      faviconImg.alt = '';
      faviconImg.loading = 'lazy';
      faviconImg.src = getFaviconUrl(safeUrl);

      const monogramFallback = document.createElement('span');
      monogramFallback.className = 'tile-avatar';
      monogramFallback.textContent = getMonogram(item.title, safeUrl);
      monogramFallback.style.display = 'none';

      faviconImg.addEventListener('error', () => {
        faviconImg.style.display = 'none';
        monogramFallback.style.display = 'inline-block';
      });

      iconBox.appendChild(faviconImg);
      iconBox.appendChild(monogramFallback);
      tile.appendChild(iconBox);

      const label = document.createElement('span');
      label.className = 'tile-label';
      label.textContent = item.title || getDisplayDomain(safeUrl);
      tile.appendChild(label);

      return tile;
    }

    createAddTile() {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'tile-add-btn';
      tile.setAttribute('aria-label', 'Add custom shortcut');
      tile.setAttribute('role', 'listitem');

      const iconBox = document.createElement('div');
      iconBox.className = 'tile-add-icon';
      iconBox.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      `;

      const label = document.createElement('span');
      label.className = 'tile-add-label';
      label.textContent = 'Add';

      tile.appendChild(iconBox);
      tile.appendChild(label);

      tile.addEventListener('click', () => {
        modalController.open();
      });

      return tile;
    }

    async togglePin(item) {
      const norm = normalizeUrl(item.url);

      if (item.isPinned) {
        this.pinnedShortcuts = this.pinnedShortcuts.filter((p) => normalizeUrl(p.url) !== norm);
        await this.savePinnedShortcuts();
        showToast(`Unpinned "${item.title}"`);
      } else {
        this.pinnedShortcuts.push({
          id: `pin-${Date.now()}`,
          title: item.title,
          url: toSafeHttpUrl(item.url),
          isPinned: true
        });
        await this.savePinnedShortcuts();
        showToast(`Pinned "${item.title}"`);
      }

      await this.renderGrid();
    }

    async removeShortcut(item) {
      const norm = normalizeUrl(item.url);

      if (item.isPinned) {
        this.pinnedShortcuts = this.pinnedShortcuts.filter((p) => normalizeUrl(p.url) !== norm);
        await this.savePinnedShortcuts();
        showToast(`Removed "${item.title}"`);
      } else {
        this.hiddenUrls.add(norm);
        await this.saveHiddenUrls();
        showToast(`Hidden "${item.title}"`);
      }

      await this.renderGrid();
    }

    async addCustomShortcut(title, rawUrl) {
      const finalUrl = toSafeHttpUrl(rawUrl, '');
      if (!finalUrl) {
        showToast('Invalid URL scheme (use http or https)');
        return;
      }

      const newShortcut = {
        id: `pin-${Date.now()}`,
        title: title.trim() || getDisplayDomain(finalUrl),
        url: finalUrl,
        isPinned: true,
        isCustom: true
      };

      this.pinnedShortcuts.push(newShortcut);
      await this.savePinnedShortcuts();
      await this.renderGrid();

      showToast(`Added "${newShortcut.title}"`);
    }
  }

  /* ==========================================================================
     7. Minimalist Modal Dialog Controller
     ========================================================================== */

  class ModalController {
    constructor() {
      this.overlay = document.getElementById('modalOverlay');
      this.form = document.getElementById('addShortcutForm');
      this.titleInput = document.getElementById('shortcutTitleInput');
      this.urlInput = document.getElementById('shortcutUrlInput');
      this.closeBtn = document.getElementById('modalCloseBtn');
      this.cancelBtn = document.getElementById('modalCancelBtn');
      this.errorEl = document.getElementById('formError');

      this.bindEvents();
    }

    bindEvents() {
      if (!this.overlay) return;

      if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());
      if (this.cancelBtn) this.cancelBtn.addEventListener('click', () => this.close());

      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) this.close();
      });

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.overlay.classList.contains('open')) {
          this.close();
        }
      });

      if (this.form) {
        this.form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleSubmit();
        });
      }
    }

    open() {
      if (!this.overlay) return;
      this.clearError();
      this.form.reset();
      this.overlay.classList.add('open');
      this.overlay.setAttribute('aria-hidden', 'false');

      setTimeout(() => {
        if (this.titleInput) this.titleInput.focus();
      }, 50);
    }

    close() {
      if (!this.overlay) return;
      this.overlay.classList.remove('open');
      this.overlay.setAttribute('aria-hidden', 'true');
      this.clearError();

      const searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.focus();
    }

    showError(msg) {
      if (this.errorEl) {
        this.errorEl.textContent = msg;
      }
    }

    clearError() {
      if (this.errorEl) {
        this.errorEl.textContent = '';
      }
    }

    handleSubmit() {
      const title = this.titleInput.value.trim();
      const rawUrl = this.urlInput.value.trim();

      if (!rawUrl) {
        this.showError('Please enter a web address or domain.');
        this.urlInput.focus();
        return;
      }

      if (!isValidHttpUrl(rawUrl, true)) {
        this.showError('Please enter a valid http/https URL (e.g. github.com).');
        this.urlInput.focus();
        return;
      }

      shortcutsController.addCustomShortcut(title, rawUrl);
      this.close();
    }
  }

  /* ==========================================================================
     8. YouTube Music Playlists Controller
     ========================================================================== */

  class PlaylistsController {
    constructor() {
      this.shelfEl = document.getElementById('playlistsShelf');
      this.playlists = [];
      this.init();
    }

    async init() {
      if (!this.shelfEl) return;
      await this.loadPlaylists();
      this.render();
    }

    async loadPlaylists() {
      try {
        const stored = await extensionApi.storage.local.get(STORAGE_KEYS.CUSTOM_YTM_PLAYLISTS);
        if (stored && Array.isArray(stored[STORAGE_KEYS.CUSTOM_YTM_PLAYLISTS])) {
          this.playlists = stored[STORAGE_KEYS.CUSTOM_YTM_PLAYLISTS].filter(
            (p) => p && typeof p === 'object' && isValidHttpUrl(p.url, true)
          );
        } else {
          this.playlists = DEFAULT_YTM_PLAYLISTS.map((p) => ({ ...p }));
          await this.savePlaylists();
        }
      } catch (err) {
        console.warn('Error loading playlists:', err);
        this.playlists = DEFAULT_YTM_PLAYLISTS.map((p) => ({ ...p }));
      }
    }

    async savePlaylists() {
      try {
        await extensionApi.storage.local.set({
          [STORAGE_KEYS.CUSTOM_YTM_PLAYLISTS]: this.playlists
        });
      } catch (err) {
        console.error('Error saving playlists:', err);
      }
    }

    async addPlaylist({ title, url, cover }) {
      const cleanUrl = toSafeHttpUrl(url, '');
      if (!cleanUrl) {
        showToast('Invalid playlist URL');
        return;
      }

      const trimmedCover = (cover || '').trim();
      const safeCover = (isSafeDataImageUrl(trimmedCover) || isValidHttpUrl(trimmedCover, false) || /^assets\/[a-zA-Z0-9_./-]+$/.test(trimmedCover))
        ? trimmedCover
        : '';

      const newPlaylist = {
        id: `ytm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: title.trim() || 'Untitled Playlist',
        url: cleanUrl,
        cover: safeCover
      };

      this.playlists.push(newPlaylist);
      await this.savePlaylists();
      this.render();
      showToast(`Added "${newPlaylist.title}"`);
    }

    async removePlaylist(id, title) {
      this.playlists = this.playlists.filter((p) => p.id !== id);
      await this.savePlaylists();
      this.render();
      showToast(`Removed "${title || 'Playlist'}"`);
    }

    render() {
      if (!this.shelfEl) return;
      this.shelfEl.textContent = '';

      this.playlists.forEach((playlist, index) => {
        if (!playlist.id) {
          playlist.id = `ytm-legacy-${index}-${Date.now()}`;
        }
        const pill = this.createPlaylistPill(playlist);
        this.shelfEl.appendChild(pill);
      });

      this.shelfEl.appendChild(this.createAddPlaylistPill());
    }

    createMusicNoteSvg() {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', '18');
      svg.setAttribute('height', '18');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.setAttribute('aria-hidden', 'true');

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M9 18V5l12-2v13');
      svg.appendChild(path);

      const c1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c1.setAttribute('cx', '6');
      c1.setAttribute('cy', '18');
      c1.setAttribute('r', '3');
      svg.appendChild(c1);

      const c2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c2.setAttribute('cx', '18');
      c2.setAttribute('cy', '16');
      c2.setAttribute('r', '3');
      svg.appendChild(c2);

      return svg;
    }

    createPlaylistPill(playlist) {
      const pill = document.createElement('a');
      pill.className = 'playlist-pill';
      pill.href = toSafeHttpUrl(playlist.url, '#');
      pill.setAttribute('role', 'listitem');
      pill.setAttribute('title', `${playlist.title || 'Playlist'} (YouTube Music)`);

      if (OPEN_PLAYLIST_IN_NEW_TAB) {
        pill.target = '_blank';
        pill.rel = 'noopener noreferrer';
      }

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'playlist-remove-btn';
      removeBtn.textContent = '×';
      removeBtn.title = 'Remove playlist';
      removeBtn.setAttribute('aria-label', `Remove "${playlist.title || 'Playlist'}"`);
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.removePlaylist(playlist.id, playlist.title);
      });
      pill.appendChild(removeBtn);

      const coverWrap = document.createElement('div');
      coverWrap.className = 'playlist-cover-wrap';

      const fallback = document.createElement('div');
      fallback.className = 'playlist-cover-fallback';
      fallback.appendChild(this.createMusicNoteSvg());

      if (playlist.cover) {
        const img = document.createElement('img');
        img.className = 'playlist-cover-img';
        img.alt = playlist.title || 'Playlist cover';
        img.loading = 'lazy';
        img.src = playlist.cover;

        fallback.style.display = 'none';

        img.addEventListener('error', () => {
          img.style.display = 'none';
          fallback.style.display = 'flex';
        });

        coverWrap.appendChild(img);
        coverWrap.appendChild(fallback);
      } else {
        coverWrap.appendChild(fallback);
      }

      pill.appendChild(coverWrap);

      const title = document.createElement('span');
      title.className = 'playlist-title';
      title.textContent = playlist.title || 'Untitled Playlist';
      pill.appendChild(title);

      const playIcon = document.createElement('div');
      playIcon.className = 'playlist-play-icon';
      const playSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      playSvg.setAttribute('viewBox', '0 0 24 24');
      playSvg.setAttribute('width', '12');
      playSvg.setAttribute('height', '12');
      playSvg.setAttribute('fill', 'currentColor');
      playSvg.setAttribute('aria-hidden', 'true');
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      poly.setAttribute('points', '6 3 20 12 6 21 6 3');
      playSvg.appendChild(poly);
      playIcon.appendChild(playSvg);
      pill.appendChild(playIcon);

      return pill;
    }

    createAddPlaylistPill() {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'playlist-add-pill';
      btn.setAttribute('role', 'listitem');
      btn.setAttribute('aria-label', 'Add YouTube Music playlist');

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', '15');
      svg.setAttribute('height', '15');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2.2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('aria-hidden', 'true');

      const l1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l1.setAttribute('x1', '12');
      l1.setAttribute('y1', '5');
      l1.setAttribute('x2', '12');
      l1.setAttribute('y2', '19');

      const l2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l2.setAttribute('x1', '5');
      l2.setAttribute('y1', '12');
      l2.setAttribute('x2', '19');
      l2.setAttribute('y2', '12');

      svg.appendChild(l1);
      svg.appendChild(l2);

      const label = document.createElement('span');
      label.textContent = 'Add';

      btn.appendChild(svg);
      btn.appendChild(label);

      btn.addEventListener('click', () => {
        if (playlistModalController) {
          playlistModalController.open();
        }
      });

      return btn;
    }
  }

  class PlaylistModalController {
    constructor() {
      this.overlay = document.getElementById('playlistModalOverlay');
      this.form = document.getElementById('addPlaylistForm');
      this.titleInput = document.getElementById('playlistTitleInput');
      this.urlInput = document.getElementById('playlistUrlInput');
      this.coverUrlInput = document.getElementById('playlistCoverUrlInput');
      this.coverFileInput = document.getElementById('playlistCoverFileInput');
      this.fileStatusEl = document.getElementById('playlistFileStatus');
      this.errorEl = document.getElementById('playlistFormError');
      this.closeBtn = document.getElementById('playlistModalCloseBtn');
      this.cancelBtn = document.getElementById('playlistModalCancelBtn');

      this.localCoverDataUrl = '';
      this.bindEvents();
    }

    bindEvents() {
      if (!this.overlay) return;

      if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());
      if (this.cancelBtn) this.cancelBtn.addEventListener('click', () => this.close());

      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) this.close();
      });

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.overlay.classList.contains('open')) {
          this.close();
        }
      });

      if (this.coverFileInput) {
        this.coverFileInput.addEventListener('change', (e) => {
          const file = e.target.files && e.target.files[0];
          this.handleFileSelection(file);
        });
      }

      if (this.form) {
        this.form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleSubmit();
        });
      }
    }

    open() {
      if (!this.overlay) return;
      this.clearError();
      this.localCoverDataUrl = '';
      if (this.form) this.form.reset();
      if (this.fileStatusEl) this.fileStatusEl.textContent = 'No file chosen';
      this.overlay.classList.add('open');
      this.overlay.setAttribute('aria-hidden', 'false');

      setTimeout(() => {
        if (this.titleInput) this.titleInput.focus();
      }, 50);
    }

    close() {
      if (!this.overlay) return;
      this.overlay.classList.remove('open');
      this.overlay.setAttribute('aria-hidden', 'true');
      this.clearError();
      this.localCoverDataUrl = '';
    }

    showError(msg) {
      if (this.errorEl) this.errorEl.textContent = msg;
    }

    clearError() {
      if (this.errorEl) this.errorEl.textContent = '';
    }

    resizeImageToDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to read image file.'));
        reader.onload = () => {
          const img = new Image();
          img.onerror = () => reject(new Error('Invalid image file.'));
          img.onload = () => {
            const size = 200;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Canvas unavailable.'));
              return;
            }

            // Center-crop to square
            const minSide = Math.min(img.width, img.height);
            const sx = (img.width - minSide) / 2;
            const sy = (img.height - minSide) / 2;
            ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

            try {
              resolve(canvas.toDataURL('image/jpeg', 0.85));
            } catch (err) {
              reject(err);
            }
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    }

    async handleFileSelection(file) {
      this.clearError();
      if (!file) {
        this.localCoverDataUrl = '';
        if (this.fileStatusEl) this.fileStatusEl.textContent = 'No file chosen';
        return;
      }

      if (!file.type.startsWith('image/')) {
        this.localCoverDataUrl = '';
        if (this.fileStatusEl) this.fileStatusEl.textContent = 'No file chosen';
        this.showError('Please choose an image file.');
        return;
      }

      try {
        if (this.fileStatusEl) this.fileStatusEl.textContent = 'Processing...';
        this.localCoverDataUrl = await this.resizeImageToDataUrl(file);
        if (this.fileStatusEl) this.fileStatusEl.textContent = file.name;
      } catch {
        this.localCoverDataUrl = '';
        if (this.fileStatusEl) this.fileStatusEl.textContent = 'No file chosen';
        this.showError('Could not process that image.');
      }
    }

    async handleSubmit() {
      const title = this.titleInput ? this.titleInput.value.trim() : '';
      const rawUrl = this.urlInput ? this.urlInput.value.trim() : '';
      const coverUrl = this.coverUrlInput ? this.coverUrlInput.value.trim() : '';

      if (!title) {
        this.showError('Please enter a playlist name.');
        if (this.titleInput) this.titleInput.focus();
        return;
      }

      if (!rawUrl) {
        this.showError('Please enter a YouTube Music playlist URL.');
        if (this.urlInput) this.urlInput.focus();
        return;
      }

      if (!isValidHttpUrl(rawUrl, true)) {
        this.showError('Please enter a valid http/https playlist URL.');
        if (this.urlInput) this.urlInput.focus();
        return;
      }

      if (coverUrl && !isValidHttpUrl(coverUrl, false)) {
        this.showError('Cover image URL must start with http:// or https://.');
        if (this.coverUrlInput) this.coverUrlInput.focus();
        return;
      }

      const cover = this.localCoverDataUrl || coverUrl;
      await playlistsController.addPlaylist({ title, url: rawUrl, cover });
      this.close();
    }
  }

  /* ==========================================================================
     9. Tab & Media Bridge Helpers
     ========================================================================== */

  function runtimeHasError() {
    return Boolean(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError);
  }

  function getThumbnailFromUrl(url) {
    if (!url) return '';
    try {
      const videoId = new URL(url).searchParams.get('v');
      if (videoId) return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    } catch {}
    return '';
  }

  function parseTrackDetails(tabTitle) {
    if (!tabTitle) return { title: '', artist: '' };
    const clean = tabTitle.trim().replace(/^\(\d+\+?\)\s*/, '');

    if (!clean || ['YouTube Music', 'YouTube', 'Spotify'].includes(clean)) {
      return { title: '', artist: '' };
    }

    const stripSuffix = (str) =>
      str.replace(/(?:\s*[-|]\s*YouTube Music|\s*[-|]\s*YouTube)$/i, '').trim();

    if (clean.includes(' • ')) {
      const parts = clean.split(' • ');
      return {
        title: parts[0].trim(),
        artist: stripSuffix(parts.slice(1).join(' • '))
      };
    }

    if (/(?:\s*[-|]\s*YouTube Music)$/i.test(clean)) {
      const stripped = stripSuffix(clean);
      if (stripped.includes(' - ')) {
        const parts = stripped.split(' - ');
        return { title: parts[0].trim(), artist: parts.slice(1).join(' - ').trim() };
      }
      return { title: stripped, artist: 'YouTube Music' };
    }

    if (/(?:\s*[-|]\s*YouTube)$/i.test(clean)) {
      const stripped = stripSuffix(clean);
      return { title: stripped, artist: 'YouTube' };
    }

    return { title: clean, artist: '' };
  }

  async function getOpenMediaTabs() {
    const tabsApi = (typeof browser !== 'undefined' && browser.tabs) ? browser.tabs :
                    (typeof chrome !== 'undefined' && chrome.tabs ? chrome.tabs : null);
    if (!tabsApi || !tabsApi.query) return [];

    try {
      if (typeof browser !== 'undefined' && browser.tabs?.query) {
        return await browser.tabs.query({});
      }
      return await new Promise((resolve) => chrome.tabs.query({}, resolve));
    } catch {
      return [];
    }
  }

  function findBestMusicTab(tabs) {
    if (!Array.isArray(tabs) || tabs.length === 0) return null;

    // 1. Prioritize YouTube Music tabs (playing first, then paused)
    const ytmTabs = tabs.filter((t) => t.url && t.url.includes('music.youtube.com'));
    if (ytmTabs.length > 0) {
      return ytmTabs.find((t) => t.audible) || ytmTabs[0];
    }

    // 2. Any currently audible media tab
    const audibleMedia = tabs.find((t) => t.audible && t.url && (
      t.url.includes('youtube.com/watch') || t.url.includes('spotify.com')
    ));
    if (audibleMedia) return audibleMedia;

    // 3. Fallback to any open YouTube watch or Spotify tab
    return tabs.find((t) => t.url && (
      t.url.includes('youtube.com/watch') || t.url.includes('spotify.com')
    )) || null;
  }

  /* ==========================================================================
     10. Stabilized Live Mini-Player Controller (Zero-Flicker In-Place DOM)
     ========================================================================== */

  class YtmMiniPlayerController {
    constructor() {
      this.containerEl = document.getElementById('ytmMiniPlayer');
      this.currentTabId = null;
      this.currentWindowId = null;
      this.pollTimer = null;
      this.progressTimer = null;
      this.actionLockUntil = 0;
      this.injectedTabs = new Set();
      this.lastRenderedKey = '';
      this.domRefs = null;
      this.lastSampledArt = '';

      this.progressState = {
        currentTime: 0,
        duration: 0,
        lastSyncAt: Date.now()
      };

      this.currentState = {
        hasTrack: false,
        isPlaying: false,
        title: '',
        artist: '',
        albumArt: ''
      };

      this.init();
    }

    async init() {
      if (!this.containerEl) return;

      const runtimeApi = (typeof browser !== 'undefined' && browser.runtime) ? browser.runtime :
                         (typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime : null);
      if (runtimeApi && runtimeApi.onMessage) {
        runtimeApi.onMessage.addListener((message, sender) => {
          if (message?.type === 'YTM_STATE_CHANGED' && message.data) {
            if (Date.now() < this.actionLockUntil) return;
            if (!sender?.tab || sender.tab.id === this.currentTabId) {
              this.applyState(message.data);
            }
          }
        });
      }

      await this.pollYtmTab();
      this.pollTimer = setInterval(() => this.pollYtmTab(), 2000);
      this.progressTimer = setInterval(() => this.tickProgress(), 250);
    }

    async ensureBridgeInjected(tabId, force = false) {
      if (!tabId || (!force && this.injectedTabs.has(tabId))) return;
      const scriptingApi = (typeof browser !== 'undefined' && browser.scripting) ? browser.scripting :
                           (typeof chrome !== 'undefined' && chrome.scripting ? chrome.scripting : null);
      if (scriptingApi && scriptingApi.executeScript) {
        try {
          await scriptingApi.executeScript({ target: { tabId }, files: ['ytm-bridge.js'] });
          this.injectedTabs.add(tabId);
        } catch {}
      }
    }

    async sendMessageWithAutoInject(tabId, message) {
      let response = await this.sendMessageToTab(tabId, message);
      if (response === null) {
        await this.ensureBridgeInjected(tabId, true);
        await new Promise((resolve) => setTimeout(resolve, 150));
        response = await this.sendMessageToTab(tabId, message);
      }
      return response;
    }

    async sendMessageToTab(tabId, message) {
      if (!tabId) return null;

      if (typeof browser !== 'undefined' && browser.tabs?.sendMessage) {
        try {
          const res = await browser.tabs.sendMessage(tabId, message);
          return res || null;
        } catch {
          return null;
        }
      }

      if (typeof chrome !== 'undefined' && chrome.tabs?.sendMessage) {
        return new Promise((resolve) => {
          try {
            chrome.tabs.sendMessage(tabId, message, (response) => {
              resolve(runtimeHasError() ? null : (response || null));
            });
          } catch {
            resolve(null);
          }
        });
      }

      return null;
    }

    async executeDirectMediaFallback(tabId, actionType, ratio = 0) {
      if (!tabId) return null;
      const scriptingApi = (typeof browser !== 'undefined' && browser.scripting) ? browser.scripting :
                           (typeof chrome !== 'undefined' && chrome.scripting ? chrome.scripting : null);
      if (!scriptingApi || !scriptingApi.executeScript) return null;

      try {
        const results = await scriptingApi.executeScript({
          target: { tabId },
          args: [actionType, ratio],
          func: (action, seekRatio) => {
            const media =
              Array.from(document.querySelectorAll('video, audio')).find((m) => m.currentSrc) ||
              document.querySelector('video');

            if (action === 'TOGGLE_PLAY') {
              const btn =
                document.querySelector('ytmusic-player-bar #play-pause-button') ||
                document.querySelector('#play-pause-button') ||
                document.querySelector('.ytp-play-button') ||
                document.querySelector('[data-testid="control-button-playpause"]');
              if (btn) btn.click();
              else if (media) media.paused ? media.play().catch(() => {}) : media.pause();
            } else if (action === 'NEXT_TRACK') {
              const btn =
                document.querySelector('ytmusic-player-bar .next-button') ||
                document.querySelector('.next-button') ||
                document.querySelector('.ytp-next-button') ||
                document.querySelector('[data-testid="control-button-skip-forward"]');
              if (btn) btn.click();
            } else if (action === 'PREV_TRACK') {
              const btn =
                document.querySelector('ytmusic-player-bar .previous-button') ||
                document.querySelector('.previous-button') ||
                document.querySelector('.ytp-prev-button') ||
                document.querySelector('[data-testid="control-button-skip-back"]');
              if (btn) btn.click();
            } else if (action === 'SEEK_TO') {
              if (media && Number.isFinite(media.duration) && media.duration > 0) {
                media.currentTime = media.duration * Math.max(0, Math.min(1, Number(seekRatio) || 0));
              }
            }

            return {
              currentTime: (media && Number.isFinite(media.currentTime)) ? media.currentTime : 0,
              duration: (media && Number.isFinite(media.duration) && media.duration > 0) ? media.duration : 0
            };
          }
        });
        return results?.[0]?.result || null;
      } catch {
        return null;
      }
    }

    async pollYtmTab() {
      if (Date.now() < this.actionLockUntil) return;

      const tabs = await getOpenMediaTabs();
      const mediaTab = findBestMusicTab(tabs);

      if (!mediaTab) {
        this.currentTabId = null;
        this.currentWindowId = null;
        this.applyState({ hasTrack: false, isPlaying: false, title: '', artist: '', albumArt: '' });
        return;
      }

      this.currentTabId = mediaTab.id;
      this.currentWindowId = mediaTab.windowId;

      await this.ensureBridgeInjected(mediaTab.id);

      const bridgeStatus = await this.sendMessageWithAutoInject(mediaTab.id, { type: 'GET_STATUS' });

      if (bridgeStatus && bridgeStatus.hasTrack) {
        this.applyState({
          hasTrack: true,
          isPlaying: Boolean(bridgeStatus.isPlaying),
          title: bridgeStatus.title,
          artist: bridgeStatus.artist || 'YouTube Music',
          albumArt: bridgeStatus.albumArt || getThumbnailFromUrl(mediaTab.url),
          currentTime: bridgeStatus.currentTime || 0,
          duration: bridgeStatus.duration || 0
        });
        return;
      }

      const parsed = parseTrackDetails(mediaTab.title);
      if (parsed.title) {
        this.applyState({
          hasTrack: true,
          isPlaying: Boolean(mediaTab.audible),
          title: parsed.title,
          artist: parsed.artist || 'YouTube Music',
          albumArt: getThumbnailFromUrl(mediaTab.url)
        });
      } else {
        this.applyState({ hasTrack: false, isPlaying: false, title: '', artist: '', albumArt: '' });
      }
    }

    applyState(next) {
      if (typeof next.currentTime === 'number' || typeof next.duration === 'number') {
        this.syncProgress(next.currentTime || 0, next.duration || 0);
      }

      const stateKey = `${next.hasTrack}|${next.isPlaying}|${next.title}|${next.artist}|${next.albumArt}`;
      if (stateKey === this.lastRenderedKey) return;
      this.lastRenderedKey = stateKey;

      this.currentState = {
        hasTrack: Boolean(next.hasTrack),
        isPlaying: Boolean(next.isPlaying),
        title: next.title || '',
        artist: next.artist || '',
        albumArt: next.albumArt || ''
      };

      if (!next.hasTrack) {
        this.renderIdleState(Boolean(this.currentTabId));
        return;
      }

      this.updateActivePlayerInPlace();
    }

    syncProgress(currentTime, duration) {
      this.progressState.currentTime = Math.max(0, Number(currentTime) || 0);
      this.progressState.duration = Math.max(0, Number(duration) || 0);
      this.progressState.lastSyncAt = Date.now();
      this.renderProgressBar();
    }

    tickProgress() {
      if (!this.currentState.hasTrack || !this.currentState.isPlaying) return;
      if (this.progressState.duration <= 0) return;
      this.renderProgressBar();
    }

    renderProgressBar() {
      if (!this.domRefs || !this.domRefs.progressFill) return;
      const { currentTime, duration, lastSyncAt } = this.progressState;
      if (duration <= 0) {
        this.domRefs.progressFill.style.width = '0%';
        return;
      }

      const elapsed = this.currentState.isPlaying ? (Date.now() - lastSyncAt) / 1000 : 0;
      const estimated = Math.max(0, Math.min(duration, currentTime + elapsed));
      const pct = Math.max(0, Math.min(100, (estimated / duration) * 100));
      this.domRefs.progressFill.style.width = `${pct.toFixed(2)}%`;
    }

    async seekToRatio(ratio) {
      if (!this.currentTabId) return;
      const clamped = Math.max(0, Math.min(1, ratio));
      this.actionLockUntil = Date.now() + 500;

      if (this.progressState.duration > 0) {
        this.syncProgress(this.progressState.duration * clamped, this.progressState.duration);
      }

      const updated = await this.sendMessageWithAutoInject(this.currentTabId, {
        type: 'SEEK_TO',
        ratio: clamped
      });
      if (updated && updated.hasTrack) {
        this.applyState(updated);
      } else if (!updated) {
        const fallback = await this.executeDirectMediaFallback(this.currentTabId, 'SEEK_TO', clamped);
        if (fallback && fallback.duration > 0) {
          this.syncProgress(fallback.currentTime, fallback.duration);
        }
      }
    }

    clearDynamicGlow() {
      if (this.containerEl) {
        this.containerEl.style.borderColor = '';
        this.containerEl.style.boxShadow = '';
      }
      if (this.domRefs?.playPauseBtn) {
        this.domRefs.playPauseBtn.style.color = '';
        this.domRefs.playPauseBtn.style.backgroundColor = '';
        this.domRefs.playPauseBtn.style.borderColor = '';
      }
      if (this.domRefs?.progressFill) {
        this.domRefs.progressFill.style.backgroundColor = '';
      }
    }

    applyDynamicGlow(r, g, b) {
      if (this.containerEl) {
        this.containerEl.style.borderColor = `rgba(${r}, ${g}, ${b}, 0.45)`;
        this.containerEl.style.boxShadow = `0 12px 32px rgba(0, 0, 0, 0.6), 0 0 22px rgba(${r}, ${g}, ${b}, 0.25)`;
      }
      if (this.domRefs?.playPauseBtn) {
        this.domRefs.playPauseBtn.style.color = `rgb(${r}, ${g}, ${b})`;
        this.domRefs.playPauseBtn.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.16)`;
        this.domRefs.playPauseBtn.style.borderColor = `rgba(${r}, ${g}, ${b}, 0.35)`;
      }
      if (this.domRefs?.progressFill) {
        this.domRefs.progressFill.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
      }
    }

    boostColorVibrancy(r, g, b) {
      // Lift dark/muted averages so the border & play button stay legible on dark themes
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const avg = (r + g + b) / 3;

      if (max < 110) {
        const lift = 145 / Math.max(1, max);
        r = Math.min(255, Math.round(r * lift));
        g = Math.min(255, Math.round(g * lift));
        b = Math.min(255, Math.round(b * lift));
      }

      if (max - min > 12) {
        const boost = 1.28;
        r = Math.max(0, Math.min(255, Math.round(avg + (r - avg) * boost)));
        g = Math.max(0, Math.min(255, Math.round(avg + (g - avg) * boost)));
        b = Math.max(0, Math.min(255, Math.round(avg + (b - avg) * boost)));
      }

      return { r, g, b };
    }

    sampleAlbumArtColor(artUrl) {
      if (!artUrl) {
        this.lastSampledArt = '';
        this.clearDynamicGlow();
        return;
      }

      if (artUrl === this.lastSampledArt) return;
      this.lastSampledArt = artUrl;

      const probe = new Image();
      probe.crossOrigin = 'anonymous';
      probe.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 10;
          canvas.height = 10;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            this.clearDynamicGlow();
            return;
          }

          ctx.drawImage(probe, 0, 0, 10, 10);
          const data = ctx.getImageData(0, 0, 10, 10).data;

          let sumR = 0;
          let sumG = 0;
          let sumB = 0;
          let count = 0;

          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) continue;
            sumR += data[i];
            sumG += data[i + 1];
            sumB += data[i + 2];
            count++;
          }

          if (count === 0) {
            this.clearDynamicGlow();
            return;
          }

          const boosted = this.boostColorVibrancy(
            Math.round(sumR / count),
            Math.round(sumG / count),
            Math.round(sumB / count)
          );
          if (this.currentState.hasTrack && this.currentState.albumArt === artUrl) {
            this.applyDynamicGlow(boosted.r, boosted.g, boosted.b);
          }
        } catch {
          this.clearDynamicGlow();
        }
      };
      probe.onerror = () => {
        this.clearDynamicGlow();
      };

      // Cache-bust CORS probe so it doesn't collide with non-CORS cached responses from the visible <img>
      if (artUrl.startsWith('data:')) {
        probe.src = artUrl;
      } else {
        probe.src = artUrl.includes('?') ? `${artUrl}&cors=1` : `${artUrl}?cors=1`;
      }
    }

    async focusYtmTab() {
      const tabsApi = (typeof browser !== 'undefined' && browser.tabs) ? browser.tabs :
                      (typeof chrome !== 'undefined' && chrome.tabs ? chrome.tabs : null);
      const windowsApi = (typeof browser !== 'undefined' && browser.windows) ? browser.windows :
                         (typeof chrome !== 'undefined' && chrome.windows ? chrome.windows : null);

      if (this.currentTabId && tabsApi) {
        try {
          await tabsApi.update(this.currentTabId, { active: true });
          if (this.currentWindowId && windowsApi) {
            await windowsApi.update(this.currentWindowId, { focused: true });
          }
          return;
        } catch {}
      }

      const url = 'https://music.youtube.com';
      if (tabsApi?.create) tabsApi.create({ url });
      else window.open(url, '_blank');
    }

    async dispatchAction(actionType) {
      if (!this.currentTabId) return;

      this.actionLockUntil = Date.now() + 800;

      if (actionType === 'TOGGLE_PLAY') {
        this.applyState({
          ...this.currentState,
          isPlaying: !this.currentState.isPlaying
        });
      }

      const updated = await this.sendMessageWithAutoInject(this.currentTabId, { type: actionType });
      if (updated && updated.hasTrack) {
        this.applyState({
          hasTrack: true,
          isPlaying: Boolean(updated.isPlaying),
          title: updated.title,
          artist: updated.artist || 'YouTube Music',
          albumArt: updated.albumArt || this.currentState.albumArt,
          currentTime: updated.currentTime || 0,
          duration: updated.duration || 0
        });
      } else if (!updated) {
        await this.executeDirectMediaFallback(this.currentTabId, actionType);
      }
    }

    updateActivePlayerInPlace() {
      if (!this.containerEl) return;

      if (!this.domRefs) {
        this.containerEl.textContent = '';

        const progressTrack = document.createElement('div');
        progressTrack.className = 'ytm-progress-track';
        progressTrack.setAttribute('role', 'slider');
        progressTrack.setAttribute('aria-label', 'Seek track position');
        progressTrack.addEventListener('click', (e) => {
          e.stopPropagation();
          const rect = progressTrack.getBoundingClientRect();
          if (rect.width > 0) {
            this.seekToRatio((e.clientX - rect.left) / rect.width);
          }
        });

        const progressFill = document.createElement('div');
        progressFill.className = 'ytm-progress-fill';
        progressTrack.appendChild(progressFill);
        this.containerEl.appendChild(progressTrack);

        const activeWrap = document.createElement('div');
        activeWrap.className = 'ytm-active-wrap';

        const infoSection = document.createElement('div');
        infoSection.className = 'ytm-mini-info';
        infoSection.setAttribute('role', 'button');
        infoSection.setAttribute('tabindex', '0');
        infoSection.setAttribute('title', 'Switch to music tab');
        infoSection.addEventListener('click', () => this.focusYtmTab());

        const coverBox = document.createElement('div');
        coverBox.className = 'ytm-mini-cover-box';

        const fallback = document.createElement('div');
        fallback.className = 'ytm-mini-cover-fallback';
        fallback.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg>`;

        const img = document.createElement('img');
        img.className = 'ytm-mini-cover-img';
        img.alt = 'Track Cover';
        img.addEventListener('error', () => {
          img.style.display = 'none';
          fallback.style.display = 'flex';
        });

        coverBox.appendChild(img);
        coverBox.appendChild(fallback);
        infoSection.appendChild(coverBox);

        const textBox = document.createElement('div');
        textBox.className = 'ytm-mini-text';

        const titleEl = document.createElement('div');
        titleEl.className = 'ytm-mini-title';

        const artistEl = document.createElement('div');
        artistEl.className = 'ytm-mini-artist';

        textBox.appendChild(titleEl);
        textBox.appendChild(artistEl);
        infoSection.appendChild(textBox);
        activeWrap.appendChild(infoSection);

        const controlsSection = document.createElement('div');
        controlsSection.className = 'ytm-mini-controls';

        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'ytm-ctrl-btn btn-prev';
        prevBtn.setAttribute('aria-label', 'Previous track');
        prevBtn.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>`;
        prevBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.dispatchAction('PREV_TRACK');
        });

        const playPauseBtn = document.createElement('button');
        playPauseBtn.type = 'button';
        playPauseBtn.className = 'ytm-ctrl-btn btn-play-pause';
        playPauseBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.dispatchAction('TOGGLE_PLAY');
        });

        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'ytm-ctrl-btn btn-next';
        nextBtn.setAttribute('aria-label', 'Next track');
        nextBtn.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>`;
        nextBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.dispatchAction('NEXT_TRACK');
        });

        controlsSection.appendChild(prevBtn);
        controlsSection.appendChild(playPauseBtn);
        controlsSection.appendChild(nextBtn);
        activeWrap.appendChild(controlsSection);

        this.containerEl.appendChild(activeWrap);
        this.domRefs = { img, fallback, titleEl, artistEl, playPauseBtn, progressFill, lastArt: '' };
      }

      const { img, fallback, titleEl, artistEl, playPauseBtn } = this.domRefs;
      const state = this.currentState;

      titleEl.textContent = state.title || 'Untitled Track';
      artistEl.textContent = state.artist || 'YouTube Music';

      if (state.albumArt && state.albumArt !== this.domRefs.lastArt) {
        this.domRefs.lastArt = state.albumArt;
        img.src = state.albumArt;
        img.style.display = 'block';
        fallback.style.display = 'none';
        this.sampleAlbumArtColor(state.albumArt);
      } else if (!state.albumArt) {
        this.domRefs.lastArt = '';
        img.style.display = 'none';
        fallback.style.display = 'flex';
        this.sampleAlbumArtColor('');
      }

      this.renderProgressBar();

      playPauseBtn.setAttribute('aria-label', state.isPlaying ? 'Pause' : 'Play');
      playPauseBtn.innerHTML = state.isPlaying
        ? `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`
        : `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>`;
    }

    renderIdleState(hasOpenTab) {
      if (!this.containerEl) return;
      this.domRefs = null;
      this.lastSampledArt = '';
      this.clearDynamicGlow();
      this.containerEl.textContent = '';

      const pill = document.createElement('div');
      pill.className = 'ytm-idle-pill';
      pill.setAttribute('role', 'button');
      pill.setAttribute('tabindex', '0');

      const iconWrap = document.createElement('span');
      iconWrap.className = 'ytm-idle-icon';
      iconWrap.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg>`;

      const text = document.createElement('span');
      text.textContent = hasOpenTab ? 'Paused • Open YouTube Music' : 'No music playing • Open YTM';

      const dot = document.createElement('span');
      dot.className = 'ytm-idle-dot';

      pill.appendChild(iconWrap);
      pill.appendChild(text);
      pill.appendChild(dot);
      pill.addEventListener('click', () => this.focusYtmTab());

      this.containerEl.appendChild(pill);
    }
  }

  /* ==========================================================================
     11. Theme Color Switcher Controller
     ========================================================================== */

  class ThemeController {
    constructor() {
      this.wrapEl = document.getElementById('themeSwitcherWrap');
      this.triggerBtn = document.getElementById('themeTrigger');
      this.popoverEl = document.getElementById('themePopover');
      this.presetsListEl = document.getElementById('themePresetsList');
      this.customAccentInput = document.getElementById('customAccentInput');
      this.customAccentHex = document.getElementById('customAccentHex');
      this.triggerDot = document.getElementById('themeTriggerDot');

      this.currentThemeId = THEME_PRESETS[0].id;
      this.customAccent = THEME_PRESETS[0].accent;
      this.saveTimer = null;

      this.init();
    }

    async init() {
      this.renderPresets();
      this.bindEvents();
      await this.loadTheme();
    }

    hexToRgb(hex) {
      const clean = String(hex || '').replace('#', '');
      if (clean.length !== 6) return { r: 225, g: 29, b: 72 };
      const num = parseInt(clean, 16);
      if (Number.isNaN(num)) return { r: 225, g: 29, b: 72 };
      return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
      };
    }

    lightenHex(hex, ratio) {
      const { r, g, b } = this.hexToRgb(hex);
      const mix = (channel) => Math.min(255, Math.round(channel + (255 - channel) * ratio));
      const toHex = (val) => val.toString(16).padStart(2, '0');
      return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
    }

    applyTheme(themeId, customAccentHex) {
      const preset = THEME_PRESETS.find((t) => t.id === themeId) || THEME_PRESETS[0];
      this.currentThemeId = preset.id;

      const accent = customAccentHex || preset.accent;
      this.customAccent = accent;

      const isPresetDefaultAccent = accent.toLowerCase() === preset.accent.toLowerCase();
      const accentSoft = isPresetDefaultAccent ? preset.accentSoft : this.lightenHex(accent, 0.28);
      const accentBlush = this.lightenHex(accent, 0.52);

      const accentRgb = this.hexToRgb(accent);
      const accentSoftRgb = this.hexToRgb(accentSoft);
      const textRgb = this.hexToRgb(preset.textPrimary);

      const root = document.documentElement;
      root.style.setProperty('--bg-base', preset.bgBase);
      root.style.setProperty('--bg-glow', preset.bgGlow);
      root.style.setProperty('--bg-elevated', preset.bgElevated);
      root.style.setProperty('--text-primary', preset.textPrimary);
      root.style.setProperty('--text-muted', `rgba(${textRgb.r}, ${textRgb.g}, ${textRgb.b}, 0.58)`);
      root.style.setProperty('--text-subtle', `rgba(${textRgb.r}, ${textRgb.g}, ${textRgb.b}, 0.36)`);
      root.style.setProperty('--accent', accent);
      root.style.setProperty('--accent-soft', accentSoft);
      root.style.setProperty('--accent-blush', accentBlush);
      root.style.setProperty('--accent-rgb', `${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}`);
      root.style.setProperty('--accent-soft-rgb', `${accentSoftRgb.r}, ${accentSoftRgb.g}, ${accentSoftRgb.b}`);
      root.style.setProperty('--surface', 'rgba(255, 255, 255, 0.04)');
      root.style.setProperty('--surface-hover', 'rgba(255, 255, 255, 0.08)');
      root.style.setProperty('--border', 'rgba(255, 255, 255, 0.08)');
      root.style.setProperty('--border-subtle', 'rgba(255, 255, 255, 0.14)');

      if (this.customAccentInput) {
        this.customAccentInput.value = accent;
      }
      if (this.customAccentHex) {
        this.customAccentHex.textContent = accent.toLowerCase();
      }
      if (this.triggerDot) {
        this.triggerDot.style.backgroundColor = accent;
      }

      this.updateActivePresetUI();
    }

    async loadTheme() {
      try {
        const stored = await extensionApi.storage.local.get(STORAGE_KEYS.THEME_CONFIG);
        const config = stored && stored[STORAGE_KEYS.THEME_CONFIG];
        if (config && typeof config === 'object') {
          this.applyTheme(config.themeId, config.customAccent);
        } else {
          this.applyTheme(THEME_PRESETS[0].id, THEME_PRESETS[0].accent);
        }
      } catch (err) {
        console.warn('Error loading theme:', err);
        this.applyTheme(THEME_PRESETS[0].id, THEME_PRESETS[0].accent);
      }
    }

    async saveTheme() {
      try {
        await extensionApi.storage.local.set({
          [STORAGE_KEYS.THEME_CONFIG]: {
            themeId: this.currentThemeId,
            customAccent: this.customAccent
          }
        });
      } catch (err) {
        console.error('Error saving theme:', err);
      }
    }

    renderPresets() {
      if (!this.presetsListEl) return;
      this.presetsListEl.textContent = '';

      THEME_PRESETS.forEach((preset) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'theme-preset-btn';
        btn.dataset.themeId = preset.id;
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', 'false');

        const swatchPair = document.createElement('span');
        swatchPair.className = 'theme-swatch-pair';

        const bgSwatch = document.createElement('span');
        bgSwatch.className = 'theme-swatch-bg';
        bgSwatch.style.backgroundColor = preset.bgBase;

        const accentSwatch = document.createElement('span');
        accentSwatch.className = 'theme-swatch-accent';
        accentSwatch.style.backgroundColor = preset.accent;

        swatchPair.appendChild(bgSwatch);
        swatchPair.appendChild(accentSwatch);

        const label = document.createElement('span');
        label.className = 'theme-preset-name';
        label.textContent = preset.name;

        const checkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        checkSvg.setAttribute('viewBox', '0 0 24 24');
        checkSvg.setAttribute('width', '14');
        checkSvg.setAttribute('height', '14');
        checkSvg.setAttribute('fill', 'none');
        checkSvg.setAttribute('stroke', 'currentColor');
        checkSvg.setAttribute('stroke-width', '2.5');
        checkSvg.setAttribute('stroke-linecap', 'round');
        checkSvg.setAttribute('stroke-linejoin', 'round');
        checkSvg.classList.add('theme-preset-check');

        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        polyline.setAttribute('points', '20 6 9 17 4 12');
        checkSvg.appendChild(polyline);

        btn.appendChild(swatchPair);
        btn.appendChild(label);
        btn.appendChild(checkSvg);

        btn.addEventListener('click', () => {
          this.applyTheme(preset.id, preset.accent);
          this.saveTheme();
        });

        this.presetsListEl.appendChild(btn);
      });
    }

    updateActivePresetUI() {
      if (!this.presetsListEl) return;
      const buttons = this.presetsListEl.querySelectorAll('.theme-preset-btn');
      buttons.forEach((btn) => {
        const isActive = btn.dataset.themeId === this.currentThemeId;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
      });
    }

    togglePopover(forceState) {
      if (!this.popoverEl || !this.triggerBtn) return;
      const shouldOpen = typeof forceState === 'boolean'
        ? forceState
        : !this.popoverEl.classList.contains('open');

      this.popoverEl.classList.toggle('open', shouldOpen);
      this.popoverEl.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
      this.triggerBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    }

    bindEvents() {
      if (this.triggerBtn) {
        this.triggerBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.togglePopover();
        });
      }

      if (this.customAccentInput) {
        this.customAccentInput.addEventListener('input', (e) => {
          this.applyTheme(this.currentThemeId, e.target.value);
          clearTimeout(this.saveTimer);
          this.saveTimer = setTimeout(() => this.saveTheme(), 150);
        });

        this.customAccentInput.addEventListener('change', (e) => {
          this.applyTheme(this.currentThemeId, e.target.value);
          this.saveTheme();
        });
      }

      document.addEventListener('click', (e) => {
        if (this.wrapEl && !this.wrapEl.contains(e.target)) {
          this.togglePopover(false);
        }
      });

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.popoverEl && this.popoverEl.classList.contains('open')) {
          this.togglePopover(false);
        }
      });
    }
  }

  /* ==========================================================================
     12. List-Wise Movie Watchlist Controller
     ========================================================================== */

  class WatchlistController {
    constructor() {
      this.triggerBtn = document.getElementById('watchlistTrigger');
      this.triggerCountEl = document.getElementById('watchlistCount');
      this.backdropEl = document.getElementById('watchlistBackdrop');
      this.drawerEl = document.getElementById('watchlistDrawer');
      this.closeBtn = document.getElementById('watchlistCloseBtn');
      this.tabToWatchBtn = document.getElementById('tabToWatch');
      this.tabWatchedBtn = document.getElementById('tabWatched');
      this.toWatchCountEl = document.getElementById('toWatchTabCount');
      this.watchedCountEl = document.getElementById('watchedTabCount');
      this.addForm = document.getElementById('watchlistAddForm');
      this.searchWrapEl = document.getElementById('watchlistSearchWrap');
      this.titleInput = document.getElementById('movieTitleInput');
      this.searchBtn = document.getElementById('movieSearchBtn');
      this.suggestionsEl = document.getElementById('movieSuggestionsDropdown');
      this.lookupHintEl = document.getElementById('movieLookupHint');
      this.actorInput = document.getElementById('movieActorInput');
      this.posterInput = document.getElementById('moviePosterInput');
      this.listEl = document.getElementById('watchlistList');

      this.movies = [];
      this.activeTab = 'to-watch';
      this.searchDebounceTimer = null;
      this.searchRequestId = 0;

      this.init();
    }

    async init() {
      this.bindEvents();
      await this.loadMovies();
      this.render();
    }

    async loadMovies() {
      try {
        const stored = await extensionApi.storage.local.get(STORAGE_KEYS.MOVIE_WATCHLIST);
        if (stored && Array.isArray(stored[STORAGE_KEYS.MOVIE_WATCHLIST])) {
          this.movies = stored[STORAGE_KEYS.MOVIE_WATCHLIST];
        } else {
          this.movies = DEFAULT_WATCHLIST_MOVIES.map((m) => ({ ...m }));
          await this.saveMovies();
        }
      } catch (err) {
        console.warn('Error loading watchlist:', err);
        this.movies = DEFAULT_WATCHLIST_MOVIES.map((m) => ({ ...m }));
      }
    }

    async saveMovies() {
      try {
        await extensionApi.storage.local.set({
          [STORAGE_KEYS.MOVIE_WATCHLIST]: this.movies
        });
      } catch (err) {
        console.error('Error saving watchlist:', err);
      }
    }

    openDrawer() {
      if (!this.drawerEl || !this.backdropEl) return;
      this.drawerEl.classList.add('open');
      this.backdropEl.classList.add('open');
      this.drawerEl.setAttribute('aria-hidden', 'false');
      this.backdropEl.setAttribute('aria-hidden', 'false');
      if (this.triggerBtn) this.triggerBtn.setAttribute('aria-expanded', 'true');

      setTimeout(() => {
        if (this.titleInput) this.titleInput.focus();
      }, 60);
    }

    closeDrawer() {
      if (!this.drawerEl || !this.backdropEl) return;
      this.drawerEl.classList.remove('open');
      this.backdropEl.classList.remove('open');
      this.drawerEl.setAttribute('aria-hidden', 'true');
      this.backdropEl.setAttribute('aria-hidden', 'true');
      if (this.triggerBtn) this.triggerBtn.setAttribute('aria-expanded', 'false');
    }

    setTab(tab) {
      this.activeTab = tab === 'watched' ? 'watched' : 'to-watch';

      if (this.tabToWatchBtn) {
        const active = this.activeTab === 'to-watch';
        this.tabToWatchBtn.classList.toggle('active', active);
        this.tabToWatchBtn.setAttribute('aria-selected', active ? 'true' : 'false');
      }

      if (this.tabWatchedBtn) {
        const active = this.activeTab === 'watched';
        this.tabWatchedBtn.classList.toggle('active', active);
        this.tabWatchedBtn.setAttribute('aria-selected', active ? 'true' : 'false');
      }

      this.render();
    }

    updateCounts() {
      const toWatchCount = this.movies.filter((m) => !m.watched).length;
      const watchedCount = this.movies.filter((m) => m.watched).length;

      if (this.triggerCountEl) this.triggerCountEl.textContent = String(toWatchCount);
      if (this.toWatchCountEl) this.toWatchCountEl.textContent = String(toWatchCount);
      if (this.watchedCountEl) this.watchedCountEl.textContent = String(watchedCount);
    }

    createFilmReelSvg() {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', '18');
      svg.setAttribute('height', '18');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '1.8');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.setAttribute('aria-hidden', 'true');

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', '2');
      rect.setAttribute('y', '4');
      rect.setAttribute('width', '20');
      rect.setAttribute('height', '16');
      rect.setAttribute('rx', '2');
      svg.appendChild(rect);

      const lines = [
        ['7', '4', '7', '20'],
        ['17', '4', '17', '20'],
        ['2', '12', '22', '12'],
        ['2', '8', '7', '8'],
        ['2', '16', '7', '16'],
        ['17', '8', '22', '8'],
        ['17', '16', '22', '16']
      ];
      lines.forEach(([x1, y1, x2, y2]) => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        svg.appendChild(line);
      });

      return svg;
    }

    createMovieRow(movie) {
      const row = document.createElement('div');
      row.className = `watchlist-row${movie.watched ? ' is-watched' : ''}`;
      row.setAttribute('role', 'listitem');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'watchlist-checkbox';
      checkbox.checked = Boolean(movie.watched);
      checkbox.setAttribute(
        'aria-label',
        movie.watched ? `Mark "${movie.title}" as To Watch` : `Mark "${movie.title}" as Watched`
      );

      checkbox.addEventListener('change', () => {
        row.classList.add('is-transitioning');
        setTimeout(async () => {
          movie.watched = checkbox.checked;
          await this.saveMovies();
          this.render();
          showToast(movie.watched ? `Moved "${movie.title}" to Watched` : `Moved "${movie.title}" to To Watch`);
        }, 250);
      });

      const posterBox = document.createElement('div');
      posterBox.className = 'watchlist-poster-box';

      const fallback = document.createElement('div');
      fallback.className = 'watchlist-poster-fallback';
      fallback.appendChild(this.createFilmReelSvg());

      const safePosterUrl = (movie.posterUrl || '').trim();
      if (safePosterUrl && isValidHttpUrl(safePosterUrl, false)) {
        const img = document.createElement('img');
        img.className = 'watchlist-poster-img';
        img.alt = `${movie.title} poster`;
        img.loading = 'lazy';
        img.src = safePosterUrl;
        fallback.style.display = 'none';

        img.addEventListener('error', () => {
          img.style.display = 'none';
          fallback.style.display = 'flex';
        });

        posterBox.appendChild(img);
        posterBox.appendChild(fallback);
      } else {
        posterBox.appendChild(fallback);
      }

      const details = document.createElement('div');
      details.className = 'watchlist-details';

      const titleEl = document.createElement('div');
      titleEl.className = 'watchlist-movie-title';
      titleEl.textContent = movie.title;

      const actorEl = document.createElement('div');
      actorEl.className = 'watchlist-movie-actor';
      actorEl.textContent = movie.actor || 'Cast not specified';

      details.appendChild(titleEl);
      details.appendChild(actorEl);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'watchlist-delete-btn';
      deleteBtn.textContent = '×';
      deleteBtn.title = 'Remove movie';
      deleteBtn.setAttribute('aria-label', `Remove "${movie.title}"`);
      deleteBtn.addEventListener('click', async () => {
        this.movies = this.movies.filter((m) => m.id !== movie.id);
        await this.saveMovies();
        this.render();
        showToast(`Removed "${movie.title}"`);
      });

      row.appendChild(checkbox);
      row.appendChild(posterBox);
      row.appendChild(details);
      row.appendChild(deleteBtn);

      return row;
    }

    render() {
      this.updateCounts();
      if (!this.listEl) return;

      this.listEl.textContent = '';

      const filtered = this.movies.filter((m) =>
        this.activeTab === 'watched' ? Boolean(m.watched) : !m.watched
      );

      if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'watchlist-empty';
        empty.textContent = this.activeTab === 'watched'
          ? 'No watched movies yet.'
          : 'Your To Watch list is empty.';
        this.listEl.appendChild(empty);
        return;
      }

      filtered.forEach((movie) => {
        this.listEl.appendChild(this.createMovieRow(movie));
      });
    }

    async handleAddMovie() {
      const title = this.titleInput ? this.titleInput.value.trim() : '';
      if (!title) return;

      const actor = this.actorInput ? this.actorInput.value.trim() : '';
      const rawPosterUrl = this.posterInput ? this.posterInput.value.trim() : '';
      const posterUrl = isValidHttpUrl(rawPosterUrl, false) ? rawPosterUrl : '';

      const newMovie = {
        id: `movie-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title,
        actor,
        posterUrl,
        watched: false
      };

      this.movies.unshift(newMovie);
      await this.saveMovies();

      if (this.addForm) this.addForm.reset();
      this.hideSuggestions();
      this.clearLookupHint();
      if (this.activeTab !== 'to-watch') {
        this.setTab('to-watch');
      } else {
        this.render();
      }

      showToast(`Added "${title}" to Watchlist`);
      if (this.titleInput) this.titleInput.focus();
    }

    setLookupHint(message) {
      if (this.lookupHintEl) {
        this.lookupHintEl.textContent = message || '';
      }
    }

    clearLookupHint() {
      this.setLookupHint('');
    }

    hideSuggestions() {
      if (!this.suggestionsEl) return;
      this.suggestionsEl.classList.remove('open');
      this.suggestionsEl.setAttribute('aria-hidden', 'true');
      this.suggestionsEl.textContent = '';
    }

    showSuggestionsStatus(message) {
      if (!this.suggestionsEl) return;
      this.suggestionsEl.textContent = '';
      const statusEl = document.createElement('div');
      statusEl.className = 'movie-suggestion-status';
      statusEl.textContent = message;
      this.suggestionsEl.appendChild(statusEl);
      this.suggestionsEl.classList.add('open');
      this.suggestionsEl.setAttribute('aria-hidden', 'false');
    }

    async fetchMovieSuggestions(rawQuery) {
      const query = (rawQuery || '').trim();
      if (!query) {
        this.hideSuggestions();
        this.clearLookupHint();
        return;
      }

      const requestId = ++this.searchRequestId;
      this.clearLookupHint();
      this.showSuggestionsStatus('Searching movies...');

      try {
        const endpoint = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=movie&entity=movie&limit=5`;
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();

        if (requestId !== this.searchRequestId) return;

        const results = Array.isArray(payload.results) ? payload.results.slice(0, 5) : [];
        this.renderSuggestions(results);
      } catch {
        if (requestId !== this.searchRequestId) return;
        this.hideSuggestions();
        this.setLookupHint('Offline or lookup unavailable — enter details manually.');
      }
    }

    renderSuggestions(results) {
      if (!this.suggestionsEl) return;
      this.suggestionsEl.textContent = '';

      if (!results || results.length === 0) {
        this.hideSuggestions();
        this.setLookupHint('No matching movies found — enter details manually.');
        return;
      }

      results.forEach((item) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'movie-suggestion-item';
        btn.setAttribute('role', 'option');

        const posterUrl100 = item.artworkUrl100 || '';
        if (posterUrl100 && isValidHttpUrl(posterUrl100, false)) {
          const img = document.createElement('img');
          img.className = 'movie-suggestion-poster';
          img.src = posterUrl100;
          img.alt = '';
          img.loading = 'lazy';
          btn.appendChild(img);
        }

        const info = document.createElement('div');
        info.className = 'movie-suggestion-info';

        const year = item.releaseDate ? String(item.releaseDate).slice(0, 4) : '';
        const titleText = item.trackName || 'Untitled';
        const titleEl = document.createElement('div');
        titleEl.className = 'movie-suggestion-title';
        titleEl.textContent = year ? `${titleText} (${year})` : titleText;

        const metaEl = document.createElement('div');
        metaEl.className = 'movie-suggestion-meta';
        metaEl.textContent = item.artistName || 'Unknown Director / Cast';

        info.appendChild(titleEl);
        info.appendChild(metaEl);
        btn.appendChild(info);

        btn.addEventListener('click', () => {
          if (this.titleInput) {
            this.titleInput.value = year ? `${titleText} (${year})` : titleText;
          }
          if (this.actorInput) {
            this.actorInput.value = item.artistName || '';
          }
          if (this.posterInput && posterUrl100 && isValidHttpUrl(posterUrl100, false)) {
            this.posterInput.value = posterUrl100.replace('100x100bb', '400x600bb');
          }
          this.hideSuggestions();
          if (this.actorInput) this.actorInput.focus();
        });

        this.suggestionsEl.appendChild(btn);
      });

      this.suggestionsEl.classList.add('open');
      this.suggestionsEl.setAttribute('aria-hidden', 'false');
    }

    bindEvents() {
      if (this.triggerBtn) {
        this.triggerBtn.addEventListener('click', () => this.openDrawer());
      }
      if (this.closeBtn) {
        this.closeBtn.addEventListener('click', () => this.closeDrawer());
      }
      if (this.backdropEl) {
        this.backdropEl.addEventListener('click', () => this.closeDrawer());
      }
      if (this.tabToWatchBtn) {
        this.tabToWatchBtn.addEventListener('click', () => this.setTab('to-watch'));
      }
      if (this.tabWatchedBtn) {
        this.tabWatchedBtn.addEventListener('click', () => this.setTab('watched'));
      }
      if (this.titleInput) {
        this.titleInput.addEventListener('input', () => {
          clearTimeout(this.searchDebounceTimer);
          this.clearLookupHint();
          const q = this.titleInput.value.trim();
          if (q.length < 2) {
            this.hideSuggestions();
            return;
          }
          this.searchDebounceTimer = setTimeout(() => {
            this.fetchMovieSuggestions(q);
          }, 400);
        });
      }
      if (this.actorInput) {
        this.actorInput.addEventListener('focus', () => this.hideSuggestions());
      }
      if (this.posterInput) {
        this.posterInput.addEventListener('focus', () => this.hideSuggestions());
      }
      if (this.searchBtn) {
        this.searchBtn.addEventListener('click', () => {
          clearTimeout(this.searchDebounceTimer);
          const q = this.titleInput ? this.titleInput.value.trim() : '';
          if (q) {
            this.fetchMovieSuggestions(q);
          } else if (this.titleInput) {
            this.titleInput.focus();
          }
        });
      }
      if (this.addForm) {
        this.addForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleAddMovie();
        });
      }

      document.addEventListener('click', (e) => {
        if (this.searchWrapEl && !this.searchWrapEl.contains(e.target)) {
          this.hideSuggestions();
        }
      });

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if (this.suggestionsEl && this.suggestionsEl.classList.contains('open')) {
            this.hideSuggestions();
            return;
          }
          if (this.drawerEl && this.drawerEl.classList.contains('open')) {
            this.closeDrawer();
          }
        }
      });
    }
  }

  /* ==========================================================================
     13. Custom Wallpaper Layer Controller
     ========================================================================== */

  class WallpaperController {
    constructor() {
      this.fileInput = document.getElementById('wallpaperFileInput');
      this.clearBtn = document.getElementById('wallpaperClearBtn');
      this.dimInput = document.getElementById('wallpaperDimInput');
      this.dimValueEl = document.getElementById('wallpaperDimValue');
      this.blurInput = document.getElementById('wallpaperBlurInput');
      this.blurValueEl = document.getElementById('wallpaperBlurValue');

      this.config = {
        dataUrl: '',
        dim: 55,
        blur: 2
      };
      this.saveTimer = null;

      this.init();
    }

    async init() {
      this.bindEvents();
      await this.loadWallpaper();
    }

    applyWallpaper() {
      const root = document.documentElement;
      const hasSafeImage = isSafeDataImageUrl(this.config.dataUrl);

      root.style.setProperty(
        '--wallpaper-image',
        hasSafeImage ? `url("${this.config.dataUrl}")` : 'none'
      );
      root.style.setProperty('--wallpaper-dim', String((this.config.dim ?? 55) / 100));
      root.style.setProperty('--wallpaper-blur', `${this.config.blur ?? 2}px`);
      document.body.classList.toggle('has-wallpaper', hasSafeImage);

      if (this.dimInput) this.dimInput.value = String(this.config.dim ?? 55);
      if (this.dimValueEl) this.dimValueEl.textContent = `${this.config.dim ?? 55}%`;
      if (this.blurInput) this.blurInput.value = String(this.config.blur ?? 2);
      if (this.blurValueEl) this.blurValueEl.textContent = `${this.config.blur ?? 2}px`;
    }

    async loadWallpaper() {
      try {
        const stored = await extensionApi.storage.local.get(STORAGE_KEYS.WALLPAPER_CONFIG);
        const saved = stored && stored[STORAGE_KEYS.WALLPAPER_CONFIG];
        if (saved && typeof saved === 'object') {
          this.config = {
            dataUrl: isSafeDataImageUrl(saved.dataUrl) ? saved.dataUrl : '',
            dim: Number.isFinite(Number(saved.dim)) ? Math.max(0, Math.min(85, Number(saved.dim))) : 55,
            blur: Number.isFinite(Number(saved.blur)) ? Math.max(0, Math.min(16, Number(saved.blur))) : 2
          };
        } else {
          this.config = { dataUrl: '', dim: 55, blur: 2 };
        }
      } catch (err) {
        console.warn('Error loading wallpaper:', err);
      }
      this.applyWallpaper();
    }

    async saveWallpaper() {
      try {
        await extensionApi.storage.local.set({
          [STORAGE_KEYS.WALLPAPER_CONFIG]: this.config
        });
      } catch (err) {
        console.error('Error saving wallpaper:', err);
      }
    }

    compressImageToDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to read image.'));
        reader.onload = () => {
          const img = new Image();
          img.onerror = () => reject(new Error('Invalid image file.'));
          img.onload = () => {
            const maxWidth = 1920;
            const scale = img.width > maxWidth ? maxWidth / img.width : 1;
            const targetW = Math.max(1, Math.round(img.width * scale));
            const targetH = Math.max(1, Math.round(img.height * scale));

            const canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Canvas unavailable.'));
              return;
            }

            ctx.drawImage(img, 0, 0, targetW, targetH);
            try {
              resolve(canvas.toDataURL('image/jpeg', 0.82));
            } catch (err) {
              reject(err);
            }
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    }

    bindEvents() {
      if (this.fileInput) {
        this.fileInput.addEventListener('change', async (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          if (!file.type.startsWith('image/')) {
            showToast('Please select a valid image file');
            return;
          }

          try {
            const dataUrl = await this.compressImageToDataUrl(file);
            this.config.dataUrl = dataUrl;
            this.applyWallpaper();
            await this.saveWallpaper();
            showToast('Custom wallpaper applied');
          } catch {
            showToast('Could not load wallpaper image');
          } finally {
            this.fileInput.value = '';
          }
        });
      }

      if (this.clearBtn) {
        this.clearBtn.addEventListener('click', async () => {
          this.config.dataUrl = '';
          this.applyWallpaper();
          await this.saveWallpaper();
          showToast('Wallpaper cleared');
        });
      }

      if (this.dimInput) {
        this.dimInput.addEventListener('input', (e) => {
          this.config.dim = Number(e.target.value);
          this.applyWallpaper();
          clearTimeout(this.saveTimer);
          this.saveTimer = setTimeout(() => this.saveWallpaper(), 150);
        });
      }

      if (this.blurInput) {
        this.blurInput.addEventListener('input', (e) => {
          this.config.blur = Number(e.target.value);
          this.applyWallpaper();
          clearTimeout(this.saveTimer);
          this.saveTimer = setTimeout(() => this.saveWallpaper(), 150);
        });
      }
    }
  }

  /* ==========================================================================
     14. One-Click JSON Backup & Restore Controller
     ========================================================================== */

  class BackupController {
    constructor() {
      this.exportBtn = document.getElementById('backupExportBtn');
      this.importBtn = document.getElementById('backupImportBtn');
      this.importInput = document.getElementById('backupImportInput');

      this.bindEvents();
    }

    bindEvents() {
      if (this.exportBtn) {
        this.exportBtn.addEventListener('click', () => this.exportBackup());
      }
      if (this.importBtn && this.importInput) {
        this.importBtn.addEventListener('click', () => this.importInput.click());
        this.importInput.addEventListener('change', (e) => {
          const file = e.target.files && e.target.files[0];
          if (file) {
            this.importBackup(file);
          }
          this.importInput.value = '';
        });
      }
    }

    sanitizeImportedData(rawData) {
      const sanitized = {};

      if (Array.isArray(rawData[STORAGE_KEYS.PINNED_SHORTCUTS])) {
        sanitized[STORAGE_KEYS.PINNED_SHORTCUTS] = rawData[STORAGE_KEYS.PINNED_SHORTCUTS]
          .filter((item) => item && typeof item === 'object' && isValidHttpUrl(item.url, true))
          .map((item) => ({
            id: typeof item.id === 'string' ? item.id : `pin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title: typeof item.title === 'string' ? item.title.trim().slice(0, 64) : getDisplayDomain(item.url),
            url: toSafeHttpUrl(item.url),
            isPinned: true,
            isCustom: Boolean(item.isCustom)
          }));
      }

      if (Array.isArray(rawData[STORAGE_KEYS.HIDDEN_URLS])) {
        sanitized[STORAGE_KEYS.HIDDEN_URLS] = rawData[STORAGE_KEYS.HIDDEN_URLS]
          .filter((u) => typeof u === 'string' && u.length > 0 && u.length < 256);
      }

      if (Array.isArray(rawData[STORAGE_KEYS.CUSTOM_YTM_PLAYLISTS])) {
        sanitized[STORAGE_KEYS.CUSTOM_YTM_PLAYLISTS] = rawData[STORAGE_KEYS.CUSTOM_YTM_PLAYLISTS]
          .filter((p) => p && typeof p === 'object' && isValidHttpUrl(p.url, true))
          .map((p) => {
            const rawCover = typeof p.cover === 'string' ? p.cover.trim() : '';
            const safeCover = (isSafeDataImageUrl(rawCover) || isValidHttpUrl(rawCover, false) || /^assets\/[a-zA-Z0-9_./-]+$/.test(rawCover))
              ? rawCover
              : '';
            return {
              id: typeof p.id === 'string' ? p.id : `ytm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              title: typeof p.title === 'string' ? p.title.trim().slice(0, 64) : 'Untitled Playlist',
              url: toSafeHttpUrl(p.url),
              cover: safeCover
            };
          });
      }

      if (Array.isArray(rawData[STORAGE_KEYS.MOVIE_WATCHLIST])) {
        sanitized[STORAGE_KEYS.MOVIE_WATCHLIST] = rawData[STORAGE_KEYS.MOVIE_WATCHLIST]
          .filter((m) => m && typeof m === 'object' && typeof m.title === 'string' && m.title.trim().length > 0)
          .map((m) => {
            const rawPoster = typeof m.posterUrl === 'string' ? m.posterUrl.trim() : '';
            return {
              id: typeof m.id === 'string' ? m.id : `movie-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              title: m.title.trim().slice(0, 120),
              actor: typeof m.actor === 'string' ? m.actor.trim().slice(0, 120) : '',
              posterUrl: isValidHttpUrl(rawPoster, false) ? rawPoster : '',
              watched: Boolean(m.watched)
            };
          });
      }

      if (rawData[STORAGE_KEYS.THEME_CONFIG] && typeof rawData[STORAGE_KEYS.THEME_CONFIG] === 'object') {
        const cfg = rawData[STORAGE_KEYS.THEME_CONFIG];
        sanitized[STORAGE_KEYS.THEME_CONFIG] = {
          themeId: typeof cfg.themeId === 'string' ? cfg.themeId : THEME_PRESETS[0].id,
          customAccent: typeof cfg.customAccent === 'string' && /^#[0-9a-fA-F]{6}$/.test(cfg.customAccent)
            ? cfg.customAccent
            : THEME_PRESETS[0].accent
        };
      }

      if (rawData[STORAGE_KEYS.WALLPAPER_CONFIG] && typeof rawData[STORAGE_KEYS.WALLPAPER_CONFIG] === 'object') {
        const wp = rawData[STORAGE_KEYS.WALLPAPER_CONFIG];
        sanitized[STORAGE_KEYS.WALLPAPER_CONFIG] = {
          dataUrl: isSafeDataImageUrl(wp.dataUrl) ? wp.dataUrl : '',
          dim: Number.isFinite(Number(wp.dim)) ? Math.max(0, Math.min(85, Number(wp.dim))) : 55,
          blur: Number.isFinite(Number(wp.blur)) ? Math.max(0, Math.min(16, Number(wp.blur))) : 2
        };
      }

      return sanitized;
    }

    async exportBackup() {
      try {
        const allKeys = Object.values(STORAGE_KEYS);
        const stored = await extensionApi.storage.local.get(allKeys);

        const payload = {
          version: '1.6.0',
          exportedAt: new Date().toISOString(),
          data: stored || {}
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const dateStamp = new Date().toISOString().slice(0, 10);

        const a = document.createElement('a');
        a.href = url;
        a.download = `velvet-newtab-backup-${dateStamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('Backup exported');
      } catch (err) {
        console.error('Export failed:', err);
        showToast('Failed to export backup');
      }
    }

    async importBackup(file) {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);

        if (!parsed || typeof parsed !== 'object' || !parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) {
          showToast('Invalid backup file format');
          return;
        }

        const toRestore = this.sanitizeImportedData(parsed.data);

        if (Object.keys(toRestore).length === 0) {
          showToast('No valid extension data found');
          return;
        }

        await extensionApi.storage.local.set(toRestore);

        if (themeController) await themeController.loadTheme();
        if (wallpaperController) await wallpaperController.loadWallpaper();
        if (shortcutsController) {
          await shortcutsController.loadStoredData();
          await shortcutsController.renderGrid();
        }
        if (playlistsController) {
          await playlistsController.loadPlaylists();
          playlistsController.render();
        }
        if (watchlistController) {
          await watchlistController.loadMovies();
          watchlistController.render();
        }

        showToast('Backup restored successfully');
      } catch (err) {
        console.error('Import failed:', err);
        showToast('Failed to parse backup JSON');
      }
    }
  }

  /* ==========================================================================
     15. Keyboard-First Global Navigation Controller
     ========================================================================== */

  class KeyboardNavigationController {
    constructor() {
      this.bindEvents();
    }

    isEditableTarget(target) {
      if (!target || !(target instanceof Element)) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    }

    focusSearch() {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }

    launchPlaylistByIndex(index) {
      if (!playlistsController || !Array.isArray(playlistsController.playlists)) return;
      const playlist = playlistsController.playlists[index];
      if (!playlist || !playlist.url) return;

      const safeUrl = toSafeHttpUrl(playlist.url, '');
      if (!safeUrl) return;

      if (OPEN_PLAYLIST_IN_NEW_TAB) {
        window.open(safeUrl, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = safeUrl;
      }
    }

    bindEvents() {
      window.addEventListener('keydown', (e) => {
        const isTyping = this.isEditableTarget(e.target);

        // Ctrl+K / Cmd+K: Focus & select search bar from anywhere
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          this.focusSearch();
          return;
        }

        // Alt+1 through Alt+9: Launch 1st..9th playlist
        if (e.altKey && !e.ctrlKey && !e.metaKey && e.key >= '1' && e.key <= '9') {
          e.preventDefault();
          this.launchPlaylistByIndex(Number(e.key) - 1);
          return;
        }

        // Ignore single-key shortcuts while typing
        if (isTyping) return;

        // "/" focuses & selects search bar
        if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          this.focusSearch();
          return;
        }

        // Space toggles Play/Pause on YTM mini-player (unless activating a focused button/link)
        if (
          e.code === 'Space' &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          e.target.tagName !== 'BUTTON' &&
          e.target.tagName !== 'A'
        ) {
          e.preventDefault();
          if (ytmMiniPlayerController) {
            ytmMiniPlayerController.dispatchAction('TOGGLE_PLAY');
          }
        }
      });
    }
  }

  /* ==========================================================================
     16. Application Bootstrap
     ========================================================================== */

  let shortcutsController;
  let modalController;
  let playlistsController;
  let playlistModalController;
  let ytmMiniPlayerController;
  let themeController;
  let wallpaperController;
  let watchlistController;
  let backupController;
  let keyboardNavigationController;

  document.addEventListener('DOMContentLoaded', () => {
    themeController = new ThemeController();
    wallpaperController = new WallpaperController();
    watchlistController = new WatchlistController();
    new ClockController();
    new SearchController();
    shortcutsController = new ShortcutsController();
    modalController = new ModalController();
    playlistsController = new PlaylistsController();
    playlistModalController = new PlaylistModalController();
    ytmMiniPlayerController = new YtmMiniPlayerController();
    backupController = new BackupController();
    keyboardNavigationController = new KeyboardNavigationController();
  });
})();