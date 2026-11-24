/** Cookie parsing/serialization with `__Host-` defaults. */
export function readCookie(request, name) {
    const header = request.headers.get('cookie');
    if (!header)
        return null;
    for (const part of header.split(';')) {
        const eq = part.indexOf('=');
        if (eq < 0)
            continue;
        const key = part.slice(0, eq).trim();
        if (key !== name)
            continue;
        return part.slice(eq + 1).trim();
    }
    return null;
}
export function serializeCookie(name, value, options = {}) {
    const parts = [`${name}=${value}`];
    parts.push(`Path=${options.path ?? '/'}`);
    if (options.maxAgeSeconds !== undefined)
        parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`);
    if (options.httpOnly !== false)
        parts.push('HttpOnly');
    if (options.secure !== false)
        parts.push('Secure');
    parts.push(`SameSite=${options.sameSite ?? 'Lax'}`);
    return parts.join('; ');
}
export function clearCookie(name, options = {}) {
    return serializeCookie(name, '', { ...options, maxAgeSeconds: 0 });
}
/** Append without dropping an existing Set-Cookie header. */
export function appendSetCookie(headers, cookie) {
    headers.append('Set-Cookie', cookie);
}
