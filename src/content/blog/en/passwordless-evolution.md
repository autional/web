---
title: "The End of Passwords: Evolution from SMS OTP to Passkey"
date: "2026-06-06"
category: "Tech"
tags: ["Passwordless", "Passkey", "Evolution"]
readTime: "8 min"
excerpt: "From 1960s time-sharing system passwords to Passkeys set to become the default in 2026, identity authentication has undergone half a century of evolution. This article reviews every key milestone, explaining why each step solved the previous problem and where the next step is headed."
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

## Where It All Began: Why Do We Have Passwords?

In 1961, MIT's Compatible Time-Sharing System (CTSS) introduced the concept of the password—the first password system in human history. The purpose was simple: allow multiple researchers sharing a single mainframe to protect their own files from others.

Fernando Corbato—the inventor of the CTSS password system—said in a 2014 interview: "Passwords have become a kind of nightmare."

He passed away in 2019 at age 93. Three years before his death, the FIDO Alliance released the WebAuthn standard, officially beginning the end of his "nightmare."

## Phase 1: The Plain Password Era (1961-2000s)

### How It Works

A user memorizes a secret string. The server stores a hash of that string (ideally). Login compares the hash.

### The Problem

From day one, passwords had two structural flaws:

**Limits of human memory**: A security-worthy password (random 16 characters with upper/lowercase, numbers, and symbols) is nearly impossible for humans to remember. So humans created their own "security strategies"—using birthdays, pet names, or the same password for every site.

**Fragility of shared secrets**: A password is a shared secret between client and server. If either side leaks, the entire authentication system collapses.

In 2009, the RockYou data breach exposed 32 million plaintext passwords. The top three most common passwords: `123456`, `12345`, `123456789`. Fifteen years later in 2024, NordPass's global statistics still showed `123456` as the most common password.

Humans don't change. We need to change authentication.

## Phase 2: SMS OTP (2000s-2010s)

### What It Solved

Added "something you have" (phone) to "something you know" (password)—the beginnings of two-factor authentication.

### What It Introduced

SMS OTP was officially labeled as "restricted" in NIST SP 800-63B in 2016. Reasons:

- **SIM Swap attacks**: Attackers socially engineer carriers to port the target's number to their own SIM—all SMS codes go directly to the attacker
- **SS7 protocol vulnerabilities**: Signaling System 7 has known flaws that allow SMS interception at the network layer
- **Latency and delivery**: International SMS can be delayed 30+ seconds or not delivered at all

### Current Status

Despite NIST's 2016 "restricted" designation, SMS OTP remains widely used in 2026. "Low cost" and "user familiarity" keep it from fully exiting the stage, but the industry consensus is: **In new systems, SMS OTP should not be used as the sole second factor.**

Autional's mfa-service still offers SMS OTP as an option (for backward compatibility with existing users), but recommends admins prioritize TOTP and Passkey.

## Phase 3: TOTP (2008-Present)

### Breakthrough

TOTP (Time-based One-Time Password, RFC 6238) doesn't rely on telecom networks—the verification code is computed on the user's device from a seed secret combined with the current time, no SMS needed.

### What It Solved

- No longer relies on telecom networks (eliminates SIM Swap and SS7 risks)
- Works offline (Google Authenticator, Authy, etc. generate codes without connectivity)
- Single setup, long-term validity

### Remaining Issues

- **The seed key is still a shared secret**: If the server's seed key database is breached, attackers can generate any user's TOTP
- **Phishing still works**: Attackers' phishing sites can relay TOTP codes to the real site in real time (Adversary-in-the-Middle)
- **Mediocre UX**: Open authenticator app, find the entry, read 6 digits, type them in (within 30 seconds)

## Phase 4: Push Notification Authentication (2013-Present)

### Breakthrough

No verification code entry—when logging in, the server sends a push notification to the user's trusted device (via APNs/FCM), and the user taps "Approve" or "Deny."

### What It Solved

- Greatly improved UX (no more manual code entry)
- Push can carry context (login location, device type, time) to help users determine if it's their own action

### What It Introduced

- **MFA Fatigue attacks**: After obtaining credentials, attackers repeatedly send push notifications until the user, annoyed, clicks "Approve" without thinking
- This directly led to the 2022 Uber breach—attackers kept sending push notifications to an Uber employee, then impersonated IT support on WhatsApp to convince them to approve

### Defenses

- **Number Matching**: Instead of simple "Approve/Deny," the push requires the user to enter a 2-digit number displayed on the authenticating device, proving the authenticator has access to the current session
- **Rate limiting**: Account locks after consecutive rejections
- Autional's mfa-service already supports number-matching push notifications

## Phase 5: FIDO U2F (2014-2018)

### Breakthrough

This was revolutionary: FIDO U2F (Universal 2nd Factor) no longer relies on shared secrets. It uses public-key cryptography:

1. On registration, a hardware security key (e.g., YubiKey) generates a key pair. The public key is sent to the server; the private key never leaves the device
2. On login, the server sends a random challenge, the security key signs it with the private key. The server verifies with the public key

### Fundamental Improvements

