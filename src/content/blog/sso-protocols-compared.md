---
title: "SSO Protocols Compared: SAML vs OAuth 2.0 vs OIDC vs CAS"
date: "2026-06-15"
category: "Tech"
tags: ["SSO", "SAML", "OAuth", "OIDC"]
readTime: "10 min"
excerpt: "SAML, OAuth 2.0, OIDC, CAS — four names, four protocols, four fundamentally different design philosophies. Many engineers can't distinguish OAuth 2.0 from OIDC, while some enterprise users insist on SAML and refuse JWT. This article systematically breaks down these four SSO protocols from three dimensions — protocol history, working principles, and applicable scenarios — and provides a decision guide for choosing the right one based on business needs."
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

If HTTP is the universal language of the Web, then SSO protocols are the universal language of identity authentication. Unfortunately, unlike HTTP, this domain doesn't have a single standard — we have at least four "standards," each with its own advocates and use cases. To make matters worse, the relationships between their names involve subtle overlaps and easy misconceptions.

This article aims to answer three questions in the simplest possible language: **How does each protocol work? What are the real differences between them? Which one should you use in which scenario?**

## Protocol Overview

| Protocol | Year | Core Purpose | Data Format | Transport | Primary Use Case |
|----------|------|--------------|-------------|-----------|------------------|
| SAML 2.0 | 2005 | Federated identity (SSO) | XML | HTTP Redirect + POST | Enterprise B2B SSO |
| OAuth 2.0 | 2012 | Authorization | JSON / Arbitrary | HTTP (Bearer Token) | API authorization, third-party login |
| OIDC | 2014 | Authentication | JSON (JWT) | HTTP (based on OAuth 2.0) | Modern app SSO, mobile |
| CAS | 2002 | Web SSO (education) | XML / JSON | HTTP Redirect + Ticket | Universities, research institutions |

A key insight: **OAuth 2.0 is an authorization protocol, not an authentication protocol.** This is arguably the most misunderstood technical fact in the industry. OAuth 2.0 answers "Can Application A access User's data on Service B?", not "Who are you?". OIDC adds an identity layer (the `id_token`) on top of OAuth 2.0, extending the authorization protocol into an authentication protocol.

## SAML 2.0: The Enterprise Passport

### Background

SAML (Security Assertion Markup Language) was born in 2002, with its last major version, SAML 2.0, released in 2005 and maintained by the OASIS standards organization. Before cloud computing, enterprise system interoperability (e.g., employees using one account to log into CRM, ERP, and OA systems) relied primarily on SAML. To this day, it remains the de facto standard for B2B enterprise SSO — virtually all major enterprise identity providers (Okta, Azure AD, OneLogin) offer SAML as their primary protocol.

### How It Works

SAML involves three roles:

- **Principal (user)**: The person accessing the application via a browser
- **Identity Provider / IdP**: Authenticates users and issues assertions
- **Service Provider / SP**: Receives assertions and allows user access to the application

Complete SAML 2.0 Web Browser SSO flow:

```
1. User accesses SP (e.g., salesforce.com)
2. SP checks if user is authenticated → not authenticated
3. SP generates SAML AuthnRequest, redirects user's browser to IdP via HTTP Redirect
4. IdP authenticates user (e.g., password + TOTP)
5. IdP generates SAML Assertion (containing user identity and attributes), redirects browser back to SP via HTTP POST
6. SP validates the Assertion's signature (using IdP's public key)
7. SP establishes user session, grants access
```

Key security mechanisms:
- **XML Digital Signature**: SP uses IdP's public key to verify the Assertion hasn't been tampered with
- **NotBefore / NotOnOrAfter**: Assertions have a time window; expired assertions are invalid
- **InResponseTo / ID**: Each AuthnRequest and Response pair has unique ID binding to prevent replay attacks

### Strengths and Weaknesses

