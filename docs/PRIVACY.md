# PRIVACY DISCLOSURE & DATA FLOW POLICY: ClipSave

**Version:** 1.0.0  
**Date:** 2026-10-26  
**Status:** Approved  

---

## 1. Core Privacy Commitments

1. **Zero Tracking and Telemetry:** ClipSave contains no advertising SDKs, tracking frameworks, device fingerprinting libraries, or background analytics beacons.
2. **No Accounts or Logins:** The application requires no email, phone number, social login, or personal identifiers.
3. **Local-First Retention:** Download history, preferences, and temporary files remain strictly on your local device.
4. **No Media Retention on Backend:** The ClipSave resolver backend functions as a stateless metadata parser. It **never proxies, stores, or caches video streams**.

---

## 2. Comprehensive Data Flow & Network Destinations

| Interaction | Network Destination | Data Transmitted | Purpose | Retention |
| :--- | :--- | :--- | :--- | :--- |
| **Resolve Link** | ClipSave Resolver Backend (`/v1/resolve`) | Submitted TikTok URL string, HTTP User-Agent | Resolves public video metadata and eligible CDN stream URL | URL query parameters are stripped; server logs keep only redacted paths for max 24 hours. |
| **Download Video Stream** | Public Media CDN (e.g. `*.tiktokcdn.com`) | Standard HTTPS GET request with media headers | Streams video bytes directly from CDN to mobile device cache | Stored in app private cache until download completes; moved to device gallery/storage upon verification. |
| **Open / Share Video** | Local device media player / native share dialog | None (local intent) | Allows playback or export to other user-chosen apps | Kept in local history until user explicitly clears records or deletes files. |
| **App Launch / Idle** | None | None | No background polling, heartbeat, or beacon network traffic | N/A |

---

## 3. Local Storage & Deletion Semantics

ClipSave maintains explicit, separate controls for user data:
- **Remove History Entry:** Deletes the metadata record from the local SQLite/AsyncStorage database. The actual media file remains untouched in device storage.
- **Delete File from Device:** Permanently unlinks and deletes the MP4 video file from device storage, then removes the history entry.
- **Clear Temporary Cache:** Safely deletes orphaned `.tmp` streaming files from the application cache directory without affecting completed downloads.

---

## 4. Third-Party Platform Interaction & Watermark Disclaimer

- ClipSave only queries public TikTok media endpoints. It does not scrape authenticated or private accounts.
- Availability of clean or watermark-free sources depends entirely on what the public platform provides. ClipSave does not perform pixel manipulation to erase platform or creator watermarks.
