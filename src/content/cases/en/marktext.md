---
title: "MarkText: From a Desktop Editor to a Multi-User Cloud Writing Product"
date: "2026-11-04"
platform: "Vercel"
framework: "Next.js"
stack: "Next.js 15 (App Router) · React 19 · muya (MarkText editor core) · Autional (identity) · Neon Postgres · Vercel"
repo: "https://github.com/autional-demo/marktext"
demo: "https://marktext-web.vercel.app"
tags: ["AI Refactoring", "SSO", "Multi-Tenant", "Cloud Storage", "MarkText"]
readTime: "6 min"
excerpt: "We turned MarkText, the Electron desktop Markdown editor, into a multi-user web product: Autional provides SSO and accounts, Vercel hosts the app and APIs, and Neon persists encrypted documents. It ships with PWA support and per-note URLs — refactor and go-live on the same day. This page covers the motivation, the step-by-step build, the result, and the launch prompt verbatim."
status: verified
reviewed_by: "editorial"
claims_reviewed: true
---

On 2026-11-04, we turned MarkText from an Electron desktop editor into a multi-user writing product that runs in the browser: SSO login, per-user document isolation, cloud persistence, PWA support, and per-note URLs. The refactor and go-live happened on the same day.

## At a Glance

| Item | Value |
| --- | --- |
| Upstream app | MarkText — open-source Markdown editor (Electron desktop) |
| Upstream repo | [github.com/marktext/marktext](https://github.com/marktext/marktext) |
| Upstream website | [marktext.app](https://marktext.app) |
| Result | SSO login · per-user isolation · cloud persistence · field-level encryption · PWA · per-note URLs |
| Stack | Next.js 15 (App Router) · React 19 · muya (MarkText editor core) · Autional · Neon Postgres |
| Platform | Vercel |
| Time | Refactor + go-live on the same day |
| Reference repo | [github.com/autional-demo/marktext](https://github.com/autional-demo/marktext) |
| Demo | [marktext-web.vercel.app](https://marktext-web.vercel.app) |

## About MarkText

MarkText is an open-source (MIT) cross-platform Markdown editor built on Electron, focused on a true WYSIWYG writing experience. It supports CommonMark and GFM — headings, lists, task lists, tables, code blocks, quotes, footnotes — plus KaTeX math, Mermaid diagrams, syntax highlighting, focus mode, and quick insert. On the desktop it is remarkably complete.

But it has two hard boundaries: **it only runs on the desktop**, and **data stays on the local machine**. There are no accounts, which means no shareable links, no continue-on-another-device, and no way to tell users apart. The editor is strong; what was missing was identity, cloud, and multi-user.

## Why We Refactored

For a writing tool, the desktop limitations are concrete:

- Switch computers and your documents are not there;
- Clear the cache and your history is gone;
- To share a note you have to export a file and send it;
- Without accounts, there is no notion of "who wrote what."

So the refactor set four goals:

1. **Move to the web**: keep the MarkText editing experience, open a browser and write;
2. **Add accounts**: support SSO while keeping email + password;
3. **Go cloud with isolation**: persist documents and isolate them per user;
4. **Ship the same day**: go live immediately and keep iterating.

## What Each Platform Does

We kept the three concerns separate, one platform each:

| Platform | Role | Responsibility |
| --- | --- | --- |
| Autional | Identity | SSO (OAuth 2.0 + PKCE), email/password login, token validation, tenant and user identity |
| Vercel | Hosting and runtime | Build and deploy, serverless APIs, same-origin `/bff` proxy, auto-deploy on GitHub push |
| Neon | Data | Postgres persistence, rows owned by `tenant_id + user_id`, encrypted payloads |

One clarification: **field encryption happens in the application layer**. Neon stores ciphertext; the decryption key lives only in server-side environment variables.

## The Build, Step by Step

We split the work into 10 small goals, each with a clear acceptance point.

### 1. Put the editor on the web

Goal: no compromise on the editing experience.

Approach: build a Next.js 15 web app and use **muya** (`@muyajs/core`), the editor core extracted from MarkText. Rendering, toolbars, tables, math, and diagrams all come from the same core, plus autosave.

Result: the same writing experience in the browser, with Markdown import and export.

### 2. Add accounts and SSO

Goal: an account system with SSO as the default path.

Approach: integrate Autional. The login page offers "Sign in with Autional" using the authorization code flow with PKCE and a public client; email + password stays available, and registration goes through the identity service. The SDK manages the session and logout returns to the login page.

Result: login, registration, and logout work end to end; tokens refresh automatically and tabs stay in sync.

### 3. Connect the browser to identity via a same-origin proxy

Goal: no cross-origin friction when calling identity APIs.

Approach: add a `/bff` same-origin proxy that forwards identity and OAuth requests to Autional; OIDC discovery goes through it too. The browser only talks to its own origin.

Result: stable login and token exchange without depending on third-party CORS configuration.

### 4. Design the document model

Goal: one owner per document, sortable, soft-deletable.

Approach: create a `documents` table in Neon with `id`, `tenant_id`, `user_id`, `title`, `content`, `rev`, `deleted_at`, and timestamps; index by tenant + user + updated time.

Result: the list sorts by most recent edit, deletes are soft, and history is preserved.

### 5. Expose document APIs

Goal: the frontend touches documents only through one REST surface.

Approach: list, create, read, save, and delete endpoints; 2 MB per document, 500 documents per list; create accepts a client-supplied id so existing local data can be uploaded.

Result: the full document lifecycle happens server-side; the frontend never touches the database directly.

### 6. Isolate data and encrypt fields

Goal: users cannot read each other's data, and ciphertext cannot be moved.

Approach: every query carries `tenant_id + user_id`; titles and bodies are encrypted with **AES-256-GCM**, and tenant + user + document + field are bound to the ciphertext as additional authenticated data (AAD).

Result: switching accounts shows nothing from the previous user; copying ciphertext into another row fails to decrypt.

### 7. Gate the APIs behind a session

Goal: no read or write without a valid login.

Approach: document APIs require a `Bearer` token. The server checks expiry, then validates authoritatively against the identity service's `/me` endpoint (cached for 60 seconds) before trusting the user and tenant.

Result: missing or forged tokens get 401; only valid sessions reach data.

### 8. Sync, conflicts, and offline

Goal: feels local, stores in the cloud.

Approach: keep a local cache and write to the cloud about 1.6 seconds after typing stops. Each document carries a `rev`; saves use optimistic locking, conflicts return 409 with the cloud version, and the user chooses "load cloud" or "overwrite with local." A PWA makes the app installable and available offline.

Result: refresh or switch devices and the content returns; sync resumes when the network is back; conflicts never silently overwrite.

### 9. Per-note URLs

Goal: every note has its own address.

Approach: add a `/d/<id>` route that opens the matching document and supports refresh, deep links, and browser back/forward.

Result: notes can be bookmarked and shared, with links landing directly on the content.

### 10. Ship with GitHub → Vercel

Goal: a repeatable release process.

Approach: host the code on GitHub, bind the Vercel project to the `main` branch so every push builds and deploys, keep environment variables in the Vercel project, and pin functions to the `sin1` region.

Result: live on the same day, and every later push updates production automatically.

## Result

**Live**: [marktext-web.vercel.app](https://marktext-web.vercel.app)
**Code**: [github.com/autional-demo/marktext](https://github.com/autional-demo/marktext)

| Capability | Result |
| --- | --- |
| Login | SSO + email/password, clean logout |
| Multi-user | Isolated by tenant + user |
| Cloud | Neon persistence, survives cache clears |
| Encryption | Field-level AES-256-GCM, bound to ownership |
| Concurrency | `rev` optimistic locking, conflicts surface to the user |
| Multi-device | Installable PWA, per-note URLs |
| Deployment | GitHub → Vercel, push to ship |

Verifiable results:

- Build passes;
- Identity integration tests **8/8** (discovery, registration, login, profile, token, logout, revocation, auth config);
- SSO preflight **2/2** (authorize returns 302 to the callback; CORS returns 204);
- Full authorization-code chain (authorize → code → token → userinfo) all 200;
- Cloud document end-to-end **13/13** (create, list, read, save, conflict, ciphertext check, delete);
- Production API: 200 with a token, 401 without one.

In one sentence: **Autional answers "who you are," Vercel answers "where it runs," Neon answers "where it lives"** — and the editor keeps doing what it does best.

## Launch Prompt (Verbatim)

The prompt handed to the AI coding assistant on 2026-11-04:

```
1. 帮我下载marktext， 并安装。   2.  参考 https://www.autional.com/cases/nextchat 把 marktext 发布到我的 vercel 。 3. 请读取 https://www.autional.cn/ai/skill.md，并据此为当前项目接入 Autional 登录。
若打不开，改用国内镜像：
https://cdn.autional.cn/ai/latest/SKILL.md
```

## Try It Yourself

Copy the prompt above, swap in your own project URL, and hand it to an AI coding assistant (Claude Code, Cursor, and others). To get started right away, see the [AI onboarding guide](/ai).
