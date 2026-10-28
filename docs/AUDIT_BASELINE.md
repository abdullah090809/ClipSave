# ClipSave — System Audit Baseline & Architecture Map

## 1. Executive Summary & Verification State
This baseline document records the audited architectural state of the **ClipSave TikTok video downloader**, comprising a client mobile application (Expo / React Native / TypeScript) and a stateless metadata resolver and media streaming backend (FastAPI / Python 3.13 / yt-dlp).

| Component | Target Framework | Environment / Runtime | Current Verification State |
| :--- | :--- | :--- | :--- |
| **Mobile Client** | Expo SDK 58 / React Native 0.88 / React 19.3 | Node.js 22 / TypeScript 6.0 strict | **PASS**: 12 Jest suites (82/82 passed), 0 TypeScript errors |
| **Backend API** | FastAPI / Starlette / Pydantic v2 | Python 3.13.14 / Uvicorn | **PASS**: 32 Pytest tests (32/32 passed), 0 failures |
| **Production Deployment** | Docker multi-stage container | SnapDeploy / 15-min auto-sleep | Verified cold-start wake orchestration & proxy resilience |

---

## 2. Real Repository Structure & Directory Map

```
ClipSave/
├── app/                         # Expo Router App Entry & Tab Routes
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Custom animated tab bar with active badge indicators
│   │   ├── index.tsx            # Home Tab (URL input, resolve, card preview, top/preview sheet menus)
│   │   ├── queue.tsx            # Queue Tab (active, pending, completed, retryable cards)
│   │   ├── history.tsx          # History Tab (saved videos, local play, thumbnail fallback, swipe-to-delete)
│   │   └── settings.tsx         # Settings Tab (appearance, theme, palette, concurrency, storage maintenance)
│   ├── _layout.tsx              # Root Stack layout, ThemeProvider, launch pre-warm
│   └── preview.tsx              # Direct playback handler (redirects to native player / share sheet)
├── assets/                      # Application brand assets, splash, app icon
│   └── clipsave-logo.png        # Official brand logo
├── backend/                     # Python Resolver & Stream Proxy Backend
│   ├── app/
│   │   ├── main.py              # FastAPI app instance, CORS middleware, security headers, lifespan hooks
│   │   ├── config.py            # Pydantic BaseSettings (timeouts, rate limits, origins)
│   │   ├── models.py            # Strict Pydantic models (ResolveRequest, ResolvedMediaResponse, ErrorResponse)
│   │   ├── routes/
│   │   │   ├── health.py        # /healthz and /readyz liveness/readiness probes
│   │   │   └── resolve.py       # POST /v1/resolve and GET /v1/stream/{stream_id} proxy
│   │   ├── security/
│   │   │   ├── ssrf.py          # Strict RFC1918, link-local, cloud metadata DNS protection
│   │   │   ├── rate_limit.py    # Sliding window rate limiter with auto-pruning & capacity cap
│   │   │   ├── url_validation.py# TikTok domain & URL structure validation allowlist
│   │   │   └── logging.py       # Redacted safe logging (scrubs cookies, query tokens)
│   │   └── services/
│   │       └── extractor.py     # ThreadPoolExecutor-isolated yt-dlp metadata extractor & session store
│   ├── tests/                   # Pytest test suite (32 tests covering security, APIs, rate limiting)
│   ├── Dockerfile               # Multi-stage lightweight non-root production container
│   ├── load_test.py             # CLI concurrency and latency benchmarking utility
│   └── requirements.txt         # Pinned backend dependencies
├── docs/                        # Architectural specifications, audits, test reports, and runbooks
├── src/                         # Mobile Application Source
│   ├── components/              # Shared UI components (TabHeader, BottomSheetMenu, AccordionRow, Badges)
│   ├── services/
│   │   ├── apiClient.ts         # Resilient backend client with cold-start wake-up orchestration
│   │   ├── downloadEngine.ts    # Resumable download engine with concurrency queues & retry mechanics
│   │   ├── mediaManager.ts      # Scoped storage, gallery export, cache cleanup & sharing
│   │   └── mockResolver.ts      # Offline fixture resolver for testing without network
│   ├── storage/                 # Local persistence layer with memory-cache optimization
│   │   ├── historyStore.ts      # Completed downloads index and batch existence check
│   │   ├── queueStore.ts        # In-flight queue persistence with process-death reconciliation
│   │   └── settingsStore.ts     # User preferences (theme, palette, concurrency, storage)
│   ├── theme/                   # Dynamic design system (8 curated palettes, typography, spacing, motion)
│   ├── types/                   # TypeScript interfaces (DownloadJob, ResolvedMedia, AppSettings)
│   └── utils/                   # Formatters, URL validator, filename sanitizer, speed tracker
├── app.json                     # Expo configuration (permissions, scheme, android package)
├── eas.json                     # Expo Application Services build profiles
├── package.json                 # Pinned frontend dependencies & test scripts
└── tsconfig.json                # TypeScript strict configuration
```

