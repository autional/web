---
title: "The 7 Most Common Authentication Mistakes (And How to Fix Them)"
date: "2026-05-26"
category: "Security"
tags: ["Anti-Patterns", "Security Mistakes", "Best Practices"]
readTime: "7 minutes"
excerpt: "These authentication mistakes — you may be making them every day. From hardcoded API keys to non-expiring JWTs, from unsalted passwords to logging sensitive information — this article covers 7 of the most common identity anti-patterns, each with a real-world data breach case and actionable fixes. How Autional eliminates these mistakes at the architectural level? Read on."
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

There's a saying in the security community: attackers don't need to discover new vulnerabilities — they just need to find the known issues you haven't fixed.

This is especially true in authentication. The following 7 mistakes were already emphasized in the OWASP Top 10 from a decade ago, yet in 2026, they still appear in every security audit report as "high-risk findings."

## Mistake 1: Hardcoded API Keys and Secrets in Code

### Why It's Dangerous

In 2025, GitHub's automated scanning detected over 2 million public repositories containing commits with suspected secrets. Once your API key, database password, or JWT signing key appears in code, it lives forever in git history — even if you delete the file and commit again.

Worse still, attackers have built automated GitHub scanning tools that can extract keys within seconds of a new commit being pushed and attempt to use them immediately.

### Real-World Case

In 2024, a $1.5 billion AI startup suffered an incident when an engineer committed a configuration file containing AWS root account keys to a public GitHub repository. Within 4 hours, the attacker had spun up hundreds of GPU instances for cryptomining, generating a $650,000 bill.

### How to Fix

```
Wrong:
const API_KEY = "tk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"  // Hardcoded

Right:
const API_KEY = process.env.AUTHMS_API_KEY  // Environment variable
if (!API_KEY) throw new Error("AUTHMS_API_KEY not set")
```

Going further:
- Migrate all secrets to a Key Management Service (KMS) or Vault
- Integrate secret scanning (e.g., GitGuardian, truffleHog) in CI/CD to block commits containing keys
- Use `.gitignore` to exclude all configuration files containing secrets
- Immediately rotate any potentially leaked keys

**How Autional prevents this**: After creation, an API Key's full value is shown only once. The database stores only a SHA-256 hash. Even if someone accesses the database, they cannot retrieve the API Key plaintext. Internal service secrets (JWT signing keys, encryption DEKs) are injected via environment variables or managed by KMS — hardcoding in config files is prohibited. The CI check scripts scan all Go source and configuration files for hardcoded secret patterns.

## Mistake 2: Login Endpoint Without Rate Limiting

### Why It's Dangerous

A login endpoint without rate limiting is an open invitation to credential stuffing. Attackers don't need sophisticated techniques — just a dictionary of common passwords and a script that can send HTTP requests.

### Real-World Case

In the 2023 23andMe data breach, attackers didn't exploit any system vulnerabilities. They used **credential stuffing** — obtaining username/password combinations from other data breaches and trying them one by one. Without effective rate limiting and anomaly detection, attackers compromised approximately 14,000 accounts over several weeks and scraped genealogical data from millions of users through these accounts.

### How to Fix

Implement at least three layers of rate limiting:
1. IP-level: no more than 30 requests per minute from the same IP
2. User-level: no more than 10 login attempts per minute for the same user
3. Global-level: overall request rate cap on the login endpoint

```
// Right — server-side rate limiting
app.post('/login', rateLimiter({
  windowMs: 60 * 1000,   // 1-minute window
  max: 30,               // Maximum 30 requests
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests' })
  }
}), loginHandler)
```

**How Autional prevents this**: The gateway-service has built-in three-layer distributed rate limiting (IP-level, user-level, global-level), supporting token bucket and sliding window algorithms with Redis-based cross-instance counting. A progressive penalty strategy is applied when rate limits are triggered.

## Mistake 3: Storing Passwords with MD5 or SHA-1

### Why It's Dangerous

MD5 and SHA-1 are **general-purpose hash functions** designed to be as fast as possible. Password hashing needs the exact opposite — **as slow as possible**. GPUs can compute billions of MD5/SHA-1 hashes per second, making brute-force attacks extremely efficient.

### Real-World Case

