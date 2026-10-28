# ClipSave — UI Redesign & Architecture Handover

## 1. Overview & Objective
This document outlines the complete mobile UI redesign of **ClipSave** following the visual reference in `ClipSave Mobile UI Showcase.png`. All four core application screens (**Home**, **Queue**, **History**, **Settings**), the theme system, and responsive mobile layouts have been rebuilt from the ground up while preserving the existing React Native, Expo, and TypeScript architecture.

---

## 2. Investigation of Previous Layout & UI Anomalies

### 2.1 The "Repeating Floating Gear Icons" Mystery
- **Investigation:** Code inspection of the entire repository confirmed that **zero** floating gear icons exist in the application code.
- **Root Cause:** The user's physical device is a Xiaomi/Redmi device running HyperOS/MIUI with "Quick Ball" (Touch Assistant) or "Game Turbo" enabled. When a scrolling (rolling) screenshot is captured natively on the device, the floating system assistant widget remains stationary on the glass while the content scrolls underneath. The OS rolling screenshot stitcher captures this fixed overlay on every stitched frame, making it appear multiple times along the margin.
- **Resolution:** Confirmed all layouts use clean flex layout without absolute-positioned floating buttons that could collide with system widgets.

### 2.2 Horizontal Overflow & Boundary Violations
- **Queue Screen:** Previously, the `telemetryBanner` placed a long status message and the "Resume All" button in an unconstrained flex row without `minWidth: 0` or wrapping, pushing the action button beyond the right bezel on narrower screens.
- **Resolution:** Replaced the cluttered banner with the clean 3-column status summary card (`Active` | `Paused` | `Done`), with flexible equal-width columns.

### 2.3 Server Sleep vs. Container Burning
- **Investigation:** SnapDeploy automatically sleeps containers after 15 minutes of zero HTTP traffic. Previously, `checkAndWarmBackend()` was called in a `useFocusEffect` on the Home screen, sending background `/healthz` pings repeatedly whenever tabs were focused. This prevented the container from entering its natural idle sleep and burned through monthly container hours.
- **Resolution (Option B Implemented):** Removed the recurring focus-effect background polling. In its place, the app sends a **single, non-blocking one-shot wake ping on app launch** and upon URL paste. While the user navigates or prepares their link, the container boots up in parallel. Once the task finishes, zero background HTTP traffic is generated, allowing the container to sleep automatically after 15 minutes of zero traffic.

---

## 3. Theme & Design Tokens Implementation

### 3.1 Three Appearance Modes
- `system`: Reacts immediately to OS light/dark changes via React Native's `useColorScheme`.
- `light`: Explicit light mode override.
- `dark`: Explicit dark mode override.

### 3.2 Three Color Palettes
1. **Warm Light (`warm_light`)**:
   - Light: Warm off-white background (`#FAF8F5`), white surfaces (`#FFFFFF`), charcoal text (`#1C1B1A`), slate secondary (`#5C5854`), neutral border (`#E5E0D8`).
   - Dark: Charcoal warm background (`#181716`), dark surface (`#222120`), light charcoal text (`#F5F2EC`).
2. **Midnight (`midnight`)**:
   - Dark: Deep obsidian charcoal (`#0D0F12`), dark surfaces (`#14171D`), near-white text (`#F4F6F8`), muted grey (`#8E96A4`).
   - Light: Cool grey background (`#F0F2F5`), white surfaces (`#FFFFFF`), dark charcoal text (`#0D0F12`).
3. **Sage (`sage`)**:
   - Light: Calm organic sage background (`#F3F6F4`), white surfaces (`#FFFFFF`), dark sage text (`#152018`).
   - Dark: Forest charcoal background (`#0D1310`), dark forest surfaces (`#141C18`), soft sage text (`#EEF3EF`).

### 3.3 Five Accessible Accent Colors
- **Coral**: `#FE2C55` (TikTok Vibrant Magenta/Coral)
- **Blue**: `#2563EB` (Royal Blue)
- **Violet**: `#8B5CF6` (Electric Violet)
- **Green**: `#10B981` (Emerald Green)
- **Amber**: `#F59E0B` (Warm Amber)

### 3.4 Storage & Startup Hydration
- Preferences persist in `@clipsave_settings_v1` via `settingsStore.ts`.
- Memory cache ensures instant startup without theme flashing.

---

## 4. Screen-by-Screen Implementation

### Screen 1: Home (`app/(tabs)/index.tsx`)
- **Header**: Compact `TabHeader` with ClipSave brand logo, wordmark, and 3-dots overflow menu.
- **Centered Hero**: "Paste a TikTok link" / "Save your favorite videos in seconds".
- **Clipboard Prompt Chip**: Appears when a TikTok URL is detected on clipboard ("TikTok link detected: tap to paste").
- **URL Input**: Clean container with link icon, placeholder "Paste TikTok link here...", autoCapitalize="none", clear button (`close-circle`), and inline validation.
- **Primary Action**: Full-width Coral button "[download-outline] Get video" with loading spinner and live status updates ("Resolving video...", "Waking up server...").
- **Resolved Video Preview Card**:
  - Thumbnail with duration badge (`0:32`) and centered play icon overlay.
  - Video title (2 lines max), author (`@creator`), format/size badge.
  - 3-dots action sheet (Download Video, Extract Audio MP3, Copy TikTok Link, Dismiss).
  - Direct "Download Video (1080p)" action button.
