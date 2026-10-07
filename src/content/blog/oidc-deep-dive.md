---
title: "OpenID Connect 深入解析：ID Token、UserInfo 与 Claims 详解"
date: "2026-05-22"
category: "Tech"
tags: ["OIDC", "OpenID Connect", "OAuth"]
readTime: "10 分钟"
excerpt: "OIDC 是构建在 OAuth 2.0 之上的身份层。本文深入解析 ID Token 的结构（JWT claims）、UserInfo 端点的作用、授权码/Implicit/混合三种流程的差异，以及 Autional oauth-service 如何提供完整的 OIDC Provider 能力。"
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

OAuth 2.0 解决了「授权」问题——让第三方应用获得访问资源的能力。但它从未解决一个前置问题：**这个用户是谁？**

OAuth 2.0 没有定义身份信息的标准格式。每个实现各自定义获取用户数据的 API，导致生态割裂。OpenID Connect（OIDC）正是为填补这一空白而生——它是构建在 OAuth 2.0 之上的一个**身份层**。

## OIDC 是什么？

OIDC 全称 OpenID Connect 1.0。一句话概括：

> **OIDC = OAuth 2.0 + ID Token + UserInfo + 标准化的身份 Claims**

OAuth 2.0 给你一个 `access_token` 用于访问用户资源；OIDC 额外提供一个 `id_token`（JWT 格式），告诉你用户是谁。

理解两者关系的最简单方式：

| | OAuth 2.0 | OIDC |
|---|-----------|------|
| 核心产物 | access_token | id_token + access_token |
| 解决的问题 | 「这个应用能访问我的照片吗？」 | 「我是谁？请验证我的身份」 |
| 客户端角色 | 代表用户访问资源 | 验证用户身份 |
| 信息格式 | 无标准（由资源服务器自定义） | 标准化的 JWT claims |
| 典型场景 | 让 Gmail 读取你的 Google Drive 文件 | 用 Google 账号登录第三方网站 |

## ID Token：OIDC 的灵魂

ID Token 是 OIDC 的核心创新。它是由授权服务器签名的 JWT，包含一组标准化的身份 claims。

### ID Token 结构

```json
// Header
{
  "alg": "RS256",
  "kid": "2026-key-01",
  "typ": "JWT"
}

// Payload
{
  "iss": "https://iam.tianv.com",                    // Issuer
  "sub": "01ARZ3NDEKTSV4RRFFQ69G5FAV",           // Subject (user unique ID)
  "aud": "app_client_id_12345",                   // Audience (must be the client's client_id)
  "exp": 1715693800,                              // Expiration time
  "iat": 1715690200,                              // Issued at
  "auth_time": 1715690200,                        // Last authentication time
  "nonce": "n-0S6_WzA2Mj",                       // Anti-replay
  "name": "Zhang San",
  "email": "zhangsan@example.com",
  "email_verified": true,
  "picture": "https://avatar.example.com/zhangsan.jpg",
  "phone_number": "+8613800138000",
  "phone_number_verified": false,
  "preferred_username": "zhangsan",
  "locale": "zh-CN",
  "zoneinfo": "Asia/Shanghai",
  "updated_at": 1715600000,
  "tenant_id": "tenant_abc123",                   // Autional extension: multi-tenant identifier
  "roles": ["admin", "developer"]                 // Autional extension: role claims
}
```

### 标准 Claims 详解

**必需 Claims（按 OIDC 规范）：**

- `iss`（Issuer）：令牌的签发者。必须是包含协议、主机名、可选端口与路径，但不含查询参数或 fragment 的 HTTPS URL。RP 必须精确校验该值。
- `sub`（Subject）：用户的唯一标识符。同一 Issuer 下同一用户的 `sub` 始终一致。**但不同 client_id 可能收到不同的 `sub` 值**（Pairwise Subject Identifier，成对主体标识符），除非使用公开主体标识符。
- `aud`（Audience）：令牌的目标受众。必须包含客户端的 `client_id`。如果 ID Token 有多个受众，则必须出现 `azp`（Authorized Party，授权方）claim 来指明实际被授权的客户端。
- `exp`（Expiration）：过期时间。客户端必须校验 ID Token 未过期。
- `iat`（Issued At）：签发时间。客户端可用它拒绝时间戳明显错误的令牌（如来自未来的时间）。

**推荐 Claims：**

- `auth_time`（Authentication Time）：用户最近一次认证的时间戳。用于判断是否需要重新认证——如果用户很久没有认证，即使 ID Token 未过期也应要求重新登录。
- `nonce`：客户端在认证请求中发送的随机字符串，ID Token 中必须原值返回。这是关键的防重放机制。

