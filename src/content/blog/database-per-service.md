---
title: "Microservice Database Isolation: Why Each Service Needs Its Own Database"
date: "2026-05-14"
category: "Architecture"
tags: ["Database Isolation", "Microservices", "Data Security"]
readTime: "8 min"
excerpt: "AuthMS's 16 microservices each have their own independent PostgreSQL database. This 'database-as-service-boundary' model delivers fault isolation, independent scaling, and hardened security boundaries."
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

In microservice architecture, one question keeps coming up: "Does every service really need its own database? Isn't sharing a single database simpler?"

The answer is: for identity and authentication systems, database isolation isn't over-engineering — it's a **cornerstone of security and reliability**. AuthMS has strictly followed the Database-per-Service pattern from day one, with 16 microservices each having their own independent PostgreSQL database. Here are our design considerations and lessons learned.

## Why Can't We Share a Database?

The "benefits" of a shared database seem straightforward: simple JOIN queries, strong transactional consistency, and managing just one database. But these "benefits" are actually traps:

### Hidden Coupling

When the identity-service's `users` table and the billing-service's `subscriptions` table live in the same database, developers naturally write cross-table JOINs. This seemingly convenient operation leads to:

- A billing team DBA tweaks an index and inadvertently affects identity's query plan
- One service's slow query drags down the entire database instance
- Ownership of "who owns this table" becomes ambiguous

### Cascading Single Point of Failure

This is the most critical problem. If the shared database instance goes down:

- ❌ Users can't log in (identity)
- ❌ All sessions are invalid (session)
- ❌ MFA verification is unavailable (mfa)
- ❌ OAuth authorization fails (oauth)
- ❌ Wallet balances are unreadable (wallet)

**The entire platform's authentication system is completely paralyzed.** But with database isolation:

- billing DB down → can't top up, but users can still log in and use existing balance
- notification DB down → email delivery is delayed, but login is unaffected
- session DB down → users need to re-login (degraded experience), but registration and password reset still work

That's real **fault isolation**.

## AuthMS Database Isolation in Practice

### 16 Services, 16 Databases

| Service | Database | Core Responsibility |
|---------|----------|-------------------|
| identity-service | `authms_identity` | Users, roles, permissions, tenants |
| profile-service | `authms_profile` | Extended user attributes, departments |
| tenant-service | `authms_tenant` | Tenant config, subscriptions, white-label |
| session-service | `authms_session` | Login sessions, refresh tokens |
| mfa-service | `authms_mfa` | Multi-factor auth (TOTP/SMS/Email) |
| oauth-service | `authms_oauth` | OAuth 2.0 / OIDC authorization |
| wallet-service | `authms_wallet` | Wallet balance, transaction history |
| point-service | `authms_point` | Loyalty points system |
| billing-service | `authms_billing` | Billing, invoices, payments |
| notification-service | `authms_notification` | Notification templates, channels, send records |
| communication-service | `authms_communication` | Email, SMS, Webhook |
| storage-service | `authms_storage` | File storage metadata |
| audit-service | `authms_audit` (MongoDB) | Audit logs |
| compliance-service | `authms_compliance` | Compliance reports, data exports |
| Other services | Independent DB each | — |

> Note: audit-service uses MongoDB instead of PostgreSQL because audit log data is document-oriented (unstructured append-heavy data, time-series writes) with a fundamentally different access pattern from relational databases. This database type diversity is itself a benefit of isolation.

### Connection and Authentication

Each service connects to its own database using an independent database user:

```yaml
# tenant-service connection config
POSTGRES_HOST: postgres
POSTGRES_PORT: 5432
POSTGRES_DB: authms_tenant
POSTGRES_USER: authms_tenant
POSTGRES_PASSWORD: ${TENANT_DB_PASSWORD}
```

Connection pool settings are also configured per service. identity-service's 25 connections won't compete with billing-service's 10 connections for database resources. While they share the same PostgreSQL cluster at the PgBouncer layer, database-level isolation ensures quota and resource fairness.

## Cross-Service Data Queries: Beyond Database JOINs

### Approach 1: gRPC/HTTP API Calls

When billing-service needs a user's email, it doesn't JOIN the database directly — it calls the identity-service API:

```go
// billing-service calling identity-service
resp, err := identityClient.GetUser(ctx, &pb.GetUserRequest{UserId: userID})
if err != nil {
    return nil, fmt.Errorf("get user: %w", err)
}
email := resp.GetEmail()
```

Benefits of this approach:

- identity-service can modify its `users` table structure anytime without affecting billing
- identity-service can sanitize email fields (`j***@example.com`), giving billing inherently sanitized data
- Centralized access control: only identity-service has permission to read sensitive columns like `password_hash`
- Built-in retry and circuit breaking: gRPC client interceptors handle network issues automatically

### Approach 2: Domain Events + Data Redundancy

For high-frequency read scenarios, API call latency and availability costs are too high. Event-driven data redundancy is the answer:

1. identity-service user changes email → publishes `user.profile.updated` event
2. billing-service consumes the event → updates local `user_profiles` cache table

