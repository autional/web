---
title: "SSO 协议对比：SAML vs OAuth 2.0 vs OIDC vs CAS"
date: "2026-06-15"
category: "Tech"
tags: ["SSO", "SAML", "OAuth", "OIDC"]
readTime: "10 分钟"
excerpt: "SAML、OAuth 2.0、OIDC、CAS——四个名字、四种协议、四种截然不同的设计哲学。很多工程师分不清 OAuth 2.0 与 OIDC，而一些企业用户死守 SAML 拒绝 JWT。本文从协议历史、工作原理、适用场景三个维度系统拆解这四种 SSO 协议，并给出按业务需求选型的决策指南。"
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

如果说 HTTP 是 Web 的通用语言，那么 SSO 协议就是身份认证的通用语言。遗憾的是，与 HTTP 不同，这个领域并没有唯一的标准——我们至少有四个「标准」，每个都有自己的拥护者与适用场景。更麻烦的是，它们名称之间的关系存在微妙的交叉，很容易被误解。

本文试图用最通俗的语言回答三个问题：**每种协议是怎么工作的？它们之间的真正差异是什么？什么场景该用哪一种？**

## 协议速览

| 协议 | 诞生年份 | 核心目的 | 数据格式 | 传输方式 | 主要场景 |
|----------|------|--------------|-------------|-----------|------------------|
| SAML 2.0 | 2005 | 联邦身份（SSO） | XML | HTTP Redirect + POST | 企业 B2B SSO |
| OAuth 2.0 | 2012 | 授权 | JSON / 任意 | HTTP（Bearer Token） | API 授权、第三方登录 |
| OIDC | 2014 | 认证 | JSON（JWT） | HTTP（基于 OAuth 2.0） | 现代应用 SSO、移动端 |
| CAS | 2002 | Web SSO（教育） | XML / JSON | HTTP Redirect + Ticket | 高校、科研机构 |

一个关键认知：**OAuth 2.0 是授权协议，不是认证协议。** 这大概是业界被误解得最多的技术事实。OAuth 2.0 回答的是「应用 A 能否访问用户在服务 B 上的数据？」，而不是「你是谁？」。OIDC 在 OAuth 2.0 之上增加了一个身份层（`id_token`），把授权协议扩展成了认证协议。

## SAML 2.0：企业界的通行证

### 背景

SAML（Security Assertion Markup Language）诞生于 2002 年，最后一个大版本 SAML 2.0 于 2005 年发布，由 OASIS 标准组织维护。在云计算之前，企业系统的互通（例如员工用一个账号登录 CRM、ERP、OA）主要依靠 SAML。直到今天，它仍是 B2B 企业 SSO 事实上的标准——几乎所有主流企业身份源（Okta、Azure AD、OneLogin）都把 SAML 作为主打协议。

### 工作原理

SAML 涉及三个角色：

- **Principal（用户）**：通过浏览器访问应用的人
- **Identity Provider / IdP（身份提供方）**：负责认证用户并签发断言
- **Service Provider / SP（服务提供方）**：接收断言并放行用户访问应用

完整的 SAML 2.0 Web Browser SSO 流程：

```
1. User accesses SP (e.g., salesforce.com)
2. SP checks if user is authenticated → not authenticated
3. SP generates SAML AuthnRequest, redirects user's browser to IdP via HTTP Redirect
4. IdP authenticates user (e.g., password + TOTP)
5. IdP generates SAML Assertion (containing user identity and attributes), redirects browser back to SP via HTTP POST
6. SP validates the Assertion's signature (using IdP's public key)
7. SP establishes user session, grants access
```

关键安全机制：

- **XML 数字签名**：SP 使用 IdP 的公钥验证断言未被篡改
- **NotBefore / NotOnOrAfter**：断言带有时间窗口，过期断言无效
- **InResponseTo / ID**：每一对 AuthnRequest 与 Response 都有唯一 ID 绑定，防止重放攻击

### 优势与不足

**优势**：

