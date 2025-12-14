# URGENT: Fix for ua-parser-js Missing on Render

## Issue
Render deployment shows `ua-parser-js: NOT FOUND` even though it's in package.json.

## Root Cause
Render might be caching old dependencies or not installing properly.

## Solution Options

### Option 1: Clear Render Build Cache (RECOMMENDED)

1. Go to https://dashboard.render.com
2. Open `ftd-device-detection` service
3. Click **Settings**
4. Scroll to **Build & Deploy**
5. Click **Clear build cache**
6. Then go back to **Manual Deploy** → **Deploy latest commit**

### Option 2: Force Clean Install

Update the Build Command on Render:

1. Go to service **Settings**
2. Find **Build Command**
3. Change from: `npm install`
4. Change to: `rm -rf node_modules package-lock.json && npm install`
5. Save changes
6. Redeploy

### Option 3: Use npm ci

1. Go to service **Settings**
2. Find **Build Command**
3. Change to: `npm ci`
4. Save and redeploy

## Verification

After redeploying, check logs for:

```
📦 Required Modules:
   ✅ express: v4.22.1
   ✅ cors: v2.8.5
   ✅ ua-parser-js: v2.0.7  ← Should show version, not "NOT FOUND"
```

## If Still Failing

The code now has fallback support, so the service will work even if ua-parser-js is missing, but with reduced functionality. The 403 error should be gone.

## Test After Deploy

```bash
curl https://ftd-device-detection.onrender.com/api/detect
```

Should return JSON without errors.
