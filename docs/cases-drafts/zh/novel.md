---
title: "Novel：单用户笔记应用改造为多用户产品"
date: "2026-10-13"
platform: "Vercel"
framework: "Next.js"
stack: "Next.js 15 · React 18 · Tiptap · Vercel Blob（私有存储）"
repo: "https://github.com/autional-demo/novel"
demo: "https://novel-demo-nine.vercel.app"
tags: ["AI 改造", "SSO", "多用户", "Novel"]
readTime: "4 分钟"
excerpt: "一段可复制的 prompt + 一个 GitHub 地址，我们把开源笔记应用 Novel 从「无账号、文档共享」改造成带 SSO 登录、按用户隔离文档、接入平台 AI 中转的多用户产品——主改造在一个 AI 协作会话内完成，当天上线 Vercel。本页是这次真实改造的速览：改造前后对照、可核验的测试数字，以及发起改造的 prompt 逐字存档。"
status: verified
reviewed_by: "editorial"
claims_reviewed: true
---

2026-10-13，我们把开源笔记应用 [Novel](https://github.com/steven-tey/novel) 从「打开即用、所有人共享同一池文档」的单用户工具，改造成带 SSO 登录、按用户隔离文档、接入平台 AI 中转的多用户产品——主改造在一个 AI 协作会话内完成，当天部署上线 Vercel。演示环境开放，可以打开亲手验证。

## 速览

| 项 | 值 |
| --- | --- |
| 上游应用 | Novel —— 开源 AI 笔记应用（[steven-tey/novel](https://github.com/steven-tey/novel)） |
| 改造结果 | SSO 登录 · 文档按用户隔离并持久化 · AI 能力接平台中转 · 生产部署 |
| 技术栈 | Next.js 15 · React 18 · Tiptap · Vercel Blob（私有存储） |
| 部署平台 | Vercel |
| 用时 | 主改造一个 AI 协作会话内完成，当天上线 |
| 参考仓库 | [github.com/autional-demo/novel](https://github.com/autional-demo/novel) |
| 演示环境 | [novel-demo-nine.vercel.app](https://novel-demo-nine.vercel.app) |

## 改造前 → 改造后

| 维度 | 改造前（原版 Novel） | 改造后 |
| --- | --- | --- |
| 账号 | 无 —— 打开即用 | 邮箱密码，或一键「使用 Autional 登录」（OAuth 2.0 + PKCE） |
| 数据 | 所有人共享同一池文档 | 多用户隔离 —— 文档按用户私有 |
| 会话 | 无会话概念 | 自动刷新、跨标签同步，设备会话可见可撤销 |
| 登出 | — | 标准 OIDC 登出：会话真正结束，可切换账号 |
| AI 能力 | 自备模型 key，成本不可控 | 平台 AI 中转，统一计量 |
| 部署 | 仅本地 | 生产（Vercel + 平台存储） |
| 运维 | 没有账号体系可运维 | 用户、审计、安全策略在平台门户管理，无需自建后台 |

这不是效果图：改造后的代码在 [github.com/autional-demo/novel](https://github.com/autional-demo/novel) 公开可查；演示环境开放，登录、数据隔离、换号切换均可亲手验证。

## 改造做了什么

- **SSO 接入**：同源 `/bff` 代理 + 会话桥 + OAuth 回调；
- **多用户改造**：文档按用户隔离，持久化到平台存储（Vercel Blob 私有）；
- **AI 中转**：应用的 AI 能力接入平台中转，统一计量；
- **部署上线**：Vercel 生产部署，注册生产回调地址。

## 结果与验证

- 本地三闸全绿：lint / typecheck / build；单元测试 **8/8**；
- 生产环境真机 E2E **5/5**：登录、文档增删改查、跨用户隔离对照、AI 生成、图片上传；
- 安全专项：跨用户越权探针 **19/19** 全部拦截（跨用户读取双向 404、未登录 401）；文档存储为私有（private Blob）；
- 演示环境开放：[novel-demo-nine.vercel.app](https://novel-demo-nine.vercel.app)。

改造中发现的问题全部记录归档，反哺平台与 skill 的迭代——下一位改造者的起点因此更靠前。

## 发起 prompt（逐字存档）

2026-10-13（CST）发起改造时交给 AI 编码助手的 prompt 原文：

```
请读取 https://www.autional.cn/ai/skill.md，并据此为 https://github.com/steven-tey/novel 完成改造：接入 Autional 登录，把它从单用户应用改造成多用户产品（用户数据隔离并持久化到平台存储）；改造完成后部署上线到 Vercel。
若打不开，改用国内镜像：https://cdn.autional.cn/ai/latest/SKILL.md
```

把仓库地址换成你自己的项目，这句话就是你的 prompt。

## 自己试一遍

复制上面的 prompt，把仓库地址换成你的项目，交给 AI 编码助手（Claude Code、Cursor 等）即可。完整方法论（八阶段流程、四条流程规则、分步操作）见博客深文：[《用 AI 改造开源应用：从一段 prompt 和一个 GitHub 地址开始》](/blog/ai-refactor-novel)；想直接开始，看 [AI 接入指南](/ai)。
