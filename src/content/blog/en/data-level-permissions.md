---
title: "Data-Level Permissions: Row-Level and Field-Level Access Control"
date: "2026-10-05"
category: "Architecture"
tags: ["Access Control", "Data Security", "BOLA", "Architecture", "Least Privilege"]
readTime: "9 min"
excerpt: "\"Has the view-orders permission\" does not mean \"can see every order.\" Two separate things hide behind one button: whether you may click it, and which data you touch when you do. Row-level rules govern which records; field-level rules govern which columns. This article walks through the USPS BOLA incident, PostgreSQL RLS, field masking, and why hiding a column in the UI secures nothing."
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

Suppose you grant operator Maya the "view orders" permission. The next day she asks: why can I see every order on the platform?

You check the role configuration. She does have "view orders." The problem is what you didn't notice: **"view orders" is just a ticket through the gate. Which aisles she can walk inside, and which items on the shelves are covered, is a boundary you draw separately.**

That boundary has a name: **data-level permissions**. And it's one of the two things teams routinely confuse on the same ticket.

## One button, two questions

| | ① May you click it? (the action) | ② What do you reach? (the data) |
|:--|:--|:--|
| The question | Does your account carry "view orders"? | Once clicked, which orders and which columns do you touch? |
| How it shows | Button enabled / greyed out | Same enabled button, different result sets |
| Subdivision | — (a single action permission) | **Row-level** (which records) + **field-level** (which columns) |
| Who governs it | The permission grant for the action | A **separately drawn** boundary |

The functional side checks "who + which resource + which action" against a list. The data side asks "which records of this resource can this user touch." Skip the separation and you get the opening scene: the role config was never wrong — the data still leaked.

## Row-level: four tiers, narrowing step by step

Row-level permissions answer "**which records**." In practice the most useful design is not infinitely fine rules but four tiers:

| Tier | In one line | What they can browse |
|:--|:--|:--|
| **All** | The whole shelf is yours | Every order on the platform |
| **Tenant** | Just this shop | All orders of this tenant |
| **Department** | Just what your unit handled | Department orders |
| **Self** | Just your own rows | Orders you personally handled |

Same button, different boundary: a colleague scoped to "tenant" browses the whole store; Maya scoped to "self" sees a handful of rows.

One default worth setting carefully: **scope should default to "self"** and be widened explicitly. Starting wide and narrowing later means every leak waits to be discovered before it gets closed.

## Field-level: slicing across a single row

Row-level governs "which records"; field-level governs "**which fields** within one record."

In a single order row: the order number and amount are fine to show; the phone number and government ID must be masked. They live in the same row, so row-level rules can't touch them — row-level only governs whole records.

Field-level has exactly two honest implementations: **masking and encryption**.

- **Masking**: the presentation layer receives `138****5678`; the plaintext never leaves the controlled zone.
- **Encryption**: sensitive fields are encrypted at rest; a query path without the key only ever sees ciphertext.

**Hiding a column in the UI is not field-level security.** Open the developer tools, hit a different endpoint, export a CSV — the data is still there. A piece of tape over the label doesn't empty the box.

## Enforce at read time

The most common implementation mistake is the **location** of the filter.

Query everything first, then drop the rows you shouldn't see in application code — **too late. The data already left the store**: it can persist in logs, caches, and exception traces.

The right shape is a sieve on the tap: **filter first, release second.** Enforcement must happen at the moment data leaves storage — as a SQL predicate, a database row-security policy, or a rewrite inside the data-access layer.

One symmetric rule: **if you filter reads, filter updates and deletes too.** Protecting the query endpoint while letting `UPDATE` / `DELETE` run by primary key is locking the front door and leaving the back one open.

## Two implementation routes

### Route one: in the database — PostgreSQL RLS

PostgreSQL has shipped built-in **row-level security** since 9.5 (2016), letting the database enforce the filter itself:

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_tenant_isolation ON orders
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY orders_self_only ON orders
  USING (owner_id = current_setting('app.user_id')::uuid);
