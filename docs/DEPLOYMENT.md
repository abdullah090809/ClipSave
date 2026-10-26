# DEPLOYMENT GUIDE: ClipSave

**Version:** 1.0.0  
**Date:** 2026-10-26  

---

## 1. Quick Local Development Deployment

### Prerequisites
- Node.js >= 20.0 (active Node v24.18.0 tested)
- Python >= 3.12 (active Python 3.13.14 tested)

### Step 1: Start Backend Resolver
```bash
# Create venv and install dependencies
python -m venv backend/.venv
.\backend\.venv\Scripts\pip install -r backend\requirements.txt

# Start FastAPI server on port 8080
.\backend\.venv\Scripts\uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8080 --reload
```

### Step 2: Start Mobile Client in Expo Go
```bash
# Install npm packages
npm install

# Start Expo development server
npx expo start
```
*Scan the terminal QR code using the Expo Go app on your Android phone.*

---

## 2. Production Docker Deployment

Deploy the resolver backend using Docker Compose:
```bash
docker compose up -d --build
```

Verify service status:
```bash
docker compose ps
docker compose logs clipsave-resolver
```

---

## 3. Native Android Development Build (for Share Intent & Background Work)

To test native Android features not available in Expo Go (such as the Android Share Target sheet):
```bash
# 1. Prebuild Android native project with config plugins
npx expo prebuild --platform android

# 2. Compile and run development build
npx expo run:android
```
