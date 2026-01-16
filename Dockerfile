# Backend-only Node.js deployment with Python and Fingerprint Browser support
FROM node:18-slim

# Set working directory
WORKDIR /app

# Install system dependencies including Python, Xvfb, and Chromium deps
RUN echo "=== Installing system dependencies ===" && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
        xz-utils \
        python3 \
        python3-pip \
        python3-pandas \
        python3-requests \
        python3-dev \
        gcc \
        make \
        g++ \
        # Xvfb and display dependencies
        xvfb \
        x11-utils \
        xauth \
        dbus-x11 \
        # Chromium dependencies
        fonts-liberation \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libatspi2.0-0 \
        libcairo2 \
        libcups2 \
        libdbus-1-3 \
        libdrm2 \
        libexpat1 \
        libgbm1 \
        libglib2.0-0 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libpango-1.0-0 \
        libx11-6 \
        libxcb1 \
        libxcomposite1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxkbcommon0 \
        libxrandr2 \
        libxshmfence1 \
    && echo "=== Creating Python symlinks ===" && \
    ln -sf python3 /usr/bin/python && \
    ln -sf pip3 /usr/bin/pip && \
    echo "=== Verifying Python installation ===" && \
    python3 --version && \
    pip3 --version && \
    echo "=== Checking pre-installed packages ===" && \
    python3 -c "import pandas; print(f'Pandas version: {pandas.__version__}')" && \
    python3 -c "import requests; print(f'Requests version: {requests.__version__}')" && \
    rm -rf /var/lib/apt/lists/* && \
    echo "=== System dependencies installed successfully ==="

# Install Fingerprint Chromium
RUN echo "=== Installing Fingerprint Chromium ===" && \
    CHROMIUM_VERSION="142.0.7444.175" && \
    DOWNLOAD_URL="https://github.com/adryfish/fingerprint-chromium/releases/download/${CHROMIUM_VERSION}/ungoogled-chromium-${CHROMIUM_VERSION}-1-x86_64_linux.tar.xz" && \
    mkdir -p /opt/fingerprint-chromium && \
    curl -L -o /tmp/chromium.tar.xz "$DOWNLOAD_URL" && \
    cd /tmp && \
    tar -xf chromium.tar.xz && \
    cp -r ungoogled-chromium*/* /opt/fingerprint-chromium/ 2>/dev/null || cp -r */ /opt/fingerprint-chromium/ 2>/dev/null || true && \
    chmod +x /opt/fingerprint-chromium/chrome 2>/dev/null || chmod +x /opt/fingerprint-chromium/chromium 2>/dev/null || true && \
    # Create symlink if needed
    if [ -f /opt/fingerprint-chromium/chromium ] && [ ! -f /opt/fingerprint-chromium/chrome ]; then \
        ln -sf /opt/fingerprint-chromium/chromium /opt/fingerprint-chromium/chrome; \
    fi && \
    rm -rf /tmp/chromium.tar.xz /tmp/ungoogled-chromium* && \
    # Verify installation
    ls -la /opt/fingerprint-chromium/ && \
    echo "=== Fingerprint Chromium installed successfully ==="

# Copy package files
COPY backend/package*.json ./

# Install Node.js dependencies
RUN npm ci --omit=dev

# Reinstall sharp for glibc (Debian) platform
RUN npm uninstall sharp && \
    npm install --os=linux --cpu=x64 sharp

# Copy backend source code
COPY backend/ ./

# Install Python dependencies for scrapers
RUN echo "=== Installing Python dependencies ===" && \
    echo "Current directory: $(pwd)" && \
    echo "=== Core packages already installed via apt ===" && \
    python3 -c "import pandas, requests; print('✅ pandas and requests already available')" && \
    echo "=== Python dependencies setup completed ==="

# Create necessary directories
RUN mkdir -p /app/logs /tmp/fp-browser-profiles

# Create additional Python symlinks to ensure they're found
RUN ln -sf /usr/bin/python3 /usr/local/bin/python && \
    ln -sf /usr/bin/python3 /usr/local/bin/python3 && \
    ln -sf /usr/bin/pip3 /usr/local/bin/pip

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000
ENV PATH="/usr/local/bin:/usr/bin:$PATH"
ENV PYTHONPATH="/app"
ENV PYTHONUNBUFFERED=1
ENV DISPLAY=:99
ENV FINGERPRINT_CHROMIUM_PATH=/opt/fingerprint-chromium/chrome
ENV MAX_BROWSER_SESSIONS=5
ENV BROWSER_SESSION_TIMEOUT=1800000
ENV BROWSER_DATA_DIR=/tmp/fp-browser-profiles

# Final verification
RUN echo "=== Final environment verification ===" && \
    echo "Python version: $(python3 --version)" && \
    echo "Python path: $(which python3)" && \
    python3 -c "import pandas; print(f'✅ Pandas {pandas.__version__} is working')" && \
    python3 -c "import requests; print(f'✅ Requests {requests.__version__} is working')" && \
    echo "Chromium path: $FINGERPRINT_CHROMIUM_PATH" && \
    ls -la /opt/fingerprint-chromium/ | head -5 && \
    echo "=== Environment setup completed successfully ==="

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Start Xvfb and the Node.js server
CMD rm -f /tmp/.X99-lock /tmp/.X11-unix/X99 && \
    Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset & \
    sleep 2 && \
    npm start