- **No shared secret on the server** (only a public key—useless if leaked)
- **Phishing-resistant** (signatures are bound to the domain—origin checking is built into the protocol, not bypassable at the application layer)
- **Hardware-isolated private key** (the private key can never be read by software)

### Limitations

- Requires additional hardware (USB/NFC security key)
- Not suitable for large-scale consumer scenarios (cost, distribution, loss)
- Primarily used as a second factor, cannot replace passwords

In 2017, Google ran an internal experiment requiring 85,000 employees to use FIDO U2F security keys. Result: zero successful phishing attacks (previously multiple per year).

## Phase 6: FIDO2 / WebAuthn + Passkey (2018-2026)

### Breakthrough

FIDO2 is the evolution of U2F, comprising two core standards:
- **WebAuthn** (W3C standard): JavaScript API between browser and authenticator
- **CTAP2** (Client to Authenticator Protocol): Protocol between platform and external authenticator

Key innovations:
1. **Platform Authenticator**: No external hardware needed—the device's TPM/Secure Enclave itself is the authenticator. Your MacBook's Touch ID, iPhone's Face ID, Windows Hello are all FIDO2 platform authenticators
2. **Cross-device sync**: Via platform cloud sync (iCloud Keychain, Google Password Manager, Windows Hello), private keys can be securely synced across a user's multiple devices
3. **Passkey**: The brand name for FIDO2 credentials—essentially cross-device-syncable FIDO2 credentials

### 2025-2026: The Tipping Point

Data points proving Passkey has reached critical mass:

- **Apple**: In iOS 19, Passkey is the preferred registration method for new app accounts. Over 95% of iCloud users automatically have Passkey support
- **Google**: Q4 2025, Passkey authentication on Google accounts exceeded 1 billion times/month. Q1 2026, Google announced Passkey as the default login method for Workspace (password as fallback)
- **Microsoft**: December 2025, Microsoft announced it has completely eliminated passwords internally—all 220,000 Microsoft employees authenticate via Passkey and Windows Hello for Business
- **Amazon**: During 2025 Black Friday, over 40% of logins used Passkey
- **Cross-border e-commerce Shopee/Lazada**: After introducing Passkey, login conversion rates increased 18% in Southeast Asia

### Autional Passkey Implementation

Autional has had built-in full WebAuthn RP support since 2025:

```
Browser                             Autional
  │                                  │
  │ 1. Request registration challenge│
  │─────────────────────────────→   │ identity-service
  │                                  │ generate challenge + user ID
  │ 2. Return challenge + params     │
  │←─────────────────────────────   │
  │                                  │
  │ [User completes fingerprint/Face/ │
  │  hardware key verification]      │
  │                                  │
  │ 3. Return attestation            │
  │─────────────────────────────→   │ mfa-service
  │                                  │ verify signature + store public key
  │ 4. Registration success          │
  │←─────────────────────────────   │
```

The assertion flow during login is similar—server sends a challenge, platform authenticator signs with private key, server verifies with public key.

## Phase 7: What's Next?

### Continuous Authentication

From "verify once at login" to "continuous verification." Based on behavioral biometrics (typing rhythm, mouse movement patterns) and contextual signals (location, time, device state), trust is continuously assessed throughout the session.

### Recovery Without Passwords

Currently—if you lose your Passkey private key (device lost without cloud sync), you need to fall back to a password or recovery code. Next step—passwordless account recovery based on social recovery or escrow-based recovery.

### Post-Quantum Cryptography Transition

In 2026, NIST post-quantum cryptography standards (CRYSTALS-Kyber, CRYSTALS-Dilithium, etc.) are being incorporated into the FIDO standard system. Passkey key pairs will gradually transition from ECDSA to quantum-safe Dilithium. This may take 5-10 years, but preparation starts today.

## Summary

| Phase | Time | Core Mechanism | Phishing-Resistant? | No Shared Secret? | UX Complexity | Current Status |
|-------|------|----------------|:---:|:---:|:---:|:---:|
| Passwords | 1961+ | Shared secret | ❌ | ❌ | Low | Still widely used |
| SMS OTP | 2000s+ | Telecom network | ❌ | ❌ | Medium | Should avoid |
| TOTP | 2008+ | Time sync | ❌ | ❌ | Medium | Recommended fallback |
| Push Notification | 2013+ | Device verification | ❌ | ❌ | Low | Recommended |
| FIDO U2F | 2014+ | Public key | ✅ | ✅ | Medium | Enterprise use |
| Passkey | 2022+ | Public key + cross-device | ✅ | ✅ | Very Low | **Recommended first choice** |
| Continuous Auth | 2026+ | Behavioral analysis | — | — | Imperceptible | Exploring |

From 1961 to 2026, identity authentication has traveled from "secrets memorized by humans" to "secrets generated by hardware that even humans cannot read." Passkey isn't the finish line, but it's the first time we have an authentication method that is both secure (phishing-resistant, no shared secrets) and easy to use (scan/fingerprint/Face ID, no passwords).

Autional fully supports every stage in this table—not because you need to deploy SMS OTP in 2026, but because you can choose the right combination of authentication methods for different user groups, different security levels, and different compliance requirements. The evolution from passwords to Passkey isn't a migration—it's a journey. Autional has prepared every stop along the way.
