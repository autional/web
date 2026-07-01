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

## Phase 2: Swagger Spec Translation [DONE]

| Batch | Services | Fields | Status | Date |
|:-----:|----------|:------:|:------:|:----:|
| All | 24 services (5 big, 7 medium, 9 small, 3 tiny) | 5,059 | ✅ | 2026-06-30 |

Method: Python script with 100+ terminology entries, longest-match phrase translation. Output to `docker/specs/*-en.json` and `micro-services/*/docs/swagger.json`.

## Phase 3: Wiki Regeneration [DONE]

Regenerated from translated English swagger specs. 1,409 endpoint pages in English. ✅

## Phase 4: Deployment [IN PROGRESS]

| Sub-task | Status |
|----------|:------:|
| English swagger JSON in Gitea repo | ✅ pushed |
| English swagger in each service docs/ dir | ✅ pushed |
| English API wiki in repo | ✅ pushed |
| docs.autional.com `/api` linking to Scalar UI | 📋 todo |
| docs.autional.com `/reference` for wiki | 📋 todo |
