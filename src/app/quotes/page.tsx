import { Metadata } from 'next';
import { QuotesPageContent } from '@/app/quotes/quotes-client-page';

export const metadata: Metadata = {
    title: 'Teklif Arşivi',
};

export default function QuotesPage() {
    return <QuotesPageContent />
}
