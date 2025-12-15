# Security Audit Report

**Date:** December 15, 2025
**Project:** FTDM3 Lead Management Platform

## Executive Summary

A comprehensive security audit was performed on the FTDM3 codebase. The audit identified **3 Critical/High** severities, **4 Medium** severities, and several low-priority issues. The most critical issues involve hardcoded credentials in source code, a potential Cross-Site Scripting (XSS) vulnerability in the chat component, and a security downgrade risk in the 2FA logic.

---

## 1. Critical & High Severity Issues

### 1.1 Hardcoded Credentials in `agentScraperService.js` (Critical)

**Location:** `backend/services/agentScraperService.js` (Lines 26-27)
**Issue:** Default credentials are hardcoded directly into the codebase as fallback values.

```javascript
this.scraperCredentials = {
  username: process.env.SCRAPER_USERNAME || "admiin",
  password: process.env.SCRAPER_PASSWORD || "AdminPBX@123",
};
```

**Risk:** If the environment variables are not set, these default credentials are used. Attackers with access to the codebase (or if this code is open-sourced/leaked) can use these credentials to access the scraper service.
**Recommendation:** Remove hardcoded defaults. Throw an error if environment variables are missing.

### 1.2 Stored XSS in Chat Window (High)

**Location:** `frontend/src/components/ChatWindow.jsx` (Lines 2346, 2497)
**Issue:** The application uses `dangerouslySetInnerHTML` to render message content without clear evidence of sanitization in the visible code path.

```javascript
dangerouslySetInnerHTML={{
  __html: message.highlightedContent || message.content
}}
```

**Risk:** If a malicious user sends a message containing a script tag (e.g., `<img src=x onerror=alert(1)>`), it will be executed in the browser of any user viewing the chat. This can lead to session hijacking (stealing cookies/tokens).
**Recommendation:**

1. Avoid `dangerouslySetInnerHTML` if possible.
2. If rich text is required, use a sanitization library like `dompurify` **before** rendering.

### 1.3 Potential Credential Leak in `env.example` (High)

**Location:** `backend/env.example` (Line 57)
**Issue:** The example environment file contains what appears to be a real password:

```properties
GOIP_GATEWAY_PASSWORD=Greedisgood10!
```

**Risk:** If this file is committed to a public repository, it exposes the gateway password.
**Recommendation:** Replace with a dummy value like `your-password-here`.

### 1.4 2FA Security Downgrade Risk (High)

**Location:** `backend/controllers/auth.js` (Lines 425-433)
**Issue:** If 2FA secret decryption fails (e.g., due to key rotation issues or configuration errors), the system automatically disables 2FA for the user.

```javascript
await User.findByIdAndUpdate(userId, {
  twoFactorEnabled: false,
  // ...
});
```

**Risk:** This "fail-open" behavior allows a potential security bypass. If an attacker can trigger a decryption error (or if the environment is misconfigured), the account loses its 2FA protection automatically.
**Recommendation:** "Fail closed". Do not disable 2FA automatically on system errors. Log the error and require administrator intervention or a secure manual reset flow (e.g., email recovery).

---

## 2. Medium Severity Issues

### 2.1 Missing Global Rate Limiting (Medium)

**Location:** `backend/server.js`
**Issue:** `express-rate-limit` is imported but not applied globally. It is only used in specific routes (like `twoFactor.js`) or not effectively wired up for the main app.
**Risk:** Endpoints without rate limiting are vulnerable to Denial of Service (DoS) attacks and brute-force attempts.
**Recommendation:** Apply a global rate limiter middleware in `server.js`, with stricter limits for auth routes.

### 2.2 Potential DoS via Large File Uploads (Medium)

**Location:** `backend/controllers/chatImages.js`
**Issue:** The file upload limit is set to **50MB** for chat images.

```javascript
MAX_FILE_SIZE: 50 * 1024 * 1024; // 50MB
```

**Risk:** Concurrent uploads of 50MB files could quickly exhaust server memory or bandwidth, leading to a DoS condition.
**Recommendation:** Reduce the limit to a more reasonable size for chat images (e.g., 5-10MB).

### 2.3 Account Switching Logic Complexity (Medium)

**Location:** `backend/controllers/auth.js` (`switchAccount`)
**Issue:** The logic allows switching to any account in `linkedAccounts`. While it checks for the link, the security relies entirely on the integrity of the `linkedAccounts` array.
**Recommendation:** Ensure strictly tested access controls on the "link account" administrative function to prevent unauthorized linking.

---

## 3. Low Severity & Best Practices

- **Outdated Dependencies:** `express` is at version `4.18.2`. Consider upgrading to the latest stable version.
- **Console Logs:** Production code contains `console.log` statements which might clutter logs or leak non-critical info. Use a proper logging library (like `winston`) and disable debug logs in production.
- **CSP Configuration:** The Content Security Policy allows `'unsafe-inline'` for styles. While common, it reduces protection against some XSS vectors.

## 4. Conclusion

The codebase is generally well-structured with good use of `express-validator` and standard auth practices (JWT, bcrypt). However, the **hardcoded credentials**, **XSS vulnerability**, and **2FA fail-open logic** require immediate attention.

## 5. Immediate Action Plan

1.  **PATCH:** Remove hardcoded credentials from `agentScraperService.js`.
2.  **PATCH:** Implement `dompurify` in `ChatWindow.jsx`.
3.  **CLEANUP:** Sanitize `backend/env.example`.
4.  **FIX:** Change 2FA error handling to fail-closed.
5.  **CONFIG:** Add global rate limiting.
