# Autional AI 登录 · 完整实施方案（v3 · 规范长期版）

> 状态：**已上线（2026-11-24）**：内嵌免密登录（扫码 + 邮箱码）在 `www.autional.cn/ai/login`、`www.autional.com/ai/login` 可用；双区 BFF 自托管于香港；撤销 ≤65s 实测通过。
> 需求源：用户 2026-11-23 —— **仅登录、仅读取部分授权个人信息、token 必须限制适用范围**
> 拍板：**B1+B2 平台改造纳入本期**；**撤销 ≤5 分钟**；**固定 `union` 租户 + 跨租户用户（family-domain federation），不做应用专属租户**
> 关联契约：`docs/AI-LOGIN-BFF.md`
> 当前实现：`src/pages/ai/login.astro`、`src/components/ai-login/*`、`src/lib/ai-auth.ts`（生产默认 `embedded`）；BFF `api/auth/*` + `server/ai-auth/*`；SDK `packages/ai-auth`（补丁）
> 交付补丁：`.tmp/patches/{service-oauth-b1b2b6.git,infra-ops-gateway-ai-consent,infra-ops-oauth-env-ai,sdk-ai-auth}.patch`（相对各仓根目录）

---

## 0.0 2026-11-24 方向更新（覆盖下文「OAuth 为主」的旧表述）

**用户最终拍板：登录内嵌在客户自己的域名页面（如 `https://marktext.denglu.dev/login`），不跳转 `autional.cn`，任何形式都不出现密码。**

| 维度 | 现行（embedded，默认） | OAuth 授权码（保留为可选/回退） |
|---|---|---|
| 入口 | 客户页面 → BFF `/api/auth/embed/*` | 客户页面 → `/api/auth/login` → 平台授权页 → `/api/auth/callback` |
| 凭据到达浏览器 | 只有 `__Host-ai-session`（加密 HttpOnly） | 同左 |
| identity token | BFF 短暂持有，不落地、不下发 | BFF 换码后立即丢弃 |
| 授权记录 | BFF 调内部 `POST /internal/oauth/consents`（`grant_method=embedded_bff`） | 用户点同意页，平台写 consent |
| 默认开关 | `PUBLIC_AI_AUTH_MODE` 未设 → `embedded` | `oauth`（显式配置才启用） |
| 现状 | **已上线并 E2E 通过**（扫码 / 邮箱码 / 撤销） | 已实现，保留回退 |

下文 §0–§7 描述 OAuth 链的细节仍有效，但生产默认路径以本节为准；内嵌流程的契约见 `AI-LOGIN-BFF.md` §0.0。

---

## 0. 一页结论

> **AI 站只做 OAuth 2.0 授权码 + PKCE（OIDC）；AI 专用 confidential client；JWT AT 带 `aud=AI 资源`；只申请 `openid email`；ID Token 只取 `sub`，email 走 userinfo；AT/RT 用完即弃；BFF 只存 `iss/sub/email/tenantId` 会话；撤销 ≤5 分钟生效。**

| 关键点 | 结论 |
|---|---|
| 协议 | OAuth Authorization Code + PKCE（S256），OIDC ID Token |
| 客户端 | 每区一个 confidential AI client；secret 只在 BFF |
| 受众 | **JWT AT `aud = default_resource`（AI 资源）**；平台改造 B1+B2 本期完成 |
| scopes | 冻结 `openid email`；不申请 `profile`/`offline_access`/写 |
| 身份 | ID Token 取 `sub/tenant_id`；userinfo 取 `email/email_verified` |
| 令牌 | AT/RT/ID Token 不落库、不写日志、不进 Cookie；BFF 用完即弃 |
| 会话 | `__Host-ai-session` HttpOnly；只存 `iss/sub/email/tenantId`；30m idle / 8h absolute |
| 撤销 | **consent-status/epoch 检查（平台 OP 未实现 backchannel；discovery=false）**；≤5 分钟 |
| 租户 | **固定 `union` 租户** `01M60J7J1WZRC0K3BSSVS5J6S1`（display “Autional”）；所有 `/ai` 共用；其他租户用户由 family-domain federation 放行；BFF 存用户 `tenant_id`，数据按 `(iss,sub,tenantId)` 隔离；**不强制相等** |
| 登录 CSRF | `__Host-ai-oauth-state` Cookie（`browserNonce`）+ 服务端 state 双匹配 |
| BFF→AI API | 独立 `iss/sub/tenant_id/aud=AI API/client_id` + TTL≤60s + RS256/kid + 私网/mTLS + 剥离入站 `X-User-*`/`X-Tenant-*`/`X-Entry-Plane` |
| 端点 | 以 discovery canonical `/oauth/api/v1/oauth/...` 为准；`/bff` 是别名；断言 host+path |

---

## 1. 需求与验收

### 1.1 用户故事

| # | 角色 | 故事 | 验收 |
|---|---|---|---|
| U1 | 桌面用户 | 不想记密码，点登录去 Autional，用 QR/Passkey 登录 | 登录页无密码框；授权后回 AI 站已登录 |
| U2 | 手机用户 | 不想装 App，用邮箱码登录 | 门户邮箱码可用；AI 站已登录 |
| U3 | 首次用户 | 注册后不想再登录一次 | 注册 → 同意 → 回调 → AI 站已登录 |
| U4 | 隐私敏感用户 | 只授权 AI 读邮箱 | 同意页只显示 `openid email`；AI 只存 `iss/sub/email` |
| U5 | 安全负责人 | token 被偷也干不了别的 | JWT AT `aud=AI 资源`；scope 只读；15m；client 绑定；撤销 ≤5 分钟 |
| U6 | 租户用户 | 我用现有 Autional 账号直接登录 AI，不用再注册 | union 固定 client；其他租户用户 family-domain 放行；BFF 存用户 tenant |

### 1.2 总体验收

