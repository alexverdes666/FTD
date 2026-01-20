const axios = require('axios');
const User = require('../models/User');

class SipSyncService {
  constructor() {
    this.apiUrl = 'http://188.126.10.151:7080/api_sip.php';
    this.defaultPassword = '123123';
    this.emailDomain = '@mail.com';
  }

  /**
   * Extract name from cid field (letters only, lowercase)
   * Examples:
   * - "David C 647" -> "davidc"
   * - "Jason" -> "jason"
   * - "Treasure 631" -> "treasure"
   * - "IP Phone 10" -> "ipphone"
   * @param {string} cid - The caller ID string
   * @returns {string} - Extracted name (letters only, lowercase)
   */
  extractNameFromCid(cid) {
    if (!cid) return '';
    // Remove all non-letter characters and convert to lowercase
    return cid.replace(/[^a-zA-Z]/g, '').toLowerCase();
  }

  /**
   * Convert 3-digit SIP code to 4-digit agent code by adding "0" prefix
   * @param {string} sip - The 3-digit SIP code
   * @returns {string} - 4-digit agent code
   */
  convertToFourDigitCode(sip) {
    if (!sip) return null;
    const sipStr = sip.toString();
    // If already 4 digits, return as-is
    if (sipStr.length === 4) return sipStr;
    // If 3 digits or less, pad with leading zeros to make 4 digits
    return sipStr.padStart(4, '0');
  }

  /**
   * Capitalize first letter of each word in a name
   * @param {string} name - The name to capitalize
   * @returns {string} - Capitalized name
   */
  capitalizeFullName(name) {
    if (!name) return '';
    // For single-word names extracted from cid, just capitalize first letter
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }

  /**
   * Fetch agents from external SIP API
   * @returns {Promise<Array>} - Array of SIP agents
   */
  async fetchSipAgents() {
    try {
      console.log('[SIP Sync] Fetching agents from external API...');
      const response = await axios.get(this.apiUrl, { timeout: 30000 });

      if (response.data && response.data.status === 'success' && Array.isArray(response.data.data)) {
        console.log(`[SIP Sync] Fetched ${response.data.count} agents from API`);
        return response.data.data;
      }

      console.warn('[SIP Sync] Invalid response format from API:', response.data);
      return [];
    } catch (error) {
      console.error('[SIP Sync] Error fetching from external API:', error.message);
      throw error;
    }
  }

  /**
   * Get all existing agent codes from the database
   * @returns {Promise<Set<string>>} - Set of existing 4-digit codes
   */
  async getExistingAgentCodes() {
    try {
      const agents = await User.find({ role: 'agent' }).select('fourDigitCode').lean();
      const codes = new Set(agents.map(a => a.fourDigitCode).filter(Boolean));
      console.log(`[SIP Sync] Found ${codes.size} existing agent codes in database`);
      return codes;
    } catch (error) {
      console.error('[SIP Sync] Error fetching existing agents:', error.message);
      throw error;
    }
  }

  /**
   * Get all existing emails from the database
   * @returns {Promise<Set<string>>} - Set of existing emails (lowercase)
   */
  async getExistingEmails() {
    try {
      const users = await User.find({}).select('email').lean();
      const emails = new Set(users.map(u => u.email.toLowerCase()));
      console.log(`[SIP Sync] Found ${emails.size} existing emails in database`);
      return emails;
    } catch (error) {
      console.error('[SIP Sync] Error fetching existing emails:', error.message);
      throw error;
    }
  }

  /**
   * Create a new agent in the database
   * @param {Object} agentData - Agent data from SIP API
   * @param {Set<string>} existingEmails - Set of existing emails to avoid duplicates
   * @returns {Promise<Object|null>} - Created user or null if failed, or 'skipped_email' if email exists
   */
  async createAgent(agentData, existingEmails) {
    try {
      const { sip, cid } = agentData;
      const fourDigitCode = this.convertToFourDigitCode(sip);
      const extractedName = this.extractNameFromCid(cid);

      if (!fourDigitCode || !extractedName) {
        console.warn(`[SIP Sync] Skipping agent with invalid data: sip=${sip}, cid=${cid}`);
        return null;
      }

      // Generate email - if exists, skip this agent entirely
      const email = `${extractedName}${this.emailDomain}`;
      if (existingEmails.has(email.toLowerCase())) {
        console.log(`[SIP Sync] Skipping agent ${extractedName} (${fourDigitCode}) - email ${email} already exists`);
        return 'skipped_email';
      }

      const fullName = this.capitalizeFullName(extractedName);

      const userData = {
        email,
        password: this.defaultPassword,
        fullName,
        role: 'agent',
        fourDigitCode,
        permissions: {
          canCreateOrders: false,
          canManageLeads: false,
          canManageRefunds: false,
          canManageSimCards: false
        },
        isActive: true,
        status: 'approved',
        leadManagerStatus: 'not_applicable'
      };

      console.log(`[SIP Sync] Creating agent: ${fullName} (${fourDigitCode}) - ${email}`);
      const user = await User.create(userData);

      // Add the new email to the set to prevent duplicates in same batch
      existingEmails.add(email.toLowerCase());

      return user;
    } catch (error) {
      console.error(`[SIP Sync] Error creating agent:`, error.message);
      return null;
    }
  }

