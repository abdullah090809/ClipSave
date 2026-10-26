# STRIDE THREAT MODEL & SECURITY EVALUATION: ClipSave

**Version:** 1.0.0  
**Date:** 2026-10-26  
**Auditor:** Antigravity Senior Application Security Engineer  

---

## 1. System Assets & Trust Boundaries

### Primary Assets
1. **Host Infrastructure & Internal Network:** Protecting resolver servers from being used as a proxy to probe internal services or cloud metadata.
2. **User Device Integrity:** Ensuring downloaded files cannot trigger path traversal, code injection, or corrupt the device filesystem.
3. **User Privacy:** Guaranteeing submitted URLs and personal preferences are never leaked in logs, metrics, or third-party beacons.

### Trust Boundaries
- **Boundary 1 (User / Untrusted Input -> Mobile Client):** Input URLs, clipboard data, and external Android Share intents.
- **Boundary 2 (Mobile Client -> Backend API):** Network HTTPS boundary between mobile app and resolver service.
- **Boundary 3 (Backend API -> External Networks):** Extractor connection to public TikTok endpoints.
- **Boundary 4 (Mobile Client -> Media CDN):** Direct client streaming connection to TikTok media CDN.
- **Boundary 5 (Mobile Client -> Android Filesystem):** Writing temporary files and committing to Android MediaStore.

---

## 2. STRIDE Threat Analysis & Applied Mitigations

| Category | Threat Scenario | Mitigation Mechanism | Verification Test ID |
| :--- | :--- | :--- | :--- |
| **Spoofing** | Attacker crafts a phishing or lookalike domain (e.g. `tiktok.com.attacker.example` or `evil-tiktok.com`). | Client and Backend enforce strict hostname allowlist (`tiktok.com`, `vm.tiktok.com`, `vt.tiktok.com`, `m.tiktok.com`). | `UT-VAL-05`, `BE-VAL-02` |
| **Tampering** | Man-in-the-middle or corrupted stream produces truncated video file presented as completed download. | Streaming writes to private `.tmp` files. Verification of total bytes and file signature before promoting to gallery. | `UT-FS-01`, `UT-DL-03` |
| **Repudiation** | User claims app illegally accessed private accounts or bypassed DRM. | ClipSave strictly rejects private/restricted accounts, implements no login bypasses, and displays an explicit rights acknowledgment banner. | `UT-UI-01`, `BE-API-03` |
| **Information Disclosure** | Server logs or mobile logs expose submitted URLs, query parameters, or CDN auth tokens. | Log redaction filters strip query parameters, tokens, and PII before writing to logs. Zero analytics SDKs. | `BE-LOG-01`, `SEC-AUDIT-01` |
| **Denial of Service** | Flooding backend with concurrent resolve requests exhausts CPU, memory, or thread pool. | Token-bucket rate limiting (per IP), request body limits (10KB), request timeouts (15s), bounded semaphore (5 concurrent extractions). | `BE-RL-01`, `BE-LOAD-01` |
| **Elevation of Privilege / SSRF** | Attacker inputs cloud metadata IP (`http://169.254.169.254/latest/meta-data`) or internal IP (`http://192.168.1.1`) to steal IAM credentials or scan intranet. | Multi-layer defense: URL allowlist + Pre-flight DNS validation asserting all resolved IPs are public + yt-dlp extractor restricted to TikTok. | `BE-SSRF-01` to `BE-SSRF-08` |

---

## 3. OWASP MASVS & API Security Top 10 Alignment

- **MASVS-NETWORK:** Cleartext traffic disabled; all communication occurs over TLS/HTTPS.
- **MASVS-STORAGE:** No sensitive data, tokens, or permanent secrets stored in plaintext. Temporary files kept in private cache and pruned on startup.
- **MASVS-PLATFORM:** Scoped storage used on Android; no broad `READ_EXTERNAL_STORAGE` or `WRITE_EXTERNAL_STORAGE` permissions requested on modern Android.
- **API1:2023 Broken Object Level Authorization:** Stateless resolver; no user accounts or cross-user object access.
- **API4:2023 Unrestricted Resource Consumption:** Hard bounded concurrency, timeouts, and sliding-window rate limiting.
- **API7:2023 Server Side Request Forgery (SSRF):** Comprehensive DNS resolution verification rejecting loopback, RFC 1918, link-local, and cloud metadata IPs.

---

## 4. Residual Risks & Accepted Decisions

1. **Third-Party CDN Rate Limiting:**  
   *Risk:* TikTok CDN may temporarily throttle rapid sequential downloads from a single client IP.  
   *Mitigation:* App informs user of CDN status and provides transparent exponential retry.  
   *Residual Risk:* Acceptable; throttling is enforced by the upstream platform.

2. **Extractor Breakage on Upstream HTML/API Changes:**  
   *Risk:* TikTok updates its web endpoints, temporarily breaking extraction.  
   *Mitigation:* Stateless backend allows instant patching without app store resubmissions. Extractor errors map to clean, actionable user notifications.
