#!/bin/bash

# Fingerprint Chromium Setup Script for Render
# Downloads and installs fingerprint-chromium for headless browser automation

set -e

CHROMIUM_VERSION="142.0.7444.175"
DOWNLOAD_URL="https://github.com/adryfish/fingerprint-chromium/releases/download/${CHROMIUM_VERSION}/ungoogled-chromium-${CHROMIUM_VERSION}-1-x86_64_linux.tar.xz"
INSTALL_DIR="/opt/fingerprint-chromium"
TEMP_DIR="/tmp/fp-chromium-setup"

echo "🔧 Setting up Fingerprint Chromium ${CHROMIUM_VERSION}..."

# Create directories
mkdir -p "$TEMP_DIR"
mkdir -p "$INSTALL_DIR"

# Check if already installed
if [ -f "$INSTALL_DIR/chrome" ]; then
    INSTALLED_VERSION=$("$INSTALL_DIR/chrome" --version 2>/dev/null | grep -oP '\d+\.\d+\.\d+\.\d+' || echo "unknown")
    if [ "$INSTALLED_VERSION" = "$CHROMIUM_VERSION" ]; then
        echo "✅ Fingerprint Chromium ${CHROMIUM_VERSION} already installed"
        exit 0
    fi
    echo "🔄 Updating from version ${INSTALLED_VERSION} to ${CHROMIUM_VERSION}..."
fi

# Download
echo "📥 Downloading Fingerprint Chromium..."
curl -L -o "$TEMP_DIR/chromium.tar.xz" "$DOWNLOAD_URL"

# Extract
echo "📦 Extracting..."
cd "$TEMP_DIR"
tar -xf chromium.tar.xz

# Find extracted directory (usually named ungoogled-chromium-*)
EXTRACTED_DIR=$(find . -maxdepth 1 -type d -name "ungoogled-chromium*" | head -1)

if [ -z "$EXTRACTED_DIR" ]; then
    # Try alternative extraction layout
    EXTRACTED_DIR="."
fi

# Move to install directory
echo "📁 Installing to ${INSTALL_DIR}..."
rm -rf "$INSTALL_DIR"/*
cp -r "$EXTRACTED_DIR"/* "$INSTALL_DIR/" 2>/dev/null || cp -r ./* "$INSTALL_DIR/"

# Make chrome executable
chmod +x "$INSTALL_DIR/chrome" 2>/dev/null || true
chmod +x "$INSTALL_DIR/chromium" 2>/dev/null || true

# Create symlink for easier access
if [ -f "$INSTALL_DIR/chromium" ] && [ ! -f "$INSTALL_DIR/chrome" ]; then
    ln -sf "$INSTALL_DIR/chromium" "$INSTALL_DIR/chrome"
fi

# Cleanup
echo "🧹 Cleaning up..."
rm -rf "$TEMP_DIR"

# Verify installation
if [ -f "$INSTALL_DIR/chrome" ]; then
    echo "✅ Fingerprint Chromium installed successfully!"
    echo "📍 Location: $INSTALL_DIR/chrome"
    "$INSTALL_DIR/chrome" --version 2>/dev/null || echo "Note: Version check requires display"
else
    echo "❌ Installation failed - chrome binary not found"
    ls -la "$INSTALL_DIR/"
    exit 1
fi

echo "🎉 Setup complete!"
