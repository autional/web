---
title: "MFA Protocols Compared: TOTP vs Passkey vs WebAuthn"
date: "2026-06-10"
category: "Security"
tags: ["MFA", "TOTP", "Passkey", "WebAuthn", "FIDO2"]
readTime: "8 min"
excerpt: "Technical deep-dive comparing TOTP, Passkey (FIDO2/WebAuthn), SMS OTP, and Push Notification MFA methods."
status: "verified"
reviewed_by: "butler-exec"
claims_reviewed: true
---

## MFA Method Comparison

| Method | Phishing Resistance | UX | Adoption |
|--------|:--:|:--:|:--:|
| **TOTP** | ❌ Vulnerable to real-time phishing | ⭐⭐⭐⭐ | Universal |
| **Passkey (FIDO2)** | ✅ Phishing-resistant | ⭐⭐⭐⭐⭐ | Growing fast |
| **SMS OTP** | ❌ SIM-swap vulnerable | ⭐⭐⭐ | Universal |
| **Push Notification** | ⚠️ MFA fatigue risk | ⭐⭐⭐⭐ | Enterprise |
| **Hardware Key (U2F)** | ✅ Phishing-resistant | ⭐⭐⭐ | Niche |

## Our Recommendation

Passkey-first with TOTP fallback. Passkey eliminates the biggest attack vector (credential phishing), while TOTP provides a reliable backup for devices without biometrics.
