---
title: "OpenID Connect Deep Dive: ID Token, UserInfo, and Claims Explained"
date: "2026-05-22"
category: "Tech"
tags: ["OIDC", "OpenID Connect", "OAuth"]
readTime: "10 min"
excerpt: "OIDC is an identity layer built on top of OAuth 2.0. This article provides an in-depth analysis of ID Token structure (JWT claims), the UserInfo endpoint's role, the differences between Authorization Code, Implicit, and Hybrid flows, and how Autional oauth-service delivers complete OIDC Provider capabilities."
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

OAuth 2.0 solves the "authorization" problem — allowing third-party applications to gain access to resources. But it never solved the prerequisite question: **Who is this user?**

OAuth 2.0 doesn't define a standard format for identity information. Each implementation defines its own API for retrieving user data, leading to ecosystem fragmentation. OpenID Connect (OIDC) was created to fill this gap — it's an **identity layer** built on top of OAuth 2.0.

## What is OIDC?

OIDC stands for OpenID Connect 1.0. In one sentence:

> **OIDC = OAuth 2.0 + ID Token + UserInfo + Standardized Identity Claims**

OAuth 2.0 gives you an `access_token` to access the user's resources. OIDC additionally provides an `id_token` (in JWT format) that tells you who the user is.

The simplest way to understand the relationship:

| | OAuth 2.0 | OIDC |
|---|-----------|------|
| Core output | access_token | id_token + access_token |
| Problem solved | "Can this app access my photos?" | "Who am I? Verify my identity" |
| Client role | Access resources on behalf of user | Verify user identity |
| Info format | No standard (defined by resource server) | Standardized JWT claims |
| Typical scenario | Let Gmail read your Google Drive files | Log into third-party sites with Google account |

## ID Token: The Soul of OIDC

The ID Token is OIDC's core innovation. It's a JWT signed by the authorization server, containing a standardized set of identity claims.

### ID Token Structure

```json
// Header
{
  "alg": "RS256",
  "kid": "2026-key-01",
  "typ": "JWT"
}

// Payload
{
  "iss": "https://iam.tianv.com",                    // Issuer
  "sub": "01ARZ3NDEKTSV4RRFFQ69G5FAV",           // Subject (user unique ID)
  "aud": "app_client_id_12345",                   // Audience (must be the client's client_id)
  "exp": 1715693800,                              // Expiration time
  "iat": 1715690200,                              // Issued at
  "auth_time": 1715690200,                        // Last authentication time
  "nonce": "n-0S6_WzA2Mj",                       // Anti-replay
  "name": "Zhang San",
  "email": "zhangsan@example.com",
  "email_verified": true,
  "picture": "https://avatar.example.com/zhangsan.jpg",
  "phone_number": "+8613800138000",
  "phone_number_verified": false,
  "preferred_username": "zhangsan",
  "locale": "zh-CN",
  "zoneinfo": "Asia/Shanghai",
  "updated_at": 1715600000,
  "tenant_id": "tenant_abc123",                   // Autional extension: multi-tenant identifier
  "roles": ["admin", "developer"]                 // Autional extension: role claims
}
```

### Standard Claims Explained

**Required Claims (per OIDC spec):**

- `iss` (Issuer): The token's issuer. Must be an HTTPS URL containing protocol, hostname, optional port and path, but no query parameters or fragments. The RP must verify this value exactly.
- `sub` (Subject): The user's unique identifier. The same user always has the same `sub` under the same Issuer. **However, different client_ids may receive different `sub` values** (Pairwise Subject Identifier), unless using a Public Subject Identifier.
- `aud` (Audience): The token's target audience. Must include the client's `client_id`. If the ID Token has multiple audiences, the `azp` (Authorized Party) claim must appear to specify which client is actually authorized.
- `exp` (Expiration): Expiration time. Clients must verify the ID Token hasn't expired.
- `iat` (Issued At): Issuance time. Clients can use this to reject tokens with obviously wrong timestamps (e.g., future times).

**Recommended Claims:**

- `auth_time` (Authentication Time): Timestamp of the user's last authentication. Used to determine if re-authentication is needed — if the user hasn't authenticated for a long time, they should re-login even if the ID Token hasn't expired.
- `nonce`: A random string sent by the client in the authentication request, which must be included with the same value in the ID Token. This is a critical anti-replay mechanism.

