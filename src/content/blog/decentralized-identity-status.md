---
title: "去中心化身份（DID/SSI）现状：概念、标准与现实"
date: "2026-06-08"
category: "Tech"
tags: ["去中心化", "DID", "SSI", "Web3"]
readTime: "10 分钟"
excerpt: "自主主权身份（SSI）与去中心化标识符（DID）被宣传为数字身份的未来。但真实的落地情况如何？哪些已经实现，哪些还停留在概念验证阶段？本文对 DID/SSI 在 2026 年的实际状态做出冷静评估。"
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

## 愿景：把身份还给个人

在传统的身份模型中，你的数字身份并不属于你——它属于每一个你注册过的服务提供商。

你用 Google 登录上百个网站 → Google 知道你去过哪些站点。你用微信登录五十个应用 → 微信知道你在用哪些应用。每次注册新服务，你都在创造一个全新的「数字分身」——散落在互联网各处，不受你控制，也无法彼此关联。

**自主主权身份（Self-Sovereign Identity，SSI）** 试图扭转这个模型：

- 你创建一个属于自己的数字身份（不是某家公司授予的）
- 你从可信机构获取可验证凭证（VC）——政府签发的数字身份证、大学签发的数字学位、银行签发的信用评分证明
- 当你需要向服务商证明某事时，你出示一张可验证凭证——而不是注册一个新账号
- 服务商验证凭证签名，信任签发方，无需存储你的密码

听起来很美好。但它距离现实有多近？

## W3C 标准现状

去中心化身份不是单一技术，而是一个标准家族，核心包括：

### DID（去中心化标识符）

W3C DID Core 规范于 2022 年 7 月成为 W3C 正式推荐标准。DID 是一个全局唯一、无需中心化注册机构的标识符。格式：

```
did:example:123456789abcdefghi
```

`did:` 是协议方案，`example` 是 DID 方法（method），后面是方法特定的标识符。

已有 150 多个 DID 方法注册在案。常用方法包括：

- `did:web` — 基于域名，最容易与现有基础设施集成
- `did:key` — 直接由公钥派生，最简单但密钥无法轮换
- `did:ethr` — 基于以太坊地址
- `did:indy` — 基于 Hyperledger Indy 账本（企业级 SSI）
- `did:ion` — 基于比特币区块链（Sidetree 协议）

**关键里程碑**：`did:web` 已成为事实上的默认方法，它在不引入全新基础设施的前提下，交付了 DID 的核心价值。

### 可验证凭证（VC）

W3C 可验证凭证数据模型 v1.1 于 2022 年 3 月成为正式推荐标准。VC 定义了一套数据模型，用于以密码学方式表达「签发方关于某一主体的一项声明」。

简化后的 VC 结构：

```json
{
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  "type": ["VerifiableCredential", "UniversityDegreeCredential"],
  "issuer": "did:web:university.example.com",
  "issuanceDate": "2026-05-01T00:00:00Z",
  "credentialSubject": {
    "id": "did:example:alice",
    "degree": {
      "type": "BachelorDegree",
      "name": "Bachelor of Computer Science"
    }
  },
  "proof": {
    "type": "Ed25519Signature2020",
    "created": "2026-05-01T00:00:00Z",
    "verificationMethod": "did:web:university.example.com#key-1",
    "proofPurpose": "assertionMethod",
    "proofValue": "z58DAdFfa9SkqZM..."
  }
}
```

VC 的关键特性：

1. **签发方绑定**：凭证由签发方签名，任何人都能验证签名
2. **自主保管**：凭证由持有者保管，通常放在数字钱包中
3. **选择性披露**：你可以证明「我是大学毕业生」而不披露自己的 GPA
4. **可撤销**：签发方可通过状态列表（Status List）撤销已签发的凭证

VC v2.0（W3C 工作组草案）于 2024 年发布，增加了可选的 JSON-LD context、原生 JWT 与 SD-JWT 支持，并将 Bitstring Status List 2021 作为标准撤销机制。

### DIDComm / OpenID4VC

在 SSI 生态中，身份主体之间需要通信协议：

- **DIDComm v2**：DID 之间点对点的安全通信协议，支持加密消息传递
- **OpenID for Verifiable Credentials（OpenID4VC）**：由 OpenID 基金会推动，把 OpenID Connect 的成熟机制扩展到 VC 场景，包括：
  - OpenID4VCI（可验证凭证签发）：签发方侧协议
  - OpenID4VP（可验证呈现）：呈现/验证协议
  - SIOPv2（Self-Issued OpenID Provider v2）：自签发的身份提供方

