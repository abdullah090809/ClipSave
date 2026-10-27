# ClipSave — Redesign Plan and Performance Report

Environment: Linux container, Node + Jest, `expo export`. **No Android emulator, device, or Android SDK was available**, and the uploaded zip contained no `.git` history. A local baseline commit of the uploaded files was used for diffs and before/after runs.

## 1. Problems found in the uploaded code

| Area | Verified problem |
|---|---|
| Home | Large title + subtitle, 3-step "How it works" list, a duplicated settings gear, a disclaimer, and an "active download" card all competed with the input. |
| Queue | Three different bordered cards, a 4-pill filter bar and per-row coloured borders. Screen re-rendered on every progress tick. RESOLVING/READY jobs fell through to the *failed* row. |
| History | Loaded only on mount, so new downloads did not appear until the screen remounted. `fileExists` was never verified, so the "file moved" state could not appear. Share + trash buttons on every row; delete choices lived in one 3-button alert. |
| Settings | Every row had an icon box; "Reset to Default" hard-coded `http://192.168.1.243:8080`, not the real default. |
| Preview | `typography.headlineSmall` does not exist (title was unstyled); "Verified Clean" was hard-coded regardless of `isCleanSourceVerified`. |
| Typography tokens | Typed `Record<string, TextStyle>`, so TypeScript could not catch a missing key. |
| Bundle | `import { Ionicons } from '@expo/vector-icons'` pulled every icon font family into the export. |

## 2. New structure (before → after)

**Home** — Before: title block, hero text, input bar, resolve button, live-shelf card, 3-step guide, disclaimer. After: compact header; one filled field with trailing Paste / Clear; one helper slot that swaps between guidance and error (no layout jump); one full-width Continue; one privacy line; up to 3 flat "Recent" rows. Resolver errors add a "Check resolver in Settings" action; input is always preserved. History "Re-download" now prefills this field.

**Queue** — Before: filter pills + card per job. After: sections *In progress / Needs attention / Completed* with flat hairline-separated rows. Active rows: title, status · real bytes · %, thin progress, pause/resume + cancel. Failed: reason + Retry. Completed: size + saved location + Share. "Clear finished" lives in the Completed header. Empty state points to Home.

**History** — Before: search bar always shown, bordered card rows, share + trash. After: library rows with a 44×58 portrait thumbnail, 2-line title, `date · size · creator`. One primary action (Share, or Re-download when the file is missing) + a ⋮ bottom sheet (Share · Remove from library · Delete video file…). File deletion needs a second confirmation. Search opens from the header. Missing-file state is now real (see §4).

**Settings** — Before: icon-box rows. After: Appearance (segmented), Connection, Development (mock resolver), Storage (clear temp files; clear history in destructive colour with a two-step file-deletion confirmation), About. No inactive settings were added.

**Preview** — Before: hero image with overlay pills, spec chips, dock. After: top bar with close, portrait thumbnail beside title/creator, a plain facts list (duration, estimated size, format — only when known), fixed bottom actions (Download primary, Cancel secondary). Watermark wording appears only when the resolver reports `isCleanSourceVerified`.

**Navigation** — Home / Queue / History / Settings kept; routes unchanged. Library icons, system-computed bar height/insets, queue badge for active jobs. `freezeOnBlur` set on tabs.

## 3. Functionality deliberately not changed

Backend, API contract, download engine, queue store and state machine, URL validation, filename sanitising, history persistence, theme persistence, mock mode. `src/storage/historyStore.ts` gained one additive read-only function (`checkHistoryFilesExist`).

## 4. Performance — what was verified

All numbers below come from this container (Node/Jest/Hermes export), **not a phone**.

| Measure | Before | After | Method |
|---|---|---|---|
| Queue render work, 25 jobs, 200 progress ticks on one job | 974–1024 ms summed `actualDuration` (200 commits) | 286–365 ms (200 commits) | React Profiler + `react-test-renderer`, 3 runs each, same fixture, fake timers |
| Android Hermes bundle | 3,106,095 B | 2,765,822 B | `expo export --platform android` |
| Exported assets | 45 files | 27 files | same export |
| Total export size | 7,208,669 B | 3,180,146 B | same export |

Causes confirmed and fixed: whole-screen re-render on each progress tick (rows now subscribe individually; the screen updates only on structural changes); every icon font bundled (per-family import); missing-file checks were never run (now lazy, ≤12 visible rows per batch, once per visit).

Not measured: startup time, frame rate, tab-switch latency, theme-switch latency, History scrolling at ~1,000 rows, real-device jank. I could not reproduce "the app is slow" on a device, so I make **no** claim about perceived speed. `freezeOnBlur` is expected to reduce work in inactive tabs but was not measured.

## 5. Verification

- `npx tsc --noEmit`: clean.
- `npx jest`: 11 suites, 68 tests pass (59 baseline + 9 new).
- Backend `pytest`: 22 pass, 2 fail **only because the sandbox has no DNS** (they resolve `www.tiktok.com`); backend code is untouched. Re-run on your machine.
- `expo export --platform android`: succeeds.
- Not done: emulator/device run, screenshots, 360/430 dp checks, large-font, keyboard-open and TalkBack checks, APK build.

## 6. Open items

- `wifiOnly`, `saveToGallery`, `autoDownloadOnResolve`, `maxConcurrentDownloads` exist in settings storage but nothing reads them (the engine always saves to gallery), so no UI was added for them.
- There is no "Open file" action in the original app (Share only); none was invented.
- Theme preference loads asynchronously, so a user with a saved override may see one frame of the system theme.
- `Card`, `Badge`, `DisclaimerBanner`, `ScreenHeader` remain (About uses some); About was not redesigned.
- `retryDownload` restarts from byte 0 (original behaviour).
