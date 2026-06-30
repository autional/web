---
title: "The AI Agent Identity Problem: Who Authenticates When AI Acts for Humans?"
date: "2026-06-07"
category: "Tech"
tags: ["AI Agent", "AI Security", "Future"]
readTime: "9 min"
excerpt: "When an AI Agent sends emails, approves purchases, and commits code on your behalf, identity systems face a thorny question: who actually completed the authentication — the AI or the human? This article explores the frontier challenges of Non-Human Identity (NHI) management and Autional's approach."
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

## The Question: Who Is Operating?

Picture this scene on a workday in 2026:

> You're a procurement manager. You use an AI Agent to handle routine purchases automatically. This week, the Agent detects that office supply inventory is below threshold, automatically generates a purchase order, and sends it to the approver. The approver is also an AI Agent that approves the order based on budget and policy. The order is sent automatically to the supplier's system.

Now ask three questions:
1. The procurement system's identity log shows "Operator: Procurement Manager" — but that's not entirely accurate; the direct operator is an AI Agent
2. If the wrong item is purchased — is it the human's fault? The Agent's fault? Or the platform's fault?
3. Does an audit log entry reading "approver = procurement_agent" have legal weight in a regulatory audit?

This isn't science fiction. In 2026, enterprises are already using AI Agents in production to handle workflows. The identity infrastructure hasn't caught up.

## What Is Non-Human Identity (NHI)?

We're accustomed to an identity model of "one person = one account." Each account is bound to:
- Identity identifier (username/email/phone)
- Authentication credentials (password/biometrics/TOTP)
- Authorization information (roles/permissions/groups)

But these "accounts" don't fit that model:

| Type | Example | Characteristics |
|------|---------|-----------------|
| Service Account | CI/CD deployment account | Represents a service, not a person |
| API Client | Third-party app integration | Gets tokens via client_credentials |
| IoT Device | Smart locks, sensors | Low power, no user interface |
| AI Agent | Automated procurement, automated customer service | Makes decisions and operations on behalf of humans |
| RPA Bot | Automated data entry | Simulates human UI operations |

Gartner predicts that by 2028, non-human identities will outnumber human identities. This trend will only accelerate in the context of the AI Agent rise.

## New Demands AI Agents Place on Identity Systems

### Requirement 1: Delegated Authorization — "An AI Acting for Someone"

A user should never share their password with an AI Agent. The correct approach is:

**Delegated Authorization**: The user delegates a subset of their permissions to the Agent through a standard authorization protocol.

This can be implemented using OAuth 2.0 Token Exchange (RFC 8693):

```
User logs in → obtains access token (scope: procurement.*)
             → requests delegation token authorizing the agent
             → agent obtains a restricted token (scope: procurement.create, procurement.read)
             → agent uses the restricted token to operate on behalf of the user
```

Key distinction: the agent's token scope is explicitly limited by the user — the user has `procurement.*` but only grants the agent `procurement.create` + `procurement.read`, not `procurement.approve`.

Autional's `oauth-service` supports this delegated authorization model through the Token Exchange protocol (RFC 8693):
- User token → exchanged for a limited-scope agent token
- The agent token includes the `act` claim (actor), indicating "this operation was performed by the agent on behalf of the user"
- Audit logs simultaneously record `user_id` (delegator) and `actor_id` (Agent ID)

### Requirement 2: Non-Repudiation — "Was It a Human or an AI?"

When a purchase order is "approved," the audit log must be able to distinguish:
- Case A: A human approver manually clicked the "Approve" button
- Case B: An AI Agent automatically approved within the rules authorized by a human

**Solution**: The `act` (Actor) claim in JWT tokens.

```json
{
  "sub": "user_procurement_manager",
  "act": {
    "sub": "agent_procurement_bot_v2",
    "delegation_id": "delg_01ARZ3NDEK..."
  },
  "scope": "procurement.create",
  "iat": 1715692800,
  "exp": 1715696400
}
```