- [ ] AI 站登录页**没有密码输入框**。
- [ ] 授权请求只含 `openid email`；同意页展示 AI app 名 + scopes + terms/privacy。
- [ ] AT 是 **JWT**，`aud=AI 资源`、`client_id=AI client`、`scope=openid email`、TTL≈15m。
- [ ] AT **只用于一次 userinfo**；AI API 的 bearer 是 BFF 内部 JWT，不接收 AT。
- [ ] ID Token 校验 `iss/aud=client_id/exp/nonce`；只取 `sub/tenant_id`。
- [ ] `email/email_verified` 来自 userinfo（scope=email）；`email_verified=true` 才用于通知。
- [ ] AT/RT/ID Token **不落库、不写日志、不进 Cookie**；RT 即使签发也丢弃并断言。
- [ ] BFF 会话只含 `iss/sub/email/tenantId`；浏览器存储无 token。
- [ ] state 服务端记录 + `__Host-ai-oauth-state` Cookie 双匹配；不匹配拒绝。
- [ ] 回调 `https://www.autional.cn/api/auth/callback`；authorize/token/userinfo 用 canonical 端点。
- [ ] 双区各自 client/issuer/回调；`.cn`/`.com` E2E 通过。
- [ ] 拒绝同意 / code 过期 / state 不匹配 / 跨租户 / userinfo 无 email → 不建会话。
- [ ] 注册 → 同意 → 回调 → 已登录；不出现二次登录（自动登录失败也给“继续授权”出口）。
- [ ] 登出 → 会话清除；提供“同时登出 Autional”或共享设备警告。
- [ ] 撤销 client → **≤5 分钟**现有会话失效。
- [ ] 手机布局、深浅色、中英双语、真机门户扫码/邮箱码通过。
- [ ] 构建、类型、i18n、链接、层级检查全绿。

### 1.3 非目标

| # | 非目标 | 原因 |
|---|---|---|
| N1 | 客户自有域名 Passkey | 多租户 WebAuthn 另立项 |
| N2 | identity token 交给 AI 前端/BFF | BFF 只拿 OAuth scoped AT |
| N3 | 写 scope / `offline_access` | 登录只需身份 |
| N4 | 短信主登录 | SIM 交换/成本/可达性 |
| N5 | 设备流 / CIBA 无跳转 QR | 平台缺 `/device`、complete URI、抗钓鱼；另立项 |
| N6 | 增量 scope 授权 | 平台 consent 只按 client、无 `prompt`；scope 冻结 |

---

## 2. 现状与差距

### 2.1 已完成（本地，未上线）

| 项 | 状态 |
|---|---|
| `/ai/login` UI（QR/邮箱码/安装引导/仅密码分支/会话卡） | 本地实现 |
| 响应式/深浅色/a11y/i18n（508 键对称） | 本地验证 |
| 凭据审计（客户端存储/跨租户/跨 portal） | 完成 |
| 首轮/二轮独立审核 | P0 清零；5 P1 收口中 |

> `/ai/login` 线上 404；文件未提交。所有“已完成”指本地。

### 2.2 差距与本期任务

| # | 差距 | 归属 | 本期处置 |
|---|---|---|---|
| D1 | 当前 identity 直连 | 前端 | Phase 1 替换 |
| D2 | 双区 AI client 未建 | 平台 | Phase 0 |
| D3 | BFF 未实现；站点静态 | AI 后端 | Phase 0/1 |
| D4 | 注册上下文 | site-auth | Phase 2 |
| D5 | 设备流缺口 | 平台 | 不做（另立项） |
| D6 | identity QR 门禁 | service-identity | Phase 2 |
| D7 | 真机扫码 | QA | Phase 2 |
| D8 | 同意页品牌/scope | 平台 | Phase 0 验证 |
| D9 | 机密客户端 AT 无 aud | service-oauth | **B1 本期改造** |
| D10 | ID Token 无 email | service-oauth | **B3 可选**；本期走 userinfo |
| D11 | 撤销不传导 | oauth/BFF | **B6 本期：≤5 分钟** |
| D12 | 端点路径易错 | 方案/实现 | 规范 URL 表 + 断言 |
| D13 | 双区 client | 平台 | Phase 0 |
| D14 | 日志 code/state | BFF/nginx | Phase 1 |
| D15 | 数据删除 | AI 后端 | Phase 2 |
| D16 | 无 CSP | web | Phase 2 |
| D17 | 租户模型 | 产品 | **固定 union + 跨租户用户（family-domain）** |

---

## 3. 目标架构

```
www.autional.cn/ai
  ├─ 静态前端（Astro）
  │    ├─ 登录页：品牌 + 「使用 Autional 登录」+ 会话卡 + 错误页
  │    └─ 无密码框、无 token
  └─ /api/auth/*  BFF（同源，服务端）
        ├─ /login     → 设 state Cookie + 302 authorize
        ├─ /callback  → state+Cookie → 换码 → 校验 id_token → userinfo(email)
        │              → 建会话 → 丢弃 AT/RT → 302 /ai/
        ├─ /session   → { user: { id, email } }；检查撤销 epoch
        └─ /logout    → 清会话

auth.autional.cn
  ├─ 登录页：QR / Passkey / 邮箱码 / 密码（租户策略）
  ├─ 同意页：AI app + openid email + terms/privacy
  └─ OAuth：authorize / token / userinfo / revoke / backchannel logout

AI API
  └─ 只接受 BFF 短时内部 JWT（aud=AI API）；不接收 OAuth AT/浏览器 Cookie
```

---

## 4. 关键设计决策

