---
title: "RBAC vs ABAC vs ReBAC: Which Permission Model Do You Need?"
date: "2026-10-04"
category: "Tech"
tags: ["RBAC", "ABAC", "ReBAC", "Access Control", "Least Privilege"]
readTime: "10 min"
excerpt: "Logging in gets you through the door — deciding what you can do inside is an entirely different question. RBAC answers it by role, ABAC by attributes, ReBAC by relationships. This article traces the standards timeline from NIST to Google Zanzibar and lays out a decision table for choosing between them, plus how Autional runs all three layers together."
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

A backend engineer new to the team gets his first permissions ticket: add an "Export Report" button to the order console, visible only to operations and finance.

After wiring it up, he asks himself one question: **when operator Maya clicks that button, which orders will she actually see?**

Three teammates give three different answers:

- "She's in the operations group, and that group has the permission" — that's **role**.
- "Weekdays between 9 and 6, from the corporate network, only for completed orders" — that's **attributes**.
- "She can only see orders from the stores she personally manages" — that's **relationships**.

All three answers are correct, but they answer three different questions. And that's the first trap in permission design: **treating three questions as one.**

## "Can they see it?" — only three ways to ask

Every "can they see it?" question reduces to one of three forms:

| The question | The evidence | The model |
|:--|:--|:--|
| **What kind of person are they?** | Which badge they carry (group, role) | RBAC |
| **Do they meet the conditions?** | Their attributes, evaluated on the spot | ABAC |
| **How do they relate to this data?** | The edges between them and the object | ReBAC |

- **RBAC** (Role-Based Access Control) bundles permissions into roles and attaches people to roles. Change a role once, and everyone holding it changes with it.
- **ABAC** (Attribute-Based Access Control) bundles nothing. It evaluates subject, object, action, and environment attributes at decision time — "is finance" and "is a weekday" are just attributes.
- **ReBAC** (Relationship-Based Access Control) walks a **relationship graph** between users and objects — "does Maya share a team with the owner?" "did Maya create this document?"

The three approaches answer three questions: **RBAC asks "can this kind of person?", ABAC asks "do these conditions qualify?", ReBAC asks "does this person relate to this thing?"** Step one of any selection process is not memorizing acronyms — it's figuring out which question you're actually asking.

## A timeline: this wasn't invented on a whiteboard

Each step in the evolution of permission models was a response to getting burned in practice.

| When | What happened | The problem it solved |
|:--|:--|:--|
| Early | ACL / DAC: "one list per person, owners decide" | Auditable, but unmanageable at scale |
| Early | MAC: military multi-level security labels | Enforced by classification, but rigid |
| **1992-10-13** | Ferraiolo & Kuhn (NIST) propose RBAC: bind permissions to roles, not people | Role changes no longer require per-person edits |
| **1996** | Sandhu et al. publish "Role-Based Access Control Models" (IEEE Computer 29(2)) | Establishes the RBAC0–RBAC3 tiers |
| **2000** | NIST consolidates into the NIST RBAC model | A shared industry reference |
| **2004-02-11** | Adopted as ANSI/INCITS 359-2004 (revised 2012-05-29 as INCITS 359-2012) | RBAC becomes a formal standard |
| **2014-01** | NIST publishes **SP 800-162**, the ABAC guide (errata 2019-02) | ABAC gets a definition and a checklist |
| **2019** | Google publishes the **Zanzibar** paper (USENIX ATC 2019) | Relationship-based authorization proven at global scale |

In one line: **we went from handing out keys to individuals, to handing them to roles, to evaluating conditions, to following relationships — every new question needed a new kind of key.**

## RBAC: by role, still the default

RBAC does three things: **bundle permissions into roles → attach people to roles → resolve roles at decision time.**

It became the default for enterprises and multi-tenant systems for good reasons: change a role once and everyone holding it updates; auditing "who can export" means reading a roster; behavior is stable and predictable.

But the four letters hide four tiers (Sandhu 1996, RBAC0–RBAC3):

| Tier | What it adds | The gap it fills | The cost |
|:--|:--|:--|:--|
| RBAC0 | Bundles permissions into "packages" attached to people | Per-person lists don't scale | Too many packages becomes a mess |
| RBAC1 | A big package automatically includes smaller ones (inheritance) | One change shouldn't touch a hundred grants | Over-nesting creates invisible abilities |
| RBAC2 | Conflicting packages can't land on the same person (separation of duty) | One person doing the whole workflow is unauditable | Only stops pairs you actually listed |
| RBAC3 | Both inheritance and constraints | Fine-grained orgs need both | Complete, but needs real maintenance |

