'use client';
import { DashboardContent } from '@/app/dashboard-content/page';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Yönetim Paneli',
};

export default function HomePage() {
  return (
    <DashboardContent />
  );
}
