---
title: "From Docker Compose to Kubernetes: AuthMS Containerization Best Practices"
date: "2026-06-10"
category: "Architecture"
tags: ["Docker", "Kubernetes", "Deployment"]
readTime: "10 min"
excerpt: "AuthMS's deployment journey started with docker-compose for local development and eventually reached production-grade Kubernetes clusters. This article documents key decisions along the way: how to design Dockerfiles for build-once-run-anywhere, managing stateful services in K8s, ConfigMap and Secrets best practices, and real-world results of horizontal autoscaling."
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

AuthMS established a principle from day one: **deployment method should never be a barrier to user adoption.** A startup might run docker-compose on a single 4-core 8GB cloud server; a mid-sized enterprise might use a Kubernetes cluster with 3 replicas; a large enterprise might need multi-AZ multi-cluster deployment. The same codebase, the same Docker images, must work across three dramatically different scenarios.

This article documents our complete journey from Docker Compose to Kubernetes — not for showmanship, but because at every stage we stepped into real pitfalls, some of which could have been entirely avoided with earlier planning.

## Phase 1: Local Development (pnpm + Go)

Before writing any Dockerfile, the developer experience comes first. Developers should not have to wait for Docker builds just to see their code changes.

AuthMS's development environment is entirely local:

```powershell
# Backend development
cd micro-services/identity-service
go run cmd/server/main.go

# Frontend development
cd web
pnpm dev:auth
```

Infrastructure dependencies (PostgreSQL, Redis, RabbitMQ) run locally via `docker-compose.infra.yml`:

```powershell
docker compose -f docker-compose.infra.yml up -d
```

This file contains only infrastructure containers — none of the 15 microservices run through Docker; they run as native Go binaries directly on Windows. The benefits:
- Near-zero latency hot-reload (Go compilation typically < 5s)
- Direct delve debugger support for breakpoint debugging
- Environment variables and config files read directly from the local filesystem

## Phase 2: Docker Compose Unified Deployment

When deployment to a test environment or small production environment is needed, Docker Compose is the simplest choice.

### Unified Dockerfile: One Template for 15 Services

AuthMS has 15 microservices but only **one Dockerfile** (at `docker/Dockerfile.service`). All differentiation is done via build args:

```dockerfile
ARG SERVICE_NAME          # e.g., identity-service
ARG SERVICE_PORT          # e.g., 11001
ARG RUNTIME_EXTRA_COPYS   # optional extra files
```

Example build command:

```powershell
docker build \
  --build-arg SERVICE_NAME=identity-service \
  --build-arg SERVICE_PORT=11001 \
  -f docker/Dockerfile.service \
  -t authms/identity-service:latest .
```

The core value of this design: **adding a new service does not require a new Dockerfile.** As long as the service follows the standard directory structure (`micro-services/{name}/cmd/server/main.go`), the build system automatically adapts. All 15 services share the same build layer cache (Go dependency cache, build cache), so building a second service with `--build-arg` after the first takes only seconds.

### Multi-Stage Build Details

```
Stage 1 (base-builder): Install Go dependencies + copy all local module code
Stage 2 (builder):       Compile target service into a statically linked binary
Stage 3 (runtime):       Minimal Alpine image + binary + config files
```

Key optimizations:
- `COPY go.mod go.sum` before `COPY .` leverages Docker layer caching — if dependencies haven't changed, download is skipped
- `CGO_ENABLED=0` produces a purely static binary, shrinking the runtime image from 800MB to 20MB
- Build cache is preserved via the CI system's Docker layer cache or BuildKit cache mounts

### docker-compose.yml Structure

AuthMS's `docker-compose.yml` uses YAML anchors to eliminate configuration duplication:

```yaml
x-postgres-env: &postgres-env
  POSTGRES_HOST: postgres
  PGBOUNCER_PORT: 5432
  POSTGRES_USER: authuser
  POSTGRES_PASSWORD: authpassword

services:
  identity-service:
    build:
      context: .
      dockerfile: docker/Dockerfile.service
      args:
        SERVICE_NAME: identity-service
        SERVICE_PORT: 11001
    environment:
      <<: [*postgres-env, *redis-env]
      POSTGRES_DB: authms_identity
    ports:
      - "11001:11001"
```

This keeps each of the 15 service definitions very concise — only 10-15 lines each, with the bulk of configuration reused through anchors.

### Docker Compose Limitations

Docker Compose is suitable for:
- Development/test environments
- Single-machine deployments (< 5 servers)
- Customer PoC environments

But it is unsuitable for:
- Automatic scaling
- Rolling updates without downtime
- Cross-host service discovery
- Managing stateful service data persistence

This is why we need Kubernetes.

## Phase 3: Kubernetes Production Deployment

### Handling Stateful Services

The trickiest K8s deployment issue for an identity system is not the microservices themselves (they are stateless) but the databases.

**Should PostgreSQL live in Kubernetes?**

We spent significant time debating this, ultimately settling on a two-tier strategy:

- **Small deployments (< 100K users)**: PostgreSQL can run in K8s with StatefulSet + PersistentVolume, paired with CloudNativePG or Zalando Operator for high availability.
- **Medium/large deployments (> 100K users)**: Use managed cloud PostgreSQL (RDS, Cloud SQL). The identity database is the single most critical component — managed services provide automated backups, PITR, read replicas, and cross-AZ HA more reliably and cost-effectively than self-managing.

The same applies to Redis — use K8s Redis + Sentinel for small deployments, managed cloud Redis (ElastiCache, Memorystore) for large ones.

