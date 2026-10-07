---
title: "用开源 IAM 实现 GDPR DSAR 自动化"
date: "2026-06-15"
category: "Compliance"
tags: ["GDPR", "DSAR", "隐私", "自动化"]
readTime: "10 分钟"
excerpt: "如何借助现代 IAM 平台自动化处理 GDPR 数据主体访问请求（DSAR），并通过哈希链审计实现可验证的完整性。"
status: "verified"
reviewed_by: "butler-exec"
claims_reviewed: true
---

> **合规说明**：本文所述技术能力为 Autional 的设计目标，不构成 GDPR 合规认证。最终合规责任由数据控制者承担。

## DSAR 的挑战

根据 GDPR 第 15 条，数据主体有权访问其个人数据。对拥有多个微服务的组织来说，完成一次 DSAR 意味着：

1. **发现**——在数据库、日志、缓存中定位 PII
2. **聚合**——把结果合并成一份连贯的响应
3. **验证**——通过审计轨迹证明完整性
4. **时效**——在 30 天内作出响应

## 自动化架构

Autional 的擦除编排会协同 7 个服务：

| 服务 | 操作 |
|---------|-----------|
| Identity | 软删除 + 会话吊销 |
| Profile | 删除个人资料 + 版本历史 |
| Session | 吊销所有活跃会话 |
| MFA | 清除 MFA 配置 |
| OAuth | 吊销所有令牌 |
| Points | 匿名化积分数据 |
| Notification | 删除通知历史 |

## 哈希链验证

每一次 DSAR 操作都会产生一条 Merkle 树哈希记录，形成不可篡改的审计轨迹，可证明数据在何时、以何种方式、被谁访问或删除。
