# ClipSave — UI/UX Redesign Audit & Action Plan

**Date:** 2026-10-26  
**Auditor:** Senior Mobile UI/UX & Frontend Architecture Specialist  
**Target Platform:** Android (Material Design 3 / React Native / Expo SDK 58)  
**Repository:** `D:\Skills\Tiktok Downloader`

---

## 1. Executive Summary

An exhaustive code-level audit was conducted across all screens, layouts, shared components, themes, and navigation patterns in the ClipSave repository. The application has sound underlying functionality (URL validation, resilient stream resolution, chunked downloads, queue state machine, and local storage), but the user interface currently resembles an initial utility prototype rather than a modern, cohesive Android consumer product.

### Core Visual & Interaction Deficiencies Identified:
1. **Inconsistent Component Hierarchy & Android Conventions:** Heavy reliance on generic card borders and uniform shadows rather than Material Design 3 surface elevations, tonal layering, and platform-native touch interactions (ripples).
2. **Crowded Actions & Touch Targets:** Several secondary buttons and action rows drop below the recommended 48dp touch target or place conflicting destructive actions adjacent to routine controls.
3. **Typography & Spacing Drift:** Headings and metadata labels lack consistent scale hierarchy across screens; body text and metadata rows lack proper line heights and letter-spacing for high-density Android displays.
4. **Sub-optimal Keyboard & Viewport Adaptability:** On 360dp-wide devices with on-screen keyboards open, the Home screen's primary action button and input field can get partially occluded.
5. **State Feedback Gaps:** Indeterminate stream states, partial network recoveries, and mock mode indicators lack clear, unambiguous visual badging.

---

## 2. Audit Findings & Remediation Plan

### Must Fix (High Priority — Critical for Production Usability & Compliance)

#### MF-01: Home Screen — Keyboard Overlap and Action Ergonomics
- **Screen:** `app/(tabs)/index.tsx`
- **Actual Problem:** On compact Android screens (360dp width) with the soft keyboard open, the "Paste" and "Resolve" action row gets squished against the input card and the bottom navigation, risking accidental mis-taps.
- **Why It Matters:** Pasting and resolving a link is the primary core user flow of the app (Flow A & B). If this action is awkward or hidden by the keyboard, the user experience fails at the first step.
- **Planned Change:** Redesign the Home hero into an integrated, elevated input surface with an inline quick-paste action, clean clear button, prominent full-width primary action, and responsive `KeyboardAvoidingView` with platform-specific vertical offsets.
- **Verification:** Test on 360dp and 430dp viewport simulations with keyboard active and dismissed; ensure touch targets are ≥48dp.

#### MF-02: Preview Surface — Missing Close Action and Cramped Metadata
- **Screen:** `app/preview.tsx`
- **Actual Problem:** The preview screen is rendered as a modal, but lacks a visible, accessible Android top-bar close button (`X` or back arrow). The thumbnail is fixed-height (220dp) with no aspect ratio handling, and metadata is displayed in a raw 2-column border box.
- **Why It Matters:** Users who mistakenly paste a link or decide not to download must have an immediate, obvious, standard Android mechanism to dismiss the preview without depending exclusively on gesture back.
- **Planned Change:** Implement a polished Android top app bar with explicit back/close icon button, rounded 16:9 media hero container with fallback placeholder, styled metadata badges (duration, file size, codec, format), and a prominent bottom fixed action bar.
- **Verification:** Verify modal dismissal, accessibility label for close button, and metadata rendering for long titles and missing thumbnails.

