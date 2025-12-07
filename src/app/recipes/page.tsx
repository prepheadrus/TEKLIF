import { Metadata } from "next";
import { RecipesPage } from '@/app/recipes/recipes-client-page';

export const metadata: Metadata = {
    title: 'Reçeteler',
};

export default function Page() {
    return <RecipesPage />;
}
