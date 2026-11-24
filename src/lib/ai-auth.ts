/**
 * Autional AI 登录客户端。
 *
 * 两种传输：
 * - bff（生产默认）：浏览器只与同源 /api/auth/* 通信；身份令牌留在 BFF，
 *   浏览器只拿 HttpOnly 会话 Cookie。契约见 docs/AI-LOGIN-BFF.md。
 * - direct（仅本地预览）：浏览器直连身份 API；令牌只存 sessionStorage，
 *   关闭标签即失效。生产禁止使用。
 *
 * 为什么默认 bff：identity access token 是平台级 bearer（aud = 平台 API），
 * 不是按 portal 隔离的。客户前端不应持有它。
 *
 * 扫码/邮箱码的协议与状态机参考站内既有实现：
 * - shared/service-identity/internal/handler/qr_login_handler.go
 * - deploy-sync/auth/apps/auth-pages/src/components/auth/QRLoginPanel.tsx
 */

import { SITE_ROOT_DOMAIN } from './site-env';

const env = import.meta.env as unknown as {
  DEV?: boolean;
  PUBLIC_AUTIONAL_TENANT_ID?: string;
  PUBLIC_AUTIONAL_API_URL?: string;
  PUBLIC_AUTHENTICATOR_URL?: string;
  PUBLIC_AUTH_PORTAL_URL?: string;
  PUBLIC_AI_AUTH_MODE?: string;
};

const isDev = Boolean(env.DEV);

/** AI 空间的租户 ULID。空串 → 使用 public auth-config/default。 */
export const AI_TENANT_ID = (env.PUBLIC_AUTIONAL_TENANT_ID ?? '').trim();

/**
 * direct 模式的 API 基址。
 * dev 走 Vite 代理 /bff（见 astro.config.mjs）；生产走同域网关。
 * 网关 CORS 已放行 *.autional.cn / *.autional.com。
 */
export const AI_API_URL = (
  isDev ? '/bff' : (env.PUBLIC_AUTIONAL_API_URL ?? `https://api.${SITE_ROOT_DOMAIN}/bff`)
).replace(/\/$/, '');

export const AUTHENTICATOR_URL = (
  env.PUBLIC_AUTHENTICATOR_URL ?? `https://authenticator.${SITE_ROOT_DOMAIN}`
).replace(/\/$/, '');

export const AUTH_PORTAL_URL = (
  env.PUBLIC_AUTH_PORTAL_URL ?? `https://auth.${SITE_ROOT_DOMAIN}`
).replace(/\/$/, '');

export type AuthMode = 'oauth' | 'bff' | 'direct';

/**
 * oauth = 生产默认：同源 /api/auth/login → 平台 OAuth（PKCE）→ BFF 会话。
 * bff   = 旧预览（QR/邮箱码直连 BFF，未实现服务端）；direct = 仅本地预览。
 * 显式 PUBLIC_AI_AUTH_MODE 可覆盖；dev 默认 direct（无服务端运行时）。
 */
export const AUTH_MODE: AuthMode =
  env.PUBLIC_AI_AUTH_MODE === 'oauth' ||
  env.PUBLIC_AI_AUTH_MODE === 'bff' ||
  env.PUBLIC_AI_AUTH_MODE === 'direct'
    ? env.PUBLIC_AI_AUTH_MODE
    : isDev
      ? 'direct'
      : 'oauth';

export const IS_DIRECT_PREVIEW = AUTH_MODE === 'direct';
export const IS_OAUTH = AUTH_MODE === 'oauth';

/* ------------------------------------------------------------------ */
/* 类型                                                                */
/* ------------------------------------------------------------------ */

export type AuthMethod = 'password' | 'qr' | 'magic_link' | 'passkey' | 'email_code' | 'phone_code';

export interface AuthConfig {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  methods: AuthMethod[];
}

export interface QrSession {
  sessionToken: string;
  numberMatching: string;
  expiresIn: number;
}

export type QrStatusValue = 'pending' | 'scanned' | 'confirmed' | 'cancelled' | 'expired';

export interface QrPollResult {
  status: QrStatusValue;
  numberMatching?: string;
  superseded?: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  /** bff 模式下由 BFF 在 confirmed 时返回（令牌不经过浏览器）。 */
  user?: SessionUser;
}

