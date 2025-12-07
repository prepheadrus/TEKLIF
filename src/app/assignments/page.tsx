
import { Metadata } from 'next';
import { AssignmentsPageContent } from './assignments-client-page';

export const metadata: Metadata = {
  title: 'İş Atamaları',
  description: 'Atanan işleri ve ödeme durumlarını takip edin.',
};

export default function AssignmentsPage() {
  return <AssignmentsPageContent />;
}
