/**
 * Embedded passwordless login (no redirect, no password).
 *
 * Flow: customer page -> BFF -> Autional identity (QR / email code) -> BFF holds
 * the identity access token transiently -> records consent -> creates the BFF
 * session. The identity token never reaches the browser.
 */
import { serializeCookie, appendSetCookie } from './sdk/cookies.js';
import { newSession, sealSession, sessionCookieName } from './sdk/session.js';

const HOUR = 60 * 60;

function trimSlash(value) {
  return String(value || '').replace(/\/+$/u, '');
}

function json(body, status = 200, headers) {
  const h = headers ?? new Headers();
  h.set('content-type', 'application/json; charset=utf-8');
  h.set('cache-control', 'no-store');
  h.set('x-content-type-options', 'nosniff');
  h.set('referrer-policy', 'no-referrer');
  h.set('content-security-policy', "default-src 'none'; frame-ancestors 'none'");
  return new Response(JSON.stringify(body), { status, headers: h });
}

function decodeJwtPayload(token) {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function cookieOptions(config) {
  return {
    secure: config.secureCookies !== false,
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
  };
}

function base(config) {
  return trimSlash(config.identityApi);
}

async function identityFetch(config, path, init = {}) {
  const res = await fetch(`${base(config)}${path}`, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(10000),
  });
  const body = await res.json().catch(() => null);
  return { res, body };
}

async function identityMe(config, token, tenantId) {
  const { res, body } = await identityFetch(config, '/identity/api/v1/auth/me', {
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
      'x-tenant-id': tenantId,
    },
  });
  if (res.status !== 200 || body?.code !== 0) return null;
  return body.data || null;
}

async function recordConsent(config, userId, tenantId) {
  const res = await fetch(config.consentCreateUrl, {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-api-key': config.internalApiKey,
      'x-tenant-id': tenantId,
    },
    body: JSON.stringify({
      user_id: userId,
      client_id: config.clientId,
      scopes: config.embedScopes || ['openid', 'email'],
    }),
  });
  const body = await res.json().catch(() => null);
  if (res.status !== 200 || body?.code !== 0) {
    throw new Error(`consent record failed: HTTP ${res.status}`);
  }
}

async function sessionResponse(config, token, emailHint) {
  const claims = decodeJwtPayload(token);
  const tenantId = claims?.tenant_id;
  if (!tenantId) throw new Error('identity token has no tenant_id');
  const me = await identityMe(config, token, tenantId);
  if (!me?.id) throw new Error('identity /me failed');
  await recordConsent(config, me.id, tenantId);
  const session = newSession({
    iss: config.issuer,
    sub: me.id,
    tenantId,
    clientId: config.clientId,
    ...(me.email || emailHint ? { email: me.email || emailHint } : {}),
    ttl: {
      absoluteSeconds: config.sessionAbsoluteTtlSeconds ?? 8 * HOUR,
      idleSeconds: config.sessionIdleTtlSeconds ?? 30 * 60,
    },
  });
  const sealed = await sealSession(config.sessionSecret, session);
  const headers = new Headers();
  appendSetCookie(
    headers,
    serializeCookie(sessionCookieName(config.cookiePrefix || '__Host-ai'), sealed, cookieOptions(config)),
  );
  return {
    response: json(
      {
        user: {
          sub: session.sub,
          email: session.email ?? null,
          tenantId: session.tenantId,
        },
      },
      200,
      headers,
    ),
  };
}

export function createEmbedHandlers(config) {
  async function sendEmail(request) {
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    const body = await request.json().catch(() => null);
    const email = String(body?.email || '').trim();
    if (!email) return json({ error: 'email_required' }, 400);
    const { res, body: rb } = await identityFetch(config, '/identity/api/v1/auth/send-verification-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ email, tenant_id: config.identityTenantId }),
    });
    if (res.status !== 200 || rb?.code !== 0) return json({ error: 'send_failed' }, 502);
    return json({ ok: true });
  }

  async function loginEmail(request) {
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    const body = await request.json().catch(() => null);
    const email = String(body?.email || '').trim();
    const code = String(body?.code || '').trim();
    if (!email || !/^\d{6}$/u.test(code)) return json({ error: 'invalid_input' }, 400);
    const { res, body: rb } = await identityFetch(config, '/identity/api/v1/auth/login/email-code', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ email, code, tenant_id: config.identityTenantId }),
    });
    if (res.status !== 200 || rb?.code !== 0) {
      if (rb?.data?.requires_mfa || rb?.requires_mfa) return json({ error: 'mfa_required' }, 401);
      return json({ error: 'login_failed' }, 401);
    }
    const token = rb?.data?.access_token;
    if (!token) return json({ error: 'login_failed' }, 502);
    try {
      return (await sessionResponse(config, token, rb?.data?.user?.email || email)).response;
    } catch (error) {
      console.error(`[ai-bff] embed email session: ${error instanceof Error ? error.message : String(error)}`);
      return json({ error: 'login_failed' }, 502);
    }
  }

  async function qrInitiate(request) {
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    const { res, body } = await identityFetch(config, '/identity/api/v1/auth/qr-login/initiate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ tenant_id: config.identityTenantId }),
    });
    if (res.status !== 200 || body?.code !== 0) return json({ error: 'qr_initiate_failed' }, 502);
    const d = body.data || {};
    return json({
      sessionToken: d.session_token,
      numberMatching: d.number_matching,
      expiresIn: d.expires_in ?? 300,
    });
  }

  async function qrStatus(request) {
    if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
    const url = new URL(request.url);
    const token = url.searchParams.get('token') || '';
    if (!token) return json({ error: 'token_required' }, 400);
    const { res, body } = await identityFetch(
      config,
      `/identity/api/v1/auth/qr-login/status?token=${encodeURIComponent(token)}`,
      { headers: { accept: 'application/json' } },
    );
    if (res.status !== 200 || body?.code !== 0) return json({ error: 'qr_status_failed' }, 502);
    const d = body.data || {};
    const status = String(d.status || 'pending');
    const out = {
      status,
      numberMatching: d.number_matching,
      superseded: d.superseded === true,
    };
    if (status === 'confirmed') {
      if (!d.access_token) return json({ ...out, status: 'no_token' });
      try {
        const result = await sessionResponse(config, d.access_token, d.user?.email);
        const payload = await result.response.json();
        const headers = result.response.headers;
        const h = new Headers(headers);
        h.set('content-type', 'application/json; charset=utf-8');
        return new Response(JSON.stringify({ ...out, user: payload.user }), { status: 200, headers: h });
      } catch (error) {
        console.error(`[ai-bff] embed qr session: ${error instanceof Error ? error.message : String(error)}`);
        return json({ error: 'login_failed' }, 502);
      }
    }
    return json(out);
  }

  async function qrRevoke(request) {
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    const body = await request.json().catch(() => null);
    const token = String(body?.token || '');
    if (token) {
      await identityFetch(config, '/identity/api/v1/auth/qr-login/revoke', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ token }),
      }).catch(() => {});
    }
    return json({ ok: true });
  }

  return { sendEmail, loginEmail, qrInitiate, qrStatus, qrRevoke };
}
