# Quick Reference - Render Deployment

## 🚀 Deploy Now

### 1. Go to Render

https://dashboard.render.com → `ftd-device-detection`

### 2. Deploy

Click: **Manual Deploy** → **Deploy latest commit**

### 3. Wait (~2-3 min)

Watch for: `Server running on http://localhost:10000`

---

## ✅ Test (Copy & Paste)

### Browser Tests:

```
https://ftd-device-detection.onrender.com/health
https://ftd-device-detection.onrender.com/api/detect
```

### PowerShell Test:

```powershell
cd backend/get_info
$env:GET_INFO_URL="https://ftd-device-detection.onrender.com/api/detect"
node test-cors.js
```

### curl Test:

```bash
curl https://ftd-device-detection.onrender.com/health
curl https://ftd-device-detection.onrender.com/api/detect
```

---

## 📋 Success Checklist

- [ ] Health endpoint returns `{"status": "healthy"}`
- [ ] Detect endpoint returns JSON with device data
- [ ] test-cors.js shows all tests passed
- [ ] Main backend shows no 403 errors
- [ ] Device detection logs appear in database

---

## 📚 Documentation

- **Deploy Steps**: `DEPLOYMENT.md`
- **Fix Details**: `FIX_403_SUMMARY.md`
- **Troubleshooting**: `RENDER_TROUBLESHOOTING.md`
- **Test Script**: `test-cors.js`

---

## 🆘 If Still Broken

1. Check Render logs for errors
2. Run `node test-cors.js`
3. Read `RENDER_TROUBLESHOOTING.md`
4. Try Alternative Solution #2 (deploy together)

---

## 🎯 What Was Fixed

- ✅ Enhanced CORS configuration
- ✅ Added explicit allowed headers
- ✅ Added health check endpoint
- ✅ Improved error logging
- ✅ Added diagnostic tools

---

## 📊 Environment Check

Main backend `.env` should have:

```
GET_INFO_URL=https://ftd-device-detection.onrender.com/api/detect
```

If changed, redeploy main backend too.