#### MF-03: Queue Screen — Visual Distinction Between Job States
- **Screen:** `app/(tabs)/queue.tsx`
- **Actual Problem:** Active downloading, paused, completed, and failed jobs all share identical card layouts and border treatments. The user must read small text labels to determine whether a download is in progress or completed.
- **Why It Matters:** Users scanning the queue need immediate visual cues (distinct container colors, animated progress bars for active jobs, green checkmark treatment for completed, amber for paused, rose for failed).
- **Planned Change:** Introduce state-differentiated card styling with Material 3 tonal backgrounds, animated smooth progress bars with exact byte counters, dedicated retry buttons for failed jobs, and prominent export actions for completed items.
- **Verification:** Verify all 6 states (`QUEUED`, `DOWNLOADING`, `PAUSED`, `FINALIZING`, `COMPLETED`, `FAILED`) visually and via Jest tests.

#### MF-04: History Screen — Ambiguous Deletion Hierarchy
- **Screen:** `app/(tabs)/history.tsx`
- **Actual Problem:** Each history card presents a "Delete" button that triggers an alert with two choices: "Remove from History Only" vs. "Delete File from Device". Having this on every card with identical styling causes cognitive friction.
- **Why It Matters:** Accidental file deletion of a user's favorite saved video is an irreversible data loss event.
- **Planned Change:** Distinguish between primary interaction (Send to Gallery / Play) and secondary management (more options / delete). Make the file deletion option explicitly destructive with clear warning text in the dialog.
- **Verification:** Test record deletion vs. file deletion semantics; ensure no regression in `historyStore.ts`.

#### MF-05: Touch Targets and Accessibility Labels
- **Screen:** All screens & components (`Button.tsx`, `Badge.tsx`, `index.tsx`, `queue.tsx`, `history.tsx`)
- **Actual Problem:** Some icon-only buttons (like clear input, cancel item) have touch target heights below 48dp or lack `accessibilityLabel` and `accessibilityRole`.
- **Why It Matters:** Violates Android accessibility standards (WCAG 2.1 AA Target Size 2.5.5) and prevents screen reader (TalkBack) users from operating the downloader.
- **Planned Change:** Ensure every interactive component has a minimum 48×48dp bounding box, explicit `accessibilityRole="button"`, descriptive `accessibilityLabel`, and appropriate `accessibilityState`.
- **Verification:** Inspect style rules and run automated tests.

---

### Should Fix (Medium Priority — Important for Polish & Modern Feel)

#### SF-01: Centralized Design System & Material 3 Tonal Tokens
- **Screen:** `src/theme/colors.ts`, `src/theme/spacing.ts`, `src/theme/typography.ts`
- **Actual Problem:** Theme colors currently lack intermediate surface tonal containers (`surfaceContainer`, `surfaceContainerHigh`), input focus rings, ripple colors, and consistent outline variants.
- **Why It Matters:** Without these tokens, components have to either use hardcoded hex values or rely on basic opacity hacks, creating visual inconsistency between light and dark themes.
- **Planned Change:** Upgrade `colors.ts` with complete Material 3 semantic palette (Surface, SurfaceContainerLow, SurfaceContainer, SurfaceContainerHigh, Outline, OutlineVariant, OnSurface, PrimaryContainer, OnPrimaryContainer). Add ripple color tokens for Android.
- **Verification:** Verify both light and dark modes render with high contrast (≥4.5:1 text contrast).

#### SF-02: Interactive Ripple Feedback on Android
- **Screen:** `src/components/Button.tsx`, `src/components/Card.tsx`, list items
- **Actual Problem:** Buttons use standard iOS-style `TouchableOpacity` (opacity reduction on press) rather than Android native ripple feedback.
- **Why It Matters:** Native ripple (`android_ripple` via `Pressable`) makes the app feel like a native Android citizen instead of an iOS port.
- **Planned Change:** Enhance `Button` and interactive cards to use `Pressable` with `android_ripple={{ color: colors.ripple }}` on Android, falling back to gentle opacity on iOS/web.
- **Verification:** Verify touch feedback in Android runtime.

