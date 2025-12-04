// This file is intentionally left blank. 
// The print page generates its own full HTML document to ensure isolation.
export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