- 久经考验（20 多年生产验证），安全性经过充分检验
- 属性传递能力丰富（SAML Attribute Statement 可传递任意属性）
- 支持 IdP 发起的 SSO（用户在 IdP 门户点击应用图标即可直接登录，无需先访问 SP）
- 企业生态成熟（各大 SaaS 平台都支持 SAML）

**不足**：

- XML 臃肿——一个 SAML Response 可达数十 KB，而等效的 JWT 只有几百字节
- 签名校验计算开销大（XML 规范化 + XML Signature 非常吃 CPU）
- 对移动端不友好——SAML 面向桌面浏览器时代设计，HTTP Redirect + POST 绑定在移动 App 中实现复杂
- 配置繁琐——IdP 与 SP 需要交换元数据 XML 文件、手工建立信任关系
- 调试困难——XML 格式的断言不直观，排障需要专门的 SAML 调试工具

### 适用场景

- **企业 B2B SSO**：你的客户是使用 Okta / Azure AD / OneLogin 作为 IdP 的大型企业
- **政府 / 教育**：这些行业的 IT 标准更新周期较长，内部系统互通以 SAML 为主流
- **需要丰富的属性交换**：如果 SSO 不仅需要认证，还需要传递组织结构、角色、部门等信息，SAML 的 Attribute Statement 比 JWT claims 更灵活

## OAuth 2.0：不只是「授权」

### 核心概念

OAuth 2.0（RFC 6749）定义了一套授权框架，允许第三方应用在资源所有者（用户）的授权下，获得对受保护资源的有限访问权限。核心角色：

- **Resource Owner（资源所有者）**：即用户
- **Client（客户端）**：第三方应用（例如需要读取你 Google 日历的日历应用）
- **Authorization Server（授权服务器）**：例如 Google 的 OAuth 端点
- **Resource Server（资源服务器）**：例如 Google Calendar API

### 四种授权模式

OAuth 2.0 为不同场景定义了四种授权模式：

1. **授权码模式（Authorization Code Grant）**：最安全、最常用。适用于有后端的 Web 应用。客户端不接触用户凭据，而是用一次性的授权码换取访问令牌。**强烈建议配合 PKCE（Proof Key for Code Exchange）使用，防止授权码被拦截。**

2. **客户端凭证模式（Client Credentials Grant）**：用于机器对机器通信。例如 `audit-service` 调用 `identity-service` 的内部 API，直接用 `client_id + client_secret` 获取令牌。

3. **隐式模式（Implicit Grant）**：已废弃。历史上用于纯前端 SPA，但因令牌暴露在 URL fragment 中而不安全。RFC 8252 建议改用 Authorization Code + PKCE。

4. **密码模式（Resource Owner Password Credentials Grant）**：已废弃。用户直接把用户名密码交给客户端换取令牌。这不安全（客户端能看到用户凭据），也违背 OAuth 的设计初衷。

### 常见误区澄清

**误区一**：「OAuth 2.0 可以用来做登录（认证）。」

OAuth 2.0 本身**不能**用于认证。当你点击「使用 Google 登录」时，实际使用的是 OIDC（构建在 OAuth 2.0 之上的认证协议），而不是纯粹的 OAuth 2.0。OAuth 2.0 只给你一个 `access_token`——这个令牌说明「你可以访问资源」，但没有说明「你是谁」。只有 `id_token`（由 OIDC 补充）才包含用户身份信息。

**误区二**：「OAuth 2.0 比 SAML 更安全。」

两者解决的是不同的安全需求。SAML 更适合联邦场景（跨组织），OAuth 2.0 更适合授权场景（跨应用）。不是谁更安全，而是谁更适合你的场景。

### Autional 对 OAuth 2.0 的支持

Autional 的 `oauth-service` 完整支持：

- Authorization Code Grant + PKCE
- Client Credentials Grant
- 刷新令牌轮换（每次使用刷新令牌都会同时签发新的刷新令牌，旧的失效）
- Token Introspection（RFC 7662）
- Token Revocation（RFC 7009）
- 自定义 scope 与 claim

## OIDC（OpenID Connect）：现代 SSO 的王者

### OIDC 与 OAuth 2.0 的关系

