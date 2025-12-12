# Backend-only Dockerfile for Render deployment
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Update package index and install Python with better error handling
RUN echo "=== Installing Python and system dependencies ===" && \
    apk update && \
    apk add --no-cache \
        python3 \
        py3-pip \
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
    echo "=== Python installation completed successfully ==="

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --only=production

# Copy backend source code
COPY . .

# Copy Python scripts from parent directory (if they exist)
COPY ../agent_session_browser.py ./ 2>/dev/null || true
COPY ../gui_browser_session.py ./ 2>/dev/null || true

# Install Python dependencies for scrapers
RUN echo "=== Installing Python dependencies ===" && \
    python3 -m pip install --no-cache-dir --upgrade pip && \
    python3 -m pip install --no-cache-dir -r requirements.txt && \
    echo "=== Python dependencies installed successfully ==="

# Try to install parent directory requirements if it exists
RUN if [ -f "../requirements.txt" ]; then \
        echo "=== Installing parent directory Python requirements ===" && \
        python3 -m pip install --no-cache-dir -r ../requirements.txt; \
    fi

# Create additional symlinks to ensure Python is found in all common locations
RUN ln -sf /usr/bin/python3 /usr/local/bin/python && \
    ln -sf /usr/bin/python3 /usr/local/bin/python3 && \
    ln -sf /usr/bin/pip3 /usr/local/bin/pip

# Set environment variables
ENV PATH="/usr/local/bin:/usr/bin:$PATH"
ENV PYTHONPATH="/app"
ENV PYTHONUNBUFFERED=1

# Final verification of Python environment
RUN echo "=== Final Python environment verification ===" && \
    echo "Python version: $(python3 --version)" && \
    echo "Python path: $(which python3)" && \
    echo "Pip path: $(which pip3)" && \
    echo "PATH: $PATH" && \
    echo "Installed Python packages:" && \
    python3 -m pip list && \
    echo "=== Environment setup completed successfully ==="

# Expose port
EXPOSE 5000

# Start the application
CMD ["npm", "start"] 