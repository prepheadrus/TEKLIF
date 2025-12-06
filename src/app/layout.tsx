'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { useAuth, initiateAnonymousSignIn, useUser } from '@/firebase';
import { Building, Home, Users, Package, FileText, Layers, BookCopy, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { NoSsr } from '@/components/no-ssr';


const navItems = [
    { href: '/', label: 'Anasayfa', icon: Home },
    { href: '/quotes', label: 'Teklifler', icon: FileText },
    { href: '/customers', label: 'Müşteriler', icon: Users },
    { href: '/products', label: 'Ürünler', icon: Package },
    { href: '/installation-types', label: 'Kategoriler', icon: Layers },
    { href: '/recipes', label: 'Reçeteler', icon: BookCopy },
];

function AppInitializer({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const pathname = usePathname();

  useEffect(() => {
    if (!isUserLoading && !user && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [isUserLoading, user, auth]);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 flex-shrink-0 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm print-hidden-on-print-page">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-8">
                    <Link href="/" className="flex items-center gap-2 font-bold text-slate-800">
                        <Building className="h-6 w-6 text-primary" />
                        <span className="text-lg">MechQuote</span>
                    </Link>
                    <nav className="hidden md:flex gap-1">
                         {navItems.map((item) => (
                            <NavItem key={item.href} href={item.href} label={item.label} />
                        ))}
                    </nav>
                </div>
                <div className="flex items-center gap-4">
                     {/* Portal target for exchange rates. It's placed here in the main layout. */}
                     <div id="exchange-rate-portal"></div>
                    <div className="md:hidden">
                        <MobileNav />
                    </div>
                </div>
            </div>
        </div>
        {/* This is the portal target for the secondary, sticky header in the quote detail page. */}
        <div id="sub-header-portal"></div>
      </header>
       <main className="flex-1 flex flex-col">
            {children}
        </main>
    </div>
  );
}

const NavItem = ({ href, label }: { href: string, label: string }) => {
    const pathname = usePathname();
    const isActive = (pathname === '/' && href === '/') || (href !== '/' && pathname.startsWith(href));

    return (
        <Link 
            href={href}
            className={cn(
                "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive 
                    ? "text-primary bg-primary/10" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            )}
        >
            {label}
        </Link>
    )
}

const MobileNav = () => {
    const [open, setOpen] = useState(false);
    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="print-hidden-on-print-page">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Menüyü aç</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left">
                 <Link href="/" className="flex items-center gap-2 font-bold text-slate-800 mb-8">
                    <Building className="h-6 w-6 text-primary" />
                    <span className="text-lg">MechQuote</span>
                </Link>
                <nav className="flex flex-col gap-2">
                    {navItems.map((item) => (
                        <Link 
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className="text-lg text-slate-700 hover:text-primary"
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>
            </SheetContent>
        </Sheet>
    )
}

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
        <FirebaseClientProvider>
          <AppInitializer>{children}</AppInitializer>
        </FirebaseClientProvider>
        <NoSsr>
          <Toaster />
        </NoSsr>
      </body>
    </html>
  );
}
