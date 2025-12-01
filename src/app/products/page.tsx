
'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    PlusCircle,
    MoreHorizontal,
    Edit,
    Trash2,
    Loader2,
    Search,
    UploadCloud
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, writeBatch, getDocs, where } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { QuickAddProduct } from '@/components/app/quick-add-product';
import { productSeedData } from '@/lib/product-seed-data';

// Combined type for a product/material
export type Product = {
  id: string;
  // Core Info
  code: string;
  name: string;
  brand: string;
  unit: string;
  // Sales Info
  listPrice: number;
  currency: 'TRY' | 'USD' | 'EUR';
  discountRate: number; // For sales
  // Cost Info
  basePrice: number;
  supplierId?: string;
  // Categorization
  category: string; // General category
  installationTypeId?: string;
};

export type Supplier = {
  id: string;
  name: string;
};

type InstallationType = {
    id: string;
    name: string;
    parentId?: string | null;
}

const buildCategoryNameMap = (categories: InstallationType[]): Map<string, string> => {
    const categoryMap: { [id: string]: { id: string; name: string; children: any[], parentId?: string | null } } = {};
    if (categories) {
        categories.forEach(cat => {
            categoryMap[cat.id] = { ...cat, children: [] };
        });
    }

    const roots: any[] = [];
    if (categories) {
        categories.forEach(cat => {
            if (cat.parentId && categoryMap[cat.parentId]) {
                categoryMap[cat.parentId].children.push(categoryMap[cat.id]);
            } else {
                roots.push(categoryMap[cat.id]);
            }
        });
    }
    
    const nameMap = new Map<string, string>();
    const traverse = (node: { id: string; name: string; children: any[] }, prefix: string) => {
        const currentName = prefix ? `${prefix} > ${node.name}` : node.name;
        nameMap.set(node.id, currentName);
        node.children.forEach(child => traverse(child, currentName));
    };

    roots.sort((a,b) => a.name.localeCompare(b.name)).forEach(root => traverse(root, ''));
    return nameMap;
};

