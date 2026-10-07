---
title: "From 0 to 16 Microservices: Autional Engineering Culture"
date: "2026-06-19"
category: "Project"
tags: ["Engineering Culture", "Team", "Microservices"]
readTime: "8 min"
excerpt: "15 people, 16 microservices, 25 CI check scripts — how does Autional maintain code quality and architectural consistency while iterating at speed? This article documents our team's engineering culture, toolchain, and lessons learned from three hard-earned mistakes."
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

In early 2024, Autional was just a Go monolith maintained by a 3-person team. Two years later, we have 15 people, 16 microservices, roughly 430K lines of Go code, and 1437 API endpoints. More importantly — **these endpoints didn't grow wild; they follow the same set of architectural constraints, coding standards, and engineering workflows.**

This article is about the engineering culture behind it — not the cliché "we love coding" slogans, but the concrete tools, processes, and decision logic. Including our smartest choices and the decisions that make us want to slap ourselves.

## Why Go

This wasn't a difficult choice. Autional's domain characteristics made Go almost the only candidate:

- **Identity authentication is high-concurrency by nature.** A medium-sized SaaS platform may process thousands of token validation requests per second. Go's goroutine model handles massive concurrency with minimal memory overhead — a single session-service instance can sustain 15,000 QPS of JWT validation with 2GB of RAM.
- **Static compilation, single binary deployment.** For on-premises customers, no runtime environment installation is needed — drop a single `identity-service.exe` (~28MB) on a server and it runs. Java can't do this. Python can't do this. Node.js can't do this.
- **Type safety + compile-time checks.** When defining gRPC interfaces across 16 services, type safety isn't a "nice to have" — it's a survival necessity. We cannot afford cross-service runtime failures caused by a single misspelled field name.

The only alternative we seriously considered was Rust, but at the time we couldn't hire enough Rust developers. The Go job market is more mature and the learning curve is gentler — critical for rapidly building a team.

## Why Microservices

If you've read our other article "From Monolith to Microservices: Autional's Evolution," you know we didn't start with microservices. We began as a monolith and only started splitting after hitting critical thresholds in team size, user count, and feature complexity.

But here's an easily overlooked detail: **Even when we had just one service, we wrote code to microservice standards from day one.** What does that mean? Even during the monolith era, we insisted on:

- Organizing packages by business capability (`identity/`, `session/`, `oauth/`) rather than by technical layer (`handler/`, `service/`, `repository/`)
- Decoupling domain models with interfaces (`type UserRepository interface { ... }`)
- Encapsulating database operations in the repository layer — business logic never writes SQL

These principles made the eventual split surprisingly smooth — over the past two years, each service split averaged only 2-3 weeks.

## How to Maintain Consistency Across 16 Services

This is the central challenge of engineering culture. Sixteen independent `go.mod` files, sixteen `main.go` files, sixteen sets of handler/service/repository — without strong constraints, they'd quickly diverge into 16 different coding styles where nobody can read anyone else's code.

Our solution wasn't more architecture meetings. It was encoding constraints into tooling.

### Unified Bootstrap: `micro-middleware/app`

All 15 business services use the same bootstrap framework in `main.go`:

```go
app := app_pkg.New("identity-service", logger).
    WithRouter(router).
    WithHealth(healthHandler).
    WithServer("grpc", grpcServer).
    WithServer("mq-consumer", mqConsumerServer).
    WithCleanupNamed("db", func() error {
        sqlDB, _ := db.DB()
        return sqlDB.Close()
    })

app.Run(11001)
```

This framework uniformly manages: HTTP server startup, graceful shutdown, health checks, resource cleanup, gRPC servers, and MQ consumers. A new service's `main.go` is never more than 40 lines. More importantly — **if someone hand-writes `http.ListenAndServe` in any service, CI will reject it.**

### 25 Python Check Scripts

This is one of our proudest engineering investments. Before every PR is submitted, the CI pipeline runs 25 Python scripts covering three tiers:

