'use client';

import React, { useState, useEffect } from 'react';

/**
 * A component that prevents its children from being rendered on the server.
 * This is useful for components that rely on browser-specific APIs or cause
 * hydration mismatches.
 */
export function NoSsr({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // This effect runs only on the client, after the initial render.
    setIsClient(true);
  }, []);

  // On the server or during the initial client render, render nothing.
  // After the component mounts on the client, re-render with the children.
  return <>{isClient ? children : null}</>;
}
