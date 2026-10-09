---
title: "Idempotency Design: Why Double-Clicking Pay Only Charges Once"
date: "2026-10-06"
category: "Architecture"
tags: ["Idempotency", "Payments", "Distributed Systems", "Architecture"]
readTime: "9 min"
excerpt: "A user double-clicks when the payment page stalls, a backend retries after a timeout, a payment provider redelivers its callback — duplicate requests aren't an anomaly, they're the norm. Idempotency design answers one question: when the same payment arrives twice, can the system tell it's the same payment? This article breaks down the three gates — state machine, idempotency key, webhook signature — and why money moves through a freeze-then-capture step."
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

An utterly ordinary scene: Maya taps "Confirm Payment," the page spins for two seconds with no response, she loses confidence and taps again.

**Is she about to be charged twice?**

If you're thinking "that's just an impatient user, a rare edge case," start with the three ways duplicate requests actually happen — they cover every normally functioning system:

1. **No response ≠ not delivered.** The first request may have succeeded; only the receipt got lost on the way back. The user's second tap is really a resend of a completed payment.
2. **Double-taps and nervous clicks.** On flaky mobile networks, this is the most common cause of all.
3. **Callbacks get redelivered — and forged.** Provider notifications travel the public internet and carry retry logic; redelivery is by design, forgery is the threat it enables.

Stack one more layer of engineering reality on top: packet loss, timeouts, queue redelivery — **at-least-once delivery is the default contract of distributed systems.** Duplicates aren't the exception; duplicates are the baseline.

So the goal of idempotency design is not "stop duplicate requests" — that's impossible. It answers exactly one question: **when the same payment arrives again, can the system tell it's the same one it already saw?**

## Three gates: the lane, the token, the seal

Preventing "the same thing runs twice" takes three complementary gates:

| | ① The lane (state machine) | ② The token (idempotency key) | ③ The seal (webhook verification) |
|:--|:--|:--|:--|
| Blocks | Clicking a payment that already succeeded | Processing the same payment twice | Fake or repeated notifications |
| How it works | Only "new" can move to "succeeded," never back | Same token arriving again returns the first result | Notification carries a signature; verify before accepting; accept each event once |
| When it fails | Can't stop "pure accumulation" | The resend used a new token | The shared secret leaked |

The three gates **work together and complement each other** — you don't pick one. And none of them promises "never a duplicate." That's the engineering contract, not humility.

### Gate one: the state machine — forward only

Design the payment state as a one-way road:

```
created → processing → succeeded
                    ↘ failed
                    ↘ expired
```

Once an intent reaches `succeeded`, another "pay" request hits a state machine that simply refuses it — the intent is no longer in a payable state. A scheduled task moves timed-out unpaid intents to `expired`.

The cost of state machines: they do nothing for "pure accumulation." Adding loyalty points or balance — "add 10 more" sent twice — has no "already added" state for the machine to check.

### Gate two: the idempotency key — one token, one charge

The idempotency key is the most widely adopted mechanism: **the client generates a unique key per operation and resends it verbatim.**

```http
POST /api/v1/payments
X-Idempotency-Key: 7f9c24e8-1b3a-4d5e-9c00-3e2a1f8b6d71
Content-Type: application/json

{ "order_id": "SO-20261006-001", "amount": "199.00", "currency": "CNY" }
```

Server-side logic:

```
On request:
  Empty key    → pass through (idempotency not engaged)
  Look up "key → first result" store:
    Hit, identical payload   → return the first result; do not execute again
    Hit, different payload   → 422 (one token can't cover two different operations)
    Miss                     → execute, persist "key → result", respond
```

Two engineering details:

- **A database unique constraint backstops concurrency**: when two same-key requests arrive simultaneously and both miss the cache, a unique index on `(tenant, idempotency_key)` guarantees only one can insert; the loser reads the first result and returns it. The cache is for speed; the constraint is the floor.
- **Expiry**: Stripe's documented behavior is to return the original result for **24 hours**; an IETF draft for the `Idempotency-Key` header (draft-ietf-httpapi-idempotency-key-header) saw version 07 expire in April 2026, with newer revisions still in progress — it has never become an RFC, but Stripe, Adyen, Square and others run its de facto rules in production: keys must be unique, must not be reused with different content, and may expire over time.

The one client bug that matters: **resending without the key, or with a new key.** Reusing the same token, the system recognizes "the same payment again." A new token means **a brand-new payment** in the system's eyes — charged again. Generate the key when the operation starts, keep it in memory, send it unchanged on every retry.

While you're at it, get the HTTP semantics straight (RFC 9110 §9.2.2): `GET` / `PUT` / `DELETE` are idempotent by definition — resends are harmless. `POST` / `PATCH` are **not**. Payments, orders, and coupon issuance overwhelmingly use `POST`, so the application has to supply idempotency itself.

### Gate three: webhook signature — notifications carry a seal

Provider "payment succeeded" callbacks are the other hot zone for duplicates and forgeries. Two rules:

1. **Verify first, persist second.** The payload carries an HMAC signature (RFC 2104); accept only if it validates against the shared secret. Compare in **constant time** and fail closed on any error.
2. **Accept each event exactly once.** Enforce a unique constraint on the event's identifier; a notification that's already processed gets skipped.

## Three ways to implement idempotency

| Approach | Strength | Cost |
|:--|:--|:--|
| Response cache (HTTP middleware) | Generic; replays the first response | Depends on cache; expires |
| Database unique key | Strong consistency, no external dependency, survives concurrency | Business tables must carry the key; handle conflicts |
| State machine (domain layer) | Strongest semantics | Requires modeling; misses pure accumulation |

