---
title: "限流实战：如何保护登录端点不被压垮"
date: "2026-05-23"
category: "Tech"
tags: ["限流", "DDoS", "安全"]
readTime: "9 分钟"
excerpt: "登录端点是攻击者最爱的靶子。从令牌桶到滑动窗口，从 IP 级到用户级，从单机到分布式——本文通过一次真实的暴力破解场景，逐层剖析限流策略的演进，以及 Autional gateway-service 如何为每个租户提供可配置的多维防护。"
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

周二凌晨 3 点，你的运维群炸了。CPU 飙到 95%，登录端点的 p99 延迟从 50ms 涨到 12 秒。日志显示 `/auth/login` 每秒收到 3000 次请求，来源是分布在全球 200 多个 IP 上的僵尸网络。攻击者正拿着泄露的密码库暴力破解你的登录。

你没有配置任何限流。你的登录端点完全暴露在外。

## 限流不是可选项

登录端点很特殊，必须加以保护：

1. **CPU 密集**：密码校验需要执行 bcrypt/argon2 运算，开销远高于普通 API。一次 bcrypt 校验大约消耗 50-100ms 的 CPU。每秒三千次并发请求，意味着 150-300 个 CPU 核心的持续消耗。
2. **有状态写入**：登录失败会更新 `failed_attempts` 计数器、写审计日志、触发失败次数检查。这些数据库写操作在高并发下会成为瓶颈。
3. **安全风险**：没有限流，攻击者可以在几分钟内尝试数万种密码组合。再强的密码，在足够多的尝试次数面前也终会失守。

## 限流算法的演进

### 第一代：固定窗口计数器

最简单的做法：在固定时间窗口（例如 1 分钟）内统计请求数，超过阈值的请求直接拒绝。

```
Logic:
    key = "ratelimit:login:ip:{client_ip}"
    count = redis.incr(key)
    if count == 1: redis.expire(key, 60)  # 60-second window
    if count > 100: return 429 Too Many Requests
```

**问题：边界突发**

固定窗口有一个严重缺陷——窗口边界处的突发流量不受限制。

```
Timeline:  |──── Minute 1 ────|──── Minute 2 ────|
Requests:        100                 100

But if attackers concentrate requests in the last second of minute 1 and the first second of minute 2:
Timeline:  |────Minute 1─────────|──Minute 2──|
Requests:      98 (59s)   100 (1s)   100 (1s)

In 2 seconds, attackers can send 200 requests, while your rate limit intends 100 per minute.
```

### 第二代：滑动窗口

滑动窗口把时间窗口切分成更小的槽位，从而解决边界突发问题。

```
Timeline (1-min window, 6 slots, 10s each):

┌──────┬──────┬──────┬──────┬──────┬──────┐
│ 0-10s│10-20s│20-30s│30-40s│40-50s│50-60s│
│  15  │  20  │  18  │  12  │   8  │   5  │
└──────┴──────┴──────┴──────┴──────┴──────┘

Current total = 15+20+18+12+8+5 = 78 < 100 → Pass

Next 10 seconds, window advances:

┌──────┬──────┬──────┬──────┬──────┬──────┐
│10-20s│20-30s│30-40s│40-50s│50-60s│60-70s│
│  20  │  18  │  12  │   8  │   5  │   0  │
└──────┴──────┴──────┴──────┴──────┴──────┘

Current total = 20+18+12+8+5+0 = 63 < 100 → Pass
```

滑动窗口比固定窗口精确得多，但在高精度场景下，粒度决定精度，存储成本也随之上升。

### 第三代：令牌桶

令牌桶是业界最流行的限流算法，也是 Autional gateway-service 的默认选择。

```
Token Bucket Model:
┌─────────────────────────┐
│    Token Refiller        │
│  Adds tokens at fixed    │  Rate: r tokens/sec
│  rate. Capacity: b       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│    Token Bucket (cap b)  │
│  ◉ ◉ ◉ ◉ ◉ ◉ ○ ○ ○     │  Current tokens: 6
└───────────┬─────────────┘
            │
            ▼
      Take 1 token → Pass
      No token → Reject
```

核心参数：

