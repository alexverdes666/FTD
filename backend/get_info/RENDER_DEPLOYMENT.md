# Render Deployment Guide for get_info Service

## Current Issue: 403 Forbidden Error

The service at `https://ftd-device-detection.onrender.com/api/detect` is returning **403 Forbidden** errors.

### Possible Causes

1. **Render Web Service Permissions** - The service may need to be configured to accept external requests
2. **Service Sleeping** - Free tier spins down after inactivity, causing cold starts
3. **CORS Configuration** - May be blocking requests from your main backend
4. **Incorrect Root Directory** - Render may not be finding the correct files

## Solution Steps

### Step 1: Verify Service Configuration on Render

1. Log into [Render Dashboard](https://dashboard.render.com/)
2. Navigate to your `ftd-device-detection` service
3. Check these settings:

   **Build & Deploy:**
   - Root Directory: `backend/get_info`
   - Build Command: `npm install`
   - Start Command: `npm start`
   
   **Environment:**
   - Runtime: Node
   - Node Version: 18 or higher (recommended)

### Step 2: Test the Service Directly

Before integration, test the service directly:

```bash
# Test root endpoint
curl https://ftd-device-detection.onrender.com/

# Test health check
curl https://ftd-device-detection.onrender.com/health

# Test detection endpoint
curl https://ftd-device-detection.onrender.com/api/detect
```

Expected response from `/api/detect`:
```json
{
  "ip": { "clientIp": "...", ... },
  "userAgent": { "raw": "...", ... },
  "device": { "hostname": "...", ... },
  ...
}
```

### Step 3: Check Render Logs

In the Render dashboard:
1. Go to your service
2. Click "Logs" tab
3. Look for:
   - Build errors
   - Runtime errors
   - Detection request logs (added in latest update)

### Step 4: Redeploy with Latest Changes

The code has been updated with:
- ✅ Explicit CORS configuration allowing all origins
- ✅ Health check endpoint at `/health`
- ✅ Root endpoint with service info
- ✅ Better error logging
- ✅ 403-specific error handling

To deploy:

**Option A: Manual Deploy (Render Dashboard)**
1. Go to Render dashboard
2. Select your service
3. Click "Manual Deploy" > "Deploy latest commit"

**Option B: Git Push (Automatic)**
```bash
cd /path/to/FTD
git add backend/get_info/
git commit -m "fix: improve CORS and error handling for get_info service"
git push origin main
```

Render will automatically detect changes in `backend/get_info` and redeploy.

### Step 5: Verify Integration

After redeployment:

1. **Test the service directly:**
   ```bash
   curl https://ftd-device-detection.onrender.com/api/detect
   ```

2. **Check main backend logs** for device detection:
   - Should see `[DEVICE-DETECT]` entries
   - Should NOT see "403" errors

3. **Test from your application:**
   - Perform a login or any POST/PUT request
   - Check if device information is being captured

### Step 6: Update Main Backend Environment

Ensure your main FTD backend has the correct environment variable:

**On Render (main backend service):**
```
GET_INFO_URL=https://ftd-device-detection.onrender.com/api/detect
```

After updating, redeploy the main backend.

## Troubleshooting

### Issue: Service Returns 404

**Solution:** Check Root Directory setting
- Should be: `backend/get_info`
- Not: `/backend/get_info` or `get_info`

### Issue: Service Won't Start

**Symptoms:** Build succeeds but service crashes

**Solutions:**
1. Check Render logs for errors
2. Verify `package.json` has all dependencies:
   ```json
   {
     "dependencies": {
       "express": "^4.18.2",
       "cors": "^2.8.5",
       "useragent": "^2.3.0",
       "geoip-lite": "^1.4.7"
     }
   }
   ```
3. Ensure Node version compatibility (use Node 18+)

### Issue: Still Getting 403 After Deployment

**Possible causes:**
1. **Service hasn't redeployed** - Check deployment status in Render
2. **Cached old version** - Wait 1-2 minutes for Render to fully redeploy
3. **Wrong URL** - Verify `GET_INFO_URL` is correct
4. **Render region issues** - Try deploying in a different region

**Advanced solution - Add API Key Authentication:**

If the issue persists, we can add simple API key authentication:

1. Add to `backend/get_info/src/server.js`:
   ```javascript
   app.get("/api/detect", (req, res) => {
     const apiKey = req.headers["x-api-key"];
     if (process.env.API_KEY && apiKey !== process.env.API_KEY) {
       return res.status(403).json({ error: "Invalid API key" });
     }
     // ... rest of code
   });
   ```

2. Set environment variable in Render:
   ```
   API_KEY=your-secret-key-here
   ```

3. Update main backend to send key:
   ```javascript
   const response = await axios.get(GET_INFO_URL, {
     headers: {
       "x-api-key": process.env.GET_INFO_API_KEY,
       // ... other headers
     }
   });
   ```

### Issue: Slow Response Times

**Solutions:**
1. Upgrade to a paid Render instance (removes cold starts)
2. Increase timeout in `deviceDetection.js` (currently 3000ms)
3. Deploy both services in the same region

## Fallback Behavior

The system is designed to work even if the get_info service fails:
- Automatically falls back to basic detection
- Logs are still created with limited information
- No impact on main application functionality

Check logs for:
```
[DeviceDetection] ⚠️  get_info service error: Request failed with status code 403
```

This indicates the fallback is being used.

## Health Check

To monitor service health, use the `/health` endpoint:

```bash
curl https://ftd-device-detection.onrender.com/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "get_info",
  "timestamp": "2025-12-14T21:30:00.000Z"
}
```

## Next Steps

1. ✅ Code has been updated with fixes
2. ⏳ Deploy the updated code to Render
3. ⏳ Test the service endpoints
4. ⏳ Verify integration with main backend
5. ⏳ Check device detection logs in MongoDB

## Support

If issues persist after following this guide:
1. Check Render service logs for specific error messages
2. Verify network connectivity between services
3. Consider upgrading to Render's paid tier for guaranteed uptime
4. Enable detailed logging in both services
