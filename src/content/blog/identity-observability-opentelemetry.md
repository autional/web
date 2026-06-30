---
title: "Identity System Observability: OpenTelemetry Full-Link Tracing in Practice"
date: "2026-06-14"
category: "Architecture"
tags: ["Observability", "OpenTelemetry", "Distributed Tracing"]
readTime: "10 min"
excerpt: "Identity systems are the bedrock of security infrastructure, and their observability directly impacts incident detection and root cause localization speed. This article dissects how AuthMS built a unified observability system integrating logs, metrics, and distributed tracing on top of OpenTelemetry, and demonstrates the practical value of full-link tracing through a slow-login troubleshooting case."
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

The 2025 production incident at a major SaaS platform remains a stark reminder: without distributed tracing, a single "slow login" user complaint consumed 6 full hours across 3 SREs, from ticket creation to root cause identification. The culprit was a Redis connection pool misconfiguration in `session-service` that forced a new connection on every token validation — but without tracing, the team had to check each service and middleware manually, like finding a needle in a haystack.

This is why observability is not a "nice to have" but a lifeline for identity systems. When an identity system goes down or degrades, every business system that depends on it becomes unavailable — and that blast radius dwarfs any single business module.

AuthMS has treated observability as a first-class citizen from day one, building a unified log-metric-trace observability system on OpenTelemetry. This article breaks down each layer and demonstrates how to quickly locate problems using real-world cases.

## Three Pillars of Observability and the Special Needs of Identity Systems

### Logs: Recording "What Happened"

The pain point of traditional logging isn't a lack of data — it's too much. A medium-sized authentication system can generate gigabytes of access logs daily, but when an actual incident occurs, operators often get lost in a sea of unstructured log data.

AuthMS's structured logging solution:

- **78+ standardized log keys**: All logs use predefined key constants from the `base/logger` package, such as `logger_base.KeyUserID`, `logger_base.KeyTraceID`, and `logger_base.KeyErrorCode`. This means you can precisely `grep` for all operations by a specific user, all occurrences of a specific error code, or every log step within a trace span.
- **Request-level log context**: On each HTTP request, middleware injects `request_id`, `tenant_id`, `user_id`, and `trace_id` into `context.Context`. All subsequent `logger_base.FromContext(ctx)` calls automatically carry these identifiers — no need to manually pass log parameters as long as the function receives `ctx`.
- **Complete error chain recording**: `error_base.Err` carries the full error chain (`cause -> cause -> cause`), which is automatically expanded into an `"error_chain"` field in log output, revealing the root cause at a glance.

```go
logger.Info("user login successful",
    slog.String(logger_base.KeyUserID, userID),
    slog.String(logger_base.KeyTenantID, tenantID),
    slog.Duration(logger_base.KeyDuration, elapsed),
)
```

### Metrics: Quantifying "What Happened"

Logs tell you the details of a single request; metrics tell you the macro health of your system. AuthMS's Prometheus metrics cover four layers:

| Layer | Example Metrics | Purpose |
|-------|----------------|---------|
| HTTP Service | `http_requests_total`, `http_request_duration_seconds` | Request volume, latency, error rate |
| Domain Events | `events_published_total`, `events_publish_duration_seconds` | Domain event throughput and latency |
| MQ Consumption | `mq_consumer_messages_total`, `mq_consumer_message_duration_seconds` | Consumption rate, processing latency, DLQ backlog |
| Infrastructure | `db_connections_active`, `redis_commands_duration_seconds` | Connection pool health, cache hit rate |

These metrics are automatically registered via the `micro-middleware/metrics` middleware — business code does not require manual instrumentation. But this doesn't mean you can ignore metrics. **The key is defining the right alerting rules**, which we will cover in a separate article.

### Traces: Understanding "How It Happened"

Logs tell you the result of each step. Metrics tell you the overall system trend. Traces connect the two — they reveal how many services a single request crosses, how long each service takes, and where the bottleneck is.

A typical "user login" request trace in AuthMS:

```
gateway (1ms)
  → identity-service /auth/login (45ms)
      → bcrypt password verify (30ms)
      → JWT token generate (2ms)
      → audit-service /log (5ms, async)
      → session-service /session/create (8ms)
          → Redis SET (2ms)
          → PostgreSQL INSERT (4ms)
  → profile-service /profile/me (12ms, parallel)
```

In the old architecture, if "login is slow" was the complaint, you had to SSH into each service and check logs manually. With distributed tracing, one screen shows you that `identity-service` bcrypt took 30ms (65% of total), while `session-service`'s PostgreSQL INSERT took only 4ms — everything is crystal clear.

## AuthMS OpenTelemetry Implementation Architecture

### Cross-Protocol Propagation

What makes identity systems unique is the need to support three communication protocols simultaneously: HTTP, gRPC, and MQ. `/auth/login` is HTTP → HTTP, but `compliance-service` may require gRPC calls, and audit logs are delivered asynchronously through MQ. If trace context cannot flow smoothly between protocols, the trace breaks.

AuthMS's solution:

- **HTTP**: Uses the W3C Trace Context standard, propagated via the `traceparent` header. The `micro-middleware/tracing` middleware automatically extracts and injects it.
- **gRPC**: Uses `otelgrpc`'s `NewClientHandler()` / `NewServerHandler()` propagated via gRPC metadata. All gRPC client connections mandatorily inject `otelgrpc.NewClientHandler()`.
- **MQ**: `micro-pkg/event.Publisher` automatically injects the W3C `traceparent` in `buildHeaders`. Consumers extract it via the `consumer/middleware.Tracing()` middleware.

This means even if a business flow crosses HTTP → MQ → gRPC → HTTP, the trace remains fully intact. This is especially critical for identity systems, where a "user registration" operation triggers audit logging (MQ), wallet creation (HTTP), and default role assignment (gRPC).

### Integration Approach

AuthMS chose to use the OpenTelemetry SDK directly rather than a vendor-specific agent. The benefits:

1. **Vendor-neutral**: Trace data can be exported to any OTLP-compatible backend — Jaeger, Tempo, Datadog, Alibaba Cloud ARMS — by changing just one environment variable: `OTEL_EXPORTER_OTLP_ENDPOINT`.
2. **Configurable sampling**: 100% sampling in development; on-demand sampling in production (e.g., only error requests and slow requests), preventing trace data explosion.
3. **Zero code intrusion**: All trace logic is handled by infrastructure-layer middleware. Business code only needs to pass `ctx` normally — zero manual instrumentation cost.

## Real-World Case: Debugging Slow Logins with Tracing

One day, operations received an alert: "identity-service P99 latency spiked from 80ms to 500ms." Here is the complete process of locating the root cause using distributed tracing:

### Step 1: Look at the Big Picture

Open the `http_request_duration_seconds` panel in Grafana. Confirm that the latency spike began at 14:32, with P99 rising from 80ms to 500ms. The error rate is normal — meaning the service is not crashing, just degrading in performance.

### Step 2: Find Representative Traces

In the tracing backend (e.g., Jaeger), query for traces with `operation = POST /api/v1/auth/login` and `duration > 400ms`. Sample 5 traces at random and find a common pattern:

```
identity-service  auth/login  420ms
  ├── bcrypt compare  28ms  ← Normal
  ├── JWT generate     2ms  ← Normal
  └── session save   385ms  ← Anomaly!
      ├── PostgreSQL INSERT  383ms
      └── Redis SET           2ms
```

The problem is in `session-service`'s PostgreSQL write.

### Step 3: Correlate Logs

Find the `trace_id` in the trace and use it to search logs in Loki (all AuthMS logs carry the `trace_id` field):

```
14:32:15 [session-service] ERROR session save failed
  error="could not serialize access token" cause="pq: value too long for type character varying(1024)"
  trace_id=abc123
  user_id=01ARZ3NDEKTSV4RRFFQ69G5FAV
```

The root cause is clear: a tenant configured abnormally large JWT claims (too many custom fields), causing the serialized token to exceed the database column length limit. Fix: increase the column length and add truncation protection before serialization.

**Entire process: from alert receipt to root cause identification — 4 minutes.** Without the observability system, this process could have taken 4 hours.

## Beyond Tracing: The Next Frontier of Observability

AuthMS's observability system continues to evolve. The next milestones include:

### Convergence of Audit Logging and Observability

Identity systems naturally require audit capabilities — who performed what action and when. AuthMS bridges audit logging (`audit-service` writing to MongoDB) with structured logging: every audit record carries a `trace_id`, allowing you to jump directly from a trace to the corresponding audit record and confirm that an operation was initiated by the user (not an internal call). This is a killer feature for compliance auditing (GDPR Article 30 — records of processing activities).

### Error Budget Dashboard

Based on SLO and error budget principles, we are building a centralized "Identity System Health" dashboard that translates core metrics into business language:

- Login success rate (last 1 hour) — actual vs SLO (99.9%)
- Remaining error budget (this month) — how much tolerance is left
- Token issuance P99 latency — is user experience impacted?

When the error budget is exhausted, alert levels are automatically escalated, and a ticket is created, forcing the team to pause feature development and prioritize stability — this is the essence of Google SRE and the decision-making layer we are building on top of observability.

## Advice for Readers

If you are building observability for your identity system, here are three prioritized recommendations:

1. **Start with structured logging**: Replace `fmt.Sprintf("user %s login", uid)` with `slog.Info("user login", "user_id", uid)`. This is the highest-ROI improvement — near-zero cost, immediate results.
2. **Then add distributed tracing**: If your architecture spans more than 3 services, distributed tracing is essential. Start by injecting trace headers at the gateway layer and core authentication services, then extract them at the consumer side. AuthMS's `micro-pkg` middleware is ready to use.
3. **Finally, implement metrics**: Define your SLOs (what counts as "available") first, then build dashboards and alerts. Metrics without SLOs are just charts; metrics with SLOs are decision-making tools.

Observability is not a set of tools — it is a culture: "How can I know what's wrong with my system faster?" For identity systems, this culture directly determines your security response speed and ultimately, your users' trust.

---

*All 15 AuthMS microservices have built-in OpenTelemetry support, ready to use out of the box. Learn how to integrate AuthMS authentication into your application in the [developer documentation](/developer/docs).*