OIDC 是构建在 OAuth 2.0 之上的**身份认证层**。它在 OAuth 2.0 的协议流程上增加了两个核心内容：

- **`id_token`**：包含用户身份信息（`sub`、`name`、`email` 等 claim）的 JWT。这正是 OAuth 2.0 所缺少的，也是 OIDC 能用于认证的原因。
- **UserInfo Endpoint**：由 `access_token` 保护的 API，返回标准化的用户信息。

```
OAuth 2.0:  access_token → authorization ("what you can access")
OIDC:       id_token     → authentication ("who you are") + authorization
```

**一个比喻帮你彻底分清**：OAuth 2.0 像酒店房卡——它证明你有权进入某个房间，但不能证明你是谁。OIDC 像身份证——它证明你的身份（姓名、出生日期），顺带也让你能进入某些场所。

### OIDC 认证流程

OIDC 基于 OAuth 2.0 的授权码模式，但在请求中增加了 `openid` scope，并在响应中返回 `id_token`：

```
1. RP (Relying Party, i.e., your application) redirects the user to OP (OpenID Provider, i.e., the auth service)
   GET /authorize?response_type=code&scope=openid+profile+email&client_id=xxx&redirect_uri=xxx

2. OP authenticates the user, returns an authorization code

3. RP exchanges the authorization code for tokens
   POST /token → { access_token, id_token, refresh_token }

4. RP validates the id_token's signature and claims (iss, aud, exp, sub)
   Validation passes → user is authenticated

5. (Optional) RP uses access_token to call the UserInfo Endpoint for additional attributes
```

### OIDC 的优势

- **基于 JWT**：轻量（几百字节 vs SAML 的数十 KB），JSON 格式可读性强，各语言都有成熟的 JWT 库
- **移动端友好**：基于 RESTful HTTP，不像 SAML 那样依赖浏览器重定向
- **发现机制**：通过 `/.well-known/openid-configuration` 端点自动发现 OP 配置（端点、支持的 scope、加密算法），零手工配置
- **会话管理**：RP-Initiated Logout、Session Management、Back-Channel Logout 等规范提供完整的会话生命周期管理
- **兼容 OAuth 2.0**：支持 OIDC 的服务自然支持 OAuth 2.0

### Autional 对 OIDC 的支持

Autional 的 `oauth-service` 是完整的 OpenID Provider：

- 支持 OIDC Discovery（`/.well-known/openid-configuration`）
- 支持 `id_token` 的 RS256 签名与校验
- 支持标准 claim：`sub`、`name`、`email`、`email_verified`、`phone_number`、`preferred_username`、`picture`
- 支持自定义 claim（例如 `tenant_id`、`role`）
- 支持 RP-Initiated Logout 与 Session Management
- 支持 Dynamic Client Registration（RFC 7591）

## CAS：教育界的明珠

### 历史地位

CAS（Central Authentication Service）由耶鲁大学于 2002 年创建，后来成为 Jasig（现 Apereo 基金会）的开源项目。它是中国高校、科研机构以及部分政府单位最常见的 SSO 协议——几乎所有「统一身份认证平台」都建立在 CAS 或类 CAS 实现之上。

### 工作原理

CAS 的设计非常简单，涉及三个核心角色：

```
1. User accesses App
2. App checks for a valid CASTGC cookie (CASTGC = CAS Ticket Granting Cookie)
3. If none, redirect to CAS Server
4. CAS Server authenticates user, sets CASTGC cookie, issues ST (Service Ticket)
5. CAS Server redirects user back to App with ST in the URL
6. App uses ST to make a backend validation request to CAS Server (/serviceValidate)
7. CAS Server returns user information (XML/JSON)
8. App establishes local session
```

### CAS vs SAML vs OIDC

| 特性 | CAS | SAML | OIDC |
|---------|-----|------|------|
| 复杂度 | 低 | 高 | 中 |
| 数据格式 | XML / JSON | XML | JSON（JWT） |
| 会话管理 | CASTGC cookie | 依赖 SP 本地会话 | Session Management / Logout Token |
| 单点登出（SLO） | 支持但有限 | 支持 | 支持（多种模式） |
| 移动端支持 | 差 | 差 | 好 |
| 行业采用 | 教育 / 政府 | 企业 B2B | 互联网 / 现代应用 |

