
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
import { PlusCircle, MoreHorizontal, Edit, Trash2, Loader2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { QuickAddProduct } from '@/components/app/quick-add-product';

type Product = {
  id: string;
  code: string;
  name: string;
  brand: string;
  category: string; // This is the general category
  unit: string;
  listPrice: number;
  currency: 'TRY' | 'USD' | 'EUR';
  discountRate: number;
  installationTypeId?: string;
};

type InstallationType = {
    id: string;
    name: string;
    parentId?: string | null;
}

const buildCategoryNameMap = (categories: InstallationType[]): Map<string, string> => {
    const categoryMap: { [id: string]: { id: string; name: string; children: any[], parentId?: string | null } } = {};
    categories.forEach(cat => {
        categoryMap[cat.id] = { ...cat, children: [] };
    });

    const roots: any[] = [];
    categories.forEach(cat => {
        if (cat.parentId && categoryMap[cat.parentId]) {
            categoryMap[cat.parentId].children.push(categoryMap[cat.id]);
        } else {
            roots.push(categoryMap[cat.id]);
        }
    });
    
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
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const productsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'products'), orderBy('name', 'asc')) : null),
    [firestore]
  );
  const { data: products, isLoading, error, refetch } = useCollection<Product>(productsQuery);
  
  const installationTypesRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'installation_types') : null),
    [firestore]
  );
  const { data: installationTypes, isLoading: isLoadingInstallationTypes } = useCollection<InstallationType>(installationTypesRef);
  
  const categoryNameMap = useMemo(() => {
    if (!installationTypes) return new Map();
    return buildCategoryNameMap(installationTypes);
  }, [installationTypes]);

  const handleDeleteProduct = async (productId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'products', productId));
      toast({ title: 'Başarılı', description: 'Ürün silindi.' });
      refetch();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Hata', description: `Ürün silinemedi: ${error.message}` });
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
  
  const tableIsLoading = isLoading || isLoadingInstallationTypes;

  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Ürünler</h2>
          <p className="text-muted-foreground">Ürün ve hizmetlerinizi yönetin.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setIsAddProductOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Yeni Ürün Ekle
          </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Ürün Listesi</CardTitle>
          <CardDescription>Tüm ürün ve hizmetleriniz.</CardDescription>
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
                <TableHead>Marka</TableHead>
                <TableHead>Tesisat Kategorisi</TableHead>
                <TableHead>Liste Fiyatı</TableHead>
                <TableHead><span className="sr-only">İşlemler</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableIsLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    <Loader2 className="mx-auto my-4 h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : error ? (
                 <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-red-600">
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
                    <TableCell>{product.brand}</TableCell>
                    <TableCell>
                      {product.installationTypeId && (
                        <Badge variant="outline">{categoryNameMap.get(product.installationTypeId) || 'Bilinmiyor'}</Badge>
                      )}
                    </TableCell>
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
                          <DropdownMenuItem onClick={() => alert('Düzenleme yakında eklenecek.')}>
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
                  <TableCell colSpan={5} className="h-24 text-center">
                    Henüz ürün bulunmuyor.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <QuickAddProduct
        isOpen={isAddProductOpen}
        onOpenChange={setIsAddProductOpen}
        onProductAdded={refetch}
      />
    </>
  );
}