**Strengths**:
- Battle-tested (20+ years in production), security extensively validated
- Rich attribute passing (SAML Attribute Statement can pass arbitrary attributes)
- Supports IdP-Initiated SSO (users click an app icon on the IdP portal and log in directly without visiting the SP first)
- Mature enterprise ecosystem (all major SaaS platforms support SAML)

**Weaknesses**:
- XML bloat — a single SAML Response can reach tens of KB, while an equivalent JWT is just a few hundred bytes
- Computationally expensive signature verification (XML Canonicalization + XML Signature is CPU-intensive)
- Not mobile-friendly — SAML was designed for the desktop browser era; HTTP Redirect + POST binding is complex to implement in mobile apps
- Tedious configuration — IdP and SP must exchange metadata XML files and manually establish trust relationships
- Difficult debugging — XML-format Assertions are unreadable; troubleshooting requires specialized SAML debugging tools

### Applicable Scenarios

- **Enterprise B2B SSO**: Your customers are large enterprises using Okta / Azure AD / OneLogin as their IdP
- **Government / Education**: These sectors have slower IT standard update cycles; SAML is the mainstream for internal system interoperability
- **Rich attribute exchange needed**: If SSO requires not just authentication but also organizational structure, roles, departments, etc., SAML's Attribute Statement is more flexible than JWT claims

## OAuth 2.0: More Than Just "Authorization"

### Core Concepts

OAuth 2.0 (RFC 6749) defines an authorization framework that allows third-party applications to obtain limited access to protected resources under the resource owner's (user's) authorization. Core roles:

- **Resource Owner**: the user
- **Client**: the third-party application (e.g., a calendar app that needs to read your Google Calendar)
- **Authorization Server**: the authorization server (e.g., Google's OAuth endpoint)
- **Resource Server**: the resource server (e.g., Google Calendar API)

### Four Grant Types

OAuth 2.0 defines four grant types for different scenarios:

1. **Authorization Code Grant**: Most secure, most commonly used. Suitable for web applications with a backend. The client never touches the user's credentials; it uses a one-time authorization code to exchange for an access token. **Strongly recommended with PKCE (Proof Key for Code Exchange) to prevent authorization code interception attacks.**

2. **Client Credentials Grant**: Used for machine-to-machine communication. For example, `audit-service` calling `identity-service`'s internal API, using `client_id + client_secret` to obtain a token directly.

3. **Implicit Grant**: Deprecated. Historically used for pure frontend SPAs, but insecure because the token is exposed in the URL fragment. RFC 8252 recommends Authorization Code + PKCE instead.

4. **Resource Owner Password Credentials Grant**: Deprecated. The user hands over their username and password directly to the client, which exchanges them for a token. This is insecure (the client sees the user's credentials) and violates OAuth's design philosophy.

### Common Misconceptions Corrected

**Misconception 1**: "OAuth 2.0 can be used for login (authentication)."

OAuth 2.0 itself **cannot** be used for authentication. When you click "Sign in with Google," you're actually using OIDC (the authentication protocol built on top of OAuth 2.0), not pure OAuth 2.0. OAuth 2.0 only gives you an `access_token` — this token tells you "you can access resources," but not "who you are." Only the `id_token` (added by OIDC) contains user identity information.

**Misconception 2**: "OAuth 2.0 is more secure than SAML."

They serve different security needs. SAML is better suited for federation scenarios (cross-organization), while OAuth 2.0 is better for authorization scenarios (cross-application). It's not about which is more secure — it's about which is more appropriate for your scenario.

### AuthMS OAuth 2.0 Support

AuthMS's `oauth-service` fully supports:
- Authorization Code Grant + PKCE
- Client Credentials Grant
- Refresh Token Rotation (each use of a refresh token simultaneously issues a new refresh token, invalidating the old one)
- Token Introspection (RFC 7662)
- Token Revocation (RFC 7009)
- Custom scopes and claims

## OIDC (OpenID Connect): The Modern SSO Champion

### OIDC's Relationship with OAuth 2.0

OIDC is an **identity authentication layer** built on top of OAuth 2.0. It extends OAuth 2.0's protocol flow with two core additions:

- **`id_token`**: A JWT containing user identity information (`sub`, `name`, `email` claims, etc.). This is what OAuth 2.0 lacks, and it's what makes OIDC suitable for authentication.
- **UserInfo Endpoint**: An `access_token`-protected API that returns standardized user information.

```
OAuth 2.0:  access_token → authorization ("what you can access")
OIDC:       id_token     → authentication ("who you are") + authorization
```

**An analogy to help you distinguish once and for all**: OAuth 2.0 is like a hotel key card — it proves you're allowed into a certain room, but not who you are. OIDC is like an ID card — it proves your identity (name, date of birth), and grants you access to certain places as a side benefit.

### OIDC Authentication Flow

OIDC is based on OAuth 2.0's Authorization Code Grant, but adds the `openid` scope to the request and returns an `id_token` in the response:

```
1. RP (Relying Party, i.e., your application) redirects the user to OP (OpenID Provider, i.e., the auth service)
   GET /authorize?response_type=code&scope=openid+profile+email&client_id=xxx&redirect_uri=xxx

2. OP authenticates the user, returns an authorization code

3. RP exchanges the authorization code for tokens
   POST /token → { access_token, id_token, refresh_token }

4. RP validates the id_token's signature and claims (iss, aud, exp, sub)
   Validation passes → user is authenticated

5. (Optional) RP uses access_token to call the UserInfo Endpoint for additional attributes
```

### OIDC Advantages

- **JWT-based**: Lightweight (hundreds of bytes vs SAML's tens of KB), highly readable JSON format, mature JWT libraries in every language
- **Mobile-friendly**: Based on RESTful HTTP, unlike SAML which depends on browser redirects
- **Discovery mechanism**: Auto-discovers OP configuration (endpoints, supported scopes, crypto algorithms) via `/.well-known/openid-configuration` endpoint — zero manual configuration
- **Session management**: RP-Initiated Logout, Session Management, Back-Channel Logout, and other specifications provide complete session lifecycle management
- **OAuth 2.0 compatible**: Any service supporting OIDC naturally supports OAuth 2.0

### AuthMS OIDC Support

AuthMS's `oauth-service` as a complete OpenID Provider:
- Supports OIDC Discovery (`/.well-known/openid-configuration`)
- Supports `id_token` RS256 signing and verification
- Supports standard claims: `sub`, `name`, `email`, `email_verified`, `phone_number`, `preferred_username`, `picture`
- Supports custom claims (e.g., `tenant_id`, `role`)
- Supports RP-Initiated Logout and Session Management
- Supports Dynamic Client Registration (RFC 7591)

## CAS: The Education Sector's Gem

### Historical Position

CAS (Central Authentication Service) was created by Yale University in 2002 and later became an open-source project of Jasig (now the Apereo Foundation). It is the most common SSO protocol in Chinese universities, research institutions, and some government agencies — virtually all "unified identity authentication platforms" are built on CAS or CAS-like implementations.

### How It Works

CAS has a very simple design involving three core roles:

```
1. User accesses App
2. App checks for a valid CASTGC cookie (CASTGC = CAS Ticket Granting Cookie)
3. If none, redirect to CAS Server
4. CAS Server authenticates user, sets CASTGC cookie, issues ST (Service Ticket)
5. CAS Server redirects user back to App with ST in the URL
6. App uses ST to make a backend validation request to CAS Server (/serviceValidate)
7. CAS Server returns user information (XML/JSON)
8. App establishes local session
```

### CAS vs SAML vs OIDC

| Feature | CAS | SAML | OIDC |
|---------|-----|------|------|
| Complexity | Low | High | Medium |
| Data Format | XML / JSON | XML | JSON (JWT) |
| Session Management | CASTGC cookie | Depends on SP local session | Session Management / Logout Token |
| Single Logout (SLO) | Supported but limited | Supported | Supported (multiple modes) |
| Mobile Support | Poor | Poor | Good |
| Industry Adoption | Education / Government | Enterprise B2B | Internet / Modern apps |

### Why CAS Is Still Popular in Education

1. **Simplicity**: Few protocol concepts (TGT + ST, just two tokens), low learning curve for deployment and integration
2. **Historical inertia**: Chinese universities' IT modernization started early (around 2010), when OIDC hadn't appeared yet, SAML was too heavy, and CAS was the natural choice
3. **Rich extension ecosystem**: Apereo CAS has 100+ plugins supporting various authentication methods (LDAP, JDBC, SPNEGO, Radius, etc.)
4. **Inter-university federation**: Through Shibboleth or CAS protocols, universities can establish identity federations (e.g., CARSI / eduGAIN)

### CAS Limitations

- Weak mobile support (the protocol is natively browser-oriented)
- No standardized user attribute passing method (compared to SAML Attribute Statement and OIDC claims)
- Community is mainly active in the education sector; low enterprise adoption
- Protocol specification is less formal than SAML/OIDC (not as RFC-standardized)

## Protocol Selection Decision Guide

### By Business Scenario

| Scenario | Recommended Protocol | Reason |
|----------|---------------------|--------|
| B2B SaaS, integrating with large enterprise SSO | SAML 2.0 | Enterprise IdPs prefer SAML; OIDC is catching up but SAML remains dominant |
| Modern web app + mobile app | OIDC | JWT is lightweight, mobile-friendly, auto-discovery, zero configuration |
| Pure API service-to-service calls | OAuth 2.0 (Client Credentials) | No user involvement, direct service-to-service authorization |
| "Sign in with Google/WeChat/GitHub" | OIDC (via corresponding Provider) | Social login providers almost all support OIDC |
| Education / research institution internal SSO | CAS or SAML | Choose based on the target organization's existing infrastructure |
| Chinese government / state-owned enterprise projects | CAS (common) + SAML (international) | Consider the integration partner's technology stack history |
| Both enterprise and mobile support needed | SAML + OIDC dual protocol | AuthMS supports both, one platform covers all scenarios |

### AuthMS Protocol Architecture

AuthMS integrates all SSO protocols within `oauth-service`:

```
oauth-service (Port 11006)
├── OAuth 2.0 (RFC 6749)
│   ├── Authorization Code Grant + PKCE
│   ├── Client Credentials Grant
│   ├── Token Introspection (RFC 7662)
│   └── Token Revocation (RFC 7009)
├── OIDC (based on OAuth 2.0)
│   ├── OIDC Discovery
│   ├── id_token (JWT, RS256)
│   ├── UserInfo Endpoint
│   └── RP-Initiated Logout + Back-Channel Logout
├── SAML 2.0
│   ├── SP-Initiated SSO
│   ├── IdP-Initiated SSO
│   ├── SAML Metadata import/export
│   └── Attribute Statement mapping
└── CAS
    ├── CAS 1.0 / 2.0 / 3.0 protocol
    ├── Proxy Ticket (CAS PT) support
    └── CASTGC session management
```

All protocols share the same user source (`identity-service`), the same MFA policies (`mfa-service`), and the same audit logs (`audit-service`). This means you can serve from one platform simultaneously: frontend SPAs logging in via OIDC, enterprise customers via SAML, internal management systems via CAS — all sharing the same user identities, security policies, and audit records.

---

Protocols are means, not ends. Choose SAML not because XML is elegant, choose OIDC not because JWT is cool. Choose the protocol that best fits your users' tech stack, your compliance requirements, and your engineering capabilities — and if your users need multiple protocols, choose a platform that supports them all. AuthMS unifies all four protocols in `oauth-service`, so you don't need to maintain a separate identity system for each protocol.

*AuthMS oauth-service provides complete OAuth 2.0, OIDC, SAML 2.0, and CAS protocol support for enterprise customers. [View developer documentation](/developer/docs/oauth-service) for integration guides.*
