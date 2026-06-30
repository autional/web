---
title: "Dengbao Level 3 Compliance Checklist: 20 Must-Check Items for Identity Systems"
date: "2026-05-27"
category: "Compliance"
tags: ["Dengbao", "Level 3", "Compliance Checklist"]
readTime: "9 min"
excerpt: "In Dengbao Level 3 certification, identity authentication and access control are key audit domains. This article breaks down the 20 specific requirements that certification assessors focus on during on-site inspections, analyzes evaluation criteria and common pitfalls, and shows how AuthMS meets core Dengbao Level 3 requirements through built-in password policies, MFA, RBAC, audit logs, and data encryption."
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

> **Compliance Disclaimer**: The Level 3 classified protection security capabilities described in this article represent AuthMS platform design goals and do not constitute Level 3 certification. Dengbao certification must be completed by a qualified third-party assessment body. The final compliance responsibility rests with the information system operator. The check items listed here are for reference only; actual evaluation standards are subject to the latest national releases.

China's Cybersecurity Classified Protection 2.0 (Dengbao 2.0) imposes strict requirements on identity authentication and access control for Level 3 systems. For most enterprise-facing SaaS products, Level 3 is the minimum market access requirement — without certification, you can't serve government, state-owned enterprise, financial, or other critical industry clients.

Level 3 Dengbao evaluation covers both technical and management aspects. On the technical side, **Identity Authentication** and **Access Control** are two independent and most critical evaluation units within the "Secure Computing Environment" domain.

This article selects the 20 most frequently inspected items during on-site assessments and analyzes each one.

## I. Identity Authentication (8 Items)

### 1. Unique User Identity

**Requirement**: Logged-in users shall be identified and authenticated, with unique identity identifiers.

**On-site check**: Assessors check for duplicate usernames or user IDs in the system. They examine the user table structure to verify that `username` or `user_id` columns have unique constraints.

**Common pitfalls**: Allowing multiple users to register with the same phone number or email, or generating duplicate identity identifiers during account merging or migration.

**How AuthMS meets it**: identity-service's user table has unique indexes on `username`, `email`, and `phone`. ULID primary keys guarantee global uniqueness. Uniqueness is enforced at both the database constraint and application logic levels on every registration or update operation.

### 2. Authentication Failure Handling

**Requirement**: The system shall have login failure handling functionality, including ending sessions, limiting invalid login attempts, and connection timeout.

**On-site check**: Assessors attempt multiple failed logins on the same account to verify if the system has a lockout mechanism and a recovery mechanism after lockout.

**Common pitfalls**: Only client-side validation of login attempts (can be bypassed); no server-side lockout; lockout duration too short (e.g., 1 minute); lockout can be bypassed by modifying URL parameters.

**How AuthMS meets it**: identity-service enforces server-side limits — temporary account lockout after 5 failed attempts. Progressive lockout (see item 5 below). Lockout state is maintained server-side and cannot be bypassed by the frontend.

### 3. Password Complexity

**Requirement**: Authentication information shall have complexity requirements and shall be changed periodically.

**On-site check**: Assessors check whether password policies cover minimum length (Level 3 typically requires ≥ 8 characters), whether three or more character types are required (uppercase, lowercase, digits, special characters), and whether password expiry is enforced.

**Common pitfalls**: Password policy only enforced during registration but not during password changes; password expiry policy not actually enforced (just a UI hint); temporary passwords from admin resets not forced to change.

**How AuthMS meets it**: Password policy is uniformly enforced by identity-service across all scenarios: registration, password changes, admin resets, and password recovery. Minimum length 8 chars (configurable), supports digit+upper+lower+special character combinations. Configurable 90-day password expiry, password history up to 24 entries.

### 4. In-Transit Authentication Protection

**Requirement**: Authentication information shall be encrypted during transmission.

**On-site check**: Assessors use Wireshark to capture traffic and verify whether login requests use HTTPS. They specifically check: whether passwords are in the POST body (not URL parameters); whether HTTPS certificates are valid; whether weak cipher suites are supported.

**Common pitfalls**: Using HTTP in development; production allows HTTPS downgrade; passwords transmitted via GET query parameters (visible in server logs); using self-signed certificates instead of CA-issued ones.

**How AuthMS meets it**: Full-site HTTPS enforcement, HTTP auto-redirects (301) to HTTPS. TLS 1.2+ with strong cipher suites only. Passwords are always transmitted in the POST body. HTTPS termination is handled at the gateway-service layer.

### 5. Multi-Factor Authentication

**Requirement**: Two or more combined authentication technologies shall be used for user identification.

**On-site check**: Assessors check whether the system supports MFA and whether critical operations (viewing sensitive data, modifying config) require MFA. Dengbao Level 3 increasingly mandates MFA, especially in financial and government data scenarios.

