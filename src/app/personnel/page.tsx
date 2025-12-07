
import { Metadata } from 'next';
import { PersonnelPageContent } from './personnel-client-page';

export const metadata: Metadata = {
  title: 'Ustalar ve Personel',
  description: 'Ekibinizi yönetin, iş atamaları yapın ve ödemeleri takip edin.',
};

export default function PersonnelPage() {
  return <PersonnelPageContent />;
}

    