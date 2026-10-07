---
title: "WebAuthn Deep Dive: From the CTAP2 Protocol to Autional's Complete Implementation"
date: "2026-05-24"
category: "Tech"
tags: ["WebAuthn", "FIDO2", "Passkey"]
readTime: "12 min"
excerpt: "WebAuthn is the most important standard in identity authentication in recent years. This article starts from the CTAP2 protocol, analyzes the complete registration and authentication flows layer by layer, examines the security differences between platform authenticators and roaming authenticators, and shows how Autional mfa-service + identity-service collaborate to deliver a complete WebAuthn server-side implementation."
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

WebAuthn, short for Web Authentication, is the W3C and FIDO Alliance's browser-based passwordless authentication standard. Unlike traditional username + password, WebAuthn is based on public-key cryptography — the client generates and holds the private key, while the server only stores the public key. The private key never leaves the user's device.

This article will go layer by layer from the protocol level, and finally show how Autional encapsulates this complex protocol into an enterprise-grade capability that works out of the box.

## Protocol Overview: FIDO2 Layered Architecture

FIDO2 consists of two core components:

```
┌──────────────────────────────────────────────┐
│  WebAuthn (W3C Specification)                │
│  Browser JavaScript API                       │
│  navigator.credentials.create()              │
│  navigator.credentials.get()                 │
└───────────────────┬──────────────────────────┘
                    │
┌───────────────────▼──────────────────────────┐
│  CTAP2 (FIDO Alliance Specification)          │
│  Client-to-Authenticator Transport Protocol   │
│  Supports USB, NFC, BLE                       │
└───────────────────┬──────────────────────────┘
                    │
┌───────────────────▼──────────────────────────┐
│  Authenticator                                │
│  Hardware Security Key (YubiKey),             │
│  Platform Authenticator (Touch ID)            │
└──────────────────────────────────────────────┘
```

- **WebAuthn**: The JavaScript API running in the browser, defining how web pages interact with authenticators. Developers create credentials via `navigator.credentials.create()` and obtain credential assertions via `navigator.credentials.get()`.
- **CTAP2** (Client to Authenticator Protocol): The communication protocol between the browser and physical authenticators. When a user plugs in a USB security key or taps via NFC, CTAP2 defines the data transfer format.
- **Authenticator**: The hardware or software module responsible for generating key pairs, storing private keys, and performing signing operations.

FIDO2 doesn't require developers to understand CTAP2 details — the browser handles CTAP2 communication; developers only need to call the WebAuthn API. But understanding the full protocol picture helps make informed security architecture decisions.

## Registration Flow: Attestation (Credential Creation)

Registration is the starting point of the entire WebAuthn flow — the user binding a device to their account for the first time.

### Step 1: Server Generates Challenge

```
Client → Server: POST /webauthn/register/begin
    Body: { "display_name": "My YubiKey" }

Server Processing:
    1. Generate 32-byte random challenge (crypto/rand)
    2. Generate user ID (Autional ULID)
    3. Query user's already-registered credentials (for excludeCredentials)
    4. Store challenge temporarily (Redis, TTL 5 minutes)

Server → Client:
    {
      "challenge": "base64url...",
      "rp": { "id": "iam.tianv.com", "name": "Autional" },
      "user": {
        "id": "base64url...",
        "name": "user@example.com",
        "displayName": "Nickname"
      },
      "pubKeyCredParams": [
        { "type": "public-key", "alg": -7 },   // ES256
        { "type": "public-key", "alg": -257 }  // RS256
      ],
      "authenticatorSelection": {
        "authenticatorAttachment": "cross-platform",
        "userVerification": "required"
      },
      "attestation": "none"
    }
```

`rp.id` is the Relying Party ID — it must be a valid subset of the current domain. For example, if the service runs on `iam.tianv.com`, `rp.id` can be `iam.tianv.com`, but cannot be `example.com`. This restriction is one of WebAuthn's core anti-phishing mechanisms.

`authenticatorSelection` controls:
- `authenticatorAttachment: "platform"` — platform authenticators only (e.g., Touch ID, Windows Hello)
- `authenticatorAttachment: "cross-platform"` — roaming authenticators only (e.g., USB security key)
- `userVerification: "required"` — requires biometric or PIN to unlock the authenticator

### Step 2: Client Calls WebAuthn API

```javascript
const publicKeyCredential = await navigator.credentials.create({
  publicKey: optionsFromServer
});
// publicKeyCredential contains:
//   - id: credential ID (base64url)
//   - rawId: credential ID raw bytes
//   - response.clientDataJSON: client data (challenge, origin, type)
//   - response.attestationObject: authenticator data (public key, signature)
//   - type: "public-key"
```

This call triggers the browser's WebAuthn flow:

