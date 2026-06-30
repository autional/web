---
title: "SaaS Security Self-Checklist: 30 Identity Security Items You Must Check"
date: "2026-05-28"
category: "Security"
tags: ["Security Checklist", "SaaS", "Best Practices"]
readTime: "8 min"
excerpt: "A 30-item identity security checklist for SaaS product owners and technical decision-makers. Covers eight domains: password policy, MFA enforcement, session management, API security, audit logging, data encryption, access control, and supply chain security. Each item includes 'What to check' and 'How Autional does it.' Complete a systematic security self-audit in 30 minutes."
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

Identity security is the first and most important line of defense for SaaS products. According to Verizon's 2025 Data Breach Investigations Report, 86% of SaaS data breaches involve compromised or misused identity credentials.

This checklist covers 8 security domains and 30 specific checks. Each item has three parts: **What to check** (assessment criteria), **Why it matters** (risk description), and **How Autional does it** (reference implementation).

> **Compliance Note**: The "How Autional does it" sections describe design goals and reference implementations of the Autional platform and do not constitute legal statements of security compliance. The ultimate responsibility for security compliance rests with each SaaS product provider.

## I. Password Policy (6 Items)

### 1. Enforce Minimum Password Length ≥ 8 Characters

**What to check**: Does your system allow short passwords (6 characters or fewer)? Is a minimum length enforced?

**Why it matters**: An 8-character random password takes about 8 days to brute-force (SHA-256 GPU), while a 6-character one takes only 30 minutes. Each additional character makes cracking exponentially harder.

**How Autional does it**: identity-service defaults to a minimum password length of 8. Tenant admins can adjust it to 12, 16, or even 20 characters via password policy. Length is enforced during registration and password changes.

### 2. Block Commonly Used Weak Passwords

**What to check**: Does the system accept passwords like `123456`, `password`, `admin123`?

**Why it matters**: NordPass statistics show `123456` remains the most commonly used password globally. These are the first entries in attackers' dictionary attacks.

**How Autional does it**: Built-in blacklist of 100,000 commonly used weak passwords based on Have I Been Pwned's Pwned Passwords dataset. Passwords are checked in real-time against the blacklist during setup. The blacklist updates regularly.

### 3. Use bcrypt/scrypt/argon2 for Password Hashing

**What to check**: How are passwords stored in the database? Hashed or plaintext? If hashed, is it MD5/SHA1 or bcrypt?

**Why it matters**: In the 2012 LinkedIn breach of 6.5M passwords, unsalted SHA-1 was used—90% were cracked within 72 hours.

**How Autional does it**: Default bcrypt (cost factor=12), hashes automatically include random salt. Argon2id interface is reserved for transparent upgrades—user's hash is auto-migrated on next login.

### 4. Password Expiration Policy

**What to check**: Is there a periodic password expiration mechanism (e.g., 90 days)? Password history (preventing reuse of the last N passwords)?

**Why it matters**: Password leaks can be silent—a password leaked six months ago might never have been used by an attacker. Mandatory periodic changes reduce the window of risk.

**How Autional does it**: Configurable password expiration (30/60/90/180 days), password history (stores last 5-24 password hashes).

### 5. Account Lockout Mechanism

**What to check**: After N consecutive failed attempts, is the account temporarily locked? Is the lock duration reasonable?

**Why it matters**: A login endpoint without lockout is completely defenseless against brute-force attacks. Attackers can try password combinations indefinitely.

**How Autional does it**: Default: 5 failures → 30-minute lockout. Progressive lockout: 1st: 5 min, 2nd: 30 min, 3rd: 2 hours, 4th: requires admin unlock.

### 6. Password Strength Indicator

**What to check**: Is there a strength indicator when users set a password? Does it suggest including uppercase, numbers, special characters?

**Why it matters**: If users don't know why their password is weak, they won't actively choose strong ones. A good strength indicator can reduce weak password rates by 40%.

**How Autional does it**: The login page (auth-pages) has a built-in password strength indicator that evaluates and displays strength in real-time (Weak/Medium/Strong/Very Strong), based on password entropy rather than simple rules.

## II. Multi-Factor Authentication (5 Items)

### 7. Is MFA Enabled Globally or Per User Group?

**What to check**: Is MFA globally mandatory or optional? Can it be mandatory for admins and optional for regular users?

**Why it matters**: MFA can prevent 99.9% of account compromises. But blanket enforcement on all users may drive some away. The best strategy: mandatory for privileged roles, recommended for regular users.

**How Autional does it**: MFA policy can be configured per tenant, role group, or individual user. MFA (WebAuthn) is mandatory for admins by default; regular users can optionally enable TOTP.

### 8. Which MFA Methods Are Supported?

**What to check**: Does the system support TOTP? FIDO2/WebAuthn hardware keys? SMS OTP?

**Why it matters**: Different MFA methods have vastly different security levels. SMS OTP can be bypassed via SIM swap attacks, while FIDO2 has protocol-level phishing resistance.

