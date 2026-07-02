export function getOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Autional',
    legalName: 'Autional',
    url: 'https://www.autional.com',
    logo: 'https://www.autional.com/logo-mark.svg',
    description: 'Enterprise Identity & Access Management platform — authentication, SSO, MFA, multi-tenancy, audit, and developer APIs.',
    foundingDate: '2024',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      email: 'hello@autional.com',
    },
    sameAs: [
      'https://github.com/autional',
      'https://twitter.com/autional',
      'https://www.linkedin.com/company/autional',
    ],
  };
}

export function getProductSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Autional',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: '0',
      highPrice: '299',
      priceCurrency: 'USD',
      offerCount: '3',
    },
    description: 'Enterprise Identity & Access Management (IAM) platform providing SSO, MFA, multi-tenancy, audit compliance, and developer APIs for AI-generated applications.',
  };
}
