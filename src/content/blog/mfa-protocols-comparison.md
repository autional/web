---
title: "Multi-Factor Authentication Protocol Comparison: TOTP vs HOTP vs FIDO2 vs SMS OTP"
date: "2026-05-20"
category: "Tech"
tags: ["MFA", "TOTP", "FIDO2"]
readTime: "10 min"
excerpt: "MFA isn't just 'one more verification code.' Different MFA protocols vary enormously in security, user experience, and phishing resistance. This article compares TOTP, HOTP, SMS OTP, and FIDO2/WebAuthn — the four mainstream MFA protocols — across working principles, security strengths, and applicable scenarios, and shows how AuthMS mfa-service delivers an optimal authentication experience through risk-based adaptive selection."
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

Multi-factor authentication (MFA) is the most effective defense against account takeover. Microsoft research shows MFA can block 99.9% of account compromises. But "MFA" is an umbrella term — the security gap between specific technical implementations is enormous.

This article puts four mainstream MFA protocols side by side, analyzing them layer by layer from the protocol level to the security level.

## Quick Overview of the Four MFA Protocols

| Protocol | Year Introduced | Standard | Authentication Factor | Interaction |
|----------|-----------------|----------|----------------------|-------------|
| SMS OTP | 1990s | No unified standard | Something you have (phone number) | Receive SMS, enter manually |
| HOTP | 2005 | RFC 4226 | Something you have (HMAC counter) | Hardware token or App display, enter manually |
| TOTP | 2008 | RFC 6238 | Something you have (HMAC time-sync) | App shows 6-digit code, enter manually |
| FIDO2 | 2018 | W3C + FIDO | Something you have (private key) + Something you are (biometric) | USB/NFC/BLE tap, or fingerprint/face confirm |

## SMS OTP: The Weakest MFA, but the Most Widespread

### How It Works

```
1. User enters phone number on login page
2. Server generates 4-6 digit random code, valid for 5 minutes
3. Server calls SMS gateway API to send the code to the user's phone
4. User receives SMS and enters the code
5. Server compares — match means pass
```

SMS OTP security relies on one assumption: **a phone number can uniquely and securely identify a user.** But in 2026, that assumption is very fragile.

### Security Weaknesses

**1. SIM Swap Attack**

Attackers use social engineering to request a SIM replacement from the carrier, transferring the target's phone number to a SIM card they control. Once successful, they can receive all SMS messages sent to that number — including MFA codes.

In 2024, the U.S. SEC's X (formerly Twitter) account was compromised via SIM swap + SMS OTP hijacking.

**2. SS7 Protocol Vulnerabilities**

SS7 (Signaling System No. 7) is the signaling protocol between telecom carriers, designed in the 1970s with几乎没有 security considerations. Attackers with SS7 access (typically through compromised smaller foreign carriers or black-market access) can intercept or redirect SMS messages.

**3. Phishing Attacks**

Users can enter an SMS code on a phishing site, and the attacker immediately relays it to the real site. This real-time phishing works perfectly against SMS OTP — because SMS OTP has no origin binding.

**4. No Encryption, No Integrity Protection**

SMS messages travel in plaintext over carrier networks. Base stations, core network equipment, international signaling gateways — any node can eavesdrop.

### Scorecard

| Dimension | Score | Notes |
|-----------|-------|-------|
| Security | ★★☆☆☆ | Vulnerable to SIM swap, SS7 hijacking, phishing |
| User Experience | ★★★☆☆ | Must wait for SMS delivery, poor experience with weak signal |
| Deployment Cost | ★★★★★ | Just an SMS gateway API, zero client deployment |
| Phishing Resistance | ★☆☆☆☆ | No origin binding, phishing sites can relay directly |
| Offline Usability | ★☆☆☆☆ | Depends on cellular network coverage |

## HOTP: Event-Based HMAC OTP

### How It Works

HOTP (HMAC-based One-Time Password) uses a shared secret and an incrementing counter to generate one-time passwords:

```
HOTP(K, C) = Truncate(HMAC-SHA-1(K, C))
Where:
  K = Shared secret (at least 128 bit, recommended 160 bit)
  C = 8-byte counter, increments after each use
  Truncate = Extract 6-8 decimal digits from HMAC result
```

```
Initialization:
  Server generates random secret K
  Server encodes K as URI or QR code (otpauth://hotp/...)
  User scans with App, App stores K, counter C initialized to 0

Authentication:
  Server sends challenge (waiting for user input)
  User presses hardware token button or App generate button
  App internally: C += 1, OTP = HOTP(K, C), display OTP
  User enters OTP
  Server: retrieves K and C from DB, computes OTP' = HOTP(K, C)
  If OTP == OTP', verification passes, C += 1

Counter sync issue:
  If the user accidentally presses the token (generates OTP but doesn't use it),
  the App's C and server's C become out of sync.
  Solution: server tries C, C+1, C+2... when verifying OTP
  (Window size configurable, typically 5-10)
```

