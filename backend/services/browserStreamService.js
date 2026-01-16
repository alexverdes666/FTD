/**
 * Browser Stream Service
 * Provides real-time browser screenshot streaming via Socket.IO
 * for remote browser viewing and interaction
 */

const fingerprintBrowserService = require("./fingerprintBrowserService");

class BrowserStreamService {
  constructor() {
    this.streams = new Map(); // sessionId -> { interval, clients, fps }
    this.io = null;
    this._initialized = false;
  }

  /**
   * Initialize with Socket.IO instance
   */
  initialize(io) {
    if (this._initialized) return;
    this.io = io;
    this._initialized = true;
    console.log("🎥 BrowserStreamService initialized");
  }

  /**
   * Start streaming screenshots for a browser session
   */
  startStream(sessionId, userId, options = {}) {
    if (!this._initialized || !this.io) {
      throw new Error("BrowserStreamService not initialized");
    }

    const session = fingerprintBrowserService.getSession(sessionId);
    if (!session) {
      throw new Error("Browser session not found");
    }

    // Check if stream already exists
    if (this.streams.has(sessionId)) {
      const stream = this.streams.get(sessionId);
      if (!stream.clients.includes(userId)) {
        stream.clients.push(userId);
      }
      return {
        sessionId,
        room: `browser:${sessionId}`,
        fps: stream.fps,
        clientCount: stream.clients.length,
      };
    }

    const fps = options.fps || 5; // Default 5 FPS
    const quality = options.quality || 60;
    const intervalMs = Math.floor(1000 / fps);

    // Create stream room
    const roomName = `browser:${sessionId}`;

    // Start screenshot interval
    const interval = setInterval(async () => {
      try {
        const screenshot = await fingerprintBrowserService.takeScreenshot(sessionId, {
          type: "jpeg",
          quality,
          fullPage: false,
        });

        // Get current URL and title
        const session = fingerprintBrowserService.getSession(sessionId);
        let pageInfo = { url: "", title: "" };

        try {
          const content = await fingerprintBrowserService.getPageContent(sessionId);
          pageInfo = { url: content.url, title: content.title };
        } catch (err) {
          // Ignore - page might be navigating
        }

        // Emit to room
        this.io.to(roomName).emit("browser:frame", {
          sessionId,
          image: screenshot,
          url: pageInfo.url,
          title: pageInfo.title,
          timestamp: Date.now(),
        });
      } catch (error) {
        // Session might be closed
        if (error.message.includes("Session not found")) {
          this.stopStream(sessionId);
        }
      }
    }, intervalMs);

    // Store stream info
    this.streams.set(sessionId, {
      interval,
      clients: [userId],
      fps,
      quality,
      roomName,
      startedAt: new Date(),
    });

    console.log(`🎥 Started streaming for session ${sessionId} at ${fps} FPS`);

    return {
      sessionId,
      room: roomName,
      fps,
      clientCount: 1,
    };
  }

  /**
   * Stop streaming for a session
   */
  stopStream(sessionId) {
    const stream = this.streams.get(sessionId);
    if (!stream) return false;

    clearInterval(stream.interval);
    this.streams.delete(sessionId);

    // Notify clients
    if (this.io) {
      this.io.to(stream.roomName).emit("browser:stream_ended", {
        sessionId,
        reason: "Session closed",
      });
    }

    console.log(`🎥 Stopped streaming for session ${sessionId}`);
    return true;
  }

  /**
   * Remove client from stream
   */
  removeClient(sessionId, userId) {
    const stream = this.streams.get(sessionId);
    if (!stream) return;

    const index = stream.clients.indexOf(userId);
    if (index > -1) {
      stream.clients.splice(index, 1);
    }

    // If no more clients, stop the stream
    if (stream.clients.length === 0) {
      this.stopStream(sessionId);
    }
  }

  /**
   * Handle mouse event from client
   */
  async handleMouseEvent(sessionId, event) {
    const session = fingerprintBrowserService.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const { type, x, y, button } = event;
    const page = session.page;

    try {
      switch (type) {
        case "click":
          await page.mouse.click(x, y, { button: button || "left" });
          break;
        case "dblclick":
          await page.mouse.click(x, y, { button: "left", clickCount: 2 });
          break;
        case "mousedown":
          await page.mouse.down({ button: button || "left" });
          break;
        case "mouseup":
          await page.mouse.up({ button: button || "left" });
          break;
        case "mousemove":
          await page.mouse.move(x, y);
          break;
        case "contextmenu":
          await page.mouse.click(x, y, { button: "right" });
          break;
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle keyboard event from client
   */
  async handleKeyboardEvent(sessionId, event) {
    const session = fingerprintBrowserService.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const { type, key, text } = event;
    const page = session.page;

    try {
      switch (type) {
        case "keydown":
          await page.keyboard.down(key);
          break;
        case "keyup":
          await page.keyboard.up(key);
          break;
        case "keypress":
          await page.keyboard.press(key);
          break;
        case "type":
          await page.keyboard.type(text, { delay: 50 });
          break;
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle scroll event from client
   */
  async handleScrollEvent(sessionId, event) {
    const session = fingerprintBrowserService.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const { deltaX, deltaY, x, y } = event;
    const page = session.page;

    try {
      // Move mouse to position first if provided
      if (x !== undefined && y !== undefined) {
        await page.mouse.move(x, y);
      }

      // Execute scroll
      await page.mouse.wheel({ deltaX: deltaX || 0, deltaY: deltaY || 0 });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get stream status
   */
  getStreamStatus(sessionId) {
    const stream = this.streams.get(sessionId);
    if (!stream) return null;

    return {
      sessionId,
      room: stream.roomName,
      fps: stream.fps,
      quality: stream.quality,
      clientCount: stream.clients.length,
      startedAt: stream.startedAt,
      uptime: Date.now() - stream.startedAt.getTime(),
    };
  }

  /**
   * Get all active streams
   */
  getAllStreams() {
    const streams = [];
    for (const [sessionId, stream] of this.streams) {
      streams.push({
        sessionId,
        room: stream.roomName,
        fps: stream.fps,
        clientCount: stream.clients.length,
        startedAt: stream.startedAt,
      });
    }
    return streams;
  }

  /**
   * Shutdown service
   */
  shutdown() {
    for (const [sessionId] of this.streams) {
      this.stopStream(sessionId);
    }
    this._initialized = false;
    console.log("🎥 BrowserStreamService shutdown complete");
  }
}

// Export singleton
const service = new BrowserStreamService();
module.exports = service;
