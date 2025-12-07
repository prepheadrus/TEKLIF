
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useDoc, useMemoFirebase, useFirestore } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import type { Product, Supplier } from '@/app/products/products-client-page';
import type { InstallationType } from '@/app/installation-types/installation-types-client-page';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, FileText, Edit, ShoppingCart, Info, FileDown } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { QuickAddProduct } from '@/components/app/quick-add-product';

type EnrichedProduct = Product & {
  supplierName?: string;
  installationCategoryName?: string;
};

export function ProductDetailClientPage() {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const productId = params.id as string;
  
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // --- Data Fetching ---
  const productRef = useMemoFirebase(
    () => (firestore && productId ? doc(firestore, 'products', productId) : null),
    [firestore, productId]
  );
  const { data: product, isLoading: isProductLoading, error, refetch: refetchProduct } = useDoc<Product>(productRef);

  const supplierRef = useMemoFirebase(
    () => (firestore && product?.supplierId ? doc(firestore, 'suppliers', product.supplierId) : null),
    [firestore, product?.supplierId]
  );
  const { data: supplier } = useDoc<Supplier>(supplierRef);

  const categoryRef = useMemoFirebase(
    () => (firestore && product?.installationTypeId ? doc(firestore, 'installation_types', product.installationTypeId) : null),
    [firestore, product?.installationTypeId]
  );
  const { data: category } = useDoc<InstallationType>(categoryRef);

  // --- Data Enrichment ---
  const enrichedProduct: EnrichedProduct | null = useMemo(() => {
    if (!product) return null;
    return {
      ...product,
      supplierName: supplier?.name,
      installationCategoryName: category?.name,
    };
  }, [product, supplier, category]);

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(amount);
  };
  
  const handleEditSuccess = () => {
    refetchProduct(); // Refetch the product data after successful edit
  }

  if (isProductLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-4">Ürün detayları yükleniyor...</span>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 p-8">Hata: {error.message}</div>;
  }

  if (!enrichedProduct) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-bold">Ürün Bulunamadı</h1>
        <p className="text-muted-foreground">Aradığınız ürün mevcut değil veya silinmiş olabilir.</p>
        <Button onClick={() => router.push('/products')}>
          <ArrowLeft className="mr-2" /> Ürün Listesine Geri Dön
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="h-full flex flex-col">
         {/* Sub-header */}
         <header className="flex-shrink-0 bg-background/95 backdrop-blur-sm border-b px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" onClick={() => router.push('/products')}>
                <ArrowLeft />
              </Button>
              <div>
                <h1 className="text-xl font-bold">{enrichedProduct.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {enrichedProduct.brand} {enrichedProduct.model && `- ${enrichedProduct.model}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
                <Edit className="mr-2" /> Düzenle
              </Button>
              <Button disabled>
                <ShoppingCart className="mr-2" /> Teklife Ekle
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left Column: Core Info & Pricing */}
          <div className="md:col-span-2 space-y-8">
              {/* Core Info Card */}
              <Card>
                  <CardHeader>
                      <CardTitle>Genel Bilgiler</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="font-medium text-muted-foreground">Ürün Kodu</div>
                          <div className="font-mono">{enrichedProduct.code}</div>

                          <div className="font-medium text-muted-foreground">Marka</div>
                          <div>{enrichedProduct.brand}</div>

                          <div className="font-medium text-muted-foreground">Model</div>
                          <div>{enrichedProduct.model || '-'}</div>

                          <div className="font-medium text-muted-foreground">Birim</div>
                          <div>{enrichedProduct.unit}</div>

                          <div className="font-medium text-muted-foreground">Genel Kategori</div>
                          <div><Badge variant="secondary">{enrichedProduct.category}</Badge></div>

                          <div className="font-medium text-muted-foreground">Tesisat Kategorisi</div>
                          <div>{enrichedProduct.installationCategoryName ? <Badge variant="outline">{enrichedProduct.installationCategoryName}</Badge> : '-'}</div>
                      </div>
                  </CardContent>
              </Card>

              {/* Pricing Card */}
              <Card>
                  <CardHeader>
                      <CardTitle>Fiyatlandırma</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="font-medium text-muted-foreground">Birim Alış Fiyatı</div>
                          <div className="font-semibold text-red-600">{formatCurrency(enrichedProduct.basePrice, enrichedProduct.currency)}</div>

                           <div className="font-medium text-muted-foreground">Tedarikçi</div>
                          <div>{enrichedProduct.supplierName || 'Belirtilmemiş'}</div>

                          <Separator className="col-span-2" />

                          <div className="font-medium text-muted-foreground">Birim Liste Satış Fiyatı</div>
                          <div className="font-semibold text-green-600">{formatCurrency(enrichedProduct.listPrice, enrichedProduct.currency)}</div>
                          
                          <div className="font-medium text-muted-foreground">Varsayılan İskonto</div>
                          <div>%{enrichedProduct.discountRate * 100}</div>
                      </div>
                  </CardContent>
              </Card>
          </div>

          {/* Right Column: Description & Specs */}
          <div className="space-y-8">
              <Card>
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2"><Info /> Açıklama</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {enrichedProduct.description || 'Bu ürün için bir açıklama girilmemiş.'}
                      </p>
                  </CardContent>
              </Card>
              <Card>
                  <CardHeader>
                      <CardTitle>Teknik Özellikler</CardTitle>
                  </CardHeader>
                   <CardContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {enrichedProduct.technicalSpecifications || 'Bu ürün için teknik özellik girilmemiş.'}
                      </p>
                  </CardContent>
              </Card>
               <Card>
                  <CardHeader>
                      <CardTitle>Dökümanlar</CardTitle>
                  </CardHeader>
                   <CardContent>
                     {enrichedProduct.brochureUrl ? (
                       <Button asChild variant="outline">
                         <a href={enrichedProduct.brochureUrl} target="_blank" rel="noopener noreferrer">
                           <FileDown className="mr-2" /> Broşürü Görüntüle
                         </a>
                       </Button>
                     ) : (
                       <p className="text-sm text-muted-foreground">Bu ürün için bir döküman yüklenmemiş.</p>
                     )}
                  </CardContent>
              </Card>
          </div>
        </main>
      </div>
      <QuickAddProduct
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={handleEditSuccess}
        existingProduct={enrichedProduct}
      />
    </>
  );
}

    