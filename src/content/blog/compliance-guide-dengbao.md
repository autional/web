---
title: "Dengbao 2.0 Compliance Guide: Identity System Requirements"
date: "2026-05-11"
category: "Compliance"
tags: ["Dengbao", "Compliance", "Security Certification"]
readTime: "10 minutes"
excerpt: "An in-depth interpretation of Dengbao 2.0's specific requirements for identity authentication systems, and how AuthMS helps you pass dengbao evaluation through built-in security capabilities."
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

> **Compliance Disclaimer**: The dengbao 2.0-related technical capabilities described in this article represent the design objectives of the AuthMS platform and do not constitute a legal statement of dengbao compliance certification. Dengbao evaluation must be conducted through a comprehensive on-site assessment by a qualified evaluation institution, and the ultimate compliance responsibility rests with the information system operator.

*Information Security Technology — Baseline for Classified Protection of Cybersecurity* (Dengbao 2.0) is one of the core compliance standards in China's cybersecurity landscape. For SaaS platforms, enterprise internal systems, and public-facing online services, Dengbao 2.0 sets clear and strict requirements for identity authentication systems.

This article interprets the identity-related requirements of Dengbao 2.0 article by article and analyzes how AuthMS meets these requirements.

## Dengbao Classification Overview

Dengbao 2.0 classifies information system security protection into five levels. For most SaaS and commercial platforms, Level 2 (System Audit Protection) and Level 3 (Security Marking Protection) are the most common evaluation grades. This article uses Level 3 requirements as the primary reference.

Dengbao 2.0 divides security requirements into two categories: technical and managerial. The technical chapters "Secure Computing Environment" and "Secure Zone Boundary" directly involve identity authentication systems.

## I. Identity Authentication (Secure Computing Environment L3-1)

### Evaluation Requirements

- User identity identification and authentication must be performed at login, with unique identity identifiers
- Authentication information must have complexity requirements and be periodically changed
- Login failure handling must be provided, including session termination, limiting illegal login attempts, and automatic logout
- When performing remote management, necessary measures must be taken to prevent authentication information from being eavesdropped during network transmission
- Two or more combined authentication techniques (passwords, cryptographic technology, biometrics) must be used for user identity authentication

### AuthMS Response

**Unique Identification and Password Policies**: AuthMS's identity-service supports login via username, email, or phone number — all unique identifiers. Password policies are fully configurable:

- **Complexity requirements**: Supports configurable requirements for minimum length, uppercase/lowercase letters, digits, and special characters
- **Password history**: Automatically checks history when users change passwords, preventing reuse of the last N passwords
- **Periodic change**: Supports password expiration settings with automatic user notification before expiry
- **Login failure lockout**: Automatically locks accounts after consecutive login failures exceeding a threshold; both lockout duration and failure count are configurable
- **Session timeout**: Session lifecycle management via session-service, supporting idle timeout and absolute timeout

**Multi-Factor Authentication (MFA)**: AuthMS's mfa-service provides an out-of-the-box solution for Dengbao 2.0's requirement of "two or more combined authentication methods." It supports TOTP time-based one-time codes, SMS verification codes, email verification codes, and Passkey (WebAuthn) — four authentication methods. Administrators can precisely control which users and which scenarios require MFA through policy configuration.

**Transmission Security**: AuthMS enforces HTTPS/TLS 1.3 across the entire chain. Communication from the gateway layer to microservices and inter-microservice internal communication all use mTLS encryption. Passwords undergo client-side PBKDF2 salted hashing before transmission, ensuring authentication information is not eavesdropped on the entire transmission path.

## II. Access Control (Secure Computing Environment L3-2)

### Evaluation Requirements

- Accounts and permissions must be assigned to logged-in users
- Default accounts must be renamed or deleted, and default passwords must be changed
- Excess and expired accounts must be promptly deleted or disabled
- Management users must be granted the minimum necessary permissions, achieving separation of management user privileges
- Authorized entities must configure access control policies, which define the rules for subject access to objects

### AuthMS Response

**Fine-Grained RBAC**: AuthMS's identity-service implements the full NIST RBAC standard — including Core RBAC, Hierarchical RBAC (role inheritance), and Static Separation of Duty (SoD).

- **Role hierarchy**: Roles support parent-child hierarchy (ParentID); child roles automatically inherit parent role permissions. For example, `SecurityAdmin` inherits all permissions from `AuditViewer`
- **Role assignment**: Many-to-many `UserRole` associations with attributes such as grant type (direct grant/approval grant) and expiration time
- **Direct permissions**: Supports bypassing roles to directly assign permissions to users for temporary authorization scenarios
- **SoD mutual exclusion**: Defines conflicting role pairs (`ConflictPair`) to prevent a single person from holding conflicting roles simultaneously, meeting privilege separation requirements
- **Approval workflow**: Sensitive role assignments require an approval process before activation

**Principle of Least Privilege**:

```go
// Read operations (security_admin can view but not modify)
admin.AdminRequiredWith("super_admin", "admin", "security_admin")

// Management write operations (admin and super_admin only)
admin.AdminRequiredWith("super_admin", "admin")

// Super-admin operations (super_admin only)
admin.AdminRequiredWith("super_admin")
```

**Default Account Management**: AuthMS provides no hardcoded backdoor accounts. The initial administrator is created via a bootstrap API on first deployment, and all default configurations require immediate modification. Account lifecycle management APIs support batch deactivation/deletion of expired accounts.