### ConfigMap & Secrets

AuthMS configuration falls into two categories:

**ConfigMap (non-sensitive configuration)**:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: identity-service-config
data:
  config.yaml: |
    service:
      name: identity-service
      port: 11001
    postgres:
      host: ${POSTGRES_HOST}
      port: 5432
```

**Secrets (sensitive configuration)**:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: identity-service-secrets
type: Opaque
stringData:
  JWT_SECRET: "${JWT_SECRET}"
  POSTGRES_PASSWORD: "${POSTGRES_PASSWORD}"
  REDIS_PASSWORD: "${REDIS_PASSWORD}"
```

**Key principles**:
1. ConfigMap and Secrets must remain separate — even if your organization thinks "all configuration can go in ConfigMap," putting JWT_SECRET in ConfigMap is like taping your bank vault combination to the front door.
2. Secrets are injected via environment variables (`envFrom`), not volume mounts. Volume-mounted secrets require a Pod restart when updated; env var injection is more controllable.
3. Never commit plaintext Secrets to Git. Use Sealed Secrets, External Secrets Operator, or SOPS to manage encrypted Secrets in a GitOps workflow.

### Horizontal Pod Autoscaler (HPA)

Different AuthMS services have vastly different scaling requirements:

| Service | Scaling Strategy | Target Metric | Min/Max Replicas |
|---------|-----------------|---------------|-------------------|
| identity-service | CPU 70% | Login requests are CPU-intensive (bcrypt) | 2 / 10 |
| session-service | QPS | Max 5000 QPS per replica | 2 / 20 |
| audit-service | MQ Queue Depth | KEDA + RabbitMQ scaler | 1 / 5 |
| profile-service | CPU 70% | Low load | 1 / 3 |
| oauth-service | CPU 60% | OAuth flow involves multiple redirects | 2 / 8 |

Example HPA configuration:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: identity-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: identity-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

**Why identity-service uses CPU while session-service uses QPS?** Every identity-service request involves bcrypt hash comparison (CPU-intensive), making CPU usage linearly correlated with traffic. Session-service requests are primarily Redis queries and DB writes (I/O-intensive) — CPU usage doesn't accurately reflect load, so custom Prometheus metrics (`http_requests_per_second`) are used instead.

### Audit Service Special Handling

`audit-service` has a dual-role design: `api` (receives audit writes) + `processor` (consumes MQ messages). In K8s, these roles run as different Deployments from the same image:

```yaml
# api role
- name: audit-service-api
  image: authms/audit-service:latest
  env:
  - name: ROLE
    value: "api"

# processor role
- name: audit-service-processor
  image: authms/audit-service:latest
  env:
  - name: ROLE
    value: "processor"
```

They share the same image and configuration, but processor instances are auto-scaled by KEDA based on MQ queue depth.

### Graceful Shutdown & Rolling Updates

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
```

Combined with `micro-middleware/app`'s graceful shutdown mechanism (SIGTERM → readiness marks unhealthy → wait 30s → close connections → exit):
1. K8s sends SIGTERM to the old Pod
2. The Pod immediately marks `/ready` as unhealthy
3. K8s removes the Pod from the Service Endpoint (new requests no longer route to it)
4. The Pod waits for existing requests to complete (30s timeout)
5. The Pod closes DB/Redis/MQ connections and exits
6. Meanwhile, the new Pod has already started receiving traffic (`maxSurge: 1`)

This process ensures **zero traffic loss during rolling updates**.

## Migration Path: Docker Compose to K8s

If you are already running AuthMS with Docker Compose, migrating to Kubernetes can be done in three steps:

**Step 1: Generate initial manifests with Kompose**

```bash
kompose convert -f docker-compose.yml -o k8s/
```

This generates basic Deployment, Service, and ConfigMap YAML files. But Kompose output is just a starting point — it doesn't understand your stateful component requirements, scaling strategies, or secret management.

**Step 2: Manual review and optimization**

- Replace `depends_on` in `docker-compose.yml` with K8s `initContainers` or health-check dependencies
- Migrate sensitive `environment` values to Secrets
- Add resource requests/limits for each service
- Configure HPA for services that need scaling

**Step 3: Gradual traffic switch**

Don't cut all traffic over to K8s at once. Deploy the full application in K8s first, route 5% of traffic via Ingress to K8s, observe for 24 hours with no anomalies, then gradually increase the percentage.

## Real-World Lessons

1. **Resource limits are not "suggestions," they are "protections."** We once encountered a service that kept restarting due to OOM from a memory leak, but without CPU limits, each restart's compilation/initialization phase consumed all CPU on the node, slowing down co-located services. **Always set limits.**
2. **Never use `latest` as a Docker image tag.** Use Git commit SHAs or semantic version numbers. With `imagePullPolicy: Always`, `latest` can cause Pods to pull different image versions on restart without you ever noticing.
3. **Set `initialDelaySeconds` generously for health checks.** AuthMS's identity-service needs to connect to the database, run AutoMigrate, and preload caches on startup. If initialDelay is too short, K8s will start killing the Pod before it's ready (due to readiness probe failures), causing an infinite restart loop.

Containerization is not the goal — it's a means. Whether running single-machine with Docker Compose or a cluster with K8s, there is only one standard: **When the service goes down at 3 AM, can it recover automatically? If not, it's not properly deployed yet.**

---

*AuthMS offers three deployment methods: Docker Compose, Kubernetes Helm Chart, and one-click cloud marketplace deployment. Get started by visiting the [Quick Start guide](/developer/docs/getting-started).*
