
import { Metadata } from 'next';
import { CustomerDetailClientPage } from './customer-detail-client-page';

export const metadata: Metadata = {
  title: 'Müşteri Detayı',
};

export default function CustomerDetailPage() {
    return <CustomerDetailClientPage />;
}
