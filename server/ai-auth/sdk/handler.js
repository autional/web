/**
 * BFF login handler: OAuth 2.0 Authorization Code + PKCE (S256), OIDC nonce,
 * encrypted HttpOnly session, consent-revocation check and an optional
 * BFF→AI internal JWT.
 *
 * Runtime target: any Web `Request`/`Response` environment (Cloudflare Workers,
 * Vercel Edge, Node 20+). No tokens are persisted anywhere.
 */
import { base64UrlEncode, base64UrlDecode, decryptJson, encryptJson, fromUtf8, importRs256PrivateKey, randomBytes, safeEqual, sha256Base64Url, signRs256, utf8, } from './crypto.js';
import { appendSetCookie, clearCookie, readCookie, serializeCookie } from './cookies.js';
import { createConsentChecker } from './consent.js';
import { createEndpointResolver, pkceChallenge, verifyIdToken } from './oidc.js';
import { newSession, openSession, sealSession, sessionCookieName, touchSession } from './session.js';
const DEFAULT_SCOPES = ['openid', 'email'];
const DEFAULT_ABSOLUTE_TTL = 8 * 60 * 60;
const DEFAULT_IDLE_TTL = 30 * 60;
const DEFAULT_STATE_TTL = 10 * 60;
function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim() !== '';
}
function normalizeConfig(config) {
    if (!isNonEmptyString(config.issuer))
        throw new Error('ai-auth: issuer is required');
    if (!isNonEmptyString(config.clientId))
        throw new Error('ai-auth: clientId is required');
    if (!isNonEmptyString(config.clientSecret))
        throw new Error('ai-auth: clientSecret is required');
    if (!isNonEmptyString(config.redirectUri))
        throw new Error('ai-auth: redirectUri is required');
    if (!isNonEmptyString(config.resource))
        throw new Error('ai-auth: resource is required');
    if (!isNonEmptyString(config.sessionSecret) || config.sessionSecret.length < 32) {
        throw new Error('ai-auth: sessionSecret must be at least 32 characters');
    }
    const redirect = new URL(config.redirectUri);
    if (redirect.protocol !== 'https:' && !config.allowInsecureHttp) {
        throw new Error('ai-auth: redirectUri must use https');
    }
    const issuer = config.issuer.replace(/\/+$/u, '');
    const scopes = (config.scopes ?? DEFAULT_SCOPES).map((scope) => scope.trim()).filter(Boolean);
    if (scopes.length === 0)
        throw new Error('ai-auth: scopes must not be empty');
    for (const required of ['openid', 'email']) {
        if (!scopes.includes(required))
            throw new Error(`ai-auth: scope '${required}' is required`);
    }
    const cookiePrefix = config.cookiePrefix ?? '__Host-ai';
    const secureCookies = config.secureCookies ?? true;
    if (cookiePrefix.startsWith('__Host-') && !secureCookies) {
        throw new Error('ai-auth: __Host- cookies require secureCookies=true; use cookiePrefix "ai" for local http');
    }
    const allowedNextPrefixes = (config.allowedNextPrefixes ?? ['/ai']).map((prefix) => prefix.endsWith('/') ? prefix.slice(0, -1) || '/' : prefix);
    return {
        raw: config,
        ...(config.onError ? { onError: config.onError } : {}),
        issuer,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri,
        resource: config.resource,
        siteOrigin: redirect.origin,
        scopes,
        sessionSecret: config.sessionSecret,
        absoluteTtl: config.sessionAbsoluteTtlSeconds ?? DEFAULT_ABSOLUTE_TTL,
        idleTtl: config.sessionIdleTtlSeconds ?? DEFAULT_IDLE_TTL,
        stateTtl: config.stateTtlSeconds ?? DEFAULT_STATE_TTL,
        cookiePrefix,
        secureCookies,
        allowedNextPrefixes,
        loginPath: '/ai/login',
        requireEmail: config.requireEmail ?? true,
        fetcher: config.fetch ?? fetch,
    };
}
function cookieOptions(config, maxAgeSeconds) {
    return {
        secure: config.secureCookies,
        httpOnly: true,
        sameSite: 'Lax',
        path: '/',
        ...(maxAgeSeconds !== undefined ? { maxAgeSeconds } : {}),
    };
}
function stateCookieName(config, stateHash) {
    return `${config.cookiePrefix}-oauth-state-${stateHash}`;
}
function browserCookieName(config) {
    return `${config.cookiePrefix}-browser`;
}
function defaultNext(config) {
    const first = config.allowedNextPrefixes[0];
    if (!first || first === '/')
        return '/';
    return `${first}/`;
}
function sanitizeNext(config, raw) {
    const fallback = defaultNext(config);
    if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || /[\r\n]/u.test(raw)) {
        return fallback;
    }
    let url;
    try {
        url = new URL(raw, config.siteOrigin);
    }
    catch {
        return fallback;
    }
    if (url.origin !== config.siteOrigin)
        return fallback;
    const pathname = url.pathname;
    const allowed = config.allowedNextPrefixes.some((prefix) => {
        if (prefix === '/')
            return true;
        return pathname === prefix || pathname.startsWith(`${prefix}/`);
    });
    if (!allowed)
        return fallback;
    return `${pathname}${url.search}${url.hash}`;
}
function loginErrorRedirect(config, code, headers) {
    const url = new URL(config.loginPath, config.siteOrigin);
    url.searchParams.set('error', code);
    return redirect(url.toString(), headers);
}
function redirect(location, headers) {
    const finalHeaders = headers ?? new Headers();
    finalHeaders.set('location', location);
    finalHeaders.set('cache-control', 'no-store');
    return new Response(null, { status: 302, headers: finalHeaders });
}
function jsonResponse(body, status = 200, headers) {
    const finalHeaders = headers ?? new Headers();
    finalHeaders.set('content-type', 'application/json; charset=utf-8');
    finalHeaders.set('cache-control', 'no-store');
    finalHeaders.set('x-content-type-options', 'nosniff');
    finalHeaders.set('referrer-policy', 'no-referrer');
    finalHeaders.set('content-security-policy', "default-src 'none'; frame-ancestors 'none'");
    return new Response(JSON.stringify(body), { status, headers: finalHeaders });
}
function methodNotAllowed() {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
        status: 405,
        headers: { 'content-type': 'application/json; charset=utf-8', allow: 'GET, POST' },
    });
}
function reportError(config, error, context) {
    try {
        config.onError?.(error, context);
    }
    catch {
        // Observability hooks must never break the auth flow.
    }
}
async function exchangeCode(config, endpoints, code, verifier) {
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        code_verifier: verifier,
    });
    const basic = btoa(`${config.clientId}:${config.clientSecret}`);
    const response = await config.fetcher(endpoints.token, {
        method: 'POST',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            accept: 'application/json',
            authorization: `Basic ${basic}`,
        },
        body: body.toString(),
    });
    if (!response.ok)
        throw new Error(`token endpoint returned HTTP ${response.status}`);
    const payload = (await response.json());
    if (payload.error)
        throw new Error(`token endpoint error: ${payload.error}`);
    if (!isNonEmptyString(payload.access_token) || !isNonEmptyString(payload.id_token)) {
        throw new Error('token response is missing access_token/id_token');
    }
    if (String(payload.token_type ?? '').toLowerCase() !== 'bearer') {
        throw new Error('token response token_type is not Bearer');
    }
    return payload;
}
async function fetchUserInfo(config, endpoints, accessToken) {
    const response = await config.fetcher(endpoints.userinfo, {
        headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
    });
    if (!response.ok)
        throw new Error(`userinfo returned HTTP ${response.status}`);
    const payload = (await response.json());
    if (!isNonEmptyString(payload.sub))
        throw new Error('userinfo is missing sub');
    return payload;
}
function sessionCookieNameFor(config) {
    return sessionCookieName(config.cookiePrefix);
}
function readSessionCookie(config, request) {
    return readCookie(request, sessionCookieNameFor(config));
}
async function issueSessionCookie(config, headers, session) {
    const sealed = await sealSession(config.sessionSecret, session);
    appendSetCookie(headers, serializeCookie(sessionCookieNameFor(config), sealed, cookieOptions(config)));
}
export function createAiAuth(configInput, hooks = {}) {
    const config = normalizeConfig({
        ...configInput,
        ...(hooks.onError ? { onError: hooks.onError } : {}),
    });
    const endpoints = createEndpointResolver({
        ...config.raw,
        issuer: config.issuer,
        fetch: config.fetcher,
        allowInsecureHttp: config.raw.allowInsecureHttp,
    });
    const consent = createConsentChecker({ ...config.raw, fetch: config.fetcher });
    let privateKey = null;
    async function login(request) {
        if (request.method !== 'GET')
            return methodNotAllowed();
        try {
            const url = new URL(request.url);
            const next = sanitizeNext(config, url.searchParams.get('next'));
            const resolved = await endpoints();
            const state = base64UrlEncode(randomBytes(32));
            const nonce = base64UrlEncode(randomBytes(32));
            const verifier = base64UrlEncode(randomBytes(32));
            const browserNonce = base64UrlEncode(randomBytes(32));
            const challenge = await pkceChallenge(verifier);
            const stateHash = (await sha256Base64Url(state)).slice(0, 16);
            const payload = {
                v: 1,
                state,
                nonce,
                verifier,
                next,
                browserNonce,
                expiresAt: Math.floor(Date.now() / 1000) + config.stateTtl,
            };
            const stateCookie = await encryptJson(config.sessionSecret, payload);
            const headers = new Headers();
            appendSetCookie(headers, serializeCookie(stateCookieName(config, stateHash), stateCookie, cookieOptions(config, config.stateTtl)));
            appendSetCookie(headers, serializeCookie(browserCookieName(config), browserNonce, cookieOptions(config, config.stateTtl)));
            const authorize = new URL(resolved.authorize);
            authorize.searchParams.set('response_type', 'code');
            authorize.searchParams.set('client_id', config.clientId);
            authorize.searchParams.set('redirect_uri', config.redirectUri);
            authorize.searchParams.set('scope', config.scopes.join(' '));
            authorize.searchParams.set('state', state);
            authorize.searchParams.set('nonce', nonce);
            authorize.searchParams.set('code_challenge', challenge);
            authorize.searchParams.set('code_challenge_method', 'S256');
            return redirect(authorize.toString(), headers);
        }
        catch (error) {
            reportError(config, error, 'login');
            return loginErrorRedirect(config, 'login_unavailable');
        }
    }
    async function callback(request) {
        if (request.method !== 'GET')
            return methodNotAllowed();
        const headers = new Headers();
        let stateHashForClear = '';
        const fail = (code) => {
            const clearHeaders = new Headers();
            if (stateHashForClear) {
                appendSetCookie(clearHeaders, clearCookie(stateCookieName(config, stateHashForClear), cookieOptions(config)));
            }
            appendSetCookie(clearHeaders, clearCookie(browserCookieName(config), cookieOptions(config)));
            return loginErrorRedirect(config, code, clearHeaders);
        };
        try {
            const url = new URL(request.url);
            const oauthError = url.searchParams.get('error');
            if (oauthError) {
                return fail(oauthError === 'access_denied' ? 'access_denied' : 'login_failed');
            }
            const state = url.searchParams.get('state') ?? '';
            const code = url.searchParams.get('code') ?? '';
            if (!state || !code)
                return fail('state_invalid');
            stateHashForClear = (await sha256Base64Url(state)).slice(0, 16);
            const sealedState = readCookie(request, stateCookieName(config, stateHashForClear));
            if (!sealedState)
                return fail('state_invalid');
            const payload = await decryptJson(config.sessionSecret, sealedState);
            if (!payload || payload.v !== 1 || !safeEqual(payload.state, state)) {
                return fail('state_invalid');
            }
            if (payload.expiresAt <= Math.floor(Date.now() / 1000)) {
                return fail('state_expired');
            }
            const browserNonce = readCookie(request, browserCookieName(config)) ?? '';
            if (!safeEqual(payload.browserNonce, browserNonce)) {
                return fail('state_invalid');
            }
            const resolved = await endpoints();
            const tokens = await exchangeCode(config, resolved, code, payload.verifier);
            const claims = await verifyIdToken({
                token: tokens.id_token,
                issuer: config.issuer,
                clientId: config.clientId,
                nonce: payload.nonce,
                accessToken: tokens.access_token,
                jwksUri: resolved.jwks,
                fetcher: config.fetcher,
                allowInsecureHttp: config.raw.allowInsecureHttp === true,
            });
            const userInfo = await fetchUserInfo(config, resolved, tokens.access_token);
            if (!safeEqual(userInfo.sub, claims.sub)) {
                throw new Error('userinfo sub does not match ID token sub');
            }
            if (config.requireEmail && !isNonEmptyString(userInfo.email)) {
                return fail('email_required');
            }
            const session = newSession({
                iss: config.issuer,
                sub: claims.sub,
                tenantId: claims.tenant_id,
                clientId: config.clientId,
                ...(isNonEmptyString(userInfo.email) ? { email: userInfo.email } : {}),
                ...(typeof userInfo.email_verified === 'boolean' ? { emailVerified: userInfo.email_verified } : {}),
                ttl: { absoluteSeconds: config.absoluteTtl, idleSeconds: config.idleTtl },
            });
            if (consent && !(await consent(session))) {
                return fail('consent_revoked');
            }
            // Successful path: clear the one-shot state cookies alongside the new session.
            if (stateHashForClear) {
                appendSetCookie(headers, clearCookie(stateCookieName(config, stateHashForClear), cookieOptions(config)));
            }
            appendSetCookie(headers, clearCookie(browserCookieName(config), cookieOptions(config)));
            await issueSessionCookie(config, headers, session);
            return redirect(new URL(payload.next || defaultNext(config), config.siteOrigin).toString(), headers);
        }
        catch (error) {
            reportError(config, error, 'callback');
            return fail('login_failed');
        }
    }
    async function loadSession(request) {
        const headers = new Headers();
        const raw = readSessionCookie(config, request);
        if (!raw)
            return { response: jsonResponse({ authenticated: false }, 200, headers) };
        const opened = await openSession(config.sessionSecret, raw);
        if (!opened)
            return { response: jsonResponse({ authenticated: false }, 200, headers) };
        const touched = touchSession(opened, config.idleTtl);
        if (!touched) {
            appendSetCookie(headers, clearCookie(sessionCookieNameFor(config), cookieOptions(config)));
            return { response: jsonResponse({ authenticated: false }, 200, headers) };
        }
        if (consent && !(await consent(touched))) {
            appendSetCookie(headers, clearCookie(sessionCookieNameFor(config), cookieOptions(config)));
            return { response: jsonResponse({ authenticated: false, error: 'consent_revoked' }, 200, headers) };
        }
        await issueSessionCookie(config, headers, touched);
        return { session: touched, headers };
    }
    async function session(request) {
        if (request.method !== 'GET')
            return methodNotAllowed();
        const result = await loadSession(request);
        if ('response' in result)
            return result.response;
        return jsonResponse({
            authenticated: true,
            user: {
                sub: result.session.sub,
                email: result.session.email ?? null,
                emailVerified: result.session.emailVerified ?? false,
                tenantId: result.session.tenantId,
                issuer: result.session.iss,
            },
        }, 200, result.headers);
    }
    async function logout(request) {
        if (request.method !== 'POST')
            return methodNotAllowed();
        const headers = new Headers();
        appendSetCookie(headers, clearCookie(sessionCookieNameFor(config), cookieOptions(config)));
        return jsonResponse({ ok: true }, 200, headers);
    }
    async function getUser(request) {
        const raw = readSessionCookie(config, request);
        if (!raw)
            return null;
        const opened = await openSession(config.sessionSecret, raw);
        if (!opened)
            return null;
        const touched = touchSession(opened, config.idleTtl);
        if (!touched)
            return null;
        if (consent && !(await consent(touched)))
            return null;
        return touched;
    }
    async function mintInternalToken(sessionValue) {
        const settings = config.raw.internalJwt;
        if (!settings)
            return null;
        privateKey ??= importRs256PrivateKey(settings.privateKeyPkcs8);
        const now = Math.floor(Date.now() / 1000);
        const ttl = Math.min(Math.max(settings.ttlSeconds ?? 60, 1), 60);
        const header = { alg: 'RS256', typ: 'JWT', kid: settings.kid };
        const payload = {
            iss: settings.issuer,
            sub: `${sessionValue.iss}:${sessionValue.sub}`,
            aud: settings.audience,
            tenant_id: sessionValue.tenantId,
            client_id: sessionValue.clientId,
            iat: now,
            exp: now + ttl,
            jti: base64UrlEncode(randomBytes(16)),
        };
        const signingInput = `${base64UrlEncode(utf8(JSON.stringify(header)))}.${base64UrlEncode(utf8(JSON.stringify(payload)))}`;
        const signature = await signRs256(await privateKey, utf8(signingInput));
        return `${signingInput}.${base64UrlEncode(signature)}`;
    }
    async function route(request) {
        let pathname;
        try {
            pathname = new URL(request.url).pathname.replace(/\/+$/u, '');
        }
        catch {
            return jsonResponse({ error: 'bad_request' }, 400);
        }
        if (pathname.endsWith('/login'))
            return login(request);
        if (pathname.endsWith('/callback'))
            return callback(request);
        if (pathname.endsWith('/session'))
            return session(request);
        if (pathname.endsWith('/logout'))
            return logout(request);
        return jsonResponse({ error: 'not_found' }, 404);
    }
    return { route, login, callback, session, logout, getUser, mintInternalToken };
}
// Re-export helpers used by adapters/tests without expanding the public surface too much.
export { base64UrlDecode, fromUtf8 };
