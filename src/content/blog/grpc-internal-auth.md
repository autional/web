---
title: "gRPC Security Practices for Internal Service Communication"
date: "2026-05-13"
category: "Architecture"
tags: ["gRPC", "Service-to-Service Communication", "Security"]
readTime: "7 min"
excerpt: "How AuthMS uses gRPC to build a secure communication layer between microservices—from Protobuf's efficiency advantages to TLS/mTLS transport security, from JWT+API Key dual-mode authentication to full-link OpenTelemetry tracing."
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

One of the core challenges of microservice architecture is enabling secure and efficient communication between services. The REST + JSON approach may seem simple, but it exposes numerous problems in inter-service communication scenarios: high serialization overhead, lack of strong type constraints, and difficulty with streaming. AuthMS's choice: **REST for external, gRPC for internal.**

## Why gRPC for Internal Calls?

### Efficiency Comparison: Protobuf vs JSON

Suppose identity-service needs to return user information to compliance-service:

**JSON (REST):**

```json
{
  "user_id": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  "email": "user@example.com",
  "display_name": "张三",
  "roles": ["admin", "developer"],
  "created_at": "2026-05-13T10:30:00Z"
}
```

Raw payload: approximately 180 bytes, requiring JSON encode/decode on every call.

**Protobuf (gRPC):**

```protobuf
message GetUserResponse {
  string user_id = 1;
  string email = 2;
  string display_name = 3;
  repeated string roles = 4;
  google.protobuf.Timestamp created_at = 5;
}
```

Serialized: approximately 80 bytes (binary), no parsing overhead.

For tens of thousands of internal calls per second (authentication, permission checks, data validation), Protobuf's serialization efficiency directly translates to lower CPU usage and faster response times.

### Strongly Typed Contracts

REST API contracts are "documentation + convention"—Swagger/OpenAPI standardizes the description, but cannot verify at compile time whether the caller passed the correct parameter types.

gRPC contracts are `.proto` files—**guaranteed at compile time**:

- Caller and server generate code from the same `.proto` file
- Field type errors are caught at compile time
- New fields don't affect existing callers (Protobuf backward compatibility)
- Deprecated fields marked `reserved` cause compile errors if reused

In AuthMS, all `.proto` files are generated uniformly by `scripts/generate-proto.ps1`, and `check-grpc-compliance.py` in the CI pipeline ensures generated code is consistent with proto definitions—eliminating runtime bugs like "the doc says accept int, but the code passes string."

### Streaming

REST struggles to elegantly handle large data transfers:

- compliance-service exports audit logs: requires pagination API (`?page=1`, `?page=2`...), n+1 HTTP calls
- audit-service pushes real-time alert events: requires WebSocket or SSE, adding protocol complexity

gRPC natively supports four communication modes:

```
Unary:               Request→Response (traditional RPC)
Server Streaming:    Request→Streaming Response (large data export)
Client Streaming:    Streaming Request→Single Response (batch upload)
Bidirectional:       Bidirectional streams (real-time alerts, conversations)
```

In the compliance report export scenario, compliance-service calls audit-service's `ExportAuditLogs` method, audit-service pushes data in batches via Server Streaming, and compliance-service writes to CSV as it receives—without waiting for the full dataset to load into memory.

## AuthMS's gRPC Security Architecture

### Transport Security: TLS / mTLS

AuthMS's internal gRPC communication enables TLS by default:

```yaml
grpc:
  enabled: true
  port: 12018
  tls:
    enabled: true
    cert_file: "/certs/server.crt"
    key_file: "/certs/server.key"
    ca_file: "/certs/ca.crt"
```

Upgraded to mTLS (mutual authentication) in production: each service has its own client certificate, and the server verifies the caller's identity. This prevents unauthorized internal calls—even if an attacker breaches network isolation, they cannot call gRPC endpoints without a valid certificate.

### Authentication: JWT + API Key Dual Mode

Internal inter-service calls have two authentication scenarios, and AuthMS supports both modes:

**JWT (User Context Propagation):**

When the gateway forwards a user request to internal services, the `user_id` and `tenant_id` from the JWT token are passed downstream via gRPC metadata:

```go
// Injected in the gRPC client interceptor
md := metadata.Pairs(
    "authorization", "Bearer "+token,
    "x-tenant-id", tenantID,
    "x-user-id", userID,
)
ctx := metadata.NewOutgoingContext(ctx, md)
```

**API Key (Service-to-Service Trust):**

For internal calls that don't carry user context (e.g., scheduled tasks triggering compliance scans), a pre-provisioned API Key is used:

