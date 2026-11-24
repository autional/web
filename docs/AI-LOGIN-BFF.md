# AI 登录 BFF 接入契约

> 目标：`/ai` 下的网页登录不出现密码；浏览器不持有 identity 令牌。
> 前端实现：`src/components/ai-login/*`、`src/lib/ai-auth.ts`。
> 生产默认 `PUBLIC_AI_AUTH_MODE=bff`（未配置时生产也是 bff）。

## 0. 生产口径（2026-11-23 用户确认）

AI 站只需要「登录 + 读取少量授权个人信息」，且 token 必须限制适用范围。
因此生产必须走 **OAuth 2.0 Authorization Code + PKCE（OIDC）**，不是 identity 直连：

| 控制 | 生产要求 |
|---|---|
| 授权 | 每区一个 AI 专用 OAuth client；用户看到同意页与 scopes |
| scopes | 只申请 `openid email`（**冻结**；不加 `profile`/`offline_access`/`write`） |
| 身份来源 | **ID Token 只取 `sub/tenant_id`**；`email/email_verified` 走 userinfo（scope=email） |
| token 受众 | **JWT AT `aud=default_resource`（AI 资源）**；平台改造 B1+B2 本期完成（当前机密客户端是 opaque，改造后切换） |
| token 能力 | JWT AT 带 `aud/client_id/scope`；其它服务按自己的 `JWT_RESOURCE` 拒绝；TTL≈15m |
| BFF | 换码后只存 `iss/sub/email/tenantId`；**丢弃 AT/RT/ID Token**；RT 即使签发也丢弃 |
| 登录 CSRF | `/api/auth/login` 设 `__Host-ai-oauth-state` Cookie（`browserNonce`）；回调必须 state 记录 + Cookie 双匹配 |
| 双区 | `.cn` / `.com` 各自 client/secret/issuer/回调，不能一个 client 通吃 |
| 租户 | **固定 `union` 租户** `01M60J7J1WZRC0K3BSSVS5J6S1`；所有 `/ai` 共用；其他租户用户 family-domain 放行；BFF 存用户 `tenant_id`；数据按 `(iss,sub,tenantId)`；**不强制相等** |
| 撤销 | **consent-status/epoch（平台 OP 未实现 backchannel，discovery=false）**；≤5 分钟 |
| BFF→AI API | 内部 JWT 独立 `iss/sub/tenant_id/aud=AI API/client_id` + TTL≤60s + RS256/kid + 私网/mTLS + 剥离入站 `X-User-*`/`X-Tenant-*`/`X-Entry-Plane` |

> 本文件 §2–§4 的 identity QR/邮箱码直连只作**第一方预览**：它发的是平台 identity token，
> 没有 client/scope 限制，**不能作为生产登录**。生产流程见 §7。

## 1. 为什么必须 BFF

| 事实 | 结论 |
|---|---|
| identity access token 的 `aud` = 平台 API（`identity-service,https://api.autional.cn`） | 它是平台级 bearer，不是按 portal 隔离的 |
| 平台门户默认把令牌存 localStorage（per-origin） | 第一方门户的既有取舍；客户前端不能照抄 |
| JWT 带 `tenant_id`；网关会覆写 `X-Tenant-ID` | 跨租户有边界；只有平台租户 + admin/platform 平面可代操作 |
| 客户前端会渲染模型输出 | XSS 面更大；令牌不能进 JS |

因此：**浏览器只拿 HttpOnly 会话 Cookie；OAuth 令牌只在服务端内存中使用一次，不持久化。**

## 2. 端点契约（**仅预览**）

> **本节 identity QR/邮箱码直连只作第一方预览，不是生产。** 生产必须用 §7 的 OAuth 流程。
> BFF 必须固定租户（服务端配置），**不要**从客户端接收 `tenant_id`。

所有端点同源：`/api/auth/*`。

### 2.1 扫码

| 方法 | 路径 | 请求 | 响应 |
|---|---|---|---|
| `POST` | `/api/auth/qr/initiate` | `{}` | `{ "sessionToken": "...", "numberMatching": "123456", "expiresIn": 300 }` |
| `GET` | `/api/auth/qr/status?token=...` | — | `{ "status": "pending\|scanned\|confirmed\|cancelled\|expired", "superseded"?: true, "user"?: { "id", "email" } }` |
| `POST` | `/api/auth/qr/revoke` | `{ "token": "..." }` | `{ "ok": true }` |

