---
title: "Identity System SLI/SLO Design: How 99.99% Availability Is Achieved"
date: "2026-06-13"
category: "Architecture"
tags: ["SLA", "SLO", "Reliability"]
readTime: "8 min"
excerpt: "99.9% and 99.99% differ by a factor of 10 — for identity systems, that's the difference between 8.76 hours and 52 minutes of downtime per year. Starting from SLI selection, this article dives into how AuthMS achieves enterprise-grade availability guarantees through health checks, dual probes, and error budget mechanisms."
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

> **Architecture Note**: The SLO/SLI metrics and availability targets described in this article represent AuthMS's architectural design goals and do not constitute runtime performance commitments for production environments. Actual availability is influenced by deployment architecture, infrastructure configuration, network conditions, and other factors. Specific SLAs are governed by commercial contracts.

"We promise 99.99% availability." — This phrase appears in nearly every SaaS identity platform's marketing materials. But what does 99.99% actually mean? How is it measured? What happens when it's not met? For most teams, the answers to these questions matter far more than the number itself.

Let's start with a common misconception: **SLA (Service Level Agreement), SLO (Service Level Objective), and SLI (Service Level Indicator) are three entirely different concepts.**

- **SLI** is a measured value — "Over the past 30 days, login success rate was 99.97%"
- **SLO** is a target — "Login success rate must be ≥ 99.9%"
- **SLA** is a contractual commitment — "If login success rate falls below 99.9%, we will refund 10% of the monthly fee"

Most teams skip defining SLIs, pick an SLO number arbitrarily, and then write it into an SLA contract. The result: either the SLO is too loose to matter (you never reach it anyway, so the penalty never applies), or too strict that teams are constantly firefighting. This article takes a systematic approach from the perspective of identity systems — how to define SLIs, set SLOs, and how AuthMS uses technical measures to guarantee these targets.

## SLI Selection: What Should an Identity System Measure?

Not everything measurable deserves an SLO. Good SLIs satisfy three conditions: **directly correlated with user experience**, **precisely measurable**, and **actionable for improvement**.

For identity systems, we recommend the following 5 core SLIs:

### 1. Login Success Rate

This is the most important SLI for an identity system, bar none. Definition:

```
Login Success Rate = Successful Logins / Total Login Requests × 100%
```

But there's a trap in defining "success." Does an HTTP 200 always count as success? If the interface returns 200 but the business logic fails (e.g., "account locked"), should that count as success or failure?

AuthMS's definition: **Only requests where `identity-service` returns 200 and the payload contains a valid JWT token count as success.** All business errors (wrong password, account locked, MFA failure) are excluded from "failures" — they are normal business flows, not availability problems.

This leads to a key methodology: **distinguish between "errors" and "failures."** A user entering a wrong password means your system is working as intended. A database connection timeout means your system has a fault. SLIs measure the latter.

### 2. Token Issuance Latency (P99)

When a user clicks "Login," authentication completing within 1 second is a smooth experience; above 3 seconds is a poor one. But averages can be deceptive — if 90% of logins complete in 100ms and 10% take 5 seconds, the average might be 590ms, which looks acceptable, but 10% of users are enduring a 5-second wait.

**Always use percentiles to define latency SLIs, never averages.**

AuthMS's recommendations: P99 login latency < 500ms (standard deployment) / < 200ms (HA deployment). Use the P99 of the `http_request_duration_seconds` histogram as the measurement source.

### 3. MFA Verification Latency (P95)

More and more applications enforce MFA, meaning MFA latency directly impacts login experience. AuthMS's `mfa-service` is deployed independently. MFA verification involves:
- Querying the user's MFA configuration (cache hit or DB query)
- Calling third-party channels (SMS/email/OTP)
- Or local TOTP algorithm verification

Different MFA methods have vastly different latencies — TOTP local verification < 10ms, SMS OTP can take 3-5 seconds. SLIs should be split by MFA method.

### 4. Health Check Response Time

This is not a user-facing SLI but an operational one. The `/health` endpoint's response speed reflects the health of infrastructure (DB, Redis, MQ). If `/health` response exceeds 1 second, it typically indicates connection timeouts or slow queries in some infrastructure component.

### 5. Token Verification Throughput

In a high-traffic API Gateway scenario, nearly every request needs JWT token verification. If `session-service` or `identity-service` lacks the capacity to verify tokens quickly, the entire business system can be dragged down.

SLI definition: Successful token verifications per second > expected peak × 1.5 (50% headroom).

## Setting SLOs: 99.9% or 99.99%?

99.9% (three nines) = 8.76 hours downtime per year
99.99% (four nines) = 52.6 minutes downtime per year
99.999% (five nines) = 5.26 minutes downtime per year

Each additional nine increases costs by at least 5-10x. Does your system really need four nines?

