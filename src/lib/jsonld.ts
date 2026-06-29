export function getOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'AuthMS',
    legalName: '深圳市天艺网络技术有限公司',
    url: 'https://iam.tianv.com',
    logo: 'https://iam.tianv.com/logo.png',
    description: '企业级身份认证与访问管理平台',
    foundingDate: '2024',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      email: 'tianv@tianv.com',
    },
    sameAs: [
      'https://github.com/authms',
    ],
  };
}

export function getProductSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'AuthMS',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: '0',
      highPrice: '999',
      priceCurrency: 'CNY',
      offerCount: '3',
    },
    description: '企业级身份认证与访问管理（IAM）平台，提供 SSO、MFA、多租户、审计合规、开发者 API 等核心能力。',
  };
}

