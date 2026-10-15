---
title: "NextChat：单用户 AI 聊天客户端改造为多用户产品"
date: "2026-10-15"
platform: "Vercel"
framework: "Next.js"
stack: "Next.js 14（App Router）· React 18 · Zustand · Vercel Blob（私有存储）"
repo: "https://github.com/autional-demo/nextchat"
demo: "https://nextchat-demo-eight.vercel.app"
tags: ["AI 改造", "SSO", "多用户", "NextChat"]
readTime: "4 分钟"
excerpt: "同样是「一段 prompt + 一个 GitHub 地址」，只换了仓库地址：我们把开源 AI 聊天客户端 NextChat 从「无账号、数据全在浏览器」改造成带 SSO 登录、按用户隔离、聊天记录持久化到平台存储的多用户产品——改造与上线当天完成，生产真机 E2E 6/6。本页给出速览、可核验的测试数字与 prompt 逐字存档。"
status: verified
reviewed_by: "editorial"
claims_reviewed: true
---

2026-10-15，我们再次用同一句话的 prompt——只把仓库地址换成 [NextChat](https://github.com/ChatGPTNextWeb/NextChat)——把这款开源 AI 聊天客户端从「数据全部留在浏览器本地」的单用户工具，改造成带 SSO 登录、按用户隔离、聊天数据持久化到平台存储的多用户产品。改造与上线当天完成，生产真机 E2E 6/6。

## 速览

| 项 | 值 |
| --- | --- |
| 上游应用 | NextChat —— 开源 AI 聊天客户端（原名 ChatGPT-Next-Web） |
| 原项目仓库 | [github.com/ChatGPTNextWeb/NextChat](https://github.com/ChatGPTNextWeb/NextChat) |
| 原项目官网 | [nextchat.club](https://nextchat.club) |
| 改造结果 | SSO 登录 · 按用户隔离 · 会话持久化（平台存储）· 服务路由会话门 |
| 技术栈 | Next.js 14（App Router）· React 18 · Zustand · Vercel Blob（私有存储） |
| 部署平台 | Vercel |
| 用时 | 改造 + 上线当天完成（同一 AI 协作会话） |
| 参考仓库 | [github.com/autional-demo/nextchat](https://github.com/autional-demo/nextchat) |
| 演示环境 | [nextchat-demo-eight.vercel.app](https://nextchat-demo-eight.vercel.app) |

## 关于原项目 NextChat

NextChat（原名 ChatGPT-Next-Web，2024 年 1 月更名）是跨平台开源 AI 聊天客户端：覆盖 Web / PWA / iOS / Android / 桌面端（Tauri），支持 GPT、Claude、Gemini、DeepSeek 等主流模型，兼容 Azure 与自部署模型；具备 Markdown / LaTeX / Mermaid 渲染、提示词面具、插件、分享为图片等能力。聊天数据默认全部留在浏览器本地，无账号体系——这也正是本次改造的起点。项目采用 MIT 许可，截至 2026-10 在 GitHub 上获 8.8 万+ star。

## 改造前 → 改造后

| 维度 | 改造前（原版 NextChat） | 改造后 |
| --- | --- | --- |
| 账号 | 无 —— 打开即用 | SSO 登录（OAuth 2.0 + PKCE） |
| 数据 | 全部在浏览器本地（IndexedDB / localStorage） | 按用户隔离，持久化到平台存储；清空本地缓存后重新加载即可恢复 |
| 服务路由 | 无鉴权 | 全部 LLM 路由与服务路由加会话门（伪造 / 缺失 token 一律 401） |
| 登出 | — | 标准 OIDC 登出，干净回落登录页 |
| 部署 | 仅本地 | 生产（Vercel + 平台存储） |

## 改造做了什么

全程按 skill 的八阶段流程推进——判据先行、确认门、分支隔离、验收闭环；接入方式经确认门拍板（SSO 授权码流、平台存储 = Vercel Blob 私有）。

- **SSO 接入**：同源 `/bff` 代理 + 会话桥 + OAuth 回调；
- **多用户改造**：聊天状态（会话、配置等）按用户隔离，快照持久化到平台存储（Vercel Blob 私有）；
- **会话门**：全部 LLM 路由（16 条）+ 服务路由（4 条）加鉴权门；
- **修复两处数据同步缺陷**：默认模型配置不生效、流式回复的最终消息未落平台存储——修复后，重载或换设备都能完整恢复会话。

## 结果与验证

- 本地全量测试 **39 套件 / 185 用例**全绿（含接入相关 5 套件 / 28 用例）；
- 隔离探针 **6/6**（跨用户读取零泄漏）；线上契约探针 **4/4**；
- 生产真机 E2E **6/6**：SSO 登录、对话持久化（清空本地 → 恢复）、换号隔离（bob 登录后看不到 alice 的对话）、换号往返（alice 会话完好）、登出（干净回落登录页）、登录页明暗主题轮；
- 生产负面复验：伪造 / 缺失 token 一律 401（会话门）；
- 演示环境开放：[nextchat-demo-eight.vercel.app](https://nextchat-demo-eight.vercel.app)。

改造中发现的问题全部记录归档，反哺平台与 skill 的迭代——下一位改造者的起点因此更靠前。

## 发起 prompt（逐字存档）

2026-10-15 10:09（CST）发起改造时交给 AI 编码助手的 prompt 原文：

```
请读取 https://www.autional.cn/ai/skill.md，并据此为 https://github.com/chatgptnextweb/nextchat 完成改造：接入 Autional 登录，把它从单用户应用改造成多用户产品（用户数据隔离并持久化到平台存储）；改造完成后部署上线到 Vercel。
若打不开，改用国内镜像：https://cdn.autional.cn/ai/latest/SKILL.md
```

与上一个案例（Novel）相比，只有仓库地址不同——同一句 prompt，换仓库即用。

## 自己试一遍

复制上面的 prompt，把仓库地址换成你的项目，交给 AI 编码助手（Claude Code、Cursor 等）即可。想直接开始，看 [AI 接入指南](/ai)。