In 2012, LinkedIn suffered a breach of 6.5 million password hashes. LinkedIn used **unsalted SHA-1**. After the leak, security researchers cracked 90% of the passwords within 72 hours. Worse still, these cracked passwords were used for credential stuffing attacks on other sites — because a large number of users reuse the same password across different websites.

### How to Fix

Always use dedicated password hashing functions: bcrypt, scrypt, or argon2id.

```
Wrong:
hash = md5(password)          // Don't. Just don't.
hash = sha1(password)         // Same
hash = sha256(password + "fixed_salt")  // Still not enough

Right:
hash = bcrypt(password, cost=12)  // Simplest choice
hash = argon2id(password, time=3, memory=65536, parallelism=4)  // Best choice
```

If migrating from an old scheme:
1. Record the current hashing algorithm in the database
2. On the user's next login: verify with old algorithm → if passes, rehash with new algorithm → update database
3. Flag migrated users; those still on old hashes are asked to reset their password after N months

**How Autional prevents this**: The identity-service uses bcrypt by default (cost factor=12) with automatic random salts built into the hash. The Argon2id interface is reserved with support for transparent migration. CI prohibits any MD5/SHA-1 usage in password-related code.

## Mistake 4: JWT Without Expiration

### Why It's Dangerous

A JWT without an `exp` claim is theoretically valid forever. If your system issues such JWTs, an attacker who obtains any one of them can access your system permanently as that user.

A more subtle variant: the JWT has an expiration time, but it's too long — e.g., `exp` set to current time + 365 days. This is nearly as dangerous as having no expiration, because a stolen token can be abused for an entire year.

### How to Fix

Use the short-lived Access Token + long-lived Refresh Token pattern:

```
Access Token (JWT): valid for 15 minutes, used for API call authentication
Refresh Token (opaque string): valid for 7 days, used only to obtain new Access Tokens
```

```go
// Right way
token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
    "sub": userID,
    "exp": time.Now().Add(15 * time.Minute).Unix(),  // Short-lived
    "iat": time.Now().Unix(),
    "jti": generateJTI(),                             // For revocation
})
```

**How Autional prevents this**: The identity-service enforces `exp` (default 15 minutes), `iat`, and `jti` when signing JWTs. Refresh tokens are bound to the session-service, supporting instant revocation. The maximum Access Token validity period is configurable, with system administrators able to set an upper limit.

## Mistake 5: Admin Accounts Without Mandatory MFA

### Why It's Dangerous

Your system may enforce MFA for all regular users, but if you relax the requirement for admin accounts, you leave the most vulnerable entry point open for the most destructive attackers.

The admin panel is usually the attacker's ultimate target — because it provides access to all user data, system configurations, and audit logs. A compromised admin account without MFA is like handing the attacker a master key.

### Real-World Case

In the 2020 Twitter internal tool hack, attackers used social engineering to obtain Twitter employee credentials — because those employee accounts did not have mandatory MFA. Using internal management tools, the attackers took over 130 high-profile accounts (including Barack Obama, Elon Musk, Bill Gates) and posted Bitcoin scam messages.

If those employee accounts had been required to use hardware security keys (FIDO2), this attack would have been stopped at the first step — because attackers cannot obtain physical keys through remote social engineering.

### How to Fix

```
Minimum MFA requirements for admin accounts:
├── Must be FIDO2/WebAuthn (not SMS OTP or TOTP alone)
├── Must use a hardware security key (not just platform authenticator)
├── Must verify at every login (no "remember this device")
└── MFA device loss requires an approval workflow to recover (not self-service)
```

**How Autional prevents this**: The RBAC system's predefined `super_admin` role mandates FIDO2/WebAuthn (and this is how Autional itself operates). Sensitive operations in the admin console (creating API Keys, modifying permissions, viewing audit logs) trigger secondary MFA verification. Admin MFA status is continuously monitored — accounts without MFA enabled are flagged and alerted.

## Mistake 6: Logging Sensitive Information Like Passwords and Tokens

### Why It's Dangerous

Logging systems are typically accessible to all developers and operations staff. If a login request is fully recorded in logs — including the plaintext password — then everyone who can see the logs effectively knows the user's password.

