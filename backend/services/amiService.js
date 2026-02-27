const net = require("net");
const EventEmitter = require("events");
const mysql = require("mysql2/promise");
const User = require("../models/User");
const Lead = require("../models/Lead");

// SIP peer names that are trunks/gateways, NOT agents
const TRUNK_PATTERNS = [
  /^ev\d*/i,
  /^eb\d*/i,
  /^gsm/i,
  /^cloudcart/i,
];

function isTrunk(name) {
  return TRUNK_PATTERNS.some((p) => p.test(name));
}

class AmiService extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.io = null;
    this.connected = false;
    this.authenticated = false;
    this.peers = new Map(); // objectName -> { state, ip, port, ... }
    this.activeChannels = new Map(); // channel -> { peer, state, callerIdNum, ... }
    this.agentMap = new Map(); // sipExtension -> { fullName, fourDigitCode, _id }
    this.agentMapInterval = null;
    this.leadCache = new Map(); // phone -> { firstName, lastName, newEmail, newPhone, _id, ts }
    this.leadCacheTTL = 30000; // 30s cache per phone lookup
    this.pendingLeadLookups = new Set(); // avoid duplicate concurrent lookups
    this.callHistory = []; // Recent CDR records from the PBX
    this.maxHistorySize = 1000;
    this.cdrPool = null;
    this.cdrPollInterval = null;
    this.lastCdrTimestamp = null; // Track last fetched CDR to get only new ones
    this.buffer = "";
    this.bannerReceived = false;
    this.reconnectTimer = null;
    this.reconnectInterval = 5000;
    this.pingInterval = null;
    this.pollInterval = null;

    // AMI credentials
    this.host = "188.126.10.151";
    this.port = 5038;
    this.username = "evolvs";
    this.password = "evolvs@1";

    // MySQL CDR database
    this.cdrDbConfig = {
      host: "188.126.10.151",
      port: 5039,
      user: "evlovs",
      password: "XxUzALcqynY8PXqd",
      connectTimeout: 10000,
    };
  }

  initialize(io) {
    this.io = io;
    this._loadAgentMap();
    // Refresh agent map every 60s
    this.agentMapInterval = setInterval(() => this._loadAgentMap(), 60000);
    this.connect();
    this._initCdrDatabase();
    console.log("✅ AMI Service initialized");
  }

  async _initCdrDatabase() {
    try {
      // First, discover the database name by listing databases
      const conn = await mysql.createConnection(this.cdrDbConfig);
      const [databases] = await conn.query("SHOW DATABASES");
      console.log("📊 CDR MySQL databases:", databases.map((d) => Object.values(d)[0]).join(", "));

      // Look for a database that contains "cdr" or "asterisk"
      const dbNames = databases.map((d) => Object.values(d)[0]);
      let cdrDbName = dbNames.find((n) => n.toLowerCase().includes("cdr"))
        || dbNames.find((n) => n.toLowerCase().includes("asterisk"))
        || null;

      if (!cdrDbName) {
        // Try each database and look for cdr_pbx table
        for (const dbName of dbNames) {
          if (["information_schema", "mysql", "performance_schema", "sys"].includes(dbName)) continue;
          try {
            const [tables] = await conn.query(`SHOW TABLES FROM \`${dbName}\` LIKE '%cdr%'`);
            if (tables.length > 0) {
              cdrDbName = dbName;
              break;
            }
          } catch (e) { /* skip */ }
        }
      }

      if (!cdrDbName) {
        console.warn("⚠️ CDR: Could not find CDR database");
        await conn.end();
        return;
      }

      console.log(`📊 CDR: Using database "${cdrDbName}"`);
      await conn.end();

      // Create pool with the discovered database
      this.cdrPool = mysql.createPool({
        ...this.cdrDbConfig,
        database: cdrDbName,
        waitForConnections: true,
        connectionLimit: 3,
      });

      // Verify the cdr_pbx table exists
      const [tables] = await this.cdrPool.query("SHOW TABLES LIKE 'cdr_pbx'");
      if (tables.length === 0) {
        // Try to find the actual CDR table name
        const [allTables] = await this.cdrPool.query("SHOW TABLES LIKE '%cdr%'");
        if (allTables.length > 0) {
          this.cdrTableName = Object.values(allTables[0])[0];
          console.log(`📊 CDR: Found table "${this.cdrTableName}" (cdr_pbx not found)`);
        } else {
          console.warn("⚠️ CDR: No CDR table found");
          return;
        }
      } else {
        this.cdrTableName = "cdr_pbx";
      }

      // Check table structure
      const [columns] = await this.cdrPool.query(`DESCRIBE \`${this.cdrTableName}\``);
      console.log(`📊 CDR: Table "${this.cdrTableName}" columns:`, columns.map((c) => c.Field).join(", "));

      // Load initial history
      await this._loadCdrHistory();

      // Poll for new CDRs every 30s
      this.cdrPollInterval = setInterval(() => this._loadNewCdrs(), 30000);

    } catch (error) {
      console.error("❌ CDR MySQL connection failed:", error.message);
    }
  }

  async _loadCdrHistory() {
    if (!this.cdrPool || !this.cdrTableName) return;

    try {
      // Load CDR records that involve agent extensions (short src or dst = extension)
      const [rows] = await this.cdrPool.query(
        `SELECT * FROM \`${this.cdrTableName}\`
         WHERE (dst REGEXP '^[0-9]{2,4}$' AND call_type = 'incoming')
            OR (src REGEXP '^[0-9]{2,4}$' AND call_type = 'outgoing')
         ORDER BY calldate DESC LIMIT 500`
      );

      if (rows.length === 0) {
        console.log("📊 CDR: No records found");
        return;
      }

      console.log(`📊 CDR: Loaded ${rows.length} historical records`);

      // Store last timestamp for incremental polling
      if (rows.length > 0) {
        this.lastCdrTimestamp = rows[0].calldate;
      }

      // Convert MySQL CDR rows to our format
      const records = [];
      for (const row of rows) {
        const record = await this._cdrRowToRecord(row);
        if (record) records.push(record);
      }

      // Merge with any existing event-tracked history (event-tracked at front)
      const eventTracked = this.callHistory.filter((h) => h._source === "event");
      this.callHistory = [...eventTracked, ...records].slice(0, this.maxHistorySize);

      // Broadcast
      if (this.io) {
        this.io.to("admin:ami-agents").emit("ami_call_history", this.callHistory);
      }
    } catch (error) {
      console.error("❌ CDR: Failed to load history:", error.message);
    }
  }

  async _loadNewCdrs() {
    if (!this.cdrPool || !this.cdrTableName || !this.lastCdrTimestamp) return;

    try {
      const [rows] = await this.cdrPool.query(
        `SELECT * FROM \`${this.cdrTableName}\`
         WHERE calldate > ?
           AND ((dst REGEXP '^[0-9]{2,4}$' AND call_type = 'incoming')
             OR (src REGEXP '^[0-9]{2,4}$' AND call_type = 'outgoing'))
         ORDER BY calldate DESC LIMIT 50`,
        [this.lastCdrTimestamp]
      );

      if (rows.length === 0) return;

      this.lastCdrTimestamp = rows[0].calldate;

      const newRecords = [];
      for (const row of rows) {
        const record = await this._cdrRowToRecord(row);
        if (record) newRecords.push(record);
      }

      // Add to front (most recent first), remove duplicates by startTime+extension
      const existing = new Set(this.callHistory.map((h) => `${h.startTime}|${h.extension}`));
      const unique = newRecords.filter((r) => !existing.has(`${r.startTime}|${r.extension}`));

      if (unique.length > 0) {
        this.callHistory = [...unique, ...this.callHistory].slice(0, this.maxHistorySize);
        if (this.io) {
          this.io.to("admin:ami-agents").emit("ami_call_history", this.callHistory);
        }
        console.log(`📊 CDR: Added ${unique.length} new records`);
      }
    } catch (error) {
      // Silently retry next interval
    }
  }

  async _cdrRowToRecord(row) {
    // Custom PBX CDR table structure:
    //   Incoming: src = phone number, dst = agent extension
    //   Outgoing: src = agent extension, dst = phone number
    const src = (row.src || "").toString();
    const dst = (row.dst || "").toString();
    const callType = (row.call_type || "").toLowerCase();

    // Determine agent extension and phone number based on call type
    let agentExt = null;
    let phone = "";

    if (callType === "outgoing") {
      // src is the agent extension, dst is the phone
      if (/^\d{2,4}$/.test(src) && !isTrunk(src)) {
        agentExt = src;
        phone = dst;
      }
    } else {
      // incoming/local: dst is the agent extension, src is the phone
      if (/^\d{2,4}$/.test(dst) && !isTrunk(dst)) {
        agentExt = dst;
        phone = src;
      }
    }

    if (!agentExt) return null; // Not an agent call

    const agentInfo = this.agentMap.get(agentExt);

    // Lead lookup (cached)
    let lead = null;
    if (phone) {
      lead = await this._lookupLead(phone);
    }

    return {
      _source: "cdr_db",
      extension: agentExt,
      agentName: agentInfo?.fullName || agentExt,
      src,
      dst,
      phone,
      callType,
      disposition: row.disposition || "",
      duration: parseInt(row.duration, 10) || 0,
      billsec: parseInt(row.billsec, 10) || 0,
      startTime: row.calldate ? new Date(row.calldate).toISOString() : "",
      endTime: row.timestamp_end
        ? new Date(parseInt(row.timestamp_end, 10) * 1000).toISOString()
        : row.calldate
          ? new Date(new Date(row.calldate).getTime() + (parseInt(row.duration, 10) || 0) * 1000).toISOString()
          : "",
      leadName: lead?.fullName || null,
      leadEmail: lead?.newEmail || null,
      leadId: lead?._id || null,
      leadCountry: lead?.country || null,
      timestamp: row.calldate ? new Date(row.calldate).toISOString() : "",
    };
  }

  async _loadAgentMap() {
    try {
      const agents = await User.find(
        { role: "agent", fourDigitCode: { $exists: true, $ne: null } },
        "fullName fourDigitCode"
      ).lean();

      this.agentMap.clear();
      for (const agent of agents) {
        if (!agent.fourDigitCode) continue;
        // fourDigitCode "0602" -> SIP extension "602"
        const sipExt = agent.fourDigitCode.replace(/^0+/, "") || agent.fourDigitCode;
        this.agentMap.set(sipExt, {
          fullName: agent.fullName || "",
          fourDigitCode: agent.fourDigitCode,
          _id: agent._id.toString(),
        });
      }
      console.log(`🔌 AMI: Loaded ${this.agentMap.size} agent mappings`);
    } catch (error) {
      console.error("❌ AMI: Failed to load agent map:", error.message);
    }
  }

  async _lookupLead(phoneNumber) {
    if (!phoneNumber) return null;

    // Normalize: strip spaces, keep + and digits
    const normalized = phoneNumber.replace(/[^+\d]/g, "");
    if (normalized.length < 5) return null;

    // Check cache
    const cached = this.leadCache.get(normalized);
    if (cached && Date.now() - cached.ts < this.leadCacheTTL) {
      return cached.lead;
    }

    // Avoid duplicate concurrent lookups for the same number
    if (this.pendingLeadLookups.has(normalized)) return cached?.lead || null;
    this.pendingLeadLookups.add(normalized);

    try {
      // Search by phone - try exact, then partial (last digits)
      let lead = await Lead.findOne(
        { newPhone: { $regex: normalized.replace(/^\+/, "\\+?"), $options: "i" } },
        "firstName lastName newEmail newPhone country status"
      ).lean();

      // If not found with full number, try matching last 10 digits
      if (!lead && normalized.length >= 10) {
        const lastDigits = normalized.slice(-10);
        lead = await Lead.findOne(
          { newPhone: { $regex: lastDigits + "$", $options: "i" } },
          "firstName lastName newEmail newPhone country status"
        ).lean();
      }

      const result = lead
        ? {
            _id: lead._id.toString(),
            firstName: lead.firstName,
            lastName: lead.lastName,
            fullName: `${lead.firstName} ${lead.lastName}`.trim(),
            newEmail: lead.newEmail,
            newPhone: lead.newPhone,
            country: lead.country,
            status: lead.status,
          }
        : null;

      this.leadCache.set(normalized, { lead: result, ts: Date.now() });
      return result;
    } catch (error) {
      // Don't spam logs for lookup failures
      return null;
    } finally {
      this.pendingLeadLookups.delete(normalized);
    }
  }

  // Extract phone and email from a caller ID alias string
  // e.g. "john@example.com +447535964504" or "john@mail.com447535964504"
  _parseAlias(callerIdName) {
    if (!callerIdName) return { phone: null, email: null };
    const emailMatch = callerIdName.match(/[\w.+-]+@[\w.-]+\.\w+/);
    const phoneMatch = callerIdName.match(/\+?\d[\d\s-]{6,}/);
    return {
      email: emailMatch ? emailMatch[0] : null,
      phone: phoneMatch ? phoneMatch[0].replace(/[\s-]/g, "") : null,
    };
  }

  async _lookupLeadByEmail(email) {
    if (!email) return null;
    const normalized = email.toLowerCase().trim();

    const cacheKey = `email:${normalized}`;
    const cached = this.leadCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < this.leadCacheTTL) {
      return cached.lead;
    }

    try {
      const lead = await Lead.findOne(
        { newEmail: { $regex: `^${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
        "firstName lastName newEmail newPhone country status"
      ).lean();

      const result = lead
        ? {
            _id: lead._id.toString(),
            firstName: lead.firstName,
            lastName: lead.lastName,
            fullName: `${lead.firstName} ${lead.lastName}`.trim(),
            newEmail: lead.newEmail,
            newPhone: lead.newPhone,
            country: lead.country,
            status: lead.status,
          }
        : null;

      this.leadCache.set(cacheKey, { lead: result, ts: Date.now() });
      return result;
    } catch (error) {
      return null;
    }
  }

  // Look up leads for all peers currently in a call and broadcast
  async _enrichAndBroadcast() {
    if (!this.io) return;

    const lookups = [];
    for (const [name, peer] of this.peers) {
      if ((peer.state === "talking" || peer.state === "calling") && (peer.talkingTo || peer.callerIdNum || peer.callerIdName)) {
        lookups.push(
          (async () => {
            const phone = peer.talkingTo || peer.callerIdNum;
            // First try direct phone lookup
            let lead = phone ? await this._lookupLead(phone) : null;

            // If no lead found, parse the alias (callerIdName may contain email+phone)
            if (!lead && peer.callerIdName) {
              const alias = this._parseAlias(peer.callerIdName);
              // Try email from alias
              if (alias.email) {
                lead = await this._lookupLeadByEmail(alias.email);
              }
              // Try phone from alias if still not found
              if (!lead && alias.phone) {
                lead = await this._lookupLead(alias.phone);
              }
            }

            peer.lead = lead;
          })()
        );
      } else {
        peer.lead = null;
      }
    }

    if (lookups.length > 0) {
      await Promise.all(lookups);
    }

    const states = this.getAgentStates();
    this.io.to("admin:ami-agents").emit("ami_agent_states", states);
  }

  connect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
    }

    this.socket = new net.Socket();
    this.buffer = "";
    this.bannerReceived = false;
    this.connected = false;
    this.authenticated = false;

    this.socket.connect(this.port, this.host, () => {
      console.log(`🔌 AMI: Connected to ${this.host}:${this.port}`);
      this.connected = true;
    });

    this.socket.on("data", (data) => {
      this.buffer += data.toString();
      this._processBuffer();
    });

    this.socket.on("close", () => {
      console.log("🔌 AMI: Connection closed");
      this.connected = false;
      this.authenticated = false;
      this._clearTimers();
      this._scheduleReconnect();
    });

    this.socket.on("error", (err) => {
      console.error("❌ AMI: Socket error:", err.message);
      this.connected = false;
      this.authenticated = false;
    });

    this.socket.on("timeout", () => {
      console.warn("⚠️ AMI: Socket timeout");
      this.socket.destroy();
    });

    this.socket.setTimeout(60000);
  }

  _processBuffer() {
    // Handle the welcome banner first (single line ending with \r\n)
    if (!this.bannerReceived) {
      const bannerEnd = this.buffer.indexOf("\r\n");
      if (bannerEnd === -1) return; // incomplete banner
      const banner = this.buffer.substring(0, bannerEnd);
      this.buffer = this.buffer.substring(bannerEnd + 2);
      this.bannerReceived = true;
      console.log(`🔌 AMI: Banner: ${banner}`);
      this._login();
    }

    // Process complete AMI messages (separated by \r\n\r\n)
    while (this.buffer.includes("\r\n\r\n")) {
      const idx = this.buffer.indexOf("\r\n\r\n");
      const msg = this.buffer.substring(0, idx);
      this.buffer = this.buffer.substring(idx + 4);
      if (msg.trim()) {
        this._handleMessage(msg.trim());
      }
    }
  }

  _handleMessage(rawMsg) {
    const parsed = {};
    const lines = rawMsg.split("\r\n");
    for (const line of lines) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > -1) {
        const key = line.substring(0, colonIdx).trim();
        const value = line.substring(colonIdx + 1).trim();
        parsed[key] = value;
      }
    }

    // Handle login response
    if (parsed["Response"] === "Success" && parsed["Message"] === "Authentication accepted") {
      console.log("✅ AMI: Authenticated successfully");
      this.authenticated = true;
      this._startPing();
      this._requestInitialState();
      return;
    }

    if (parsed["Response"] === "Error" && !parsed["ActionID"]) {
      console.error("❌ AMI: Error:", parsed["Message"]);
      return;
    }

    // Handle events
    if (parsed["Event"]) {
      this._handleEvent(parsed);
    }
  }

  _handleEvent(event) {
    const eventName = event["Event"];

    switch (eventName) {
      // SIP peer list response
      case "PeerEntry":
        this._handlePeerEntry(event);
        break;
      case "PeerlistComplete":
        this._broadcastAllStates();
        break;

      // Peer registration changes
      case "PeerStatus":
        this._handlePeerStatus(event);
        break;

      // Channel lifecycle - tracks active calls
      case "Newchannel":
        this._handleNewChannel(event);
        break;
      case "Newstate":
        this._handleNewState(event);
        break;
      case "Hangup":
        this._handleHangup(event);
        break;

      // Dial events
      case "DialBegin":
        this._handleDialBegin(event);
        break;
      case "DialEnd":
        this._handleDialEnd(event);
        break;

      // Bridge events (two channels connected)
      case "BridgeEnter":
        this._handleBridgeEnter(event);
        break;

      // Channel state changes
      case "DeviceStateChange":
        this._handleDeviceStateChange(event);
        break;

      // Active channel list response
      case "CoreShowChannel":
        this._handleCoreShowChannel(event);
        break;
      case "CoreShowChannelsComplete":
        this._resolveStatesFromChannels();
        this._broadcastAllStates();
        break;

      // CDR events from cdr_manager module
      case "Cdr":
        this._handleCdrEvent(event);
        break;

      default:
        break;
    }
  }

  // ===== Initial state loading =====

  _requestInitialState() {
    // Get all SIP peers
    this._sendAction({ Action: "SIPpeers", ActionID: "init_peers" });

    // Get all active channels after a short delay (peers need to load first)
    setTimeout(() => {
      this._sendAction({ Action: "CoreShowChannels", ActionID: "init_channels" });
    }, 2000);

    // Start periodic polling for channel state (every 10s)
    this._startPolling();
  }

  // ===== SIP Peer handling =====

  _handlePeerEntry(event) {
    const name = event["ObjectName"] || "";
    if (!name || isTrunk(name)) return;

    const statusStr = event["Status"] || "UNKNOWN";
    const ip = event["IPaddress"] || "-none-";

    let registrationState = "offline";
    if (statusStr.startsWith("OK")) {
      registrationState = "online";
    } else if (statusStr === "UNKNOWN" || ip === "-none-") {
      registrationState = "offline";
    } else if (statusStr === "UNREACHABLE") {
      registrationState = "offline";
    }

    const existing = this.peers.get(name);
    this.peers.set(name, {
      ...(existing || {}),
      name,
      ip: ip === "-none-" ? null : ip,
      port: event["IPport"] || "0",
      registrationState,
      state: registrationState === "offline" ? "unavailable" : (existing?.state || "free"),
      callerIdNum: existing?.callerIdNum || "",
      callerIdName: existing?.callerIdName || "",
      channel: existing?.channel || "",
      talkingTo: existing?.talkingTo || "",
      timestamp: new Date().toISOString(),
    });
  }

  _handlePeerStatus(event) {
    // event.Peer = "SIP/602"
    const peerStr = event["Peer"] || "";
    const name = peerStr.replace(/^SIP\//i, "");
    if (!name || isTrunk(name)) return;

    const peerStatus = event["PeerStatus"] || "";

    const existing = this.peers.get(name) || { name, state: "free" };

    if (peerStatus === "Registered") {
      existing.registrationState = "online";
      existing.ip = (event["Address"] || "").split(":")[0] || existing.ip;
      if (existing.state === "unavailable") {
        existing.state = "free";
      }
    } else if (peerStatus === "Unregistered" || peerStatus === "Unreachable") {
      existing.registrationState = "offline";
      existing.state = "unavailable";
      existing.callerIdNum = "";
      existing.callerIdName = "";
      existing.channel = "";
      existing.talkingTo = "";
    }

    existing.timestamp = new Date().toISOString();
    this.peers.set(name, existing);
    this._broadcastAllStates();
  }

  // ===== Channel/Call event handling =====

  _extractPeerFromChannel(channel) {
    // Channel = "SIP/602-00001234" -> "602"
    if (!channel) return null;
    const match = channel.match(/^SIP\/([^-]+)/i);
    if (match) {
      const name = match[1];
      return isTrunk(name) ? null : name;
    }
    return null;
  }

  _handleNewChannel(event) {
    const channel = event["Channel"] || "";
    const peerName = this._extractPeerFromChannel(channel);

    this.activeChannels.set(channel, {
      peer: peerName,
      state: event["ChannelStateDesc"] || "Down",
      callerIdNum: event["CallerIDNum"] || "",
      callerIdName: event["CallerIDName"] || "",
      connectedLineNum: event["ConnectedLineNum"] || "",
      connectedLineName: event["ConnectedLineName"] || "",
      uniqueId: event["Uniqueid"] || "",
      linkedId: event["Linkedid"] || "",
    });

    if (peerName && this.peers.has(peerName)) {
      const peer = this.peers.get(peerName);
      if (peer.registrationState !== "offline") {
        const wasIdle = peer.state === "free" || peer.state === "unavailable";
        peer.state = "calling";
        peer.channel = channel;
        peer.callerIdNum = event["CallerIDNum"] || "";
        peer.callerIdName = event["CallerIDName"] || "";
        if (wasIdle) peer.callStartTime = new Date().toISOString();
        peer.timestamp = new Date().toISOString();
        this.peers.set(peerName, peer);
        this._broadcastAllStates();
      }
    }
  }

  _handleNewState(event) {
    const channel = event["Channel"] || "";
    const stateDesc = (event["ChannelStateDesc"] || "").toLowerCase();
    const peerName = this._extractPeerFromChannel(channel);

    // Update channel
    if (this.activeChannels.has(channel)) {
      const ch = this.activeChannels.get(channel);
      ch.state = event["ChannelStateDesc"] || ch.state;
      ch.connectedLineNum = event["ConnectedLineNum"] || ch.connectedLineNum;
      ch.connectedLineName = event["ConnectedLineName"] || ch.connectedLineName;
      this.activeChannels.set(channel, ch);
    }

    if (peerName && this.peers.has(peerName)) {
      const peer = this.peers.get(peerName);
      if (peer.registrationState === "offline") return;

      if (stateDesc === "up") {
        peer.state = "talking";
        peer.talkingTo = event["ConnectedLineNum"] || event["CallerIDNum"] || "";
        if (!peer.callStartTime) peer.callStartTime = new Date().toISOString();
      } else if (stateDesc === "ringing" || stateDesc === "ring") {
        peer.state = "calling";
        if (!peer.callStartTime) peer.callStartTime = new Date().toISOString();
      }

      peer.channel = channel;
      peer.callerIdNum = event["ConnectedLineNum"] || event["CallerIDNum"] || peer.callerIdNum;
      peer.callerIdName = event["ConnectedLineName"] || event["CallerIDName"] || peer.callerIdName;
      peer.timestamp = new Date().toISOString();
      this.peers.set(peerName, peer);
      this._broadcastAllStates();
    }
  }

  _handleHangup(event) {
    const channel = event["Channel"] || "";
    const peerName = this._extractPeerFromChannel(channel);

    this.activeChannels.delete(channel);

    if (peerName && this.peers.has(peerName)) {
      const peer = this.peers.get(peerName);

      // Check if this peer has any other active channels
      let hasOtherChannels = false;
      for (const [ch, data] of this.activeChannels) {
        if (data.peer === peerName) {
          hasOtherChannels = true;
          break;
        }
      }

      if (!hasOtherChannels && peer.registrationState !== "offline") {
        // Record call history entry before clearing peer state
        const phone = peer.talkingTo || peer.callerIdNum || "";
        if (peer.callStartTime && (peer.state === "talking" || peer.state === "calling")) {
          this._recordCallFromEvent(peerName, peer, event);
        }

        peer.state = "free";
        peer.callerIdNum = "";
        peer.callerIdName = "";
        peer.channel = "";
        peer.talkingTo = "";
        peer.callStartTime = null;
        peer.lead = null;
      }

      peer.timestamp = new Date().toISOString();
      this.peers.set(peerName, peer);
      this._broadcastAllStates();
    }
  }

  // Build a call history record from our own tracked channel events
  async _recordCallFromEvent(peerName, peer, hangupEvent) {
    const endTime = new Date().toISOString();
    const startTime = peer.callStartTime;
    const durationSec = Math.round((Date.now() - new Date(startTime).getTime()) / 1000);
    const phone = peer.talkingTo || peer.callerIdNum || "";
    const cause = hangupEvent["Cause"] || "";
    const causeTxt = (hangupEvent["Cause-txt"] || "").toUpperCase();

    // Determine disposition from hangup cause
    let disposition = "ANSWERED";
    if (peer.state === "calling") {
      // Never reached "talking" state
      if (causeTxt.includes("BUSY")) disposition = "BUSY";
      else if (causeTxt.includes("CONGESTION")) disposition = "CONGESTION";
      else disposition = "NO ANSWER";
    }

    // Billable seconds: only if the call was actually answered (talking state)
    const billsec = peer.state === "talking" ? durationSec : 0;

    const agentInfo = this.agentMap.get(peerName);

    // Lead lookup
    let lead = peer.lead;
    if (!lead && phone) {
      lead = await this._lookupLead(phone);
      if (!lead && peer.callerIdName) {
        const alias = this._parseAlias(peer.callerIdName);
        if (alias.email) lead = await this._lookupLeadByEmail(alias.email);
        if (!lead && alias.phone) lead = await this._lookupLead(alias.phone);
      }
    }

    const record = {
      _source: "event",
      extension: peerName,
      agentName: agentInfo?.fullName || peerName,
      src: peerName,
      dst: phone,
      phone,
      disposition,
      duration: durationSec,
      billsec,
      startTime,
      answerTime: peer.state === "talking" ? startTime : "",
      endTime,
      leadName: lead?.fullName || null,
      leadEmail: lead?.newEmail || null,
      leadId: lead?._id || null,
      leadCountry: lead?.country || null,
      timestamp: endTime,
    };

    this.callHistory.unshift(record);
    if (this.callHistory.length > this.maxHistorySize) {
      this.callHistory = this.callHistory.slice(0, this.maxHistorySize);
    }

    // Broadcast updated history
    if (this.io) {
      this.io.to("admin:ami-agents").emit("ami_call_history", this.callHistory);
    }
  }

  _handleDialBegin(event) {
    const destChannel = event["DestChannel"] || "";
    const destPeer = this._extractPeerFromChannel(destChannel);

    if (destPeer && this.peers.has(destPeer)) {
      const peer = this.peers.get(destPeer);
      if (peer.registrationState !== "offline") {
        peer.state = "calling";
        peer.channel = destChannel;
        peer.callerIdNum = event["CallerIDNum"] || event["ConnectedLineNum"] || "";
        peer.callerIdName = event["CallerIDName"] || event["ConnectedLineName"] || "";
        peer.timestamp = new Date().toISOString();
        this.peers.set(destPeer, peer);
        this._broadcastAllStates();
      }
    }

    // Also update the source peer
    const srcChannel = event["Channel"] || "";
    const srcPeer = this._extractPeerFromChannel(srcChannel);
    if (srcPeer && this.peers.has(srcPeer)) {
      const peer = this.peers.get(srcPeer);
      if (peer.registrationState !== "offline") {
        peer.state = "calling";
        peer.channel = srcChannel;
        peer.callerIdNum = event["DestCallerIDNum"] || "";
        peer.callerIdName = event["DestCallerIDName"] || "";
        peer.timestamp = new Date().toISOString();
        this.peers.set(srcPeer, peer);
        this._broadcastAllStates();
      }
    }
  }

  _handleDialEnd(event) {
    const dialStatus = (event["DialStatus"] || "").toUpperCase();
    if (dialStatus === "ANSWER") {
      // Call was answered - will transition to "talking" via Newstate/BridgeEnter
      return;
    }

    // Call was not answered (BUSY, NOANSWER, CANCEL, etc.)
    const destChannel = event["DestChannel"] || "";
    const destPeer = this._extractPeerFromChannel(destChannel);
    if (destPeer && this.peers.has(destPeer)) {
      const peer = this.peers.get(destPeer);
      // Check if peer has other active channels before setting free
      let hasOtherChannels = false;
      for (const [ch, data] of this.activeChannels) {
        if (data.peer === destPeer && ch !== destChannel) {
          hasOtherChannels = true;
          break;
        }
      }
      if (!hasOtherChannels && peer.registrationState !== "offline") {
        peer.state = "free";
        peer.callerIdNum = "";
        peer.callerIdName = "";
        peer.channel = "";
        peer.talkingTo = "";
        peer.timestamp = new Date().toISOString();
        this.peers.set(destPeer, peer);
        this._broadcastAllStates();
      }
    }
  }

  _handleBridgeEnter(event) {
    const channel = event["Channel"] || "";
    const peerName = this._extractPeerFromChannel(channel);

    if (peerName && this.peers.has(peerName)) {
      const peer = this.peers.get(peerName);
      if (peer.registrationState !== "offline") {
        peer.state = "talking";
        peer.channel = channel;
        peer.callerIdNum = event["ConnectedLineNum"] || event["CallerIDNum"] || peer.callerIdNum;
        peer.callerIdName = event["ConnectedLineName"] || event["CallerIDName"] || peer.callerIdName;
        peer.talkingTo = event["ConnectedLineNum"] || "";
        peer.timestamp = new Date().toISOString();
        this.peers.set(peerName, peer);
        this._broadcastAllStates();
      }
    }
  }

  _handleDeviceStateChange(event) {
    const device = event["Device"] || "";
    // Device = "SIP/602" -> "602"
    const name = device.replace(/^SIP\//i, "");
    if (!name || isTrunk(name)) return;
    if (!this.peers.has(name)) return;

    const stateStr = (event["State"] || "").toUpperCase();
    const peer = this.peers.get(name);
    if (peer.registrationState === "offline") return;

    if (stateStr.includes("NOT_INUSE") || stateStr === "IDLE") {
      // Only set free if no active channels
      let hasChannels = false;
      for (const [ch, data] of this.activeChannels) {
        if (data.peer === name) { hasChannels = true; break; }
      }
      if (!hasChannels) {
        peer.state = "free";
        peer.callerIdNum = "";
        peer.callerIdName = "";
        peer.channel = "";
        peer.talkingTo = "";
      }
    } else if (stateStr.includes("RINGING") || stateStr === "RING") {
      peer.state = "calling";
    } else if (stateStr.includes("INUSE") || stateStr === "BUSY") {
      peer.state = "talking";
    } else if (stateStr.includes("ONHOLD")) {
      peer.state = "talking"; // still in call
    } else if (stateStr.includes("UNAVAILABLE") || stateStr.includes("INVALID")) {
      peer.state = "unavailable";
    }

    peer.timestamp = new Date().toISOString();
    this.peers.set(name, peer);
    this._broadcastAllStates();
  }

  // ===== CoreShowChannels - periodic refresh =====

  _handleCoreShowChannel(event) {
    const channel = event["Channel"] || "";
    const peerName = this._extractPeerFromChannel(channel);
    const stateDesc = (event["Application"] || "").toLowerCase();

    this.activeChannels.set(channel, {
      peer: peerName,
      state: event["ChannelStateDesc"] || "",
      callerIdNum: event["CallerIDNum"] || "",
      callerIdName: event["CallerIDName"] || "",
      connectedLineNum: event["ConnectedLineNum"] || "",
      connectedLineName: event["ConnectedLineName"] || "",
      application: event["Application"] || "",
      duration: event["Duration"] || "",
      uniqueId: event["Uniqueid"] || "",
    });
  }

  _resolveStatesFromChannels() {
    // Build a set of peers with active channels
    const peersInCall = new Map(); // peerName -> channel info

    for (const [channel, data] of this.activeChannels) {
      if (data.peer && this.peers.has(data.peer)) {
        const stateDesc = (data.state || "").toLowerCase();
        let callState = "calling";
        if (stateDesc === "up") {
          callState = "talking";
        } else if (stateDesc === "ringing" || stateDesc === "ring") {
          callState = "calling";
        }

        // Prefer "talking" over "calling" if multiple channels
        const existing = peersInCall.get(data.peer);
        if (!existing || callState === "talking") {
          peersInCall.set(data.peer, { ...data, callState });
        }
      }
    }

    // Update all peers
    for (const [name, peer] of this.peers) {
      if (peer.registrationState === "offline") {
        peer.state = "unavailable";
        continue;
      }

      const inCall = peersInCall.get(name);
      if (inCall) {
        peer.state = inCall.callState;
        peer.callerIdNum = inCall.connectedLineNum || inCall.callerIdNum || "";
        peer.callerIdName = inCall.connectedLineName || inCall.callerIdName || "";
        peer.talkingTo = inCall.connectedLineNum || "";
      } else {
        peer.state = "free";
        peer.callerIdNum = "";
        peer.callerIdName = "";
        peer.channel = "";
        peer.talkingTo = "";
      }
      peer.timestamp = new Date().toISOString();
    }
  }

  // ===== CDR (Call Detail Record) from cdr_manager =====

  async _handleCdrEvent(event) {
    console.log("📞 AMI: CDR event received:", JSON.stringify(event).substring(0, 300));
    const src = event["Source"] || "";
    const dst = event["Destination"] || "";
    const channel = event["Channel"] || "";
    const dstChannel = event["DestinationChannel"] || "";
    const disposition = event["Disposition"] || "";
    const duration = parseInt(event["Duration"], 10) || 0;
    const billsec = parseInt(event["BillableSeconds"], 10) || 0;
    const startTime = event["StartTime"] || "";
    const answerTime = event["AnswerTime"] || "";
    const endTime = event["EndTime"] || "";

    // Determine which is the agent extension
    const srcPeer = this._extractPeerFromChannel(channel);
    const dstPeer = this._extractPeerFromChannel(dstChannel);
    const agentExt = (srcPeer && !isTrunk(srcPeer)) ? srcPeer : (dstPeer && !isTrunk(dstPeer)) ? dstPeer : null;

    if (!agentExt) return; // Not an agent call

    const agentInfo = this.agentMap.get(agentExt);
    const phone = agentExt === srcPeer ? dst : src;

    // Look up lead
    let lead = null;
    if (phone) {
      lead = await this._lookupLead(phone);
      if (!lead) {
        const alias = this._parseAlias(event["CallerID"] || "");
        if (alias.email) lead = await this._lookupLeadByEmail(alias.email);
        if (!lead && alias.phone) lead = await this._lookupLead(alias.phone);
      }
    }

    const record = {
      extension: agentExt,
      agentName: agentInfo?.fullName || agentExt,
      src,
      dst,
      phone,
      disposition,
      duration,
      billsec,
      startTime,
      answerTime,
      endTime,
      leadName: lead?.fullName || null,
      leadEmail: lead?.newEmail || null,
      leadId: lead?._id || null,
      leadCountry: lead?.country || null,
      timestamp: new Date().toISOString(),
    };

    this.callHistory.unshift(record);
    if (this.callHistory.length > this.maxHistorySize) {
      this.callHistory = this.callHistory.slice(0, this.maxHistorySize);
    }

    // Broadcast updated history
    if (this.io) {
      this.io.to("admin:ami-agents").emit("ami_call_history", this.callHistory);
    }
  }

  getCallHistory() {
    return this.callHistory;
  }

  // ===== Broadcasting =====

  _broadcastAllStates() {
    // Use enriched broadcast (with lead lookups) for call state changes
    this._enrichAndBroadcast().catch(() => {});
  }

  getAgentStates() {
    const states = [];
    for (const [name, data] of this.peers) {
      const agentInfo = this.agentMap.get(name);
      states.push({
        ...data,
        agentName: agentInfo?.fullName || null,
        agentId: agentInfo?._id || null,
        fourDigitCode: agentInfo?.fourDigitCode || null,
        lead: data.lead || null,
      });
    }
    // Sort: online first, then by name (prefer agent name if available)
    states.sort((a, b) => {
      if (a.registrationState !== b.registrationState) {
        return a.registrationState === "online" ? -1 : 1;
      }
      const nameA = a.agentName || a.name || "";
      const nameB = b.agentName || b.name || "";
      return nameA.localeCompare(nameB, undefined, { numeric: true });
    });
    return states;
  }

  // ===== Actions =====

  _login() {
    this._sendAction({
      Action: "Login",
      Username: this.username,
      Secret: this.password,
      Events: "on",
    });
  }

  _sendAction(params) {
    if (!this.socket || !this.connected) {
      console.warn("⚠️ AMI: Cannot send action, not connected");
      return;
    }

    let message = "";
    for (const [key, value] of Object.entries(params)) {
      message += `${key}: ${value}\r\n`;
    }
    message += "\r\n";
    this.socket.write(message);
  }

  // ===== Timers =====

  _startPing() {
    this._clearTimers();
    this.pingInterval = setInterval(() => {
      if (this.connected && this.authenticated) {
        this._sendAction({ Action: "Ping" });
      }
    }, 60000);
  }

  _startPolling() {
    if (this.pollInterval) return;
    // Refresh channels every 10 seconds for accuracy
    this.pollInterval = setInterval(() => {
      if (this.connected && this.authenticated) {
        // Clear stale channels before re-querying
        this.activeChannels.clear();
        this._sendAction({ Action: "CoreShowChannels", ActionID: "poll" });
      }
    }, 10000);
  }

  _clearTimers() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  _scheduleReconnect() {
    if (this.reconnectTimer) return;
    console.log(`🔄 AMI: Reconnecting in ${this.reconnectInterval / 1000}s...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectInterval);
  }

  shutdown() {
    this._clearTimers();
    if (this.agentMapInterval) {
      clearInterval(this.agentMapInterval);
      this.agentMapInterval = null;
    }
    if (this.cdrPollInterval) {
      clearInterval(this.cdrPollInterval);
      this.cdrPollInterval = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.cdrPool) {
      this.cdrPool.end().catch(() => {});
      this.cdrPool = null;
    }
    if (this.socket) {
      if (this.authenticated) {
        this._sendAction({ Action: "Logoff" });
      }
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
    this.authenticated = false;
    console.log("✅ AMI Service shut down");
  }

  getStatus() {
    return {
      connected: this.connected,
      authenticated: this.authenticated,
      agentCount: this.peers.size,
    };
  }
}

// Singleton
const amiService = new AmiService();
module.exports = amiService;
