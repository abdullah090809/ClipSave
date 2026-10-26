# ANDROID PHYSICAL PHONE TEST CHECKLIST: ClipSave

**Target:** Physical Android Smartphone (Android 10 - 15) running **Expo Go**  
**Host PC OS:** Windows (PowerShell)  
**App Version:** ClipSave 1.0.0  

---

## 1. Prerequisites and Network Setup

Before running tests on your phone, complete these three simple setup steps:

### 1.1 Ensure Same Wi-Fi Network
- Connect your **Android phone** and your **Windows PC** to the **same Wi-Fi network** (or connect your PC to your phone's Wi-Fi hotspot).
- Note: On Windows, ensure your Wi-Fi network profile is set to **Private** (Settings > Network & internet > Wi-Fi > your network > select "Private network"). If set to "Public network", Windows Defender Firewall blocks incoming connections from your phone.

### 1.2 Find Your PC's Local IP Address
In PowerShell on your PC, check your local IP address:
```powershell
ipconfig
```
Look for `IPv4 Address` under your active Wi-Fi adapter (for example: `192.168.1.50`).

### 1.3 Install Expo Go on Android
- Open Google Play Store on your Android phone.
- Search for and install **Expo Go** (published by 650 Industries / Expo).

---

## 2. Launching Services on Your PC

Open two PowerShell windows in `D:\Skills\Tiktok Downloader`:

### Terminal 1: Start the Python Backend Resolver
```powershell
.\backend\.venv\Scripts\python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8080
```
> **Important:** `--app-dir backend` instructs Uvicorn to import from `backend/app`, preventing Python from accidentally importing the frontend's `app/` folder located in the repository root.
- You will see: `Uvicorn running on http://0.0.0.0:8080 (Press CTRL+C to quit)`
- *Windows Firewall prompt:* If Windows displays a "Windows Defender Firewall has blocked some features" dialog, click **Allow access** for Private networks.

### Terminal 2: Start the Expo Development Server
```powershell
npx expo start
```
- A large QR code will appear in your terminal, and Metro Bundler will start at `http://localhost:8081`.

---

## 3. Connecting Your Android Phone

1. Open the **Expo Go** app on your Android phone.
2. Tap **Scan QR code** and point your phone's camera at the QR code in Terminal 2.
3. Expo Go will download the JavaScript bundle (progress 0% -> 100%) and launch the ClipSave app.
4. **Automatic Backend Detection:** ClipSave automatically detects your PC's IP address (e.g. `http://192.168.1.50:8080`) from the Expo connection and configures the resolver backend.
   - Go to the **Settings** tab in the app to verify that `Resolver Base URL` shows `http://<your-pc-ip>:8080`.

---

## 4. Test Matrix: Tests A Through M (Run in Priority Order)

Run each test scenario below, verify the expected behavior, and mark your result.

---

### Test A: First-Launch, Disclaimers, and Theme Switching
- **Priority:** High
- **Steps:**
  1. Open ClipSave on the Home tab.
  2. Inspect the top banner: verify the copyright and personal ownership disclaimer is visible.
  3. Navigate to the **Settings** tab.
  4. Tap **Dark**, then tap **Light**, then tap **System**.
- **Expected Result:**
  - App displays clean layout without overlapping text.
  - Disclaimer banner clearly explains authorized personal use.
  - Theme switches instantly with proper high-contrast colors and readable text.
- [ ] **PASS** / [ ] **FAIL**

---

### Test B: Input Validation & Defensive Rejection
- **Priority:** High
- **Steps:**
  1. On the Home tab, leave the text input empty and tap **Resolve**.
  2. Paste a lookalike phishing link: `https://tiktok.com.attacker.example/video/12345` and tap **Resolve**.
  3. Paste random text (e.g. `hello world testing`) and tap **Resolve**.
  4. Paste a valid TikTok URL with tracking parameters (e.g. `https://www.tiktok.com/@user/video/734891238910?utm_source=share&fbclid=xyz`).
- **Expected Result:**
  - Empty input displays inline validation error: "Please enter or paste a TikTok video link."
  - Lookalike domain displays inline error rejecting the unapproved host.
  - Non-URL text displays inline validation error.
  - Valid TikTok URL is accepted, tracking parameters (`utm_source`, `fbclid`) are automatically stripped, and Resolve proceeds.
- [ ] **PASS** / [ ] **FAIL**

---

### Test C: Mock Resolver Mode (Offline / Sandbox Verification)
- **Priority:** High
- **Steps:**
  1. Go to the **Settings** tab.
  2. Toggle **Mock Resolver Mode** to **ON**.
  3. Return to the Home tab and tap **Resolve** on any valid TikTok link.
- **Expected Result:**
  - Video Preview modal opens immediately with fixture data:
    - Title: "ClipSave Mock Public Video (Development Fixture)"
    - Author: "CreativeCreator"
    - Estimated size and format displayed.
  - Proves the entire UI and preview flow works independently without depending on third-party network APIs.
- [ ] **PASS** / [ ] **FAIL**

---

### Test D: Real Public TikTok URL Resolution
- **Priority:** High
- **Steps:**
  1. In **Settings**, ensure **Mock Resolver Mode** is **OFF**.
  2. On your phone, open TikTok or a browser and copy a link to a **public, authorized video**.
  3. Open ClipSave and tap **Paste from Clipboard**.
  4. Tap **Resolve**.
- **Expected Result:**
  - Button enters loading state ("Resolving...").
  - Backend log in Terminal 1 shows `POST /v1/resolve` returning HTTP 200.
  - Video Preview modal opens displaying the real video title, creator username, thumbnail image, estimated file size, and duration.
- [ ] **PASS** / [ ] **FAIL**

---

### Test E: Private / Restricted Video Handling
- **Priority:** High
- **Steps:**
  1. Paste a link to a private, deleted, or restricted TikTok video.
  2. Tap **Resolve**.
- **Expected Result:**
  - App does NOT crash.
  - A friendly, explicit error message appears: "This video is private or restricted. ClipSave cannot access private accounts" or "The video could not be found or has been removed."
- [ ] **PASS** / [ ] **FAIL**

---

### Test F: Download Progress & Cancellation Mid-Stream
- **Priority:** High
- **Steps:**
  1. On the Preview modal (from Test C or D), tap **Start Download**.
  2. App navigates to the **Queue** tab.
  3. Observe the progress bar and streaming byte counter (e.g. `1.2 MB / 8.4 MB`).
  4. While the download is active, tap **Cancel** and confirm the cancellation prompt.
- **Expected Result:**
  - Progress updates smoothly in real time without freezing the UI.
  - When Cancel is confirmed, the download stops immediately.
  - Status updates to `CANCELLED`.
  - The partial temporary `.tmp` file is deleted from phone storage.
- [ ] **PASS** / [ ] **FAIL**

---

### Test G: Pause and Resume Download
- **Priority:** Medium
- **Steps:**
  1. Start a new download from the Preview modal.
  2. On the Queue tab, tap the **Pause** button on the active job card.
  3. Wait 3 seconds, then tap the **Resume** button.
- **Expected Result:**
  - State changes to `PAUSED`. Streaming ceases.
  - Upon tapping Resume, download resumes and finishes cleanly without corrupting the file.
- [ ] **PASS** / [ ] **FAIL**

---

### Test H: Download Completion & Storage Verification
- **Priority:** Critical
- **Steps:**
  1. Allow a download to reach 100% completion.
  2. Observe the state transition: `DOWNLOADING` -> `FINALIZING` -> `COMPLETED`.
  3. Status badge indicates "Saved to Gallery" or "Saved to App Storage".
  4. If prompted for Media / Photos permission on Android, tap **Allow**.
- **Expected Result:**
  - Job card displays green `COMPLETED` badge.
  - On standalone/dev builds, video is visible in Android Gallery under the `ClipSave` album.
  - In Expo Go (due to scoped storage restrictions), video is saved to app storage and recorded in History.
- [ ] **PASS** / [ ] **FAIL**

---

### Test I: History, In-App Playback, and Native Sharing
- **Priority:** High
- **Steps:**
  1. Navigate to the **History** tab.
  2. Locate the completed download from Test H.
  3. Tap the item to open the playback or details view.
  4. Tap the **Share** button on the history item.
- **Expected Result:**
  - The Android system share sheet opens, showing messaging apps, Google Drive, WhatsApp, etc.
  - Sharing the video to another app transmits the valid, playable MP4 file.
- [ ] **PASS** / [ ] **FAIL**

---

### Test J: History Record Removal vs. File Deletion
- **Priority:** Medium
- **Steps:**
  1. On the **History** tab, tap the trash/delete icon on a history card.
  2. Choose **Remove from History Only**.
  3. Verify the item disappears from the History list, but the file remains on device.
  4. Complete another download, then delete with **Delete File & Remove Record**.
  5. Verify both the record and the physical file are deleted.
- **Expected Result:**
  - Clear separation between removing history log entries and deleting device media.
- [ ] **PASS** / [ ] **FAIL**

---

### Test K: Cache Cleanup in Settings
- **Priority:** Medium
- **Steps:**
  1. Navigate to the **Settings** tab.
  2. Tap **Clear Temporary Cache**.
- **Expected Result:**
  - Alert displays: "Safely removed X temporary stream files. Your saved media and history were preserved."
  - Confirmed completed videos and history records are NOT deleted.
- [ ] **PASS** / [ ] **FAIL**

---

### Test L: Offline / Network Failure Resilience
- **Priority:** High
- **Steps:**
  1. Turn on Airplane Mode on your phone (or stop the FastAPI backend with Ctrl+C in Terminal 1).
  2. Attempt to resolve a TikTok link.
- **Expected Result:**
  - App displays a polite network error: "Could not connect to the ClipSave resolver backend. Check your network or enable Mock Resolver in Settings for offline testing."
  - App does not crash or display an unhandled exception redbox.
- [ ] **PASS** / [ ] **FAIL**

---

### Test M: Multiple Queued Downloads
- **Priority:** Medium
- **Steps:**
  1. Resolve and download video 1.
  2. Immediately return to Home, resolve and download video 2.
  3. Navigate to the Queue tab.
- **Expected Result:**
  - Both jobs appear in the queue list with independent progress bars and status indicators.
  - Both downloads complete without collision or shared state corruption.
- [ ] **PASS** / [ ] **FAIL**

---

## 5. Troubleshooting and Fallback Guide

| Symptom | Probable Cause | Exact Fix |
| :--- | :--- | :--- |
| **"Could not connect to backend"** | Phone and PC are on different Wi-Fi networks | Verify both devices are on the same Wi-Fi router. Disable VPNs on both PC and phone. |
| **"Could not connect to backend"** | Windows Firewall is blocking port 8080 | Run in PowerShell on PC (as Admin): `New-NetFirewallRule -DisplayName "ClipSave Backend" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow` |
| **Backend IP is wrong in Settings** | Phone is connected via cellular data or tunnel | Look up your PC's IP (`ipconfig`), open ClipSave Settings tab, type `http://<your-pc-ip>:8080`, and tap Save. |
| **TikTok says "video unavailable"** | Link has expired or is geo-restricted | Try another public TikTok link, or enable Mock Resolver Mode in Settings for testing. |
| **Expo Go crashes on QR scan** | Expo Go app version mismatch | Update Expo Go from Google Play Store to match SDK 58. |

---

## 6. How to Capture and Redact Logs

If you encounter an issue during testing:

### Capturing Backend Logs (Terminal 1)
- Copy the relevant lines from PowerShell Terminal 1.
- Note: ClipSave's logging engine automatically redacts sensitive auth tokens and parameters. Verify no private IP addresses or personal names are included before sharing.

### Capturing Frontend Logs (Terminal 2)
- Metro bundler logs errors directly in Terminal 2.
- Copy the error stack trace, redact any personal directory paths, and review against `docs/INCIDENT_RESPONSE.md`.
