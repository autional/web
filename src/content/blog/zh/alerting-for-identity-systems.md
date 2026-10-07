---
title: "身份系统的告警规则：哪些指标值得告警，哪些不值得"
date: "2026-06-12"
category: "Architecture"
tags: ["告警", "监控", "运维"]
readTime: "7 分钟"
excerpt: "告警疲劳是运维团队的头号杀手——噪声太多会淹没真正重要的告警。本文给出身份系统的分级告警策略，从 P0 救火级到 P3 趋势级，并附可直接使用的 Prometheus 告警规则示例，帮助团队从「到处都在叫」走向「只有真正重要的才响」。"
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

凌晨 3 点，手机震动。你睁眼看到第 17 条告警通知——「identity-service CPU 使用率连续 2 分钟超过 80%」。你翻个身继续睡。3:05，第 18 条告警——「登录失败率飙升」。你依然没看，因为过去一个月这条告警响了 342 次，342 次都是测试脚本在跑异常场景。3:12，你接到客户电话：「我们的用户全都登不进去了。」

这是**告警疲劳**的经典剧本。噪声太多会淹没真正的危险信号，最终让整个团队麻木。行业统计显示，**SRE 收到的告警中超过 70% 是毫无意义的噪声**——自愈无需人工介入、阈值设得太低，或者本就不该存在。

本文只聚焦一个问题：对身份系统而言，哪些指标应该告警？阈值怎么定？优先级怎么分？基于 Autional 的 Prometheus 指标体系与真实运维经验，我们给出一套可直接落地的参考框架。

## 告警分级框架

告警不是二元的——不同严重级别需要不同的响应方式。Autional 采用四级告警体系：

| 级别 | 名称 | 响应时间 | 通知方式 | 是否唤醒？ |
|-------|------|--------------|-------------------|-------------------|
| P0 | 致命 | 5 分钟内 | 电话 + 短信 + 即时通讯 | 是 |
| P1 | 严重 | 15 分钟内 | 短信 + 即时通讯 | 是 |
| P2 | 警告 | 1 小时内 | 即时通讯 + 邮件 | 否（工作时间内处理） |
| P3 | 提示 | 下一个工作日 | 邮件 + 工单 | 否 |

关键原则：**P0 告警必须是「用户已经在受影响、或即将受影响而无法使用系统」的事件。** 如果你还在纠结某个告警是 P0 还是 P1，那它多半是 P1。

## P0 级：救火告警

### 1. 登录失败率异常飙升

这是身份系统的头号告警。

```yaml
- alert: LoginFailureRateSpike
  expr: |
    (
      sum(rate(http_requests_total{service="identity-service", path="/api/v1/auth/login", status!="200"}[5m]))
      /
      sum(rate(http_requests_total{service="identity-service", path="/api/v1/auth/login"}[5m]))
    ) > 0.3
  for: 5m
  labels:
    severity: P0
  annotations:
    summary: "Login failure rate spike"
    description: "Login failure rate exceeded 30% in the past 5 minutes, current value {{ $value | humanizePercentage }}"
```

**为什么是 30% 而不是 5%？** 因为正常情况下登录失败率也可能偏高——例如营销活动带来大量新用户，其中一些人会输错密码。但失败率超过 30% 几乎可以断定不是正常的用户行为。`for: 5m` 条件则确保它不是瞬时抖动。

**这条告警触发后要做的事：**
1. 检查是否存在滥用流量（按 IP 聚合登录请求，寻找高频来源）
2. 检查数据库连接池健康状况
3. 检查 `identity-service` 近期是否发布过新版本

### 2. 令牌签发完全失败

比「登录缓慢」更糟的是「登录不可能」。

```yaml
- alert: TokenGenerationFailed
  expr: |
    sum(rate(http_requests_total{service="identity-service", path="/api/v1/auth/login", status=~"5.."}[5m])) > 0
  for: 1m
  labels:
    severity: P0
  annotations:
    summary: "Token issuance returning server errors"
    description: "identity-service returning 5xx errors for login requests, service may be unavailable"
```

这里不设百分比阈值，因为**登录端点上出现任何 5xx 都是不可接受的**——它意味着系统内部故障，而不是用户行为问题。

### 3. 数据库连接池耗尽

身份系统的所有操作最终都依赖数据库。连接池耗尽意味着服务全面不可用。

```yaml
- alert: DBConnectionPoolExhausted
  expr: |
    db_connections_active / db_connections_max > 0.9
  for: 2m
  labels:
    severity: P0
  annotations:
    summary: "Database connection pool near exhaustion"
    description: "Active connections exceed 90% of max connections, current {{ $value | humanizePercentage }}"
```

Autional 的 PostgreSQL 连接池默认配置为 `DBMaxOpenConns = 25`、`DBMaxIdleConns = 10`。当某个服务的活跃连接持续高于 22 时，可能正在发生连接泄漏或慢查询堆积。

## P1 级：严重告警

### 4. MFA 绕过尝试异常增加

MFA 是抵御账号接管的最后一道防线。如果有人正在尝试绕过 MFA，你必须知道。

```yaml
- alert: MFABypassAttemptsSpike
  expr: |
    sum(rate(mfa_bypass_attempts_total{result="failed"}[10m])) > 10
  for: 10m
  labels:
    severity: P1
  annotations:
    summary: "Abnormal increase in MFA bypass attempts"
    description: "{{ $value }} failed MFA bypass attempts in the past 10 minutes, possible attack in progress"
```