export default function ProductsPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSeeding, setIsSeeding] = useState(false);

  // --- Data Fetching ---
  const productsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'products'), orderBy('name', 'asc')) : null),
    [firestore]
  );
  const { data: products, isLoading: isLoadingProducts, error, refetch: refetchProducts } = useCollection<Product>(productsQuery);
  
  const installationTypesRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'installation_types') : null),
    [firestore]
  );
  const { data: installationTypes, isLoading: isLoadingInstallationTypes } = useCollection<InstallationType>(installationTypesRef);
  
  const suppliersQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'suppliers')) : null),
    [firestore]
  );
  const { data: suppliers, isLoading: isLoadingSuppliers, refetch: refetchSuppliers } = useCollection<Supplier>(suppliersQuery);


  // --- Memoized Maps for Display ---
  const categoryNameMap = useMemo(() => {
    if (!installationTypes) return new Map();
    return buildCategoryNameMap(installationTypes);
  }, [installationTypes]);

  const supplierMap = useMemo(() => {
    if (!suppliers) return new Map<string, string>();
    return new Map(suppliers.map(s => [s.id, s.name]));
  }, [suppliers]);
  
  
  // --- Event Handlers ---
  const handleOpenAddDialog = () => {
    setEditingProduct(null);
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (product: Product) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  };

  const handleDeleteProduct = (productId: string) => {
    if (!firestore) return;
    deleteDocumentNonBlocking(doc(firestore, 'products', productId));
    toast({ title: 'Başarılı', description: 'Ürün silindi.' });
    refetchProducts();
  };
  
  const handleSeedProducts = async () => {
    if (!firestore) return;
    setIsSeeding(true);
    toast({ title: 'Başlatılıyor...', description: 'Örnek ürün/malzeme verileri veritabanına yükleniyor.' });

    try {
      const batch = writeBatch(firestore);
      const suppliersCollection = collection(firestore, 'suppliers');
      const productsCollection = collection(firestore, 'products');
      const seededSupplierIds = new Map<string, string>();

      // 1. Create or find suppliers
      const uniqueSupplierNames = [...new Set(productSeedData.map(m => m.supplierName))];

      for (const name of uniqueSupplierNames) {
        const q = query(suppliersCollection, where("name", "==", name));
        const existingSupplierSnap = await getDocs(q);
        if (existingSupplierSnap.empty) {
          const newSupplierRef = doc(suppliersCollection);
          batch.set(newSupplierRef, { name, contactEmail: `${name.toLowerCase().replace(/ /g, '.')}@example.com` });
          seededSupplierIds.set(name, newSupplierRef.id);
        } else {
          seededSupplierIds.set(name, existingSupplierSnap.docs[0].id);
        }
      }

      // 2. Create products with supplier IDs
      for (const product of productSeedData) {
        const supplierId = seededSupplierIds.get(product.supplierName);
        if (!supplierId) {
          console.warn(`Tedarikçi bulunamadı: ${product.supplierName}`);
          continue;
        }
        const newProductRef = doc(productsCollection);
        const { supplierName, ...restOfProduct } = product;
        batch.set(newProductRef, { 
            ...restOfProduct, 
            supplierId,
            // Add default sales values if not present
            listPrice: restOfProduct.basePrice * 1.25, // Default list price = 25% above cost
            discountRate: 0,
            code: `CODE-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            brand: 'Çeşitli',
            category: 'Genel',
         });
      }

      await batch.commit();
      toast({ title: 'Başarılı!', description: 'Örnek ürünler ve tedarikçiler başarıyla yüklendi.' });
      refetchProducts();
      refetchSuppliers();
    } catch (error: any) {
      console.error("Seeding error:", error);
      toast({ variant: 'destructive', title: 'Hata', description: `Veri yüklenemedi: ${error.message}` });
    } finally {
      setIsSeeding(false);
    }
  };


  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(amount);
  };
  
  const filteredProducts = products?.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.installationTypeId && categoryNameMap.get(p.installationTypeId)?.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const tableIsLoading = isLoadingProducts || isLoadingInstallationTypes || isLoadingSuppliers;

  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Ürünler / Malzemeler</h2>
          <p className="text-muted-foreground">Tekliflerinizde kullandığınız tüm ürün, malzeme ve hizmetleri yönetin.</p>
        </div>
        <div className="flex items-center space-x-2">
           <Button onClick={handleSeedProducts} disabled={isSeeding} variant="outline">
                {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                Örnek Ürünleri Yükle
            </Button>
          <Button onClick={handleOpenAddDialog}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Yeni Ürün Ekle
          </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Ürün Listesi</CardTitle>
          <CardDescription>Tüm ürün, malzeme ve hizmetleriniz.</CardDescription>
          <div className="relative pt-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ürün adı, kodu, markası veya kategorisi ara..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad</TableHead>
                <TableHead>Tedarikçi</TableHead>
                <TableHead>Tesisat Kategorisi</TableHead>
                <TableHead>Birim Alış Fiyatı</TableHead>
                <TableHead>Birim Satış Fiyatı</TableHead>
                <TableHead><span className="sr-only">İşlemler</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableIsLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    <Loader2 className="mx-auto my-4 h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : error ? (
                 <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-red-600">
                        Ürünler yüklenirken bir hata oluştu: {error.message}
                    </TableCell>
                </TableRow>
              ) : filteredProducts && filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                        <div>{product.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{product.code}</div>
                    </TableCell>
                    <TableCell>
                      {product.supplierId && (
                        <Badge variant="secondary">{supplierMap.get(product.supplierId) || 'Bilinmiyor'}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {product.installationTypeId && (
                        <Badge variant="outline">{categoryNameMap.get(product.installationTypeId) || 'Bilinmiyor'}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatCurrency(product.basePrice || 0, product.currency)}</TableCell>
                    <TableCell>{formatCurrency(product.listPrice, product.currency)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Menüyü aç</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleOpenEditDialog(product)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Düzenle
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Sil
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Bu işlem geri alınamaz. Bu ürünü kalıcı olarak silecektir.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>İptal</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteProduct(product.id)} className="bg-destructive hover:bg-destructive/90">
                                  Evet, Sil
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    Henüz ürün bulunmuyor. Örnek verileri yükleyebilir veya yeni ürün ekleyebilirsiniz.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <QuickAddProduct
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={() => {
            refetchProducts();
            refetchSuppliers();
        }}
        existingProduct={editingProduct}
      />
    </>
  );
}