When the `audit-service` receives an operation record with this token, it records both `sub` and `act.sub` — at any time, it's traceable back to "authorized by whom, executed by which Agent."

### Requirement 3: Rate Limiting — "Agents May Be Too Fast"

Human operations have a natural ceiling — at most a few button clicks per minute. An AI Agent can complete 1,000 operations in the same minute. If the identity infrastructure isn't designed for NHI at this speed, it will be rate-limited or locked out as an attack.

Autional's rate limiting needs to distinguish between "high-frequency operations by the same user, same device but initiated by an AI Agent" and "abnormally high-frequency operations impossible for a human":

- **Standard Rate Limit**: 60 API calls per user per minute (human ceiling)
- **Agent Rate Limit**: Dynamic limit per Agent per minute (based on Agent's permission level and historical behavior)
- **Anomaly Detection**: Agent operation pattern suddenly deviates from baseline → triggers manual review

### Requirement 4: Auditing — "An Immutable Chain of Evidence"

When an AI Agent makes a wrong decision (e.g., incorrectly approving a purchase that exceeds budget), there must be a complete chain of evidence:
- When the human user granted the Agent what permissions
- What data the Agent based its decision on (risk score? rule matching? LLM reasoning?)
- The complete timeline of the decision (input → processing → output)
- The Agent's model version and configuration snapshot

Traditional audit logs ("user X did Y at time Z") are insufficient to capture this information. Autional's `audit-service` needs to extend the audit model: from "who did what when" to "who, through whom, when, based on what, did what."

## Autional's NHI Roadmap

Facing the rise of AI Agents, Autional is preparing on multiple fronts:

### Near Term (2026)

**Token Exchange Support**: Full implementation of RFC 8693 Token Exchange in `oauth-service`, supporting user token exchange for limited-scope agent tokens.

**act Claim Standardization**: All JWT tokens include the `act` claim, recording the delegation chain.

**audit-service Actor Support**: Extended audit log model with `actor_type` (human/service/agent) and `delegation_chain` fields.

### Medium Term (2027)

**Agent Identity Registration**: `identity-service` supports creating Agent-type identity principals with their own registration and authentication flows (API Key + OAuth client_credentials).

**Agent Permission Model**: RBAC extended to support Agent-specific roles — e.g., `agent_procurement` can create purchase orders but not approve them.

**Agent Behavior Baseline**: `session-service` establishes behavioral baselines for Agents, triggering alerts on abnormal behavior.

### Long Term (2028+)

**Agent-to-Agent Authentication**: Support direct authentication and authorization between two AI Agents without human intermediation.

**Decision Provenance**: The `audit-service` records the complete "data lineage" of Agent decisions — input data, model version, reasoning steps — forming a reviewable chain of evidence for decisions.

## What This Means for Today's Developers

If you're building a product that will leverage AI Agents in 2026-2027, here's what you can do now:

1. **Don't let users give passwords to Agents**. Use independent API Keys or OAuth Tokens (client_credentials grant) for Agents, and obtain user-representation permissions through Token Exchange.

2. **Distinguish "doer" from "on-behalf-of" in audit logs**. Even if your system doesn't have Agents today, adding an `actor` field to your audit model leaves room for the future.

3. **Design rate limiting for high-frequency operations**. Agents can operate 10-100 times faster than humans. Limits should be based on operation type and risk level, not simply "N times per user per minute."

4. **Follow the OAuth 2.0 Token Exchange standard (RFC 8693)** rather than inventing your own protocol. It's the industry's best practice convention for delegated authorization.

## Summary

AI Agents are not a "future feature" for identity systems — they are a reality unfolding now. As AI performs more and more digital operations on behalf of humans, identity infrastructure must answer a fundamental question: **in a mixed human-AI operational chain, who is the responsible entity?**

The answer will influence the entire identity technology stack — from authentication protocols and authorization models to auditing standards. Autional is systematically addressing this challenge from four directions: Token Exchange, the `act` claim, Agent identity types, and decision provenance.