**用户信息 Claims（定义于 OpenID Connect Core 1.0 第 5.1 节）：**

| Claim | 类型 | 说明 |
|-------|------|-------------|
| `name` | string | 全名 |
| `given_name` | string | 名 |
| `family_name` | string | 姓 |
| `email` | string | 邮箱地址 |
| `email_verified` | boolean | 邮箱是否已验证 |
| `picture` | string | 头像 URL |
| `phone_number` | string | 手机号（E.164 格式） |
| `phone_number_verified` | boolean | 手机号是否已验证 |
| `locale` | string | 语言与地区设置（BCP47） |
| `zoneinfo` | string | 时区（如 `Asia/Shanghai`） |

### ID Token 校验流程

客户端（RP）收到 ID Token 后，必须执行以下校验：

```
1. Verify JWT signature (using the public key from JWK endpoint)
2. Verify iss (matches expected issuer)
3. Verify aud (includes own client_id)
4. Verify exp (token not expired)
5. Verify iat (token not issued in the future)
6. If nonce present, verify it matches the value sent in the request
7. If using Authorization Code Flow, verify c_hash (Code Hash)
8. If using Implicit/Hybrid Flow, verify at_hash (Access Token Hash)
```

第 7、8 步——哈希校验——是最容易被忽略却至关重要的一环。它们把 ID Token 与授权码或访问令牌绑定，防止混淆攻击。

Autional oauth-service 在签发 ID Token 时自动计算并内嵌 `c_hash` 与 `at_hash`。客户端 SDK 在校验时自动验证。

## UserInfo 端点

除了 ID Token 中内嵌的 claims，OIDC 还定义了 UserInfo 端点。这是一个受 OAuth 2.0 保护的 API 端点，客户端携带 access_token 访问，以获取当前用户的身份信息。

### UserInfo 端点与 ID Token 对比

| | ID Token | UserInfo 端点 |
|---|----------|------------------|
| 获取方式 | 认证流程结束时直接返回 | 单独发起 API 调用 |
| 认证方式 | 无需凭证（自签名 JWT） | 需要 access_token |
| 内容 | 固定的 claims 集合 | 按 scope 动态返回内容 |
| 实时性 | 签发时刻的快照 | 实时查询 |
| 适用场景 | 基础身份信息（姓名、邮箱等） | 最新的或额外的用户信息 |

**最佳实践**：用 ID Token 做认证确认（「验证这个用户是谁」），用 UserInfo 端点获取详细的用户信息。对敏感或强时效的用户属性，不要只依赖 ID Token，因为它可能被缓存。

当客户端请求 `openid profile email` 这些 scope 时，Autional 会在 UserInfo 端点响应中包含对应的 claims：

```json
{
  "sub": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  "name": "Zhang San",
  "given_name": "San",
  "family_name": "Zhang",
  "email": "zhangsan@example.com",
  "email_verified": true,
  "picture": "https://avatar.example.com/zhangsan.jpg",
  "updated_at": 1715600000
}
```

## OIDC 的三种流程

OIDC 继承了 OAuth 2.0 的授权流程并叠加身份信息。主要有三种流程：

### 1. 授权码流程

这是最安全的流程。授权码经前端浏览器传递（不暴露给 JavaScript），令牌则通过后端通道换取。PKCE 提供额外一层保护。Autional 默认使用该流程。

### 2. Implicit 流程——已废弃

OAuth 2.1 已正式移除 Implicit 流程。它通过前端 URL fragment 直接返回令牌，带来严重的安全风险——令牌会暴露在浏览器历史与 referrer 请求头中。如果你还在使用，现在是迁移的时候了。

### 3. 混合流程

混合流程是授权码流程与 Implicit 流程的组合——前端直接拿到 ID Token（用于立即展示用户信息），后端用授权码换取访问令牌。适用于既需要前端即时展示、又需要后端安全访问的场景。

Autional oauth-service 支持全部三种流程，但在管理后台新建客户端注册时，默认只允许授权码流程（带 PKCE）。

## 请求 Scope 与 Claims

OIDC 用 scope 参数控制返回哪些 claims：

| Scope | 含义 | 返回的 Claims |
|-------|---------|-----------------|
| `openid` | 请求 OIDC 认证（必需） | `sub`、`iss`、`aud`、`exp`、`iat` |
| `profile` | 基础用户信息 | `name`、`family_name`、`given_name`、`picture`、`locale`、`zoneinfo`、`updated_at` |
| `email` | 邮箱信息 | `email`、`email_verified` |
| `address` | 地址信息 | `address`（JSON 对象） |
| `phone` | 手机号信息 | `phone_number`、`phone_number_verified` |

