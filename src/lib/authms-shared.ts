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

export function useSEO(
  { title, description }: { title?: string; description?: string },
  _opts?: { hreflang?: boolean }
) {
  usePageTitle(title || '');
  usePageMeta(description || '');
}

export const DEVELOPER_PORTAL_URL = 'https://developer.aotional.com';
export const AUTH_PAGES_URL = 'https://auth.aotional.com';

export function extractApiError(_err: unknown): string {
  return 'An error occurred';
}
