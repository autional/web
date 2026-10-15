---
title: "Novel: From a Single-User Notes App to a Multi-User Product"
date: "2026-10-13"
platform: "Vercel"
framework: "Next.js"
stack: "Next.js 15 · React 18 · Tiptap · Vercel Blob (private)"
repo: "https://github.com/autional-demo/novel"
demo: "https://novel-demo-nine.vercel.app"
tags: ["AI Refactoring", "SSO", "Multi-Tenant", "Novel"]
readTime: "4 min"
excerpt: "One copyable prompt plus one GitHub URL: we turned Novel, the open-source notes app, from an open-access single-player tool into a multi-user product with SSO login, per-user document isolation, and the platform AI relay — the main refactor in one AI collaboration session, live on Vercel the same day. This page is the case brief: before/after, verifiable test numbers, and the launch prompt archived verbatim."
status: verified
reviewed_by: "editorial"
claims_reviewed: true
---

On 2026-10-13, we took [Novel](https://github.com/steven-tey/novel) — an open-source AI notes app where anyone could open it and everyone shared one pool of documents — and turned it into a multi-user product with SSO login, per-user document isolation, and the platform AI relay. The main refactor finished in one AI collaboration session and went live on Vercel the same day. The demo is open — verify it yourself.

## At a Glance

| Item | Value |
| --- | --- |
| Upstream app | Novel — open-source AI notes app (Notion-style editor) |
| Upstream repo | [github.com/steven-tey/novel](https://github.com/steven-tey/novel) |
| Upstream website | [novel.sh](https://novel.sh) |
| Result | SSO login · per-user document isolation and persistence · platform AI relay · production deployment |
| Stack | Next.js 15 · React 18 · Tiptap · Vercel Blob (private) |
| Platform | Vercel |
| Time | Main refactor in one AI collaboration session; live the same day |
| Reference repo | [github.com/autional-demo/novel](https://github.com/autional-demo/novel) |
| Demo | [novel-demo-nine.vercel.app](https://novel-demo-nine.vercel.app) |

## About the Upstream Project: Novel

Novel is a Notion-style WYSIWYG editor by Steven Tey, built on Next.js, Tiptap, and the Vercel AI SDK. Its core feature is AI-powered autocompletion: type `++` in the body to trigger suggestions, use slash commands to insert blocks, and select text for the bubble menu; images can be dragged, dropped, or pasted, and LaTeX and tweet embeds are supported. The editor also ships as the `novel` npm package for other apps to embed. Licensed under Apache-2.0, with 16k+ stars on GitHub as of October 2026.

## Before and After

| Dimension | Before (stock Novel) | After |
| --- | --- | --- |
| Accounts | None — open and go | Email + password, or one-click "Continue with Autional" SSO (OAuth 2.0 + PKCE) |
| Data | Everyone shares one pool of documents | Multi-user isolation — documents are private per user |
| Sessions | No session concept | Automatic token refresh, cross-tab sync, viewable and revocable device sessions |
| Sign-out | — | Standard OIDC logout: the session really ends, and switching accounts works |
| AI features | Bring your own model key, uncontrolled cost | Platform AI relay with unified metering |
| Deployment | Local only | Production (Vercel + platform storage) |
| Operations | No account system to operate | Users, audit, and security policy managed in platform portals — no admin backend to build |

This is not a mockup: the refactored code is public at [github.com/autional-demo/novel](https://github.com/autional-demo/novel), and the demo is open — login, data isolation, and account switching are all testable by hand.

## What Changed

- **SSO integration**: same-origin `/bff` proxy + session bridge + OAuth callback;
- **Multi-user refactor**: documents isolated per user and persisted in platform storage (private Vercel Blob);
- **AI relay**: the app's AI features route through the platform relay with unified metering;
- **Go live**: production deployment on Vercel with the production callback registered.

## Results and Verification

- Local gates green: lint / typecheck / build; unit tests **8/8**;
- Production real-browser E2E **5/5**: login, document CRUD, cross-user isolation side-by-side, AI generation, image upload;
- Security: cross-user access probes **19/19** blocked (bidirectional 404 on cross-user reads, 401 unauthenticated); document storage is private (private Blob);
- Demo is open: [novel-demo-nine.vercel.app](https://novel-demo-nine.vercel.app).

Every issue found in a real refactor is logged and fed back into the platform and the skill — which is why the next project starts further ahead.

## Launch Prompt (Verbatim)

Launch prompt for this case, 2026-10-13 (CST) — the same sentence ships in both regions; this is the English (.com) form:

```
Fetch https://www.autional.com/ai/skill.md and follow it to add Autional login to https://github.com/steven-tey/novel, turning it into a multi-user product (per-user data isolated and persisted in platform storage); once that's done, deploy it live on Vercel.
If unreachable, use: https://cdn.autional.com/ai/latest/SKILL.md
```

Swap the repo URL for your own project and that sentence is your prompt.

## Try It Yourself

Copy the prompt above, put your own repo URL in place of Novel's, and hand it to your AI coding assistant (Claude Code, Cursor, and others). To get started right away, see the [AI onboarding guide](/ai).