```go
// billing-service local cache table
type UserProfile struct {
    UserID    string `gorm:"primaryKey"`
    Email     string `gorm:"-:migration"`  // encrypted storage
    EmailHash string `gorm:"index"`         // for exact matching
    UpdatedAt time.Time
}
```

This pattern is widely used in AuthMS:

- notification-service caches user `email` and `phone` (avoids calling profile API for every email)
- compliance-service caches tenant `plan` info (avoids calling billing API for every compliance scan)
- audit-service receives all service audit logs via event stream, not API polling

**Key principle**: Redundant data is only cached within the consuming service, never used as a cross-service source of truth. The "single source of truth" for identity data always remains in identity-service.

## Data Consistency and Eventual Consistency

Database isolation trades single-database ACID guarantees for **eventual consistency**:

### Event-Driven Consistency Pattern

When a user registers, multiple services are involved:

1. identity-service creates user → writes to `authms_identity`
2. Publishes `user.created` event to RabbitMQ
3. profile-service consumes event → creates default profile → writes to `authms_profile`
4. wallet-service consumes event → creates empty wallet → writes to `authms_wallet`

If step 3 fails, the event enters the Dead Letter Queue (DLQ), triggering an alert for retry.

For operations requiring strong consistency (e.g., debit), AuthMS uses the **Transactional Outbox Pattern**:

```go
func (s *WalletService) Withdraw(ctx context.Context, req *WithdrawRequest) error {
    return s.db.Transaction(func(tx *gorm.DB) error {
        // 1. Update balance (atomic)
        result := tx.Model(&Wallet{}).
            Where("user_id = ? AND balance >= ?", req.UserID, req.Amount).
            Update("balance", gorm.Expr("balance - ?", req.Amount))
        if result.RowsAffected == 0 {
            return ErrInsufficientBalance
        }
        
        // 2. Write transaction record
        tx.Create(&Transaction{...})
        
        // 3. Write outbox record
        tx.Create(&Outbox{
            Topic: "wallet.transaction.completed",
            Payload: marshal(event),
        })
        
        return nil
    })
}
```

The outbox background worker scans the `outbox` table and reliably delivers messages to MQ. Even if MQ is temporarily unavailable, messages are never lost — this is the core mechanism for cross-service data consistency.

## Independent Scaling

Database isolation lets each service independently choose its database configuration:

- **High-concurrency services** (identity, session): high-frequency reads/writes, need more connections and higher IOPS quotas
- **Low-frequency services** (billing, compliance): mostly batch processing, can use smaller instance specs
- **Time-series write-heavy** (audit): MongoDB sharded cluster supports horizontal write scaling
- **Hybrid** (storage): PostgreSQL for metadata, MinIO for file binaries

This flexibility is impossible with a shared database. A billing export task (compliance-service full-table scan of 2 million audit records) shouldn't consume I/O bandwidth from authentication queries (identity-service high-frequency point reads on the `users` table).

## Security Boundaries

Database isolation creates one of the strongest security boundaries:

- **Key isolation**: Each service has an independent database password. Compromising one service doesn't expose all data.
- **Breach containment**: A SQL injection in billing's `subscriptions` table doesn't give attackers access to `users` table password hashes.
- **Clear compliance scope**: A GDPR "data export" request only needs to scan the identity and profile databases, not all 16.
- **Audit integrity**: audit-service's MongoDB cluster has independent access controls — other services cannot modify audit logs.

## Operational Cost and Mitigation

Database isolation does increase operational overhead. AuthMS manages this through:

### Unified Schema Management

Each service uses GORM AutoMigrate for schema changes. The `check-db-schema.py` script in the CI pipeline compares Go domain models against actual database table structures — catching drift before deployment.

### PgBouncer Unified Entry Point

All 16 services' database connections go through PgBouncer (transaction pooling mode). Operations teams maintain just one PostgreSQL cluster + one PgBouncer instance, not 16 independent database servers.

### Backup Strategy

```bash
# Full backup (daily)
pg_dumpall -h pgbouncer -U authuser > /backups/all_dbs_$(date +%Y%m%d).sql

# Single DB backup (on-demand, e.g., identity hourly)
pg_dump -h pgbouncer -U authuser -d authms_identity > /backups/identity_$(date +%Y%m%d%H).sql
```

Isolation enables more flexible backup granularity. Audit logs (tens of GB, large daily increments) can have their own backup window, separate from core identity data (hundreds of MB, low change frequency).

## Summary

Database-per-service isn't a silver bullet, but in identity and authentication systems, the benefits far outweigh the costs:

| Benefit | Description |
|---------|-------------|
| Fault isolation | One DB crash doesn't affect core login functionality |
| Security boundary | Breach containment + independent keys + clear compliance scope |
| Independent scaling | High-throughput → high spec, low-frequency → low spec |
| Technology heterogeneity | audit uses MongoDB, storage uses MinIO+PG |
| Schema independence | Each service evolves independently, lock-free changes |
| Flexible backups | Custom backup policies per service granularity |

If you're building a multi-tenant SaaS identity platform, adopt database isolation from day one. Splitting a shared database later is far more difficult than starting isolated — which is exactly why AuthMS made this choice.
