import { Metadata } from 'next';
import { QuoteDetailClientPage } from './quote-detail-client-page';

export const metadata: Metadata = {
  title: 'Teklif Detayı',
};

export default function QuoteDetailPage() {
    return <QuoteDetailClientPage />;
}
