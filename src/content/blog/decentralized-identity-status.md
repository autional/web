---
title: "Decentralized Identity (DID/SSI) Status: Concepts, Standards, and Reality"
date: "2026-06-08"
category: "Tech"
tags: ["Decentralization", "DID", "SSI", "Web3"]
readTime: "10 min"
excerpt: "Self-Sovereign Identity (SSI) and Decentralized Identifiers (DID) are promoted as the future of digital identity. But what's the real adoption picture? What's actually implemented and what's still in proof-of-concept? This article provides a sober assessment of DID/SSI's actual state in 2026."
status: verified
reviewed_by: "butler-exec"
claims_reviewed: true
---

## The Vision: Giving Identity Back to the Individual

In the traditional identity model, your digital identity doesn't belong to you — it belongs to every service provider you register with.

You use Google to sign in to a hundred websites → Google knows which sites you visit. You use WeChat to log into fifty apps → WeChat knows which apps you use. Every time you register for a new service, you create a new "digital分身" — scattered across the internet, beyond your control, with no ability to link them together.

**Self-Sovereign Identity (SSI)** aims to reverse this model:

- You create a digital identity that belongs to you (not granted by some company)
- You obtain Verifiable Credentials (VCs) from trusted institutions — government-issued digital IDs, university-issued digital degrees, bank-issued credit score proofs
- When you need to prove something to a service provider, you present a verifiable credential — instead of registering a new account
- The service provider verifies the credential's signature, trusts the issuer, and doesn't need to store your password

This sounds great. But how close is it to reality?

## The State of W3C Standards

Decentralized identity isn't a single technology — it's a family of standards, centered around:

### DID (Decentralized Identifier)

The W3C DID Core specification became an official W3C Recommendation in July 2022. DID is a globally unique identifier that doesn't require a centralized registration authority. Format:

```
did:example:123456789abcdefghi
```

`did:` is the scheme, `example` is the DID method, followed by method-specific identifier.

Over 150 DID methods are registered. Commonly used ones include:
- `did:web` — domain-based, easiest to integrate with existing infrastructure
- `did:key` — directly derived from a public key, simplest but keys can't be rotated
- `did:ethr` — based on Ethereum addresses
- `did:indy` — based on the Hyperledger Indy ledger (enterprise-grade SSI)
- `did:ion` — based on the Bitcoin blockchain (Sidetree protocol)

**Key milestone**: `did:web` has become the de facto default method, delivering DID's core value without introducing entirely new infrastructure.

### Verifiable Credentials (VC)

The W3C Verifiable Credentials Data Model v1.1 became an official Recommendation in March 2022. VC defines a data model for cryptographically expressing "an issuer's claim about a subject."

A simplified VC structure:

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

Key VC properties:
1. **Issuer binding**: The credential is signed by the issuer; anyone can verify the signature
2. **Self-custody**: The credential is held by the holder, typically in a digital wallet
3. **Selective disclosure**: You can prove "I'm a university graduate" without disclosing your GPA
4. **Revocability**: Issuers can revoke issued credentials via a Status List

VC v2.0 (W3C Working Group Draft) was released in 2024, adding optional JSON-LD context, native JWT and SD-JWT support, and the Bitstring Status List 2021 as a standard revocation mechanism.

### DIDComm / OpenID4VC

In the SSI ecosystem, identity subjects need communication protocols:

- **DIDComm v2**: Secure peer-to-peer communication protocol between DIDs, supporting encrypted messaging
- **OpenID for Verifiable Credentials (OpenID4VC)**: Driven by the OpenID Foundation, extending OpenID Connect's mature mechanisms to VC scenarios, including:
  - OpenID4VCI (Verifiable Credential Issuance): issuer-side protocol
  - OpenID4VP (Verifiable Presentation): presentation/verification protocol
  - SIOPv2 (Self-Issued OpenID Provider v2): self-issued identity provider

OpenID4VC is becoming the de facto SSI protocol standard because it builds on the widely proven OAuth 2.0 / OIDC foundation.

## Real-World Adoption: Who's Using It and Where?

### European Union: eIDAS 2.0 and the EUDI Wallet

