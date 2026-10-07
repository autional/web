---
title: "Build vs Buy: Identity System Total Cost of Ownership (TCO) Calculator"
date: "2026-06-16"
category: "Product"
tags: ["TCO", "ROI", "Build vs Buy"]
readTime: "9 min"
excerpt: "\"We can just build a login system ourselves — why pay for it?\" — nearly every potential Autional customer has asked this question. This article uses real engineering economics to run the numbers: the complete TCO of 3 months of development plus ongoing maintenance, and the hidden costs that are often overlooked — security audits, compliance fill-ins, and developer onboarding documentation."
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

There's a widely shared joke in tech circles: "The most expensive trait of a programmer isn't writing code — it's saying, 'I can write that too.'" This rings especially true for identity systems. Almost any engineering team can cobble together a "working" login and registration system in a month — password hashing, JWT issuance, Redis session management. It looks simple. Why spend tens of thousands a year on a ready-made solution?

The answer is: **Authentication (login system) and Identity Platform are two entirely different things.** The former is a feature module; the latter is a system engineering effort requiring ongoing investment, continuous compliance, and sustained security. The gap between them is like the gap between building a go-kart in your garage and operating an automobile production line.

> **Integration Note**: The TCO calculations in this article are based on typical industry scenarios (mid-level engineer salaries in first-tier cities, general cloud service pricing). Actual costs vary by team location, tech stack, service provider pricing, and market conditions. Compliance costs are referenced to the Chinese market; other regions should follow local regulatory guidance. Autional pricing is subject to the latest official pricing page.

This article is not a product pitch — it's a complete TCO calculation using real data you can plug in for your own team.

## The Basic TCO Formula

For identity systems, TCO can be broken down into three phases:

```
TCO = Initial Build Cost + Annual Operations Cost + Implicit Risk Cost
```

Let's unpack each item with formulas and reasonable market reference values.

## Phase 1: Initial Build Cost

### Basic Authentication (Mandatory)

| Feature Module | Engineering Effort | Notes |
|---------------|-------------------|-------|
| Email + Phone registration/login | 15 person-days | Includes password policy, email verification, SMS verification code |
| Social login (WeChat/Google/GitHub) | 10 person-days | OAuth integration + token management per platform |
| JWT issuance and verification | 5 person-days | Access token + refresh token mechanism |
| Password reset flow | 5 person-days | Email-based recovery + security verification + password strength check |
| Session management | 5 person-days | Redis storage + expiry policy + concurrency limits |
| Basic RBAC (roles + permissions) | 10 person-days | User-role-permission model + dynamic permission checks |
| **Subtotal** | **50 person-days** | **~2.5 engineer-months** |

### Security Enhancements (Strongly Recommended)

| Feature Module | Engineering Effort | Notes |
|---------------|-------------------|-------|
| MFA (TOTP + SMS + Email) | 15 person-days | Three methods + recovery codes + device management |
| Login risk control (rate limiting + geo anomaly detection) | 10 person-days | IP rate limiting + geographic anomaly detection |
| Password hashing strategy (bcrypt/argon2) | 3 person-days | Algorithm selection + upgrade migration mechanism |
| API Key management | 5 person-days | Generation/rotation/revocation + permission binding |
| Session forced invalidation | 3 person-days | Admin force logout + invalidation on password change |
| **Subtotal** | **36 person-days** | **~1.8 engineer-months** |

### Compliance Features (Market-Required)

| Feature Module | Engineering Effort | Notes |
|---------------|-------------------|-------|
| Audit logging (complete + tamper-proof) | 10 person-days | Structured logging + hash chain verification |
| Data export (user data subject request) | 5 person-days | GDPR DSAR / PIPL data portability |
| Data deletion (account deletion + data cleanup) | 8 person-days | Cascading deletion + audit retention + backup cleanup |
| Privacy policy + Cookie consent management | 3 person-days | GDPR/ePrivacy compliance UI |
| MLPS compliance (log retention 180 days + encryption + audit) | 15 person-days | For the Chinese market |
| **Subtotal** | **41 person-days** | **~2 engineer-months** |

### Total Initial Build Cost

```
Initial development effort = 50 + 36 + 41 = 127 person-days ≈ 6.4 engineer-months
```

Based on a mid-level backend engineer's annual salary of ¥300,000-450,000 (including benefits and office costs) in a first-tier Chinese city, the monthly cost is approximately ¥30,000-35,000:

```
Initial build cost = 6.4 months × ¥30,000/month × 1 person ≈ ¥192,000
```

If multiple engineers work in parallel (a 3-person team developing different modules concurrently), total person-months remain the same, but calendar time can be compressed to 2-3 months. However, larger teams incur higher communication overhead, and actual person-months typically increase by 20-30%:

```
3-person parallel build cost = 6.4 × 1.25 × ¥30,000 ≈ ¥240,000
```

## Phase 2: Annual Operations Cost

### Infrastructure

| Resource | Monthly Cost | Annual Cost |
|----------|-------------|------------|
| Cloud servers (4C8G × 2, HA) | ¥800 × 2 | ¥19,200 |
| Managed PostgreSQL | ¥500 | ¥6,000 |
| Managed Redis | ¥300 | ¥3,600 |
| SMS + Email service | ¥500 | ¥6,000 |
| Domain + SSL certificate | ¥100 | ¥1,200 |
| Monitoring (Managed Prometheus + Grafana) | ¥300 | ¥3,600 |
| **Subtotal** | **¥3,300/month** | **¥39,600/year** |

