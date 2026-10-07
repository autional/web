---
title: "最常见的 7 个认证错误（以及如何修复）"
date: "2026-05-26"
category: "Security"
tags: ["反模式", "安全错误", "最佳实践"]
readTime: "7 分钟"
excerpt: "这些认证错误，你可能每天都在犯。从硬编码 API Key 到永不过期的 JWT，从明文密码到把敏感信息写进日志——本文梳理 7 个最常见的身份反模式，每一条都配有真实的数据泄露案例与可执行的修复方案，并说明 Autional 如何在架构层面消除这些错误。"
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

安全圈有句话：攻击者不需要发现新漏洞——他们只需要找到你还没修的已知问题。

在认证领域尤其如此。以下 7 个错误，十年前的 OWASP Top 10 就已经强调过，但在 2026 年，它们依然出现在每一份安全审计报告的「高危发现」里。

## 错误 1：在代码中硬编码 API Key 与密钥

### 为什么危险

2025 年，GitHub 的自动扫描检测到超过 200 万个公开仓库中含有疑似密钥的提交。一旦你的 API Key、数据库密码或 JWT 签名密钥出现在代码中，它就永远留在 git 历史里——即便你删掉文件再提交一次。

更糟的是，攻击者已经做出了自动化的 GitHub 扫描工具，能在新提交推送后的几秒内提取出密钥并立即尝试使用。

### 真实案例

2024 年，一家估值 15 亿美元的 AI 创业公司发生事故：一名工程师把含有 AWS 根账号密钥的配置文件提交到了公开的 GitHub 仓库。4 小时内，攻击者拉起数百台 GPU 实例用于挖矿，产生了 65 万美元的账单。

### 如何修复

```
Wrong:
const API_KEY = "tk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"  // Hardcoded

Right:
const API_KEY = process.env.AUTHMS_API_KEY  // Environment variable
if (!API_KEY) throw new Error("AUTHMS_API_KEY not set")
```

进一步的做法：
- 把所有密钥迁移到密钥管理服务（KMS）或 Vault
- 在 CI/CD 中集成密钥扫描（如 GitGuardian、truffleHog），拦截含密钥的提交
- 用 `.gitignore` 排除所有包含密钥的配置文件
- 对任何可能已泄露的密钥立即轮换

**Autional 如何防范**：API Key 创建后，完整值只展示一次，数据库中只存 SHA-256 哈希。即便有人拿到了数据库，也无法还原 API Key 明文。服务内部密钥（JWT 签名密钥、加密 DEK）通过环境变量注入或由 KMS 托管——禁止写死在配置文件中。CI 检查脚本会扫描所有 Go 源码与配置文件中的硬编码密钥模式。

## 错误 2：登录端点没有限流

### 为什么危险

没有限流的登录端点，等于向撞库攻击敞开大门。攻击者不需要什么高深技术——一本常见密码字典，加上一个能发 HTTP 请求的脚本就够了。

### 真实案例

2023 年 23andMe 数据泄露事件中，攻击者没有利用任何系统漏洞，而是使用了**撞库**——从其他数据泄露事件中拿到用户名/密码组合，逐个尝试。由于缺乏有效的限流与异常检测，攻击者在数周内攻破了约 14,000 个账号，并通过这些账号抓取了数百万用户的族谱数据。

### 如何修复

至少实现三层限流：
1. IP 级：同一 IP 每分钟不超过 30 次请求
2. 用户级：同一用户每分钟不超过 10 次登录尝试
3. 全局级：登录端点的整体请求速率上限

```
// Right — server-side rate limiting
app.post('/login', rateLimiter({
  windowMs: 60 * 1000,   // 1-minute window
  max: 30,               // Maximum 30 requests
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests' })
  }
}), loginHandler)
```

**Autional 如何防范**：gateway-service 内置三层分布式限流（IP 级、用户级、全局级），支持令牌桶与滑动窗口算法，并基于 Redis 做跨实例计数。触发限流时会施加渐进式惩罚策略。

## 错误 3：用 MD5 或 SHA-1 存储密码

### 为什么危险

MD5 与 SHA-1 是**通用哈希函数**，设计目标是尽可能快。而密码哈希需要的恰恰相反——**尽可能慢**。GPU 每秒可以计算数十亿次 MD5/SHA-1 哈希，使暴力破解变得极其高效。

### 真实案例