### Characteristics

HOTP's defining feature is that it's **event-driven** — each OTP generation requires active user action. This is both an advantage (works offline, no clock sync needed) and a disadvantage (accidental presses cause counter drift).

Best suited for: hardware security tokens providing one-time passwords for employees in offline environments.

### Scorecard

| Dimension | Score | Notes |
|-----------|-------|-------|
| Security | ★★★☆☆ | HMAC-SHA1 cryptographic strength is adequate, but OTP can be phished |
| User Experience | ★★☆☆☆ | Must press button to generate, enter manually, counter sync issues |
| Deployment Cost | ★★★★☆ | Software App available, hardware tokens need distribution |
| Phishing Resistance | ★☆☆☆☆ | Like SMS OTP, OTP can be relayed |
| Offline Usability | ★★★★★ | No time sync needed, no network required |

## TOTP: Time-Based HMAC OTP

### How It Works

TOTP (Time-based One-Time Password) is a time variant of HOTP — replacing the counter with the current timestamp:

```
TOTP(K, T) = HOTP(K, floor(T / X))
Where:
  K = Shared secret (typically 80 bit, Base32 encoded as 16 characters)
  T = Current Unix timestamp (seconds)
  X = Time step (typically 30 seconds)
```

```
Example:
  K = "JBSWY3DPEHPK3PXP" (Base32)
  T = 1715692800 (some Unix timestamp)
  X = 30 seconds
  
  C = floor(1715692800 / 30) = 57189760
  OTP = TOTP(K, T)
  
  Valid for [T, T+29] — 30-second window
```

This is how your familiar Authenticator Apps (Google Authenticator, Authy, Microsoft Authenticator) work. A 6-digit number refreshes every 30 seconds with no network connection required.

### Security Hardening

**Time Sync Tolerance**

Client and server clocks can never be perfectly synchronized. Servers typically allow ±1 time step tolerance (allowing OTP from the previous or next 30-second window).

**Replay Protection**

Servers must remember recently verified OTPs to prevent reuse within the same 30-second window.

AuthMS mfa-service replay protection implementation:

```go
func VerifyTOTP(userID, secret string, otp string) (bool, error) {
    now := time.Now().Unix()
    
    for offset := -1; offset <= 1; offset++ {
        t := now + int64(offset*30)
        expected := computeTOTP(secret, t)
        
        if otp == expected {
            key := fmt.Sprintf("totp:used:%s:%s:%d", userID, otp, t/30)
            if redis.Exists(key) {
                return false, ErrOTPReused
            }
            redis.Set(key, "1", 60*time.Second)
            return true, nil
        }
    }
    return false, nil
}
```

### Scorecard

| Dimension | Score | Notes |
|-----------|-------|-------|
| Security | ★★★★☆ | Strong cryptography, auto-expires in 30s, but OTP still phishable |
| User Experience | ★★★★☆ | App auto-refreshes, copy-paste or autofill |
| Deployment Cost | ★★★★★ | Users just install a free App on their phone |
| Phishing Resistance | ★★☆☆☆ | 30-second window helps, but real-time phishing can still relay |
| Offline Usability | ★★★★★ | Pure time calculation, no network needed |

## FIDO2/WebAuthn: The Strongest MFA

FIDO2 is fundamentally different from the first three MFA methods — it's based on public-key cryptography, not shared secrets.

### Core Difference

```
TOTP/HOTP/SMS OTP approach (shared secret):
  Server knows secret → generates expected OTP
  User knows secret → generates actual OTP
  If OTP matches → user holds correct secret

  ⚠ Problem: server stores the secret. If the server is breached, all secrets leak.

FIDO2 approach (public-key cryptography):
  User device generates key pair → private key stored securely in device → public key sent to server
  Server sends random challenge → device signs with private key → server verifies with public key

  ✅ Advantage: server only stores public keys. Even if the server is breached, attackers only get public keys.
```

### Why FIDO2 Resists Phishing

Phishing attacks work by luring users to a fake site that looks identical to the real one, tricking them into entering credentials. But with FIDO2:

1. The fake site's domain differs from the real site
2. The browser verifies the current page's origin (protocol + domain + port) when calling the WebAuthn API
3. `rp.id` is bound at registration time
4. The authenticator checks whether the request's `rp.id` matches the one from registration
5. Mismatch → authenticator refuses to sign
6. Even with a perfect phishing page, attackers can't pass the authenticator

This is protocol-level phishing protection — not "advise users to check the URL," but cryptographically impossible to authenticate under the wrong domain.

### Scorecard

| Dimension | Score | Notes |
|-----------|-------|-------|
| Security | ★★★★★ | Public-key crypto + origin binding + hardware security chip |
| User Experience | ★★★★★ | One-tap fingerprint/face login, or insert key and tap |
| Deployment Cost | ★★★☆☆ | Requires server-side support and modern browsers (covering 95%+) |
| Phishing Resistance | ★★★★★ | Protocol-level origin binding, phishing sites can't pass |
| Offline Usability | ★★★★☆ | No network needed during authentication (required during registration) |