| # | 决策 | 选择 |
|---|---|---|
| K1 | 登录协议 | OAuth 授权码 + PKCE（S256），OIDC |
| K2 | 客户端 | 每区 confidential；只注册 `authorization_code`；禁用 client_credentials/refresh/device |
| K3 | 身份 | ID Token：`sub/tenant_id`；userinfo：`email/email_verified` |
| K4 | scopes | 冻结 `openid email`；不申请 `profile`/`offline_access`/写 |
| K5 | 受众 | **JWT AT `aud=default_resource`（AI 资源）**；B1+B2 本期 |
| K6 | 会话 | `__Host-ai-session`；只存 `iss/sub/email/tenantId`；30m idle/8h absolute |
| K7 | 注册 | authorize 流程内；注册成功回 authorize；不依赖自动登录 |
| K8 | 失败策略 | fail-closed；不建会话；不回退 identity |
| K9 | 预览 | 生产禁止 `direct`；仅本地 UI 预览 |
| K10 | 租户 | **固定 union 租户**；所有 `/ai` 共用；用户可来自其他租户；BFF 存用户 tenant；数据键 `(iss,sub,tenantId)`；不强制相等 |
| K11 | 外部 ID | `(iss, sub)` 主键；email 仅资料 |
| K12 | 首次资料 | 首登即存 `iss/sub/email`；**email 缺失 fail-closed（不建会话）**；`email_verified=true` 才用于通知 |
| K13 | 增量授权 | 不做；scope 冻结 |
| K14 | 设备流 | 不做；另立项 |
| K15 | 登录 CSRF | state Cookie `browserNonce` + 服务端 state 双匹配 |
| K16 | 双区 | 每区独立 client/secret/issuer/回调 |
| K17 | 日志 | code/state 脱敏；token 响应不落日志 |
| K18 | 数据删除 | 删除端点 + 保留期 + 同意撤回 |
| K19 | 平台改造 | B1（JWT AT aud）+ B2（userinfo 接受 AI aud）本期 |
| K20 | 撤销 | backchannel logout + consent-status/epoch；≤5 分钟 |
| K21 | BFF→AI API | 短时内部 JWT（aud=AI API，iss=BFF，sub=iss:sub） |
| K22 | BFF 宿主 | 同源 `/api/auth/*`；Phase 0 出口列明运行时 |
| K23 | 端点断言 | discovery canonical `/oauth/api/v1/oauth/...`；`/bff` 别名 |

---

## 5. 配置清单

### 5.1 AI OAuth client（每区一套）

| 项 | `.cn` | `.com` |
|---|---|---|
| `client_id` | `client-<AI-CN>`（tenant=`union`） | `client-<AI-COM>`（tenant=`union`） |
| `client_secret` | BFF 密钥管理 | BFF 密钥管理 |
| `redirect_uri` | `https://www.autional.cn/api/auth/callback` | `https://www.autional.com/api/auth/callback` |
| `scopes` | `openid email` | `openid email` |
| `default_resource` | `https://www.autional.cn/ai/api` | `https://www.autional.com/ai/api` |
| `grant_types` | **仅 `authorization_code`** | 同左 |
| token 格式 | **JWT**：`access_token_format=jwt`（B1 开关） | 同左 |
| 客户端类型 | confidential | confidential |
| 同意页 | “Autional AI” + scopes + terms/privacy | 同左 |
| 撤销 | 用户可撤销 | 同左 |

### 5.2 租户

| 项 | 要求 | 验收 |
|---|---|---|
| 固定租户 | **`union` / `01M60J7J1WZRC0K3BSSVS5J6S1`**；所有 `/ai` 共用 | `.cn`/`.com` 公开列表均可见；client tenant = union |
| 登录路由 | `https://auth.<root>/union/login?redirect=<authorize URL>` | 登录页为 union/Autional；不落默认门户 |
| 跨租户用户 | 非 idp client + 平台家族域回调 → family-domain 放行；ID Token `tenant_id` = 用户租户 | E2E：其他租户用户直接登录；BFF 存其 tenant |
| 数据隔离 | 按 `(iss,sub,tenantId)` 键；不把 union 当唯一用户租户 | 同 sub 不同 tenant 不串数据 |
| 客户端 | union 内每区一个 app client（`.cn`/`.com`） | 双区 client 归属 union |
| 品牌 | union 显示名 “Autional” | 登录页/同意页 |
| 回退 | 若某用户被跨租户门禁拒绝（非家族域/异常），给“加入 union”或切换账号 | 有明确出口，不死路 |
| **登录方式（必改）** | 线上 `union` 当前仅 `login_methods=["password"]`、`passkey_enabled=false`、`membership_approval=invitation_only`。必须改为 `["password","qr","email_code","passkey"]` + `passkey_enabled=true`；注册策略按业务选 `open`（推荐）或 `approval_required`，**否则无密码登录与自助注册走不通** | 公开 auth-config 回读含 qr/email_code/passkey；注册可自助 |
| 配置入口 | `PUT https://api.<root>/bff/tenant/api/v1/admin/tenants/01M60J7J1WZRC0K3BSSVS5J6S1/auth-policy`（`login_methods`/`passkey_enabled`）+ `PUT .../admin/tenants/01M...`（`membership_approval`） | 管理面审计有记录 |

### 5.3 BFF 环境（每区）

变量名以 `server/ai-auth/config.mjs` 为准（香港机 `/etc/ai-bff/{cn,com}.env`，每区一套）：

| 变量 | 值 |
|---|---|
| `AI_OAUTH_CLIENT_ID` / `AI_OAUTH_CLIENT_SECRET` | union client（每区独立） |
| `AI_OAUTH_ISSUER` | `https://api.autional.cn` / `.com` |
| `AI_OAUTH_REDIRECT_URI` | `https://www.<root>/api/auth/callback` |
| `AI_OAUTH_ENDPOINT_ALLOWLIST` | CSV 四条 **discovery 实测**：authorize/token/userinfo/`https://api.<root>/.well-known/jwks.json` |
| `AI_RESOURCE` | `https://www.<root>/ai/api` |
| `AI_SESSION_SECRET` | ≥32 随机值（Cookie AES-GCM 密钥） |
| `AI_CONSENT_STATUS_URL` | `https://api.<root>/bff/oauth/api/v1/internal/oauth/consent-status` |
| `AI_INTERNAL_API_KEY` | 与 oauth-service 的 `AI_BFF_API_KEY` **同值**（专用单键） |
| `AI_INTERNAL_JWT_ISSUER` / `AI_INTERNAL_JWT_AUDIENCE` / `AI_INTERNAL_JWT_PRIVATE_KEY` / `AI_INTERNAL_JWT_KID` | 可选：BFF→AI API 的 RS256 内部 JWT（私钥只进密钥库） |

