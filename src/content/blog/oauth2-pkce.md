---
title: "OAuth 2.1 & PKCE: Securing Authorization Flows for Mobile Apps and SPAs"
date: "2026-02-28"
category: "Tech"
tags: ["OAuth", "Security", "Mobile"]
readTime: "7 min"
excerpt: "The OAuth 2.1 draft makes PKCE mandatory for all authorization code flows, officially retiring the Implicit flow. This article explains PKCE's principles, attack scenarios, step-by-step implementation, and how Autional enables zero-code OAuth 2.1 adaptation — oauth-service has PKCE built in, fully automated server-side."
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

More than a decade after OAuth 2.0's release, its security flaws have been thoroughly exposed. The OAuth 2.1 draft, passed in 2025, is a major security upgrade to the original specification, with one core change:

> **PKCE (Proof Key for Code Exchange) becomes mandatory for all authorization code flows. The Implicit grant flow is officially removed.**

What does this mean for mobile app and SPA developers? Let's start from the beginning.

## The Problem: Why Was the Authorization Code Flow Not Secure Enough?

Before understanding PKCE, understand the problem it solves.

### The Standard Authorization Code Flow

OAuth 2.0's Authorization Code Grant works as follows:

1. The client redirects the user to the authorization server
2. The user logs in and authorizes
3. The authorization server returns an `authorization_code` via the redirect URL
4. The client exchanges this `code` + `client_secret` for an `access_token` at the token endpoint

This flow is secure in server-side applications (where `client_secret` can be stored safely) — even if an attacker intercepts the authorization code in step 3, without the `client_secret` they cannot exchange it for a token in step 4.

### But in Mobile Apps and SPAs…

Mobile apps and SPAs **cannot securely store a `client_secret`**. APK packages can be decompiled; JavaScript code is exposed in the browser. Attackers can easily extract a `client_secret`.

This creates a critical security vulnerability — **Authorization Code Interception Attack**:

```
1. Attacker installs the target app on their own phone
2. Attacker registers a custom URL scheme (e.g., myapp://callback) to intercept system redirects
3. Attacker induces the user to authorize on their phone (but the target app is the victim's installation)
4. After authorization completes, the authorization code is returned via the redirect URL
5. If the attacker can intercept the code (malicious app registered the same custom scheme)
   → Attacker has the code + extracted client_secret → can exchange for access_token
6. Attacker now accesses the API as the victim
```

This issue is especially severe on mobile because Android allows multiple apps to register the same custom URL scheme, and iOS versions before 2024 had the same risk.

## The Solution: How PKCE Works

PKCE's core idea is elegantly simple: **At the start of the flow, create a random secret known only to the client. At the end of the flow, use that secret to prove "I am the same client that initiated the request."**

### The Four Key Steps of PKCE

```
Step 1: Client generates code_verifier

  code_verifier = randomly generated 43-128 character high-entropy string
  e.g.: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"

Step 2: Client computes code_challenge

  code_challenge = BASE64URL(SHA256(code_verifier))
  e.g.: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

  code_challenge_method = "S256"

Step 3: Send code_challenge in the authorization request

  GET /authorize?
    response_type=code&
    client_id=myapp&
    redirect_uri=https://myapp.com/callback&
    code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&
    code_challenge_method=S256

Step 4: Send code_verifier in the token request

  POST /token
    grant_type=authorization_code&
    code=abc123&
    client_id=myapp&
    code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk

  Server verifies:
  BASE64URL(SHA256(code_verifier)) == code_challenge ?
  If matched → issue access_token
  If not matched → reject (401)
```

### Why Can't an Attacker Bypass PKCE?

Even if an attacker successfully intercepts the authorization code, they face an unsolvable problem:

- The attacker can see `code_challenge` (transmitted in plaintext in step 3's URL)
- The attacker can intercept the `authorization_code` (returned in step 3)
- But **the attacker doesn't have the `code_verifier`** — this value is never transmitted over the network, it exists only in the legitimate client's local memory

SHA256 is a one-way hash function. You cannot reverse `code_challenge` to derive `code_verifier`. Without `code_verifier`, the request to the token endpoint will be rejected.

That's the essence of PKCE: **Prove identity with a random secret held locally on the client, without ever transmitting that secret over the network.**

## Implementation in Autional: oauth-service Fully Automates PKCE

In Autional's `oauth-service`, PKCE is not optional — it's the default behavior. As an OAuth 2.1-compliant identity platform, Autional handles all PKCE complexity:

### Authorization Endpoint (/authorize)

```go
// oauth-service automatically:
// 1. Parses and validates code_challenge and code_challenge_method
// 2. Stores the association between code_challenge and authorization_code
// 3. If code_challenge is missing from the request → rejects (401)
func (h *AuthorizationHandler) HandleAuthorize(c *gin.Context) {
    req := parseAuthorizeRequest(c)
    
    // OAuth 2.1: PKCE is mandatory for all authorization code flows
    if req.CodeChallenge == "" {
        c.Error(auth.ErrPKCERequired)
        return
    }
    if req.CodeChallengeMethod != "S256" {
        c.Error(auth.ErrInvalidCodeChallengeMethod)
        return
    }
    // ... proceed with authorization
}
```

### Token Endpoint (/token)

```go
// oauth-service automatically:
// 1. Reads the original code_challenge from storage
// 2. Recomputes the code_challenge from the request's code_verifier
// 3. Compares the two code_challenge values
// 4. Match → issue token; mismatch → reject
func (h *TokenHandler) HandleTokenExchange(c *gin.Context) {
    req := parseTokenRequest(c)
    
    storedChallenge := h.store.GetCodeChallenge(ctx, req.Code)
    computedChallenge := base64URLEncode(sha256(req.CodeVerifier))
    
    if !subtle.ConstantTimeCompare(storedChallenge, computedChallenge) {
        c.Error(auth.ErrInvalidCodeVerifier)
        return
    }
    // ... issue tokens
}
```

Critical security detail: Autional uses `crypto/subtle.ConstantTimeCompare` instead of regular string comparison to prevent timing attacks that could infer a valid `code_verifier`.

### Companion Client SDKs

Autional provides client SDKs covering major platforms, with PKCE logic built into the SDK:

```typescript
// Web SDK (React)
import { useAuth, login } from '@authms/react';

function LoginButton() {
  const { isAuthenticated } = useAuth();
  
  const handleLogin = async () => {
    await login({
      clientId: 'myapp',
      redirectUri: 'https://myapp.com/callback',
      // ⬇️ SDK auto-generates code_verifier and computes code_challenge
      // Developers don't need to worry about PKCE details
    });
  };
  
  return !isAuthenticated && <button onClick={handleLogin}>Login</button>;
}
```

```kotlin
// Android SDK (Kotlin)
Autional.authorize(
    context = this,
    config = AutionalConfig(
        clientId = "myapp",
        redirectUri = "myapp://callback",
        // ⬇️ SDK auto-generates code_verifier and computes code_challenge
        // Developers don't need to worry about PKCE details
    )
) { result ->
    when (result) {
        is AutionalResult.Success -> handleToken(result.accessToken)
        is AutionalResult.Error -> handleError(result.exception)
    }
}
```

## The Deprecated Implicit Flow: Why It Had to Go

OAuth 2.1 officially removes the Implicit Grant flow. This wasn't a sudden decision — the security community had been calling for its deprecation for years.

### Problems with the Implicit Flow

The Implicit Flow was originally designed to provide a backend-free authorization method for pure frontend applications (JavaScript SPAs):

```
GET /authorize?response_type=token&client_id=myapp&redirect_uri=...

→ Server returns access_token directly in the URL fragment:
   https://myapp.com/callback#access_token=xxx&expires_in=3600
```

The issue list:

1. **Access Token exposed in the URL**: URL fragments aren't sent to the server, but can leak through browser history, browser extensions, and (in some scenarios) referrer headers
2. **No client authentication**: No client_secret, no PKCE — anyone who knows the redirect_uri can initiate the flow
3. **No token refresh**: The Implicit Flow doesn't support refresh_token (since the token is directly exposed in the URL, long-term credentials can't be stored securely)
4. **Expired tokens require full re-authorization**: Worse user experience

### Migration Path: Implicit Flow → Authorization Code + PKCE

| Dimension | Implicit Flow | Authorization Code + PKCE |
|-----------|--------------|--------------------------|
| Use case | SPA (deprecated) | SPA, Mobile, Desktop |
| Access Token location | URL fragment (insecure) | HTTPS response body (secure) |
| Client authentication | None | PKCE code_verifier |
| Refresh Token support | No | Yes |
| Token refresh | Requires re-authorization | Silent refresh |
| OAuth 2.1 status | Removed | Mandatory |

### Minimal Changes to Migrate from Implicit Flow

If your app is still using the Implicit Flow, good news: migrating to Authorization Code + PKCE requires minimal changes.

**Before (Implicit Flow):**
```javascript
// response_type=token → access_token appears directly in URL fragment
const hash = window.location.hash;
const accessToken = new URLSearchParams(hash.substring(1)).get('access_token');
```

**After (Authorization Code + PKCE):**
```javascript
// response_type=code → exchange code for token via backend SDK
import { exchangeCodeForToken } from '@authms/web-sdk';

const params = new URLSearchParams(window.location.search);
const code = params.get('code');

const { accessToken, refreshToken } = await exchangeCodeForToken({
  code,
  codeVerifier: getStoredCodeVerifier(), // SDK manages this
  clientId: 'myapp',
  redirectUri: 'https://myapp.com/callback'
});
```

For Autional users already using our SDK (React, Vue, Android, iOS), **no code changes are needed**. oauth-service automatically handles all authorization code flows with PKCE, transparent to the client.

## PKCE Limitations: Not a Silver Bullet

PKCE solves authorization code interception attacks, but it doesn't solve all OAuth security issues:

- **PKCE can't prevent malicious clients**: If an attacker tricks a user into installing a malicious app disguised as a legitimate one, PKCE can't prevent authorization (the attacker's app can generate its own code_verifier)
- **PKCE relies on HTTPS**: While PKCE provides integrity protection, the authorization request and token response still need HTTPS to prevent man-in-the-middle (MITM) attacks
- **PKCE can't prevent CSRF**: The `state` parameter is still needed to prevent cross-site request forgery

Therefore, Autional's recommended security combination is:

```
PKCE (anti-auth code interception) + state (anti-CSRF) + DPoP (anti-token replay, planned) + strict redirect_uri validation
```

## Summary

OAuth 2.1's PKCE mandate is a late but correct security decision. For mobile and SPA developers, it may require some code changes, but the security benefits are significant:

1. **Even if an attacker intercepts the authorization code, they cannot exchange it for a token**
2. **Migrating from Implicit Flow to PKCE gives the app refresh_token support, improving user experience**
3. **Autional's oauth-service and client SDKs handle all PKCE complexity — developers need minimal adaptation**

If you're building a mobile app or SPA that requires OAuth authorization, use Authorization Code + PKCE from day one. If your existing app still uses the Implicit Flow, it's time to migrate — OAuth 2.1 isn't just a best practice, it's the future standard for all identity platforms.

Autional's `oauth-service` has followed the OAuth 2.1 specification since its inception, providing out-of-the-box PKCE support. Visit our documentation and GitHub repository for more implementation details.
