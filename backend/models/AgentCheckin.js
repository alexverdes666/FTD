const mongoose = require("mongoose");

/**
 * AgentCheckin Model
 *
 * Stores device info reported by the FTD Local Agent running on user machines.
 * The agent periodically POSTs its local device info (hostname, username, IPs, MACs)
 * directly to the backend. The device detection middleware then matches these
 * entries by public IP to enrich request logs with local device data.
 *
 * This avoids Chrome's Private Network Access restrictions entirely —
 * the agent phones home instead of the browser fetching from localhost.
 */
const agentCheckinSchema = new mongoose.Schema(
  {
    publicIP: {
      type: String,
      required: true,
      index: true,
    },
    hostname: String,
    username: String,
    platform: String,
    ips: {
      ipv4: [
        {
          address: String,
          interface: String,
          netmask: String,
          mac: String,
        },
      ],
      ipv6: [
        {
          address: String,
          interface: String,
          netmask: String,
          mac: String,
          scopeid: Number,
        },
      ],
    },
    agentVersion: String,
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Upsert by publicIP + hostname to keep one entry per machine
agentCheckinSchema.index({ publicIP: 1, hostname: 1 }, { unique: true });

// Auto-expire entries after 24 hours of no heartbeat
agentCheckinSchema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model("AgentCheckin", agentCheckinSchema);