**service-oauth 部署 env（prod program.env）**：

| 变量 | 值 |
|---|---|
| `OAUTH_ALLOWED_RESOURCES` | CSV，含 `https://www.autional.cn/ai/api`（`.com` 区对应）；B2 白名单 |
| `AI_BFF_API_KEY` | consent-status 专用单键；BFF 侧存为 `AI_INTERNAL_API_KEY`；空 = 端点全 401 |

---

## 6. 流程

### 6.1 登录

```
AI 站「登录」→ GET /api/auth/login
  → state/nonce/verifier + browserNonce
  → 服务端存 state → {verifier, nonce, browserNonceHash, iss, next}
  → Set-Cookie __Host-ai-oauth-state-<stateHash>=<browserNonce>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600
  → 302 https://auth.autional.cn/oauth/api/v1/oauth/authorize
       client_id, redirect_uri=https://www.autional.cn/api/auth/callback,
       response_type=code, scope=openid email, state, nonce,
       code_challenge=S256
  → 门户登录/同意
  → 302 /api/auth/callback?code&state
```

### 6.2 回调

- [ ] state 记录 + `__Host-ai-oauth-state` Cookie 双匹配。
- [ ] 换码：canonical token URL + client_secret + code_verifier。
- [ ] ID Token：RS256 + `kid`、JWKS（缓存/轮换）、`iss`、`aud=client_id`、`exp`、`nonce`；多 aud 校验 `azp`；有 `at_hash` 则校验。
- [ ] 取 `sub/tenant_id`；`tenant_id` 非空；**存用户 tenant，不强制等于 union**；数据键 `(iss,sub,tenantId)`。
- [ ] userinfo：Bearer AT；取 `email/email_verified`；AT 只在此处使用。
- [ ] `email_verified=true` 才用于通知；身份只用 `(iss,sub)`。
- [ ] email 缺失：不建会话（fail-closed）；错误页给重试/联系管理员。
- [ ] 丢弃 AT/RT/ID Token；不写库/日志/Cookie。
- [ ] 建会话（`iss/sub/email/tenantId`）；轮换 session id；清 state Cookie；302 `next`（站内白名单）或 `/ai/`。
- [ ] `Cache-Control: no-store`；`Referrer-Policy: no-referrer`。

### 6.3 会话 / 登出 / 撤销

- `GET /api/auth/session` → `{ user: { id, email } }`；检查撤销 epoch。
- `POST /api/auth/logout` → 清 Cookie + 删会话 + 轮换。
- 登出 Autional：BFF 丢弃 ID Token，无 `id_token_hint`；跨域 RP-initiated logout 会落确认页/401。因此默认 **共享设备警告 + 显式跳 auth 门户登出**；不承诺自动 `end_session`；行为写 runbook 并实测。
- 会话 TTL：30m idle / 8h absolute。
- 撤销（**epoch-only；不依赖 backchannel**）：
  - 平台：`RevokeConsent` 写撤销 epoch/Redis；新增内部只读端点 `GET /internal/oauth/consent-status?tenant_id&user_id&client_id` → `{active, revoked_at, epoch}`。
  - BFF：`/api/auth/session` 与每次代理 AI API 前查该端点；缓存 ≤60s；**≤5 分钟**生效。
  - 查询失败策略（已定）：**登录 fail-closed**；`/session`/AI API 使用**最后已知良好 ≤5 分钟**窗口 + 告警（超过 5 分钟无新结果则拒绝）。写 runbook。
  - AT 撤销：AT 只在登录时调一次 userinfo（≤15 分钟窗口）；≤5 分钟约束的是 **BFF 会话**。若也要约束 AT，加 client-scoped epoch 并在 `ValidateAccessToken` 检查；Redis 缺席时 fail-closed。
  - 测试：撤销后 ≤5 分钟 `/session` 401、AI API 401。

### 6.4 注册

```
AI 站「注册」→ /api/auth/login
  → authorize（client 所属 union）
  → 未登录 → https://auth.<root>/union/login?redirect=<authorize URL>
  → 门户「注册」
  → 注册成功（服务端门户会话或一次性 continuation token）
  → 回 authorize → 同意 → 回调 → AI 站已登录
```

平台修：

| 位置 | 现状 | 改为 |
|---|---|---|
| `auth/apps/auth-pages/src/app/page.tsx:1355-1363` | 注册链接丢 redirect | 保留完整 query |
| `auth/apps/auth-pages/src/app/register/page.tsx:231-232,557-565` | 只读 invitation；成功固定 dashboard | 读 redirect；成功回 authorize；自动登录失败给“继续授权”（服务端会话或一次性 continuation token） |
| 租户路由 | 默认门户/客户端租户 | 显式 `union/login` + authorize `state.redirect`；不静默落默认门户 |
| 跨租户用户 | 其他租户会话 | **family-domain 放行**（非 idp client + 平台家族域回调）；BFF 存用户 tenant；若门禁拒绝给“加入 union”/切换账号 |

- union 固定 client；用户可以是其他租户；注册页按用户实际租户/union 品牌处理；不强制 `tenant_id` 相等。

### 6.5 设备流 / CIBA（不做）

- 平台缺 `/device`、complete URI、`binding_message`、日志脱敏；另立项。
- 门户 QR/Passkey/邮箱码覆盖扫码体验。

### 6.6 错误

