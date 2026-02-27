import io from "socket.io-client";
import api from "./api";
import { store } from "../store/store";

class AmiAgentService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
  }

  connect() {
    if (this.socket && (this.socket.connected || this.socket.connecting)) {
      return;
    }

    const state = store.getState();
    const token = state.auth.token;

    if (!token) {
      console.error("No auth token available for AMI agent connection");
      return;
    }

    let socketUrl;
    if (import.meta.env.VITE_API_URL) {
      socketUrl = import.meta.env.VITE_API_URL
        .replace("/api", "")
        .replace("https://", "wss://")
        .replace("http://", "ws://");
    } else {
      socketUrl = "http://localhost:5000";
    }

    this.socket = io(socketUrl, {
      auth: { token },
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 3000,
    });

    this.socket.on("connect", () => {
      this.isConnected = true;
      // Join the AMI agents room
      this.socket.emit("join_room", "admin:ami-agents", (response) => {
        if (response?.success) {
          console.log("Joined AMI agents room");
        }
      });
    });

    this.socket.on("disconnect", () => {
      this.isConnected = false;
    });

    this.socket.on("ami_agent_states", (data) => {
      this._emit("agentStates", data);
    });

    this.socket.on("ami_call_history", (data) => {
      this._emit("callHistory", data);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.emit("leave_room", "admin:ami-agents");
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  _emit(event, data) {
    if (this.listeners.has(event)) {
      for (const cb of this.listeners.get(event)) {
        cb(data);
      }
    }
  }

  // REST API - get current states (initial load)
  async getAgentStates() {
    const response = await api.get("/ami-agents");
    return response.data;
  }

  // REST API - get connection status
  async getStatus() {
    const response = await api.get("/ami-agents/status");
    return response.data;
  }

  // REST API - force reconnect
  async reconnect() {
    const response = await api.post("/ami-agents/reconnect");
    return response.data;
  }
}

const amiAgentService = new AmiAgentService();
export default amiAgentService;