```

The fine print:

- **Deny by default** — enable RLS without a matching policy and the table returns nothing;
- **`BYPASSRLS` and table owners bypass policies** (the official docs say so explicitly) — migration scripts, backup tools, and DBA connections often carry those privileges, so audit them separately;
- Application connections must use an ordinary role and set the session variables on every request, or the policies mean nothing.

### Route two: in the application — a unified data-access layer

Don't let business code compose its own `WHERE` clauses; a shared data-access layer **rewrites queries** based on the current identity:

```go
// Pseudocode: narrow before fetching
func ApplyDataScope(q *Query, ident Identity, res Resource) *Query {
    switch ident.Scope(res) {
    case ScopeAll:
        return q                                    // platform administrators
    case ScopeTenant:
        return q.Where("tenant_id = ?", ident.TenantID)
    case ScopeDepartment:
        return q.Where("tenant_id = ? AND department_id = ?", ident.TenantID, ident.DepartmentID)
    case ScopeSelf:
        return q.Where("tenant_id = ? AND owner_id = ?", ident.TenantID, ident.UserID)
    }
    return q.Where("1 = 0")                          // unknown scope → return nothing
}
```

The two routes aren't exclusive: the application layer carries the semantics ("what counts as my department"), the database layer is the backstop (even a missed query can't escape).

## A real lesson: USPS and 60 million records

In November 2018, the USPS "Informed Visibility" system was publicly disclosed to have a broken object-level authorization flaw: the API behind usps.com accounts **performed no object-level authorization checks** — any **logged-in** ordinary account could query **other users'** profile data (email, username, account number, street address, phone), and the API accepted wildcards, letting a caller pull an **entire dataset** in one request.

- Roughly **60 million** users were affected;
- An anonymous researcher had reported it **about a year earlier** with no response; KrebsOnSecurity notified USPS ahead of publication (the API had already been modified), and published on 2018-11-21;
- One attribution that must stay precise: the USPS OIG audit report of October 2018 found **authentication and encryption weaknesses** — it did **not** find this object-level flaw, and must not be cited as evidence of it.

This is the textbook shape of **API1:2023 Broken Object Level Authorization (BOLA)**, the long-running number one on the OWASP API list: not "they weren't logged in," but "they were logged in, and nobody checked whether the record belonged to them." Its neighbor, **API3:2023 (BOPLA, Broken Object Property Level Authorization)**, covers the field level — responses carrying fields that shouldn't ship, or requests quietly setting fields that shouldn't change.

## Why this boundary is expensive

The difficulty isn't conceptual. It's four costs:

1. **Dependence on org data** — "department" and "self" scopes only work if the system knows who sits where. That data usually lives in another system and needs integration, sync, and an authoritative source.
2. **Performance** — row filtering turns "fetch one" into "fetch a candidate set and check," which changes index design and query plans.
3. **Real handling of sensitive fields** — masking and encryption aren't toggles: encryption means key management and migrating existing data; masking means asking whether downstream systems can still work with masked values.
4. **Read/write symmetry** — filtering reads is half the job. Updates, deletes, exports, and bulk operations all need the same rules.

## The compliance view: not optional

Data-level permissions map directly onto hard requirements:

- **China's PIPL**: personal information processing must follow the "minimum necessary" principle;
- **China's MLPS 2.0 (GB/T 22239-2019)**: access control demands least privilege, with subject-object operations authorized and controlled;
- **GDPR Article 5**: the data minimisation principle;
- **NIST SP 800-53 Rev.5**: AC-3 (access enforcement), AC-4 (information flow enforcement), AC-6 (least privilege);
- **OWASP ASVS V4.2**: testable requirements for object-level authorization.

For multi-tenant SaaS there's a business layer too: **tenant isolation is simply the coarsest row-level tier.** One leak in the "tenant" tier is a cross-tenant incident.

## How Autional handles it

Our implementation has three parts:

1. **Four scope tiers attached to roles**: the `DataScope` constant has exactly four values — `all` / `tenant` / `department` / `self` — with `self` as the role default. Change a role once and everyone holding it narrows together.
2. **Fetch only what belongs to you**: data access goes through a controlled path that rewrites query conditions from the current identity, rather than filtering after the fact.
3. **Sensitive fields handled separately**: password hashes, MFA secrets, and OAuth tokens are controlled at the storage layer; the presentation side masks on demand.

Honest boundaries: filtering by "department" and "self" **requires org data**, and that integration is still being completed here (full filtering for the `department` / `self` tiers is not fully wired yet — currently marked with debug logs only); the general-purpose row-level / field-level policy engine is still on the roadmap. Org and department data lives in `tenant-service`, and we hold only references. Before enforcing strict field-level policies in your own system, start with a measured inventory against your data classification list.

## Common misconceptions

- "Has view-orders permission, therefore sees all orders." Being allowed to click is not the same as reaching every row.
- "Filter in the UI after fetching." The data already left the store — enforcement must happen at fetch time.
- "Hide the phone number in the UI, done." The data is still there; real coverage means masking or encryption.
- "The narrower the tier, the safer." Too narrow blocks legitimate work; scope should be exactly right, no more and no less.
- "Configure once, forever." Transfers and departures require revoking scope along with roles — stale scope keeps showing people what they shouldn't see.
- "RLS is on, so we're covered." `BYPASSRLS` and table owners bypass policies; privileged connections need their own audit.

## Closing

Next time a back office shows you "just your own rows," don't assume it's broken — consider that the boundary is covering everyone else's.

Two questions worth carrying into any permission review:

**Same button — who reaches which rows? And is that boundary enforced at read time, or cleaned up after fetching?**