- `initiate` 上游：`POST {api}/identity/api/v1/auth/qr-login/initiate` body `{ tenant_id }`。
- `status` 上游：`GET {api}/identity/api/v1/auth/qr-login/status?token=...`。
- 上游 `confirmed` 时**只返回一次** `access_token/refresh_token`；BFF 必须当场消费：
  1. 调 `GET {api}/identity/api/v1/auth/me` 校验；
  2. 建服务端会话（随机 128-bit session id），只存 `{ userId, tenantId, email, amr }`；
  3. 写 `Set-Cookie: __Host-ai-session=<id>; HttpOnly; Secure; SameSite=Lax; Path=/`；
  4. 响应只回 `{ status: "confirmed", user: {...} }`，**绝不回令牌**；
  5. **丢弃 identity 令牌**：不写库、不写日志、不放进 Cookie。BFF 后续用 `userId` 授权自己的 API，不再需要这把平台 bearer。
- 上游 `confirmed` 但无令牌：返回 `confirmed`，前端按终态处理（让用户重新发起）。
- `revoke` 透传上游 `POST .../qr-login/revoke`。

### 2.2 邮箱验证码

| 方法 | 路径 | 请求 | 响应 |
|---|---|---|---|
| `POST` | `/api/auth/email/send` | `{ "email": "..." }` | `{ "ok": true }` |
| `POST` | `/api/auth/email/login` | `{ "email": "...", "code": "123456" }` | `{ "user": { "id", "email" } }` + 会话 Cookie |

- 发码上游：`POST {api}/identity/api/v1/auth/send-verification-email` body `{ email, tenant_id }`。
- 登录上游：`POST {api}/identity/api/v1/auth/login/email-code` body `{ email, code, tenant_id }`。
- 上游成功返回令牌 → BFF 同上建会话；响应不含令牌。
- 未注册：上游 `can_register` → BFF 映射为 `{ error: "not_registered" }`（HTTP 404/400 都可），前端给注册链接。

### 2.3 会话

| 方法 | 路径 | 响应 |
|---|---|---|
| `GET` | `/api/auth/session` | `{ "user": { "id", "email" } }` 或 `{ "user": null }` |
| `POST` | `/api/auth/logout` | `{ "ok": true }`，清 Cookie + 删服务端会话 + 撤销 identity 令牌 |

## 3. 安全不变量

| # | 不变量 |
|---|---|
| S1 | 令牌不进浏览器：预览/生产都不把 `access_token`/`refresh_token` 暴露给 JS；BFF 只在单次请求内存中使用，**不加密存储、不持久化** |
| S2 | 租户固定：BFF 配置里的 `tenant_id` 是唯一权威；客户端传的租户一律忽略 |
| S3 | Cookie：`__Host-ai-session`，HttpOnly + Secure + SameSite=Lax + Path=/，不设 Domain |
| S4 | CSRF：POST 校验 `Origin`/`Sec-Fetch-Site`；SameSite=Lax 兜底 |
| S5 | 令牌一次性：上游 `confirmed` 只取一次；BFF 不缓存 status 响应 |
| S6 | 日志脱敏：不打印 `sessionToken`、`access_token`、`refresh_token`、Cookie、`code`、`state` |
| S7 | 失败关闭：换票/校验失败 → 不建会话；不返回半成品用户 |
| S8 | 撤销：登出清会话；可选 `end_session`；`40000502`/撤销 epoch 清会话 |
| S9 | **不持久化任何令牌**：BFF 会话只存 `iss/sub/email/tenantId`；令牌只在登录瞬间内存中使用，不写库、不写日志、不进 Cookie |

### 3.1 信任模型：BFF 也不是全知全能

用户会问：“令牌留在服务器，服务器拿去做坏事，不是更糟？”

答案是：**服务器本来就能做坏事**——它发 JS、看数据、能记键盘。客户端存令牌并不能防恶意服务器；它只防浏览器里的其他攻击者（XSS、恶意依赖、扩展、共用电脑）。BFF 把能偷令牌的人从“浏览器里的任何脚本”收窄到“服务器运营方”，再用最小权限收窄运营方能做的事。

