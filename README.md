# Velvet New Tab

A minimalist, frosted-glass, keyboard-first custom New Tab extension for Firefox (Manifest V3). Built with overlapping Rainmeter-style typography, selectable search engines and bangs, live YouTube Music controls, a TMDB-powered movie watchlist, and local-first storage—with zero tracking or external telemetry.

![Firefox](https://img.shields.io/badge/Firefox-140.0%2B-FF7139?logo=firefox-browser&logoColor=white)
![Manifest](https://img.shields.io/badge/Manifest-V3-e11d48)
![License](https://img.shields.io/badge/License-MIT-blue)

## Features

- **Rainmeter-Style Overlapping Clock:** Bold, clean time, day badge, and date display anchored at the top of the dashboard.
- **Multi-Engine Search & Custom Bangs:** Instant search bar with direct URL detection, selectable search engine support, and quick bang shortcuts:
  - `!ytm <query>` — Search YouTube Music
  - `!gh <query>` — Search GitHub
  - `!mdn <query>` — Search MDN Web Docs
  - `!g <query>` — Search Google
- **Live YouTube Music Mini-Player:** Syncs directly with hydrated YouTube Music, YouTube, or Spotify player controls via a lightweight content script bridge (`ytm-bridge.js`) for instant play/pause, track skipping, seek scrubbing, and CORS-safe dynamic album-art accent glow.
- **Curated Playlist Shelf:** One-click pills for your favorite YouTube Music playlists with custom square cover uploads or URLs.
- **TMDB-Powered Movie Watchlist:** Slide-out *To Watch* / *Watched* drawer with live TMDB v3 movie search, automatic `w500` poster fetching, and top-billed cast lookup using your own locally stored TMDB v3 API Key or Read Access Token.
- **Borderless Shortcut Grid:** Combines pinned custom shortcuts with Firefox `topSites` and history suggestions, complete with hover pin/hide micro-controls and strict `http:`/`https:` URL validation.
- **Themes, Wallpapers & JSON Backup:** Built-in color presets (*Velvet & Rose*, *Midnight & Cyan*, *Emerald & Obsidian*, *Amber & Espresso*), custom hex accent picker, validated local wallpaper upload with dim/blur sliders, and one-click JSON export/restore.

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `/` or `Ctrl+K` (`Cmd+K`) | Focus and select the search bar |
| `Space` | Toggle Play / Pause on the active music tab |
| `Alt + 1` – `Alt + 9` | Launch the 1st through 9th playlist in your shelf |
| `Esc` | Clear search input or close active modals/drawers |

## Installation


### Load Locally for Development
1. Clone this repository:
   ```bash
   git clone [https://github.com/kruses-locker/firefox-extention.git](https://github.com/kruses-locker/firefox-extention.git)
   cd firefox-extention