```go
md := metadata.Pairs("x-api-key", internalAPIKey)
ctx := metadata.NewOutgoingContext(ctx, md)
```

### Unified Interceptor Chain

AuthMS's gRPC server is created via the `grpc_mw.NewServer` factory method, which auto-injects a four-layer interceptor chain:

```
Client Request
  ↓
[Recovery]         ← panic recovery, prevents a single request from crashing the entire service
  ↓
[Logging]          ← records method, duration, status
  ↓
[Metrics]          ← Prometheus metrics: request_count, latency_histogram
  ↓
[Auth]             ← validates JWT or API Key, injects user_id/tenant_id
  ↓
Business Handler   ← actual gRPC method implementation
```

The Auth interceptor automatically skips health check endpoints (`/grpc.health.v1.Health/*`), ensuring Kubernetes liveness probes are always reachable:

```go
// Health check whitelist inside grpc_mw.NewServer
if info.FullMethod == "/grpc.health.v1.Health/Check" ||
   info.FullMethod == "/grpc.health.v1.Health/Watch" {
    return handler(ctx, req)  // skip auth
}
```

## Full-Link Tracing: OpenTelemetry

Inter-service call chains are complex, and debugging latency issues requires full-link tracing. All AuthMS gRPC calls are injected with W3C Trace Context:

**Client Side:**

```go
conn, err := grpc.NewClient(addr,
    grpc.WithTransportCredentials(insecure.NewCredentials()),
    grpc.WithStatsHandler(otelgrpc.NewClientHandler()),
)
```

**Server Side:** `grpc_mw.NewServer` auto-injects `otelgrpc.NewServerHandler()`. This way, when a request from the gateway traverses the gRPC call chain, Jaeger displays the complete trace:

```
Gateway → [identity-service: GetUser] → [profile-service: GetProfile] → [compliance-service: CheckCompliance]
                                                                          ↑ Span: 45ms
                                                        ↑ Span: 12ms
                                  ↑ Span: 8ms
            ↑ Trace: 3a2b1c4d5e6f...
```

Each Span records the caller service name, method name, status code, and duration. When P99 latency spikes, you can quickly identify which downstream service method is slowing down the overall response.

## In Practice: Compliance Scan Authentication Chain

Using compliance-service executing GDPR data export as an example, here's the complete gRPC call chain:

```
1. Admin initiates export request (HTTP → gateway)
2. Gateway forwards to compliance-service (HTTP)
3. compliance-service calls identity-service (gRPC):
   → GetUser(user_id) → gets user basic info
   → ListUserRoles(user_id) → gets role list
4. compliance-service calls profile-service (gRPC):
   → GetProfile(user_id) → gets extended attributes
5. compliance-service calls audit-service (gRPC):
   → ExportAuditLogs(user_id, stream) → streams audit logs
6. compliance-service assembles data → generates export file → uploads to storage-service
```

Steps 3-5 are all gRPC calls, each carrying the same Trace ID. If `GetUser` in step 3 fails, compliance-service can quickly return an error (rather than timing out) and log the failing gRPC status code:

```
level=ERROR msg="gdpr export failed" user_id=01ARZ... 
  error="rpc error: code = NotFound desc = user not found"
  step=get_user grpc_code=NotFound
```

## gRPC vs REST Division in AuthMS

AuthMS does not recommend using gRPC for end-user-facing APIs:

| Scenario | Approach | Reason |
|------|------|------|
| Browser → Backend | REST + JSON (gateway proxy) | Browsers can't call gRPC directly, need grpc-web proxy |
| Mobile → Backend | REST + JSON | Adding gRPC layer offers limited value for mobile |
| Service-to-Service | gRPC + Protobuf | Highest efficiency, type safety, streaming support |
| Third-party API | REST + OAuth 2.0 | Industry standard, ecosystem compatibility |
| Webhook Callback | HTTP POST + JSON | Easy for receivers to process |
| Real-time Push | WebSocket / SSE | Browser-friendly |

## Summary

gRPC's role in AuthMS internal communication can be summarized as:

- **Efficiency**: Protobuf binary serialization, 50%+ smaller payload than JSON, lower CPU overhead
- **Security**: TLS/mTLS transport encryption + JWT/API Key dual-mode authentication + unified interceptor chain
- **Reliability**: Compile-time type safety, backward-compatible proto changes, CI-enforced consistency
- **Observability**: OpenTelemetry full-link tracing, each Span records method name, status code, and duration

If you have more than 5 microservices and inter-service calls are becoming frequent—now is the best time to introduce gRPC.
