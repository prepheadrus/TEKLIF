
'use client'; // Bu satır dosyayı bir İstemci Bileşeni'ne dönüştürür.

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import type { Metadata } from 'next';

// RecipesPageContent bileşenini ssr: false ile dinamik olarak yüklüyoruz.
// Bu, sadece istemci tarafında render edilmesini sağlar.
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

// Metadata hala bir Sunucu Bileşeni özelliği gibi dışa aktarılabilir.
// Ancak, bu sayfada 'use client' olduğu için build sırasında statik olarak analiz edilir.
// export const metadata: Metadata = {
//     title: 'Reçeteler',
// };

export default function RecipesPage() {
    return <RecipesPageContent />;
}
