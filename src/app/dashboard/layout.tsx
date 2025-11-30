
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import { Home, Users, Package, FileText, Settings, LogOut, Bot } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2">
              <Bot size={24} className="text-primary" />
              <h1 className="text-xl font-semibold">MechQuote</h1>
            </div>
          </SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/dashboard'}>
                    <Link href="/dashboard">
                        <Home />
                        Anasayfa
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/customers')}>
                    <Link href="/dashboard/customers">
                        <Users />
                        Müşteriler
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/products')}>
                    <Link href="/dashboard/products">
                        <Package />
                        Ürünler
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/quotes')}>
                    <Link href="/dashboard/quotes">
                        <FileText />
                        Teklifler
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarFooter>
            <SidebarGroup>
              <SidebarGroupLabel>Ayarlar</SidebarGroupLabel>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Settings />
                  Genel Ayarlar
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarGroup>
            <div className="flex items-center justify-between p-2">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="https://picsum.photos/seed/1/100/100" />
                  <AvatarFallback>MK</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">Murat Kaya</span>
              </div>
              <Button variant="ghost" size="icon">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>
        <div className="flex-1 flex flex-col">
           <header className="flex h-14 items-center justify-between border-b bg-background px-4">
               <SidebarTrigger className="md:hidden" />
               <h2 className="text-lg font-semibold">Yönetim Paneli</h2>
           </header>
           <main className="flex-1 overflow-y-auto p-4">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