## Comprehensive Comparison Matrix

| Dimension | SMS OTP | HOTP | TOTP | FIDO2 |
|-----------|---------|------|------|-------|
| Cryptographic Basis | Random number | HMAC-SHA1 | HMAC-SHA1 | ECDSA/EdDSA |
| Key Storage | Server-side | Shared both sides | Shared both sides | Private key on device, public key on server |
| Phishing Resistance | None | None | Very weak (30s window) | Strong (origin binding) |
| SIM Swap Resistance | None | N/A | N/A | N/A |
| Offline Usability | No (needs cellular) | Yes | Yes | Yes |
| User Interaction | Wait for SMS → enter | Press button → enter | App auto → enter | Biometric / tap |
| Device Dependency | Phone + SIM card | Hardware token or App | App | Platform authenticator or hardware key |
| Loss Risk | SIM card damage | Token damage | Phone loss | Device loss |
| Recovery Plan | Replace SIM | Backup token | Backup recovery codes | Alternative auth method |
| Cost Per User | ~$0.007/msg | Token ~$1-30 | Free | Free-$70 |
| Security Score | 2/5 | 3/5 | 4/5 | 5/5 |
| Recommended For | Transition or low-risk | Offline industrial | General MFA | High-security scenarios |

## AuthMS Multi-Channel MFA Architecture

AuthMS mfa-service manages all of the above MFA protocols in a unified way:

```
┌──────────────────────────────────────────────────┐
│                  mfa-service                       │
│                                                    │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐   │
│  │ SMS OTP  │  │   TOTP   │  │ FIDO2/WebAuthn │   │
│  │ Handler  │  │ Handler  │  │   Handler      │   │
│  └────┬─────┘  └────┬─────┘  └───────┬────────┘   │
│       │             │                │             │
│  ┌────▼─────────────▼────────────────▼──────────┐  │
│  │          MFA Policy Engine                    │  │
│  │  - Tenant-level MFA policy configuration     │  │
│  │  - User MFA registration management          │  │
│  │  - Adaptive auth strength selection          │  │
│  └──────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### Multi-Channel Registration

Users can register multiple MFA methods simultaneously in their security settings:

```json
{
  "user_id": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  "mfa_methods": [
    {
      "type": "totp",
      "device_name": "iPhone Authenticator",
      "registered_at": "2026-01-15T10:30:00Z",
      "is_primary": false
    },
    {
      "type": "webauthn",
      "device_name": "YubiKey 5C NFC",
      "credential_id": "base64url...",
      "registered_at": "2026-03-22T14:00:00Z",
      "is_primary": true
    },
    {
      "type": "sms_otp",
      "phone_number": "+86138****8000",
      "registered_at": "2026-01-15T10:30:00Z",
      "is_primary": false
    }
  ],
  "backup_codes_remaining": 8
}
```

The system uses the user's configured primary method by default, but automatically falls back to alternative methods if the primary one is unavailable (e.g., hardware key not nearby).

### Adaptive MFA Policy

AuthMS's adaptive MFA engine dynamically selects authentication methods based on login risk score:

```
Risk Score 0-30 (Low Risk):
  → User can log in with password, MFA not required

Risk Score 31-60 (Medium Risk):
  → Prompt user for TOTP verification

Risk Score 61-85 (High Risk):
  → Force FIDO2/WebAuthn verification
  → TOTP not accepted (may be phished)

Risk Score 86-100 (Critical Risk):
  → Deny login
  → Trigger security alert
```

Administrators can configure risk thresholds and corresponding authentication policies per tenant.

## Selection Recommendations

| Scenario | Recommended MFA | Reason |
|----------|-----------------|--------|
| Consumer-facing SaaS | TOTP (default) + FIDO2 (optional) | Great UX, zero cost, high security |
| Enterprise internal systems | FIDO2 platform authenticator (Windows Hello / Touch ID) | Easy device management, high security |
| Finance / Banking | FIDO2 hardware key mandatory | Highest security, regulatory compliance |
| Offline industrial environment | HOTP hardware token | No network or time sync dependency |
| Temporary / transition solution | SMS OTP | Wide user coverage, but upgrade ASAP |
| Admin / privileged users | FIDO2 hardware key + TOTP backup | Defense in depth, dual MFA channels |

## Summary

MFA is not an on/off switch — it's a spectrum of security levels. From the weakest SMS OTP to the strongest FIDO2, the gap spans a dimension: shared secrets vs public-key cryptography, no origin binding vs protocol-level anti-phishing.

AuthMS mfa-service unifies all MFA protocols in one channel, so application developers don't need to integrate each protocol separately. More importantly, the adaptive MFA engine ensures users don't have to tolerate low-security authentication before they purchase hardware keys — the system automatically escalates authentication requirements based on risk.

MFA is the first line of defense for account security. Don't settle for the weakest option.
