# Quick Deployment Guide

## Deploy to Render - Step by Step

### 1. Push Latest Changes

```bash
cd backend/get_info
git add .
git commit -m "fix: Improve CORS configuration and add diagnostics"
git push origin main
```

### 2. Deploy on Render

1. Go to https://dashboard.render.com
2. Find service: `ftd-device-detection`
3. Click **Manual Deploy** → **Deploy latest commit**
4. Wait for deployment to complete (~2-3 minutes)

### 3. Verify Deployment

Open in browser: https://ftd-device-detection.onrender.com/health

Expected response:
```json
{
  "status": "healthy",
  "service": "get_info",
  "timestamp": "2025-12-14T...",
  "uptime": 12.34
}
```

### 4. Test Detection Endpoint

Open: https://ftd-device-detection.onrender.com/api/detect

Expected: JSON with device detection data

### 5. Update Main Backend

Ensure main backend `.env` has:
```
GET_INFO_URL=https://ftd-device-detection.onrender.com/api/detect
```

Redeploy main backend if changed.

### 6. Test Integration

From local machine:
```bash
cd backend/get_info
GET_INFO_URL=https://ftd-device-detection.onrender.com/api/detect node test-cors.js
```

Expected: All tests pass ✅

### 7. Monitor Logs

On Render dashboard:
1. Open `ftd-device-detection` service
2. Go to **Logs** tab
3. Make a request to your main backend
4. Look for log entries like:
   ```
   [timestamp] GET /api/detect from <IP>
   [SUCCESS] Detection completed for <IP>
   ```

## Common Issues & Solutions

### Issue: 403 Forbidden

**Cause:** CORS or service permissions

**Solution:**
1. Verify latest code is deployed (check git commit hash in logs)
2. Try accessing directly in browser first
3. Check Render service is public (not private)
4. Review `RENDER_TROUBLESHOOTING.md`

### Issue: Timeout Errors

**Cause:** Cold start or slow service

**Solution:**
1. Increase timeout in `backend/middleware/deviceDetection.js`:
   ```javascript
   const GET_INFO_TIMEOUT = 10000; // 10 seconds
   ```
2. Upgrade to paid Render instance (no cold starts)
3. Add keep-alive pings

### Issue: Service Not Responding

**Cause:** Deployment failed or crashed

**Solution:**
1. Check Render logs for errors
2. Verify all dependencies installed
3. Check `start.js` output for missing modules
4. Redeploy from scratch if needed

## Testing Commands

```bash
# Test health endpoint
curl https://ftd-device-detection.onrender.com/health

# Test detection endpoint
curl https://ftd-device-detection.onrender.com/api/detect

# Test with headers (simulate real request)
curl https://ftd-device-detection.onrender.com/api/detect \
  -H "User-Agent: Mozilla/5.0" \
  -H "X-Forwarded-For: 94.101.205.231"

# Run full CORS test
cd backend/get_info
GET_INFO_URL=https://ftd-device-detection.onrender.com/api/detect node test-cors.js
```

## Deployment Checklist

- [ ] Latest code pushed to git
- [ ] Service deployed on Render
- [ ] Health check passes
- [ ] Detection endpoint returns data
- [ ] Main backend `.env` updated with correct URL
- [ ] Main backend redeployed
- [ ] Integration test passes
- [ ] Logs show successful requests
- [ ] No 403 or timeout errors

## Need Help?

1. Read: `RENDER_TROUBLESHOOTING.md`
2. Check Render logs
3. Run test script: `node test-cors.js`
4. Verify service status: https://status.render.com/