This is currently the world's largest DID/VC deployment project. The eIDAS 2.0 regulation (effective May 2024) requires every EU member state to offer citizens a "European Digital Identity Wallet" (EUDI Wallet) by the end of 2026.

This means by the end of 2026, 450 million EU citizens will have a digital wallet capable of storing and presenting verifiable credentials — for:
- Proving age (without disclosing date of birth)
- Opening bank accounts online (presenting digital ID)
- Applying for jobs (presenting digital diplomas)
- Cross-border use of public services

Four large-scale pilot projects (EBSI and POTENTIAL + NOBID + DC4EU + EWC) cover over 150 use cases.

### Enterprise Adoption

- **IBM / Mastercard**: Digital Trust Network, based on Hyperledger Indy
- **Microsoft Entra**: Verified ID, based on did:web + JWT-based VC
- **SpruceID / MATTR / Cheqd**: VC issuance and verification PaaS services
- **Auth0 / Okta**: Integrating Verifiable Credentials into their CIAM product lines

### China: BSN-DID and ChainMaker

China has multiple DID explorations:
- **BSN-DID**: Decentralized identifier system based on the Blockchain Service Network (BSN)
- **ChainMaker**: Enterprise-grade blockchain supporting DID and VC
- **DID-Alliance**: Promoting DID applications across industries

## Reality: Why Hasn't It Gone Mainstream?

### 1. The Chicken-and-Egg Problem

Service providers won't support DID login because users don't have DID wallets. Users don't have DID wallets because no service providers support DID login. eIDAS 2.0 is trying to break this cycle through regulation — mandating that public services accept EUDI Wallets.

### 2. Key Recovery Is a Fatal UX Problem

The biggest practical obstacle: if you lose your DID private key, your entire digital identity is gone. There's no "forgot password" — because there's no centralized password reset service.

Current solutions:
- Social recovery (wait for enough people to approve recovery)
- Hardware Security Module (HSM) backup
- Custodial wallets (reverting to a centralized model, defeating the purpose of decentralization)

### 3. Legal Frameworks Lag Behind Technology

A verifiable credential's cryptographic validity is one thing; its legal validity is another. Does a DID + VC digital ID have the same legal standing as a physical ID card? Under EU eIDAS 2.0, yes. At the federal level in China and the US, it's not yet established.

### 4. Technology Stack Fragmentation

150+ DID methods, multiple communication protocols (DIDComm vs OpenID4VC vs OIDC4IDA), various cryptography suites — it's a fragmented ecosystem. Developers struggle with "what should I use?"

## Autional Strategy: Pragmatic Evolution, Not Radical Revolution

Autional takes a "observe, integrate, evolve" approach to decentralized identity:

**Short-term (2026): DID Exploration**
- Added `did` module in internal architecture: basic DID resolution and creation for `did:web` and `did:key` methods
- identity-service supports mapping user ULIDs to DIDs
- OpenID4VC research and lab verification

**Mid-term (2027): Selective Introduction**
- Support OpenID4VP (Verifiable Presentation) as a new authentication method — users can register and log in by presenting verifiable credentials
- oauth-service supports SD-JWT format tokens for selective disclosure
- Integrate with EUDI Wallet and mainstream VC platforms like SpruceID

**Long-term (2028+): SSI-Ready**
- Allow users to upgrade Autional-managed identities to self-sovereign identities — exported as DID + VC
- Maintain dual-mode operation (standard identity and DID identity) to meet diverse market and compliance requirements

Autional doesn't bet on any specific DID method or blockchain — instead, we build abstractions at the identity infrastructure layer, allowing the upper layers to adapt to technological evolution without rewriting core logic.

## Summary

Decentralized identity isn't a utopian fantasy — in 2026, it has real-world deployments, usable technical standards, and clear evolution paths. But mass adoption is still limited by UX challenges (key recovery), ecosystem fragmentation, and lagging legal frameworks.

For most SaaS developers and enterprises, the pragmatic choice today is: build products with mature centralized identity infrastructure (like Autional) while keeping an eye on decentralized identity standards. When DID/SSI's practicality and legal foundation reach critical mass, the infrastructure layer will be ready for migration.
