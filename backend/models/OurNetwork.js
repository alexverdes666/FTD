const mongoose = require("mongoose");
const encryptFields = require("./plugins/encryptFields");

const ourNetworkSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Our network name is required"],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    assignedAffiliateManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    cryptoWallets: {
      ethereum: {
        type: [String],
        default: [],
        validate: {
          validator: function (addresses) {
            if (!Array.isArray(addresses)) return false;
            return addresses.every(
              (addr) =>
                !addr || addr.trim() === "" || /^0x[a-fA-F0-9]{40}$/.test(addr)
            );
          },
          message: "Invalid Ethereum wallet address format",
        },
      },
      bitcoin: {
        type: [String],
        default: [],
        validate: {
          validator: function (addresses) {
            if (!Array.isArray(addresses)) return false;
            return addresses.every(
              (addr) =>
                !addr ||
                addr.trim() === "" ||
                /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/.test(
                  addr
                )
            );
          },
          message: "Invalid Bitcoin wallet address format",
        },
      },
      tron: {
        type: [String],
        default: [],
        validate: {
          validator: function (addresses) {
            if (!Array.isArray(addresses)) return false;
            return addresses.every(
              (addr) =>
                !addr || addr.trim() === "" || /^T[A-Za-z1-9]{33}$/.test(addr)
            );
          },
          message: "Invalid TRON wallet address format",
        },
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
ourNetworkSchema.index({ name: 1 });
ourNetworkSchema.index({ assignedAffiliateManager: 1 });
ourNetworkSchema.index({ createdBy: 1 });
ourNetworkSchema.index({ isActive: 1 });
// Text index for global search
ourNetworkSchema.index(
  { name: "text", description: "text" },
  { weights: { name: 10, description: 5 }, name: "our_network_search_index" }
);

// Virtual fields
ourNetworkSchema.virtual("hasAssignedManager").get(function () {
  return !!this.assignedAffiliateManager;
});

ourNetworkSchema.virtual("activeBrokersCount").get(function () {
  return 0;
});

// Virtual fields for crypto wallet URLs
ourNetworkSchema.virtual("cryptoWalletUrls").get(function () {
  const wallets = this.cryptoWallets || {};
  const urls = {};

  if (wallets.ethereum && wallets.ethereum.length > 0) {
    urls.ethereum = wallets.ethereum
      .filter((addr) => addr && addr.trim() !== "")
      .map((addr) => `https://etherscan.io/address/${addr}#tokentxns`);
  }

  if (wallets.bitcoin && wallets.bitcoin.length > 0) {
    urls.bitcoin = wallets.bitcoin
      .filter((addr) => addr && addr.trim() !== "")
      .map(
        (addr) => `https://www.blockchain.com/explorer/addresses/btc/${addr}`
      );
  }

  if (wallets.tron && wallets.tron.length > 0) {
    urls.tron = wallets.tron
      .filter((addr) => addr && addr.trim() !== "")
      .map((addr) => `https://tronscan.org/#/address/${addr}/transfers`);
  }

  return urls;
});

ourNetworkSchema.plugin(encryptFields, {
  fields: [
    "cryptoWallets.ethereum",
    "cryptoWallets.bitcoin",
    "cryptoWallets.tron",
  ],
});

module.exports = mongoose.model("OurNetwork", ourNetworkSchema);
