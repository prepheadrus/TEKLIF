'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth, initiateAnonymousSignIn, useUser } from '@/firebase';
import { Building, Home, Users, Package, FileText, Layers, BookCopy, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const navItems = [
    { href: '/', label: 'Anasayfa', icon: Home, target: 'anasayfa' },
    { href: '/quotes', label: 'Teklifler', icon: FileText, target: 'teklifler' },
    { href: '/customers', label: 'Müşteriler', icon: Users, target: 'musteriler' },
    { href: '/products', label: 'Ürünler', icon: Package, target: 'urunler' },
    { href: '/installation-types', label: 'Kategoriler', icon: Layers, target: 'kategoriler' },
    { href: '/recipes', label: 'Reçeteler', icon: BookCopy, target: 'receteler' },
];

const NavItem = ({ href, label, target }: { href: string, label: string, target: string }) => {
    const pathname = usePathname();
    const isActive = pathname === href;

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        window.open(href, target); 
    }

    return (
        <a 
            href={href}
            onClick={handleClick}
            className={cn(
                "px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                isActive 
                    ? "text-primary bg-primary/10" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            )}
        >
            {label}
        </a>
    )
}

const MobileNav = () => {
    const [open, setOpen] = useState(false);

    const handleLinkClick = (e: React.MouseEvent, href: string, target: string) => {
        e.preventDefault();
        window.open(href, target);
        setOpen(false);
    }
    
    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Menüyü aç</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left">
                 <a href="/" onClick={(e) => handleLinkClick(e, '/', 'anasayfa')} className="flex items-center gap-2 font-bold text-slate-800 mb-8">
                    <Building className="h-6 w-6 text-primary" />
                    <span className="text-lg">MechQuote</span>
                </a>
                <nav className="flex flex-col gap-2">
                    {navItems.map((item) => (
                        <a 
                            key={item.href}
                            href={item.href}
                            onClick={(e) => handleLinkClick(e, item.href, item.target)}
                            className="text-lg text-slate-700 hover:text-primary"
                        >
                            {item.label}
                        </a>
                    ))}
                </nav>
            </SheetContent>
        </Sheet>
    )
}


export function AppProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    if (!isUserLoading && !user && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [isUserLoading, user, auth]);

  const pathname = usePathname();
  const isPrintPage = pathname?.includes('/print');

  if (isPrintPage) {
    return <main>{children}</main>;
  }
  
  return (
    <div className={cn("flex flex-col min-h-screen bg-slate-50")}>
      <header className="sticky top-0 z-30 flex-shrink-0 bg-white/95 backdrop-blur-sm border-b border-slate-200 print-hidden">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-8">
                    <a href="/" onClick={(e) => { e.preventDefault(); window.open('/', 'anasayfa'); }} className="flex items-center gap-2 font-bold text-slate-800">
                        <Building className="h-6 w-6 text-primary" />
                        <span className="text-lg">MechQuote</span>
                    </a>
                    <nav className="hidden md:flex gap-1">
                         {navItems.map((item) => (
                            <NavItem key={item.href} href={item.href} label={item.label} target={item.target} />
                        ))}
                    </nav>
                </div>
                <div className="flex items-center gap-4">
                     <div id="exchange-rate-portal"></div>
                    <div className="md:hidden">
                        <MobileNav />
                    </div>
                </div>
            </div>
        </div>
        <div id="sub-header-portal"></div>
      </header>
       <main className="flex-1 flex flex-col">
            {children}
        </main>
    </div>
  );
}