2012 年，LinkedIn 泄露了 650 万个密码哈希。LinkedIn 使用的是**未加盐的 SHA-1**。泄露发生后，安全研究人员在 72 小时内破解了其中 90% 的密码。更糟的是，这些被破解的密码被用于对其他站点发起撞库攻击——因为大量用户在不同网站复用同一个密码。

### 如何修复

始终使用专用的密码哈希函数：bcrypt、scrypt 或 argon2id。

```
Wrong:
hash = md5(password)          // Don't. Just don't.
hash = sha1(password)         // Same
hash = sha256(password + "fixed_salt")  // Still not enough

Right:
hash = bcrypt(password, cost=12)  // Simplest choice
hash = argon2id(password, time=3, memory=65536, parallelism=4)  // Best choice
```

如果需要从旧方案迁移：
1. 在数据库中记录当前使用的哈希算法
2. 用户下次登录时：用旧算法校验 → 通过后用新算法重新哈希 → 更新数据库
3. 标记已迁移用户；仍在旧哈希上的用户，在 N 个月后要求重置密码

**Autional 如何防范**：identity-service 默认使用 bcrypt（cost 因子=12），随机盐已内建于哈希中。同时预留 Argon2id 接口，支持透明迁移。CI 禁止在密码相关代码中使用任何 MD5/SHA-1。

## 错误 4：JWT 没有过期时间

### 为什么危险

没有 `exp` 声明的 JWT 理论上永久有效。如果你的系统签发这样的 JWT，攻击者只要拿到任意一个，就能以该用户身份永久访问你的系统。

更隐蔽的变体是：JWT 有过期时间，但太长了——例如 `exp` 设为当前时间 + 365 天。这几乎和不设过期一样危险，因为被窃取的令牌可以在整整一年内被滥用。

### 如何修复

采用「短期访问令牌 + 长期刷新令牌」模式：

```
访问令牌（JWT）：有效期 15 分钟，用于 API 调用认证
刷新令牌（不透明字符串）：有效期 7 天，仅用于获取新的访问令牌
```

```go
// Right way
token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
    "sub": userID,
    "exp": time.Now().Add(15 * time.Minute).Unix(),  // Short-lived
    "iat": time.Now().Unix(),
    "jti": generateJTI(),                             // For revocation
})
```

**Autional 如何防范**：identity-service 在签发 JWT 时强制包含 `exp`（默认 15 分钟）、`iat` 与 `jti`。刷新令牌绑定到 session-service，支持即时吊销。访问令牌的最长有效期可配置，系统管理员可以设置上限。

## 错误 5：管理员账号没有强制 MFA

### 为什么危险

你的系统可能对所有普通用户都强制 MFA，但如果对管理员账号放松了要求，就等于给最具破坏力的攻击者留了最脆弱的入口。

管理后台通常是攻击者的终极目标——因为它能访问所有用户数据、系统配置与审计日志。一个没有 MFA 的管理员账号被攻破，就像把万能钥匙交到攻击者手里。

### 真实案例

2020 年 Twitter 内部工具入侵事件中，攻击者通过社会工程获取了 Twitter 员工的凭据——因为这些员工账号没有强制 MFA。利用内部管理工具，攻击者接管了 130 个高知名度账号（包括 Barack Obama、Elon Musk、Bill Gates），并发布了比特币诈骗信息。

如果那些员工账号被要求使用硬件安全密钥（FIDO2），这次攻击会在第一步就被拦下——因为攻击者无法通过远程社会工程拿到物理密钥。

### 如何修复

```
管理员账号的 MFA 最低要求：
├── 必须使用 FIDO2/WebAuthn（不能只用短信 OTP 或 TOTP）
├── 必须使用硬件安全密钥（不能只用平台内置认证器）
├── 每次登录都必须验证（不允许「记住此设备」）
└── MFA 设备丢失须走审批流程恢复（不允许自助恢复）
```

**Autional 如何防范**：RBAC 系统预置的 `super_admin` 角色强制要求 FIDO2/WebAuthn（Autional 自身也是这样运行的）。管理控制台中的敏感操作（创建 API Key、修改权限、查看审计日志）会触发 MFA 二次验证。管理员 MFA 状态会被持续监控——未启用 MFA 的账号会被标记并告警。

## 错误 6：把密码、令牌等敏感信息写进日志

### 为什么危险

日志系统通常对所有开发者与运维人员开放。如果一次登录请求被完整记录进日志——包括明文密码——那么凡是能看到日志的人实际上都知道了用户的密码。