**Architecture Gates (preventing architectural degradation):**
- `check-dto-compliance.py`: All HTTP responses must use `dto_base.NewDataResponse` or `dto_base.NewListResponse`. Bare structs, `gin.H`, and `map[string]interface{}` as JSON responses are prohibited.
- `check-factory-types.py`: Factory type names must match the registry.
- `check-rbac-constants.py`: RBAC role codes must exist in the registry.

**Coding Standards (preventing silent quality erosion):**
- `check-error-codes.py`: Error codes must be registered in `base/error/registry.go`. Returning `errors.New("something wrong")` from handlers is prohibited.
- `check-encoding.py`: Scans all source files for GBK contamination and UTF-8 corruption. Windows developers often mix GBK encoding into Chinese comments — this script has saved us countless times.
- `check-internal-paths.py`: Detects hardcoded internal API paths (e.g., `"/api/v1/internal/..."`), requiring the use of constants.
- `check-auth-constants.py`: Detects hardcoded MFA types and OAuth grant types — these should use constants defined in `micro-share/auth`.

**Runtime Safety (preventing production incidents):**
- `check-db-schema.py`: Compares GORM model definitions against actual PostgreSQL table structures, detecting missing columns and type mismatches.
- `check-swagger-freshness.py`: Detects handler annotation changes without corresponding Swagger doc regeneration.
- `check-middleware-order.py`: Verifies middleware registration order (Recovery → Logging → Auth → RBAC).

**These scripts aren't because we distrust developers; it's because even the best developer can write buggy code at 2 AM.** CI doesn't get tired, doesn't get distracted, and never says "I'll let it slide this time."

### Lint-Enforced Architecture Boundaries

Our `.golangci.yml` doesn't just check code style — it enforces architectural constraints:

- `depguard`: Prohibits lower-layer modules from importing upper-layer modules. If `base/config` imports `micro-share/auth`, CI immediately fails.
- `forbidigo`: Bans specific function calls. For example, direct `grpc.NewServer()` calls are prohibited — use `grpc_mw.NewServer()` instead. `slog.SetDefault()` is banned — use `logger_base.SetDefault()` instead.

**Why encode architectural constraints in lint? Because meetings and documents can't stop tech debt from accumulating.** When you're rushing to meet a deadline at midnight, you're not going to pull up an architecture document to check "is this import direction correct?" Lint will tell you before you commit.

### Auto-Generated Swagger Documentation

We have 1437 API endpoints. Handwriting documentation would make it obsolete the day after it was written.

Our approach:
1. Standard Swagger annotations on handlers (`@Summary`, `@Param`, `@Success`, `@Router`, etc.)
2. `swag init` auto-generates `swagger.json` from annotations
3. Generators produce API indexes, Wiki docs, and frontend TypeScript types from `swagger.json`
4. Git pre-commit hook checks: if handler files are modified without regenerating Swagger docs, the commit is blocked

The result: **documentation and code are always in sync because you can't commit without syncing.**

## Engineering Values

The above covers the tooling. But tooling is just the embodiment of values, not the values themselves. Here are Autional's core engineering values:

### Security is Default, Not Optional

We have a strict rule: all GORM struct fields for password hashes, API Keys, OAuth Tokens, and MFA secrets must have `json:"-"` tags. This is not a suggestion — it's mandatory. Because historically, a developer added a new field, forgot `json:"-"`, and printed the entire struct in a log — password hashes leaked straight into ELK.

Similar rules:
- All inter-service communication must be authenticated via `auth_mw.InternalAPIKeyAuth` — no hand-rolled verification logic allowed
- All user input passes through a unified parameter validation framework before reaching handlers
- All cross-service data synchronization uses domain events + MQ for eventual consistency — direct cross-service database access is prohibited

### Explicit Over Implicit

The Go community's values are pushed to the extreme in Autional:

- Every error code must have a clear 8-digit number and be registered in `registry.go`
- Every cache key must have a registered prefix (no hand-written `"user:" + id`)
- Every environment variable name must be defined in a constants file
- Every database table name must be registered in the constants registry

