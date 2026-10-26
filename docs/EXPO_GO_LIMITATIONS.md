# EXPO GO LIMITATIONS & NATIVE RUNTIME BOUNDARIES

**Date:** 2026-10-26  
**Status:** Active Reference  

---

## 1. Runtime Environment Separation

ClipSave is built with **React Native + Expo**. To maintain absolute transparency and prevent misleading demos, we explicitly differentiate between what is supported in **Expo Go** versus what requires an **Expo Development Build (EAS / Prebuild)** or a **Production Android APK/AAB**.

| Runtime | Target Purpose | Native Capabilities Supported |
| :--- | :--- | :--- |
| **Expo Go** | Fast UI development, component testing, layout verification, link paste & validation, mock resolver testing, history UI, dark/light theme testing. | Standard Expo SDK modules: `expo-clipboard`, `expo-file-system` (foreground), `expo-sharing`, `@expo/vector-icons`, `expo-constants`. |
| **Expo Development Build** | End-to-end device testing, Android Share Target intent integration, full `expo-media-library` public gallery saving, background download capabilities. | Custom config plugins (`app.json`), Android Intent Filters for `android.intent.action.SEND`, scoped MediaStore integration, foreground notifications. |
| **Production Build (APK/AAB)** | Final consumer release, optimized bytecode, Hermes engine, disabled debug ports, minimal release permissions. | Complete native Android integration, verified signing, release security configuration. |

---

## 2. Feature-by-Feature Capability Matrix

| Feature | Expo Go Support | Development Build Support | Implementation Choice | Test Evidence / Verification |
| :--- | :--- | :--- | :--- | :--- |
| **URL Input & Validation** | Fully Supported | Fully Supported | Pure TypeScript validation logic in `src/utils/urlValidator.ts`. | Unit tests passing; validated directly in Expo Go. |
| **Explicit Clipboard Paste** | Fully Supported | Fully Supported | `expo-clipboard` invoked strictly on explicit user button tap. | Verified in Expo Go. |
| **Android Share Target (Receive share from TikTok app)** | **Unsupported** in Expo Go (cannot register custom Android intent filters in pre-compiled Expo Go client) | Fully Supported | Config plugin in `app.json` for `android.intent.action.SEND` with MIME type `text/plain`. | In Expo Go, display clear notice: *"Android Share Target requires a development build. Please paste the link above."* |
| **Mock Resolver Mode** | Fully Supported | Fully Supported | Client-side mock resolver toggleable in Settings or automatically active in test/offline mode. | Tested in Expo Go and Jest unit tests. |
| **Remote Resolver Integration** | Fully Supported | Fully Supported | Standard `fetch` / `axios` API calls over HTTPS to ClipSave FastAPI resolver backend. | Verified with local/hosted backend. |
| **Foreground Video Download** | Fully Supported | Fully Supported | `expo-file-system` download resumable session streaming to app cache directory. | Real progress events measured and displayed. |
| **Public Gallery Insertion (Android MediaStore)** | Limited / Sandboxed in some Expo Go versions | Fully Supported | `expo-media-library` with scoped permissions (`READ_MEDIA_VIDEO`). Fallback to `expo-sharing` if MediaStore permission is restricted in Expo Go. | Verified in Development Build; fallback graceful in Expo Go. |
| **True Background Downloads across Process Kill** | **Unsupported** in Expo Go | Requires WorkManager / Foreground Service Native Plugin | Foreground streaming download with pause/resume state persistence. Interrupted downloads can be resumed upon app reopening. | Documented constraint; no fake background promises. |
| **History & Queue Persistence** | Fully Supported | Fully Supported | `AsyncStorage` / `expo-sqlite` persistent local storage. | Unit tested & verified across app restarts. |
| **Settings & Theme (Light/Dark)** | Fully Supported | Fully Supported | React Native `Appearance` API + custom theme context. | Verified in Expo Go across light and dark modes. |
| **Audio-only Export (Optional)** | Limited in Expo Go | Fully Supported with native media muxer | Pure audio stream extraction via resolver stream selection or native config plugin. | Documented in Phase 8. |

---

## 3. Expo Go Graceful Fallback Strategy

When running in **Expo Go**, the app detects its environment via `Constants.appOwnership === AppOwnership.Expo`.

If a feature requiring a development build is accessed:
1. **Share Target:** A prominent helper banner on the Home screen explains how to paste links directly, noting that direct share integration is available in the compiled Android build.
2. **Media Saving:** If `expo-media-library` encounters permission restrictions in Expo Go, the app offers an immediate **"Share / Save via System Dialog"** action using `expo-sharing`, ensuring the user can still export and view their downloaded video.
3. **No Dead Controls:** No button or setting is disabled without a clear, human-readable explanation of why the action requires a development build.

---

## 4. Commands to Run

### Running in Expo Go
```bash
npx expo start
```
*Scan the generated QR code with the Expo Go Android app.*

### Creating & Running a Development Build (for full native Android capabilities)
```bash
# Generate native Android project with config plugins
npx expo prebuild --platform android

# Run Android development build on connected device / emulator
npx expo run:android
```
