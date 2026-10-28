# ClipSave — UI Redesign, Responsive Architecture & Server Wake Audit

## 1. Project Overview & Architecture
- **Framework:** React Native 0.88.0, Expo SDK 58.0.19, React 19.3.0, TypeScript 6.0.3 (Strict mode).
- **Navigation:** Expo Router 58.0.26 with file-based routing:
  - Root: `app/_layout.tsx` (Splash screen gatekeeper, ThemeProvider, LaunchAnimation, SafeAreaProvider).
  - Main Tabs: `app/(tabs)/_layout.tsx`:
    - `index.tsx`: Home / Downloader
    - `queue.tsx`: Download Queue & Activity
    - `history.tsx`: Download Library / History
    - `settings.tsx`: Settings & Preferences
  - Modals / Subroutes: `app/about.tsx`, `app/preview.tsx`.
- **Backend:** FastAPI hosted on SnapDeploy (`https://clipsave-96518.containers.snapdeploy.app`).
- **Storage & State:**
  - `src/storage/settingsStore.ts`: AsyncStorage `@clipsave_settings_v1` with synchronous in-memory cache.
  - `src/storage/queueStore.ts`: AsyncStorage `@clipsave_queue_jobs_v1` with listener subscriptions.
  - `src/storage/historyStore.ts`: AsyncStorage `@clipsave_history_items_v1`.
  - `src/services/downloadEngine.ts`: Concurrent download queue with pause, resume, cancel, retry, and progress tracking.

## 2. Investigation of Visual & Layout Defects
1. **Repeating Floating Gear Icons:**
   - *Root Cause:* In the user's screenshots (`media_1793161892034_2cc064d8.jpg`, etc.), multiple floating gear icons appear on the right side over content. Inspection of the React Native codebase confirms that **no floating gear icons exist in the code**. The device is a Xiaomi/Redmi (MIUI/HyperOS) phone with "Quick Ball" (Touch Assistant) or "Game Turbo" enabled. When a native rolling/scrolling screenshot is captured, the OS stitcher repeatedly captures the fixed floating system widget along each scroll frame.
   - *Action:* Confirm that all screen templates use standard layout flow without rogue `position: 'absolute'` buttons that could collide with system overlays.
2. **Horizontal Overflow & Screen Boundary Violations:**
   - *Queue Screen:* In `app/(tabs)/queue.tsx`, the `telemetryBanner` forced a long status string and the `Resume All` button into an unconstrained horizontal flex row, forcing the button off the right edge.
   - *Filter Pills:* The filter row lacked responsive chip wrapping or properly constrained horizontal scrolling.
   - *Home Carousel:* Promotional decks and feature tiles had negative gutter margins and unpadded cards that cut off at screen edges.

## 3. Server Wake & Idle Sleep Audit
- SnapDeploy containers sleep after 15 minutes of zero HTTP traffic.
- Incoming requests to a sleeping container return `503 Service Unavailable` with `X-Wake-Page: true`.
- SnapDeploy wake API: `POST https://snapdeploy.dev/api/public/wake/{subdomain}`.
- *Problem Identified:* Idle background health checks were previously resetting the 15-minute countdown, keeping the container active and burning monthly hours.
- *Resolution:* Only send the wake signal on-demand when the user requests a link resolution. Do not maintain background polling or keep-alive pings when idle, allowing the container to sleep automatically after completing the task.

## 4. Implementation Plan (Following Target Reference Image)
1. **Design Tokens & Theme System:**
   - Support `ThemeMode`: `system`, `light`, `dark`.
   - Support `ColorPalette`: `warm_light`, `midnight`, `sage`.
   - Support `AccentColor`: `coral` (#FE2C55), `blue` (#2563EB), `violet` (#8B5CF6), `green` (#10B981), `amber` (#F59E0B).
   - Instant startup hydration via `settingsStore.ts` and `ThemeContext.tsx`.
2. **Screen 1 — Home Redesign:**
   - Compact header: ClipSave logo + wordmark + overflow menu.
   - Hero: "Paste a TikTok link" / "Save your favorite videos in seconds".
   - Full-width link input with link icon, clear button, and URL validator.
   - Full-width primary action button: "Get video" (coral accent).
   - Compact resolved video preview card (thumbnail with duration & play icon, title, @creator, overflow menu).
   - Accordion rows: "Quick actions" and "More features".
   - Clean removal of redundant promotional carousels and feature badges.
3. **Screen 2 — Queue Redesign:**
   - Large "Queue" header + compact 3-column summary (`Active` | `Paused` | `Done`).
   - Compact filter pills: `All`, `Active`, `Paused`, `Done`.
   - Clean download cards with thumbnail (play icon & duration), title, @creator, size/resolution, progress bar with percentage, and two pill buttons (`⏸ Pause` | `✕ Cancel`).
4. **Screen 3 — History Redesign:**
   - Large "History" header + search bar & "Filter" chip button.
   - Centered, minimal empty state ("No Saved Videos Yet" + explanation, no oversized outer container).
   - Clean saved video items with thumbnail, metadata, and 3-dots action menu.
5. **Screen 4 — Settings Redesign:**
   - Large "Settings" header + 4 compact expandable accordion rows:
     1. Appearance (Theme mode, palette selector, accent color picker)
     2. Downloads (Wi-Fi only, Save to Gallery, Simultaneous downloads stepper)
     3. Storage (Used storage display, Clear temporary files, Delete all saved videos)
     4. About (App version, Privacy and licenses)
   - Danger zone: "Clear all history" card with confirmation dialog.
