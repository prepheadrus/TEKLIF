import { Metadata } from 'next';
import { PrintQuoteClientPage } from './print-quote-client-page';

export const metadata: Metadata = {
    title: 'Teklif Yazdır',
};

export default function PrintQuotePage() {
    return <PrintQuoteClientPage />;
}
