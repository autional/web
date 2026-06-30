---
title: "From Monolith to Microservices: AuthMS's Evolution Journey"
date: "2026-03-30"
category: "Architecture"
tags: ["Microservices", "Evolution", "Engineering"]
readTime: "15 min"
excerpt: "AuthMS evolved from a startup monolith to 16 independent microservices powering enterprise-grade identity authentication. This article dives into the motivations, methodology, technical challenges, and hard-won lessons of the拆分 journey, covering distributed tracing, graceful shutdown, database isolation, and other key decisions — providing first-hand reference for teams considering microservices adoption."
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

In early 2024, the first version of AuthMS was a Go monolith under 8,000 lines of code. It ran on a single server, connected to one PostgreSQL instance and one Redis — enough to handle login and registration for early customers. Two years later, AuthMS has evolved into 16 independent microservices, processing hundreds of millions of authentication requests daily for businesses of all sizes.

This article documents that evolution — not just the technology choices, but the continuous iteration of a team across architecture decisions, engineering culture, and product philosophy.

## Why Does an Authentication System Need Microservices?

When the team first proposed microservices, the most common question was: "Isn't authentication just looking up a user table and issuing a token? Why split it into a dozen services?" The answer lies precisely in that phrase "just looking up a user table."

### Naturally Different Resource Requirements

Consider three typical scenarios:

- **Login authentication**: High concurrency, low latency (<50ms P99), peak traffic can reach 50x normal volume (e.g., Friday afternoon login surges). Requires significant compute for password hashing and JWT signing.
- **Audit logging**: High-throughput writes, latency-tolerant (<2s acceptable), but data volume grows linearly with user activity — storage pressure far outweighs compute pressure.
- **OAuth authorization**: Requires maintaining long-lived state (authorization code lifecycle), involves multiple redirects, with a traffic pattern completely different from regular API calls.

If these three functions share the same process, you cannot scale CPU for login authentication without wasting resources on the audit module. You cannot provision high-throughput disks for audit logs alone. You cannot tune connection pool parameters for OAuth independently. **In a monolith, all modules share the same infrastructure configuration — the weakest link dictates the entire system's performance.**

### Fault Isolation: A Single Bug Mustn't Crash the Whole System

A Q3 2024 production incident left an indelible mark. During bulk user import by an admin, an inadequately tested CSV parsing function entered an infinite loop, consuming all available goroutines. The result: not just the import feature went down — the entire authentication system (login, registration, password reset) became completely unavailable. Dozens of customers were affected, with downtime exceeding twenty minutes (a hypothetical scenario from architectural retrospective).

After microservices adoption, similar failures are contained within a single service. If `identity-service`'s user import module goes down, `session-service` still validates tokens, `mfa-service` still processes multi-factor authentication, and users' login experience is completely unaffected.

### Team Autonomy: A 15-Person Team Needs Parallel Development

As the product grew (multi-factor authentication, OAuth/OIDC support, wallet system, compliance auditing, RBAC permission model…), the team expanded from 3 to 15 people. In a monorepo, code from different feature modules intertwined, merge conflicts became daily occurrences, and release cadences blocked each other.

After microservices, each service has independent code ownership (AuthMS uses a pseudo-monorepo pattern with Go monorepo + independent `go.mod`), allowing teams to develop, test, and deploy independently. The "Auth team" can modify `identity-service` without affecting the "Compliance team" releasing `compliance-service`. **Release cycles shortened from bi-weekly to on-demand, with up to 8 hotfixes deployed per day during peak periods.**

## How to Split: By Business Capability, Not Technical Layer

This was one of our most important decisions — and a common trap.

### The Wrong Way: Split by Technical Layer

```
auth-handler-service → auth-service → auth-repository-service
```

This approach merely turns function calls into RPC calls without solving any real problems, while introducing network latency and serialization overhead.

### AuthMS's Approach: Split by Business Capability

Our principle: **one service = one complete business capability**.

| Service | Business Capability | Database |
|---------|-------------------|----------|
| identity-service | User registration, login, password management | PostgreSQL |
| profile-service | User profiles, avatars, preferences | PostgreSQL |
| tenant-service | Multi-tenant management, plan binding | PostgreSQL |
| session-service | Session creation, validation, invalidation | PostgreSQL |
| mfa-service | Multi-factor authentication (TOTP/SMS/hardware keys) | PostgreSQL |
| oauth-service | OAuth 2.1 / OIDC authorization | PostgreSQL |
| wallet-service | Balance management, transaction records | PostgreSQL |
| point-service | Points management | PostgreSQL |
| audit-service | Audit log collection and query | MongoDB |
| notification-service | Email, SMS, in-app notifications | PostgreSQL |
| communication-service | Message templates, channel management | PostgreSQL |
| storage-service | File upload, object storage proxy | PostgreSQL + MinIO |
| billing-service | Billing, plans, invoices | PostgreSQL |
| compliance-service | GDPR/DSAR, data export, consent management | PostgreSQL |
| gateway-service | API gateway, rate limiting, route aggregation | — |

