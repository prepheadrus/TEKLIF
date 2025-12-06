import { Metadata } from 'next';
import { InstallationTypesPageContent } from '@/app/installation-types/installation-types-client-page';

export const metadata: Metadata = {
  title: 'Tesisat Kategorileri',
};

export default function InstallationTypesPage() {
    return <InstallationTypesPageContent />;
}
