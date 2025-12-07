
import { Metadata } from 'next';
import { ProductsPageContent } from '@/app/products/products-client-page';

export const metadata: Metadata = {
    title: 'Ürün ve Malzemeler',
};

export default function ProductsPage() {
    return <ProductsPageContent />;
}

    