| 错误 | 提示 |
|---|---|
| `access_denied` | 取消授权；可重试 |
| state/Cookie 不匹配 | 登录失效；重新登录 |
| code 过期/复用 | 登录过期；重新登录 |
| `invalid_client` / 双区不匹配 | 配置错误；联系管理员 |
| userinfo 无 email | 无法读取授权邮箱；重试/联系管理员 |
| tenant/issuer 缺失或不匹配 | 登录失败；重新登录/联系管理员 |
| 撤销/epoch 失效 | 授权已撤销；重新登录 |
| 网络/5xx | 服务暂不可用；重试 |

---

## 7. BFF 契约（生产）

| 方法 | 路径 | 作用 |
|---|---|---|
| `GET` | `/api/auth/login` | state/nonce/PKCE + state Cookie，302 authorize |
| `GET` | `/api/auth/callback` | state+Cookie、换码、ID Token、userinfo、会话 |
| `GET` | `/api/auth/session` | `{ user: { id, email } }`；查撤销 epoch |
| `POST` | `/api/auth/logout` | 清会话 |

不变量：

| # | 不变量 |
|---|---|
| S1 | state/nonce/verifier 服务端；10min；一次性 |
| S2 | state Cookie 绑定浏览器：**每个 state 一个 `__Host-ai-oauth-state-<stateHash>` Cookie**（Max-Age 600）；回调只删匹配项；多标签可并行 |
| S3 | 换码在服务端；secret 不进前端 |
| S4 | JWT AT 校验 `aud=AI 资源`；ID Token 校验 `iss/aud/exp/nonce` |
| S5 | ID Token 只取 `sub/tenant_id`；email 来自 userinfo |
| S6 | AT/RT/ID Token 不持久化、不写日志、不进 Cookie；RT 丢弃 |
| S7 | 会话只存 `iss/sub/email/tenantId` |
| S8 | `__Host-ai-session` HttpOnly/Secure/SameSite=Lax/Path=/；登录轮换 |
| S9 | POST Origin/Sec-Fetch-Site；登录限流 |
| S10 | 回调 code/state 日志脱敏；token 响应不落日志 |
| S11 | 失败关闭 |
| S12 | `tenant_id` 来自 ID Token；非空；**不强制等于 union**；数据键 `(iss,sub,tenantId)`；union 只作 client 路由 |
| S13 | 撤销 epoch/backchannel ≤5 分钟 |
| S14 | BFF→AI API 内部 JWT：独立 `iss=BFF issuer URL`、`sub=用户 sub`、`tenant_id`、`aud=AI API`、`client_id=AI client`、`iat/exp`（TTL≤60s）、`jti`；`alg=RS256` + `kid` + JWKS；时钟偏移≤60s；AI API 私网/mTLS；剥离入站 `X-User-*`/`X-Tenant-*`/`X-Entry-Plane`；密钥重叠窗口 + 轮换 runbook。**不要**用 `sub=iss:sub` 拼接 |
| S15 | 审计；不记录 token/code/state |

---

## 8. 前端改造

| # | 改动 |
|---|---|
| F1 | 删除生产 identity 直连；`direct` 仅本地 |
| F2 | 登录按钮 → `/api/auth/login` |
| F3 | 保留视觉/i18n/响应式/会话卡；删除邮箱码表单 |
| F4 | 错误页/会话过期/撤销提示 |
| F5 | `.cn`/`.com` 双区 |
| F6 | 注册 → `/api/auth/login` |
| F7 | 生产禁止 `direct`（CI 门） |
| F8 | `next` 存 state，白名单 |
| F9 | CSP：静态站不能用 per-request nonce；用构建期 `'sha256-...'` 或去掉内联脚本；由 Vercel/nginx **header** 下发（不用 meta；`frame-ancestors` 在 meta 无效）；`default-src 'self'; script-src 'self' 'sha256-...'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`；测试真实构建产物 |
| F10 | 共享设备：提供“同时登出 Autional”或警告 |

### 8.1 SDK 形态（复用优先）

| 项 | 设计 |
|---|---|
| 服务端包 | `sdk/packages/ai-auth`（新）：`createAiAuthHandler(config)` → Web-standard `Request/Response` handler；覆盖 login/callback/session/logout |
| 适配器 | **Cloudflare Workers**（KV 会话/epoch 缓存、Wrangler secrets）；**Vercel Functions/Edge**（Upstash/Redis）；**Node/AI 后端**（Redis 或本地内存 dev）；同一契约 |
| 前端包 | `sdk/packages/react` 或复用现有 `web/src/components/ai-login`：登录按钮/会话卡；只调 `/api/auth/*` |
| 配置 | issuer、client_id/secret、redirect_uri、scopes、union tenant、AI resource、session/epoch store、内部 JWT 密钥 |
| 部署 | AI 站 `/api/auth/[...]` 薄路由 → SDK handler；每区可选 Worker / Vercel Function / AI 后端 |
| 测试 | fetch handler 契约、state Cookie、PKCE、ID Token/JWKS、userinfo、会话、epoch、内部 JWT；双区 |
| 版本 | 新包 `0.1.0-rc.x`；按共享模块 bump 纪律；不把密钥写进包 |

**宿主建议**：优先 **Cloudflare Worker + KV**（近期已有 Cloudflare 经验；`www` 走 Cloudflare 时可直接挂 `/api/auth/*`）；Vercel Function 作为 `.com` 备选；AI 自带后台可用 Node adapter。SDK 与宿主解耦，换宿主不改业务代码。

---

## 9. 平台改造

