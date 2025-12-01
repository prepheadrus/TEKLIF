export default function PrintLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return (
      <html lang="tr" suppressHydrationWarning>
        <body>
            {children}
        </body>
      </html>
    );
  }
