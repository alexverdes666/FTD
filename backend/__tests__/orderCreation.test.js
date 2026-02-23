/**
 * Tests for order creation lead selection logic.
 *
 * Covers:
 * 1. Agent filtering: assigned leads should be used as fallback when no unassigned leads exist
 * 2. Client network dedup: leads already used with a client network must not be reused
 * 3. Client broker dedup: leads already used with client brokers must not be reused
 */
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongoServer;

// Models
let Lead, Order, Campaign, ClientNetwork, OurNetwork, ClientBroker, User;

// Shared test IDs
let adminUser, affiliateManager, agent1, agent2;
let campaign, clientNetwork1, clientNetwork2, ourNetwork, clientBroker1, clientBroker2;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  Lead = require("../models/Lead");
  Order = require("../models/Order");
  Campaign = require("../models/Campaign");
  ClientNetwork = require("../models/ClientNetwork");
  OurNetwork = require("../models/OurNetwork");
  ClientBroker = require("../models/ClientBroker");
  User = require("../models/User");
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Helper to create a lead
const createLead = async (overrides = {}) => {
  const defaults = {
    leadType: "ftd",
    firstName: "Test",
    lastName: "Lead",
    newEmail: `test-${new mongoose.Types.ObjectId()}@test.com`,
    newPhone: `+1${Math.floor(1000000000 + Math.random() * 9000000000)}`,
    country: "Canada",
    status: "active",
    isArchived: false,
    assignedAgent: null,
    lastUsedInOrder: null,
    gender: "not_defined",
  };
  return Lead.create({ ...defaults, ...overrides });
};

// Helper to create a fulfilled order
const createOrder = async (leads, overrides = {}) => {
  const defaults = {
    requester: adminUser,
    requests: { ftd: leads.length, filler: 0, cold: 0 },
    fulfilled: { ftd: leads.length, filler: 0, cold: 0 },
    leads: leads.map((l) => l._id),
    leadsMetadata: leads.map((l) => ({ leadId: l._id, orderedAs: "ftd" })),
    status: "fulfilled",
    countryFilter: "Canada",
    selectedCampaign: campaign,
    selectedClientNetwork: null,
    selectedClientBrokers: [],
    plannedDate: new Date(Date.now() + 86400000),
  };
  return Order.create({ ...defaults, ...overrides });
};

// Setup shared entities once
beforeAll(async () => {
  adminUser = new mongoose.Types.ObjectId();
  affiliateManager = new mongoose.Types.ObjectId();
  agent1 = new mongoose.Types.ObjectId();
  agent2 = new mongoose.Types.ObjectId();

  campaign = await Campaign.create({
    name: "Test Campaign",
    status: "active",
    isActive: true,
    createdBy: adminUser,
    assignedAffiliateManagers: [affiliateManager],
  });

  clientNetwork1 = await ClientNetwork.create({
    name: "Traffic360",
    createdBy: adminUser,
    isActive: true,
  });

  clientNetwork2 = await ClientNetwork.create({
    name: "LeadGen Pro",
    createdBy: adminUser,
    isActive: true,
  });

  ourNetwork = await OurNetwork.create({
    name: "Efex",
    createdBy: adminUser,
    isActive: true,
    assignedAffiliateManager: affiliateManager,
  });

  clientBroker1 = await ClientBroker.create({
    name: "Broker Alpha",
    domain: "broker-alpha.com",
    createdBy: adminUser,
    isActive: true,
  });

  clientBroker2 = await ClientBroker.create({
    name: "Broker Beta",
    domain: "broker-beta.com",
    createdBy: adminUser,
    isActive: true,
  });
});

afterEach(async () => {
  // Clean up leads and orders between tests, keep shared entities
  await Lead.deleteMany({});
  await Order.deleteMany({});
});

// ─────────────────────────────────────────────
// Import the createOrder controller logic
// We call it via supertest-like approach but since the controller is complex,
// we extract the core logic by simulating what the controller does.
// ─────────────────────────────────────────────

