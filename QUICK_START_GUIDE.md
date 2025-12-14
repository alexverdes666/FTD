# Quick Deployment Guide - Device Detection Integration

## ⚡ Quick Start

### Step 1: Deploy get_info Service (5 minutes)

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your Git repository
4. Configure:
   - **Name**: `ftd-device-detection`
   - **Root Directory**: `backend/get_info`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node
5. Click **"Create Web Service"**
6. Wait for deployment (2-3 minutes)
7. Copy the URL: `https://ftd-device-detection.onrender.com`

### Step 2: Update Backend Environment (2 minutes)

1. Go to your main backend service on Render
2. Go to **"Environment"** tab
3. Add new variable:
   - **Key**: `GET_INFO_URL`
   - **Value**: `https://ftd-device-detection.onrender.com/api/detect`
4. Click **"Save Changes"**
5. Click **"Manual Deploy"** → **"Deploy latest commit"**

### Step 3: Verify (2 minutes)

Test get_info service:

```bash
curl https://ftd-device-detection.onrender.com/api/detect
```

Test backend integration (make any POST/PUT/DELETE request):

```bash
# After making a request, check logs with:
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  https://your-backend.onrender.com/api/device-detection/stats?hours=1
```

## ✅ What You Get

Every POST, PUT, PATCH, DELETE request now logs:

- ✅ Complete IP analysis with proxy detection
- ✅ Anti-detect browser detection (Dolphin Anty, Multilogin, etc.)
- ✅ Device system information (hostname, username, CPU, memory)
- ✅ Geolocation data (country, city, timezone)
- ✅ Security risk scoring (0-100)
- ✅ Before/after change tracking
- ✅ Audit trail in MongoDB

## 🚨 Security Alerts

Console logs will show security warnings:

```
🚨 ANTI-DETECT: dolphinAnty
🔀 PROXY DETECTED
⚠️ RISK: 75/100
```

## 📊 View Logs

Admin endpoints:

```bash
# All logs
GET /api/device-detection

# Suspicious activities
GET /api/device-detection/suspicious?hours=24

# User activity
GET /api/device-detection/user/:userId?days=30

# IP tracking
GET /api/device-detection/ip/:ipAddress?hours=24

# Statistics
GET /api/device-detection/stats?hours=24

# Anti-detect browser stats
GET /api/device-detection/antidetect-stats?hours=168
```

## 🔍 Query Examples

### Find all anti-detect browser usage

```bash
curl -H "Authorization: Bearer TOKEN" \
  "https://your-backend.onrender.com/api/device-detection?antidetect=true"
```

### Find all proxy usage

```bash
curl -H "Authorization: Bearer TOKEN" \
  "https://your-backend.onrender.com/api/device-detection?proxy=true"
```

### Find high-risk activities

```bash
curl -H "Authorization: Bearer TOKEN" \
  "https://your-backend.onrender.com/api/device-detection?minRiskScore=50"
```

### Get suspicious activities in last 24 hours

```bash
curl -H "Authorization: Bearer TOKEN" \
  "https://your-backend.onrender.com/api/device-detection/suspicious?hours=24"
```

## 🛠️ Troubleshooting

### "get_info service not available"

- Check if service is running on Render
- Verify URL in environment variables
- Test: `curl https://your-get-info-url/api/detect`

### No logs appearing

- Make a POST/PUT/DELETE request (GET requests aren't logged)
- Check MongoDB connection
- Check Render logs for errors

### Timeouts

- Default timeout is 3 seconds
- System falls back to basic detection if timeout
- Consider upgrading get_info to paid instance

## 💰 Cost

- **Development**: Both services free on Render
- **Production**:
  - get_info: $7/month (Starter instance)
  - main backend: Already deployed
  - Total additional cost: $7/month

## 📝 Files Changed

### New Files

- `backend/models/DeviceDetectionLog.js`
- `backend/middleware/deviceDetection.js`
- `backend/routes/deviceDetection.js`
- `DEVICE_DETECTION_INTEGRATION.md`
- `backend/get_info/` (entire folder)

### Modified Files

- `backend/server.js` (replaced activityLogger with deviceDetection)
- `backend/env.example` (added GET_INFO_URL)
- `backend/get_info/README.md` (added deployment guide)

## 🎯 Next Steps

1. Deploy get_info service ✅
2. Add environment variable ✅
3. Redeploy backend ✅
4. Monitor logs ⏳
5. Set up alerts (optional)
6. Configure retention policy (optional)

## 📚 Full Documentation

See `DEVICE_DETECTION_INTEGRATION.md` for complete documentation.

## 🔐 Security Notes

- No authentication needed for get_info (internal use only)
- All sensitive data automatically redacted in logs
- Risk scoring helps identify threats automatically
- Audit trail for compliance requirements

## ⚡ Performance

- Average overhead: 50-200ms per request
- Falls back instantly if service unavailable
- Async logging doesn't block responses
- MongoDB inserts are fast and indexed

## 🎉 Benefits

1. **Fraud Detection**: Identify anti-detect browsers
2. **Security**: Detect proxies, VPNs, and suspicious activity
3. **Compliance**: Complete audit trail
4. **Account Takeover**: Detect device changes
5. **Account Sharing**: Identify multiple users per account
6. **Forensics**: Detailed logs for investigation
7. **Risk Scoring**: Automatic threat identification

---

**Need Help?** Check the full documentation in `DEVICE_DETECTION_INTEGRATION.md`