| 存储位置 | 谁可能偷到 | 能做什么 |
|---|---|---|
| 浏览器 localStorage | 任何 XSS / 恶意依赖 / 扩展 / 共用电脑 | 平台级 bearer：调平台 API，跨 portal 重放 |
| BFF 持久化令牌 | 服务器运营方 / 服务器被攻破 | 同上（平台级 bearer） |
| **BFF 只存会话身份（本契约）** | 服务器运营方 / 服务器被攻破 | 只能操作本 AI 应用自己的数据；不能重放平台 bearer |
| OAuth scoped token（第三方客户） | 服务器运营方 / 服务器被攻破 | 只能做 scope 允许的事；可按 client 撤销 |

所以：

1. **BFF 不持久化 identity/OAuth 令牌**（S9）。它只需要知道“是谁”，不需要“能代表用户调平台 API 的钥匙”。
2. **第一方**（本站 `/ai`）：BFF 与 identity 同一信任域；仍按最小权限，只存会话身份。
3. **第三方客户**：不要让 BFF 拿 identity 令牌；用 OAuth 授权码 + PKCE，拿 **scoped** access token（`aud=AI 资源` + client_id + scopes + consent），BFF 只放行 scope 内的调用；用户可在 Autional 撤销该 client。
4. 服务器作恶的治理不是“换个存储位置”，而是：**最小权限、scope、aud、审计、可撤销、用户同意**。
5. 会话本身也是 bearer（Cookie）；所以会话要短 TTL、可撤销、绑定风险信号；撤销 ≤5 分钟。

## 4. 用户故事 / 验收（**预览**）

> 本节是 identity 预览的用户故事；生产 OAuth 的用户故事/验收见 `AI-LOGIN-PLAN.md` §1。

| 用户故事 | 验收 |
|---|---|
| 桌面用户扫码 2 秒登录 | 点「获取二维码」→ 手机确认 → 页面出现「已登录」；浏览器无令牌 |
| 手机用户用邮箱码 | 输入邮箱 → 收 6 位码 → 输满自动登录；不需要装 App |
| 首次用户不会装认证器 | 二维码下方有安装引导；提供邮箱码兜底 |
| 租户只开密码 | 页面显示「尚未开启扫码/邮箱登录」+ 管理员指引 + Autional 登录出口 |
| 安全负责人检查 | `GET /api/auth/session` 只回用户；任何响应无 token；Cookie HttpOnly |

## 5. 部署

- 站点是 `output: 'static'`，托管在香港 `190.92.241.251`（nginx + Docker）。生产 BFF = **同机两个 Node 容器**：`ai-bff-cn`（127.0.0.1:8090）与 `ai-bff-com`（127.0.0.1:8091），代码 `server/ai-auth/{server.mjs,config.mjs,sdk/}`，由 `sites-static` 容器 nginx 的 `location ^~ /api/auth/` 反代；**不再使用 Vercel**。
- 本地预览：`PUBLIC_AI_AUTH_MODE=direct`（dev 默认），Vite 把 `/bff` 代理到本区网关；令牌只进 `sessionStorage`，关闭标签即失效。**本地 HTTP 不能用 `__Host-`**：用 dev-only cookie 名或本地 HTTPS，生产不降级。
- 生产 **不要** 设置 `PUBLIC_AI_AUTH_MODE=direct`。
- 租户：固定 **`union` / `01M60J7J1WZRC0K3BSSVS5J6S1`** 作 client tenant；用户 `tenant_id` 来自 ID Token；其他租户用户由 family-domain federation 放行；数据按 `(iss,sub,tenantId)`。空串只适合本地预览。
- 每区独立 client/secret/issuer/回调；`OAUTH_TOKEN_URL`/`USERINFO_URL` 以 discovery canonical 为准，`/bff` 别名显式允许。

## 6. 与平台现状的关系

- 扫码/邮箱码接口：`shared/service-identity/internal/handler/qr_login_handler.go`、`auth_login.go`。
- 邮箱码/手机码有服务端登录方式门禁；扫码目前**没有**服务端门禁（已知缺口，建议补 `checkLoginMethodAllowed(..., "qr", ...)`；Phase 2 或 AI 租户启用 QR 前）。
- 前端按 `login_methods` 渲染；租户未开 `qr`/`email_code` 时不给死路。
- 生产 OAuth 依赖平台改造 **B1（机密客户端 JWT AT + aud）+ B2（userinfo 接受 AI aud）+ B6（撤销 ≤5 分钟）**；改造完成前功能开关保持关闭。

