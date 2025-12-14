# Render Deployment Troubleshooting Guide

## 403 Forbidden Error

If you're getting a 403 error when the main backend tries to call the get_info service, here are the most common causes and solutions:

### Problem: CORS Configuration

**Symptoms:**

- Logs show: `Request failed with status code 403`
- Service works when accessed directly in browser
- Fails when called from backend

**Solution:**

The CORS configuration has been updated in `src/server.js` to allow all origins. Deploy the updated version:

```bash
cd backend/get_info
git add .
git commit -m "fix: Update CORS configuration for Render deployment"
git push origin main
```

Then trigger a redeploy on Render for the `ftd-device-detection` service.

### Problem: Render Service Not Public

**Symptoms:**

- 403 or 401 errors
- Service works locally but not on Render

**Solution:**

1. Go to Render dashboard
2. Select your `ftd-device-detection` service
3. Go to **Settings**
4. Ensure the service is **not** set to "Private"
5. If using private networking, ensure both services are in the same team/organization

### Problem: Rate Limiting or DDoS Protection

**Symptoms:**

- Works initially, then starts failing
- 403 errors appear after many requests

**Solution:**

Render may be rate limiting requests. Options:

1. **Upgrade to paid tier** - Free tier has stricter limits
2. **Add caching** - Cache detection results in Redis
3. **Reduce requests** - Only call get_info for sensitive operations

### Problem: Missing Environment Variables

**Symptoms:**

- Service works but returns errors
- 500 errors instead of 403

**Solution:**

Check environment variables on Render:

1. Go to `ftd-device-detection` service settings
2. Add environment variables:
   - `NODE_ENV=production`
   - `PORT` (usually auto-set by Render)

### Problem: Service Cold Start

**Symptoms:**

- First request fails, subsequent requests work
- Timeout errors followed by 403

**Solution:**

Render's free tier has cold starts. Options:

1. **Increase timeout** in `backend/middleware/deviceDetection.js`:

   ```javascript
   const GET_INFO_TIMEOUT = 10000; // Increase to 10 seconds
   ```

2. **Upgrade to paid tier** - Keeps service warm

3. **Add health check pings** - Keep service alive:
   ```javascript
   // In main backend
   setInterval(async () => {
     try {
       await axios.get("https://ftd-device-detection.onrender.com/health");
     } catch (error) {
       // Ignore errors
     }
   }, 5 * 60 * 1000); // Ping every 5 minutes
   ```

## Testing the Connection

Run the test script to diagnose the issue:

```bash
cd backend/get_info
GET_INFO_URL=https://ftd-device-detection.onrender.com/api/detect node test-cors.js
```

This will:

- Test basic connectivity
- Check CORS headers
- Verify the service is responding correctly

## Verification Steps

### 1. Direct Browser Test

Open in browser: `https://ftd-device-detection.onrender.com/api/detect`

**Expected:** JSON response with device detection data

**If fails:** Service deployment issue - check Render logs

### 2. Health Check

Open in browser: `https://ftd-device-detection.onrender.com/health`

**Expected:**

```json
{
  "status": "healthy",
  "service": "get_info",
  "timestamp": "2025-12-14T...",
  "uptime": 123.45
}
```

### 3. Backend Integration Test

From main backend terminal:

```bash
curl https://ftd-device-detection.onrender.com/api/detect \
  -H "User-Agent: Mozilla/5.0" \
  -H "Accept: application/json"
```

**Expected:** JSON response with detection data

**If 403:** CORS or networking issue

### 4. Check Render Logs

1. Go to Render dashboard
2. Open `ftd-device-detection` service
3. View **Logs** tab
4. Look for incoming requests and any errors

**Expected logs:**

```
[timestamp] GET /api/detect from <IP>
[SUCCESS] Detection completed for <IP>
```

## Alternative Solutions

### Option 1: Use Internal Service URL (Render Teams Only)

If you have a Render team account, use internal networking:

1. In `ftd-device-detection` settings, enable **Private Networking**
2. Use internal URL in main backend:
   ```
   GET_INFO_URL=http://ftd-device-detection:3000/api/detect
   ```

This bypasses public internet and CORS entirely.

### Option 2: Deploy Both Services Together

Instead of separate services, include get_info in the main backend:

1. Copy `backend/get_info/src` to `backend/services/detection`
2. Import and mount in main backend:
   ```javascript
   const detectionRouter = require("./services/detection/router");
   app.use("/internal/detect", detectionRouter);
   ```
3. Update middleware:
   ```javascript
   const GET_INFO_URL =
     process.env.GET_INFO_URL || "http://localhost:5000/internal/detect";
   ```

### Option 3: Add API Key Authentication

Add a shared secret between services:

1. **In get_info service** (`src/server.js`):

   ```javascript
   app.use((req, res, next) => {
     const apiKey = req.headers["x-api-key"];
     const expectedKey = process.env.API_KEY || "your-secret-key";

     if (apiKey !== expectedKey) {
       return res.status(403).json({ error: "Invalid API key" });
     }
     next();
   });
   ```

2. **In main backend** (`.env`):

   ```
   GET_INFO_API_KEY=your-secret-key
   ```

3. **Update middleware** (`middleware/deviceDetection.js`):

   ```javascript
   headers: {
     'x-api-key': process.env.GET_INFO_API_KEY || '',
     // ... other headers
   }
   ```

4. **Set environment variables on Render:**
   - `ftd-device-detection`: `API_KEY=your-secret-key`
   - Main backend: `GET_INFO_API_KEY=your-secret-key`

## Still Not Working?

If you've tried all the above and it's still not working:

1. **Check Render Status**: https://status.render.com/
2. **Review Render Docs**: https://render.com/docs/web-services
3. **Contact Render Support**: They can check for account-specific restrictions
4. **Use Fallback**: The system already falls back to basic detection if get_info fails

## Monitoring

Add monitoring to track success/failure rates:

```javascript
// In middleware/deviceDetection.js
let successCount = 0;
let failureCount = 0;

setInterval(() => {
  const total = successCount + failureCount;
  const successRate = total > 0 ? ((successCount / total) * 100).toFixed(2) : 0;
  console.log(
    `[DeviceDetection] Success rate: ${successRate}% (${successCount}/${total})`
  );
  successCount = 0;
  failureCount = 0;
}, 60000); // Log every minute
```

## Performance Tips

1. **Reduce timeout**: If service is consistently slow, lower timeout to fail faster
2. **Cache results**: Store detection data in Redis for same IP/User-Agent
3. **Batch requests**: Queue multiple detections and process together
4. **Skip for GET requests**: Only detect on POST/PUT/PATCH/DELETE (already done)
