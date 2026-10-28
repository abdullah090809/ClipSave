# ClipSave — Production Release & Deployment Checklist

## 1. Mobile Release Checklist (Expo & Android/iOS)

### 1.1 Configuration & Metadata
- [x] **Application ID / Package Name**: `com.clipsave.app` confirmed in `app.json`.
- [x] **Version / Build Number**: Version `1.0.0`, VersionCode `1` set in `app.json`.
- [x] **App Icons & Splash Screen**: Verified assets in `assets/` (`clipsave-logo.png`, `icon.png`, `splash-icon.png`).
- [x] **Permissions Audit**:
  - `READ_MEDIA_VIDEO` / `READ_MEDIA_IMAGES` for Android 13+ gallery export.
  - `WRITE_EXTERNAL_STORAGE` / `READ_EXTERNAL_STORAGE` capped with `maxSdkVersion: 32`.
- [x] **Cleartext Traffic**: Only allowed on local development subnets; production strictly uses HTTPS.

### 1.2 Build & Code Quality Gate
- [x] **TypeScript Strict Check**: `npm run typecheck` passes with **0 errors**.
- [x] **Unit & Integration Tests**: `npm test` passes **82/82 tests** across 12 test suites.
- [x] **Production Bundle Export**: `npx expo export --platform android --no-bytecode` passes cleanly with **0 errors**.
- [ ] **EAS Build Trigger**: Run `eas build --platform android --profile preview` or `production`.

---

## 2. Backend Release Checklist (FastAPI & Docker)

### 2.1 Environment Configuration
- [x] `APP_NAME`: `"ClipSave Resolver"`
- [x] `APP_VERSION`: `"1.0.0"`
- [x] `DEBUG`: Set to `False` in production.
- [x] `RATE_LIMIT_PER_MINUTE`: Set to `30` (or tune per server capacity).
- [x] `REQUEST_TIMEOUT_SECONDS`: Set to `15`.
- [x] `MAX_CONCURRENT_EXTRACTIONS`: Set to `5`.
- [x] `ENABLE_MOCK_EXTRACTOR`: Set to `False` in production; `True` only in CI or mock benchmarking.

### 2.2 Security Configuration Gate
- [x] **SSRF Pre-Flight DNS Check**: Active on both link resolution and media stream proxying.
- [x] **Stream Redirect Defense**: Safe redirect loop with per-hop allowlist validation (max 5 hops).
- [x] **Token Entropy**: Bearer tokens generated via `secrets.token_urlsafe(24)` (192 bits).
- [x] **Session Cap**: Registry bounded to 5,000 sessions with LRU eviction.
- [x] **Rate Limiter Memory**: Auto-pruning of stale/empty IPs and 10,000 hard ceiling.
- [x] **CORS Allowlist**: Configured for local development origins and production web origins.
- [x] **Exposed Headers**: `Range`, `Content-Range`, `Accept-Ranges`, `Content-Length` exposed.

### 2.3 Docker Production Build Gate
- [x] Non-root user execution (`appuser:appgroup`).
- [x] Unbuffered Python logs (`PYTHONUNBUFFERED=1`).
- [x] Minimal image footprint using `python:3.13-slim`.
- [x] Verified `backend/Dockerfile` builds and runs cleanly.

---

## 3. Production Health Probes & Monitoring

### 3.1 Health Endpoints
- **Liveness Probe**: `GET /healthz` -> Returns `200 OK` `{"status": "ok", "app": "ClipSave Resolver"}`.
- **Readiness Probe**: `GET /readyz` -> Returns `200 OK` `{"status": "ready"}`.

### 3.2 Key Monitoring Metrics
1. **HTTP 429 Rate**: Sudden spike indicates bot traffic or shared NAT address.
2. **HTTP 502/504 Rate**: Indicates upstream TikTok throttling or CDN network issues.
3. **Response Time (`X-Response-Time-Ms`)**: Target p50 < 100ms for health checks; target p50 < 3.5s for video resolution.
4. **Memory Footprint**: Should stay flat below 250 MB under sustained load.

---

## 4. Rollback Plan & Disaster Recovery
1. **Mobile Client**: If a critical bug is discovered post-release, publish an OTA update via Expo EAS Update (`eas update --branch production`).
2. **Backend**: Revert Docker container tag to previous stable build SHA (`docker compose down && docker compose up -d`).
3. **Container Idle Sleep**: SnapDeploy automatically scales containers down to zero after 15 minutes of inactivity; waking takes ~18-22s and is handled automatically by the mobile client's wake orchestration loop.