此外，日志通常会被送到集中式日志系统（ELK、Loki、CloudWatch），其访问控制往往比数据库更宽松。日志还可能被备份到对象存储，进一步扩大暴露面。

### 真实案例

2019 年，Facebook 承认「数百万」Instagram 用户的密码以明文形式存储在其内部日志系统中。这些日志可被 2,000 多名 Facebook 员工访问。虽然未发现内部滥用证据，但事件本身已严重违反 GDPR 与基本安全原则。

### 如何修复

```
Wrong:
logger.Info("login attempt", 
  "username", req.Username, 
  "password", req.Password,    // ← Plaintext password in logs!
  "ip", req.IP)

Right:
logger.Info("login attempt",
  "user_id", userID,
  "ip", req.IP,
  "result", "success")  // Never log passwords/tokens

// Going further: request body redaction
type LoginRequest struct {
    Username string `json:"username"`
    Password string `json:"password" log:"-"`  // Marked as not logged
}
```

**Autional 如何防范**：日志中间件会自动脱敏所有已知敏感字段（`password`、`password_hash`、`access_token`、`refresh_token`、`api_key`、`credit_card`、`id_number`）。GORM 中标记为敏感的字段（`json:"-"`）在日志输出中自动替换为 `[REDACTED]`。CI 检查禁止 `slog.String("password", ...)` 这类写法。

## 错误 7：没有会话吊销机制

### 为什么危险

当用户修改密码、检测到异常登录，或管理员发现可疑活动时，必须能够**立即**终止相关会话。没有这个能力，攻击者在密码修改之后仍能用旧会话继续访问系统——因为他们的会话或 JWT 还没过期。

### 真实案例

2022 年，某 SaaS 协作平台的大客户反馈：他们辞退一名员工并停用其账号后，该前员工在长达 48 小时内仍能通过已登录的移动端应用会话访问公司数据——因为系统没有吊销移动端会话的机制。

### 如何修复

```
完整的会话吊销能力：
1. 用户修改密码 → 自动吊销该用户的所有会话
2. 用户选择「退出所有设备」→ 吊销除当前会话外的全部会话
3. 管理员停用某用户 → 立即终止其所有会话
4. 检测到异常登录 → 吊销异常会话并通知用户
5. 管理员查看并手动终止可疑会话
```

```go
// Revoke all sessions for a user
func RevokeAllSessions(ctx context.Context, userID string) error {
    return sessionService.RevokeByUserID(ctx, userID)
}

// Revoke a single session
func RevokeSession(ctx context.Context, sessionID string) error {
    return sessionService.Revoke(ctx, sessionID)
}
```

**Autional 如何防范**：session-service 维护所有活跃会话的完整记录，并提供 `DELETE /sessions?user_id=X` 与 `DELETE /sessions/{session_id}` 接口用于即时吊销。密码修改、账号停用、异常检测等事件会自动触发对应的会话吊销。即便使用了 JWT（本身不可吊销），gateway-service 在处理敏感操作时也会向 session-service 重新校验会话有效性。

## 反模式速查表

| # | 反模式 | 风险等级 | 修复优先级 | Autional 防护 |
|---|-------------|------------|--------------|----------------|
| 1 | 硬编码密钥 | 致命 | 立即 | KMS 托管 + CI 扫描 |
| 2 | 登录无限流 | 高 | 一周内 | 三层分布式限流 |
| 3 | MD5/SHA1 存密码 | 致命 | 一周内 | bcrypt + 透明迁移 |
| 4 | JWT 无过期时间 | 致命 | 立即 | 强制 exp + 短 TTL |
| 5 | 管理员无 MFA | 致命 | 立即 | RBAC 强制 FIDO2 |
| 6 | 日志记录密码 | 高 | 一周内 | 自动脱敏中间件 |
| 7 | 无会话吊销 | 高 | 一个月内 | session-service |

## 结语

这 7 个错误有一个共同特征：**它们的存在不是因为技术太复杂，而是因为安全意识不足。** 每一个错误都有成熟、现成的解决方案。问题不在于「怎么修」，而在于「意识到需要修」。

Autional 把这些防护全部内建在架构中——不是可选的「安全功能」，而是不可绕过的架构约束。用 Autional 构建的应用默认就避开了这些错误。如果你正在自研身份系统，请逐条对照这份清单检查。你可能会惊讶地发现，其中有几条看起来非常「眼熟」。