| # | 改动 | 仓/位置 | 量级 |
|---|---|---|---|
| P1 | **B1**：机密客户端 JWT AT（client flag），`aud=default_resource` | service-oauth | 1–2 周 |
| P2 | **B2**：userinfo 接受 AI 资源 aud | service-oauth | 同批 |
| P3 | **B6**：撤销事件/consent-status/epoch；backchannel logout | service-oauth | 3–5 天 |
| P4 | 双区 AI client/secret/redirect/scopes/grant_types | 管理门户 | 配置 |
| P5 | 注册链接/注册成功回 authorize | site-auth | 小 |
| P6 | 同意页品牌/scope/terms/privacy | service-oauth `PublicClientInfo` 加 `terms_url`/`privacy_policy` + site-auth 渲染 + 测试 | 小 |
| P7 | identity QR 登录方式门禁 | service-identity | 小 |
| P8 | 真机验收 | QA | 1 天 |
| P9 | 设备流/CIBA | 另立项 | — |
| P10 | 日志脱敏实现：nginx access log 去 query 或正则脱敏 `code/state`；BFF 结构化日志字段白名单；测试 | infra/BFF | 小 |
| P11 | client secret 多 secret 重叠轮换；内部 JWT `kid` 双钥重叠 + 回滚 runbook | service-oauth/BFF | 小 |
| P12 | 数据删除：AI 只存 `iss/sub/email/tenantId`；删除端点/流程/保留期/owner；撤回同意触发会话撤销 | AI 后端 | 中 |

### 9.1 B1/B2/B6 实现要点

| 改造 | 实现 | 测试 |
|---|---|---|
| **B1** 机密客户端 JWT AT | 1) client 管理 API/DTO 新增 `access_token_format`（空/`opaque` = 默认；`jwt` = 机密客户端发 JWT AT），落 `metadata.access_token_format`；2) JWT 路径条件加该 flag；3) `aud=default_resource`；4) **fail-closed**：flag=`jwt` 且 `default_resource` 空/非 HTTPS/等于平台资源 → 拒绝签发 | `access_token_format_test.go`：confidential+jwt 有 `aud`；未开 flag 仍 opaque；缺资源/http/平台资源拒绝 |
| **B2** userinfo 接受 AI aud | `effectiveJWTConfig`：`cfg.Audience=""`，`cfg.AllowedAudiences={平台资源} ∪ OAUTH_ALLOWED_RESOURCES`（CSV）；保留 issuer/签名/exp/type/blacklist/scope 校验；**不关闭** aud 校验 | `access_token_format_test.go`：平台 aud 200、AI aud 200、未登记 aud 401、错签名/issuer 401 |
| **B6** 撤销 ≤5 分钟（DB epoch） | 1) `RevokeConsent` 软删 consent 行（已有行为）即 epoch 失效；2) 新增只读端点 `GET /api/v1/internal/oauth/consent-status?user_id&client_id`（tenant 走 `X-Tenant-ID`，专用 `AI_BFF_API_KEY` 单键；网关窄 public 路由 `/bff/oauth/...`）→ `{active, granted_at, epoch}`；3) BFF `/api/auth/session` 与 AI API 调用前查，缓存 ≤60s；4) 不依赖 Redis/backchannel | `consent_status_test.go`：撤销后 active=false；DB 错误上报不伪装 |
| client 权限 | `client_credentials`/`device_code` 在 handler 用已加载 client 判定；`authorization_code` 在 authorize 端点判定；`refresh_token` 在 `RotateRefreshToken` 判定；空 `grant_types` 历史客户端保持放行 | `grant_type_guard_test.go`：非空列表必须命中；空列表放行 |

---

## 10. 安全模型

| 威胁 | 控制 |
|---|---|
| XSS 偷令牌 | 令牌不进浏览器；HttpOnly；CSP；消毒 |
| BFF 运维滥用 | 不持久化 token；只存最小会话；aud/scope/TTL；审计 |
| 令牌跨服务 | JWT AT `aud=AI 资源`；其它服务按 `JWT_RESOURCE` 拒绝 |
| 权限过大 | `openid email`；无写/refresh |
| 不知情授权 | 同意页 app+scopes+terms/privacy；可拒绝/撤销 |
| 登录 CSRF | state Cookie `browserNonce` + 服务端 state |
| 撤销不生效 | backchannel + epoch；≤5 分钟 |
| 跨租户 | union 固定 client；其他租户用户 family-domain 放行；BFF 存用户 tenant；数据按 `(iss,sub,tenantId)` 隔离；不强制相等 |
| BFF→AI API 伪造 | 内部 JWT：独立 iss/sub/tenant_id/aud/client_id；TTL≤60s；RS256+kid+JWKS；私网/mTLS；剥离入站 `X-User-*`/`X-Tenant-*`/`X-Entry-Plane`；密钥重叠/轮换 |
| OAuth AT 被误认为 AI API 凭据 | 文档与实现明确：OAuth AT 是 **userinfo-only**；AI API 的 bearer 是内部 JWT；`aud` 是防御性校验，不是 AI API 授权 |
| AT 撤销窗口 | AT 只在登录时用一次（≤15 分钟）；≤5 分钟约束 BFF 会话；若要约束 AT，加 client-scoped epoch + Redis 缺席 fail-closed |
| 日志泄漏 | code/state 脱敏；token 不落日志 |
| 数据保留 | 删除端点/保留期/同意撤回 |
| 共享设备 | 同时登出 Autional 或警告 |
| CDCP/QR | 不做自建 QR；设备流另立项按 RFC 10027 |

---

## 11. 标准与同行

- RFC 6749/7636；RFC 9700（PKCE、精确 redirect、禁 implicit/password、受众、最小权限）；RFC 9068（JWT AT aud/client_id/scope）；RFC 8707（resource）；OIDC Core；RFC 9449（DPoP，长期）；RFC 8693（token exchange，长期）；RFC 8628/CIBA/RFC 10027（设备流，另立项）。
- 同行：微信 `snsapi_base`/`snsapi_userinfo`（服务端换码/最小 scope）；Google/Apple/Microsoft OIDC + consent；Apple 首登资料只给一次；GitHub scope 粗。
- 本方案：OIDC + JWT AT aud + `openid email` + BFF + 不持久化 + ≤5 分钟撤销。

---

## 12. 测试与验收