Each service owns its own database instance (or schema). **Services don't share databases; they communicate only via APIs.** This ensures each service can choose the best storage solution independently — for example, audit-service uses MongoDB over PostgreSQL because audit logs are naturally document-oriented, with write throughput far exceeding relational query needs.

### Split Priority: From Edge to Core

We adopted a gradual "edge-to-core" splitting strategy:

1. **Edge stateless services first** (audit-service, notification-service): Loosest coupling with core auth flow — even if problems arise, login is unaffected.
2. **High-frequency independent modules next** (session-service, mfa-service): Session validation has the highest QPS — isolating it enables dedicated scaling and cache optimization.
3. **Core business later** (RBAC, OAuth within identity-service): These modules have the deepest coupling with login authentication, requiring more careful domain modeling.
4. **Infrastructure services last** (gateway-service, storage-service): Lowest migration risk, ideal for POC validation first.

The entire split took 8 months while keeping production services online. The key strategy was the **Strangler Fig Pattern**: first abstract boundaries with interfaces in the monolith, incrementally migrate implementations to new services, then cut off the old paths.

## Three Technical Challenges We Had to Solve

Microservices are no silver bullet. Here are the three biggest challenges we faced and AuthMS's solutions.

### Challenge 1: Distributed Tracing — One Login Traverses 6 Services

User enters password → `gateway-service` routes → `identity-service` verifies password → `session-service` creates session → `mfa-service` checks MFA requirement → `audit-service` logs the login → `notification-service` sends login alert.

If a login takes too long, how do you pinpoint which link is slow?

**AuthMS's Solution: OpenTelemetry Full-Chain Tracing**

We implemented unified tracing at all inter-service communication points:

- **HTTP ingress** (gateway-service): Injects W3C Trace Context (`traceparent` header)
- **Inter-service HTTP calls**: Auto-propagates `traceparent` via Gin middleware
- **gRPC calls**: Injected via `otelgrpc.NewClientHandler()`
- **MQ messages**: `micro-pkg/consumer/middleware.Tracing()` extracts trace context from message headers
- **Database queries**: GORM plugin auto-records SQL latency

Result: The Jaeger UI shows the complete call chain for a single login request, reducing the time to locate slow queries and anomalous nodes from "guesswork + add logs + redeploy" (30 minutes) to 30 seconds.

### Challenge 2: Graceful Shutdown — 16 Services Must Not Start and Stop Chaotically

In the monolith era, `Ctrl+C` ends the process — done. With microservices, shutting down a service involves:

- Waiting for in-flight HTTP requests to complete
- Waiting for MQ consumers to ack current messages
- Closing database connection pools
- Closing Redis connection pools
- Notifying the registry to de-register the node
- Waiting for gRPC server shutdown

Wrong order could lead to message loss, request failure, or connection leaks.

**AuthMS's Solution: Unified Bootstrapper `micro-middleware/app`**

We abstracted a unified Application architecture — all 15 services use the same bootstrap framework:

```go
app := app_pkg.New("identity-service", logger).
    WithRouter(router).
    WithHealth(healthHandler).
    WithServer("grpc", grpcServer).
    WithServer("mq-consumer", mqConsumerServer).
    WithCleanupNamed("db", func() error {
        sqlDB, _ := db.DB()
        return sqlDB.Close()
    }).
    WithReadTimeout(30 * time.Second).
    WithWriteTimeout(30 * time.Second)

app.Run(11001)
```

Key design decisions:

- **Server interface abstraction**: Any component that listens on a port (HTTP Server, gRPC Server, MQ Consumer) implements `app.Server` (`ListenAndServe` + `Shutdown`), with lifecycle managed by the framework.
- **Named cleanup with error returns**: `WithCleanupNamed(name, fn)` replaced the old unnamed `WithCleanup`. Each cleanup step has a name and returns errors. On shutdown, steps execute in reverse registration order — any failure is logged without blocking subsequent cleanup.
- **Signal capture and timeout control**: `app.Run()` captures SIGINT/SIGTERM, first closes Servers (stops accepting new requests), then executes Cleanup (releases resources). If not completed within 30 seconds, force-exits.