/**
 * Simulate the FTD lead selection logic from createOrder (the non-agent-assignments path).
 * This mirrors the code in orders.js lines ~2201-2337.
 */
const simulateOrderFTDSelection = async ({
  requestedFtd,
  country,
  gender = null,
  agentFilter = null,
  selectedClientNetwork = null,
  selectedClientBrokers = [],
}) => {
  const countryFilter = country ? { country: new RegExp(country, "i") } : {};
  const genderFilter = gender ? { gender } : {};

  // Collect leads from existing non-cancelled orders with same client network
  let leadsAlreadyInSameClientNetwork = new Set();
  if (selectedClientNetwork) {
    const existingOrders = await Order.find({
      selectedClientNetwork: selectedClientNetwork,
      status: { $ne: "cancelled" },
    })
      .select("leads")
      .lean();

    for (const order of existingOrders) {
      if (order.leads) {
        for (const leadId of order.leads) {
          leadsAlreadyInSameClientNetwork.add(leadId.toString());
        }
      }
    }
  }

  // Collect leads from existing non-cancelled orders with same client brokers
  let leadsAlreadyWithSameBrokers = new Set();
  if (selectedClientBrokers && selectedClientBrokers.length > 0) {
    const existingBrokerOrders = await Order.find({
      selectedClientBrokers: { $in: selectedClientBrokers },
      status: { $ne: "cancelled" },
    })
      .select("leads")
      .lean();

    for (const order of existingBrokerOrders) {
      if (order.leads) {
        for (const leadId of order.leads) {
          leadsAlreadyWithSameBrokers.add(leadId.toString());
        }
      }
    }
  }

  // Build the query (mirrors the fixed code)
  let ftdQuery = {
    leadType: "ftd",
    isArchived: { $ne: true },
    status: { $ne: "inactive" },
    ...countryFilter,
    ...genderFilter,
  };

  // Exclude leads already in orders with same client network or same brokers
  const excludedIds = new Set();
  for (const id of leadsAlreadyInSameClientNetwork) excludedIds.add(id);
  for (const id of leadsAlreadyWithSameBrokers) excludedIds.add(id);
  if (excludedIds.size > 0) {
    ftdQuery._id = {
      $nin: [...excludedIds].map((id) => new mongoose.Types.ObjectId(id)),
    };
  }

  // Fetch all matching leads (no $sample randomness in tests for determinism)
  let ftdLeads = await Lead.find(ftdQuery);

  if (ftdLeads.length > 0) {
    // Cooldown filter
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    ftdLeads = ftdLeads.filter(
      (lead) => !lead.lastUsedInOrder || lead.lastUsedInOrder <= tenDaysAgo
    );

    // Agent filtering (mirrors the FIXED code)
    if (agentFilter) {
      const agentAssignedLeads = ftdLeads.filter(
        (lead) =>
          lead.assignedAgent &&
          lead.assignedAgent.toString() === agentFilter.toString()
      );
      const unassignedLeads = ftdLeads.filter(
        (lead) => !lead.assignedAgent
      );
      ftdLeads = [...agentAssignedLeads, ...unassignedLeads];
    } else {
      // FIXED: unassigned first, assigned as fallback (not excluded!)
      const unassignedLeads = ftdLeads.filter(
        (lead) => !lead.assignedAgent
      );
      const assignedLeads = ftdLeads.filter((lead) => lead.assignedAgent);
      ftdLeads = [...unassignedLeads, ...assignedLeads];
    }
  }

  return ftdLeads.slice(0, requestedFtd);
};