| 层 | 用例 |
|---|---|
| 单元 | state/nonce/PKCE；state Cookie；ID Token（RS256/kid/iss/aud/exp/nonce/azp/at_hash）；aud；错误映射；RT 丢弃断言 |
| 集成 | 正常；拒绝；code 过期/复用；state/Cookie 不匹配；ID Token aud 错；AT aud 错；scope 不足；userinfo 无 email；跨租户；撤销 ≤5 分钟；登出；双区 |
| E2E | 桌面/手机；门户 QR/Passkey/邮箱码/密码；注册（含自动登录失败）；`.cn`/`.com`；无密码框；浏览器无 token；BFF 404/502 fail closed；共享设备 |
| 安全 | 登录 CSRF；AT 重放；scope 提升；开放重定向；`next` 白名单（`//evil`、`https://evil`、编码变体）；Cookie 标志；日志脱敏；CSP；内部头伪造；client_credentials/refresh/device 拒绝；AT 只能打 userinfo |
| 真机 | iOS/Android 门户扫码/邮箱码 |

验收：§1.2 每条 + 证据（命令/截图/日志/报告）。

---

## 13. 阶段 / 工作量

| 阶段 | 任务 | 工作量 | 出口 |
|---|---|---|---|
| **Phase 0** | 拍板/配置：双区 client（union）、BFF 宿主、平台改造设计、CI 门禁 | 2–3 天 | 配置/宿主/设计就绪 |
| **Phase 1** | 平台 B1+B2；BFF（login/callback/session/logout + state Cookie + 内部 JWT）；前端切换；单测 | 2–3 周 | staging 端到端；AT aud/scope 验证 |
| **Phase 2** | B6 撤销 ≤5 分钟；注册；拒绝/错误；`.com`；CSP；数据删除；安全测试；真机 | 1–2 周 | 验收全过 |
| **Phase 3（可选）** | B3 ID Token email；B5 scope-aware consent/prompt；B7 DPoP/token exchange | 另立项 | 长期增强 |
| **Phase 4（可选）** | 设备流/CIBA；多租户 WebAuthn | 另立项 | 不阻塞 |

### 13.1 Phase 0 出口（必须全过）

| 项 | 验收 |
|---|---|
| BFF 宿主/运行时/区域 | 记录实际 hostname/runtime/region/TLS 证书；staging 访问日志/截图 |
| Redis / 会话 / 撤销 epoch | 记录 endpoint/库/owner/TTL/HA；smoke 日志 |
| 密钥管理 | 记录 secret manager 路径/owner/最小权限/轮换证据 |
| 反代规则 | `/api/auth/*` 同源到 BFF；不缓存；不透传入站 `X-User-*` |
| 健康检查 | `/api/auth/health`；BFF 不健康时登录 CTA fail closed |
| 双区 client/tenant | `.cn`/`.com` client 均归属 `union`；redirect、secret、scopes、`default_resource` |
| 平台改造设计 | B1/B2/B6 的方案、测试、发布/回滚窗口已评审 |
| 回滚 | 关 BFF 开关 + 清会话 + 停 client + 平台回滚；不回退 identity |

总计：**约 5–6 周**（含平台改造与撤销）。

---

## 14. 风险 / 回滚

| 风险 | 缓解 |
|---|---|
| 平台 B1/B2 延期 | Phase 0 先做平台改造；AI 登录 feature flag 隐藏；不降级到 identity |
| BFF 宿主未定 | Phase 0 出口列明宿主/Redis/TLS/反代/密钥/健康/回滚 |
| 撤销链路复杂 | backchannel + epoch 双保险；≤5 分钟测试 |
| 双区漂移 | 每区独立 client/issuer；E2E 两区 |
| 租户迁移 | 自助注册 + 邀请/迁移文档 |
| 回滚 | 关 BFF 开关 + 清会话 + 停 client + 回滚平台 B1/B2 + **不回退 identity**（fail closed） |

---

## 15. 交付物

| 类型 | 内容 |
|---|---|
| 方案 | 本文件 |
| 契约 | `docs/AI-LOGIN-BFF.md` |
| 平台 | service-oauth B1/B2/B6；site-auth 注册；identity QR 门禁 |
| 前端 | `/ai/login` + 组件 + `ai-auth.ts` |
| BFF / SDK | `sdk/packages/ai-auth` + `/api/auth/*` 薄路由；Cloudflare/Vercel/Node 适配器；内部 JWT |
| 测试 | 单测/集成/E2E/安全/真机 |
| 观测 | 登录成功率/失败原因/撤销延迟/换码失败；日志脱敏 |
| 文档 | runbook（登录、撤销、密钥轮换、数据删除） |

---

## 15.1 实施状态（2026-11-23）

| 件 | 位置 | 状态 | 验证 |
|---|---|---|---|
| 平台 B1 client `access_token_format` | service-oauth（补丁） | 完成 | `access_token_format_test.go`；`go test ./...` 全绿 |
| 平台 B2 `AllowedAudiences` | service-oauth（补丁） | 完成 | 平台/AI/未登记 aud 三例 |
| 平台 B6 `consent-status` + 专用单键 | service-oauth（补丁）+ 网关（补丁） | 完成 | `consent_status_test.go`；`AI_BFF_API_KEY` 空 = 401 |
| grant_types 执行 | service-oauth：authorize / client_credentials / device / refresh | 完成 | `grant_type_guard_test.go` |
| SDK `@autional/ai-auth` | `sdk/packages/ai-auth`（新包补丁） | 完成 | 10/10 `node --test`；tsc 0 错 |
| BFF `/api/auth/*` | `web/server/ai-auth/*` + 香港 `ai-bff-cn/com` 容器 | 完成（香港自托管） | 公网 302 + Cookie 属性；`/api/auth/session` 200；无 Vercel |
| 静态站部署 | 香港 `sites-static` + `container.conf` `/api/auth/` 反代 | 完成（2026-11-24） | `www.autional.cn/.com/ai/login` 上线；OAuth 按钮可达 `/union/login` |
| E2E（真实浏览器） | 注册 → 回 authorize → 同意 → callback → session | **PASS 2026-11-24** | 新 union 账号无邮箱也登录成功；BFF session 显示 union sub |
| B6 撤销实测 | 软删 consent → 65s 后重载 `/ai/login` | **PASS** | 会话失效回登录页（缓存 60s + 检查） |
| 注册回程 | 登录页注册链接携带 `redirect`；注册成功回 authorize | **PASS** | auth 站已发布，链接含 authorize query |
| 前端 OAuth 模式 | `web/src/components/ai-login/*`、`ai-auth.ts` | 完成 | i18n 520/520、astro check 0/0/0、build 78 页 |
| 注册回程 | site-auth 登录→注册透传 `redirect`；注册成功回 authorize | 完成 | auth-pages `tsc --noEmit` 通过 |
| 生产 client/secret/env | union 租户 + 香港 BFF env | **完成** | `.cn`=`client-5Ssb62kMToQK`，`.com`=`client-7DdSfmWupJgf`；secret 在 `D:\ws\autional\.local\ai-oauth-clients.json`（不入库）；metadata `access_token_format=jwt` 已生效（B1 实测 JWT AT aud=AI 资源） |
| union 登录/注册策略 | 生产 API | **已执行 2026-11-24** | `login_methods=[password,qr,email_code,passkey]`、`passkey_enabled=true`、`membership_approval=open`；公开 auth-config 与登录/注册页已回读验证 |