- **速率 r**：每秒补充的令牌数（稳态速率）
- **容量 b**：桶中最多可容纳的令牌数（允许的突发量）

这正是令牌桶的精妙之处——**可控的突发**。当 `r=10, b=100` 时：正常情况下每秒放行 10 个请求；但如果桶在空闲期攒满了 100 个令牌，就能瞬间承接 100 个请求，同时不违背长期平均速率。

### 第四代：漏桶

漏桶是令牌桶的镜像：令牌桶以固定速率补充令牌并允许突发；漏桶则以固定速率处理请求，把输出削峰填谷。

```
    Requests in (any rate)
       │  │  │  │  │  │
       ▼  ▼  ▼  ▼  ▼  ▼
┌─────────────────────────┐
│    Leaky Bucket (queue)  │
│  ◉ ◉ ◉ ◉ ◉ ◉ ◉  ...     │  Overflow → drop
└───────────┬─────────────┘
            │
            ▼
      Fixed-rate outflow
```

漏桶适合流量整形的场景——需要向下游服务输出稳定请求速率时。但面对突发流量，漏桶会直接丢弃而非排队，用户体验不如令牌桶。

Autional gateway-service 默认使用令牌桶，并提供配置项，允许租户管理员根据流量特征切换算法。

## 多维度限流：不止于 IP

基于 IP 的限流是最常见的做法，但它有两个局限：

1. **NAT/代理后的用户共用同一 IP**：同一家公司 200 人通过一个出口 IP 访问你的服务——IP 级限流会误伤正常用户。
2. **攻击者使用 IP 池**：手握大量 IP 的攻击者可以对单个账号发起低频、有组织的攻击，每个 IP 都远低于阈值。

成熟的限流策略需要多层配合：

### 第一层：IP 级限流

```
IP-level parameters (Autional defaults):
  - Window: 60 seconds
  - Threshold: 30 requests / window
  - Algorithm: sliding window
```

这是抵御大规模分布式攻击的最外层防线。当单个 IP 的请求量异常时，直接拒绝。

### 第二层：用户级限流

```
User-level parameters:
  - Window: 5 minutes
  - Threshold: 10 requests / window
  - Algorithm: token bucket (r=0.03/s, b=10)
```

这是核心防御层。即使攻击者用不同 IP 针对同一账号，该账号每 5 分钟也最多只能尝试 10 次。这对阻断定向暴力破解至关重要。

### 第三层：全局限流

```
Global parameters:
  - Window: 10 seconds
  - Threshold: 500 requests / window (entire login endpoint)
```

这是灾难保护层。当整体登录请求量远超正常水平（说明正在遭受 DDoS 攻击）时，优先保障其他业务端点的可用性。

### Autional gateway-service 三层配置示例

```yaml
# Tenant admin configuration in Autional admin console
rate_limiting:
  login_endpoint:
    ip_limit:
      window: 60s
      max_requests: 30
      algorithm: sliding_window
    user_limit:
      window: 300s
      max_requests: 10
      algorithm: token_bucket
    global_limit:
      window: 10s
      max_requests: 500
      algorithm: token_bucket
    block_duration: 900s  # 15-min block after rate limit triggered
    block_strategy: progressive  # 1st: 1min, 2nd: 5min, 3rd: 30min
```

## 分布式限流：多网关实例

在微服务架构下，单实例限流是不够的——3 个网关实例各自有 30 次/分钟的 IP 阈值，攻击者向每个实例各发 30 次，合计 90 次/分钟，轻松绕过限制。

分布式限流依赖共享的计数存储，Redis 是天然之选：

```
Distributed rate limiting with Redis:

# IP-level rate limiting (sliding window)
EVAL "
  local key = KEYS[1]
  local window = tonumber(ARGV[1])  -- window size in seconds
  local limit = tonumber(ARGV[2])   -- threshold
  local now = tonumber(ARGV[3])     -- current timestamp (ms)
  local window_start = now - window * 1000

  -- Remove entries outside the window
  redis.call('ZREMRANGEBYSCORE', key, 0, window_start)
  -- Count requests within the window
  local count = redis.call('ZCARD', key)

  if count >= limit then
    return 0  -- reject
  end

  -- Add current request to sorted set
  redis.call('ZADD', key, now, now .. ':' .. math.random())
  redis.call('EXPIRE', key, window + 1)
  return 1  -- pass
" 1 "ratelimit:login:ip:192.168.1.1" 60 30 1715692800000
```