// ═════════════════════════════════════════════
// TEST SUITE 1: Agent filtering
// ═════════════════════════════════════════════
describe("Order creation - agent filtering", () => {
  test("should return assigned leads when no unassigned leads exist and no agent filter is set", async () => {
    // Create 5 FTD leads, ALL assigned to agents
    const leads = await Promise.all([
      createLead({ assignedAgent: agent1, firstName: "Lead1" }),
      createLead({ assignedAgent: agent1, firstName: "Lead2" }),
      createLead({ assignedAgent: agent2, firstName: "Lead3" }),
      createLead({ assignedAgent: agent2, firstName: "Lead4" }),
      createLead({ assignedAgent: agent1, firstName: "Lead5" }),
    ]);

    const result = await simulateOrderFTDSelection({
      requestedFtd: 5,
      country: "Canada",
      selectedClientNetwork: clientNetwork1._id,
    });

    // Should return all 5, not 0
    expect(result.length).toBe(5);
  });

  test("should prioritize unassigned leads over assigned leads", async () => {
    // 2 unassigned + 3 assigned
    const unassigned1 = await createLead({ firstName: "Unassigned1" });
    const unassigned2 = await createLead({ firstName: "Unassigned2" });
    await createLead({ assignedAgent: agent1, firstName: "Assigned1" });
    await createLead({ assignedAgent: agent1, firstName: "Assigned2" });
    await createLead({ assignedAgent: agent2, firstName: "Assigned3" });

    const result = await simulateOrderFTDSelection({
      requestedFtd: 3,
      country: "Canada",
      selectedClientNetwork: clientNetwork1._id,
    });

    expect(result.length).toBe(3);
    // First 2 should be unassigned
    expect(result[0].assignedAgent).toBeNull();
    expect(result[1].assignedAgent).toBeNull();
    // 3rd should be assigned (fallback)
    expect(result[2].assignedAgent).not.toBeNull();
  });

  test("should return only unassigned leads when enough are available", async () => {
    // 5 unassigned + 3 assigned
    for (let i = 0; i < 5; i++) {
      await createLead({ firstName: `Unassigned${i}` });
    }
    for (let i = 0; i < 3; i++) {
      await createLead({ assignedAgent: agent1, firstName: `Assigned${i}` });
    }

    const result = await simulateOrderFTDSelection({
      requestedFtd: 5,
      country: "Canada",
      selectedClientNetwork: clientNetwork1._id,
    });

    expect(result.length).toBe(5);
    // All 5 should be unassigned since there are enough
    result.forEach((lead) => {
      expect(lead.assignedAgent).toBeNull();
    });
  });

  test("should fill remaining slots with assigned leads when unassigned are insufficient", async () => {
    // 2 unassigned + 5 assigned, request 4
    await createLead({ firstName: "Unassigned1" });
    await createLead({ firstName: "Unassigned2" });
    for (let i = 0; i < 5; i++) {
      await createLead({ assignedAgent: agent1, firstName: `Assigned${i}` });
    }

    const result = await simulateOrderFTDSelection({
      requestedFtd: 4,
      country: "Canada",
      selectedClientNetwork: clientNetwork1._id,
    });

    expect(result.length).toBe(4);
    // First 2 unassigned, then 2 assigned as fallback
    expect(result[0].assignedAgent).toBeNull();
    expect(result[1].assignedAgent).toBeNull();
    expect(result[2].assignedAgent).not.toBeNull();
    expect(result[3].assignedAgent).not.toBeNull();
  });

  test("should return 0 leads when none match criteria (cancelled order is expected)", async () => {
    // Only leads from wrong country
    await createLead({ country: "Germany", assignedAgent: agent1 });
    await createLead({ country: "Germany" });

    const result = await simulateOrderFTDSelection({
      requestedFtd: 5,
      country: "Canada",
      selectedClientNetwork: clientNetwork1._id,
    });

    expect(result.length).toBe(0);
  });
});

