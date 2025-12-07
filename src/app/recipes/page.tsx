'use client'; // Bu direktif, bu dosyanın bir istemci bileşeni olmasını sağlar.

import { Metadata } from "next";
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Dinamik import'u ssr: false ile bir istemci bileşeni içinde kullanıyoruz.
const RecipesPageContent = dynamic(
    () => import('@/app/recipes/recipes-client-page').then(mod => mod.RecipesPageContent),
    { 
        ssr: false, 
        loading: () => <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-16 w-16 animate-spin text-primary" /></div> 
    }
);

// Metadata hala dışarıda tanımlanabilir, ancak bu sayfa bir istemci bileşeni olacak.
// export const metadata: Metadata = {
//     title: 'Reçeteler',
// };

export default function Page() {
    return <RecipesPageContent />;
}
