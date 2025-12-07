'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const RecipesPageContent = dynamic(
    () => import('@/app/recipes/recipes-client-page').then(mod => mod.RecipesPageContent),
    { 
        ssr: false, 
        loading: () => (
            <div className="flex h-full w-full items-center justify-center p-8">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
        )
    }
);

export default function RecipesPage() {
    return <RecipesPageContent />;
}