Autional gateway-service 内置了这套 Redis 限流器，开发者无需自己实现。只要在网关配置中提供 `redis` 连接信息，就会自动启用分布式模式；若 Redis 不可用，则优雅降级为本地限流（各实例独立计数）并触发告警。

## 真实场景：一次完整的暴力破解防御链

回到开头的攻击场景。以下是 Autional 的逐层响应：

```
Time: 03:00:00
Attack begins → 3,000 login requests/second from 200+ IPs

03:00:02
Global rate limit triggered: requests exceed 500 in 10-second window
→ gateway-service returns 429 Too Many Requests
→ System auto-scales gateway-service instances (Kubernetes HPA)

03:00:05
IP-level rate limit triggered: each attacking IP is individually limited
→ Attacker IPs enter the blocklist for 15 minutes
→ Legitimate users are unaffected (their IPs are far below the threshold)

03:00:10
User-level rate limit triggered: multiple IPs detected trying the same account
→ Account enters "protected" mode
→ Subsequent login attempts require MFA (WebAuthn)
→ Security alert triggered, email sent to account owner

03:00:30
Adaptive MFA engine activates:
→ Composite score: unknown device fingerprint + low IP reputation + multi-location + high failure rate = extreme risk
→ Further requests for protected accounts are directly rejected
→ Security team receives alert push notification

03:05:00
Attack traffic subsides.
→ Blocked IPs auto-unblock after 15 minutes
→ System returns to normal
→ Audit log has a complete record of the entire attack
```

## 限流配置的黄金法则

### 1. 不要只依赖 IP 限流

IP 限流只是第一道防线，不是唯一一道。它必须与用户级限流配合使用。

### 2. 阈值应来自数据

不要凭感觉猜阈值，而要分析你的正常流量特征：

- 正常用户 1 分钟内会发起多少次登录尝试？（用 p99，不要用平均值）
- 正常用户每小时登录多少次？（取最大值）
- 你的登录端点请求速率的 p95 与 p99 分别是多少？

把阈值设在正常 p99 的 3-5 倍——既能容忍异常行为，又能有效拦截攻击。

### 3. 错误信息保持一致

触发限流后，错误信息不应区分「密码错误」与「请求过多」，因为攻击者可以从响应中反推策略：

```json
// Bad: leaks rate-limiting policy
{ "error": "Too many attempts. Try again in 215 seconds." }

// Good: doesn't leak information
{ "error": "Authentication failed. Please try again later." }
```

Autional 返回标准的 `429 Too Many Requests` 状态码与 `Retry-After` 响应头，但响应体与普通认证失败保持一致，不暴露限流细节。

### 4. 递进式惩罚

不要在第一次触发阈值时就封禁 24 小时，而应采用递进策略：

```
1st trigger: wait 1 minute
2nd trigger: wait 5 minutes
3rd trigger: wait 30 minutes
4th trigger: wait 2 hours + notify account owner
5th trigger: account temporarily locked, contact admin
```

这一策略对偶尔输错密码的正常用户尽量轻罚，同时对恶意攻击者逐级加大威慑。

### 5. 监控与告警

限流不是「配好就不管」的事。你需要：

- 监控限流触发频次（如果每天都在触发，可能需要调整阈值或排查原因）
- 监控被限流的 IP 数量（激增意味着正在被攻击）
- 监控被限流的账号数量（大量不同账号可能是撞库）
- 设置告警：限流触发率超过正常水平 10 倍时发出告警

## 总结

限流是身份安全的基础设施，不是可选的附加项。没有限流的登录端点就像一扇没有锁的门——只是还没被攻击者注意到。

Autional gateway-service 内置的分布式限流提供三层防护（IP 级、用户级、全局级），支持令牌桶与滑动窗口两种算法，并通过 Redis 实现跨实例的精确计数。每个租户都可以根据自身的安全需求与流量特征独立配置。

给你的登录端点穿上盔甲。
