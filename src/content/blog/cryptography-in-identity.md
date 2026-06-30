---
title: "Cryptography in Identity Systems: Hash, Salt, Key Derivation Done Right"
date: "2026-05-21"
category: "Tech"
tags: ["Cryptography", "Security", "Hash"]
readTime: "10 min"
excerpt: "Cryptography is the foundation of identity systems. Bad cryptography is worse than no cryptography. This article covers the bcrypt vs argon2 choice, correct use of salt and pepper, secure API Key hashing and storage, field-level PII encryption (AES-256-GCM), and how AuthMS bakes these security practices into its architecture."
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

Password storage is the core operation of every identity system. And the cost of getting it wrong is enormous — when a database is breached, the quality of your cryptographic scheme determines how long it takes attackers to crack your users' passwords.

Even worse, insecure password storage **doesn't look obviously wrong**. Hashing passwords with SHA-256 plus a salt looks reasonable, right? Wrong. This article starts from first principles and breaks down the correct use of cryptography in identity systems.

## Password Hashing: Why SHA-256 Isn't Enough

### The Problem Is Speed, Not Output Format

SHA-256 is a **general-purpose hash function**. It's designed to be as fast as possible — which is exactly what makes it disastrous for password hashing.

Modern GPUs (like the NVIDIA RTX 4090) can perform 8 billion SHA-256 operations per second. If an attacker gets your password hash database, here's how long it takes to brute-force all possible 8-character passwords:

```
8-char ASCII printable combinations ≈ 95^8 ≈ 6.6 × 10^15
RTX 4090 SHA-256 rate ≈ 8 × 10^9 hashes/s
Crack time ≈ 6.6 × 10^15 / 8 × 10^9 ≈ 8.3 × 10^5 seconds ≈ 9.6 days
```

With bcrypt (cost factor 12), the RTX 4090 can only manage about 5000 hashes/s. How long does the same password space take?

```
Crack time ≈ 6.6 × 10^15 / 5000 ≈ 1.3 × 10^12 seconds ≈ 42,000 years
```

That's the power of **slow hashing** — the computational cost difference is just 200ms vs 2ms per login (unnoticeable to the user), but for an attacker's brute force, it's days versus millennia.

### The Three Candidates: bcrypt, scrypt, argon2

| Feature | bcrypt | scrypt | argon2 |
|---------|--------|--------|--------|
| Design Goal | Resist GPU brute force | Resist GPU/ASIC/FPGA + memory-hard | Best all-around: time + memory + parallelism |
| Memory Requirement | Fixed 4KB (GPU-friendly) | Configurable (memory-hard) | Configurable (memory-hard) |
| Maturity | 1999-present, battle-tested | 2012 | 2015 (PHC winner) |
| Go Standard Library | No (needs `golang.org/x/crypto`) | No (needs third-party) | No (needs third-party) |
| AES Acceleration | No (limited GPU resistance) | Yes (XOR + Salsa20 core) | Yes (Blake2b) |

**AuthMS defaults to bcrypt (cost factor 12).** The reasons are straightforward:

1. **Battle-tested**: bcrypt has survived 20+ years of security audits and real-world attacks. No publicly known bcrypt weakness has ever been found.
2. **Mature Go ecosystem**: `golang.org/x/crypto/bcrypt` is an official Go extension library with the best code review and long-term support guarantees.
3. **Simple implementation, few knobs**: bcrypt has only one parameter — the cost factor. Fewer parameters means fewer chances for misconfiguration.

Argon2 is theoretically more secure (ASIC and FPGA resistance through memory hardness), but its security advantages mainly matter in extreme scenarios (nation-state attackers with custom hardware). For most SaaS applications, bcrypt provides 80-90% of the security with lower operational risk.

AuthMS is designed with headroom for migrating to argon2id — the identity-service password verification interface accepts any `PasswordHasher` implementation, allowing a switch to a new hash algorithm without modifying business code.

## Salt and Pepper: The Misunderstood Double Protection

### Salt: Getting It Right

A salt is a unique random value per password, prepended to the password before hashing. Its purpose is to **eliminate rainbow table attacks and prevent identical passwords from producing identical hashes**.