NIST's unified model describes the same thing as four components: Core RBAC, Hierarchical RBAC, Static Separation of Duty, and Dynamic Separation of Duty.

**RBAC's hard boundary**: it cannot answer "**which** row?" Operations has the "view orders" permission — but can she see every order on the platform, or only her store's? That requires a data scope layered on top, which we cover in a separate article.

### Role explosion: RBAC's real bill

Left to grow, RBAC produces **role explosion**. Kuhn, Coyne & Weil documented it in "Adding Attributes to Role-Based Access Control" (IEEE Computer 43(6), 2010): large organizations can end up needing **hundreds or thousands of roles**.

The mechanism is mundane. The business is always "just one condition away": "East-region finance" → "East-region finance, month-end only" → "East-region finance, month-end only, completed orders only." Building a role per combination turns the role table into an exhaustive enumeration of business conditions.

That's exactly the motivation for ABAC: **instead of pre-cooking every combination of conditions into a role, let the decision engine evaluate the conditions directly.**

## ABAC: by attribute, flexible but demanding

ABAC's official definition comes from NIST SP 800-162 (2014-01, errata 2019-02): decisions are based on four attribute categories — **subject, object, action, and environment**.

A typical ABAC rule (XACML style):

```xml
<Rule Effect="Permit">
  <Target>
    <AnyOf><Match MatchId="string-equal">
      <AttributeValue>export</AttributeValue>
      <AttributeDesignator Category="action" AttributeId="action-id"/>
    </Match></AnyOf>
  </Target>
  <Condition>
    <Apply FunctionId="and">
      <Apply FunctionId="string-equal">
        <AttributeValue>finance</AttributeValue>
        <AttributeDesignator Category="subject" AttributeId="department"/>
      </Apply>
      <Apply FunctionId="time-in-range">
        <AttributeValue>09:00:00/18:00:00</AttributeValue>
        <EnvironmentAttributeDesignator AttributeId="current-time"/>
      </Apply>
    </Apply>
  </Condition>
</Rule>
```

The upside is obvious: conditions change, you edit a rule — no new role required. The costs are equally real:

- **Rules get tangled.** With several rules in play, "who can actually do what" stops being readable at a glance.
- **Evaluation is expensive.** Every decision pulls live attributes (department, time, location), which is heavier than a role lookup.
- **Auditing gets harder.** "Why does he have access?" resolves through an evaluation trace, not a roster.

ABAC is not "RBAC, but better." It moves complexity out of the role table and into a rule base. The complexity doesn't disappear — it relocates.

## ReBAC: by relationship, for "who does this row belong to?"

ReBAC comes out of the social-network era: data is born with relationships — a document lives in a folder, a folder belongs to a team, a team has members. Instead of granting a role to "the team," you store an edge between the user and the object, and at decision time ask: **starting from this person, can we reach this object?**

Google's Zanzibar (2019) is the industrial-scale proof. The paper's numbers:

- **trillions** of access control lists;
- **millions** of authorization requests per second;
- **99.999%** availability over three years, with 95th-percentile latency under **10 milliseconds**.

The cost: relationships chain, so one edge change can **ripple everywhere**; tuple volume is enormous, making both storage and queries heavy. It fits object-level sharing and ownership — cloud drives, collaborative docs, social graphs — and does not belong under everything as a universal base.

## The three models side by side

| Dimension | RBAC (by role) | ABAC (by attribute) | ReBAC (by relationship) |
|:--|:--|:--|:--|
| Decision basis | Which badge you carry | Your attributes, evaluated live | Whether an edge connects you to the object |
| Question answered | Can this kind of person? | Do these conditions qualify? | Does this person relate to this thing? |
| Granularity | Coarse (resource:action) | Fine (arbitrary condition combinations) | Fine (object-level, transitively) |
| Strength | Simple, auditable, stable | Flexible, dynamic, context-aware | Native fit for hierarchy/sharing/ownership |
| Cost | Role explosion, static, blind to context | Tangled rules, slow evaluation | Ripple effects, heavy storage and queries |
| Standards | INCITS 359 / NIST RBAC | NIST SP 800-162 / OASIS XACML | Zanzibar (2019) / NGAC |
| In one line | Grant by role | Decide by condition | Decide by relationship |

