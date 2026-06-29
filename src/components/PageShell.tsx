import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router';
import enI18n from '@/i18n';
import type { ReactNode } from 'react';

export default function PageShell({ children }: { children: ReactNode }) {
  return (
    <I18nextProvider i18n={enI18n}>
      <MemoryRouter initialEntries={['/']}>
        {children}
      </MemoryRouter>
    </I18nextProvider>
  );
}