1. Browser verifies `rp.id` matches the current domain
2. Browser communicates with the authenticator via CTAP2, requesting a new key pair
3. Authenticator prompts the user for verification (fingerprint, face, PIN)
4. Authenticator generates an ECDSA (ES256) key pair; private key is securely stored in the authenticator
5. Authenticator signs the `clientDataJSON` hash with the private key, generating attestation
6. Returns the `attestationObject` containing the public key and signature

### Step 3: Server Verifies and Stores

```
Client → Server: POST /webauthn/register/complete
    Body: {
      "id": "base64url...",
      "rawId": "base64url...",
      "response": {
        "clientDataJSON": "base64url...",
        "attestationObject": "base64url..."
      },
      "type": "public-key"
    }

Server Processing:
    1. Verify clientDataJSON.type === "webauthn.create"
    2. Verify clientDataJSON.challenge === stored challenge
    3. Verify clientDataJSON.origin === expected origin
    4. Parse attestationObject, extract:
       - authData: authenticator data (RP ID hash, flags, counter, public key)
       - fmt: attestation format ("none", "packed", "tpm", etc.)
    5. Verify RP ID hash in authData matches
    6. Verify userPresent and userVerified flags in authData
    7. Extract public key (CBOR decode → COSE Key → ECDSA public key)
    8. Compute SHA-256 hash of clientDataJSON
    9. Verify signature in attestationObject (optional, depends on attestation param)
    10. Store in database:
        - credential_id: credential ID
        - public_key: public key (DER encoded)
        - counter: signature counter (for clone detection)
        - transports: supported transport methods (usb, nfc, ble, internal)
        - device_name: user-set device name
```

Autional's mfa-service applies the following security hardening during registration verification:

- **Strict origin validation**: Only accepts configured allowed origin list, preventing cross-domain attacks
- **Challenge anti-replay**: Challenge is deleted immediately after use, preventing reuse
- **Counter checking**: Stores the authenticator's signature counter; subsequent verifications require the counter to increment — if counter rollback is detected, the private key may have been cloned
- **Duplicate registration prevention**: Same credential ID cannot be registered to different accounts

## Authentication Flow: Assertion Verification

The authentication flow is simpler than registration because the public key is already on the server — it only needs to verify the user actually holds the corresponding private key.

### Step 1: Server Generates Challenge

```
Client → Server: POST /webauthn/authenticate/begin
    Body: { "user_id": "01ARZ3NDEKTSV4RRFFQ69G5FAV" }

Server Processing:
    1. Query user's all registered credential IDs (for allowCredentials)
    2. Generate new random challenge
    3. Store challenge temporarily
    4. Optionally restrict userVerification requirements

Server → Client:
    {
      "challenge": "base64url...",
      "allowCredentials": [
        { "id": "base64url...", "type": "public-key", "transports": ["usb","nfc"] }
      ],
      "userVerification": "required",
      "timeout": 60000
    }
```

### Step 2: Client Signs Challenge

```javascript
const assertion = await navigator.credentials.get({
  publicKey: optionsFromServer
});
// assertion contains:
//   - response.authenticatorData: authenticator data (RP ID hash, counter)
//   - response.clientDataJSON: client data (challenge, origin)
//   - response.signature: authenticator's signature over (authenticatorData + clientDataJSON hash) using private key
```

The authenticator's processing flow:
1. Verify `rp.id` matches the RP ID stored at registration
2. Prompt user for verification (fingerprint/face/PIN)
3. Sign `(authData || SHA-256(clientDataJSON))` with private key
4. Increment internal counter (for clone detection)
5. Return signature result

### Step 3: Server Verifies Signature

```
Server Processing:
    1. Look up public key from database using credential_id
    2. Verify clientDataJSON.type === "webauthn.get"
    3. Verify clientDataJSON.challenge === stored challenge
    4. Verify clientDataJSON.origin === expected origin
    5. Verify RP ID hash in authenticatorData
    6. Verify userPresent and userVerified flags
    7. Verify signature counter > last recorded counter (anti-clone)
    8. Construct signature data: authenticatorData || SHA-256(clientDataJSON)
    9. Verify signature with public key (ECDSA verify)
    10. Signature verification passes → authentication success
    11. Update counter value in database
```

## Authenticator Types and Security Levels

| Feature | Platform Authenticator | Roaming Authenticator |
|---------|-----------------------|----------------------|
| Implementation | Touch ID, Windows Hello, Android Biometric | YubiKey, Feitian, Google Titan |
| Private Key Storage | Device security chip (TEE/Secure Enclave) | Authenticator's internal security chip |
| Cross-Device Use | Not directly supported (needs Passkey sync) | Supported (physically carry it) |
| User Verification | Biometric (fingerprint/face) | PIN or biometric (high-end models) |
| Phishing Resistance | High (origin binding, private key stays on device) | Highest (physical isolation + origin binding) |
| Loss Risk | Device loss requires recovery flow | Physical loss requires backup key |
| Use Case | Daily login, low-medium security | Admin operations, high security |

