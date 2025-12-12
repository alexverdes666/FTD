// External API Integration Service
const axios = require('axios');

// External API configuration - hardcoded values
const DEFAULT_EXTERNAL_CONFIG = {
    affc: 'AFF-WSWOA0B3TE',
    bxc: 'BX-T3L4UBJ7H5AKS',
    vtc: 'VT-HP8XSRMKVS6E7',
    apiKey: '154e56bc-3585-4d80-8847-f313c207bc01',
    domain: 'weconvert.club',
    funnel: 'WEConvert',
    lang: 'en',
    landingLang: 'en'
};

class ExternalApiService {
    constructor() {
        this.config = DEFAULT_EXTERNAL_CONFIG;
    }

    // Get external configuration with URL parameter overrides
    getExternalConfig(queryParams = {}) {
        return {
            affc: queryParams.affc || this.config.affc,
            bxc: queryParams.bxc || this.config.bxc,
            vtc: queryParams.vtc || this.config.vtc,
            apiKey: queryParams.key || this.config.apiKey,
            domain: queryParams.domain || this.config.domain,
            funnel: queryParams.funnel || this.config.funnel,
            lang: queryParams.lang || this.config.lang,
            landingLang: queryParams.landingLang || this.config.landingLang
        };
    }

    // Get user location info
    async getLocationInfo(clientIp) {
        try {
            // Basic validation - the IP should already be validated by the route handler
            if (!clientIp || clientIp === 'localhost' || clientIp === '127.0.0.1' || clientIp === '::1') {
                console.log('⚠️ Invalid IP detected, using fallback');
                return { ip: '8.8.8.8', geo: 'US' };
            }

            const response = await axios.get(`https://ipinfo.io/${clientIp}/json`, {
                timeout: 5000
            });
            
            if (response.data && response.data.country) {
                return {
                    ip: clientIp,
                    geo: response.data.country
                };
            }
        } catch (error) {
            console.error('Error fetching location info:', error.message);
        }
        
        // Fallback to safe defaults
        return { ip: clientIp || '8.8.8.8', geo: 'US' };
    }

    // Validate form data
    validateFormData(formData) {
        const errors = [];
        
        if (!formData.firstName || formData.firstName.trim().length < 2) {
            errors.push('First name must be at least 2 characters');
        }
        
        if (!formData.lastName || formData.lastName.trim().length < 2) {
            errors.push('Last name must be at least 2 characters');
        }
        
        if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            errors.push('Please enter a valid email address');
        }
        
        // Phone validation - consistent with backend route validation
        if (!formData.phone || !formData.phone.trim()) {
            errors.push('Phone number is required');
        } else {
            // Check for invalid characters (same as backend route)
            if (!/^[\d\s\-\(\)\+]*$/.test(formData.phone)) {
                errors.push('Phone number contains invalid characters');
            } else {
                // Sanitize phone number (same as backend route)
                const sanitizedPhone = formData.phone.replace(/[\s\-\(\)\+]/g, '');
                
                // Check digit count (same as backend route)
                if (!/^\d{6,15}$/.test(sanitizedPhone)) {
                    errors.push('Phone number must be between 6 and 15 digits');
                }
            }
        }

        return errors;
    }

    // Submit lead to external API only
    async submitToExternalAPI(formData, clientIp, queryParams = {}, requestUrl = '') {
        try {
            // Validate form data first
            const validationErrors = this.validateFormData(formData);
            if (validationErrors.length > 0) {
                throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
            }

            const config = this.getExternalConfig(queryParams);
            const locationInfo = await this.getLocationInfo(clientIp);
            const SUB_ID = queryParams.subid || Date.now().toString();
            const landingURL = requestUrl || 'https://localhost:3000/landing';
            
            const apiData = {
                funnel: config.funnel,
                lang: config.lang,
                landingLang: config.landingLang,
                affc: config.affc,
                bxc: config.bxc,
                vtc: config.vtc,
                profile: {
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    email: formData.email,
                    password: "aA1234567&",
                    phone: formData.prefix + formData.phone.replace(/[^0-9]/g, '')
                },
                landingURL,
                ip: locationInfo.ip,
                geo: locationInfo.geo,
                subId: SUB_ID,
                utmId: queryParams.fbp || null
            };

            console.log('🚀 Submitting to external API:', `https://${config.domain}/api/external/integration/lead`);
            console.log('📤 Payload:', JSON.stringify(apiData, null, 2));

            const response = await axios.post(
                `https://${config.domain}/api/external/integration/lead`,
                apiData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'x-api-key': config.apiKey
                    },
                    timeout: 30000 // 30 seconds timeout
                }
            );

            console.log('✅ External API response:', response.data);

            return {
                success: true,
                redirectUrl: response.data.redirectUrl,
                message: response.data.message || 'Registration successful! Redirecting...',
                data: response.data
            };

        } catch (error) {
            console.error('❌ External API submission error:', error.response?.data || error.message);
            
            let errorMessage = 'External API submission failed';
            let statusCode = 500;
            
            // Handle different types of errors
            if (error.response) {
                // HTTP error response from external API
                statusCode = error.response.status;
                const errorData = error.response.data;
                
                if (errorData && typeof errorData === 'object') {
                    // Handle structured error response
                    if (errorData.error) {
                        errorMessage = errorData.error;
                    } else if (errorData.message) {
                        errorMessage = errorData.message;
                    } else if (errorData.success === false) {
                        errorMessage = 'External API returned failure status';
                    }
                } else if (typeof errorData === 'string') {
                    errorMessage = errorData;
                }
                
                // Handle specific HTTP status codes
                switch (statusCode) {
                    case 403:
                        if (errorMessage.includes('IP recently registered')) {
                            errorMessage = 'A registration from this location was recently submitted. Please try again later.';
                        } else if (errorMessage.includes('duplicate')) {
                            errorMessage = 'This email address has already been registered. Please use a different email.';
                        } else {
                            errorMessage = 'Registration blocked. Please contact support if this continues.';
                        }
                        break;
                    case 409:
                        errorMessage = 'This email address is already registered. Please use a different email.';
                        break;
                    case 422:
                        errorMessage = 'Invalid registration data. Please check your information and try again.';
                        break;
                    case 429:
                        errorMessage = 'Too many registration attempts. Please wait a moment and try again.';
                        break;
                    case 500:
                        errorMessage = 'External service temporarily unavailable. Please try again in a few minutes.';
                        break;
                    default:
                        if (!errorMessage || errorMessage === 'External API submission failed') {
                            errorMessage = `Registration service error (${statusCode}). Please try again.`;
                        }
                }
            } else if (error.request) {
                // Network error or no response
                errorMessage = 'Unable to connect to registration service. Please check your connection and try again.';
            } else if (error.message) {
                // Other error (validation, etc.)
                errorMessage = error.message;
            }

            // Create error object with additional info
            const errorObj = new Error(errorMessage);
            errorObj.statusCode = statusCode;
            errorObj.originalError = error;
            
            throw errorObj;
        }
    }
}

module.exports = new ExternalApiService(); 