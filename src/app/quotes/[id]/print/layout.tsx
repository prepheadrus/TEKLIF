import React from 'react';

// This layout is now a simple pass-through to prevent hydration errors.
// The main app layout will be used, and its elements (like the navbar)
// will be hidden via CSS on the print page.
export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