这需要一个业务层自定义指标——`mfa-service` 每收到一次 MFA 绕过请求就递增该计数器。Autional 的 MFA 模块已内置这一埋点。

### 5. 令牌签发延迟 P99 超过阈值

用户不会上报「P99 延迟」，但他们会说「登录特别慢」。

```yaml
- alert: TokenGenerationLatencyHigh
  expr: |
    histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{
      service="identity-service",
      path="/api/v1/auth/login"
    }[5m])) > 1.0
  for: 10m
  labels:
    severity: P1
  annotations:
    summary: "Token issuance latency too high"
    description: "Login request P99 latency {{ $value }}s, exceeds 1s threshold"
```

### 6. MQ 死信队列积压

如果 `audit-service` 的消费者挂了，审计日志会堆积在死信队列里。虽然不影响用户体验，但意味着合规风险。

```yaml
- alert: DLQBacklogGrowing
  expr: |
    mq_dlq_queue_messages > 1000
  for: 10m
  labels:
    severity: P1
  annotations:
    summary: "MQ dead letter queue backlog"
    description: "DLQ message count {{ $value }}, exceeds 1000 threshold, possible consumer fault"
```

## P2 级：警告

### 7. 服务实例频繁重启

Pod 频繁重启是明确的危险信号——可能是内存泄漏、OOM 被杀，或就绪探针配置错误。

```yaml
- alert: ServiceFrequentRestarts
  expr: |
    rate(kube_pod_container_status_restarts_total{container=~"identity-.*"}[30m]) > 0
  for: 10m
  labels:
    severity: P2
  annotations:
    summary: "Frequent service instance restarts"
    description: "{{ $labels.pod }} has restarted in the past 30 minutes, possible issue"
```

### 8. 缓存命中率下降

缓存命中率下降意味着更多请求打到数据库，可能造成延迟升高与数据库负载增加。

```yaml
- alert: CacheHitRateDropping
  expr: |
    rate(cache_hits_total[15m]) / rate(cache_requests_total[15m]) < 0.7
  for: 15m
  labels:
    severity: P2
  annotations:
    summary: "Cache hit rate dropping"
    description: "{{ $labels.service }} cache hit rate dropped to {{ $value | humanizePercentage }}"
```

## 哪些指标不该告警（至少不该惊动人）

### 不该告警的例子

1. **单次登录失败**——除非你能证明这是攻击，而不是用户打错了密码。
2. **CPU/内存瞬时尖峰**——容器环境下 CPU 波动是常态。持续高位（超过 85% 且持续 15 分钟以上）才值得告警。
3. **瞬时网络抖动**——持续几秒就自动恢复，不值得叫醒任何人。
4. **非关键路径上的降级**——头像上传失败？用户名字段校验报错？这些可以等到下一个工作日。
5. **所有测试环境告警**——测试环境的告警应全部走独立通道。绝不要让测试环境的噪声污染生产告警链路。

### 替代方案：用趋势看板代替告警

对于 CPU 使用率、内存使用率、网络流量这类指标，**告警是错误的做法**。它们属于趋势看板，供团队在白天主动查看，而不是在凌晨 3 点被动接收。

Autional 建议搭建以下 Grafana 看板：
- **服务总览**：QPS、延迟、错误率 × 各服务
- **基础设施总览**：PostgreSQL 连接数/QPS/慢查询，Redis 内存/命中率/连接数，RabbitMQ 队列深度/消费速率
- **认证业务看板**：注册量、登录量、MFA 使用率、令牌签发量、OAuth 授权量

这些看板与告警配合，形成清晰的分工：**看板看趋势，告警管事故。**

## 告警质量指标

配好告警规则只是开始，持续衡量告警质量才是长期功课。Autional 的运维团队按月跟踪以下指标：

- **告警-事故转化率**：发出的 100 条告警中，有多少真正对应需要人工介入的事故？目标：> 30%。
- **平均响应时间（MTTR）**：从告警触发到服务恢复。目标：P0 < 15 分钟，P1 < 60 分钟。
- **告警噪声率**：无需任何人工介入即自动恢复的告警占比。目标：< 20%。

如果告警-事故转化率长期低于 10%，说明阈值过于敏感——放宽阈值或延长 `for` 持续时间。如果 MTTR 偏高，则需要更完善的运维手册（Runbook）与自动化恢复手段。

## 小结

好的告警系统就像好的安防系统——真正有危险时希望它报警，但不希望一只猫路过它就响。三条核心原则：

1. **告警必须可执行**——每条告警都应有明确的运维手册（响应步骤）。没有手册的告警不是告警，是噪声。
2. **告警针对症状，而非原因**——要告警「登录失败率飙升」，而不是「CPU 使用率高」。CPU 高可能是原因之一，但最终影响用户的是登录失败。
3. **持续优化**——每季度复盘告警数据。下线不再有用的规则、调整阈值、补充新场景。告警规则是活的资产，不是一次性的配置。

---

*Autional 的 Prometheus 指标覆盖全部核心业务路径与基础设施组件。内置 Grafana 看板模板，团队可在 30 分钟内搭好完整的身份系统监控栈。*
