---
title: "Alerting Rules for Identity Systems: Which Metrics Matter and Which Don't"
date: "2026-06-12"
category: "Architecture"
tags: ["Alerting", "Monitoring", "Operations"]
readTime: "7 min"
excerpt: "Alert fatigue is the number one killer for operations teams — too much noise drowns out truly important alerts. This article lays out a tiered alerting strategy for identity systems, covering everything from P0 lifesaving alerts to P3 trend alerts, with ready-to-use Prometheus alerting rule examples to help teams evolve from 'everything is screaming' to 'only the truly important gets through.'"
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

It's 3 AM. Your phone buzzes. You open your eyes to the 17th alert notification — "identity-service CPU usage exceeded 80% for 2 minutes." You roll over and go back to sleep. At 3:05 AM, the 18th alert — "Login failure rate spiking." You still don't look, because over the past month this alert fired 342 times, and 342 times it was a test script running error scenarios. At 3:12 AM, you get a call from a customer: "None of our users can log in."

This is the classic script of **Alert Fatigue**. Too much noise drowns out genuine danger signals, eventually desensitizing the entire team. Industry statistics show that **over 70% of alerts received by SREs are meaningless noise** — self-healing without human intervention, thresholds set too low, or alerts that shouldn't exist in the first place.

This article focuses on one specific question: for identity systems, which metrics should have alerts? How should thresholds be set? How should priorities be assigned? Based on Autional's Prometheus metrics system and real-world operational experience, we provide a reference-ready framework you can adopt directly.

## Alert Tiering Framework

Alerting is not binary — different severities require different response methods. Autional uses a four-tier alert system:

| Level | Name | Response Time | Notification Method | Wake-Up Required? |
|-------|------|--------------|-------------------|-------------------|
| P0 | Critical | Within 5 min | Phone + SMS + Instant Messaging | Yes |
| P1 | Severe | Within 15 min | SMS + Instant Messaging | Yes |
| P2 | Warning | Within 1 hour | Instant Messaging + Email | No (business hours) |
| P3 | Informational | Next business day | Email + Ticket | No |

Key principle: **A P0 alert MUST be an event where users are already experiencing or are about to experience system unavailability.** If you're debating whether an alert is P0 or P1, it's probably P1.

## P0 Level: Lifesaving Alerts

### 1. Abnormal Login Failure Rate Spike

This is the number one alert for identity systems.

```yaml
- alert: LoginFailureRateSpike
  expr: |
    (
      sum(rate(http_requests_total{service="identity-service", path="/api/v1/auth/login", status!="200"}[5m]))
      /
      sum(rate(http_requests_total{service="identity-service", path="/api/v1/auth/login"}[5m]))
    ) > 0.3
  for: 5m
  labels:
    severity: P0
  annotations:
    summary: "Login failure rate spike"
    description: "Login failure rate exceeded 30% in the past 5 minutes, current value {{ $value | humanizePercentage }}"
```

**Why 30% and not 5%?** Because normal conditions can also have relatively high login failure rates — for example, a marketing campaign bringing in many new users, some of whom mistype their passwords. But a failure rate above 30% is almost certainly not normal user behavior. The `for: 5m` condition ensures it's not a transient spike.

**Actions to take when this alert fires:**
1. Check for abusive traffic (aggregate login requests by IP, look for high-frequency sources)
2. Check database connection pool health
3. Check if there was a recent deployment of `identity-service`

### 2. Complete Token Issuance Failure

Worse than "login is slow" is "login is impossible."

```yaml
- alert: TokenGenerationFailed
  expr: |
    sum(rate(http_requests_total{service="identity-service", path="/api/v1/auth/login", status=~"5.."}[5m])) > 0
  for: 1m
  labels:
    severity: P0
  annotations:
    summary: "Token issuance returning server errors"
    description: "identity-service returning 5xx errors for login requests, service may be unavailable"
```

No percentage threshold here, because **any 5xx on the login endpoint is unacceptable** — it means the system has an internal fault, not a user behavior issue.

### 3. Database Connection Pool Exhaustion

All operations in an identity system ultimately depend on the database. Connection pool exhaustion means total service outage.

```yaml
- alert: DBConnectionPoolExhausted
  expr: |
    db_connections_active / db_connections_max > 0.9
  for: 2m
  labels:
    severity: P0
  annotations:
    summary: "Database connection pool near exhaustion"
    description: "Active connections exceed 90% of max connections, current {{ $value | humanizePercentage }}"
```

Autional's default PostgreSQL connection pool configuration is `DBMaxOpenConns = 25`, `DBMaxIdleConns = 10`. When a service sees active connections consistently above 22, it may be experiencing connection leaks or slow query accumulation.

## P1 Level: Severe Alerts

### 4. Abnormal Increase in MFA Bypass Attempts

MFA is the last line of defense against account takeover. If someone is trying to bypass MFA, you need to know.

```yaml
- alert: MFABypassAttemptsSpike
  expr: |
    sum(rate(mfa_bypass_attempts_total{result="failed"}[10m])) > 10
  for: 10m
  labels:
    severity: P1
  annotations:
    summary: "Abnormal increase in MFA bypass attempts"
    description: "{{ $value }} failed MFA bypass attempts in the past 10 minutes, possible attack in progress"
```