**How Autional does it**: mfa-service fully supports TOTP, WebAuthn (FIDO2), HOTP, SMS OTP, and Backup Codes. Admins can configure the allowed MFA method list.

### 9. Is There an MFA Recovery Mechanism?

**What to check**: How do users recover when they lose their MFA device (new phone, damaged hardware key)? Are there Backup Codes or an admin reset channel?

**Why it matters**: Without a recovery mechanism, users can be permanently locked out if they lose their device. But if the recovery mechanism is too weak (e.g., just answering security questions), protection is meaningless.

**How Autional does it**: Three recovery mechanisms: (1) 10 one-time Backup Codes auto-generated on MFA registration; (2) Admin approval workflow to reset MFA; (3) Support for multiple MFA devices per user (primary + backup).

### 10. Is There an MFA Skip/Remember Device Mechanism?

**What to check**: Can users skip MFA for a period (e.g., "Trust this device for 30 days")?

**Why it matters**: If MFA is required every single login, users get frustrated and may try to bypass it. Trusted device mechanisms balance convenience and security.

**How Autional does it**: Supports "Remember this device"—records a device fingerprint hash, re-requires MFA after a configurable number of days or when the device fingerprint changes.

### 11. Adaptive MFA: Adjust Authentication Strength Based on Risk?

**What to check**: Can the system identify anomalous login behavior (new location, new device, unusual time) and automatically escalate authentication requirements?

**Why it matters**: Traditional MFA treats everyone the same. The same user logging in from the corporate network vs. an overseas location faces the same verification—the former is interrupted unnecessarily, the latter is under-protected.

**How Autional does it**: The adaptive MFA engine uses a 7-dimensional risk score (device fingerprint, IP reputation, geolocation, behavior patterns, time factors, failure history, sensitive operation context) to dynamically determine authentication strength. Low risk: skip MFA; high risk: mandate WebAuthn.

## III. Session Management (4 Items)

### 12. Absolute Timeout and Idle Timeout?

**What to check**: Are login sessions permanent? Is there an auto-logout mechanism for inactivity?

**Why it matters**: Sessions that never expire mean a forgotten browser tab could still access enterprise systems months later. Extremely risky.

**How Autional does it**: session-service supports dual timeout: absolute timeout (e.g., force re-authentication after 8 hours) and idle timeout (e.g., logout after 30 minutes of inactivity). Both are tenant-configurable.

### 13. Single-Device Login or Concurrency Limits?

**What to check**: Can the same user log in on multiple devices simultaneously? Is there a maximum concurrent session limit?

**How Autional does it**: session-service globally tracks all active sessions per user. Admins can set a maximum concurrent session count (e.g., 3); when exceeded, the earliest session is forcibly terminated or new logins are rejected.

### 14. Can Sessions Be Immediately Revoked?

**What to check**: When a security event is detected (e.g., compromised account), can an admin immediately terminate all active sessions for that user?

**Why it matters**: JWT's biggest weakness is the inability to instantly revoke—you must wait for token expiry or introduce a blacklist. Instant revocation is a fundamental requirement for security incident response.

**How Autional does it**: session-service provides `DELETE /sessions?user_id=X` API to immediately terminate all active sessions. The JWT's `jti` is bound to the Session ID; gateway-service verifies session validity against session-service for sensitive operations.

### 15. Are Session Cookies Set with Secure, HttpOnly, SameSite?

**What to check**: Are session cookie attributes configured securely?

**How Autional does it**: `Set-Cookie` response headers enforce `Secure=true; HttpOnly=true; SameSite=Lax`. In HTTPS-only environments, cookies are inaccessible to JavaScript and cannot be carried in cross-site requests.

## IV. API Security (4 Items)

### 16. Are Login and API Endpoints Rate-Limited?

**What to check**: Is there rate limiting on the login endpoint? Is there global rate limiting on APIs?

**How Autional does it**: gateway-service implements three-layer rate limiting: IP-level (60s window, 30 requests), user-level (5min window, 10 requests), global-level (10s window, 500 requests). Redis-backed distributed rate limiting enables shared counting across multiple gateway instances.

### 17. Do Inter-Service APIs Use Internal Authentication?

**What to check**: Do microservice-to-microservice API calls require authentication? Or are they exposed (assuming the internal network is safe)?

**Why it matters**: Zero-trust architecture requires internal API authentication even within the network. "Safe inside the castle walls" is an outdated security model. Once attackers breach outer defenses, unauthenticated internal APIs are defenseless.

**How Autional does it**: Internal APIs enforce `X-API-Key` authentication via the `auth_mw.InternalAPIKeyAuth()` middleware. Internal API keys are injected through environment variables, not read from config files.

### 18. Are API Keys Stored and Used Correctly?

**What to check**: Are API keys stored in plaintext or hashed in the database? Can the full key be viewed again after creation?

**How Autional does it**: API keys are stored as SHA-256 hashes. The full key is shown to the user only once at creation time. After that, only a prefix is visible (e.g., `tk_a1b2c3d4****`). Verification compares hashes, not plaintext.