---

## 3. End-to-End Data & Execution Flows

### 3.1 Link Resolution & Server Cold-Start Flow
```
User inputs TikTok URL -> URL validation regex -> Pre-warm check
   │
   ├─► Backend Awake (200 OK)
   │     └─► POST /v1/resolve -> ssrf check -> yt-dlp metadata extraction
   │           └─► Register high-entropy stream token -> Return ResolvedMediaResponse
   │
   └─► Backend Dormant (503 / Network Timeout)
         └─► apiClient triggers SnapDeploy wake hook (/api/public/wake/{subdomain})
               └─► Displays calm UI progress ("Waking up server..." -> "Almost ready...")
                     └─► Polls /healthz -> Server ready -> Retries POST /v1/resolve
```

### 3.2 Resilient Download & Gallery Export Flow
```
User taps "Download MP4"
   │
   ├─► Check active concurrency vs AppSettings.maxConcurrentDownloads
   │     ├─► Concurrency limit reached -> Enqueue with state="QUEUED"
   │     └─► Concurrency slot free -> Start download stream immediately
   │
   └─► Download Streaming (expo-file-system createDownloadResumable)
         ├─► Proxied through /v1/stream/{stream_id} (bypasses CDN 403 hotlink & TLS blocks)
         ├─► Temp file written to FileSystem.cacheDirectory/downloads/{jobId}.tmp
         ├─► Progress throttled to 8 UI dispatches/sec & 1 AsyncStorage write/sec
         └─► Download completes -> Move to permanent document storage -> Save to MediaLibrary Gallery
               └─► Trigger processNextQueuedJob() to dequeue next pending download
```

---

## 4. Storage Schemas & Persistence Model

### 4.1 Queue Store (`@clipsave_queue_v1`)
Stored as JSON array of `DownloadJob` objects:
- `id`: Unique string (`job_{timestamp}_{random}`).
- `sourceUrl`: TikTok URL.
- `media`: Resolved metadata payload.
- `state`: State machine enum: `'QUEUED' | 'DOWNLOADING' | 'PAUSED' | 'FINALIZING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'`.
- `bytesDownloaded` / `totalBytes`: Numerical byte counts.
- `tempFilePath`: Path to local temporary chunk file.
- `statusMessage`: User-friendly status string.
- `retryCount`: Integer counter.
- `createdAt` / `updatedAt`: ISO 8601 timestamps.

### 4.2 History Store (`@clipsave_history_v1`)
Stored as JSON array of `HistoryItem` objects:
- `id`: `hist_{jobId}`.
- `sourceUrl`: Original URL.
- `title`: Video title sanitized for filesystem display.
- `author`: Creator username.
- `thumbnailUrl`: Remote preview image URL.
- `fileUri`: Local permanent storage URI (`file:///...`).
- `fileSizeBytes`: Total size in bytes.
- `savedAt`: ISO timestamp.
- `fileExists`: Boolean state verified on-demand.

### 4.3 Settings Store (`@clipsave_settings_v1`)
Stored as JSON object of `AppSettings`:
- `themeMode`: `'system' | 'light' | 'dark'`.
- `palette`: Selection among 8 themes (`warm_light`, `modern_dark`, `neon_cyan`, etc.).
- `accentColor`: Hex color string.
- `maxConcurrentDownloads`: Number (1 to 5).
- `saveToGallery`: Boolean.
- `useMockResolver`: Boolean.
- `backendBaseUrl`: Remote API endpoint.
- `autoDownloadOnResolve`: Boolean.
