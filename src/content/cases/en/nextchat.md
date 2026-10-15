---
title: "NextChat: From a Single-User AI Chat Client to a Multi-User Product"
date: "2026-10-15"
platform: "Vercel"
framework: "Next.js"
stack: "Next.js 14 (App Router) · React 18 · Zustand · Vercel Blob (private)"
repo: "https://github.com/autional-demo/nextchat"
demo: "https://nextchat-demo-eight.vercel.app"
tags: ["AI Refactoring", "SSO", "Multi-Tenant", "NextChat"]
readTime: "4 min"
excerpt: "The same prompt sentence again — only the repo URL changed. We turned NextChat, the open-source AI chat client that keeps everything in the browser, into a multi-user product with SSO login, per-user isolation, and chat history persisted in platform storage. Refactor and go-live the same day; production E2E passed 6/6. This page gives the brief, verifiable test numbers, and the launch prompt archived verbatim."
status: verified
reviewed_by: "editorial"
claims_reviewed: true
---

On 2026-10-15, we ran the same sentence of prompt again — only the repo URL changed — on [NextChat](https://github.com/ChatGPTNextWeb/NextChat), an open-source AI chat client that keeps all data in the browser. It became a multi-user product with SSO login, per-user isolation, and chat data persisted in platform storage. The refactor and go-live happened the same day; production E2E passed 6/6.

## At a Glance

| Item | Value |
| --- | --- |
| Upstream app | NextChat — open-source AI chat client (formerly ChatGPT-Next-Web) |
| Upstream repo | [github.com/ChatGPTNextWeb/NextChat](https://github.com/ChatGPTNextWeb/NextChat) |
| Upstream website | [nextchat.club](https://nextchat.club) |
| Result | SSO login · per-user isolation · conversation persistence (platform storage) · session gate on service routes |
| Stack | Next.js 14 (App Router) · React 18 · Zustand · Vercel Blob (private) |
| Platform | Vercel |
| Time | Refactor + go-live the same day (one AI collaboration session) |
| Reference repo | [github.com/autional-demo/nextchat](https://github.com/autional-demo/nextchat) |
| Demo | [nextchat-demo-eight.vercel.app](https://nextchat-demo-eight.vercel.app) |

## About the Upstream Project: NextChat

NextChat (renamed from ChatGPT-Next-Web in January 2024) is a cross-platform open-source AI chat client: web, PWA, iOS, Android, and desktop (Tauri). It supports major models such as GPT, Claude, Gemini, and DeepSeek, plus Azure and self-hosted endpoints, and offers Markdown / LaTeX / Mermaid rendering, prompt masks, plugins, and share-as-image. By default, all chat data stays in the browser with no account system — which is exactly where this refactor starts. Licensed under MIT, with 88k+ stars on GitHub as of October 2026.

## Before and After

| Dimension | Before (stock NextChat) | After |
| --- | --- | --- |
| Accounts | None — open and go | SSO login (OAuth 2.0 + PKCE) |
| Data | All in the browser (IndexedDB / localStorage) | Isolated per user and persisted in platform storage; clearing the local cache and reloading restores it |
| Service routes | No authentication | Session gate on every LLM and service route (forged or missing tokens get 401) |
| Sign-out | — | Standard OIDC logout, cleanly back to the login page |
| Deployment | Local only | Production (Vercel + platform storage) |

## What Changed

The whole run followed the skill's eight-phase procedure — findings first, confirmation gates, branch isolation, closing the loop; integration choices were pinned at confirmation gates (SSO authorization-code flow, platform storage = private Vercel Blob).

- **SSO integration**: same-origin `/bff` proxy + session bridge + OAuth callback;
- **Multi-user refactor**: chat state (conversations, settings, and more) isolated per user, snapshots persisted to platform storage (private Vercel Blob);
- **Session gate**: authentication on every LLM route (16) and service route (4);
- **Two data-sync bugs fixed**: the default model config not taking effect, and the final message of a streaming reply never persisting — after the fix, reloading or switching devices restores conversations in full.

## Results and Verification

- Full local suite: **39 suites / 185 cases** green (including 5 suites / 28 cases for the integration);
- Isolation probes **6/6** (zero cross-user leakage); live contract probes **4/4**;
- Production real-browser E2E **6/6**: SSO login; conversation persistence (clear local → restore); account-switch isolation (bob sees none of alice's conversations); switching back (alice's conversations intact); sign-out (clean return to the login page); login-page light/dark round;
- Production negative checks: forged or missing tokens get 401 (session gate);
- Demo is open: [nextchat-demo-eight.vercel.app](https://nextchat-demo-eight.vercel.app).

Every issue found in a real refactor is logged and fed back into the platform and the skill — which is why the next project starts further ahead.

## Launch Prompt (Verbatim)

Launch prompt for this case, 2026-10-15 10:09 (CST) — the same sentence ships in both regions; this is the English (.com) form:

```
Fetch https://www.autional.com/ai/skill.md and follow it to add Autional login to https://github.com/chatgptnextweb/nextchat, turning it into a multi-user product (per-user data isolated and persisted in platform storage); once that's done, deploy it live on Vercel.
If unreachable, use: https://cdn.autional.com/ai/latest/SKILL.md
```

Compared with the previous case (Novel), only the repository URL differs — the same sentence works for any repo.

## Try It Yourself

Copy the prompt above, put your own repo URL in its place, and hand it to your AI coding assistant (Claude Code, Cursor, and others). To get started right away, see the [AI onboarding guide](/ai).
