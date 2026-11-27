/**
 * Stabilized Media Bridge for Firefox (YouTube Music / YouTube / Spotify)
 * Eliminates state flickering via active-media selection, debounce, and non-empty locking.
 */
(function () {
  'use strict';

  if (window.__velvetBridgeActive) return;
  window.__velvetBridgeActive = true;

  const runtime = (typeof browser !== 'undefined' && browser.runtime)
    ? browser.runtime
    : (typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime : null);

  let lastGoodArt = '';
  let lastBroadcast = '';
  let debounceTimer = null;

  function queryText(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = (el.innerText || el.textContent || '').trim();
        if (text) return text;
      }
    }
    return '';
  }

  // Pick the actual playing media element, or the one with a loaded source
  function getActiveMedia() {
    const mediaEls = Array.from(document.querySelectorAll('video, audio'));
    return (
      mediaEls.find((m) => !m.paused && !m.ended && m.currentSrc) ||
      mediaEls.find((m) => m.currentSrc && m.duration > 0) ||
      mediaEls[0] ||
      null
    );
  }

  function getArtworkUrl() {
    // 1. DOM Cover Art Selectors FIRST (YTM sometimes leaves mediaSession.artwork as [] on initial load)
    const coverSelectors = [
      'ytmusic-player-bar img#img',
      'ytmusic-player-bar .image img',
      'ytmusic-player-bar .thumbnail img',
      '[data-testid="cover-art-image"]',
      'img[data-testid="entity-image"]'
    ];

    for (const sel of coverSelectors) {
      const el = document.querySelector(sel);
      const src = el?.currentSrc || el?.src || el?.getAttribute('src') || '';
      if (src && !src.startsWith('data:image/svg') && !src.includes('pixel')) {
        const cleanSrc = src.replace(/=w\d+-h\d+/, '=w240-h240');
        lastGoodArt = cleanSrc;
        return cleanSrc;
      }
    }

    // 2. Standard MediaSession API Fallback
    if (navigator.mediaSession?.metadata?.artwork?.length) {
      const artwork = navigator.mediaSession.metadata.artwork;
      const best = artwork[artwork.length - 1];
      if (best?.src && !best.src.startsWith('data:image/svg')) {
        const cleanSrc = best.src.replace(/=w\d+-h\d+/, '=w240-h240');
        lastGoodArt = cleanSrc;
        return cleanSrc;
      }
    }

    // 3. YouTube Video ID Fallback
    try {
      const vid = new URL(window.location.href).searchParams.get('v');
      if (vid) return `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
    } catch {}

    return lastGoodArt;
  }

  function extractTrackInfo() {
    const media = getActiveMedia() || document.querySelector('video');
    // Only check !media.paused && !media.ended (ignore readyState dips during buffering)
    const isPlaying = Boolean(media && !media.paused && !media.ended);

    let title = navigator.mediaSession?.metadata?.title?.trim() || '';
    let artist = navigator.mediaSession?.metadata?.artist?.trim() || '';

    // DOM Fallbacks
    if (!title) {
      title = queryText([
        'ytmusic-player-bar yt-formatted-string.title',
        'ytmusic-player-bar .title',
        'ytd-watch-metadata #title h1 yt-formatted-string',
        '[data-testid="context-item-info-title"] a'
      ]);
    }

    if (!artist) {
      artist = queryText([
        'ytmusic-player-bar yt-formatted-string.byline a',
        'ytmusic-player-bar .byline a',
        'ytmusic-player-bar .byline',
        'ytd-channel-name a',
        '[data-testid="context-item-info-artist"] a'
      ]);

      if (artist.includes(' • ')) {
        artist = artist.split(' • ')[0].trim();
      }
    }

    // Document Title Fallback
    if (!title) {
      const docTitle = document.title || '';
      if (docTitle.includes(' - YouTube Music')) {
        title = docTitle.replace(/ - YouTube Music$/, '').trim();
      } else if (docTitle.includes(' - YouTube')) {
        title = docTitle.replace(/ - YouTube$/, '').trim();
      }
    }

    const ignoredTitles = ['YouTube Music', 'YouTube', 'Spotify', ''];
    const hasTrack = !ignoredTitles.includes(title);
    const currentTime = (media && Number.isFinite(media.currentTime)) ? media.currentTime : 0;
    const duration = (media && Number.isFinite(media.duration) && media.duration > 0) ? media.duration : 0;

    return {
      hasTrack,
      isPlaying,
      title: hasTrack ? title : '',
      artist: hasTrack ? artist : '',
      albumArt: hasTrack ? getArtworkUrl() : '',
      currentTime: hasTrack ? currentTime : 0,
      duration: hasTrack ? duration : 0,
      url: window.location.href
    };
  }

  function doTogglePlay() {
    const btn =
      document.querySelector('ytmusic-player-bar #play-pause-button') ||
      document.querySelector('#play-pause-button') ||
      document.querySelector('.ytp-play-button') ||
      document.querySelector('[data-testid="control-button-playpause"]');

    if (btn) {
      btn.click();
      return;
    }

    const media = getActiveMedia();
    if (media) {
      media.paused ? media.play().catch(() => {}) : media.pause();
    }
  }

  function doNext() {
    const btn =
      document.querySelector('ytmusic-player-bar .next-button') ||
      document.querySelector('.next-button') ||
      document.querySelector('.ytp-next-button') ||
      document.querySelector('[data-testid="control-button-skip-forward"]');
    if (btn) btn.click();
  }

  function doPrev() {
    const btn =
      document.querySelector('ytmusic-player-bar .previous-button') ||
      document.querySelector('.previous-button') ||
      document.querySelector('.ytp-prev-button') ||
      document.querySelector('[data-testid="control-button-skip-back"]');
    if (btn) btn.click();
  }

  function broadcastState(immediate = false) {
    if (!runtime?.sendMessage) return;

    const send = () => {
      try {
        const info = extractTrackInfo();
        const serialized = `${info.hasTrack}|${info.title}|${info.artist}|${info.isPlaying}|${info.albumArt}`;
        if (serialized === lastBroadcast) return;
        lastBroadcast = serialized;

        runtime.sendMessage({ type: 'YTM_STATE_CHANGED', data: info }).catch(() => {});
      } catch {}
    };

    if (immediate) {
      clearTimeout(debounceTimer);
      send();
      return;
    }

    // Debounce DOM mutations by 150ms so mid-render states never leak to the UI
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(send, 150);
  }

  function setupObservers() {
    let observedTarget = null;
    let activeObserver = null;

    const bindObserver = () => {
      if (!window.MutationObserver) return;

      // Prefer the hydrated player-bar container over <title> so album art & track switches fire immediately
      const preferredContainer =
        document.querySelector('ytmusic-player-bar .middle-controls') ||
        document.querySelector('ytmusic-player-bar') ||
        document.querySelector('[data-testid="now-playing-widget"]') ||
        document.querySelector('title');

      if (preferredContainer && preferredContainer !== observedTarget) {
        if (activeObserver) {
          activeObserver.disconnect();
        }
        observedTarget = preferredContainer;
        activeObserver = new MutationObserver(() => broadcastState(false));
        activeObserver.observe(preferredContainer, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['src', 'title']
        });
        broadcastState(true);
      }
    };

    const bindMedia = () => {
      const media = getActiveMedia();
      if (media && !media.__velvetObserved) {
        media.__velvetObserved = true;
        media.addEventListener('play', () => broadcastState(true));
        media.addEventListener('pause', () => broadcastState(true));
        media.addEventListener('loadedmetadata', () => broadcastState(true));
      }
      bindObserver();
    };

    bindMedia();
    setInterval(bindMedia, 3000);
  }

  const msgTarget = (typeof browser !== 'undefined' && browser.runtime?.onMessage)
    ? browser.runtime
    : (typeof chrome !== 'undefined' && chrome.runtime?.onMessage ? chrome.runtime : null);

  if (msgTarget) {
    const isFirefox = typeof browser !== 'undefined';

    msgTarget.onMessage.addListener((request, sender, sendResponse) => {
      if (!request?.type) return false;

      if (request.type === 'GET_STATUS') {
        const info = extractTrackInfo();
        if (isFirefox) return Promise.resolve(info);
        sendResponse(info);
        return false;
      }

      if (request.type === 'TOGGLE_PLAY') {
        doTogglePlay();
        if (isFirefox) {
          return new Promise((resolve) => {
            setTimeout(() => {
              const updated = extractTrackInfo();
              broadcastState(true);
              resolve(updated);
            }, 200);
          });
        }
        setTimeout(() => {
          const updated = extractTrackInfo();
          broadcastState(true);
          sendResponse(updated);
        }, 200);
        return true;
      }

      if (request.type === 'NEXT_TRACK') {
        doNext();
        if (isFirefox) {
          return new Promise((resolve) => {
            setTimeout(() => {
              const updated = extractTrackInfo();
              broadcastState(true);
              resolve(updated);
            }, 350);
          });
        }
        setTimeout(() => {
          const updated = extractTrackInfo();
          broadcastState(true);
          sendResponse(updated);
        }, 350);
        return true;
      }

      if (request.type === 'PREV_TRACK') {
        doPrev();
        if (isFirefox) {
          return new Promise((resolve) => {
            setTimeout(() => {
              const updated = extractTrackInfo();
              broadcastState(true);
              resolve(updated);
            }, 350);
          });
        }
        setTimeout(() => {
          const updated = extractTrackInfo();
          broadcastState(true);
          sendResponse(updated);
        }, 350);
        return true;
      }

      if (request.type === 'SEEK_TO') {
        const media = getActiveMedia() || document.querySelector('video');
        const ratio = Math.max(0, Math.min(1, Number(request.ratio) || 0));
        if (media && Number.isFinite(media.duration) && media.duration > 0) {
          media.currentTime = media.duration * ratio;
        }
        const updated = extractTrackInfo();
        broadcastState(true);
        if (isFirefox) return Promise.resolve(updated);
        sendResponse(updated);
        return false;
      }

      return false;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupObservers);
  } else {
    setupObservers();
  }
})();