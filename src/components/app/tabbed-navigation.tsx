'use client';
import { useEffect } from 'react';
import { useTabStore } from '@/hooks/use-tab-store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { X, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';

export function TabbedNavigation() {
  const { tabs, activeTab, setActiveTab, removeTab, setIsQuoting } = useTabStore();
  const pathname = usePathname();

  useEffect(() => {
    // Check if the current visible page is a quote detail page
    const isQuotePage = tabs.some(tab => tab.href === activeTab && tab.href?.startsWith('/quotes/'));
    const isPrintPage = pathname.includes('/print');

    if (isQuotePage || isPrintPage) {
        setIsQuoting(true);
    } else {
        setIsQuoting(false);
    }
  }, [activeTab, tabs, setIsQuoting, pathname]);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full">
      <div className="flex-shrink-0 border-b">
        <TabsList className="h-auto p-0 bg-transparent rounded-none gap-1">
          <TabsTrigger
            value="/"
            className={cn(
                "relative h-10 px-4 py-2 text-sm font-medium border-b-2 border-transparent rounded-none transition-none focus-visible:ring-0",
                "data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none"
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
                    "group relative h-10 pl-4 pr-8 py-2 text-sm font-medium border-b-2 border-transparent rounded-none transition-none focus-visible:ring-0",
                    "data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none"
                )}
            >
              {tab.label}
              <div
                role="button"
                aria-label={`Sekmeyi kapat: ${tab.label}`}
                className="absolute top-1/2 right-1 -translate-y-1/2 h-6 w-6 rounded-full flex items-center justify-center opacity-50 group-hover:opacity-100 hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTab(tab.href);
                }}
              >
                <X className="h-4 w-4" />
              </div>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="/" className="flex-1 bg-slate-100/70 p-0">
        <iframe src="/dashboard-content" className="w-full h-full border-0" title="Anasayfa" />
      </TabsContent>

      {tabs.map((tab) => (
        <TabsContent key={tab.href} value={tab.href} className="flex-1 mt-0">
          <iframe src={tab.href} className="w-full h-full border-0" title={tab.label} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

// Create a new page component for the dashboard content
export function DashboardContentPage() {
    // This could be the original content of your dashboard page
    return (
        <div>
            <h1>Dashboard Content</h1>
            <p>Welcome to the main dashboard.</p>
        </div>
    );
}
