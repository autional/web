/**
 * Production BFF config for www.autional.cn / www.autional.com `/ai` login.
 *
 * Every value comes from the Vercel project environment. Missing required
 * values fail closed (the function returns 500 instead of starting a flow
 * with a partial configuration). See docs/AI-LOGIN-BFF.md §7.
 */
import { createAiAuth } from './sdk/index.js';

function env(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') throw new Error(`missing env ${name}`);
  return value.trim();
}

function optionalEnv(name) {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : undefined;
}

const allowlist = env('AI_OAUTH_ENDPOINT_ALLOWLIST')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

// B6 强依赖：缺失即配置失败（函数 500），不允许静默关闭撤销检查。
const consentEndpoint = env('AI_CONSENT_STATUS_URL');
const consentKey = env('AI_INTERNAL_API_KEY');

const internalKey = optionalEnv('AI_INTERNAL_JWT_PRIVATE_KEY');

const config = {
  issuer: env('AI_OAUTH_ISSUER'),
  clientId: env('AI_OAUTH_CLIENT_ID'),
  clientSecret: env('AI_OAUTH_CLIENT_SECRET'),
  redirectUri: env('AI_OAUTH_REDIRECT_URI'),
  resource: env('AI_RESOURCE'),
  scopes: ['openid', 'email'],
  endpointAllowlist: allowlist,
  sessionSecret: env('AI_SESSION_SECRET'),
  cookiePrefix: '__Host-ai',
  secureCookies: true,
  allowedNextPrefixes: ['/ai'],
  consentStatus: {
    endpoint: consentEndpoint,
    apiKey: consentKey,
    cacheTtlSeconds: 60,
  },
  ...(internalKey
    ? {
        internalJwt: {
          issuer: env('AI_INTERNAL_JWT_ISSUER'),
          audience: env('AI_INTERNAL_JWT_AUDIENCE'),
          privateKeyPkcs8: internalKey.replace(/\\n/gu, '\n'),
          kid: env('AI_INTERNAL_JWT_KID'),
          ttlSeconds: 60,
        },
      }
    : {}),
};

export const auth = createAiAuth(config, {
  onError(error, context) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ai-auth] ${context}: ${message}`);
  },
});
