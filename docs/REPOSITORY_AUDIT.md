# REPOSITORY AUDIT: ClipSave

**Date:** 2026-10-26  
**Auditor:** Antigravity Senior Engineer  
**Workspace:** `d:\Skills\Tiktok Downloader`  

---

## 1. Executive Summary & Inventory

An initial inspection of the workspace was conducted on 2026-10-26. The workspace was initially empty. Version control (`git`) was initialized (`git init`). A complete survey of available system runtimes, tools, ports, and environment constraints was performed.

### Runtime and Toolchain Inventory

| Tool / Runtime | Installed Version | Status / Notes |
| :--- | :--- | :--- |
| **Node.js** | `v24.18.0` | Active (compatible with modern npm and Expo tooling) |
| **npm** | `11.16.0` | Active package manager |
| **Python** | `3.13.14` | Active; pip `26.2.1` installed |
| **Git** | `2.55.0.windows.2` | Initialized repository |
| **Docker** | Docker Desktop running | Available for container builds and local service testing |
| **npx** | Present (`npx.ps1`) | `create-expo-app` 5.1.5 tested |
| **Android SDK / ADB** | Not in standard PATH / not detected | Local Android emulator/device testing is unavailable in this environment; tests requiring Android emulator or physical device will be explicitly documented and reported as `NOT RUN` with reasons. Mock and automated JS/Python test suites will be run locally. |
| **Ports in Use** | Port `8000` is active | `hirefilter-api-1` container occupies port `8000`. ClipSave backend resolver will use port `8080` (or `8001`) by default to avoid port collision. |

---

## 2. Technology Selection & Target Stack

### Mobile Frontend
- **Framework:** React Native + Expo (SDK 52, latest stable)
- **Language:** TypeScript with strict mode (`strict: true`, `noImplicitAny: true`, `strictNullChecks: true`)
- **Navigation:** Expo Router v4 (file-based routing under `app/`)
- **Architecture:** Feature-driven architecture:
  - `app/`: Expo Router screens and layouts (`(tabs)`, `modal`, `_layout.tsx`)
  - `src/features/`: Download queue, resolver integration, history management, settings
  - `src/components/`: Accessible, themed UI components (buttons, input fields, progress bars, cards, modals)
  - `src/services/`: API resolver client, HTTP download engine, file manager
  - `src/storage/`: SQLite / async local storage persistence for history and queue
  - `src/hooks/`: Reactive hooks for network status, theme, queue state
  - `src/theme/`: Light and dark color palettes, spacing tokens, typography scales
  - `src/types/`: Strict domain interfaces and schemas
  - `src/utils/`: Safe URL sanitizers, filename sanitizers, error mappers
- **Icons:** `@expo/vector-icons` (maintained, official Expo icon set)
- **Local Persistence:** `expo-sqlite` / `@react-native-async-storage/async-storage` for history and queue state
- **File Management:** `expo-file-system`, `expo-media-library`, `expo-sharing`

### Backend Resolver
- **Language:** Python 3.13
- **Framework:** FastAPI with Uvicorn (ASGI)
- **Validation:** Pydantic v2 Settings and BaseModel schemas
- **Extractor:** `yt-dlp` Python API (strictly pinned, with restricted extractor allowlists)
- **Security Protections:**
  - Strict URL hostname parsing & validation (only exact TikTok domains permitted)
  - SSRF protection: DNS resolution verification rejecting private/loopback/cloud-metadata IPs (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.169.254, ::1, fc00::/7)
  - Rate limiting (in-memory token bucket / sliding window per client IP)
  - Bounded concurrency & strict timeout enforcement
  - Redacted logging (no raw query parameters, signed tokens, or PII)
- **Testing:** `pytest`, `pytest-asyncio`, `httpx`, `hypothesis`

---

## 3. Risks & Mitigations

1. **Upstream Platform Changes:**  
   TikTok frequently alters its web endpoints, tokens, and CDN policies.  
   *Mitigation:* The backend resolver isolates the extractor logic (`yt-dlp`), allowing rapid updates without requiring app store resubmissions. The app handles extractor failures with transparent, actionable error states.

2. **Expo Go Native Boundary Constraints:**  
   Certain native capabilities (such as Android Share Sheet intent filters and background services) cannot execute in standard Expo Go.  
   *Mitigation:* Clear runtime detection and graceful fallbacks. Detailed runtime comparison in `docs/EXPO_GO_LIMITATIONS.md`. In Expo Go, manual paste, mock resolver, and foreground download flows are fully functional.

3. **SSRF and Abusive Link Ingestion:**  
   Malicious actors could submit internal IP addresses, AWS metadata endpoints, or non-TikTok links to probe internal infrastructure.  
   *Mitigation:* Multi-layer defense: Client regex/URL validation + Backend strict hostname allowlist + Socket-level pre-flight DNS validation against RFC 1918, link-local, and cloud metadata ranges + Disabling arbitrary yt-dlp generic extractors.

4. **Network Interruption & Corrupted Media:**  
   Downloads interrupted mid-stream could leave unplayable video files or corrupt local history.  
   *Mitigation:* Downloads write to private temporary files (`.tmp`). Completed files undergo size and container validation before atomic rename/promotion and entry into the public media gallery and database.

5. **Storage and Memory Exhaustion:**  
   Loading large media into JavaScript heap will crash React Native.  
   *Mitigation:* Streaming I/O via native file system delegates (`expo-file-system` / native background downloaders). Video data never touches the JavaScript heap as raw bytes or base64.

---

## 4. Phase Plan and Gates

- **Phase 0:** Repository audit, architecture baseline, Expo Go limitations, traceability matrix (COMPLETE).
- **Phase 1:** App skeleton, strict TypeScript, design system, theme tokens, tabs and screens with deterministic mock data.
- **Phase 2:** Link validation engine, API client contracts, and backend resolver with SSRF defenses and rate limiting.
- **Phase 3:** Real resolver integration, preview confirmation sheet, and robust error handling.
- **Phase 4:** Resilient download engine, honest progress reporting, pause/resume, temp file cleanup, and gallery saving.
- **Phase 5:** History management, settings, theme switching, file deletion semantics, and accessibility.
- **Phase 6:** Failure recovery, process death reconciliation, security hardening, and STRIDE verification.
- **Phase 7:** Performance benchmarks, mocked load testing, and edge-case testing.
- **Phase 8:** Optional media utilities (audio extraction) if core release criteria are satisfied.
- **Phase 9:** Release readiness, runbooks, Dockerization, dependencies audit, and final verification.