## 7. 生产：OAuth 授权码 + PKCE（scoped）

### 7.1 AI OAuth client 配置

| 项 | `.cn` | `.com` |
|---|---|---|
| `client_id` | `client-<AI-CN>`（新建） | `client-<AI-COM>`（新建） |
| `client_secret` | BFF 密钥管理 | BFF 密钥管理 |
| `redirect_uri` | `https://www.autional.cn/api/auth/callback` | `https://www.autional.com/api/auth/callback` |
| `scopes` | `openid email` | `openid email` |
| `default_resource` | `https://www.autional.cn/ai/api` | `https://www.autional.com/ai/api` |
| `grant_types` | **仅 `authorization_code`**；禁 client_credentials/refresh/device | 同左 |
| token 格式 | **JWT**（B1 client flag） | JWT |
| 客户端类型 | confidential（BFF 持 secret） | confidential |
| 同意页 | “Autional AI” + `openid email` + terms/privacy | 同左 |
| 撤销 | 用户可撤销 client；**≤5 分钟**生效 | 同左 |

创建（B1 部署后；`$TOKEN` 需平台管理员 + `read` scope）：

```bash
curl -sS -X POST "https://api.autional.cn/oauth/api/v1/admin/oauth/clients" \
  -H "Authorization: Bearer $PLATFORM_ADMIN_TOKEN" \
  -H "X-Tenant-ID: 01M60J7J1WZRC0K3BSSVS5J6S1" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Autional AI (.cn)",
    "redirect_uris": ["https://www.autional.cn/api/auth/callback"],
    "scopes": ["openid", "email"],
    "grant_types": ["authorization_code"],
    "default_resource": "https://www.autional.cn/ai/api",
    "access_token_format": "jwt",
    "is_confidential": true,
    "website": "https://www.autional.cn/ai/",
    "terms_url": "https://www.autional.cn/terms",
    "privacy_policy": "https://www.autional.cn/privacy"
  }'
```

`.com` 区同形替换 host。响应里的 `client_id` / `client_secret` 只写入 BFF 密钥库，不写入仓库/对话/argv。

BFF 环境变量（香港机 `/etc/ai-bff/{cn,com}.env`，600，`.cn` / `.com` 各一套）：

| 变量 | 值 |
|---|---|
| `AI_OAUTH_ISSUER` | `https://api.autional.cn` / `.com` |
| `AI_OAUTH_CLIENT_ID` / `AI_OAUTH_CLIENT_SECRET` | 上述创建结果 |
| `AI_OAUTH_REDIRECT_URI` | `https://www.<root>/api/auth/callback` |
| `AI_RESOURCE` | `https://www.<root>/ai/api` |
| `AI_OAUTH_ENDPOINT_ALLOWLIST` | CSV 四条，**以 discovery 实测为准**：`https://auth.<root>/oauth/api/v1/oauth/authorize`、`https://api.<root>/oauth/api/v1/oauth/token`、`https://api.<root>/oauth/api/v1/oauth/userinfo`、`https://api.<root>/.well-known/jwks.json` |
| `AI_SESSION_SECRET` | ≥32 字符随机值（Cookie 加密） |
| `AI_CONSENT_STATUS_URL` | `https://api.<root>/bff/oauth/api/v1/internal/oauth/consent-status`（窄 public 路由，服务侧 API Key） |
| `AI_INTERNAL_API_KEY` | 调 consent-status 的专用单键（oauth-service 侧变量名 `AI_BFF_API_KEY`，同一值；不是舰队 `INTERNAL_API_KEY`） |
| `AI_INTERNAL_JWT_*` | 可选：BFF→AI API 的 RS256 私钥/PKID/aud（私钥只进密钥库） |
| `AI_REQUIRE_EMAIL` | 可选：`1` = 无邮箱拒绝登录（默认 `0`）。union 密码注册可无邮箱；AI 会话以 `sub` 为稳定标识，email 有则展示 |

平台改造与事实：

