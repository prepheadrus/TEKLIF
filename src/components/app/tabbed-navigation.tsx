'use client';

import React, { useEffect } from 'react';
import { useTabStore } from '@/hooks/use-tab-store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Home, FileText, Users, Package, Layers, BookCopy } from 'lucide-react';
import { cn } from '@/lib/utils';

// Import Page Contents
import { DashboardContent } from '@/app/dashboard-content/page';
import { QuotesPageContent } from '@/app/quotes/page';
import { CustomersPageContent } from '@/app/customers/page';
import { ProductsPageContent } from '@/app/products/page';
import { InstallationTypesPageContent } from '@/app/installation-types/page';
import { RecipesPageContent } from '@/app/recipes/page';
import QuoteDetailPage from '@/app/quotes/[id]/page';


// Map hrefs to components
const pageContentMap: Record<string, React.ComponentType<any>> = {
  '/': DashboardContent,
  '/quotes': QuotesPageContent,
  '/customers': CustomersPageContent,
  '/products': ProductsPageContent,
  '/installation-types': InstallationTypesPageContent,
  '/recipes': RecipesPageContent,
};

const getIconForHref = (href: string) => {
    if (href.startsWith('/quotes/')) return <FileText className="mr-2 h-4 w-4" />;
    switch (href) {
        case '/': return <Home className="mr-2 h-4 w-4" />;
        case '/quotes': return <FileText className="mr-2 h-4 w-4" />;
        case '/customers': return <Users className="mr-2 h-4 w-4" />;
        case '/products': return <Package className="mr-2 h-4 w-4" />;
        case '/installation-types': return <Layers className="mr-2 h-4 w-4" />;
        case '/recipes': return <BookCopy className="mr-2 h-4 w-4" />;
        default: return null;
    }
}


export function TabbedNavigation() {
  const { tabs, removeTab, activeTab, setActiveTab, setIsQuoting } = useTabStore();

  useEffect(() => {
    const isQuotePage = activeTab.startsWith('/quotes/');
    // Since we are no longer using iframes, we need a different way to detect print pages if necessary
    // For now, we only base it on the quote detail page.
    setIsQuoting(isQuotePage);
  }, [activeTab, setIsQuoting]);

  const renderContent = (href: string) => {
    if (href.startsWith('/quotes/')) {
        return <QuoteDetailPage />;
    }
    const PageComponent = pageContentMap[href];
    return PageComponent ? <PageComponent /> : <div className="p-8">Sayfa bulunamadı: {href}</div>;
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  }

  const handleTabClose = (e: React.MouseEvent, href: string) => {
    e.stopPropagation();
    removeTab(href);
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col h-full bg-slate-100/70">
      <div className="flex-shrink-0 border-b bg-background">
        <TabsList className="h-auto p-0 bg-transparent rounded-none gap-0">
          <TabsTrigger
            value="/"
            className={cn(
                "relative h-10 px-4 py-2 text-sm font-medium border-b-2 rounded-none transition-none focus-visible:ring-0",
                 activeTab === '/' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
            )}
          >
            <Home className="mr-2 h-4 w-4" />
            Anasayfa
          </TabsTrigger>

          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.href}
              value={tab.href}
               className={cn(
                    "group relative h-10 pl-4 pr-8 py-2 text-sm font-medium border-b-2 rounded-none transition-none focus-visible:ring-0",
                    activeTab === tab.href ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
                )}
            >
              {getIconForHref(tab.href)}
              {tab.label}
              <div
                role="button"
                aria-label={`Sekmeyi kapat: ${tab.label}`}
                className="absolute top-1/2 right-1 -translate-y-1/2 h-6 w-6 rounded-full flex items-center justify-center opacity-50 group-hover:opacity-100 hover:bg-muted"
                onClick={(e) => handleTabClose(e, tab.href)}
              >
                <X className="h-4 w-4" />
              </div>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <TabsContent value="/" forceMount={true} className={cn("mt-0 h-full", activeTab !== '/' && 'hidden')}>
            {renderContent('/')}
        </TabsContent>

        {tabs.map((tab) => (
            <TabsContent key={tab.href} value={tab.href} forceMount={true} className={cn("mt-0 h-full", activeTab !== tab.href && 'hidden')}>
                {renderContent(tab.href)}
            </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}