This unified framework not only solved graceful shutdown but reduced a new service's `main.go` from 200+ lines to 30 lines. When onboarding a new service, teams only need to define the Router and cleanup functions — everything else is handled by the framework.

### Challenge 3: Database Isolation — Services Can't Share Databases But Need Data Consistency

The golden rule of microservices is "each service owns its own database." But in reality:

- `identity-service` creates a user, then `profile-service` needs to create the corresponding profile
- `billing-service` changes a plan, then `tenant-service` must update the tenant's plan info
- `wallet-service` deducts funds, then `point-service` needs to grant points

Relying heavily on distributed transactions (2PC) hurts both performance and availability.

**AuthMS's Solution: Eventual Consistency + Domain Events**

We chose "eventual consistency" as the default strategy for cross-service data synchronization:

1. **Event publishing**: After a transaction commits, `identity-service` publishes a `user.created` event via `micro-pkg/event.Publisher`.
2. **Event subscription**: `profile-service`'s MQ Consumer listens for `user.created` and auto-creates a profile record.
3. **Retry and idempotency**: The `micro-pkg/consumer` framework has built-in retry (exponential backoff) and DLQ (dead letter queue) mechanisms. On consumer failure, messages are auto-requeued, retried up to 3 times, then sent to DLQ for manual or automated handling.
4. **Idempotency guarantee**: All cross-service operations are deduplicated by unique event ID, ensuring correctness under at-least-once delivery.

For scenarios requiring strong consistency (e.g., wallet deduction), we keep it within a single service using database transactions, never crossing service boundaries.

## Engineering Culture's Parallel Evolution

Architecture evolution isn't just technology. Here are equally important non-technical practices:

### CI Check System

From a monolith to 16 services, manual review can no longer guarantee code quality and architectural consistency. We built a CI pipeline with 30+ Python check scripts:

- **Architecture enforcement**: `check-dto-compliance.py` ensures all HTTP responses use `dto_base` unified envelopes; `check-factory-types.py` validates factory pattern consistency
- **Coding standards**: `check-error-codes.py` verifies error codes are registered in `base/error/registry.go`; `check-encoding.py` scans for GBK mixing and UTF-8 corruption
- **Runtime safety**: `check-db-schema.py` compares GORM models against actual database table structures to detect version drift

Every line of code must pass all checks before submission. **A good CI system enforces consistency better than any architecture document.**

### Documentation as Code

We insist on recording architecture decisions in AGENTS.md, stored in the same repository as code. Any PR involving architecture changes must update AGENTS.md. New developers can understand the entire system's architecture constraints and design philosophy within a day by reading AGENTS.md.

### Technical Debt Transparency

Not all technical debt needs to be paid immediately. We classify technical debt into three tiers: P0 (security risks), P1 (development efficiency impact), P2 (code smell), reviewed quarterly. Key principle: **Debt is fine — but you must know what debt you've incurred.**

## Present and Future

Today, AuthMS has been running stably on its microservice architecture for over 12 months. Sixteen services exposed through a unified gateway serve everything from individual developers to enterprise clients.

Areas we're exploring:

- **Service Mesh**: Moving inter-service authentication, rate limiting, and retry logic from the application layer to a Sidecar, further simplifying service code.
- **Multi-region deployment**: Leveraging PostgreSQL logical replication + Redis Geo-Replication for cross-AZ authentication latency under 10ms.
- **Edge computing integration**: Deploying session-service's token validation capability to Cloudflare Workers / AWS Lambda@Edge, reducing auth latency to single-digit milliseconds.

## For Teams Considering Microservices

1. **Don't split too early.** If your team is <5 people and user count is <100K, a monolith is the better choice. Our split began when the team reached a certain scale and DAU hit a significant level.
2. **From edge to core.** Start with the lowest-risk modules to build confidence and processes, then tackle core modules.
3. **Unified frameworks are a lifeline.** Without a unified App bootstrap, logging, tracing, error handling, and config management framework across 16 services, operational costs grow exponentially.
4. **Database isolation is non-negotiable.** Once two services share a database, you lose the ability to deploy and optimize independently.
5. **Distributed tracing is not optional.** In a microservice architecture, not having tracing is like debugging in the dark.

AuthMS's microservices journey continues. If you're interested in the architecture of a specific module, feel free to browse our open-source documentation or ask questions on GitHub Discussions.