- **Two Expandable Accordion Rows**:
  1. `Quick actions` (Yellow star icon): Paste from Clipboard, Clear Input Field.
  2. `More features` (Purple sparkles icon): No Watermark Guarantee, Full HD 1080p Resolution, Fast Multithreaded Engine.
- **Removed**: Oversized carousels, feature badge grids, and background keep-alive pingers.

### Screen 2: Queue (`app/(tabs)/queue.tsx`)
- **Header**: `TabHeader` title="Queue", 3-dots overflow menu (Pause All, Resume All, Clear Finished).
- **Summary Card**: Compact 3-column card displaying `Active`, `Paused`, and `Done` counts. Tapping any column filters the list.
- **Filter Pills**: `All`, `Active`, `Paused`, `Done` with active accent pill styling.
- **Download Cards**:
  - Thumbnail with play overlay and duration badge.
  - Title, author handle, size & resolution (`12.4 MB • 1080p`).
  - Progress bar with percentage text using tabular numbers (`typography.numeric`).
  - Two equal pill buttons:
    - Active: `[pause] Pause` | `[close] Cancel`
    - Paused: `[play] Resume` | `[close] Cancel`
    - Done: `[play-circle] Play` | `[share] Share`
    - Failed: `[reload] Retry` | `[trash] Remove`
- **Empty State**: Centered download tray icon, "Your queue is empty", and a "Download a Video" button navigating to Home.

### Screen 3: History (`app/(tabs)/history.tsx`)
- **Header**: `TabHeader` title="History", 3-dots overflow menu (Sort Newest, Sort Size, Clear All History).
- **Search & Filter Row**:
  - Search input ("Search videos...") with clear button.
  - "Filter" chip button opening sort modal (Newest First, Oldest First, Largest File Size).
- **Video Cards**: Thumbnail with duration badge & play icon, title, author, file size & save date, 3-dots action sheet (Play, Share, Copy Link, Redownload, Delete).
- **Empty State**: Centered circular film icon, "No Saved Videos Yet", and "Download Videos" button navigating to Home.

### Screen 4: Settings (`app/(tabs)/settings.tsx`)
- **Header**: `TabHeader` title="Settings", 3-dots overflow menu (Reset Preferences, About).
- **Four Expandable Accordion Sections**:
  1. `Appearance`: Theme Mode segmented pills (System, Light, Dark), Color Palette selector (Warm Light, Midnight, Sage), Accent Color circular swatches (Coral, Blue, Violet, Green, Amber).
  2. `Downloads`: Wi-Fi only switch, Save to Gallery switch, Simultaneous downloads stepper ([-] [count] [+], 1 to 5).
  3. `Storage`: Used storage metric ("48.2 MB used"), "Clear temporary files" cache purge button.
  4. `About`: App information, Privacy & Terms dialog, Open Source Licenses.
- **Danger Zone**: Red border card "Clear all history" with red pill button and confirmation dialog.

---

## 5. Reusable Components Created / Enhanced
1. `src/components/TabHeader.tsx`: Unified header component for all screens with brand logo, screen title, subtitle, and 3-dots overflow action.
2. `src/components/AccordionRow.tsx`: Animated, accessible disclosure accordion with icon bubble, title, subtitle, rotating chevron, and smooth height transition.
3. `src/theme/colors.ts`: Centralized theme tokens, `ACCENT_PRESETS`, `PALETTE_PRESETS`, and `getThemeColors(isDark, palette, accentKey)`.

---

## 6. Verification & Quality Assurance Results

| Test / Check | Tool / Command | Result | Notes |
| :--- | :--- | :--- | :--- |
| **TypeScript Typecheck** | `npm run typecheck` (`tsc --noEmit`) | **PASS (0 errors)** | Strict TypeScript compliance |
| **Unit Test Suite** | `npm test` (`jest`) | **PASS (12 suites, 80 tests)** | 100% test pass rate |
| **Android Bundle Export** | `npx expo export --platform android --no-bytecode` | **PASS** | 1059 modules bundled successfully |
| **Live Backend Wake Test** | SnapDeploy Wake API (`POST https://snapdeploy.dev/api/public/wake/clipsave-96518`) | **PASS** | Container boots and returns 200 OK |
| **Live Resolver Test** | `POST /v1/resolve` with TikTok URL | **PASS** | Metadata, clean stream URL, cookies returned |

---

## 7. Handover Checklist
- [x] All 4 screens redesigned to match `ClipSave Mobile UI Showcase.png`.
- [x] Floating gear icon mystery resolved (MIUI/HyperOS native screenshot overlay).
- [x] Horizontal overflow bugs eliminated.
- [x] Background idle pings removed to allow SnapDeploy container sleep.
- [x] On-demand server wake integrated seamlessly into resolve flow.
- [x] Centralized Theme system (System/Light/Dark + 3 Palettes + 5 Accents) fully persisted.
- [x] Accessible touch targets ($\ge 44 \times 44$ dp).
- [x] All 80 unit tests passing.
- [x] Zero TypeScript errors.