**Common pitfalls**: MFA is supported but not enforced; incomplete MFA implementation (e.g., SMS OTP without usage limits or expiry); MFA can be bypassed by the frontend.

**How AuthMS meets it**: mfa-service provides complete multi-factor authentication capabilities (TOTP, WebAuthn/FIDO2, SMS OTP, HOTP). Admins can configure role-based MFA enforcement, with high-privilege accounts enforced by default. All MFA verification is server-side and cannot be bypassed by the frontend.

### 6. Cross-System Identity Uniqueness

**Requirement**: User identifiers shall remain unique throughout the system's lifecycle, and when interacting with other systems for authentication, identifiers shall be unique and traceable.

**On-site check**: Assessors verify whether deleted user IDs are reused (they shouldn't be); whether cross-system user identifiers have a consistent mapping; whether user identifiers are consistent in SSO or OIDC integration.

**How AuthMS meets it**: User IDs use ULID (time-sorted globally unique identifiers) that are never reused after deletion. All services identify users by the same ID. In OIDC integration, the `sub` claim ensures cross-system user identifier consistency.

### 7. Session Management

**Requirement**: The system shall have login connection timeout and auto-logout functionality.

**On-site check**: Assessors log in, leave the system idle for a period, then check whether the system automatically logs out and whether the user can return to the previous state without re-authentication.

**Common pitfalls**: Only a frontend timer (resets on page refresh) with no server-side session timeout; browser back button can still access authenticated pages after logout; Session Cookie has no expiration.

**How AuthMS meets it**: session-service maintains server-side session timeout — absolute timeout (e.g., 8 hours) and idle timeout (e.g., 30 minutes). After timeout, any request to an authenticated page is redirected to login. Double protection via cookies and server-side sessions.

### 8. Critical Operation Two-Factor Protection

**Requirement**: Critical operations shall require secondary authentication.

**On-site check**: Do operations like password changes, modifying bound phone/email, account deletion, large transactions require re-entering the password or MFA verification?

**How AuthMS meets it**: Sensitive operations trigger secondary authentication. identity-service's `POST /password/change` requires the current password. Critical config changes require admin MFA verification. The adaptive MFA engine automatically elevates the authentication level for high-sensitivity operations.

## II. Access Control (6 Items)

### 9. Least Privilege

**Requirement**: The principle of least privilege shall be followed, granting users the minimum permissions needed to complete their tasks.

**On-site check**: Assessors sample default permissions for newly registered users, checking for unnecessary admin permissions. They check if "admin by default" exists.

**How AuthMS meets it**: The RBAC system follows least privilege. New users default to a basic role (`user`) with no admin permissions. All permissions must be explicitly assigned by admins. Permission simulation allows admins to preview a specific user's effective permissions without switching accounts.

### 10. Access Control Policy Coverage

**Requirement**: Access control policies shall cover all subjects, objects, and their operations.

**On-site check**: Assessors traverse all system feature pages and API endpoints to check for access control gaps — pages accessible without login, low-privilege users bypassing frontend controls via direct API requests.

**Common pitfalls**: API endpoint access control only implemented on the frontend (hiding menu items) with no independent backend API verification; file download endpoints without access control; exported data containing unauthorized information.

**How AuthMS meets it**: All API endpoints perform permission verification at the handler layer, independent of the frontend. gateway-service validates JWT-declared roles and permissions at the routing layer. RBAC middleware enforces checks before business logic execution.

### 11. Separation of Duties (SoD)

**Requirement**: Roles such as security administrator, system administrator, and security auditor shall have separated permissions.

**On-site check**: Assessors check whether the system defines administrative roles and whether there are separation of duties constraints — i.e., one user cannot simultaneously hold administrative and audit permissions.

**How AuthMS meets it**: Three management roles are pre-defined: Super Admin (system administrator), Admin (administrator), and Security Admin (security auditor). Security Admin can view all security/audit data but cannot modify it. SoD constraints prevent a single user from holding conflicting roles simultaneously.

### 12. Fine-Grained Access Control

**Requirement**: Access control granularity shall reach the user level for subjects and the file or database table level for objects.

**On-site check**: Assessors verify whether the permission system can control access to individual records or pieces of data, not just feature menus or page-level access.

**Common pitfalls**: Only page-level access control (e.g., "can see user management page" but can't distinguish "can only see their own department's data").

**How AuthMS meets it**: RBAC permissions can be granular down to individual API endpoints. Supports data-level filtering (based on tenant_id and role). Allows resource-level access control policy definitions.

### 13. Access Control List Management

**Requirement**: Access control lists shall be managed and maintained.

**On-site check**: Assessors check for permission management interfaces, audit logs for permission changes, and automatic revocation of expired permissions.

**How AuthMS meets it**: Provides complete permission management API and admin UI. Permission changes trigger audit events recording operator, time, and change details. Supports temporary permissions with expiration.

### 14. Remote Access Control

**Requirement**: The address range for remote access shall be restricted.

**On-site check**: Check if the system can restrict access sources by IP address for users or APIs.

**How AuthMS meets it**: Supports IP whitelisting — API Keys or users can be restricted to specific IP address ranges. gateway-service performs IP checks before requests reach business services.

## III. Security Audit (3 Items)

### 15. Comprehensive Audit Logging

**Requirement**: Security audit functionality shall be enabled, covering each user with auditing of important user behaviors and security events.

**On-site check**: Assessors log in and perform a series of operations (login, modify data, delete records, export data), then check whether audit logs record all these operations. They specifically check: whether logs contain the operator, time, operation type, target, result, and source IP.

**How AuthMS meets it**: audit-service records complete audit logs for all authentication events and admin operations. Log fields include: `event_id`, `user_id`, `tenant_id`, `action`, `resource`, `result`, `ip_address`, `user_agent`, `timestamp`. Covers all critical operations: login, logout, password changes, permission changes, data exports.

### 16. Audit Log Integrity Protection

**Requirement**: Audit records shall be protected against unauthorized deletion, modification, or overwriting.

**On-site check**: Assessors attempt to delete an audit log directly from the database and check whether the system has a detection mechanism — i.e., whether the system alerts or reports an anomaly on the next verification.

**How AuthMS meets it**: audit-service uses a hash chain to protect log integrity. Each audit record contains `prev_hash` (SHA-256 hash of the previous record) and `chain_index`. Any insertion, deletion, or modification of a log entry breaks the hash chain, which the system detects through periodic verification. Logs are stored append-only with no API for deletion.

### 17. Audit Record Retention

**Requirement**: Audit records shall meet retention requirements, with a minimum of 6 months.

**On-site check**: Assessors check the audit log retention policy — the oldest log date, whether there's an auto-cleanup policy.

**Common pitfalls**: Audit logs stored in the application database are purged along with business data; retention period shorter than 6 months; archived logs are not retrievable.

**How AuthMS meets it**: audit-service uses an independent MongoDB storage, independent of business database cleanup policies. Default retention of 12 months, configurable by admins for longer periods. Supports automatic archiving to cold storage (e.g., object storage) with continued searchability.

## IV. Data Security (3 Items)

### 18. Data-at-Rest Encryption

**Requirement**: Cryptographic techniques shall ensure the confidentiality of important data at rest.

**On-site check**: Assessors check how sensitive database fields (passwords, phone numbers, national IDs, tokens) are stored — plaintext or ciphertext.

**How AuthMS meets it**: Passwords are bcrypt-hashed (irreversible, not encryption), API Keys use SHA-256 hash storage. PII fields (phone numbers, email, national IDs) use AES-256-GCM field-level encryption. Encryption keys are managed by cloud KMS and only exist in process memory as plaintext.

### 19. Data-in-Transit Encryption

**Requirement**: Cryptographic techniques shall ensure the confidentiality of important data in transit.

**On-site check**: Packet capture to verify all API communication uses HTTPS and whether internal service communication is encrypted.

**How AuthMS meets it**: External APIs enforce HTTPS. Internal gRPC communication uses mTLS (Mutual TLS). gateway-service-to-business-service internal network communication is encrypted via TLS in deployed environments.

### 20. Data Backup and Recovery

**Requirement**: Local data backup and recovery functionality for important data shall be provided.

**On-site check**: Check for regular database backup strategies, encrypted backup storage, and whether recovery can be completed within the specified time.

**How AuthMS meets it**: Each microservice uses an independent PostgreSQL database (schema isolation), supporting per-service granularity backups. Backup data is encrypted with AES-256. Provides a rebuild solution based on GORM AutoMigrate + initial SQL.

## Certification Preparation Checklist

| Item | Description |
|------|-------------|
| Policy documents | Information security management policy, password management policy, access control strategy documentation |
| Technical config | Screenshots/config files proving each security control is properly implemented |
| Audit logs | At least 6 months of complete audit logs available for sample checking |
| Vulnerability scan | Most recent vulnerability scan report (including remediation results) |
| Penetration test | Most recent penetration test report |
| Emergency plan | Security incident response plan and drill records |
| Personnel training | Security training records |

Level 3 Dengbao certification isn't a one-time event — it's ongoing validation of security management maturity. Assessors don't just check technical implementation; they look for institutionalized, routinely executed security management. AuthMS's built-in capabilities help you pass the technical inspection, but having sound policies and processes is equally important.