Money endpoints typically **use two at once**: middleware caching for speed, a database unique constraint as the floor.

## Evidence: duplicate charges aren't rare

A June 2026 study (SSRN 6895958, published by the reconciliation vendor Rexi) analyzed **97,028** financial complaints filed with the U.S. Consumer Financial Protection Bureau between January 2021 and December 2025, isolating the patterns consistent with **reconciliation failures — including duplicate charges that were never reversed**. Those complaints closed with **monetary relief** at a rate of **9.96%** — nearly **3×** the 3.51% rate of other financial payment complaints.

The damage to users is direct, and the cause is rarely "one extra click" — it's a long-tail, cumulative, manual-recovery operational burden. The study's sample spans 11 fintech companies; for vendor research, we relay the figures without extrapolating beyond them.

## Another angle: freeze first, then capture

A more fundamental approach to duplicates is to **reserve before charging.** That's what card pre-authorization does:

1. At order or check-in time, **authorize** — the amount is held, not yet moved;
2. At completion, **capture** — the hold releases and the charge lands;
3. An uncaptured authorization **releases automatically** at expiry; the payment intent transitions to canceled/expired.

Validity windows differ by network: Visa card-not-present authorizations run about **10 days** and card-present about **5 days**; Mastercard around **7 days**; hotel and car-rental holds can persist **up to 30 days** (it varies by card type and scenario, and public references typically give ranges only).

In wallet systems the matching design is the **three-column balance**:

| Column | Meaning |
|:--|:--|
| Available | Spendable and withdrawable right now |
| Frozen | Still yours, held pending an unresolved event |
| (Total) | The sum of the two |

A freeze is only legitimate with two companions: a **record** (what it's for, how much, since when — `active → released`) and an **expiry** (auto-release if unresolved). A freeze without an expiry becomes dead money — visible on the balance, usable by nobody.

Withdrawals stack one more gate: freeze the amount → review → capture on approval, release on rejection. Three checks layer up, each holding its own link: **freezes hold the money, reviews hold the decision, limits hold the scale** (configured as daily/monthly caps and auto-approval thresholds).

But keep their boundary in view: freezes and reviews control **whether a process completes**, not **whether the ledger recorded it correctly** — that's the ledger's and reconciliation's job.

## How Autional does it

The payment path runs idempotency across `pay-service` and `wallet-service`:

**`pay-service` (charging and callbacks):**

1. **State machine**: `PaymentIntent` models the state transitions explicitly; a scheduled task moves timed-out unpaid intents to `expired`;
2. **Idempotency key + unique constraint**: `PaymentIntent.IdempotencyKey` is **unique per tenant** (unique index `uni_payment_intents_tenant_idempotency`; identical keys across tenants don't collide); `RefundRecord` idempotency keys are unique too; the HTTP middleware serves an `X-Idempotency-Key` response cache (with TTL release; empty keys pass through, keys capped at 256 characters);
3. **Callback verification**: `PaymentWebhook` is unique on `(TenantID + Channel + PaymentID + EventType)`; `VerifyWebhook` runs first (dual-secret HMAC, constant-time comparison, fail-closed), with `IsVerified` / `IsProcessed` flags preventing double processing.

**`wallet-service` (freezes and withdrawals):**

- Three-column balances (`Balance` / `FrozenBalance` / `AvailableBalance`) plus freeze records (`FreezeRecord`, `active → released`);
- A withdrawal state machine (`pending → approved/rejected → completed`) with configurable policy (daily/monthly caps, minimum amount, whether manual review is required, auto-approval limit);
- An expiry sweeper for stale freezes (`SchedulerWalletWithdrawalExpiry`);
- Concurrency protection via optimistic locking (`UpdateBalance(wallet, oldVersion)` inside transactions) plus idempotency keys as a second belt;
- Fallbacks: daily wallet snapshots (`WalletSnapshot`) and the ledger's event hash chain (covered in the reconciliation article).

The admin-side operations around freezes and approvals (PIM, approval workflow) follow the same governance: big permissions are never permanent — request first, act only after approval.

## Boundaries: idempotency doesn't promise "never twice"

Stating the failure modes plainly is more honest than promising success:

- **A new key wipes everything out** — retrying with a fresh key tells the system "this is a different payment";
- **Pure accumulation** defeats state machines; it needs a unique key or an operation record;
- **A leaked shared secret** breaks verification — secrets must rotate, with old and new coexisting through the transition;
- **An expired key** lets an old duplicate look new — the unique constraint is the last line of defense.

## Common misconceptions

- "Timeout means the request failed." Not necessarily — it may have executed; only the receipt was lost.
- "Resends are safe." Without the same token, duplicates happen anyway.
- "With an idempotency key, we're bulletproof." Expiry sweeps, missing keys, and pure accumulation all leak.
- "The callback arrived, ship it." Callback URLs are public — verify the signature first, and accept each event once.
- "Total balance is what I can spend." Spendable means available.
- "Frozen means charged." The money is still there; an unresolved event releases it.
- "Freeze and approve, and nothing can go wrong." Process control doesn't replace correct bookkeeping — reconciliation does.
- "Freezes can be left alone." Without expiry and cleanup they become dead money.

## Closing

Preventing duplicates doesn't rely on **remembering how many times the user clicked** — it relies on making the **same payment count once, no matter how many times it's resent.**

To decide whether an operation needs idempotency, ask one question: **would running this twice cause damage?** Payments, transfers, orders, coupon issuance, refunds — for anything where the second run hurts, answer this first: when the same operation arrives again, can the system tell it's the one it already saw?