实际部署（2026-11-24）：union auth-policy 已改、client 已建、B1/B2/B6 二进制已换装（`cloud-identity` 重启）、consent-status 已由 ingress 窄路由暴露、香港 `ai-bff-cn/com` 容器与 `sites-static` 的 `/api/auth/` 反代已上线、web `.cn`/`.com` 已发布。**待办**：service-oauth / infra-ops / SDK / web / auth-pages 的源码提交与补丁回写（当前 live 领先于 git）。

> 2026-11-23 实测：`union` 公开 auth-config 返回 `login_methods=["password"]`、`passkey_enabled=false`、`membership_approval="invitation_only"`。不改这三项，OAuth 流程会在平台登录页退回密码/无法注册；AI 站本身仍不显示密码。

---

## 16. 已拍板

| # | 决策 | 结果 |
|---|---|---|
| 1 | 平台 B1+B2 | **纳入本期** |
| 2 | 撤销语义 | **立即/≤5 分钟** |
| 3 | 租户模型 | **固定 `union` + 跨租户用户（family-domain federation）；数据按 `(iss,sub,tenantId)`** |
| 4 | scopes | `openid email` |
| 5 | BFF 宿主 | 同源 `/api/auth/*`（Phase 0 定运行时） |
| 6 | 会话 TTL | 30m idle / 8h absolute |

---

## 17. 附录：平台事实 / 证据

| 事实 | 证据 |
|---|---|
| ID Token 无 email | `service-oauth/internal/service/oidc_signer.go:60-103` |
| userinfo 仅 email scope 返回 email/email_verified | `service-oauth/internal/handler/handler_userinfo.go:88-99,327-341` |
| 机密客户端默认 opaque（flag=jwt 时走 JWT） | `service-oauth/internal/service/service.go`（本次补丁：CreateAccessToken） |
| JWT 路径与 `default_resource` aud | 同左（本次补丁：fail-closed 资源校验） |
| userinfo aud 白名单（本次已改） | `effectiveJWTConfig`：`AllowedAudiences` |
| scope_guard | `service-core/micro-middleware/auth/scope_guard.go:69-121` |
| 同意页/PKCE/nonce | `site-auth/app/oauth/authorize/page.tsx` |
| 注册链接丢 redirect（本次已修：透传 `redirect`） | `site-auth/apps/auth-pages/src/app/page.tsx:1355-1370` |
| 注册成功固定 dashboard（本次已修：回 authorize） | `site-auth/apps/auth-pages/src/app/register/page.tsx:557-575` |
| discovery canonical + `/bff` 别名 | 线上 discovery；`sites.manifest.json:492-493` |
| backchannel logout **未实现** | 线上 discovery `backchannel_logout_supported: false`；`service-oauth/internal/handler/dto/dto.go:704-707` 明确未实现，不得广播 true；`service-identity/oidc_session_handler.go` 只是接收端 |
| 撤销现状 | `RevokeConsent` 只删 opaque AT/RT（`service-oauth/internal/service/service.go:1793-1817`）；JWT AT 不落库；需新增 epoch/consent-status |
| B1（本次补丁已实现） | `access_token_format=jwt` 落 metadata；机密客户端 JWT AT `aud=default_resource`；缺/非 HTTPS/平台资源 fail-closed |
| B2（本次补丁已实现） | `effectiveJWTConfig` 改 `Audience=""` + `AllowedAudiences={平台} ∪ OAUTH_ALLOWED_RESOURCES` |
| grant_types（本次补丁已实现） | authorize/client_credentials/device/refresh 四处校验；空列表历史 client 放行 |
| 设备流缺页 | `service-oauth/.../device_authorization_handler.go`；`site-auth/src/app` 无 `device` |
| identity QR 无门禁 | `service-identity/internal/handler/qr_login_handler.go`；对比 `auth_handler.go:1124` |
| 当前实现未部署 | 本地文件（web 仓未提交）；线上 `/ai/login` 仍 404；待补丁/部署 |
| union 固定租户 | `01M60J7J1WZRC0K3BSSVS5J6S1`，display “Autional”；`.cn`/`.com` 公开租户列表均可见；`TENANT-INVENTORY-20261111.md` 保留 |
| union 联邦 | `AUTIONAL_UNION_TENANT_ID`（identity/oauth env）；union 内已有 “Autional Federation RP” idp client（`client-0hHPPT5AloZy`） |
| 跨租户放行 | `cross_tenant_gate.go:112-130`：非 idp client 且全部 redirect URI 在平台家族域 → 放行；ID Token 带用户租户 |