Autional allows tenant administrators to configure accepted authenticator types in MFA policies:

```yaml
webauthn_policy:
  allowed_attachments:
    - platform
    - cross-platform
  user_verification: required
  attestation: none
```

## Autional Implementation Architecture

Autional's complete WebAuthn implementation is a collaboration between two services:

### identity-service Role

identity-service provides the user-facing WebAuthn API entry points:

```
POST   /api/v1/mfa/webauthn/register/begin
POST   /api/v1/mfa/webauthn/register/complete
POST   /api/v1/mfa/webauthn/authenticate/begin
POST   /api/v1/mfa/webauthn/authenticate/complete
GET    /api/v1/mfa/webauthn/credentials
DELETE /api/v1/mfa/webauthn/credentials/{id}
```

Primary responsibilities:
- Manage challenge generation, storage, and verification (in coordination with session-service)
- Control user interaction flow
- Credential CRUD management

### mfa-service Role

mfa-service handles the core cryptographic operations of the WebAuthn protocol:

```
Internal API (for identity-service consumption):
POST /api/v1/internal/mfa/webauthn/verify-registration
POST /api/v1/internal/mfa/webauthn/verify-authentication
```

Primary responsibilities:
- CBOR parsing of attestationObject
- Public key extraction and format conversion (COSE Key → DER public key → crypto.PublicKey)
- Registration signature verification
- Authentication signature verification
- Counter management (anti-clone)

### Why Split Into Two Services?

This separation of responsibilities embodies Autional's microservice design philosophy:

1. **Separation of concerns**: identity-service handles user interaction, mfa-service handles cryptographic operations. Changing signature algorithms or adding new authenticator types only requires changes in mfa-service.
2. **Independent scaling**: The cryptographic operations in registration and authentication (ECDSA verification) are CPU-intensive. During Passkey promotion, registration requests may spike — mfa-service can scale independently without affecting identity-service.
3. **Security boundary**: Public key storage and signature verification logic is concentrated in mfa-service, narrowing the audit scope and reducing the security risk surface.

## Developer Experience

For developers integrating Autional, enabling Passkey requires just three steps:

1. **Enable Passkey in the admin console**: Go to MFA policy configuration, enable WebAuthn, and select allowed authenticator types.
2. **Frontend code (zero lines)**: Autional's login page (auth-pages) already has the complete WebAuthn flow built-in. The user's browser automatically detects Passkey support.
3. **User registration**: After logging in, the user goes to security settings, clicks "Add Passkey," and the system automatically calls `navigator.credentials.create()`, guiding the user through fingerprint/face registration.

The entire process requires the integrator to understand zero underlying concepts like CTAP2, CBOR, COSE Key, or attestation.

## Security Best Practices

### 1. Strict RP ID Configuration

RP ID is the foundation of WebAuthn's anti-phishing capability. It must precisely match your domain — no wildcards allowed. If your service has multiple subdomains (e.g., `app.example.com` and `admin.example.com`), you need to decide between using `example.com` as a shared RP ID (credentials can be used across all subdomains) or independent RP IDs per subdomain (higher isolation).

In Autional's multi-tenant scenarios, each tenant can have its own independent domain; the system configures the correct RP ID for each tenant at registration.

### 2. User Verification Strategy

`userVerification` has three levels:
- `discouraged`: User verification not required. Suitable for low-risk operations.
- `preferred`: Verification recommended if the authenticator supports it. Suitable for daily login.
- `required`: Verification mandatory. Suitable for sensitive operations.

Autional's adaptive MFA engine can dynamically determine the `userVerification` strategy based on the operation's risk level — `preferred` for viewing profiles, `required` for password changes, `required` + mandatory hardware key for large transfers.

### 3. Credential Backup and Recovery

Once a user registers a Passkey, they need to be protected from being locked out due to device loss. Autional's strategy:

- Passkey serves as the primary authentication factor (replacing passwords), while TOTP and Backup Codes are retained as recovery channels
- Supports registering multiple Passkeys on the same account (primary device + backup device)
- Provides admin MFA reset functionality in the management console (requires approval workflow)

## Summary

WebAuthn represents the future of identity authentication — replacing shared secrets with public-key cryptography. Its security far exceeds passwords and traditional MFA because:

1. **Private key never leaves the device**: The server only stores public keys; even a database breach can't forge authentication
2. **Domain-bound**: Phishing sites can't pass origin verification, eliminating phishing at the protocol level
3. **Nothing to remember**: Better user experience than passwords

Autional has encapsulated WebAuthn from a complex protocol standard into an out-of-the-box capability. Your application only needs one API call to let users log in with their fingerprint.
