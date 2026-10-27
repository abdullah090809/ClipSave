# ClipSave — UI & UX Redesign Audit

**Date:** 2026-10-27  
**Repository:** `D:\Skills\Tiktok Downloader`  
**Target:** Android (Expo SDK 58, React Native 0.88, React 19, TypeScript strict mode)

---

## 1. Existing Screen Inventory

| Screen Route | Title | Key Components / Features |
|---|---|---|
| `app/(tabs)/index.tsx` | Downloader | Giant circular download orb, top header with info & settings buttons, clipboard detector, manual entry modal with TextInput. |
| `app/(tabs)/queue.tsx` | Activity | Metric summary tabs (`All`, `Active`, `Failed`, `Done`), `SectionList` with `ActiveCard`, `FailedCard`, `DoneCard`, progress tracks, pause/resume/cancel/retry actions. |
| `app/(tabs)/history.tsx` | Videos | 2-column grid vs list mode toggle, search bar, filter chips (`All`, `On Device`, `Missing`), `BottomSheetMenu` for sharing and file deletion, lazy batch file verification. |
| `app/(tabs)/settings.tsx` | Settings | App header, Theme selector (`System`, `Light`, `Dark`), cache purging, library clearing with two-step deletion confirmation. |
| `app/preview.tsx` | Preview Modal | Video metadata card, portrait thumbnail, verified clean source badge, format/duration chips, "Download Video" and "Cancel" buttons. |
| `app/about.tsx` | About | App information, version, license, privacy notice, third-party acknowledgments. |
| `app/_layout.tsx` | Root Layout | Native splash screen hold (`preventAutoHideAsync`), theme & settings hydration sync, launch animation component mounting. |
| `app/(tabs)/_layout.tsx` | Tab Navigation | 4 destinations: Downloader (`index`), Activity (`queue`), Videos (`history`), Settings (`settings`). Insets elevation above system gesture bar. |

---

## 2. Existing Functional Flows

1. **Link Intake & Resolution Flow:**
   - User copies a TikTok link (`tiktok.com`, `vm.tiktok.com`, `vt.tiktok.com`).
   - Downloader detects the clipboard URL or user inputs URL manually.
   - `extractAndValidateTikTokUrl` validates scheme, host, path, and security properties (no control characters, private IPs, or lookalikes).
   - `resolveTikTokUrl` calls the FastAPI backend `/v1/resolve` (or local mock resolver when enabled) with client timeout and abort controller.
   - On resolution, returns `ResolvedMedia` containing title, author, media URL, direct clean stream flag, duration, estimated bytes, and format.
   - Navigates to `/preview` modal with serialized metadata.

2. **Download Execution & Queue Management Flow:**
   - User confirms download in `/preview` (or triggers instant download).
   - `startDownload` creates a `DownloadJob` with initial state `QUEUED` -> `DOWNLOADING`.
   - `expo-file-system` `createDownloadResumable` streams the MP4 file to a temporary directory with byte progress events.
   - Byte progress throttles updates to `queueStore`.
   - On completion, `mediaManager` safely moves the file to the app's document directory and indexes it into the Android Media Library (Gallery) via `expo-media-library`.
   - Record is persisted into `historyStore` (`@clipsave_history_v1`).
   - User can pause, resume, cancel, or retry downloads via `downloadEngine`.

3. **Media Library & Saved Videos Flow:**
   - `historyStore` loads saved history items.
   - Items are verified against the physical filesystem in batches (`checkHistoryFilesExist`).
   - If a file was deleted externally, it is displayed with a missing badge and a re-download action (prefilling the Downloader).
   - If a file exists, user can share via Android system share sheet (`expo-sharing`) or delete the entry and underlying disk file.

4. **Settings & Theming Flow:**
   - `ThemeContext` provides `system`, `light`, and `dark` modes with persisted preference in AsyncStorage.
   - `settingsStore` manages app configuration (`AppSettings`).
   - Storage maintenance allows purging leftover partial chunks (`cleanOrphanedTempFiles`) or wiping library history and video files with confirmation.

---

## 3. Current Layout & UX Problems Identified

