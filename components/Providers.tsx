'use client';

import { SessionProvider } from 'next-auth/react';
import PushNavigationListener from '@/components/PushNavigationListener';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PushNavigationListener />
      {children}
    </SessionProvider>
  );
}