### 19. Is an IP Whitelist Supported?

**What to check**: Can API keys be restricted to specific IP addresses or IP ranges?

**How Autional does it**: Each API key can have a configured IP whitelist. gateway-service checks the requesting IP against the whitelist during API key verification.

## V. Audit Logging (3 Items)

### 20. Are All Authentication-Related Events Recorded?

**What to check**: Are login success/failure, password changes, MFA registration/verification, permission changes, etc. fully logged in the audit trail?

**How Autional does it**: audit-service records comprehensive audit logs for all authentication events (who, what action, when, what IP, what result). Logs use a hash chain to ensure immutability.

### 21. Are Audit Logs Tamper-Proof?

**What to check**: Can administrators with database access delete or modify audit logs?

**How Autional does it**: audit-service uses a hash chain (each log's hash includes the previous log's hash) and a Merkle tree to provide cryptographic integrity proof for audit logs. Any insertion, deletion, or modification of a single log breaks the hash chain and is detectable.

### 22. Is PII Masked in Logs?

**What to check**: Are sensitive details like passwords, tokens, or ID numbers accidentally recorded in logs?

**How Autional does it**: The logging middleware auto-masks PII fields (phone numbers, email addresses, ID numbers) and sensitive fields (password_hash, access_token, api_key). Only masked versions are retained.

## VI. Data Encryption (3 Items)

### 23. Are There Unencrypted PII Fields in the Database?

**What to check**: Are users' phone numbers, email addresses, ID numbers, etc. stored in plaintext or ciphertext in the database?

**How Autional does it**: PII fields use AES-256-GCM field-level encryption. Encryption keys are managed via cloud KMS, existing only in process memory—never in plaintext on disk.

### 24. Is There an Encryption Key Rotation Mechanism?

**What to check**: How often are encryption keys (for PII encryption, JWT signing) rotated?

**How Autional does it**: Data Encryption Keys (DEK) rotate every 90 days; KMS master keys rotate every year. JWT signing keys use JWK format with auto-generated `kid` (Key ID), supporting smooth transition during key rotation.

### 25. Is Data Encrypted in Transit?

**What to check**: Is all API communication over HTTPS/TLS? Is inter-service communication encrypted?

**How Autional does it**: External APIs enforce HTTPS (HTTP requests auto-redirect). Internal gRPC communication uses mTLS (mutual TLS), with both server and client verifying each other's certificates.

## VII. Access Control (3 Items)

### 26. Is the Principle of Least Privilege Implemented?

**What to check**: Do users have more permissions than they need? Are admin accounts used for daily operations?

**How Autional does it**: RBAC (Role-Based Access Control) system with predefined roles (Super Admin, Admin, Security Admin) and custom roles. Permissions can be granular down to individual API endpoints. Supports permission simulation and reverse query.

### 27. Is Multi-Tenant Data Isolation in Place?

**What to check**: Are different tenants' data fully isolated? Can one tenant access another's data?

**How Autional does it**: All database queries enforce `WHERE tenant_id = ?`. Middleware extracts `tenant_id` from JWT and injects it into context; the Service layer auto-injects tenant filtering on all queries. Cross-tenant data access is architecturally impossible.

### 28. Is There Separation of Duties (SoD) Control?

**What to check**: Are there conflicting roles that cannot be held by the same user simultaneously (e.g., approver and applicant)?

**How Autional does it**: The RBAC system supports Static SoD (Separation of Duties), defining mutually exclusive role pairs (e.g., "Admin" and "Auditor"). When a user is assigned conflicting roles, the system rejects the operation and triggers an alert.

## VIII. Supply Chain & Compliance (2 Items)

### 29. Are Third-Party Dependencies Regularly Audited?

**What to check**: Do your open-source libraries and SaaS dependencies have known vulnerabilities? When was the last audit?

**How Autional does it**: All Go dependencies use `go mod tidy` with regular `govulncheck` scanning. Docker images are based on minimal Distroless base images, reducing the attack surface.

### 30. Are There Compliance Certifications or Framework Benchmarks?

**What to check**: Which security frameworks does your system align with (SOC 2, ISO 27001, MLPS 2.0)? Is there a certification plan?

**How Autional does it**: Autional is pursuing SOC 2 Type II certification. It has built-in capabilities for MLPS Level 3 requirements including identity authentication, access control, security audit, and data encryption. Provides automated compliance evidence collection and export.

## Self-Assessment Scoring

Score 1 point for each item passed, total 30 points.

| Score | Level | Action |
|-------|-------|--------|
| 25-30 | Security mature | Maintain and continuously monitor |
| 18-24 | Basically adequate | Fill gaps, prioritize 1-star and 2-star items |
| 10-17 | At risk | Immediate security hardening project required |
| 0-9 | Critical | Your system is exposed—urgent action needed |

The goal of this checklist isn't to score 30 points—it's to identify your security blind spots. Every missing item corresponds to a real potential security incident.
