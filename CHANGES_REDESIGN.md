# ClipSave front-end redesign: steps 1 to 9

## Step 9 (fixes from your device screenshots)
- Fix: history.tsx was missing the borderRadius import (crash on open).
- Colors restored to the step 7 "Petrol & Marigold" values (dark and light). Step 8's palette changes are reverted. The new violet and pink tokens stay, with the old softer tint strength.
- Home: Paste / Clear / Resolve tile row (three cramped 2-line buttons) replaced by a Paste button inside the input field (becomes a clear X once there is text) and one full-width "Get video" button.
- Home: removed the "What you can save" carousel, its tab pill and dots. It was misaligned with the screen margins, crowded, and repeated the four tiles below it (it also made claims such as "320 KBPS" that the app does not verify).
- Queue: sections with nothing in them are hidden (no more empty "Active downloads 0" / "Completed 0" rows), the filter pills are hidden when the queue is empty, and pills are shorter (Active, Paused, Done, Failed) so they fit.
- History: removed the duplicate Filter button next to search (the header filter icon stays); the four boxed stats became one clean strip with dividers, shown only once something is saved.
- Settings: storage card rebuilt as full-width rows. The ring gauge was decorative, and "~28.4 GB Free" and the starting "1.2 GB" were made-up numbers, so both are gone and only the real used size is shown. Switches use a white thumb. "Max Concurrent Downloads" shortened to "Simultaneous downloads".
- The gear button floating over every screen in your screenshots is not in the app (no floating button exists in the code). It looks like a phone overlay such as an assistive ball.


## Step 8 (livelier theme, roomier icon bubbles, iOS review fixes)
- New src/components/IconBubble.tsx: one tinted icon container (sizes 36/44/52/80) where the icon is always ~45% of the bubble. Old bubbles held icons at 50 to 75% of their size and felt packed. Used for section headers, Home feature tiles and tip card, the disclaimer banner and the empty states.
- Theme: livelier palette. Dark: deeper background with clearer card separation and stronger tinted containers. Light: warm cream background instead of grey-green. New violet and pink tokens (colors.violet, colors.pink and their containers) so feature tiles are not all the same hue.
- Home feature tiles: yellow, blue, violet, pink icons; "Android" renamed "Mobile" (the app is not Android-only); more space between bubble and label.
- Tab bar: roomier pill (64x36, 22px icon, taller bar). The 24px icon in a 32px pill was cramped.
- Touch targets raised to 44: Queue pause/resume/cancel buttons, Home action buttons, Settings steppers.
- Accessibility: 25 tappable elements that had no label (search clear, filters, steppers, retry, share, more options, About rows and others) now have a role and a spoken label.
- Files: colors.ts, IconLabel.tsx, DisclaimerBanner.tsx, _layout.tsx (tabs), index.tsx, queue.tsx, history.tsx, settings.tsx, new IconBubble.tsx.
- Not seen on a device. Checked only by syntax and unused-code scan.


## Step 7 (leftovers) changes
- Queue: real speed and ETA. New src/utils/speedTracker.ts measures bytes per second from the job's byte count (smoothed); formatSpeed and formatEta added to formatters.ts. Tests in src/utils/speedTracker.test.ts.
- Queue: removed fake values: "4.8 MB/s", "TURBO/IDLE" badge, "3.2 MB/s ETA ~00:04", fallback sizes "18.4 MB" and "28.7 MB", fake "1080P/320K" badge (now MP4/MP3), and the 15% placeholder progress. Sizes use totalBytes, then the resolver's estimate, otherwise are left out.
- Queue banner now says "Downloading" / "Paused" with active and queued counts.
- Home: promo card and clipboard labels changed from ALL CAPS to sentence case, letter spacing reduced.
- Preview screen removed (app/preview.tsx and its route). Nothing opened it; Home already shows the result card with the Download button. Router types and three docs updated to match.


## Step 6 (animation) changes
New files (3)
- src/theme/motion.ts: shared durations, easing, stagger and press-scale values; reads the system "Reduce motion" setting
- src/components/PressableScale.tsx: pressable that shrinks to 97% and dims slightly while held
- src/components/FadeIn.tsx: fade and rise-into-place entrance, staggered

Changed files (10)
- Button, Card (when tappable), IconButton: now use PressableScale instead of an instant opacity flip
- ProgressBar.tsx: new AnimatedFill, bars glide to new values instead of jumping
- app/(tabs)/queue.tsx: download progress bar uses AnimatedFill; every job card fades in
- app/(tabs)/index.tsx: Home sections and the clipboard banner enter in sequence
- app/(tabs)/history.tsx: video rows fade in
- app/(tabs)/_layout.tsx: tab pill grows and fades in, icon gets a small pop
- src/hooks/useQueue.ts: cards slide into place when jobs are added, removed or change section (LayoutAnimation)
- src/components/LaunchAnimation.tsx: logo springs in, name fades up, then dissolves (~800ms); onFinish can no longer cut it short on a parent re-render
- Card.tsx also lost an unused import

Reduce motion: when the phone's "Remove animations" / "Reduce motion" setting is on, entrances, press scale, progress glide, tab pill and list changes skip animating, and the launch screen only does a quick fade.


## Changed in steps 1 to 5 (21 files)
Theme and tokens (step 1, 2, 3)
- src/theme/colors.ts: new "Petrol & Marigold" palette, new tokens (onPrimary, onDanger, accentContainer, accentBorder, primaryBorder, dangerBorder)
- src/theme/typography.ts: new scale, no forced all-caps, `numeric` style
- src/theme/spacing.ts: new radii, `layout` spacing scale, `iconSize` scale
- app.json: splash and adaptive icon background color

Screens
- app/(tabs)/index.tsx (Home): re-spaced, emoji to icons, input moved to top, promo cards moved below, TabHeader
- app/(tabs)/queue.tsx: re-spaced, emoji to icons, section headers, TabHeader
- app/(tabs)/history.tsx: re-spaced, time icon, TabHeader
- app/(tabs)/settings.tsx: re-spaced, section headers with icons, About rows open the real About screen, TabHeader
- app/(tabs)/_layout.tsx: tab bar pill indicator, History icon, bigger labels
- app/_layout.tsx: screen transitions (slide from right, modal gestures)
- app/about.tsx, app/preview.tsx: spacing and icon sizes only

Components
- src/components/Button.tsx, Card.tsx, ScreenHeader.tsx, IconButton.tsx, Badge.tsx, BottomSheetMenu.tsx, DisclaimerBanner.tsx, EmptyState.tsx, SegmentedControl.tsx: token colors, spacing, icon sizes

## New (2 files)
- src/components/TabHeader.tsx: shared header for the four tabs
- src/components/IconLabel.tsx: IconText and SectionTitle

## Not changed
- All logic: src/services, src/storage, src/utils, src/types (src/hooks/useQueue.ts got the list animation in step 6)
- All tests (*.test.ts), jest config, package.json, package-lock.json, tsconfig.json, eas.json
- assets/ (icons, logos), docs/, dist/, README.md, CHANGELOG.md, compose.yaml
- The backend (backend/ folder) was not touched in any step

## Known leftovers (not fixed yet)
- Hardcoded sample values on Queue (speeds, ETA, fallback sizes)
- Preview screen appears unused
- Some hardcoded all-caps labels in the Home promo cards