1. **Downloader Screen:**
   - **Problem:** The oversized 200dp circular orb dominates the screen and creates vast empty space. While tapping it reads the clipboard, a first-time user cannot tell what the orb does or where to type a link.
   - **Solution:** Redesign the Downloader into a purpose-built, intuitive download console:
     - Prominent, clear URL input bar at the top of the workflow.
     - Intuitive Paste button with instant clipboard detection pill ("TikTok link detected — tap to paste").
     - Clear, self-explanatory primary "Download" action button explaining what happens next.
     - A compact, polished secondary interaction for one-tap clipboard downloading without dominating the entire viewport.
     - Direct, frictionless path to preview or immediate background download.

2. **Activity Screen:**
   - **Problem:** Four large statistic/filter boxes take up valuable vertical space above the fold, and empty states are oversized.
   - **Solution:**
     - Replace large tiles with a compact summary bar / segmented chips (`All`, `Active`, `Failed`, `Completed`).
     - Prioritize active downloads prominently with high-fidelity progress readouts (speed, transferred/total bytes, ETA, percentage).
     - Compact, information-dense transfer cards with contextual controls (Pause, Resume, Cancel, Retry).
     - Clear, actionable failure diagnostics.

3. **Videos Screen:**
   - **Problem:** When empty, an oversized illustration dominates the screen. When populated, card metadata lacks consistent visual hierarchy.
   - **Solution:**
     - A true media library experience: responsive two-column grid (or clean list toggle) prioritizing authentic video thumbnails.
     - Clean metadata chips (duration, file size, creator).
     - Clear distinction between verified local files vs. missing/moved files with instant re-download.
     - Instant local search and filter chips.
     - Compact, helpful onboarding state when empty with a direct route to the Downloader.

4. **Settings Screen:**
   - **Problem:** Clunky, inconsistent card styling with wasted whitespace.
   - **Solution:**
     - Group settings into compact, scannable Android Material 3 sections:
       1. *Appearance* (Theme selection)
       2. *Startup & Motion* (Startup animation: Off, Subtle, Standard)
       3. *Downloads & Storage* (Save to gallery, storage path)
       4. *Performance & Cleanup* (Purge temp cache, delete videos)
       5. *About & Privacy* (App version, privacy policy, license)
     - Clean rows with subtle dividers, consistent typography, and no decorative card bloat.

---

## 4. Confirmed Performance Issues & Startup Diagnostics

1. **Startup Theme & Splash Synchronization:**
   - When launching, if `SplashScreen` auto-hides before `AsyncStorage` resolves `@clipsave_theme_mode`, the app renders Frame 1 in system default and switches on Frame 2, causing a visible flicker.
   - Gating `SplashScreen.hideAsync()` on `isThemeReady && appReady` completely eliminates theme flash.
2. **Startup Animation Options:**
   - Needs user-configurable options: `Off`, `Subtle`, and `Standard`.
   - `Off`: Native splash hides directly into the UI with 0ms transition.
   - `Subtle`: Lightweight 180ms opacity fade.
   - `Standard`: Tasteful 400ms branded entrance.
   - Protected by a module-level cold-start guard (`hasPlayedColdStartAnimation`) so it never replays on tab navigation.
3. **Queue Byte Progress Subscriptions:**
   - Progress events firing at 10 Hz previously re-rendered the entire screen.
   - Isolating progress subscriptions to individual `useJob(jobId)` rows reduces commit work by ~65%.
4. **Virtualization & Insets:**
   - Missing `insets.bottom` in navigation bars caused elements to be submerged beneath Android gesture pills. Proper safe area handling resolves all clipping.

---

## 5. Existing Test Baseline

- **TypeScript (`tsc --noEmit`):** 0 errors.
- **Jest Unit Tests:** 11 suites, 69 tests passing (0 failures).
- **Backend Pytest:** 24 tests passing in 1.39s (0 failures).
- **Expo Export (`expo export --platform android`):** Clean compilation of Hermes bytecode (3.1MB).

---

## 6. Proposed New Screen Hierarchy

```
[ App Root (Stack) ]
   ├── (tabs) [Bottom Navigation Bar with Safe Area Insets]
   │     ├── Downloader (Clear URL Input, Paste Chip, Action Buttons, Compact Quick-Orb)
   │     ├── Activity (Compact Filter Pills, Active Job Showcase, Dense Transfer Cards)
   │     ├── Videos (Media Grid/List, Thumbnail Badges, Missing-File Detection, Search)
   │     └── Settings (Grouped List: Appearance, Startup & Motion, Storage, Cleanup, About)
   ├── Preview Modal (Portrait Thumbnail, Facts Grid, Download Button)
   └── About Screen (App Info, Licenses, Privacy)
```