// ═════════════════════════════════════════════
// TEST SUITE 2: Client network dedup
// ═════════════════════════════════════════════
describe("Order creation - client network dedup", () => {
  test("should NOT return leads already used in a fulfilled order with the same client network", async () => {
    // Create 3 leads and put them in an existing fulfilled order with clientNetwork1
    const usedLeads = await Promise.all([
      createLead({ firstName: "Used1" }),
      createLead({ firstName: "Used2" }),
      createLead({ firstName: "Used3" }),
    ]);

    await createOrder(usedLeads, {
      selectedClientNetwork: clientNetwork1._id,
      status: "fulfilled",
    });

    // Create 2 fresh leads
    const freshLead1 = await createLead({ firstName: "Fresh1" });
    const freshLead2 = await createLead({ firstName: "Fresh2" });

    const result = await simulateOrderFTDSelection({
      requestedFtd: 5,
      country: "Canada",
      selectedClientNetwork: clientNetwork1._id,
    });

    // Should only get the 2 fresh leads, not the 3 already used
    expect(result.length).toBe(2);
    const resultIds = result.map((l) => l._id.toString());
    expect(resultIds).toContain(freshLead1._id.toString());
    expect(resultIds).toContain(freshLead2._id.toString());
    usedLeads.forEach((used) => {
      expect(resultIds).not.toContain(used._id.toString());
    });
  });

  test("should allow leads from cancelled orders with the same client network", async () => {
    // Create leads in a CANCELLED order — they should be available
    const cancelledLeads = await Promise.all([
      createLead({ firstName: "Cancelled1" }),
      createLead({ firstName: "Cancelled2" }),
    ]);

    await createOrder(cancelledLeads, {
      selectedClientNetwork: clientNetwork1._id,
      status: "cancelled",
    });

    const result = await simulateOrderFTDSelection({
      requestedFtd: 5,
      country: "Canada",
      selectedClientNetwork: clientNetwork1._id,
    });

    // Leads from cancelled orders should be available
    expect(result.length).toBe(2);
    const resultIds = result.map((l) => l._id.toString());
    expect(resultIds).toContain(cancelledLeads[0]._id.toString());
    expect(resultIds).toContain(cancelledLeads[1]._id.toString());
  });

  test("should allow leads used with a DIFFERENT client network", async () => {
    // Create leads used with clientNetwork2
    const otherNetworkLeads = await Promise.all([
      createLead({ firstName: "OtherNet1" }),
      createLead({ firstName: "OtherNet2" }),
    ]);

    await createOrder(otherNetworkLeads, {
      selectedClientNetwork: clientNetwork2._id,
      status: "fulfilled",
    });

    // Create fresh lead
    const freshLead = await createLead({ firstName: "Fresh" });

    const result = await simulateOrderFTDSelection({
      requestedFtd: 5,
      country: "Canada",
      selectedClientNetwork: clientNetwork1._id, // Different network
    });

    // Should get all 3 leads — the other-network leads are not excluded
    expect(result.length).toBe(3);
  });
});

// ═════════════════════════════════════════════
// TEST SUITE 3: Client broker dedup
// ═════════════════════════════════════════════
describe("Order creation - client broker dedup", () => {
  test("should NOT return leads already used in an order with the same client broker", async () => {
    // Create leads used with clientBroker1
    const usedLeads = await Promise.all([
      createLead({ firstName: "BrokerUsed1" }),
      createLead({ firstName: "BrokerUsed2" }),
    ]);

    await createOrder(usedLeads, {
      selectedClientBrokers: [clientBroker1._id],
      status: "fulfilled",
    });

    // Fresh leads
    const freshLead = await createLead({ firstName: "BrokerFresh" });

    const result = await simulateOrderFTDSelection({
      requestedFtd: 5,
      country: "Canada",
      selectedClientBrokers: [clientBroker1._id],
    });

    // Only the fresh lead should be returned
    expect(result.length).toBe(1);
    expect(result[0]._id.toString()).toBe(freshLead._id.toString());
  });

  test("should exclude leads when ANY broker in the order overlaps", async () => {
    // Order with [broker1, broker2]
    const usedLeads = await Promise.all([
      createLead({ firstName: "MultiBroker1" }),
    ]);

    await createOrder(usedLeads, {
      selectedClientBrokers: [clientBroker1._id, clientBroker2._id],
      status: "fulfilled",
    });

    const freshLead = await createLead({ firstName: "MultiBrokerFresh" });

    // New order with just broker1 — should still exclude the lead from the broker1+broker2 order
    const result = await simulateOrderFTDSelection({
      requestedFtd: 5,
      country: "Canada",
      selectedClientBrokers: [clientBroker1._id],
    });

    expect(result.length).toBe(1);
    expect(result[0]._id.toString()).toBe(freshLead._id.toString());
  });

  test("should allow leads from cancelled orders with the same broker", async () => {
    const cancelledLeads = await Promise.all([
      createLead({ firstName: "BrokerCancelled1" }),
    ]);

    await createOrder(cancelledLeads, {
      selectedClientBrokers: [clientBroker1._id],
      status: "cancelled",
    });

    const result = await simulateOrderFTDSelection({
      requestedFtd: 5,
      country: "Canada",
      selectedClientBrokers: [clientBroker1._id],
    });

    // Leads from cancelled orders should be available
    expect(result.length).toBe(1);
  });

  test("should allow leads used with a DIFFERENT broker", async () => {
    const otherBrokerLeads = await Promise.all([
      createLead({ firstName: "OtherBroker1" }),
    ]);

    await createOrder(otherBrokerLeads, {
      selectedClientBrokers: [clientBroker2._id],
      status: "fulfilled",
    });

    const freshLead = await createLead({ firstName: "DiffBrokerFresh" });

    const result = await simulateOrderFTDSelection({
      requestedFtd: 5,
      country: "Canada",
      selectedClientBrokers: [clientBroker1._id], // Different broker
    });

    // Both leads should be returned
    expect(result.length).toBe(2);
  });
});

