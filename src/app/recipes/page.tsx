
import { Metadata } from 'next';
import { RecipesPageContent } from './recipes-client-page';

export const metadata: Metadata = {
  title: 'Reçeteler',
  description: 'Ürün reçeteleri oluşturun ve yönetin.',
};

export default function RecipesPage() {
    return <RecipesPageContent />;
}
