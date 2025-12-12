# Backend-only Node.js deployment with Python support
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies including Python
RUN echo "=== Installing system dependencies ===" && \
    apk update && \
    apk add --no-cache \
        curl \
        python3 \
        py3-pip \
        py3-pandas \
        py3-requests \
        python3-dev \
        gcc \
        musl-dev \
        linux-headers \
        make \
        g++ \
    && echo "=== Creating Python symlinks ===" && \
    ln -sf python3 /usr/bin/python && \
    ln -sf pip3 /usr/bin/pip && \
    echo "=== Verifying Python installation ===" && \
    python3 --version && \
    pip3 --version && \
    which python3 && \
    which pip3 && \
    echo "=== Checking pre-installed packages ===" && \
    python3 -c "import pandas; print(f'Pandas version: {pandas.__version__}')" && \
    python3 -c "import requests; print(f'Requests version: {requests.__version__}')" && \
    rm -rf /var/cache/apk/* && \
    echo "=== System dependencies installed successfully ==="

# Copy package files
COPY backend/package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Reinstall sharp for Alpine Linux (musl) platform
RUN rm -rf node_modules/sharp && \
    npm install --os=linux --libc=musl --cpu=x64 sharp

# Copy backend source code
COPY backend/ ./

# Install Python dependencies for scrapers
RUN echo "=== Installing Python dependencies ===" && \
    echo "Current directory: $(pwd)" && \
    echo "Files in current directory:" && \
    ls -la && \
    echo "=== Core packages already installed via apk ===" && \
    python3 -c "import pandas, requests; print('✅ pandas and requests already available')" && \
    echo "=== Python dependencies setup completed ==="

# Create necessary directories
RUN mkdir -p /app/logs

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

# Final verification of Python environment
RUN echo "=== Final Python environment verification ===" && \
    echo "Python version: $(python3 --version)" && \
    echo "Python path: $(which python3)" && \
    echo "Pip path: $(which pip3)" && \
    echo "PATH: $PATH" && \
    echo "=== Verifying required packages ===" && \
    python3 -c "import pandas; print(f'✅ Pandas {pandas.__version__} is working')" && \
    python3 -c "import requests; print(f'✅ Requests {requests.__version__} is working')" && \
    python3 -c "import json; print('✅ JSON module is working')" && \
    python3 -c "import sys; print(f'✅ Python executable: {sys.executable}')" && \
    echo "=== Environment setup completed successfully ==="

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Start the Node.js server
CMD ["npm", "start"] 