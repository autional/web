---
title: "Government IT Identity: Level 3 Classified Protection + SM Algorithms + Xinchuang Adaptation"
date: "2026-06-01"
category: "Compliance"
tags: ["Government", "Xinchuang", "SM Algorithms"]
readTime: "10 min"
excerpt: "Government information systems have unique technical requirements for identity authentication: Level 3 Classified Protection is the baseline, SM2/SM3/SM4 algorithms are mandatory, and Xinchuang environment adaptation is a deployment prerequisite. This article analyzes the strategy for building identity systems in government scenarios and how Autional supports these requirements."
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

> **Compliance Notice**: The technical capabilities described in this article—SM algorithms, Level 3 Classified Protection, Xinchuang adaptation—represent the design goals of the Autional platform and do not constitute Classified Protection certification or Xinchuang product certification. The ultimate compliance responsibility for government systems lies with the system operator based on specific project requirements. Compliant use of SM algorithms must follow the latest specifications from the State Cryptography Administration.

## The Uniqueness of Government IT

Government IT modernization has a characteristic often overlooked by outsiders: **it is not about making choices from "zero," but finding optimal solutions within a strictly constrained technical framework.**

This framework is defined by three factors:
1. **Classified Protection 2.0** defines security levels and protection requirements—government systems are typically rated at Level 3 or above
2. **Cryptography Law + SM Standards** mandate the cryptographic algorithms that must be used—SM2 (asymmetric), SM3 (hash), SM4 (symmetric)
3. **Xinchuang Catalog** restricts the hardware architectures, operating systems, and foundational software that can be used

Combined with the unique requirements of government scenarios such as intranet deployment, offline operation, and classified information protection, this creates a technical environment fundamentally different from internet SaaS development.

## Level 3 Classified Protection: Security Baseline for Government Systems

Classified Protection 2.0 divides information system security levels into five tiers. Level 3 (Security Mark Protection Level) is the minimum requirement for most government systems. Compared to Level 2, the core differences at Level 3 are:

**Mandatory Access Control (MAC)**: Beyond Discretionary Access Control (DAC)—where users decide who accesses their own data—the system enforces access rules based on security labels.

**Security Labels**: Both subjects (users) and objects (data) must be bound to security labels. Access decisions are based on label comparisons.

**Formal Security Policy Model**: Access control policies must have a formal description and rigorous implementation.

For the identity system, this means:
- Each user must be bound to a security level label
- Each piece of data must be bound to a classification label (Public / Internal / Secret / Confidential / Top Secret)
- Access decisions are based on the Bell-LaPadula model (no read up, no write down) or equivalent implementation

Autional provides enhanced access control for this:
- User security level labels are implemented through RBAC role attributes
- Resource security labels are implemented through database metadata fields
- Access decisions are enforced in the identity-service permission check engine

### Specific Classified Protection Requirements for Identity Authentication

**Identity Authentication**:
- Unique identifiers + complexity policy + periodic rotation
- Two or more combined authentication techniques (password + certificate/biometric/USB Key)
- Login failure lockout + session timeout

**Access Control**:
- Need-to-know permission assignment (principle of least privilege)
- Remove/rename default accounts
- Timely cleanup of expired/excess accounts
- Subject-object security labels

**Security Audit**:
- Audit scope covers all users and security events
- Audit records include date, time, type, subject identifier, object identifier, and event result
- Audit records are protected against unauthorized modification and deletion

**Communication Confidentiality**:
- Encrypted transmission of authentication information during communication
- Use of cryptographic techniques to ensure integrity and confidentiality of communication data

Autional coverage of these requirements:

| Classified Protection Requirement | Autional Implementation |
|---------|----------------------|
| Two or more authentication methods | password + SM2 certificate + TOTP, or password + USB Key (FIDO2) |
| Mandatory Access Control | RBAC + security label binding |
| Security Audit | audit-service hash chain + tamper-proof storage |
| Communication Encryption | TLS 1.3 (SM2/SM4 cipher suites) + mTLS |
| Session Security | session-service idle/absolute timeout + device binding |

## SM Algorithms: Cryptographic Adaptation in Identity Systems

Article 27 of the Cryptography Law, effective January 1, 2020, clearly states: "Operators of critical information infrastructure shall, in accordance with laws, regulations, and cryptography-related standards, use commercial cryptography for protection."

For government systems, this means must use commercial cryptographic algorithms approved by the State Cryptography Administration (i.e., SM algorithms replacing international algorithms):

### SM2: Elliptic Curve Public Key Cryptography Algorithm

SM2 replaces RSA and ECDSA, applied in:
- **Digital Signatures**: JWT token signing, API request signing, data integrity signatures
- **Key Agreement**: Key exchange during TLS handshake
- **Certificate System**: SM2-based PKI system