export interface SessionUser {
  id: string;
  email?: string;
  tenantId?: string;
}

export interface SessionInfo {
  user: SessionUser;
}

export interface LoginApi {
  initiate(): Promise<QrSession>;
  status(sessionToken: string): Promise<QrPollResult>;
  revoke(sessionToken: string): Promise<void>;
  sendEmailCode(email: string): Promise<void>;
  loginEmailCode(email: string, code: string): Promise<{ user?: SessionUser }>;
  getSession(): Promise<SessionInfo | null>;
  logout(): Promise<void>;
}

/** 生产 OAuth 登录入口（同源 BFF）。 */
export function oauthLoginUrl(next: string): string {
  const safe = /^\/(?!\/)/.test(next) && !next.startsWith('/ai/login') ? next : '/ai/';
  return `/api/auth/login?next=${encodeURIComponent(safe)}`;
}

/* ------------------------------------------------------------------ */
/* 错误                                                                */
/* ------------------------------------------------------------------ */

export class AiAuthError extends Error {
  constructor(
    message: string,
    readonly code = 'unknown',
    readonly status = 0,
  ) {
    super(message);
    this.name = 'AiAuthError';
  }
}

export function isNotRegistered(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = err instanceof AiAuthError ? err.code : '';
  return /can_register|user.*not.*found|not registered/i.test(`${err.message} ${code}`);
}

function describeCode(code: string): string {
  if (code === '61000905') return 'tenant_mismatch';
  return code;
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    // 网关跨源 allow_credentials=false：同源只用于 BFF Cookie，跨源不带凭据。
    res = await fetch(url, { ...init, cache: 'no-store', credentials: 'same-origin' });
  } catch {
    throw new AiAuthError('network', 'network');
  }

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  const body = (json ?? {}) as Record<string, unknown>;

  if (!res.ok) {
    throw new AiAuthError(
      String(body.message ?? body.error_description ?? body.detail ?? res.statusText ?? 'request failed'),
      describeCode(String(body.code ?? body.error ?? res.status)),
      res.status,
    );
  }
  if (typeof body.code === 'number' && body.code !== 0) {
    throw new AiAuthError(
      String(body.message ?? 'request failed'),
      describeCode(String(body.code)),
      res.status,
    );
  }
  return (body.data ?? body) as T;
}

/* ------------------------------------------------------------------ */
/* 公开配置                                                            */
/* ------------------------------------------------------------------ */

export async function fetchAuthConfig(): Promise<AuthConfig> {
  const data = await request<Record<string, unknown>>(
    `${AI_API_URL}/identity/api/v1/public/auth-config/${encodeURIComponent(AI_TENANT_ID || 'default')}`,
  );
  const methods = Array.isArray(data.login_methods)
    ? data.login_methods.filter((m): m is AuthMethod => typeof m === 'string')
    : [];
  return {
    tenantId: String(data.tenant_id ?? AI_TENANT_ID),
    tenantSlug: String(data.tenant_name ?? ''),
    tenantName: String(data.display_name ?? data.tenant_name ?? ''),
    methods: methods.length ? methods : ['password'],
  };
}

/** 二维码内容：认证器 App 的审批页（与站内 auth 门户同协议）。 */
export function qrApprovalUrl(session: QrSession): string {
  return `${AUTHENTICATOR_URL}/login-approve?token=${encodeURIComponent(session.sessionToken)}&nm=${encodeURIComponent(session.numberMatching)}`;
}

/** Autional 登录/注册入口（OAuth/密码等“其他方式”）。 */
export function portalLoginUrl(tenantSlug?: string): string {
  return tenantSlug ? `${AUTH_PORTAL_URL}/${encodeURIComponent(tenantSlug)}/login` : `${AUTH_PORTAL_URL}/`;
}

export function portalRegisterUrl(tenantSlug?: string): string {
  return tenantSlug ? `${AUTH_PORTAL_URL}/${encodeURIComponent(tenantSlug)}/register` : `${AUTH_PORTAL_URL}/`;
}

