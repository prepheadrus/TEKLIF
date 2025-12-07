import { Metadata } from 'next';
import { RecipesPageContent } from '@/app/recipes/recipes-client-page';

export const metadata: Metadata = {
    title: 'Reçeteler',
};

export default function RecipesPage() {
    return <RecipesPageContent />;
}
