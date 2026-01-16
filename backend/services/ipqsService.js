// IPQS (IPQualityScore) Email and Phone Validation Service
const axios = require('axios');

// Country code mapping for phone number formatting
const COUNTRY_CODES = {
    'Australia': '+61',
    'Canada': '+1',
    'Germany': '+49',
    'Italy': '+39',
    'Poland': '+48',
    'South Africa': '+27',
    'Spain': '+34',
    'Sweden': '+46',
    'United Kingdom': '+44',
};

class IPQSService {
    constructor() {
        this.apiKey = process.env.IPQS_API;
        this.baseUrl = 'https://www.ipqualityscore.com/api/json';
        this.timeout = 30000; // 30 seconds timeout
    }

    /**
     * Validate an email address using IPQS
     * @param {string} email - Email address to validate
     * @returns {Promise<Object>} Validation result
     */
    async validateEmail(email) {
        if (!this.apiKey) {
            throw new Error('IPQS_API key is not configured');
        }

        if (!email || typeof email !== 'string') {
            throw new Error('Valid email address is required');
        }

        try {
            const url = `${this.baseUrl}/email/${this.apiKey}/${encodeURIComponent(email)}`;

            const response = await axios.get(url, {
                timeout: this.timeout,
                params: {
                    fast: false,           // Full validation (not fast mode)
                    timeout: 20,           // API timeout in seconds
                    suggest_domain: false, // Don't suggest domain corrections
                    strictness: 1,         // Medium strictness (0=low, 1=medium, 2=high)
                    abuse_strictness: 1    // Medium abuse detection
                }
            });

            if (response.data) {
                return {
                    success: true,
                    email: email,
                    valid: response.data.valid,
                    disposable: response.data.disposable,
                    honeypot: response.data.honeypot,
                    spam_trap_score: response.data.spam_trap_score,
                    recent_abuse: response.data.recent_abuse,
                    fraud_score: response.data.fraud_score,
                    suspect: response.data.suspect,
                    catch_all: response.data.catch_all,
                    generic: response.data.generic,
                    common: response.data.common,
                    dns_valid: response.data.dns_valid,
                    smtp_score: response.data.smtp_score,
                    overall_score: response.data.overall_score,
                    deliverability: response.data.deliverability,
                    leaked: response.data.leaked,
                    first_name: response.data.first_name,
                    sanitized_email: response.data.sanitized_email,
                    domain_age: response.data.domain_age,
                    first_seen: response.data.first_seen,
                    message: response.data.message,
                    request_id: response.data.request_id
                };
            }

            return {
                success: false,
                email: email,
                error: 'No response data from IPQS'
            };

        } catch (error) {
            console.error(`IPQS Email validation error for ${email}:`, error.message);
            return {
                success: false,
                email: email,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Validate a phone number using IPQS
     * @param {string} phone - Phone number to validate
     * @param {string} country - Country code (e.g., 'US', 'CA')
     * @returns {Promise<Object>} Validation result
     */
    async validatePhone(phone, country = null) {
        if (!this.apiKey) {
            throw new Error('IPQS_API key is not configured');
        }

        if (!phone || typeof phone !== 'string') {
            throw new Error('Valid phone number is required');
        }

        // Clean phone number - remove non-digit characters except +
        const cleanPhone = phone.replace(/[^\d+]/g, '');

        try {
            const url = `${this.baseUrl}/phone/${this.apiKey}/${encodeURIComponent(cleanPhone)}`;

            const params = {
                strictness: 1  // Medium strictness
            };

            // Add country if provided
            if (country) {
                params.country = country.toUpperCase();
            }

            const response = await axios.get(url, {
                timeout: this.timeout,
                params
            });

            if (response.data) {
                return {
                    success: true,
                    phone: phone,
                    valid: response.data.valid,
                    active: response.data.active,
                    fraud_score: response.data.fraud_score,
                    recent_abuse: response.data.recent_abuse,
                    VOIP: response.data.VOIP,
                    prepaid: response.data.prepaid,
                    risky: response.data.risky,
                    active_status: response.data.active_status,
                    line_type: response.data.line_type,
                    carrier: response.data.carrier,
                    country: response.data.country,
                    region: response.data.region,
                    city: response.data.city,
                    timezone: response.data.timezone,
                    zip_code: response.data.zip_code,
                    dialing_code: response.data.dialing_code,
                    do_not_call: response.data.do_not_call,
                    leaked: response.data.leaked,
                    spammer: response.data.spammer,
                    name: response.data.name,
                    formatted: response.data.formatted,
                    local_format: response.data.local_format,
                    message: response.data.message,
                    request_id: response.data.request_id
                };
            }

            return {
                success: false,
                phone: phone,
                error: 'No response data from IPQS'
            };

        } catch (error) {
            console.error(`IPQS Phone validation error for ${phone}:`, error.message);
            return {
                success: false,
                phone: phone,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Format a phone number with country code prefix
     * @param {string} phone - Phone number without country prefix
     * @param {string} country - Country name (e.g., 'Australia', 'United Kingdom')
     * @returns {string} Phone number with country prefix
     */
    formatPhoneWithCountryCode(phone, country) {
        if (!phone) return phone;

        const countryCode = country ? COUNTRY_CODES[country] : null;
        if (!countryCode) return phone;

        // Clean the phone number first
        const cleanPhone = phone.replace(/[^\d]/g, '');

        // Return with country code prefix
        return `${countryCode}${cleanPhone}`;
    }

    /**
     * Validate a lead's email and phone
     * @param {Object} lead - Lead object with newEmail, newPhone, and country
     * @returns {Promise<Object>} Combined validation results
     */
    async validateLead(lead) {
        const results = {
            leadId: lead._id,
            email: null,
            phone: null,
            validatedAt: new Date()
        };

        // Validate email
        if (lead.newEmail) {
            results.email = await this.validateEmail(lead.newEmail);
        }

        // Validate phone
        if (lead.newPhone) {
            // Format phone with country code prefix for accurate validation
            const formattedPhone = this.formatPhoneWithCountryCode(lead.newPhone, lead.country);
            results.phone = await this.validatePhone(formattedPhone, lead.country);
        }

        return results;
    }

    /**
     * Validate multiple leads in an order
     * @param {Array} leads - Array of lead objects
     * @param {boolean} onlyUnvalidated - Only validate leads without existing IPQS validation
     * @returns {Promise<Array>} Array of validation results
     */
    async validateOrderLeads(leads, onlyUnvalidated = false) {
        const results = [];

        // Filter leads if only validating unvalidated ones
        const leadsToValidate = onlyUnvalidated
            ? leads.filter(lead => !lead.ipqsValidation?.validatedAt)
            : leads;

        // Process leads sequentially to avoid rate limiting
        for (const lead of leadsToValidate) {
            try {
                const result = await this.validateLead(lead);
                results.push(result);

                // Small delay between requests to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                console.error(`Error validating lead ${lead._id}:`, error.message);
                results.push({
                    leadId: lead._id,
                    email: { success: false, error: error.message },
                    phone: { success: false, error: error.message },
                    validatedAt: new Date()
                });
            }
        }

        return results;
    }

    /**
     * Check if a lead has been validated
     * @param {Object} lead - Lead object
     * @returns {boolean} True if lead has IPQS validation
     */
    isLeadValidated(lead) {
        return !!(lead.ipqsValidation && lead.ipqsValidation.validatedAt);
    }

    /**
     * Get leads that need validation from an array
     * @param {Array} leads - Array of lead objects
     * @returns {Array} Leads without IPQS validation
     */
    getUnvalidatedLeads(leads) {
        return leads.filter(lead => !this.isLeadValidated(lead));
    }

    /**
     * Get a summary status based on validation results
     * @param {Object} emailResult - Email validation result
     * @param {Object} phoneResult - Phone validation result
     * @returns {Object} Summary with status and risk level
     */
    getValidationSummary(emailResult, phoneResult) {
        let emailStatus = 'unknown';
        let phoneStatus = 'unknown';
        let overallRisk = 'unknown';

        // Email status determination
        if (emailResult && emailResult.success) {
            if (!emailResult.valid) {
                emailStatus = 'invalid';
            } else if (emailResult.fraud_score >= 75 || emailResult.disposable || emailResult.honeypot) {
                emailStatus = 'high_risk';
            } else if (emailResult.fraud_score >= 50 || emailResult.suspect || emailResult.recent_abuse) {
                emailStatus = 'medium_risk';
            } else if (emailResult.fraud_score >= 25) {
                emailStatus = 'low_risk';
            } else {
                emailStatus = 'clean';
            }
        }

        // Phone status determination
        if (phoneResult && phoneResult.success) {
            if (!phoneResult.valid) {
                phoneStatus = 'invalid';
            } else if (phoneResult.fraud_score >= 75 || phoneResult.VOIP || phoneResult.risky) {
                phoneStatus = 'high_risk';
            } else if (phoneResult.fraud_score >= 50 || phoneResult.recent_abuse || phoneResult.prepaid) {
                phoneStatus = 'medium_risk';
            } else if (phoneResult.fraud_score >= 25) {
                phoneStatus = 'low_risk';
            } else {
                phoneStatus = 'clean';
            }
        }

        // Overall risk determination (take the higher risk)
        const riskLevels = ['clean', 'low_risk', 'medium_risk', 'high_risk', 'invalid', 'unknown'];
        const emailRiskIndex = riskLevels.indexOf(emailStatus);
        const phoneRiskIndex = riskLevels.indexOf(phoneStatus);
        overallRisk = riskLevels[Math.max(emailRiskIndex, phoneRiskIndex)];

        return {
            emailStatus,
            phoneStatus,
            overallRisk,
            emailFraudScore: emailResult?.fraud_score ?? null,
            phoneFraudScore: phoneResult?.fraud_score ?? null
        };
    }
}

module.exports = new IPQSService();
