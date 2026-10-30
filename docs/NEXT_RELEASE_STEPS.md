# ClipSave — Next Steps for Android Release

**Date:** 2026-10-30  
**Target:** Production Android Release Candidate APK  
**Auditor:** Independent Release & DevOps Engineering  

---

## 1. Prerequisites for Release Candidate Build

The repository source code, security defenses, network configurations, and unit/integration test suites have been verified clean. Before generating the final production signed release APK, perform the following steps:

---

## 2. Step-by-Step Release Checklist

### Step 1: Configure Dedicated Production Keystore
Never sign production APKs with a debug certificate. Generate a dedicated release signing key:
```bash
keytool -genkey -v -keystore clipsave-release.keystore \
  -alias clipsave-key \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=ClipSave,O=ClipSave,C=US"
```
Convert the keystore to base64:
```bash
# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("clipsave-release.keystore")) | Out-File -Encoding ascii keystore_base64.txt

# Linux / macOS
base64 -w 0 clipsave-release.keystore > keystore_base64.txt
```
Add these repository secrets in **GitHub Repository → Settings → Secrets and variables → Actions**:
- `ANDROID_KEYSTORE_BASE64`: Content of `keystore_base64.txt`
- `ANDROID_KEYSTORE_PASSWORD`: Keystore password
- `ANDROID_KEY_ALIAS`: `clipsave-key`
- `ANDROID_KEY_PASSWORD`: Key password

> **Security Caution:** Never commit `clipsave-release.keystore` or `keystore_base64.txt` to the Git repository. Store a secure offline backup of the keystore file. If lost, existing users cannot receive app updates.

---

### Step 2: Production Backend Container Verification
ClipSave's mobile client defaults to the deployed SnapDeploy backend:
`https://clipsave-96518.containers.snapdeploy.app`

- **Free-Tier Sleeping:** Free-tier containers go dormant after inactivity and return `HTTP 503` with `X-Wake-Page: true`. ClipSave automatically sends a wake request to `https://snapdeploy.dev/api/public/wake/clipsave-96518` when checking backend health or resolving links.
- **Always-On Option:** For instant, zero-latency resolution on every launch without cold-start wake delays, upgrade the container to an Always-On plan via the SnapDeploy dashboard.

---

### Step 3: Trigger the GitHub Actions APK Build
1. Push the committed release changes to GitHub (`git push origin main`).
2. Go to **GitHub Actions → Build Android APK**.
3. Click **Run workflow**, choose `release`, and run the build.
4. Download the generated artifact `ClipSave-Android-APK` from the workflow summary.

---

### Step 4: Device Acceptance Testing Matrix
Install the compiled release APK on a physical Android device (`adb install ClipSave-release.apk`) and verify:
- [ ] Fresh launch renders startup splash screen and lands on Home tab.
- [ ] Paste a public TikTok link → tap **Get video** → confirm video metadata resolves.
- [ ] Select quality → tap **Download** → verify real byte progress and transfer speed.
- [ ] Ensure permission prompt appears and video is saved to Android Gallery (`ClipSave` album).
- [ ] Test playback via native player intent.
- [ ] Test YouTube Shorts, Instagram Reels, and Facebook Reels.
- [ ] Navigate to Settings → verify "Network & Resolver" accordion and test backend connection.