## III. Security Audit (Secure Computing Environment L3-3)

### Evaluation Requirements

- Security audit functionality must be enabled, covering every user
- Audit records must include event date/time, user, event type, and event result
- Audit records must be protected and regularly backed up to prevent unintended deletion, modification, or overwriting
- Audit record retention must meet standards such as GB/T 20945 (Level 3 systems: no less than 6 months)

### AuthMS Response

**Full Audit Coverage**: AuthMS's audit-service captures audit events through three channels:

1. **Automatic HTTP middleware audit**: All requests are automatically recorded — timestamp, operator ID, tenant ID, IP address, request path, HTTP method, response status code, and duration
2. **Domain event publishing**: Business services publish domain events (user registration, role changes, permission modifications, etc.) via `micro-pkg/event.Publisher`; the audit-service subscribes and automatically records them
3. **Explicit audit logging**: Critical operations can proactively call the audit API to record additional context

**Hash Chain Tamper-Proofing**: This is AuthMS's most core differentiating audit capability. Each audit record contains:

```
prev_hash = SHA-256(previous record content)
current_hash = SHA-256(prev_hash + current record content)
```

Any modification to historical records will cause hash mismatches in all subsequent records. Auditors can independently verify any record's integrity through Merkle proofs without trusting the system administrator.

**Retention Policy**: Supports configurable audit log retention policies by time and type. Logs beyond the retention period can be automatically archived to MinIO object storage (with encryption and compression). Archived logs remain protected by the hash chain, ensuring long-term integrity and availability.

**SIEM Integration**: The audit-service supports real-time push of audit events to external SIEM systems (Splunk, ELK, etc.), meeting Dengbao 2.0's requirements for centralized auditing and real-time monitoring.

## IV. Data Encryption (Secure Computing Environment L3-4)

### Evaluation Requirements

- Cryptographic techniques must be used to ensure confidentiality of important data during transmission
- Cryptographic techniques must be used to ensure confidentiality of important data during storage

### AuthMS Response

**Transmission Encryption**:

| Component | Encryption Method |
|-----------|-------------------|
| Client → Gateway | TLS 1.3 (AES-256-GCM) |
| Gateway → Microservices | mTLS internal certificates |
| Inter-service gRPC | mTLS |
| Database connections | TLS (postgres) + password hashing |
| Cache connections | TLS (redis) + AUTH authentication |

**Storage Encryption**:

- **Password storage**: BCrypt (cost=12) salted hash — never stored as plaintext or in reversibly encrypted form
- **MFA secrets**: TOTP seed keys encrypted with AES-256-GCM; keys injected via environment variables
- **OAuth Tokens**: Refresh Tokens and Client Secrets stored as SHA-256 hashes; plaintext returned only once at creation
- **API Keys**: `key_hash` field stores SHA-256 hash; the original key is returned only at creation. All sensitive fields are uniformly tagged with `json:"-"` to prevent serialization leaks

**Sensitive Field Inventory**: AuthMS's database schema strictly audits all sensitive fields (password hashes, salts, OAuth tokens, MFA secrets, API key hashes, webhook secrets, provider credentials), ensuring no omissions.

## V. Security Incident Response (Secure Zone Boundary L3)

### Evaluation Requirements

- Security incidents must be handled promptly upon discovery
- A graded security incident response mechanism must be established
- Security incidents must be classified and graded

### AuthMS Response

**Real-Time Monitoring**: The audit-service's anomaly detection module continuously analyzes the audit event stream, identifying abnormal login patterns (geo-anomaly, brute-force attacks, unusual-time access) and automatically triggering alerts.

**Security Incident Tracking**: The compliance-service's Security Incident Management module provides a complete incident lifecycle — from creation, classification, assignment, investigation, to closure — with audit records and evidence attachments at every step.

**SIEM Connector**: Supports real-time push of alerts and events to SIEM systems such as Splunk and ELK. The `security_admin` role allows security operations personnel to view security dashboards, update anomaly status, and export logs, but restricts them from modifying configurations or managing rules — achieving privilege separation between security operations and configuration management.

## Dengbao Compliance Roadmap

Teams using AuthMS can accelerate dengbao certification along the following path:

| Phase | Activity | AuthMS Built-In Capability | Estimated Time |
|-------|----------|----------------------------|----------------|
| 1. Gap Assessment | Article-by-article review against Dengbao 2.0 requirements | Compliance checklist + security audit report | 1-2 days |
| 2. Technical Remediation | Implement missing security controls | Password policies + MFA + RBAC + hash chain audit | 1-3 days |
| 3. Operational Monitoring | Continuous operation and audit evidence collection | Automated audit logs + security dashboard | 1-3 months |
| 4. Compliance Evaluation | Submit to evaluation institution | Audit log export + compliance report generation | Per evaluator schedule |

AuthMS is preparing for Dengbao 2.0 Level 3 evaluation. Its built-in security capabilities cover the vast majority of identity-related requirements in Dengbao 2.0. If you are preparing for dengbao evaluation, AuthMS can shorten the identity compliance cycle from months to days.

---

*This article is for reference only. The specific requirements of dengbao evaluation are subject to the interpretation of the evaluating institution. It is recommended to engage a qualified dengbao evaluation institution for formal assessment.*
