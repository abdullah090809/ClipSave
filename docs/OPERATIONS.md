# OPERATIONS & MONITORING: ClipSave

**Version:** 1.0.0  
**Date:** 2026-10-26  

---

## 1. Service Health & Probes

The resolver provides two unauthenticated, light probes:
- `GET /healthz`: Liveness check verifying the ASGI process is responsive.
- `GET /readyz`: Readiness check verifying concurrency semaphores are operational.

### Health Check Command
```bash
curl -i http://127.0.0.1:8080/healthz
```
Expected Output:
```json
{"status":"ok","app":"ClipSave Resolver","version":"1.0.0"}
```

---

## 2. Resource Boundaries & Monitoring

The container configuration enforces strict resource ceilings:
- **CPU limit:** 1.5 cores
- **Memory limit:** 512 MB
- **Concurrency limit:** 5 simultaneous extraction threads (semaphore-bounded)
- **Request timeout:** 15 seconds

---

## 3. Extractor Staged Promotion Procedure

To prevent unreviewed extractor code from causing unexpected production regressions:
1. **Branch & Update:** Create a maintenance branch and update the pinned `yt-dlp` version in `backend/requirements.txt`.
2. **Automated Verification:** Run the full backend test suite:
   ```bash
   .\backend\.venv\Scripts\pytest -v backend\tests
   ```
3. **Staged Canary:** Deploy container to a private staging environment. Test with 2-3 public authorized links.
4. **Production Deploy:** Deploy using read-only filesystem container with minimal privileges.
