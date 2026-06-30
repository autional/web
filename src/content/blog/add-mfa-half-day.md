---
title: "From 0 to 1: Adding MFA to Your Existing System in Half a Day"
date: "2026-05-06"
category: "Project"
tags: ["MFA", "Quick Integration", "Dev Efficiency"]
readTime: "6 min"
excerpt: "Traditionally, adding multi-factor authentication to an existing system takes months of development. With AuthMS, you can go from app registration to a fully functional MFA deployment in just half a day. This article walks you through the entire process step by step."
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

> **Integration Note**: The integration time estimates ("half a day", "3.5-5 months") described in this article are reference values based on ideal conditions. Actual integration time varies depending on existing system complexity, team experience, security policy requirements, and other factors. We recommend allocating sufficient testing and deployment time in project planning.

Multi-factor authentication (MFA) is one of the most effective defenses against account hijacking. Microsoft's research shows that MFA can block **99.9%** of account compromise attacks. China's MLPS 2.0 Level 3 explicitly requires the use of two or more combined authentication techniques, and the SOC 2 security standard also lists MFA as a key control.

Yet many teams still haven't adopted MFA — not because they don't need it, but because the investment seems too large. Implementing TOTP protocol, SMS sending, email sending, Passkey registration from scratch... a conservative estimate puts the development cycle at **3-6 months**.

AuthMS aims to compress this timeline to **half a day**.

## The Cost of Building MFA In-House

Before introducing the AuthMS approach, let's look at what building MFA yourself entails:

| Item | Work Involved | Estimated Time |
|------|---------------|---------------|
| TOTP Implementation | RFC 6238 protocol, seed key generation, time-based validation, window tolerance | 2 weeks |
| SMS Verification | SMS provider API integration, send/verify logic, abuse prevention, cost control | 2 weeks |
| Email Verification | Email template design, send queue, anti-spam policy, multi-provider failover | 1-2 weeks |
| Passkey/WebAuthn | FIDO2 attestation/assertion protocol, credential storage, cross-device compatibility | 3-4 weeks |
| MFA Enrollment Flow | User guidance pages, device binding, backup code generation and recovery | 2 weeks |
| MFA Auth Flow | Post-login secondary auth, Remember Device, session management | 2 weeks |
| Admin Console | MFA policy configuration, forced user enablement, device view and revocation | 2 weeks |
| Security Hardening | Seed key encryption, brute-force protection, anomaly detection | 1-2 weeks |
| Audit Logging | Device registration, auth success/failure, policy change records | 1 week |

**Total: approximately 14-19 weeks (3.5-5 months)**. This doesn't even include testing, security reviews, or ongoing maintenance after launch.

And this is just the development side. After go-live, your security team needs to monitor MFA usage — how many users have enabled it? Which users have disabled it? Are there suspicious device registration behaviors? All of this requires additional operational support.

## The AuthMS Solution: Everything Done in Half a Day

AuthMS implements MFA as a standalone `mfa-service` that provides MFA capabilities to all integrated applications via OAuth 2.0 / OIDC protocols. You don't need to implement any MFA logic in your application code.

### Step 1: Register Your Application (5 minutes)

Log into the AuthMS Admin Console and create an OAuth client:

- Enter the application name and callback URL
- Select the required scopes (openid profile email)
- Obtain your Client ID and Client Secret

### Step 2: Integrate OAuth Login (30 minutes)

Replace your application's existing login flow with the OAuth 2.0 authorization code flow.

**Backend code-to-token exchange example** (Express.js / 10 lines):

```javascript
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  const response = await fetch('https://auth.yourcompany.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.AUTHMS_CLIENT_ID,
      client_secret: process.env.AUTHMS_CLIENT_SECRET,
      redirect_uri: 'https://yourapp.com/auth/callback',
    }),
  });
  const tokens = await response.json();
  // Set session / cookie, complete login
  res.redirect('/');
});
```

The frontend just needs a "Sign in with AuthMS" button that redirects to the authorization page. The rest of the logic — including login, registration, password reset, and MFA flows — is all handled by AuthMS.

### Step 3: Enable MFA Policy (2 minutes)