## How to choose: start with the question

| What you're governing | Which model | Why |
|:--|:--|:--|
| A class of people (what a job does) | By role | Least effort, easiest audit |
| Time, department, device conditions | By attribute | Flexible without enumerating roles |
| "Who does this row belong to" | By relationship | Precise and transitive |
| Reality (some of everything) | **All three** | Most systems aren't either/or — they layer |

Two selection rules that get ignored far too often:

1. **Finer does not mean safer.** Badly written rules leak at any granularity; badly drawn relationship edges connect data that should never have been connected.
2. **No model replaces the discipline of least privilege.** That rule predates all of them: Saltzer & Schroeder wrote it down in 1975 — grant only what's needed. A famous counterexample is Capital One (2019): a single over-broad cloud role was exploited, exposing data on roughly **106 million** customers and applicants, and the OCC issued an **$80 million** penalty in August 2020. Pick the perfect model and grant over-broad scope, and you still get breached.

## Authentication ≠ authorization: two questions, two rulebooks

There's a more fundamental line than model selection: **getting in is a pass — identity and permission are separate questions.**

The split between the standards makes it clear: NIST's digital identity guidelines (**SP 800-63**) address authentication, while attributes, authorization, and access control are handled separately in the **AC family of SP 800-53 (AC-3, Access Enforcement)**. The two have stayed separate for a reason: they answer different questions.

The engineering consequence: **never treat "login succeeded" as "permissions are fine."** A login credential proves who you are; it proves nothing about which data you may touch. Fold authorization into the same token and you get the worst of both — permission changes wait for re-login, and a leaked token leaks the entire permission list.

## How Autional layers the three

Back to that first ticket. Autional's answer isn't to pick one model — it's three layers, each answering its own question:

1. **Role baseline (RBAC).** `rbac-service` implements NIST RBAC's Core plus hierarchical inheritance (inheritance via `ParentID`, with `checkCircularHierarchy` running BFS to break cycles) and static separation of duty (`ConflictPair` conflict pairs, with three pairs seeded by default). Change a role once; everyone holding it updates.
2. **Attribute narrowing (ABAC).** `abac_evaluator` evaluates expressions with **deny-override** semantics: role-based checks run first, and anything a role allows can still be narrowed by the condition layer (time windows, environment restrictions).
3. **Relationship backstop (ReBAC).** `rbac_relationships` stores Zanzibar-style relation tuples, and `micro-pkg/rebac` provides BFS and Expand — answering "who does this row belong to?"

Two disciplines come with the layers:

- **Start minimal.** New accounts get the smallest role by default; additions go through approval (PIM just-in-time roles). Big permissions are never permanent.
- **No permissions inside credentials.** Authentication lives in `identity-service`; authorization lives in `rbac-service` — physically separate services. `role_checker.go` spells it out: **the access token carries no role; roles are resolved on demand.** Permission changes take effect immediately (no re-login), and a leaked token leaks no permission list.

Honest boundaries: the department and org data ABAC needs lives in `tenant-service`, and we hold only references to it (unifying the semantics of our two condition implementations is still on the backlog). Dynamic separation of duty — holding two conflicting roles but being barred from activating both at once — is not implemented; we cover the common cases, not every case. And how any given platform implements and mixes the tiers is rarely visible in public material — measure your own system.

## Common misconceptions

- "Finer-grained means safer." No — badly configured rules leak at any granularity.
- "You must pick one of the three." No — real systems layer: roles as the base, attributes to narrow, relationships for row ownership.
- "The names are intimidating." They're just jargon for three questions.
- "Login succeeded, so permissions are fine." Login answers who; permissions answer what. Different questions.
- "Grant once, done forever." Grants accumulate; without revocation on transfer or departure, old access just stays.
- "A role is a job title." A role is a bundle of what someone can do — not "manager" or "director."

## Closing

Next time you're about to tick permission checkboxes, stop and ask one question: **am I governing a class of people, a set of conditions, or "who does this row belong to"?**

The question decides the model. RBAC, ABAC, and ReBAC aren't three weapons — they're three ways to ask. **Governing permissions starts with knowing which question you're asking.**