One common misconception: salt must be secret. In reality, salt does **not** need to be secret (it's stored in plaintext alongside the hash). The value of salt is **uniqueness**, not secrecy.

AuthMS salt generation:

```go
// Password hashing in identity-service
func HashPassword(password string) (string, error) {
    // bcrypt auto-generates salt and embeds it in the hash string
    // Format: $2a$12$[22-char salt][31-char hash]
    bytes, err := bcrypt.GenerateFromPassword([]byte(password), 12)
    if err != nil {
        return "", err
    }
    return string(bytes), nil
}
```

bcrypt's output already contains the salt (embedded in the hash string), so no separate salt management is needed.

### Pepper: The Right Way

Pepper is an application-level global secret key that is concatenated with the password before bcrypt hashing. Unlike salt, pepper **must remain secret** — it's stored in application configuration (environment variables or a key management service), not alongside password hashes in the database.

```
Final stored value = bcrypt(password + pepper, cost=12)
```

If the database leaks but the application configuration doesn't, attackers cannot verify password guesses without knowing the pepper. But if **both leak simultaneously** (e.g., a backup snapshot containing both the database and config files), pepper provides no additional protection.

This is pepper's limitation: it only helps in the specific "database leaked but config didn't" scenario. AuthMS uses an alternative approach — **encrypting the entire password hash field** (see field-level encryption below) — and recommends storing pepper values in a hardware security module (HSM) or cloud KMS, ensuring physical isolation from data storage.

## API Key Storage: A Different Strategy from Passwords

API Keys (backend service access keys, user API tokens) have different security requirements than passwords:

1. **API Keys don't need slow hashing**: API Keys are inherently high-entropy random strings (e.g., `tk_` + 64 hex chars = 256 bits of entropy). Brute-forcing one is as hard as brute-forcing an AES-256 key. No need for extra computational cost.
2. **API Keys need partial display**: Unlike passwords, API Keys are shown to the user at creation time (once only), and users need to see the prefix to distinguish different keys.

AuthMS API Key handling strategy:

```go
// Create API Key
apiKey := "tk_" + random_util.GenerateHex(32)  // 64 hex chars = 256 bit entropy

// Storage: SHA-256 hash (not bcrypt)
keyHash := sha256Hex(apiKey)

// Database storage
// - key_hash: SHA-256(apiKey)     # for verification
// - key_prefix: apiKey[:15]        # for display (first 15 chars)
// - key_hash_alg: "sha256"         # record hash algorithm for future migration

// Verification
func VerifyAPIKey(providedKey string, storedHash string) bool {
    return sha256Hex(providedKey) == storedHash
}

// Display to user
// "Your API Key: tk_a1b2c3d4e5f6g7h8..."
// After storage, only the prefix is shown: tk_a1b2c3d4e5f****
```

Why SHA-256 instead of bcrypt here? Because an API Key's entropy (256 bits) makes brute force physically infeasible. SHA-256 verification latency is microseconds, while bcrypt is hundreds of milliseconds — a difference that matters greatly in high-frequency API call scenarios.

## Field-Level Encryption: Protecting PII Data

Password and API Key storage strategies handle authentication credential security. But another category of sensitive data in identity systems — Personally Identifiable Information (PII) — needs a different protection scheme.

### Why Field-Level Encryption Is Needed

PII data like phone numbers, email addresses, and national IDs need protection in these scenarios:

1. **Database breach**: Even if the entire database is exfiltrated, PII fields remain ciphertext, preventing direct access to user personal information.
2. **Insider threat**: Employees with production database access cannot view users' PII plaintext.
3. **Compliance requirements**: Level 3 classified protection (Dengbao), GDPR all require encryption protection for sensitive data.
4. **Selective decryption**: The system can decrypt when needed (e.g., sending SMS verification codes, sending emails) instead of always storing plaintext.

### AES-256-GCM: Authenticated Encryption

AuthMS uses AES-256-GCM for field-level encryption. GCM (Galois/Counter Mode) is an authenticated encryption mode that provides data integrity verification alongside encryption.

```
Encryption:
  plaintext = "13800138000" (phone number)
  key = 32-byte AES key from KMS
  nonce = randomly generated 12 bytes (different nonce per encryption)
  
  ciphertext, tag = AES-256-GCM.Encrypt(key, nonce, plaintext, aad)
  
  Stored in database:
  {
    "encrypted": "base64(ciphertext)",
    "nonce": "base64(nonce)",
    "tag": "base64(tag)",
    "alg": "aes-256-gcm",
    "key_id": "kms-key-2026-05"  # supports key rotation
  }

Decryption:
  key = from KMS by key_id
  plaintext = AES-256-GCM.Decrypt(key, nonce, ciphertext, aad)
  # If tag verification fails (tampered data), Decrypt returns error
```

**Why authenticated encryption matters**: GCM's tag ensures the ciphertext hasn't been tampered with. If an attacker modifies a single bit of the encrypted field, decryption fails. This is a capability that plain AES-CBC mode lacks.

### Key Management

The security of the encryption key itself is critical to the whole scheme. AuthMS key management strategy:

```
Production key hierarchy:

┌────────────────────────────────────┐
│  Cloud KMS (Key Management Service)│
│  - Master Key                      │
│  - Encrypts/decrypts DEK           │
│  - HSM-protected                   │
│  - Full access audit logging       │
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│  Application Config (Env Vars)     │
│  - Encrypted DEK (ciphertext)      │
│  - key_id (pointing to KMS master) │
└──────────────┬─────────────────────┘
               │ decrypted at startup
               ▼
┌────────────────────────────────────┐
│  In-Memory DEK (plaintext)          │
│  - 32-byte AES-256 key             │
│  - Process memory only, not on disk│
│  - Rotated every 90 days           │
└────────────────────────────────────┘
```

At startup, AuthMS uses the cloud KMS to decrypt the DEK ciphertext, keeping the plaintext DEK only in process memory. All field-level encryption and decryption operations use the in-memory DEK.

### Which Fields Should Be Encrypted

AuthMS enables field-level encryption for these PII fields by default:

| Service | Encrypted Fields |
|---------|-----------------|
| identity-service | Phone number, backup email, national ID |
| profile-service | Real name, address details, national ID |
| wallet-service | Bank account number, bank branch name |
| compliance-service | Personal info in data subject requests, sensitive fields in audit logs |

Encrypted fields are tagged with `json:"-"` in JSON responses to prevent accidental exposure through APIs.

## Security Practices Checklist

| # | Practice | Description | How AuthMS Does It |
|---|----------|-------------|-------------------|
| 1 | Slow hash for passwords | bcrypt cost ≥ 12, argon2id | bcrypt cost=12, argon2id interface reserved |
| 2 | Salt must be unique | Independent random salt per password | bcrypt auto-generates 22-char salt |
| 3 | Pepper separate from env | pepper not stored in database | KMS-managed field-level encryption replaces pepper |
| 4 | Fast hash for API Keys | SHA-256 / HMAC-SHA256 | SHA-256 + prefix storage for UI display |
| 5 | Authenticated encryption for PII | AES-256-GCM (encryption + tamper-proof) | DEK decrypted from KMS at startup |
| 6 | Regular key rotation | Master key and DEK rotated periodically | DEK: 90 days, KMS master key: 1 year |
| 7 | Version the hash algorithm | Store algorithm identifier in database | `key_hash_alg`, `encrypt_alg` fields |
| 8 | Tag encrypted data as sensitive | Exclude from JSON serialization | `json:"-"` tags |
| 9 | Keys in memory only | No plaintext keys on disk | DEK ciphertext in config, plaintext in memory |
| 10 | Logs must not leak sensitive fields | Log sanitization | Log middleware auto-sanitizes PII fields |

## Common Mistakes and Consequences

### Mistake 1: Using MD5/SHA1 for Password Storage

```
Consequence: LinkedIn 6.5M password leak in 2012
      → Used unsalted SHA-1
      → 90% of passwords cracked within 72 hours
      → Attackers used those passwords for cross-platform credential stuffing

Fix: Migrate to bcrypt immediately. Transparently upgrade the hash algorithm
     on the user's next login.
```

AuthMS includes the algorithm identifier in the password hash output (bcrypt's `$2a$12$` prefix), making it possible to auto-detect old hash formats during login and transparently upgrade them.

### Mistake 2: Rolling Your Own Password Hash

```
"We'll SHA-256-iterate 1000 times with a fixed salt. That should work, right?"

Consequence: Cryptographers spent decades designing secure password hash functions.
      bcrypt has resisted 20 years of attacks. argon2id won the Password Hashing
      Competition. Any home-grown scheme has a near-100% failure probability.

Fix: Always use peer-reviewed standard implementations. Never invent your own.
```

### Mistake 3: Encryption Without Authentication

```
Consequence: Using AES-CBC without a MAC
      → Attackers can manipulate ciphertext to control decrypted plaintext
        (Padding Oracle Attack)
      → ASP.NET's 2010 Padding Oracle vulnerability led to remote code execution

Fix: Use authenticated encryption (AES-256-GCM or AES-256-CBC + HMAC-SHA256)
```

AuthMS uniformly uses AES-256-GCM and has never used an unauthenticated encryption mode.

### Mistake 4: Using Debug Keys in Production

```
if os.Getenv("ENV") == "production" {
    key = os.Getenv("ENCRYPTION_KEY")
} else {
    key = "00000000000000000000000000000000"  // 32 zeros
}

Consequence: A deployment config error, env var not properly set
      → System falls back to DEBUG key
      → All PII data is effectively "encrypted" with a public key
      → Equivalent to plaintext storage

Fix: AuthMS KMS integration ensures the service fails to start (panics)
     when the key is unavailable, rather than falling back to an insecure mode.
```

## Summary

Cryptography in identity systems isn't an optional "extra layer of security" — it's fundamental to the architecture. Bad cryptographic practices don't just lower the security level; they completely eliminate it while giving your users a false sense of safety.

AuthMS ships with security-reviewed cryptographic schemes: bcrypt password hashing, SHA-256 API Key verification, AES-256-GCM field-level encryption, and KMS-integrated key management. For applications that integrate with AuthMS, these security practices are the default — no deep understanding required from the developer.

But if you're building your own identity system, take every practice in this article seriously. Your users entrust their most private information to your system. Don't let them down.