#### SF-03: Settings Screen — Segmented Control for Theme Selection
- **Screen:** `app/(tabs)/settings.tsx`
- **Actual Problem:** Theme selection renders 3 standalone rectangular buttons side-by-side that look unintegrated.
- **Why It Matters:** A connected Segmented Control is the standard Material 3 pattern for exclusive 3-state options (System / Light / Dark).
- **Planned Change:** Create a polished `SegmentedControl` component for Theme Mode and integrate it cleanly into Settings.
- **Verification:** Test theme switching between System, Light, and Dark modes; verify persistence in AsyncStorage.

#### SF-04: Mock Resolver Mode Visual Indicator
- **Screen:** `app/(tabs)/index.tsx`, `app/(tabs)/settings.tsx`
- **Actual Problem:** When Mock Resolver Mode is enabled in settings, there is no persistent indication on the Home screen that the app is resolving against mock fixtures.
- **Why It Matters:** Prevents confusion during development and testing, ensuring the user always knows whether they are querying real TikTok servers or offline mocks.
- **Planned Change:** Add a compact, dismissible/clear development badge banner at the top of the Home screen when Mock Mode is active.
- **Verification:** Toggle Mock Mode in Settings and verify banner appears on Home.

---

### Nice to Have (Low Priority — Refinement & Delight)

#### NH-01: Smooth Progress Bar Transitions
- **Screen:** `src/components/ProgressBar.tsx`
- **Actual Problem:** When progress updates in chunks (e.g. 10% -> 35%), the bar jumps immediately to the new width without a micro-interpolation.
- **Why It Matters:** Smooth progress animation gives the impression of continuous, fast streaming.
- **Planned Change:** Add gentle `Animated.timing` interpolation on progress changes when total bytes are known.
- **Verification:** Run Jest tests and verify progress calculations.

#### NH-02: Empty States with Contextual Guidance
- **Screen:** `app/(tabs)/queue.tsx`, `app/(tabs)/history.tsx`
- **Actual Problem:** Empty states have basic text descriptions, but could feature richer iconography and direct navigation buttons back to the Home/Download tab.
- **Why It Matters:** Guides first-time users directly into the primary action flow.
- **Planned Change:** Add a "Start a Download" action button to the Queue and History empty states that navigates to `/(tabs)`.
- **Verification:** Test empty state button clicks navigate to the Home tab.

---

## 3. Implementation Order & Architecture Roadmap

1. **Step 1: Theme & Tokens System:**
   - Update `src/theme/colors.ts` with Material 3 surface elevation, container, outline, and ripple tokens.
   - Refine `src/theme/typography.ts` with Android M3 type scale.
   - Refine `src/theme/spacing.ts` with 4dp/8dp grid and 48dp minimum touch bounds.
2. **Step 2: Shared UI Components:**
   - Enhance `Button.tsx` (Pressable with Android ripple, sizes, variants, 48dp minimum).
   - Enhance `Card.tsx` (elevations, tonal borders).
   - Enhance `Badge.tsx` (Material 3 tonal chips with status icons).
   - Enhance `ProgressBar.tsx` (smooth animation, indeterminate pulsing).
   - Enhance `EmptyState.tsx` (clean iconography, CTA button).
   - Create `ScreenHeader.tsx` (unified Android app bar).
   - Create `SegmentedControl.tsx` (for theme and segmented choices).
3. **Step 3: Screen Redesigns:**
   - Redesign `app/(tabs)/index.tsx` (Home/Download).
   - Redesign `app/preview.tsx` (Preview/Confirm Modal).
   - Redesign `app/(tabs)/queue.tsx` (Queue Screen).
   - Redesign `app/(tabs)/history.tsx` (History Screen).
   - Redesign `app/(tabs)/settings.tsx` (Settings Screen).
   - Redesign `app/about.tsx` (About & Legal Screen).
   - Polish `app/(tabs)/_layout.tsx` (Navigation Bar).
4. **Step 4: Quality & Regression Verification:**
   - Run strict TypeScript check (`npm run typecheck`).
   - Run full Jest test suite (`npm test`).
   - Run backend Pytest suite (`pytest backend/tests`).
   - Run Android Metro bundle export (`npx expo export --platform android`).
