---
title: "MarkText：从桌面编辑器到多用户云端写作产品"
date: "2026-11-04"
platform: "Vercel"
framework: "Next.js"
stack: "Next.js 15（App Router）· React 19 · muya（MarkText 编辑器内核）· Autional（身份）· Neon Postgres · Vercel"
repo: "https://github.com/autional-demo/marktext"
demo: "https://marktext-web.vercel.app"
tags: ["AI 改造", "SSO", "多用户", "云存储", "MarkText"]
readTime: "6 分钟"
excerpt: "把 Electron 桌面版 MarkText 做成 Web 多用户产品：Autional 提供 SSO 与账号，Vercel 负责托管与 API，Neon 持久化加密文档；支持 PWA 与独立笔记链接，改造与上线当天完成。本页给出改造动机、分步做法、最终成果与发起 prompt 原文。"
status: verified
reviewed_by: "editorial"
claims_reviewed: true
---

2026-11-04，我们把 MarkText 从一款 Electron 桌面编辑器，做成了可以直接在浏览器里使用的多用户写作产品：SSO 登录、文档按用户隔离、保存到云端数据库、支持 PWA 与独立笔记链接。改造与上线在同一天完成。

## 速览

| 项 | 值 |
| --- | --- |
| 上游应用 | MarkText —— 开源 Markdown 编辑器（Electron 桌面端） |
| 原项目仓库 | [github.com/marktext/marktext](https://github.com/marktext/marktext) |
| 原项目官网 | [marktext.app](https://marktext.app) |
| 改造结果 | SSO 登录 · 按用户隔离 · 云端持久化 · 字段加密 · PWA · 独立笔记链接 |
| 技术栈 | Next.js 15（App Router）· React 19 · muya（MarkText 编辑器内核）· Autional · Neon Postgres |
| 部署平台 | Vercel |
| 用时 | 改造 + 上线当天完成 |
| 参考仓库 | [github.com/autional-demo/marktext](https://github.com/autional-demo/marktext) |
| 演示环境 | [marktext-web.vercel.app](https://marktext-web.vercel.app) |

## 关于 MarkText

MarkText 是一款开源（MIT 许可）的跨平台 Markdown 编辑器，基于 Electron 构建，主打「所见即所得」的写作体验。它支持 CommonMark 与 GFM，覆盖标题、列表、任务列表、表格、代码块、引用与脚注；也支持 KaTeX 数学公式、Mermaid 图表、代码高亮、焦点模式与快捷插入，桌面端的完成度很高。

但它有两个天然边界：**只在桌面运行**，以及**数据只保存在本机**。没有账号体系，也就没有「分享链接、换设备继续写、多人各用各的」这些能力。编辑体验很强，缺的是账号、云和多人。

## 为什么改造

对写作工具来说，桌面版的限制很具体：

- 换一台电脑，文档不在；
- 清一次缓存，历史归零；
- 想分享一篇笔记，只能导出文件再发；
- 没有账号，就无法区分「谁写了什么」。

因此这次改造定了四个目标：

1. **搬上 Web**：保留 MarkText 的编辑器体验，打开浏览器就能写；
2. **加账号**：支持 SSO，也保留邮箱密码登录；
3. **上云并隔离**：文档持久化到数据库，按用户隔离；
4. **当天可用**：改完即可上线，后续能持续迭代。

## 三个平台各自负责什么

改造没有把三件事混在一起，而是各交给一个平台：

| 平台 | 角色 | 具体负责 |
| --- | --- | --- |
| Autional | 身份层 | SSO（OAuth 2.0 + PKCE）、邮箱密码登录、令牌校验、提供租户与用户标识 |
| Vercel | 托管与运行时 | 构建与部署、Serverless API、同源 `/bff` 代理、GitHub push 自动发布 |
| Neon | 数据层 | Postgres 持久化文档，按 `tenant_id + user_id` 归属，存储加密后的密文 |

需要说明的是：**字段加密在应用层完成**，Neon 里保存的是密文；解密密钥只放在服务端环境变量里。

## 改造步骤

整个过程拆成 10 个小目标，每个目标都有明确的验收点。

### 1. 把编辑器搬上 Web

目标：编辑器体验不打折。

做法：用 Next.js 15 搭 Web 应用，编辑器直接采用 MarkText 抽出的内核 **muya**（`@muyajs/core`）。渲染、工具栏、表格、公式、图表都沿用同一套内核，并补上自动保存。

结果：浏览器里获得与桌面版一致的写作体验，支持导入 / 导出 `.md`。

### 2. 接入账号与 SSO

目标：有账号体系，且默认走 SSO。

做法：接入 Autional。登录页提供「使用 Autional SSO 登录」，采用授权码 + PKCE 的公开客户端；同时保留邮箱密码登录，注册走身份服务。登录后由 SDK 管理会话，登出回到登录页。

结果：登录、注册、登出闭环；令牌过期会自动刷新，多标签页状态同步。

### 3. 用同源代理连接浏览器与身份服务

目标：浏览器调用身份接口时不受跨域限制。

做法：应用内提供 `/bff` 同源代理，把身份与 OAuth 请求转发到 Autional；OIDC discovery 也走同源。浏览器只与自己的域名通信。

结果：登录与换票稳定，不再依赖第三方域名的 CORS 配置。

### 4. 设计文档数据模型

目标：一个人一份数据，能排序、能软删除。

做法：在 Neon 建 `documents` 表：`id`、`tenant_id`、`user_id`、`title`、`content`、`rev`、`deleted_at`、创建 / 更新时间；按「租户 + 用户 + 更新时间」建索引。

结果：列表按最近更新排序，删除是软删除，历史数据可保留。

### 5. 提供文档读写 API

目标：前端只通过一套 REST 接口操作文档。

做法：提供列表、新建、读取、保存、删除五个接口；单文档正文上限 2 MB，列表上限 500 条；新建允许客户端带上 id，用于把本机旧数据上传。

结果：文档的完整生命周期都在服务端完成，前端不直接接触数据库。

### 6. 数据隔离与字段加密

目标：跨用户读不到，密文也搬不走。

做法：所有查询强制带 `tenant_id + user_id`；标题与正文用 **AES-256-GCM** 加密，并把「租户 + 用户 + 文档 + 字段」作为附加认证数据（AAD）绑定到密文上。

结果：换一个账号登录，看不到别人的文档；把密文复制到另一条记录也无法解密。

### 7. 给 API 加会话门

目标：没有登录就不能读写。

做法：文档 API 要求 `Bearer` 令牌，服务端先检查有效期，再向身份服务 `/me` 做权威校验（结果缓存 60 秒）。校验通过才拿到可信的用户与租户。

结果：无 token、伪造 token 一律 401；正常会话下接口才返回数据。

### 8. 同步、冲突与离线

目标：写起来像本地应用，数据却在云上。

做法：本地保留缓存，输入停止约 1.6 秒后写云端；每条文档带 `rev` 版本号，保存时做乐观锁，冲突返回 409 并带回云端版本，由用户选择「载入云端」或「用本机覆盖」。同时提供 PWA，可安装、可离线打开。

结果：刷新页面、换设备都能恢复；网络恢复后自动同步；冲突不会静默覆盖。

### 9. 独立笔记链接

目标：每条笔记都有自己的地址。

做法：新增 `/d/<id>` 路由，打开即定位到对应文档，支持刷新、深链和浏览器前进后退。

结果：笔记可以被收藏、被分享，链接直接落到内容。

### 10. GitHub → Vercel 上线

目标：发布流程可重复。

做法：代码托管在 GitHub，Vercel 项目绑定仓库的 `main` 分支，push 即自动构建与发布；环境变量在 Vercel 项目里配置，函数区域固定为 `sin1`。

结果：改造当天上线，后续每次 push 自动更新，不再手工部署。

## 最终成果

**线上**：[marktext-web.vercel.app](https://marktext-web.vercel.app)
**代码**：[github.com/autional-demo/marktext](https://github.com/autional-demo/marktext)

| 能力 | 结果 |
| --- | --- |
| 登录 | SSO + 邮箱密码，登出干净回落 |
| 多用户 | 按租户 + 用户隔离，互不可见 |
| 云端 | Neon 持久化，清本地缓存可恢复 |
| 加密 | 字段级 AES-256-GCM，密文绑定归属 |
| 并发 | `rev` 乐观锁，冲突二选一 |
| 多端 | PWA 可安装，独立笔记链接 |
| 发布 | GitHub → Vercel，push 即上线 |

可核验的结果：

- 构建通过；
- 身份集成测试 **8/8**（discovery、注册、登录、资料、令牌、登出、吊销、认证配置）；
- SSO 预检 **2/2**（authorize 302 回指回调、CORS 204）；
- 授权码全链路（authorize → code → token → userinfo）全部 200；
- 云端文档端到端 **13/13**（创建、列表、读取、保存、冲突、密文校验、删除）；
- 生产接口：带令牌 200，无令牌 401。

一句话总结这套结构：**Autional 管「你是谁」，Vercel 管「在哪跑」，Neon 管「存在哪」**，编辑器继续做它最擅长的事。

## 发起 prompt（逐字存档）

2026-11-04 发起改造时交给 AI 编码助手的 prompt 原文：

```
1. 帮我下载marktext， 并安装。   2.  参考 https://www.autional.com/cases/nextchat 把 marktext 发布到我的 vercel 。 3. 请读取 https://www.autional.cn/ai/skill.md，并据此为当前项目接入 Autional 登录。
若打不开，改用国内镜像：
https://cdn.autional.cn/ai/latest/SKILL.md
```

## 自己试一遍

把同样的 prompt 换成你的项目地址，交给 AI 编码助手（Claude Code、Cursor 等）即可。想直接开始，看 [AI 接入指南](/ai)。
