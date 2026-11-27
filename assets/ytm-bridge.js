/**
 * Universal WebNowPlaying Media Bridge
 * ------------------------------------
 * Injected into YouTube Music, YouTube, and Spotify tabs
 * - Robust track metadata extraction (MediaSession, MoviePlayer, DOM, Document Title)
 * - Playback control (play, pause, next, previous)
 * - Real-time state broadcasting to extension
 */

(function () {
  'use strict';

  if (window.__velvetBridgeActive) return;
  window.__velvetBridgeActive = true;

  const runtime = (function () {
    if (typeof browser !== 'undefined' && browser.runtime) {
      return browser.runtime;
    }
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return chrome.runtime;
    }
    return null;
  })();

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

  function getArtworkUrl() {
    // 1. Try MediaSession artwork
    const mediaSession = window.wrappedJSObject?.navigator?.mediaSession || navigator.mediaSession;
    if (mediaSession && mediaSession.metadata && mediaSession.metadata.artwork) {
      const artwork = mediaSession.metadata.artwork;
      if (Array.isArray(artwork) && artwork.length > 0) {
        const best = artwork[artwork.length - 1];
        if (best && best.src) return best.src;
      }
    }

    // 2. Try YTM / YouTube / Spotify cover art
    const coverSelectors = [
      'ytmusic-player-bar img#img',
      'ytmusic-player-bar .thumbnail img',
      'ytmusic-player-bar .image img',
      'ytmusic-player-bar #thumbnail img',
      'ytmusic-player-bar .image',
      '#player-thumbnail img',
      'ytd-watch-metadata #thumbnail img',
      '[data-testid="cover-art-image"]',
      'img[data-testid="entity-image"]'
    ];

    for (const sel of coverSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const src = el.src || el.getAttribute('src');
        if (src && !src.startsWith('data:image/svg')) {
          return src.replace(/=w\d+-h\d+/, '=w160-h160');
        }
      }
    }

    // 3. Fallback to YouTube video ID from URL
    try {
      const parsed = new URL(window.location.href);
      const vid = parsed.searchParams.get('v');
      if (vid) {
        return `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
      }
    } catch {}

    return '';
  }

  function extractTrackInfo() {
    const media = document.querySelector('video, audio');
    const isPlaying = media ? !media.paused && !media.ended && media.readyState > 1 : false;

    let title = '';
    let artist = '';
    let album = '';
    const albumArt = getArtworkUrl();

    // 1. Check window.wrappedJSObject.navigator.mediaSession (Firefox Xray wrapper)
    const mediaSession = window.wrappedJSObject?.navigator?.mediaSession || navigator.mediaSession;
    if (mediaSession && mediaSession.metadata) {
      const meta = mediaSession.metadata;
      if (meta.title) title = meta.title.trim();
      if (meta.artist) artist = meta.artist.trim();
      if (meta.album) album = meta.album.trim();
    }

    // 2. Check movie_player.getVideoData() (YouTube HTML5 player API)
    if (!title || !artist) {
      try {
        const moviePlayer = window.wrappedJSObject?.document?.getElementById('movie_player') ||
                            document.getElementById('movie_player');
        if (moviePlayer && typeof moviePlayer.getVideoData === 'function') {
          const vData = moviePlayer.getVideoData();
          if (vData && vData.title) {
            if (!title) title = vData.title.trim();
            if (!artist) artist = (vData.author || '').trim();
          }
        }
      } catch {}
    }

    // 3. Fallback to DOM queries (YTM, YouTube, Spotify)
    if (!title) {
      title = queryText([
        'ytmusic-player-bar yt-formatted-string.title',
        'ytmusic-player-bar .content-info-wrapper .title',
        'ytmusic-player-bar .title',
        '.title.ytmusic-player-bar',
        '#layout > ytmusic-player-bar .content-info-wrapper yt-formatted-string',
        'ytd-watch-metadata #title h1 yt-formatted-string',
        'h1.ytd-watch-metadata',
        '[data-testid="context-item-info-title"] a',
        '[data-testid="nowplaying-track-link"]'
      ]);
    }

    if (!artist) {
      artist = queryText([
        'ytmusic-player-bar yt-formatted-string.byline a',
        'ytmusic-player-bar .byline a',
        'ytmusic-player-bar yt-formatted-string.byline',
        'ytmusic-player-bar .byline',
        'ytmusic-player-bar .subtitle a',
        'ytmusic-player-bar .subtitle',
        '#layout > ytmusic-player-bar .byline',
        'ytd-channel-name a',
        '#owner #channel-name a',
        '[data-testid="context-item-info-artist"] a',
        '[data-testid="context-item-info-subtitles"]'
      ]);

      if (artist.includes(' • ')) {
        const parts = artist.split(' • ');
        artist = parts[0].trim();
        if (parts.length > 1 && !album) {
          album = parts[1].trim();
        }
      }
    }

    // 4. Fallback to document.title
    if (!title) {
      const docTitle = document.title || '';
      if (docTitle.includes(' • ')) {
        const parts = docTitle.split(' • ');
        title = parts[0].trim();
        if (!artist && parts[1]) {
          artist = parts[1].replace(/ - YouTube Music$/, '').trim();
        }
      } else if (docTitle.includes(' - YouTube Music')) {
        title = docTitle.replace(/ - YouTube Music$/, '').trim();
      } else if (docTitle.includes(' - YouTube')) {
        const clean = docTitle.replace(/ - YouTube$/, '').trim();
        if (clean.includes(' - ')) {
          const parts = clean.split(' - ');
          artist = parts[0].trim();
          title = parts.slice(1).join(' - ').trim();
        } else {
          title = clean;
        }
      }
    }

    const hasTrack = Boolean(title && title !== 'YouTube Music' && title !== 'YouTube' && title !== 'Spotify');

    return {
      hasTrack,
      isPlaying,
      title: title || '',
      artist: artist || '',
      album: album || '',
      albumArt: albumArt || '',
      url: window.location.href
    };
  }

  function doTogglePlay() {
    const ytmPlayBtn = document.querySelector('#play-pause-button') ||
                       document.querySelector('ytmusic-player-bar #play-pause-button') ||
                       document.querySelector('.play-pause-button');
    if (ytmPlayBtn) {
      ytmPlayBtn.click();
      return;
    }

    const ytPlayBtn = document.querySelector('.ytp-play-button');
    if (ytPlayBtn) {
      ytPlayBtn.click();
      return;
    }

    const spotifyPlayBtn = document.querySelector('[data-testid="control-button-playpause"]');
    if (spotifyPlayBtn) {
      spotifyPlayBtn.click();
      return;
    }

    const media = document.querySelector('video, audio');
    if (media) {
      if (media.paused) media.play().catch(() => {});
      else media.pause();
    }
  }

  function doNext() {
    const nextBtn = document.querySelector('.next-button') ||
                    document.querySelector('#next-button') ||
                    document.querySelector('ytmusic-player-bar .next-button') ||
                    document.querySelector('.ytp-next-button') ||
                    document.querySelector('[data-testid="control-button-skip-forward"]');
    if (nextBtn) {
      nextBtn.click();
      return;
    }

    try {
      const mp = window.wrappedJSObject?.document?.getElementById('movie_player') ||
                 document.getElementById('movie_player');
      if (mp && typeof mp.nextVideo === 'function') mp.nextVideo();
    } catch {}
  }

  function doPrev() {
    const prevBtn = document.querySelector('.previous-button') ||
                    document.querySelector('#previous-button') ||
                    document.querySelector('ytmusic-player-bar .previous-button') ||
                    document.querySelector('.ytp-prev-button') ||
                    document.querySelector('[data-testid="control-button-skip-back"]');
    if (prevBtn) {
      prevBtn.click();
      return;
    }

    try {
      const mp = window.wrappedJSObject?.document?.getElementById('movie_player') ||
                 document.getElementById('movie_player');
      if (mp && typeof mp.previousVideo === 'function') mp.previousVideo();
    } catch {}
  }

  let lastBroadcast = '';
  function broadcastState() {
    if (!runtime || !runtime.sendMessage) return;
    try {
      const info = extractTrackInfo();
      const serialized = `${info.title}|${info.artist}|${info.isPlaying}|${info.albumArt}`;
      if (serialized === lastBroadcast) return;
      lastBroadcast = serialized;

      runtime.sendMessage({
        type: 'YTM_STATE_CHANGED',
        data: info
      }).catch(() => {});
    } catch {}
  }

  function setupObservers() {
    const bindMedia = () => {
      const media = document.querySelector('video, audio');
      if (media && !media.__velvetObserved) {
        media.__velvetObserved = true;
        media.addEventListener('play', broadcastState);
        media.addEventListener('pause', broadcastState);
        media.addEventListener('ended', broadcastState);
      }
    };

    bindMedia();
    setInterval(bindMedia, 3000);

    const playerBar = document.querySelector('ytmusic-player-bar') ||
                      document.getElementById('movie_player') ||
                      document.querySelector('footer');
    if (playerBar && window.MutationObserver) {
      const observer = new MutationObserver(() => {
        broadcastState();
      });
      observer.observe(playerBar, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['title', 'aria-label', 'src', 'class']
      });
    }

    const titleEl = document.querySelector('title');
    if (titleEl && window.MutationObserver) {
      const titleObserver = new MutationObserver(() => {
        broadcastState();
      });
      titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }
  }

  if (runtime && runtime.onMessage) {
    runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (!request || !request.type) return false;

      switch (request.type) {
        case 'GET_STATUS': {
          sendResponse(extractTrackInfo());
          return false;
        }

        case 'TOGGLE_PLAY': {
          doTogglePlay();
          setTimeout(() => {
            const updated = extractTrackInfo();
            sendResponse(updated);
            broadcastState();
          }, 120);
          return true;
        }

        case 'NEXT_TRACK': {
          doNext();
          setTimeout(() => {
            const updated = extractTrackInfo();
            sendResponse(updated);
            broadcastState();
          }, 250);
          return true;
        }

        case 'PREV_TRACK': {
          doPrev();
          setTimeout(() => {
            const updated = extractTrackInfo();
            sendResponse(updated);
            broadcastState();
          }, 250);
          return true;
        }

        default:
          return false;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupObservers);
  } else {
    setupObservers();
  }
})();
