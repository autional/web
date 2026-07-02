// Minimal stub for @authms/shared — provides SEO hooks used by React pages in SSG context

export function usePageTitle(title: string) {
  if (typeof document !== 'undefined') document.title = title;
}

export function usePageMeta(description: string) {
  if (typeof document !== 'undefined') {
    const el = document.querySelector('meta[name="description"]');
    if (el) el.setAttribute('content', description);
  }
}

function injectJsonLd(items: Record<string, any>[]) {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('script[data-jsonld]').forEach((el) => el.remove());
  items.forEach((item) => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-jsonld', '');
    script.textContent = JSON.stringify(item);
    document.head.appendChild(script);
  });
}

export function useSEO(
  { title, description, jsonld }: { title?: string; description?: string; jsonld?: Record<string, any>[] },
  _opts?: { hreflang?: boolean }
) {
  usePageTitle(title || '');
  usePageMeta(description || '');
  if (jsonld && jsonld.length > 0) injectJsonLd(jsonld);
}

export const DEVELOPER_PORTAL_URL = 'https://developer.autional.com';
export const AUTH_PAGES_URL = 'https://auth.autional.com';
export const TRUST_CENTER_URL = 'https://www.autional.com/trust';

export function extractApiError(_err: unknown): string {
  return 'An error occurred';
}

// Mock generated API — not needed on standalone landing site
export const statusSubscriptionsPost = (_body: any) => Promise.resolve({});
