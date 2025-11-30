'use client';

// This layout is specifically for the print view.
// It renders its children directly, without the main dashboard chrome (nav, header, etc.)
// to provide a clean, printable page.
export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
