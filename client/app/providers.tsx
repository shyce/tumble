'use client';

import { SessionProvider } from 'next-auth/react';
import { TumbleToaster } from '@/components/ui/tumble-toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <TumbleToaster />
    </SessionProvider>
  );
}