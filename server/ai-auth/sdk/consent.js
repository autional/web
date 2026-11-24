/**
 * Consent revocation check (B6).
 *
 * The platform's `GET /internal/oauth/consent-status` reflects the consent row's
 * soft-delete state. Any failure — network, HTTP, malformed body, `active !== true`
 * — is treated as revoked (fail-closed). Active results are cached for a short
 * TTL (default 60s), which bounds revocation propagation to ≤5 minutes together
 * with the session check interval.
 */
const memoryCache = new Map();
function cacheKey(session) {
    return `${session.iss}|${session.tenantId}|${session.sub}|${session.clientId}`;
}
function parseStatus(body) {
    if (!body || typeof body !== 'object')
        return null;
    const root = body;
    const data = (root.data && typeof root.data === 'object' ? root.data : root);
    if (typeof data.active !== 'boolean')
        return null;
    return {
        active: data.active,
        granted_at: typeof data.granted_at === 'string' ? data.granted_at : undefined,
        epoch: typeof data.epoch === 'number' ? data.epoch : undefined,
    };
}
export function createConsentChecker(config) {
    const settings = config.consentStatus;
    if (!settings)
        return null;
    const fetcher = config.fetch ?? fetch;
    const cacheTtlMs = Math.max(0, (settings.cacheTtlSeconds ?? 60) * 1000);
    return async (session) => {
        const key = cacheKey(session);
        const now = Date.now();
        const cached = memoryCache.get(key);
        if (cached && cached.expiresAt > now)
            return cached.active;
        if (settings.cache) {
            try {
                const shared = await settings.cache.get(key);
                if (shared === '1') {
                    if (cacheTtlMs > 0)
                        memoryCache.set(key, { active: true, expiresAt: now + cacheTtlMs });
                    return true;
                }
            }
            catch {
                // Shared-cache read failure falls through to the authoritative check.
            }
        }
        let active = false;
        try {
            const url = new URL(settings.endpoint);
            url.searchParams.set('user_id', session.sub);
            url.searchParams.set('client_id', session.clientId);
            const response = await fetcher(url.toString(), {
                headers: {
                    accept: 'application/json',
                    'x-api-key': settings.apiKey,
                    'x-tenant-id': session.tenantId,
                },
            });
            if (response.ok) {
                const status = parseStatus(await response.json());
                active = status?.active === true;
            }
        }
        catch {
            active = false;
        }
        if (cacheTtlMs > 0 && active) {
            memoryCache.set(key, { active, expiresAt: now + cacheTtlMs });
            if (settings.cache) {
                try {
                    await settings.cache.set(key, '1', Math.floor(cacheTtlMs / 1000));
                }
                catch {
                    // Shared-cache write failure must not turn a valid session invalid.
                }
            }
        }
        else if (!active) {
            memoryCache.delete(key);
        }
        return active;
    };
}
/** Test hook: clears the in-process cache. */
export function clearConsentCache() {
    memoryCache.clear();
}
