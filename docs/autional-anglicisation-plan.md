# Autional English Internationalization Plan

> Last updated: 2026-06-30  
> Status: In Progress  

## Scope

All Chinese content across the Autional ecosystem must be translated to English or replaced with English equivalents.

| Site | Status | Remaining |
|------|:------:|-----------|
| www.autional.com (66 pages) | ✅ English | 3 fixes (Phase 1) |
| docs.autional.com (10 pages) | ✅ English | — |
| developer.autional.com (4 pages) | ✅ English | — |
| 49 blog posts | ✅ English | — |
| 24 Swagger specs | ❌ Chinese | Phase 2 |
| API Wiki (1,432 pages) | ❌ Chinese | Phase 3 |

## Phase 1: Website Fixes [DONE]

| # | Fix | Status | Date |
|:-:|-----|:------:|:----:|
| 1.1 | /docs page: move portal link out of steps.map() (was 4x → 1x) | ✅ | 2026-06-30 |
| 1.2 | GitHub URL: index.astro → autional/web, blog + jsonld → autional | ✅ | 2026-06-30 |
| 1.3 | Homepage "Built With" badge (Go/TS/PostgreSQL/Redis/etc) | ✅ | 2026-06-30 |

## Phase 2: Swagger Spec Translation [IN PROGRESS]

### Method
For each `docker/specs/{service}.json`, translate all:
- `info.description`
- Path `summary` and `description` fields
- Response `description` fields
- Parameter `description` fields

Output to `docker/specs/{service}-en.json`.

### Batch 1: Big Services (~5.5h)
- identity-service (672KB, ~600 fields)
- compliance-service (461KB, ~500 fields)
- tenant-service (421KB, ~400 fields)

### Batch 2: Medium Services (~4h)
- billing-service (299KB), audit-service (269KB), mfa-service (264KB)
- storage-service (223KB), oauth-service (206KB), notification-service (221KB)
- wallet-service (239KB)

### Batch 3: Small Services (~4h)
- profile-service, rbac-service, communication-service, point-service
- session-service, secret-service, verification-service
- status-service, pay-service, gateway-service

### Batch 4: Tiny Services (~30min)
- thirdparty-service, saml-service
- hash-service-standard, hash-service-sm

## Phase 3: Wiki Regeneration
After all swagger specs are translated:
```bash
python scripts/generate/generate_api_wiki.py --spec-dir docker/specs/
```
Regenerates 1,432 pages from translated specs.

## Phase 4: Deployment
- Copy translated specs to docker/specs/*-en.json
- Update Scalar UI to use -en.json
- Deploy wiki to docs.autional.com/reference/
