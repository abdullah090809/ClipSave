# ClipSave — Baseline Test Report

**Date:** 2026-10-30  
**Environment:** Windows 10/11, Node.js v22.14.0, Python 3.13.14, Expo 58.0.19  
**Status:** All Static Checks, Typechecks, Unit Tests, and Bundle Exports Passing  

---

## 1. Summary of Baseline Execution

| Check Category | Command Executed | Exit Code | Duration | Outcome |
| :--- | :--- | :---: | :---: | :--- |
| **Mobile TypeScript Strict Check** | `npx tsc --noEmit` | `0` | 7.9s | **PASS** — 0 type errors across all `.ts` and `.tsx` files |
| **Mobile Jest Test Suite** | `npm test` | `0` | 8.2s | **PASS** — 12/12 suites passed, 107/107 tests passed |
| **Backend Pytest Suite** | `pytest backend/tests` | `0` | 1.58s | **PASS** — 5/5 test files passed, 45/45 tests passed |
| **Android Bundle Export** | `npx expo export --platform android` | `0` | 22.7s | **PASS** — Hermes bytecode bundle generated (2.9MB, 1226 modules) |
| **Python Dependency Check** | `python -m pip check` | `0` | 0.8s | **PASS** — No broken requirements found |
| **Mobile Dependency Audit** | `npm audit` | `1` | 6.8s | **WARNING** — 13 vulnerabilities (9 low, 4 high) in dev/build tools |
| **Docker Daemon Check** | `docker ps` | `1` | 0.4s | **NOT RUN** — Docker CLI present (29.9.2), daemon inactive on host |

---

## 2. Detailed Test Suite Breakdowns

### 2.1 Mobile Frontend Test Suite (`jest`)

```text
PASS src/utils/filenameSanitizer.test.ts
PASS src/utils/urlValidator.test.ts
PASS src/storage/settingsStore.test.ts
PASS src/storage/performance.test.ts
PASS src/services/mediaManager.test.ts
PASS src/utils/formatters.test.ts
PASS src/storage/queueStore.test.ts
PASS src/utils/jobDisplay.test.ts
PASS src/storage/historyStore.test.ts
PASS src/utils/speedTracker.test.ts
PASS src/services/downloadEngine.test.ts
PASS src/services/apiClient.test.ts

Test Suites: 12 passed, 12 total
Tests:       107 passed, 107 total
Snapshots:   0 total
Time:        8.171 s
```

### 2.2 Backend Resolver Test Suite (`pytest`)

```text
backend\tests\test_rate_limit.py ...                                     [  6%]
backend\tests\test_resolve_api.py ................                       [ 42%]
backend\tests\test_ssrf.py ........                                      [ 60%]
backend\tests\test_stream_session.py ...                                 [ 66%]
backend\tests\test_url_validation.py ...............                     [100%]

============================= 45 passed in 1.58s ==============================
```

### 2.3 Android Production Bundle Export (`expo export`)

```text
Android Bundled 22729ms node_modules\expo-router\entry.js (1226 modules)
› Assets (28):
assets\clipsave-logo.png (23KB)
node_modules\@expo\vector-icons\build\vendor\react-native-vector-icons\Fonts\Ionicons.ttf (390KB)
...
› android bundles (1):
_expo/static/js/android/entry-701fd3418ef7cfa0feb98c1d13186372.hbc (2.9MB)
› Files (1):
metadata.json (1.9KB)
Exported: dist
```

---

## 3. Baseline Environment Observations

1. **Test Reliability:** 0 flaky test failures observed across mobile and backend suites.
2. **Hermes Bytecode Compilation:** The complete client application compiles into a single Hermes bytecode bundle (`entry-*.hbc`, 2.9MB) with 0 bundling errors.
3. **Audit Caveats:** `npm audit` flagged dependencies (`deepmerge`, `node-forge`, `zod`) that are required by `@expo/cli` and `jest-config` for build-time operations and do not ship into the client runtime bundle.