// ═════════════════════════════════════════════
// TEST SUITE 4: Combined client network + broker dedup
// ═════════════════════════════════════════════
describe("Order creation - combined network and broker dedup", () => {
  test("should exclude leads matching either network OR broker from previous orders", async () => {
    // Lead used with clientNetwork1
    const networkLead = await createLead({ firstName: "NetLead" });
    await createOrder([networkLead], {
      selectedClientNetwork: clientNetwork1._id,
      status: "fulfilled",
    });

    // Lead used with clientBroker1
    const brokerLead = await createLead({ firstName: "BrokerLead" });
    await createOrder([brokerLead], {
      selectedClientBrokers: [clientBroker1._id],
      status: "fulfilled",
    });

    // Fresh lead
    const freshLead = await createLead({ firstName: "ComboFresh" });

    const result = await simulateOrderFTDSelection({
      requestedFtd: 5,
      country: "Canada",
      selectedClientNetwork: clientNetwork1._id,
      selectedClientBrokers: [clientBroker1._id],
    });

    // Only the fresh lead should be returned
    expect(result.length).toBe(1);
    expect(result[0]._id.toString()).toBe(freshLead._id.toString());
  });
});

// ═════════════════════════════════════════════
// TEST SUITE 5: Cooldown filter
// ═════════════════════════════════════════════
describe("Order creation - cooldown filter", () => {
  test("should exclude FTD leads used within the last 10 days", async () => {
    // Lead used 5 days ago (in cooldown)
    await createLead({
      firstName: "RecentlyUsed",
      lastUsedInOrder: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    });

    // Lead used 15 days ago (cooldown expired)
    const expiredLead = await createLead({
      firstName: "CooldownExpired",
      lastUsedInOrder: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    });

    // Never used lead
    const freshLead = await createLead({ firstName: "NeverUsed" });

    const result = await simulateOrderFTDSelection({
      requestedFtd: 5,
      country: "Canada",
    });

    expect(result.length).toBe(2);
    const resultIds = result.map((l) => l._id.toString());
    expect(resultIds).toContain(expiredLead._id.toString());
    expect(resultIds).toContain(freshLead._id.toString());
  });
});

// ═════════════════════════════════════════════
// TEST SUITE 6: Inactive/archived exclusion
// ═════════════════════════════════════════════
describe("Order creation - status and archive filtering", () => {
  test("should exclude inactive and archived leads", async () => {
    await createLead({ firstName: "Inactive", status: "inactive" });
    await createLead({ firstName: "Archived", isArchived: true });
    const activeLead = await createLead({ firstName: "Active", status: "active" });

    const result = await simulateOrderFTDSelection({
      requestedFtd: 5,
      country: "Canada",
    });

    expect(result.length).toBe(1);
    expect(result[0]._id.toString()).toBe(activeLead._id.toString());
  });
});
