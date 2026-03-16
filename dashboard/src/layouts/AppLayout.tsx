import React from 'react';
import Providers from '@/components/providers/Providers';

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="min-h-screen bg-background">
        {children}
      </div>
    </Providers>
  );
}
