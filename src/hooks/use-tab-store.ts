'use client';
import { create } from 'zustand';

type Tab = {
  href: string;
  label: string;
};

type TabState = {
  tabs: Tab[];
  activeTab: string;
  addTab: (tab: Tab) => void;
  removeTab: (href: string) => void;
  setActiveTab: (href: string) => void;
  isQuoting: boolean;
  setIsQuoting: (isQuoting: boolean) => void;
};

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [],
  activeTab: '/',
  isQuoting: false,

  addTab: (newTab) => {
    const { tabs } = get();
    // Sekme zaten açık değilse ekle
    if (!tabs.some(tab => tab.href === newTab.href)) {
      set({ tabs: [...tabs, newTab] });
    }
    // Her durumda yeni tıklanan sekmeyi aktif yap
    set({ activeTab: newTab.href });
  },

  removeTab: (href) => {
    const { tabs, activeTab } = get();
    const newTabs = tabs.filter(tab => tab.href !== href);
    let newActiveTab = activeTab;

    // Eğer kapatılan sekme aktif ise, yeni aktif sekmeyi belirle
    if (activeTab === href) {
      const removedTabIndex = tabs.findIndex(tab => tab.href === href);
      if (newTabs.length > 0) {
        // Bir önceki sekmeyi aktif yap
        newActiveTab = newTabs[Math.max(0, removedTabIndex - 1)].href;
      } else {
        // Hiç sekme kalmazsa anasayfayı aktif yap
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