- **现状**：机密客户端 AT 是 opaque（`service-oauth/internal/service/service.go:1181-1204`），`default_resource` 只在 JWT 路径生效（`service.go:1166-1179`）。
- **B1（本期）**：client `metadata.access_token_format=jwt` 让机密客户端走 JWT AT，`aud=default_resource`；资源缺失/非 HTTPS/等于平台资源 → 拒绝签发。
- **B2（本期）**：`effectiveJWTConfig` 改 `cfg.Audience=""` + `AllowedAudiences={平台资源} ∪ OAUTH_ALLOWED_RESOURCES`（部署 env CSV），userinfo 接受 AI 资源 aud；未登记 aud 仍 401。
- **B6（本期）**：`RevokeConsent` 软删 consent 行即失效；`GET /api/v1/internal/oauth/consent-status?user_id&client_id`（tenant 走 `X-Tenant-ID`，专用 `AI_BFF_API_KEY` 单键）→ `{active, granted_at, epoch}`；公网窄路由 `/bff/oauth/api/v1/internal/oauth/consent-status`（网关 public + 服务侧单键）；BFF `/session` 与 AI API 调用前查，缓存 ≤60s；**不依赖 Redis/backchannel**（平台 OP discovery=false）。
- **ID Token 不含 `email`**（`oidc_signer.go:60-103`）；email 只在 userinfo、且 scope 含 `email` 时返回（`handler_userinfo.go:88-99,327-341`）。
- OAuth AT 带 `client_id` + `scope`；`RequireScopes` 对 OAuth 令牌**不**走首方 wildcard（`service-core/micro-middleware/auth/scope_guard.go:69-121`）。空 scope = 无权限。
- ID Token 的 `aud` 是 client_id；BFF 必须校验 `iss/aud/exp/nonce`，并校验 JWT AT 的 `aud=AI 资源`。

规范 URL（每区一套；canonical + `/bff` 别名）：

| 用途 | `.cn` | `.com` |
|---|---|---|
| browser authorize | `https://auth.autional.cn/oauth/api/v1/oauth/authorize` | `https://auth.autional.com/oauth/api/v1/oauth/authorize` |
| token（canonical） | `https://api.autional.cn/oauth/api/v1/oauth/token` | `https://api.autional.com/oauth/api/v1/oauth/token` |
| token（`/bff` 别名） | `https://api.autional.cn/bff/oauth/api/v1/oauth/token` | `https://api.autional.com/bff/oauth/api/v1/oauth/token` |
| userinfo（canonical） | `https://api.autional.cn/oauth/api/v1/oauth/userinfo` | `https://api.autional.com/oauth/api/v1/oauth/userinfo` |
| userinfo（`/bff` 别名） | `https://api.autional.cn/bff/oauth/api/v1/oauth/userinfo` | `https://api.autional.com/bff/oauth/api/v1/oauth/userinfo` |
| JWKS（discovery 实测） | `https://api.autional.cn/.well-known/jwks.json` | `https://api.autional.com/.well-known/jwks.json` |
| redirect_uri | `https://www.autional.cn/api/auth/callback` | `https://www.autional.com/api/auth/callback` |

> 实现时先读平台 discovery，断言 issuer host + 精确 path；`/bff` 别名显式允许（线上实测两者都通）。allowlist 精确到 scheme+host+path，防 discovery 被篡改后的 SSRF。

### 7.2 流程

```
AI 站                  BFF                         auth.autional.cn
 点「登录」 → GET /api/auth/login
                        → 生成 state/nonce/verifier + browserNonce
                        → 服务端存 state → {verifier, nonce, browserNonceHash, iss, next}
                        → Set-Cookie __Host-ai-oauth-state=<browserNonce>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600
                        → 302 authorize?client_id&redirect_uri
                          &response_type=code&scope=openid email
                          &state&nonce&code_challenge(S256) ──────→ 登录/同意（QR/Passkey/邮箱码/密码）
                        ← 302 /api/auth/callback?code&state ───────────┘
 GET /api/auth/callback?code&state
                        → 校验 state 记录 + __Host-ai-oauth-state Cookie
                        → POST token（code + code_verifier + client_secret）
                        → 校验 id_token（RS256/kid/iss/aud=client_id/exp/nonce/azp/at_hash）
                        → 取 sub/tenant_id；tenant_id 非空；存用户 tenant（不强制等于 union）
                        → GET userinfo（Bearer AT，scope=email）取 email/email_verified
                        → 校验 JWT AT aud == AI_RESOURCE
                        → 建会话（只存 iss/sub/email/tenantId）；丢弃 AT/RT/ID Token
                        → Set-Cookie __Host-ai-session（轮换）
 ← 302 next（站内白名单）或 /ai/
```

