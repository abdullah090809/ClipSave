# OPERATIONAL RUNBOOK: ClipSave

**Version:** 1.0.0  
**Date:** 2026-10-26  
**Audience:** Site Reliability Engineers, DevOps, Project Maintainers  

---

## 1. Upstream Extractor Outage (TikTok Endpoint Change)

### Symptoms
- Clients report `HTTP 422` or `HTTP 500` on URL resolution.
- Resolver logs show `yt_dlp.utils.DownloadError` with message indicating parsing or token errors.

### Triage & Resolution Steps
1. **Enable Mock Extractor Fallback (Emergency Continuity):**
   If TikTok has broken extraction globally, enable mock mode temporarily so users can still test and interact with the UI:
   ```bash
   # In .env or container environment
   ENABLE_MOCK_EXTRACTOR=true
   ```
2. **Check Upstream `yt-dlp` Releases:**
   The `yt-dlp` maintainers frequently release patches for TikTok within hours of platform updates:
   ```bash
   pip install --upgrade yt-dlp
   pytest backend/tests/
   ```
3. **Deploy Tested Extractor Update:**
   Rebuild the Docker container and promote to staging first:
   ```bash
   docker compose build clipsave-resolver
   docker compose up -d clipsave-resolver
   ```
4. **Verify Health:**
   ```bash
   curl -f http://127.0.0.1:8080/healthz
   ```

---

## 2. Rate Limit Saturation (HTTP 429 Storm)

### Symptoms
- Mobile clients report: *"Too many requests. Please wait a moment before trying again."*
- Resolver logs show repeated `HTTP_429_RateLimited` rejections for specific IPs.

### Triage & Resolution
1. Verify if requests are legitimate traffic bursts or abusive automated loops.
2. If legitimate load has scaled, adjust `RATE_LIMIT_PER_MINUTE` in `.env`:
   ```env
   RATE_LIMIT_PER_MINUTE=120
   ```
3. Reload without downtime:
   ```bash
   docker compose restart clipsave-resolver
   ```

---

## 3. Host Port Collision (e.g. Port 8000 Conflict)

### Problem
- Port 8000 is occupied on the host (e.g. by another container or service).

### Solution
- The ClipSave resolver defaults to port **8080** (or **8001**).
- If changing the port, update `PORT` in `backend/app/config.py` and `compose.yaml`:
  ```yaml
  ports:
    - "8080:8080"
  ```
- Update client setting in mobile Settings screen or `EXPO_PUBLIC_BACKEND_URL`.
