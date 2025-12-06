'use client';
import { TabbedNavigation } from '@/components/app/tabbed-navigation';

export default function DashboardPage() {
  return (
    <div className="flex-1 flex flex-col h-full">
      <TabbedNavigation />
    </div>
  );
}
