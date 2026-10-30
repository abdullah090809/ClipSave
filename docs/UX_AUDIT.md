# ClipSave — UI & UX Source Audit

**Date:** 2026-10-30  
**Scope:** Screen Layouts, Design Tokens, Accessibility (a11y), User Journeys, Touch Targets, and Interaction Feedback  
**Auditor:** Independent UX Research & Accessibility Engineering  

---

## 1. Usability & User Journey Audit

### Journey A: First Launch → Paste Link → Resolve → Download → Gallery
- **Experience:**
  - Hero header displays supported platforms (YouTube, TikTok, Instagram, Facebook).
  - Copying a link to the Android clipboard immediately surfaces the Clipboard Prompt Chip (`"YouTube Short detected: tap to paste"`).
  - Tapping **Get video** triggers metadata resolution with clear spinner and status updates.
  - Video preview card appears with thumbnail, title, creator handle, and quality selector chips (`1080p Full HD`, `720p HD`, `360p SD`, `Audio Only (MP3)`).
  - Selecting a quality starts downloading with actual byte-level progress (`12.4 MB / 45.1 MB • 2.1 MB/s`).
  - Upon completion, the card displays `"Saved to Gallery"` and registers in History.
- **Rating:** **EXCELLENT** — Feedback is continuous and never ambiguous.

### Journey B: Invalid or Unsupported Domain Link
- **Experience:**
  - Pasting an unsupported domain (e.g., `https://twitter.com/user/status/123`) or malformed URL displays an inline red error card (`"Unsupported domain. Only YouTube, TikTok, Instagram, and Facebook links are supported."`).
  - The text input border highlights red with an error icon.
  - No backend request is dispatched for locally invalid URLs.
- **Rating:** **PASS** — Early client-side validation prevents unnecessary server roundtrips.

### Journey C: Download Failure & Recovery
- **Experience:**
  - Network interruption or process death transitions the job to `FAILED` with a retryable status.
  - The Queue item displays a prominent orange **Retry** button and clear explanation (`"Interrupted by app termination. Tap Retry to resume."`).
  - Tapping **Retry** re-queues the job at the head of the queue.
- **Rating:** **PASS** — Zero dead-ends or unrecoverable states.

### Journey D: History Record vs Media Deletion
- **Experience:**
  - Tapping the 3-dots menu on a history card presents two distinct destructive choices:
    1. `"Remove from history"` (Preserves the video file on device; removes the log record).
    2. `"Delete video from device"` (Deletes both the physical file and the history record).
- **Rating:** **EXCELLENT** — Eliminates accidental media deletion.

---

## 2. Accessibility (a11y) & Interaction Quality

| Standard | Evaluation | Status |
| :--- | :--- | :---: |
| **Touch Target Size** | All interactive icon buttons utilize `hitSlop={8}` or `hitSlop={12}`, meeting the 48x48dp Android touch target minimum. | **PASS** |
| **Screen-Reader Labels** | `accessibilityRole="button"`, `accessibilityLabel`, and `accessibilityState` are applied across all Pressable components. | **PASS** |
| **Color Contrast** | Primary text on dark backgrounds (`#FFFFFF` on `#0B1417`) achieves a contrast ratio of **18.4:1**, far exceeding WCAG AAA (7:1). Text on light backgrounds (`#111827` on `#FAFAF8`) achieves **16.1:1**. | **PASS** |
| **Non-Color Indicators** | Platform tags and download states use both distinct iconography (icons for YouTube, TikTok, Instagram, Facebook, checkmark, close, retry) and text labels, avoiding reliance on color alone. | **PASS** |
| **Keyboard Dismissal** | Tapping outside input fields or pressing submit dismisses the Android soft keyboard. | **PASS** |

---

## 3. Targeted UX Improvements Needed

1. **Expose Network & Resolver Settings in Accordion UI:**
   - Users should be able to view and customize their backend resolver endpoint (`backendBaseUrl`) and toggle Mock Resolver mode from within `app/(tabs)/settings.tsx`.