  /**
   * Sync agents from SIP API to database
   * Creates missing agents, skips existing ones
   * @returns {Promise<Object>} - Sync results
   */
  async syncAgents() {
    const startTime = Date.now();
    console.log('[SIP Sync] Starting agent sync...');

    const results = {
      success: true,
      totalFromApi: 0,
      existingAgentCodes: 0,
      existingEmails: 0,
      created: 0,
      skipped: 0,
      errors: 0,
      createdAgents: [],
      skippedDetails: [],
      errorDetails: []
    };

    try {
      // Fetch data from external API
      const sipAgents = await this.fetchSipAgents();
      results.totalFromApi = sipAgents.length;

      if (sipAgents.length === 0) {
        console.log('[SIP Sync] No agents to process');
        results.duration = `${Date.now() - startTime}ms`;
        return results;
      }

      // Get existing agent codes and emails
      const existingCodes = await this.getExistingAgentCodes();
      const existingEmails = await this.getExistingEmails();

      // Process each SIP agent
      for (const sipAgent of sipAgents) {
        const fourDigitCode = this.convertToFourDigitCode(sipAgent.sip);
        const extractedName = this.extractNameFromCid(sipAgent.cid);

        // Skip if agent code already exists
        if (existingCodes.has(fourDigitCode)) {
          results.existingAgentCodes++;
          continue;
        }

        // Skip entries with no extractable name
        if (!extractedName) {
          console.warn(`[SIP Sync] Skipping entry with no extractable name: ${sipAgent.cid}`);
          results.skipped++;
          results.skippedDetails.push({
            sip: sipAgent.sip,
            cid: sipAgent.cid,
            reason: 'No extractable name'
          });
          continue;
        }

        // Try to create the agent
        const createResult = await this.createAgent(sipAgent, existingEmails);

        if (createResult === 'skipped_email') {
          // Email already exists, skip
          results.existingEmails++;
          results.skippedDetails.push({
            sip: sipAgent.sip,
            cid: sipAgent.cid,
            fourDigitCode,
            extractedName,
            reason: `Email ${extractedName}@mail.com already exists`
          });
        } else if (createResult && createResult !== 'skipped_email') {
          // Successfully created
          results.created++;
          results.createdAgents.push({
            fullName: createResult.fullName,
            email: createResult.email,
            fourDigitCode: createResult.fourDigitCode
          });
          // Add to existing codes to prevent duplicates in same run
          existingCodes.add(fourDigitCode);
        } else {
          // Error creating
          results.errors++;
          results.errorDetails.push({
            sip: sipAgent.sip,
            cid: sipAgent.cid,
            reason: 'Failed to create'
          });
        }
      }

      results.duration = `${Date.now() - startTime}ms`;
      console.log(`[SIP Sync] Sync completed:`, {
        totalFromApi: results.totalFromApi,
        existingAgentCodes: results.existingAgentCodes,
        existingEmails: results.existingEmails,
        created: results.created,
        skipped: results.skipped,
        errors: results.errors,
        duration: results.duration
      });

      return results;
    } catch (error) {
      results.success = false;
      results.error = error.message;
      results.duration = `${Date.now() - startTime}ms`;
      console.error('[SIP Sync] Sync failed:', error.message);
      return results;
    }
  }

  /**
   * Get sync status - lists agents that would be created
   * @returns {Promise<Object>} - Preview of sync without making changes
   */
  async getSyncPreview() {
    console.log('[SIP Sync] Generating sync preview...');

    try {
      const sipAgents = await this.fetchSipAgents();
      const existingCodes = await this.getExistingAgentCodes();

      const agentsToCreate = [];
      const existingAgentsInApi = [];

      for (const sipAgent of sipAgents) {
        const fourDigitCode = this.convertToFourDigitCode(sipAgent.sip);
        const extractedName = this.extractNameFromCid(sipAgent.cid);

        if (existingCodes.has(fourDigitCode)) {
          existingAgentsInApi.push({
            sip: sipAgent.sip,
            cid: sipAgent.cid,
            fourDigitCode,
            extractedName
          });
        } else if (extractedName) {
          agentsToCreate.push({
            sip: sipAgent.sip,
            cid: sipAgent.cid,
            fourDigitCode,
            extractedName,
            proposedEmail: `${extractedName}${this.emailDomain}`
          });
        }
      }

      return {
        totalFromApi: sipAgents.length,
        alreadyExist: existingAgentsInApi.length,
        toBeCreated: agentsToCreate.length,
        agentsToCreate,
        existingAgentsInApi
      };
    } catch (error) {
      console.error('[SIP Sync] Error generating preview:', error.message);
      throw error;
    }
  }
}

// Create singleton instance
const sipSyncService = new SipSyncService();

module.exports = sipSyncService;