### Decision Framework

| Scenario | Recommended SLO | Rationale |
|----------|----------------|-----------|
| Internal admin console | 99.5% | Limited impact of downtime, low operational cost priority |
| B2B SaaS (SMB) | 99.9% | Balance reliability and cost; industry mainstream standard |
| B2B SaaS (Enterprise) | 99.95% | High SLA penalty for enterprise customers, requires higher guarantees |
| Financial / Healthcare | 99.99% | Regulatory requirements or contractual mandates |
| National identity infrastructure | 99.999% | Public safety impact, requires multi-active architecture |

AuthMS targets 99.99% as the SLO for high-availability deployments, and 99.9% for standard deployments. This is reflected in the architecture design:

- **High-Availability Deployment**: At least 3 replicas per service + master-slave database + Redis Sentinel + cross-AZ deployment
- **Standard Deployment**: 2 replicas per service + single-instance database + daily automated backups

### Error Budget: SLO's "Fault Tolerance Quota"

An SLO is not an iron law — it allows a certain amount of unavailable time, which is the "error budget." If the SLO is 99.9%, then the error budget = 0.1% × 30 days = 43 minutes/month.

The value of an error budget lies in changing the decision logic:
- Error budget sufficient → can take risks (ship new features, run chaos engineering)
- Error budget exhausted → freeze all non-emergency releases, everyone works on stability improvements

**An SLO without an error budget is just decoration.** AuthMS integrates an error budget consumption view into the operations dashboard, automatically triggering different levels of alerts and process freezes when consumption exceeds 50%/80%/100%.

## How AuthMS Guarantees SLOs: Technical Measures

### Dual Health Check Probes

AuthMS provides two independent health check endpoints for each service:

**`/health` (Liveness Probe)**:
- Checks if the process is alive
- Returns 200 if the service is running
- Used for Kubernetes liveness probe; restarts the Pod on failure

**`/ready` (Readiness Probe)**:
- Checks if the service is ready to receive traffic
- Checks DB connection, Redis connection, MQ connection one by one
- Returns 503 if any dependency is unavailable
- Used for Kubernetes readiness probe; removes from Service on failure, re-adds on success

Why two probes? If the DB connection pool is exhausted, `/health` might still return 200 (the process isn't dead), but `/ready` will return 503 (cannot handle requests). Kubernetes stops sending traffic to that Pod on readiness failure, but does not restart it (since liveness is normal — it might be a transient DB fault). When the DB recovers, `/ready` automatically restores, and the Pod resumes receiving traffic — zero operational intervention.

### Result Caching

For high-frequency queries (e.g., token verification, permission checks), AuthMS implements a local+distributed two-tier cache with negative caching in `micro-pkg/cache`.

Key design:
- **Positive cache**: "Token ABC is valid, user ID is 123" → cached for 5 minutes
- **Negative cache**: "Token XYZ is revoked" → cached for 1 minute
- **Cache avalanche protection**: Uses random TTL (TTL ± 20%) to prevent simultaneous cache expiration from causing a DB avalanche
- **Cache penetration protection**: Also caches an empty value for non-existent keys (negative cache), preventing attackers from using non-existent tokens to penetrate the cache and hit the DB directly

### Graceful Shutdown and Failure Recovery

Each AuthMS service implements a unified graceful shutdown flow via `micro-middleware/app`:

1. Receive SIGTERM → immediately mark `/ready` as unhealthy
2. Wait for existing requests to complete (max 30 seconds)
3. Close DB connection pool, MQ connections
4. Exit process

Combined with Kubernetes rolling update strategy (`maxUnavailable: 0`, `maxSurge: 1`), this ensures zero traffic loss during upgrades.

## Practical Recommendations

1. **Start with login success rate**: This is the easiest SLI to measure and the one that most directly affects users. Run data for a month, then set your SLO — don't pick a number out of thin air.
2. **Distinguish critical path from non-critical path**: Login is critical; avatar uploads are not. Degradation on non-critical paths does not consume the error budget.
3. **Graceful degradation > hard failure**: If the MFA SMS channel is unavailable, degrade to TOTP only. If audit log writing fails, buffer temporarily instead of blocking login. AuthMS's async audit writing is a practical application of this philosophy.
4. **Review error budgets monthly**: Make error budget consumption a standing agenda item in monthly operations reviews. If the budget is exhausted for three consecutive months, consider adjusting the architecture rather than just adding more people.

99.99% is not a technical metric — it is a promise to your users and the engineering resources you are willing to invest in that promise. Before setting your number, answer this question first: **If the system goes down for 1 hour, what will users lose, and what will we lose?** That answer is your SLO.

---

*All AuthMS services have built-in dual-probe health checks and Prometheus metrics exposure. Refer to the [architecture documentation](/developer/docs) for more details.*
