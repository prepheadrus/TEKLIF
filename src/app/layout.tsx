import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { NoSsr } from '@/components/no-ssr';
import { AppProvider } from '@/components/app/app-provider';
import type { Metadata } from 'next';
import { FirebaseClientProvider } from '@/firebase';
import { AppLayout } from '@/components/app/app-layout';
import { ThemeProvider } from '@/components/app/theme-provider';

export const metadata: Metadata = {
  title: {
    template: '%s | MechQuote',
    default: 'MechQuote - Teklif Yönetim Sistemi',
  },
  description: 'Mekanik tesisat firmaları için modern ve akıllı teklif hazırlama ve maliyet analiz yazılımı.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <NoSsr>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <FirebaseClientProvider>
              <AppProvider>
                <AppLayout>{children}</AppLayout>
              </AppProvider>
            </FirebaseClientProvider>
          </ThemeProvider>
        </NoSsr>
        <Toaster />
      </body>
    </html>
  );
}
