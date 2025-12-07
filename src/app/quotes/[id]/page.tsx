import { Metadata } from 'next';
import { QuoteDetailClientPage } from './quote-detail-client-page';

export const metadata: Metadata = {
  title: 'Teklif Detayı',
};

export default function QuoteDetailPage({ params }: { params: { id: string } }) {
    return <QuoteDetailClientPage params={params} />;
}