Moreover, logs are usually sent to centralized logging systems (ELK, Loki, CloudWatch), whose access controls are often less strict than databases. Logs may also be backed up to cloud storage, further expanding the exposure surface.

### Real-World Case

In 2019, Facebook admitted that "millions" of Instagram users' passwords were stored in plaintext within its internal logging systems. These logs were accessible to over 2,000 Facebook employees. While no evidence of internal abuse was found, the incident itself was a serious violation of GDPR and fundamental security principles.

### How to Fix

```
Wrong:
logger.Info("login attempt", 
  "username", req.Username, 
  "password", req.Password,    // ← Plaintext password in logs!
  "ip", req.IP)

Right:
logger.Info("login attempt",
  "user_id", userID,
  "ip", req.IP,
  "result", "success")  // Never log passwords/tokens

// Going further: request body redaction
type LoginRequest struct {
    Username string `json:"username"`
    Password string `json:"password" log:"-"`  // Marked as not logged
}
```

**How Autional prevents this**: The logging middleware automatically redacts all known sensitive fields (`password`, `password_hash`, `access_token`, `refresh_token`, `api_key`, `credit_card`, `id_number`). GORM fields marked as sensitive (`json:"-"`) are automatically replaced with `[REDACTED]` in log output. CI checks prohibit `slog.String("password", ...)` patterns.

## Mistake 7: No Session Revocation Mechanism

### Why It's Dangerous

When a user changes their password, an anomalous login is detected, or an administrator finds suspicious activity, they must be able to **immediately** terminate the relevant sessions. Without this capability, an attacker can continue accessing the system with the old session even after a password change — because their Session or JWT has not yet expired.

### Real-World Case

In 2022, a major customer of a SaaS collaboration platform reported that after they terminated an employee and deactivated their account, the former employee could still access company data through an already-logged-in mobile app session for up to 48 hours — because the system had no mechanism to revoke mobile sessions.

### How to Fix

```
Complete session revocation capability:
1. User changes password → Automatically revoke all sessions for that user
2. User selects "log out of all devices" → Revoke all sessions except current
3. Admin disables a user → Immediately terminate all sessions
4. Anomalous login detected → Revoke the anomalous session, notify the user
5. Admin views and manually terminates suspicious sessions
```

```go
// Revoke all sessions for a user
func RevokeAllSessions(ctx context.Context, userID string) error {
    return sessionService.RevokeByUserID(ctx, userID)
}

// Revoke a single session
func RevokeSession(ctx context.Context, sessionID string) error {
    return sessionService.Revoke(ctx, sessionID)
}
```

**How Autional prevents this**: The session-service maintains a complete record of all active sessions. It provides `DELETE /sessions?user_id=X` and `DELETE /sessions/{session_id}` APIs for instant revocation. Events such as password changes, account deactivation, and anomaly detection automatically trigger corresponding session revocations. Even with JWTs (which are inherently non-revocable), the gateway-service re-checks session validity with the session-service when processing sensitive operations.

## Anti-Pattern Quick Reference

| # | Anti-Pattern | Risk Level | Fix Priority | Autional Defense |
|---|-------------|------------|--------------|----------------|
| 1 | Hardcoded secrets | Critical | Immediate | KMS management + CI scanning |
| 2 | No rate limiting on login | High | Within the week | Three-layer distributed rate limiting |
| 3 | MD5/SHA1 passwords | Critical | Within the week | bcrypt + transparent migration |
| 4 | JWT without expiration | Critical | Immediate | Mandatory exp + short TTL |
| 5 | Admin without MFA | Critical | Immediate | RBAC-enforced FIDO2 |
| 6 | Logging passwords | High | Within the week | Auto-redaction middleware |
| 7 | No session revocation | High | Within the month | session-service |

## Conclusion

These 7 mistakes share a common characteristic: **they exist not because the technology is too complex, but because security awareness is insufficient.** Every mistake has a proven, ready-made solution. The problem isn't "how to fix it" — it's "realizing it needs fixing."

Autional bakes every one of these defenses into its architecture — not as optional "security features," but as non-bypassable architectural constraints. Applications built with Autional avoid these mistakes by default. If you're building your own identity system, go through this checklist item by item. You might be surprised at how many look "familiar."