### 7.3 BFF 端点（生产 OAuth 版）

| 方法 | 路径 | 作用 |
|---|---|---|
| `GET` | `/api/auth/login` | 生成 state/nonce/PKCE + state Cookie，302 authorize |
| `GET` | `/api/auth/callback` | 校验 state+Cookie，换码，校验 id_token/AT aud，userinfo，建会话 |
| `GET` | `/api/auth/session` | 返回 `{ user: { id, email } }`；检查撤销 epoch |
| `POST` | `/api/auth/logout` | 清 Cookie/会话；轮换 |

- **不落库**：OAuth AT/RT/ID Token 都不持久化；只在换码请求的内存里用一次。
- **RT 也丢弃**：平台即使签发 RT，也断言不落库/不写日志；会话到期重新走 OAuth。
- **只读**：userinfo 只取 `email/email_verified`；`sub` 来自 ID Token；不请求任何写 scope。
- **撤销 ≤5 分钟（epoch-only）**：BFF 查内部 `consent-status`；`/api/auth/session` 和 AI API 调用都查 epoch；缓存 ≤60s；登录 fail-closed，会话/API 用最后已知良好 ≤5 分钟 + 告警。
- **BFF→AI API**：内部 JWT 独立 `iss/sub/tenant_id/aud=AI API/client_id` + TTL≤60s + RS256/kid/JWKS + 私网/mTLS + 剥离入站 `X-User-*`/`X-Tenant-*`/`X-Entry-Plane`；密钥重叠/轮换。AI API 不接收 OAuth AT/浏览器 Cookie。
- **日志**：`/api/auth/callback` 的 `code/state` 访问日志脱敏；token 请求/响应不落日志。
- **租户**：union 只作 client 路由；ID Token `tenant_id` 是用户租户，非空即可；数据按 `(iss,sub,tenantId)`；不强制等于 union。
- **跨区**：每区独立 client/secret/issuer/回调；secret 轮换 runbook。
- **client 权限**：只注册 `authorization_code`；显式拒绝 client_credentials/refresh/device；测试覆盖。

### 7.4 无跳转的 QR：不做（另立项）

设备流平台缺 `/device` 页、`verification_uri_complete`、`binding_message`/数字匹配、日志脱敏，且不签 ID Token。**本方案不承诺无跳转 QR**；门户登录页的 QR/Passkey/邮箱码已覆盖扫码体验。设备流/CIBA 作为独立平台项目，遵守 RFC 8628/CIBA/RFC 10027。

### 7.5 与当前 `/ai/login` 的关系

- 当前页面的 identity QR/邮箱码直连是**本地预览**（未上线、未提交）；BFF 契约 §2–§4 也仍是 identity 直连；**生产必须换成 §7.1–§7.3 的 OAuth 流程**。
- 换成 OAuth 后，AI 站通常只需要一个「使用 Autional 登录」按钮（跳 authorize）；门户的登录页已经提供 QR/Passkey/邮箱码/密码。
- 邮箱码表单不再需要（门户负责登录方式）；现有视觉外壳、响应式、i18n、会话卡可复用；替换的是认证传输层。

### 7.6 SDK 形态

服务端实现做成 `sdk/packages/ai-auth`（`createAiAuthHandler(config)`，Web-standard Request/Response）：

- 适配器：Cloudflare Workers（KV）、Vercel Functions/Edge（Upstash/Redis）、Node/AI 后端（Redis/内存 dev）。
- AI 站只保留 `/api/auth/[...]` 薄路由；宿主可换、业务代码不动。
- 配置：issuer、client_id/secret、redirect_uri、scopes、union tenant、AI resource、session/epoch store、内部 JWT 密钥。
- 前端可选 `sdk/packages/react` 或复用现有 `web/src/components/ai-login`。