### CAS 为何在教育领域长盛不衰

1. **简单**：协议概念少（TGT + ST，就两个票据），部署与集成的学习成本低
2. **历史惯性**：中国高校的 IT 建设起步较早（约 2010 年），当时 OIDC 尚未出现，SAML 太重，CAS 是自然之选
3. **扩展生态丰富**：Apereo CAS 有 100 多个插件，支持多种认证方式（LDAP、JDBC、SPNEGO、Radius 等）
4. **校际联邦**：通过 Shibboleth 或 CAS 协议，高校之间可以建立身份联邦（如 CARSI / eduGAIN）

### CAS 的局限

- 移动端支持弱（协议原生面向浏览器）
- 没有标准化的用户属性传递方式（相比 SAML Attribute Statement 与 OIDC claim）
- 社区主要活跃在教育领域，企业采用率低
- 协议规范不如 SAML/OIDC 正式（未 RFC 标准化）

## 协议选型决策指南

### 按业务场景

| 场景 | 推荐协议 | 原因 |
|----------|---------------------|--------|
| B2B SaaS，对接大型企业 SSO | SAML 2.0 | 企业 IdP 偏好 SAML；OIDC 正在追赶，但 SAML 仍是主流 |
| 现代 Web 应用 + 移动 App | OIDC | JWT 轻量、移动端友好、自动发现、零配置 |
| 纯 API 服务间调用 | OAuth 2.0（Client Credentials） | 无用户参与，服务间直接授权 |
| 「使用 Google/微信/GitHub 登录」 | OIDC（通过对应 Provider） | 社交登录提供方几乎都支持 OIDC |
| 教育 / 科研机构内部 SSO | CAS 或 SAML | 根据目标机构的存量基础设施选择 |
| 中国政府 / 国企项目 | CAS（常见）+ SAML（国际化） | 考虑对接方的技术栈历史 |
| 既要企业客户又要移动端 | SAML + OIDC 双协议 | Autional 两者都支持，一个平台全覆盖 |

### Autional 的协议架构

Autional 把全部 SSO 协议整合在 `oauth-service` 中：

```
oauth-service (Port 11006)
├── OAuth 2.0 (RFC 6749)
│   ├── Authorization Code Grant + PKCE
│   ├── Client Credentials Grant
│   ├── Token Introspection (RFC 7662)
│   └── Token Revocation (RFC 7009)
├── OIDC (based on OAuth 2.0)
│   ├── OIDC Discovery
│   ├── id_token (JWT, RS256)
│   ├── UserInfo Endpoint
│   └── RP-Initiated Logout + Back-Channel Logout
├── SAML 2.0
│   ├── SP-Initiated SSO
│   ├── IdP-Initiated SSO
│   ├── SAML Metadata import/export
│   └── Attribute Statement mapping
└── CAS
    ├── CAS 1.0 / 2.0 / 3.0 protocol
    ├── Proxy Ticket (CAS PT) support
    └── CASTGC session management
```

所有协议共享同一套用户源（`identity-service`）、同一套 MFA 策略（`mfa-service`）与同一套审计日志（`audit-service`）。这意味着你可以用一个平台同时服务：前端 SPA 走 OIDC 登录，企业客户走 SAML，内部管理系统走 CAS——它们共享同一份用户身份、安全策略与审计记录。

---

协议是手段，不是目的。选 SAML 不是因为 XML 优雅，选 OIDC 也不是因为 JWT 时髦。选择最契合你的用户技术栈、你的合规要求和你的工程能力的协议——如果用户需要多种协议，就选一个全都支持的平台。Autional 把四种协议统一在 `oauth-service` 中，你不需要为每种协议各维护一套身份系统。

*Autional oauth-service 为企业客户提供完整的 OAuth 2.0、OIDC、SAML 2.0 与 CAS 协议支持。接入指南见[开发者文档](https://developer.autional.cn/api)。*
