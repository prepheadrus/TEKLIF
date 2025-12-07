
import { Metadata } from 'next';
import { ProductDetailClientPage } from './product-detail-client-page';

export const metadata: Metadata = {
  title: 'Ürün Detayı',
};

export default function ProductDetailPage() {
    return <ProductDetailClientPage />;
}
