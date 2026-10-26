# BUGS, KNOWN LIMITATIONS & ACCEPTED RISKS: ClipSave

**Version:** 1.0.0  
**Date:** 2026-10-26  

---

## 1. Known Limitations

| ID | Component | Limitation Description | Workaround / Fallback |
| :--- | :--- | :--- | :--- |
| **LIM-01** | Expo Go | Android Share Target (`SEND` intent) cannot be registered in standard Expo Go client. | App provides prominent paste button and guidance. Android Share Target works in compiled Development Build. |
| **LIM-02** | Extractor | Private accounts, age gates, regional geoblocks, and authenticated content cannot be resolved. | Explicitly communicated in UI error messages; no bypasses attempted. |
| **LIM-03** | Media Engine | Clean / watermark-free streams depend on source platform availability. | Neutral wording ("Available Source") used in preview; no fake HD/clean guarantees made. |
| **LIM-04** | Environment | Local Android SDK / emulator was not detected on development host. | Automated Jest and Pytest suites verify all logic; physical device testing documented as `NOT RUN`. |

---

## 2. Accepted Risks (Owner Reviewed)

- **Third-Party Platform Drift:** Upstream TikTok DOM/API updates may temporarily break extraction.  
  *Decision:* Accepted; backend isolation allows updating yt-dlp independently of mobile app store releases.
- **Client IP Rate Limiting by TikTok CDN:** Rapid successive downloads from the same IP may encounter temporary HTTP 403/429.  
  *Decision:* Accepted; app exposes honest error messages and exponential backoff retry.
