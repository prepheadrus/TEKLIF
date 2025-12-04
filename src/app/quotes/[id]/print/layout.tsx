import "@/app/globals.css";

export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="print-layout">{children}</div>;
}
