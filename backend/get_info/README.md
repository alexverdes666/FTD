# User Detection API

Simple API for real-time user detection and device information.

## Features

- ✅ Real-time IP detection (automatic local network IP resolution)
- ✅ User Agent parsing (browser, OS, device)
- ✅ **Device information (hostname, username, user path)**
- ✅ **System information (CPU, memory, platform, uptime)**
- ✅ Anti-detect browser detection
- ✅ Proxy/VPN detection
- ✅ Client Hints support
- ✅ GeoIP lookup
- ✅ Network interface enumeration

## Installation

```bash
npm install
```

## Usage

```bash
# Start the server
npm start

# Start with auto-reload (development)
npm run dev
```

## API Endpoint

### GET /api/detect

Returns comprehensive detection information about the client.

**Example Request:**

```bash
curl http://localhost:3000/api/detect
```

**Example Response:**

```json
{
  "ip": {
    "clientIp": "192.168.0.222",
    "socketIp": "127.0.0.1",
    "detectedIp": "127.0.0.1",
    "isIPv6": false,
    "ipType": "private-class-c",
    "connectionType": "loopback",
    "localNetworkIPs": {
      "ipv4": [...],
      "ipv6": [...]
    }
  },
  "userAgent": {
    "raw": "Mozilla/5.0...",
    "browser": { "name": "Chrome", "version": "143.0.0.0" },
    "os": { "name": "Windows", "version": "10" },
    "device": { "type": "desktop" },
    "isBot": false,
    "isMobile": false
  },
  "device": {
    "hostname": "Vertex",
    "user": {
      "username": "dani0",
      "homedir": "C:\\Users\\dani0",
      "userPath": "C:\\Users\\dani0",
      "uid": -1,
      "gid": -1,
      "shell": null
    },
    "system": {
      "platform": "win32",
      "platformName": "Windows",
      "release": "10.0.26200",
      "architecture": "x64",
      "cpuCount": 12,
      "cpuModel": "Intel(R) Core(TM) i9-8950HK CPU @ 2.90GHz",
      "cpuSpeed": 2904,
      "totalMemoryGB": "63.76",
      "freeMemoryGB": "50.27",
      "usedMemoryGB": "13.49",
      "memoryUsagePercent": "21.16",
      "uptimeHours": "8.73"
    },
    "tempDir": "C:\\Users\\dani0\\AppData\\Local\\Temp",
    "endianness": "LE"
  },
  "antidetect": {
    "isDetected": false,
    "confidence": "none"
  },
  "proxy": {
    "isProxy": false
  },
  "geo": {
    "available": false
  },
  "clientHints": {...},
  "securityHeaders": {...},
  "fingerprint": {...}
}
```

## Device Detection Features

### Device Information

- **Hostname**: Computer/device name
- **Username**: Current system user
- **User Path**: Full user directory path (e.g., `C:\Users\dani0`)
- **Home Directory**: User's home directory

### System Information

- **Platform**: Operating system (Windows, macOS, Linux, etc.)
- **Release**: OS version/release number
- **Architecture**: CPU architecture (x64, arm64, etc.)
- **CPU Details**: Model, core count, speed
- **Memory**: Total, free, used memory with percentage
- **Uptime**: System uptime in hours
- **Temp Directory**: System temporary directory path

### IP Detection

- Automatically resolves loopback addresses to actual local network IP
- Prioritizes Wi-Fi and Ethernet over virtual adapters
- Classifies IP types (loopback, private, public, link-local)
- Detects proxy chains and forwarding headers
- Lists all network interfaces with detailed information

## Configuration

Default port: `3000`

Change port:

```bash
PORT=8080 npm start
```

## Deployment to Render

This service is designed to be deployed alongside the main FTD backend on Render.

### Quick Start

See `DEPLOYMENT.md` for step-by-step deployment instructions.

### Troubleshooting

If you encounter 403 errors or connection issues, see `RENDER_TROUBLESHOOTING.md`.

### Testing

```bash
# Test CORS and connectivity
GET_INFO_URL=https://ftd-device-detection.onrender.com/api/detect node test-cors.js

# Test health endpoint
curl https://ftd-device-detection.onrender.com/health
```

### Step 1: Prepare for Deployment

1. Navigate to the `get_info` directory:

```bash
cd backend/get_info
```

2. Ensure all dependencies are listed in `package.json`

### Step 2: Deploy to Render

1. **Create a New Web Service** on Render.com
2. **Connect your Git repository** (same repo as FTD backend)
3. **Configure the service:**

   - **Name**: `ftd-device-detection` (or any name you prefer)
   - **Region**: Same as your main backend (for low latency)
   - **Branch**: `main` (or your deployment branch)
   - **Root Directory**: `backend/get_info`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Starter (should be sufficient)

4. **Environment Variables** (optional):

   - `PORT`: Auto-set by Render (usually 10000)
   - `NODE_ENV`: `production`

5. **Deploy**: Click "Create Web Service"

### Step 3: Update Main Backend Configuration

Once deployed, you'll get a URL like: `https://ftd-device-detection.onrender.com`

Update your main FTD backend's `.env` file:

```bash
GET_INFO_URL=https://ftd-device-detection.onrender.com/api/detect
```

Then redeploy your main backend for the changes to take effect.

### Step 4: Verify Integration

After both services are deployed:

1. Check the get_info service is running:

```bash
curl https://ftd-device-detection.onrender.com/api/detect
```

2. Make a test request to your main backend (POST, PUT, DELETE)

3. Check the logs in Render for the main backend:

   - You should see `[DEVICE-DETECT]` log entries
   - Device information should be captured in MongoDB

4. Query the database or use the API:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-backend.onrender.com/api/device-detection/stats
```

### Troubleshooting

**If get_info service is not reachable:**

- The system will automatically fall back to basic detection
- Check Render logs for the get_info service
- Verify the URL is correct in your backend's `.env`
- Ensure both services are in the same region for low latency

**If requests are timing out:**

- Default timeout is 3 seconds
- Consider increasing timeout in `backend/middleware/deviceDetection.js`
- Check Render service health and cold start times

### Cost Optimization

- Both services can run on Render's free tier during development
- For production, consider:
  - Upgrading get_info to a paid instance for guaranteed uptime
  - Using the same instance type as your main backend
  - Deploying both in the same region to minimize latency

### Security Considerations

- The get_info service doesn't require authentication (it's internal)
- However, you may want to add API key authentication if exposed publicly
- Consider using Render's private networking if available
- Monitor logs for any suspicious access patterns

## Integration with FTD Backend

The FTD backend automatically calls this service for every POST, PUT, PATCH, and DELETE request. The data is stored in MongoDB's `devicedetectionlogs` collection with:

- Complete IP analysis
- Anti-detect browser detection
- Device fingerprinting
- Security risk scoring
- Change tracking

View logs via the API:

- `GET /api/device-detection` - All logs
- `GET /api/device-detection/suspicious` - Suspicious activities
- `GET /api/device-detection/stats` - Statistics
- `GET /api/device-detection/user/:userId` - User-specific logs

## License

MIT
