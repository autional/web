/**
 * OIDC discovery, endpoint allowlisting and ID Token verification.
 *
 * All network failures are fail-closed: a login cannot proceed on partial
 * discovery data, an unlisted endpoint, a non-RS256 token or a bad nonce.
 */
import { base64UrlDecode, base64UrlEncode, fromUtf8, sha256, verifyRs256 } from './crypto.js';
const DISCOVERY_TTL_MS = 60 * 60 * 1000;
const JWKS_TTL_MS = 10 * 60 * 1000;
const CLOCK_LEEWAY_SECONDS = 60;
export class OidcError extends Error {
    constructor(message) {
        super(message);
        this.name = 'OidcError';
    }
}
function trimSlash(value) {
    return value.replace(/\/+$/u, '');
}
function parseHttpsUrl(value, allowInsecure) {
    let url;
    try {
        url = new URL(value);
    }
    catch {
        throw new OidcError(`invalid endpoint URL: ${value}`);
    }
    if (url.username || url.password || url.hash) {
        throw new OidcError(`endpoint URL must not contain userinfo/fragment: ${value}`);
    }
    if (url.protocol !== 'https:' && !(allowInsecure && url.protocol === 'http:')) {
        throw new OidcError(`endpoint must use https: ${value}`);
    }
    return url;
}
function normalizeEndpoint(value) {
    return trimSlash(value);
}
function assertAllowed(endpoint, allowlist, allowInsecure) {
    const url = parseHttpsUrl(endpoint, allowInsecure);
    if (!allowlist || allowlist.length === 0) {
        // Discovery-derived endpoints without an explicit allowlist are only
        // accepted when they share the issuer origin (still exact-match below).
        return;
    }
    const normalized = normalizeEndpoint(endpoint);
    const ok = allowlist.some((entry) => normalizeEndpoint(entry) === normalized);
    if (!ok)
        throw new OidcError(`endpoint is not in allowlist: ${url.origin}${url.pathname}`);
}
export function createEndpointResolver(config) {
    const fetcher = config.fetch ?? fetch;
    const allowInsecure = config.allowInsecureHttp === true;
    let cached = null;
    let inflight = null;
    const validate = (value) => {
        const urls = [value.authorize, value.token, value.userinfo, value.jwks];
        for (const item of urls)
            assertAllowed(item, config.endpointAllowlist, allowInsecure);
        if (!config.endpointAllowlist || config.endpointAllowlist.length === 0) {
            const issuerOrigin = new URL(config.issuer).origin;
            for (const item of urls) {
                const origin = new URL(item).origin;
                if (origin !== issuerOrigin) {
                    throw new OidcError(`endpoint origin must equal issuer origin when no allowlist is set: ${origin}`);
                }
            }
        }
        return value;
    };
    return async () => {
        if (cached && cached.expiresAt > Date.now())
            return cached.value;
        if (inflight)
            return inflight;
        inflight = (async () => {
            try {
                let value;
                if (config.endpoints) {
                    value = config.endpoints;
                }
                else {
                    const discoveryUrl = `${trimSlash(config.issuer)}/.well-known/openid-configuration`;
                    const response = await fetcher(discoveryUrl, { headers: { accept: 'application/json' } });
                    if (!response.ok)
                        throw new OidcError(`discovery failed: HTTP ${response.status}`);
                    const doc = (await response.json());
                    if (trimSlash(doc.issuer ?? '') !== trimSlash(config.issuer)) {
                        throw new OidcError('discovery issuer mismatch');
                    }
                    if (!doc.authorization_endpoint || !doc.token_endpoint || !doc.userinfo_endpoint || !doc.jwks_uri) {
                        throw new OidcError('discovery document is missing required endpoints');
                    }
                    value = {
                        authorize: doc.authorization_endpoint,
                        token: doc.token_endpoint,
                        userinfo: doc.userinfo_endpoint,
                        jwks: doc.jwks_uri,
                    };
                }
                const validated = validate(value);
                cached = { value: validated, expiresAt: Date.now() + DISCOVERY_TTL_MS };
                return validated;
            }
            finally {
                inflight = null;
            }
        })();
        return inflight;
    };
}
let jwksCache = null;
/** Test hook: clears the process-wide JWKS cache. */
export function clearOidcCache() {
    jwksCache = null;
}
async function loadJwks(uri, fetcher, allowInsecure) {
    parseHttpsUrl(uri, allowInsecure);
    if (jwksCache && jwksCache.uri === uri && jwksCache.expiresAt > Date.now())
        return jwksCache.keys;
    const response = await fetcher(uri, { headers: { accept: 'application/json' } });
    if (!response.ok)
        throw new OidcError(`JWKS fetch failed: HTTP ${response.status}`);
    const doc = (await response.json());
    if (!Array.isArray(doc.keys) || doc.keys.length === 0)
        throw new OidcError('JWKS contains no keys');
    jwksCache = { uri, keys: doc.keys, expiresAt: Date.now() + JWKS_TTL_MS };
    return doc.keys;
}
function decodeSegment(segment) {
    try {
        return JSON.parse(fromUtf8(base64UrlDecode(segment)));
    }
    catch {
        throw new OidcError('malformed JWT segment');
    }
}
export async function verifyIdToken(options) {
    const parts = options.token.split('.');
    if (parts.length !== 3)
        throw new OidcError('ID token is not a JWT');
    const [headerB64, payloadB64, signatureB64] = parts;
    const header = decodeSegment(headerB64);
    if (header.alg !== 'RS256')
        throw new OidcError('ID token alg must be RS256');
    const kid = typeof header.kid === 'string' ? header.kid : '';
    if (!kid)
        throw new OidcError('ID token is missing kid');
    const keys = await loadJwks(options.jwksUri, options.fetcher, options.allowInsecureHttp);
    const jwk = keys.find((key) => key.kid === kid && (key.alg === undefined || key.alg === 'RS256'));
    if (!jwk)
        throw new OidcError('no matching JWKS key for ID token kid');
    const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlDecode(signatureB64);
    if (!(await verifyRs256(jwk, signingInput, signature))) {
        throw new OidcError('ID token signature verification failed');
    }
    const claims = decodeSegment(payloadB64);
    const now = Math.floor(Date.now() / 1000);
    if (trimSlash(String(claims.iss ?? '')) !== trimSlash(options.issuer)) {
        throw new OidcError('ID token issuer mismatch');
    }
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(options.clientId))
        throw new OidcError('ID token audience mismatch');
    if (audiences.length > 1 && claims.azp !== options.clientId) {
        throw new OidcError('ID token azp mismatch');
    }
    if (typeof claims.exp !== 'number' || claims.exp + CLOCK_LEEWAY_SECONDS < now) {
        throw new OidcError('ID token is expired');
    }
    if (typeof claims.iat !== 'number' || claims.iat > now + CLOCK_LEEWAY_SECONDS) {
        throw new OidcError('ID token iat is invalid');
    }
    if (!claims.nonce || !safeNonce(claims.nonce, options.nonce)) {
        throw new OidcError('ID token nonce mismatch');
    }
    if (typeof claims.sub !== 'string' || claims.sub === '')
        throw new OidcError('ID token is missing sub');
    if (typeof claims.tenant_id !== 'string' || claims.tenant_id === '') {
        throw new OidcError('ID token is missing tenant_id');
    }
    const atHash = claims.at_hash;
    if (typeof atHash === 'string' && atHash !== '') {
        if (!options.accessToken)
            throw new OidcError('ID token has at_hash but no access token was provided');
        const digest = await sha256(new TextEncoder().encode(options.accessToken));
        const expected = base64UrlEncode(digest.slice(0, digest.length / 2));
        if (!safeNonce(expected, atHash))
            throw new OidcError('ID token at_hash mismatch');
    }
    return claims;
}
function safeNonce(a, b) {
    if (a.length !== b.length)
        return false;
    let diff = 0;
    for (let i = 0; i < a.length; i += 1)
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}
/** PKCE S256 code challenge. */
export async function pkceChallenge(verifier) {
    const digest = await sha256(new TextEncoder().encode(verifier));
    let binary = '';
    for (const byte of digest)
        binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}
