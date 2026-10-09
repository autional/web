---
title: "Account Recovery Design: Recovery Codes, Backup Channels, and Stopping Impersonation"
date: "2026-10-08"
category: "Security"
tags: ["Account Recovery", "Security", "MFA", "NIST"]
readTime: "9 min"
excerpt: "Recovery is the weakest moment in an account's life — a back door around the everyday keys, so it has to be heavier and slower. Email codes, SMS codes, recovery codes, recovery contacts: all four backup paths have a failure moment, and a badly designed reset flow turns a lifeline into an \"account detector.\" This article walks through NIST SP 800-63B-4's four anti-impersonation requirements and the practices that make them real."
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

Start with a situation: Maya changed her phone number and the old one is disconnected. One day she forgets her password and reaches for "forgot password" — the code goes to the dead number, and the registration email is long gone too.

Can she still get into her own account?

For most systems the answer is: barely, or never again. That's the first half of recovery design — **did you leave yourself a second path in advance?**

But there's a second half, and it's more dangerous: **every recovery mechanism is a back door around the everyday keys. A back door rescues you, and it can also be used against you.** A sloppy "forgot password" flow stops being a lifeline and becomes an attacker's "account detector."

## Why recovery must be heavier than login

The principle in one line: **recovery only recognizes channels you set up in advance. Memory doesn't count, and neither does anything an outsider can look up.**

That principle has a cautionary tale. Colonial Pipeline (2021): according to the company's statements and congressional testimony, the entry point was **a leaked old password combined with multi-factor authentication that was not enabled**, and fuel transport along the U.S. East Coast was disrupted. The attackers didn't defeat a new defense — they walked through a door that should have been invalidated long ago.

Two lessons for recovery design:

- **An old credential that's never revoked stays an open door** — revoking old sessions and old credentials after recovery completes is part of the loop;
- **The recovery flow itself must not become the weakest link** — what it verifies has to be something you planted in advance and nobody can look up.

(A note on scope: public reporting on that incident's technical details is limited, and we won't extrapolate beyond it.)

## Four "second paths"

The mainstream recovery channels, plus one final fallback of manual review:

| Dimension | ① Email code | ② SMS code | ③ Recovery codes | ④ Recovery contacts |
|:--|:--|:--|:--|:--|
| What it is | A code sent to the registered email | A code sent to the bound phone | One-time offline codes issued at registration | People you designated in advance |
| How it works | Receive → enter → reset | Receive → enter → reset | Take one out → enter → reset | They step in when you truly can't |
| Strongest when | The email still works | The number still works | **Phone and email are both gone** | Both of your paths are gone |
| Fails when | The email is compromised or inaccessible | Number changed / disconnected (Maya, above) | Stored with the account and lost together | You chose the wrong person |
| In one line | Rely on the inbox | Rely on the phone | Rely on a piece of paper | Rely on a person |

The design details worth aligning to standards:

- **Recovery codes are single-use.** NIST SP 800-63B-4 (published 2025-07, replacing 800-63B-3) §3.1.2 governs "look-up secrets": each **SHALL be used successfully only once** (§3.1.2.2), **at least six decimal digits** (§3.1.2.1), stored hashed by the verifier. §4.2 lays out the account-recovery framework, and §4.2.1 covers recovery codes: secrets issued to the subscriber **to allow them to recover an account at which they are no longer able to authenticate**.
- **SMS codes are out-of-band** (§3.1.3). The standard also says something frequently misread: **email SHALL NOT be used for out-of-band authentication** — but §3.1.3.1 clarifies that codes issued as **confirmation/recovery codes** are not subject to that ban (§4.2.1.2 is the recovery-side cross-reference). So an "email code" is positioned as a recovery code, not an OOB authenticator.
- **Security questions (KBA) are out.** §3.1.1.2 is blunt: verifiers and CSPs SHALL NOT prompt subscribers to use knowledge-based authentication ("What was the name of your first pet?") or security questions. Anyone can look up the answers — security questions as recovery are keys hung on the door handle.
- **Recovery endpoints must be rate-limited** (§3.2.2's general rate-limiting requirement): requests, code attempts, and reset submissions each need throttling and lockout policy.

## Stopping impersonation: four requirements

Recovery security isn't measured by "can the rightful owner get through" — it's measured by **"can an impersonator get through."** Four things, none optional:

**① Leave more than one path in advance.** One path means one loss ends everything short of manual review. Keep at least two, and **don't store them in the same place** — email and phone are two places; a photo of your recovery codes in the camera roll is one place, which is the same as none.

**② Recovery codes: single-use and offline.** Single-use means a leak is hard to replay (used is spent); offline means it survives losing phone and account together. Ten codes, one gone per use, is the mechanism working as designed.

**③ After recovery completes, revoke old sessions and notify the owner.** This is the most frequently skipped step and has the most direct consequence: if an impersonator logged in before you ran recovery, **changing your password doesn't evict them** — their session lives on. So completion must **revoke every session on the account** and send the owner a "your password just changed" notification.

**④ Uniform responses plus rate limiting.** A "forgot password" endpoint that answers "account not found" for unknown emails and "code sent" for known ones is an **account detector** — an impersonator sorts registered addresses by probing. The correct behavior: **same response either way.** Add throttling so "keep guessing" stops being viable.

## Three design traps

1. **Only one path.** Lose email and phone together and it's over — recovery channels must be redundant;
2. **Recovery codes screenshotted into the photo library.** Stored on the same device as the account, which is the same as not storing them;
3. **No revocation after recovery.** The password changed, and the impersonator's session is still open.

One philosophical note on top of the mechanics: **when no reliable second path exists, the secure move is a heavier manual verification, not a lower bar.** Manual review is slow and clumsy — that slowness is defense. A recovery flow should default to heavier, never to more convenient.

## How Autional implements it

We provide three recovery paths with throttling and auditing throughout:

1. **Forgot password (`forgot-password`)**: sends a code to the bound email or phone, resets only after verification; unknown accounts receive a **uniform response** that reveals nothing about existence.
2. **The recovery flow (`recovery/request → verify → complete`)**: a dedicated chain separate from ordinary password change; **on completion it automatically revokes every session on the account and sends a password-change notification** — the old keys are all invalidated.
3. **Recovery contacts**: add and remove (`GetRecoveryContacts / Add / Remove`) for when both other paths are unavailable.

Supporting mechanisms:

- **Throttling and audit throughout**: recovery requests and code verification are rate-limited; key actions emit audit events (`recovery.requested` / `code_verified` / `recovery/complete`) so everything is traceable afterward;
- **Recovery codes are encrypted at rest, single-use, and capped in number** (10 by default).

Honest boundaries: our defaults (lockout policy `LockoutAttempts=5` / `LockoutDurationMinutes=30`, the recovery-code cap) are **product choices, not industry mandates**. Recovery implementations vary widely across systems, and public material is rarely complete, so we don't make per-vendor claims. Separately, whether the masked target (`MaskedTarget`) returned by a recovery request constitutes a new enumeration surface — and how the product's storage form for recovery codes (encrypted at rest) maps onto the standard's letter (hashed) — are things we keep verifying.

## Common misconceptions

- "Recovery is just clicking 'forgot password'." Only if you left a second path in advance; without one, or with a lost one, it's the heaviest manual route — nothing lighter.
- "Security questions are more secure." The answers are lookup-able; standards have retired them.
- "Once recovery finishes, it's over." Without revoking old sessions, an impersonator may still be logged in — and the password change means nothing.
- "A photo of the recovery codes is fine." Stored with the account, it's as good as not having one.
- "A slow recovery flow is a bad user experience." Recovery is your weakest moment — **being hard is what it takes to hold impersonators out.**

## Closing

Login runs on passwords; recovery runs on second paths. Two questions you can check right now, on your own accounts:

**Do I have a second path? And did I reclaim the old logins?**

Next time you're locked out, don't blame your luck — recovery is harder than login by design. **It is the weakest moment of the account, and being harder is exactly what keeps impersonators out.**
