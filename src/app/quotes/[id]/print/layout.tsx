export default function PrintLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return (
      <body className="font-body antialiased bg-white">
            {children}
      </body>
    );
  }