**User Information Claims (defined in OpenID Connect Core 1.0 Section 5.1):**

| Claim | Type | Description |
|-------|------|-------------|
| `name` | string | Full name |
| `given_name` | string | Given name |
| `family_name` | string | Family name |
| `email` | string | Email address |
| `email_verified` | boolean | Whether email is verified |
| `picture` | string | Profile picture URL |
| `phone_number` | string | Phone number (E.164 format) |
| `phone_number_verified` | boolean | Whether phone is verified |
| `locale` | string | Language and region setting (BCP47) |
| `zoneinfo` | string | Time zone (e.g., `Asia/Shanghai`) |

### ID Token Verification Flow

After receiving the ID Token, the client (RP) must perform the following verification:

```
1. Verify JWT signature (using the public key from JWK endpoint)
2. Verify iss (matches expected issuer)
3. Verify aud (includes own client_id)
4. Verify exp (token not expired)
5. Verify iat (token not issued in the future)
6. If nonce present, verify it matches the value sent in the request
7. If using Authorization Code Flow, verify c_hash (Code Hash)
8. If using Implicit/Hybrid Flow, verify at_hash (Access Token Hash)
```

Steps 7 and 8 — hash verification — are the most overlooked yet critical. They bind the ID Token to the Authorization Code or Access Token, preventing mixing attacks.

Autional oauth-service automatically computes and embeds `c_hash` and `at_hash` when issuing ID Tokens. Client SDKs automatically verify these during validation.

## The UserInfo Endpoint

Beyond the claims embedded in the ID Token, OIDC defines the UserInfo endpoint. This is an OAuth 2.0-protected API endpoint that clients access with their access_token to retrieve the current user's identity information.

### UserInfo Endpoint vs ID Token

| | ID Token | UserInfo Endpoint |
|---|----------|------------------|
| Retrieval method | Direct response at end of auth flow | Separate API call |
| Authentication | No credentials needed (self-signed JWT) | Requires access_token |
| Content | Fixed set of claims | Dynamic content based on scope |
| Real-time | Snapshot at issuance | Real-time query |
| Use case | Basic identity info (name, email, etc.) | Latest or additional user info |

**Best practice**: Use the ID Token for authentication confirmation ("verify who this user is") and the UserInfo endpoint for detailed user information. Don't rely solely on the ID Token for sensitive or time-sensitive user attributes, as it may be cached.

When a client requests `openid profile email` scopes, Autional includes the corresponding claims in the UserInfo endpoint response:

```json
{
  "sub": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  "name": "Zhang San",
  "given_name": "San",
  "family_name": "Zhang",
  "email": "zhangsan@example.com",
  "email_verified": true,
  "picture": "https://avatar.example.com/zhangsan.jpg",
  "updated_at": 1715600000
}
```

## The Three OIDC Flows

OIDC inherits OAuth 2.0's authorization flows and adds identity information on top. Three main flows:

### 1. Authorization Code Flow

This is the most secure flow. The Authorization Code is passed through the frontend browser (not exposed to JavaScript), while the Token is retrieved via the backend channel. PKCE provides an extra layer of protection. Autional uses this flow by default.

### 2. Implicit Flow — Deprecated

OAuth 2.1 has officially removed the Implicit Flow. It returns the Token directly through the frontend URL fragment, creating serious security risks — tokens are exposed in browser history and referrer headers. If you're still using it, now is the time to migrate.

### 3. Hybrid Flow

The Hybrid Flow is a combination of Authorization Code Flow and Implicit Flow — the frontend receives an ID Token (for immediate user display), while the backend exchanges the Authorization Code for an Access Token. Suitable for scenarios requiring both frontend instant display and backend secure access.

Autional oauth-service supports all three flows, but for new client registrations in the admin console, only Authorization Code Flow (with PKCE) is allowed by default.

## Requesting Scopes and Claims

OIDC uses the scope parameter to control which claims are returned:

| Scope | Meaning | Returned Claims |
|-------|---------|-----------------|
| `openid` | Request OIDC authentication (required) | `sub`, `iss`, `aud`, `exp`, `iat` |
| `profile` | Basic user info | `name`, `family_name`, `given_name`, `picture`, `locale`, `zoneinfo`, `updated_at` |
| `email` | Email info | `email`, `email_verified` |
| `address` | Address info | `address` (JSON object) |
| `phone` | Phone info | `phone_number`, `phone_number_verified` |