This requires a business-layer custom metric — `mfa-service` increments this counter each time it receives an MFA bypass request. Autional's MFA module has built-in instrumentation for this.

### 5. Token Issuance Latency P99 Exceeds Threshold

Users won't report "P99 latency," but they will say "login is really slow."

```yaml
- alert: TokenGenerationLatencyHigh
  expr: |
    histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{
      service="identity-service",
      path="/api/v1/auth/login"
    }[5m])) > 1.0
  for: 10m
  labels:
    severity: P1
  annotations:
    summary: "Token issuance latency too high"
    description: "Login request P99 latency {{ $value }}s, exceeds 1s threshold"
```

### 6. MQ Dead Letter Queue Backlog

If the `audit-service` consumer goes down, audit logs will pile up in the dead letter queue. While this doesn't affect user experience, it represents a compliance risk.

```yaml
- alert: DLQBacklogGrowing
  expr: |
    mq_dlq_queue_messages > 1000
  for: 10m
  labels:
    severity: P1
  annotations:
    summary: "MQ dead letter queue backlog"
    description: "DLQ message count {{ $value }}, exceeds 1000 threshold, possible consumer fault"
```

## P2 Level: Warnings

### 7. Frequent Service Instance Restarts

Frequent pod restarts are a clear red flag — could be memory leaks, OOM kills, or readiness probe misconfiguration.

```yaml
- alert: ServiceFrequentRestarts
  expr: |
    rate(kube_pod_container_status_restarts_total{container=~"identity-.*"}[30m]) > 0
  for: 10m
  labels:
    severity: P2
  annotations:
    summary: "Frequent service instance restarts"
    description: "{{ $labels.pod }} has restarted in the past 30 minutes, possible issue"
```

### 8. Cache Hit Rate Dropping

A declining cache hit rate means more requests are hitting the database, potentially causing higher latency and increased database load.

```yaml
- alert: CacheHitRateDropping
  expr: |
    rate(cache_hits_total[15m]) / rate(cache_requests_total[15m]) < 0.7
  for: 15m
  labels:
    severity: P2
  annotations:
    summary: "Cache hit rate dropping"
    description: "{{ $labels.service }} cache hit rate dropped to {{ $value | humanizePercentage }}"
```

## Which Metrics Should NOT Alert (Or at Least Not Notify Humans)

### Examples of What Not to Alert On

1. **A single login failure** — unless you can prove it's an attack and not a user mistyping their password.
2. **CPU/memory transient spikes** — CPU fluctuations are normal in containerized environments. Sustained high watermarks (>85% for 15+ minutes) are worth alerting on.
3. **Transient network jitter** — If it lasts a few seconds and recovers automatically, it's not worth waking anyone up.
4. **Degradation on non-critical paths** — Avatar upload failed? Username field validation error? These can wait until the next business day.
5. **All test environment alerts** — All test environment alerts should go through a separate channel. Never allow test environment noise to pollute the production alert pipeline.

### Alternative: Trend Dashboards Instead of Alerts

For metrics like CPU usage, memory usage, and network traffic, **alerting is the wrong approach**. These belong on trend dashboards for teams to actively review during the day, not to receive passively at 3 AM.

Autional recommends setting up the following Grafana dashboards:
- **Service Overview**: QPS, latency, error rate × per service
- **Infrastructure Overview**: PostgreSQL connections/QPS/slow queries, Redis memory/hit rate/connections, RabbitMQ queue depth/consumption rate
- **Auth Business Dashboard**: Registration count, login count, MFA usage rate, token issuance volume, OAuth authorization volume

These dashboards, combined with alerts, form a clear division: **dashboards for trends, alerts for incidents.**

## Alert Quality Metrics

Setting up alert rules is just the beginning. Continuously measuring alert quality is the long-term effort. Autional's operations team tracks these metrics monthly:

- **Alert-to-Incident Conversion Rate**: Out of 100 alerts fired, how many actually corresponded to incidents requiring human intervention? Target: > 30%.
- **Mean Time to Respond (MTTR)**: From alert firing to service restoration. Target: P0 < 15 minutes, P1 < 60 minutes.
- **Alert Noise Rate**: Percentage of alerts that auto-resolve without any human intervention. Target: < 20%.

If the alert-to-incident conversion rate is persistently below 10%, the thresholds are too sensitive — loosen the thresholds or increase the `for` duration. If MTTR is high, better runbooks and automated recovery measures are needed.

## Summary

A good alerting system is like a good security system — you want it to sound the alarm when there's real danger, but you don't want it going off every time a cat walks by. Three core principles:

1. **Alerts must be actionable** — Every alert should have a clear runbook (response steps). An alert without a runbook is not an alert; it's noise.
2. **Alerts target symptoms, not causes** — Alert on "login failure rate spiking," not "CPU usage high." High CPU might be one cause, but what ultimately affects users is login failure.
3. **Continuously optimize** — Review alert data quarterly. Decommission rules that are no longer useful, adjust thresholds, add new scenarios. Alert rules are living artifacts, not a one-time configuration.

---

*Autional's Prometheus metrics cover all core business paths and infrastructure components. With built-in Grafana dashboard templates, teams can set up a complete identity system monitoring stack in 30 minutes.*
