export default function PrintLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return (
      <html lang="tr" suppressHydrationWarning>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
            rel="stylesheet"
          />
        </head>
        <body className="font-body antialiased">
            {children}
        </body>
      </html>
    );
  }