/* ------------------------------------------------------------------ */
/* direct：浏览器直连（仅预览）                                        */
/* ------------------------------------------------------------------ */

const DIRECT_SESSION_KEY = 'autional-ai-session';

interface StoredDirectSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: SessionUser;
}

function directStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function decodeJwtClaims(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(decodeURIComponent(
      atob(padded).split('').map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`).join(''),
    )) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function userFromClaims(claims: Record<string, unknown> | null): SessionUser {
  return {
    id: String(claims?.sub ?? claims?.user_id ?? ''),
    email: typeof claims?.email === 'string' ? claims.email : undefined,
    tenantId: typeof claims?.tenant_id === 'string' ? claims.tenant_id : undefined,
  };
}

function readStoredDirect(): StoredDirectSession | null {
  try {
    const raw = directStorage()?.getItem(DIRECT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDirectSession;
    if (!parsed?.accessToken || !parsed?.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredDirect(session: StoredDirectSession): void {
  try {
    directStorage()?.setItem(DIRECT_SESSION_KEY, JSON.stringify(session));
  } catch {
    /* 配额/隐私模式：本次内存态仍可继续 */
  }
}

function clearStoredDirect(): void {
  try {
    directStorage()?.removeItem(DIRECT_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** direct 模式：采纳身份令牌（仅 sessionStorage，关闭标签即失效）。 */
export function adoptDirectTokens(tokens: {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}): SessionUser {
  const user = userFromClaims(decodeJwtClaims(tokens.accessToken));
  writeStoredDirect({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken ?? '',
    expiresAt: Date.now() + (tokens.expiresIn ?? 300) * 1000,
    user,
  });
  return user;
}

async function refreshDirectSession(): Promise<SessionInfo | null> {
  const stored = readStoredDirect();
  if (!stored?.refreshToken) return null;
  try {
    const data = await request<Record<string, unknown>>(`${AI_API_URL}/identity/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: stored.refreshToken }),
    });
    const accessToken = String(data.access_token ?? '');
    if (!accessToken) return null;
    const user = adoptDirectTokens({
      accessToken,
      refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : stored.refreshToken,
      expiresIn: Number(data.expires_in ?? 300),
    });
    return { user };
  } catch {
    clearStoredDirect();
    return null;
  }
}

async function getDirectSession(): Promise<SessionInfo | null> {
  const stored = readStoredDirect();
  if (stored && stored.expiresAt > Date.now() + 5_000) return { user: stored.user };
  return refreshDirectSession();
}