This sounds tedious. But when a new person takes over a service, they can find everything they need within 10 minutes — because everything is explicitly declared, no need for "I guess so" or "ask the veteran."

### Documentation is Part of the Code

Our engineering standards don't live in a Wiki — they live in `AGENTS.md`, in the same repository as the code. Any PR that modifies an architectural decision must also update AGENTS.md. The benefits:
- Documentation never goes out of date (because you can't pass review without syncing doc with code)
- New hire onboarding is a single file to read
- `git blame` traces every architectural decision to its author and context

## Three Things We Did Wrong

An engineering culture article that only talks about successes isn't worth reading. Here are three decisions we got wrong and would do differently:

### Mistake 1: Introducing Test Coverage Metrics Too Early

Early on, we set a "80% unit test coverage" target. The result? Developers wrote mountains of meaningless tests for getters and setters to hit the metric, while core business logic tests were neglected.

What we do now: **We don't chase coverage metrics. We require integration tests for critical paths (registration, login, payment, permission validation).** One integration test covering the authentication flow is worth more than 100 unit tests testing `GetName()`.

### Mistake 2: Introducing gRPC Too Early

We brought in gRPC for inter-service communication early in the microservices split. But with only 3 services at the time, the overhead of maintaining protobuf definitions far exceeded the performance benefit. Worse, gRPC's error handling approach (status codes) caused semantic conflicts with our error code system, forcing us to write an extra translation layer.

Our current principle: **Start with HTTP + JSON. Only introduce gRPC when inter-service calls genuinely become a performance bottleneck.** Currently, only compliance-service and a few high-frequency internal interfaces use gRPC.

### Mistake 3: Too Much Technology Diversity

Early on, we allowed different services to experiment with different tech stacks — one service used MongoDB, another used Kafka, another used RabbitMQ. The result: the ops team had to maintain 5 different middleware systems. New members had to learn 3 different message queues.

Our current principle: **Technology choices default to uniformity. New components are only introduced with a solid justification.** Our standard stack: Go + Gin + PostgreSQL + Redis + RabbitMQ. MongoDB is used only in audit-service (audit logs are document-oriented data). Kafka is used only when high-throughput event streams are needed.

## Team Organization: No Dedicated "Architect" Role

Autional's engineering team has no dedicated architect. Not because we don't value architecture — quite the opposite. **We value it too much to make it one person's responsibility.**

Whenever we face a significant architectural decision (e.g., whether to adopt gRPC, how to design event sourcing, database selection), the process is:
1. Any engineer can propose an RFC, written in Notion
2. All engineers review and comment within 3 days
3. If there are no major objections, the proposal passes
4. If there are disputes, a 30-minute synchronous discussion is organized

This process has run for two years, producing 40+ RFCs. Three were rejected; five passed after major revisions. No one can unilaterally decide the architecture direction — and equally, no one can push architectural responsibility onto "the architect."

## Advice for Teams Looking to Follow

If you're building an engineering team, here are our most important takeaways:

1. **Constraints are not the opposite of freedom.** Across 16 services, without strong constraints, you won't get diversity — you'll get chaos. Lint rules, CI scripts, and code generators don't limit creativity. They focus creativity where it truly matters (business logic) instead of wasting it on "what format should this API return?"

2. **Automate every check you can.** If a rule is important enough to bring up in Code Review, it should be written as a CI script. Humans are unreliable checkers.

3. **Newcomer experience is one of the most important engineering metrics.** If a new developer needs two weeks to complete their first PR, it's not their problem — it's your onboarding process. Our goal: day one, local dev environment running; day two, first bug fix submitted.

4. **Be honest about mistakes.** The three mistakes in this article aren't a "sharing experience" show — they are real errors that wasted significant team time. If you see similar warning signs in your team, we hope our experience helps you avoid one misstep.

Autional's engineering culture wasn't built overnight. It was shaped by 15 people over two years through countless debates, compromises, refactors, and reflections. And it's still evolving — we're currently experimenting with AI-assisted Code Review, and we'll share the results in a future article.