### Human Maintenance

Identity system maintenance is not a "write it and forget it" affair. Ongoing investment includes:

| Maintenance Item | Frequency | Annual Effort |
|-----------------|-----------|---------------|
| Security vulnerability patching (e.g., CVE follow-up) | On-demand, ~1/month | 12 person-days |
| Dependency upgrades (Go version, third-party libs) | Quarterly | 8 person-days |
| Feature iteration (new OAuth providers, new MFA methods) | On-demand | 20 person-days |
| Compliance audit (annual security audit + pen test) | 1/year | 15 person-days |
| On-call (handling production issues and user support) | Continuous | 12 person-days |
| **Subtotal** | — | **67 person-days/year** |

```
Annual human maintenance cost = 67 person-days ÷ 20.83 person-days/month × ¥30,000/month ≈ ¥97,000/year
```

### Total Annual Operations Cost

```
Annual operations cost = ¥39,600 (infrastructure) + ¥97,000 (human) ≈ ¥136,000/year
```

## Phase 3: Implicit Risk Cost

This is the most frequently overlooked component of TCO — not reflected on the books, but real when it happens:

| Risk Event | Probability | Single Loss | Annualized Risk Cost |
|------------|------------|-------------|---------------------|
| Security breach leading to data leak | 5%/year | ¥500K-5M (fines + compensation + brand damage) | ¥25K-250K |
| Compliance audit failure (unable to serve customers) | 20%/year (startups) | Loss of 1-3 enterprise customers, each ¥100K-500K | ¥20K-300K |
| Feature delays (team bottlenecked maintaining old features) | N/A | Product launch delayed 1-3 months | Unquantifiable opportunity cost |
| Key engineer leaving, taking knowledge | 15%/year | New hire needs 2-3 months to learn the code | ¥60K-90K |
| **Total Implicit Risk Cost** | — | — | **~¥100K-640K/year** |

You might argue these probabilities are just estimates. True. But the key point is: **these risks are near-zero with a purchased platform** — security vulnerabilities are patched by the vendor, compliance certifications are maintained by the vendor, and knowledge continuity is guaranteed by the vendor. The risk premium of building in-house is the probability × loss you bear.

## TCO Summary

| Cost Item | Year 1 | Year 2 | Year 3 |
|-----------|--------|--------|--------|
| Initial build | ¥192K-240K | ¥0 | ¥0 |
| Infrastructure | ¥40K | ¥40K | ¥40K |
| Human maintenance | ¥97K | ¥97K | ¥97K |
| Implicit risk | ¥100K-640K | ¥100K-640K | ¥100K-640K |
| **In-house annual TCO** | **¥429K-1,017K** | **¥237K-777K** | **¥237K-777K** |
| **3-year cumulative TCO** | — | — | **¥903K-2,571K** |

Compare with Autional commercial editions:

| Edition | Annual Fee (10K MAU) | 3-Year Cumulative |
|---------|----------------------|-------------------|
| Autional Pro | ¥12K/year | ¥36K |
| Autional Enterprise | ¥36K/year | ¥108K |

## When to Build vs When to Buy?

### Build if:

1. **Your needs are extremely unique** — for instance, your identity system needs deep integration with a 15-year-old legacy ERP that no off-the-shelf platform can handle. Even then, what you likely need is a professional services team rather than a pure in-house build.

2. **Zero compliance requirements** — your system is an internal tool with no external users, no personal data processing, and no regulatory scrutiny. Still, you need security — and security's implicit costs don't vanish just because compliance isn't a factor.

3. **You are an identity platform company** — well, if you are a competitor to Auth0, Keycloak, or Autional, then yes, you need to build. But if you're reading this blog post, you probably aren't.

### Buy if:

1. **You have external users** — once your system is open to real users, any identity-related security incident is a brand incident.
2. **You have any compliance requirements** — whether GDPR (for European users), PIPL (for Chinese users), SOC 2 (for enterprise customers), or MLPS (for Chinese regulations), compliance costs far exceed platform fees.
3. **Your team has fewer than 50 people** — small teams lack the bandwidth to maintain a full identity platform. Buying lets you focus on your core business.
4. **You are fundraising or preparing for acquisition** — investors and acquirers scrutinize whether the identity system is professionally built during due diligence. A homegrown "good enough" login system is a liability.

## Final Thoughts

The purpose of this TCO calculation is not to say "buying is always cheaper than building." The truth is: **if all you really need is a login box, building it for a month might indeed cost less than buying for a year.** But the problem is that almost every SaaS product needs not a "login box" but an "identity platform" — a system engineering effort requiring sustained investment in security, compliance, features, and operations.

When running the numbers, include the implicit costs. When evaluating, include the risk premium. You should arrive at a sufficiently clear number. And that number will most likely point you toward "buy."

---

*Autional offers a Community Edition (permanently free), Pro Edition (¥12K/year), and Enterprise Edition (¥36K/year). [View full pricing and edition comparison](/pricing).*