此外，OIDC 支持 `claims` 请求参数，允许客户端精确请求特定 claims：

```
GET /authorize?
  ...
  &claims={
    "id_token": {
      "email": {"essential": true},
      "email_verified": {"essential": true}
    },
    "userinfo": {
      "name": null,
      "picture": null
    }
  }
```

Autional oauth-service 完整实现了标准 scope 映射与 claims 请求参数解析，并支持在管理后台为每个客户端配置允许的 scope 范围。

## Autional 作为 OIDC Provider

Autional oauth-service 是一个完整的 OIDC Provider，实现以下端点：

```
/.well-known/openid-configuration     # OIDC Discovery document
/oauth/authorize                      # Authorization endpoint
/oauth/token                          # Token endpoint
/oauth/userinfo                       # UserInfo endpoint
/oauth/jwks                           # JWK endpoint (public keys)
/oauth/revoke                         # Token revocation endpoint
/oauth/introspect                     # Token introspection endpoint
```

### 多租户支持

每个租户可以拥有独立的 OIDC 域名与配置：

```
https://tenant-a.iam.tianv.com/.well-known/openid-configuration
https://tenant-b.iam.tianv.com/.well-known/openid-configuration
```

每个租户的 JWK 密钥对独立管理，密钥轮换在租户级别进行。这意味着某个租户的密钥泄露不会影响其他租户。

### 自定义 Claims 映射

Autional 允许租户管理员配置自定义 claims 映射：

```yaml
# Tenant configuration
oidc:
  claims_mapping:
    id_token:
      tenant_id: "{{.User.TenantID}}"
      roles: "{{.User.Roles}}"
      department: "{{.Profile.Department}}"
    userinfo:
      organization: "{{.Profile.Organization}}"
      employee_id: "{{.Profile.EmployeeID}}"
```

这些模板在令牌签发时动态渲染，让每个租户都能把自己的业务字段映射进 OIDC claims。

### 安全特性

1. **强制 HTTPS**：OIDC Discovery 文档中的所有端点 URL 必须使用 HTTPS。Autional 在部署层通过 nginx 反向代理强制 HTTPS。

2. **PKCE 强制**：对公开客户端（SPA 与移动应用），PKCE 强制启用且不可关闭。这遵循 OAuth 2.1 的安全最佳实践。

3. **令牌绑定**：自动计算并内嵌 `c_hash` 与 `at_hash`，防止混淆攻击。

4. **成对主体标识符（Pairwise Subject Identifier）**：针对隐私敏感场景，Autional 支持为不同客户端生成不同的 `sub` 值，防止跨客户端追踪用户。实现基于 `sub = SHA-256(client_id || user_id || sector_identifier_uri)`。

## 客户端集成示例

以下是与 Autional 对接的标准 OIDC 客户端集成：

```javascript
// 1. Discover OIDC Provider configuration
const config = await fetch(
  'https://iam.tianv.com/.well-known/openid-configuration'
).then(r => r.json());

// 2. Build authorization request
const authUrl = new URL(config.authorization_endpoint);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('client_id', 'your_client_id');
authUrl.searchParams.set('redirect_uri', 'https://yourapp.com/callback');
authUrl.searchParams.set('scope', 'openid profile email');
authUrl.searchParams.set('state', generateRandomState());
authUrl.searchParams.set('nonce', generateRandomNonce());
authUrl.searchParams.set('code_challenge', await pkceChallenge());
authUrl.searchParams.set('code_challenge_method', 'S256');

// 3. Redirect user to authorization page
window.location.href = authUrl.toString();

// 4. Handle response in callback URL
// 5. Exchange code for token
// 6. Verify ID Token
// 7. Extract user info
```

Autional 提供 Go、JavaScript、Python、Java 的官方 OIDC 客户端 SDK，封装了 PKCE、JWT 校验与令牌管理的复杂逻辑。

## 总结

OIDC 是当今采用最广泛的标准化身份协议。它把 OAuth 2.0 从纯粹的授权协议提升为完整的身份认证协议，并通过 ID Token 的标准化 claims 格式，实现了跨系统的用户身份互通。

Autional oauth-service 作为完整的 OIDC Provider，提供：
- 完整的 OIDC 端点（Authorization、Token、UserInfo、JWK、Discovery）
- 多租户隔离的域名与密钥管理
- 灵活的自定义 claims 映射
- PKCE 强制、令牌绑定、成对主体标识符等安全特性
- 多语言客户端 SDK

无论你是自建身份系统还是集成第三方登录，OIDC 都是现代身份架构的基石。