Additionally, OIDC supports the `claims` request parameter, allowing clients to precisely request specific claims:

```
GET /authorize?
  ...
  &claims={
    "id_token": {
      "email": {"essential": true},
      "email_verified": {"essential": true}
    },
    "userinfo": {
      "name": null,
      "picture": null
    }
  }
```

Autional oauth-service fully implements standard scope mapping and claims request parameter parsing, and supports configuring allowed scope ranges for each client in the admin console.

## Autional as an OIDC Provider

Autional oauth-service is a complete OIDC Provider, implementing the following endpoints:

```
/.well-known/openid-configuration     # OIDC Discovery document
/oauth/authorize                      # Authorization endpoint
/oauth/token                          # Token endpoint
/oauth/userinfo                       # UserInfo endpoint
/oauth/jwks                           # JWK endpoint (public keys)
/oauth/revoke                         # Token revocation endpoint
/oauth/introspect                     # Token introspection endpoint
```

### Multi-Tenant Support

Each tenant can have its own independent OIDC domain and configuration:

```
https://tenant-a.iam.tianv.com/.well-known/openid-configuration
https://tenant-b.iam.tianv.com/.well-known/openid-configuration
```

Each tenant's JWK key pair is managed independently, and key rotation happens at the tenant level. This means a key leak in one tenant doesn't affect others.

### Custom Claims Mapping

Autional allows tenant administrators to configure custom claims mapping:

```yaml
# Tenant configuration
oidc:
  claims_mapping:
    id_token:
      tenant_id: "{{.User.TenantID}}"
      roles: "{{.User.Roles}}"
      department: "{{.Profile.Department}}"
    userinfo:
      organization: "{{.Profile.Organization}}"
      employee_id: "{{.Profile.EmployeeID}}"
```

These templates are dynamically rendered at token issuance time, enabling each tenant to map their business fields into OIDC claims.

### Security Features

1. **HTTPS enforced**: All endpoint URLs in the OIDC Discovery document must use HTTPS. Autional enforces HTTPS at the deployment layer through the nginx reverse proxy.

2. **PKCE mandatory**: For public clients (SPAs and mobile apps), PKCE is mandatory and cannot be disabled. This follows OAuth 2.1 security best practices.

3. **Token binding**: `c_hash` and `at_hash` are automatically computed and embedded, preventing mixing attacks.

4. **Pairwise Subject Identifier**: For privacy-sensitive scenarios, Autional supports generating different `sub` values for different clients, preventing cross-client user tracking. Implementation based on `sub = SHA-256(client_id || user_id || sector_identifier_uri)`.

## Client Integration Example

Below is a standard OIDC client integration with Autional:

```javascript
// 1. Discover OIDC Provider configuration
const config = await fetch(
  'https://iam.tianv.com/.well-known/openid-configuration'
).then(r => r.json());

// 2. Build authorization request
const authUrl = new URL(config.authorization_endpoint);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('client_id', 'your_client_id');
authUrl.searchParams.set('redirect_uri', 'https://yourapp.com/callback');
authUrl.searchParams.set('scope', 'openid profile email');
authUrl.searchParams.set('state', generateRandomState());
authUrl.searchParams.set('nonce', generateRandomNonce());
authUrl.searchParams.set('code_challenge', await pkceChallenge());
authUrl.searchParams.set('code_challenge_method', 'S256');

// 3. Redirect user to authorization page
window.location.href = authUrl.toString();

// 4. Handle response in callback URL
// 5. Exchange code for token
// 6. Verify ID Token
// 7. Extract user info
```

Autional provides official OIDC client SDKs for Go, JavaScript, Python, and Java, encapsulating the complex logic of PKCE, JWT verification, and token management.

## Summary

OIDC is the most widely adopted standardized identity protocol today. It elevates OAuth 2.0 from a pure authorization protocol to a complete identity authentication protocol, enabling cross-system user identity interoperability through the standardized claims format of the ID Token.

Autional oauth-service, as a complete OIDC Provider, delivers:
- Full OIDC endpoints (Authorization, Token, UserInfo, JWK, Discovery)
- Multi-tenant isolated domains and key management
- Flexible custom claims mapping
- PKCE enforcement, token binding, Pairwise Subject Identifier, and other security features
- Multi-language client SDKs

Whether you're building your own identity system or integrating third-party login, OIDC is the cornerstone of modern identity architecture.