In Autional, SM2 application scenarios include:
- identity-service JWT signing: using SM2 signatures instead of HS256/RS256
- mfa-service Passkey: leveraging SM2's signature mechanism for passwordless authentication
- Service-to-service communication: mutual authentication via SM2 certificates

### SM3: Cryptographic Hash Algorithm

SM3 replaces SHA-256, applied in:
- **Password Hashing**: salted hash storage of user passwords
- **Data Integrity**: digital digests of files/records
- **Blockchain/Hash Chain**: audit-service hash chain verification

### SM4: Block Cipher Algorithm

SM4 replaces AES, applied in:
- **Data Transmission Encryption**: data encryption in TLS
- **Data-at-Rest Encryption**: field-level encryption in databases
- **Config File Encryption**: encrypted storage of sensitive configurations like keys

### Challenges and Technical Solutions for SM Algorithm Migration

Migrating from international algorithms (RSA/AES/SHA) to SM algorithms is a systemic engineering challenge:

**Challenge 1: Algorithm Performance Differences**. SM2 signing is 2-3x slower than ECDSA due to differences in elliptic curve parameters and protocol details. Solution: Autional performs batch pre-signing during JWT generation and pools identity tokens for reuse.

**Challenge 2: Cryptographic Library Dependency**. The Go standard library does not include SM algorithms, requiring third-party libraries like `tjfoc/gmsm` or `emmansun/gmsm`. The maintainers and maturity of these libraries need assessment. Autional uses independently security-audited versions of SM libraries with continuous CI verification.

**Challenge 3: TLS Adaptation**. Standard TLS handshake uses ECDHE + RSA/AES, while SM TLS should use ECDHE + SM2/SM4. However, the SM TLS implementation (GM/T 0024 SSL VPN Technical Specification) is not fully compatible with international TLS 1.3. Autional adopts a dual-protocol-stack approach: intranet communication uses SM TLS, extranet communication uses standard TLS 1.3.

## Xinchuang Adaptation: From "Runnable" to "Usable"

Xinchuang (Information Technology Application Innovation) aims to achieve independent control of key technologies and products. This affects deployment environment choices:

- **CPU Architecture**: x86 → ARM (Kunpeng, Phytium) / LoongArch (Loongson)
- **OS**: Windows → Kylin / Tongxin UOS
- **Database**: SQL Server/Oracle → DM (DaMeng) / Kingbase / GaussDB

For Autional, the core work of Xinchuang adaptation includes:

### Build Adaptation

Go 1.25 natively supports Linux ARM64, enabling direct cross-compilation:
```bash
GOOS=linux GOARCH=arm64 go build -o identity-service-linux-arm64 ./cmd/server
```

### Database Adaptation

Autional supports database driver switching through the infra-client/gorm factory pattern. Adapting to DaMeng database requires only:
1. Importing DaMeng's GORM driver
2. Configuring the database connection string
3. Verifying SQL syntax compatibility of AutoMigrate output

### Storage Adaptation

- File storage: switching from MinIO/S3 to domestic object storage (e.g.,杉岩, XSKY)
- Cache: switching from Redis to Redis-protocol-compatible domestic caches (e.g., Garnet, Tendis)

### Middleware Adaptation

- Message queue: switching from RabbitMQ to RocketMQ or domestic Pulsar distributions
- API gateway: retaining gateway-service, but switching underlying communication to SM TLS

## Intranet Deployment and Offline Operation

Many government systems require fully offline operation (no internet connection), which poses unique challenges for identity systems:

**Passkey and Biometrics**: FIDO2/WebAuthn Passkeys typically require platform sync services (e.g., iCloud Keychain) for cross-device synchronization. Offline environments need alternatives:
- Using SM2-based hardware keys (similar to USB tokens) via USB/NFC connection
- Fully local facial recognition without relying on cloud APIs

**Software Updates**: Software updates in offline environments must use secure offline media (e.g., encrypted discs, signed USB drives). Autional needs to provide offline patch verification and installation mechanisms.

**Time Synchronization**: JWT tokens, TOTP codes, and session timeouts all depend on accurate time. Offline environments must ensure time consistency through local NTP servers or GPS timing.

## Conclusion

Building identity authentication for government systems is a "dance in chains" engineering challenge—constructing secure and practical identity infrastructure under the multiple constraints of Classified Protection regulations, SM standards, and Xinchuang catalog requirements.

Autional provides an out-of-the-box identity solution for government IT modernization through complete SM algorithm support (SM2/SM3/SM4), multi-CPU architecture compilation adaptation, domestic database and middleware integration, offline deployment capabilities, and enhanced audit and access control—without requiring "building from scratch."
