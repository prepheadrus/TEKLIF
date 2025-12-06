'use client';
import { create } from 'zustand';

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
    // Prevent adding a tab that already exists
    if (!tabs.some(tab => tab.href === newTab.href)) {
      set({ tabs: [...tabs, newTab] });
    }
    set({ activeTab: newTab.href });
  },

  removeTab: (href) => {
    const { tabs, activeTab } = get();
    const newTabs = tabs.filter(tab => tab.href !== href);
    let newActiveTab = activeTab;

    // If the closed tab was the active one, decide which tab to activate next
    if (activeTab === href) {
      const removedTabIndex = tabs.findIndex(tab => tab.href === href);
      if (newTabs.length > 0) {
        // Try to activate the previous tab, or the first one if it was the first
        newActiveTab = newTabs[Math.max(0, removedTabIndex - 1)].href;
      } else {
        // If no tabs are left, activate the homepage
        newActiveTab = '/';
      }
    }

    set({ tabs: newTabs, activeTab: newActiveTab });
  },

  setActiveTab: (href) => {
    set({ activeTab: href });
  },

  setIsQuoting: (isQuoting: boolean) => {
    set({ isQuoting });
  }
}));