const directApi: LoginApi = {
  async initiate() {
    const data = await request<Record<string, unknown>>(
      `${AI_API_URL}/identity/api/v1/auth/qr-login/initiate`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenant_id: AI_TENANT_ID || 'default' }),
      },
    );
    return {
      sessionToken: String(data.session_token ?? ''),
      numberMatching: String(data.number_matching ?? ''),
      expiresIn: Number(data.expires_in ?? 300),
    };
  },

  async status(sessionToken) {
    const data = await request<Record<string, unknown>>(
      `${AI_API_URL}/identity/api/v1/auth/qr-login/status?token=${encodeURIComponent(sessionToken)}`,
    );
    return {
      status: String(data.status ?? 'pending') as QrStatusValue,
      numberMatching: typeof data.number_matching === 'string' ? data.number_matching : undefined,
      superseded: data.superseded === true,
      accessToken: typeof data.access_token === 'string' ? data.access_token : undefined,
      refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : undefined,
      expiresIn: typeof data.expires_in === 'number' ? data.expires_in : undefined,
    };
  },

  async revoke(sessionToken) {
    await request(`${AI_API_URL}/identity/api/v1/auth/qr-login/revoke`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: sessionToken }),
    });
  },

  async sendEmailCode(email) {
    await request(`${AI_API_URL}/identity/api/v1/auth/send-verification-email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, tenant_id: AI_TENANT_ID || 'default' }),
    });
  },

  async loginEmailCode(email, code) {
    const data = await request<Record<string, unknown>>(
      `${AI_API_URL}/identity/api/v1/auth/login/email-code`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, code, tenant_id: AI_TENANT_ID || 'default' }),
      },
    );
    const accessToken = String(data.access_token ?? '');
    if (!accessToken) throw new AiAuthError('登录响应缺少令牌', 'no_token');
    const user = adoptDirectTokens({
      accessToken,
      refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : undefined,
      expiresIn: Number(data.expires_in ?? 300),
    });
    return { user };
  },

  getSession: getDirectSession,

  async logout() {
    const stored = readStoredDirect();
    if (stored) {
      // 尽力撤销服务端会话；失败不阻断本地清理。
      void request(`${AI_API_URL}/identity/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${stored.accessToken}`,
        },
        body: JSON.stringify({ refresh_token: stored.refreshToken }),
      }).catch(() => {});
    }
    clearStoredDirect();
  },
};

/* ------------------------------------------------------------------ */
/* bff：同源服务端会话（生产默认）                                     */
/* ------------------------------------------------------------------ */

function normalizeUser(raw: unknown): SessionUser | null {
  if (!raw || typeof raw !== 'object') return null;
  const u = raw as Record<string, unknown>;
  const id = String(u.id ?? u.user_id ?? u.sub ?? '');
  if (!id) return null;
  return {
    id,
    email: typeof u.email === 'string' ? u.email : undefined,
    tenantId: typeof u.tenant_id === 'string' ? u.tenant_id : undefined,
  };
}

const bffApi: LoginApi = {
  async initiate() {
    const data = await request<Record<string, unknown>>('/api/auth/qr/initiate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    return {
      sessionToken: String(data.sessionToken ?? data.session_token ?? ''),
      numberMatching: String(data.numberMatching ?? data.number_matching ?? ''),
      expiresIn: Number(data.expiresIn ?? data.expires_in ?? 300),
    };
  },

  async status(sessionToken) {
    const data = await request<Record<string, unknown>>(
      `/api/auth/qr/status?token=${encodeURIComponent(sessionToken)}`,
    );
    return {
      status: String(data.status ?? 'pending') as QrStatusValue,
      numberMatching:
        typeof data.numberMatching === 'string'
          ? data.numberMatching
          : typeof data.number_matching === 'string'
            ? data.number_matching
            : undefined,
      superseded: data.superseded === true,
      user: normalizeUser(data.user) ?? undefined,
    };
  },

  async revoke(sessionToken) {
    await request('/api/auth/qr/revoke', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: sessionToken }),
    });
  },

  async sendEmailCode(email) {
    await request('/api/auth/email/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    });
  },

  async loginEmailCode(email, code) {
    const data = await request<Record<string, unknown>>('/api/auth/email/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    return { user: normalizeUser(data.user) ?? undefined };
  },

  async getSession() {
    try {
      const data = await request<Record<string, unknown>>('/api/auth/session');
      const user = normalizeUser(data.user);
      return user ? { user } : null;
    } catch {
      return null;
    }
  },

  async logout() {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch {
      /* 本地仍回到未登录态 */
    }
  },
};

/* ------------------------------------------------------------------ */
/* oauth：生产 BFF（OAuth Code + PKCE）                                */
/* ------------------------------------------------------------------ */

const oauthApi: LoginApi = {
  async initiate() {
    throw new AiAuthError('oauth mode does not expose QR initiate', 'unsupported');
  },
  async status() {
    throw new AiAuthError('oauth mode does not expose QR status', 'unsupported');
  },
  async revoke() {
    /* no-op：OAuth 模式没有浏览器侧二维码会话 */
  },
  async sendEmailCode() {
    throw new AiAuthError('oauth mode does not expose email codes', 'unsupported');
  },
  async loginEmailCode() {
    throw new AiAuthError('oauth mode does not expose email codes', 'unsupported');
  },
  async getSession() {
    try {
      const data = await request<Record<string, unknown>>('/api/auth/session');
      if (data.authenticated !== true) return null;
      const user = normalizeUser(data.user);
      return user ? { user } : null;
    } catch {
      return null;
    }
  },
  async logout() {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch {
      /* 会话已失效也回到未登录态 */
    }
  },
};

export const authApi: LoginApi = AUTH_MODE === 'oauth' ? oauthApi : AUTH_MODE === 'direct' ? directApi : bffApi;
