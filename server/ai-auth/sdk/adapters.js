/**
 * Runtime adapters.
 *
 * - Cloudflare Workers / Vercel Edge: the Web `Request`/`Response` handler is
 *   used directly.
 * - Node (including Vercel Node functions): convert IncomingMessage/ServerResponse
 *   to/from the Web standard objects.
 */
/** Cloudflare Workers `export default { fetch }`. */
export function createCloudflareHandler(auth) {
    return { fetch: (request) => auth.route(request) };
}
/** Vercel Edge / Next.js App Router `export default`. */
export function createVercelEdgeHandler(auth) {
    return (request) => auth.route(request);
}
function headerValue(value) {
    if (Array.isArray(value))
        return value.join(', ');
    return value;
}
function requestUrl(request) {
    const host = headerValue(request.headers['x-forwarded-host']) ?? headerValue(request.headers.host) ?? 'localhost';
    const proto = headerValue(request.headers['x-forwarded-proto']) ?? 'https';
    const path = request.url ?? '/';
    return `${proto}://${host}${path.startsWith('/') ? path : `/${path}`}`;
}
async function readBody(request) {
    const method = (request.method ?? 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD')
        return undefined;
    const chunks = [];
    for await (const chunk of request)
        chunks.push(chunk);
    if (chunks.length === 0)
        return undefined;
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
    }
    return out;
}
/** Vercel Node runtime / plain Node `(req, res)` handler. */
export function createNodeHandler(auth) {
    return async (req, res) => {
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
            if (value === undefined || key.toLowerCase() === 'set-cookie')
                continue;
            const joined = headerValue(value);
            if (joined !== undefined)
                headers.set(key, joined);
        }
        const body = await readBody(req);
        const request = new Request(requestUrl(req), {
            method: req.method ?? 'GET',
            headers,
            ...(body ? { body: body } : {}),
        });
        const response = await auth.route(request);
        res.statusCode = response.status;
        response.headers.forEach((value, key) => {
            if (key.toLowerCase() === 'set-cookie')
                return;
            res.setHeader(key, value);
        });
        const setCookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
        if (setCookies.length > 0)
            res.setHeader('set-cookie', setCookies);
        const arrayBuffer = await response.arrayBuffer();
        res.end(new Uint8Array(arrayBuffer));
    };
}