OpenID4VC 正在成为事实上的 SSI 协议标准，因为它建立在被广泛验证的 OAuth 2.0 / OIDC 基础之上。

## 真实落地：谁在用，用在哪里？

### 欧盟：eIDAS 2.0 与 EUDI 钱包

这是目前全球最大的 DID/VC 部署项目。eIDAS 2.0 法规（2024 年 5 月生效）要求每个欧盟成员国在 2026 年底前为公民提供「欧洲数字身份钱包」（EUDI Wallet）。

这意味着到 2026 年底，4.5 亿欧盟公民将拥有一个能够存储与出示可验证凭证的数字钱包，用于：

- 证明年龄（不披露出生日期）
- 在线开立银行账户（出示数字身份证）
- 求职（出示数字学位证书）
- 跨境使用公共服务

四个大型试点项目（EBSI 与 POTENTIAL + NOBID + DC4EU + EWC）覆盖了 150 多个用例。

### 企业采用

- **IBM / Mastercard**：Digital Trust Network，基于 Hyperledger Indy
- **Microsoft Entra**：Verified ID，基于 did:web + 基于 JWT 的 VC
- **SpruceID / MATTR / Cheqd**：VC 签发与验证 PaaS 服务
- **Auth0 / Okta**：将可验证凭证集成进其 CIAM 产品线

### 中国：BSN-DID 与 ChainMaker

中国有多条 DID 探索路径：

- **BSN-DID**：基于区块链服务网络（BSN）的去中心化标识符体系
- **ChainMaker**：支持 DID 与 VC 的企业级区块链
- **DID-Alliance**：推动 DID 在各行业的应用

## 现实：为什么还没成为主流？

### 1. 先有鸡还是先有蛋

服务商不支持 DID 登录，因为用户没有 DID 钱包。用户没有 DID 钱包，因为没有服务商支持 DID 登录。eIDAS 2.0 正试图通过监管打破这个循环——强制公共服务接受 EUDI 钱包。

### 2. 密钥恢复是致命的体验问题

最大的现实障碍：如果你丢失了 DID 私钥，你的整个数字身份就没了。这里没有「忘记密码」——因为不存在中心化的密码重置服务。

目前的解决方案：

- 社交恢复（等待足够多的人批准恢复）
- 硬件安全模块（HSM）备份
- 托管钱包（退回中心化模型，背离了去中心化的初衷）

### 3. 法律框架落后于技术

可验证凭证在密码学上有效是一回事，在法律上有效是另一回事。DID + VC 的数字身份证与实体身份证具备同等法律效力吗？在欧盟 eIDAS 2.0 下，答案是肯定的。在中国与美国的联邦层面，尚未确立。

### 4. 技术栈碎片化

150 多个 DID 方法、多种通信协议（DIDComm vs OpenID4VC vs OIDC4IDA）、各异的密码学套件——这是一个碎片化的生态。开发者会困惑：「我到底该用哪个？」

## Autional 的策略：务实地演进，而非激进地革命

Autional 对去中心化身份采取「观察、集成、演进」的方式：

**短期（2026）：DID 探索**

- 在内部架构中新增 `did` 模块：为 `did:web` 与 `did:key` 方法提供基础的 DID 解析与创建能力
- identity-service 支持将用户 ULID 映射到 DID
- OpenID4VC 研究与实验室验证

**中期（2027）：选择性引入**

- 支持 OpenID4VP（可验证呈现）作为一种新的认证方式——用户可以通过出示可验证凭证来注册与登录
- oauth-service 支持 SD-JWT 格式令牌，用于选择性披露
- 与 EUDI 钱包及 SpruceID 等主流 VC 平台集成

**长期（2028+）：SSI-Ready**

- 允许用户把 Autional 托管的身份升级为自主主权身份——导出为 DID + VC
- 保持双模式运行（标准身份与 DID 身份），以满足多样化的市场与合规要求

Autional 不押注任何特定的 DID 方法或区块链——而是在身份基础设施层做抽象，让上层能够适应技术演进，而无需重写核心逻辑。

## 小结

去中心化身份不是乌托邦幻想——在 2026 年，它已有真实世界的部署、可用的技术标准与清晰的演进路径。但大规模普及仍受限于体验挑战（密钥恢复）、生态碎片化与滞后的法律框架。

对大多数 SaaS 开发者与企业而言，当下务实的选择是：用成熟的中心化身份基础设施（如 Autional）构建产品，同时持续关注去中心化身份标准。当 DID/SSI 的实用性与法律基础达到临界规模时，基础设施层将已为迁移做好准备。