In the Admin Console → MFA Policy page:

1. **Global Default Policy**: Select "Recommended Enable" mode — users can choose to set up MFA after login, not mandatory
2. **Admin Forced Policy**: Create a policy for the admin role → "Force Enable" → check both TOTP and Passkey
3. **Sensitive Operation Policy**: Configure operations like "Change Password" and "Change Security Settings" → force MFA secondary verification

Save. Done.

### User Experience Flow

After configuration, users' registration and login experience requires no additional code changes:

**New User Registration**:
1. Create an account on the AuthMS unified registration page → auto-login
2. Go to personal settings → click "Enable Multi-Factor Authentication"
3. Choose TOTP (recommended), scan the QR code with your phone to complete binding
4. System generates 10 one-time backup codes; users are advised to save them securely

**Existing User Login**:
1. Complete first-factor authentication with password/Passkey
2. If TOTP is enabled → enter the 6-digit code (or use phone biometric auto-fill)
3. Optionally check "Trust this device for 30 days" → subsequent logins skip MFA

**Admin Operations**:
1. View all users' MFA enrollment status in the Admin Console
2. Force-enable MFA or revoke device bindings for specific users
3. View MFA-related audit logs (who registered a device and when, who entered incorrect verification codes)

## Supported MFA Methods

AuthMS's `mfa-service` supports the following four authentication methods, which can be flexibly combined in policies:

| Method | Use Case | Security | User Experience |
|--------|---------|----------|----------------|
| **TOTP** (Time-based One-Time Password) | Recommended default, free, works offline | High | Scan QR code, enter 6 digits |
| **SMS Code** | Users less familiar with technology | Medium (SIM swap risk) | Auto-fill (mobile), enter 6 digits |
| **Email Code** | Users without a phone number | Medium | Click link or enter 6-digit code from email |
| **Passkey** (WebAuthn) | High-security scenarios | Highest | One-touch fingerprint/face auth |

All MFA methods share a unified state machine: Device Registered → Awaiting Activation → Activated → Revoked. Admins can view and manage all registered devices for each user.

## Underlying Implementation

Understanding AuthMS's MFA implementation helps explain why it's more secure than a self-built solution:

**TOTP Key Protection**:
- TOTP seed keys are encrypted with AES-256-GCM and stored in PostgreSQL
- The encryption key is not hardcoded — it's injected via environment variables and integrated with the configuration management system
- Keys are decrypted in memory only during verification and immediately cleared afterward

**Brute-Force Protection**:
- Consecutive incorrect TOTP codes trigger a cooldown period automatically (exponential backoff)
- After the cooldown ends, further incorrect attempts are required before entering another cooldown
- All failure records are logged in audit logs; abnormal brute-force patterns automatically trigger alerts

**Session Security**:
- After completing MFA verification, the session-service injects the `amr` (Authentication Methods Reference) claim into the token, recording which MFA method was used
- Inter-service API calls can check the `amr` field and reject requests that haven't completed MFA
- Trusted Device (Remember Device) is implemented via a separate encrypted cookie that auto-expires after 30 days

## Migrating Existing Users

What if your system already has users? AuthMS provides user import and progressive migration options:

1. **Bulk Import**: Import existing users via the Bulk Import API (password hashes can be preserved); users are guided to set up MFA on first login
2. **Progressive Migration**: Keep the old login page as a fallback; new users go through the AuthMS flow. Both login entry points coexist until migration is complete
3. **Silent Registration**: The legacy system calls AuthMS's internal API in the background, automatically creating an AuthMS account on the user's next login for a seamless migration

## Getting Started

AuthMS provides complete SDKs and documentation covering major languages and frameworks. Whether your system uses Node.js, Python, Java, Go, or PHP, there's a corresponding quick-start guide.

```bash
# Three steps to set up a local dev environment
git clone https://github.com/authms/authms-demo
cd authms-demo
docker compose up -d
```

Visit `http://localhost:11080` and experience the complete flow from user registration to MFA deployment in under 30 minutes.

---

**Multi-factor authentication is no longer a luxury — it's the baseline for modern application security.** AuthMS helps existing systems integrate MFA capabilities quickly.
