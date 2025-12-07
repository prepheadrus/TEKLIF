'use client';

import { useEffect, type ReactNode } from 'react';
import { useAuth, initiateAnonymousSignIn, useUser } from '@/firebase';
import { usePathname } from 'next/navigation';

export function AppProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    // When auth is ready and we determine there's no user, initiate sign-in.
    // This will run in every new tab, ensuring each tab is authenticated.
    if (!isUserLoading && !user && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [isUserLoading, user, auth]);

  const pathname = usePathname();
  const isPrintPage = pathname?.includes('/print');

  // For print pages, we don't need any special layout, just the content.
  if (isPrintPage) {
    return <main>{children}</main>;
  }

  // Pass children through to the next level (AppLayout)
  return <>{children}</>;
}
