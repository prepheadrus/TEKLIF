'use client';
import { create } from 'zustand';
import { usePathname, useRouter } from 'next/navigation';

type Tab = {
  href: string;
  label: string;
};

type TabState = {
  tabs: Tab[];
  activeTab: string;
  isQuoting: boolean;
  addTab: (tab: Tab) => void;
  removeTab: (href: string) => void;
  setActiveTab: (href: string) => void;
  setIsQuoting: (isQuoting: boolean) => void;
};

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [],
  activeTab: '/',
  isQuoting: false,

  addTab: (newTab) => {
    const { tabs } = get();
    // Prevent adding a tab that already exists, but still make it active
    if (!tabs.some(tab => tab.href === newTab.href)) {
      set({ tabs: [...tabs, newTab] });
    }
    set({ activeTab: newTab.href });
  },

  removeTab: (href) => {
    const { tabs, activeTab, setActiveTab } = get();
    const newTabs = tabs.filter(tab => tab.href !== href);
    let newActiveTab = activeTab;

    if (activeTab === href) {
      const removedTabIndex = tabs.findIndex(tab => tab.href === href);
      if (newTabs.length > 0) {
        newActiveTab = newTabs[Math.max(0, removedTabIndex - 1)].href;
      } else {
        newActiveTab = '/';
      }
    }
    
    set({ tabs: newTabs });
    // Directly call setActiveTab to handle the active state change
    setActiveTab(newActiveTab);
  },

  setActiveTab: (href) => {
    set({ activeTab: href });
  },
  
  setIsQuoting: (isQuoting: boolean) => {
    set({ isQuoting });
  }
}));
