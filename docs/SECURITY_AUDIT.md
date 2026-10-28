# ClipSave — Comprehensive Security Audit & Hardening Report

## 1. Threat Model & Scope
ClipSave processes untrusted user input (public TikTok URLs) and streams binary media streams through a proxy server. The primary attack surfaces evaluated and hardened are:
1. **Server-Side Request Forgery (SSRF)**: Attempts to probe or exfiltrate private internal IP addresses, AWS/GCP cloud metadata endpoints (`169.254.169.254`), or loopback ports via input URLs or upstream redirect hops.
2. **Denial of Service (DoS) & Memory Exhaustion**: Attempts to degrade backend availability by exhausting connection pools, flooding unbounded in-memory dictionaries, or triggering CPU-intensive extractor loops.
3. **Stream Session Token Hijacking**: Attempts to brute-force or guess bearer capability tokens for active media proxies.
4. **Cross-Origin Information Leakage (CORS)**: Overly permissive origin policies or improper header handling.
5. **Sensitive Information Exposure**: Unintentional logging of session cookies, authentication headers, or private user parameters.
6. **Mobile Client Storage & URI Injection**: Path traversal attacks or malicious intent schemas.

---

## 2. SSRF Vulnerability Analysis & Hardening

### 2.1 Pre-Flight DNS Verification
In `backend/app/security/ssrf.py`, incoming URLs must satisfy two mandatory constraints before being passed to `yt-dlp`:
1. **Strict Protocol Allowlist**: Only `http://` and `https://` schemes are permitted. Schemes such as `file://`, `ftp://`, `gopher://`, and `data:` are rejected immediately.
2. **Comprehensive Private Subnet Verification**: The host is resolved to all associated IPv4 and IPv6 addresses via `socket.getaddrinfo()`. All resolved addresses are checked against standard blocked networks:
   - Loopback: `127.0.0.0/8`, `::1/128`, `::/128`
   - Link-Local & Cloud Metadata: `169.254.0.0/16`, `fe80::/10`
   - RFC 1918 Private Ranges: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
   - Carrier-Grade NAT: `100.64.0.0/10`
   - IPv6 Unique Local: `fc00::/7`
   - Multicast & Reserved: `224.0.0.0/4`, `240.0.0.0/4`, `ff00::/8`

### 2.2 Stream Proxy Redirect SSRF Defense
**Identified Defect:** The streaming media endpoint (`/v1/stream/{stream_id}`) previously configured `httpx.AsyncClient(follow_redirects=True)`. If an upstream video CDN returned an HTTP 301/302 redirect targeting an internal address (e.g. `http://169.254.169.254/latest/meta-data/`), `httpx` would follow the redirect automatically, allowing internal metadata exfiltration.

**Remediation Applied in `backend/app/routes/resolve.py`:**
1. Disabled automatic redirect following (`follow_redirects=False`).
2. Implemented an explicit redirect loop bounded to 5 hops maximum.
3. Every redirect target is normalized with `urllib.parse.urljoin()` and evaluated against `verify_url_ssrf_safety()`.
4. If an upstream server redirects to any private subnet or cloud metadata IP, the connection is closed immediately, logged safely, and rejected with `HTTP 400 (SSRF_RESTRICTED)`.

---

## 3. Rate Limiting & Memory Growth Mitigation

### 3.1 Sliding Window Algorithm
In `backend/app/security/rate_limit.py`, requests are throttled per client IP using a 60-second sliding window (`RATE_LIMIT_PER_MINUTE = 30`).

### 3.2 Memory Leak Remediation
**Identified Defect:** Storing client timestamps in `defaultdict(list)` retained empty IP keys indefinitely. A distributed crawler or IP spoofing could expand memory unbounded.

**Remediation Applied:**
1. Stale timestamps are purged on each request.
2. When all timestamps for an IP expire, the IP key is removed from the dictionary (`_request_history.pop(client_ip, None)`).
3. Added a periodic sweep when tracked IP count exceeds `_SWEEP_THRESHOLD = 500`.
4. Enforced a hard capacity cap (`MAX_TRACKED_IPS = 10000`). If the cap is reached, the oldest 1,000 IP records are evicted.

---

## 4. Stream Session Registry & Token Entropy

### 4.1 Bearer Token Entropy
**Identified Defect:** Session tokens originally used `uuid.uuid4().hex[:12]`, which provides only 48 bits of entropy.

**Remediation Applied in `backend/app/services/extractor.py`:**
- Tokens now generate using `f"stream_{secrets.token_urlsafe(24)}"`, providing **192 bits of cryptographic entropy**.
- Tokens cannot be enumerated or brute-forced.

### 4.2 Session Registry Capacity Cap
**Identified Defect:** In-memory `_stream_sessions` had no size bound, retaining up to 2 hours of stream records without a ceiling.

**Remediation Applied:**
- Implemented `MAX_STREAM_SESSIONS = 5000`.
- If registrations exceed capacity, the oldest sessions are evicted.
- Automatic TTL cleanup purges sessions older than 7,200 seconds (2 hours).

---

## 5. CORS & HTTP Security Headers

### 5.1 Streaming Range & CORS Headers
In `backend/app/main.py`:
- `allow_headers` includes: `"Content-Type"`, `"Accept"`, `"X-Request-ID"`, `"Range"`, `"Origin"`, `"User-Agent"`.
- `allow_methods` includes: `"GET"`, `"POST"`, `"OPTIONS"`, `"HEAD"`.
- `expose_headers` explicitly exposes:
  `"Content-Range"`, `"Accept-Ranges"`, `"Content-Length"`, `"Content-Type"`, `"X-Request-ID"`, `"X-Response-Time-Ms"`.
- This ensures media players and mobile download engines can perform partial byte range requests (HTTP 206) without CORS violations.

### 5.2 Defensive Response Headers
Every response from the backend carries:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Server: ClipSave-Resolver`

---

## 6. Logging Hygiene & Data Privacy
In `backend/app/security/logging.py`:
- Sensitive headers (`Cookie`, `Authorization`, `X-Auth-Token`) are stripped before logging.
- Video URLs are logged with query parameters sanitized (`urlparse` cleans tokens like `?token=...`).
- Stack traces logged during errors suppress raw cookie jars or upstream session tokens.

---

## 7. Mobile Client Security Review
1. **Cleartext Traffic Policy**: All production API traffic routes strictly over TLS (`https://`). Local development IPs (`10.x.x.x`, `192.168.x.x`) are only permitted when explicitly configured in Settings.
2. **Scoped Storage Compliance**: Downloads are saved to app-sandboxed storage (`FileSystem.documentDirectory`) and exported to Android MediaStore / iOS Photos via official `expo-media-library` APIs. No raw `/sdcard/` paths or un-sandboxed root storage access is attempted.
3. **Safe Filename Sanitization**: User-derived video titles undergo strict regex filtering in `filenameSanitizer.ts`:
   - Strips directory traversal (`../`, `/`, `\`).
   - Removes control characters and reserved OS symbols (`:`, `*`, `?`, `"`, `<`, `>`, `|`).
   - Clamps max length to 80 characters with safe `.mp4` extensions.
